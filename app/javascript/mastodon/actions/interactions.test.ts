import { configureStore } from '@reduxjs/toolkit';

import type * as ApiModule from '@/mastodon/api';
import type { ApiNotificationJSON } from '@/mastodon/api_types/notifications';
import { rootReducer } from '@/mastodon/reducers';
import { defaultMiddleware } from '@/mastodon/store/store';
import { statusFactoryAPI, statusFactoryImmutable } from '@/testing/factories';
import { waitFor } from '@/testing/rendering';

import { favourite, unfavourite } from './interactions';
import { fetchPendingMentions } from './pending_mentions';

const mocks = vi.hoisted(() => ({ post: vi.fn(), request: vi.fn() }));

vi.mock('@/mastodon/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  default: () => mocks,
}));

describe('Favourite changes in pending mentions', () => {
  const status = statusFactoryAPI();
  const notification: ApiNotificationJSON = {
    id: '123',
    type: 'mention',
    created_at: status.created_at,
    group_key: 'mention:123',
    account: status.account,
    status,
  };
  const makeStore = () =>
    configureStore({
      reducer: rootReducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware(defaultMiddleware),
    });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.post.mockResolvedValue({ data: status });
  });

  it('removes favourited mentions and restores them after unfavouriting, including an empty list', async () => {
    const store = makeStore();
    mocks.request
      .mockResolvedValueOnce({ data: [notification], headers: {} })
      .mockResolvedValueOnce({ data: [], headers: {} })
      .mockResolvedValueOnce({ data: [notification], headers: {} });

    await store.dispatch(fetchPendingMentions());
    expect(store.getState().pendingMentions.items).toEqual([notification]);

    store.dispatch(favourite(statusFactoryImmutable()));
    await waitFor(() => {
      expect(store.getState().pendingMentions.items).toEqual([]);
    });

    store.dispatch(unfavourite(statusFactoryImmutable({ favourited: true })));
    await waitFor(() => {
      expect(store.getState().pendingMentions.items).toEqual([notification]);
    });
    expect(mocks.request).toHaveBeenCalledTimes(3);
  });

  it('does not load pending mentions before the page has been visited', async () => {
    const store = makeStore();
    store.dispatch(unfavourite(statusFactoryImmutable({ favourited: true })));
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledOnce();
    });
    await Promise.resolve();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
