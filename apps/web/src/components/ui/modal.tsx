'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type OverlayTone = 'primary' | 'edit' | 'success' | 'danger' | 'neutral';
export type ModalSize = 'sm' | 'md' | 'lg';

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
  /** Icon colour: what kind of popup this is. Worked out from the icon when not given. */
  tone?: OverlayTone;
  /** S 420px · M 560px · L 760px (Modal only) */
  size?: ModalSize;
  /** Ask "Discard your changes?" when closing after typing (default on) */
  guard?: boolean;
}

const TONE_CLASS: Record<OverlayTone, string> = {
  primary: 'border-primary/20 bg-primary-soft text-primary',
  edit: 'border-info/20 bg-info-soft text-info',
  success: 'border-success/20 bg-success-soft text-success',
  danger: 'border-destructive/20 bg-destructive/10 text-destructive',
  neutral: 'border-border bg-muted text-muted-foreground',
};

const DANGER = /^(Trash|Trash2|X|XCircle|CircleX|Ban|UserX|UserMinus|AlertTriangle|TriangleAlert|OctagonX|LogOut|Power|PowerOff|Undo2|RotateCcw|Archive|Eraser)$/;
const EDIT = /^(Pencil|PencilLine|Edit|Edit2|Edit3|SquarePen|PenLine|ClipboardEdit|ClipboardPen|Settings|Settings2|SlidersHorizontal|Tags|Palette|ArrowRightLeft|Move|MoveRight|GitBranch)$/;
const SUCCESS = /^(Check|CheckCircle|CheckCircle2|CircleCheck|CircleCheckBig|BadgeCheck|ClipboardCheck|ThumbsUp|Send|PartyPopper|ShieldCheck|UserCheck|HandCoins|Wallet)$/;

/** Colour the header icon by what the popup does (add / edit / approve / danger). */
function toneOf(icon: React.ReactNode): OverlayTone {
  if (!React.isValidElement(icon)) return 'primary';
  const type = icon.type as { displayName?: string; name?: string } | string;
  const name = typeof type === 'string' ? '' : (type.displayName ?? type.name ?? '');
  const cls = String((icon.props as { className?: string }).className ?? '');
  if (/text-(destructive|danger)/.test(cls) || DANGER.test(name)) return 'danger';
  if (SUCCESS.test(name)) return 'success';
  if (EDIT.test(name)) return 'edit';
  return 'primary';
}

