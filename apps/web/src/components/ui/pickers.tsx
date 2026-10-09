'use client';

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { inputClass } from './field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useUiState } from '@/lib/preferences/ui-state';

const isWeek = (v: unknown): v is 'mon' | 'sun' => v === 'mon' || v === 'sun';

// ─── Shared dropdown shell ──────────────────────────────────

/**
 * Opens under its trigger, inside the page / popup flow (no portal), so it
 * scrolls with the form and Escape closes only the list, not the popup.
 */
function usePanel() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      // The list may float outside the wrapper (see useFloat)
      if (!wrap.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
    };
  }, [open]);
  return { open, setOpen, wrap, panel };
}

type Float = { left: number; width: number; top?: number; bottom?: number; maxH: number };

/**
 * Outside popups the list floats over the page (fixed, in a portal), so a card
 * with hidden overflow can't cut it off; it opens upward when there is no
 * room below. Inside a popup it stays in the popup's own flow, so the popup
 * keeps focus and treats clicks on the list as inside.
 */
function useFloat(open: boolean, wrap: React.RefObject<HTMLDivElement>, trigger: React.RefObject<HTMLButtonElement>) {
  const [float, setFloat] = useState<Float | null>(null);
  const inPopup = Boolean(wrap.current?.closest('[role="dialog"]'));
  useLayoutEffect(() => {
    if (!open || inPopup) return setFloat(null);
    let frame = 0;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const up = below < 240 && above > below;
      setFloat({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }), maxH: Math.max(140, (up ? above : below) - 4) });
    };
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('scroll', later, true);
    window.addEventListener('resize', later);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', later, true);
      window.removeEventListener('resize', later);
    };
  }, [open, inPopup, trigger]);
  return float;
}

/**
 * Inside a popup the list takes up room under its field, so the popup grows to
 * show it (an overlaid list was cut off by the popup's scrolling body when the
 * form is short). A list inside another picker (month in the date popup) still
 * overlays it.
 */
function useInFlow(open: boolean, wrap: React.RefObject<HTMLDivElement>) {
  const [inFlow, setInFlow] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const el = wrap.current;
    setInFlow(Boolean(el?.closest('[role="dialog"]') && !el.closest('[data-picker-panel]')));
  }, [open, wrap]);
  return inFlow;
}

const triggerClass = cn(inputClass, 'items-center gap-2 text-left');
const panelClass =
  'absolute left-0 top-[calc(100%+4px)] w-max min-w-full max-w-[min(30rem,calc(100vw-2rem))] z-40 overflow-hidden rounded-lg border border-border bg-raised shadow-dialog animate-in fade-in-0 slide-in-from-top-1';

// ─── Search select ──────────────────────────────────────────

export interface PickOption {
  value: string;
  label: string;
  /** Second line (job title, team, counts…) */
  sub?: string | null;
  /** Shown left of the label (avatar, dot…) */
  lead?: React.ReactNode;
  disabled?: boolean;
  /** Extra words to match on */
  keywords?: string;
}

export interface SearchSelectProps {
  /** Inside a popup, float the list over what's below instead of making room (filter rows) */
  overlay?: boolean;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: PickOption[];
  placeholder?: string;
  /** Adds a "nothing" choice with this label (value '') */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  searchPlaceholder?: string;
  /** Hide the search box for short lists */
  searchable?: boolean;
  invalid?: boolean;
  /** Grey out the empty choice like a placeholder (off when "" is a real choice, e.g. "Everyone") */
  muteEmpty?: boolean;
  /** Extra classes for the button itself (className goes on the wrapper) */
  triggerClassName?: string;
  required?: boolean;
  name?: string;
  /** Search on the server instead: called with the typed text; `options` are already the matches */
  onSearch?: (q: string) => void;
  /** The server search is running */
  searching?: boolean;
}

