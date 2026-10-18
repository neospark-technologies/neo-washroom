'use client';

import React, { useEffect, useState, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Shield, Home, Clock, RefreshCw } from 'lucide-react';
import { formatKathmanduTime } from '@/lib/utils/date';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header = memo(function Header({ onRefresh, isRefreshing }: HeaderProps) {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatKathmanduTime(new Date().toISOString()));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-black/80 transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20 transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 text-base sm:text-lg">
                  NeoSpark
                </span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                  Washroom
                </span>
                {/* Live Online Ping */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                toilet.neospark.tech
              </p>
            </div>
          </Link>
        </div>

        {/* Live Clock & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentTime && (
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>{currentTime}</span>
              <span className="text-[10px] text-zinc-400 font-mono">NPT</span>
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh status"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 active:scale-95 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition shadow-2xs"
              aria-label="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          )}

          {pathname === '/admin' ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition shadow-2xs"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Public View</span>
            </Link>
          ) : (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition shadow-sm"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
});
