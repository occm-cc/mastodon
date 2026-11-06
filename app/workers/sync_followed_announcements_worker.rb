# frozen_string_literal: true

# Brings an open web client in line with a follow relationship that just
# changed: announcements of the followed account are pushed after a follow
# and removed after an unfollow. The relationship is read when the job runs,
# so repeated follow/unfollow toggles collapse into the latest state.
class SyncFollowedAnnouncementsWorker
  include Sidekiq::Worker
  include Redisable

  sidekiq_options lock: :until_executing

  def perform(follower_id, author_id)
    return unless redis.exists?("subscribed:timeline:#{follower_id}")

    follower = Account.find_by(id: follower_id)
    return if follower.nil?

    visible_ids = Announcement.visible_records_for(follower, Announcement.visible_to(follower).where(account_id: author_id)).map(&:id)

    Announcement.published.where(account_id: author_id).find_each do |announcement|
      if visible_ids.include?(announcement.id)
        publish(follower_id, :announcement, InlineRenderer.render(announcement, follower, :announcement))
      else
        publish(follower_id, :'announcement.delete', announcement.id.to_s)
      end
    end
  end

  private

  def publish(follower_id, event, payload)
    redis.publish("timeline:#{follower_id}", { event: event, payload: payload }.to_json)
  end
end
