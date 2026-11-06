# frozen_string_literal: true

class AddAccountIdToAnnouncements < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_reference :announcements, :account, null: true, index: { algorithm: :concurrently }
  end
end
