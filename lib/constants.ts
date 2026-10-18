import { SupplyCategory, SupplySeverity, SupplyStatus, ToiletId } from '@/types';

export const TOILETS: Record<ToiletId, { id: ToiletId; name: string }> = {
  mens: { id: 'mens', name: "Men's Toilet" },
  womens: { id: 'womens', name: "Women's Toilet" },
};

export const SUPPLY_CATEGORIES: SupplyCategory[] = [
  'Soap',
  'Toilet paper',
  'Paper towels',
  'Hand sanitizer',
  'Other',
];

export const SUPPLY_SEVERITIES: SupplySeverity[] = ['Normal', 'Urgent'];

export const SUPPLY_STATUSES: SupplyStatus[] = ['pending', 'in_progress', 'resolved'];

export const DEFAULT_FRESHNESS_MINUTES = 60;
export const APP_TIMEZONE = 'Asia/Kathmandu';

