/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { LayoutDashboard, Users, CalendarDays, Wallet, Bell } from 'lucide-react';
import { CompanyAvatar } from './company-avatar';

/** Miniature company portal rendered with the given brand colors. */
export function BrandPreview({
  name,
  logoUrl,
  primaryColor,
  secondaryColor,
}: {
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
}) {
  const valid = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
  const primary = valid(primaryColor) ? primaryColor : '#4F46E5';
  const secondary = valid(secondaryColor) ? secondaryColor : '#EEF2FF';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white text-slate-800 shadow-lg select-none">
      <div className="flex h-9 items-center justify-between px-3" style={{ backgroundColor: primary }}>
        <div className="flex items-center gap-2">
          <CompanyAvatar name={name || 'Company'} logoUrl={logoUrl} color="rgba(255,255,255,0.25)" size="sm" className="h-6 w-6 rounded-md text-[9px]" />
          <span className="text-xs font-semibold text-white truncate max-w-[140px]">{name || 'Company name'}</span>
        </div>
        <Bell className="h-3.5 w-3.5 text-white/80" />
      </div>
      <div className="flex h-40">
        <div className="w-28 space-y-1 border-r border-slate-100 p-2" style={{ backgroundColor: secondary }}>
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: Users, label: 'Employees' },
            { icon: CalendarDays, label: 'Leave' },
            { icon: Wallet, label: 'Payroll' },
          ].map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-medium"
              style={active ? { backgroundColor: primary, color: '#fff' } : { color: '#475569' }}
            >
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-2 p-3">
          <div className="h-2.5 w-24 rounded bg-slate-200" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-md border border-slate-100 p-2">
                <div className="h-1.5 w-8 rounded bg-slate-200" />
                <div className="mt-1.5 h-3 w-6 rounded" style={{ backgroundColor: primary, opacity: 0.85 - i * 0.2 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <span className="rounded-md px-2 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: primary }}>
              Primary action
            </span>
            <span className="rounded-md px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: secondary, color: primary }}>
              Secondary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
