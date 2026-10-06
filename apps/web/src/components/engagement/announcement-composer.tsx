'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, AtSign, Bold, Building2, Clock, Italic, Link2, List, Mail, MapPin, Paperclip, Send, Smartphone, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/feedback';
import { Field, Input, Textarea, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { useDepartments, useLocations } from '@/lib/company/org';
import { useAudiencePreview, useSaveAnnouncement, type Announcement, type AnnouncementInput, type Audience } from '@/lib/company/engagement';
import { AnnouncementCover } from './cover';
import { CoverPicker, type CoverMedia } from './cover-picker';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CATEGORIES, CATEGORY_ORDER, COVERS, CategoryPill, RichText, eventWhen } from './announcement-ui';
import { DateInput } from '@/components/ui/pickers';
import { useMentions } from '@/components/engagement/mentions';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** <input type="datetime-local"> value ↔ ISO */
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const empty = (teamOnly: boolean): AnnouncementInput => ({
  title: '', body: '', audience: teamOnly ? 'TEAM' : 'COMPANY', departmentIds: [], locationIds: [], category: 'update', cover: null, coverEmoji: null,
  coverScene: null, coverArt: null, coverMotion: 'gentle', coverFocusX: 50, coverFocusY: 50, coverDim: 25,
  pinned: false, requiresAck: false, ackDueAt: null, sendEmail: false, allowReactions: true, eventAt: null, eventPlace: null, expiresAt: null, action: 'publish', publishAt: null,
});

