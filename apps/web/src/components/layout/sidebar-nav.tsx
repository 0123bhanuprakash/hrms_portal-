'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { useUiState } from '@/lib/preferences/ui-state';

// ============================================================
// Sidebar menu styles. Classic is the original menu; Rail, Floating
// and Collapsible are optional looks an employee (or the company) can
// pick. They only change how the same items are laid out.
// ============================================================

export interface SidebarItem {
  name: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  soon?: boolean;
  /** Live count shown on the item */
  count?: number;
}

export interface SidebarGroup {
  label: string;
  icon: React.ElementType;
  items: SidebarItem[];
}

const isActive = (item: SidebarItem, pathname: string) =>
  item.exact ? pathname === item.href : pathname.startsWith(item.href);
const groupCount = (g: SidebarGroup) => g.items.reduce((n, i) => n + (i.count ?? 0), 0);

function CountPill({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="bg-primary text-2xs text-primary-foreground rounded-full px-1.5 font-semibold tabular-nums leading-4"
      aria-label={`${count} waiting`}
    >
      {count}
    </span>
  );
}

/** One menu entry. `pill` = rounded pill without the left marker (Floating). */
function ItemLink({
  item,
  pathname,
  pill,
  onNavigate,
}: {
  item: SidebarItem;
  pathname: string;
  pill?: boolean;
  onNavigate?: () => void;
}) {
  const { name, href, icon: Icon, soon, count } = item;
  const active = isActive(item, pathname);
  const content = (
    <>
      {active && !pill && (
        <span
          className="bg-primary absolute -left-3 bottom-1.5 top-1.5 w-[3px] rounded-r-full"
          aria-hidden
        />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-sidebar-muted')} />
      <span className="flex-1 truncate">{name}</span>
      {soon && <Badge className="text-2xs px-1.5 py-0">Soon</Badge>}
      <CountPill count={count} />
    </>
  );
  const classes = cn(
    'relative flex h-8 items-center gap-2.5 text-[13px] font-medium transition-colors',
    pill ? 'rounded-full px-3' : 'rounded-md px-2',
    active
      ? 'bg-sidebar-active text-sidebar-active-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
  );
  return (
    <li>
      {soon ? (
        <span
          aria-disabled
          className={cn(classes, 'cursor-not-allowed opacity-55 hover:bg-transparent')}
          title="Coming soon"
        >
          {content}
        </span>
      ) : (
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={classes}
          onClick={onNavigate}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xs text-sidebar-muted mb-1 px-2 font-medium uppercase tracking-wider">
      {children}
    </p>
  );
}

/** The original menu: every group open with a small heading. */
export function ClassicNav({
  groups,
  pathname,
  className,
}: {
  groups: SidebarGroup[];
  pathname: string;
  className?: string;
}) {
  return (
    <nav className={cn('flex-1 overflow-y-auto px-3 py-2', className)} aria-label="Main">
      {groups.map((group) => (
        <div key={group.label} className="mb-4">
          <GroupLabel>{group.label}</GroupLabel>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <ItemLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Floating: the same groups with pill entries and a quick filter on top. */
export function FloatingNav({ groups, pathname }: { groups: SidebarGroup[]; pathname: string }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = term
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.name.toLowerCase().includes(term)) }))
        .filter((g) => g.items.length)
    : groups;
  return (
    <nav className="flex flex-1 flex-col overflow-hidden" aria-label="Main">
      <div className="px-3 pb-2">
        <label className="bg-sidebar-active/50 text-sidebar-muted focus-within:ring-ring flex h-8 items-center gap-2 rounded-full px-3 text-[13px] focus-within:ring-2">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            placeholder="Find in menu"
            aria-label="Find in menu"
            className="text-sidebar-active-foreground placeholder:text-sidebar-muted min-w-0 flex-1 bg-transparent outline-none"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear"
              className="hover:bg-sidebar-active rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {shown.map((group) => (
          <div key={group.label} className="mb-4">
            <GroupLabel>{group.label}</GroupLabel>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <ItemLink key={item.href} item={item} pathname={pathname} pill />
              ))}
            </ul>
          </div>
        ))}
        {!shown.length && (
          <p className="text-sidebar-muted px-2 py-6 text-center text-xs">Nothing matches “{q}”</p>
        )}
      </div>
    </nav>
  );
}

