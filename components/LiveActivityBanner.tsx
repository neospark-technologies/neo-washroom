'use client';

import React, { memo } from 'react';
import { ToiletWithFreshness } from '@/types';
import { Activity, Smartphone, Monitor, Tablet, Clock, ArrowRight } from 'lucide-react';
import { formatKathmanduTime, formatRelativeTime } from '@/lib/utils/date';

interface LiveActivityBannerProps {
  toilets: ToiletWithFreshness[];
}

export const LiveActivityBanner = memo(function LiveActivityBanner({ toilets }: LiveActivityBannerProps) {
  const activeEntries = toilets.filter((t) => t.lastChange);

  if (activeEntries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-4 sm:p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 transition-all backdrop-blur-xs">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Real-Time Device Status Stream
          </h3>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono font-medium">
          Live Audit Feed
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {toilets.map((toilet) => {
          const change = toilet.lastChange;
          if (!change) {
            return (
              <div
                key={toilet.id}
                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-xs dark:border-zinc-800/60 dark:bg-zinc-950/40"
              >
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {toilet.name}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Updated {formatRelativeTime(toilet.last_status_update)}
                </span>
              </div>
            );
          }

          const isMobile =
            change.device_summary.toLowerCase().includes('mobile') ||
            change.device_summary.toLowerCase().includes('iphone') ||
            change.device_summary.toLowerCase().includes('android');

          const isTablet =
            change.device_summary.toLowerCase().includes('tablet') ||
            change.device_summary.toLowerCase().includes('ipad');

          const DeviceIcon = isMobile ? Smartphone : isTablet ? Tablet : Monitor;

          return (
            <div
              key={toilet.id}
              className="flex flex-col justify-between rounded-xl border border-zinc-200/60 bg-zinc-50/70 p-3 text-xs dark:border-zinc-800/80 dark:bg-zinc-950/50 space-y-2 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {toilet.name}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  <Clock className="h-3 w-3" />
                  {formatKathmanduTime(change.created_at)} ({formatRelativeTime(change.created_at)})
                </span>
              </div>

              {/* Status Transition Badge */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="capitalize text-zinc-500 font-medium">
                  {change.previous_status || 'Initial'}
                </span>
                <ArrowRight className="h-3 w-3 text-zinc-400" />
                <span
                  className={`font-bold capitalize rounded-full px-2 py-0.5 text-[10px] ${
                    change.new_status === 'occupied'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : change.new_status === 'available'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {change.new_status}
                </span>
              </div>

              {/* Device and Client Details */}
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/80">
                <DeviceIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {change.device_summary}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
