# frozen_string_literal: true

class Api::V1::AccountAnnouncementsController < Api::BaseController
  include AccountAnnouncementManagement

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, except: [:index, :show]
  before_action :require_user!
  before_action :require_permission!
  before_action :set_announcement, except: [:index, :create]

  def index
    render json: account_announcements.reverse_chronological, each_serializer: REST::AnnouncementSerializer
  end

  def show
    render json: @announcement, serializer: REST::AnnouncementSerializer
  end

  def create
    @announcement = account_announcements.new
    save_or_fail!
  end

  def update
    save_or_fail!
  end

  def destroy
    destroy_account_announcement(@announcement)
    render_empty
  end

  private

  def require_permission!
    forbidden unless can_manage_follower_announcements?
  end

  def save_or_fail!
    raise ActiveRecord::RecordInvalid, @announcement unless save_account_announcement(@announcement, announcement_params)

    render json: @announcement, serializer: REST::AnnouncementSerializer
  end

  def set_announcement
    @announcement = account_announcements.find(params[:id])
  end

  def announcement_params
    params.permit(*AccountAnnouncementManagement::PERMITTED_PARAMS)
  end
end
