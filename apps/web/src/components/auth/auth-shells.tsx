'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Activity, Building2, Lock, ShieldCheck } from 'lucide-react';
import { ThemeArt } from '@/components/theme/theme-art';
import { ThemeStyle } from '@/components/theme/theme-style';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { resolveTheme } from '@/lib/theme/presets';
import { workspaceName, workspaceTokens, type Workspace } from '@/lib/auth/portal';
import { initials } from '@/lib/format';

// ============================================================
// Sign-in layouts
//   PlatformAuthShell — Super Admin "control room": always dark,
//                       neutral, no company branding.
//   CompanyAuthShell  — split screen in the company's own theme,
//                       logo and generative cover art.
// ============================================================

export function PlatformAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark">
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
        {/* Grid + glow backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-12rem] h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        />

        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">HRMS Platform</p>
              <p className="text-[11px] text-muted-foreground">Administration console</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px] shadow-success" />
            Restricted area
          </span>
        </header>

        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[400px]">
            <div className="rounded-xl border border-border bg-surface/80 p-7 shadow-dialog backdrop-blur-xl sm:p-8">
              {children}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Super Admin access only
              </p>
              <p className="flex items-center justify-end gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Every sign-in is audited
              </p>
            </div>
          </div>
        </main>

        <footer className="relative z-10 px-6 pb-6 text-center text-[11px] text-muted-foreground/70 sm:px-10">
          Company users sign in on their own workspace page.
        </footer>
      </div>
    </div>
  );
}

/** Follows the visitor's light/dark choice for the cover art. */
function useArtMode(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  useEffect(() => setMode(resolvedTheme === 'dark' ? 'dark' : 'light'), [resolvedTheme]);
  return mode;
}

export function CompanyAuthShell({
  workspace,
  children,
}: {
  /** Undefined while unknown → neutral HRMS branding */
  workspace?: Workspace;
  children: React.ReactNode;
}) {
  const mode = useArtMode();
  const tokens = workspaceTokens(workspace);
  const artTokens = tokens ?? resolveTheme(undefined);
  const name = workspace ? workspaceName(workspace) : 'HRMS Portal';
  const logo = workspace?.branding?.logoUrl ?? null;

  const mark = (size: string) =>
    logo ? (
      <img src={logo} alt={`${name} logo`} className={`${size} shrink-0 rounded-xl bg-white object-contain p-1 shadow-card`} />
    ) : (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-card`}>
        {workspace ? initials(name) : <Building2 className="h-5 w-5" />}
      </div>
    );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ThemeStyle tokens={tokens} />

      {/* Cover */}
      <ThemeArt
        tokens={artTokens}
        seed={workspace?.slug ?? 'hrms'}
        mode={mode}
        className="hidden w-[46%] max-w-[720px] flex-col justify-between p-10 lg:flex"
      >
        <div className="flex items-center gap-3">
          {mark('h-11 w-11')}
          <p className="text-lg font-semibold tracking-tight text-foreground">{name}</p>
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
            {workspace ? `Welcome to ${name}` : 'Your people, all in one place'}
          </h2>
          <p className="text-sm leading-relaxed text-foreground/70">
            Attendance, leave, payroll and your team — sign in to pick up where you left off.
          </p>
        </div>
        <p className="text-xs text-foreground/60">Powered by HRMS Portal</p>
      </ThemeArt>

      {/* Form */}
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5 lg:invisible">
            {mark('h-9 w-9')}
            <p className="text-sm font-semibold tracking-tight">{name}</p>
          </div>
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
