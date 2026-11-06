# frozen_string_literal: true

class AddContentTypeToStatuses < ActiveRecord::Migration[8.1]
  def change
    add_column :statuses, :content_type, :string
  end
end