/** A dropdown with search and keyboard support (↑ ↓ Enter Esc). */
export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  emptyLabel,
  disabled,
  className,
  searchPlaceholder = 'Search…',
  searchable,
  invalid,
  muteEmpty = true,
  triggerClassName,
  required,
  name,
  onSearch,
  searching,
  overlay,
  ...rest
}: SearchSelectProps) {
  const { open, setOpen, wrap, panel } = usePanel();
  const trigger = useRef<HTMLButtonElement>(null);
  const float = useFloat(open, wrap, trigger);
  const inFlow = useInFlow(open, wrap) && !overlay;
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const all = useMemo(() => (emptyLabel !== undefined ? [{ value: '', label: emptyLabel }, ...options] : options), [options, emptyLabel]);
  const showSearch = onSearch ? true : searchable ?? all.length > 7;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // Name matches first, then matches on the second line (job title, team…)
  const inName = (o: PickOption) => words.every((w) => o.label.toLowerCase().includes(w));
  // With a server search the options already match; this only drops the chosen one when it doesn't
  const shown = words.length
    ? all
        .filter((o) => o.value && words.every((w) => `${o.label} ${o.sub ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(w)))
        .sort((a, b) => Number(inName(b)) - Number(inName(a)))
    : all;
  const selected = all.find((o) => o.value === value);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(Math.max(0, all.findIndex((o) => o.value === value)));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setActive(0), [q]);
  useEffect(() => onSearch?.(q), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, panel]);

  const pick = (o: PickOption | undefined) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    // A list inside another list (month picker in a date popup) handles its own keys
    if (open && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className={cn('relative', className)} onKeyDown={onKey} data-picker-open={open || undefined}>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={rest['aria-label']}
        onClick={() => setOpen(!open)}
        className={cn(triggerClass, triggerClassName, invalid && 'border-destructive', open && 'border-ring ring-[3px] ring-ring/20')}
      >
        {selected?.value || (selected && !muteEmpty) ? (
          <>
            {selected.lead}
            <span className="min-w-0 flex-1 truncate">{selected.label}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-muted-foreground/80">{selected?.label ?? placeholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {(required || name) && (
        // Lets the browser's own "please fill in" check and FormData still work
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required={required}
          value={value}
          onChange={() => undefined}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      )}
      {open && floatOrInline(
        float,
        <div
          ref={panel}
          data-picker-panel=""
          className={float ? cn(floatClass, float.bottom !== undefined && 'slide-in-from-bottom-1') : inFlow ? inFlowClass : panelClass}
          style={float ? { left: float.left, top: float.top, bottom: float.bottom, minWidth: float.width } : undefined}
        >
          {showSearch && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="hidden text-[10px] text-muted-foreground sm:block">↑↓ Enter</kbd>
            </div>
          )}
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain p-1" style={float ? { maxHeight: Math.min(256, float.maxH - (showSearch ? 40 : 0)) } : undefined}>
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{searching ? 'Searching…' : q ? `Nothing matches “${q}”` : 'Nothing to choose'}</li>}
            {shown.map((o, i) => (
              <li
                key={o.value || '__empty'}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm',
                  i === active && 'bg-primary-soft/70',
                  o.disabled && 'cursor-not-allowed opacity-50',
                  !o.value && muteEmpty && 'text-muted-foreground',
                )}
              >
                {o.lead}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium"><Highlight text={o.label} words={words} /></span>
                  {o.sub && <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>}
                </span>
                {o.value === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const inFlowClass = 'relative mt-1 w-full overflow-hidden rounded-lg border border-border bg-raised shadow-card animate-in fade-in-0 slide-in-from-top-1';
const floatClass =
  'fixed z-[60] w-max max-w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-raised shadow-dialog animate-in fade-in-0 slide-in-from-top-1';
const floatOrInline = (float: Float | null, el: React.ReactElement) => (float ? createPortal(el, document.body) : el);

function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const lower = text.toLowerCase();
  const w = words.find((x) => lower.includes(x));
  if (!w) return <>{text}</>;
  const at = lower.indexOf(w);
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-warning-soft px-0.5 text-foreground">{text.slice(at, at + w.length)}</mark>
      {text.slice(at + w.length)}
    </>
  );
}

// ─── Select (drop-in for a native <Select>) ─────────────────

type NativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  value?: string | number | null;
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  /** Classes for the wrapper, e.g. when it has to sit absolutely over something */
  wrapClassName?: string;
  /** Inside a popup, float the list over what's below instead of making room (filter rows) */
  overlay?: boolean;
  invalid?: boolean;
  searchable?: boolean;
};

const textOf = (n: React.ReactNode): string => {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(n)) return textOf(n.props.children);
  return '';
};

function optionsOf(children: React.ReactNode, out: PickOption[] = [], group?: string): PickOption[] {
  React.Children.forEach(children, (c) => {
    if (!React.isValidElement<{ children?: React.ReactNode; value?: unknown; disabled?: boolean; label?: string }>(c)) return;
    if (c.type === React.Fragment) return void optionsOf(c.props.children, out, group);
    if (c.type === 'optgroup') return void optionsOf(c.props.children, out, c.props.label);
    if (c.type !== 'option') return;
    const text = textOf(c.props.children).trim();
    // "Label — what it means" reads better as two lines
    const dash = text.indexOf(' — ');
    const value = c.props.value === undefined ? text : String(c.props.value);
    out.push({
      value,
      label: dash > 0 ? text.slice(0, dash) : text,
      sub: dash > 0 ? text.slice(dash + 3) : group,
      disabled: c.props.disabled,
      keywords: group,
    });
  });
  return out;
}

// Size and placement classes belong on the wrapper; looks stay on the button
const WRAP_CLASS = /^(?:[\w-]+:)*(?:w-|min-w-|max-w-|flex-|shrink|grow|basis-|ml-auto|mr-auto|self-|col-span|order-|absolute|relative|inset-|top-|left-|right-|bottom-|z-)/;

/**
 * Looks and works like every other dropdown in the app, but takes the same
 * props and <option> children as a native <Select>, so swapping is one word.
 */
export function Select({ value, onChange, children, className, wrapClassName, disabled, id, required, name, invalid, searchable, overlay, ...rest }: NativeSelectProps) {
  const options = optionsOf(children);
  const classes = cn(className).split(/\s+/).filter(Boolean);
  const wrap = classes.filter((c) => WRAP_CLASS.test(c));
  const look = classes.filter((c) => !WRAP_CLASS.test(c));
  const v = value == null ? '' : String(value);
  const selected = options.find((o) => o.value === v);
  return (
    <SearchSelect
      id={id}
      value={v}
      onChange={(next) => onChange?.({ target: { value: next }, currentTarget: { value: next } })}
      options={options}
      placeholder={selected ? selected.label : options[0]?.label}
      disabled={disabled}
      required={required}
      name={name}
      invalid={invalid ?? (rest['aria-invalid'] === true || rest['aria-invalid'] === 'true')}
      searchable={searchable}
      overlay={overlay}
      muteEmpty={false}
      aria-label={rest['aria-label']}
      className={cn('w-full', wrap, wrapClassName)}
      triggerClassName={cn(look, wrap.some((c) => /absolute|inset-/.test(c)) && 'h-full')}
    />
  );
}

// ─── Person select ──────────────────────────────────────────

export interface PersonOption {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  /** Job title, employee ID, "3 open"… */
  sub?: string | null;
  disabled?: boolean;
}

/** Choose a person: search by name, with photos. */
export function PersonSelect({
  people,
  ...props
}: Omit<SearchSelectProps, 'options' | 'searchable'> & { people: PersonOption[] }) {
  const options = useMemo(
    () =>
      people.map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName}`.trim(),
        sub: p.sub,
        disabled: p.disabled,
        lead: <PersonAvatar person={p} size="xs" />,
      })),
    [people],
  );
  return <SearchSelect placeholder="Choose a person" searchPlaceholder="Search by name…" {...props} options={options} searchable={people.length > 5} />;
}

