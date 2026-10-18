import { APP_TIMEZONE } from '../constants';

/**
 * Formats a timestamp into Asia/Kathmandu local time
 */
export function formatKathmanduTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Formats a timestamp into Asia/Kathmandu full date & time
 */
export function formatKathmanduDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Gets the calendar date string (YYYY-MM-DD) in Asia/Kathmandu
 */
export function getKathmanduDateString(isoStringOrDate: string | Date): string {
  try {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
    if (isNaN(d.getTime())) return '';
    
    // We format in 'en-CA' because it outputs standard ISO YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Gets the local 24-hour integer (0..23) in Asia/Kathmandu
 */
export function getKathmanduHour(isoStringOrDate: string | Date): number {
  try {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
    if (isNaN(d.getTime())) return 0;

    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(d);
    
    // In en-US with hour12: false, midnight can sometimes be formatted as 24
    const parsed = parseInt(hourStr, 10);
    return parsed === 24 ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Returns human-readable relative time string
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Unknown';
    
    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} mins ago`;
    if (diffHr === 1) return '1 hour ago';
    if (diffHr < 24) return `${diffHr} hours ago`;
    if (diffDay === 1) return 'Yesterday';
    return `${diffDay} days ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Calculates start Date, end Date, and array of date keys in Asia/Kathmandu for a given period
 */
export function getDateRangeForPeriod(period: 'today' | '7d' | '30d'): {
  startIso: string;
  endIso: string;
  dateKeys: string[];
} {
  const now = new Date();
  const todayKey = getKathmanduDateString(now);

  // Parse today's year, month, day in Nepal
  const [year, month, day] = todayKey.split('-').map(Number);
  
  // Nepal is UTC+05:45, so midnight Nepal is (year, month - 1, day, 0, 0, 0) minus 5 hours 45 mins UTC
  // Equivalent to:
  const getUtcTimestampForKathmanduMidnight = (y: number, m: number, d: number) => {
    // 5 hours 45 minutes = 345 minutes = 20,700,000 ms
    return Date.UTC(y, m - 1, d, 0, 0, 0) - (5 * 60 + 45) * 60 * 1000;
  };

  const daysCount = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const dateKeys: string[] = [];

  // Generate date keys ending today
  for (let i = daysCount - 1; i >= 0; i--) {
    // Subtract days from Nepal calendar date
    const targetDate = new Date(Date.UTC(year, month - 1, day - i, 12, 0, 0));
    const k = targetDate.toISOString().slice(0, 10);
    dateKeys.push(k);
  }

  const [startYear, startMonth, startDay] = dateKeys[0].split('-').map(Number);
  const startUtcMs = getUtcTimestampForKathmanduMidnight(startYear, startMonth, startDay);
  
  // End of period is end of today in Nepal (tomorrow midnight - 1ms)
  const tomorrowUtcMs = getUtcTimestampForKathmanduMidnight(year, month, day + 1);

  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(tomorrowUtcMs - 1).toISOString(),
    dateKeys,
  };
}

