'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import { api } from '@/lib/api';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
    );
  }

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);

    // Silently persist theme preference in backend database
    try {
      await api.patch('/users/me/preferences', {
        theme: newTheme.toUpperCase(),
      });
    } catch {
      // Preference persistence fail fallback (already saved in localStorage via next-themes)
    }
  };

  return (
    <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-300/50 dark:border-slate-700/60 shadow-inner">
      <button
        type="button"
        onClick={() => handleThemeChange('light')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
          theme === 'light'
            ? 'bg-white text-amber-600 shadow-sm font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Light Mode"
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        onClick={() => handleThemeChange('dark')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
          theme === 'dark'
            ? 'bg-slate-900 text-indigo-400 shadow-sm font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Dark Mode"
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>

      <button
        type="button"
        onClick={() => handleThemeChange('system')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
          theme === 'system'
            ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="System Preference"
      >
        <Laptop className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">System</span>
      </button>
    </div>
  );
}
