'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Building2,
  CornerDownLeft,
  FileText,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  Plus,
  Search,
  ServerCog,
  Sun,
  UserCircle,
} from 'lucide-react';
import { useCompanies } from '@/lib/admin/queries';
import { CompanyAvatar } from './company-avatar';
import { Kbd } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';

export const NAV_SHORTCUTS: Array<{ key: string; label: string; href: string; icon: React.ReactNode }> = [
  { key: 'd', label: 'Dashboard', href: '/super-admin', icon: <LayoutDashboard /> },
  { key: 'c', label: 'Companies', href: '/super-admin/companies', icon: <Building2 /> },
  { key: 'a', label: 'Audit logs', href: '/super-admin/audit-logs', icon: <FileText /> },
  { key: 't', label: 'Themes', href: '/super-admin/themes', icon: <Palette /> },
  { key: 's', label: 'System', href: '/super-admin/system', icon: <ServerCog /> },
  { key: 'p', label: 'Profile & security', href: '/super-admin/profile', icon: <UserCircle /> },
];

const itemClass =
  'flex cursor-default select-none items-center gap-3 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[selected=true]:bg-subtle [&_svg]:size-4 [&_svg]:text-muted-foreground';

/** Ctrl/⌘ + K palette: navigate, find companies, run actions. */
export function CommandMenu({
  open,
  onOpenChange,
  onLogout,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
  onShowShortcuts: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const companies = useCompanies({ limit: 6, search: debounced || undefined, sortBy: 'name', sortOrder: 'asc' });

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-raised shadow-dialog data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <Command label="Command menu" shouldFilter={true} loop>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search pages, companies and actions…"
                className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">No results for “{search}”.</Command.Empty>

              {(companies.data?.data.length ?? 0) > 0 && (
                <Command.Group heading="Companies" className="cmdk-group">
                  {companies.data!.data.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`company ${c.name} ${c.slug} ${c.email}`}
                      onSelect={() => run(() => router.push(`/super-admin/companies/${c.id}`))}
                      className={itemClass}
                    >
                      <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} size="sm" className="h-6 w-6 rounded-md text-[9px]" />
                      <span className="min-w-0 flex-1 truncate">
                        {c.name} <span className="text-muted-foreground">· {c.slug}</span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Go to" className="cmdk-group">
                {NAV_SHORTCUTS.map((nav) => (
                  <Command.Item key={nav.href} value={`go ${nav.label}`} onSelect={() => run(() => router.push(nav.href))} className={itemClass}>
                    {nav.icon}
                    <span className="flex-1">{nav.label}</span>
                    <span className="flex gap-1"><Kbd>G</Kbd><Kbd>{nav.key.toUpperCase()}</Kbd></span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group heading="Actions" className="cmdk-group">
                <Command.Item value="onboard new company create" onSelect={() => run(() => router.push('/super-admin/companies/new'))} className={itemClass}>
                  <Plus /> <span className="flex-1">Onboard a company</span>
                </Command.Item>
                <Command.Item
                  value="toggle theme dark light appearance"
                  onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}
                  className={itemClass}
                >
                  {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
                  <span className="flex-1">Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} mode</span>
                </Command.Item>
                <Command.Item value="keyboard shortcuts help" onSelect={() => run(onShowShortcuts)} className={itemClass}>
                  <Keyboard /> <span className="flex-1">Keyboard shortcuts</span> <Kbd>?</Kbd>
                </Command.Item>
                <Command.Item value="sign out logout" onSelect={() => run(onLogout)} className={itemClass}>
                  <LogOut /> <span className="flex-1">Sign out</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2 text-2xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd> select</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Lists every keyboard shortcut. */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const rows: Array<[string[], string]> = [
    [['Ctrl', 'K'], 'Open command menu'],
    [['/'], 'Focus search on the current page'],
    ...NAV_SHORTCUTS.map((n): [string[], string] => [['G', n.key.toUpperCase()], `Go to ${n.label.toLowerCase()}`]),
    [['?'], 'Show keyboard shortcuts'],
  ];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-raised p-5 shadow-dialog data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] focus:outline-none"
        >
          <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
            <Keyboard className="h-4 w-4 text-muted-foreground" /> Keyboard shortcuts
          </DialogPrimitive.Title>
          <ul className="mt-4 divide-y divide-border">
            {rows.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
