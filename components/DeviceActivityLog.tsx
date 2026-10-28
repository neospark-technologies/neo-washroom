'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { PublicActivityEvent, ToiletId } from '@/types';
import {
  Smartphone,
  Monitor,
  Tablet,
  Clock,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { formatKathmanduTime, formatRelativeTime } from '@/lib/utils/date';

interface DeviceActivityLogProps {
  initialEvents?: PublicActivityEvent[];
  refreshTrigger?: number; // increments when user changes status above
}

export const DeviceActivityLog = memo(function DeviceActivityLog({ refreshTrigger = 0 }: DeviceActivityLogProps) {
  const [events, setEvents] = useState<PublicActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterToilet, setFilterToilet] = useState<ToiletId | 'all'>('all');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/activity', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEvents(json.data);
        }
      }
    } catch {
      // Graceful offline fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch('/api/activity', { cache: 'no-store' });
        if (res.ok && !ignore) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setEvents(json.data);
          }
        }
      } catch {
        // Silently handle
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000); // Auto-sync every 15s
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [refreshTrigger]);

  const filteredEvents = events.filter((e) => {
    if (filterToilet === 'all') return true;
    return e.toilet_id === filterToilet;
  });

  return (
    <section aria-labelledby="device-log-heading" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
            <h2 id="device-log-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Device Activity &amp; Status Change Log
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Detailed log showing which device performed each status update, including OS, browser, action, and Nepal timestamp.
          </p>
        </div>

        {/* Filter & Refresh Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950 text-xs">
            <button
              onClick={() => setFilterToilet('all')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterToilet === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              All Restrooms
            </button>
            <button
              onClick={() => setFilterToilet('mens')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterToilet === 'mens'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Men&apos;s
            </button>
            <button
              onClick={() => setFilterToilet('womens')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterToilet === 'womens'
                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Women&apos;s
            </button>
          </div>

          <button
            onClick={fetchEvents}
            disabled={isLoading}
            title="Refresh device log"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        {isLoading && events.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-blue-500" />
            <p>Loading device activity logs...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <SlidersHorizontal className="h-6 w-6 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No device activity recorded yet</p>
            <p className="mt-0.5 text-zinc-400">
              When anyone changes or confirms a restroom status above, their device details and exact action will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filteredEvents.map((evt) => {
              const isMobile = evt.device_type === 'Mobile';
              const isTablet = evt.device_type === 'Tablet';
              const DeviceIcon = isMobile ? Smartphone : isTablet ? Tablet : Monitor;

              return (
                <div
                  key={evt.id}
                  className="p-4 sm:px-6 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Left: Device & Restroom Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isMobile
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                          : isTablet
                          ? 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      <DeviceIcon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      {/* Action Headline */}
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                        <span className="text-zinc-800 dark:text-zinc-200">
                          {evt.toilet_name}
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="font-normal text-zinc-600 dark:text-zinc-400">
                          {evt.action_summary}
                        </span>
                      </div>

                      {/* Device breakdown badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {/* Device summary pill */}
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          {evt.device_summary}
                        </span>
                        {/* OS pill */}
                        <span className="text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 px-1.5 py-0.5 rounded text-[10px]">
                          OS: {evt.os}
                        </span>
                        {/* Browser pill */}
                        <span className="text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 px-1.5 py-0.5 rounded text-[10px]">
                          Browser: {evt.browser}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Transition & Timestamp */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/60">
                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {evt.previous_status && evt.previous_status !== evt.new_status ? (
                        <>
                          <span className="capitalize text-zinc-500">
                            {evt.previous_status}
                          </span>
                          <ArrowRight className="h-3 w-3 text-zinc-400" />
                        </>
                      ) : null}
                      <span
                        className={`font-bold capitalize rounded-full px-2.5 py-0.5 text-[10px] ${
                          evt.new_status === 'occupied'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : evt.new_status === 'available'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {evt.new_status}
                      </span>
                    </div>

                    {/* Exact Time & Relative */}
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                      <Clock className="h-3 w-3" />
                      <span>{formatKathmanduTime(evt.created_at)}</span>
                      <span>({formatRelativeTime(evt.created_at)})</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});

