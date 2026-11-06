# frozen_string_literal: true

class UnpublishAnnouncementWorker
  include Sidekiq::Worker

  # The announcement may already be deleted, so the author is passed along
  # to know who received it. A nil author means a server-wide announcement.
  def perform(announcement_id, author_account_id = nil)
    AnnouncementStreamer.new(author_account_id).publish(:'announcement.delete', announcement_id.to_s)
  end
end
