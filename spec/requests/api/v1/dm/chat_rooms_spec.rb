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

  describe 'DELETE /api/v1/dm/chat_rooms/:id' do
    let(:chat_room) { DmChatRoom.create!(owner_account: alice, room_type: :group_chat) }
    let!(:membership) { chat_room.dm_chat_room_accounts.create!(account: user.account, accepted: accepted, unread: true) }

    before do
      other_room = DmChatRoom.create!(owner_account: bob, room_type: :direct)
      other_room.dm_chat_room_accounts.create!(account: user.account, accepted: true, unread: true)
    end

    shared_examples 'updating the unread count immediately' do
      it 'removes the room from the cached unread count' do
        get '/api/v1/dm/unread_count', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body[:count]).to eq 2

        delete "/api/v1/dm/chat_rooms/#{chat_room.uuid}", headers: headers

        expect(response).to have_http_status(200)
        expect(membership.reload.left_at).to be_present

        get '/api/v1/dm/unread_count', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body[:count]).to eq 1
      end
    end

    context 'when leaving an accepted room' do
      let(:accepted) { true }

      it_behaves_like 'updating the unread count immediately'
    end

    context 'when declining an invitation' do
      let(:accepted) { false }

      it_behaves_like 'updating the unread count immediately'
    end
  end
end
