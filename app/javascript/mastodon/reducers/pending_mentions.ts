import { createReducer } from '@reduxjs/toolkit';

import type { ApiNotificationJSON } from 'mastodon/api_types/notifications';

import {
  fetchPendingMentions,
  fetchMorePendingMentions,
  dismissPendingMention,
} from '../actions/pending_mentions';

interface PendingMentionsState {
  items: ApiNotificationJSON[];
  isLoading: boolean;
  isFetched: boolean;
  hasMore: boolean;
  next: string | null;
}

const initialState: PendingMentionsState = {
  items: [],
  isLoading: false,
  isFetched: false,
  hasMore: false,
  next: null,
};

export const pendingMentionsReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchPendingMentions.pending, (state) => {
      state.isLoading = true;
    })
    .addCase(fetchPendingMentions.fulfilled, (state, action) => {
      state.items = action.payload.notifications;
      state.isLoading = false;
      state.isFetched = true;
      state.next = action.payload.next;
      state.hasMore = !!action.payload.next;
    })
    .addCase(fetchPendingMentions.rejected, (state) => {
      state.isLoading = false;
    })
    .addCase(fetchMorePendingMentions.pending, (state) => {
      state.isLoading = true;
    })
    .addCase(fetchMorePendingMentions.fulfilled, (state, action) => {
      state.items = [...state.items, ...action.payload.notifications];
      state.isLoading = false;
      state.next = action.payload.next;
      state.hasMore = !!action.payload.next;
    })
    .addCase(fetchMorePendingMentions.rejected, (state) => {
      state.isLoading = false;
    })
    .addCase(dismissPendingMention.fulfilled, (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload.id);
    });
});