// ─── Date input ─────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const addDays = (k: string, n: number) => {
  const d = parse(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
const daysFrom = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function relative(k: string) {
  const n = daysFrom(keyOf(new Date()), k);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n <= 60) return `in ${n} days`;
  if (n < -1 && n >= -60) return `${-n} days ago`;
  return '';
}

export interface DateInputProps {
  id?: string;
  value: string;
  /** Same shape as an <input> change event, so it drops in for type="date" */
  onChange: (e: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}

/** Date field with our own calendar, quick picks and "in N days". */
export function DateInput({ id, value, onChange, min, max, required, disabled, className, placeholder = 'Pick a date', ...rest }: DateInputProps) {
  const { open, setOpen, wrap, panel } = usePanel();
  const today = keyOf(new Date());
  const [week] = useUiState<'mon' | 'sun'>('week.start', 'mon', isWeek);
  const sunFirst = week === 'sun';
  const [view, setView] = useState(() => (value || today).slice(0, 7));
  useEffect(() => {
    if (open) setView((value || (max && max < today ? max : min && min > today ? min : today)).slice(0, 7));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = (k: string) => (!min || k >= min) && (!max || k <= max);
  const set = (k: string) => {
    onChange({ target: { value: k } });
    setOpen(false);
  };
  const past = Boolean(max && max <= today);
  const nextMon = addDays(today, ((8 - parse(today).getDay()) % 7) || 7);
  const quick: Array<[string, string]> = past
    ? [['Today', today], ['Yesterday', addDays(today, -1)], ['A week ago', addDays(today, -7)]]
    : [['Today', today], ['Tomorrow', addDays(today, 1)], ['Next Mon', nextMon], ['In a week', addDays(today, 7)]];

  const [vy, vm] = view.split('-').map(Number) as [number, number];
  const first = new Date(vy, vm - 1, 1);
  const lead = sunFirst ? first.getDay() : (first.getDay() + 6) % 7; // Monday first unless chosen otherwise
  const days = new Date(vy, vm, 0).getDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => `${vy}-${pad(vm)}-${pad(i + 1)}`)];
  const shift = (n: number) => setView(keyOf(new Date(vy, vm - 1 + n, 1)).slice(0, 7));
  const yearNow = new Date().getFullYear();
  const years = Array.from({ length: 111 }, (_, i) => yearNow + 10 - i).filter((y) => (!min || y >= +min.slice(0, 4)) && (!max || y <= +max.slice(0, 4)));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };
  const rel = value ? relative(value) : '';

