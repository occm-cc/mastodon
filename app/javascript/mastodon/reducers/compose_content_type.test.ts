import { fromJS } from 'immutable';

import { COMPOSE_RESET, COMPOSE_SET_STATUS } from '@/mastodon/actions/compose';
import { setComposeContentType } from '@/mastodon/actions/compose_typed';

import { composeReducer } from './compose';

const initialState = composeReducer(undefined, { type: '@@INIT' });

const statusFixture = fromJS({
  id: '1',
  in_reply_to_id: null,
  visibility: 'public',
  media_attachments: [],
  sensitive: false,
  language: 'en',
  quote: null,
  quote_approval: null,
  poll: null,
});

describe('compose content type', () => {
  it('defaults to plain text', () => {
    expect(initialState.get('content_type')).toBe('text/plain');
  });

  it('changes the content type', () => {
    const state = composeReducer(
      initialState,
      setComposeContentType('text/markdown'),
    );

    expect(state.get('content_type')).toBe('text/markdown');
  });

  it('goes back to the default content type after reset', () => {
    let state = initialState.set('default_content_type', 'text/html');
    state = composeReducer(state, setComposeContentType('text/markdown'));
    state = composeReducer(state, { type: COMPOSE_RESET });

    expect(state.get('content_type')).toBe('text/html');
  });

  it('uses the content type of the post being edited', () => {
    const state = composeReducer(initialState, {
      type: COMPOSE_SET_STATUS,
      status: statusFixture,
      text: '**bold**',
      spoiler_text: '',
      content_type: 'text/markdown',
    });

    expect(state.get('content_type')).toBe('text/markdown');
  });

  it('treats edited posts without a content type as plain text', () => {
    const state = composeReducer(
      initialState.set('content_type', 'text/html'),
      {
        type: COMPOSE_SET_STATUS,
        status: statusFixture,
        text: 'hello',
        spoiler_text: '',
      },
    );

    expect(state.get('content_type')).toBe('text/plain');
  });
});
