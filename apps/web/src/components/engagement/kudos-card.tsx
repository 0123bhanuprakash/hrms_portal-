'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { KUDOS_REACTIONS, useReact, useRemoveKudos, type KudosItem } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { HeartBurst } from '@/components/motion/motion';

/** One kudos: giver → recipients, value, message, reactions. */
export function KudosCard({ k, compact }: { k: KudosItem; compact?: boolean }) {
  const react = useReact();
  const remove = useRemoveKudos();
  const names = k.recipients.map((r) => r.firstName).join(', ');

  return (
    <Card className={cn('p-4', compact && 'shadow-none')}>
      <div className="flex items-start gap-3">
        <div className="flex -space-x-2">
          {k.recipients.slice(0, 3).map((r) => <PersonAvatar key={r.id} person={r} size={compact ? 'sm' : 'md'} className="ring-2 ring-surface" />)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{k.from.firstName} {k.from.lastName}</span>
            <span className="text-muted-foreground"> gave kudos to </span>
            <span className="font-semibold">{names}</span>
          </p>
          {k.value && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${k.value.color}22`, color: k.value.color }}>
              {k.value.emoji} {k.value.name}
            </span>
          )}
          <p className={cn('mt-1.5 whitespace-pre-line text-sm', compact && 'line-clamp-3')}>{k.message}</p>
          {!compact && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {KUDOS_REACTIONS.map((emoji) => {
                const r = k.reactions.find((x) => x.emoji === emoji);
                return <ReactionButton key={emoji} emoji={emoji} count={r?.count} mine={Boolean(r?.mine)} onReact={() => react.mutate({ id: k.id, emoji })} />;
              })}
              <span className="ml-auto text-xs text-muted-foreground">{formatRelative(k.createdAt)}</span>
              {k.canRemove && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove kudos"
                  onClick={async () => {
                    try {
                      await remove.mutateAsync(k.id);
                      toast.success('Kudos removed');
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, 'Could not remove'));
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
          {compact && <p className="mt-1 text-xs text-muted-foreground">{formatRelative(k.createdAt)}</p>}
        </div>
      </div>
    </Card>
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
        'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors',
        mine ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle',
        !count && 'opacity-60 hover:opacity-100',
      )}
    >
      <HeartBurst fire={fire}>{emoji}</HeartBurst>
      {count ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}
