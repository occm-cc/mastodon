import { configureStore } from '@reduxjs/toolkit';
import { fromJS } from 'immutable';
import { Provider } from 'react-redux';

import {
  changeCompose,
  COMPOSE_REPLY,
  submitCompose,
} from '@/mastodon/actions/compose';
import {
  editScheduledStatus,
  setComposeSchedule,
  setComposeToScheduledStatus,
} from '@/mastodon/actions/scheduled_statuses';
import { STORE_HYDRATE } from '@/mastodon/actions/store';
import type * as ApiModule from '@/mastodon/api';
import type { ApiScheduledStatusJSON } from '@/mastodon/api_types/scheduled_statuses';
import { reducerWithInitialState } from '@/mastodon/reducers';
import {
  closeComposer,
  initializeComposer,
  selectComposerIsChanged,
  submitComposer,
} from '@/mastodon/reducers/slices/composer';
import { defaultMiddleware } from '@/mastodon/store/store';
import {
  mediaAttachmentFactoryAPI,
  statusFactoryImmutable,
} from '@/testing/factories';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@/testing/rendering';

import ScheduleModal from './schedule_modal';
import ScheduledStatusesModal from './scheduled_statuses_modal';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/mastodon/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  default: () => ({ request: mocks.request }),
}));
vi.mock('@/mastodon/api/scheduled_statuses', () => ({
  apiGetScheduledStatuses: mocks.list,
  apiGetScheduledStatus: mocks.get,
  apiDeleteScheduledStatus: mocks.remove,
}));

const reservation = (id = '900'): ApiScheduledStatusJSON => ({
  id,
  scheduled_at: '2026-10-12T12:00:00Z',
  params: {
    text: `Scheduled ${id}`,
    language: 'fr',
    visibility: 'private',
    in_reply_to_id: null,
  },
  media_attachments: [],
});

