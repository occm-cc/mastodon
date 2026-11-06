# frozen_string_literal: true

# == Schema Information
#
# Table name: announcements
#
#  id                   :bigint(8)        not null, primary key
#  account_id           :bigint(8)
#  all_day              :boolean          default(FALSE), not null
#  ends_at              :datetime
#  notification_sent_at :datetime
#  published            :boolean          default(FALSE), not null
#  published_at         :datetime
#  scheduled_at         :datetime
#  starts_at            :datetime
#  status_ids           :bigint(8)        is an Array
#  text                 :text             default(""), not null
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#

class Announcement < ApplicationRecord
  PER_ACCOUNT_LIMIT = 5

  scope :unpublished, -> { where(published: false) }
  scope :published, -> { where(published: true) }
  scope :server_wide, -> { where(account_id: nil) }
  scope :account_scoped, -> { where.not(account_id: nil) }
  scope :chronological, -> { order(coalesced_chronology_timestamps.asc) }
  scope :reverse_chronological, -> { order(coalesced_chronology_timestamps.desc) }

  belongs_to :account, optional: true, inverse_of: :announcements

  has_many :announcement_mutes, dependent: :destroy
  has_many :announcement_reactions, dependent: :destroy

  validates :text, presence: true
  validates :starts_at, presence: true, if: :ends_at?
  validates :ends_at, presence: true, if: :starts_at?
  validate :validate_account_is_local, if: :account_id?
  validate :validate_per_account_limit, on: :create, if: :account_id?

  before_validation :set_published, on: :create

  class << self
    def coalesced_chronology_timestamps
      Arel.sql(
        <<~SQL.squish
          COALESCE(announcements.starts_at, announcements.scheduled_at, announcements.published_at, announcements.created_at)
        SQL
      )
    end

    # Published announcements a given account is allowed to see: server-wide
    # announcements, its own announcements and those of accounts it follows,
    # minus blocked, muted or suspended authors.
    def visible_to(account)
      return published.server_wide if account.nil?

      followed_accounts = Account
        .without_suspended
        .where(id: Follow.where(account_id: account.id).select(:target_account_id))
        .where.not(id: account.excluded_from_timeline_account_ids)

      published.server_wide
        .or(published.where(account_id: account.id))
        .or(published.where(account_id: followed_accounts.select(:id)))
    end

    # Same as `visible_to`, but also drops announcements whose author lost
    # the permission to publish them, which cannot be expressed in SQL.
    def visible_records_for(account, scope = visible_to(account))
      scope.includes(account: [:account_stat, { user: :role }]).to_a.select(&:author_can_publish?)
    end
  end

  def server_wide?
    account_id.nil?
  end

  def author_can_publish?
    return true if server_wide?

    account&.user&.role&.can?(:manage_follower_announcements) || false
  end

  def to_log_human_identifier
    text
  end

  def publish!
    update!(published: true, published_at: Time.now.utc, scheduled_at: nil)
  end

  def unpublish!
    update!(published: false, scheduled_at: nil)
  end

  def notification_sent?
    notification_sent_at.present?
  end

  def mentions
    @mentions ||= Account.from_text(text)
  end

  def statuses
    @statuses ||= begin
      if status_ids.nil?
        []
      else
        Status.with_includes.distributable_visibility.where(id: status_ids)
      end
    end
  end

  def tags
    @tags ||= Tag.find_or_create_by_names(Extractor.extract_hashtags(text))
  end

  def emojis
    @emojis ||= CustomEmoji.from_text(text)
  end

  def reactions_allowed
    !Rails.configuration.x.mastodon.disable_announcement_reactions
  end

  def reactions(account = nil)
    return [] unless reactions_allowed

    grouped_ordered_announcement_reactions.select(
      [:name, :custom_emoji_id, 'COUNT(*) as count'].tap do |values|
        values << value_for_reaction_me_column(account)
      end
    ).to_a.tap do |records|
      ActiveRecord::Associations::Preloader.new(records: records, associations: :custom_emoji).call
    end
  end

  def scope_for_notification
    User.confirmed.joins(:account).merge(Account.without_suspended)
  end

  private

  def validate_account_is_local
    errors.add(:account, :invalid) unless account&.local?
  end

  def validate_per_account_limit
    return if account.nil?

    active_count = account.announcements.where(published: true).or(account.announcements.where.not(scheduled_at: nil)).count
    errors.add(:base, I18n.t('settings.announcements.errors.limit_reached', count: PER_ACCOUNT_LIMIT)) if active_count >= PER_ACCOUNT_LIMIT
  end

  def grouped_ordered_announcement_reactions
    announcement_reactions
      .group(:announcement_id, :name, :custom_emoji_id)
      .order(
        Arel.sql('MIN(created_at)').asc
      )
  end

  def value_for_reaction_me_column(account)
    if account.nil?
      'FALSE AS me'
    else
      <<~SQL.squish
        EXISTS(
          SELECT 1
          FROM announcement_reactions inner_reactions
          WHERE inner_reactions.account_id = #{account.id}
            AND inner_reactions.announcement_id = announcement_reactions.announcement_id
            AND inner_reactions.name = announcement_reactions.name
        ) AS me
      SQL
    end
  end

  def set_published
    return unless scheduled_at.blank? || scheduled_at.past?

    self.published = true
    self.published_at = Time.now.utc
  end
end
