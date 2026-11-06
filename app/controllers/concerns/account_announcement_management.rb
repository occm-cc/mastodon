# frozen_string_literal: true

# Shared behaviour for the controllers that let a permitted user manage the
# announcements shown to their followers (settings UI and REST API).
module AccountAnnouncementManagement
  extend ActiveSupport::Concern

  PERMITTED_PARAMS = %i(text scheduled_at starts_at ends_at all_day).freeze

  private

  def can_manage_follower_announcements?
    current_user&.role&.can?(:manage_follower_announcements) && !current_account.unavailable?
  end

  def account_announcements
    current_account.announcements
  end

  # Returns whether the announcement was saved
  def save_account_announcement(announcement, attributes = {})
    announcement.assign_attributes(attributes)
    return false unless announcement.save

    PublishScheduledAnnouncementWorker.perform_async(announcement.id) if announcement.published?
    true
  end

  def publish_account_announcement(announcement)
    announcement.publish!
    PublishScheduledAnnouncementWorker.perform_async(announcement.id)
  end

  def unpublish_account_announcement(announcement)
    announcement.unpublish!
    UnpublishAnnouncementWorker.perform_async(announcement.id, announcement.account_id)
  end

  def destroy_account_announcement(announcement)
    was_published = announcement.published?
    announcement.destroy!
    UnpublishAnnouncementWorker.perform_async(announcement.id, announcement.account_id) if was_published
  end
end
