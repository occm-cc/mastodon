# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Rack::Attack, type: :request do
  def app
    Rails.application
  end

  shared_examples 'throttled endpoint' do
    before do
      # Rack::Attack periods are not rolling, so avoid flaky tests by setting the time in a way
      # to avoid crossing period boundaries.

      # The code Rack::Attack uses to set periods is the following:
      # https://github.com/rack/rack-attack/blob/v6.7.0/lib/rack/attack/cache.rb#L70-L72
      # So we want to minimize `Time.now.to_i % period`

      travel_to Time.zone.at(counter_prefix * period.seconds)
    end

    context 'when the number of requests is lower than the limit' do
      before do
        below_limit.times { increment_counter }
      end

      it 'does not change the request status' do
        expect { request.call }.to change { throttle_count }.by(1)

        expect(response).to_not have_http_status(429)
      end
    end

    context 'when the number of requests is higher than the limit' do
      before do
        above_limit.times { increment_counter }
      end

      it 'returns http too many requests after limit and returns to normal status after period' do
        expect { request.call }.to change { throttle_count }.by(1)
        expect(response).to have_http_status(429)

        travel period

        expect { request.call }.to change { throttle_count }.by(1)
        expect(response).to_not have_http_status(429)
      end
    end

    def below_limit
      limit - 1
    end

    def above_limit
      limit * 2
    end

    def throttle_count
      described_class.cache.read("#{counter_prefix}:#{throttle}:#{discriminator}") || 0
    end

    def counter_prefix
      (Time.now.to_i / period.seconds).to_i
    end

    def increment_counter
      described_class.cache.count("#{throttle}:#{discriminator}", period)
    end
  end

  let(:remote_ip) { '1.2.3.5' }
  let(:discriminator) { remote_ip }

  describe Rack::Attack::Request do
    let(:user) { Fabricate(:user, role: role) }
    let(:access_token) { Fabricate(:access_token, resource_owner_id: user.id) }
    let(:role_aware_throttle_names) do
      %w(
        throttle_authenticated_api
        throttle_per_token_api
        throttle_api_media
        throttle_authenticated_paging
        throttle_api_delete
        throttle_email_confirmations/email
      )
    end
    let(:role_aware_throttle_limits) do
      Rack::Attack.configuration.throttles
        .slice(*role_aware_throttle_names)
        .transform_values(&:limit)
    end

    before { allow(Doorkeeper::OAuth::Token).to receive(:authenticate).and_return(access_token) }

    context 'when the user role has the API rate limit boost disabled' do
      let(:role) { Fabricate(:user_role, api_rate_limit_boost: false) }

      it 'keeps the configured standard limit' do
        standard_limit = 100
        request = described_class.new(Rack::MockRequest.env_for('/api/v1/timelines/home'))

        expect(request.api_rate_limit(standard_limit)).to eq(standard_limit)
      end
    end

    context 'when the user role has the API rate limit boost enabled' do
      let(:role) { Fabricate(:user_role, api_rate_limit_boost: true) }

      it 'dynamically multiplies each configured authenticated API limit' do
        role.update!(api_rate_limit_boost: false)
        normal_request = described_class.new(Rack::MockRequest.env_for('/api/v1/timelines/home'))
        normal_limits = role_aware_throttle_limits.transform_values { |limit| limit.call(normal_request) }
        role.update!(api_rate_limit_boost: true)
        boosted_request = described_class.new(Rack::MockRequest.env_for('/api/v1/timelines/home'))
        boosted_limits = role_aware_throttle_limits.transform_values { |limit| limit.call(boosted_request) }

        expect(boosted_limits).to eq(normal_limits.transform_values { |limit| limit * UserRole::API_RATE_LIMIT_MULTIPLIER })
      end
    end
  end

  describe 'throttle excessive confirmation e-mail requests by e-mail address' do
    let(:throttle) { 'throttle_email_confirmations/email' }
    let(:limit) { 5 }
    let(:period) { 30.minutes }
    let(:request) { -> { post path, params: { user: { email: email } } } }
    let(:path) { '/auth/confirmation' }
    let(:email) { 'foo@bar.com' }
    let(:discriminator) { email }

    it_behaves_like 'throttled endpoint'
  end

  describe 'throttle excessive sign-up requests by IP address' do
    context 'when accessed through the website' do
      let(:throttle) { 'throttle_sign_up_attempts/ip' }
      let(:limit)  { 25 }
      let(:period) { 5.minutes }
      let(:request) { -> { post path, headers: { 'REMOTE_ADDR' => remote_ip } } }

      context 'with exact path' do
        let(:path) { '/auth' }

        it_behaves_like 'throttled endpoint'
      end

      context 'with path with format' do
        let(:path) { '/auth.html' }

        it_behaves_like 'throttled endpoint'
      end
    end

    context 'when accessed through the API' do
      let(:throttle) { 'throttle_api_sign_up' }
      let(:limit)  { 5 }
      let(:period) { 30.minutes }
      let(:request) { -> { post path, headers: { 'REMOTE_ADDR' => remote_ip } } }

      context 'with exact path' do
        let(:path) { '/api/v1/accounts' }

        it_behaves_like 'throttled endpoint'
      end

      context 'with path with format' do
        let(:path)  { '/api/v1/accounts.json' }

        it 'returns http not found' do
          request.call
          expect(response).to have_http_status(404)
        end
      end
    end
  end

  describe 'throttle excessive sign-in requests by IP address' do
    let(:throttle) { 'throttle_login_attempts/ip' }
    let(:limit)  { 25 }
    let(:period) { 5.minutes }
    let(:request) { -> { post path, headers: { 'REMOTE_ADDR' => remote_ip } } }

    context 'with exact path' do
      let(:path) { '/auth/sign_in' }

      it_behaves_like 'throttled endpoint'
    end

    context 'with path with format' do
      let(:path) { '/auth/sign_in.html' }

      it_behaves_like 'throttled endpoint'
    end
  end

  describe 'throttle excessive oauth application registration requests by IP address' do
    let(:throttle) { 'throttle_oauth_application_registrations/ip' }
    let(:limit)  { 5 }
    let(:period) { 10.minutes }
    let(:path)   { '/api/v1/apps' }
    let(:params) do
      {
        client_name: 'Throttle Test',
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: 'read',
      }
    end

    let(:request) { -> { post path, params: params, headers: { 'REMOTE_ADDR' => remote_ip } } }

    it_behaves_like 'throttled endpoint'
  end

  describe 'throttle excessive password change requests by account' do
    let(:user) { Fabricate(:user, email: 'user@host.example') }
    let(:throttle) { 'throttle_password_change/account' }
    let(:limit) { 10 }
    let(:period) { 10.minutes }
    let(:request) { -> { put path, headers: { 'REMOTE_ADDR' => remote_ip } } }
    let(:path) { '/auth' }
    let(:discriminator) { user.id }

    before do
      sign_in user, scope: :user

      # Unfortunately, devise's `sign_in` helper causes the `session` to be
      # loaded in the next request regardless of whether it's actually accessed
      # by the client code.
      #
      # So, we make an extra query to clear issue a session cookie instead.
      #
      # A less resource-intensive way to deal with that would be to generate the
      # session cookie manually, but this seems pretty involved.
      get '/'
    end

    it_behaves_like 'throttled endpoint'
  end
end
