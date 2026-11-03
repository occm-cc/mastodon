import type React from 'react';
import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useColumn } from '@/mastodon/components/column/context';
import { fetchChatRooms } from 'mastodon/actions/dm';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { ChatRoomItem } from './chat_room_item';
import { ChatRoomListHeader } from './chat_room_list_header';
import { ChatRoomListSkeleton } from './skeleton_loading';

const messages = defineMessages({
  empty: {
    id: 'dm.list.empty',
    defaultMessage:
      'You have no conversations yet. Send someone a message to start one.',
  },
  noResults: {
    id: 'dm.list.no_results',
    defaultMessage: 'No conversation matches.',
  },
  nothingUnread: {
    id: 'dm.list.nothing_unread',
    defaultMessage: 'Nothing unread.',
  },
  migrationLoading: {
    id: 'dm.chat_room_list.migration_loading',
    defaultMessage: 'Loading your conversation history...',
  },
  loading: { id: 'dm.chat_room_list.loading', defaultMessage: 'Loading...' },
});

interface ChatRoomListProps {
  activeRoomId?: string;
}

export const ChatRoomList: React.FC<ChatRoomListProps> = ({ activeRoomId }) => {
  const intl = useIntl();
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dispatch = useAppDispatch();
  const chatRooms = useAppSelector((state) => state.dm.chatRooms);
  const migrationInProgress = useAppSelector(
    (state) => state.dm.migrationInProgress,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollSensor } = useColumn();

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (
      scrollHeight - scrollTop - clientHeight < 100 &&
      !chatRooms.isLoading &&
      chatRooms.hasMore
    ) {
      const lastUuid = chatRooms.orderedIds[chatRooms.orderedIds.length - 1];
      const lastRoom = lastUuid ? chatRooms.items[lastUuid] : undefined;
      if (lastRoom) {
        dispatch(fetchChatRooms({ max_id: lastRoom.id }));
      }
    }
  }, [
    dispatch,
    chatRooms.isLoading,
    chatRooms.hasMore,
    chatRooms.orderedIds,
    chatRooms.items,
  ]);

  const isFirstLoad = chatRooms.isLoading && chatRooms.orderedIds.length === 0;
  const showMigrationBanner =
    migrationInProgress &&
    !chatRooms.isLoading &&
    chatRooms.orderedIds.length === 0;

  const needle = query.trim().toLocaleLowerCase();
  const visibleRooms = chatRooms.orderedIds.flatMap((id) => {
    const room = chatRooms.items[id];
    if (!room || (unreadOnly && !room.unread)) return [];
    const matches =
      !needle ||
      [
        room.title,
        ...room.participants.flatMap((p) => [
          p.display_name,
          p.username,
          p.acct,
        ]),
      ].some((value) => value.toLocaleLowerCase().includes(needle));
    return matches ? [room] : [];
  });

  return (
    <div className='dm-chat-room-list'>
      <ChatRoomListHeader
        query={query}
        onQueryChange={setQuery}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
      />
      <div
        className='dm-chat-room-list__items scrollable'
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {scrollSensor}
        {isFirstLoad ? (
          <ChatRoomListSkeleton />
        ) : (
          <>
            {showMigrationBanner && (
              <div className='dm-migration-banner'>
                <span className='dm-migration-banner__text'>
                  {intl.formatMessage(messages.migrationLoading)}
                </span>
              </div>
            )}
            {visibleRooms.map((room) => (
              <ChatRoomItem
                key={room.uuid}
                room={room}
                active={room.uuid === activeRoomId}
              />
            ))}
            {!chatRooms.isLoading &&
              !showMigrationBanner &&
              visibleRooms.length === 0 && (
                <div className='dm-chat-room-list__empty' role='status'>
                  {intl.formatMessage(
                    needle
                      ? messages.noResults
                      : unreadOnly
                        ? messages.nothingUnread
                        : messages.empty,
                  )}
                </div>
              )}
            {chatRooms.isLoading && (
              <div className='dm-chat-room-list__loading'>
                <span>{intl.formatMessage(messages.loading)}</span>
              </div>
            )}
          </>
        )}
      </div>
      <small className='dm-credit'>
        <a
          href='https://twitter.com/_longwhile'
          target='_blank'
          rel='noopener noreferrer'
        >
          <span lang='ko'>메시지 UI · 한참 (@_longwhile)</span>
        </a>
      </small>
    </div>
  );
};
