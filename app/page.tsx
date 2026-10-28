'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { ToiletStatusCard } from '@/components/ToiletStatusCard';
import { LiveActivityBanner } from '@/components/LiveActivityBanner';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { SupplyIssuesList } from '@/components/SupplyIssuesList';
import { SupplyReportModal } from '@/components/SupplyReportModal';
import { DeviceActivityLog } from '@/components/DeviceActivityLog';
import { ToiletWithFreshness, SupplyReport, ToiletStatus } from '@/types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseUserAgentToDeviceInfo } from '@/lib/utils/device';

export default function Home() {
  const [toilets, setToilets] = useState<ToiletWithFreshness[]>([]);
  const [supplyReports, setSupplyReports] = useState<SupplyReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState<number>(0);
  const statusSeqRef = useRef<{ mens: number; womens: number }>({ mens: 0, womens: 0 });

  const fetchToiletsAndSupplies = useCallback(async () => {
    try {
      const [toiletsRes, suppliesRes] = await Promise.all([
        fetch('/api/toilets', { cache: 'no-store' }),
        fetch('/api/supplies?unresolvedOnly=true', { cache: 'no-store' }),
      ]);

      if (toiletsRes.ok) {
        const tJson = await toiletsRes.json();
        if (tJson.success && Array.isArray(tJson.data)) {
          setToilets(tJson.data);
        }
      }

      if (suppliesRes.ok) {
        const sJson = await suppliesRes.json();
        if (sJson.success && Array.isArray(sJson.data)) {
          setSupplyReports(sJson.data);
        }
      }
    } catch {
      // Graceful offline / error handling
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    const runSync = async () => {
      try {
        const [toiletsRes, suppliesRes] = await Promise.all([
          fetch('/api/toilets', { cache: 'no-store' }),
          fetch('/api/supplies?unresolvedOnly=true', { cache: 'no-store' }),
        ]);

        if (toiletsRes.ok && !ignore) {
          const tJson = await toiletsRes.json();
          if (tJson.success && Array.isArray(tJson.data)) {
            setToilets((prev) => {
              if (!prev.length) return tJson.data;
              return tJson.data.map((fresh: ToiletWithFreshness) => {
                const current = prev.find((p) => p.id === fresh.id);
                if (!current) return fresh;
                const currentTime = new Date(current.last_status_update).getTime();
                const freshTime = new Date(fresh.last_status_update).getTime();
                return freshTime >= currentTime ? fresh : current;
              });
            });
          }
        }

        if (suppliesRes.ok && !ignore) {
          const sJson = await suppliesRes.json();
          if (sJson.success && Array.isArray(sJson.data)) {
            setSupplyReports(sJson.data);
          }
        }
      } catch {
        // Silently handle sync errors
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    runSync();
    // Auto-refresh every 20 seconds to keep freshness and status synchronized
    const interval = setInterval(runSync, 20000);

    // Refresh immediately when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !ignore) {
        runSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      ignore = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleUpdateStatus = useCallback(async (toiletId: 'mens' | 'womens', newStatus: ToiletStatus) => {
    setBannerMessage(null);

    const nowIso = new Date().toISOString();
    const clientDevice =
      typeof navigator !== 'undefined'
        ? parseUserAgentToDeviceInfo(navigator.userAgent)
        : 'Web Visitor';

    // Increment request sequence for this toilet so out-of-order responses are dropped
    statusSeqRef.current[toiletId] = (statusSeqRef.current[toiletId] || 0) + 1;
    const requestSeq = statusSeqRef.current[toiletId];

    // Instant optimistic update: locked in locally without buffering
    setToilets((prev) =>
      prev.map((t) =>
        t.id === toiletId
          ? {
              ...t,
              status: newStatus,
              displayStatus: newStatus,
              isStale: false,
              last_status_update: nowIso,
              freshnessNote: 'Updated just now',
              lastChange: {
                new_status: newStatus,
                previous_status: t.status,
                device_summary: clientDevice,
                created_at: nowIso,
              },
            }
          : t
      )
    );

    try {
      const res = await fetch('/api/toilets/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      // Directly apply returned server state if this is still the newest request for this toilet
      if (requestSeq === statusSeqRef.current[toiletId] && data.data) {
        setToilets((prev) =>
          prev.map((t) => (t.id === toiletId ? data.data : t))
        );
      }

      // Trigger bottom device activity log refresh
      setActivityRefreshKey((k) => k + 1);

      const toiletName = toiletId === 'mens' ? "Men's Toilet" : "Women's Toilet";
      const statusAction =
        newStatus === 'available'
          ? 'is now Vacant (Available)'
          : newStatus === 'occupied'
          ? 'is now marked Occupied'
          : 'is under Maintenance';

      setBannerMessage({
        type: 'success',
        text: `${toiletName} ${statusAction}. Status saved!`,
      });
      setTimeout(() => setBannerMessage(null), 3500);
    } catch (err: unknown) {
      if (requestSeq === statusSeqRef.current[toiletId]) {
        const msg = err instanceof Error ? err.message : 'Error updating status';
        setBannerMessage({ type: 'error', text: msg });
        fetchToiletsAndSupplies();
      }
    }
  }, [fetchToiletsAndSupplies]);

  const handleUpdateQueue = useCallback(async (toiletId: 'mens' | 'womens', delta: number) => {
    // Instant optimistic update for smooth zero-latency interaction
    setToilets((prev) =>
      prev.map((t) =>
        t.id === toiletId
          ? {
              ...t,
              queue_count: Math.max(0, (t.queue_count ?? 0) + delta),
            }
          : t
      )
    );

    try {
      const res = await fetch('/api/toilets/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, delta }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update queue');
      }

      if (data.data) {
        setToilets((prev) =>
          prev.map((t) => (t.id === toiletId ? data.data : t))
        );
      }

      // Refresh activity log
      setActivityRefreshKey((k) => k + 1);
    } catch {
      fetchToiletsAndSupplies();
    }
  }, [fetchToiletsAndSupplies]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100 pb-20">
      <Header onRefresh={fetchToiletsAndSupplies} isRefreshing={isLoading} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-8">
        {/* Banner Feedback */}
        {bannerMessage && (
          <div
            className={`rounded-2xl p-4 text-xs font-semibold flex items-center justify-between shadow-xs transition ${
              bannerMessage.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section 1: Real-time Toilet Statuses */}
        <section aria-labelledby="status-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 id="status-heading" className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Current Restroom Status
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Tap below to update when you enter, leave, or discover maintenance needs. No login required.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isLoading && toilets.length === 0 ? (
              <>
                <div className="h-44 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-44 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
              </>
            ) : (
              toilets.map((toilet) => (
                <ToiletStatusCard
                  key={toilet.id}
                  toilet={toilet}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateQueue={handleUpdateQueue}
                />
              ))
            )}
          </div>

          {/* Section: Live Activity & Device Summary Banner */}
          <LiveActivityBanner toilets={toilets} />
        </section>

        {/* Section 2: Analytics Overview Dashboard */}
        <AnalyticsDashboard initialPeriod="today" />

        {/* Section 3: Supply Issues */}
        <section aria-labelledby="supplies-heading">
          <SupplyIssuesList
            reports={supplyReports}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            isLoading={isLoading}
          />
        </section>

        {/* Section 4: Detailed Device Activity Log (Bottom Log) */}
        <DeviceActivityLog refreshTrigger={activityRefreshKey} />
      </main>

      {/* Supply Report Modal */}
      <SupplyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onReportSubmitted={fetchToiletsAndSupplies}
      />
    </div>
  );
}
