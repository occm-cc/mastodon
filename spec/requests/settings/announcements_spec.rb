# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Settings Announcements' do
  let(:publisher_role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_follower_announcements]) }

  context 'without the permission' do
    before { sign_in Fabricate(:user) }

    it 'forbids access' do
      get settings_announcements_path

      expect(response).to have_http_status(403)
    end
  end

  context 'with the permission' do
    let(:user) { Fabricate(:user, role: publisher_role) }

    before { sign_in user }

    it 'lists the announcements' do
      Fabricate(:announcement, account: user.account, text: 'Hello followers')

      get settings_announcements_path

      expect(response).to have_http_status(200)
      expect(response.body).to include('Hello followers')
    end

    it 'creates an announcement' do
      expect { post settings_announcements_path, params: { announcement: { text: 'Hello followers' } } }
        .to change { user.account.announcements.count }.by(1)

      expect(response).to redirect_to(settings_announcements_path)
    end

    it 'unpublishes an announcement' do
      announcement = Fabricate(:announcement, account: user.account)

      expect { post unpublish_settings_announcement_path(announcement) }
        .to change { announcement.reload.published }.from(true).to(false)
    end
  end
end
