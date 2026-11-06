# frozen_string_literal: true

class PublishAnnouncementReactionWorker
  include Sidekiq::Worker

  def perform(announcement_id, name)
    announcement = Announcement.find(announcement_id)

    reaction,  = announcement.announcement_reactions.where(name: name).group(:announcement_id, :name, :custom_emoji_id).select('name, custom_emoji_id, count(*) as count, false as me')
    reaction ||= announcement.announcement_reactions.new(name: name)

    payload = InlineRenderer.render(reaction, nil, :reaction).tap { |h| h[:announcement_id] = announcement_id.to_s }
    AnnouncementStreamer.new(announcement.account_id).publish(:'announcement.reaction', payload)
  rescue ActiveRecord::RecordNotFound
    true
  end
end
