# frozen_string_literal: true

# V2 scheduling reuses post validation without changing the V1 API's semantics.
class ScheduledStatusService < PostStatusService
  def call(account, options = {}, scheduled_status = nil)
    @scheduled_status = scheduled_status
    options = options.dup
    boolean_type = ActiveModel::Type::Boolean.new
    options[:sensitive] = boolean_type.cast(options[:sensitive]) if options.key?(:sensitive)
    if options[:poll].present?
      options[:poll] = options[:poll].dup
      %i(multiple hide_totals).each do |key|
        options[:poll][key] = boolean_type.cast(options[:poll][key]) if options[:poll].key?(key)
      end
    end
    validate_schedule!(account, options[:scheduled_at])

    super(account, options)
  end

  private

  def with_idempotency(&block)
    # Commit the reservation before PostStatusService caches its ID in Redis.
    super do
      ApplicationRecord.transaction(&block)
    end
  end

  def validate_schedule!(account, value)
    date = value.present? ? Time.iso8601(value.to_s) : nil
    return if date.present? && date > Time.now.utc + ScheduledStatus::MINIMUM_OFFSET

    status = account.scheduled_statuses.new(scheduled_at: date)
    status.errors.add(:scheduled_at, I18n.t('scheduled_statuses.too_soon'))
    raise ActiveRecord::RecordInvalid, status
  rescue ArgumentError
    raise Mastodon::ValidationError, 'Invalid scheduled_at'
  end

  def validate_media!
    super

    @media = @account.media_attachments.where(id: @media.map(&:id)).lock.to_a

    unavailable = @media.select { |media| media.status_id.present? || (media.scheduled_status_id.present? && media.scheduled_status_id != @scheduled_status&.id) }
    return if unavailable.empty?

    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.not_found', ids: unavailable.map(&:id).join(', '))
  end

  def persist_scheduled_status!
    (@options[:media_attributes] || []).each do |attributes|
      media = @media.find { |attachment| attachment.id == attributes[:id].to_i }
      media&.update!(attributes.slice(:description, :focus))
    end

    return super if @scheduled_status.nil?

    @scheduled_status.update!(scheduled_status_attributes)
    @scheduled_status
  end

  def scheduled_options
    super.merge(
      text: @text,
      spoiler_text: @options[:spoiler_text] || '',
      sensitive: @sensitive,
      visibility: @visibility,
      language: status_attributes[:language],
      media_ids: (@options[:media_ids] || []).map(&:to_s)
    ).except(:media_attributes)
  end
end
