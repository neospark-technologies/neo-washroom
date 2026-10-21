import { getServerSupabaseClient } from '../supabase/server';
import {
  Toilet,
  ToiletId,
  ToiletStatus,
  ToiletWithFreshness,
  SupplyReport,
  SupplyCategory,
  SupplySeverity,
  SupplyStatus,
  CleaningLog,
  CleaningSchedule,
  AdminAuditLog,
  ToiletStatusHistory,
  AnalyticsPeriod,
  AnalyticsData,
} from '@/types';
import { TOILETS, SUPPLY_CATEGORIES, SUPPLY_SEVERITIES } from '../constants';
import { computeToiletFreshness } from '../utils/freshness';
import fs from 'fs';
import path from 'path';
import { parseUserAgentToDeviceInfo } from '../utils/device';
import {
  getKathmanduDateString,
  getKathmanduHour,
  getDateRangeForPeriod,
} from '../utils/date';

// In-memory fallback store in case Supabase tables are not yet created
class LocalFallbackStore {
  toilets: Map<ToiletId, Toilet> = new Map([
    [
      'mens',
      {
        id: 'mens',
        name: "Men's Toilet",
        status: 'available',
        queue_count: 0,
        last_status_update: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
    [
      'womens',
      {
        id: 'womens',
        name: "Women's Toilet",
        status: 'available',
        queue_count: 0,
        last_status_update: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    ],
  ]);

  statusHistory: ToiletStatusHistory[] = [];
  supplyReports: SupplyReport[] = [];
  cleaningLogs: CleaningLog[] = [];
  cleaningSchedules: CleaningSchedule[] = [
    { id: 'cs-1', toilet_id: 'mens', time_of_day: '09:00', shift_name: 'Morning Inspection', is_active: true, created_at: new Date().toISOString() },
    { id: 'cs-2', toilet_id: 'mens', time_of_day: '13:00', shift_name: 'Midday Sanitization', is_active: true, created_at: new Date().toISOString() },
    { id: 'cs-3', toilet_id: 'mens', time_of_day: '17:00', shift_name: 'Evening Deep Clean', is_active: true, created_at: new Date().toISOString() },
    { id: 'cs-4', toilet_id: 'womens', time_of_day: '09:00', shift_name: 'Morning Inspection', is_active: true, created_at: new Date().toISOString() },
    { id: 'cs-5', toilet_id: 'womens', time_of_day: '13:00', shift_name: 'Midday Sanitization', is_active: true, created_at: new Date().toISOString() },
    { id: 'cs-6', toilet_id: 'womens', time_of_day: '17:00', shift_name: 'Evening Deep Clean', is_active: true, created_at: new Date().toISOString() },
  ];
  adminAuditLogs: AdminAuditLog[] = [];
}

const FALLBACK_DB_PATH = path.join(process.cwd(), '.data', 'fallback-db.json');

function saveStoreToDisk(store: LocalFallbackStore) {
  try {
    const dir = path.dirname(FALLBACK_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized = {
      toilets: Array.from(store.toilets.entries()),
      statusHistory: store.statusHistory,
      supplyReports: store.supplyReports,
      cleaningLogs: store.cleaningLogs,
      cleaningSchedules: store.cleaningSchedules,
      adminAuditLogs: store.adminAuditLogs,
    };
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(serialized, null, 2), 'utf-8');
  } catch {
    // Ignore if running in a read-only filesystem
  }
}

function loadStoreFromDisk(store: LocalFallbackStore) {
  try {
    if (fs.existsSync(FALLBACK_DB_PATH)) {
      const content = fs.readFileSync(FALLBACK_DB_PATH, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.toilets) && data.toilets.length > 0) {
        store.toilets = new Map(data.toilets);
      }
      if (Array.isArray(data.statusHistory)) store.statusHistory = data.statusHistory;
      if (Array.isArray(data.supplyReports)) store.supplyReports = data.supplyReports;
      if (Array.isArray(data.cleaningLogs)) store.cleaningLogs = data.cleaningLogs;
      if (Array.isArray(data.cleaningSchedules)) store.cleaningSchedules = data.cleaningSchedules;
      if (Array.isArray(data.adminAuditLogs)) store.adminAuditLogs = data.adminAuditLogs;
    }
  } catch {
    // Ignore load errors and keep in-memory defaults
  }
}

const globalForDb = globalThis as unknown as {
  fallbackStore?: LocalFallbackStore;
  missingTables?: Set<string>;
};

if (!globalForDb.fallbackStore) {
  const newStore = new LocalFallbackStore();
  loadStoreFromDisk(newStore);
  globalForDb.fallbackStore = newStore;
}
const fallbackStore = globalForDb.fallbackStore;

if (!globalForDb.missingTables) {
  globalForDb.missingTables = new Set<string>();
}

export class DatabaseService {
  private static missingTables: Set<string> = globalForDb.missingTables!;

  public static clearCache(): void {
    this.missingTables.clear();
  }

  /**
   * Helper to check if Supabase error is table not found
   */
  private static isTableNotFoundError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as { code?: string; message?: string };
    return (
      e.code === 'PGRST205' ||
      e.code === 'PGRST202' ||
      e.code === '42P01' ||
      e.code === '42883' ||
      (typeof e.message === 'string' &&
        (e.message.toLowerCase().includes('schema cache') ||
         e.message.toLowerCase().includes('could not find the function') ||
         e.message.toLowerCase().includes('relation') ||
         e.message.toLowerCase().includes('does not exist')))
    );
  }

  // ============================================================================
  // Toilets & Status Management
  // ============================================================================

  static async getToiletsWithFreshness(): Promise<ToiletWithFreshness[]> {
    loadStoreFromDisk(fallbackStore);
    // Fetch raw toilets and history in parallel for maximum speed
    const fetchRawToilets = async (): Promise<Toilet[]> => {
      if (this.missingTables.has('toilets')) {
        loadStoreFromDisk(fallbackStore);
        return Array.from(fallbackStore.toilets.values());
      }
      const supabase = getServerSupabaseClient();
      try {
        const { data, error } = await supabase
          .from('toilets')
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          if (this.isTableNotFoundError(error)) {
            this.missingTables.add('toilets');
          }
          loadStoreFromDisk(fallbackStore);
          return Array.from(fallbackStore.toilets.values());
        }
        return data && data.length > 0 ? (data as Toilet[]) : Array.from(fallbackStore.toilets.values());
      } catch {
        this.missingTables.add('toilets');
        loadStoreFromDisk(fallbackStore);
        return Array.from(fallbackStore.toilets.values());
      }
    };

    const fetchLatestHistory = async (): Promise<ToiletStatusHistory[]> => {
      if (this.missingTables.has('toilet_status_history')) {
        loadStoreFromDisk(fallbackStore);
        return fallbackStore.statusHistory;
      }
      const supabase = getServerSupabaseClient();
      try {
        const { data: hData, error: hErr } = await supabase
          .from('toilet_status_history')
          .select('toilet_id, new_status, previous_status, user_agent, created_at')
          .order('created_at', { ascending: false })
          .limit(10);
        if (hErr) {
          if (this.isTableNotFoundError(hErr)) this.missingTables.add('toilet_status_history');
          loadStoreFromDisk(fallbackStore);
          return fallbackStore.statusHistory;
        }
        return (hData as ToiletStatusHistory[]) || [];
      } catch {
        this.missingTables.add('toilet_status_history');
        loadStoreFromDisk(fallbackStore);
        return fallbackStore.statusHistory;
      }
    };

    const [rawToilets, history] = await Promise.all([
      fetchRawToilets(),
      fetchLatestHistory(),
    ]);

    return rawToilets.map((t) => {
      const evaluated = computeToiletFreshness(t);
      const lastHist = history.find((h) => h.toilet_id === t.id);
      if (lastHist) {
        evaluated.lastChange = {
          new_status: lastHist.new_status,
          previous_status: lastHist.previous_status,
          device_summary: parseUserAgentToDeviceInfo(lastHist.user_agent),
          created_at: lastHist.created_at,
        };
      } else {
        evaluated.lastChange = {
          new_status: t.status,
          previous_status: undefined,
          device_summary: 'System Initializer',
          created_at: t.last_status_update,
        };
      }
      return evaluated;
    });
  }

