# frozen_string_literal: true

class Api::V1::AnnouncementsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: :dismiss
  before_action :require_user!
  before_action :set_announcements, only: :index
  before_action :set_announcement, except: :index

  def index
    render json: @announcements, each_serializer: REST::AnnouncementSerializer
  end

  def dismiss
    AnnouncementMute.find_or_create_by!(account: current_account, announcement: @announcement)
    render_empty
  end

  private

  # Server-wide announcements and announcements of followed accounts are
  # returned together so that existing clients show both.
  def set_announcements
    @announcements = Announcement.visible_records_for(current_account, Announcement.visible_to(current_account).chronological)
  end

  def set_announcement
    @announcement = Announcement.visible_to(current_account).find(params[:id])
    raise ActiveRecord::RecordNotFound unless @announcement.author_can_publish?
  end
end
