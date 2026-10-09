'use client';

import React, { useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, BarChart3, Download, EyeOff, Mail, Network, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { useHintManagers, useKudosInsights, type KudosInsights } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const PERIODS = [[1, '30 days'], [3, '3 months'], [6, '6 months'], [12, 'Year']] as const;
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });

export default function KudosInsightsPage() {
  const { can, hasFeature, isLoading } = useAccess();
  const [months, setMonths] = useState<number>(6);
  const allowed = hasFeature('engage.kudos') && can('kudos.manage');
  const q = useKudosInsights(months, allowed);
  if (!isLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Only HR can see recognition insights" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Recognition insights"
        description="Who is being thanked, for what, and who might be missed. Only HR sees this page."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" asChild><Link href="/app/kudos"><ArrowLeft /> Shout-outs</Link></Button>
            <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Period">
              {PERIODS.map(([m, l]) => (
                <button key={m} type="button" aria-pressed={months === m} onClick={() => setMonths(m)} className={cn('h-8 rounded-md px-3 text-xs font-semibold', months === m ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>{l}</button>
              ))}
            </div>
            {q.data && <Button variant="secondary" onClick={() => exportCsv(q.data!)}><Download /> Export</Button>}
          </div>
        }
      />
      {q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load insights')} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : (
        <Body d={q.data} />
      )}
    </div>
  );
}

