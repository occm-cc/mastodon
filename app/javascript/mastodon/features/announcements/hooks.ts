import { useEffect } from 'react';

import type {
  List as ImmutableList,
  Record as ImmutableRecord,
} from 'immutable';

import {
  fetchAnnouncements,
  showAnnouncements,
} from '@/mastodon/actions/announcements';
import type {
  AnnouncementScope,
  ApiAnnouncementJSON,
} from '@/mastodon/api_types/announcements';
import type { RootState } from '@/mastodon/store';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';
import { isRedesignEnabled } from '@/mastodon/utils/environment';

type AnnouncementItem = ImmutableRecord<
  Omit<ApiAnnouncementJSON, 'account'> & { account_id: string | null }
>;

type AnnouncementsState = ImmutableRecord<{
  items: ImmutableList<AnnouncementItem>;
  isLoading: boolean;
  show: boolean;
  showServer: boolean;
  showAccount: boolean;
}>;

const SHOW_KEYS = {
  all: 'show',
  server: 'showServer',
  account: 'showAccount',
} as const;

export function isInAnnouncementScope(
  accountId: string | null | undefined,
  scope: AnnouncementScope,
) {
  if (scope === 'server') {
    return !accountId;
  } else if (scope === 'account') {
    return !!accountId;
  }

  return true;
}

const selectItems = (state: RootState) =>
  (state.announcements as AnnouncementsState).get('items');

function useScopedAnnouncementCounts(scope: AnnouncementScope) {
  const count = useAppSelector((state) =>
    selectItems(state).count((item) =>
      isInAnnouncementScope(item.get('account_id'), scope),
    ),
  );
  const unreadCount = useAppSelector((state) =>
    selectItems(state).count(
      (item) =>
        !item.get('read') &&
        isInAnnouncementScope(item.get('account_id'), scope),
    ),
  );
  const shouldShow = useAppSelector((state) =>
    (state.announcements as AnnouncementsState).get(SHOW_KEYS[scope]),
  );

  return { count, unreadCount, shouldShow };
}

/**
 * Announcement counts for one scope. `all` combines server-wide announcements
 * with those of followed accounts, as shown on the notifications page.
 */
export function useHasAnnouncements({
  fetch = true,
  scope = 'all',
}: { fetch?: boolean; scope?: AnnouncementScope } = {}) {
  const dispatch = useAppDispatch();
  const { count, unreadCount, shouldShow } = useScopedAnnouncementCounts(scope);
  const hasUnreadAnnouncements = !!unreadCount;

  useEffect(() => {
    if (hasUnreadAnnouncements && isRedesignEnabled()) {
      dispatch(showAnnouncements(scope));
    }
  }, [hasUnreadAnnouncements, scope, dispatch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (fetch) {
        dispatch(fetchAnnouncements());
      }
    }, 700);

    return () => {
      clearTimeout(timeout);
    };
  }, [fetch, dispatch]);

  return {
    hasAnnouncements: count > 0,
    hasUnreadAnnouncements,
    shouldShowAnnouncements: shouldShow,
    unreadAnnouncementCount: unreadCount,
  };
}
