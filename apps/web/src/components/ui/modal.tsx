'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Prevent closing (Escape / outside click / X) while an action runs */
  busy?: boolean;
  className?: string;
  /** Optional icon shown beside the title */
  icon?: React.ReactNode;
}

function Header({ title, description, busy, icon }: Pick<OverlayProps, 'title' | 'description' | 'busy' | 'icon'>) {
  return (
    <div className="flex items-start gap-3 px-6 pb-4 pt-5">
      {icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground [&_svg]:size-[18px]">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-foreground">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">Dialog</DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close
        disabled={busy}
        aria-label="Close"
        className="-mr-2 -mt-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

const overlayClass =
  'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0';

function guard(busy?: boolean) {
  return (e: Event) => busy && e.preventDefault();
}

/** Centered dialog (Radix): focus trap, Escape, scroll lock, a11y labels. */
export function Modal({ open, onClose, title, description, footer, children, busy, className, icon }: OverlayProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          onEscapeKeyDown={guard(busy)}
          onPointerDownOutside={guard(busy)}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-raised text-raised-foreground shadow-dialog focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-top-1',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97]',
            className,
          )}
        >
          <Header title={title} description={description} busy={busy} icon={icon} />
          {children && <div className="px-6 pb-5">{children}</div>}
          {footer && (
            <div className="flex justify-end gap-2 rounded-b-xl border-t border-border bg-muted/40 px-6 py-3.5">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Right-hand slide-over panel (Radix Dialog). */
export function Drawer({ open, onClose, title, description, footer, children, busy, className, icon }: OverlayProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          onEscapeKeyDown={guard(busy)}
          onPointerDownOutside={guard(busy)}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-raised text-raised-foreground shadow-dialog focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:duration-300 data-[state=closed]:duration-200',
            className,
          )}
        >
          <div className="border-b border-border">
            <Header title={title} description={description} busy={busy} icon={icon} />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-3.5">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
