# frozen_string_literal: true

class ValidateAnnouncementsAccountForeignKey < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :announcements, :accounts
  end
end
