# frozen_string_literal: true

require 'rails_helper'

RSpec.describe '/api/v2/scheduled_statuses' do
  include_context 'with API authentication'

  let(:scopes) { 'read:statuses write:statuses' }
  let(:schedule_time) { 1.hour.from_now.iso8601 }

  def create_schedule(**attributes)
    post api_v2_scheduled_statuses_path, headers: headers, params: { status: 'Future post', scheduled_at: schedule_time, language: 'ko' }.merge(attributes), as: :json
  end

  describe 'POST /api/v2/scheduled_statuses' do
    it 'creates a reservation without publishing a status' do
      expect { create_schedule }.to change(ScheduledStatus, :count).by(1).and not_change(Status, :count)
      expect(response).to have_http_status(200)
      expect(response.parsed_body[:params]).to include(text: 'Future post', language: 'ko')
    end

    it 'does not publish past, missing or invalid dates' do
      [1.minute.ago.iso8601, 5.minutes.from_now.iso8601, nil, 'not a date'].each do |date|
        expect { create_schedule(scheduled_at: date) }.to not_change(Status, :count).and not_change(ScheduledStatus, :count)
        expect(response).to have_http_status(422)
      end
    end

    it 'requires write scope' do
      token.update!(scopes: 'read:statuses')
      create_schedule
      expect(response).to have_http_status(403)
    end

    it 'supports a write-only token' do
      token.update!(scopes: 'write:statuses')
      create_schedule
      expect(response).to have_http_status(200)
    end

    it 'normalizes booleans submitted as form strings' do
      create_schedule(sensitive: 'false', poll: { options: %w(Yes No), expires_in: 3600, multiple: 'false' })
      expect(response).to have_http_status(200)
      expect(user.account.scheduled_statuses.last.params).to include('sensitive' => false)
      expect(response.parsed_body[:params][:poll][:multiple]).to be(false)
    end

    it 'honors the idempotency key' do
      keyed_headers = headers.merge('Idempotency-Key' => SecureRandom.uuid)
      2.times { post api_v2_scheduled_statuses_path, headers: keyed_headers, params: { status: 'Once', scheduled_at: schedule_time }, as: :json }
      expect(user.account.scheduled_statuses.count).to eq(1)
    end

    it 'rejects media already reserved by another post' do
      reserved = Fabricate(:scheduled_status, account: user.account)
      media = Fabricate(:media_attachment, account: user.account, scheduled_status: reserved)
      create_schedule(media_ids: [media.id.to_s])
      expect(response).to have_http_status(422)
      expect(media.reload.scheduled_status_id).to eq(reserved.id)
    end

    it 'validates reply visibility and quote permissions' do
      private_post = Fabricate(:status, visibility: :private)
      create_schedule(in_reply_to_id: private_post.id.to_s)
      expect(response).to have_http_status(403)
      create_schedule(quoted_status_id: private_post.id.to_s)
      expect(response).to have_http_status(403)
    end

    it 'preserves reply, quote and poll data for later publication' do
      quoted = Fabricate(:status, account: user.account)
      create_schedule(in_reply_to_id: quoted.id.to_s, quoted_status_id: quoted.id.to_s)
      expect(response).to have_http_status(200)
      expect(response.parsed_body[:params]).to include(in_reply_to_id: quoted.id.to_s, quoted_status_id: quoted.id.to_s)
      create_schedule(poll: { options: %w(Yes No), expires_in: 3600, multiple: true })
      expect(response).to have_http_status(200)
      expect(response.parsed_body[:params][:poll]).to include(options: %w(Yes No), expires_in: 3600, multiple: true)
    end
  end

  describe 'PUT /api/v2/scheduled_statuses/:id' do
    let!(:scheduled) { Fabricate(:scheduled_status, account: user.account, params: { text: 'Original', language: 'ko', visibility: 'private', sensitive: false }) }

    it 'updates the same reservation and preserves omitted fields' do
      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { status: 'Edited', scheduled_at: schedule_time }, as: :json
      expect(response).to have_http_status(200)
      expect(response.parsed_body[:id]).to eq(scheduled.id.to_s)
      expect(scheduled.reload.params).to include('text' => 'Edited', 'language' => 'ko', 'visibility' => 'private')
      expect(scheduled.scheduled_at.iso8601).to eq(schedule_time)
    end

    it 'restores content and supports clearing a poll' do
      scheduled.update!(params: scheduled.params.merge(poll: { options: %w(Yes No), expires_in: 3600 }))
      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { poll: nil }, as: :json
      expect(response).to have_http_status(200)
      expect(scheduled.reload.params['poll']).to be_nil
    end

    it 'rolls back invalid content changes' do
      original = scheduled.reload.attributes
      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { status: '', scheduled_at: schedule_time }, as: :json
      expect(response).to have_http_status(422)
      expect(scheduled.reload.attributes).to eq(original)
    end

    it 'cannot update another account reservation' do
      other = Fabricate(:scheduled_status)
      put api_v2_scheduled_status_path(other), headers: headers, params: { status: 'Stolen', scheduled_at: schedule_time }, as: :json
      expect(response).to have_http_status(404)
    end

    it 'rejects media belonging to another account' do
      media = Fabricate(:media_attachment)
      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { media_ids: [media.id.to_s] }, as: :json
      expect(response).to have_http_status(422)
      expect(media.reload.scheduled_status_id).to be_nil
    end

    it 'changes media and descriptions atomically' do
      previous = Fabricate(:media_attachment, account: user.account, scheduled_status: scheduled)
      added = Fabricate(:media_attachment, account: user.account)
      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { media_ids: [added.id.to_s], media_attributes: [{ id: added.id.to_s, description: 'New alt text' }] }, as: :json
      expect(response).to have_http_status(200)
      expect(previous.reload.scheduled_status_id).to be_nil
      expect(added.reload).to have_attributes(scheduled_status_id: scheduled.id, description: 'New alt text')
    end

    it 'rolls back media descriptions and associations if reservation validation fails' do
      previous = Fabricate(:media_attachment, account: user.account, scheduled_status: scheduled)
      added = Fabricate(:media_attachment, account: user.account, description: 'Original alt')
      Fabricate(:scheduled_status, account: user.account)
      stub_const('ScheduledStatus::TOTAL_LIMIT', 1)

      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { media_ids: [added.id.to_s], media_attributes: [{ id: added.id.to_s, description: 'Changed alt' }] }, as: :json

      expect(response).to have_http_status(422)
      expect(previous.reload.scheduled_status_id).to eq(scheduled.id)
      expect(added.reload).to have_attributes(scheduled_status_id: nil, description: 'Original alt')
    end

    it 'allows edits when the reservation already occupies the final daily and total slots' do
      stub_const('ScheduledStatus::TOTAL_LIMIT', 1)
      stub_const('ScheduledStatus::DAILY_LIMIT', 1)
      put api_v2_scheduled_status_path(scheduled), headers: headers, params: { status: 'Edited at limit' }, as: :json
      expect(response).to have_http_status(200)
    end
  end

  describe 'reading and cancellation' do
    let!(:scheduled) { Fabricate(:scheduled_status, account: user.account, params: { text: 'Visible', in_reply_to_id: 123 }) }

    it 'lists only the current account and uses V2 pagination links' do
      Fabricate(:scheduled_status)
      get api_v2_scheduled_statuses_path, headers: headers, params: { limit: 1 }
      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to eq([scheduled.id.to_s])
      expect(response.headers['Link']).to include('/api/v2/scheduled_statuses')
    end

    it 'serializes reply IDs as strings' do
      get api_v2_scheduled_status_path(scheduled), headers: headers
      expect(response.parsed_body[:params][:in_reply_to_id]).to eq('123')
    end

    it 'exposes the effective language of a legacy reservation without changing V1' do
      user.update!(locale: 'ko')
      user.settings['default_language'] = 'fr'
      user.save!
      get api_v2_scheduled_status_path(scheduled), headers: headers
      expect(response.parsed_body[:params][:language]).to eq('fr')
      get api_v1_scheduled_status_path(scheduled), headers: headers
      expect(response.parsed_body[:params][:language]).to be_nil
    end

    it 'normalizes legacy form booleans for V2 while leaving the V1 response intact' do
      scheduled.update!(params: { text: 'Legacy', sensitive: 'false', poll: { options: %w(Yes No), expires_in: 3600, multiple: 'false' } })
      get api_v2_scheduled_status_path(scheduled), headers: headers
      expect(response.parsed_body[:params]).to include(sensitive: false)
      expect(response.parsed_body[:params][:poll][:multiple]).to be(false)
      get api_v1_scheduled_status_path(scheduled), headers: headers
      expect(response.parsed_body[:params][:sensitive]).to eq('false')
    end

    it 'cancels the reservation' do
      delete api_v2_scheduled_status_path(scheduled), headers: headers
      expect(response).to have_http_status(200)
      expect(ScheduledStatus.exists?(scheduled.id)).to be(false)
    end
  end

  describe 'V1 compatibility' do
    it 'continues to ignore content in a V1 time update' do
      scheduled = Fabricate(:scheduled_status, account: user.account, params: { text: 'Original' })
      put api_v1_scheduled_status_path(scheduled), headers: headers, params: { status: 'Ignored', scheduled_at: schedule_time }
      expect(response).to have_http_status(200)
      expect(scheduled.reload.params['text']).to eq('Original')
    end

    it 'preserves V1 past-date posting behavior' do
      post api_v1_statuses_path, headers: headers, params: { status: 'V1 post', scheduled_at: 1.minute.ago.iso8601 }
      expect(response).to have_http_status(200)
      expect(user.account.statuses.last.text).to eq('V1 post')
    end
  end
end
