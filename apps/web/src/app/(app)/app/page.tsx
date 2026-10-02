'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, ImageIcon, Palette, SlidersHorizontal, UserCheck, Users, UsersRound } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import { useCompanyBranding, useCompanyStats } from '@/lib/company/queries';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const ROADMAP = [
  { title: 'Employee directory', description: 'Profiles, documents and org chart.' },
  { title: 'Attendance', description: 'Clock-in, shifts and regularization.' },
  { title: 'Leave', description: 'Policies, balances and approvals.' },
  { title: 'Payroll', description: 'Salary runs, payslips and statutory compliance.' },
];

export default function CompanyDashboardPage() {
  const { user, companyId, permissions } = useAuthStore();
  const branding = useCompanyBranding(companyId);
  const stats = useCompanyStats(companyId);
  const s = stats.data;
  const canBrand = user?.isSuperAdmin || permissions.includes('branding.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${greeting()}, ${user?.firstName ?? ''}`}
        title={branding.data?.displayName ?? 'Dashboard'}
        description="Your HR workspace at a glance."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Employees" value={s?.employeeCount} icon={<Users />} />
        <StatCard title="Departments" value={s?.departmentCount} icon={<Building2 />} tone="info" />
        <StatCard title="Portal users" value={s?.userCount} icon={<UsersRound />} tone="neutral" />
        <StatCard title="Active users" value={s?.activeUserCount} icon={<UserCheck />} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Coming to your workspace" description="Modules on the roadmap for this portal" />
          <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            {ROADMAP.map((m) => (
              <li key={m.title} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{m.title}</p>
                  <Badge>Soon</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Make it yours" description="Personalize your company portal" />
          <div className="space-y-1 px-3 pb-3">
            {[
              ...(canBrand
                ? [
                    { href: '/app/settings/theme', icon: Palette, title: 'Theme', text: 'Colors, font, shapes — with live preview' },
                    { href: '/app/settings/branding', icon: ImageIcon, title: 'Branding', text: 'Logo, favicon and display name' },
                  ]
                : []),
              { href: '/app/settings/preferences', icon: SlidersHorizontal, title: 'Preferences', text: 'Appearance, time zone and date format' },
            ].map(({ href, icon: Icon, title, text }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{text}</span>
                </span>
                <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
