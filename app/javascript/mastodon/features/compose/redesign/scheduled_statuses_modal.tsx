import { useCallback, useEffect, useId, useState } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import classNames from 'classnames';

import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { isAxiosError } from 'axios';

import { editScheduledStatus } from '@/mastodon/actions/scheduled_statuses';
import {
  apiDeleteScheduledStatus,
  apiGetScheduledStatuses,
} from '@/mastodon/api/scheduled_statuses';
import type { ApiScheduledStatusJSON } from '@/mastodon/api_types/scheduled_statuses';
import { Button, IconButton } from '@/mastodon/components/button/redesign';
import { Callout } from '@/mastodon/components/callout/redesign';
import { CircularProgress } from '@/mastodon/components/circular_progress';
import { Checkbox } from '@/mastodon/components/form_fields/checkbox_field';
import { Icon } from '@/mastodon/components/icon';
import {
  ModalShell,
  ModalTitle,
} from '@/mastodon/components/modal_shell/redesign';
import { ConfirmationModal } from '@/mastodon/features/ui/components/confirmation_modals/confirmation_modal';
import { DiscardDraftConfirmationModal } from '@/mastodon/features/ui/components/confirmation_modals/discard_draft_confirmation';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

import { ScheduledTime } from './schedule';
import classes from './schedule.module.scss';

interface ModalProps {
  onClose: () => void;
}

// Remount on account changes so old reservations cannot appear under a new identity.
const ScheduledStatusesModal: React.FC<ModalProps> = (props) => {
  const accountId = useAppSelector(
    (state) => state.meta.get('me') as string | null,
  );
  return <ScheduledStatusesList key={accountId} {...props} />;
};

