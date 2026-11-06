import { configureStore } from '@reduxjs/toolkit';
import type { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { Provider } from 'react-redux';

import { unfollowAccountSuccess } from '@/mastodon/actions/accounts_typed';
import type * as AnnouncementActions from '@/mastodon/actions/announcements';
import {
  fetchAnnouncementsSuccess,
  hideAnnouncements,
  showAnnouncements,
  toggleShowAnnouncements,
} from '@/mastodon/actions/announcements';
import { reducerWithInitialState } from '@/mastodon/reducers';
import announcementsReducer from '@/mastodon/reducers/announcements';
import { defaultMiddleware } from '@/mastodon/store/store';
import {
  accountFactoryImmutable,
  relationshipsFactoryAPI,
} from '@/testing/factories';
import { fireEvent, render, screen } from '@/testing/rendering';

import { HomeAnnouncementButtons, HomeAnnouncements } from './announcements';

import '@testing-library/jest-dom';

vi.mock('@/mastodon/actions/announcements', async (importOriginal) => ({
  ...(await importOriginal<typeof AnnouncementActions>()),
  fetchAnnouncements: () => ({ type: 'TEST_FETCH_ANNOUNCEMENTS' }),
  dismissAnnouncement: () => ({ type: 'TEST_DISMISS_ANNOUNCEMENT' }),
}));

const announcement = (id: string, accountId: string | null, read: boolean) => ({
  id,
  account_id: accountId,
  content: `<p>Announcement ${id}</p>`,
  contentHtml: `<p>Announcement ${id}</p>`,
  starts_at: null,
  ends_at: null,
  all_day: false,
  published_at: '2026-11-06T00:00:00.000Z',
  updated_at: null,
  read,
  mentions: [],
  statuses: [],
  tags: [],
  emojis: [],
  reactions: [],
  reactions_allowed: false,
});

function renderHome(items: ReturnType<typeof announcement>[]) {
  const store = configureStore({
    reducer: reducerWithInitialState({
      meta: { me: '123', locale: 'en' },
      accounts: {
        '123': accountFactoryImmutable({ id: '123' }),
        '456': accountFactoryImmutable({
          id: '456',
          acct: 'leader',
          display_name: 'Community Leader',
        }),
      },
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware(defaultMiddleware),
  });

  store.dispatch(fetchAnnouncementsSuccess(items));

  render(
    <Provider store={store}>
      <HomeAnnouncementButtons />
      <HomeAnnouncements />
    </Provider>,
  );

  return store;
}

type Store = ReturnType<typeof renderHome>;

const showState = (store: Store) => {
  const state = store.getState().announcements as ImmutableMap<string, unknown>;
  return {
    all: state.get('show'),
    server: state.get('showServer'),
    account: state.get('showAccount'),
  };
};

const serverButtonName = /server announcements/i;
const accountButtonName = /announcements from people you follow/i;

describe('Home announcements', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders no buttons without announcements', () => {
    renderHome([]);

    expect(
      screen.queryByRole('button', { name: serverButtonName }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: accountButtonName }),
    ).not.toBeInTheDocument();
  });

  it('shows separate buttons with their own unread counts', () => {
    renderHome([
      announcement('1', null, false),
      announcement('2', null, false),
      announcement('3', '456', false),
    ]);

    const serverButton = screen.getByRole('button', { name: serverButtonName });
    const accountButton = screen.getByRole('button', {
      name: accountButtonName,
    });

    expect(serverButton.parentElement).toHaveTextContent('2');
    expect(accountButton.parentElement).toHaveTextContent('1');
  });

  it('only shows the server button when there are no account announcements', () => {
    renderHome([announcement('1', null, true)]);

    expect(
      screen.getByRole('button', { name: serverButtonName }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: accountButtonName }),
    ).not.toBeInTheDocument();
  });

  it('toggles each kind of announcement independently', () => {
    const store = renderHome([
      announcement('1', null, true),
      announcement('2', '456', true),
    ]);

    expect(screen.queryByText('Announcement 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Announcement 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: accountButtonName }));

    expect(screen.getByText('Announcement 2')).toBeInTheDocument();
    expect(screen.queryByText('Announcement 1')).not.toBeInTheDocument();
    expect(screen.getByText('Community Leader')).toBeInTheDocument();
    expect(showState(store).server).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: serverButtonName }));

    expect(screen.getByText('Announcement 1')).toBeInTheDocument();
  });

  it('automatically opens the kind that has unread announcements', () => {
    renderHome([
      announcement('1', null, true),
      announcement('2', '456', false),
    ]);

    expect(screen.getByText('Announcement 2')).toBeInTheDocument();
    expect(screen.queryByText('Announcement 1')).not.toBeInTheDocument();
  });

  it('keeps the combined and split visibility flags independent', () => {
    const store = renderHome([]);

    store.dispatch(toggleShowAnnouncements());
    expect(showState(store)).toEqual({
      all: true,
      server: false,
      account: false,
    });

    store.dispatch(showAnnouncements('account'));
    store.dispatch(toggleShowAnnouncements('server'));
    store.dispatch(hideAnnouncements('account'));
    expect(showState(store)).toEqual({
      all: true,
      server: true,
      account: false,
    });
  });

  it('shows every followed publisher and drops one after unfollowing', () => {
    const store = renderHome([
      announcement('1', '456', false),
      announcement('2', '789', false),
    ]);

    // Both publishers' announcements show in the account carousel
    expect(screen.getAllByText(/Announcement [12]/)).toHaveLength(2);

    const state = announcementsReducer(
      store.getState().announcements as Parameters<
        typeof announcementsReducer
      >[0],
      unfollowAccountSuccess({
        relationship: relationshipsFactoryAPI({ id: '456' }),
        statuses: null,
      }),
    ) as ImmutableMap<string, ImmutableList<ImmutableMap<string, unknown>>>;

    expect(
      state
        .get('items')
        ?.map((item) => item.get('id'))
        .toArray(),
    ).toEqual(['2']);
  });
});
