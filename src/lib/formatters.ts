/**
 * Centralized formatting utility for Remix OS.
 * Handles locale-aware formatting for currencies, dates, and numbers.
 */

export interface LocaleSettings {
  language: string;
  currency: string;
  timezone?: string;
  dateFormat?: string;
}

const DEFAULT_LOCALE = 'en-US';

/**
 * Format a number as currency.
 */
export function formatCurrency(amount: number, settings: LocaleSettings): string {
  try {
    return new Intl.NumberFormat(settings.language || DEFAULT_LOCALE, {
      style: 'currency',
      currency: settings.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    console.error('Error formatting currency:', e);
    return `${settings.currency || '$'} ${amount.toLocaleString()}`;
  }
}

/**
 * Format a date object.
 */
export function formatDate(date: Date | any, settings: LocaleSettings): string {
  if (!date) return '---';
  
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
  
  try {
    return new Intl.DateTimeFormat(settings.language || DEFAULT_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: settings.timezone,
    }).format(d);
  } catch (e) {
    console.error('Error formatting date:', e);
    return d.toLocaleDateString();
  }
}

/**
 * Format time.
 */
export function formatTime(date: Date | any, settings: LocaleSettings): string {
  if (!date) return '---';
  
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
  
  try {
    return new Intl.DateTimeFormat(settings.language || DEFAULT_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: settings.timezone,
    }).format(d);
  } catch (e) {
    console.error('Error formatting time:', e);
    return d.toLocaleTimeString();
  }
}

/**
 * Format numbers with locale awareness.
 */
export function formatNumber(num: number, language: string = DEFAULT_LOCALE): string {
  try {
    return new Intl.NumberFormat(language).format(num);
  } catch (e) {
    return num.toLocaleString();
  }
}
