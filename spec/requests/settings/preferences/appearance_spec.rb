# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Settings Preferences Appearance' do
  let(:user) { Fabricate(:user) }

  before { sign_in user }

  describe 'GET /settings/preferences/appearance' do
    it 'shows all composer positions with sidebar selected by default' do
      get settings_preferences_appearance_path

      expect(response).to have_http_status(200)
      inputs = response.parsed_body.css('input[type="radio"][name="user[settings_attributes][web.composer_position]"]')
      expect(inputs.pluck('value')).to eq %w(sidebar top popup)
      expect(inputs.find { |input| input['checked'] }['value']).to eq 'sidebar'
    end
  end

  describe 'PUT /settings/preferences/appearance' do
    %w(sidebar top popup).each do |position|
      it "persists #{position} and sends it to the web app" do
        put settings_preferences_appearance_path, params: { user: { settings_attributes: { 'web.composer_position' => position } } }

        expect(response).to redirect_to(settings_preferences_appearance_path)
        expect(user.reload.settings['web.composer_position']).to eq position

        get '/home'
        initial_state = JSON.parse(response.parsed_body.at_css('#initial-state').text)
        expect(initial_state.dig('meta', 'composer_position')).to eq position
      end
    end

    it 'gracefully handles invalid nested params' do
      put settings_preferences_appearance_path(user: 'invalid')

      expect(response)
        .to have_http_status(400)
    end
  end
end
