'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { UserCog, Moon, Sun, Monitor, Clock, Calendar, Globe, Check, Loader2 } from 'lucide-react';

export default function PreferencesPage() {
  const [theme, setTheme] = useState<'DARK' | 'LIGHT' | 'SYSTEM'>('DARK');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [language, setLanguage] = useState('en-US');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api
      .get('/users/me/preferences')
      .then((res) => {
        const pref = res.data.data;
        if (pref) {
          if (pref.theme) setTheme(pref.theme);
          if (pref.timezone) setTimezone(pref.timezone);
          if (pref.dateFormat) setDateFormat(pref.dateFormat);
          if (pref.language) setLanguage(pref.language);
        }
      })
      .catch(() => {
        // Use defaults if unavailable
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.patch('/users/me/preferences', {
        theme,
        timezone,
        dateFormat,
        language,
      });
      toast.success('Preferences updated successfully!');
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to save preferences.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="User Preferences"
        subtitle="Manage your portal display mode, timezone, date formatting, and regional localization"
      />

      <form
        onSubmit={handleSavePreferences}
        action="#"
        method="POST"
        className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-8"
      >
        {/* Visual Theme Selection */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <UserCog className="h-4 w-4 text-indigo-400" />
            <span>Theme Mode</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setTheme('DARK')}
              className={`p-4 rounded-xl border flex flex-col items-center space-y-2 transition-all ${
                theme === 'DARK'
                  ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-md'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Moon className="h-6 w-6 text-indigo-400" />
              <span className="text-xs font-semibold">Dark Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('LIGHT')}
              className={`p-4 rounded-xl border flex flex-col items-center space-y-2 transition-all ${
                theme === 'LIGHT'
                  ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-md'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="h-6 w-6 text-amber-400" />
              <span className="text-xs font-semibold">Light Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('SYSTEM')}
              className={`p-4 rounded-xl border flex flex-col items-center space-y-2 transition-all ${
                theme === 'SYSTEM'
                  ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-md'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="h-6 w-6 text-emerald-400" />
              <span className="text-xs font-semibold">System Sync</span>
            </button>
          </div>
        </div>

        {/* Timezone & Date Formatting */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center space-x-1.5">
              <Clock className="h-4 w-4 text-indigo-400" />
              <span>Timezone</span>
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
              <option value="America/New_York">America/New_York (EST - UTC-5)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST - UTC-8)</option>
              <option value="Europe/London">Europe/London (GMT - UTC+0)</option>
              <option value="Europe/Paris">Europe/Paris (CET - UTC+1)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center space-x-1.5">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <span>Date Format</span>
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-01)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (01/10/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (10/01/2026)</option>
              <option value="DD-MMM-YYYY">DD-MMM-YYYY (01-Oct-2026)</option>
            </select>
          </div>
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center space-x-1.5">
            <Globe className="h-4 w-4 text-indigo-400" />
            <span>Language Localization</span>
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="en-US">English (United States)</option>
            <option value="es-ES">Spanish (Español)</option>
            <option value="fr-FR">French (Français)</option>
            <option value="de-DE">German (Deutsch)</option>
          </select>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-lg shadow-md transition-colors flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
