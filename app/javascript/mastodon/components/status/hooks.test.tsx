import { IntlProvider } from 'react-intl';

import type { RecordOf } from 'immutable';

import { fireEvent, render, renderHook, screen } from '@testing-library/react';

import type * as StoreModule from '@/mastodon/store';
import {
  accountFactoryState,
  statusFactoryImmutable,
  statusFactoryState,
} from '@/testing/factories';

import { useStatusMenuActions } from './hooks';

vi.mock('@/mastodon/store', async (importOriginal) => {
  const actual = await importOriginal<typeof StoreModule>();
  return {
    ...actual,
    useAppDispatch: () => vi.fn(),
    useAppSelector: (
      selector: (state: ReturnType<typeof actual.store.getState>) => unknown,
    ) => {
      const state = actual.store.getState() as RecordOf<StoreModule.RootState>;
      return selector(
        state
          .set('meta', state.meta.set('me', '123'))
          .set('statuses', state.statuses.set('1', statusFactoryImmutable())),
      );
    },
  };
});

const status = {
  ...statusFactoryState(),
  account: accountFactoryState(),
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale='en'>{children}</IntlProvider>
);

describe('Redesign pending mention actions', () => {
  it('dismisses the notification using its callback', () => {
    const onDismissPendingMention = vi.fn();
    const { result } = renderHook(
      () =>
        useStatusMenuActions({
          status,
          contextType: 'pending-mentions',
          withDismiss: true,
          onDismissPendingMention,
        }),
      { wrapper },
    );

    const dismissAction = result.current.find(
      (item) => item?.text === 'Dismiss',
    );
    expect(dismissAction).toBeDefined();
    if (dismissAction && 'action' in dismissAction) {
      render(
        <button type='button' onClick={dismissAction.action}>
          Dismiss
        </button>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    }
    expect(onDismissPendingMention).toHaveBeenCalledOnce();
  });

  it('does not offer pending mention dismissal in other feeds', () => {
    const { result } = renderHook(
      () =>
        useStatusMenuActions({
          status,
          contextType: 'home',
          onDismissPendingMention: vi.fn(),
        }),
      { wrapper },
    );

    expect(result.current.some((item) => item?.text === 'Dismiss')).toBe(false);
  });

  it('does not offer dismissal when there is no notification callback', () => {
    const { result } = renderHook(
      () => useStatusMenuActions({ status, contextType: 'pending-mentions' }),
      { wrapper },
    );

    expect(result.current.some((item) => item?.text === 'Dismiss')).toBe(false);
  });
});
