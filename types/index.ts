export type ToiletId = 'mens' | 'womens';

export type ToiletStatus = 'available' | 'occupied' | 'maintenance';

export type DisplayStatus = 'available' | 'occupied' | 'maintenance' | 'needs_verification';

export type SupplyCategory = 
  | 'Soap' 
  | 'Toilet paper' 
  | 'Paper towels' 
  | 'Hand sanitizer' 
  | 'Other';

export type SupplySeverity = 'Normal' | 'Urgent';

export type SupplyStatus = 'pending' | 'in_progress' | 'resolved';

export interface Toilet {
  id: ToiletId;
  name: string;
  status: ToiletStatus;
  queue_count: number;
  last_status_update: string;
  created_at?: string;
  updated_at?: string;
}

export interface ToiletLastChangeInfo {
  new_status: ToiletStatus;
  previous_status?: ToiletStatus | null;
  device_summary: string;
  created_at: string;
}

export interface ToiletWithFreshness extends Toilet {
  displayStatus: DisplayStatus;
  isStale: boolean;
  minutesSinceUpdate: number;
  freshnessNote: string;
  lastChange?: ToiletLastChangeInfo | null;
}

export interface ToiletStatusHistory {
  id: string;
  toilet_id: ToiletId;
  previous_status: ToiletStatus | null;
  new_status: ToiletStatus;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface PublicActivityEvent {
  id: string;
  toilet_id: ToiletId;
  toilet_name: string;
  previous_status: ToiletStatus | null;
  new_status: ToiletStatus;
  action_summary: string;
  device_summary: string;
  device_type: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  browser: string;
  created_at: string;
}

export interface SupplyReport {
  id: string;
  toilet_id: ToiletId;
  toilet_name?: string;
  category: SupplyCategory;
  description?: string | null;
  severity: SupplySeverity;
  status: SupplyStatus;
  resolution_note?: string | null;
  is_archived: boolean;
  ip_address?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface CleaningSchedule {
  id: string;
  toilet_id: ToiletId;
  time_of_day: string;
  shift_name: string;
  is_active: boolean;
  created_at: string;
}

export interface CleaningLog {
  id: string;
  toilet_id: ToiletId;
  cleaned_at: string;
  checklist: string[];
  notes?: string | null;
  staff_identifier?: string | null;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export type AnalyticsPeriod = 'today' | '7d' | '30d';

export interface AnalyticsData {
  period: AnalyticsPeriod;
  timezone: string;
  totalStatusChanges: number;
  occupiedReports: number;
  maintenanceReports: number;
  unresolvedSupplyIssues: number;
  cleaningCompletion: {
    completed: number;
    scheduled: number;
    rate: number;
    isConfigured: boolean;
  };
  dailyActivity: Array<{
    date: string;
    formattedDate: string;
    changes: number;
    occupied: number;
    maintenance: number;
  }>;
  occupiedByHour: Array<{
    hour: number;
    label: string;
    count: number;
  }>;
  toiletComparison: {
    mens: {
      name: string;
      totalChanges: number;
      occupiedTransitions: number;
      currentStatus: ToiletStatus;
    };
    womens: {
      name: string;
      totalChanges: number;
      occupiedTransitions: number;
      currentStatus: ToiletStatus;
    };
  };
  maintenanceFrequency: Array<{
    date: string;
    formattedDate: string;
    count: number;
  }>;
  supplyProblems: {
    byCategory: Array<{
      category: SupplyCategory;
      count: number;
    }>;
    byToilet: Array<{
      toiletId: ToiletId;
      toiletName: string;
      count: number;
    }>;
  };
}

