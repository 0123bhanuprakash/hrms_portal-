'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Building2, ChevronDown, ChevronUp, Crosshair, GitBranch, ImageDown, Maximize2, Minus, Network, Plus, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useOrgChart, type ChartEmployee } from '@/lib/company/org';
import { useOrgHealth, type OrgHealth } from '@/lib/company/lifecycle';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { MoveDialog, type MoveRequest } from './move-dialog';

// ─── Layout ─────────────────────────────────────────────────

const W = 172;
const H = 112;
const GAP_X = 22;
const GAP_Y = 64;
const PALETTE = ['#6366F1', '#14B8A6', '#F59E0B', '#EC4899', '#0EA5E9', '#A855F7', '#22C55E', '#EF4444', '#64748B'];
/** Same colour for a department everywhere on the chart. */
export function deptColor(id: string | null | undefined): string {
  if (!id) return '#94A3B8';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

interface TNode {
  e: ChartEmployee;
  children: TNode[];
  /** everyone below */
  size: number;
  depth: number;
  x: number;
  y: number;
  width: number;
}

function build(list: ChartEmployee[], rootId: string | null): TNode[] {
  const byId = new Map<string, TNode>(list.map((e) => [e.id, { e, children: [], size: 0, depth: 0, x: 0, y: 0, width: W }]));
  const roots: TNode[] = [];
  for (const n of byId.values()) {
    const parent = n.e.reportingManagerId ? byId.get(n.e.reportingManagerId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const rank = (n: TNode) => n.e.designation?.orgLevel?.rank ?? -Infinity;
  const walk = (nodes: TNode[], depth: number) => {
    nodes.sort((a, b) => rank(b) - rank(a) || b.children.length - a.children.length || a.e.firstName.localeCompare(b.e.firstName));
    for (const n of nodes) {
      n.depth = depth;
      walk(n.children, depth + 1);
      n.size = n.children.reduce((s, c) => s + 1 + c.size, 0);
    }
  };
  walk(roots, 0);
  if (rootId && byId.get(rootId)) {
    const r = byId.get(rootId)!;
    const rebase = (n: TNode, d: number) => { n.depth = d; n.children.forEach((c) => rebase(c, d + 1)); };
    rebase(r, 0);
    return [r];
  }
  // Big roots first, people with nobody around them last
  return roots.sort((a, b) => b.size - a.size || a.e.firstName.localeCompare(b.e.firstName));
}

/**
 * Tidy-ish tree: each subtree as wide as its visible children, parents centred
 * above. People who lead nobody are packed into a small grid under their
 * manager, so a manager with 15 reports doesn't make the chart 15 cards wide.
 */
function layout(roots: TNode[], collapsed: Set<string>): { nodes: TNode[]; width: number; height: number } {
  const out: TNode[] = [];
  const kids = (n: TNode) => (collapsed.has(n.e.id) ? [] : n.children);
  const split = (n: TNode) => {
    const all = kids(n);
    const branches = all.filter((c) => kids(c).length > 0);
    const leaves = all.filter((c) => kids(c).length === 0);
    // Few people: keep them in one row (the classic look)
    if (leaves.length <= 3 || all.length <= 4) return { row: all, leaves: [] as TNode[], cols: 0 };
    return { row: branches, leaves, cols: Math.min(4, Math.max(2, Math.ceil(Math.sqrt(leaves.length)))) };
  };
  const gridWidth = (cols: number) => cols * W + (cols - 1) * GAP_X;
  const measure = (n: TNode): number => {
    const { row, leaves, cols } = split(n);
    const parts = row.map(measure);
    if (leaves.length) {
      leaves.forEach(measure);
      parts.push(gridWidth(cols));
    }
    n.width = parts.length ? Math.max(W, parts.reduce((x, y) => x + y, 0) + GAP_X * (parts.length - 1)) : W;
    return n.width;
  };
  const place = (n: TNode, left: number, top: number) => {
    n.x = left + n.width / 2 - W / 2;
    n.y = top;
    out.push(n);
    const { row, leaves, cols } = split(n);
    const childTop = top + H + GAP_Y;
    let l = left + (n.width - (row.reduce((x, c) => x + c.width, 0) + (leaves.length ? gridWidth(cols) : 0) + GAP_X * Math.max(0, row.length + (leaves.length ? 1 : 0) - 1))) / 2;
    for (const c of row) {
      place(c, l, childTop);
      l += c.width + GAP_X;
    }
    leaves.forEach((c, i) => {
      c.width = W;
      c.x = l + (i % cols) * (W + GAP_X);
      c.y = childTop + Math.floor(i / cols) * (H + GAP_Y / 2);
      out.push(c);
    });
  };
  let left = 0;
  for (const r of roots) {
    measure(r);
    place(r, left, 0);
    left += r.width + GAP_X * 2;
  }
  const height = out.reduce((m, n) => Math.max(m, n.y + H), H);
  return { nodes: out, width: Math.max(W, left - GAP_X * 2), height };
}

// ─── Chart ──────────────────────────────────────────────────

export function OrgVisual({ canManage, onOpenDepartments }: { canManage: boolean; onOpenDepartments: () => void }) {
  const chart = useOrgChart();
  const health = useOrgHealth(canManage);
  const employees = useMemo(() => chart.data?.employees ?? [], [chart.data]);
  const [colour, setColour] = useUiState<'department' | 'level'>('org:colour', 'department', (v): v is 'department' | 'level' => v === 'department' || v === 'level');
  const [rootId, setRootId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string> | null>(null);
  const [query, setQuery] = useState('');
  const [move, setMove] = useState<MoveRequest | null>(null);
  const [view, setView] = useState({ x: 24, y: 24, k: 1 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const roots = useMemo(() => build(employees, rootId), [employees, rootId]);
  // Big companies start with two levels open
  useEffect(() => {
    if (collapsed || !employees.length) return;
    const start = new Set<string>();
    if (employees.length > 40) {
      const visit = (n: TNode) => { if (n.depth >= 1 && n.children.length) start.add(n.e.id); n.children.forEach(visit); };
      roots.forEach(visit);
    }
    setCollapsed(start);
  }, [employees, roots, collapsed]);
  const shut = useMemo(() => collapsed ?? new Set<string>(), [collapsed]);
  const { nodes, width, height } = useMemo(() => layout(roots, shut), [roots, shut]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.e.id, n])), [nodes]);
  const focus = focusId ? employees.find((e) => e.id === focusId) ?? null : null;

  const fit = useCallback(() => {
    const el = box.current;
    if (!el || !width) return;
    const k = Math.min(1.1, Math.max(0.55, Math.min((el.clientWidth - 48) / width, (el.clientHeight - 96) / height)));
    setView({ k, x: (el.clientWidth - width * k) / 2, y: 64 });
  }, [width, height]);
  useEffect(() => { fit(); }, [fit, rootId]);

  const centreOn = (id: string) => {
    const el = box.current;
    const n = byId.get(id);
    if (!el || !n) return;
    setView((v) => ({ ...v, x: el.clientWidth / 2 - (n.x + W / 2) * v.k, y: el.clientHeight / 3 - (n.y + H / 2) * v.k }));
  };
  const zoom = (factor: number) => setView((v) => {
    const el = box.current;
    const k = Math.min(2, Math.max(0.2, v.k * factor));
    if (!el) return { ...v, k };
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
  });

  // Ctrl / ⌘ + scroll zooms (native listener — React's wheel events can't stop the browser zoom)
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      zoomRef.current(ev.deltaY < 0 ? 1.1 : 0.9);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [chart.isLoading]);

  /** Opens everyone above `id` so they're on screen, then focuses them. */
  const reveal = (id: string) => {
    const managerOf = new Map(employees.map((e) => [e.id, e.reportingManagerId]));
    const next = new Set(shut);
    let cur = managerOf.get(id) ?? null;
    while (cur) { next.delete(cur); cur = managerOf.get(cur) ?? null; }
    if (rootId && !isBelow(id, rootId, managerOf)) setRootId(null);
    setCollapsed(next);
    setFocusId(id);
    setTimeout(() => centreOn(id), 30);
  };

  const q = query.trim().toLowerCase();
  const hits = q ? employees.filter((e) => `${e.firstName} ${e.lastName} ${e.designation?.name ?? ''}`.toLowerCase().includes(q)).slice(0, 6) : [];

  const exportPng = () => {
    try {
      downloadPng(nodes, width, height, colour);
    } catch {
      toast.error('Could not create the image');
    }
  };

  if (chart.isError) return <ErrorState message={getApiErrorMessage(chart.error, 'Could not load the org chart')} onRetry={() => chart.refetch()} />;
  if (chart.isLoading) return <Skeleton className="h-[560px]" />;
  if (!employees.length) return <EmptyState icon={<Network />} title="No employees yet" description="Add employees and set their reporting managers — the chart builds itself." />;

  const focusNode = focusId ? byId.get(focusId) : undefined;
  const focusTree = focusId ? findNode(build(employees, null), focusId) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div
        ref={box}
        className="relative h-[620px] touch-none select-none overflow-hidden rounded-xl border border-border bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px] bg-subtle/40"
        onPointerDown={(ev) => {
          if ((ev.target as HTMLElement).closest('[data-node],[data-ui]')) return;
          drag.current = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
          (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
        }}
        onPointerMove={(ev) => {
          const d = drag.current;
          if (d) setView((v) => ({ ...v, x: d.vx + ev.clientX - d.x, y: d.vy + ev.clientY - d.y }));
        }}
        onPointerUp={() => { drag.current = null; }}
        aria-label="Org chart — drag to move, Ctrl + scroll to zoom"
      >
        {/* Toolbar */}
        <div data-ui className="absolute left-3 top-3 z-10 flex flex-wrap items-start gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person…" className="h-9 bg-surface pl-8" aria-label="Find a person on the chart" />
            {hits.length > 0 && (
              <ul className="absolute left-0 right-0 top-10 z-20 overflow-hidden rounded-lg border border-border bg-raised shadow-menu">
                {hits.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-subtle" onClick={() => { reveal(e.id); setQuery(''); }}>
                      <PersonAvatar person={e} size="sm" className="h-6 w-6 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate">{e.firstName} {e.lastName}</span>
                      <span className="truncate text-xs text-muted-foreground">{e.designation?.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="inline-flex h-9 rounded-lg border border-border bg-surface p-0.5 text-xs font-semibold" role="group" aria-label="Colour by">
            {(['department', 'level'] as const).map((c) => (
              <button key={c} type="button" onClick={() => setColour(c)} aria-pressed={colour === c} className={cn('rounded-md px-2.5', colour === c ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>
                {c === 'department' ? 'Department' : 'Level'}
              </button>
            ))}
          </div>
          {rootId && (
            <Button variant="secondary" size="sm" className="h-9" onClick={() => setRootId(null)}><X /> Whole company</Button>
          )}
        </div>
        <div data-ui className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-border bg-surface p-1 shadow-card">
          <Button variant="ghost" size="icon-sm" onClick={() => zoom(1.2)} aria-label="Zoom in"><Plus /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out"><Minus /></Button>
          <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Fit to screen"><Maximize2 /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(new Set())} aria-label="Expand everyone"><ChevronDown /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(new Set(nodes.filter((n) => n.depth >= 1 && n.children.length).map((n) => n.e.id)))} aria-label="Collapse to two levels"><ChevronUp /></Button>
          <Button variant="ghost" size="icon-sm" onClick={exportPng} aria-label="Download as image"><ImageDown /></Button>
        </div>

        {/* Canvas */}
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width, height }}>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={height} aria-hidden>
            {nodes.map((n) => (shut.has(n.e.id) ? [] : n.children).map((c) => {
              const x1 = n.x + W / 2;
              const y1 = n.y + H;
              const x2 = c.x + W / 2;
              const y2 = c.y;
              const my = y1 + GAP_Y / 2;
              const lit = focusId && (focusId === n.e.id || focusId === c.e.id);
              return <path key={c.e.id} d={`M${x1},${y1} V${my} H${x2} V${y2}`} fill="none" stroke={lit ? 'hsl(var(--primary))' : 'hsl(var(--border))'} strokeWidth={lit ? 2.5 : 1.5} />;
            }))}
          </svg>
          {nodes.map((n) => {
            const e = n.e;
            const band = colour === 'level' ? e.designation?.orgLevel?.color ?? '#94A3B8' : deptColor(e.department?.id);
            const isShut = shut.has(e.id);
            return (
              <div
                key={e.id}
                data-node
                role="button"
                tabIndex={0}
                onClick={() => setFocusId(e.id === focusId ? null : e.id)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setFocusId(e.id); } }}
                className={cn(
                  'absolute flex cursor-pointer flex-col items-center gap-1 rounded-xl border bg-surface px-2 pb-2 pt-3 text-center shadow-card transition-shadow hover:shadow-md',
                  focusId === e.id ? 'border-primary ring-4 ring-primary/20' : 'border-border',
                  e.joinsOn && 'border-dashed opacity-75',
                )}
                style={{ left: n.x, top: n.y, width: W, height: H }}
                aria-label={`${e.firstName} ${e.lastName}, ${e.designation?.name ?? 'no title'}${n.children.length ? `, ${n.children.length} direct reports` : ''}`}
              >
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl" style={{ background: band }} />
                <PersonAvatar person={e} size="md" className="h-11 w-11 rounded-xl" />
                <span className="w-full truncate text-[12.5px] font-semibold leading-tight">{e.firstName} {e.lastName}</span>
                <span className="w-full truncate text-[11px] leading-tight text-muted-foreground">{e.joinsOn ? `Joins ${formatDate(e.joinsOn)}` : e.designation?.name ?? e.department?.name ?? '—'}</span>
                {n.children.length > 0 && (
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); setCollapsed((c) => { const s = new Set(c ?? []); s.has(e.id) ? s.delete(e.id) : s.add(e.id); return s; }); }}
                    className={cn('absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10.5px] font-bold shadow-card', isShut ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background')}
                    aria-label={isShut ? `Show ${e.firstName}'s team (${n.size})` : `Hide ${e.firstName}'s team`}
                  >
                    {isShut ? `+${n.size}` : n.size}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground">Drag to move · Ctrl + scroll to zoom · click a card to focus · click a count to open or close a team</p>
      </div>

      <div className="space-y-4">
        {focus && focusTree ? (
          <Card className="animate-fade-up">
            <CardHeader icon={<Crosshair />} title={`${focus.firstName}’s team`} action={<Button variant="ghost" size="icon-sm" onClick={() => setFocusId(null)} aria-label="Clear focus"><X /></Button>} />
            <div className="space-y-4 px-5 pb-5">
              <Link href={`/app/employees/${focus.id}`} className="flex items-center gap-3 rounded-lg hover:bg-subtle">
                <PersonAvatar person={focus} size="lg" className="rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{focus.firstName} {focus.lastName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[focus.designation?.name, focus.department?.name].filter(Boolean).join(' · ') || '—'}</span>
                </span>
              </Link>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Direct', focusTree.children.filter((c) => !c.e.joinsOn).length], ['Whole team', countCurrent(focusTree)], ['Levels', depthOf(focusTree)]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-muted px-2 py-2">
                    <p className="text-lg font-semibold tabular-nums">{v}</p>
                    <p className="text-2xs text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
              {focusTree.children.length > 0 && (
                <div className="flex -space-x-2">
                  {focusTree.children.slice(0, 8).map((c) => <PersonAvatar key={c.e.id} person={c.e} size="sm" className="h-8 w-8 border-2 border-surface" />)}
                  {focusTree.children.length > 8 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-muted text-[10px] font-bold">+{focusTree.children.length - 8}</span>}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" asChild><Link href={`/app/employees/${focus.id}`}>Open profile</Link></Button>
                {focusTree.children.length > 0 && <Button variant="secondary" size="sm" onClick={() => { setRootId(focus.id); setFocusId(focus.id); }}>Show only this team</Button>}
                {canManage && <Button variant="secondary" size="sm" onClick={() => setMove({ employee: focus })}><GitBranch /> Change manager</Button>}
              </div>
              {focusNode === undefined && <p className="text-xs text-muted-foreground">They’re inside a closed team — use “Find a person” to open it.</p>}
            </div>
          </Card>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground"><Crosshair className="h-4 w-4" /> Click anyone on the chart</p>
            <p className="mt-1 text-xs">See their team size, open their profile, or show only their part of the organisation.</p>
          </Card>
        )}
        {canManage && health.data && <HealthCard health={health.data} onPerson={(id) => (canManage ? setMove({ employee: employees.find((e) => e.id === id)! }) : reveal(id))} onFocus={reveal} onDepartments={onOpenDepartments} compact />}
        <DepartmentBars employees={employees} />
      </div>

      <MoveDialog request={move} onClose={() => setMove(null)} />
    </div>
  );
}

function isBelow(id: string, rootId: string, managerOf: Map<string, string | null>): boolean {
  let cur: string | null | undefined = id;
  while (cur) {
    if (cur === rootId) return true;
    cur = managerOf.get(cur);
  }
  return false;
}
function findNode(roots: TNode[], id: string): TNode | null {
  for (const r of roots) {
    if (r.e.id === id) return r;
    const f = findNode(r.children, id);
    if (f) return f;
  }
  return null;
}
/** Everyone below, not counting people who haven't joined yet. */
function countCurrent(n: TNode): number {
  return n.children.reduce((s, c) => s + (c.e.joinsOn ? 0 : 1) + countCurrent(c), 0);
}
function depthOf(n: TNode): number {
  return n.children.length ? 1 + Math.max(...n.children.map(depthOf)) : 0;
}

// ─── Health + departments ───────────────────────────────────

const HEALTH_TONE: Record<OrgHealth['items'][number]['tone'], string> = { warning: 'bg-warning', danger: 'bg-destructive', info: 'bg-info', neutral: 'bg-muted-foreground' };

export function HealthCard({ health, onPerson, onFocus, onDepartments, compact }: { health: OrgHealth; onPerson: (id: string) => void; onFocus: (id: string) => void; onDepartments: () => void; compact?: boolean }) {
  return (
    <Card>
      <CardHeader icon={<AlertTriangle />} title="Org health" description={health.items.length ? `${health.items.length} thing${health.items.length === 1 ? '' : 's'} to look at` : 'Nothing to fix — nice and tidy'} />
      <ul className="px-5 pb-4">
        {health.items.slice(0, compact ? 4 : undefined).map((i) => (
          <li key={i.key} className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', HEALTH_TONE[i.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{i.title}</p>
              <p className="text-xs text-muted-foreground">{i.detail}</p>
              {!compact && i.people && i.people.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {i.people.slice(0, 12).map((p) => (
                    <button key={p.id} type="button" onClick={() => onFocus(p.id)} className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-subtle">{p.name}</button>
                  ))}
                  {i.count > i.people.length && <span className="px-1 py-0.5 text-xs text-muted-foreground">+{i.count - i.people.length} more</span>}
                </div>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
              onClick={() => (i.fix === 'departments' ? onDepartments() : i.people?.[0] ? (i.fix === 'reporting' ? onPerson(i.people[0].id) : onFocus(i.people[0].id)) : undefined)}
            >
              Fix
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DepartmentBars({ employees }: { employees: ChartEmployee[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, { id: string | null; name: string; n: number }>();
    for (const e of employees) {
      if (e.joinsOn) continue;
      const k = e.department?.id ?? 'none';
      const r = m.get(k) ?? { id: e.department?.id ?? null, name: e.department?.name ?? 'No department', n: 0 };
      r.n++;
      m.set(k, r);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [employees]);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card>
      <CardHeader icon={<Building2 />} title="Departments" description={`${rows.reduce((s, r) => s + r.n, 0)} people`} />
      <ul className="space-y-2.5 px-5 pb-5">
        {rows.slice(0, 8).map((r) => (
          <li key={r.id ?? 'none'}>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-sm" style={{ background: deptColor(r.id) }} />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.name}</span>
              <span className="tabular-nums text-muted-foreground"><Users className="mr-1 inline h-3 w-3" />{r.n}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: deptColor(r.id) }} /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Export as image ────────────────────────────────────────

function downloadPng(nodes: TNode[], width: number, height: number, colour: 'department' | 'level') {
  const pad = 32;
  const scale = Math.min(2, 8000 / Math.max(width + pad * 2, height + pad * 2));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((width + pad * 2) * scale);
  canvas.height = Math.ceil((height + pad * 2) * scale);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no canvas');
  g.scale(scale, scale);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, width + pad * 2, height + pad * 2);
  g.translate(pad, pad);
  const visible = new Set(nodes.map((n) => n.e.id));
  g.strokeStyle = '#CBD5E1';
  g.lineWidth = 1.5;
  for (const n of nodes) {
    for (const c of n.children) {
      if (!visible.has(c.e.id)) continue;
      const my = n.y + H + GAP_Y / 2;
      g.beginPath();
      g.moveTo(n.x + W / 2, n.y + H);
      g.lineTo(n.x + W / 2, my);
      g.lineTo(c.x + W / 2, my);
      g.lineTo(c.x + W / 2, c.y);
      g.stroke();
    }
  }
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  const fitText = (t: string, max: number) => {
    if (g.measureText(t).width <= max) return t;
    let s = t;
    while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
    return `${s}…`;
  };
  for (const n of nodes) {
    const e = n.e;
    const band = colour === 'level' ? e.designation?.orgLevel?.color ?? '#94A3B8' : deptColor(e.department?.id);
    round(n.x, n.y, W, H, 12);
    g.fillStyle = '#ffffff';
    g.fill();
    g.strokeStyle = '#E2E8F0';
    g.stroke();
    g.save();
    round(n.x, n.y, W, 4, 2);
    g.fillStyle = band;
    g.fill();
    g.restore();
    // initials disc (photos aren't drawn — they may live on another domain)
    g.fillStyle = band;
    round(n.x + W / 2 - 22, n.y + 12, 44, 44, 12);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 15px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(initials(`${e.firstName} ${e.lastName}`), n.x + W / 2, n.y + 34);
    g.fillStyle = '#0F172A';
    g.font = '600 12.5px system-ui, sans-serif';
    g.fillText(fitText(`${e.firstName} ${e.lastName}`, W - 16), n.x + W / 2, n.y + 72);
    g.fillStyle = '#64748B';
    g.font = '11px system-ui, sans-serif';
    g.fillText(fitText(e.designation?.name ?? e.department?.name ?? '', W - 16), n.x + W / 2, n.y + 90);
  }
  canvas.toBlob((blob) => {
    if (!blob) {
      toast.error('Could not create the image');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org-chart-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
