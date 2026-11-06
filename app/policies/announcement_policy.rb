# frozen_string_literal: true

class AnnouncementPolicy < ApplicationPolicy
  def index?
    role.can?(:manage_announcements)
  end

  def create?
    role.can?(:manage_announcements)
  end

  # Account announcements belong to their author; staff can only take them down
  def update?
    role.can?(:manage_announcements) && server_wide?
  end

  def unpublish?
    role.can?(:manage_announcements)
  end

  def destroy?
    role.can?(:manage_announcements) && server_wide?
  end

  def distribute?
    server_wide? && record.published? && !record.notification_sent? && role.can?(:manage_settings)
  end

  private

  def server_wide?
    !record.is_a?(Announcement) || record.server_wide?
  end
end
