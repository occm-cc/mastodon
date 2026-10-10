import { render, screen } from '@/testing/rendering';

import { ColumnsArea } from '.';

import '@testing-library/jest-dom';

vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => false,
}));

vi.mock('@/mastodon/features/compose/components/search', () => ({
  Search: ({ context }: { context?: string }) => (
    <input aria-label={`Search ${context ?? 'column'}`} />
  ),
}));

vi.mock('@/mastodon/features/compose/redesign/trigger', () => ({
  ComposeRedesignButton: () => null,
}));

vi.mock('mastodon/features/custom_homepage/components/footer', () => ({
  Footer: () => null,
}));

vi.mock('@/mastodon/features/navigation_panel/redesign', () => ({
  RedesignNavigationPanel: () => null,
}));

vi.mock('@/mastodon/features/navigation_panel/redesign/mobile_nav', () => ({
  RedesignMobileNavigation: () => null,
}));

vi.mock('@/mastodon/features/navigation_panel/components/trends', () => ({
  Trends: () => <div>Bird UI trends</div>,
}));

vi.mock('@/mastodon/features/navigation_panel/redesign/footer_links', () => ({
  NavigationFooterLinks: () => null,
}));

vi.mock('./multi_column_content', () => ({
  MultiColumnContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('ColumnsArea sidebars', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--bird-ui-redesign');
    window.localStorage.removeItem('experiments');
  });

  it('preserves Bird UI search and trends without the retired redesign attribute', () => {
    document.documentElement.style.setProperty('--bird-ui-redesign', '1');
    window.localStorage.setItem('experiments', 'layout-with-search');

    render(
      <ColumnsArea singleColumn>
        <div>Timeline</div>
      </ColumnsArea>,
    );

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Bird UI trends')).toBeInTheDocument();
    expect(
      screen.getAllByRole('textbox', { name: 'Search sidebar' }),
    ).toHaveLength(1);
  });

  it('keeps the upstream search experiment available for other themes', () => {
    window.localStorage.setItem('experiments', 'layout-with-search');

    render(
      <ColumnsArea singleColumn>
        <div>Timeline</div>
      </ColumnsArea>,
    );

    expect(
      screen.getByRole('textbox', { name: 'Search sidebar' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Bird UI trends')).not.toBeInTheDocument();
  });

  it('keeps sidebars out of the minimal shell', () => {
    document.documentElement.style.setProperty('--bird-ui-redesign', '1');

    render(
      <ColumnsArea singleColumn minimalShell>
        <div>Public page</div>
      </ColumnsArea>,
    );

    expect(screen.getByText('Public page')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Bird UI trends')).not.toBeInTheDocument();
  });
});
