import { Search } from '@/mastodon/features/compose/components/search';
import { Trends } from '@/mastodon/features/navigation_panel/components/trends';
import { NavigationFooterLinks } from '@/mastodon/features/navigation_panel/redesign/footer_links';

import classes from './styles.module.scss';

export const BirdUiSidebar: React.FC = () => (
  <div className={classes.birdUiSidebar}>
    <Search singleColumn context='sidebar' />
    <Trends />
    <NavigationFooterLinks />
  </div>
);
