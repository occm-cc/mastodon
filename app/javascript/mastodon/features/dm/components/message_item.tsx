import type React from 'react';
import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { EmojiHTML } from 'mastodon/components/emoji/html';
import type { DmChatRoomParticipant, DmMessage } from 'mastodon/reducers/dm';

const messages = defineMessages({
  retry: {
    id: 'dm.message_item.retry',
    defaultMessage: 'Failed to send. Tap to retry',
  },
  read_status: { id: 'dm.message_item.read', defaultMessage: 'Read' },
});

const firstNonBlank = (
  ...values: (string | null | undefined)[]
): string | undefined =>
  values.find((value): value is string => Boolean(value?.trim()));

interface MessageItemProps {
  message: DmMessage;
  isOwn: boolean;
  unreadCount?: number;
  isGroupChat?: boolean;
  showAvatar: boolean;
  showName: boolean;
  showTimestamp: boolean;
  onRetry?: (message: DmMessage) => void;
  account?: DmChatRoomParticipant;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  unreadCount,
  isGroupChat,
  showAvatar,
  showName,
  showTimestamp,
  onRetry,
  account,
}) => {
  const intl = useIntl();
  const time = intl.formatTime(message.created_at, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const classNames = [
    'dm-message-item',
    isOwn ? 'dm-message-item--own' : 'dm-message-item--other',
    !showAvatar ? 'dm-message-item--consecutive' : '',
    message.pending ? 'dm-message-item--pending' : '',
    message.failed ? 'dm-message-item--failed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      {!isOwn && isGroupChat && (
        <div className='dm-message-item__avatar'>
          {showAvatar &&
            (account?.avatar_static ? (
              <img
                className='dm-message-item__avatar-img'
                src={account.avatar_static}
                alt=''
                width='28'
                height='28'
              />
            ) : (
              <div className='dm-message-item__avatar-placeholder' />
            ))}
        </div>
      )}
      <div className='dm-message-item__bubble-wrapper'>
        {showName && !isOwn && (
          <span className='dm-message-item__sender-name'>
            {firstNonBlank(account?.display_name, account?.username) ??
              message.account_id}
          </span>
        )}
        {/* Safety: message.content is HTML-escaped server-side in
            SendDmMessageService#process_content via ERB::Util.html_escape
            before being wrapped in a <p> tag. Only safe HTML is stored.
            Optimistic messages are also HTML-escaped client-side in the
            reducer before being set as content. EmojiHTML parses this into
            React elements (rather than dangerouslySetInnerHTML) and expands
            any :shortcode: text nodes into custom emoji images using
            message.emojis, matching how status content is rendered. */}
        <div
          className={`dm-message-bubble ${isOwn ? 'dm-message-bubble--own' : 'dm-message-bubble--other'}`}
        >
          {message.attachments.length > 0 && (
            <div className='dm-message-bubble__attachments'>
              {(
                message.attachments as {
                  id: string;
                  preview_url?: string;
                  url?: string;
                  type?: string;
                }[]
              ).map((attachment) => (
                <img
                  key={attachment.id}
                  className='dm-message-bubble__attachment-img'
                  src={firstNonBlank(attachment.preview_url, attachment.url)}
                  alt=''
                />
              ))}
            </div>
          )}
          {message.content && (
            <EmojiHTML
              htmlString={message.content}
              extraEmojis={message.emojis}
            />
          )}
        </div>
        {message.failed && (
          <FailedMessageRetry message={message} onRetry={onRetry} />
        )}
      </div>
      {showTimestamp && (
        <div className='dm-message-item__meta'>
          {isOwn &&
            isGroupChat &&
            unreadCount !== undefined &&
            unreadCount > 0 && (
              <span className='dm-message-item__read-status dm-message-item__unread-count'>
                {unreadCount}
              </span>
            )}
          {isOwn &&
            !isGroupChat &&
            unreadCount !== undefined &&
            unreadCount === 0 && (
              <span className='dm-message-item__read-status'>
                {intl.formatMessage(messages.read_status)}
              </span>
            )}
          <time
            className='dm-message-item__time'
            dateTime={message.created_at}
            title={intl.formatDate(message.created_at, {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          >
            {time}
          </time>
        </div>
      )}
    </div>
  );
};

interface FailedMessageRetryProps {
  message: DmMessage;
  onRetry?: (message: DmMessage) => void;
}

const FailedMessageRetry: React.FC<FailedMessageRetryProps> = ({
  message,
  onRetry,
}) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    if (onRetry) {
      onRetry(message);
    }
  }, [onRetry, message]);

  return (
    <button
      type='button'
      className='dm-message-item__retry'
      onClick={handleClick}
    >
      {intl.formatMessage(messages.retry)}
    </button>
  );
};
