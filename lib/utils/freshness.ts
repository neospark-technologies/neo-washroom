import { Toilet, ToiletWithFreshness, DisplayStatus } from '@/types';
import { DEFAULT_FRESHNESS_MINUTES } from '../constants';
import { formatKathmanduTime, formatRelativeTime } from './date';

export function getFreshnessThresholdMinutes(): number {
  if (typeof process !== 'undefined' && process.env && process.env.STATUS_FRESHNESS_MINUTES) {
    const parsed = parseInt(process.env.STATUS_FRESHNESS_MINUTES, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_FRESHNESS_MINUTES;
}

/**
 * Derives the freshness state and display status for a toilet.
 * Does NOT alter the underlying stored database status.
 */
export function computeToiletFreshness(
  toilet: Toilet,
  customThresholdMinutes?: number
): ToiletWithFreshness {
  const threshold = customThresholdMinutes ?? getFreshnessThresholdMinutes();
  const lastUpdateMs = new Date(toilet.last_status_update).getTime();
  const nowMs = Date.now();
  
  const diffMs = Math.max(0, nowMs - lastUpdateMs);
  const minutesSinceUpdate = Math.floor(diffMs / (60 * 1000));
  const isStale = minutesSinceUpdate >= threshold;

  const relativeTime = formatRelativeTime(toilet.last_status_update);
  const formattedTime = formatKathmanduTime(toilet.last_status_update);

  let displayStatus: DisplayStatus = toilet.status;
  let freshnessNote = `Updated ${relativeTime} at ${formattedTime}`;

  if (isStale) {
    if (toilet.status === 'maintenance') {
      // Maintenance remains maintenance, but with an explicit freshness notice
      displayStatus = 'maintenance';
      freshnessNote = `Maintenance ongoing. Last verified ${relativeTime} (${formattedTime}). No recent update.`;
    } else {
      // Available and Occupied show 'needs_verification'
      displayStatus = 'needs_verification';
      const prevLabel = toilet.status === 'occupied' ? 'Occupied' : 'Available';
      freshnessNote = `Reported ${prevLabel} ${relativeTime} (${formattedTime}). No status update recently; please verify before use.`;
    }
  }

  return {
    ...toilet,
    queue_count: typeof toilet.queue_count === 'number' ? Math.max(0, toilet.queue_count) : 0,
    displayStatus,
    isStale,
    minutesSinceUpdate,
    freshnessNote,
  };
}

