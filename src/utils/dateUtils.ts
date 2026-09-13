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
