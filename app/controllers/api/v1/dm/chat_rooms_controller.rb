# frozen_string_literal: true

class Api::V1::Dm::ChatRoomsController < Api::BaseController
  include Redisable
  include DmChatRoomFinder

  LIMIT = 20

  before_action -> { doorkeeper_authorize! :read, :'read:dm' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:dm' }, only: [:create, :update, :destroy, :read]
  before_action :require_user!
  before_action :set_chat_room, only: [:show, :update, :destroy, :read]
  after_action :insert_pagination_headers, only: :index

  def index
    trigger_migration_if_needed
    @chat_rooms = paginated_chat_rooms
    render json: @chat_rooms, each_serializer: REST::DmChatRoomSerializer
  end

  def show
    render json: @chat_room, serializer: REST::DmChatRoomSerializer
  end

  def create
    @chat_room = CreateDmChatRoomService.new.call(
      current_account,
      account_ids: chat_room_params[:account_ids],
      title: chat_room_params[:title] || ''
    )

    render json: @chat_room, serializer: REST::DmChatRoomSerializer
  end

  def update
    raise Mastodon::NotPermittedError unless @chat_room.owner_account_id == current_account.id

    @chat_room.update!(title: chat_room_params[:title])
    render json: @chat_room, serializer: REST::DmChatRoomSerializer
  end

  def destroy
    membership = @chat_room.dm_chat_room_accounts.active.find_by!(account: current_account)
    membership.update!(left_at: Time.current)
    redis.del("dm:unread:#{current_account.id}")
    render_empty
  end

  def read
    membership = @chat_room.dm_chat_room_accounts.active.find_by!(account: current_account)
    last_message = @chat_room.dm_messages.visible.reverse_ordered.first

    previous_last_read = membership.last_read_message_id
    membership.update!(unread: false, last_read_message_id: last_message&.id)
    redis.del("dm:unread:#{current_account.id}")

    # Only broadcast if the read position actually advanced
    if last_message && previous_last_read != last_message.id
      payload = {
        chat_room_uuid: @chat_room.uuid,
        account_id: current_account.id.to_s,
        last_read_message_id: last_message.id.to_s,
      }.to_json

      @chat_room.dm_chat_room_accounts.active.where.not(account_id: current_account.id).find_each do |other_membership|
        redis.publish("timeline:dm:#{other_membership.account_id}", { event: :dm_read_receipt, payload: payload }.to_json)
      end
    end

    render json: @chat_room, serializer: REST::DmChatRoomSerializer
  end

  private

  def paginated_chat_rooms
    DmChatRoom.active_for_account(current_account)
      .includes(dm_chat_room_accounts: :account)
      .includes(:owner_account)
      .ordered
      .to_a_paginated_by_id(limit_param(LIMIT), params_slice(:max_id, :since_id, :min_id))
  end

  def chat_room_params
    params.permit(:title, account_ids: [])
  end

  def next_path
    api_v1_dm_chat_rooms_url pagination_params(max_id: pagination_max_id) if records_continue?
  end

  def prev_path
    api_v1_dm_chat_rooms_url pagination_params(min_id: pagination_since_id) unless @chat_rooms.empty?
  end

  def pagination_max_id
    @chat_rooms.last.id
  end

  def pagination_since_id
    @chat_rooms.first.id
  end

  def records_continue?
    @chat_rooms.size == limit_param(LIMIT)
  end

  def trigger_migration_if_needed
    if redis.exists?("dm:migrated:#{current_account.id}")
      nil
    elsif redis.exists?("dm:migrating:#{current_account.id}")
      response.headers['X-DM-Migration-Status'] = 'in_progress'
    else
      redis.set("dm:migrating:#{current_account.id}", '1', ex: 600)
      MigrateConversationsToDmWorker.perform_async(current_account.id)
      response.headers['X-DM-Migration-Status'] = 'in_progress'
    end
  end
end
