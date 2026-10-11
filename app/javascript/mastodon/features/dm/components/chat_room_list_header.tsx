import type React from 'react';
import { useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { NotePencilIcon } from '@phosphor-icons/react';

import {
  ColumnHeader,
  ColumnHeaderButton,
} from '@/mastodon/components/column_header';
import { TextInput } from '@/mastodon/components/form_fields';

import { NewChatRoomModal } from './new_chat_room_modal';

const messages = defineMessages({
  title: { id: 'dm.chat_room_list_header.title', defaultMessage: 'Messages' },
  newMessage: {
    id: 'dm.chat_room_list_header.new_message',
    defaultMessage: 'New message',
  },
  searchPlaceholder: {
    id: 'dm.chat_room_list_header.search_placeholder',
    defaultMessage: 'Search conversations...',
  },
});

export const ChatRoomListHeader: React.FC = () => {
  const intl = useIntl();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        extraButtons={
          <ColumnHeaderButton icon={NotePencilIcon} onClick={handleOpenModal}>
            {intl.formatMessage(messages.newMessage)}
          </ColumnHeaderButton>
        }
      />
      <div className='dm-chat-room-list-header__search'>
        <TextInput
          type='search'
          className='dm-chat-room-list-header__search-input'
          placeholder={intl.formatMessage(messages.searchPlaceholder)}
          aria-label={intl.formatMessage(messages.searchPlaceholder)}
          readOnly
        />
      </div>
      <NewChatRoomModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};
