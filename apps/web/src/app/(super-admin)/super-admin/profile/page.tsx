'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { History, Keyboard, Lock, Palette, UserCircle } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Kbd } from '@/components/ui/badge';
import { DisplaySettingsCard } from '@/components/preferences/display-preferences';
import { BackdropCard, MenuStyleCard, MomentsCard } from '@/components/preferences/personal-look';
import { NAV_SHORTCUTS } from '@/components/super-admin/command-menu';
import { AccountSection } from '@/components/super-admin/profile/account-section';
import { SecuritySection, securityChecks } from '@/components/super-admin/profile/security-section';
import { ActivitySection } from '@/components/super-admin/profile/activity-section';
import { useAccountOverview } from '@/lib/account';
import { cn } from '@/lib/cn';

type Section = 'account' | 'security' | 'activity' | 'appearance' | 'shortcuts';
const SECTIONS: Array<{ key: Section; label: string; icon: React.ReactNode }> = [
  { key: 'account', label: 'Account', icon: <UserCircle /> },
  { key: 'security', label: 'Security', icon: <Lock /> },
  { key: 'activity', label: 'Sign-in activity', icon: <History /> },
  { key: 'appearance', label: 'Appearance', icon: <Palette /> },
  { key: 'shortcuts', label: 'Shortcuts', icon: <Keyboard /> },
];
const isSection = (v: string | null): v is Section => SECTIONS.some((s) => s.key === v);

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Profile />
    </Suspense>
  );
}

function Profile() {
  const params = useSearchParams();
  const raw = params.get('section');
  const section: Section = isSection(raw) ? raw : 'account';
  const overview = useAccountOverview();
  const todo = overview.data ? securityChecks(overview.data).filter((c) => !c.ok).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile &amp; security</h1>
        <p className="text-sm text-muted-foreground">Your Super Admin account — keep it locked down, it can change every company.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Profile sections" className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:self-start">
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={`/super-admin/profile${s.key === 'account' ? '' : `?section=${s.key}`}`}
              scroll={false}
              aria-current={section === s.key ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors [&>svg]:h-4 [&>svg]:w-4',
                section === s.key ? 'bg-surface font-semibold text-foreground shadow-sm ring-1 ring-border [&>svg]:text-primary' : 'text-muted-foreground hover:bg-subtle hover:text-foreground',
              )}
            >
              {s.icon}
              {s.label}
              {s.key === 'security' && todo > 0 && <span className="ml-auto rounded-full bg-warning-soft px-1.5 text-[11px] font-bold text-warning">{todo}</span>}
            </Link>
          ))}
        </nav>

        <div className="min-w-0" key={section}>
          {section === 'account' ? (
            <AccountSection />
          ) : section === 'security' ? (
            <SecuritySection secure={params.get('secure') === '1'} />
          ) : section === 'activity' ? (
            <ActivitySection />
          ) : section === 'appearance' ? (
            <div className="space-y-5">
              <MenuStyleCard platform />
              <BackdropCard platform />
              <MomentsCard platform />
              <DisplaySettingsCard />
            </div>
          ) : (
            <ShortcutsCard />
          )}
        </div>
      </div>
    </div>
  );
}

function ShortcutsCard() {
  const rows: Array<[string, string[]]> = [
    ['Search everything', ['Ctrl', 'K']],
    ['Focus the page search', ['/']],
    ['Show all shortcuts', ['?']],
    ...NAV_SHORTCUTS.map((n) => [`Go to ${n.label}`, ['g', n.key]] as [string, string[]]),
  ];
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Keyboard className="h-4 w-4 text-muted-foreground" /> Keyboard shortcuts
        <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">press <Kbd>?</Kbd> anywhere</span>
      </h2>
      <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
            <span>{label}</span>
            <span className="flex items-center gap-1">
              {keys.map((k, i) => (
                <React.Fragment key={k + i}>
                  {i > 0 && keys[0] === 'g' && <span className="text-xs text-muted-foreground">then</span>}
                  <Kbd>{k}</Kbd>
                </React.Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
