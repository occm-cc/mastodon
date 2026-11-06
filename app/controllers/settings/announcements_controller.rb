# frozen_string_literal: true

class Settings::AnnouncementsController < Settings::BaseController
  include AccountAnnouncementManagement

  before_action :require_permission!
  before_action :set_announcement, except: [:index, :new, :create]

  def index
    @announcements = account_announcements.reverse_chronological.page(params[:page])
  end

  def new
    @announcement = account_announcements.new
  end

  def edit; end

  def create
    @announcement = account_announcements.new

    if save_account_announcement(@announcement, resource_params)
      redirect_to settings_announcements_path, notice: @announcement.published? ? I18n.t('admin.announcements.published_msg') : I18n.t('admin.announcements.scheduled_msg')
    else
      render :new
    end
  end

  def update
    if save_account_announcement(@announcement, resource_params)
      redirect_to settings_announcements_path, notice: I18n.t('admin.announcements.updated_msg')
    else
      render :edit
    end
  end

  def publish
    publish_account_announcement(@announcement)
    redirect_to settings_announcements_path, notice: I18n.t('admin.announcements.published_msg')
  end

  def unpublish
    unpublish_account_announcement(@announcement)
    redirect_to settings_announcements_path, notice: I18n.t('admin.announcements.unpublished_msg')
  end

  def destroy
    destroy_account_announcement(@announcement)
    redirect_to settings_announcements_path, notice: I18n.t('admin.announcements.destroyed_msg')
  end

  private

  def require_permission!
    forbidden unless can_manage_follower_announcements?
  end

  def set_announcement
    @announcement = account_announcements.find(params[:id])
  end

  def resource_params
    params.expect(announcement: AccountAnnouncementManagement::PERMITTED_PARAMS)
  end
end
