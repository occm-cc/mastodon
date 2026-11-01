# frozen_string_literal: true

require_relative 'base'

module Mastodon::CLI
  class Dm < Base
    option :all, type: :boolean, default: false
    option :dry_run, type: :boolean, default: false
    desc 'migrate_groups [USERNAME]', 'Re-run migration of legacy group direct conversations into DM chat rooms'
    long_desc <<-LONG_DESC
      Migrate legacy group direct conversations (3 or more participants
      including the owner) into DM group chat rooms.

      Only conversations that still have unmigrated posts are processed.
      Conversations that were partially migrated reuse their existing room,
      so the command is safe to run repeatedly.

      With the --all option, all local accounts with group conversations are
      processed. Otherwise, a single user specified by USERNAME.
    LONG_DESC
    def migrate_groups(username = nil)
      if username.present?
        account = Account.find_local(username)
        fail_with_message 'No such account' if account.nil?

        result = MigrateConversationsToDmWorker.new.migrate_group_conversations(account, dry_run: dry_run?)
        say("Migrated #{result[:migrated]} group conversations, #{result[:failed]} failed#{dry_run_mode_suffix}", result[:failed].zero? ? :green : :yellow)
      elsif options[:all]
        # Process accounts sequentially: members of the same group conversation
        # handled in parallel could otherwise each create a separate room.
        processed = migrated = failed = 0
        scope = accounts_with_group_conversations
        progress = create_progress_bar(scope.count)

        scope.find_each do |account|
          result = MigrateConversationsToDmWorker.new.migrate_group_conversations(account, dry_run: dry_run?)
          processed += 1
          migrated += result[:migrated]
          failed += result[:failed]
          progress.log("#{account.username}: #{result[:failed]} group conversations failed") if result[:failed].positive?
          progress.increment
        end

        progress.finish

        say("Processed #{processed} accounts: migrated #{migrated} group conversations, #{failed} failed#{dry_run_mode_suffix}", failed.zero? ? :green : :yellow)
      else
        fail_with_message 'No account(s) given'
      end
    end

    private

    def accounts_with_group_conversations
      Account.local.where(id: AccountConversation.where('cardinality(participant_account_ids) > 1').select(:account_id))
    end
  end
end
