'use client';

import React, { useEffect, useState } from 'react';
import type { PreviewMessage } from '@/lib/theme/preview';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { ThemeStyle } from '@/components/theme/theme-style';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { DEFAULT_PRESET } from '@/lib/theme/presets';
import { cn } from '@/lib/cn';

// ============================================================
// /theme-preview — rendered inside the Theme Studio iframe.
// Receives { type: 'hrms-theme-preview', tokens, mode, page } via
// postMessage (same origin only) and renders a mock company portal
// with the real UI components, so the preview is faithful.
// ============================================================

const PEOPLE = [
  { name: 'Aarav Sharma', role: 'Product Designer', dept: 'Design', status: 'Active' },
  { name: 'Diya Patel', role: 'HR Business Partner', dept: 'People', status: 'On leave' },
  { name: 'Kabir Singh', role: 'Backend Engineer', dept: 'Engineering', status: 'Active' },
  { name: 'Meera Iyer', role: 'Finance Analyst', dept: 'Finance', status: 'Probation' },
];

export default function ThemePreviewPage() {
  const [state, setState] = useState<Omit<PreviewMessage, 'type'>>({
    tokens: DEFAULT_PRESET.tokens,
    mode: 'light',
    page: 'dashboard',
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as PreviewMessage | undefined;
      if (data?.type === 'hrms-theme-preview') setState({ tokens: data.tokens, mode: data.mode, page: data.page });
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'hrms-theme-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', state.mode === 'dark');
    root.classList.toggle('light', state.mode === 'light');
    root.style.colorScheme = state.mode;
  }, [state.mode]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ThemeStyle tokens={state.tokens} />

      {/* Sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sm:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">AC</span>
          <span className="text-sm font-semibold">Acme Corp</span>
        </div>
        <nav className="space-y-0.5 px-3 py-2 text-[13px] font-medium">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
            { icon: Users, label: 'People', page: 'people' },
            { icon: CalendarDays, label: 'Leave', page: 'form' },
            { icon: Wallet, label: 'Payroll' },
            { icon: Settings, label: 'Settings' },
          ].map(({ icon: Icon, label, page }) => {
            const active = page === state.page;
            return (
              <div
                key={label}
                className={cn(
                  'relative flex h-8 items-center gap-2.5 rounded-md px-2',
                  active ? 'bg-sidebar-active text-sidebar-active-foreground' : 'text-sidebar-foreground',
                )}
              >
                {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />}
                <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-sidebar-muted')} />
                {label}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-5">
          <div className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-surface px-2.5 text-xs text-muted-foreground shadow-card">
            <Search className="h-3.5 w-3.5" /> Search people, policies…
          </div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-2xs font-semibold text-primary-soft-foreground">DP</span>
          </div>
        </header>

        <main className="flex-1 space-y-5 p-5">
          {state.page === 'dashboard' && <DashboardPreview />}
          {state.page === 'people' && <PeoplePreview />}
          {state.page === 'form' && <FormPreview />}
        </main>
      </div>
    </div>
  );
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function DashboardPreview() {
  return (
    <>
      <PageTitle title="Good morning, Diya" subtitle="Here's what's happening at Acme today." action={<Button size="sm" icon={<Plus />}>Add employee</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Headcount', value: '248', tone: 'bg-primary-soft text-primary-soft-foreground', icon: Users },
          { label: 'Present today', value: '231', tone: 'bg-success-soft text-success', icon: CheckCircle2 },
          { label: 'On leave', value: '12', tone: 'bg-warning-soft text-warning', icon: CalendarDays },
          { label: 'Pending approvals', value: '5', tone: 'bg-info-soft text-info', icon: Clock },
        ].map(({ label, value, tone, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', tone)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Attendance this week" description="Present vs. expected" />
          <div className="flex h-36 items-end gap-3 px-5 pb-5">
            {[72, 88, 94, 81, 97].map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md bg-primary/85" style={{ height: `${v}%` }} />
                <span className="text-2xs text-muted-foreground">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Leave requests" description="Awaiting your approval" />
          <ul className="divide-y divide-border border-t border-border">
            {PEOPLE.slice(0, 3).map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="flex gap-1.5">
                  <Button size="sm" variant="secondary">Decline</Button>
                  <Button size="sm">Approve</Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function PeoplePreview() {
  const tone = (s: string) => (s === 'Active' ? 'success' : s === 'On leave' ? 'warning' : 'info') as 'success' | 'warning' | 'info';
  return (
    <>
      <PageTitle title="People" subtitle="248 employees across 6 departments" action={<Button size="sm" icon={<Plus />}>Invite</Button>} />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Department</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PEOPLE.map((p, i) => (
              <tr key={p.name} className={cn(i === 1 && 'bg-subtle')}>
                <td className="px-4 py-3">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.role}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.dept}</td>
                <td className="px-4 py-3"><Badge tone={tone(p.status)} dot>{p.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function FormPreview() {
  return (
    <>
      <PageTitle title="Request leave" subtitle="Your manager will be notified." />
      <Card className="max-w-lg p-5">
        <div className="space-y-4">
          <Field label="Leave type" htmlFor="pv-type" required>
            <Input id="pv-type" defaultValue="Annual leave" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="pv-from"><Input id="pv-from" defaultValue="12 Oct 2026" /></Field>
            <Field label="To" htmlFor="pv-to" error="End date must be after start date"><Input id="pv-to" defaultValue="10 Oct 2026" invalid /></Field>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-info-soft p-3 text-xs text-info">
            <CalendarDays className="h-3.5 w-3.5" /> You have 9 days of annual leave remaining.
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost">Cancel</Button>
            <Button variant="secondary">Save draft</Button>
            <Button>Submit request</Button>
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">Primary</Badge>
        <Badge tone="success" dot>Approved</Badge>
        <Badge tone="warning" dot>Pending</Badge>
        <Badge tone="danger" dot>Rejected</Badge>
        <Badge tone="info">Info</Badge>
        <Button size="sm" variant="danger">Delete</Button>
        <Button size="sm" variant="soft">Soft</Button>
      </div>
    </>
  );
}
