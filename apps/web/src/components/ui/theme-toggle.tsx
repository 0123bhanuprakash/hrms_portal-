'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Laptop, Moon, Sun } from 'lucide-react';
import { api } from '@/lib/api';
import { DropdownMenu } from './dropdown-menu';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/cn';

type Mode = 'light' | 'dark' | 'system';

/** Compact appearance switcher (icon button + menu). Persists the choice to the user's preferences. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const change = async (mode: Mode) => {
    setTheme(mode);
    try {
      await api.patch('/users/me/preferences', { theme: mode });
    } catch {
      // Already persisted locally by next-themes
    }
  };

  const Icon = !mounted ? Sun : resolvedTheme === 'dark' ? Moon : Sun;
  const option = (mode: Mode, label: string, icon: React.ReactNode) => ({
    label,
    icon: theme === mode ? <Check /> : icon,
    onSelect: () => change(mode),
  });

  return (
    <DropdownMenu
      label="Appearance"
      className="min-w-[10rem]"
      trigger={() => (
        <span>
          <Tooltip content="Appearance">
            <button
              type="button"
              aria-label="Change appearance"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className,
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          </Tooltip>
        </span>
      )}
      items={[option('light', 'Light', <Sun />), option('dark', 'Dark', <Moon />), option('system', 'System', <Laptop />)]}
    />
  );
}
