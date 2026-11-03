import type React from 'react';
import { useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { MagnifyingGlassIcon, NotePencilIcon } from '@phosphor-icons/react';

import {
  ColumnHeader,
  ColumnHeaderButton,
} from '@/mastodon/components/column_header';

import { NewChatRoomModal } from './new_chat_room_modal';

const messages = defineMessages({
  title: { id: 'dm.chat_room_list_header.title', defaultMessage: 'Messages' },
  newMessage: {
    id: 'dm.chat_room_list_header.new_message',
    defaultMessage: 'New message',
  },
  all: { id: 'dm.filter.all', defaultMessage: 'All' },
  unread: { id: 'dm.filter.unread', defaultMessage: 'Unread' },
  filter: { id: 'dm.filter.label', defaultMessage: 'Filter conversations' },
  searchPlaceholder: {
    id: 'dm.chat_room_list_header.search_placeholder',
    defaultMessage: 'Search conversations...',
  },
});

export const ChatRoomListHeader: React.FC<{
  query: string;
  onQueryChange: (query: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
}> = ({ query, onQueryChange, unreadOnly, onUnreadOnlyChange }) => {
  const intl = useIntl();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleQueryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(event.target.value);
    },
    [onQueryChange],
  );
  const handleFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onUnreadOnlyChange(event.target.value === 'unread');
    },
    [onUnreadOnlyChange],
  );

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
          <>
            <select
              className='dm-chat-room-list-header__filter'
              aria-label={intl.formatMessage(messages.filter)}
              value={unreadOnly ? 'unread' : 'all'}
              onChange={handleFilterChange}
            >
              <option value='all'>{intl.formatMessage(messages.all)}</option>
              <option value='unread'>
                {intl.formatMessage(messages.unread)}
              </option>
            </select>
            <ColumnHeaderButton icon={NotePencilIcon} onClick={handleOpenModal}>
              {intl.formatMessage(messages.newMessage)}
            </ColumnHeaderButton>
          </>
        }
      />
      <div className='dm-chat-room-list-header__search'>
        <MagnifyingGlassIcon size={20} aria-hidden />
        <input
          type='search'
          className='dm-chat-room-list-header__search-input'
          placeholder={intl.formatMessage(messages.searchPlaceholder)}
          aria-label={intl.formatMessage(messages.searchPlaceholder)}
          value={query}
          onChange={handleQueryChange}
        />
      </div>
      <NewChatRoomModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};
