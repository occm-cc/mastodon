import type React from 'react';
import { useState, useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { GearIcon, ListIcon } from '@phosphor-icons/react';

import { openNavigation } from '@/mastodon/actions/navigation';
import {
  ColumnHeader,
  ColumnHeaderButton,
} from '@/mastodon/components/column_header';
import { useBreakpoint } from '@/mastodon/features/ui/hooks/useBreakpoint';
import { useAppDispatch } from '@/mastodon/store';
import { me } from 'mastodon/initial_state';
import type { DmChatRoom } from 'mastodon/reducers/dm';

import { RoomSettingsModal } from './room_settings_modal';

const messages = defineMessages({
  title: { id: 'dm.chat_room_list_header.title', defaultMessage: 'Messages' },
  settings: {
    id: 'dm.chat_room_header.settings',
    defaultMessage: 'Room settings',
  },
  membersCount: {
    id: 'dm.chat_room_header.members_count',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
  },
  roomFallback: {
    id: 'dm.chat_room_header.room_fallback',
    defaultMessage: 'Chat {id}',
  },
});

interface ChatRoomHeaderProps {
  room?: DmChatRoom;
  onBack?: () => void;
}

const firstNonBlank = (
  ...values: (string | null | undefined)[]
): string | undefined =>
  values.find((value): value is string => Boolean(value?.trim()));

export const ChatRoomHeader: React.FC<ChatRoomHeaderProps> = ({
  room,
  onBack,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const isMobile = useBreakpoint('openable');
  const handleOpenNavigation = useCallback(() => {
    dispatch(openNavigation());
  }, [dispatch]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const otherParticipant = room?.participants.find((p) => p.id !== me);
  const fallbackName = intl.formatMessage(messages.roomFallback, {
    id: room?.id ?? '',
  });
  const roomName = !room
    ? intl.formatMessage(messages.title)
    : room.room_type === 'direct'
      ? (firstNonBlank(
          otherParticipant?.display_name,
          otherParticipant?.username,
          room.title,
        ) ?? fallbackName)
      : (firstNonBlank(room.title) ?? fallbackName);
  const participantCount = room?.participant_ids.length ?? 0;
  const avatarUrl = firstNonBlank(
    otherParticipant?.avatar_static,
    room?.participants[0]?.avatar_static,
  );

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  return (
    <>
      <ColumnHeader
        withBackButton={!!onBack}
        onBack={onBack}
        title={
          room ? (
            <span className='dm-chat-room-header__identity'>
              <span className='dm-chat-room-header__avatar'>
                {avatarUrl ? (
                  <img
                    className='dm-chat-room-header__avatar-img'
                    src={avatarUrl}
                    alt=''
                    width='36'
                    height='36'
                  />
                ) : (
                  <span className='dm-chat-room-header__avatar-placeholder' />
                )}
              </span>
              <span className='dm-chat-room-header__info'>
                <span className='dm-chat-room-header__name'>{roomName}</span>
                <span className='dm-chat-room-header__members'>
                  {intl.formatMessage(messages.membersCount, {
                    count: participantCount,
                  })}
                </span>
              </span>
            </span>
          ) : (
            roomName
          )
        }
        extraButtons={
          <>
            {isMobile && onBack && (
              <ColumnHeaderButton
                icon={ListIcon}
                onClick={handleOpenNavigation}
              >
                <FormattedMessage id='tabs_bar.menu' defaultMessage='Menu' />
              </ColumnHeaderButton>
            )}
            <ColumnHeaderButton
              icon={GearIcon}
              onClick={handleOpenSettings}
              disabled={!room}
            >
              {intl.formatMessage(messages.settings)}
            </ColumnHeaderButton>
          </>
        }
      />
      {room && (
        <RoomSettingsModal
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          room={room}
        />
      )}
    </>
  );
};
