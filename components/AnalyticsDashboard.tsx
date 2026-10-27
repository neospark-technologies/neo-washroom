'use client';

import React, { useState, useEffect, memo } from 'react';
import { AnalyticsData, AnalyticsPeriod } from '@/types';
import {
  BarChart3,
  Activity,
  Lock,
  Wrench,
  AlertCircle,
  Sparkles,
  Info,
  Clock,
  Layers,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  initialPeriod?: AnalyticsPeriod;
}

export const AnalyticsDashboard = memo(function AnalyticsDashboard({ initialPeriod = 'today' }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = React.useRef<Record<string, AnalyticsData>>({});

  useEffect(() => {
    let ignore = false;

    // Instant zero-latency switch if already loaded in this session
    if (cacheRef.current[period]) {
      setData(cacheRef.current[period]);
      setIsLoading(false);
      return;
    }

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/analytics?period=${period}`);
        const json = await res.json();
        if (!ignore) {
          if (!res.ok || !json.success) {
            throw new Error(json.error || 'Failed to load analytics data');
          }
          cacheRef.current[period] = json.data;
          setData(json.data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Error fetching analytics';
          setError(msg);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [period]);

  return (
    <section className="space-y-6">
      {/* Top Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Analytics Overview
            </h2>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Info className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span>Based on reported status changes, not verified toilet usage.</span>
            <span className="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              Asia/Kathmandu (NPT)
            </span>
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950 self-start sm:self-auto">
          {(['today', '7d', '30d'] as AnalyticsPeriod[]).map((p) => {
            const labels: Record<AnalyticsPeriod, string> = {
              today: 'Today',
              '7d': 'Last 7 days',
              '30d': 'Last 30 days',
            };
            const isSelected = period === p;
            return (
              <button
                key={p}
                onClick={() => {
                  if (!cacheRef.current[p]) setIsLoading(true);
                  setPeriod(p);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
          <p className="font-semibold">Unable to load analytics</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        </div>
      )}

      {/* Content When Loaded */}
      {data && (
        <div className="space-y-6">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* 1. Total Status Changes */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Changes
                </span>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {data.totalStatusChanges}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Actual status transitions in period
              </p>
            </div>

            {/* 2. Occupied Reports */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Occupied Reports
                </span>
                <Lock className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {data.occupiedReports}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Transitions into &ldquo;occupied&rdquo; state
              </p>
            </div>

            {/* 3. Maintenance Reports */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Maintenance
                </span>
                <Wrench className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {data.maintenanceReports}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Restroom maintenance updates
              </p>
            </div>

            {/* 4. Unresolved Supply Issues (Current count independent of period) */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Supply Issues
                </span>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {data.unresolvedSupplyIssues}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Current active pending / in-progress
              </p>
            </div>

            {/* 5. Cleaning Completion */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Cleaning Rate
                </span>
                <Sparkles className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {data.cleaningCompletion.isConfigured
                    ? `${data.cleaningCompletion.rate}%`
                    : 'Not configured'}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {data.cleaningCompletion.isConfigured
                  ? `${data.cleaningCompletion.completed} of ${data.cleaningCompletion.scheduled} scheduled shifts`
                  : 'Schedules pending setup'}
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Chart A: Daily Status Activity */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    Daily Status Activity
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Total status changes recorded per day
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" /> All Changes
                  </span>
                  <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" /> Occupied
                  </span>
                </div>
              </div>

              {data.dailyActivity.length === 0 || data.totalStatusChanges === 0 ? (
                <div className="flex h-48 items-center justify-center text-xs text-zinc-400">
                  No status activity recorded during this period
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {data.dailyActivity.map((day) => {
                    const maxVal = Math.max(
                      1,
                      ...data.dailyActivity.map((d) => d.changes)
                    );
                    const changesPercent = Math.min(100, Math.round((day.changes / maxVal) * 100));
                    const occupiedPercent = Math.min(100, Math.round((day.occupied / maxVal) * 100));

                    return (
                      <div key={day.date} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {day.formattedDate}
                          </span>
                          <span className="font-mono text-zinc-500 text-[11px]">
                            {day.changes} changes ({day.occupied} occupied)
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden dark:bg-zinc-800 flex">
                          <div
                            style={{ width: `${occupiedPercent}%` }}
                            className="h-full bg-rose-500 transition-all duration-300"
                            title={`Occupied: ${day.occupied}`}
                          />
                          <div
                            style={{ width: `${Math.max(0, changesPercent - occupiedPercent)}%` }}
                            className="h-full bg-blue-500 transition-all duration-300"
                            title={`Other changes: ${day.changes - day.occupied}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart B: Occupied Reports by Local Hour (00:00 - 23:00 NPT) */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    Occupied Reports by Hour
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Time of transition to occupied (00:00 – 23:00 Nepal Time)
                  </p>
                </div>
                <Clock className="h-4 w-4 text-zinc-400" />
              </div>

              {data.occupiedReports === 0 ? (
                <div className="flex h-48 items-center justify-center text-xs text-zinc-400">
                  No occupied transitions recorded during this period
                </div>
              ) : (
                <div className="pt-2">
                  <div className="grid grid-cols-12 gap-1 items-end h-40">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const h1 = idx * 2;
                      const h2 = idx * 2 + 1;
                      const count = (data.occupiedByHour[h1]?.count || 0) + (data.occupiedByHour[h2]?.count || 0);
                      const maxHourVal = Math.max(
                        1,
                        ...Array.from({ length: 12 }).map((_, i) =>
                          (data.occupiedByHour[i * 2]?.count || 0) + (data.occupiedByHour[i * 2 + 1]?.count || 0)
                        )
                      );
                      const heightPercent = Math.max(6, Math.round((count / maxHourVal) * 100));

                      return (
                        <div key={idx} className="flex flex-col items-center h-full justify-end group">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-sm transition-all duration-300 ${
                              count > 0
                                ? 'bg-rose-500 group-hover:bg-rose-600'
                                : 'bg-zinc-100 dark:bg-zinc-800'
                            }`}
                            title={`${h1}:00 - ${h2}:59 NPT: ${count} occupied transitions`}
                          />
                          <span className="mt-1.5 text-[9px] text-zinc-400 font-mono">
                            {h1}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-center text-[11px] text-zinc-400">
                    Hourly buckets in Asia/Kathmandu time. Peak occupancy frequency indicator.
                  </p>
                </div>
              )}
            </div>

            {/* Chart C: Toilet Comparison */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    Restroom Comparison
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Men&apos;s vs Women&apos;s status updates & occupied transitions
                  </p>
                </div>
                <Layers className="h-4 w-4 text-zinc-400" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Men's */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Men&apos;s Restroom
                  </span>
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        <span>Total Changes</span>
                        <span className="font-mono font-bold">{data.toiletComparison.mens.totalChanges}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          style={{
                            width: `${
                              data.totalStatusChanges > 0
                                ? Math.round((data.toiletComparison.mens.totalChanges / data.totalStatusChanges) * 100)
                                : 0
                            }%`,
                          }}
                          className="h-full bg-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        <span>Occupied Reports</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {data.toiletComparison.mens.occupiedTransitions}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          style={{
                            width: `${
                              data.occupiedReports > 0
                                ? Math.round((data.toiletComparison.mens.occupiedTransitions / data.occupiedReports) * 100)
                                : 0
                            }%`,
                          }}
                          className="h-full bg-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Women's */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Women&apos;s Restroom
                  </span>
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        <span>Total Changes</span>
                        <span className="font-mono font-bold">{data.toiletComparison.womens.totalChanges}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          style={{
                            width: `${
                              data.totalStatusChanges > 0
                                ? Math.round((data.toiletComparison.womens.totalChanges / data.totalStatusChanges) * 100)
                                : 0
                            }%`,
                          }}
                          className="h-full bg-indigo-600"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        <span>Occupied Reports</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {data.toiletComparison.womens.occupiedTransitions}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          style={{
                            width: `${
                              data.occupiedReports > 0
                                ? Math.round((data.toiletComparison.womens.occupiedTransitions / data.occupiedReports) * 100)
                                : 0
                            }%`,
                          }}
                          className="h-full bg-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart D & F: Maintenance Frequency & Recurring Supply Problems */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    Recurring Supply Breakdown
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Most frequently reported missing supplies
                  </p>
                </div>
                <AlertCircle className="h-4 w-4 text-zinc-400" />
              </div>

              <div className="space-y-2.5 pt-1">
                {data.supplyProblems.byCategory.map((item) => {
                  const maxCount = Math.max(
                    1,
                    ...data.supplyProblems.byCategory.map((c) => c.count)
                  );
                  const barWidth = Math.min(100, Math.round((item.count / maxCount) * 100));

                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {item.category}
                        </span>
                        <span className="font-mono text-zinc-500 text-[11px]">
                          {item.count} report{item.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          style={{ width: `${barWidth}%` }}
                          className={`h-full transition-all duration-300 ${
                            item.count > 0 ? 'bg-amber-500' : 'bg-transparent'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <span>Maintenance Frequency in Period:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {data.maintenanceReports} event{data.maintenanceReports === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
