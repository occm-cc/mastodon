# frozen_string_literal: true

class Api::V2::ScheduledStatusesController < Api::BaseController
  include Authorization
  include Api::InteractionPoliciesConcern

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!
  before_action :set_status, only: [:show, :update, :destroy]

  after_action :insert_pagination_headers, only: :index

  def index
    @statuses = current_account.scheduled_statuses.includes(:media_attachments, account: :user).to_a_paginated_by_id(limit_param(DEFAULT_STATUSES_LIMIT), params_slice(:max_id, :since_id, :min_id))
    render json: @statuses, each_serializer: REST::V2::ScheduledStatusSerializer
  end

  def show
    render json: @status, serializer: REST::V2::ScheduledStatusSerializer
  end

  def create
    @status = ScheduledStatusService.new.call(current_account, post_options)
    render json: @status, serializer: REST::V2::ScheduledStatusSerializer
  end

  def update
    @status.with_lock do
      @status = ScheduledStatusService.new.call(current_account, post_options, @status)
    end
    render json: @status, serializer: REST::V2::ScheduledStatusSerializer
  end

  def destroy
    @status.with_lock { @status.destroy! }
    render_empty
  end

  private

  def set_status
    @status = current_account.scheduled_statuses.find(params[:id])
  end

  def post_options
    options = @status&.params&.deep_symbolize_keys || {}
    options.merge!(status_params.to_h.deep_symbolize_keys)
    options[:text] = options.delete(:status) if options.key?(:status)
    options[:scheduled_at] = status_params.key?(:scheduled_at) ? status_params[:scheduled_at] : @status&.scheduled_at&.iso8601
    options[:thread] = Status.find(options.delete(:in_reply_to_id)) if options[:in_reply_to_id].present?
    options[:quoted_status] = Status.find(options.delete(:quoted_status_id)).proper if options[:quoted_status_id].present?
    authorize(options[:thread], :show?) if options[:thread].present?
    authorize(options[:quoted_status], :quote?) if options[:quoted_status].present?
    options[:application] = options[:application_id].present? ? Doorkeeper::Application.find(options.delete(:application_id)) : doorkeeper_token.application
    options[:quote_approval_policy] = quote_approval_policy if @status.nil? || status_params.key?(:quote_approval_policy)
    options[:with_rate_limit] = @status.nil?
    options[:idempotency] = request.headers['Idempotency-Key'] if @status.nil?
    options[:media_ids] = @status.media_attachments.ids.map(&:to_s) if @status.present? && !options.key?(:media_ids)
    options
  end

  def status_params
    permitted = params.permit(
      :status,
      :in_reply_to_id,
      :quoted_status_id,
      :quote_approval_policy,
      :sensitive,
      :spoiler_text,
      :visibility,
      :language,
      :scheduled_at,
      allowed_mentions: [],
      media_ids: [],
      media_attributes: [:id, :description, :focus],
      poll: [:multiple, :hide_totals, :expires_in, { options: [] }]
    )
    permitted[:poll] = nil if params.key?(:poll) && params[:poll].nil?
    permitted
  end

  def next_path
    api_v2_scheduled_statuses_url pagination_params(max_id: pagination_max_id) if @statuses.size == limit_param(DEFAULT_STATUSES_LIMIT)
  end

  def prev_path
    api_v2_scheduled_statuses_url pagination_params(min_id: pagination_since_id) unless @statuses.empty?
  end

  def pagination_collection
    @statuses
  end
end
