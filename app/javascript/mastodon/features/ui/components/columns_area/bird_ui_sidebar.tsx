import { Search } from '@/mastodon/components/search';
import { BirdUiComposer } from '@/mastodon/features/compose/components/bird_ui_composer';
import { Trends } from '@/mastodon/features/navigation_panel/components/trends';
import { NavigationFooterLinks } from '@/mastodon/features/navigation_panel/redesign/footer_links';

import classes from './styles.module.scss';

export const BirdUiSidebar: React.FC = () => (
  <div className={classes.birdUiSidebar}>
    <Search singleColumn context='sidebar' />
    <BirdUiComposer placement='sidebar' />
    <Trends />
    <NavigationFooterLinks />
  </div>
);