function Header({ title, description, busy, icon, tone }: Pick<OverlayProps, 'title' | 'description' | 'busy' | 'icon' | 'tone'>) {
  return (
    <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
      {icon && (
        <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-[18px]', TONE_CLASS[tone ?? toneOf(icon)])}>
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

const SIZE: Record<ModalSize, string> = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[760px]' };

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Shared behaviour of every popup:
 *  • "Discard your changes?" when closing by Escape / outside click / X after typing
 *  • Ctrl/⌘ + Enter presses the main (last) footer button
 *  • a short ✓ when it closes right after saving
 */
function useOverlay({ open, onClose, busy, guard = true, tone }: Pick<OverlayProps, 'open' | 'onClose' | 'busy' | 'guard' | 'tone'>) {
  const [touched, setTouched] = useState(false);
  const [asking, setAsking] = useState(false);
  const [shown, setShown] = useState(open);
  const [done, setDone] = useState(false);
  const busyEndedAt = useRef(0);
  const wasBusy = useRef(Boolean(busy));
  const footerRef = useRef<HTMLDivElement>(null);

  // Order matters: note when saving finished before deciding how to close
  useEffect(() => {
    if (wasBusy.current && !busy) busyEndedAt.current = Date.now();
    wasBusy.current = Boolean(busy);
  }, [busy]);

  useEffect(() => {
    if (open) {
      setShown(true);
      setDone(false);
      setTouched(false);
      setAsking(false);
      return;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (Date.now() - busyEndedAt.current < 900 && !reduce && tone !== 'danger') {
      setDone(true);
      const t = setTimeout(() => {
        setShown(false);
        setDone(false);
      }, 520);
      return () => clearTimeout(t);
    }
    setShown(false);
    return undefined;
  }, [open, tone]);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (guard && touched) setAsking(true);
    else onClose();
  }, [busy, guard, touched, onClose]);

  const contentProps = {
    onInput: () => setTouched(true),
    onChange: () => setTouched(true),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || busy) return;
      const buttons = footerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      const main = buttons?.[buttons.length - 1];
      if (!main) return;
      e.preventDefault();
      main.click();
    },
  };

  const keepEditing = () => setAsking(false);
  const discard = () => {
    setAsking(false);
    setTouched(false);
    onClose();
  };
  return { shown: open || shown, done, asking, requestClose, contentProps, footerRef, keepEditing, discard };
}

function guardEvent(busy?: boolean) {
  return (e: Event) => busy && e.preventDefault();
}

/** Escape closes an open picker list first, not the whole popup. */
function guardEscape(busy?: boolean) {
  return (e: KeyboardEvent) => {
    if (busy || document.querySelector('[data-picker-open]')) e.preventDefault();
  };
}

function DiscardBar({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div role="alertdialog" aria-label="Discard your changes?" className="absolute inset-0 z-10 flex items-end justify-center bg-raised/70 p-4 backdrop-blur-[1px] animate-in fade-in-0 sm:items-center">
      <div className="w-full max-w-xs rounded-xl border border-border bg-raised p-4 shadow-dialog animate-in zoom-in-95">
        <p className="text-sm font-semibold">Discard your changes?</p>
        <p className="mt-1 text-xs text-muted-foreground">What you typed in this form will be lost.</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onDiscard} className="h-8 rounded-md px-3 text-sm font-medium text-destructive hover:bg-destructive/10">
            Discard
          </button>
          <button type="button" autoFocus onClick={onKeep} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneTick() {
  return (
    <div aria-hidden className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-raised/85 animate-in fade-in-0">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-lg animate-in zoom-in-50 duration-300">
        <Check className="h-7 w-7" strokeWidth={3} />
      </span>
    </div>
  );
}

function ShortcutHint() {
  return (
    <span className="mr-auto hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex">
      <kbd className="rounded border border-b-2 border-border bg-surface px-1 font-sans">{isMac() ? '⌘' : 'Ctrl'}</kbd>+
      <kbd className="rounded border border-b-2 border-border bg-surface px-1 font-sans">Enter</kbd>
    </span>
  );
}

/**
 * Centered dialog (Radix): focus trap, Escape, scroll lock, a11y labels.
 * Always fits the screen (only the middle scrolls); a bottom sheet on phones.
 */
export function Modal({ open, onClose, title, description, footer, children, busy, className, icon, tone, size = 'md', guard }: OverlayProps) {
  const resolvedTone = tone ?? (icon ? toneOf(icon) : 'primary');
  const o = useOverlay({ open, onClose, busy, guard, tone: resolvedTone });
  return (
    <DialogPrimitive.Root open={o.shown} onOpenChange={(v) => !v && o.requestClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          {...o.contentProps}
          onEscapeKeyDown={guardEscape(busy)}
          onPointerDownOutside={guardEvent(busy)}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border border-border bg-raised text-raised-foreground shadow-dialog focus:outline-none',
            // Phones: bottom sheet
            'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:duration-300',
            // Tablet and up: centred card that never leaves the screen
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-0',
            'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-[0.97] sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-[0.97] sm:data-[state=closed]:fade-out-0',
            SIZE[size],
            className,
          )}
        >
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <Header title={title} description={description} busy={busy} icon={icon} tone={resolvedTone} />
          {children && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-5">{children}</div>}
          {footer && (
            <div ref={o.footerRef} className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3.5 sm:rounded-b-xl">
              {resolvedTone !== 'danger' && <ShortcutHint />}
              {footer}
            </div>
          )}
          {o.asking && <DiscardBar onKeep={o.keepEditing} onDiscard={o.discard} />}
          {o.done && <DoneTick />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Right-hand slide-over panel (Radix Dialog). A bottom sheet on phones. */
export function Drawer({ open, onClose, title, description, footer, children, busy, className, icon, tone, guard }: OverlayProps) {
  const resolvedTone = tone ?? (icon ? toneOf(icon) : 'primary');
  const o = useOverlay({ open, onClose, busy, guard, tone: resolvedTone });
  return (
    <DialogPrimitive.Root open={o.shown} onOpenChange={(v) => !v && o.requestClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          {...o.contentProps}
          onEscapeKeyDown={guardEscape(busy)}
          onPointerDownOutside={guardEvent(busy)}
          className={cn(
            'fixed z-50 flex flex-col border-border bg-raised text-raised-foreground shadow-dialog focus:outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:duration-300 data-[state=closed]:duration-200',
            'sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none sm:border-l sm:border-t-0 sm:pb-0',
            'sm:data-[state=open]:slide-in-from-right sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-right sm:data-[state=closed]:slide-out-to-bottom-0',
            className,
          )}
        >
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <div className="shrink-0 border-b border-border">
            <Header title={title} description={description} busy={busy} icon={icon} tone={resolvedTone} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
          {footer && (
            <div ref={o.footerRef} className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3.5">
              {resolvedTone !== 'danger' && <ShortcutHint />}
              {footer}
            </div>
          )}
          {o.asking && <DiscardBar onKeep={o.keepEditing} onDiscard={o.discard} />}
          {o.done && <DoneTick />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