const ScheduledStatusesList: React.FC<ModalProps> = ({ onClose }) => {
  const intl = useIntl();
  const titleId = useId();
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<ApiScheduledStatusJSON[] | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void apiGetScheduledStatuses(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setItems(result);
      },
      () => {
        if (!controller.signal.aborted) setError(true);
      },
    );
    return () => {
      controller.abort();
    };
  }, [refresh]);

  const toggle = useCallback((id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const handleRefresh = useCallback(() => {
    setItems(null);
    setError(false);
    setSelected(new Set());
    setRefresh((previous) => previous + 1);
  }, []);
  const handleEditing = useCallback(() => {
    setEditing((previous) => !previous);
    setSelected(new Set());
  }, []);
  const handleChoose = useCallback(
    (id: string) => {
      if (editing) {
        toggle(id);
        return;
      }
      setBusy(true);
      void dispatch(editScheduledStatus({ id }))
        .then((result) => {
          if (result === 'missing') handleRefresh();
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [dispatch, editing, toggle, handleRefresh],
  );
  const handleConfirm = useCallback(() => {
    setConfirming(true);
  }, []);
  const handleCancelConfirm = useCallback(() => {
    setConfirming(false);
  }, []);

  const cancelSelected = useCallback(async () => {
    setBusy(true);
    const ids = [...selected];
    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        try {
          await apiDeleteScheduledStatus(id);
        } catch (failure) {
          if (!isAxiosError(failure) || failure.response?.status !== 404)
            throw failure;
        }
        return id;
      }),
    );
    const cancelled = new Set(
      outcomes.flatMap((outcome) =>
        outcome.status === 'fulfilled' ? [outcome.value] : [],
      ),
    );
    setItems(
      (previous) => previous?.filter((item) => !cancelled.has(item.id)) ?? null,
    );
    setSelected(new Set(ids.filter((id) => !cancelled.has(id))));
    setError(cancelled.size !== ids.length);
    setBusy(false);
  }, [selected]);

  if (confirming)
    return (
      <ConfirmationModal
        title={intl.formatMessage({
          id: 'scheduled_statuses.cancel_title',
          defaultMessage: 'Cancel scheduled posts?',
        })}
        message={intl.formatMessage(
          {
            id: 'scheduled_statuses.cancel_body',
            defaultMessage:
              '{count, plural, one {This scheduled post will not be sent.} other {These # scheduled posts will not be sent.}}',
          },
          { count: selected.size },
        )}
        confirm={intl.formatMessage({
          id: 'scheduled_statuses.cancel',
          defaultMessage: 'Cancel schedule',
        })}
        onClose={handleCancelConfirm}
        onConfirm={cancelSelected}
      />
    );

  return (
    <ModalShell
      maxWidth={600}
      className={classNames(classes.modal, classes.listModal)}
      aria-labelledby={titleId}
    >
      <header className={classes.header}>
        <IconButton
          icon={ArrowLeftIcon}
          variant='ghost'
          autoFocus
          onClick={onClose}
        >
          <FormattedMessage
            id='column_back_button.label'
            defaultMessage='Back'
          />
        </IconButton>
        <ModalTitle id={titleId} noFocus>
          <FormattedMessage
            id='scheduled_statuses.open'
            defaultMessage='Scheduled posts'
          />
        </ModalTitle>
        <Button
          variant='ghost'
          disabled={busy || !items?.length}
          onClick={handleEditing}
        >
          {editing ? (
            <FormattedMessage
              id='scheduled_statuses.done'
              defaultMessage='Done'
            />
          ) : (
            <FormattedMessage
              id='scheduled_statuses.edit'
              defaultMessage='Edit'
            />
          )}
        </Button>
      </header>
      <div className={classes.list} aria-busy={items === null && !error}>
        {error && (
          <Callout
            className={classes.empty}
            icon={WarningCircleIcon}
            actionText={
              <FormattedMessage
                id='scheduled_statuses.retry'
                defaultMessage='Retry'
              />
            }
            actionClick={handleRefresh}
          >
            <FormattedMessage
              id='scheduled_statuses.error'
              defaultMessage='Some scheduled posts could not be loaded or cancelled. Please try again.'
            />
          </Callout>
        )}
        {items === null && !error && (
          <div className={classes.empty}>
            <CircularProgress
              size={24}
              strokeWidth={3}
              aria-label={intl.formatMessage({
                id: 'loading_indicator.label',
                defaultMessage: 'Loading…',
              })}
            />
          </div>
        )}
        {items?.length === 0 && (
          <p className={classes.empty}>
            <FormattedMessage
              id='scheduled_statuses.empty'
              defaultMessage='You have no scheduled posts.'
            />
          </p>
        )}
        {items?.map((item) => (
          <ScheduledItem
            key={item.id}
            item={item}
            editing={editing}
            busy={busy}
            checked={selected.has(item.id)}
            onChoose={handleChoose}
            onToggle={toggle}
          />
        ))}
      </div>
      <footer className={classes.actions}>
        {editing ? (
          <Button
            variant='solid'
            color='destructive'
            disabled={!selected.size}
            loading={busy}
            onClick={handleConfirm}
          >
            <FormattedMessage
              id='scheduled_statuses.cancel'
              defaultMessage='Cancel schedule'
            />
          </Button>
        ) : (
          <Button variant='ghost' disabled={busy} onClick={handleRefresh}>
            <FormattedMessage
              id='scheduled_statuses.refresh'
              defaultMessage='Refresh'
            />
          </Button>
        )}
      </footer>
    </ModalShell>
  );
};

const ScheduledItem: React.FC<{
  item: ApiScheduledStatusJSON;
  editing: boolean;
  busy: boolean;
  checked: boolean;
  onChoose: (id: string) => void;
  onToggle: (id: string) => void;
}> = ({ item, editing, busy, checked, onChoose, onToggle }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onChoose(item.id);
  }, [item.id, onChoose]);
  const handleToggle = useCallback(() => {
    onToggle(item.id);
  }, [item.id, onToggle]);
  return (
    <div className={classes.item}>
      {editing && (
        <Checkbox
          value={item.id}
          checked={checked}
          disabled={busy}
          onChange={handleToggle}
          aria-label={intl.formatMessage(
            {
              id: 'scheduled_statuses.select',
              defaultMessage: 'Select scheduled post: {text}',
            },
            { text: item.params.text },
          )}
        />
      )}
      <button type='button' disabled={busy} onClick={handleClick}>
        <span className={classes.time}>
          <Icon id='schedule' icon={CalendarCheckIcon} />
          <ScheduledTime value={item.scheduled_at} />
        </span>
        {item.params.spoiler_text && (
          <span className={classes.preview}>{item.params.spoiler_text}</span>
        )}
        <span className={classes.preview}>{item.params.text}</span>
        {!!item.media_attachments.length && (
          <span className={classes.metadata}>
            <FormattedMessage
              id='scheduled_statuses.attachments'
              defaultMessage='{count, plural, one {# attachment} other {# attachments}}'
              values={{ count: item.media_attachments.length }}
            />
          </span>
        )}
        {item.params.poll && (
          <span className={classes.metadata}>
            <FormattedMessage
              id='scheduled_statuses.poll'
              defaultMessage='Poll'
            />
          </span>
        )}
      </button>
    </div>
  );
};

export const ConfirmEditScheduledStatusModal: React.FC<{
  id: string;
  onClose: () => void;
}> = ({ id, onClose }) => {
  const dispatch = useAppDispatch();
  const handleConfirm = useCallback(() => {
    void dispatch(editScheduledStatus({ id, force: true }));
  }, [dispatch, id]);
  return (
    <DiscardDraftConfirmationModal
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
};

export default ScheduledStatusesModal;
