# frozen_string_literal: true

class AddAnnouncementsAccountForeignKey < ActiveRecord::Migration[8.1]
  def change
    add_foreign_key :announcements, :accounts, on_delete: :cascade, validate: false
  end
end
