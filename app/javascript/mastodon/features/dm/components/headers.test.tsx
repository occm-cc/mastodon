import { openNavigation } from '@/mastodon/actions/navigation';
import type * as InitialStateModule from '@/mastodon/initial_state';
import type { DmChatRoom } from '@/mastodon/reducers/dm';
import type * as StoreModule from '@/mastodon/store';
import { cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { ChatRoomHeader } from './chat_room_header';
import { ChatRoomListHeader } from './chat_room_list_header';

import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ isMobile: false, dispatch: vi.fn() }));

vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => mocks.isMobile,
}));
vi.mock('@/mastodon/store', async (importOriginal) => ({
  ...(await importOriginal<typeof StoreModule>()),
  useAppDispatch: () => mocks.dispatch,
}));
vi.mock('@/mastodon/initial_state', async (importOriginal) => ({
  ...(await importOriginal<typeof InitialStateModule>()),
  me: '123',
}));
vi.mock('@/mastodon/hooks/useObserver', () => ({
  useResizeObserver: () => ({ observe: vi.fn(), unobserve: vi.fn() }),
}));
vi.mock('./new_chat_room_modal', () => ({
  NewChatRoomModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role='dialog' aria-label='New message' /> : null,
}));
vi.mock('./room_settings_modal', () => ({
  RoomSettingsModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role='dialog' aria-label='Room settings' /> : null,
}));

const room: DmChatRoom = {
  id: '1',
  uuid: 'room-uuid',
  room_type: 'direct',
  title: '',
  owner_id: '123',
  participant_ids: ['123', '456'],
  participants: [
    {
      id: '123',
      acct: 'self',
      username: 'self',
      display_name: 'My account',
      avatar: '',
      avatar_static: '',
    },
    {
      id: '456',
      acct: 'friend',
      username: 'friend',
      display_name: 'Example friend',
      avatar: '',
      avatar_static: '',
    },
  ],
  last_message: null,
  unread: false,
  accepted: true,
  last_message_at: '2026-10-11T00:00:00Z',
  created_at: '2026-10-11T00:00:00Z',
  readReceipts: {},
};

describe('DM shared page headers', () => {
  beforeEach(() => {
    mocks.isMobile = false;
    mocks.dispatch.mockClear();
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('--column-header-height');
  });

  it('uses the common heading and preserves the new-message action on desktop', () => {
    const { container } = render(<ChatRoomListHeader />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Messages' }),
    ).toBeInTheDocument();
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Menu' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New message' }));
    expect(
      screen.getByRole('dialog', { name: 'New message' }),
    ).toBeInTheDocument();
  });

  it('opens the mobile navigation from the message list', () => {
    mocks.isMobile = true;
    render(<ChatRoomListHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(openNavigation());
  });

  it('preserves the conversation name, member count, back action, and settings', () => {
    const onBack = vi.fn();
    render(<ChatRoomHeader room={room} onBack={onBack} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Example friend',
    );
    expect(screen.getByText('2 members')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Room settings' }));
    expect(
      screen.getByRole('dialog', { name: 'Room settings' }),
    ).toBeInTheDocument();
  });

  it('keeps both back and navigation controls available in a mobile conversation', () => {
    mocks.isMobile = true;
    render(<ChatRoomHeader room={room} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(openNavigation());
  });

  it('keeps navigation and back available while the conversation is loading', () => {
    mocks.isMobile = true;
    render(<ChatRoomHeader onBack={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Messages' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Room settings' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(openNavigation());
  });
});
