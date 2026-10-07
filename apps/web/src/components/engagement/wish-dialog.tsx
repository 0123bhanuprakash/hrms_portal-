'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Award, Cake, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Emoji } from '@/components/motion/emoji';
import { useAuthStore } from '@/store/useAuthStore';
import { WISH_LINES, WISH_STICKERS, useSendWish, type WishKind } from '@/lib/company/celebrations';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export interface WishPerson {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * "Send wishes" for today's birthdays or a work anniversary: pick a sticker,
 * add a line (optional), see how it will reach them, send. Birthdays on the
 * same day can be wished together; people already wished are ticked.
 */
export function WishDialog({ kind, people, years, wished, onClose }: { kind: WishKind; people: WishPerson[]; years?: number; wished: Set<string>; onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const send = useSendWish();
  const open = people.filter((p) => !wished.has(p.id));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(open.map((p) => p.id)));
  const [sticker, setSticker] = useState(WISH_STICKERS[kind][0]!);
  const [message, setMessage] = useState('');
  const [fire, setFire] = useState(0);
  const birthday = kind === 'birthday';
  const one = people.length === 1 ? people[0] : null;
  const to = people.filter((p) => picked.has(p.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.length) return;
    try {
      await send.mutateAsync({ employeeIds: to.map((p) => p.id), kind, sticker, message: message.trim() || undefined });
      toast.success(`${sticker} Wishes sent to ${to.map((p) => p.firstName).join(', ')}`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send your wishes'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={send.isPending}
      icon={birthday ? <Cake /> : <Award />}
      tone="primary"
      title={birthday ? (one ? `Wish ${one.firstName} a happy birthday` : 'Send birthday wishes') : `Wish ${one?.firstName ?? 'them'} on ${years ? `${years} year${years === 1 ? '' : 's'}` : 'their work anniversary'}`}
      description="Only they see your wish — everyone else just sees the count go up."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>Cancel</Button>
          <Button type="submit" form="wish-form" loading={send.isPending} disabled={!to.length}>{sticker} Send wishes</Button>
        </>
      }
    >
      <form id="wish-form" onSubmit={submit} className="space-y-4">
        {people.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Who to wish">
            {people.map((p) => {
              const done = wished.has(p.id);
              const on = picked.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={done}
                  aria-pressed={on}
                  onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors', done ? 'border-border text-muted-foreground' : on ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}
                >
                  <PersonAvatar person={p} size="xs" />
                  {p.firstName}
                  {done ? <span className="inline-flex items-center gap-0.5 text-2xs font-medium"><Check className="h-3 w-3" />wished</span> : on && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Pick a sticker</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sticker">
            {WISH_STICKERS[kind].map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sticker === s}
                onClick={() => { setSticker(s); setFire((n) => n + 1); }}
                className={cn('emo-host flex h-11 w-11 items-center justify-center rounded-xl border text-2xl transition-all', sticker === s ? 'scale-105 border-primary bg-primary-soft shadow-sm' : 'border-border hover:bg-subtle')}
              >
                <Emoji e={s} fire={sticker === s ? fire : 0} burst />
              </button>
            ))}
          </div>
        </div>

        <Field label="Add a line (optional)" htmlFor="wish-msg" hint={`${message.length}/280`}>
          <Textarea id="wish-msg" rows={2} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={birthday ? 'Happy birthday!…' : 'Congratulations!…'} />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {WISH_LINES[kind].map((line) => (
            <button key={line} type="button" onClick={() => setMessage(line)} className="rounded-full border border-border px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground">
              {line}
            </button>
          ))}
        </div>

        {/* What lands in their bell */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">How it reaches {to.length === 1 ? to[0]!.firstName : 'them'}</p>
          <div className="celebrate-note flex items-start gap-3 rounded-xl border p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-base shadow-sm">{birthday ? '🎂' : '🏆'}</span>
            <span className="min-w-0 text-sm">
              <span className="block font-semibold">{me ? `${me.firstName} ${me.lastName}` : 'You'} wished you {birthday ? 'a happy birthday 🎂' : `on your ${years ? `${years}-year ` : ''}work anniversary 🏆`}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{message.trim() ? `${sticker} “${message.trim()}” — ${me?.firstName ?? 'you'}` : `${sticker} from ${me?.firstName ?? 'you'}`}</span>
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
