import { defineMessages } from 'react-intl';

import { createAction } from '@reduxjs/toolkit';

import { isAxiosError } from 'axios';

import { apiGetScheduledStatus } from '@/mastodon/api/scheduled_statuses';
import type { ApiScheduledStatusJSON } from '@/mastodon/api_types/scheduled_statuses';
import {
  selectComposerIsChanged,
  requestComposerFocus,
} from '@/mastodon/reducers/slices/composer';
import { createAppThunk } from '@/mastodon/store/typed_functions';

import { showAlert, showAlertForError } from './alerts';
import { clearComposeSuggestions } from './compose';
import { closeModal, openModal } from './modal';
import { fetchStatus } from './statuses';

export const setComposeSchedule = createAction<string | null>(
  'compose/setSchedule',
);
export const setComposeToScheduledStatus = createAction<ApiScheduledStatusJSON>(
  'compose/editScheduled',
);

export const scheduledMessages = defineMessages({
  scheduled: {
    id: 'scheduled_statuses.created',
    defaultMessage: 'Post scheduled.',
  },
  saved: {
    id: 'scheduled_statuses.saved',
    defaultMessage: 'Scheduled post updated.',
  },
  open: { id: 'scheduled_statuses.open', defaultMessage: 'Scheduled posts' },
  invalidTime: {
    id: 'scheduled_statuses.invalid_time',
    defaultMessage: 'Choose a time more than 5 minutes from now.',
  },
  unavailable: {
    id: 'scheduled_statuses.unavailable',
    defaultMessage:
      'This scheduled post has already been sent or cancelled. Your unsaved changes have been kept.',
  },
});

export const editScheduledStatus = createAppThunk(
  async (
    { id, force = false }: { id: string; force?: boolean },
    { dispatch, getState },
  ) => {
    if (
      getState().compose.get('is_submitting') ||
      getState().compose.get('is_uploading')
    )
      return null;
    if (!force && selectComposerIsChanged(getState())) {
      dispatch(
        openModal({
          modalType: 'CONFIRM_EDIT_SCHEDULED_STATUS',
          modalProps: { id },
        }),
      );
      return null;
    }

    const accountId = getState().meta.get('me') as string | null;
    try {
      const item = await apiGetScheduledStatus(id);
      if (getState().meta.get('me') !== accountId) return null;
      dispatch(clearComposeSuggestions());
      dispatch(setComposeToScheduledStatus(item));
      dispatch(
        closeModal({ modalType: 'SCHEDULED_STATUSES', ignoreFocus: true }),
      );
      dispatch(
        closeModal({ modalType: 'COMPOSE_SCHEDULE', ignoreFocus: true }),
      );
      dispatch(requestComposerFocus());
      if (item.params.in_reply_to_id)
        dispatch(fetchStatus(item.params.in_reply_to_id));
      if (item.params.quoted_status_id)
        dispatch(fetchStatus(item.params.quoted_status_id));
    } catch (error) {
      if (getState().meta.get('me') !== accountId) return null;
      if (isAxiosError(error) && error.response?.status === 404) {
        dispatch(showAlert({ message: scheduledMessages.unavailable }));
        return 'missing';
      }
      dispatch(showAlertForError(error));
    }
    return null;
  },
);
