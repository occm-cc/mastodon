import type * as ApiModule from '../api';

import { apiGetScheduledStatuses } from './scheduled_statuses';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  default: () => ({ get: mocks.get }),
}));

it('follows pagination, deduplicates and orders the entire list by scheduled time', async () => {
  mocks.get.mockResolvedValueOnce({
    data: [{ id: '9', scheduled_at: '2026-12-01T12:00:00Z' }],
    headers: { link: '</api/v2/scheduled_statuses?max_id=9>; rel="next"' },
  });
  mocks.get.mockResolvedValueOnce({
    data: [
      { id: '8', scheduled_at: '2026-11-01T12:00:00Z' },
      { id: '9', scheduled_at: '2026-12-01T12:00:00Z' },
    ],
    headers: {},
  });
  const signal = new AbortController().signal;
  expect(
    (await apiGetScheduledStatuses(signal)).map((item) => item.id),
  ).toEqual(['8', '9']);
  expect(mocks.get).toHaveBeenLastCalledWith(
    '/api/v2/scheduled_statuses?max_id=9',
    { signal },
  );
});
