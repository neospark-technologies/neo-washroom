'use client';

import React, { memo } from 'react';
import { ToiletWithFreshness, ToiletStatus, ToiletId } from '@/types';
import {
  CheckCircle2,
  Lock,
  Wrench,
  AlertTriangle,
  Clock,
  User,
  Users,
  Smartphone,
  Monitor,
  Minus,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { formatKathmanduTime, formatRelativeTime } from '@/lib/utils/date';

interface ToiletStatusCardProps {
  toilet: ToiletWithFreshness;
  onUpdateStatus: (toiletId: ToiletId, newStatus: ToiletStatus) => Promise<void>;
  onUpdateQueue?: (toiletId: ToiletId, delta: number) => Promise<void>;
  isLoading?: boolean;
}

export const ToiletStatusCard = memo(function ToiletStatusCard({
  toilet,
  onUpdateStatus,
  onUpdateQueue,
  isLoading = false,
}: ToiletStatusCardProps) {
  // Handlers for status toggles
  const handleStatusClick = (clickedStatus: ToiletStatus) => {
    // If clicking an already active status (except 'available'), toggle back to 'available'
    const targetStatus: ToiletStatus =
      toilet.status === clickedStatus && clickedStatus !== 'available'
        ? 'available'
        : clickedStatus;

    onUpdateStatus(toilet.id, targetStatus);
  };

  const handleMasterToggle = () => {
    if (toilet.status === 'available') {
      onUpdateStatus(toilet.id, 'occupied');
    } else {
      onUpdateStatus(toilet.id, 'available');
    }
  };

  const handleQueueClick = (delta: number) => {
    if (onUpdateQueue) {
      onUpdateQueue(toilet.id, delta);
    }
  };

  const isNeedsVerification = toilet.displayStatus === 'needs_verification' || toilet.isStale;
  const isMaintenance = toilet.status === 'maintenance';
  const isOccupied = toilet.status === 'occupied';
  const isAvailable = toilet.status === 'available' && !isNeedsVerification;

  // Dynamic styling based on current confirmed status
  let borderClass = 'border-emerald-300/80 dark:border-emerald-800/80 ring-1 ring-emerald-500/10';
  let bgClass = 'bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-zinc-900/90 dark:to-emerald-950/10';
  let badgeBg = 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
  let statusTitle = 'Available';
  let StatusIcon = CheckCircle2;

  if (isMaintenance) {
    borderClass = 'border-amber-300/80 dark:border-amber-800/80 ring-1 ring-amber-500/10';
    bgClass = 'bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-zinc-900/90 dark:to-amber-950/10';
    badgeBg = 'bg-amber-100/90 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
    statusTitle = 'Maintenance';
    StatusIcon = Wrench;
  } else if (isNeedsVerification) {
    borderClass = 'border-amber-400 dark:border-amber-600 border-dashed ring-1 ring-amber-500/20';
    bgClass = 'bg-amber-50/40 dark:bg-amber-950/30';
    badgeBg = 'bg-amber-500 text-white dark:bg-amber-600 dark:text-amber-50';
    statusTitle = 'Needs Verification';
    StatusIcon = AlertTriangle;
  } else if (isOccupied) {
    borderClass = 'border-rose-300/80 dark:border-rose-800/80 ring-1 ring-rose-500/10';
    bgClass = 'bg-gradient-to-b from-rose-50/40 via-white to-rose-50/20 dark:from-rose-950/20 dark:via-zinc-900/90 dark:to-rose-950/10';
    badgeBg = 'bg-rose-100/90 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
    statusTitle = 'Occupied';
    StatusIcon = Lock;
  }

  const GenderIcon = toilet.id === 'mens' ? User : Users;

  const isMobileDevice =
    toilet.lastChange?.device_summary.toLowerCase().includes('mobile') ||
    toilet.lastChange?.device_summary.toLowerCase().includes('iphone') ||
    toilet.lastChange?.device_summary.toLowerCase().includes('android');

  const DeviceIcon = isMobileDevice ? Smartphone : Monitor;

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 ${borderClass} ${bgClass} p-5 sm:p-6 shadow-sm transition-all duration-200 backdrop-blur-xs`}
    >
      <div>
        {/* Top Bar: Toilet Title & Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80">
              <GenderIcon className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg sm:text-xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                {toilet.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                <span>
                  Updated {formatRelativeTime(toilet.last_status_update)} ({formatKathmanduTime(toilet.last_status_update)})
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge with Live Pulsing Dot */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide uppercase shadow-2xs transition-colors duration-150 ${badgeBg}`}
          >
            {isAvailable && (
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            {isOccupied && (
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{statusTitle}</span>
          </span>
        </div>

        {/* Warning Alert if Needs Verification */}
        {isNeedsVerification && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-100/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Status freshness notice (Last reported {toilet.status === 'occupied' ? 'Occupied' : 'Available'} {formatRelativeTime(toilet.last_status_update)})
                </p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  Please tap your current observed status below to refresh the live status.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Maintenance Notice */}
        {isMaintenance && toilet.isStale && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-100/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">Maintenance ongoing</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  Under maintenance since {formatKathmanduTime(toilet.last_status_update)}. Tap &ldquo;Available&rdquo; once service is finished.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Master One-Touch Toggle Action */}
        <div className="mt-4">
          {toilet.status === 'available' ? (
            <button
              type="button"
              onClick={handleMasterToggle}
              className="w-full flex items-center justify-between rounded-xl p-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold shadow-sm transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase tracking-wider text-emerald-100 font-bold">
                    Quick Toggle
                  </span>
                  <span className="text-xs sm:text-sm font-black">
                    Vacant • Tap to Mark as Occupied
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/25 px-2.5 py-1 rounded-lg">
                Occupy →
              </span>
            </button>
          ) : toilet.status === 'occupied' ? (
            <button
              type="button"
              onClick={handleMasterToggle}
              className="w-full flex items-center justify-between rounded-xl p-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-extrabold shadow-sm transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                  <Lock className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase tracking-wider text-rose-100 font-bold">
                    Quick Toggle
                  </span>
                  <span className="text-xs sm:text-sm font-black">
                    In Use • Tap to Vacate (Set Available)
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/25 px-2.5 py-1 rounded-lg">
                Vacate →
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMasterToggle}
              className="w-full flex items-center justify-between rounded-xl p-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-extrabold shadow-sm transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase tracking-wider text-amber-100 font-bold">
                    Quick Toggle
                  </span>
                  <span className="text-xs sm:text-sm font-black">
                    Under Maintenance • Tap to Reopen
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/25 px-2.5 py-1 rounded-lg">
                Reopen →
              </span>
            </button>
          )}
        </div>

        {/* Granular Status Buttons (Clicking active status toggles back to Available) */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Change Status (Tap active to toggle)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 1. Available Button */}
            {(() => {
              const isSelected = toilet.status === 'available' && !isNeedsVerification;
              return (
                <button
                  type="button"
                  onClick={() => handleStatusClick('available')}
                  disabled={isLoading}
                  aria-pressed={isSelected}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition-all duration-150 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'border-2 border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-4 ring-emerald-500/20'
                      : 'border border-zinc-200/90 bg-white text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Available</span>
                </button>
              );
            })()}

            {/* 2. Occupied Button (Toggles to Available if already Occupied) */}
            {(() => {
              const isSelected = toilet.status === 'occupied' && !isNeedsVerification;
              return (
                <button
                  type="button"
                  onClick={() => handleStatusClick('occupied')}
                  disabled={isLoading}
                  aria-pressed={isSelected}
                  title={isSelected ? 'Click to toggle back to Available' : 'Mark as Occupied'}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition-all duration-150 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'border-2 border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/20 ring-4 ring-rose-500/20'
                      : 'border border-zinc-200/90 bg-white text-zinc-700 hover:border-rose-400 hover:bg-rose-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-rose-950/40'
                  }`}
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <div className="flex flex-col items-center sm:items-start leading-none truncate">
                    <span className="truncate">Occupied</span>
                    {isSelected && (
                      <span className="text-[9px] opacity-80 mt-0.5 sm:inline hidden">
                        (tap to toggle)
                      </span>
                    )}
                  </div>
                </button>
              );
            })()}

            {/* 3. Maintenance Button (Toggles to Available if already Maintenance) */}
            {(() => {
              const isSelected = toilet.status === 'maintenance';
              return (
                <button
                  type="button"
                  onClick={() => handleStatusClick('maintenance')}
                  disabled={isLoading}
                  aria-pressed={isSelected}
                  title={isSelected ? 'Click to toggle back to Available' : 'Mark as Maintenance'}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition-all duration-150 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'border-2 border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-600/20 ring-4 ring-amber-500/20'
                      : 'border border-zinc-200/90 bg-white text-zinc-700 hover:border-amber-400 hover:bg-amber-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-amber-950/40'
                  }`}
                >
                  <Wrench className="h-4 w-4 shrink-0" />
                  <div className="flex flex-col items-center sm:items-start leading-none truncate">
                    <span className="truncate">Repair</span>
                    {isSelected && (
                      <span className="text-[9px] opacity-80 mt-0.5 sm:inline hidden">
                        (tap to toggle)
                      </span>
                    )}
                  </div>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Waiting Queue Stepper */}
        <div className="mt-4 rounded-xl border border-zinc-200/90 bg-white/90 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/80 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold shrink-0 border border-indigo-100 dark:border-indigo-900">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block leading-tight">
                  Waiting Queue
                </span>
                <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100">
                  {toilet.queue_count > 0 ? (
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {toilet.queue_count} {toilet.queue_count === 1 ? 'person in line' : 'people in line'}
                    </span>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                      No line (0 waiting)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Stepper Buttons (-1 and +1) */}
            <div className="flex items-center gap-1.5 shrink-0 bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() => handleQueueClick(-1)}
                disabled={toilet.queue_count <= 0}
                title="Leave queue (-1)"
                aria-label="Decrement queue"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-2xs hover:bg-zinc-100 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="min-w-8 text-center font-mono text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                {toilet.queue_count}
              </div>

              <button
                type="button"
                onClick={() => handleQueueClick(1)}
                title="Join queue (+1)"
                aria-label="Increment queue"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700 active:scale-90 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-600 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device Info & Last Changed Footnote */}
      <div className="mt-5 pt-3.5 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-zinc-500 dark:text-zinc-400">
            Last Observed Status:
          </span>
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            {formatKathmanduTime(toilet.last_status_update)} ({formatRelativeTime(toilet.last_status_update)})
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2 text-xs shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 shrink-0">
              <DeviceIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 truncate">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[11px] block truncate">
                {toilet.lastChange?.device_summary || 'Web Visitor'}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              toilet.status === 'occupied'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                : toilet.status === 'available'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
            }`}
          >
            {toilet.status}
          </span>
        </div>
      </div>
    </div>
  );
});
