# frozen_string_literal: true

# Pushes announcement events to the streaming timelines of the accounts that
# can see the announcement: every active account for server-wide ones, and
# the author plus their local followers for account announcements.
class AnnouncementStreamer
  include Redisable

  def initialize(author_account_id)
    @author_account_id = author_account_id
  end

  def publish(event, payload)
    message = { event: event, payload: payload }.to_json

    each_recipient_id do |account_id|
      redis.publish("timeline:#{account_id}", message) if redis.exists?("subscribed:timeline:#{account_id}")
    end
  end

  private

  def each_recipient_id
    if @author_account_id.nil?
      FeedManager.instance.with_active_accounts { |account| yield(account.id) }
    else
      excluded_ids = excluded_follower_ids

      yield(@author_account_id)

      Account.local.without_suspended.where(id: Follow.where(target_account_id: @author_account_id).select(:account_id)).in_batches do |batch|
        batch.pluck(:id).each do |account_id|
          yield(account_id) unless excluded_ids.include?(account_id)
        end
      end
    end
  end

  def excluded_follower_ids
    Set.new(
      Mute.where(target_account_id: @author_account_id).pluck(:account_id) +
      Block.where(target_account_id: @author_account_id).pluck(:account_id) +
      Block.where(account_id: @author_account_id).pluck(:target_account_id)
    )
  end
end
