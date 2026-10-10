import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { useHistory, useRouteMatch } from 'react-router';

import { PenNibIcon, ReadCvLogoIcon } from '@phosphor-icons/react';

import type { IconButtonProps } from '@/mastodon/components/button/redesign';
import { IconButton } from '@/mastodon/components/button/redesign';
import { MenuCard } from '@/mastodon/components/menu/card';
import { useIdentity } from '@/mastodon/identity_context';
import {
  minimizeComposerToggle,
  openNewComposer,
} from '@/mastodon/reducers/slices/composer';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';
import { isBirdUiEnabled } from '@/mastodon/utils/bird_ui';
import { isRedesignEnabled } from '@/mastodon/utils/environment';

import { useBreakpoint } from '../../ui/hooks/useBreakpoint';
import { useColumnsContext } from '../../ui/util/columns_context';

import { ComposeFormHeader } from './header';
import classes from './trigger.module.scss';

const ComposeLazyForm = lazy(() =>
  import('./index').then(({ RedesignComposeForm }) => ({
    default: RedesignComposeForm,
  })),
);

export const ComposeRedesignButton: React.FC<{
  /**
   * Render the button in regular document flow instead of fixed positioning for mobile layout
   */
  inline?: boolean;
}> = ({ inline = false }) => {
  const displayState = useAppSelector((state) => state.composer.displayState);
  const pendingFocus = useAppSelector((state) => state.composer.pendingFocus);
  const isMobile = useBreakpoint('openable');
  const { multiColumn } = useColumnsContext();
  const history = useHistory();
  const isHome = !!useRouteMatch({
    path: ['/home', '/timelines/home'],
    exact: true,
  });
  const isPublishPage = !!useRouteMatch({
    path: ['/publish', '/statuses/new'],
    exact: true,
  });
  const useEmbeddedForm = isBirdUiEnabled() && !isMobile && !multiColumn;
  const { signedIn } = useIdentity();

  useEffect(() => {
    // An open draft may survive browsing; navigate only for a new focus request.
    if (
      signedIn &&
      useEmbeddedForm &&
      displayState === 'showing' &&
      pendingFocus &&
      !isHome &&
      !isPublishPage
    ) {
      // Reuse the existing compose page away from Home rather than mounting
      // a second form or creating another compose route.
      history.push('/publish');
    }
  }, [
    signedIn,
    useEmbeddedForm,
    displayState,
    pendingFocus,
    isHome,
    isPublishPage,
    history,
  ]);

  const hasMobileFloatingActionButton = useHasMobileFloatingActionButton({
    isMobile,
  });

  // Update viewport based on visual size in order to account for the virtual keyboard.
  const [viewportHeight, setViewportHeight] = useState<null | number>(null);
  useEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.visualViewport?.height ?? null);
    };

    window.visualViewport?.addEventListener('resize', updateHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
    };
  }, []);

  const dispatch = useAppDispatch();
  const handleComposerOpen: React.MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(openNewComposer({ type: 'post' }));
    }, [dispatch]);

  const toggleMinimize = useCallback(() => {
    dispatch(minimizeComposerToggle());
  }, [dispatch]);

  if (!isRedesignEnabled() || !signedIn) {
    return null;
  }

  if (useEmbeddedForm) return null;

  const floatingButtonProps = {
    inline,
    hidden: !hasMobileFloatingActionButton,
  } as const;

  if (displayState === 'minimized') {
    return isMobile ? (
      <FloatingActionButton
        icon={ReadCvLogoIcon}
        onClick={toggleMinimize}
        {...floatingButtonProps}
        hidden={false} // never hide minimized composer button
        color='neutral'
      >
        <FormattedMessage id='compose.expand' defaultMessage='Show composer' />
      </FloatingActionButton>
    ) : (
      <MenuCard className={classes.composerMinimized} elevation={2}>
        <ComposeFormHeader />
      </MenuCard>
    );
  }

  if (displayState === 'showing') {
    // Pass the viewport height as a CSS variable so it's only used for mobile.
    const style = {
      '--viewport-height': viewportHeight ? `${viewportHeight}px` : undefined,
    } as React.CSSProperties;
    return (
      <Suspense
        fallback={
          <FloatingActionButton
            loading
            icon={PenNibIcon}
            {...floatingButtonProps}
          >
            <FormattedMessage id='tabs_bar.publish' defaultMessage='New Post' />
          </FloatingActionButton>
        }
      >
        <ComposeLazyForm autoFocus className={classes.composer} style={style} />
      </Suspense>
    );
  }

  return (
    <FloatingActionButton
      icon={PenNibIcon}
      onClick={handleComposerOpen}
      {...floatingButtonProps}
    >
      <FormattedMessage id='tabs_bar.publish' defaultMessage='New Post' />
    </FloatingActionButton>
  );
};

const FloatingActionButton: React.FC<
  {
    inline: boolean;
    hidden: boolean;
  } & IconButtonProps
> = ({ inline, hidden, ...otherProps }) => {
  return (
    // This component uses a wrapper element to prevent its
    // CSS transitions from messing with the button's own transitions
    <div
      className={classNames(
        classes.buttonWrapper,
        inline && classes.buttonWrapperInline,
        hidden && classes.buttonWrapperHidden,
      )}
      inert={hidden}
    >
      <IconButton variant='solid' color='accent' size='lg' {...otherProps} />
    </div>
  );
};

function includeMultiColumnPaths(paths: string[]) {
  return [...paths, ...paths.map((path) => `/deck${path}`)];
}

const MOBILE_COMPOSE_BUTTON_ALLOW_ROUTES = includeMultiColumnPaths([
  '/home',
  '/public',
  '/lists',
  '/tags',
]);
const MOBILE_COMPOSE_BUTTON_BLOCK_ROUTES = includeMultiColumnPaths([
  '/lists/new',
]);

function useHasMobileFloatingActionButton({ isMobile }: { isMobile: boolean }) {
  const isRouteWithMobileComposeButton = !!useRouteMatch({
    path: MOBILE_COMPOSE_BUTTON_ALLOW_ROUTES,
    exact: false,
  });

  const isRouteWithoutMobileComposeButton = !!useRouteMatch({
    path: MOBILE_COMPOSE_BUTTON_BLOCK_ROUTES,
    exact: true,
  });

  const shouldHideMobileComposeButton =
    !isMobile ||
    !isRouteWithMobileComposeButton ||
    isRouteWithoutMobileComposeButton;

  return !shouldHideMobileComposeButton;
}
