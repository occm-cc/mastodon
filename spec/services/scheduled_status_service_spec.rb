# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ScheduledStatusService, use_transactional_tests: false do
  it 'returns one committed reservation for concurrent requests with the same idempotency key' do
    user = Fabricate(:user)
    options = { text: 'Schedule once', scheduled_at: 1.hour.from_now.iso8601, idempotency: SecureRandom.uuid }
    ids = Queue.new

    multi_threaded_execution(2) do
      ActiveRecord::Base.connection_pool.with_connection do
        ids << described_class.new.call(user.account, options).id
      end
    end

    expect([ids.pop, ids.pop].uniq.size).to eq(1)
    expect(user.account.scheduled_statuses.count).to eq(1)
  ensure
    user&.account&.destroy!
  end
end
