# frozen_string_literal: true

class RemoveRedundantDmAndOAuthIndexes < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    remove_index :dm_chat_room_accounts, name: :index_dm_chat_room_accounts_on_account_id, algorithm: :concurrently
    remove_index :oauth_access_tokens, name: :index_oauth_access_tokens_on_multi_account, algorithm: :concurrently
  end

  def down
    add_index :dm_chat_room_accounts, :account_id, name: :index_dm_chat_room_accounts_on_account_id, algorithm: :concurrently
    add_index :oauth_access_tokens, :multi_account, name: :index_oauth_access_tokens_on_multi_account, algorithm: :concurrently
  end
end
