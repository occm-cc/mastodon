# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AppSignUpService do
  subject { described_class.new }

  let(:app) { Fabricate(:application, scopes: 'read write') }
  let(:good_params) { { username: 'alice', password: '12345678', email: 'good@email.com', agreement: true } }
  let(:remote_ip) { IPAddr.new('198.0.2.1') }

  describe '#call' do
    let(:params) { good_params }

    shared_examples 'successful registration' do
      it 'creates an unconfirmed user with access token and the app\'s scope', :aggregate_failures do
        access_token = subject.call(app, remote_ip, params)
        expect(access_token).to_not be_nil
        expect(access_token.scopes.to_s).to eq 'read write'

        user = User.find_by(id: access_token.resource_owner_id)
        expect(user).to_not be_nil
        expect(user.confirmed?).to be false

        expect(user.account).to_not be_nil
        expect(user.invite_request).to be_nil
      end
    end

    context 'when the email address requires approval' do
      before do
        Setting.registrations_mode = 'open'
        Fabricate(:email_domain_block, allow_with_approval: true, domain: 'email.com')
      end

      it 'creates an unapproved user', :aggregate_failures do
        access_token = subject.call(app, remote_ip, params)
        expect(access_token).to_not be_nil
        expect(access_token.scopes.to_s).to eq 'read write'

        user = User.find_by(id: access_token.resource_owner_id)
        expect(user).to_not be_nil
        expect(user.confirmed?).to be false
        expect(user.approved?).to be false

        expect(user.account).to_not be_nil
        expect(user.invite_request).to be_nil
      end
    end

    context 'when the email address requires approval through MX records' do
      before do
        Setting.registrations_mode = 'open'
        Fabricate(:email_domain_block, allow_with_approval: true, domain: 'smtp.email.com')
        allow(User).to receive(:skip_mx_check?).and_return(false)
        configure_mx(domain: 'email.com', exchange: 'smtp.email.com')
      end

      it 'creates an unapproved user', :aggregate_failures do
        access_token = subject.call(app, remote_ip, params)
        expect(access_token).to_not be_nil
        expect(access_token.scopes.to_s).to eq 'read write'

        user = User.find_by(id: access_token.resource_owner_id)
        expect(user).to_not be_nil
        expect(user.confirmed?).to be false
        expect(user.approved?).to be false

        expect(user.account).to_not be_nil
        expect(user.invite_request).to be_nil
      end
    end

    context 'when registrations are closed' do
      before do
        Setting.registrations_mode = 'none'
      end

      it 'raises an error', :aggregate_failures do
        expect { subject.call(app, remote_ip, good_params) }.to raise_error Mastodon::NotPermittedError
      end

      context 'when using a valid invite' do
        let(:params) { good_params.merge({ invite_code: invite.code }) }
        let(:invite) { Fabricate(:invite) }

        before do
          invite.user.approve!
        end

        it_behaves_like 'successful registration'
      end

      context 'when using an invalid invite' do
        let(:params) { good_params.merge({ invite_code: invite.code }) }
        let(:invite) { Fabricate(:invite, uses: 1, max_uses: 1) }

        it 'raises an error', :aggregate_failures do
          expect { subject.call(app, remote_ip, params) }.to raise_error Mastodon::NotPermittedError
        end
      end
    end

    it 'raises an error when params are missing' do
      expect { subject.call(app, remote_ip, {}) }.to raise_error ActiveRecord::RecordInvalid
    end

    it_behaves_like 'successful registration'

    context 'when open registrations retain the invite text requirement' do
      before do
        Setting.registrations_mode = 'open'
        Setting.require_invite_text = true
      end

      it_behaves_like 'successful registration'

      context 'when the reason contains only whitespace' do
        let(:params) { good_params.merge(reason: " \t\n") }

        it_behaves_like 'successful registration'
      end
    end

    context 'when given an invite request text' do
      before do
        Setting.registrations_mode = 'approved'
      end

      it 'creates an account with invite request text' do
        access_token = subject.call(app, remote_ip, good_params.merge(reason: 'Foo bar'))
        expect(access_token).to_not be_nil
        user = User.find_by(id: access_token.resource_owner_id)
        expect(user).to_not be_nil
        expect(user.invite_request&.text).to eq 'Foo bar'
        expect(user.approved?).to be false
      end
    end

    context 'when open registrations receive an invite request text' do
      before do
        Setting.registrations_mode = 'open'
      end

      it 'rejects the registration without creating a user, account, or token', :aggregate_failures do
        app

        expect { subject.call(app, remote_ip, good_params.merge(reason: 'Any nonempty reason')) }
          .to raise_error(ActiveRecord::RecordInvalid) { |error| expect(error.record.errors.of_kind?(:'invite_request.text', :invalid)).to be true }
          .and not_change(User, :count)
          .and not_change(Account, :count)
          .and not_change(Doorkeeper::AccessToken, :count)
      end

      context 'when the email address requires approval' do
        before do
          Fabricate(:email_domain_block, allow_with_approval: true, domain: 'email.com')
        end

        it 'preserves the reason and creates an unapproved user', :aggregate_failures do
          access_token = subject.call(app, remote_ip, good_params.merge(reason: 'Please review my registration'))
          user = User.find(access_token.resource_owner_id)

          expect(user.approved?).to be false
          expect(user.invite_request.text).to eq 'Please review my registration'
        end
      end
    end
  end
end
