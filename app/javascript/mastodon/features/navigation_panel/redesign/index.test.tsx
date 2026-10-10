import type { RecordOf } from 'immutable';

import type * as DmActions from '@/mastodon/actions/dm';
import type * as PermissionsModule from '@/mastodon/permissions';
import type * as StoreModule from '@/mastodon/store';
import { accountFactoryImmutable } from '@/testing/factories';
import { act, fireEvent, render, screen, within } from '@/testing/rendering';

import { RedesignNavigationPanel } from '.';
import { RedesignMobileNavigation } from './mobile_nav';

import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  unreadCount: 3,
  fetchUnreadCount: vi.fn(() => ({ type: 'FETCH_DM_UNREAD' })),
}));

vi.mock('@/mastodon/store', async (importOriginal) => {
  const actual = await importOriginal<typeof StoreModule>();
  return {
    ...actual,
    useAppDispatch: () => mocks.dispatch,
    useAppSelector: (
      selector: (state: ReturnType<typeof actual.store.getState>) => unknown,
    ) => {
      const state = actual.store.getState() as RecordOf<StoreModule.RootState>;
      return selector(
        state
          .set('dm', { ...state.dm, unreadCount: mocks.unreadCount })
          .set('meta', state.meta.set('me', '123'))
          .set(
            'accounts',
            state.accounts.set(
              '123',
              accountFactoryImmutable({ id: '123', acct: 'alice' }),
            ),
          ),
      );
    },
  };
});

vi.mock('@/mastodon/actions/dm', async (importOriginal) => ({
  ...(await importOriginal<typeof DmActions>()),
  fetchUnreadCount: mocks.fetchUnreadCount,
}));

vi.mock('@/mastodon/hooks/useAccount', () => ({
  useAccount: () => accountFactoryImmutable({ id: '123', acct: 'alice' }),
}));

vi.mock('@/mastodon/hooks/useScrollSensor', () => ({
  useScrollSensor: () => ({ sensor: null, isInViewport: true }),
}));

vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => false,
}));

vi.mock('../../announcements/hooks', () => ({
  useHasAnnouncements: () => ({ unreadAnnouncementCount: 0 }),
}));

vi.mock('@/mastodon/features/compose/redesign/trigger', () => ({
  ComposeRedesignButton: () => null,
}));

vi.mock('@/mastodon/utils/multi_account_db', () => ({
  loadAllEntries: () => Promise.resolve({}),
  loadEncryptedToken: () => Promise.resolve(null),
}));

vi.mock('@/mastodon/features/multi_account/callback_handler', () => ({
  initializeCallbackHandler: vi.fn(),
  cleanupCallbackHandler: vi.fn(),
}));

vi.mock('@/mastodon/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof PermissionsModule>()),
  canViewFeed: () => true,
}));

vi.mock('@/mastodon/components/menu/card', () => ({
  PopoverMenuCard: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => <div hidden={!isOpen}>{children}</div>,
}));

describe('Redesign navigation custom features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.unreadCount = 3;
    document.documentElement.style.removeProperty('--bird-ui-redesign');
  });

  afterEach(async () => {
    document.documentElement.style.removeProperty('--bird-ui-redesign');
    await act(async () => {
      await Promise.resolve();
    });
  });

  it.each(['static', 'slide-out'] as const)(
    'uses the Twitter menu order for Bird UI in %s mode',
    (mode) => {
      document.documentElement.style.setProperty('--bird-ui-redesign', '1');
      const { container } = render(<RedesignNavigationPanel mode={mode} />);
      const links = container.querySelectorAll('nav > ul > li > a');
      expect(
        Array.from(links)
          .slice(0, 5)
          .map((link) => link.getAttribute('href')),
      ).toEqual([
        '/home',
        '/search',
        '/notifications',
        '/direct_message',
        '/bookmarks',
      ]);
      expect(screen.getByRole('link', { name: 'Chat 3' })).toHaveAttribute(
        'href',
        '/direct_message',
      );
      expect(screen.getByRole('link', { name: 'Bookmarks' })).toHaveAttribute(
        'href',
        '/bookmarks',
      );
      expect(container.querySelector('a[href^="/public"]')).toBeNull();
    },
  );

  it('also removes Public Feeds from signed-out Bird UI navigation', () => {
    document.documentElement.style.setProperty('--bird-ui-redesign', '1');
    const { container } = render(<RedesignNavigationPanel />, {
      signedIn: false,
    });
    expect(container.querySelector('a[href^="/public"]')).toBeNull();
  });

  it('links the desktop DM button to chat rooms and shows the unread count', () => {
    render(<RedesignNavigationPanel />);

    const dmLink = screen.getByRole('link', { name: 'DM 3' });
    expect(dmLink).toHaveAttribute('href', '/direct_message');
    expect(within(dmLink).getByText('3')).toBeInTheDocument();
    expect(mocks.fetchUnreadCount).toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: 'Awaiting reply' }),
    ).toHaveAttribute('href', '/pending-mentions');
  });

  it('opens account management from the desktop navigation', async () => {
    const { container } = render(<RedesignNavigationPanel />);
    const switchButton = screen.getByRole('button', {
      name: 'Switch accounts',
    });
    expect(switchButton.closest('li')?.parentElement?.tagName).toBe('UL');
    expect(container.querySelector('ul > div.account-switcher')).toBeNull();

    fireEvent.click(switchButton);
    expect(
      await screen.findByRole('dialog', { name: 'Account management' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps private mentions in the desktop account menu', () => {
    render(<RedesignNavigationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }));

    expect(
      screen.getByRole('link', { name: 'Private mentions' }),
    ).toHaveAttribute('href', '/conversations');
  });

  it('restores DM, private mentions, pending mentions, and switching on mobile', async () => {
    render(<RedesignMobileNavigation />);
    expect(screen.getByRole('link', { name: 'DM' })).toHaveAttribute(
      'href',
      '/direct_message',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }));

    expect(
      screen.getByRole('menuitem', { name: 'Private mentions' }),
    ).toHaveAttribute('href', '/conversations');
    expect(
      screen.getByRole('menuitem', { name: 'Awaiting reply' }),
    ).toHaveAttribute('href', '/pending-mentions');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch accounts' }));
    expect(
      await screen.findByRole('dialog', { name: 'Account management' }),
    ).toBeInTheDocument();
  });

  it('keeps account switching and pending mentions accessible in the slide-out menu', () => {
    render(<RedesignNavigationPanel mode='slide-out' />);
    expect(
      screen.getByRole('link', { name: 'Awaiting reply' }),
    ).toHaveAttribute('href', '/pending-mentions');
    expect(
      screen.getByRole('button', { name: 'Switch accounts' }),
    ).toBeInTheDocument();
  });

  it('does not fetch DM counts or expose account actions when signed out', () => {
    render(<RedesignNavigationPanel />, { signedIn: false });
    expect(mocks.fetchUnreadCount).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /^DM/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch accounts' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Awaiting reply' }),
    ).not.toBeInTheDocument();
  });
});
