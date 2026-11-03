import { Search } from '@/mastodon/components/search';
import { BirdUiComposer } from '@/mastodon/features/compose/components/bird_ui_composer';
import { FooterLinks } from '@/mastodon/features/discovery_panel/footer_links';
import { Trends } from '@/mastodon/features/navigation_panel/components/trends';

import classes from './styles.module.scss';

export const BirdUiSidebar: React.FC = () => (
  <div className={classes.birdUiSidebar}>
    <Search singleColumn context='sidebar' />
    <BirdUiComposer placement='sidebar' />
    <Trends />
    <footer className={classes.birdUiSidebarFooter}>
      <FooterLinks context='search' />
    </footer>
  </div>
);
