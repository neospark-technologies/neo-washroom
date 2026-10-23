'use client';

import React, { useState } from 'react';
import { ToiletId, SupplyCategory, SupplySeverity } from '@/types';
import { SUPPLY_CATEGORIES, SUPPLY_SEVERITIES } from '@/lib/constants';
import { X, AlertCircle, CheckCircle2, PackagePlus, Loader2 } from 'lucide-react';

interface SupplyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted: () => void;
  defaultToiletId?: ToiletId;
}

export function SupplyReportModal({
  isOpen,
  onClose,
  onReportSubmitted,
  defaultToiletId = 'mens',
}: SupplyReportModalProps) {
  const [toiletId, setToiletId] = useState<ToiletId>(defaultToiletId);
  const [category, setCategory] = useState<SupplyCategory>('Toilet paper');
  const [severity, setSeverity] = useState<SupplySeverity>('Normal');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (description.length > 500) {
      setErrorMessage('Description must be 500 characters or less');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/supplies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toilet_id: toiletId,
          category,
          severity,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit supply report');
      }

      setSuccessMessage('Thank you! Your supply report has been submitted to maintenance.');
      setDescription('');
      setTimeout(() => {
        onReportSubmitted();
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while submitting';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <PackagePlus className="h-5 w-5" />
          </div>
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Report Missing Supplies
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No account required. Let the facilities team know what needs replenishing.
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toilet Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
              Select Toilet <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setToiletId('mens')}
                className={`flex items-center justify-center rounded-xl border py-2.5 px-3 text-xs font-semibold transition ${
                  toiletId === 'mens'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                Men&apos;s Toilet
              </button>
              <button
                type="button"
                onClick={() => setToiletId('womens')}
                className={`flex items-center justify-center rounded-xl border py-2.5 px-3 text-xs font-semibold transition ${
                  toiletId === 'womens'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                Women&apos;s Toilet
              </button>
            </div>
          </div>

          {/* Supply Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
              Supply Item <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupplyCategory)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              required
            >
              {SUPPLY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
              Severity
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SUPPLY_SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  className={`flex items-center justify-center rounded-xl border py-2 px-3 text-xs font-semibold transition ${
                    severity === sev
                      ? sev === 'Urgent'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {sev === 'Urgent' ? '⚠️ Urgent (Empty / Critical)' : 'Normal (Low supply)'}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Short Description (Optional)
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {description.length}/500
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dispenser on the left stall is completely out of soap..."
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!successMessage}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

