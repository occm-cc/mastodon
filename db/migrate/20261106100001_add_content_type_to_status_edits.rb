# frozen_string_literal: true

class AddContentTypeToStatusEdits < ActiveRecord::Migration[8.1]
  def change
    add_column :status_edits, :content_type, :string
  end
end
