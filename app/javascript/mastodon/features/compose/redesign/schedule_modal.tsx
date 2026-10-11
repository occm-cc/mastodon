import { useCallback, useEffect, useId, useState } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { CalendarCheckIcon, XIcon } from '@phosphor-icons/react';

import { openModal } from '@/mastodon/actions/modal';
import {
  scheduledMessages,
  setComposeSchedule,
} from '@/mastodon/actions/scheduled_statuses';
import { Button, IconButton } from '@/mastodon/components/button/redesign';
import { SelectField } from '@/mastodon/components/form_fields/select_field';
import { TextInputField } from '@/mastodon/components/form_fields/text_input_field';
import { Icon } from '@/mastodon/components/icon';
import {
  ModalShell,
  ModalTitle,
} from '@/mastodon/components/modal_shell/redesign';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

import { ScheduledTime } from './schedule';
import classes from './schedule.module.scss';
import type { ScheduleFields } from './schedule_utils';
import {
  defaultScheduleDate,
  isValidSchedule,
  scheduleDate,
  scheduleFields,
} from './schedule_utils';

const ScheduleModal: React.FC<{
  onClose: () => void;
  initialFields?: ScheduleFields;
}> = ({ onClose, initialFields }) => {
  const intl = useIntl();
  const titleId = useId();
  const dispatch = useAppDispatch();
  const scheduledAt = useAppSelector(
    (state) => state.compose.get('scheduled_at') as string | null,
  );
  const isScheduledEdit = useAppSelector(
    (state) => !!state.compose.get('scheduled_status_id'),
  );
  const [fields, setFields] = useState(
    () =>
      initialFields ??
      scheduleFields(
        scheduledAt ? new Date(scheduledAt) : defaultScheduleDate(),
      ),
  );
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const originalDate = scheduledAt ? new Date(scheduledAt) : null;
  const originalFields = originalDate ? scheduleFields(originalDate) : null;
  const date =
    originalDate &&
    originalFields &&
    Object.keys(fields).every(
      (key) =>
        fields[key as keyof ScheduleFields] ===
        originalFields[key as keyof ScheduleFields],
    )
      ? originalDate
      : scheduleDate(fields);
  const valid = isValidSchedule(date?.toISOString() ?? null, now);
  const timezone = intl
    .formatDateToParts(date ?? new Date(now), {
      hour: 'numeric',
      timeZoneName: 'long',
    })
    .find((part) => part.type === 'timeZoneName')?.value;
  const offset = intl
    .formatDateToParts(date ?? new Date(now), {
      hour: 'numeric',
      timeZoneName: 'shortOffset',
    })
    .find((part) => part.type === 'timeZoneName')?.value;
  const currentYear = new Date(now).getFullYear();
  const years = [
    ...new Set([
      ...Array.from({ length: 21 }, (_, i) => currentYear + i),
      fields.year,
    ]),
  ].sort();
  const days = new Date(fields.year, fields.month, 0).getDate();

  const handleFieldChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const key = event.target.name as keyof ScheduleFields;
      const value = event.target.value;
      setFields((previous) => {
        const next = {
          ...previous,
          [key]: key === 'period' ? value : Number(value),
        };
        if (key === 'year' || key === 'month')
          next.day = Math.min(
            next.day,
            new Date(next.year, next.month, 0).getDate(),
          );
        return next;
      });
    },
    [],
  );
  const handleCalendarChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const [year, month, day] = event.target.value.split('-').map(Number);
      if (year && month && day)
        setFields((previous) => ({ ...previous, year, month, day }));
    },
    [],
  );
  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!date || !isValidSchedule(date.toISOString())) return;
      dispatch(setComposeSchedule(date.toISOString()));
      onClose();
    },
    [date, dispatch, onClose],
  );
  const handleOpenList = useCallback(() => {
    dispatch(
      openModal({
        modalType: 'SCHEDULED_STATUSES',
        modalProps: {},
        previousModalProps: { initialFields: fields },
      }),
    );
  }, [dispatch, fields]);
  const handleRemoveTime = useCallback(() => {
    dispatch(setComposeSchedule(null));
    onClose();
  }, [dispatch, onClose]);

  return (
    <ModalShell
      as='form'
      maxWidth={600}
      className={classes.modal}
      aria-labelledby={titleId}
      onSubmit={handleSubmit}
    >
      <header className={classes.header}>
        <IconButton icon={XIcon} variant='ghost' autoFocus onClick={onClose}>
          <FormattedMessage id='lightbox.close' defaultMessage='Close' />
        </IconButton>
        <ModalTitle id={titleId} noFocus>
          <FormattedMessage
            id='scheduled_statuses.schedule'
            defaultMessage='Schedule'
          />
        </ModalTitle>
        <Button type='submit' variant='solid' color='accent' disabled={!valid}>
          <FormattedMessage
            id='scheduled_statuses.confirm'
            defaultMessage='Confirm'
          />
        </Button>
      </header>

      <div className={classes.body}>
        {date && (
          <p className={classes.time}>
            <Icon id='schedule' icon={CalendarCheckIcon} />
            <ScheduledTime value={date.toISOString()} />
          </p>
        )}

        <fieldset>
          <legend>
            <FormattedMessage
              id='scheduled_statuses.date'
              defaultMessage='Date'
            />
          </legend>
          <div className={classes.fields}>
            <SelectField
              label={
                <FormattedMessage
                  id='scheduled_statuses.month'
                  defaultMessage='Month'
                />
              }
              value={fields.month}
              name='month'
              onChange={handleFieldChange}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {intl.formatDate(new Date(2000, i, 1), { month: 'long' })}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={
                <FormattedMessage
                  id='scheduled_statuses.day'
                  defaultMessage='Day'
                />
              }
              value={fields.day}
              name='day'
              onChange={handleFieldChange}
            >
              {Array.from({ length: days }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={
                <FormattedMessage
                  id='scheduled_statuses.year'
                  defaultMessage='Year'
                />
              }
              value={fields.year}
              name='year'
              onChange={handleFieldChange}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </SelectField>
          </div>
          <TextInputField
            type='date'
            label={
              <FormattedMessage
                id='scheduled_statuses.calendar'
                defaultMessage='Choose from calendar'
              />
            }
            value={`${fields.year}-${String(fields.month).padStart(2, '0')}-${String(fields.day).padStart(2, '0')}`}
            onChange={handleCalendarChange}
          />
        </fieldset>

        <fieldset>
          <legend>
            <FormattedMessage
              id='scheduled_statuses.time'
              defaultMessage='Time'
            />
          </legend>
          <div className={classes.fields}>
            <SelectField
              label={
                <FormattedMessage
                  id='scheduled_statuses.hour'
                  defaultMessage='Hour'
                />
              }
              value={fields.hour}
              name='hour'
              onChange={handleFieldChange}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={
                <FormattedMessage
                  id='scheduled_statuses.minute'
                  defaultMessage='Minute'
                />
              }
              value={fields.minute}
              name='minute'
              onChange={handleFieldChange}
            >
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}
                </option>
              ))}
            </SelectField>
            <SelectField
              label='AM/PM'
              value={fields.period}
              name='period'
              onChange={handleFieldChange}
            >
              <option value='AM'>AM</option>
              <option value='PM'>PM</option>
            </SelectField>
          </div>
        </fieldset>

        <div>
          <p className={classes.label}>
            <FormattedMessage
              id='scheduled_statuses.timezone'
              defaultMessage='Time zone'
            />
          </p>
          <p>
            {timezone} · {offset}
          </p>
          <p className={classes.hint}>
            <FormattedMessage
              id='scheduled_statuses.timezone_hint'
              defaultMessage='Uses your device time zone. If a local time occurs twice, the earlier occurrence is used.'
            />
          </p>
        </div>
        {!valid && (
          <p role='alert' className={classes.error}>
            {intl.formatMessage(scheduledMessages.invalidTime)}
          </p>
        )}
      </div>

      <footer className={classes.actions}>
        <Button variant='ghost' color='accent' onClick={handleOpenList}>
          <FormattedMessage
            id='scheduled_statuses.open'
            defaultMessage='Scheduled posts'
          />
        </Button>
        {scheduledAt && !isScheduledEdit && (
          <Button variant='ghost' onClick={handleRemoveTime}>
            <FormattedMessage
              id='scheduled_statuses.remove_time'
              defaultMessage='Remove schedule'
            />
          </Button>
        )}
      </footer>
    </ModalShell>
  );
};

export default ScheduleModal;
