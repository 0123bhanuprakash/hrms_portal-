'use client';

import React from 'react';
import { cn } from '@/lib/cn';

// ============================================================
// Emoji with its own small move (app/emoji-motion.css). Each plays
// ONCE — on hover, when it first appears, or each time `fire` goes
// up (a click on a reaction, which also floats up 3 small copies).
// "Reduce motion" (Preferences or the device) keeps them still.
// Status dots and symbols (🔴 🟠 🟢 🔵 ⏸ ⚑ ★) are never wrapped:
// they carry meaning and must not move.
// ============================================================

const MOVES: Record<string, string> = {
  '🎉': 'pop', '🎊': 'pop', '🤩': 'pop', '🎆': 'pop', '🎨': 'pop',
  '👋': 'wave',
  '❤️': 'beat', '❤': 'beat', '💛': 'beat', '♥': 'beat', '🩺': 'beat',
  '👏': 'clap',
  '👍': 'bump', '💻': 'bump', '🖥️': 'bump', '📱': 'bump', '🖨️': 'bump',
  '🔥': 'flick',
  '🙌': 'raise', '🕊️': 'raise', '🧑‍💼': 'raise', '🙂': 'raise',
  '🙏': 'bow', '😞': 'bow', '🙁': 'bow',
  '🎂': 'hop', '😐': 'hop', '🐘': 'hop',
  '🏆': 'shine', '🎖️': 'shine', '💰': 'shine', '💸': 'shine', '🏦': 'shine',
  '⭐': 'twinkle', '🌟': 'twinkle', '✨': 'twinkle',
  '🌴': 'sway', '🌿': 'sway', '🎄': 'sway', '🌸': 'sway', '🪁': 'sway', '🏳️': 'sway', '🌙': 'sway',
  '🪔': 'glow', '💡': 'glow',
  '📣': 'shout', '📢': 'shout',
  '📅': 'flip', '🗓️': 'flip', '📄': 'flip', '🧾': 'flip', '🗂️': 'flip',
  '🛠️': 'turn', '🔧': 'turn', '🔑': 'turn', '🧩': 'turn', '🏹': 'turn',
  '⏳': 'hour',
  '🎧': 'waves', '📶': 'waves', '🌤️': 'waves',
  '📘': 'tilt', '🪪': 'tilt', '✉️': 'tilt', '🧮': 'tilt', '🏷️': 'tilt',
  '⚠️': 'pulse', '🔒': 'pulse', '✝️': 'pulse',
  '🚀': 'launch', '☁️': 'launch', '✈️': 'launch', '✈': 'launch',
};

/** The move an emoji makes (unknown emoji: a small pop). */
export const moveOf = (e: string) => MOVES[e] ?? MOVES[e.replace(/️/g, '')] ?? 'pop';

export function Emoji({
  e,
  play = 'hover',
  fire = 0,
  burst = false,
  label,
  className,
}: {
  e: string;
  /** hover: plays when the pointer is on it (or on a parent with `emo-host`); appear: once when shown; none: only on `fire` */
  play?: 'hover' | 'appear' | 'none';
  /** Bump to play again (e.g. on click) */
  fire?: number;
  /** With `fire`: 3 small copies float up */
  burst?: boolean;
  /** Screen readers: say this instead of hiding the emoji */
  label?: string;
  className?: string;
}) {
  // A finished CSS animation doesn't replay when the parent re-renders, so "appear" plays once
  const playing = fire > 0 || play === 'appear';
  return (
    <span className={cn('emo', play === 'hover' && 'emo-hover', className)} data-move={moveOf(e)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span key={fire} className="emo-in" data-play={playing ? '' : undefined}>{e}</span>
      {burst && fire > 0 && (
        <span key={`b${fire}`} className="emo-burst" aria-hidden>
          <i>{e}</i>
          <i>{e}</i>
          <i>{e}</i>
        </span>
      )}
    </span>
  );
}

/** Splits text like "🎂 Birthday today" so the emoji moves and the words don't. */
export function EmojiText({ text, play = 'hover' }: { text: string; play?: 'hover' | 'appear' }) {
  const m = text.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u) ?? text.match(/^(.*?)\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)$/u);
  if (!m) return <>{text}</>;
  const leading = /^\p{Extended_Pictographic}/u.test(text);
  const [emoji, words] = leading ? [m[1]!, m[2]!] : [m[2]!, m[1]!];
  return leading ? <><Emoji e={emoji} play={play} /> {words}</> : <>{words} <Emoji e={emoji} play={play} /></>;
}
