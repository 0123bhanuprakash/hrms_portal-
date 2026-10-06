'use client';

import { NoProfile } from '@/components/profile/no-profile';
import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Check, ClipboardCheck, Inbox, PackageOpen, PackagePlus, Repeat, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { RequestList } from '@/components/assets/asset-lists';
import { ProblemDialog } from '@/components/assets/asset-dialogs';
import { LoanRing, ProductArt, UnboxMoment } from '@/components/assets/product-art';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import {
  CONDITION_LABEL,
  daysUntil,
  useAcknowledgeAsset,
  useAnswerCheck,
  useAskReturn,
  useAssetRequests,
  useMyAssets,
  useMyCheck,
  type HeldAsset,
  type MyCheck,
} from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function MyAssetsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const allowed = hasFeature('ops.assets') && can('asset.view');
  const mine = useMyAssets(allowed);
  const [page, setPage] = useState(1);
  const requests = useAssetRequests({ view: 'mine', page, limit: 10 }, allowed && can('asset.request'));
  const [reviewPage, setReviewPage] = useState(1);
  const review = useAssetRequests({ view: 'review', page: reviewPage, limit: 5 }, allowed);
  const check = useMyCheck(allowed);
  const [problem, setProblem] = useState<HeldAsset | null>(null);
  const [returning, setReturning] = useState<HeldAsset | null>(null);
  const [unbox, setUnbox] = useState<{ icon: string; label: string } | null>(null);
  const ack = useAcknowledgeAsset();
  const doneUnbox = useCallback(() => setUnbox(null), []);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Assets aren’t available" />;
  if (me.isSuccess && !me.data?.employee) return <NoProfile what="Assets are handed to employees." />;

  const confirm = async (a: HeldAsset) => {
    try {
      await ack.mutateAsync(a.id);
      setUnbox({ icon: a.asset.type.icon, label: a.asset.name.split(' ')[0] ?? '' });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not confirm'));
    }
  };

  const current = mine.data?.current ?? [];
  const unconfirmed = current.filter((a) => !a.acknowledgedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="My assets"
        description="Company equipment you have — laptop, phone, ID card and so on. Confirm when you receive something."
        action={can('asset.request') && <Button asChild><Link href="/app/assets/request"><PackagePlus /> Request an asset</Link></Button>}
      />

      {unconfirmed.map((a) => (
        <Card key={a.id} className="flex flex-wrap items-center gap-4 border-info/40 bg-info-soft/40 p-4">
          <ProductArt icon={a.asset.type.icon} size="sm" play label={a.asset.name.split(' ')[0]} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">IT handed you {a.asset.name} <span className="font-normal text-muted-foreground">· {a.asset.tag}</span></p>
            <p className="text-sm text-muted-foreground">Did you receive it? Confirming tells IT it reached you{a.dueBack ? ` — it’s a loan until ${formatDate(a.dueBack)}` : ''}.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setProblem(a)}><AlertTriangle /> It has a problem</Button>
            <Button onClick={() => void confirm(a)} loading={ack.isPending && ack.variables === a.id}><Check /> I got it</Button>
          </div>
        </Card>
      ))}

      {check.data && !check.data.done && <YearlyCheck check={check.data} />}

      {review.data && review.data.meta.total > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 text-primary" /> Waiting for your approval · {review.data.meta.total}</h2>
          <RequestList query={review} showEmployee empty="Nothing is waiting for you" page={reviewPage} onPage={setReviewPage} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">With you now{current.length ? ` · ${current.length}` : ''}</h2>
        {mine.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : mine.isError ? (
          <ErrorState message={getApiErrorMessage(mine.error, 'Could not load your assets')} onRetry={() => void mine.refetch()} />
        ) : !current.length ? (
          <EmptyState icon={<PackageOpen />} title="Nothing with you" description="When IT hands you something, it shows up here." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {current.map((a) => <HeldCard key={a.id} a={a} onProblem={() => setProblem(a)} onReturn={() => setReturning(a)} />)}
          </div>
        )}
      </section>

      {can('asset.request') && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">My requests</h2>
          <RequestList query={requests} empty="You haven’t requested anything" page={page} onPage={setPage} />
        </section>
      )}

      {(mine.data?.past.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Returned · {mine.data!.past.length}</h2>
          <Card className="divide-y divide-border">
            {mine.data!.past.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 opacity-75">
                <ProductArt icon={a.asset.type.icon} size="xs" />
                <p className="min-w-0 flex-1 truncate text-sm"><b className="font-medium">{a.asset.name}</b> · {a.asset.tag}</p>
                <span className="text-xs text-muted-foreground">{formatDate(a.assignedAt)} – {formatDate(a.returnedAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <ProblemDialog held={problem} onClose={() => setProblem(null)} />
      <ReturnAskDialog held={returning} onClose={() => setReturning(null)} />
      {unbox && <UnboxMoment icon={unbox.icon} label={unbox.label} onDone={doneUnbox} />}
    </div>
  );
}

function HeldCard({ a, onProblem, onReturn }: { a: HeldAsset; onProblem: () => void; onReturn: () => void }) {
  const ticket = a.openTickets[0];
  const loan = Boolean(a.dueBack);
  const left = a.dueBack ? daysUntil(a.dueBack) : null;
  const warrantyDays = a.asset.warrantyUntil ? daysUntil(a.asset.warrantyUntil) : null;
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative flex h-32 items-center justify-center bg-subtle">
        <ProductArt icon={a.asset.type.icon} size="sm" hover state={ticket ? 'repair' : loan ? 'loan' : null} label={a.asset.name.split(' ')[0]} />
        {a.dueBack && <span className="absolute right-3 top-3"><LoanRing dueBack={a.dueBack} from={a.assignedAt.slice(0, 10)} /></span>}
      </div>
      <div className="flex-1 space-y-1.5 p-4">
        <p className="font-semibold">{a.asset.name}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{a.asset.tag}</span> · {a.asset.type.name}{a.asset.serialNumber && ` · S/N ${a.asset.serialNumber}`}
        </p>
        <p className="text-xs text-muted-foreground">Since {formatDate(a.assignedAt)} · {CONDITION_LABEL[a.conditionOut].toLowerCase()} at hand-over</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {!a.acknowledgedAt && <Badge tone="warning" dot>Not confirmed</Badge>}
          {loan && left !== null && <Badge tone={left < 0 ? 'danger' : left <= 2 ? 'warning' : 'primary'}>{left < 0 ? `Overdue by ${-left}d — please return` : `Loan · back by ${formatDate(a.dueBack)}`}</Badge>}
          {ticket && <Badge tone="warning">Ticket #{ticket.number} open</Badge>}
          {warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 60 && <Badge tone="neutral">Warranty ends {formatDate(a.asset.warrantyUntil)}</Badge>}
        </div>
      </div>
      <div className="flex border-t border-border text-xs font-medium [&>*]:flex-1">
        <button type="button" onClick={onProblem} className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-subtle [&_svg]:size-3.5"><AlertTriangle /> Problem</button>
        <Link href="/app/assets/request" className="flex items-center justify-center gap-1.5 border-x border-border py-2.5 hover:bg-subtle [&_svg]:size-3.5"><Repeat /> Swap</Link>
        <button type="button" onClick={onReturn} className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-subtle [&_svg]:size-3.5"><RotateCcw /> Return</button>
      </div>
    </Card>
  );
}

function ReturnAskDialog({ held, onClose }: { held: HeldAsset | null; onClose: () => void }) {
  const ask = useAskReturn();
  const [note, setNote] = useState('');
  if (!held) return null;
  return (
    <Modal
      open
      onClose={onClose}
      busy={ask.isPending}
      icon={<RotateCcw />}
      title={`Return ${held.asset.tag}`}
      description="IT is told you want to hand it back and will arrange a time. It stays with you until they take it."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={ask.isPending}
            onClick={() =>
              ask.mutate(
                { assignmentId: held.id, note },
                { onSuccess: () => { toast.success('IT has been told'); setNote(''); onClose(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send')) },
              )
            }
          >
            Tell IT
          </Button>
        </>
      }
    >
      <Field label="Note for IT" htmlFor="ra-note" hint="Optional — e.g. when you’re in the office">
        <Input id="ra-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
    </Modal>
  );
}

type Answer = 'HAVE' | 'PROBLEM' | 'NOT_WITH_ME';
const ANSWERS: Array<{ id: Answer; label: string }> = [
  { id: 'HAVE', label: 'I have it' },
  { id: 'PROBLEM', label: 'It has a problem' },
  { id: 'NOT_WITH_ME', label: 'Not with me' },
];

function YearlyCheck({ check }: { check: MyCheck }) {
  const answer = useAnswerCheck();
  const [picked, setPicked] = useState<Record<string, { answer: Answer; note: string }>>(() =>
    Object.fromEntries(check.items.filter((i) => i.answer).map((i) => [i.assignmentId, { answer: i.answer!, note: i.note ?? '' }])),
  );
  const missingNote = check.items.some((i) => picked[i.assignmentId] && picked[i.assignmentId]!.answer !== 'HAVE' && picked[i.assignmentId]!.note.trim().length < 3);
  const all = check.items.every((i) => picked[i.assignmentId]);
  const submit = () =>
    answer.mutate(
      check.items.filter((i) => picked[i.assignmentId]).map((i) => ({ assignmentId: i.assignmentId, answer: picked[i.assignmentId]!.answer, note: picked[i.assignmentId]!.note || null })),
      { onSuccess: () => toast.success('Thanks — your check is done'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')) },
    );
  return (
    <Card className="space-y-3 border-primary/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="size-5 text-primary" />
        <p className="font-semibold">{check.name}</p>
        <span className="text-sm text-muted-foreground">· do you still have these? Please answer by {formatDate(check.dueOn)}</span>
      </div>
      <ul className="space-y-2">
        {check.items.map((i) => {
          const p = picked[i.assignmentId];
          return (
            <li key={i.assignmentId} className="rounded-lg bg-subtle p-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <ProductArt icon={i.asset.type.icon} size="xs" />
                <p className="min-w-0 flex-1 truncate text-sm"><b className="font-medium">{i.asset.name}</b> · <span className="font-mono text-xs">{i.asset.tag}</span></p>
                <div className="flex gap-1">
                  {ANSWERS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPicked({ ...picked, [i.assignmentId]: { answer: o.id, note: p?.note ?? '' } })}
                      className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', p?.answer === o.id ? (o.id === 'HAVE' ? 'border-success bg-success-soft text-success' : 'border-warning bg-warning-soft text-warning') : 'border-border bg-surface hover:bg-muted')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {p && p.answer !== 'HAVE' && (
                <Input className="mt-2" value={p.note} onChange={(e) => setPicked({ ...picked, [i.assignmentId]: { ...p, note: e.target.value } })} placeholder={p.answer === 'PROBLEM' ? 'What’s wrong with it?' : 'Where is it? (with IT, lost, someone else…)'} maxLength={500} />
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button onClick={submit} loading={answer.isPending} disabled={!all || missingNote}>Send answers <ArrowRight /></Button>
      </div>
    </Card>
  );
}
