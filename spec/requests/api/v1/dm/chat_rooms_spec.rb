# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 DM Chat Rooms' do
  let(:user) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:alice) { Fabricate(:account) }
  let(:bob) { Fabricate(:account) }

  describe 'POST /api/v1/dm/chat_rooms' do
    it 'creates multiple group rooms with the same members' do
      uuids = Array.new(3) do
        post '/api/v1/dm/chat_rooms', headers: headers, params: { account_ids: [alice.id, bob.id] }

        expect(response).to have_http_status(200)
        response.parsed_body[:uuid]
      end

      expect(uuids.uniq.size).to eq 3
      expect(DmChatRoom.where(uuid: uuids).group_chat.count).to eq 3
    end
  end
end
