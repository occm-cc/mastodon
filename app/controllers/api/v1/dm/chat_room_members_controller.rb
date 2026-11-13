# frozen_string_literal: true

class Api::V1::Dm::ChatRoomMembersController < Api::BaseController
  include Redisable
  include DmChatRoomFinder

  before_action -> { doorkeeper_authorize! :write, :'write:dm' }
  before_action :require_user!
  before_action :set_chat_room

  MAX_MEMBER_IDS = 20

  def create
    raise Mastodon::NotPermittedError unless @chat_room.owner_account_id == current_account.id
    raise Mastodon::NotPermittedError unless @chat_room.group_chat?

    account_ids = member_params[:account_ids] || [member_params[:account_id]].compact
    raise ActiveRecord::RecordNotFound if account_ids.empty?
    raise Mastodon::ValidationError, 'Cannot add more than 20 members at once' if account_ids.size > MAX_MEMBER_IDS

    ActiveRecord::Base.transaction do
      account_ids.each do |account_id|
        account = Account.find(account_id)
        validate_no_blocks!(account)

        membership = @chat_room.dm_chat_room_accounts.find_or_initialize_by(account: account)
        membership.update!(accepted: false, left_at: nil)
      end
    end

    render json: @chat_room, serializer: REST::DmChatRoomSerializer
  end

  def destroy
    raise Mastodon::NotPermittedError unless @chat_room.owner_account_id == current_account.id

    membership = @chat_room.dm_chat_room_accounts.active.find_by!(account_id: params[:id])
    membership.update!(left_at: Time.current)
    redis.del("dm:unread:#{membership.account_id}")

    render_empty
  end

  def accept
    membership = @chat_room.dm_chat_room_accounts.find_by!(account: current_account)

    raise Mastodon::NotPermittedError if membership.accepted?

    membership.update!(accepted: true, joined_at: Time.current)
    render json: @chat_room, serializer: REST::DmChatRoomSerializer
  end

  private

  def member_params
    params.permit(:account_id, account_ids: [])
  end

  def validate_no_blocks!(account)
    blocked = Block.exists?(account: current_account, target_account: account) ||
      Block.exists?(account: account, target_account: current_account)

    raise Mastodon::NotPermittedError if blocked
  end
end
