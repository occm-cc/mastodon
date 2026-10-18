# frozen_string_literal: true

class UnfavouriteService < BaseService
  include Payloadable

  def call(account, status)
    favourite = Favourite.find_by!(account: account, status: status)
    favourite.destroy!
    create_notification(favourite) if !status.account.local? && status.account.activitypub?
    restore_pending_mention!(account, status)
    favourite
  end

  private

  def restore_pending_mention!(account, status)
    return unless account.local?

    mention = Mention.find_by(account: account, status: status, silent: false)
    return unless mention

    notification = Notification.find_by(account: account, activity: mention, type: :mention, filtered: false)
    return unless notification
    return if PendingMentionDismissal.exists?(account: account, notification: notification)
    return if Status.exists?(account: account, in_reply_to_id: status.id)

    PendingMentionCache.add(account.id, notification.id)
  end

  def create_notification(favourite)
    status = favourite.status
    ActivityPub::DeliveryWorker.perform_async(build_json(favourite), favourite.account_id, status.account.inbox_url)
  end

  def build_json(favourite)
    serialize_payload(favourite, ActivityPub::UndoLikeSerializer).to_json
  end
end
