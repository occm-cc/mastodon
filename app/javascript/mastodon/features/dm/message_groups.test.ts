import type { DmMessage } from 'mastodon/reducers/dm';

import { continuesMessageGroup } from './message_groups';

const message = (overrides: Partial<DmMessage> = {}): DmMessage => ({
  id: '1',
  dm_chat_room_uuid: 'room',
  account_id: 'alice',
  content: '<p>Hello</p>',
  content_plain: 'Hello',
  in_reply_to_id: null,
  attachments: [],
  emojis: [],
  created_at: new Date(2026, 10, 3, 12, 0).toISOString(),
  language: 'ko',
  ...overrides,
});

describe('message bubble grouping', () => {
  it('groups messages from the same sender within three minutes', () => {
    expect(
      continuesMessageGroup(
        message(),
        message({ created_at: new Date(2026, 10, 3, 12, 3).toISOString() }),
      ),
    ).toBe(true);
  });

  it('starts a new group when the sender changes or three minutes pass', () => {
    expect(
      continuesMessageGroup(message(), message({ account_id: 'bob' })),
    ).toBe(false);
    expect(
      continuesMessageGroup(
        message(),
        message({ created_at: new Date(2026, 10, 3, 12, 3, 1).toISOString() }),
      ),
    ).toBe(false);
  });

  it('starts a new group across midnight even for consecutive messages', () => {
    expect(
      continuesMessageGroup(
        message({ created_at: new Date(2026, 10, 3, 23, 59).toISOString() }),
        message({ created_at: new Date(2026, 10, 4, 0, 0).toISOString() }),
      ),
    ).toBe(false);
  });

  it('keeps replies and failed messages separate', () => {
    expect(
      continuesMessageGroup(message(), message({ in_reply_to_id: '42' })),
    ).toBe(false);
    expect(continuesMessageGroup(message({ failed: true }), message())).toBe(
      false,
    );
    expect(continuesMessageGroup(message(), message({ failed: true }))).toBe(
      false,
    );
  });

  it('handles boundaries and out-of-order timestamps', () => {
    expect(continuesMessageGroup(undefined, message())).toBe(false);
    expect(continuesMessageGroup(message(), undefined)).toBe(false);
    expect(
      continuesMessageGroup(
        message(),
        message({ created_at: new Date(2026, 10, 3, 11, 59).toISOString() }),
      ),
    ).toBe(false);
  });
});
