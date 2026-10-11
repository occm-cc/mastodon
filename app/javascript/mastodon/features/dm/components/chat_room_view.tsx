import type React from 'react';
import { useCallback, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import {
  acceptChatRoom,
  fetchMessages,
  markAsRead,
  rejectChatRoom,
  setActiveRoom,
} from 'mastodon/actions/dm';
import { me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { ChatRoomHeader } from './chat_room_header';
import { MessageCompose } from './message_compose';
import { MessageList } from './message_list';
import { MessageListSkeleton } from './skeleton_loading';

const messages = defineMessages({
  accept: { id: 'dm.invite.accept', defaultMessage: 'Accept' },
  reject: { id: 'dm.invite.reject', defaultMessage: 'Decline' },
  description: {
    id: 'dm.invite.description',
    defaultMessage: '{name} wants to start a conversation',
  },
  remoteUserNotice: {
    id: 'dm.remote_user_notice',
    defaultMessage:
      '다른 서버 사용자에게는 DM을 보낼 수 없습니다. 개인 멘션을 보내주세요',
  },
});

interface ChatRoomViewProps {
  roomId: string;
  onBack?: () => void;
}

export const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  roomId,
  onBack,
}) => {
  const dispatch = useAppDispatch();
  const history = useHistory();
  const intl = useIntl();
  // roomId is a UUID - store is keyed by UUID
  const room = useAppSelector((state) => state.dm.chatRooms.items[roomId]);
  const messagesState = useAppSelector((state) => state.dm.messages[roomId]);

  useEffect(() => {
    // roomId is UUID - backend accepts UUID via DmChatRoomFinder
    dispatch(fetchMessages(roomId));
    dispatch(markAsRead(roomId));
    dispatch(setActiveRoom(roomId));

    // Poll for new messages every 3 seconds as a reliability fallback
    const pollInterval = setInterval(() => {
      dispatch(fetchMessages(roomId));
    }, 3000);

    return () => {
      dispatch(setActiveRoom(null));
      clearInterval(pollInterval);
    };
  }, [dispatch, roomId]);

  const handleAccept = useCallback(() => {
    void dispatch(acceptChatRoom(roomId));
  }, [dispatch, roomId]);

  const handleReject = useCallback(() => {
    void dispatch(rejectChatRoom(roomId)).then(() => {
      history.push('/direct_message');
    });
  }, [dispatch, roomId, history]);

  if (!room) {
    return (
      <div className='dm-chat-room-view'>
        <ChatRoomHeader onBack={onBack} />
        <div className='dm-chat-room-view__loading'>Loading...</div>
      </div>
    );
  }

  const isGroupChat = room.room_type === 'group_chat';
  const isFirstLoad =
    messagesState?.isLoading && messagesState.items.length === 0;
  const ownerDisplayName = room.participants.find(
    (p) => p.id === room.owner_id,
  )?.display_name;
  const ownerName = ownerDisplayName?.trim() ? ownerDisplayName : 'Someone';
  const hasRemoteParticipant = room.participants.some(
    (p) => p.id !== me && p.acct.includes('@'),
  );

  return (
    <div className='dm-chat-room-view'>
      <ChatRoomHeader room={room} onBack={onBack} />
      {isFirstLoad ? (
        <MessageListSkeleton />
      ) : (
        <MessageList
          roomId={roomId}
          currentAccountId={me ?? undefined}
          isGroupChat={isGroupChat}
        />
      )}
      {!room.accepted ? (
        <div className='dm-invite-bar'>
          <p className='dm-invite-bar__description'>
            {intl.formatMessage(messages.description, { name: ownerName })}
          </p>
          <div className='dm-invite-bar__actions'>
            <button
              className='dm-invite-bar__reject-btn'
              type='button'
              onClick={handleReject}
            >
              {intl.formatMessage(messages.reject)}
            </button>
            <button
              className='dm-invite-bar__accept-btn'
              type='button'
              onClick={handleAccept}
            >
              {intl.formatMessage(messages.accept)}
            </button>
          </div>
        </div>
      ) : hasRemoteParticipant ? (
        <div className='dm-remote-notice'>
          <p className='dm-remote-notice__message'>
            {intl.formatMessage(messages.remoteUserNotice)}
          </p>
        </div>
      ) : (
        <MessageCompose roomId={roomId} />
      )}
    </div>
  );
};
