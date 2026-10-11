# frozen_string_literal: true

class REST::V2::ScheduledStatusSerializer < REST::ScheduledStatusSerializer
  include LanguagesHelper

  def params
    values = super.with_indifferent_access.merge(
      in_reply_to_id: object.params['in_reply_to_id']&.to_s,
      language: valid_locale_cascade(object.params['language'], object.account.user&.preferred_posting_language, I18n.default_locale)
    )
    boolean_type = ActiveModel::Type::Boolean.new
    sensitive = values[:sensitive].nil? ? object.account.user&.setting_default_sensitive : values[:sensitive]
    values[:sensitive] = boolean_type.cast(sensitive) || values[:spoiler_text].present?
    if values[:poll].present?
      values[:poll] = values[:poll].dup
      %i(multiple hide_totals).each { |key| values[:poll][key] = boolean_type.cast(values[:poll][key]) || false }
    end
    values
  end

  def media_attachments
    attachments = object.media_attachments.to_a.index_by { |media| media.id.to_s }
    ordered = Array(object.params['media_ids']).filter_map { |id| attachments.delete(id.to_s) }
    ordered + attachments.values
  end
end
