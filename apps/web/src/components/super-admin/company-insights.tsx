'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Building2, CalendarDays, Clock, Gauge, Pause, Plus, StickyNote, Tag, Trash2, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Drawer } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/field';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Ring } from '@/components/dashboard/widgets';
import { HBars, TrendChart } from '@/components/dashboard/charts';
import { CountUp } from '@/components/motion/motion';
import {
  HEALTH_META,
  bytes,
  useAddCompanyNote,
  useCompanyPanel,
  useRemoveCompanyNote,
  useSetCompanyTags,
  type Attention,
  type CompaniesSummary,
  type CompanyInsights,
  type Stage,
} from '@/lib/admin/company-insights';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative, humanizeAction } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Tiny trend line; colour from the text colour. */
export function Spark({ values, className, width = 64, height = 22 }: { values: number[]; className?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${((i * width) / Math.max(1, values.length - 1)).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('shrink-0', className)} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="m-line" />
    </svg>
  );
}

const HEALTH_TEXT = { success: 'text-success', warning: 'text-warning', danger: 'text-destructive' } as const;
export function HealthPill({ health }: { health: CompanyInsights['health'] }) {
  const meta = HEALTH_META[health.label];
  return (
    <span className="flex items-center gap-2" title={`Health ${health.score}/100 — sign-ins in the last 7 days and setup progress`}>
      <Ring value={health.score} max={100} size={34} stroke={4} tone={meta.tone === 'danger' ? 'danger' : meta.tone} label={`Health ${health.score}`}>
        <span className="text-[10px] font-bold tabular-nums">{health.score}</span>
      </Ring>
      <span className={cn('text-xs font-semibold', HEALTH_TEXT[meta.tone])}>{meta.label}</span>
    </span>
  );
}

// ─── Summary row ────────────────────────────────────────────

export function SummaryTiles({ data }: { data?: CompaniesSummary }) {
  if (!data) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const c = data.companies;
  const rate = data.users.total ? Math.round((data.users.activeThisWeek / data.users.total) * 100) : 0;
  const tile = 'm-lift relative flex flex-col gap-1 overflow-hidden p-4';
  return (
    <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Companies</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={c.total} /></span>
        <span className="text-xs text-muted-foreground">{c.newThisMonth ? <b className="text-success">▲ {c.newThisMonth}</b> : 'none'} this month</span>
        <Spark values={c.growth} className="absolute bottom-3 right-3 text-primary" />
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Active · Inactive · Suspended</span>
        <span className="text-[26px] font-bold leading-none tracking-tight">{c.active} <span className="text-sm font-semibold text-muted-foreground">· {c.inactive} · {c.suspended}</span></span>
        <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
          <i className="m-fill-w bg-success" style={{ width: `${(c.active / Math.max(1, c.total)) * 100}%` }} />
          <i className="m-fill-w bg-muted-foreground/50" style={{ width: `${(c.inactive / Math.max(1, c.total)) * 100}%` }} />
          <i className="m-fill-w bg-destructive" style={{ width: `${(c.suspended / Math.max(1, c.total)) * 100}%` }} />
        </span>
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Employees across companies</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={data.employees} /></span>
        <span className="text-xs text-muted-foreground">{data.users.total} portal users</span>
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Signed in this week</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={rate} />%</span>
        <span className="text-xs text-muted-foreground">{data.users.activeThisWeek} of {data.users.total} users</span>
      </Card>
      <Card className={cn(tile, data.attentionTotal > 0 && 'border-warning/40')}>
        <span className="text-xs text-muted-foreground">Needs attention</span>
        <span className={cn('text-[26px] font-bold leading-none tracking-tight', data.attentionTotal ? 'text-warning' : 'text-success')}><CountUp value={data.attentionTotal} /></span>
        <span className="text-xs text-muted-foreground">{data.attentionTotal ? 'see below' : 'all good'}</span>
      </Card>
    </div>
  );
}

const ATTN_ICON: Record<Attention['kind'], { icon: React.ReactNode; cls: string }> = {
  suspended: { icon: <Pause />, cls: 'bg-destructive-soft text-destructive' },
  inactive: { icon: <Pause />, cls: 'bg-muted text-muted-foreground' },
  near_limit: { icon: <Gauge />, cls: 'bg-warning-soft text-warning' },
  no_activity: { icon: <Clock />, cls: 'bg-warning-soft text-warning' },
  setup: { icon: <Building2 />, cls: 'bg-info-soft text-info' },
  no_holidays: { icon: <CalendarDays />, cls: 'bg-info-soft text-info' },
};

