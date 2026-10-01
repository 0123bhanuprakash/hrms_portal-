'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  MapPin,
  Settings,
  Paintbrush,
  UserCog,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Building,
} from 'lucide-react';

export default function TenantAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, companyId, branding, setBranding, logout } = useAuthStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    pathname.startsWith('/app/settings'),
  );

  // Fetch tenant branding if companyId is present
  useEffect(() => {
    if (companyId && !branding) {
      api
        .get(`/companies/${companyId}/branding`)
        .then((res) => {
          if (res.data?.data) {
            setBranding(res.data.data);
          }
        })
        .catch(() => {
          // Fallback or ignore
        });
    }
  }, [companyId, branding, setBranding]);

  // Inject brand colors into CSS variables dynamically
  useEffect(() => {
    if (branding?.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    }
    if (branding?.secondaryColor) {
      document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
    }
  }, [branding]);

  const navItems = [
    { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
    { name: 'Employees', href: '/app/employees', icon: Users },
    { name: 'Departments', href: '/app/departments', icon: Building2 },
    { name: 'Designations', href: '/app/designations', icon: Briefcase },
    { name: 'Locations', href: '/app/locations', icon: MapPin },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyNameDisplay || 'Company Logo'}
              className="h-8 max-w-[180px] object-contain"
            />
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
                {branding?.companyNameDisplay?.[0] || 'C'}
              </div>
              <span className="font-bold text-lg text-white">
                {branding?.companyNameDisplay || 'Company Portal'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {user?.isSuperAdmin && (
            <Link
              href="/super-admin"
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center space-x-1"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Super Admin Portal</span>
            </Link>
          )}

          <div className="flex items-center space-x-3 pl-4 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-semibold text-xs border border-indigo-500/30">
              {user?.firstName?.[0] || 'U'}
              {user?.lastName?.[0] || ''}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-200 leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between p-4 shrink-0">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Settings Accordion */}
            <div className="pt-3">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  pathname.startsWith('/app/settings')
                    ? 'text-indigo-400 bg-indigo-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isSettingsOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {isSettingsOpen && (
                <div className="pl-9 pr-2 py-1 space-y-1">
                  <Link
                    href="/app/settings/branding"
                    className={`block px-3 py-2 rounded-md text-xs transition-colors ${
                      pathname === '/app/settings/branding'
                        ? 'text-white font-semibold bg-slate-800'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Paintbrush className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Tenant Branding</span>
                    </div>
                  </Link>
                  <Link
                    href="/app/settings/preferences"
                    className={`block px-3 py-2 rounded-md text-xs transition-colors ${
                      pathname === '/app/settings/preferences'
                        ? 'text-white font-semibold bg-slate-800'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <UserCog className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Preferences</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </nav>

          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-400">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold mb-1">
              <Building className="h-3.5 w-3.5" />
              <span>Multi-Tenant Node</span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              {branding?.companyNameDisplay || 'Active Company'}
            </p>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-8 overflow-y-auto bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
