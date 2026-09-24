import { useCallback, useEffect, useMemo } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from '@unhead/react/helmet';

import AlternateEmailIcon from '@/material-icons/400-24px/alternate_email.svg?react';
import ChatBubbleIcon from '@/material-icons/400-24px/chat_bubble.svg?react';
import {
  fetchPendingMentions,
  fetchMorePendingMentions,
  dismissPendingMention,
} from 'mastodon/actions/pending_mentions';
import { Icon } from 'mastodon/components/icon';
import { NotSignedInIndicator } from 'mastodon/components/not_signed_in_indicator';
import { StatusQuoteManager } from 'mastodon/components/status/legacy/quoted';
import { useIdentity } from 'mastodon/identity_context';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { Column } from '../../components/column';
import { ColumnHeader } from '@/mastodon/components/column/header';
import ScrollableList from '../../components/scrollable_list';

const messages = defineMessages({
  title: { id: 'column.pending_mentions', defaultMessage: 'Awaiting reply' },
});

const PendingMentionItem: React.FC<{
  notificationId: string;
  statusId: string | null | undefined;
}> = ({ notificationId, statusId }) => {
  const dispatch = useAppDispatch();

  const handleDismiss = useCallback(() => {
    void dispatch(dismissPendingMention({ id: notificationId }));
  }, [dispatch, notificationId]);

  if (!statusId) return null;

  return (
    <div className='notification-ungrouped focusable notification-ungrouped--mention'>
      <h2 className='notification-ungrouped__header'>
        <div className='notification-ungrouped__header__icon'>
          <Icon icon={AlternateEmailIcon} id='alternate-email' />
        </div>
        <span>
          <FormattedMessage
            id='notification.label.mention'
            defaultMessage='Mention'
          />
        </span>
      </h2>

      <StatusQuoteManager
        id={statusId}
        contextType='pending-mentions'
        onDismissPendingMention={handleDismiss}
        withDismiss
        skipPrepend
        avatarSize={40}
        unfocusable
      />
    </div>
  );
};

export const PendingMentions: React.FC<{
  multiColumn?: boolean;
}> = ({ multiColumn }) => {
  const intl = useIntl();
  const { signedIn } = useIdentity();
  const dispatch = useAppDispatch();

  const items = useAppSelector((state) => state.pendingMentions.items);
  const isLoading = useAppSelector((state) => state.pendingMentions.isLoading);
  const hasMore = useAppSelector((state) => state.pendingMentions.hasMore);
  const next = useAppSelector((state) => state.pendingMentions.next);

  useEffect(() => {
    if (signedIn) {
      void dispatch(fetchPendingMentions());
    }
  }, [dispatch, signedIn]);

  const handleLoadMore = useCallback(() => {
    if (next) {
      void dispatch(fetchMorePendingMentions({ url: next }));
    }
  }, [dispatch, next]);

  const scrollableContent = useMemo(() => {
    if (items.length === 0) return null;

    return items.map((item) => {
      const statusId =
        'status' in item && item.status ? item.status.id : undefined;
      return (
        <PendingMentionItem
          key={item.id}
          notificationId={item.id}
          statusId={statusId}
        />
      );
    });
  }, [items]);

  const emptyMessage = (
    <FormattedMessage
      id='empty_column.pending_mentions'
      defaultMessage='No mentions awaiting reply.'
    />
  );

  const prepend = (
    <div className='notification__filter-bar' style={{ padding: '15px' }}>
      <FormattedMessage
        id='pending_mentions.explanation'
        defaultMessage='Favourite a mention to remove it from this list.'
      />
    </div>
  );

  const scrollContainer = signedIn ? (
    <ScrollableList
      scrollKey='pending-mentions'
      isLoading={isLoading}
      showLoading={isLoading && items.length === 0}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      prepend={prepend}
      alwaysPrepend
      emptyMessage={emptyMessage}
      bindToDocument={!multiColumn}
    >
      {scrollableContent}
    </ScrollableList>
  ) : (
    <NotSignedInIndicator />
  );

  return (
    <Column
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      <ColumnHeader
        icon='chat_bubble'
        iconComponent={ChatBubbleIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
      />

      {scrollContainer}

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default PendingMentions;
