'use client';

import React, { memo } from 'react';
import { SupplyReport } from '@/types';
import {
  Package,
  Clock,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { formatKathmanduDateTime, formatRelativeTime } from '@/lib/utils/date';

interface SupplyIssuesListProps {
  reports: SupplyReport[];
  onOpenReportModal: () => void;
  isLoading?: boolean;
}

export const SupplyIssuesList = memo(function SupplyIssuesList({
  reports,
  onOpenReportModal,
  isLoading = false,
}: SupplyIssuesListProps) {
  // Filter to unresolved only (pending or in_progress)
  const unresolvedReports = reports.filter(
    (r) => !r.is_archived && (r.status === 'pending' || r.status === 'in_progress')
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Supply Issues
            </h2>
            {unresolvedReports.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {unresolvedReports.length} Active
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time public inventory notices and restock requests
          </p>
        </div>

        <button
          onClick={onOpenReportModal}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900 transition active:scale-95 self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Report Empty Supplies</span>
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3 py-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : unresolvedReports.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              All Restrooms Fully Stocked
            </h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
              No missing soap, paper, or sanitizer has been reported. Notice an empty dispenser? Tap the button above to report it.
            </p>
          </div>
        ) : (
          /* List of unresolved issues */
          <div className="grid gap-3 sm:grid-cols-2">
            {unresolvedReports.map((report) => {
              const isUrgent = report.severity === 'Urgent';
              const isInProgress = report.status === 'in_progress';

              return (
                <div
                  key={report.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    isUrgent
                      ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
                      : 'border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40'
                  }`}
                >
                  <div>
                    {/* Restroom and Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        {report.toilet_name || (report.toilet_id === 'mens' ? "Men's Toilet" : "Women's Toilet")}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Severity */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {report.severity}
                        </span>

                        {/* Status */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isInProgress
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {isInProgress ? 'In Progress' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Supply Type */}
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <span>Missing:</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {report.category}
                      </span>
                    </div>

                    {/* Description if present */}
                    {report.description && (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 italic">
                        &ldquo;{report.description}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Footer Timestamp */}
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <Clock className="h-3 w-3" />
                    <span>
                      Reported {formatRelativeTime(report.created_at)} ({formatKathmanduDateTime(report.created_at)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
