# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SyncFollowedAnnouncementsWorker do
  subject { described_class.new }

  let(:publisher_role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_follower_announcements]) }
  let(:author) { Fabricate(:user, role: publisher_role).account }
  let(:follower) { Fabricate(:account) }
  let!(:announcement) { Fabricate(:announcement, account: author) }

  before do
    redis.set("subscribed:timeline:#{follower.id}", '1')
    allow(redis).to receive(:publish)
  end

  it 'pushes the announcements of a followed account' do
    follower.follow!(author)

    subject.perform(follower.id, author.id)

    expect(redis).to have_received(:publish).with("timeline:#{follower.id}", include('"event":"announcement"', announcement.text))
  end

  it 'removes the announcements of an unfollowed account' do
    subject.perform(follower.id, author.id)

    expect(redis).to have_received(:publish).with("timeline:#{follower.id}", { event: :'announcement.delete', payload: announcement.id.to_s }.to_json)
  end

  it 'does nothing when the follower is not connected to streaming' do
    redis.del("subscribed:timeline:#{follower.id}")

    subject.perform(follower.id, author.id)

    expect(redis).to_not have_received(:publish)
  end
end
