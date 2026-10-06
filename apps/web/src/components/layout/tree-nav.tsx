'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useUiState } from '@/lib/preferences/ui-state';
import { CountPill, groupCount, isActive, isOpenMap, type SidebarGroup } from './sidebar-nav';

// ============================================================
// Glide + Peek menu styles. Both use the same tree menu: sections fold
// out with their pages on thin tree lines. Glide is a floating card that
// folds to icons; Peek is an icon strip that opens over the page on hover.
// ============================================================

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** True on screens wide enough for the side menu (lg); phones always get the full drawer. */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const read = () => setDesktop(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return desktop;
}

/** Glide folded to icons? Remembered on the account. */
export function useGlideFolded() {
  return useUiState<boolean>('menu:glide-folded', false, isBool);
}

/** Peek pinned open? Remembered on the account. */
export function usePeekPinned() {
  return useUiState<boolean>('menu:peek-pinned', false, isBool);
}

/**
 * Peek opens after the pointer rests a moment (so sweeping past doesn't flash
 * it open) and shuts a little after it leaves. Tabbing in opens it too.
 */
export function usePeekHover() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  // Stable functions, so effects that depend on them don't re-run every render
  const api = useMemo(() => {
    const later = (v: boolean, ms: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(v), ms);
    };
    return {
      show: () => later(true, 0),
      close: () => later(false, 0),
      handlers: {
        onMouseEnter: () => later(true, 150),
        onMouseLeave: (e: React.MouseEvent) => {
          // Moving into a popped-out card or tooltip doesn't count as leaving
          if ((e.relatedTarget as Element | null)?.closest?.('[data-menu-layer]')) return;
          later(false, 250);
        },
        onFocus: () => later(true, 0),
        onBlur: (e: React.FocusEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) later(false, 150);
        },
      },
    };
  }, []);
  return { open, ...api };
}

