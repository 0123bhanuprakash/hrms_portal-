'use client';

import React, { useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Explanation shown under the label (e.g. why it is disabled) */
  hint?: string;
  shortcut?: string;
}

interface DropdownMenuProps {
  /** Render the trigger element. `toggle` is kept for API compatibility (Radix handles opening). */
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactElement;
  items: Array<MenuItem | 'separator'>;
  align?: 'left' | 'right';
  label?: string;
  className?: string;
}

/** Accessible dropdown (Radix): keyboard navigation, typeahead, focus return. */
export function DropdownMenu({ trigger, items, align = 'right', label, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger asChild>{trigger({ open, toggle: () => undefined })}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align === 'right' ? 'end' : 'start'}
          sideOffset={6}
          className={cn(
            'z-50 min-w-[14rem] overflow-hidden rounded-lg border border-border bg-raised p-1 text-raised-foreground shadow-menu',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            className,
          )}
        >
          {label && <Menu.Label className="px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Menu.Label>}
          {items.map((item, i) =>
            item === 'separator' ? (
              <Menu.Separator key={`sep-${i}`} className="-mx-1 my-1 h-px bg-border" />
            ) : (
              <Menu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'relative flex cursor-default select-none items-start gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
                  item.danger
                    ? 'text-destructive data-[highlighted]:bg-destructive-soft'
                    : 'text-foreground data-[highlighted]:bg-subtle',
                )}
              >
                {item.icon && (
                  <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', item.danger ? 'text-destructive' : 'text-muted-foreground')}>
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block">{item.label}</span>
                  {item.hint && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
                </span>
                {item.shortcut && <span className="ml-4 text-xs tracking-widest text-muted-foreground">{item.shortcut}</span>}
              </Menu.Item>
            ),
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
