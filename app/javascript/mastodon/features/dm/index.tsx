import { useCallback, useEffect } from 'react';

import { defineMessage, useIntl } from 'react-intl';

import { useHistory, useParams } from 'react-router-dom';

import { Column } from '@/mastodon/components/column';
import { fetchChatRooms } from 'mastodon/actions/dm';
import { useAppDispatch } from 'mastodon/store';

import { ChatRoomList } from './components/chat_room_list';
import { ChatRoomView } from './components/chat_room_view';

export const DirectMessages: React.FC = () => {
  const intl = useIntl();
  const { roomId: roomParam } = useParams<{ roomId?: string }>();
  const dispatch = useAppDispatch();
  const history = useHistory();

  // roomParam is a UUID from the URL - pass directly to components
  // The backend DmChatRoomFinder accepts UUIDs natively
  const roomId = roomParam;

  useEffect(() => {
    dispatch(fetchChatRooms());
  }, [dispatch]);

  const handleBack = useCallback(() => {
    history.push('/direct_message');
  }, [history]);

  return (
    <Column
      className='dm-page'
      label={intl.formatMessage(
        defineMessage({
          id: 'dm.chat_room_list_header.title',
          defaultMessage: 'Messages',
        }),
      )}
    >
      {roomId ? (
        <ChatRoomView roomId={roomId} onBack={handleBack} />
      ) : (
        <ChatRoomList />
      )}
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default DirectMessages;
