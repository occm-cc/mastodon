export const MINIMUM_SCHEDULE_OFFSET = 5 * 60 * 1000;

export interface ScheduleFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

export function isValidSchedule(value: string | null, now = Date.now()) {
  return !!value && Date.parse(value) > now + MINIMUM_SCHEDULE_OFFSET;
}

export function defaultScheduleDate(now = Date.now()) {
  return new Date(Math.ceil((now + 60 * 60 * 1000) / 60000) * 60000);
}

export function scheduleFields(date: Date): ScheduleFields {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours() % 12 || 12,
    minute: date.getMinutes(),
    period: date.getHours() >= 12 ? 'PM' : 'AM',
  };
}

export function scheduleDate(fields: ScheduleFields): Date | null {
  const { year, month, day, hour, minute, period } = fields;
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  )
    return null;
  const hours = (hour % 12) + (period === 'PM' ? 12 : 0);
  const date = new Date(year, month - 1, day, hours, minute);
  // Reject nonexistent calendar dates and local times skipped by DST.
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minute
    ? date
    : null;
}
