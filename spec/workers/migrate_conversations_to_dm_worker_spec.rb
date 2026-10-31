# frozen_string_literal: true

require 'rails_helper'

RSpec.describe MigrateConversationsToDmWorker do
  let(:account) { Fabricate(:account) }
  let(:alice) { Fabricate(:account) }
  let(:bob) { Fabricate(:account) }

  def create_conversation(participants, text)
    conversation = Fabricate(:conversation)
    status = Fabricate(:status, account: account, conversation: conversation, visibility: :direct, text: text)
    AccountConversation.create!(
      account: account,
      conversation: conversation,
      participant_account_ids: participants.map(&:id),
      status_ids: [status.id],
      last_status_id: status.id
    )
  end

  describe '#perform' do
    it 'migrates group conversations into separate group chat rooms' do
      create_conversation([alice, bob], 'first group')
      create_conversation([alice, bob], 'second group')

      described_class.new.perform(account.id)

      rooms = DmChatRoom.active_for_account(account)
      expect(rooms.count).to eq 2
      expect(rooms).to all(be_group_chat)
      expect(rooms.flat_map { |room| room.dm_messages.pluck(:content) }).to contain_exactly('first group', 'second group')
    end

    it 'migrates a direct conversation into a direct room' do
      create_conversation([alice], 'hello')

      described_class.new.perform(account.id)

      room = DmChatRoom.active_for_account(account).sole
      expect(room).to be_direct
      expect(room.dm_messages.pluck(:content)).to eq ['hello']
    end
  end
end
