'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import {
  ToiletWithFreshness,
  SupplyReport,
  ToiletStatus,
  SupplyStatus,
  ToiletId,
  CleaningSchedule,
  CleaningLog,
  ToiletStatusHistory,
  AdminAuditLog,
} from '@/types';
import {
  Shield,
  KeyRound,
  AlertTriangle,
  Clock,
  Trash2,
  Archive,
  RefreshCw,
  Filter,
  CheckSquare,
  Sparkles,
  Package,
  RotateCcw,
  CheckCircle2,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { formatKathmanduDateTime, formatRelativeTime } from '@/lib/utils/date';
import { SUPPLY_CATEGORIES, SUPPLY_SEVERITIES, SUPPLY_STATUSES } from '@/lib/constants';
import { parseUserAgentToDeviceInfo } from '@/lib/utils/device';

export default function AdminPage() {
  // Authorization State (Account-free pass-secret)
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(false);
  const [adminSecretInput, setAdminSecretInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'toilets' | 'supplies' | 'cleanings' | 'history'>('toilets');

  // Data States
  const [toilets, setToilets] = useState<ToiletWithFreshness[]>([]);
  const [supplyReports, setSupplyReports] = useState<SupplyReport[]>([]);
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [statusHistory, setStatusHistory] = useState<ToiletStatusHistory[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Feedback notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters for Supplies
  const [toiletFilter, setToiletFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);

  // Filter for Toilets requiring verification
  const [onlyStaleToilets, setOnlyStaleToilets] = useState<boolean>(false);

  // Modal / Confirm state for destructive actions
  const [deleteCandidate, setDeleteCandidate] = useState<SupplyReport | null>(null);
  const [resolutionModalReport, setResolutionModalReport] = useState<SupplyReport | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [newTargetStatus, setNewTargetStatus] = useState<SupplyStatus>('resolved');

  // Cleaning Log Form State
  const [cleaningToiletId, setCleaningToiletId] = useState<ToiletId>('mens');
  const [cleaningStaff, setCleaningStaff] = useState<string>('Duty Staff');
  const [cleaningNotes, setCleaningNotes] = useState<string>('');
  const cleaningChecklist = [
    'Disinfected toilet bowls and handles',
    'Restocked paper towels and toilet paper',
    'Refilled hand soap & sanitizer dispensers',
    'Emptied trash bins and replaced liners',
    'Mopped floor with disinfectant solution',
  ];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper for authorized fetch headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const savedSecret = typeof window !== 'undefined' ? sessionStorage.getItem('neo_admin_key') : null;
    if (savedSecret) {
      headers['x-admin-secret'] = savedSecret;
    }
    return headers;
  }, []);

  // Fetch all admin data (supports quiet background refresh)
  const loadAdminData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingData(true);
    setIsRefreshing(true);
    try {
      const headers = getAuthHeaders();
      const [toiletsRes, suppliesRes, cleaningsRes, auditRes] = await Promise.all([
        fetch('/api/toilets', { cache: 'no-store' }),
        fetch('/api/supplies?includeArchived=true', {
          headers,
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/cleanings', { cache: 'no-store' }),
        fetch('/api/admin/audit-logs', {
          headers,
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      if (toiletsRes.ok) {
        const tJson = await toiletsRes.json();
        setToilets(tJson.data || []);
      }

      if (suppliesRes.ok) {
        const sJson = await suppliesRes.json();
        setSupplyReports(sJson.data || []);
      }

      if (cleaningsRes.ok) {
        const cJson = await cleaningsRes.json();
        setSchedules(cJson.data?.schedules || []);
        setCleaningLogs(cJson.data?.logs || []);
      }

      if (auditRes.ok) {
        const aJson = await auditRes.json();
        setStatusHistory(aJson.data?.statusHistory || []);
        setAdminAuditLogs(aJson.data?.adminAuditLogs || []);
      }
    } catch {
      if (!isSilent) {
        showNotification('error', 'Error syncing admin data from server');
      }
    } finally {
      if (!isSilent) setIsLoadingData(false);
      setIsRefreshing(false);
    }
  }, [getAuthHeaders]);

  // Read URL query parameter for tab or secret on initial load
  useEffect(() => {
    let ignore = false;

    const verifyAndInit = async () => {
      let candidateKey: string | null = null;

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);

        // Direct tab link: e.g. /admin?tab=supplies
        const tabParam = urlParams.get('tab');
        if (tabParam && ['toilets', 'supplies', 'cleanings', 'history'].includes(tabParam)) {
          setActiveTab(tabParam as 'toilets' | 'supplies' | 'cleanings' | 'history');
        }

        // Direct secret bookmark: e.g. /admin?key=neospark
        const keyParam = urlParams.get('key');
        if (keyParam) {
          candidateKey = keyParam.trim();
          // Clean the secret from browser address bar without reload
          urlParams.delete('key');
          const cleanUrl =
            window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
          window.history.replaceState({}, '', cleanUrl);
        } else {
          candidateKey = sessionStorage.getItem('neo_admin_key');
        }
      }

      // If we have a candidate secret from URL or sessionStorage, verify it
      if (candidateKey) {
        try {
          const res = await fetch('/api/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: candidateKey }),
            credentials: 'include',
          });
          const data = await res.json();
          if (res.ok && data.success && !ignore) {
            sessionStorage.setItem('neo_admin_key', candidateKey);
            setIsAdminAuthorized(true);
            await loadAdminData(false);
            return;
          }
        } catch {
          // Fall through to cookie check
        }
      }

      // Check existing HTTP-only cookie session
      try {
        const checkRes = await fetch('/api/admin/verify', {
          credentials: 'include',
          cache: 'no-store',
        });
        const checkData = await checkRes.json();
        if (checkRes.ok && checkData.authorized && !ignore) {
          setIsAdminAuthorized(true);
          await loadAdminData(false);
          return;
        }
      } catch {
        // Not authorized
      }

      if (!ignore) {
        setIsLoadingData(false);
      }
    };

    verifyAndInit();

    return () => {
      ignore = true;
    };
  }, [loadAdminData]);

  // Background Auto-Refresh (Every 7s while authorized and tab is visible)
  useEffect(() => {
    if (!isAdminAuthorized) return;

    let ignore = false;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !ignore) {
        loadAdminData(true);
      }
    }, 7000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !ignore) {
        loadAdminData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      ignore = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAdminAuthorized, loadAdminData]);

  // Handle Secret Submission
  const handleVerifySecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsVerifyingAuth(true);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ secret: adminSecretInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid admin passcode');
      }

      sessionStorage.setItem('neo_admin_key', adminSecretInput.trim());
      setIsAdminAuthorized(true);
      setAdminSecretInput('');
      showNotification('success', 'Admin access unlocked');
      loadAdminData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(msg);
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('neo_admin_key');
    await fetch('/api/admin/verify', { method: 'DELETE', credentials: 'include' });
    setIsAdminAuthorized(false);
    showNotification('success', 'Admin console locked');
  };

  // 1. Toilet Status Update from Admin with Instant Optimistic UI & Toggle Support
  const handleAdminToiletStatusUpdate = async (toiletId: ToiletId, newStatus: ToiletStatus) => {
    const current = toilets.find((t) => t.id === toiletId);
    const resolvedStatus: ToiletStatus =
      current && current.status === newStatus && newStatus !== 'available'
        ? 'available'
        : newStatus;

    const previousToilets = toilets;
    const nowIso = new Date().toISOString();

    // Instant optimistic update
    setToilets((prev) =>
      prev.map((t) =>
        t.id === toiletId
          ? {
              ...t,
              status: resolvedStatus,
              displayStatus: resolvedStatus,
              isStale: false,
              last_status_update: nowIso,
            }
          : t
      )
    );
    showNotification('success', `Updated ${toiletId === 'mens' ? "Men's" : "Women's"} to ${resolvedStatus}`);

    try {
      const res = await fetch('/api/toilets/status', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ toiletId, status: resolvedStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Status update failed');

      if (data.data) {
        setToilets((prev) => prev.map((t) => (t.id === toiletId ? data.data : t)));
      }
    } catch (err: unknown) {
      setToilets(previousToilets);
      const msg = err instanceof Error ? err.message : 'Error updating status';
      showNotification('error', msg);
    }
  };

  // 2. Queue +/- Stepper from Admin with Instant Optimistic UI
  const handleQueueChange = async (toiletId: ToiletId, delta: number) => {
    const previousToilets = toilets;
    setToilets((prev) =>
      prev.map((t) =>
        t.id === toiletId
          ? { ...t, queue_count: Math.max(0, (t.queue_count ?? 0) + delta) }
          : t
      )
    );

    try {
      const res = await fetch('/api/toilets/queue', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ toiletId, delta }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Queue update failed');
      if (data.data) {
        setToilets((prev) => prev.map((t) => (t.id === toiletId ? data.data : t)));
      }
    } catch (err: unknown) {
      setToilets(previousToilets);
      const msg = err instanceof Error ? err.message : 'Queue update failed';
      showNotification('error', msg);
    }
  };

  // 3. Supply Status Update with Instant Optimistic UI
  const handleUpdateSupplyStatus = async (
    id: string,
    targetStatus: SupplyStatus,
    note?: string
  ) => {
    const previousReports = supplyReports;
    const nowIso = new Date().toISOString();

    // Instant optimistic update
    setSupplyReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: targetStatus,
              resolution_note: note !== undefined ? note : r.resolution_note,
              resolved_at: targetStatus === 'resolved' ? nowIso : null,
              updated_at: nowIso,
            }
          : r
      )
    );
    showNotification('success', `Report updated to ${targetStatus === 'in_progress' ? 'In Progress' : targetStatus}`);
    setResolutionModalReport(null);
    setResolutionNote('');

    try {
      const res = await fetch(`/api/supplies/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          status: targetStatus,
          resolution_note: note || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update report');

      if (data.data) {
        setSupplyReports((prev) => prev.map((r) => (r.id === id ? data.data : r)));
      }
    } catch (err: unknown) {
      setSupplyReports(previousReports);
      const msg = err instanceof Error ? err.message : 'Error updating report';
      showNotification('error', msg);
    }
  };

  // 4. Toggle Archive Report with Instant Optimistic UI
  const handleToggleArchive = async (report: SupplyReport) => {
    const previousReports = supplyReports;
    const nextArchived = !report.is_archived;

    // Instant optimistic update
    setSupplyReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, is_archived: nextArchived } : r))
    );
    showNotification('success', nextArchived ? 'Report archived' : 'Report unarchived');

    try {
      const res = await fetch(`/api/supplies/${report.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          is_archived: nextArchived,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle archive');
    } catch (err: unknown) {
      setSupplyReports(previousReports);
      const msg = err instanceof Error ? err.message : 'Archive action failed';
      showNotification('error', msg);
    }
  };

  // 5. Delete Report with Instant Optimistic UI
  const handleDeleteReport = async () => {
    if (!deleteCandidate) return;
    const candidateId = deleteCandidate.id;
    const previousReports = supplyReports;

    // Instant optimistic removal
    setSupplyReports((prev) => prev.filter((r) => r.id !== candidateId));
    setDeleteCandidate(null);
    showNotification('success', 'Report permanently deleted');

    try {
      const res = await fetch(`/api/supplies/${candidateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
    } catch (err: unknown) {
      setSupplyReports(previousReports);
      const msg = err instanceof Error ? err.message : 'Delete action failed';
      showNotification('error', msg);
    }
  };

  // 6. Submit Cleaning Log with Instant Optimistic UI
  const handleLogCleaningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const tempLog: CleaningLog = {
      id: `clean-${Date.now()}`,
      toilet_id: cleaningToiletId,
      cleaned_at: nowIso,
      checklist: cleaningChecklist,
      notes: cleaningNotes.trim() || undefined,
      staff_identifier: cleaningStaff.trim() || 'Duty Staff',
      created_at: nowIso,
    };

    setCleaningLogs((prev) => [tempLog, ...prev]);
    showNotification('success', 'Cleaning log recorded successfully');
    setCleaningNotes('');

    try {
      const res = await fetch('/api/cleanings', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          toilet_id: cleaningToiletId,
          checklist: cleaningChecklist,
          notes: cleaningNotes.trim() || undefined,
          staff_identifier: cleaningStaff.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to log cleaning');
      if (data.data) {
        setCleaningLogs((prev) => prev.map((l) => (l.id === tempLog.id ? data.data : l)));
      }
    } catch (err: unknown) {
      setCleaningLogs((prev) => prev.filter((l) => l.id !== tempLog.id));
      const msg = err instanceof Error ? err.message : 'Log cleaning error';
      showNotification('error', msg);
    }
  };

  // Filtered supply reports
  const filteredReports = useMemo(() => {
    return supplyReports.filter((r) => {
      if (!includeArchived && r.is_archived) return false;
      if (toiletFilter !== 'all' && r.toilet_id !== toiletFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [supplyReports, includeArchived, toiletFilter, categoryFilter, severityFilter, statusFilter]);

  // Derived counts for alerts & tab badges
  const unresolvedReports = useMemo(
    () => supplyReports.filter((r) => !r.is_archived && (r.status === 'pending' || r.status === 'in_progress')),
    [supplyReports]
  );
  const pendingCount = useMemo(
    () => supplyReports.filter((r) => !r.is_archived && r.status === 'pending').length,
    [supplyReports]
  );
  const inProgressCount = useMemo(
    () => supplyReports.filter((r) => !r.is_archived && r.status === 'in_progress').length,
    [supplyReports]
  );
  const resolvedCount = useMemo(
    () => supplyReports.filter((r) => r.status === 'resolved').length,
    [supplyReports]
  );
  const urgentCount = useMemo(
    () => supplyReports.filter((r) => !r.is_archived && r.severity === 'Urgent').length,
    [supplyReports]
  );
  const staleToiletsCount = useMemo(
    () => toilets.filter((t) => t.isStale || t.displayStatus === 'needs_verification').length,
    [toilets]
  );

  const hasActiveFilters =
    toiletFilter !== 'all' ||
    categoryFilter !== 'all' ||
    severityFilter !== 'all' ||
    statusFilter !== 'all' ||
    includeArchived;

  const resetFilters = () => {
    setToiletFilter('all');
    setCategoryFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setIncludeArchived(false);
  };

  // Filtered toilets (stale only)
  const displayedToilets = onlyStaleToilets
    ? toilets.filter((t) => t.displayStatus === 'needs_verification' || t.isStale)
    : toilets;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100 pb-16">
      <Header onRefresh={() => loadAdminData(false)} isRefreshing={isRefreshing} />

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Auth Gate if secret not verified */}
        {!isAdminAuthorized ? (
          <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 mt-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Admin Management Console</h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Account-free facilities management. Enter the admin secret passcode to manage supplies, view audit records, and override statuses.
            </p>

            {authError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
                {authError}
              </div>
            )}

            <form onSubmit={handleVerifySecret} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Admin Passcode
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <input
                    type="password"
                    value={adminSecretInput}
                    onChange={(e) => setAdminSecretInput(e.target.value)}
                    placeholder="Enter secret passcode..."
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifyingAuth || !adminSecretInput}
                className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
              >
                {isVerifyingAuth ? 'Verifying...' : 'Unlock Management Console'}
              </button>
            </form>
          </div>
        ) : (
          /* Authorized Admin Console */
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold">Admin Management Console</h1>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                      Live Unlocked
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Restroom operations, supply reports, cleaning records & audit history
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadAdminData(false)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition shadow-2xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 transition"
                >
                  Lock Console
                </button>
              </div>
            </div>

            {/* Notification Toast */}
            {notification && (
              <div
                className={`rounded-xl p-3.5 text-xs font-medium flex items-center justify-between animate-in fade-in ${
                  notification.type === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {notification.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                  <span>{notification.message}</span>
                </div>
                <button
                  onClick={() => setNotification(null)}
                  className="text-xs opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Active Unresolved Supply Reports Alert Banner (when on other tabs) */}
            {unresolvedReports.length > 0 && activeTab !== 'supplies' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                      {unresolvedReports.length} Active Supply {unresolvedReports.length === 1 ? 'Report' : 'Reports'} Pending Review
                    </span>
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                      Restrooms require restocking ({unresolvedReports.map((r) => `${r.category} (${r.toilet_name || r.toilet_id})`).join(', ')})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('supplies')}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-1.5 transition whitespace-nowrap self-start sm:self-auto active:scale-95 shadow-xs"
                >
                  Review Supply Issues →
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2 overflow-x-auto pb-px">
              {[
                { id: 'toilets', label: 'Toilets & Freshness', count: staleToiletsCount, isStaleBadge: true },
                { id: 'supplies', label: 'Supply Reports', count: unresolvedReports.length, isSupplyBadge: true },
                { id: 'cleanings', label: 'Cleaning Shifts & Logs', count: cleaningLogs.length },
                { id: 'history', label: 'Activity & Audit Log', count: statusHistory.length },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'toilets' | 'supplies' | 'cleanings' | 'history')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
                      isActive
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.isSupplyBadge && tab.count > 0 ? (
                      <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-extrabold animate-pulse">
                        {tab.count} Active
                      </span>
                    ) : tab.count > 0 ? (
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-mono">
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Toilets & Freshness */}
            {activeTab === 'toilets' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Restroom Freshness & Manual Overrides
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      View real-time freshness state and enforce manual status changes
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyStaleToilets}
                      onChange={(e) => setOnlyStaleToilets(e.target.checked)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show only toilets needing verification ({staleToiletsCount})</span>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {displayedToilets.map((toilet) => (
                    <div
                      key={toilet.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-base">{toilet.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>
                              Last update: {formatRelativeTime(toilet.last_status_update)} ({formatKathmanduDateTime(toilet.last_status_update)})
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                              toilet.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : toilet.status === 'occupied'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {toilet.status}
                          </span>
                          {toilet.isStale && (
                            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
                              Needs Verification
                            </span>
                          )}
                        </div>
                      </div>

                      {toilet.isStale && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>Status was not updated in over {toilet.minutesSinceUpdate} minutes.</span>
                        </div>
                      )}

                      {/* Manual Override Buttons */}
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Admin Override Status
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleAdminToiletStatusUpdate(toilet.id, 'available')}
                            className="rounded-lg border border-zinc-200 py-1.5 text-xs font-semibold hover:border-emerald-500 hover:bg-emerald-50 active:scale-95 transition dark:border-zinc-800 dark:hover:bg-emerald-950/40"
                          >
                            Set Available
                          </button>
                          <button
                            onClick={() => handleAdminToiletStatusUpdate(toilet.id, 'occupied')}
                            className="rounded-lg border border-zinc-200 py-1.5 text-xs font-semibold hover:border-rose-500 hover:bg-rose-50 active:scale-95 transition dark:border-zinc-800 dark:hover:bg-rose-950/40"
                          >
                            Set Occupied
                          </button>
                          <button
                            onClick={() => handleAdminToiletStatusUpdate(toilet.id, 'maintenance')}
                            className="rounded-lg border border-zinc-200 py-1.5 text-xs font-semibold hover:border-amber-500 hover:bg-amber-50 active:scale-95 transition dark:border-zinc-800 dark:hover:bg-amber-950/40"
                          >
                            Set Maintenance
                          </button>
                        </div>
                      </div>

                      {/* Waiting Queue Stepper */}
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50 flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                          Waiting Queue: <strong className="text-zinc-900 dark:text-zinc-100">{toilet.queue_count} waiting</strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleQueueChange(toilet.id, -1)}
                            disabled={toilet.queue_count <= 0}
                            title="Decrement queue"
                            className="h-7 w-7 rounded-lg border border-zinc-200 bg-white font-bold hover:bg-zinc-100 active:scale-95 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 flex items-center justify-center transition shadow-2xs"
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleQueueChange(toilet.id, 1)}
                            title="Increment queue"
                            className="h-7 w-7 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 active:scale-95 dark:border-indigo-800 dark:bg-indigo-950 flex items-center justify-center transition shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Supply Reports Management */}
            {activeTab === 'supplies' && (
              <div className="space-y-4">
                {/* Quick Status Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: 'All Reports', count: supplyReports.length },
                    { id: 'pending', label: 'Pending', count: pendingCount },
                    { id: 'in_progress', label: 'In Progress', count: inProgressCount },
                    { id: 'resolved', label: 'Resolved', count: resolvedCount },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      onClick={() => setStatusFilter(pill.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                        statusFilter === pill.id
                          ? 'bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span className="text-[10px] opacity-80 font-mono">({pill.count})</span>
                    </button>
                  ))}

                  {urgentCount > 0 && (
                    <button
                      onClick={() => setSeverityFilter(severityFilter === 'Urgent' ? 'all' : 'Urgent')}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                        severityFilter === 'Urgent'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      <span>Urgent Only</span>
                      <span className="text-[10px] font-mono">({urgentCount})</span>
                    </button>
                  )}

                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="ml-auto text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset Filters</span>
                    </button>
                  )}
                </div>

                {/* Filter Controls Bar */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Detailed Filter Controls</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {/* Restroom */}
                    <select
                      value={toiletFilter}
                      onChange={(e) => setToiletFilter(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="all">All Restrooms</option>
                      <option value="mens">Men&apos;s Toilet</option>
                      <option value="womens">Women&apos;s Toilet</option>
                    </select>

                    {/* Category */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="all">All Categories</option>
                      {SUPPLY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* Severity */}
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="all">All Severities</option>
                      {SUPPLY_SEVERITIES.map((sev) => (
                        <option key={sev} value={sev}>
                          {sev}
                        </option>
                      ))}
                    </select>

                    {/* Status */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="all">All Statuses</option>
                      {SUPPLY_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st === 'pending' ? 'Pending' : st === 'in_progress' ? 'In Progress' : 'Resolved'}
                        </option>
                      ))}
                    </select>

                    {/* Archived toggle */}
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer self-center">
                      <input
                        type="checkbox"
                        checked={includeArchived}
                        onChange={(e) => setIncludeArchived(e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Include Archived</span>
                    </label>
                  </div>
                </div>

                {/* Reports List */}
                {supplyReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 mb-3">
                      <Package className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      No supply reports recorded yet
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                      When users submit reports from the home page (such as missing soap or toilet paper), they will instantly appear here.
                    </p>
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No reports match the selected filters.
                    </p>
                    <button
                      onClick={resetFilters}
                      className="mt-3 rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 transition"
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((report) => (
                      <div
                        key={report.id}
                        className={`rounded-2xl border p-4 shadow-xs transition ${
                          report.is_archived
                            ? 'opacity-60 bg-zinc-50 border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800'
                            : report.severity === 'Urgent' && report.status !== 'resolved'
                            ? 'bg-rose-50/30 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60'
                            : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                {report.toilet_name || (report.toilet_id === 'mens' ? "Men's Toilet" : "Women's Toilet")}
                              </span>
                              <span className="text-zinc-400">•</span>
                              <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                                {report.category}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  report.severity === 'Urgent'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                }`}
                              >
                                {report.severity}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  report.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : report.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {report.status === 'in_progress' ? 'In Progress' : report.status}
                              </span>
                              {report.is_archived && (
                                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                  Archived
                                </span>
                              )}
                            </div>

                            {report.description && (
                              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                                {report.description}
                              </p>
                            )}

                            {report.resolution_note && (
                              <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg inline-block border border-emerald-100 dark:border-emerald-900/60">
                                Resolution Note: {report.resolution_note}
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                              <span>Reported: {formatRelativeTime(report.created_at)} ({formatKathmanduDateTime(report.created_at)})</span>
                              {report.resolved_at && (
                                <span>Resolved: {formatRelativeTime(report.resolved_at)}</span>
                              )}
                              {report.ip_address && (
                                <span className="font-mono text-[10px] text-zinc-400">
                                  IP: {report.ip_address}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 sm:self-center">
                            {report.status !== 'in_progress' && report.status !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateSupplyStatus(report.id, 'in_progress')}
                                className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 active:scale-95 transition dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                              >
                                Mark In Progress
                              </button>
                            )}

                            {report.status !== 'resolved' ? (
                              <button
                                onClick={() => {
                                  setResolutionModalReport(report);
                                  setNewTargetStatus('resolved');
                                  setResolutionNote('');
                                }}
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 transition shadow-xs"
                              >
                                Resolve...
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateSupplyStatus(report.id, 'pending')}
                                className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 active:scale-95 transition dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                              >
                                Reopen Report
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleArchive(report)}
                              title={report.is_archived ? 'Unarchive' : 'Archive'}
                              className="rounded-xl border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100 active:scale-95 transition dark:border-zinc-800 dark:hover:bg-zinc-800"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => setDeleteCandidate(report)}
                              title="Delete permanently"
                              className="rounded-xl border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 active:scale-95 transition dark:border-rose-900 dark:hover:bg-rose-950/60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Cleaning Records & Shift Logging */}
            {activeTab === 'cleanings' && (
              <div className="space-y-6">
                {/* Log a New Cleaning Shift Form */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Record Cleaning Inspection
                    </h2>
                  </div>

                  <form onSubmit={handleLogCleaningSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                          Restroom
                        </label>
                        <select
                          value={cleaningToiletId}
                          onChange={(e) => setCleaningToiletId(e.target.value as ToiletId)}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          <option value="mens">Men&apos;s Toilet</option>
                          <option value="womens">Women&apos;s Toilet</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                          Staff Identifier / Tag
                        </label>
                        <input
                          type="text"
                          value={cleaningStaff}
                          onChange={(e) => setCleaningStaff(e.target.value)}
                          placeholder="e.g. Duty Shift A / Staff Tag"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                        Completed Checklist
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {cleaningChecklist.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                            <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                        Notes / Observations (Optional)
                      </label>
                      <input
                        type="text"
                        value={cleaningNotes}
                        onChange={(e) => setCleaningNotes(e.target.value)}
                        placeholder="e.g. Floors scrubbed, all dispensers checked"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>

                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 shadow-sm transition"
                    >
                      Record Cleaning Completion
                    </button>
                  </form>
                </div>

                {/* Schedules & Recent Logs */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Daily Scheduled Shifts */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-bold text-sm mb-3">Daily Cleaning Schedule</h3>
                    <div className="space-y-2">
                      {schedules.map((sch) => (
                        <div
                          key={sch.id}
                          className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800"
                        >
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {sch.shift_name}
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              {sch.toilet_id === 'mens' ? "Men's Toilet" : "Women's Toilet"}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {sch.time_of_day} NPT
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Cleaning Logs */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-bold text-sm mb-3">Recent Cleaning History</h3>
                    {cleaningLogs.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-6 text-center">No cleanings logged yet</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {cleaningLogs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-xl border border-zinc-100 p-2.5 text-xs dark:border-zinc-800 space-y-1"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold">
                                {log.toilet_id === 'mens' ? "Men's Toilet" : "Women's Toilet"}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                {formatKathmanduDateTime(log.cleaned_at)}
                              </span>
                            </div>
                            {log.notes && (
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 italic">
                                &ldquo;{log.notes}&rdquo;
                              </p>
                            )}
                            <div className="text-[10px] text-zinc-400">
                              Staff: {log.staff_identifier || 'Duty Staff'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Activity & Audit Log */}
            {activeTab === 'history' && (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Toilet Status Transition History */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="font-bold text-sm mb-3">Toilet Status Transition History</h3>
                  {statusHistory.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-6 text-center">No history recorded yet</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {statusHistory.map((hist) => (
                        <div
                          key={hist.id}
                          className="rounded-xl border border-zinc-100 p-2.5 text-xs dark:border-zinc-800"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold">
                              {hist.toilet_id === 'mens' ? "Men's Toilet" : "Women's Toilet"}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {formatRelativeTime(hist.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                            <span className="capitalize">{hist.previous_status || 'Initial'}</span>
                            <span>→</span>
                            <span className="font-bold capitalize text-blue-600 dark:text-blue-400">
                              {hist.new_status}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                            {hist.user_agent && (
                              <span className="flex items-center gap-1">
                                <Smartphone className="h-3 w-3" />
                                {parseUserAgentToDeviceInfo(hist.user_agent)}
                              </span>
                            )}
                            {hist.ip_address && (
                              <span className="font-mono">IP: {hist.ip_address}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Action Audit Trail */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="font-bold text-sm mb-3">Admin Action Audit Log</h3>
                  {adminAuditLogs.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-6 text-center">No admin actions recorded yet</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {adminAuditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-xl border border-zinc-100 p-2.5 text-xs dark:border-zinc-800"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {formatRelativeTime(log.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500">
                            Target: {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''}
                          </p>
                          {log.ip_address && (
                            <div className="mt-1 text-[10px] text-zinc-400 font-mono">
                              Admin IP: {log.ip_address}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal for Delete */}
        {deleteCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Confirm Deletion
              </h3>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Are you sure you want to permanently delete this report for{' '}
                <strong>{deleteCandidate.category}</strong>? This action cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setDeleteCandidate(null)}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteReport}
                  className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95 shadow-sm transition"
                >
                  Delete Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resolution Note Modal */}
        {resolutionModalReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Resolve Supply Issue
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Resolving {resolutionModalReport.category} report for{' '}
                {resolutionModalReport.toilet_name || resolutionModalReport.toilet_id}
              </p>

              <div className="mt-3">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Resolution Note (Optional)
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g. Replenished 3 bottles of antibacterial soap"
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setResolutionModalReport(null)}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleUpdateSupplyStatus(
                      resolutionModalReport.id,
                      newTargetStatus,
                      resolutionNote.trim()
                    )
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 shadow-sm transition"
                >
                  Confirm Resolved
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
