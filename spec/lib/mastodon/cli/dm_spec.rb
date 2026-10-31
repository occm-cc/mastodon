# frozen_string_literal: true

require 'rails_helper'
require 'mastodon/cli/dm'

RSpec.describe Mastodon::CLI::Dm do
  subject { cli.invoke(action, arguments, options) }

  let(:cli) { described_class.new }
  let(:arguments) { [] }
  let(:options) { {} }

  it_behaves_like 'CLI Command'

  describe '#migrate_groups' do
    let(:action) { :migrate_groups }

    let(:owner) { Fabricate(:account, username: 'groupowner') }
    let(:alice) { Fabricate(:account) }
    let(:bob) { Fabricate(:account) }

    def create_conversation(account, participants, text)
      conversation = Fabricate(:conversation)
      status = Fabricate(:status, account: owner, conversation: conversation, visibility: :direct, text: text)
      AccountConversation.create!(
        account: account,
        conversation: conversation,
        participant_account_ids: participants.map(&:id),
        status_ids: [status.id],
        last_status_id: status.id
      )
    end

    before do
      create_conversation(owner, [alice, bob], 'group one')
      create_conversation(owner, [alice, bob], 'group two')
      create_conversation(owner, [alice], 'direct')
    end

    context 'with a username' do
      let(:arguments) { ['groupowner'] }

      it 'migrates only group conversations into separate rooms' do
        expect { subject }
          .to output_results('Migrated 2 group conversations, 0 failed')
          .and change { DmChatRoom.group_chat.count }.by(2)

        expect(DmChatRoom.direct.count).to eq 0
        expect(DmMessage.pluck(:content)).to contain_exactly('group one', 'group two')
      end

      it 'does not create duplicate rooms when run again' do
        cli.invoke(action, arguments, options)

        expect { described_class.new.invoke(action, arguments, options) }
          .to output_results('Migrated 0 group conversations')
          .and(not_change { DmChatRoom.count })
      end
    end

    context 'with --dry-run' do
      let(:arguments) { ['groupowner'] }
      let(:options) { { dry_run: true } }

      it 'reports without creating rooms' do
        expect { subject }
          .to output_results('Migrated 2 group conversations, 0 failed (DRY RUN)')
          .and(not_change { DmChatRoom.count })
      end
    end

    context 'with --all' do
      let(:options) { { all: true } }

      before do
        # Another member holds the same group conversation from their side
        owner_conversation = AccountConversation.find_by(account: owner, participant_account_ids: [alice.id, bob.id].sort)
        AccountConversation.create!(
          account: alice,
          conversation: owner_conversation.conversation,
          participant_account_ids: [owner.id, bob.id],
          status_ids: owner_conversation.status_ids,
          last_status_id: owner_conversation.last_status_id
        )
      end

      it 'reuses the existing room for a conversation shared by several accounts' do
        expect { subject }
          .to output_results('Processed 2 accounts')
          .and change { DmChatRoom.group_chat.count }.by(2)
      end
    end

    context 'without a username or --all' do
      it 'fails' do
        expect { subject }
          .to raise_error(Thor::Error, 'No account(s) given')
      end
    end

    context 'with an unknown username' do
      let(:arguments) { ['nobody'] }

      it 'fails' do
        expect { subject }
          .to raise_error(Thor::Error, 'No such account')
      end
    end
  end
end
