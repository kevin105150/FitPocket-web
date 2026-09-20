/**
 * Utility functions for local date formatting, parsing, and arithmetic.
 * Completely avoids UTC timezone shifts caused by Date.prototype.toISOString().
 */

/**
 * Returns today's date in 'YYYY-MM-DD' format using local time.
 */
export function getTodayString(): string {
  const d = new Date();
  return formatDateString(d);
}

/**
 * Formats a JavaScript Date object into 'YYYY-MM-DD' using local time.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a 'YYYY-MM-DD' string into a local Date object set to 00:00:00 local time.
 */
export function parseDateString(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date();
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) {
    return new Date();
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

/**
 * Adds (or subtracts) N days to a 'YYYY-MM-DD' string and returns the new 'YYYY-MM-DD' string in local time.
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseDateString(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateString(d);
}

/**
 * Formats a 'YYYY-MM-DD' string into a friendly Taiwanese string, e.g., "2026年9月13日 (週日)"
 */
export function formatChineseDisplayDate(dateStr: string): string {
  const d = parseDateString(dateStr);
  const daysOfWeek = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = daysOfWeek[d.getDay()];
  return `${y}年${m}月${day}日 (${dayOfWeek})`;
}

/**
 * Returns current Pacific Time (PT) date string 'YYYY-MM-DD'.
 * Google Gemini API daily quotas reset at 00:00:00 Pacific Time.
 */
export function getGoogleApiQuotaCycleDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // e.g. "2026-09-20"
  } catch {
    // Fallback: estimate PT with UTC-7 offset
    const ptDate = new Date(date.getTime() - 7 * 60 * 60 * 1000);
    return ptDate.toISOString().slice(0, 10);
  }
}

/**
 * Calculates the next Google API Daily Quota reset time (next midnight PT)
 * and the remaining time until reset.
 */
export function getNextGoogleApiResetInfo(now: Date = new Date()): {
  nextResetDate: Date;
  msRemaining: number;
  formattedLocalTime: string;
  hoursRemaining: number;
  minutesRemaining: number;
} {
  try {
    // Find current PT date parts
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = ptFormatter.formatToParts(now);
    const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

    const ptHour = getPart('hour') % 24;
    const ptMinute = getPart('minute');
    const ptSecond = getPart('second');

    // Seconds until next midnight PT
    const secondsPassedTodayInPt = ptHour * 3600 + ptMinute * 60 + ptSecond;
    const secondsUntilMidnightPt = 86400 - secondsPassedTodayInPt;
    const msRemaining = Math.max(1000, secondsUntilMidnightPt * 1000);

    const nextResetDate = new Date(now.getTime() + msRemaining);
    const formattedLocalTime = nextResetDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const hoursRemaining = Math.floor(secondsUntilMidnightPt / 3600);
    const minutesRemaining = Math.floor((secondsUntilMidnightPt % 3600) / 60);

    return {
      nextResetDate,
      msRemaining,
      formattedLocalTime,
      hoursRemaining,
      minutesRemaining,
    };
  } catch (e) {
    const defaultMs = 12 * 3600 * 1000;
    const nextResetDate = new Date(now.getTime() + defaultMs);
    return {
      nextResetDate,
      msRemaining: defaultMs,
      formattedLocalTime: '15:00',
      hoursRemaining: 12,
      minutesRemaining: 0,
    };
  }
}
