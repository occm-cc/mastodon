import type React from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { me } from 'mastodon/initial_state';
import type { DmChatRoom } from 'mastodon/reducers/dm';

import { RoomAvatar } from './room_avatar';

const messages = defineMessages({
  photo: { id: 'dm.preview.photo', defaultMessage: 'Photo' },
  empty: { id: 'dm.preview.empty', defaultMessage: 'No messages yet' },
  fromMe: { id: 'dm.preview.from_me', defaultMessage: 'You: {body}' },
  pending: { id: 'dm.invite.pending', defaultMessage: 'Conversation request' },
});

interface ChatRoomItemProps {
  room: DmChatRoom;
  active: boolean;
}

const firstNonBlank = (
  ...values: (string | null | undefined)[]
): string | undefined =>
  values.find((value): value is string => Boolean(value?.trim()));

export const ChatRoomItem: React.FC<ChatRoomItemProps> = ({ room, active }) => {
  const intl = useIntl();
  const otherParticipant = room.participants.find((p) => p.id !== me);
  const isGroupChat = room.room_type === 'group_chat';
  const roomName = !isGroupChat
    ? (firstNonBlank(
        otherParticipant?.display_name,
        otherParticipant?.username,
        room.title,
      ) ?? `Chat ${room.id}`)
    : (firstNonBlank(room.title) ??
      room.participants
        .filter((p) => p.id !== me)
        .map((p) => firstNonBlank(p.display_name, p.username))
        .join(', '));
  const preview =
    firstNonBlank(room.last_message?.content_plain) ??
    (room.last_message?.attachments.length
      ? intl.formatMessage(messages.photo)
      : intl.formatMessage(messages.empty));
  const lastMessagePreview =
    room.last_message?.account.id === me
      ? intl.formatMessage(messages.fromMe, { body: preview })
      : preview;
  const lastMessageTime = room.last_message_at;

  return (
    <Link
      to={`/direct_message/${room.uuid}`}
      aria-current={active ? 'page' : undefined}
      className={`dm-chat-room-item ${active ? 'dm-chat-room-item--active' : ''} ${room.unread ? 'dm-chat-room-item--unread' : ''} ${!room.accepted ? 'dm-chat-room-item--pending' : ''} ${isGroupChat ? 'dm-chat-room-item--group' : ''}`}
    >
      <div className='dm-chat-room-item__avatar'>
        <RoomAvatar
          participants={room.participants}
          isGroup={isGroupChat}
          size={48}
        />
      </div>
      <div className='dm-chat-room-item__content'>
        <div className='dm-chat-room-item__top'>
          <span className='dm-chat-room-item__name'>{roomName}</span>
          {!room.accepted && (
            <span className='dm-chat-room-item__pending-badge'>
              {intl.formatMessage(messages.pending)}
            </span>
          )}
          {lastMessageTime && (
            <span className='dm-chat-room-item__time'>
              <RelativeTimestamp timestamp={lastMessageTime} />
            </span>
          )}
        </div>
        <div className='dm-chat-room-item__bottom'>
          <span className='dm-chat-room-item__preview'>
            {lastMessagePreview}
          </span>
          {room.unread && <span className='dm-chat-room-item__unread-dot' />}
        </div>
      </div>
    </Link>
  );
};