function Body({ d }: { d: KudosInsights }) {
  const change = d.previous ? Math.round(((d.sent - d.previous) / d.previous) * 100) : null;
  const max = Math.max(1, ...d.monthly.map((m) => m.count));
  const maxValue = Math.max(1, ...d.values.map((v) => v.count));
  const quiet = d.values.filter((v) => v.value && v.count / Math.max(1, d.sent) < 0.1);
  const tiles: Array<[string, string, string, string]> = [
    ['Shout-outs sent', String(d.sent), change === null ? 'First period' : `${change >= 0 ? '+' : ''}${change}% vs the period before`, change !== null && change < 0 ? 'text-destructive' : 'text-success'],
    ['People thanked', `${d.peopleThanked} of ${d.headcount}`, `${d.headcount ? Math.round((d.peopleThanked / d.headcount) * 100) : 0}% of the company`, 'text-success'],
    ['People giving', String(d.givers), `${d.headcount ? Math.round((d.givers / d.headcount) * 100) : 0}% gave at least once`, d.givers / Math.max(1, d.headcount) < 0.5 ? 'text-warning' : 'text-success'],
    ['Not thanked · 90 days', String(d.notThanked.length), d.notThanked.length ? 'see the list below' : 'everyone was thanked', d.notThanked.length ? 'text-destructive' : 'text-success'],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([l, v, s, tone]) => (
          <Card key={l} className="p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
            <p className={cn('text-xs font-semibold', tone)}>{s}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<BarChart3 />} title="Shout-outs per month" />
          <div className="flex h-48 items-end gap-3 px-5 pb-5">
            {d.monthly.map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold tabular-nums">{m.count}</span>
                <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-lg bg-gradient-to-t from-primary to-primary/60 transition-[height] duration-700" style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 6 : 2 }} /></div>
                <span className="text-xs text-muted-foreground">{monthName(m.month)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader icon={<Sparkles />} title="What people are thanked for" />
          <div className="space-y-2.5 px-5 pb-5">
            {!d.values.length && <p className="text-sm text-muted-foreground">No shout-outs in this period.</p>}
            {d.values.map((v) => (
              <div key={v.value?.id ?? 'none'}>
                <div className="flex text-xs"><span className="flex-1 font-semibold">{v.value ? `${v.value.emoji} ${v.value.name}` : 'No value tagged'}</span><span className="text-muted-foreground tabular-nums">{v.count} · {Math.round((v.count / Math.max(1, d.sent)) * 100)}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(v.count / maxValue) * 100}%`, background: v.value?.color ?? 'hsl(var(--muted-foreground))' }} /></div>
              </div>
            ))}
            {quiet.length > 0 && <p className="pt-1 text-xs text-muted-foreground">💡 {quiet.map((v) => v.value!.name).join(', ')} {quiet.length === 1 ? 'is' : 'are'} rarely recognised — maybe highlight {quiet.length === 1 ? 'it' : 'them'} in the next all-hands.</p>}
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Matrix d={d} />
        <NotThanked d={d} />
      </div>
    </div>
  );
}

function Matrix({ d }: { d: KudosInsights }) {
  const { departments, counts } = d.matrix;
  const max = Math.max(1, ...counts.flat());
  if (departments.length < 2) {
    return (
      <Card>
        <CardHeader icon={<Network />} title="Who thanks whom" />
        <p className="px-5 pb-5 text-sm text-muted-foreground">Needs shout-outs between at least two departments.</p>
      </Card>
    );
  }
  const across = counts.reduce((n, row, i) => n + row.reduce((m, c, j) => m + (i === j ? 0 : c), 0), 0);
  const total = counts.flat().reduce((n, c) => n + c, 0);
  return (
    <Card>
      <CardHeader icon={<Network />} title="Who thanks whom" description="Rows give · columns receive" />
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr><th /><>{departments.map((x) => <th key={x.id} className="truncate px-1 font-medium text-muted-foreground" title={x.name}>{x.name.slice(0, 6)}</th>)}</></tr>
          </thead>
          <tbody>
            {departments.map((row, i) => (
              <tr key={row.id}>
                <th className="max-w-[7rem] truncate pr-2 text-left font-semibold" title={row.name}>{row.name}</th>
                {counts[i]!.map((c, j) => (
                  <td key={j} className={cn('h-8 min-w-8 rounded-md text-center font-semibold tabular-nums', i === j && 'ring-1 ring-inset ring-border')} style={{ background: `hsl(var(--primary) / ${0.06 + (c / max) * 0.8})`, color: c / max > 0.5 ? 'white' : undefined }} title={`${row.name} → ${departments[j]!.name}: ${c}`}>
                    {c || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">{total ? `${Math.round((across / total) * 100)}% of shout-outs cross departments.` : ''} The diagonal is thanks inside a team.</p>
      </div>
    </Card>
  );
}

function NotThanked({ d }: { d: KudosInsights }) {
  const hint = useHintManagers();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const people = d.notThanked;
  const all = people.length > 0 && people.every((p) => picked.has(p.employee.id));
  const reason = (p: KudosInsights['notThanked'][number]) => {
    const days = Math.floor((Date.now() - new Date(p.joiningDate).getTime()) / 86_400_000);
    if (days < 60) return 'New — say welcome';
    return p.lastKudosAt ? `Last thanked ${formatRelative(p.lastKudosAt)}` : 'Never thanked';
  };
  const send = (ids: string[]) =>
    hint.mutate(ids, {
      onSuccess: (r) => {
        toast.success(`${r.hinted} manager${r.hinted === 1 ? '' : 's'} got a quiet note${r.skipped.length ? ` · no manager for ${r.skipped.join(', ')}` : ''}`);
        setPicked(new Set());
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send')),
    });
  return (
    <Card>
      <CardHeader icon={<EyeOff />} title="Not thanked in 90 days" description="Private to HR — never shown on the wall" />
      {!people.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Everyone has been thanked recently. <Emoji e="🎉" play="appear" /></p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-y border-border px-5 py-2 text-xs">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={all} onChange={() => setPicked(all ? new Set() : new Set(people.map((p) => p.employee.id)))} aria-label="Select everyone" />
            <span className="text-muted-foreground">{picked.size ? `${picked.size} selected` : `${people.length} people`}</span>
            <Button size="sm" variant="secondary" className="ml-auto" disabled={!picked.size} loading={hint.isPending} onClick={() => send([...picked])}><Mail /> Hint their managers</Button>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {people.map((p) => (
              <li key={p.employee.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={picked.has(p.employee.id)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(p.employee.id) ? n.delete(p.employee.id) : n.add(p.employee.id); return n; })} aria-label={`Select ${p.employee.firstName}`} />
                <PersonAvatar person={p.employee} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/app/employees/${p.employee.id}`} className="block truncate font-medium hover:underline">{p.employee.firstName} {p.employee.lastName}</Link>
                  <p className="truncate text-xs text-muted-foreground">{[p.department, p.manager ? `manager ${p.manager.name}` : 'no manager', `joined ${formatDate(p.joiningDate)}`].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{reason(p)}</span>
              </li>
            ))}
          </ul>
          <p className="px-5 py-3 text-xs text-muted-foreground">Managers get a gentle in-app note (“Nobody has thanked Dev in a while…”) — at most once a month per person.</p>
        </>
      )}
    </Card>
  );
}

function exportCsv(d: KudosInsights) {
  const rows: string[][] = [
    ['Month', 'Shout-outs'],
    ...d.monthly.map((m) => [m.month, String(m.count)]),
    [],
    ['Value', 'Shout-outs'],
    ...d.values.map((v) => [v.value?.name ?? 'No value', String(v.count)]),
    [],
    ['Not thanked in 90 days', 'Department', 'Manager', 'Last thanked'],
    ...d.notThanked.map((p) => [`${p.employee.firstName} ${p.employee.lastName}`, p.department ?? '', p.manager?.name ?? '', p.lastKudosAt?.slice(0, 10) ?? 'never']),
  ];
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `recognition-insights-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