function createStore(text = '') {
  return configureStore({
    reducer: reducerWithInitialState({
      meta: { me: '123', locale: 'ko' },
      compose: {
        text,
        language: 'en',
        default_language: 'en',
        privacy: 'public',
        default_privacy: 'public',
      },
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware(defaultMiddleware),
  });
}

describe('scheduled composition', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([reservation()]);
    mocks.get.mockResolvedValue(reservation());
    mocks.remove.mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('only treats edits to initialized mention text as draft changes', () => {
    const store = createStore('@alice ');
    store.dispatch(initializeComposer({}));
    expect(selectComposerIsChanged(store.getState())).toBe(false);
    store.dispatch(changeCompose('@alice A reply'));
    expect(selectComposerIsChanged(store.getState())).toBe(true);
    store.dispatch(changeCompose('@alice '));
    expect(selectComposerIsChanged(store.getState())).toBe(false);
  });

  it('protects a scheduled edit even when its text matches the initial text', () => {
    const store = createStore();
    store.dispatch(setComposeToScheduledStatus(reservation()));
    store.dispatch(initializeComposer({}));
    expect(selectComposerIsChanged(store.getState())).toBe(true);
    store.dispatch(closeComposer());
    expect(store.getState().modal.stack.first()?.get('modalType')).toBe(
      'COMPOSER_DRAFT_DELETE',
    );
  });

  it('uses the interface locale rather than the posting-language preference at hydration', () => {
    const store = createStore();
    store.dispatch({
      type: STORE_HYDRATE,
      state: fromJS({
        meta: { locale: 'ko' },
        compose: { default_language: 'en' },
      }),
    });
    expect(store.getState().compose.get('default_language')).toBe('ko');
    expect(store.getState().compose.get('language')).toBe('ko');
  });

  it('uses the interface language for a reply instead of inheriting the original language', () => {
    const store = createStore();
    store.dispatch({
      type: STORE_HYDRATE,
      state: fromJS({
        meta: { locale: 'ko' },
        compose: { default_language: 'en' },
      }),
    });
    store.dispatch({
      type: COMPOSE_REPLY,
      status: statusFactoryImmutable({ language: 'fr', spoiler_text: '' }),
    });
    expect(store.getState().compose.get('language')).toBe('ko');
  });

  it('keeps published edits on V1 with their existing language', async () => {
    const store = createStore('Edit published');
    store.dispatch({
      type: 'COMPOSE_SET_STATUS',
      status: statusFactoryImmutable({ id: '1234', language: 'fr' }),
      text: 'Edit published',
      spoiler_text: '',
    });
    mocks.request.mockRejectedValue(new Error('Keep draft for inspection'));
    store.dispatch(submitCompose());
    await waitFor(() => {
      expect(store.getState().compose.get('is_submitting')).toBe(false);
    });
    const sent = mocks.request.mock.calls[0]?.[0] as {
      url: string;
      data: Record<string, unknown>;
    };
    expect(sent.url).toBe('/api/v1/statuses/1234');
    expect(sent.data.language).toBe('fr');
    expect(sent.data).not.toHaveProperty('scheduled_at');
  });

  it('ignores an old account response without clearing the new account draft', async () => {
    const store = createStore('First account');
    store.dispatch(setComposeSchedule(reservation().scheduled_at));
    let finish: (value: unknown) => void = () => undefined;
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    store.dispatch(submitComposer({}));
    store.dispatch({
      type: STORE_HYDRATE,
      state: fromJS({
        meta: { me: '456', locale: 'ja' },
        compose: { text: 'Second account' },
      }),
    });
    finish({ data: reservation() });
    await Promise.resolve();
    expect(store.getState().compose.get('text')).toBe('Second account');
    expect(store.getState().compose.get('scheduled_status_id')).toBeNull();
  });

  it('applies a time without submitting or changing the draft', () => {
    const store = createStore('Keep my draft');
    const onClose = vi.fn();
    render(
      <Provider store={store}>
        <ScheduleModal onClose={onClose} />
      </Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(store.getState().compose.get('scheduled_at')).toBeTruthy();
    expect(store.getState().compose.get('text')).toBe('Keep my draft');
    expect(mocks.request).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('discards unapplied time changes when the settings are closed', () => {
    const store = createStore('Keep my draft');
    const value = '2026-10-12T12:00:00Z';
    store.dispatch(setComposeSchedule(value));
    render(
      <Provider store={store}>
        <ScheduleModal onClose={vi.fn()} />
      </Provider>,
    );
    fireEvent.change(screen.getByLabelText('Minute'), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(store.getState().compose.get('scheduled_at')).toBe(value);
  });

  it('creates through V2 and never imports the scheduled response into timelines', async () => {
    const store = createStore('Schedule me');
    store.dispatch(setComposeSchedule(reservation().scheduled_at));
    mocks.request.mockResolvedValue({ data: reservation() });
    const statuses = store.getState().statuses;
    store.dispatch(submitComposer({}));
    await waitFor(() => {
      expect(store.getState().compose.get('is_submitting')).toBe(false);
    });
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v2/scheduled_statuses',
        method: 'post',
      }),
    );
    const sent = mocks.request.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(sent.data).toMatchObject({
      status: 'Schedule me',
      language: 'ko',
      scheduled_at: reservation().scheduled_at,
    });
    expect(store.getState().statuses).toBe(statuses);
    expect(store.getState().compose.get('text')).toBe('');
    expect(store.getState().compose.get('scheduled_at')).toBeNull();
    expect(store.getState().composer.displayState).toBe('hidden');
  });

  it('updates the same V2 reservation and preserves its original language', async () => {
    const store = createStore();
    store.dispatch(setComposeToScheduledStatus(reservation()));
    mocks.request.mockResolvedValue({ data: reservation() });
    store.dispatch(submitComposer({}));
    await waitFor(() => {
      expect(store.getState().compose.get('is_submitting')).toBe(false);
    });
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v2/scheduled_statuses/900',
        method: 'put',
      }),
    );
    const sent = mocks.request.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(sent.data.language).toBe('fr');
  });

  it('keeps the draft and reservation on an API error', async () => {
    const store = createStore();
    store.dispatch(setComposeToScheduledStatus(reservation()));
    mocks.request.mockRejectedValue(new Error('Failed update'));
    store.dispatch(submitCompose());
    await waitFor(() => {
      expect(store.getState().compose.get('is_submitting')).toBe(false);
    });
    expect(store.getState().compose.get('text')).toBe('Scheduled 900');
    expect(store.getState().compose.get('scheduled_status_id')).toBe('900');
  });

  it('never submits a reservation whose time has become too soon', () => {
    const store = createStore('Keep me');
    store.dispatch(setComposeSchedule('2026-10-11T12:05:00Z'));
    store.dispatch(submitCompose());
    expect(mocks.request).not.toHaveBeenCalled();
    expect(store.getState().compose.get('text')).toBe('Keep me');
  });

  it('restores content, attachments, poll, reply and quote without using a published post ID', () => {
    const store = createStore();
    store.dispatch(submitComposer({}));
    expect(store.getState().composer.publishErrors).toEqual(['empty']);
    const item = reservation();
    item.params = {
      ...item.params,
      spoiler_text: 'Warning',
      sensitive: true,
      in_reply_to_id: '55',
      quoted_status_id: '66',
      quote_approval_policy: 'followers',
      poll: { options: ['Yes', 'No'], expires_in: 3600, multiple: true },
    };
    item.media_attachments = [
      mediaAttachmentFactoryAPI({ id: '77', description: 'Existing alt' }),
    ];
    store.dispatch(setComposeToScheduledStatus(item));
    const compose = store.getState().compose;
    expect(compose.get('id')).toBeNull();
    expect(compose.get('scheduled_status_id')).toBe('900');
    expect(compose.get('in_reply_to')).toBe('55');
    expect(compose.get('quoted_status_id')).toBe('66');
    expect(compose.get('spoiler_text')).toBe('Warning');
    expect(compose.getIn(['poll', 'options', 0])).toBe('Yes');
    expect(compose.getIn(['poll', 'options', 1])).toBe('No');
    expect(compose.getIn(['media_attachments', 0, 'unattached'])).toBe(false);
    expect(store.getState().composer.displayState).toBe('showing');
    expect(store.getState().composer.publishErrors).toEqual([]);
  });

  it('protects an existing draft when selecting another reservation', async () => {
    const store = createStore('Do not replace');
    await store.dispatch(editScheduledStatus({ id: '900' }));
    expect(mocks.get).not.toHaveBeenCalled();
    expect(store.getState().compose.get('text')).toBe('Do not replace');
    expect(store.getState().modal.stack.first()?.get('modalType')).toBe(
      'CONFIRM_EDIT_SCHEDULED_STATUS',
    );
  });

  it('loads a selected reservation into the shared composer', async () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <ScheduledStatusesModal onClose={vi.fn()} />
      </Provider>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Scheduled 900/ }),
    );
    await waitFor(() => {
      expect(store.getState().compose.get('scheduled_status_id')).toBe('900');
    });
    expect(store.getState().compose.get('text')).toBe('Scheduled 900');
  });

  it('confirms cancellation and retains any reservations that failed to cancel', async () => {
    const store = createStore('Untouched');
    mocks.list.mockResolvedValue([reservation('900'), reservation('901')]);
    mocks.remove.mockImplementation((id: string) =>
      id === '900' ? Promise.resolve({}) : Promise.reject(new Error('Failed')),
    );
    render(
      <Provider store={store}>
        <ScheduledStatusesModal onClose={vi.fn()} />
      </Provider>,
    );
    await screen.findByText('Scheduled 900');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(
      screen.getByLabelText('Select scheduled post: Scheduled 900'),
    );
    fireEvent.click(
      screen.getByLabelText('Select scheduled post: Scheduled 901'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel schedule' }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel schedule' }));
    await waitFor(() => {
      expect(screen.queryByText('Scheduled 900')).toBeNull();
    });
    expect(screen.getByText('Scheduled 901')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(store.getState().compose.get('text')).toBe('Untouched');
  });
});
