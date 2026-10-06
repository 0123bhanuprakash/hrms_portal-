'use client';

import React, { useRef, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import { toast } from 'sonner';
import { Box, Film, ImageIcon, Move, Palette, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnnouncementInput, Cover } from '@/lib/company/engagement';
import { cn } from '@/lib/cn';
import { ART_KEYS, ART_LABELS, Art3D, suggestArt } from './art-3d';
import { CATEGORIES, COVERS } from './announcement-ui';
import { AnnouncementCover, CoverScene, SCENES, SCENE_BG, SCENE_LABELS, type Scene } from './cover';

export interface CoverMedia {
  url: string;
  kind: 'image' | 'video' | 'lottie';
  name?: string;
}

type CoverFields = Pick<AnnouncementInput, 'cover' | 'coverEmoji' | 'coverScene' | 'coverArt' | 'coverMotion' | 'coverFocusX' | 'coverFocusY' | 'coverDim' | 'category' | 'title'>;
const EMOJIS = ['📣', '📘', '🎉', '📅', '⚠️', '🪔', '🏆', '💡', '🛠️', '🌿', '🎂', '👋'];
const COVER_KEYS = Object.keys(COVERS) as Cover[];
const MAX_BYTES = 5 * 1024 * 1024;
type Tab = 'colours' | 'scenes' | 'art' | 'upload';

/** What kind of cover a picked file is (the API checks the content again). */
function kindOf(file: File): CoverMedia['kind'] | null {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return 'image';
  if (/^video\/(mp4|webm)$/.test(file.type)) return 'video';
  if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) return 'lottie';
  return null;
}

/** Suggestions from the type, the date and the title's words. */
function suggestions(f: CoverFields): Array<{ label: string; patch: Partial<CoverFields> }> {
  const t = f.title.toLowerCase();
  const month = new Date().getMonth();
  const out: Array<{ label: string; patch: Partial<CoverFields> }> = [];
  if (/diwali|deepavali|diya/.test(t) || (month === 9 || month === 10) && f.category === 'celebrate') out.push({ label: 'Diwali', patch: { coverScene: 'diyas', coverArt: 'diya', cover: null } });
  if (/launch|release|go.?live|ship/.test(t)) out.push({ label: 'Launch', patch: { coverScene: 'sparkles', coverArt: 'rocket', cover: null } });
  if (/christmas|winter|holiday/.test(t) || month === 11) out.push({ label: 'Winter', patch: { coverScene: 'snow', coverArt: 'gift', cover: null } });
  if (/birthday|anniversary/.test(t)) out.push({ label: 'Birthday', patch: { coverScene: 'balloons', coverArt: 'cake', cover: null } });
  if (/new year|award|record|milestone|win/.test(t)) out.push({ label: 'Big win', patch: { coverScene: 'fireworks', coverArt: 'trophy', cover: null } });
  if (f.category === 'celebrate') out.push({ label: 'Party', patch: { coverScene: 'confetti', coverArt: 'party', cover: null } });
  if (f.category === 'policy') out.push({ label: 'Policy', patch: { coverScene: null, coverArt: 'shield', cover: 'indigo' } });
  if (f.category === 'event') out.push({ label: 'Event', patch: { coverScene: 'sparkles', coverArt: 'calendar', cover: null } });
  if (f.category === 'urgent') out.push({ label: 'Heads-up', patch: { coverScene: null, coverArt: 'bell', cover: 'sunset' } });
  if (/monsoon|rain/.test(t)) out.push({ label: 'Monsoon', patch: { coverScene: 'rain', coverArt: null, cover: null } });
  out.push({ label: 'Calm', patch: { coverScene: 'aurora', coverArt: suggestArt(f.category, f.title), cover: null } });
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.label) ? false : (seen.add(s.label), true))).slice(0, 4);
}

