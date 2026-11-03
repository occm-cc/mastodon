import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import classNames from 'classnames';

import { Avatar } from '@/mastodon/components/avatar';
import { useBreakpoint } from '@/mastodon/features/ui/hooks/useBreakpoint';
import { useAccount } from '@/mastodon/hooks/useAccount';
import { useIdentity } from '@/mastodon/identity_context';
import { useAppSelector } from '@/mastodon/store';

import { ComposeForm } from '../form';
import { useComposerPlacement } from '../useComposerPlacement';

import classes from './bird_ui_composer.module.scss';

// Reuse the complete composer, including its Redux draft and attachment state.
// Mobile continues to use the existing full-screen composer, so only one
// textarea with COMPOSER_TEXTAREA_ID is mounted at a time.
export const BirdUiComposer: React.FC<{ placement?: 'top' | 'sidebar' }> = ({
  placement = 'top',
}) => {
  const intl = useIntl();
  const { accountId, signedIn } = useIdentity();
  const account = useAccount(accountId);
  const isMobile = useBreakpoint('openable');
  const activePlacement = useComposerPlacement();
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useAppSelector((state) => state.composer.pendingFocus);
  const hasContext = useAppSelector(
    (state) =>
      !!state.compose.get('id') ||
      !!state.compose.get('in_reply_to') ||
      !!state.compose.get('scheduled_status_id'),
  );

  useEffect(() => {
    if (pendingFocus && !isMobile) {
      rootRef.current?.scrollIntoView({
        block: placement === 'sidebar' ? 'nearest' : 'start',
      });
    }
  }, [pendingFocus, isMobile, placement]);

  if (!signedIn || isMobile || activePlacement !== placement) return null;

  return (
    <div
      className={classNames(
        classes.root,
        placement === 'sidebar' && classes.sidebar,
      )}
      ref={rootRef}
      data-composer-position={placement}
    >
      {placement === 'top' && <Avatar account={account} size={48} />}
      <ComposeForm
        inline
        headless={!hasContext}
        noMinimize
        className={classes.form}
        aria-label={intl.formatMessage({
          id: 'tabs_bar.publish',
          defaultMessage: 'New Post',
        })}
      />
    </div>
  );
};
