import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { FormattedDate, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { dismissAnnouncement } from '@/mastodon/actions/announcements';
import type { ApiAnnouncementJSON } from '@/mastodon/api_types/announcements';
import { Avatar } from '@/mastodon/components/avatar';
import { DisplayName } from '@/mastodon/components/display_name';
import { AnimateEmojiProvider } from '@/mastodon/components/emoji/context';
import { EmojiHTML } from '@/mastodon/components/emoji/html';
import { useAccount } from '@/mastodon/hooks/useAccount';
import { useAppDispatch } from '@/mastodon/store';

import classes from './announcement.module.scss';
import { ReactionsBar } from './reactions';

export interface IAnnouncement extends Omit<ApiAnnouncementJSON, 'account'> {
  contentHtml: string;
  /** Author of an account announcement, `null` for server-wide ones */
  account_id: string | null;
}

interface AnnouncementProps {
  announcement: IAnnouncement;
  active?: boolean;
}

export const Announcement: FC<AnnouncementProps> = ({
  announcement,
  active,
}) => {
  const { read, id } = announcement;

  // Dismiss announcement when it becomes active.
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (active && !read) {
      dispatch(dismissAnnouncement(id));
    }
  }, [active, id, dispatch, read]);

  // But visually show the announcement as read only when it goes out of view.
  const [isVisuallyRead, setIsVisuallyRead] = useState(read);
  const [previousActive, setPreviousActive] = useState(active);
  if (active !== previousActive) {
    setPreviousActive(active);

    // This marks the announcement as read in the UI only after it
    // went from active to inactive.
    if (!active && isVisuallyRead !== read) {
      setIsVisuallyRead(read);
    }
  }

  return (
    <AnimateEmojiProvider>
      <strong className='announcements__range'>
        {announcement.account_id ? (
          <AnnouncementAuthor accountId={announcement.account_id} />
        ) : (
          <FormattedMessage
            id='announcement.announcement'
            defaultMessage='Announcement'
          />
        )}
        <span>
          {' · '}
          <Timestamp announcement={announcement} />
          {!isVisuallyRead && <span className='announcements__unread' />}
        </span>
      </strong>

      <EmojiHTML
        className='announcements__content translate'
        htmlString={announcement.contentHtml}
        extraEmojis={announcement.emojis}
      />

      {announcement.reactions_allowed ? (
        <ReactionsBar reactions={announcement.reactions} id={announcement.id} />
      ) : (
        <div className='reactions-bar reactions-bar--empty' />
      )}
    </AnimateEmojiProvider>
  );
};

const AnnouncementAuthor: FC<{ accountId: string }> = ({ accountId }) => {
  const account = useAccount(accountId);

  if (!account) {
    return (
      <FormattedMessage
        id='announcement.announcement'
        defaultMessage='Announcement'
      />
    );
  }

  return (
    <Link to={`/@${account.acct}`} className={classes.author}>
      <Avatar account={account} size={20} />
      <FormattedMessage
        id='announcement.account_announcement'
        defaultMessage='Announcement from {name}'
        values={{ name: <DisplayName account={account} variant='simple' /> }}
      />
    </Link>
  );
};

const Timestamp: FC<Pick<AnnouncementProps, 'announcement'>> = ({
  announcement,
}) => {
  const startsAt = announcement.starts_at && new Date(announcement.starts_at);
  const endsAt = announcement.ends_at && new Date(announcement.ends_at);
  const now = new Date();
  const hasTimeRange = startsAt && endsAt;
  const skipTime = announcement.all_day;

  if (hasTimeRange) {
    const skipYear =
      startsAt.getFullYear() === endsAt.getFullYear() &&
      endsAt.getFullYear() === now.getFullYear();
    const skipEndDate =
      startsAt.getDate() === endsAt.getDate() &&
      startsAt.getMonth() === endsAt.getMonth() &&
      startsAt.getFullYear() === endsAt.getFullYear();
    return (
      <>
        <FormattedDate
          value={startsAt}
          year={
            skipYear || startsAt.getFullYear() === now.getFullYear()
              ? undefined
              : 'numeric'
          }
          month='short'
          day='2-digit'
          hour={skipTime ? undefined : '2-digit'}
          minute={skipTime ? undefined : '2-digit'}
        />{' '}
        -{' '}
        <FormattedDate
          value={endsAt}
          year={
            skipYear || endsAt.getFullYear() === now.getFullYear()
              ? undefined
              : 'numeric'
          }
          month={skipEndDate ? undefined : 'short'}
          day={skipEndDate ? undefined : '2-digit'}
          hour={skipTime ? undefined : '2-digit'}
          minute={skipTime ? undefined : '2-digit'}
        />
      </>
    );
  }
  const publishedAt = new Date(announcement.published_at);
  return (
    <FormattedDate
      value={publishedAt}
      year={
        publishedAt.getFullYear() === now.getFullYear() ? undefined : 'numeric'
      }
      month='short'
      day='2-digit'
      hour={skipTime ? undefined : '2-digit'}
      minute={skipTime ? undefined : '2-digit'}
    />
  );
};
