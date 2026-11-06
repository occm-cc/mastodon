import { useLocation } from 'react-router';

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { reducerWithInitialState } from '@/mastodon/reducers';
import { defaultMiddleware } from '@/mastodon/store/store';
import { accountFactoryImmutable } from '@/testing/factories';
import { cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { BirdUiSidebar } from '../../ui/components/columns_area/bird_ui_sidebar';
import type * as BreakpointModule from '../../ui/hooks/useBreakpoint';
import { ComposeButton } from '../trigger';

import { BirdUiComposer } from './bird_ui_composer';

const mocks = vi.hoisted(() => ({ isMobile: false, isNarrow: false }));
vi.mock('@/mastodon/components/search', () => ({
  Search: () => <div data-testid='sidebar-search' />,
}));
vi.mock('@/mastodon/features/navigation_panel/components/trends', () => ({
  Trends: () => null,
}));
vi.mock('@/mastodon/features/navigation_panel/redesign/footer_links', () => ({
  NavigationFooterLinks: () => null,
}));
vi.mock('@/mastodon/features/discovery_panel/footer_links', () => ({
  FooterLinks: () => null,
}));
vi.mock('@/mastodon/components/avatar', () => ({ Avatar: () => null }));
vi.mock(
  '@/mastodon/features/ui/hooks/useBreakpoint',
  async (importOriginal) => ({
    ...(await importOriginal<typeof BreakpointModule>()),
    useBreakpoint: (breakpoint: string) =>
      breakpoint === 'sidebar' ? mocks.isNarrow : mocks.isMobile,
  }),
);
vi.mock('@/mastodon/hooks/useScrollSensor', () => ({
  useScrollSensor: () => ({ sensor: null, isInViewport: true }),
}));
vi.mock('@/mastodon/components/emoji/picker', () => ({
  EmojiPickerButton: () => null,
}));

const RouteLocation = () => {
  const { pathname } = useLocation();
  return <output data-testid='route-location'>{pathname}</output>;
};

function renderComposer(
  text = '',
  withInlineForm = true,
  position = 'top',
  withSidebar = false,
) {
  const store = configureStore({
    reducer: reducerWithInitialState({
      meta: {
        me: '123',
        locale: 'en',
        emoji_style: 'native',
        composer_position: position,
      },
      accounts: { '123': accountFactoryImmutable({ id: '123' }) },
      compose: {
        text,
        language: 'en',
        default_language: 'en',
        privacy: 'public',
        default_privacy: 'public',
        default_quote_policy: 'public',
      },
      composer: { displayState: 'showing' },
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware(defaultMiddleware),
  });

  const result = render(
    <Provider store={store}>
      {withInlineForm && <BirdUiComposer />}
      {withSidebar && <BirdUiSidebar />}
      <ComposeButton />
      <RouteLocation />
    </Provider>,
  );
  return { ...result, store };
}

describe('Bird UI inline composer', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(),
      configurable: true,
    });
    mocks.isMobile = false;
    mocks.isNarrow = false;
    document.documentElement.style.setProperty('--bird-ui-redesign', '1');
    vi.stubGlobal('visualViewport', undefined);
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
    cleanup();
    document.documentElement.style.removeProperty('--bird-ui-redesign');
    vi.unstubAllGlobals();
  });

  it('places the default sidebar composer directly below search, without a second form', () => {
    const { container } = renderComposer('', true, 'sidebar', true);
    const sidebar = container.querySelector(
      '[data-composer-position="sidebar"]',
    );
    expect(sidebar).not.toBeNull();
    expect(sidebar?.previousElementSibling?.getAttribute('data-testid')).toBe(
      'sidebar-search',
    );
    expect(
      container.querySelector('[data-composer-position="top"]'),
    ).toBeNull();
    expect(container.querySelectorAll('#composer-text')).toHaveLength(1);
  });

  it('uses one bottom popup when popup is selected', () => {
    const { container } = renderComposer('Existing draft', true, 'popup', true);
    expect(container.querySelector('form[data-inline]')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(container.querySelectorAll('#composer-text')).toHaveLength(1);
    expect(screen.getByRole('textbox')).toHaveProperty(
      'value',
      'Existing draft',
    );
  });

  it('moves the sidebar composer above the timeline when the right sidebar cannot fit', () => {
    mocks.isNarrow = true;
    const { container } = renderComposer(
      'Draft on a smaller desktop',
      true,
      'sidebar',
      true,
    );
    expect(
      container.querySelector('[data-composer-position="top"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-composer-position="sidebar"]'),
    ).toBeNull();
    expect(container.querySelectorAll('#composer-text')).toHaveLength(1);
  });

  it('uses the existing form and updates the existing compose draft', () => {
    const { container, store } = renderComposer();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'An inline post' } });
    expect(store.getState().compose.get('text')).toBe('An inline post');
    expect(container.querySelectorAll('form[data-inline]')).toHaveLength(1);
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the existing draft when Escape is pressed in the inline form', () => {
    const { store } = renderComposer('Keep this draft');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(store.getState().compose.get('text')).toBe('Keep this draft');
    expect(store.getState().modal.stack.size).toBe(0);
  });

  it.each(['', 'Keep this draft'])(
    'only warns before leaving the inline composer when a draft has changes: %s',
    (text) => {
      renderComposer(text);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(text.length > 0);
    },
  );

  it('does not force navigation to the compose page just because a draft is open', () => {
    renderComposer('Keep this draft', false);
    expect(screen.getByTestId('route-location').textContent).toBe('/');
  });

  it('leaves the mobile textarea to the existing full-screen composer', async () => {
    mocks.isMobile = true;
    const { container } = renderComposer();
    expect(container.querySelector('form[data-inline]')).toBeNull();
    await screen.findByRole('dialog');
  });
});
