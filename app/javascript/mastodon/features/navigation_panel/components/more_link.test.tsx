import { render, screen } from '@testing-library/react';

import type { MenuItem } from 'mastodon/models/dropdown_menu';

import { MoreLink } from './more_link';

import '@testing-library/jest-dom';

vi.mock('react-intl', () => ({
  defineMessages: (messages: Record<string, unknown>) => messages,
  useIntl: () => ({
    formatMessage: (message: { defaultMessage: string }) =>
      message.defaultMessage,
  }),
  FormattedMessage: ({ defaultMessage }: { defaultMessage: string }) =>
    defaultMessage,
}));

vi.mock('mastodon/components/dropdown_menu', () => ({
  Dropdown: ({
    children,
    items,
  }: {
    children: React.ReactNode;
    items: MenuItem[];
  }) => (
    <>
      {children}
      <ul>
        {items.map((item, index) =>
          item ? <li key={index}>{item.text}</li> : null,
        )}
      </ul>
    </>
  ),
}));

vi.mock('mastodon/components/icon', () => ({
  Icon: ({ className }: { className: string }) => (
    <svg className={className} data-testid='more-icon' />
  ),
}));

vi.mock('mastodon/identity_context', () => ({
  useIdentity: () => ({ permissions: 0 }),
}));

vi.mock('mastodon/permissions', () => ({
  canManageReports: () => false,
  canViewAdminDashboard: () => false,
}));

vi.mock('mastodon/store', () => ({
  useAppDispatch: () => vi.fn(),
}));

describe('<MoreLink />', () => {
  it('renders a hoverable, specifically identifiable More trigger', () => {
    render(<MoreLink />);

    const trigger = screen.getByRole('button', { name: 'More' });

    expect(trigger).toHaveClass('navigation-panel__more-button');
    expect(trigger.querySelector(':scope > span')).toHaveTextContent('More');
    expect(screen.getByTestId('more-icon')).toHaveClass('column-link__icon');
  });

  it('omits muted words and blocked domains from the menu', () => {
    render(<MoreLink />);

    expect(screen.getByText('Private mentions')).toBeInTheDocument();
    expect(screen.getByText('Muted users')).toBeInTheDocument();
    expect(screen.getByText('Blocked users')).toBeInTheDocument();
    expect(screen.queryByText('Muted words')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocked domains')).not.toBeInTheDocument();
  });
});
