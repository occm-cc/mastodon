import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { MegaphoneIcon, UserSoundIcon } from '@phosphor-icons/react';

import { toggleShowAnnouncements } from '@/mastodon/actions/announcements';
import type { AnnouncementScope } from '@/mastodon/api_types/announcements';
import { ToggleIconButton } from '@/mastodon/components/button/redesign';
import { Announcements } from '@/mastodon/features/announcements';
import { useHasAnnouncements } from '@/mastodon/features/announcements/hooks';
import { useAppDispatch } from '@/mastodon/store';

import classes from './announcements.module.scss';

const messages = defineMessages({
  showServer: {
    id: 'home.show_server_announcements',
    defaultMessage: 'Show server announcements',
  },
  hideServer: {
    id: 'home.hide_server_announcements',
    defaultMessage: 'Hide server announcements',
  },
  showAccount: {
    id: 'home.show_account_announcements',
    defaultMessage: 'Show announcements from people you follow',
  },
  hideAccount: {
    id: 'home.hide_account_announcements',
    defaultMessage: 'Hide announcements from people you follow',
  },
});

type SplitScope = Exclude<AnnouncementScope, 'all'>;

const SCOPE_CONFIG = {
  server: {
    icon: MegaphoneIcon,
    show: messages.showServer,
    hide: messages.hideServer,
  },
  account: {
    icon: UserSoundIcon,
    show: messages.showAccount,
    hide: messages.hideAccount,
  },
} as const;

const AnnouncementToggleButton: React.FC<{
  scope: SplitScope;
  fetch?: boolean;
}> = ({ scope, fetch = false }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { hasAnnouncements, shouldShowAnnouncements, unreadAnnouncementCount } =
    useHasAnnouncements({ fetch, scope });

  const handleClick = useCallback(() => {
    dispatch(toggleShowAnnouncements(scope));
  }, [dispatch, scope]);

  if (!hasAnnouncements) {
    return null;
  }

  const config = SCOPE_CONFIG[scope];

  return (
    <span className={classes.buttonWrapper}>
      <ToggleIconButton
        icon={config.icon}
        active={shouldShowAnnouncements}
        onClick={handleClick}
        size='sm'
        variant='ghost'
      >
        {intl.formatMessage(
          shouldShowAnnouncements ? config.hide : config.show,
        )}
      </ToggleIconButton>

      {unreadAnnouncementCount > 0 && (
        <span className={classes.badge} aria-hidden='true'>
          {unreadAnnouncementCount}
        </span>
      )}
    </span>
  );
};

/**
 * Header buttons that toggle server-wide announcements and announcements
 * of followed accounts separately, each with its own unread badge.
 */
export const HomeAnnouncementButtons: React.FC = () => (
  <>
    <AnnouncementToggleButton scope='server' fetch />
    <AnnouncementToggleButton scope='account' />
  </>
);

const ScopedAnnouncements: React.FC<{ scope: SplitScope }> = ({ scope }) => {
  const { hasAnnouncements, shouldShowAnnouncements } = useHasAnnouncements({
    fetch: false,
    scope,
  });

  if (!hasAnnouncements || !shouldShowAnnouncements) {
    return null;
  }

  return <Announcements scope={scope} />;
};

export const HomeAnnouncements: React.FC = () => (
  <>
    <ScopedAnnouncements scope='server' />
    <ScopedAnnouncements scope='account' />
  </>
);
