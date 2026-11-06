# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin account announcements' do
  let(:author) { Fabricate(:account) }
  let!(:server_announcement) { Fabricate(:announcement, text: 'Server wide news') }
  let!(:account_announcement) { Fabricate(:announcement, account: author, text: 'Follower news') }

  before { sign_in Fabricate(:admin_user) }

  it 'lists server-wide announcements by default' do
    get admin_announcements_path

    expect(response.body).to include(server_announcement.text).and(not_include(account_announcement.text))
  end

  it 'lists account announcements with the origin filter' do
    get admin_announcements_path(origin: 'account')

    expect(response.body).to include(account_announcement.text).and(not_include(server_announcement.text))
  end

  it 'allows unpublishing but not editing account announcements' do
    expect { post unpublish_admin_announcement_path(account_announcement) }
      .to change { account_announcement.reload.published }.from(true).to(false)
      .and enqueue_sidekiq_job(UnpublishAnnouncementWorker).with(account_announcement.id, author.id)

    get edit_admin_announcement_path(account_announcement)
    expect(response).to have_http_status(403)
  end
end
