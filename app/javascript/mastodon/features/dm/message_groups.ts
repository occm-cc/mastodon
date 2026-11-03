// Grouping adapted from 한참 (@_longwhile), longwhile-mastodon (AGPLv3).
import type { DmMessage } from 'mastodon/reducers/dm';

const GROUP_WINDOW_MS = 3 * 60 * 1000;

export function isSameMessageDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function continuesMessageGroup(
  previous: DmMessage | undefined,
  message: DmMessage | undefined,
): boolean {
  if (!previous || !message) return false;
  const elapsed =
    Date.parse(message.created_at) - Date.parse(previous.created_at);
  return (
    previous.account_id === message.account_id &&
    isSameMessageDay(previous.created_at, message.created_at) &&
    elapsed >= 0 &&
    elapsed <= GROUP_WINDOW_MS &&
    !message.in_reply_to_id &&
    !previous.failed &&
    !message.failed
  );
}
