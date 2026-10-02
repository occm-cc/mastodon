import { renderHook, waitFor } from '@testing-library/react';

import { directCompose } from '@/mastodon/actions/compose';
import type { AppDispatch } from '@/mastodon/store';
import { accountFactoryImmutable } from '@/testing/factories';

import { useDirectMessage } from './useDirectMessage';

const { createRoom, dispatch, push } = vi.hoisted(() => ({
  createRoom: vi.fn(),
  dispatch: vi.fn(),
  push: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
}));
vi.mock('@/mastodon/store', () => ({
  useAppDispatch: () => dispatch,
}));
vi.mock('@/mastodon/actions/compose', () => ({
  directCompose: vi.fn(() => ({ type: 'DIRECT_COMPOSE' })),
}));
vi.mock('mastodon/api/dm', () => ({
  apiCreateDmChatRoom: createRoom,
}));

describe('useDirectMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatch.mockImplementation((action: unknown): unknown =>
      typeof action === 'function'
        ? (action as (dispatch: AppDispatch) => unknown)(
            dispatch as AppDispatch,
          )
        : action,
    );
  });

  it('opens the OCCM chat room by UUID for a local account', async () => {
    const account = accountFactoryImmutable({
      id: '2',
      acct: 'alice',
      username: 'alice',
    });
    createRoom.mockResolvedValue({ id: '3', uuid: 'room-uuid' });
    const { result } = renderHook(() => useDirectMessage(account));

    result.current();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/direct_message/room-uuid');
    });
    expect(createRoom).toHaveBeenCalledWith({ account_ids: ['2'] });
    expect(directCompose).not.toHaveBeenCalled();
  });

  it('uses a private mention for a remote account', () => {
    const account = accountFactoryImmutable({
      acct: 'alice@example.org',
      username: 'alice',
    });
    const { result } = renderHook(() => useDirectMessage(account));

    result.current();

    expect(directCompose).toHaveBeenCalledWith(account);
    expect(createRoom).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to a private mention when chat room creation fails', async () => {
    const account = accountFactoryImmutable();
    createRoom.mockRejectedValue(new Error('Room unavailable'));
    const { result } = renderHook(() => useDirectMessage(account));

    result.current();

    await waitFor(() => {
      expect(directCompose).toHaveBeenCalledWith(account);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('waits for the account to load before sending a message', () => {
    const { result } = renderHook(() => useDirectMessage());

    result.current();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
