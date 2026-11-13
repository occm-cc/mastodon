# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 DM Chat Room Members' do
  let(:user) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:alice) { Fabricate(:account) }
  let(:bob) { Fabricate(:account) }
  let(:chat_room) { CreateDmChatRoomService.new.call(user.account, account_ids: [alice.id, bob.id]) }
  let(:membership) { chat_room.dm_chat_room_accounts.find_by!(account: alice) }

  describe 'DELETE /api/v1/dm/chat_rooms/:chat_room_id/members/:id' do
    it 'removes the member by account ID and invalidates their unread count' do
      redis.set("dm:unread:#{alice.id}", '2', ex: 60)

      expect(membership.id).to_not eq alice.id

      delete "/api/v1/dm/chat_rooms/#{chat_room.uuid}/members/#{alice.id}", headers: headers

      expect(response).to have_http_status(200)
      expect(membership.reload.left_at).to be_present
      expect(chat_room.dm_chat_room_accounts.active.pluck(:account_id)).to contain_exactly(user.account.id, bob.id)
      expect(redis.get("dm:unread:#{alice.id}")).to be_nil
    end

    it 'does not allow a member who is not the owner to remove members' do
      chat_room.update!(owner_account: bob)

      delete "/api/v1/dm/chat_rooms/#{chat_room.uuid}/members/#{alice.id}", headers: headers

      expect(response).to have_http_status(403)
      expect(membership.reload.left_at).to be_nil
    end

    it 'returns not found for a member who has already left' do
      membership.update!(left_at: Time.current)

      delete "/api/v1/dm/chat_rooms/#{chat_room.uuid}/members/#{alice.id}", headers: headers

      expect(response).to have_http_status(404)
    end

    it 'returns not found for an account outside the room' do
      outsider = Fabricate(:account)

      delete "/api/v1/dm/chat_rooms/#{chat_room.uuid}/members/#{outsider.id}", headers: headers

      expect(response).to have_http_status(404)
      expect(membership.reload.left_at).to be_nil
    end
  end
end
