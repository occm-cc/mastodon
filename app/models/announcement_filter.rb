# frozen_string_literal: true

class AnnouncementFilter
  KEYS = %i(
    origin
    published
    unpublished
  ).freeze

  IGNORED_PARAMS = %w(page).freeze

  attr_reader :params

  def initialize(params)
    @params = params
  end

  def results
    scope = Announcement.unscoped
    scope.merge!(Announcement.server_wide) if params[:origin].blank?

    params.each do |key, value|
      next if IGNORED_PARAMS.include?(key.to_s)

      scope.merge!(scope_for(key, value.to_s.strip)) if value.present?
    end

    scope.chronological
  end

  private

  def scope_for(key, value)
    case key.to_s
    when 'origin'
      origin_scope(value)
    when 'published'
      Announcement.published
    when 'unpublished'
      Announcement.unpublished
    else
      raise Mastodon::InvalidParameterError, "Unknown filter: #{key}"
    end
  end

  def origin_scope(value)
    case value
    when 'server'
      Announcement.server_wide
    when 'account'
      Announcement.account_scoped
    else
      raise Mastodon::InvalidParameterError, "Unknown origin filter: #{value}"
    end
  end
end