/** What needs the Super Admin's attention; each opens the company's panel. */
export function AttentionStrip({ items, total, onOpen }: { items: Attention[]; total: number; onOpen: (companyId: string) => void }) {
  if (!items.length) return null;
  return (
    <Card className="flex flex-col gap-2 p-3 lg:flex-row lg:items-stretch">
      <div className="flex shrink-0 items-center gap-2 px-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-warning" /> Needs attention {total > items.length && <span className="text-xs text-muted-foreground">· {total}</span>}
      </div>
      <div className="m-stagger grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 3).map((a) => (
          <button key={`${a.companyId}-${a.kind}`} type="button" onClick={() => onOpen(a.companyId)} className="m-lift flex items-center gap-3 rounded-lg border border-border bg-subtle/40 px-3 py-2.5 text-left">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', ATTN_ICON[a.kind].cls)}>{ATTN_ICON[a.kind].icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{a.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </Card>
  );
}

const STAGES: Array<{ key: Stage; label: string; hint: string }> = [
  { key: 'invited', label: 'Invited', hint: 'Nobody has signed in yet' },
  { key: 'setting_up', label: 'Setting up', hint: 'Signed in, setup not finished' },
  { key: 'live', label: 'Live', hint: 'Fully set up' },
  { key: 'paused', label: 'Paused', hint: 'Inactive or suspended' },
];

/** Onboarding pipeline — companies move on their own as setup progresses. */
export function Pipeline({ data, onOpen }: { data?: CompaniesSummary; onOpen: (id: string) => void }) {
  if (!data) return <Skeleton className="h-40" />;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="flex-1 text-sm font-semibold">Onboarding pipeline</h2>
        <span className="text-xs text-muted-foreground">Companies move along on their own as they set up</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s) => (
          <div key={s.key} className={cn('flex min-h-[110px] flex-col gap-2 rounded-lg border p-3', s.key === 'live' ? 'border-success/30 bg-success-soft/20' : 'border-border bg-subtle/40')}>
            <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wide text-muted-foreground">
              <span title={s.hint}>{s.label}</span>
              <span>{data.stages[s.key].length}</span>
            </div>
            {data.stages[s.key].slice(0, 5).map((c) => (
              <button key={c.id} type="button" onClick={() => onOpen(c.id)} className="m-lift flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left text-xs">
                <CompanyAvatar name={c.name} size="sm" className="!h-6 !w-6 !rounded-md text-[9px]" />
                <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                {s.key !== 'paused' && <span className="tabular-nums text-muted-foreground">{c.setupPercent}%</span>}
              </button>
            ))}
            {data.stages[s.key].length > 5 && <span className="text-2xs text-muted-foreground">+{data.stages[s.key].length - 5} more</span>}
            {!data.stages[s.key].length && <span className="text-2xs text-muted-foreground">{s.hint}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Tags ───────────────────────────────────────────────────

export function TagEditor({ companyId, tags }: { companyId: string; tags: string[] }) {
  const set = useSetCompanyTags();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const save = async (next: string[]) => {
    try {
      await set.mutateAsync({ id: companyId, tags: next });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save tags'));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-2xs font-semibold">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => void save(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-subtle">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = draft.trim();
            if (v && !tags.includes(v)) void save([...tags, v]);
            setDraft('');
            setAdding(false);
          }}
        >
          <input autoFocus value={draft} maxLength={30} onChange={(e) => setDraft(e.target.value)} onBlur={() => setAdding(false)} placeholder="Tag…" aria-label="New tag" className="h-6 w-28 rounded-full border border-border bg-surface px-2 text-2xs outline-none focus:ring-2 focus:ring-ring" />
        </form>
      ) : (
        tags.length < 10 && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-2xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3 w-3" /> Tag
          </button>
        )
      )}
    </div>
  );
}

// ─── Company side panel ─────────────────────────────────────

type PanelTab = 'overview' | 'notes';

