import {
  defaultScheduleDate,
  isValidSchedule,
  scheduleDate,
  scheduleFields,
} from './schedule_utils';

describe('schedule dates', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requires strictly more than five minutes and rejects invalid dates', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(isValidSchedule('2026-10-11T12:05:00Z', now)).toBe(false);
    expect(isValidSchedule('2026-10-11T12:05:01Z', now)).toBe(true);
    expect(isValidSchedule('invalid', now)).toBe(false);
    expect(isValidSchedule(null, now)).toBe(false);
  });

  it('defaults to a whole minute at least an hour ahead', () => {
    expect(
      defaultScheduleDate(Date.parse('2026-10-11T12:00:31Z')).toISOString(),
    ).toBe('2026-10-11T13:01:00.000Z');
  });

  it('converts midnight, noon and leap days without silently normalizing an invalid date', () => {
    vi.stubEnv('TZ', 'Asia/Seoul');
    const fields = {
      year: 2028,
      month: 2,
      day: 29,
      hour: 12,
      minute: 0,
      period: 'AM' as const,
    };
    expect(scheduleDate(fields)?.getHours()).toBe(0);
    expect(scheduleDate({ ...fields, period: 'PM' })?.getHours()).toBe(12);
    expect(scheduleDate({ ...fields, year: 2027 })).toBeNull();
    const date = scheduleDate(fields);
    if (!date) throw new Error('Leap day should be valid');
    expect(scheduleFields(date)).toEqual(fields);
  });

  it('rejects local times skipped by daylight saving time', () => {
    vi.stubEnv('TZ', 'America/New_York');
    expect(
      scheduleDate({
        year: 2027,
        month: 3,
        day: 14,
        hour: 2,
        minute: 30,
        period: 'AM',
      }),
    ).toBeNull();
  });

  it('uses the earlier occurrence of a repeated local time', () => {
    vi.stubEnv('TZ', 'America/New_York');
    expect(
      scheduleDate({
        year: 2026,
        month: 11,
        day: 1,
        hour: 1,
        minute: 30,
        period: 'AM',
      })?.toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
  });
});
