import { useLocation } from 'react-router';

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { reducerWithInitialState } from '@/mastodon/reducers';
import { defaultMiddleware } from '@/mastodon/store/store';
import { accountFactoryImmutable } from '@/testing/factories';
import { cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { BirdUiComposer } from './bird_ui_composer';
import { ComposeRedesignButton } from './trigger';

const mocks = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/mastodon/components/avatar', () => ({ Avatar: () => null }));
vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => mocks.isMobile,
}));
vi.mock('@/mastodon/hooks/useScrollSensor', () => ({
  useScrollSensor: () => ({ sensor: null, isInViewport: true }),
}));
vi.mock('./emoji', () => ({ ComposeEmojiButton: () => null }));

const RouteLocation = () => {
  const { pathname } = useLocation();
  return <output data-testid='route-location'>{pathname}</output>;
};

function renderComposer(text = '', withInlineForm = true) {
  const store = configureStore({
    reducer: reducerWithInitialState({
      meta: { me: '123', locale: 'en', emoji_style: 'native' },
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
      <ComposeRedesignButton />
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
