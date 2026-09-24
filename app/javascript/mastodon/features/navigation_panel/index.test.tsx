// Task 10.5: Logo link-target test
// Validates: Requirements 4.4

import { render, screen } from '@testing-library/react';

// Now import the component
import { NavigationPanel } from './index';

import '@testing-library/jest-dom';

// Mock react-router-dom: Link renders an <a> with href from `to` prop
vi.mock('react-router-dom', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/' }),
}));

// Mock react-intl
vi.mock('react-intl', () => ({
  defineMessages: (msgs: Record<string, unknown>) => msgs,
  useIntl: () => ({
    formatMessage: (msg: { defaultMessage?: string; id?: string }) =>
      msg.defaultMessage ?? msg.id ?? '',
  }),
}));

// Mock initial_state
vi.mock('mastodon/initial_state', () => ({
  initialState: { features: [] },
  me: 'user-1',
  autoPlayGif: false,
  localLiveFeedAccess: 0,
  remoteLiveFeedAccess: 0,
  trendsEnabled: false,
  transientSingleColumn: false,
}));

vi.mock('mastodon/is_mobile', () => ({
  transientSingleColumn: false,
}));

// Mock identity_context
vi.mock('mastodon/identity_context', () => ({
  useIdentity: () => ({
    signedIn: true,
    permissions: 0,
    disabledAccountId: null,
  }),
}));

// Mock the hooks/useAccount
const { mockUseAccount } = vi.hoisted(() => ({ mockUseAccount: vi.fn() }));
vi.mock('@/mastodon/hooks/useAccount', () => ({
  useAccount: mockUseAccount,
}));

// Mock useBreakpoint
vi.mock('mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => false,
}));

// Mock useAppSelector and useAppDispatch
vi.mock('mastodon/store', () => ({
  useAppSelector: () => 0,
  useAppDispatch: () => () => undefined,
}));

// Mock permissions
vi.mock('mastodon/permissions', () => ({
  canViewFeed: () => false,
}));

// Mock selectors
vi.mock('mastodon/selectors/notifications', () => ({
  selectUnreadNotificationGroupsCount: () => 0,
}));

// Mock actions
vi.mock('mastodon/actions/accounts', () => ({
  fetchFollowRequests: () => ({ type: 'NOOP' }),
}));

vi.mock('mastodon/actions/navigation', () => ({
  openNavigation: () => ({ type: 'NOOP' }),
  closeNavigation: () => ({ type: 'NOOP' }),
}));

// Mock the NavigationLogo component with two modes
let navigationLogoMode: 'custom' | 'default' = 'default';
vi.mock('./components/navigation_logo', () => ({
  NavigationLogo: () => {
    if (navigationLogoMode === 'custom') {
      return (
        <img
          src='https://example.com/logo.png'
          alt='Custom Logo'
          className='logo logo--custom'
        />
      );
    }
    return <div data-testid='wordmark-logo'>WordmarkLogo</div>;
  },
}));

// Mock other child components to avoid import errors
vi.mock('mastodon/features/compose/components/search', () => ({
  Search: () => null,
}));

vi.mock('mastodon/features/ui/components/account_switcher', () => ({
  AccountSwitcher: () => null,
}));

vi.mock('mastodon/features/ui/components/column_link', () => ({
  ColumnLink: () => null,
}));

vi.mock('mastodon/features/ui/components/skip_links', () => ({
  getNavigationSkipLinkId: () => 'skip-link-target-nav',
}));

vi.mock('mastodon/components/account', () => ({
  Account: () => null,
}));

vi.mock('mastodon/components/icon', () => ({
  Icon: () => null,
}));

vi.mock('mastodon/components/icon_with_badge', () => ({
  IconWithBadge: () => null,
}));

vi.mock('../annual_report/nav_item', () => ({
  AnnualReportNavItem: () => null,
}));

vi.mock('./components/disabled_account_banner', () => ({
  DisabledAccountBanner: () => null,
}));

vi.mock('./components/followed_tags_panel', () => ({
  FollowedTagsPanel: () => null,
}));

vi.mock('./components/list_panel', () => ({
  ListPanel: () => null,
}));

vi.mock('./components/more_link', () => ({
  MoreLink: () => null,
}));

vi.mock('./components/sign_in_banner', () => ({
  SignInBanner: () => null,
}));

vi.mock('./components/trends', () => ({
  Trends: () => null,
}));

// Mock SVG imports
vi.mock('@/material-icons/400-24px/add.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/alternate_email.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/bookmarks-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/bookmarks.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/category-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/category.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/chat_bubble-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/chat_bubble.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/home-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/home.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/info.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/notifications-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/notifications.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/person_add-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/person_add.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/public.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/settings.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/star-fill.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/star.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/swap_horiz.svg?react', () => ({
  default: () => null,
}));
vi.mock('@/material-icons/400-24px/trending_up.svg?react', () => ({
  default: () => null,
}));

// Mock classnames and spring/gesture libs
vi.mock('classnames', () => ({
  default: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));
vi.mock('@react-spring/web', () => ({
  animated: { div: 'div' },
  useSpring: () => [{ x: 0 }, { start: vi.fn() }],
}));
vi.mock('@use-gesture/react', () => ({
  useDrag: () => () => ({}),
}));

describe('Task 10.5: Logo link targets "/" in both custom and default logo modes', () => {
  beforeEach(() => {
    mockUseAccount.mockReturnValue({
      acct: 'testuser',
      custom_logo_enabled: false,
      custom_logo: '',
      custom_logo_static: '',
      custom_logo_description: '',
    });
  });

  it('renders logo link with href="/" when custom logo is disabled (default WordmarkLogo)', () => {
    navigationLogoMode = 'default';

    render(<NavigationPanel />);

    const logoLink = screen.getByTestId('wordmark-logo').closest('a');
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders logo link with href="/" when custom logo is enabled', () => {
    navigationLogoMode = 'custom';

    render(<NavigationPanel />);

    const logoImg = screen.getByRole('img', { name: 'Custom Logo' });
    const logoLink = logoImg.closest('a');
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('logo link has the correct CSS class and skip-link id', () => {
    navigationLogoMode = 'default';

    render(<NavigationPanel />);

    const logoLink = screen.getByTestId('wordmark-logo').closest('a');
    expect(logoLink).toHaveClass('column-link');
    expect(logoLink).toHaveClass('column-link--logo');
    expect(logoLink).toHaveAttribute('id', 'skip-link-target-nav');
  });
});
