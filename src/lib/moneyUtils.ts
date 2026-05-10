/**
 * Centralized monetary primitives. Pure functions, no dependencies.
 * Every business calculation in the app should round through toMoney().
 */

export function toMoney(value: number | null | undefined): number {
  if (value == null) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

/**
 * Returns null when previous is 0 — callers must decide how to render
 * "no baseline" rather than seeing Infinity or arbitrary numbers.
 */
export function growthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function percentOf(part: number, whole: number): number {
  return safeDivide(part, whole, 0) * 100;
}

export function applyPercent(base: number, percent: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(percent)) return 0;
  return toMoney((base * percent) / 100);
}

export function clampPositive(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

export function sumBy<T>(items: T[], pick: (item: T) => number | null | undefined): number {
  let total = 0;
  for (const item of items) {
    const value = pick(item);
    if (value != null && Number.isFinite(value)) total += value;
  }
  return toMoney(total);
}
