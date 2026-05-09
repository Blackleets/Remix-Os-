/**
 * Date helpers for business metrics. Wraps date-fns + Firestore Timestamp.
 */
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  isEqual,
} from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateRangeBundle {
  today: DateRange;
  yesterday: DateRange;
  thisWeek: DateRange;
  lastWeek: DateRange;
  thisMonth: DateRange;
  lastMonth: DateRange;
  last7Days: DateRange;
  last30Days: DateRange;
  prev7Days: DateRange;
  prev30Days: DateRange;
}

export function getDateRanges(now: Date = new Date()): DateRangeBundle {
  const today: DateRange = { start: startOfDay(now), end: endOfDay(now) };
  const yest = subDays(now, 1);
  const yesterday: DateRange = { start: startOfDay(yest), end: endOfDay(yest) };

  const lastWeekRef = subWeeks(now, 1);
  const lastMonthRef = subMonths(now, 1);

  return {
    today,
    yesterday,
    thisWeek: { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) },
    lastWeek: {
      start: startOfWeek(lastWeekRef, { weekStartsOn: 1 }),
      end: endOfWeek(lastWeekRef, { weekStartsOn: 1 }),
    },
    thisMonth: { start: startOfMonth(now), end: endOfMonth(now) },
    lastMonth: { start: startOfMonth(lastMonthRef), end: endOfMonth(lastMonthRef) },
    last7Days: { start: startOfDay(subDays(now, 6)), end: endOfDay(now) },
    last30Days: { start: startOfDay(subDays(now, 29)), end: endOfDay(now) },
    prev7Days: { start: startOfDay(subDays(now, 13)), end: endOfDay(subDays(now, 7)) },
    prev30Days: { start: startOfDay(subDays(now, 59)), end: endOfDay(subDays(now, 30)) },
  };
}

/**
 * Defensive Firestore Timestamp / string / Date → Date.
 */
export function tsToDate(value: any): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
}

export function isInRange(value: any, range: DateRange): boolean {
  const d = tsToDate(value);
  if (!d) return false;
  return (
    (isAfter(d, range.start) || isEqual(d, range.start)) &&
    (isBefore(d, range.end) || isEqual(d, range.end))
  );
}

/**
 * Bucket items into one entry per day inside `range`. Each bucket is keyed by
 * yyyy-MM-dd. Days with no items are present with empty arrays — useful for
 * charts where you need a continuous x-axis.
 */
export function bucketByDay<T>(
  items: T[],
  pickDate: (item: T) => any,
  range: DateRange
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const day of eachDayOfInterval({ start: range.start, end: range.end })) {
    buckets.set(format(day, 'yyyy-MM-dd'), []);
  }
  for (const item of items) {
    const d = tsToDate(pickDate(item));
    if (!d) continue;
    const key = format(d, 'yyyy-MM-dd');
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
  }
  return buckets;
}

export function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}
