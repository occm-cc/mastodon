import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { DM_MESSAGE_REMOVE_FAILED, sendMessage } from 'mastodon/actions/dm';
import type { DmMessage } from 'mastodon/reducers/dm';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

import { continuesMessageGroup, isSameMessageDay } from '../message_groups';

import { DateSeparator } from './date_separator';
import { MessageItem } from './message_item';

interface MessageListProps {
  roomId: string;
  currentAccountId: string | undefined;
  isGroupChat: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  roomId,
  currentAccountId,
  isGroupChat,
}) => {
  const messagesState = useAppSelector((state) => state.dm.messages[roomId]);
  const room = useAppSelector((state) => state.dm.chatRooms.items[roomId]);
  const accounts = useAppSelector((state) => state.dm.accounts);
  const readReceipts = room?.readReceipts ?? {};
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const dispatch = useAppDispatch();

  const messages = messagesState?.items ?? [];

  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [roomId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const handleRetry = useCallback(
    (message: DmMessage) => {
      // Remove the failed message, then re-dispatch send with the original content
      dispatch({
        type: DM_MESSAGE_REMOVE_FAILED,
        roomId,
        tempId: message.tempId,
      });
      dispatch(sendMessage(roomId, { content: message.content_plain }));
    },
    [dispatch, roomId],
  );

  return (
    <div
      className='dm-message-list scrollable'
      ref={scrollRef}
      onScroll={handleScroll}
    >
      {messages.map((message, index) => {
        const prevMessage = messages[index - 1];
        const isOwn = message.account_id === currentAccountId;
        const showAvatar = !continuesMessageGroup(prevMessage, message);
        const showTimestamp = !continuesMessageGroup(
          message,
          messages[index + 1],
        );
        const showName = isGroupChat && !isOwn && showAvatar;

        // Calculate unread count for the message
        let unreadCount: number | undefined;
        if (
          isOwn &&
          !message.pending &&
          !message.failed &&
          /^\d+$/.test(message.id) &&
          room
        ) {
          const totalOtherMembers = room.participant_ids.length - 1;
          const readCount = Object.entries(readReceipts).filter(
            ([accountId, lastReadId]) =>
              accountId !== message.account_id &&
              lastReadId &&
              /^\d+$/.test(lastReadId) &&
              BigInt(lastReadId) >= BigInt(message.id),
          ).length;
          unreadCount = totalOtherMembers - readCount;
        }

        const showDateSeparator =
          !prevMessage ||
          !isSameMessageDay(prevMessage.created_at, message.created_at);

        return (
          <div key={message.id}>
            {showDateSeparator && <DateSeparator date={message.created_at} />}
            <MessageItem
              message={message}
              isOwn={isOwn}
              unreadCount={unreadCount}
              isGroupChat={isGroupChat}
              showAvatar={showAvatar}
              showName={showName}
              showTimestamp={showTimestamp}
              onRetry={handleRetry}
              account={accounts[message.account_id]}
            />
          </div>
        );
      })}
    </div>
  );
};