/** A section's pages, joined to it by thin tree lines. */
function TreeItems({ group, pathname, onNavigate, onCard }: { group: SidebarGroup; pathname: string; onNavigate?: () => void; /** On a popped-out card (page colours, not the menu's) */ onCard?: boolean }) {
  return (
    <ul className="m-nav-tree">
      {group.items.map((item) => {
        const active = isActive(item, pathname);
        const body = (
          <>
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {item.soon && <Badge className="text-2xs px-1.5 py-0">Soon</Badge>}
            <CountPill count={item.count} />
          </>
        );
        const classes = cn(
          'flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
          onCard
            ? active
              ? 'bg-primary-soft text-primary-soft-foreground'
              : 'text-foreground/80 hover:bg-muted hover:text-foreground'
            : active
              ? 'bg-sidebar-active text-sidebar-active-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
        );
        return (
          <li key={item.href} data-on={active || undefined}>
            {item.soon ? (
              <span aria-disabled className={cn(classes, 'cursor-not-allowed opacity-55')}>
                {body}
              </span>
            ) : (
              <Link href={item.href} aria-current={active ? 'page' : undefined} className={classes} onClick={onNavigate}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Glide / Peek menu. `compact` = icons only: hovering an icon names it,
 * clicking pops its pages out in a small card beside the menu.
 */
export function TreeNav({
  groups,
  pathname,
  compact,
  onSearch,
}: {
  groups: SidebarGroup[];
  pathname: string;
  compact?: boolean;
  /** Icons only: the search button asks the menu to open */
  onSearch?: () => void;
}) {
  const [saved, setSaved] = useUiState<Record<string, boolean>>('menu:tree-open', {}, isOpenMap);
  const [q, setQ] = useState('');
  const [fly, setFly] = useState<{ label: string; top: number; left: number } | null>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const current = groups.find((g) => g.items.some((i) => isActive(i, pathname)))?.label;
  // The section you're in opens by itself (until you close it)
  const open = current && saved[current] === undefined ? { ...saved, [current]: true } : saved;
  const term = q.trim().toLowerCase();
  const shown = term
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.name.toLowerCase().includes(term)) })).filter((g) => g.items.length)
    : groups;

  useEffect(() => setFly(null), [pathname, compact]);
  useEffect(() => {
    if (!fly) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!flyRef.current?.contains(t) && !t.closest?.('[data-fly-trigger]')) setFly(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setFly(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [fly]);

  if (compact) {
    const flyGroup = fly ? groups.find((g) => g.label === fly.label) : undefined;
    return (
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-2 py-1" aria-label="Main">
        <Tooltip content="Search menu" side="right">
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search menu"
            className="text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground mb-1 flex h-10 w-11 shrink-0 items-center justify-center rounded-xl"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
        {groups.map((group) => {
          const Icon = group.icon;
          const here = group.label === current;
          const total = groupCount(group);
          const single = group.items.length === 1 ? group.items[0] : undefined;
          const classes = cn(
            'relative flex h-10 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
            here || fly?.label === group.label ? 'bg-sidebar-active text-primary' : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
          );
          const inner = (
            <>
              <Icon className="h-[18px] w-[18px]" />
              {total > 0 && <span className="bg-destructive ring-sidebar absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2" aria-label={`${total} waiting`} />}
            </>
          );
          return (
            <Tooltip key={group.label} content={total ? `${group.label} · ${total} waiting` : group.label} side="right" disabled={fly?.label === group.label}>
              {single && !single.soon ? (
                <Link href={single.href} className={classes} aria-label={group.label} aria-current={here ? 'page' : undefined}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  data-fly-trigger
                  aria-label={group.label}
                  aria-expanded={fly?.label === group.label}
                  className={classes}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const edge = e.currentTarget.closest('aside')?.getBoundingClientRect().right ?? r.right;
                    const tall = 48 + group.items.length * 34;
                    setFly(fly?.label === group.label ? null : { label: group.label, top: Math.max(8, Math.min(r.top - 6, window.innerHeight - tall - 8)), left: edge + 10 });
                  }}
                >
                  {inner}
                </button>
              )}
            </Tooltip>
          );
        })}
        {flyGroup &&
          fly &&
          createPortal(
            <div
              ref={flyRef}
              data-menu-layer
              role="menu"
              aria-label={flyGroup.label}
              className="bg-raised text-foreground border-border shadow-dialog animate-in fade-in-0 slide-in-from-left-1 fixed z-50 w-60 rounded-2xl border p-2 pl-1.5 duration-150"
              style={{ top: fly.top, left: fly.left, ['--sidebar-border' as string]: 'var(--border)' }}
            >
              <p className="text-foreground flex items-center gap-2 px-2.5 pb-1.5 pt-1 text-xs font-bold">
                <flyGroup.icon className="text-primary h-3.5 w-3.5" />
                {flyGroup.label}
              </p>
              <TreeItems group={flyGroup} pathname={pathname} onCard onNavigate={() => setFly(null)} />
            </div>,
            document.body,
          )}
      </nav>
    );
  }

  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Main">
      <div className="px-3 pb-2">
        <label className="border-sidebar-border text-sidebar-muted focus-within:ring-ring flex h-9 items-center gap-2 rounded-xl border px-2.5 text-[13px] focus-within:ring-2">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            placeholder="Search menu"
            aria-label="Search menu"
            data-menu-search
            className="text-sidebar-active-foreground placeholder:text-sidebar-muted min-w-0 flex-1 bg-transparent outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear" className="hover:bg-sidebar-active rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>
      <div className="m-nav-labels flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-3 pb-2">
        {shown.map((group) => {
          const Icon = group.icon;
          const isOpen = Boolean(term) || Boolean(open[group.label]);
          const here = group.label === current;
          const total = groupCount(group);
          const single = group.items.length === 1 ? group.items[0] : undefined;
          const row = cn(
            'flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-[13.5px] font-semibold transition-colors',
            here ? 'bg-sidebar-active/70 text-sidebar-active-foreground' : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
          );
          const icon = <Icon className={cn('h-[18px] w-[18px] shrink-0', here ? 'text-primary' : 'text-sidebar-muted')} />;
          if (single && !single.soon) {
            return (
              <Link key={group.label} href={single.href} className={row} aria-current={here ? 'page' : undefined}>
                {icon}
                <span className="flex-1 truncate">{group.label}</span>
                <CountPill count={total} />
              </Link>
            );
          }
          return (
            <div key={group.label}>
              <button type="button" onClick={() => setSaved({ ...open, [group.label]: !isOpen })} aria-expanded={isOpen} className={row}>
                {icon}
                <span className="flex-1 truncate text-left">{group.label}</span>
                {!isOpen && <CountPill count={total} />}
                <ChevronDown className={cn('text-sidebar-muted h-3.5 w-3.5 shrink-0 transition-transform duration-200', !isOpen && '-rotate-90')} />
              </button>
              {isOpen && <TreeItems group={group} pathname={pathname} />}
            </div>
          );
        })}
        {!shown.length && <p className="text-sidebar-muted px-2 py-6 text-center text-xs">Nothing matches “{q}”</p>}
      </div>
    </nav>
  );
}
