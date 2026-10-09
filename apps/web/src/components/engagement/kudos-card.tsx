'use client';

import React, { useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import { toast } from 'sonner';
import { HandHeart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { KUDOS_REACTIONS, useReact, useRemoveKudos, useThankKudos, type KudosItem } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { HeartBurst } from '@/components/motion/motion';

/** One kudos: recipients' photos, value colour, message, reactions and "add my thanks". */
export function KudosCard({ k, compact, onRemoved }: { k: KudosItem; compact?: boolean; onRemoved?: () => void }) {
  const react = useReact();
  const remove = useRemoveKudos();
  const thank = useThankKudos();
  const names = k.recipients.map((r) => `${r.firstName} ${r.lastName}`);
  const color = k.value?.color ?? 'hsl(var(--primary))';

  if (compact) {
    return (
      <Card className="p-4 shadow-none">
        <div className="flex items-start gap-3">
          <div className="flex -space-x-2">{k.recipients.slice(0, 3).map((r) => <PersonAvatar key={r.id} person={r} size="sm" className="ring-2 ring-surface" />)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm"><span className="font-semibold">{k.from.firstName} {k.from.lastName}</span><span className="text-muted-foreground"> gave a shout-out to </span><span className="font-semibold">{k.recipients.map((r) => r.firstName).join(', ')}</span></p>
            {k.value && <ValuePill value={k.value} className="mt-1" />}
            <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm">{k.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatRelative(k.createdAt)}</p>
          </div>
        </div>
      </Card>
    );
  }

  const thanksText = k.thanks.count
    ? k.thanks.mine
      ? `You${k.thanks.count > 1 ? ` and ${k.thanks.count - 1} other${k.thanks.count > 2 ? 's' : ''}` : ''} added thanks`
      : `${k.thanks.names.slice(0, 2).join(', ')}${k.thanks.count > 2 ? ` and ${k.thanks.count - 2} more` : ''} added thanks`
    : null;

  return (
    <Card className="relative overflow-hidden p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} aria-hidden />
      <div className="flex items-start gap-3">
        <div className="flex -space-x-3">
          {k.recipients.slice(0, 3).map((r) => <PersonAvatar key={r.id} person={r} size="lg" className="ring-[3px] ring-surface" />)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(' & ')}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            from <PersonAvatar person={k.from} size="xs" className="h-4 w-4 text-[8px]" /> <b className="text-foreground">{k.from.firstName} {k.from.lastName}</b> · {formatRelative(k.createdAt)}
          </p>
        </div>
        {k.value && <ValuePill value={k.value} />}
      </div>
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">“{k.message}”</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {KUDOS_REACTIONS.map((emoji) => {
          const r = k.reactions.find((x) => x.emoji === emoji);
          return <ReactionButton key={emoji} emoji={emoji} count={r?.count} mine={Boolean(r?.mine)} onReact={() => react.mutate({ id: k.id, emoji })} />;
        })}
        <div className="ml-auto flex items-center gap-2">
          {thanksText && <span className="hidden text-xs text-muted-foreground sm:inline">{thanksText}</span>}
          {k.canThank && (
            <Button
              size="sm"
              variant={k.thanks.mine ? 'soft' : 'ghost'}
              loading={thank.isPending}
              aria-pressed={k.thanks.mine}
              onClick={() => thank.mutate(k.id, { onError: (e) => toast.error(getApiErrorMessage(e, 'Could not add thanks')) })}
            >
              <HandHeart /> {k.thanks.mine ? 'Thanked' : 'Add my thanks'}{k.thanks.count ? ` · ${k.thanks.count}` : ''}
            </Button>
          )}
          {!k.canThank && k.thanks.count > 0 && <span className="text-xs text-muted-foreground sm:hidden">+{k.thanks.count}</span>}
          {k.canRemove && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove shout-out"
              onClick={async () => {
                try {
                  await remove.mutateAsync(k.id);
                  toast.success('Shout-out removed');
                  onRemoved?.();
                } catch (err) {
                  toast.error(getApiErrorMessage(err, 'Could not remove'));
                }
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ValuePill({ value, className }: { value: { emoji: string; name: string; color: string }; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', className)} style={{ backgroundColor: `${value.color}22`, color: value.color }}>
      {value.emoji} {value.name}
    </span>
  );
}

/** A reaction; adding one gives a small heart burst. */
function ReactionButton({ emoji, count, mine, onReact }: { emoji: string; count?: number; mine: boolean; onReact: () => void }) {
  const [fire, setFire] = useState(0);
  return (
    <button
      type="button"
      aria-pressed={mine}
      aria-label={`React ${emoji}`}
      onClick={() => {
        if (!mine) setFire((n) => n + 1);
        onReact();
      }}
      className={cn(
        'emo-host inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors',
        mine ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle',
        !count && 'opacity-60 hover:opacity-100',
      )}
    >
      <HeartBurst fire={fire}><Emoji e={emoji} fire={fire} /></HeartBurst>
      {count ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}
