# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UnfavouriteService do
  describe '#call' do
    context 'with a mention notification' do
      let(:account) { Fabricate(:account) }
      let(:status) { Fabricate(:status) }
      let(:mention) { Fabricate(:mention, account: account, status: status) }
      let!(:notification) { Fabricate(:notification, account: account, activity: mention, type: :mention) }

      before do
        PendingMentionCache.add(account.id, notification.id)
        FavouriteService.new.call(account, status)
      end

      it 'restores the mention removed by favouriting, even when the cache is not empty' do
        other_mention = Fabricate(:mention, account: account)
        other_notification = Fabricate(:notification, account: account, activity: other_mention, type: :mention)
        PendingMentionCache.add(account.id, other_notification.id)

        expect(PendingMentionCache.exists?(account.id, notification.id)).to be false

        subject.call(account, status)

        expect(PendingMentionCache.get(account.id, 40)).to contain_exactly(notification.id, other_notification.id)
      end

      it 'keeps manually dismissed mentions excluded' do
        PendingMentionDismissal.create!(account: account, notification: notification)

        subject.call(account, status)
        PendingMentionCache.populate(account.id)

        expect(PendingMentionCache.exists?(account.id, notification.id)).to be false
      end

      it 'keeps already replied-to mentions excluded' do
        Fabricate(:status, account: account, thread: status)

        subject.call(account, status)

        expect(PendingMentionCache.exists?(account.id, notification.id)).to be false
      end

      it 'keeps filtered notifications excluded' do
        notification.update!(filtered: true)

        subject.call(account, status)

        expect(PendingMentionCache.exists?(account.id, notification.id)).to be false
      end

      it 'does not recreate dismissed notifications' do
        notification.destroy!

        subject.call(account, status)

        expect(PendingMentionCache.count(account.id)).to eq(0)
      end
    end

    context 'with a favourited status' do
      let(:status) { Fabricate(:status, account: account) }
      let!(:favourite) { Fabricate(:favourite, status: status) }

      context 'when the status account is local' do
        let(:account) { Fabricate(:account, domain: nil) }

        it 'destroys the favourite' do
          subject.call(favourite.account, status)

          expect { favourite.reload }
            .to raise_error(ActiveRecord::RecordNotFound)
        end
      end

      context 'when the status account is a remote activitypub account' do
        let(:account) { Fabricate(:account, domain: 'host.example', protocol: :activitypub) }

        it 'destroys the favourite and sends a notification' do
          subject.call(favourite.account, status)

          expect { favourite.reload }
            .to raise_error(ActiveRecord::RecordNotFound)
          expect(ActivityPub::DeliveryWorker)
            .to have_enqueued_sidekiq_job(anything, favourite.account.id, status.account.inbox_url)
        end
      end
    end
  end
end
