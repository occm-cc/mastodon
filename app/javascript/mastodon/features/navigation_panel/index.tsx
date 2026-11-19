import { useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useRouteMatch } from 'react-router';

import {
  PenNibIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  BellIcon,
  ChatCircleDotsIcon,
  ChatCircleIcon,
  ArrowsLeftRightIcon,
  RssSimpleIcon,
  BookmarkSimpleIcon,
  PlusIcon,
  InfoIcon,
  GavelIcon,
  ShieldStarIcon,
  CompassIcon,
} from '@phosphor-icons/react';

import { Button } from '@/mastodon/components/button';
import { Callout } from '@/mastodon/components/callout/redesign';
import { FOCUS_TARGET } from '@/mastodon/components/navigation_focus_target';
import { selectComposeType } from '@/mastodon/features/compose/components/selectors';
import { useComposerPlacement } from '@/mastodon/features/compose/useComposerPlacement';
import { AccountSwitcher } from '@/mastodon/features/ui/components/account_switcher';
import { useScrollSensor } from '@/mastodon/hooks/useScrollSensor';
import { useIdentity } from '@/mastodon/identity_context';
import { disabledAccountId, trendsEnabled } from '@/mastodon/initial_state';
import { transientSingleColumn } from '@/mastodon/is_mobile';
import {
  canManageReports,
  canViewAdminDashboard,
} from '@/mastodon/permissions';
import {
  openNewComposer,
  requestComposerFocus,
} from '@/mastodon/reducers/slices/composer';
import { closeMobileMenu } from '@/mastodon/reducers/slices/navigation';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';
import { isBirdUiEnabled } from '@/mastodon/utils/bird_ui';
import { invokeVirtualIosKeyboard } from '@/mastodon/utils/invoke_virtual_ios_keyboard';

import { NavigationAccountCardAndMenu } from './account_menu_items';
import { CollapsedNavigationPanel } from './collapsed';
import { FooterLinks } from './footer_links';
import { NavigationHeader } from './header';
import {
  useCustomFeeds,
  useFollowedHashtags,
  usePublicFeedsLink,
  useNotificationsCount,
  useDmUnreadCount,
} from './hooks';
import { ListSection } from './list_section';
import { DisabledAccountBanner, LoggedOutInfo } from './logged_out_info';
import { NavigationLink } from './navigation_link';
import classes from './styles.module.scss';

const messages = defineMessages({
  main: {
    id: 'navigation_bar.main',
    defaultMessage: 'Main',
    description:
      'Label for the main navigation; should not contain the word "navigation".',
  },
});

const renderAccountSwitchLink = ({
  openManage,
}: {
  openManage: () => void;
}) => (
  <NavigationLink
    as='button'
    icon={ArrowsLeftRightIcon}
    onClick={openManage}
    aria-haspopup='dialog'
  >
    <FormattedMessage
      id='navigation_panel.account_switch'
      defaultMessage='Switch accounts'
    />
  </NavigationLink>
);

const MAX_HASHTAG_COUNT = 5;

