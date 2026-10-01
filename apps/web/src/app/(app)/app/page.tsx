'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import {
  Users,
  Building2,
  MapPin,
  Paintbrush,
  UserCog,
  UserPlus,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function TenantDashboardPage() {
  const { user, companyId, branding } = useAuthStore();
  const [stats, setStats] = useState<{
    totalEmployees: number;
    totalDepartments: number;
    totalLocations: number;
    totalDesignations: number;
  }>({
    totalEmployees: 0,
    totalDepartments: 0,
    totalLocations: 0,
    totalDesignations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      api
        .get(`/companies/${companyId}/stats`)
        .then((res) => {
          if (res.data?.data) {
            setStats(res.data.data);
          }
        })
        .catch(() => {
          // Ignore fallback
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [companyId]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${user?.firstName || 'User'}!`}
        subtitle={`Managing HR operations for ${branding?.companyNameDisplay || 'your organization'}`}
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Employees"
          value={isLoading ? '...' : stats.totalEmployees.toString()}
          icon={<Users className="h-5 w-5" />}
          description="Active tenant staff"
        />

        <StatCard
          title="Departments"
          value={isLoading ? '...' : stats.totalDepartments.toString()}
          icon={<Building2 className="h-5 w-5" />}
          description="Organizational units"
        />

        <StatCard
          title="Office Locations"
          value={isLoading ? '...' : stats.totalLocations.toString()}
          icon={<MapPin className="h-5 w-5" />}
          description="Global office sites"
        />

        <StatCard
          title="Designations"
          value={isLoading ? '...' : stats.totalDesignations.toString()}
          icon={<Layers className="h-5 w-5" />}
          description="Job titles & roles"
        />
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Launchpad */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Quick Action Launchpad</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/app/employees"
              className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 transition-all flex items-center space-x-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UserPlus className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">Add Employee</p>
                <p className="text-[10px] text-slate-400">Onboard staff</p>
              </div>
            </Link>

            <Link
              href="/app/departments"
              className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 transition-all flex items-center space-x-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">Departments</p>
                <p className="text-[10px] text-slate-400">Org structure</p>
              </div>
            </Link>

            <Link
              href="/app/settings/branding"
              className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 transition-all flex items-center space-x-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Paintbrush className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">Custom Brand</p>
                <p className="text-[10px] text-slate-400">Logo & colors</p>
              </div>
            </Link>

            <Link
              href="/app/settings/preferences"
              className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 transition-all flex items-center space-x-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UserCog className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">Preferences</p>
                <p className="text-[10px] text-slate-400">Theme & zone</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Tenant System Health Status */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Multi-Tenant Node Health</span>
            </h3>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">PostgreSQL RLS Partition</span>
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Isolated</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">BullMQ Email Dispatcher</span>
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Active Queue</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">MinIO S3 Asset Storage</span>
                <span className="text-indigo-400 font-semibold">hrms-branding</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {user?.isSuperAdmin && (
              <Link
                href="/super-admin"
                className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Switch to Super Admin Panel</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