const isOpenMap = (v: unknown): v is Record<string, boolean> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Collapsible: groups fold away; the group you're in always opens. Open sections are saved on the account. */
export function CollapsibleNav({ groups, pathname }: { groups: SidebarGroup[]; pathname: string }) {
  const [saved, setSaved] = useUiState<Record<string, boolean>>('menu:open-groups', {}, isOpenMap);
  const current = groups.find((g) => g.items.some((i) => isActive(i, pathname)))?.label;
  // The section you're in is always open (without changing what's saved)
  const open = current && !saved[current] ? { ...saved, [current]: true } : saved;
  const toggle = (label: string) => setSaved({ ...open, [label]: !open[label] });

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
      {groups.map((group) => {
        const isOpen = Boolean(open[group.label]);
        const total = groupCount(group);
        const Icon = group.icon;
        const id = `menu-group-${group.label.replace(/\W+/g, '-').toLowerCase()}`;
        return (
          <div key={group.label} className="mb-1">
            <button
              onClick={() => toggle(group.label)}
              aria-expanded={isOpen}
              aria-controls={id}
              className={cn(
                'hover:bg-sidebar-active/60 flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-semibold transition-colors',
                group.label === current
                  ? 'text-sidebar-active-foreground'
                  : 'text-sidebar-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  group.label === current ? 'text-primary' : 'text-sidebar-muted',
                )}
              />
              <span className="flex-1 truncate text-left">{group.label}</span>
              {!isOpen && <CountPill count={total} />}
              <ChevronDown
                className={cn(
                  'text-sidebar-muted h-3.5 w-3.5 shrink-0 transition-transform',
                  isOpen ? 'rotate-0' : '-rotate-90',
                )}
              />
            </button>
            {isOpen && (
              <ul
                id={id}
                className="border-sidebar-border mb-2 ml-[17px] mt-0.5 space-y-0.5 border-l pl-3"
              >
                {group.items.map((item) => (
                  <ItemLink key={item.href} item={item} pathname={pathname} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

const SHORT: Record<string, string> = {
  Organization: 'Org',
  Engagement: 'Engage',
  Administration: 'Admin',
};

/** Rail: a narrow strip of group icons; a group's pages open in a panel beside it. */
export function RailNav({
  groups,
  pathname,
  className,
}: {
  groups: SidebarGroup[];
  pathname: string;
  className?: string;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const current = groups.find((g) => g.items.some((i) => isActive(i, pathname)))?.label;
  const flyout = groups.find((g) => g.label === openGroup);

  useEffect(() => setOpenGroup(null), [pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !panel.current?.contains(target)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenGroup(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  return (
    <div ref={ref} className={cn('flex-1 flex-col overflow-hidden', className)}>
      <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main">
        <ul className="space-y-1">
          {groups.map((group) => {
            const Icon = group.icon;
            const total = groupCount(group);
            const here = group.label === current;
            const single = group.items.length === 1 ? group.items[0] : undefined;
            const classes = cn(
              'relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-2xs font-medium transition-colors',
              here || openGroup === group.label
                ? 'bg-sidebar-active text-sidebar-active-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
            );
            const inner = (
              <>
                <Icon
                  className={cn('h-[18px] w-[18px]', here ? 'text-primary' : 'text-sidebar-muted')}
                />
                <span className="w-full truncate text-center">
                  {SHORT[group.label] ?? group.label}
                </span>
                {total > 0 && (
                  <span className="bg-primary text-primary-foreground absolute right-2 top-1 min-w-4 rounded-full px-1 text-[10px] font-semibold tabular-nums leading-4">
                    {total}
                  </span>
                )}
              </>
            );
            return (
              <li key={group.label}>
                {single && !single.soon ? (
                  <Link
                    href={single.href}
                    className={classes}
                    title={single.name}
                    aria-current={here ? 'page' : undefined}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    className={classes}
                    onClick={() => setOpenGroup((g) => (g === group.label ? null : group.label))}
                    aria-expanded={openGroup === group.label}
                    aria-haspopup="menu"
                    title={group.label}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Portalled: the sidebar's transform would otherwise trap a fixed panel inside it */}
      {flyout &&
        createPortal(
          <div
            ref={panel}
            className="border-sidebar-border bg-sidebar text-sidebar-foreground shadow-menu animate-in fade-in-0 fixed inset-y-0 left-[84px] z-40 flex w-60 flex-col border-r"
            role="menu"
            aria-label={flyout.label}
          >
            <div className="flex h-14 items-center justify-between px-4">
              <p className="text-sidebar-active-foreground text-sm font-semibold">{flyout.label}</p>
              <button
                onClick={() => setOpenGroup(null)}
                className="hover:bg-sidebar-active rounded-md p-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
              {flyout.items.map((item) => (
                <ItemLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setOpenGroup(null)}
                />
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
