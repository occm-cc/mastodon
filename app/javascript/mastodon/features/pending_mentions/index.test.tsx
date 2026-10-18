import { openNavigation } from '@/mastodon/actions/navigation';
import type * as StoreModule from '@/mastodon/store';
import { cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { PendingMentions } from '.';

import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ isMobile: false, dispatch: vi.fn() }));

vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => mocks.isMobile,
}));
vi.mock('@/mastodon/store', async (importOriginal) => {
  const actual = await importOriginal<typeof StoreModule>();
  return {
    ...actual,
    useAppDispatch: () => mocks.dispatch,
    useAppSelector: (selector: (state: StoreModule.RootState) => unknown) =>
      selector(actual.store.getState()),
  };
});
vi.mock('@/mastodon/hooks/useObserver', () => ({
  useResizeObserver: () => ({ observe: vi.fn(), unobserve: vi.fn() }),
}));
vi.mock('@/mastodon/hooks/useScrollSensor', () => ({
  useScrollSensor: () => ({ sensor: null, isInViewport: true }),
}));
vi.mock('@/mastodon/components/scrollable_list', () => ({
  default: () => null,
}));

describe('Pending mentions shared page header', () => {
  beforeEach(() => {
    mocks.isMobile = false;
    mocks.dispatch.mockClear();
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('--column-header-height');
  });

  it('renders the common page heading on desktop', () => {
    const { container } = render(<PendingMentions />);
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Awaiting reply' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Menu' }),
    ).not.toBeInTheDocument();
  });

  it('opens the left navigation from the mobile page', () => {
    mocks.isMobile = true;
    render(<PendingMentions />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(openNavigation());
  });
});
