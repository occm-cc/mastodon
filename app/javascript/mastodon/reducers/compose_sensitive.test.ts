import { fromJS } from 'immutable';

import {
  changeComposeSensitivity,
  changeComposeSpoilerness,
} from '@/mastodon/actions/compose';

import { composeReducer } from './compose';

const initialState = composeReducer(undefined, { type: '@@INIT' });

describe('compose sensitive media', () => {
  it('blurs attached media by default when a content warning is added', () => {
    const state = composeReducer(
      initialState.set('media_attachments', fromJS([{ id: '1' }])),
      changeComposeSpoilerness(),
    );

    expect(state.get('spoiler')).toBe(true);
    expect(state.get('sensitive')).toBe(true);
  });

  it('lets media be unblurred while a content warning is set', () => {
    let state = composeReducer(
      initialState.set('media_attachments', fromJS([{ id: '1' }])),
      changeComposeSpoilerness(),
    );
    state = composeReducer(state, changeComposeSensitivity());

    expect(state.get('spoiler')).toBe(true);
    expect(state.get('sensitive')).toBe(false);
  });

  it('does not mark posts without media as sensitive', () => {
    const state = composeReducer(initialState, changeComposeSpoilerness());

    expect(state.get('spoiler')).toBe(true);
    expect(state.get('sensitive')).toBe(false);
  });
});
