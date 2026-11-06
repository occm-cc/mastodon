# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Announcement do
  describe 'Scopes' do
    context 'with published and unpublished records' do
      let!(:published) { Fabricate(:announcement, published: true) }
      let!(:unpublished) { Fabricate(:announcement, published: false, scheduled_at: 10.days.from_now) }

      describe '#unpublished' do
        it 'returns records with published false' do
          results = described_class.unpublished

          expect(results).to eq([unpublished])
        end
      end

      describe '#published' do
        it 'returns records with published true' do
          results = described_class.published

          expect(results).to eq([published])
        end
      end
    end

    context 'with timestamped announcements' do
      let!(:adam_announcement) { Fabricate(:announcement, starts_at: 100.days.ago, scheduled_at: 10.days.ago, published_at: 10.days.ago, ends_at: 5.days.from_now) }
      let!(:brenda_announcement) { Fabricate(:announcement, starts_at: 10.days.ago, scheduled_at: 100.days.ago, published_at: 10.days.ago, ends_at: 5.days.from_now) }
      let!(:clara_announcement) { Fabricate(:announcement, starts_at: 10.days.ago, scheduled_at: 10.days.ago, published_at: 100.days.ago, ends_at: 5.days.from_now) }
      let!(:darnelle_announcement) { Fabricate(:announcement, starts_at: 10.days.ago, scheduled_at: 10.days.ago, published_at: 10.days.ago, ends_at: 5.days.from_now, created_at: 100.days.ago) }

      describe '#chronological' do
        it 'orders the records correctly' do
          results = described_class.chronological

          expect(results).to eq(
            [
              adam_announcement,
              brenda_announcement,
              clara_announcement,
              darnelle_announcement,
            ]
          )
        end
      end

      describe '#reverse_chronological' do
        it 'orders the records correctly' do
          results = described_class.reverse_chronological

          expect(results).to eq(
            [
              darnelle_announcement,
              clara_announcement,
              brenda_announcement,
              adam_announcement,
            ]
          )
        end
      end
    end
  end

  describe 'Validations' do
    it { is_expected.to validate_presence_of(:text) }

    describe 'ends_at' do
      context 'when starts_at is present' do
        subject { Fabricate.build :announcement, starts_at: 1.day.ago }

        it { is_expected.to validate_presence_of(:ends_at) }
      end

      context 'when starts_at is missing' do
        subject { Fabricate.build :announcement, starts_at: nil }

        it { is_expected.to_not validate_presence_of(:ends_at) }
      end
    end

    describe 'starts_at' do
      context 'when ends_at is present' do
        subject { Fabricate.build :announcement, ends_at: 1.day.ago }

        it { is_expected.to validate_presence_of(:starts_at) }
      end

      context 'when ends_at is missing' do
        subject { Fabricate.build :announcement, ends_at: nil }

        it { is_expected.to_not validate_presence_of(:starts_at) }
      end
    end
  end

  describe '#publish!' do
    it 'publishes an unpublished record' do
      announcement = Fabricate(:announcement, published: false, scheduled_at: 10.days.from_now)

      announcement.publish!

      expect(announcement).to be_published
      expect(announcement.published_at).to_not be_nil
      expect(announcement.scheduled_at).to be_nil
    end
  end

  describe '#unpublish!' do
    it 'unpublishes a published record' do
      announcement = Fabricate(:announcement, published: true)

      announcement.unpublish!

      expect(announcement).to_not be_published
      expect(announcement.scheduled_at).to be_nil
    end
  end

  describe '#reactions' do
    context 'with announcement_reactions present' do
      let(:account_reaction_emoji) { Fabricate :custom_emoji }
      let(:other_reaction_emoji) { Fabricate :custom_emoji }
      let!(:account) { Fabricate(:account) }
      let!(:announcement) { Fabricate(:announcement) }

      before do
        Fabricate(:announcement_reaction, announcement: announcement, created_at: 10.days.ago, name: other_reaction_emoji.shortcode)
        Fabricate(:announcement_reaction, announcement: announcement, created_at: 5.days.ago, account: account, name: account_reaction_emoji.shortcode)
        Fabricate(:announcement_reaction) # For some other announcement
      end

      it 'returns the announcement reactions for the announcement' do
        results = announcement.reactions

        expect(results).to have_attributes(
          size: eq(2),
          first: have_attributes(name: other_reaction_emoji.shortcode, me: false),
          last: have_attributes(name: account_reaction_emoji.shortcode, me: false)
        )
      end

      it 'returns the announcement reactions for the announcement with `me` set correctly' do
        results = announcement.reactions(account)

        expect(results).to have_attributes(
          size: eq(2),
          first: have_attributes(name: other_reaction_emoji.shortcode, me: false),
          last: have_attributes(name: account_reaction_emoji.shortcode, me: true)
        )
      end
    end
  end

  describe '#statuses' do
    let(:announcement) { Fabricate(:announcement, status_ids: status_ids) }

    context 'with empty status_ids' do
      let(:status_ids) { nil }

      it 'returns empty array' do
        results = announcement.statuses

        expect(results).to eq([])
      end
    end

    context 'with relevant status_ids' do
      let(:status) { Fabricate(:status, visibility: :public) }
      let(:direct_status) { Fabricate(:status, visibility: :direct) }
      let(:status_ids) { [status.id, direct_status.id] }

      it 'returns public and unlisted statuses' do
        results = announcement.statuses

        expect(results).to include(status)
        expect(results).to_not include(direct_status)
      end
    end
  end

  describe 'account announcements' do
    let(:publisher_role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_follower_announcements]) }
    let(:author) { Fabricate(:user, role: publisher_role).account }
    let(:viewer) { Fabricate(:account) }

    describe '.visible_to' do
      let!(:server_announcement) { Fabricate(:announcement) }
      let!(:account_announcement) { Fabricate(:announcement, account: author) }
      let!(:other_announcement) { Fabricate(:announcement, account: Fabricate(:user, role: publisher_role).account) }

      it 'only returns server-wide announcements without an account' do
        expect(described_class.visible_to(nil)).to contain_exactly(server_announcement)
      end

      it 'returns server-wide announcements and those of followed accounts' do
        viewer.follow!(author)

        expect(described_class.visible_to(viewer)).to contain_exactly(server_announcement, account_announcement)
        expect(described_class.visible_to(viewer)).to_not include(other_announcement)
      end

      it 'returns the own announcements of the author' do
        expect(described_class.visible_to(author)).to contain_exactly(server_announcement, account_announcement)
      end

      it 'returns announcements of every followed publisher' do
        second_author = Fabricate(:user, role: publisher_role).account
        second_announcement = Fabricate(:announcement, account: second_author)
        viewer.follow!(author)
        viewer.follow!(second_author)

        expect(described_class.visible_to(viewer)).to contain_exactly(server_announcement, account_announcement, second_announcement)
      end

      it 'hides announcements again after unfollowing' do
        viewer.follow!(author)
        viewer.unfollow!(author)

        expect(described_class.visible_to(viewer)).to contain_exactly(server_announcement)
      end

      it 'excludes unpublished account announcements' do
        viewer.follow!(author)
        account_announcement.unpublish!

        expect(described_class.visible_to(viewer)).to contain_exactly(server_announcement)
      end

      it 'excludes announcements of muted authors' do
        viewer.follow!(author)
        viewer.mute!(author)

        expect(described_class.visible_to(viewer)).to contain_exactly(server_announcement)
      end

      it 'excludes announcements of suspended authors' do
        viewer.follow!(author)
        author.suspend!

        expect(described_class.visible_to(viewer)).to contain_exactly(server_announcement)
      end
    end

    describe '.visible_records_for' do
      let!(:account_announcement) { Fabricate(:announcement, account: author) }

      before { viewer.follow!(author) }

      it 'includes announcements of authors with the permission' do
        expect(described_class.visible_records_for(viewer)).to contain_exactly(account_announcement)
      end

      it 'excludes announcements of authors that lost the permission' do
        author.user.update!(role: nil)

        expect(described_class.visible_records_for(viewer)).to be_empty
      end
    end

    describe 'validations' do
      it 'rejects remote authors' do
        announcement = Fabricate.build(:announcement, account: Fabricate(:account, domain: 'example.com'))

        expect(announcement).to_not be_valid
        expect(announcement.errors[:account]).to be_present
      end

      it 'limits the number of active announcements per account' do
        Fabricate.times(Announcement::PER_ACCOUNT_LIMIT, :announcement, account: author)

        expect(Fabricate.build(:announcement, account: author)).to_not be_valid
      end

      it 'does not count unpublished announcements towards the limit' do
        Fabricate.times(Announcement::PER_ACCOUNT_LIMIT, :announcement, account: author).each(&:unpublish!)

        expect(Fabricate.build(:announcement, account: author)).to be_valid
      end

      it 'does not limit server-wide announcements' do
        Fabricate.times(Announcement::PER_ACCOUNT_LIMIT, :announcement)

        expect(Fabricate.build(:announcement)).to be_valid
      end
    end
  end
end
