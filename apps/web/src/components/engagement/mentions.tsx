'use client';

import React, { useEffect, useState } from 'react';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useDirectory, type DirectoryPerson } from '@/lib/company/profile';
import { cn } from '@/lib/cn';

// ============================================================
// @mentions in announcements. In the text a mention is stored as
// `@[Priya Shah](<employee id>)`; it shows as a highlighted @Priya Shah.
// The API checks everyone mentioned is in the post's audience and
// tells them (instead of the general "new post" notification).
// ============================================================

/** Same pattern the API reads (announcements.service.ts). */
export const MENTION = /@\[([^\]\n]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

/** A mention chip inside formatted text. */
export function MentionChip({ name }: { name: string }) {
  return <span className="rounded bg-primary-soft px-1 font-medium text-primary-soft-foreground">@{name}</span>;
}

/** "Typing @ri" before the caret → where the "@" is and what follows it. */
function mentionQuery(el: HTMLTextAreaElement): { start: number; text: string } | null {
  const upto = el.value.slice(0, el.selectionStart);
  const m = /(^|\s)@([^\s@[\]()]{0,30})$/.exec(upto);
  return m ? { start: el.selectionStart - m[2]!.length - 1, text: m[2]! } : null;
}

/**
 * Type @ in a textarea to pick a person (↑ ↓ Enter / Tab, Esc). Give the
 * textarea `onKeyDown`, and call `detect` from onChange / onClick / onKeyUp;
 * render `panel` just under the textarea (outside anything with hidden overflow).
 */
export function useMentions(ref: React.RefObject<HTMLTextAreaElement>, value: string, onChange: (next: string) => void, max = 5000) {
  const [q, setQ] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(q?.text ?? ''), 150);
    return () => clearTimeout(t);
  }, [q?.text]);
  const results = useDirectory({ search, limit: 6 }, q !== null);
  const people = q ? (results.data?.data ?? []) : [];

  const detect = () => {
    const el = ref.current;
    const next = el ? mentionQuery(el) : null;
    setQ((cur) => (cur?.start === next?.start && cur?.text === next?.text ? cur : next));
    if (!next) setActive(0);
  };

  const pick = (p: DirectoryPerson) => {
    const el = ref.current;
    if (!el || !q) return;
    const end = el.selectionStart;
    const token = `@[${p.firstName} ${p.lastName}](${p.id}) `;
    onChange((value.slice(0, q.start) + token + value.slice(end)).slice(0, max));
    const pos = q.start + token.length;
    setQ(null);
    setActive(0);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!q) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // close the list, not the page / popup
      setQ(null);
      return;
    }
    if (!people.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : people.length - 1)) % people.length);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      pick(people[Math.min(active, people.length - 1)]!);
    }
  };

  /** Toolbar button: put an "@" at the caret and open the list. */
  const start = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: end } = el;
    const before = value.slice(0, s);
    const insert = before && !/\s$/.test(before) ? ' @' : '@';
    onChange((before + insert + value.slice(end)).slice(0, max));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + insert.length, s + insert.length);
      detect();
    });
  };

  const panel = q ? (
    <div className="mt-1 overflow-hidden rounded-lg border border-border bg-raised shadow-dialog animate-in fade-in-0 slide-in-from-top-1">
      <p className="border-b border-border px-3 py-1.5 text-2xs text-muted-foreground">
        Mention someone — they’ll be told. Only people in this post’s audience can be mentioned.
      </p>
      {results.isFetching && !people.length ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Looking…</p>
      ) : !people.length ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{q.text ? `Nobody matches “${q.text}”` : 'Type a name'}</p>
      ) : (
        <ul role="listbox" aria-label="People to mention" className="max-h-56 overflow-y-auto p-1">
          {people.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()} // keep the caret in the textarea
              onClick={() => pick(p)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm', i === active && 'bg-primary-soft/70')}
            >
              <PersonAvatar person={p} size="xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{p.firstName} {p.lastName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

  // Leaving the box closes the list (picking keeps focus — see onMouseDown)
  const close = () => setQ(null);

  return { detect, onKeyDown, start, close, panel, open: q !== null };
}
