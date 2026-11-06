# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Announcements' do
  include_context 'with API authentication', oauth_scopes: 'read'

  let!(:announcement) { Fabricate(:announcement) }

  describe 'GET /api/v1/announcements' do
    context 'without token' do
      it 'returns http unprocessable entity' do
        get '/api/v1/announcements'

        expect(response).to have_http_status(422)
        expect(response.content_type)
          .to start_with('application/json')
      end
    end

    context 'with token' do
      before do
        get '/api/v1/announcements', headers: headers
      end

      it 'returns http success' do
        expect(response).to have_http_status(200)
        expect(response.content_type)
          .to start_with('application/json')
      end
    end
  end

  describe 'POST /api/v1/announcements/:id/dismiss' do
    context 'without token' do
      it 'returns http unauthorized' do
        post "/api/v1/announcements/#{announcement.id}/dismiss"

        expect(response).to have_http_status(401)
        expect(response.content_type)
          .to start_with('application/json')
      end
    end

    context 'with token' do
      let(:scopes) { 'write:accounts' }

      before do
        post "/api/v1/announcements/#{announcement.id}/dismiss", headers: headers
      end

      it 'dismisses announcement', :aggregate_failures do
        expect(response).to have_http_status(200)
        expect(response.content_type)
          .to start_with('application/json')
        expect(announcement.announcement_mutes.find_by(account: user.account)).to_not be_nil
      end
    end
  end

  describe 'account announcements' do
    let(:publisher_role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_follower_announcements]) }
    let(:author) { Fabricate(:user, role: publisher_role).account }
    let!(:account_announcement) { Fabricate(:announcement, account: author) }
    let(:scopes) { 'read write:accounts' }

    context 'when following the author' do
      before { user.account.follow!(author) }

      it 'returns server-wide and account announcements together' do
        get '/api/v1/announcements', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck(:id)).to contain_exactly(announcement.id.to_s, account_announcement.id.to_s)
        expect(response.parsed_body.find { |item| item[:id] == account_announcement.id.to_s })
          .to include(account: include(id: author.id.to_s))
        expect(response.parsed_body.find { |item| item[:id] == announcement.id.to_s })
          .to include(account: nil)
      end

      it 'allows dismissing the account announcement' do
        post "/api/v1/announcements/#{account_announcement.id}/dismiss", headers: headers

        expect(response).to have_http_status(200)
      end
    end

    context 'when the current user is the author' do
      let(:author) { user.account }

      before { user.update!(role: publisher_role) }

      it 'returns the own account announcement' do
        get '/api/v1/announcements', headers: headers

        expect(response.parsed_body.pluck(:id)).to contain_exactly(announcement.id.to_s, account_announcement.id.to_s)
      end
    end

    context 'when not following the author' do
      it 'does not return the account announcement' do
        get '/api/v1/announcements', headers: headers

        expect(response.parsed_body.pluck(:id)).to eq [announcement.id.to_s]
      end

      it 'does not allow dismissing the account announcement' do
        post "/api/v1/announcements/#{account_announcement.id}/dismiss", headers: headers

        expect(response).to have_http_status(404)
      end
    end
  end
end