/** Click a company: usage, setup, recent activity, tags and notes — without leaving the list. */
export function CompanyPanel({
  company,
  onClose,
  onChangeStatus,
}: {
  company: { id: string; name: string; slug: string; email: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; createdAt: string; plan?: { name: string } | null; branding?: { logoUrl: string | null; primaryColor: string } | null } | null;
  onClose: () => void;
  onChangeStatus: () => void;
}) {
  const q = useCompanyPanel(company?.id ?? null);
  const [tab, setTab] = useState<PanelTab>('overview');
  if (!company) return null;
  const d = q.data;
  return (
    <Drawer
      open
      onClose={onClose}
      className="max-w-2xl"
      title={company.name}
      description={`${company.slug} · ${company.email} · created ${formatRelative(company.createdAt)}`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onChangeStatus}><Pause /> Change status</Button>
          <Link href={`/super-admin/companies/${company.id}?tab=plan`} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-subtle">Plan &amp; features</Link>
          <Link href={`/super-admin/companies/${company.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Open full page <ArrowRight className="h-3.5 w-3.5" /></Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <CompanyAvatar name={company.name} logoUrl={company.branding?.logoUrl} color={company.branding?.primaryColor} />
          <StatusBadge status={company.status} />
          {company.plan && <Badge tone="primary">{company.plan.name}</Badge>}
          {d && <TagEditor companyId={company.id} tags={d.tags} />}
        </div>

        {!d ? (
          <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : (
          <>
            <div className="m-stagger grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                ['Employees', d.employees, d.maxEmployees ? `of ${d.maxEmployees}` : 'no limit'],
                ['Signed in this week', d.users ? `${Math.round((d.activeUsers7d / d.users) * 100)}%` : '—', `${d.activeUsers7d} of ${d.users} users`],
                ['Documents', bytes(d.storageBytes), 'stored'],
              ].map(([l, v, h]) => (
                <div key={String(l)} className="rounded-lg border border-border p-3">
                  <span className="block text-2xs text-muted-foreground">{l}</span>
                  <span className="block text-lg font-bold">{v}</span>
                  <span className="block text-2xs text-muted-foreground">{h}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <HealthPill health={d.health} />
              </div>
            </div>

            <div role="tablist" className="flex gap-4 border-b border-border text-sm">
              {(['overview', 'notes'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn('-mb-px border-b-2 pb-2 font-medium capitalize', tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  {t === 'notes' ? `Notes${d.notes.length ? ` · ${d.notes.length}` : ''}` : 'Overview'}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-border p-3">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-muted-foreground" /> People active each day · 30 days</h3>
                  <TrendChart points={d.dailyActive.map((x, i) => ({ label: i % 5 === 0 ? new Date(`${x.day}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '', value: x.users, title: `${x.day}: ${x.users}` }))} area height={90} label="People active each day" />
                </section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <section className="rounded-lg border border-border p-3">
                    <h3 className="mb-3 text-sm font-semibold">Modules in use · 30 days</h3>
                    <HBars rows={d.modules.map((m) => ({ label: m.label, value: m.percent, max: 100, right: `${m.percent}%` }))} />
                  </section>
                  <section className="rounded-lg border border-border p-3">
                    <h3 className="mb-2 text-sm font-semibold">Setup · {d.setup.percent}%</h3>
                    <ul className="space-y-1.5 text-sm">
                      {d.setup.items.map((s) => (
                        <li key={s.key} className="flex items-center gap-2">
                          <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold', s.done ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{s.done ? '✓' : '!'}</span>
                          <span className={s.done ? '' : 'text-muted-foreground'}>{s.label}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
                <section className="rounded-lg border border-border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
                  {d.recentActivity.length ? (
                    <ul className="space-y-1.5 text-xs">
                      {d.recentActivity.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span className="flex-1 truncate font-medium">{humanizeAction(a.action)}</span>
                          <span className="shrink-0 text-muted-foreground">{a.user ? (a.user.isSuperAdmin ? 'Super Admin' : a.user.email) : 'system'} · {formatRelative(a.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
                  )}
                </section>
              </div>
            ) : (
              <NotesTab companyId={company.id} notes={d.notes} />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function NotesTab({ companyId, notes }: { companyId: string; notes: Array<{ id: string; body: string; createdAt: string; author: { firstName: string; lastName: string } | null }> }) {
  const add = useAddCompanyNote(companyId);
  const remove = useRemoveCompanyNote(companyId);
  const [body, setBody] = useState('');
  return (
    <div className="space-y-3">
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          try {
            await add.mutateAsync(body.trim());
            setBody('');
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save the note'));
          }
        }}
      >
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Add a note — only Super Admins see these" aria-label="New note" />
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={!body.trim()} loading={add.isPending}><StickyNote /> Add note</Button>
        </div>
      </form>
      {notes.length ? (
        <ul className="m-stagger space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-border p-3">
              <p className="whitespace-pre-line text-sm">{n.body}</p>
              <div className="mt-1.5 flex items-center gap-2 text-2xs text-muted-foreground">
                <span className="flex-1">{n.author ? `${n.author.firstName} ${n.author.lastName}` : 'Former admin'} · {formatRelative(n.createdAt)}</span>
                <button type="button" aria-label="Remove note" onClick={() => remove.mutate(n.id, { onError: (err) => toast.error(getApiErrorMessage(err, 'Could not remove')) })} className="rounded p-1 opacity-0 transition-opacity hover:bg-subtle group-hover:opacity-100 focus-visible:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
