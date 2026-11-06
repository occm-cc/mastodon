# frozen_string_literal: true

class PublishScheduledAnnouncementWorker
  include Sidekiq::Worker

  def perform(announcement_id)
    @announcement = Announcement.find(announcement_id)

    refresh_status_ids!

    @announcement.publish! unless @announcement.published?

    return unless @announcement.author_can_publish?

    payload = InlineRenderer.render(@announcement, nil, :announcement)

    AnnouncementStreamer.new(@announcement.account_id).publish(:announcement, payload)
  end

  private

  def refresh_status_ids!
    @announcement.status_ids = Status.from_text(@announcement.text).map(&:id)
    @announcement.save
  end
end
