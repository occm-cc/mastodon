import { FormattedMessage } from 'react-intl';

import { WarningIcon } from '@phosphor-icons/react';

import { Callout } from '@/mastodon/components/callout/redesign';
import { Icon } from '@/mastodon/components/icon';
import { selectAccountStatus } from '@/mastodon/selectors/statuses';
import { createAppSelector, useAppSelector } from '@/mastodon/store';

import { selectComposeAttachments } from './selectors';
import classes from './styles.module.scss';

const selectComposeAttachmentsWithoutAlt = createAppSelector(
  [selectComposeAttachments],
  (attachments) => ({
    count: attachments.length,
    missingAlt: attachments.some((attachment) => !attachment.description),
  }),
);

const selectIsFollowersReply = createAppSelector(
  [
    (state) =>
      selectAccountStatus(
        state,
        state.compose.get('in_reply_to') as null | string,
      ),
    (state) => state.meta.get('me') as string | null,
  ],
  (status, me) =>
    status?.visibility === 'private' && status.account.id !== me
      ? status.account.acct
      : null,
);

export const ComposeHints = () => {
  const { count, missingAlt } = useAppSelector(
    selectComposeAttachmentsWithoutAlt,
  );
  const replyFollowersHandle = useAppSelector(selectIsFollowersReply);

  const publishErrors = useAppSelector((state) => state.composer.publishErrors);

  const messages: React.ReactNode[] = [];

  if (publishErrors.includes('empty')) {
    messages.push(
      <ComposerError key='empty'>
        <FormattedMessage
          id='compose.hints.empty'
          defaultMessage="Post can't be blank"
        />
      </ComposerError>,
    );
  }

  if (publishErrors.includes('too-long')) {
    messages.push(
      <ComposerError key='too-long'>
        <FormattedMessage
          id='compose.hints.too-long'
          defaultMessage='Post exceeds character maximum'
        />
      </ComposerError>,
    );
  }

  if (replyFollowersHandle) {
    messages.push(
      defaultWrapper(
        <FormattedMessage
          id='compose.hints.followers-reply'
          defaultMessage="You're replying to a followers-only post. People not following {user} might see your reply without the context of what you’re replying to."
          values={{ user: `@${replyFollowersHandle}` }}
        />,
        'followers-reply',
      ),
    );
  }

  if (missingAlt && count === 1) {
    messages.push(
      defaultWrapper(
        <FormattedMessage
          id='compose.hints.missing-alt'
          defaultMessage='Your attachment is missing alt text.'
        />,
        'missing-alt',
      ),
    );
  } else if (missingAlt) {
    messages.push(
      defaultWrapper(
        <FormattedMessage
          id='compose.hints.missing-alt-many'
          defaultMessage='One or more of your attachments are missing alt text.'
        />,
        'missing-alts',
      ),
    );
  }

  if (messages.length === 0) {
    return null;
  }

  return <div className={classes.calloutWrapper}>{messages}</div>;
};

const defaultWrapper = (children: React.ReactNode, key: string) => (
  <Callout icon={WarningIcon} key={key}>
    {children}
  </Callout>
);

const ComposerError: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className={classes.calloutError}>
      <Icon icon={WarningIcon} />

      {children}
    </div>
  );
};
