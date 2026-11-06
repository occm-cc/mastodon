# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Account Announcements' do
  include_context 'with API authentication', oauth_scopes: 'read:accounts write:accounts'

  let(:publisher_role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_follower_announcements]) }

  context 'without the permission' do
    it 'forbids listing and creating announcements' do
      get '/api/v1/account_announcements', headers: headers
      expect(response).to have_http_status(403)

      post '/api/v1/account_announcements', headers: headers, params: { text: 'Hello followers' }
      expect(response).to have_http_status(403)
      expect(Announcement.count).to eq 0
    end
  end

  context 'with the permission' do
    before { user.update!(role: publisher_role) }

    describe 'POST /api/v1/account_announcements' do
      it 'creates and publishes an announcement for the current account' do
        expect { post '/api/v1/account_announcements', headers: headers, params: { text: 'Hello followers' } }
          .to change(Announcement, :count).by(1)
          .and enqueue_sidekiq_job(PublishScheduledAnnouncementWorker)

        expect(response).to have_http_status(200)
        expect(response.parsed_body).to include(content: include('Hello followers'), account: include(id: user.account.id.to_s))
        expect(Announcement.last).to have_attributes(account: user.account, published: true)
      end

      it 'returns a validation error with invalid params' do
        post '/api/v1/account_announcements', headers: headers, params: { text: '' }

        expect(response).to have_http_status(422)
      end
    end

    describe 'GET /api/v1/account_announcements' do
      let!(:own) { Fabricate(:announcement, account: user.account) }

      before { Fabricate(:announcement) }

      it 'lists only the announcements of the current account' do
        get '/api/v1/account_announcements', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck(:id)).to eq [own.id.to_s]
      end
    end

    describe 'PUT /api/v1/account_announcements/:id' do
      let!(:own) { Fabricate(:announcement, account: user.account) }

      it 'updates the announcement' do
        put "/api/v1/account_announcements/#{own.id}", headers: headers, params: { text: 'Updated' }

        expect(response).to have_http_status(200)
        expect(own.reload.text).to eq 'Updated'
      end

      it 'does not allow updating someone else\'s announcement' do
        other = Fabricate(:announcement, account: Fabricate(:user, role: publisher_role).account)

        put "/api/v1/account_announcements/#{other.id}", headers: headers, params: { text: 'Updated' }

        expect(response).to have_http_status(404)
      end
    end

    describe 'DELETE /api/v1/account_announcements/:id' do
      let!(:own) { Fabricate(:announcement, account: user.account) }

      it 'deletes the announcement and notifies followers' do
        expect { delete "/api/v1/account_announcements/#{own.id}", headers: headers }
          .to enqueue_sidekiq_job(UnpublishAnnouncementWorker).with(own.id, user.account.id)

        expect(response).to have_http_status(200)
        expect(Announcement.exists?(own.id)).to be false
      end
    end
  end
end
