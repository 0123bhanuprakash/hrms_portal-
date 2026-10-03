'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, GitBranch, GripVertical, Network, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { useOrgChart, type ChartEmployee } from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { MoveDialog, type MoveRequest } from './move-dialog';

interface Node extends ChartEmployee {
  children: Node[];
  size: number;
}

/** Builds the tree; anyone whose manager isn't in the list becomes a root. */
function buildTree(list: ChartEmployee[]): Node[] {
  const byId = new Map<string, Node>(list.map((e) => [e.id, { ...e, children: [], size: 1 }]));
  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.reportingManagerId ? byId.get(node.reportingManagerId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const rank = (n: Node) => n.designation?.orgLevel?.rank ?? -Infinity;
  const sort = (nodes: Node[]) => {
    nodes.sort((a, b) => rank(b) - rank(a) || a.firstName.localeCompare(b.firstName));
    nodes.forEach((n) => {
      sort(n.children);
      n.size = 1 + n.children.reduce((s, c) => s + c.size, 0);
    });
  };
  sort(roots);
  return roots;
}

/** Everyone below `id` (to block dropping someone onto their own team). */
function descendantsOf(id: string, list: ChartEmployee[]): Set<string> {
  const kids = new Map<string, string[]>();
  for (const e of list) if (e.reportingManagerId) kids.set(e.reportingManagerId, [...(kids.get(e.reportingManagerId) ?? []), e.id]);
  const out = new Set<string>();
  const walk = (x: string) => (kids.get(x) ?? []).forEach((c) => !out.has(c) && (out.add(c), walk(c)));
  walk(id);
  return out;
}

export function OrgChart({ canManage }: { canManage: boolean }) {
  const chart = useOrgChart();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState<ChartEmployee | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [move, setMove] = useState<MoveRequest | null>(null);

  const employees = useMemo(() => chart.data?.employees ?? [], [chart.data]);
  const tree = useMemo(() => buildTree(employees), [employees]);
  const blocked = useMemo(() => (dragging ? new Set([dragging.id, ...descendantsOf(dragging.id, employees)]) : new Set<string>()), [dragging, employees]);
  const q = query.trim().toLowerCase();
  const matches = (e: ChartEmployee) =>
    !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.designation?.name.toLowerCase().includes(q) || e.department?.name.toLowerCase().includes(q);

  if (chart.isError) return <ErrorState message={getApiErrorMessage(chart.error, 'Could not load the org chart')} onRetry={() => chart.refetch()} />;
  if (chart.isLoading) return <Skeleton className="h-96" />;
  if (!employees.length) {
    return <EmptyState icon={<Network />} title="No employees yet" description="Add employees and set their reporting managers — the chart builds itself." />;
  }

  const toggle = (id: string) => setCollapsed((c) => {
    const n = new Set(c);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allIds = employees.filter((e) => e.directReports > 0).map((e) => e.id);

  const drop = (managerId: string | null) => {
    if (dragging && !(managerId && blocked.has(managerId))) setMove({ employee: dragging, managerId });
    setDragging(null);
    setOverId(null);
  };

  const renderNode = (node: Node, depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(node.id) && !q;
    const level = node.designation?.orgLevel;
    const isBlocked = Boolean(dragging) && blocked.has(node.id);
    const isTarget = overId === node.id && !isBlocked;
    const hidden = q && !matches(node) && !hasMatchBelow(node);
    if (hidden) return null;
    return (
      <li key={node.id} className="relative">
        <div
          draggable={canManage}
          onDragStart={(ev) => {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', node.id);
            setDragging(node);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOverId(null);
          }}
          onDragOver={(ev) => {
            if (!dragging || isBlocked) return;
            ev.preventDefault();
            setOverId(node.id);
          }}
          onDragLeave={() => setOverId((o) => (o === node.id ? null : o))}
          onDrop={(ev) => {
            ev.preventDefault();
            drop(node.id);
          }}
          className={cn(
            'group relative flex items-center gap-3 rounded-lg border bg-surface px-3 py-2 shadow-card transition-all',
            isTarget ? 'border-primary ring-2 ring-primary/30' : 'border-border',
            isBlocked && 'opacity-40',
            q && matches(node) && 'border-primary/60 bg-primary-soft/30',
            canManage && 'cursor-grab active:cursor-grabbing',
          )}
          style={level?.color ? { boxShadow: `inset 3px 0 0 ${level.color}` } : undefined}
        >
          {node.children.length > 0 ? (
            <button type="button" onClick={() => toggle(node.id)} aria-label={isCollapsed ? `Expand ${node.firstName}'s team` : `Collapse ${node.firstName}'s team`} className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
            {initials(`${node.firstName} ${node.lastName}`)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {node.firstName} {node.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {node.designation?.name ?? 'No title'}
              {node.department ? ` · ${node.department.name}` : ''}
            </p>
          </div>
          {level && (
            <Badge tone="outline" className="hidden sm:inline-flex">
              <span className="h-2 w-2 rounded-full" style={{ background: level.color ?? 'currentColor' }} />
              {level.name}
            </Badge>
          )}
          {node.size > 1 && (
            <Badge tone="neutral" title={`${node.children.length} direct, ${node.size - 1} in total`}>
              <Users className="h-3 w-3" /> {node.size - 1}
            </Badge>
          )}
          {canManage && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={`Change manager for ${node.firstName}`} onClick={() => setMove({ employee: node })} className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100">
                <GitBranch />
              </Button>
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
            </>
          )}
        </div>
        {node.children.length > 0 && !isCollapsed && (
          <ul className="ml-[22px] mt-2 space-y-2 border-l border-dashed border-border pl-5 [&>li]:before:absolute [&>li]:before:-left-5 [&>li]:before:top-6 [&>li]:before:h-px [&>li]:before:w-5 [&>li]:before:border-t [&>li]:before:border-dashed [&>li]:before:border-border">
            {node.children.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  function hasMatchBelow(n: Node): boolean {
    return n.children.some((c) => matches(c) || hasMatchBelow(c));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person, title or department" className="pl-8" aria-label="Search the org chart" />
        </div>
        <div className="flex gap-1 sm:ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
            <ChevronsUpDown /> Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(allIds))}>
            <ChevronsDownUp /> Collapse all
          </Button>
        </div>
      </div>

      {canManage && (
        <p className="text-xs text-muted-foreground">
          Drag someone onto their new manager (their whole team moves with them), or use <GitBranch className="inline h-3 w-3" /> on a card. You’ll see who gains or loses access before anything changes.
        </p>
      )}

      {canManage && dragging && (
        <div
          onDragOver={(ev) => {
            ev.preventDefault();
            setOverId('__top');
          }}
          onDragLeave={() => setOverId(null)}
          onDrop={(ev) => {
            ev.preventDefault();
            drop(null);
          }}
          className={cn(
            'rounded-lg border-2 border-dashed px-4 py-3 text-center text-sm text-muted-foreground transition-colors animate-in fade-in-0',
            overId === '__top' ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-border',
          )}
        >
          Drop here to place {dragging.firstName} at the top of the organisation
        </div>
      )}

      <Card className="overflow-x-auto p-4">
        <ul className="min-w-[420px] space-y-2">{tree.map((n) => renderNode(n, 0))}</ul>
      </Card>

      <MoveDialog request={move} employees={employees} onClose={() => setMove(null)} />
    </div>
  );
}