interface NavigationPanelProps {
  siteName?: string;
  /**
   * In 'slide-out' mode (used on mobile), some menu items
   * are hidden and the design is tweaked slightly
   */
  mode?: 'static' | 'slide-out';
  multiColumn?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = (props) => {
  const { mode = 'static', multiColumn, collapsed, onToggleCollapsed } = props;

  if (mode === 'static' && collapsed) {
    return (
      <CollapsedNavigationPanel
        multiColumn={multiColumn}
        onToggleCollapsed={onToggleCollapsed}
      />
    );
  } else {
    return <ExpandedNavigationPanel {...props} />;
  }
};

const ExpandedNavigationPanel: React.FC<NavigationPanelProps> = ({
  siteName,
  mode = 'static',
  multiColumn,
  onToggleCollapsed,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn, permissions } = useIdentity();
  const birdUi = isBirdUiEnabled();
  const isHome = !!useRouteMatch({
    path: ['/home', '/timelines/home'],
    exact: true,
  });
  const composeType = useAppSelector(selectComposeType);
  const isEditing = useAppSelector((state) => !!state.compose.get('id'));
  const composerPlacement = useComposerPlacement();

  const isManager = canManageReports(permissions);
  const isAdmin = canViewAdminDashboard(permissions);

  const openComposer = useCallback(() => {
    dispatch(closeMobileMenu());
    if (
      (composerPlacement === 'sidebar' ||
        (composerPlacement === 'top' && isHome)) &&
      composeType === 'post' &&
      !isEditing
    ) {
      dispatch(requestComposerFocus());
    } else {
      dispatch(openNewComposer({ type: 'post' }));
    }
  }, [dispatch, composerPlacement, isHome, composeType, isEditing]);

  const { customFeeds } = useCustomFeeds();
  const { followedHashtags } = useFollowedHashtags();

  const newPostButton = (
    <li>
      <Button
        leadingIcon={PenNibIcon}
        onClick={openComposer}
        variant='solid'
        color='accent'
        size='md'
        className={classes.newPostButton}
      >
        <FormattedMessage id='tabs_bar.publish' defaultMessage='New Post' />
      </Button>
    </li>
  );

  const { sensor: topSensor, isInViewport: isScrolledToTop } = useScrollSensor({
    placement: 'top',
    tolerance: 2,
  });
  const { sensor: bottomSensor, isInViewport: isScrolledToBottom } =
    useScrollSensor({
      placement: 'bottom',
    });

  const publicFeedsLink = usePublicFeedsLink();
  const publicFeeds = publicFeedsLink && (
    <NavigationLink
      to={publicFeedsLink.link}
      icon={publicFeedsLink.icon}
      isActive={publicFeedsLink.isActive}
    >
      {publicFeedsLink.label}
    </NavigationLink>
  );

  return (
    <nav
      className={classes.root}
      data-mode={mode}
      data-scrollable={!isScrolledToTop || !isScrolledToBottom}
      aria-label={intl.formatMessage(messages.main)}
    >
      {topSensor}
      <NavigationHeader
        multiColumn={multiColumn}
        siteName={siteName}
        isStuck={!isScrolledToTop}
        onToggleCollapsed={onToggleCollapsed}
        mode={mode}
        showActions={!birdUi}
      />
      {signedIn && (
        <>
          {transientSingleColumn && <TransientSingleColumnCallout />}
          <ul className={classes.list}>
            {birdUi && (
              <NavigationLink to='/home' icon={HouseIcon}>
                <FormattedMessage id='tabs_bar.home' defaultMessage='Home' />
              </NavigationLink>
            )}
            <ExploreLink birdUi={birdUi} />
            {birdUi ? (
              <NavigationActions />
            ) : (
              <>
                {publicFeeds}
                <NavigationLink to='/bookmarks' icon={BookmarkSimpleIcon}>
                  <FormattedMessage
                    id='navigation_bar.saved_posts'
                    defaultMessage='Saved Posts'
                  />
                </NavigationLink>
                <PendingMentionsLink />
              </>
            )}
            <AccountSwitcher renderTrigger={renderAccountSwitchLink} />
            {birdUi && composerPlacement !== 'sidebar' && newPostButton}

            <ListSection
              id='custom-feeds'
              title={
                <FormattedMessage
                  id='tabs_bar.custom_feeds'
                  defaultMessage='Custom Feeds'
                />
              }
            >
              <NavigationLink key='new' to='/lists/new' icon={PlusIcon}>
                <FormattedMessage
                  id='tabs_bar.create_custom_feed'
                  defaultMessage='Create Feed'
                />
              </NavigationLink>
              {customFeeds.map((feed) => (
                <NavigationLink
                  key={feed.id}
                  to={`/lists/${feed.id}`}
                  icon={RssSimpleIcon}
                >
                  {feed.title}
                </NavigationLink>
              ))}
            </ListSection>

            {followedHashtags.length > 0 && (
              <ListSection
                id='followed-hashtags'
                title={
                  <FormattedMessage
                    id='tabs_bar.followed_hashtags'
                    defaultMessage='Followed Hashtags'
                  />
                }
              >
                {followedHashtags.slice(0, MAX_HASHTAG_COUNT).map((tag) => (
                  <NavigationLink key={tag.name} to={`/tags/${tag.name}`}>
                    #{tag.name}
                  </NavigationLink>
                ))}
                {followedHashtags.length > MAX_HASHTAG_COUNT && (
                  <NavigationLink key='view-all' to='/followed_tags'>
                    <FormattedMessage
                      id='tabs_bar.followed_tags_view_all'
                      defaultMessage='View all'
                    />
                  </NavigationLink>
                )}
              </ListSection>
            )}

            {isAdmin && (
              <NavigationLink
                withDivider
                as='a'
                href='/admin/dashboard'
                icon={GavelIcon}
              >
                <FormattedMessage
                  id='navigation_bar.administration'
                  defaultMessage='Administration'
                />
              </NavigationLink>
            )}

            {isManager && (
              <NavigationLink
                withDivider={!isAdmin}
                as='a'
                href='/admin/reports'
                icon={ShieldStarIcon}
              >
                <FormattedMessage
                  id='navigation_bar.moderation'
                  defaultMessage='Moderation'
                />
              </NavigationLink>
            )}
          </ul>

          <footer className={classes.footer}>
            {birdUi && mode !== 'slide-out' && <NavigationAccountCardAndMenu />}
            <FooterLinks multiColumn={multiColumn} />
          </footer>
        </>
      )}
      {!signedIn && (
        <>
          <ul className={classes.list}>
            <NavigationLink to='/about' icon={InfoIcon}>
              <FormattedMessage
                id='footer.about_this_server'
                defaultMessage='About'
              />
            </NavigationLink>
            <ExploreLink birdUi={birdUi} />
            {!birdUi && publicFeeds}
          </ul>
          <footer className={classes.footer}>
            {disabledAccountId ? <DisabledAccountBanner /> : <LoggedOutInfo />}
            <FooterLinks multiColumn={multiColumn} />
          </footer>
        </>
      )}
      <div
        className={classes.bottomScrollFade}
        data-stuck={!isScrolledToBottom}
      />
      {bottomSensor}
    </nav>
  );
};

const NavigationActions: React.FC = () => {
  const notificationsCount = useNotificationsCount();
  const dmUnreadCount = useDmUnreadCount();

  return (
    <>
      <NavigationLink
        to='/notifications'
        icon={BellIcon}
        badgeCount={notificationsCount}
      >
        <FormattedMessage
          id='tabs_bar.notifications'
          defaultMessage='Notifications'
        />
      </NavigationLink>
      <PendingMentionsLink />
      <NavigationLink
        to='/direct_message'
        icon={ChatCircleDotsIcon}
        badgeCount={dmUnreadCount}
      >
        <FormattedMessage id='bird_ui.navigation.chat' defaultMessage='Chat' />
      </NavigationLink>
      <NavigationLink to='/bookmarks' icon={BookmarkSimpleIcon}>
        <FormattedMessage
          id='navigation_bar.bookmarks'
          defaultMessage='Bookmarks'
        />
      </NavigationLink>
    </>
  );
};

const PendingMentionsLink: React.FC = () => (
  <NavigationLink to='/pending-mentions' icon={ChatCircleIcon}>
    <FormattedMessage
      id='navigation_bar.pending_mentions'
      defaultMessage='Awaiting reply'
    />
  </NavigationLink>
);

const ExploreLink: React.FC<{ birdUi?: boolean }> = ({ birdUi }) => {
  if (!birdUi && !trendsEnabled) return null;

  return (
    <NavigationLink
      to={{
        pathname: trendsEnabled ? '/explore' : '/search',
        state: { focusTarget: FOCUS_TARGET.SEARCH },
      }}
      icon={birdUi ? MagnifyingGlassIcon : CompassIcon}
      onClick={handleSearchLinkClick}
    >
      {birdUi ? (
        <FormattedMessage
          id='bird_ui.navigation.explore'
          defaultMessage='Explore'
        />
      ) : trendsEnabled ? (
        <FormattedMessage id='tabs_bar.explore' defaultMessage='Explore' />
      ) : (
        <FormattedMessage id='navigation_bar.search' defaultMessage='Search' />
      )}
    </NavigationLink>
  );
};
const TransientSingleColumnCallout: React.FC = () => (
  <Callout className={classes.callout}>
    <FormattedMessage
      id='navigation_bar.opened_in_single_column_layout'
      defaultMessage='Posts, profiles, and other pages are opened in the single-column layout by default.'
    />
    <br />
    <a href={`/deck${location.pathname}`}>
      <FormattedMessage
        id='navigation_bar.advanced_interface'
        defaultMessage='Open in advanced web interface'
      />
    </a>
  </Callout>
);

export function handleSearchLinkClick() {
  const mainSearchInput = document.querySelector<HTMLInputElement>(
    '[data-column-root] input[data-main-search]',
  );

  // Focus the main search input if we're already on the search page
  if (mainSearchInput) {
    mainSearchInput.focus();
    return;
  }

  // Otherwise, the search element is not on screen yet and
  // the page needs to be rendered first. In this case, we use
  // `invokeVirtualIosKeyboard` to work around an iOS quirk that
  // prevents the virtual keyboard from opening when an element wasn't
  // focused synchronously.
  invokeVirtualIosKeyboard();
}
