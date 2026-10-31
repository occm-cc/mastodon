# frozen_string_literal: true

class MigrateConversationsToDmWorker
  include Sidekiq::Worker
  include Redisable

  sidekiq_options queue: 'pull', retry: 3, dead: false

  def perform(account_id)
    @account = Account.find(account_id)

    return if already_migrated?

    # Acquire exclusive lock - if another worker is already processing, skip
    lock_key = "dm:migration_lock:#{@account.id}"
    lock_acquired = redis.set(lock_key, '1', nx: true, ex: 600) # 10 min TTL
    return unless lock_acquired

    @start_time = Time.current

    begin
      migrate_conversations
      mark_migrated
      notify_completion
    ensure
      redis.del(lock_key)
    end
  rescue ActiveRecord::RecordNotFound
    true
  end

  private

  def already_migrated?
    redis.exists?("dm:migrated:#{@account.id}")
  end

  def mark_migrated
    redis.set("dm:migrated:#{@account.id}", '1')
    redis.del("dm:migrating:#{@account.id}")
  end

  def notify_completion
    elapsed = Time.current - @start_time

    # Always send refresh event so frontend reloads the room list
    payload = { event: 'dm_migration_complete', payload: '{}' }.to_json
    redis.publish("timeline:dm:#{@account.id}", payload)

    # Only send notification if migration took more than 1 minute
    if elapsed > 60
      notification_payload = {
        event: 'dm_migration_notification',
        payload: { message: 'migration_complete' }.to_json,
      }.to_json
      redis.publish("timeline:dm:#{@account.id}", notification_payload)
    end
  end

  def migrate_conversations
    AccountConversation.where(account: @account).find_each do |conversation|
      migrate_single_conversation(conversation)
    rescue => e
      Rails.logger.warn("Failed to migrate conversation #{conversation.id} for account #{@account.id}: #{e.message}")
    end
  end

  def migrate_single_conversation(conversation)
    participant_ids = conversation.participant_account_ids
    return if participant_ids.empty?

    room_type = participant_ids.size == 1 ? :direct : :group_chat

    existing_room = find_existing_room(participant_ids, room_type)
    room = existing_room || create_room(participant_ids, room_type)

    migrate_messages(room, conversation)
  end

  def find_existing_room(participant_ids, room_type)
    if room_type == :direct && participant_ids.size == 1
      other_account_id = participant_ids.first
      my_rooms = DmChatRoomAccount.where(account: @account).active.pluck(:dm_chat_room_id)
      other_rooms = DmChatRoomAccount.where(account_id: other_account_id).active.pluck(:dm_chat_room_id)
      common = my_rooms & other_rooms
      DmChatRoom.where(id: common, room_type: :direct).first
    end
  end

  def create_room(participant_ids, room_type)
    room = DmChatRoom.create!(
      owner_account: @account,
      room_type: room_type,
      title: ''
    )

    room.dm_chat_room_accounts.create!(
      account: @account,
      accepted: true,
      joined_at: Time.current
    )

    participant_ids.each do |pid|
      room.dm_chat_room_accounts.create!(
        account_id: pid,
        accepted: true,
        joined_at: Time.current
      )
    end

    room
  end

  def migrate_messages(room, conversation)
    return if conversation.status_ids.blank?

    statuses = Status.where(id: conversation.status_ids).includes(:media_attachments).order(:created_at)

    statuses.each do |status|
      next if DmMessage.exists?(status_id: status.id)

      content = status.text.presence || ''
      plain_content = ActionController::Base.helpers.strip_tags(content)

      # Set skip_side_effects to suppress after_create callbacks
      # (push_to_streaming, mark_others_unread, update_room_timestamp) to avoid
      # flooding streaming channels with historical messages during migration.
      message = room.dm_messages.new(
        account_id: status.account_id,
        content: content,
        content_plain: plain_content,
        status_id: status.id,
        language: status.language,
        created_at: status.created_at,
        updated_at: status.created_at
      )
      message.skip_side_effects = true
      message.save!

      next unless status.media_attachments.any?

      status.media_attachments.each do |media|
        message.dm_message_attachments.create!(media_attachment: media)
      end
    end

    last_msg = room.dm_messages.order(created_at: :desc).first
    room.update!(last_message_at: last_msg.created_at) if last_msg
  end
end
