# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CreateDmChatRoomService do
  subject { described_class.new }

  let(:owner) { Fabricate(:account) }
  let(:alice) { Fabricate(:account) }
  let(:bob) { Fabricate(:account) }

  describe 'group chats' do
    it 'creates a separate room every time, even with the same members' do
      first = subject.call(owner, account_ids: [alice.id, bob.id])
      second = subject.call(owner, account_ids: [alice.id, bob.id])
      third = subject.call(owner, account_ids: [bob.id, alice.id], title: 'Third')

      expect([first, second, third].map(&:id).uniq.size).to eq 3
      expect([first, second, third]).to all(be_group_chat)
      expect(DmChatRoom.active_for_account(owner).count).to eq 3
      expect(third.title).to eq 'Third'
    end

    it 'adds all members to each room' do
      room = subject.call(owner, account_ids: [alice.id, bob.id])

      expect(room.dm_chat_room_accounts.pluck(:account_id)).to contain_exactly(owner.id, alice.id, bob.id)
    end
  end

  describe 'direct chats' do
    it 'reuses the existing room for the same pair' do
      first = subject.call(owner, account_ids: [alice.id])
      second = subject.call(owner, account_ids: [alice.id])

      expect(second.id).to eq first.id
      expect(first).to be_direct
    end
  end
end
