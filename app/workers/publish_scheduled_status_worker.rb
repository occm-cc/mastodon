# frozen_string_literal: true

class PublishScheduledStatusWorker
  include Sidekiq::Worker

  sidekiq_options lock: :until_executed, lock_ttl: 1.hour.to_i

  def perform(scheduled_status_id)
    scheduled_status = ScheduledStatus.find(scheduled_status_id)
    scheduled_status.with_lock do
      # Jobs already queued for the previous time must not publish a moved post.
      return true if scheduled_status.scheduled_at > Time.now.utc

      if scheduled_status.account.user_disabled?
        scheduled_status.destroy!
        return true
      end

      options = options_with_objects(scheduled_status.params.with_indifferent_access)
      scheduled_status.destroy!

      PostStatusService.new.call(scheduled_status.account, options.merge(defer_postprocessing: true))
    end
  rescue ActiveRecord::RecordNotFound, ActiveRecord::RecordInvalid
    true
  end

  def options_with_objects(options)
    options.tap do |options_hash|
      options_hash[:application] = Doorkeeper::Application.find(options_hash.delete(:application_id)) if options[:application_id]
      options_hash[:thread]      = Status.find(options_hash.delete(:in_reply_to_id)) if options_hash[:in_reply_to_id]
      options_hash[:quoted_status] = Status.find(options_hash.delete(:quoted_status_id)) if options_hash[:quoted_status_id]
    end
  end
end
