import type React from 'react';
import { useCallback, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useColumn } from '@/mastodon/components/column/context';
import { fetchChatRooms } from 'mastodon/actions/dm';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { ChatRoomItem } from './chat_room_item';
import { ChatRoomListHeader } from './chat_room_list_header';
import { ChatRoomListSkeleton } from './skeleton_loading';

const messages = defineMessages({
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

  return (
    <div className='dm-chat-room-list'>
      <ChatRoomListHeader />
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
            {chatRooms.orderedIds.map((id) => {
              const room = chatRooms.items[id];
              if (!room) return null;
              return (
                <ChatRoomItem
                  key={id}
                  room={room}
                  active={id === activeRoomId}
                />
              );
            })}
            {chatRooms.isLoading && (
              <div className='dm-chat-room-list__loading'>
                <span>{intl.formatMessage(messages.loading)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
