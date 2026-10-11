# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PublishScheduledStatusWorker do
  subject { described_class.new }

  let(:scheduled_status) { Fabricate(:scheduled_status, params: { text: 'Hello world, future!' }) }

  describe 'perform' do
    before do
      travel_to scheduled_status.scheduled_at + 1.second do
        subject.perform(scheduled_status.id)
      end
    end

    context 'when the account is not disabled' do
      let(:user) { Fabricate(:user) }
      let(:scheduled_status) { Fabricate(:scheduled_status, account: user.account, params: { text: 'Hello world, future!', quoted_status_id: Fabricate(:status, account: user.account).id }) }

      it 'creates a status and removes scheduled record' do
        expect(scheduled_status.account.statuses.first.text).to eq 'Hello world, future!'
        expect(scheduled_status.account.statuses.first.quote).to_not be_nil

        expect(ScheduledStatus.find_by(id: scheduled_status.id)).to be_nil
      end
    end

    context 'when the account is disabled' do
      let(:scheduled_status) { Fabricate(:scheduled_status, account: Fabricate(:account, user: Fabricate(:user, disabled: true))) }

      it 'does not create a status and removes scheduled record' do
        expect(Status.count).to eq 0

        expect(ScheduledStatus.find_by(id: scheduled_status.id)).to be_nil
      end
    end
  end

  describe 'changed and repeated jobs' do
    it 'does not publish a reservation moved to a later time' do
      original_time = scheduled_status.scheduled_at
      scheduled_status.update!(scheduled_at: original_time + 1.hour)
      travel_to original_time do
        expect { subject.perform(scheduled_status.id) }.to not_change(Status, :count)
        expect(ScheduledStatus.exists?(scheduled_status.id)).to be(true)
      end
    end

    it 'publishes once when the same job is performed again' do
      travel_to scheduled_status.scheduled_at + 1.second do
        expect do
          2.times { subject.perform(scheduled_status.id) }
        end.to change(Status, :count).by(1)
      end
    end

    it 'retains the reservation if post validation fails' do
      scheduled_status.update!(params: { text: '' })
      travel_to scheduled_status.scheduled_at + 1.second do
        subject.perform(scheduled_status.id)
        expect(ScheduledStatus.exists?(scheduled_status.id)).to be(true)
      end
    end

    it 'ignores a cancelled reservation' do
      id = scheduled_status.id
      scheduled_status.destroy!
      expect { subject.perform(id) }.to not_change(Status, :count)
    end
  end

  describe 'concurrent publishing', use_transactional_tests: false do
    it 'consumes the reservation only once across database connections' do
      user = Fabricate(:user)
      reservation = Fabricate(:scheduled_status, account: user.account, params: { text: 'Only once' })

      travel_to reservation.scheduled_at + 1.second do
        multi_threaded_execution(2) do
          ActiveRecord::Base.connection_pool.with_connection do
            described_class.new.perform(reservation.id)
          end
        end
      end

      expect(user.account.statuses.count).to eq(1)
      expect(ScheduledStatus.exists?(reservation.id)).to be(false)
    ensure
      user&.account&.statuses&.destroy_all
      user&.account&.destroy!
    end
  end
end