/** Write, preview and publish (now, later, or keep as a draft). */
export function AnnouncementComposer({ existing }: { existing?: Announcement }) {
  const router = useRouter();
  const { can } = useAccess();
  const companyWide = can('announcement.post') || can('announcement.manage');
  const team = can('announcement.post_team');
  const canPin = can('announcement.manage');
  const save = useSaveAnnouncement();
  const departments = useDepartments();
  const locations = useLocations();
  const fileInput = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const [f, setF] = useState<AnnouncementInput>(() => empty(!companyWide));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<'app' | 'email'>('app');
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState('');
  const live = existing?.status === 'published';

  useEffect(() => {
    if (!existing) return;
    setF({
      title: existing.title, body: existing.body, audience: existing.audience, departmentIds: existing.departmentIds, locationIds: existing.locationIds,
      category: existing.category, cover: existing.cover, coverEmoji: existing.coverEmoji, pinned: existing.pinned, requiresAck: existing.requiresAck,
      coverScene: existing.coverScene, coverArt: existing.coverArt, coverMotion: existing.coverMotion, coverFocusX: existing.coverFocusX, coverFocusY: existing.coverFocusY, coverDim: existing.coverDim,
      ackDueAt: existing.ackDueAt?.slice(0, 10) ?? null, sendEmail: existing.sendEmail, allowReactions: existing.allowReactions, eventAt: existing.eventAt,
      eventPlace: existing.eventPlace, expiresAt: existing.expiresAt?.slice(0, 10) ?? null, action: 'publish', publishAt: existing.status === 'scheduled' ? existing.publishedAt : null,
    });
  }, [existing]);

  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const mention = useMentions(body, f.body, (next) => set('body', next));
  const audienceQ = useMemo(() => ({ audience: f.audience, departmentIds: f.departmentIds, locationIds: f.locationIds }), [f.audience, f.departmentIds, f.locationIds]);
  const reach = useAudiencePreview(audienceQ, !(existing && existing.audience === 'TEAM' && !existing.isMine));
  // Uploaded cover: a new file (previewed locally), the saved one, or removed
  const [coverFile, setCoverFile] = useState<{ file: File; media: CoverMedia } | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  useEffect(() => () => { if (coverFile) URL.revokeObjectURL(coverFile.media.url); }, [coverFile]);
  const media: CoverMedia | null = coverFile?.media ?? (!removeCover && existing?.coverMediaUrl && existing.coverMediaKind ? { url: existing.coverMediaUrl, kind: existing.coverMediaKind } : null);
  const coverPreview = { ...f, coverMediaUrl: media?.url ?? null, coverMediaKind: media?.kind ?? null };

  /** Wraps the selected text in the message (bold / italic / link) or starts a bullet. */
  const format = (kind: 'bold' | 'italic' | 'list' | 'link') => {
    const el = body.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e);
    let insert = sel;
    if (kind === 'bold') insert = `**${sel || 'bold text'}**`;
    if (kind === 'italic') insert = `*${sel || 'italic text'}*`;
    if (kind === 'link') insert = `[${sel || 'link text'}](https://)`;
    if (kind === 'list') insert = (sel || 'item').split('\n').map((l) => `- ${l.replace(/^\s*[-•]\s+/, '')}`).join('\n');
    const prefix = kind === 'list' && s > 0 && value[s - 1] !== '\n' ? '\n' : '';
    const next = value.slice(0, s) + prefix + insert + value.slice(e);
    set('body', next.slice(0, 5000));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length + insert.length);
    });
  };

  const submit = async (action: AnnouncementInput['action'], publishAt: string | null = null) => {
    setError(null);
    if (f.title.trim().length < 3) return setError('Give it a title (3+ characters)');
    if (f.body.trim().length < 3) return setError('Write a message (3+ characters)');
    if (file && file.size > 10 * 1024 * 1024) return setError('Attachment must be 10 MB or smaller');
    try {
      const a = await save.mutateAsync({
        ...f,
        ...(existing && { id: existing.id }),
        action,
        publishAt,
        pinned: canPin ? f.pinned : (existing?.pinned ?? false),
        coverFile: coverFile?.file ?? null,
        removeCover: removeCover && !coverFile,
        ackDueAt: f.requiresAck ? f.ackDueAt : null,
        eventAt: f.category === 'event' || f.eventAt ? f.eventAt : null,
        // End of the chosen day
        expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : null,
        file,
      });
      toast.success(
        action === 'draft' ? 'Draft saved' : action === 'schedule' ? `Scheduled for ${formatDateTime(publishAt)}` : live ? 'Announcement updated' : `Published to ${reach.data?.count ?? 'everyone'} ${reach.data?.count === 1 ? 'person' : 'people'}`,
      );
      router.push(action === 'publish' ? `/app/announcements/${a.id}` : '/app/announcements');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the announcement'));
    }
  };

  const toggle = (k: 'departmentIds' | 'locationIds', id: string) => setF((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));
  const audiences: Array<[Audience, string, React.ReactNode]> = [
    ...(companyWide ? ([['COMPANY', 'Everyone', <Users key="c" />], ['DEPARTMENTS', 'Departments', <Building2 key="d" />], ['LOCATIONS', 'Locations', <MapPin key="l" />]] as Array<[Audience, string, React.ReactNode]>) : []),
    ...(team || existing?.audience === 'TEAM' ? ([['TEAM', companyWide ? 'My team' : 'My team (everyone below me)', <Users key="t" />]] as Array<[Audience, string, React.ReactNode]>) : []),
  ];
  const busy = save.isPending;
  const count = reach.data?.count;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/app/announcements"><ArrowLeft /> Announcements</Link></Button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{existing ? (live ? 'Edit announcement' : 'Finish your draft') : 'New announcement'}</h1>
          <p className="text-sm text-muted-foreground">{live ? 'Edits don’t notify people again.' : 'Write once — it reaches the right people in-app, and by email if you choose.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!live && <Button variant="secondary" onClick={() => submit('draft')} disabled={busy}>Save draft</Button>}
          {!live && <Button variant="secondary" onClick={() => { setWhen(toLocal(f.publishAt) || toLocal(new Date(Date.now() + 3600_000).toISOString())); setScheduling(true); }} disabled={busy}><Clock /> Schedule</Button>}
          <Button onClick={() => submit('publish')} loading={busy}><Send /> {live ? 'Save changes' : count !== undefined ? `Publish to ${count} ${count === 1 ? 'person' : 'people'}` : 'Publish'}</Button>
        </div>
      </div>
      {existing?.status === 'scheduled' && <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">Scheduled to go out {formatDateTime(existing.publishedAt)}. Publish now, reschedule, or save it back as a draft.</p>}
      <FormError>{error}</FormError>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Card className="space-y-4 p-5">
            <Field label="Type">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type">
                {CATEGORY_ORDER.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={f.category === c} onClick={() => setF((p) => ({ ...p, category: c, cover: p.cover }))} className={pill(f.category === c)}>
                    {CATEGORIES[c].emoji} {CATEGORIES[c].label}
                  </button>
                ))}
              </div>
            </Field>
            <CoverPicker
              value={f}
              onChange={(patch) => setF((p) => ({ ...p, ...patch }))}
              media={media}
              onFile={(file, kind) => { setCoverFile({ file, media: { url: URL.createObjectURL(file), kind, name: file.name } }); setRemoveCover(false); }}
              onRemoveMedia={() => { setCoverFile(null); setRemoveCover(true); }}
            />
            <Field label="Title" htmlFor="an-title" required><Input id="an-title" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={150} placeholder="e.g. Updated leave policy for 2027" className="text-base font-semibold" /></Field>
            <Field label="Message" htmlFor="an-body" required aside={<span className="text-xs tabular-nums text-muted-foreground">{f.body.length}/5000</span>}>
              <div className="overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring">
                <div className="flex gap-0.5 border-b border-border bg-subtle/50 p-1">
                  {([['bold', <Bold key="b" />, 'Bold'], ['italic', <Italic key="i" />, 'Italic'], ['list', <List key="l" />, 'Bullet list'], ['link', <Link2 key="k" />, 'Link']] as const).map(([k, icon, label]) => (
                    <Button key={k} type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => format(k)}>{icon}</Button>
                  ))}
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Mention someone" title="Mention someone (type @)" onClick={mention.start}><AtSign /></Button>
                  <span className="ml-auto self-center pr-2 text-[11px] text-muted-foreground">**bold** · *italic* · - list · @name</span>
                </div>
                <Textarea
                  ref={body}
                  id="an-body"
                  value={f.body}
                  onChange={(e) => {
                    set('body', e.target.value);
                    mention.detect();
                  }}
                  onKeyDown={mention.onKeyDown}
                  onKeyUp={(e) => !['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key) && mention.detect()}
                  onClick={mention.detect}
                  onBlur={mention.close}
                  aria-expanded={mention.open}
                  maxLength={5000}
                  rows={9}
                  className="rounded-none border-0 focus-visible:ring-0"
                  placeholder="What do people need to know? Type @ to mention someone."
                />
              </div>
              {mention.panel}
            </Field>
            {(f.category === 'event' || f.eventAt) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="When" htmlFor="an-event"><Input id="an-event" type="datetime-local" value={toLocal(f.eventAt)} onChange={(e) => set('eventAt', fromLocal(e.target.value))} /></Field>
                <Field label="Where" htmlFor="an-place"><Input id="an-place" value={f.eventPlace ?? ''} maxLength={120} onChange={(e) => set('eventPlace', e.target.value || null)} placeholder="e.g. Cafeteria" /></Field>
              </div>
            )}
            <div>
              <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="sr-only" tabIndex={-1} onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              {file ? (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4" /> <span className="font-medium">{file.name}</span> <span className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</span>
                  <Button size="icon-sm" variant="ghost" aria-label="Remove file" className="ml-auto" onClick={() => setFile(null)}><X /></Button>
                </p>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}><Paperclip /> {existing?.attachmentName ? `Replace ${existing.attachmentName}` : 'Attach a file'}</Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Users />} title="Who gets it" />
            <div className="space-y-3 px-5 pb-5">
              {audiences.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {audiences.map(([k, label, icon]) => (
                    <button key={k} type="button" aria-pressed={f.audience === k} onClick={() => set('audience', k)} disabled={live && existing?.audience === 'TEAM' && !existing.isMine} className={cn(pill(f.audience === k), '[&_svg]:size-3.5')}>{icon} {label}</button>
                  ))}
                </div>
              )}
              {audiences.length === 1 && <p className="text-sm">Everyone who reports to you, directly or further down.</p>}
              {f.audience === 'DEPARTMENTS' && (
                <>
                  <Chips items={departments.data} on={f.departmentIds} toggle={(id) => toggle('departmentIds', id)} />
                  <p className="text-xs text-muted-foreground">Sub-departments are included.</p>
                </>
              )}
              {f.audience === 'LOCATIONS' && <Chips items={locations.data} on={f.locationIds} toggle={(id) => toggle('locationIds', id)} />}
              {reach.data && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-subtle px-3 py-2.5">
                  <div className="flex -space-x-2">{reach.data.sample.map((p) => <PersonAvatar key={p.id} person={p} size="sm" className="ring-2 ring-surface" />)}</div>
                  <p className="text-sm"><b>{reach.data.count} {reach.data.count === 1 ? 'person' : 'people'}</b> will see this{f.sendEmail ? ` · ${reach.data.emailable} get it by email` : ''}</p>
                </div>
              )}
              {reach.isError && <p className="text-sm text-destructive">{getApiErrorMessage(reach.error, 'Could not work out the audience')}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Options" />
            <div className="space-y-1 px-5 pb-5">
              {canPin && <Toggle on={f.pinned} onChange={(v) => set('pinned', v)} title="Pin to the top for everyone" hint="Only one announcement is pinned at a time — this replaces the current one." />}
              <Toggle on={f.requiresAck} onChange={(v) => setF((p) => ({ ...p, requiresAck: v, ackDueAt: v ? (p.ackDueAt ?? ymd(new Date(Date.now() + 7 * 86_400_000))) : null }))} title="Ask people to confirm they’ve read it" hint="Adds an “I have read this” button and tracks who did.">
                {f.requiresAck && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    Confirm by <DateInput className="h-8 w-40" value={f.ackDueAt ?? ''} min={ymd(new Date())} onChange={(e) => set('ackDueAt', e.target.value || null)} aria-label="Confirm by" />
                    {f.ackDueAt && <span>· a reminder goes 2 days before to anyone who hasn’t</span>}
                  </div>
                )}
              </Toggle>
              <Toggle on={f.sendEmail} onChange={(v) => set('sendEmail', v)} disabled={live} title="Also send by email" hint={live ? 'Only when publishing' : 'In-app notification is always sent.'} />
              <Toggle on={f.allowReactions} onChange={(v) => set('allowReactions', v)} title="Allow reactions" hint="👍 ❤️ 🎉 🙏 👏 — no comments." />
              <div className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-medium">Hide after</span>
                <DateInput className="h-8 w-40" value={f.expiresAt ?? ''} min={ymd(new Date())} onChange={(e) => set('expiresAt', e.target.value || null)} aria-label="Hide after" />
                <span className="text-xs text-muted-foreground">Optional — it moves out of the feed</span>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Preview">
            {([['app', 'In the app', <Smartphone key="a" />], ['email', 'Email', <Mail key="e" />]] as const).map(([k, l, icon]) => (
              <button key={k} type="button" aria-pressed={preview === k} onClick={() => setPreview(k)} className={cn('inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-semibold [&_svg]:size-3.5', preview === k ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>{icon} {l}</button>
            ))}
          </div>
          {preview === 'app' ? (
            <div className="mx-auto w-[270px] overflow-hidden rounded-[30px] border-[8px] border-slate-900 bg-surface shadow-dialog">
              <AnnouncementCover a={coverPreview} size="banner" className="h-32" />
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-1">
                  <CategoryPill category={f.category} className="text-[10px]" />
                  {f.requiresAck && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">Confirm{f.ackDueAt ? ` by ${formatDate(f.ackDueAt)}` : ''}</span>}
                </div>
                <p className="text-sm font-bold leading-snug">{f.title || 'Your title'}</p>
                {f.eventAt && <p className="text-[11px] font-semibold">📅 {eventWhen(f.eventAt)}{f.eventPlace ? ` · ${f.eventPlace}` : ''}</p>}
                <div className="max-h-48 overflow-hidden text-[11.5px] text-muted-foreground">{f.body ? <RichText text={f.body} /> : 'Your message…'}</div>
                {f.requiresAck && <span className="flex h-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">✓ I have read this</span>}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface text-sm shadow-card">
              <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                <p><b className="text-foreground">Subject:</b> {f.coverEmoji ?? '📢'} {f.title || 'Your title'}{f.requiresAck ? ' — please read and confirm' : ''}</p>
              </div>
              <div className="space-y-2 p-4">
                <div className="max-h-56 overflow-hidden text-[13px]">{f.body ? <RichText text={f.body} /> : <span className="text-muted-foreground">Your message…</span>}</div>
                <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Read announcement</span>
                {!f.sendEmail && <p className="text-xs text-muted-foreground">Email is off — turn on “Also send by email” in Options.</p>}
              </div>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Scheduled posts go out at the time you pick.</p>
        </aside>
      </div>

      <Modal
        open={scheduling}
        onClose={() => setScheduling(false)}
        icon={<Clock />}
        title="Schedule for later"
        description="Nobody sees it (or gets notified) until then. You can still edit it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduling(false)}>Cancel</Button>
            <Button onClick={() => { setScheduling(false); void submit('schedule', fromLocal(when)); }} disabled={!when}><Clock /> Schedule</Button>
          </>
        }
      >
        <Field label="Goes out" htmlFor="an-when"><Input id="an-when" type="datetime-local" value={when} min={toLocal(new Date().toISOString())} onChange={(e) => setWhen(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

const pill = (on: boolean) => cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50', on ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground');

function Chips({ items, on, toggle }: { items: Array<{ id: string; name: string }> | undefined; on: string[]; toggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(items ?? []).map((i) => (
        <button key={i.id} type="button" aria-pressed={on.includes(i.id)} onClick={() => toggle(i.id)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on.includes(i.id) ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-subtle')}>
          {i.name}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, title, hint, disabled, children }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <div className="py-2">
      <label className={cn('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
        <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted-foreground/30')}>
          <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
        </button>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </label>
      {children && <div className="pl-12">{children}</div>}
    </div>
  );
}
