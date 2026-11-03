// Adapted from 한참 (@_longwhile), longwhile-mastodon (AGPLv3).
import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { ChatCircleIcon } from '@phosphor-icons/react';

import { NewChatRoomModal } from './new_chat_room_modal';

export const EmptyConversation: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleOpen = useCallback(() => {
    setIsModalOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <div className='dm-empty-conversation'>
      <div className='dm-empty-conversation__icon'>
        <ChatCircleIcon size={36} aria-hidden />
      </div>
      <h2>
        <FormattedMessage
          id='dm.empty.title'
          defaultMessage='Start a conversation'
        />
      </h2>
      <p>
        <FormattedMessage
          id='dm.empty.body'
          defaultMessage='Pick one from the list, or start a new one.'
        />
      </p>
      <button type='button' onClick={handleOpen}>
        <FormattedMessage
          id='dm.chat_room_list_header.new_message'
          defaultMessage='New message'
        />
      </button>
      <NewChatRoomModal isOpen={isModalOpen} onClose={handleClose} />
    </div>
  );
};