  static async updateToiletStatus(
    toiletId: ToiletId,
    newStatus: ToiletStatus,
    ip?: string | null,
    userAgent?: string | null
  ): Promise<{ changed: boolean; toilet: ToiletWithFreshness; previousStatus?: ToiletStatus }> {
    if (!TOILETS[toiletId]) {
      throw new Error(`Invalid toilet ID: ${toiletId}`);
    }
    if (!['available', 'occupied', 'maintenance'].includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    if (this.missingTables.has('toilets')) {
      return this.updateFallbackToiletStatus(toiletId, newStatus, ip, userAgent);
    }

    const supabase = getServerSupabaseClient(true);
    const now = new Date().toISOString();

    try {
      // 1. Try atomic database function if not flagged missing
      if (!this.missingTables.has('update_toilet_status')) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('update_toilet_status', {
          p_toilet_id: toiletId,
          p_new_status: newStatus,
          p_ip: ip ?? null,
          p_user_agent: userAgent ?? null,
        });

        if (!rpcError && rpcData) {
          const rawToilet = rpcData.toilet as Toilet;
          const evaluated = computeToiletFreshness(rawToilet);
          evaluated.lastChange = {
            new_status: newStatus,
            previous_status: rpcData.previous_status,
            device_summary: parseUserAgentToDeviceInfo(userAgent),
            created_at: rawToilet.last_status_update || now,
          };
          return {
            changed: Boolean(rpcData.changed),
            previousStatus: rpcData.previous_status,
            toilet: evaluated,
          };
        }

        if (rpcError && this.isTableNotFoundError(rpcError)) {
          this.missingTables.add('update_toilet_status');
        }
      }

      // 2. Query directly
      const { data: currentToilet, error: fetchErr } = await supabase
        .from('toilets')
        .select('*')
        .eq('id', toiletId)
        .single();

      if (fetchErr) {
        if (this.isTableNotFoundError(fetchErr)) {
          this.missingTables.add('toilets');
          return this.updateFallbackToiletStatus(toiletId, newStatus, ip, userAgent);
        }
        throw fetchErr;
      }

      const prevStatus = currentToilet.status as ToiletStatus;

      if (prevStatus === newStatus) {
        // Refresh freshness timestamp without creating duplicate history event
        const { data: refreshedToilet } = await supabase
          .from('toilets')
          .update({
            last_status_update: now,
            updated_at: now,
          })
          .eq('id', toiletId)
          .select()
          .single();

        const baseToilet = (refreshedToilet as Toilet) || { ...currentToilet, last_status_update: now };
        const evaluated = computeToiletFreshness(baseToilet);
        evaluated.lastChange = {
          new_status: newStatus,
          previous_status: prevStatus,
          device_summary: parseUserAgentToDeviceInfo(userAgent),
          created_at: now,
        };

        return {
          changed: false,
          previousStatus: prevStatus,
          toilet: evaluated,
        };
      }

      // Status changed: update toilet and insert history record
      const { data: updatedToilet, error: updateErr } = await supabase
        .from('toilets')
        .update({
          status: newStatus,
          last_status_update: now,
          updated_at: now,
        })
        .eq('id', toiletId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Insert audit history
      await supabase.from('toilet_status_history').insert({
        toilet_id: toiletId,
        previous_status: prevStatus,
        new_status: newStatus,
        ip_address: ip ?? null,
        user_agent: userAgent ?? null,
        created_at: now,
      });

      const evaluated = computeToiletFreshness(updatedToilet as Toilet);
      evaluated.lastChange = {
        new_status: newStatus,
        previous_status: prevStatus,
        device_summary: parseUserAgentToDeviceInfo(userAgent),
        created_at: now,
      };

      return {
        changed: prevStatus !== newStatus,
        previousStatus: prevStatus,
        toilet: evaluated,
      };
    } catch {
      this.missingTables.add('toilets');
      return this.updateFallbackToiletStatus(toiletId, newStatus, ip, userAgent);
    }
  }

  private static updateFallbackToiletStatus(
    toiletId: ToiletId,
    newStatus: ToiletStatus,
    ip?: string | null,
    userAgent?: string | null
  ): { changed: boolean; toilet: ToiletWithFreshness; previousStatus?: ToiletStatus } {
    loadStoreFromDisk(fallbackStore);
    const existing = fallbackStore.toilets.get(toiletId) || {
      id: toiletId,
      name: TOILETS[toiletId].name,
      status: 'available',
      queue_count: 0,
      last_status_update: new Date().toISOString(),
    };

    const prevStatus = existing.status;
    const now = new Date().toISOString();

    if (prevStatus === newStatus) {
      // Refresh freshness timestamp without inserting duplicate history row
      const updated: Toilet = {
        ...existing,
        last_status_update: now,
        updated_at: now,
      };
      fallbackStore.toilets.set(toiletId, updated);

      const evaluated = computeToiletFreshness(updated);
      evaluated.lastChange = {
        new_status: newStatus,
        previous_status: prevStatus,
        device_summary: parseUserAgentToDeviceInfo(userAgent),
        created_at: now,
      };

      saveStoreToDisk(fallbackStore);
      return {
        changed: false,
        previousStatus: prevStatus,
        toilet: evaluated,
      };
    }

    const updated: Toilet = {
      ...existing,
      status: newStatus,
      last_status_update: now,
      updated_at: now,
    };
    fallbackStore.toilets.set(toiletId, updated);

    fallbackStore.statusHistory.unshift({
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      toilet_id: toiletId,
      previous_status: prevStatus,
      new_status: newStatus,
      ip_address: ip,
      user_agent: userAgent,
      created_at: now,
    });

    const evaluated = computeToiletFreshness(updated);
    evaluated.lastChange = {
      new_status: newStatus,
      previous_status: prevStatus,
      device_summary: parseUserAgentToDeviceInfo(userAgent),
      created_at: now,
    };

    saveStoreToDisk(fallbackStore);
    return {
      changed: true,
      previousStatus: prevStatus,
      toilet: evaluated,
    };
  }

  static async updateToiletQueue(
    toiletId: ToiletId,
    delta: number,
    ip?: string | null,
    userAgent?: string | null
  ): Promise<ToiletWithFreshness> {
    if (!TOILETS[toiletId]) {
      throw new Error(`Invalid toilet ID: ${toiletId}`);
    }

    if (this.missingTables.has('toilets')) {
      return this.updateFallbackToiletQueue(toiletId, delta, ip, userAgent);
    }

    const supabase = getServerSupabaseClient(true);
    const now = new Date().toISOString();

    try {
      const { data: currentToilet, error: fetchErr } = await supabase
        .from('toilets')
        .select('*')
        .eq('id', toiletId)
        .single();

      if (fetchErr) {
        if (this.isTableNotFoundError(fetchErr)) {
          this.missingTables.add('toilets');
          return this.updateFallbackToiletQueue(toiletId, delta, ip, userAgent);
        }
        throw fetchErr;
      }

      const currentQueue = Math.max(0, (currentToilet.queue_count ?? 0) + delta);

      const { data: updatedToilet, error: updateErr } = await supabase
        .from('toilets')
        .update({
          queue_count: currentQueue,
          updated_at: now,
        })
        .eq('id', toiletId)
        .select()
        .single();

      if (updateErr) {
        return this.updateFallbackToiletQueue(toiletId, delta, ip, userAgent);
      }

      const evaluated = computeToiletFreshness({
        ...updatedToilet,
        queue_count: currentQueue,
      } as Toilet);

      // Record activity event
      try {
        await supabase.from('toilet_status_history').insert({
          toilet_id: toiletId,
          previous_status: currentToilet.status,
          new_status: currentToilet.status,
          ip_address: ip ?? null,
          user_agent: userAgent ?? null,
          created_at: now,
        });
      } catch {
        // Silently continue
      }

      evaluated.lastChange = {
        new_status: currentToilet.status,
        previous_status: currentToilet.status,
        device_summary: parseUserAgentToDeviceInfo(userAgent),
        created_at: now,
      };

      return evaluated;
    } catch {
      this.missingTables.add('toilets');
      return this.updateFallbackToiletQueue(toiletId, delta, ip, userAgent);
    }
  }

  private static updateFallbackToiletQueue(
    toiletId: ToiletId,
    delta: number,
    _ip?: string | null,
    userAgent?: string | null
  ): ToiletWithFreshness {
    loadStoreFromDisk(fallbackStore);
    const existing = fallbackStore.toilets.get(toiletId) || {
      id: toiletId,
      name: TOILETS[toiletId].name,
      status: 'available',
      queue_count: 0,
      last_status_update: new Date().toISOString(),
    };

    const newQueue = Math.max(0, (existing.queue_count ?? 0) + delta);
    const now = new Date().toISOString();
    const updated: Toilet = {
      ...existing,
      queue_count: newQueue,
      updated_at: now,
    };
    fallbackStore.toilets.set(toiletId, updated);

    const evaluated = computeToiletFreshness(updated);
    evaluated.lastChange = {
      new_status: existing.status,
      previous_status: existing.status,
      device_summary: parseUserAgentToDeviceInfo(userAgent),
      created_at: now,
    };

    saveStoreToDisk(fallbackStore);
    return evaluated;
  }

  // ============================================================================
  // Supply Reports
  // ============================================================================

  static async getSupplyReports(options?: {
    unresolvedOnly?: boolean;
    toiletId?: ToiletId;
    category?: SupplyCategory;
    severity?: SupplySeverity;
    status?: SupplyStatus;
    includeArchived?: boolean;
  }): Promise<SupplyReport[]> {
    if (this.missingTables.has('supply_reports')) {
      return this.filterFallbackSupplyReports(options);
    }

    const supabase = getServerSupabaseClient();
    try {
      let query = supabase.from('supply_reports').select('*');

      if (!options?.includeArchived) {
        query = query.eq('is_archived', false);
      }
      if (options?.unresolvedOnly) {
        query = query.in('status', ['pending', 'in_progress']);
      }
      if (options?.toiletId) {
        query = query.eq('toilet_id', options.toiletId);
      }
      if (options?.category) {
        query = query.eq('category', options.category);
      }
      if (options?.severity) {
        query = query.eq('severity', options.severity);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        if (this.isTableNotFoundError(error)) {
          this.missingTables.add('supply_reports');
          return this.filterFallbackSupplyReports(options);
        }
        throw error;
      }

      return (data || []).map((r) => ({
        ...r,
        toilet_name: TOILETS[r.toilet_id as ToiletId]?.name || r.toilet_id,
      }));
    } catch {
      this.missingTables.add('supply_reports');
      return this.filterFallbackSupplyReports(options);
    }
  }

  private static filterFallbackSupplyReports(options?: {
    unresolvedOnly?: boolean;
    toiletId?: ToiletId;
    category?: SupplyCategory;
    severity?: SupplySeverity;
    status?: SupplyStatus;
    includeArchived?: boolean;
  }): SupplyReport[] {
    loadStoreFromDisk(fallbackStore);
    let list = [...fallbackStore.supplyReports];
    if (!options?.includeArchived) {
      list = list.filter((r) => !r.is_archived);
    }
    if (options?.unresolvedOnly) {
      list = list.filter((r) => r.status === 'pending' || r.status === 'in_progress');
    }
    if (options?.toiletId) {
      list = list.filter((r) => r.toilet_id === options.toiletId);
    }
    if (options?.category) {
      list = list.filter((r) => r.category === options.category);
    }
    if (options?.severity) {
      list = list.filter((r) => r.severity === options.severity);
    }
    if (options?.status) {
      list = list.filter((r) => r.status === options.status);
    }
    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  static async createSupplyReport(data: {
    toilet_id: ToiletId;
    category: SupplyCategory;
    description?: string | null;
    severity?: SupplySeverity;
    ip?: string | null;
  }): Promise<SupplyReport> {
    if (!TOILETS[data.toilet_id]) {
      throw new Error(`Invalid toilet ID: ${data.toilet_id}`);
    }
    if (!SUPPLY_CATEGORIES.includes(data.category)) {
      throw new Error(`Invalid supply category: ${data.category}`);
    }
    const severity: SupplySeverity = data.severity && SUPPLY_SEVERITIES.includes(data.severity)
      ? data.severity
      : 'Normal';

    const desc = data.description ? data.description.trim() : '';
    if (desc.length > 500) {
      throw new Error('Description must not exceed 500 characters');
    }

    const now = new Date().toISOString();
    const reportData = {
      toilet_id: data.toilet_id,
      category: data.category,
      description: desc || null,
      severity,
      status: 'pending' as const, // Strict enforcement: always pending for public
      is_archived: false,
      ip_address: data.ip || null,
      created_at: now,
      updated_at: now,
      resolved_at: null,
    };

    if (this.missingTables.has('supply_reports')) {
      loadStoreFromDisk(fallbackStore);
      const fallbackItem: SupplyReport = {
        id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...reportData,
        toilet_name: TOILETS[data.toilet_id].name,
      };
      fallbackStore.supplyReports.unshift(fallbackItem);
      saveStoreToDisk(fallbackStore);
      return fallbackItem;
    }

    const supabase = getServerSupabaseClient();
    try {
      const { data: created, error } = await supabase
        .from('supply_reports')
        .insert(reportData)
        .select()
        .single();

      if (error) {
        if (this.isTableNotFoundError(error)) {
          this.missingTables.add('supply_reports');
          loadStoreFromDisk(fallbackStore);
          const fallbackItem: SupplyReport = {
            id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            ...reportData,
            toilet_name: TOILETS[data.toilet_id].name,
          };
          fallbackStore.supplyReports.unshift(fallbackItem);
          saveStoreToDisk(fallbackStore);
          return fallbackItem;
        }
        throw error;
      }

      return {
        ...created,
        toilet_name: TOILETS[data.toilet_id].name,
      };
    } catch {
      this.missingTables.add('supply_reports');
      loadStoreFromDisk(fallbackStore);
      const fallbackItem: SupplyReport = {
        id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...reportData,
        toilet_name: TOILETS[data.toilet_id].name,
      };
      fallbackStore.supplyReports.unshift(fallbackItem);
      saveStoreToDisk(fallbackStore);
      return fallbackItem;
    }
  }

  static async updateSupplyReport(
    id: string,
    updates: {
      status?: SupplyStatus;
      resolution_note?: string | null;
      is_archived?: boolean;
    },
    adminIp?: string | null
  ): Promise<SupplyReport> {
    const supabase = getServerSupabaseClient(true);
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {
      updated_at: now,
    };

    if (updates.status) {
      patch.status = updates.status;
      if (updates.status === 'resolved') {
        patch.resolved_at = now;
      } else {
        patch.resolved_at = null;
      }
    }

    if (typeof updates.resolution_note !== 'undefined') {
      patch.resolution_note = updates.resolution_note;
    }

    if (typeof updates.is_archived === 'boolean') {
      patch.is_archived = updates.is_archived;
    }

    try {
      const { data, error } = await supabase
        .from('supply_reports')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (this.isTableNotFoundError(error)) {
          return this.updateFallbackSupplyReport(id, updates, adminIp);
        }
        throw error;
      }

      // Record administrative audit log
      await this.recordAdminAuditLog({
        action: 'UPDATE_SUPPLY_REPORT',
        entity_type: 'supply_report',
        entity_id: id,
        details: updates,
        ip_address: adminIp,
      });

      return {
        ...data,
        toilet_name: TOILETS[data.toilet_id as ToiletId]?.name || data.toilet_id,
      };
    } catch {
      return this.updateFallbackSupplyReport(id, updates, adminIp);
    }
  }

  private static updateFallbackSupplyReport(
    id: string,
    updates: {
      status?: SupplyStatus;
      resolution_note?: string | null;
      is_archived?: boolean;
    },
    adminIp?: string | null
  ): SupplyReport {
    loadStoreFromDisk(fallbackStore);
    const index = fallbackStore.supplyReports.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Supply report not found: ${id}`);
    }

    const item = fallbackStore.supplyReports[index];
    const now = new Date().toISOString();

    if (updates.status) {
      item.status = updates.status;
      item.resolved_at = updates.status === 'resolved' ? now : null;
    }
    if (typeof updates.resolution_note !== 'undefined') {
      item.resolution_note = updates.resolution_note;
    }
    if (typeof updates.is_archived === 'boolean') {
      item.is_archived = updates.is_archived;
    }
    item.updated_at = now;

    fallbackStore.adminAuditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: 'UPDATE_SUPPLY_REPORT',
      entity_type: 'supply_report',
      entity_id: id,
      details: updates,
      ip_address: adminIp,
      created_at: now,
    });

    saveStoreToDisk(fallbackStore);
    return item;
  }

  static async deleteSupplyReport(id: string, adminIp?: string | null): Promise<void> {
    const supabase = getServerSupabaseClient(true);
    try {
      const { error } = await supabase.from('supply_reports').delete().eq('id', id);
      if (error) {
        if (this.isTableNotFoundError(error)) {
          loadStoreFromDisk(fallbackStore);
          fallbackStore.supplyReports = fallbackStore.supplyReports.filter((r) => r.id !== id);
          saveStoreToDisk(fallbackStore);
          return;
        }
        throw error;
      }

      await this.recordAdminAuditLog({
        action: 'DELETE_SUPPLY_REPORT',
        entity_type: 'supply_report',
        entity_id: id,
        ip_address: adminIp,
      });
    } catch {
      loadStoreFromDisk(fallbackStore);
      fallbackStore.supplyReports = fallbackStore.supplyReports.filter((r) => r.id !== id);
      saveStoreToDisk(fallbackStore);
    }
  }

  // ============================================================================
  // Cleaning Logs & Schedules
  // ============================================================================

  static async getCleaningSchedules(): Promise<CleaningSchedule[]> {
    loadStoreFromDisk(fallbackStore);
    if (this.missingTables.has('cleaning_schedules')) {
      return fallbackStore.cleaningSchedules;
    }

    const supabase = getServerSupabaseClient();
    try {
      const { data, error } = await supabase
        .from('cleaning_schedules')
        .select('*')
        .eq('is_active', true)
        .order('time_of_day', { ascending: true });

      if (error) {
        if (this.isTableNotFoundError(error)) {
          this.missingTables.add('cleaning_schedules');
        }
        loadStoreFromDisk(fallbackStore);
        return fallbackStore.cleaningSchedules;
      }
      return data || fallbackStore.cleaningSchedules;
    } catch {
      this.missingTables.add('cleaning_schedules');
      loadStoreFromDisk(fallbackStore);
      return fallbackStore.cleaningSchedules;
    }
  }

  static async getCleaningLogs(limit = 50): Promise<CleaningLog[]> {
    loadStoreFromDisk(fallbackStore);
    if (this.missingTables.has('cleaning_logs')) {
      return fallbackStore.cleaningLogs.slice(0, limit);
    }

    const supabase = getServerSupabaseClient();
    try {
      const { data, error } = await supabase
        .from('cleaning_logs')
        .select('*')
        .order('cleaned_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (this.isTableNotFoundError(error)) {
          this.missingTables.add('cleaning_logs');
        }
        loadStoreFromDisk(fallbackStore);
        return fallbackStore.cleaningLogs.slice(0, limit);
      }
      return data || [];
    } catch {
      this.missingTables.add('cleaning_logs');
      loadStoreFromDisk(fallbackStore);
      return fallbackStore.cleaningLogs.slice(0, limit);
    }
  }

  static async createCleaningLog(data: {
    toilet_id: ToiletId;
    checklist?: string[];
    notes?: string | null;
    staff_identifier?: string | null;
  }): Promise<CleaningLog> {
    if (!TOILETS[data.toilet_id]) {
      throw new Error(`Invalid toilet ID: ${data.toilet_id}`);
    }

    const now = new Date().toISOString();
    const newLog = {
      toilet_id: data.toilet_id,
      cleaned_at: now,
      checklist: data.checklist || [
        'Sanitized toilet bowls & seats',
        'Replenished soap and toilet paper',
        'Emptied trash & mopped floor',
      ],
      notes: data.notes || null,
      staff_identifier: data.staff_identifier || 'Duty Staff',
      created_at: now,
    };

    const supabase = getServerSupabaseClient(true);
    try {
      const { data: created, error } = await supabase
        .from('cleaning_logs')
        .insert(newLog)
        .select()
        .single();

      if (error) {
        if (this.isTableNotFoundError(error)) {
          loadStoreFromDisk(fallbackStore);
          const item: CleaningLog = {
            id: `clean-${Date.now()}`,
            ...newLog,
          };
          fallbackStore.cleaningLogs.unshift(item);
          saveStoreToDisk(fallbackStore);
          return item;
        }
        throw error;
      }
      return created;
    } catch {
      loadStoreFromDisk(fallbackStore);
      const item: CleaningLog = {
        id: `clean-${Date.now()}`,
        ...newLog,
      };
      fallbackStore.cleaningLogs.unshift(item);
      saveStoreToDisk(fallbackStore);
      return item;
    }
  }

  // ============================================================================
  // Audit Logs
  // ============================================================================

  static async recordAdminAuditLog(data: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    details?: Record<string, unknown> | null;
    ip_address?: string | null;
  }): Promise<void> {
    const supabase = getServerSupabaseClient(true);
    const now = new Date().toISOString();
    try {
      await supabase.from('admin_audit_logs').insert({
        ...data,
        created_at: now,
      });
    } catch {
      loadStoreFromDisk(fallbackStore);
      fallbackStore.adminAuditLogs.unshift({
        id: `audit-${Date.now()}`,
        ...data,
        created_at: now,
      });
      saveStoreToDisk(fallbackStore);
    }
  }

  static async getAdminAuditLogs(limit = 50): Promise<AdminAuditLog[]> {
    loadStoreFromDisk(fallbackStore);
    const supabase = getServerSupabaseClient(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        loadStoreFromDisk(fallbackStore);
        return fallbackStore.adminAuditLogs.slice(0, limit);
      }
      return data || [];
    } catch {
      loadStoreFromDisk(fallbackStore);
      return fallbackStore.adminAuditLogs.slice(0, limit);
    }
  }

  static async getStatusHistory(limit = 100): Promise<ToiletStatusHistory[]> {
    loadStoreFromDisk(fallbackStore);
    const supabase = getServerSupabaseClient();
    try {
      const { data, error } = await supabase
        .from('toilet_status_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        loadStoreFromDisk(fallbackStore);
        return fallbackStore.statusHistory.slice(0, limit);
      }
      return data || [];
    } catch {
      loadStoreFromDisk(fallbackStore);
      return fallbackStore.statusHistory.slice(0, limit);
    }
  }

  // ============================================================================
  // Analytics Aggregation Engine
  // ============================================================================

  static async getAnalyticsData(period: AnalyticsPeriod): Promise<AnalyticsData> {
    loadStoreFromDisk(fallbackStore);
    const { startIso, endIso, dateKeys } = getDateRangeForPeriod(period);
    const supabase = getServerSupabaseClient();

    // 1. Fetch Status History in requested period
    let historyRecords: ToiletStatusHistory[] = [];
    if (this.missingTables.has('toilet_status_history')) {
      historyRecords = fallbackStore.statusHistory.filter(
        (h) => h.created_at >= startIso && h.created_at <= endIso
      );
    } else {
      try {
        const { data, error } = await supabase
          .from('toilet_status_history')
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: true });

        if (error) {
          if (this.isTableNotFoundError(error)) {
            this.missingTables.add('toilet_status_history');
            historyRecords = fallbackStore.statusHistory.filter(
              (h) => h.created_at >= startIso && h.created_at <= endIso
            );
          } else {
            throw error;
          }
        } else {
          historyRecords = data || [];
        }
      } catch {
        this.missingTables.add('toilet_status_history');
        historyRecords = fallbackStore.statusHistory.filter(
          (h) => h.created_at >= startIso && h.created_at <= endIso
        );
      }
    }

    // 2. Fetch Unresolved Supply Issues (Always CURRENT unresolved count, independent of period)
    let unresolvedSupplyCount = 0;
    let allPeriodReports: SupplyReport[] = [];
    if (this.missingTables.has('supply_reports')) {
      unresolvedSupplyCount = fallbackStore.supplyReports.filter(
        (r) => !r.is_archived && (r.status === 'pending' || r.status === 'in_progress')
      ).length;
      allPeriodReports = fallbackStore.supplyReports.filter(
        (r) => !r.is_archived && r.created_at >= startIso && r.created_at <= endIso
      );
    } else {
      try {
        const { count: unresCount, error: countErr } = await supabase
          .from('supply_reports')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'in_progress'])
          .eq('is_archived', false);

        if (countErr) {
          this.missingTables.add('supply_reports');
          unresolvedSupplyCount = fallbackStore.supplyReports.filter(
            (r) => !r.is_archived && (r.status === 'pending' || r.status === 'in_progress')
          ).length;
        } else {
          unresolvedSupplyCount = unresCount || 0;
        }

        // Fetch all reports in period for supply problems chart
        const { data: periodReports, error: repErr } = await supabase
          .from('supply_reports')
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .eq('is_archived', false);

        if (repErr) {
          this.missingTables.add('supply_reports');
          allPeriodReports = fallbackStore.supplyReports.filter(
            (r) => !r.is_archived && r.created_at >= startIso && r.created_at <= endIso
          );
        } else {
          allPeriodReports = periodReports || [];
        }
      } catch {
        this.missingTables.add('supply_reports');
        unresolvedSupplyCount = fallbackStore.supplyReports.filter(
          (r) => !r.is_archived && (r.status === 'pending' || r.status === 'in_progress')
        ).length;
        allPeriodReports = fallbackStore.supplyReports.filter(
          (r) => !r.is_archived && r.created_at >= startIso && r.created_at <= endIso
        );
      }
    }

    // 3. Fetch Cleaning Logs & Schedules
    let periodCleaningLogsCount = 0;
    const activeSchedules = await this.getCleaningSchedules();
    const scheduledPerDay = activeSchedules.length; // e.g. 6 tasks/day
    const daysCount = dateKeys.length;
    const totalScheduledTasks = scheduledPerDay * daysCount;

    if (this.missingTables.has('cleaning_logs')) {
      periodCleaningLogsCount = fallbackStore.cleaningLogs.filter(
        (c) => c.cleaned_at >= startIso && c.cleaned_at <= endIso
      ).length;
    } else {
      try {
        const { count: cCount, error: cleanErr } = await supabase
          .from('cleaning_logs')
          .select('*', { count: 'exact', head: true })
          .gte('cleaned_at', startIso)
          .lte('cleaned_at', endIso);

        if (cleanErr) {
          if (this.isTableNotFoundError(cleanErr)) {
            this.missingTables.add('cleaning_logs');
          }
          periodCleaningLogsCount = fallbackStore.cleaningLogs.filter(
            (c) => c.cleaned_at >= startIso && c.cleaned_at <= endIso
          ).length;
        } else {
          periodCleaningLogsCount = cCount || 0;
        }
      } catch {
        this.missingTables.add('cleaning_logs');
        periodCleaningLogsCount = fallbackStore.cleaningLogs.filter(
          (c) => c.cleaned_at >= startIso && c.cleaned_at <= endIso
        ).length;
      }
    }

    // 4. Aggregate Metrics
    const totalStatusChanges = historyRecords.length;
    const occupiedTransitions = historyRecords.filter((h) => h.new_status === 'occupied').length;
    const maintenanceTransitions = historyRecords.filter((h) => h.new_status === 'maintenance').length;

    // Daily breakdown map
    const dailyMap = new Map<string, { changes: number; occupied: number; maintenance: number }>();
    for (const dk of dateKeys) {
      dailyMap.set(dk, { changes: 0, occupied: 0, maintenance: 0 });
    }

    // Hourly map (0..23) for occupied transitions
    const hourlyMap = new Array<number>(24).fill(0);

    // Toilet comparison
    const comparison = {
      mens: {
        name: "Men's Toilet",
        totalChanges: 0,
        occupiedTransitions: 0,
        currentStatus: 'available' as ToiletStatus,
      },
      womens: {
        name: "Women's Toilet",
        totalChanges: 0,
        occupiedTransitions: 0,
        currentStatus: 'available' as ToiletStatus,
      },
    };

    // Populate current statuses
    const currentToilets = await this.getToiletsWithFreshness();
    for (const ct of currentToilets) {
      if (comparison[ct.id]) {
        comparison[ct.id].currentStatus = ct.status;
      }
    }

    for (const rec of historyRecords) {
      const dk = getKathmanduDateString(rec.created_at);
      const dayData = dailyMap.get(dk);
      if (dayData) {
        dayData.changes += 1;
        if (rec.new_status === 'occupied') dayData.occupied += 1;
        if (rec.new_status === 'maintenance') dayData.maintenance += 1;
      }

      if (rec.new_status === 'occupied') {
        const localHour = getKathmanduHour(rec.created_at);
        if (localHour >= 0 && localHour <= 23) {
          hourlyMap[localHour] += 1;
        }
      }

      if (rec.toilet_id === 'mens' || rec.toilet_id === 'womens') {
        comparison[rec.toilet_id].totalChanges += 1;
        if (rec.new_status === 'occupied') {
          comparison[rec.toilet_id].occupiedTransitions += 1;
        }
      }
    }

    const dailyActivity = dateKeys.map((dk) => {
      const item = dailyMap.get(dk) || { changes: 0, occupied: 0, maintenance: 0 };
      const d = new Date(dk + 'T12:00:00Z');
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(d);

      return {
        date: dk,
        formattedDate,
        changes: item.changes,
        occupied: item.occupied,
        maintenance: item.maintenance,
      };
    });

    const occupiedByHour = hourlyMap.map((count, hour) => {
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      return {
        hour,
        label: `${h12}${ampm}`,
        count,
      };
    });

    const maintenanceFrequency = dailyActivity.map((d) => ({
      date: d.date,
      formattedDate: d.formattedDate,
      count: d.maintenance,
    }));

    // Supply problems grouping
    const categoryCounts: Record<SupplyCategory, number> = {
      Soap: 0,
      'Toilet paper': 0,
      'Paper towels': 0,
      'Hand sanitizer': 0,
      Other: 0,
    };
    const toiletProblemCounts: Record<ToiletId, number> = {
      mens: 0,
      womens: 0,
    };

    for (const report of allPeriodReports) {
      if (categoryCounts[report.category] !== undefined) {
        categoryCounts[report.category] += 1;
      }
      if (toiletProblemCounts[report.toilet_id] !== undefined) {
        toiletProblemCounts[report.toilet_id] += 1;
      }
    }

    const supplyByCategory = (Object.keys(categoryCounts) as SupplyCategory[]).map((cat) => ({
      category: cat,
      count: categoryCounts[cat],
    }));

    const supplyByToilet: Array<{ toiletId: ToiletId; toiletName: string; count: number }> = [
      { toiletId: 'mens', toiletName: "Men's Toilet", count: toiletProblemCounts.mens },
      { toiletId: 'womens', toiletName: "Women's Toilet", count: toiletProblemCounts.womens },
    ];

    const cleaningRate = totalScheduledTasks > 0
      ? Math.min(100, Math.round((periodCleaningLogsCount / totalScheduledTasks) * 100))
      : 0;

    return {
      period,
      timezone: 'Asia/Kathmandu',
      totalStatusChanges,
      occupiedReports: occupiedTransitions,
      maintenanceReports: maintenanceTransitions,
      unresolvedSupplyIssues: unresolvedSupplyCount,
      cleaningCompletion: {
        completed: periodCleaningLogsCount,
        scheduled: totalScheduledTasks,
        rate: cleaningRate,
        isConfigured: totalScheduledTasks > 0,
      },
      dailyActivity,
      occupiedByHour,
      toiletComparison: comparison,
      maintenanceFrequency,
      supplyProblems: {
        byCategory: supplyByCategory,
        byToilet: supplyByToilet,
      },
    };
  }
}
