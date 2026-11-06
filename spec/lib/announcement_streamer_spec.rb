# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AnnouncementStreamer do
  let(:author) { Fabricate(:account) }
  let(:follower) { Fabricate(:account) }
  let(:muting_follower) { Fabricate(:account) }
  let(:stranger) { Fabricate(:account) }

  before do
    follower.follow!(author)
    muting_follower.follow!(author)
    muting_follower.mute!(author)

    [author, follower, muting_follower, stranger].each do |account|
      redis.set("subscribed:timeline:#{account.id}", '1')
    end

    allow(redis).to receive(:publish)
  end

  it 'only publishes account announcements to the author and followers that did not mute them' do
    described_class.new(author.id).publish(:announcement, { id: '1' })

    expect(redis).to have_received(:publish).with("timeline:#{author.id}", anything).once
    expect(redis).to have_received(:publish).with("timeline:#{follower.id}", anything).once
    expect(redis).to_not have_received(:publish).with("timeline:#{muting_follower.id}", anything)
    expect(redis).to_not have_received(:publish).with("timeline:#{stranger.id}", anything)
  end

  it 'publishes server-wide announcements to every active account' do
    allow(FeedManager.instance).to receive(:with_active_accounts).and_yield(follower).and_yield(stranger)

    described_class.new(nil).publish(:announcement, { id: '1' })

    expect(redis).to have_received(:publish).with("timeline:#{follower.id}", anything)
    expect(redis).to have_received(:publish).with("timeline:#{stranger.id}", anything)
  end
end
