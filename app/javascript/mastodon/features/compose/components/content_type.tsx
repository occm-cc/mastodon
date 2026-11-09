import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { CodeIcon, MarkdownLogoIcon, TextAaIcon } from '@phosphor-icons/react';

import { setComposeContentType } from '@/mastodon/actions/compose_typed';
import type { ApiStatusContentType } from '@/mastodon/api_types/statuses';
import { IconButton } from '@/mastodon/components/button';
import {
  Menu,
  MenuItemGroup,
  MenuItemRadio,
  MenuList,
  MenuTrigger,
} from '@/mastodon/components/menu';
import type { RootState } from '@/mastodon/store';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

const CONTENT_TYPE_ICONS = {
  'text/plain': TextAaIcon,
  'text/markdown': MarkdownLogoIcon,
  'text/html': CodeIcon,
} as const;

const isContentType = (value: string): value is ApiStatusContentType =>
  value in CONTENT_TYPE_ICONS;

export const selectComposeContentType = (
  state: RootState,
): ApiStatusContentType => {
  const value: unknown = state.compose.get('content_type');
  return typeof value === 'string' && isContentType(value)
    ? value
    : 'text/plain';
};

/**
 * Picks how the post text is formatted. Markdown and HTML are rendered and
 * sanitized on the server, the same way as formatted posts from other servers.
 */
export const ComposeContentTypeButton: React.FC = () => {
  const contentType = useAppSelector(selectComposeContentType);
  const dispatch = useAppDispatch();

  const handleChange = useCallback(
    ({ value }: { value: string }) => {
      if (isContentType(value)) {
        dispatch(setComposeContentType(value));
      }
    },
    [dispatch],
  );

  return (
    <Menu>
      <MenuTrigger
        as={IconButton}
        icon={CONTENT_TYPE_ICONS[contentType]}
        size='sm'
        data-content-type={contentType}
      >
        <FormattedMessage
          id='compose.content_type.change'
          defaultMessage='Change post format'
        />
      </MenuTrigger>

      <MenuList maxWidth={310} placement='top-start' strategy='fixed'>
        <MenuItemGroup
          label={
            <FormattedMessage
              id='compose.content_type.label'
              defaultMessage='Post format'
            />
          }
        >
          <MenuItemRadio
            name='content_type'
            value='text/plain'
            checked={contentType === 'text/plain'}
            onChange={handleChange}
            description={
              <FormattedMessage
                id='compose.content_type.plain_hint'
                defaultMessage='Write with no formatting'
              />
            }
          >
            <FormattedMessage
              id='compose.content_type.plain'
              defaultMessage='Plain text'
            />
          </MenuItemRadio>

          <MenuItemRadio
            name='content_type'
            value='text/markdown'
            checked={contentType === 'text/markdown'}
            onChange={handleChange}
            description={
              <FormattedMessage
                id='compose.content_type.markdown_hint'
                defaultMessage='Format your post using Markdown'
              />
            }
          >
            <FormattedMessage
              id='compose.content_type.markdown'
              defaultMessage='Markdown'
            />
          </MenuItemRadio>

          <MenuItemRadio
            name='content_type'
            value='text/html'
            checked={contentType === 'text/html'}
            onChange={handleChange}
            description={
              <FormattedMessage
                id='compose.content_type.html_hint'
                defaultMessage='Format your post using HTML. Unsafe tags are removed'
              />
            }
          >
            <FormattedMessage
              id='compose.content_type.html'
              defaultMessage='HTML'
            />
          </MenuItemRadio>
        </MenuItemGroup>
      </MenuList>
    </Menu>
  );
};