  return (
    <div ref={wrap} className={cn('relative', className)} onKeyDown={onKey} data-picker-open={open || undefined}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        onClick={() => setOpen(!open)}
        title={value ? parse(value).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : undefined}
        className={cn(triggerClass, 'whitespace-nowrap', open && 'border-ring ring-[3px] ring-ring/20')}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        {value ? (
          <span className="min-w-0 flex-1 truncate">
            {parse(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            {rel && <span className="ml-1.5 text-xs text-muted-foreground">· {rel}</span>}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-muted-foreground/80">{placeholder}</span>
        )}
        {value && !required && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ target: { value: '' } });
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {open && (
        <div ref={panel} role="dialog" aria-label="Choose a date" data-picker-panel="" className={cn(panelClass, 'right-auto w-[17.5rem] min-w-0 p-3')}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quick.map(([label, k]) => (
              <button
                key={label}
                type="button"
                disabled={!ok(k)}
                onClick={() => set(k)}
                className={cn(
                  'rounded-full border border-border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40',
                  value === k && 'border-primary bg-primary-soft text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mb-1 flex items-center gap-1">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="rounded p-1 text-muted-foreground hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Select searchable={false} aria-label="Month" value={vm} onChange={(e) => setView(`${vy}-${pad(+e.target.value)}`)} className="h-7 flex-1 rounded border-0 bg-transparent px-1.5 text-sm font-semibold shadow-none hover:bg-muted">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
            <Select searchable={false} aria-label="Year" value={vy} onChange={(e) => setView(`${e.target.value}-${pad(vm)}`)} className="h-7 w-auto rounded border-0 bg-transparent px-1.5 text-sm font-semibold shadow-none hover:bg-muted">
              {(years.includes(vy) ? years : [vy, ...years]).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="rounded p-1 text-muted-foreground hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {(sunFirst ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']).map((d) => (
              <span key={d} className="py-1 text-[10px] font-semibold uppercase text-muted-foreground">{d}</span>
            ))}
            {cells.map((k, i) =>
              k ? (
                <button
                  key={k}
                  type="button"
                  disabled={!ok(k)}
                  onClick={() => set(k)}
                  className={cn(
                    'h-8 rounded-md text-sm tabular-nums transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-30',
                    k === today && 'font-bold text-primary',
                    k === value && 'bg-primary font-semibold text-primary-foreground hover:bg-primary',
                    (sunFirst ? i % 7 === 0 || i % 7 === 6 : i % 7 >= 5) && k !== value && 'text-muted-foreground',
                  )}
                >
                  {+k.slice(8)}
                </button>
              ) : (
                <span key={`b${i}`} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