export function CoverPicker({
  value,
  onChange,
  media,
  onFile,
  onRemoveMedia,
}: {
  value: CoverFields;
  onChange: (patch: Partial<CoverFields>) => void;
  media: CoverMedia | null;
  onFile: (file: File, kind: CoverMedia['kind']) => void;
  onRemoveMedia: () => void;
}) {
  const [tab, setTab] = useState<Tab>(media ? 'upload' : value.coverScene ? 'scenes' : value.coverArt ? 'art' : 'colours');
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const preview = { ...value, coverMediaUrl: media?.url ?? null, coverMediaKind: media?.kind ?? null } as Parameters<typeof AnnouncementCover>[0]['a'];

  const take = (file: File | undefined) => {
    if (!file) return;
    const kind = kindOf(file);
    if (!kind) return void toast.error('Use a JPG, PNG, WebP or GIF image, an MP4 / WebM video, or a Lottie (.json) animation');
    if (file.size > (kind === 'lottie' ? 1024 * 1024 : MAX_BYTES)) return void toast.error(kind === 'lottie' ? 'Lottie files must be 1 MB or smaller' : 'Covers must be 5 MB or smaller');
    if (kind === 'video') {
      // Short clips only: check the length before accepting
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (v.duration > 10.5) toast.error('Videos can be up to 10 seconds — they loop on the cover');
        else onFile(file, kind);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error('That video can’t be played here');
      };
      v.src = url;
      return;
    }
    onFile(file, kind);
  };

  const setFocus = (e: React.PointerEvent) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    onChange({ coverFocusX: Math.round(Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100))), coverFocusY: Math.round(Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100))) });
  };

  const tabBtn = (id: Tab, label: string, icon: React.ReactNode) => (
    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors [&_svg]:size-3.5', tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
      {icon} {label}
    </button>
  );
  const tile = (on: boolean) => cn('overflow-hidden rounded-xl border-[1.5px] text-left transition-all', on ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]' : 'border-border hover:border-foreground/20');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium">Cover</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Wand2 className="h-3.5 w-3.5" /> Suggested:</span>
        {suggestions(value).map((s) => (
          <button key={s.label} type="button" onClick={() => { onChange(s.patch); setTab(s.patch.coverScene ? 'scenes' : 'art'); }} className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium hover:bg-subtle">{s.label}</button>
        ))}
      </div>
      <div className="flex border-b border-border" role="tablist">
        {tabBtn('colours', 'Colours', <Palette />)}
        {tabBtn('scenes', 'Animated scenes', <Sparkles />)}
        {tabBtn('art', '3D art', <Box />)}
        {tabBtn('upload', 'Upload', <Upload />)}
      </div>

      {tab === 'colours' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {COVER_KEYS.map((k) => {
              const on = !value.coverScene && (value.cover ?? CATEGORIES[value.category].cover) === k;
              return <button key={k} type="button" aria-label={`Colour ${k}`} aria-pressed={on} onClick={() => onChange({ cover: k, coverScene: null })} className={cn('h-10 w-16 rounded-lg bg-gradient-to-br transition-shadow', COVERS[k], on && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')} />;
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">Or an emoji instead of 3D art:</span>
            {EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={value.coverEmoji === e && !value.coverArt} onClick={() => onChange({ coverEmoji: e, coverArt: null })} className={cn('emo-host flex h-8 w-8 items-center justify-center rounded-lg text-lg', value.coverEmoji === e && !value.coverArt ? 'bg-primary-soft ring-1 ring-primary/40' : 'hover:bg-subtle')}><Emoji e={e} /></button>
            ))}
          </div>
        </div>
      )}

      {tab === 'scenes' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" onClick={() => onChange({ coverScene: null })} className={tile(!value.coverScene)}>
            <span className={cn('flex h-16 items-center justify-center bg-gradient-to-br text-xs font-semibold text-white', COVERS[value.cover ?? CATEGORIES[value.category].cover])}>No scene</span>
            <span className="block px-2 py-1.5 text-xs font-semibold">None</span>
          </button>
          {SCENES.map((s) => (
            <button key={s} type="button" onClick={() => onChange({ coverScene: s, cover: null })} className={tile(value.coverScene === s)}>
              <span className={cn('relative block h-16 overflow-hidden bg-gradient-to-br', SCENE_BG[s])}><CoverScene scene={s as Scene} size="tile" /></span>
              <span className="block px-2 py-1.5 text-xs font-semibold">{SCENE_LABELS[s as Scene]}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'art' && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          <button type="button" onClick={() => onChange({ coverArt: null })} className={cn(tile(!value.coverArt), 'flex flex-col items-center justify-center gap-1 py-2')}>
            <span className="flex h-12 w-12 items-center justify-center text-xs text-muted-foreground">Auto</span>
            <span className="text-[11px] font-semibold">Suggested</span>
          </button>
          {ART_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => onChange({ coverArt: k, coverEmoji: null })} className={cn(tile(value.coverArt === k), 'flex flex-col items-center gap-1 bg-subtle/50 py-2')} title={ART_LABELS[k]}>
              <Art3D name={k} float={value.coverArt === k} className="h-12 w-12" />
              <span className="text-[11px] font-semibold">{ART_LABELS[k]}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'upload' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); take(e.dataTransfer.files[0]); }}
            className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors', dragOver ? 'border-primary bg-primary-soft/40' : 'border-border')}
          >
            <span className="flex gap-2 text-muted-foreground"><ImageIcon className="h-5 w-5" /><Film className="h-5 w-5" /><Sparkles className="h-5 w-5" /></span>
            <p className="text-sm font-semibold">Drop an image or a short animation</p>
            <p className="text-xs text-muted-foreground">JPG · PNG · WebP · GIF · MP4 / WebM up to 10 s · Lottie (.json)<br />5 MB max (Lottie 1 MB) · videos play muted and loop</p>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}><Upload /> Choose file</Button>
          </div>
          {media ? (
            <div className="space-y-2">
              <div ref={frame} className="relative h-36 cursor-crosshair overflow-hidden rounded-xl" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFocus(e); }} onPointerMove={(e) => e.buttons === 1 && setFocus(e)}>
                <AnnouncementCover a={preview} size="banner" className="absolute inset-0" />
                {media.kind !== 'lottie' && <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_3px_rgba(0,0,0,.3)]" style={{ left: `${value.coverFocusX}%`, top: `${value.coverFocusY}%` }} />}
                <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{media.kind === 'video' ? '▶ video · loops' : media.kind === 'lottie' ? '✦ Lottie' : 'image'}{media.name ? ` · ${media.name}` : ''}</span>
              </div>
              {media.kind !== 'lottie' && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Move className="h-3.5 w-3.5" /> Click or drag on the picture to keep that part in frame on phones</p>}
              <label className="flex items-center gap-3 text-xs">
                <span className="shrink-0">Darken for readable text</span>
                <input type="range" min={0} max={70} step={5} value={value.coverDim} onChange={(e) => onChange({ coverDim: Number(e.target.value) })} className="w-full accent-[hsl(var(--primary))]" aria-label="Darken" />
                <span className="w-9 tabular-nums text-muted-foreground">{value.coverDim}%</span>
              </label>
              <Button size="sm" variant="ghost" onClick={onRemoveMedia}><Trash2 /> Remove upload</Button>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl bg-subtle p-4 text-center text-xs text-muted-foreground">Your upload shows here. 3D art and scenes can sit on top of it — or keep it clean.</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="text-xs font-medium">Motion</span>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="radiogroup" aria-label="Motion">
          {(['off', 'gentle', 'lively'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={value.coverMotion === m} onClick={() => onChange({ coverMotion: m })} className={cn('h-7 rounded-md px-3 text-xs font-semibold capitalize', value.coverMotion === m ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>{m}</button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{value.coverMotion === 'lively' ? 'Plus a one-time burst when someone opens the post.' : value.coverMotion === 'off' ? 'A still cover.' : 'Scenes and art move softly.'} People who prefer less motion always see it still.</span>
      </div>
    </div>
  );
}
