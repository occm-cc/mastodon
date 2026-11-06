import { Map as ImmutableMap, List as ImmutableList, fromJS } from 'immutable';

import {
  ANNOUNCEMENTS_FETCH_REQUEST,
  ANNOUNCEMENTS_FETCH_SUCCESS,
  ANNOUNCEMENTS_FETCH_FAIL,
  ANNOUNCEMENTS_UPDATE,
  ANNOUNCEMENTS_REACTION_UPDATE,
  ANNOUNCEMENTS_REACTION_ADD_REQUEST,
  ANNOUNCEMENTS_REACTION_ADD_FAIL,
  ANNOUNCEMENTS_REACTION_REMOVE_REQUEST,
  ANNOUNCEMENTS_REACTION_REMOVE_FAIL,
  ANNOUNCEMENTS_TOGGLE_SHOW,
  ANNOUNCEMENTS_DELETE,
  ANNOUNCEMENTS_DISMISS_SUCCESS,
  ANNOUNCEMENTS_SHOW,
  ANNOUNCEMENTS_HIDE,
} from '../actions/announcements';
import { unfollowAccountSuccess } from '../actions/accounts_typed';

const initialState = ImmutableMap({
  items: ImmutableList(),
  isLoading: false,
  // `show` is for the combined list, the others for the split home view
  show: false,
  showServer: false,
  showAccount: false,
});

const SHOW_KEYS = {
  all: 'show',
  server: 'showServer',
  account: 'showAccount',
};

const showKey = scope => SHOW_KEYS[scope] ?? SHOW_KEYS.all;

const updateReaction = (state, id, name, updater) => state.update('items', list => list.map(announcement => {
  if (announcement.get('id') === id) {
    return announcement.update('reactions', reactions => {
      const idx = reactions.findIndex(reaction => reaction.get('name') === name);

      if (idx > -1) {
        return reactions.update(idx, reaction => updater(reaction));
      }

      return reactions.push(updater(fromJS({ name, count: 0 })));
    });
  }

  return announcement;
}));

const updateReactionCount = (state, reaction) => updateReaction(state, reaction.announcement_id, reaction.name, x => x.set('count', reaction.count));

const addReaction = (state, id, name) => updateReaction(state, id, name, x => x.set('me', true).update('count', y => y + 1));

const removeReaction = (state, id, name) => updateReaction(state, id, name, x => x.set('me', false).update('count', y => y - 1));

const sortAnnouncements = list => list.sortBy(x => x.get('starts_at') || x.get('published_at'));

const updateAnnouncement = (state, announcement) => {
  const idx = state.get('items').findIndex(x => x.get('id') === announcement.get('id'));

  if (idx > -1) {
    // Deep merge is used because announcements from the streaming API do not contain
    // personalized data about which reactions have been selected by the given user,
    // and that is information we want to preserve
    return state.update('items', list => sortAnnouncements(list.update(idx, x => x.mergeDeep(announcement))));
  }

  return state.update('items', list => sortAnnouncements(list.unshift(announcement)));
};

export default function announcementsReducer(state = initialState, action) {
  switch(action.type) {
  case ANNOUNCEMENTS_TOGGLE_SHOW:
    return state.update(showKey(action.scope), show => !show);
  case ANNOUNCEMENTS_SHOW:
    return state.set(showKey(action.scope), true);
  case ANNOUNCEMENTS_HIDE:
    return state.set(showKey(action.scope), false);
  case ANNOUNCEMENTS_FETCH_REQUEST:
    return state.set('isLoading', true);
  case ANNOUNCEMENTS_FETCH_SUCCESS:
    return state.withMutations(map => {
      const items = fromJS(action.announcements);

      map.set('items', items);
      map.set('isLoading', false);
    });
  case ANNOUNCEMENTS_FETCH_FAIL:
    return state.set('isLoading', false);
  case ANNOUNCEMENTS_UPDATE:
    return updateAnnouncement(state, fromJS(action.announcement));
  case ANNOUNCEMENTS_REACTION_UPDATE:
    return updateReactionCount(state, action.reaction);
  case ANNOUNCEMENTS_REACTION_ADD_REQUEST:
  case ANNOUNCEMENTS_REACTION_REMOVE_FAIL:
    return addReaction(state, action.id, action.name);
  case ANNOUNCEMENTS_REACTION_REMOVE_REQUEST:
  case ANNOUNCEMENTS_REACTION_ADD_FAIL:
    return removeReaction(state, action.id, action.name);
  case ANNOUNCEMENTS_DISMISS_SUCCESS:
    return updateAnnouncement(state, fromJS({ 'id': action.id, 'read': true }));
  case unfollowAccountSuccess.type:
    // Announcements of an unfollowed account are no longer visible
    return state.update('items', list => list.filterNot(x => x.get('account_id') === action.payload.relationship.id));
  case ANNOUNCEMENTS_DELETE:
    return state.update('items', list => {
      const idx = list.findIndex(x => x.get('id') === action.id);

      if (idx > -1) {
        return list.delete(idx);
      }

      return list;
    });
  default:
    return state;
  }
}
