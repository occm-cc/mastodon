import { useCallback } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { CalendarCheckIcon } from '@phosphor-icons/react';

import { openModal } from '@/mastodon/actions/modal';
import { Button, IconButton } from '@/mastodon/components/button/redesign';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

import classes from './schedule.module.scss';

export const ComposeScheduleButton = () => {
  const dispatch = useAppDispatch();
  const isPublishedEdit = useAppSelector((state) => !!state.compose.get('id'));
  const scheduledAt = useAppSelector(
    (state) => state.compose.get('scheduled_at') as string | null,
  );
  const isSubmitting = useAppSelector(
    (state) => !!state.compose.get('is_submitting'),
  );
  const handleOpen = useCallback(() => {
    dispatch(openModal({ modalType: 'COMPOSE_SCHEDULE', modalProps: {} }));
  }, [dispatch]);

  if (isPublishedEdit) return null;

  return (
    <IconButton
      size='sm'
      icon={CalendarCheckIcon}
      aria-pressed={!!scheduledAt}
      disabled={isSubmitting}
      onClick={handleOpen}
    >
      <FormattedMessage
        id='scheduled_statuses.schedule'
        defaultMessage='Schedule'
      />
    </IconButton>
  );
};

export const ScheduledTime: React.FC<{ value: string }> = ({ value }) => {
  const intl = useIntl();
  return (
    <FormattedMessage
      id='scheduled_statuses.send_at'
      defaultMessage='Will send on {date}'
      values={{
        date: intl.formatDate(value, { dateStyle: 'full', timeStyle: 'short' }),
      }}
    />
  );
};

export const ComposeScheduleSummary = () => {
  const dispatch = useAppDispatch();
  const handleOpen = useCallback(() => {
    dispatch(openModal({ modalType: 'COMPOSE_SCHEDULE', modalProps: {} }));
  }, [dispatch]);
  const scheduledAt = useAppSelector(
    (state) => state.compose.get('scheduled_at') as string | null,
  );
  if (!scheduledAt) return null;

  return (
    <Button
      variant='ghost'
      size='sm'
      leadingIcon={CalendarCheckIcon}
      className={classes.summary}
      onClick={handleOpen}
    >
      <ScheduledTime value={scheduledAt} />
    </Button>
  );
};
