import { useRouteMatch } from 'react-router';

import { useAppSelector } from '@/mastodon/store';
import { isBirdUiEnabled } from '@/mastodon/utils/bird_ui';

import { useBreakpoint } from '../ui/hooks/useBreakpoint';
import { useColumnsContext } from '../ui/util/columns_context';

export type ComposerPlacement = 'sidebar' | 'top' | 'popup' | 'standalone';

// All mounts use the same decision, so a draft has only one active textarea.
export function useComposerPlacement(): ComposerPlacement {
  const setting = useAppSelector((state): unknown =>
    state.meta.get('composer_position', 'sidebar'),
  );
  const isMobile = useBreakpoint('openable');
  const isNarrow = useBreakpoint('sidebar');
  const { multiColumn } = useColumnsContext();
  const isStandalone = !!useRouteMatch({
    path: ['/publish', '/statuses/new'],
    exact: true,
  });
  const isMessages = !!useRouteMatch('/direct_message');

  if (isStandalone) return 'standalone';
  if (isMobile || multiColumn || !isBirdUiEnabled()) return 'popup';
  if (setting === 'popup') return 'popup';
  if (setting !== 'top' && !isNarrow && !isMessages) return 'sidebar';
  return 'top';
}
