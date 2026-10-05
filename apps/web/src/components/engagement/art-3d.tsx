'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/cn';

// ============================================================
// 3D-style art for announcement covers, drawn as SVG so it looks the
// same on every device (emoji differ between Windows, Mac and phones).
// Soft gradients + a highlight + a contact shadow give the depth.
// ============================================================

export const ART_KEYS = ['megaphone', 'calendar', 'trophy', 'rocket', 'party', 'shield', 'cake', 'heart', 'gift', 'bulb', 'star', 'bell', 'laptop', 'diya', 'handshake', 'book'] as const;
export type ArtKey = (typeof ART_KEYS)[number];
export const ART_LABELS: Record<ArtKey, string> = {
  megaphone: 'Megaphone', calendar: 'Calendar', trophy: 'Trophy', rocket: 'Rocket', party: 'Party', shield: 'Shield', cake: 'Cake', heart: 'Heart',
  gift: 'Gift', bulb: 'Idea', star: 'Star', bell: 'Bell', laptop: 'Laptop', diya: 'Diya', handshake: 'Handshake', book: 'Handbook',
};

type G = (id: string) => string;
/** Linear gradient top-left → bottom-right */
const lin = (id: string, a: string, b: string, c?: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/>${c ? `<stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>` : `<stop offset="1" stop-color="${b}"/>`}</linearGradient>`;
/** Glossy radial: light spot at the top-left */
const rad = (id: string, a: string, b: string, c: string) =>
  `<radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
const shine = (x: number, y: number, rx: number, ry: number, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45" transform="rotate(${rot} ${x} ${y})"/>`;
const floor = (w = 34) => `<ellipse cx="60" cy="108" rx="${w}" ry="5" fill="#000" opacity=".18"/>`;

const PIECES: Record<ArtKey, G> = {
  megaphone: (u) => `<defs>${lin(`${u}a`, '#FED7AA', '#F97316', '#C2410C')}${rad(`${u}b`, '#FFEDD5', '#FB923C', '#EA580C')}</defs>${floor()}
    <path d="M22 50 L80 26 Q88 24 88 32 L88 84 Q88 92 80 90 L22 66 Z" fill="url(#${u}a)"/>
    <ellipse cx="86" cy="58" rx="10" ry="31" fill="url(#${u}b)"/><ellipse cx="86" cy="58" rx="5" ry="20" fill="#9A3412" opacity=".35"/>
    <rect x="12" y="49" width="14" height="18" rx="5" fill="#C2410C"/><path d="M34 66 L40 92 Q41 96 46 95 L52 94 Q55 93 54 89 L48 70 Z" fill="#EA580C"/>${shine(48, 42, 16, 5)}`,
  calendar: (u) => `<defs>${lin(`${u}a`, '#FFFFFF', '#E5E7EB')}${lin(`${u}b`, '#FCA5A5', '#DC2626')}</defs>${floor(36)}
    <rect x="18" y="22" width="84" height="80" rx="16" fill="url(#${u}a)"/><path d="M18 38 Q18 22 34 22 L86 22 Q102 22 102 38 L102 44 L18 44 Z" fill="url(#${u}b)"/>
    <rect x="36" y="14" width="8" height="18" rx="4" fill="#475569"/><rect x="76" y="14" width="8" height="18" rx="4" fill="#475569"/>
    <text x="60" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="36" fill="#1F2937">9</text>${shine(36, 30, 10, 3, -10)}`,
  trophy: (u) => `<defs>${rad(`${u}a`, '#FEF9C3', '#FACC15', '#A16207')}${lin(`${u}b`, '#78350F', '#451A03')}</defs>${floor(30)}
    <path d="M30 18 L90 18 L86 52 Q82 70 60 72 Q38 70 34 52 Z" fill="url(#${u}a)"/>
    <path d="M30 26 Q12 26 16 42 Q20 54 34 54" fill="none" stroke="#EAB308" stroke-width="6"/><path d="M90 26 Q108 26 104 42 Q100 54 86 54" fill="none" stroke="#EAB308" stroke-width="6"/>
    <rect x="53" y="70" width="14" height="16" fill="#CA8A04"/><rect x="38" y="86" width="44" height="16" rx="5" fill="url(#${u}b)"/>${shine(46, 32, 6, 14, -15)}`,
  rocket: (u) => `<defs>${lin(`${u}a`, '#F8FAFC', '#CBD5E1', '#94A3B8')}${rad(`${u}b`, '#BAE6FD', '#38BDF8', '#0369A1')}${lin(`${u}c`, '#FCA5A5', '#DC2626')}${lin(`${u}d`, '#FEF08A', '#F97316')}</defs>${floor(24)}
    <path d="M60 8 Q84 30 80 74 L40 74 Q36 30 60 8 Z" fill="url(#${u}a)"/><circle cx="60" cy="44" r="10" fill="url(#${u}b)" stroke="#64748B" stroke-width="3"/>
    <path d="M40 58 L24 82 L42 76 Z" fill="url(#${u}c)"/><path d="M80 58 L96 82 L78 76 Z" fill="url(#${u}c)"/>
    <path d="M46 74 L74 74 Q70 100 60 104 Q50 100 46 74 Z" fill="url(#${u}d)"/>${shine(52, 30, 4, 14, 10)}`,
  party: (u) => `<defs>${lin(`${u}a`, '#F9A8D4', '#DB2777', '#9D174D')}</defs>${floor(30)}
    <path d="M18 100 L54 30 L88 66 Z" fill="url(#${u}a)"/><path d="M33 72 L64 84 M43 52 L77 72" stroke="#FDE68A" stroke-width="5" stroke-linecap="round" opacity=".9"/>
    <rect x="76" y="20" width="9" height="9" rx="2" fill="#FDE047" transform="rotate(25 80 24)"/><rect x="94" y="40" width="8" height="8" rx="2" fill="#60A5FA" transform="rotate(-20 98 44)"/>
    <circle cx="68" cy="14" r="4" fill="#34D399"/><circle cx="100" cy="24" r="4" fill="#F87171"/><rect x="88" y="62" width="8" height="8" rx="2" fill="#A78BFA" transform="rotate(30 92 66)"/>
    <path d="M62 30 Q70 20 66 10" stroke="#FB7185" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M80 46 Q92 44 96 34" stroke="#22D3EE" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  shield: (u) => `<defs>${lin(`${u}a`, '#A7F3D0', '#10B981', '#047857')}</defs>${floor(30)}
    <path d="M60 10 L98 24 Q98 74 60 104 Q22 74 22 24 Z" fill="url(#${u}a)"/><path d="M60 18 L90 29 Q90 70 60 95" fill="#fff" opacity=".12"/>
    <path d="M42 56 L55 69 L80 43" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>${shine(42, 30, 12, 4, -20)}`,
  cake: (u) => `<defs>${lin(`${u}a`, '#FBCFE8', '#F472B6', '#BE185D')}${lin(`${u}b`, '#FEF3C7', '#FDE68A')}</defs>${floor(36)}
    <rect x="22" y="56" width="76" height="44" rx="12" fill="url(#${u}a)"/><path d="M22 66 Q30 76 38 66 Q46 76 54 66 Q62 76 70 66 Q78 76 86 66 Q94 76 98 66 L98 64 Q98 56 90 56 L30 56 Q22 56 22 64 Z" fill="url(#${u}b)"/>
    <rect x="57" y="32" width="6" height="24" rx="3" fill="#60A5FA"/><path d="M60 16 Q68 26 60 32 Q52 26 60 16 Z" fill="#F59E0B"/><ellipse cx="60" cy="27" rx="2" ry="3" fill="#FEF3C7"/>${shine(40, 80, 10, 3, 0)}`,
  heart: (u) => `<defs>${rad(`${u}a`, '#FECDD3', '#F43F5E', '#9F1239')}</defs>${floor(30)}
    <path d="M60 100 Q14 70 18 42 Q22 18 44 20 Q56 22 60 34 Q64 22 76 20 Q98 18 102 42 Q106 70 60 100 Z" fill="url(#${u}a)"/>${shine(40, 38, 12, 6, -30)}`,
  gift: (u) => `<defs>${lin(`${u}a`, '#C4B5FD', '#8B5CF6', '#5B21B6')}${lin(`${u}b`, '#FDE68A', '#F59E0B')}</defs>${floor(36)}
    <rect x="22" y="50" width="76" height="52" rx="8" fill="url(#${u}a)"/><rect x="16" y="38" width="88" height="18" rx="6" fill="#7C3AED"/>
    <rect x="54" y="38" width="12" height="64" fill="url(#${u}b)"/><path d="M60 38 Q40 14 34 30 Q32 40 60 38 Q88 40 86 30 Q80 14 60 38 Z" fill="url(#${u}b)"/>${shine(34, 64, 8, 3, 0)}`,
  bulb: (u) => `<defs>${rad(`${u}a`, '#FEFCE8', '#FDE047', '#CA8A04')}</defs>${floor(22)}
    <circle cx="60" cy="48" r="32" fill="url(#${u}a)"/><path d="M46 74 L74 74 L72 86 L48 86 Z" fill="#EAB308"/>
    <rect x="46" y="86" width="28" height="8" rx="3" fill="#64748B"/><rect x="48" y="94" width="24" height="8" rx="3" fill="#475569"/>
    <path d="M52 58 Q60 44 68 58" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>${shine(46, 36, 8, 12, -30)}`,
  star: (u) => `<defs>${rad(`${u}a`, '#FEF9C3', '#FACC15', '#B45309')}</defs>${floor(28)}
    <path d="M60 10 L74 42 L108 44 L82 66 L90 100 L60 82 L30 100 L38 66 L12 44 L46 42 Z" fill="url(#${u}a)" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/>${shine(50, 40, 8, 4, -30)}`,
  bell: (u) => `<defs>${rad(`${u}a`, '#FEF3C7', '#FBBF24', '#B45309')}</defs>${floor(30)}
    <path d="M60 14 Q86 16 88 50 L92 78 Q94 86 100 88 L20 88 Q26 86 28 78 L32 50 Q34 16 60 14 Z" fill="url(#${u}a)"/>
    <circle cx="60" cy="96" r="9" fill="#B45309"/><circle cx="60" cy="12" r="5" fill="#D97706"/>${shine(46, 40, 6, 16, -10)}`,
  laptop: (u) => `<defs>${lin(`${u}a`, '#E2E8F0', '#94A3B8')}${lin(`${u}b`, '#6366F1', '#22D3EE')}</defs>${floor(44)}
    <rect x="24" y="22" width="72" height="54" rx="7" fill="#334155"/><rect x="29" y="27" width="62" height="44" rx="3" fill="url(#${u}b)"/>
    <path d="M12 82 L108 82 Q108 96 96 96 L24 96 Q12 96 12 82 Z" fill="url(#${u}a)"/><rect x="50" y="83" width="20" height="4" rx="2" fill="#64748B"/>
    <rect x="36" y="36" width="30" height="5" rx="2" fill="#fff" opacity=".8"/><rect x="36" y="46" width="44" height="5" rx="2" fill="#fff" opacity=".5"/>`,
  diya: (u) => `<defs>${lin(`${u}a`, '#FDBA74', '#EA580C', '#7C2D12')}${rad(`${u}b`, '#FFFBEB', '#FCD34D', '#F97316')}</defs>${floor(38)}
    <path d="M14 64 Q60 60 106 64 Q100 98 60 100 Q20 98 14 64 Z" fill="url(#${u}a)"/><path d="M14 64 Q60 74 106 64" fill="none" stroke="#FDE68A" stroke-width="3"/>
    <path d="M60 20 Q76 42 60 60 Q44 42 60 20 Z" fill="url(#${u}b)"/><ellipse cx="60" cy="50" rx="4" ry="7" fill="#FFFBEB"/>
    <circle cx="36" cy="82" r="3" fill="#FDE68A"/><circle cx="60" cy="86" r="3" fill="#FDE68A"/><circle cx="84" cy="82" r="3" fill="#FDE68A"/>`,
  handshake: (u) => `<defs>${lin(`${u}a`, '#FDE68A', '#F59E0B', '#B45309')}${lin(`${u}b`, '#93C5FD', '#3B82F6', '#1E40AF')}</defs>${floor(40)}
    <rect x="6" y="46" width="22" height="34" rx="6" fill="url(#${u}b)"/><rect x="92" y="46" width="22" height="34" rx="6" fill="#6366F1"/>
    <path d="M26 52 Q48 40 66 46 L86 56 Q94 62 88 68 Q82 72 74 66 L64 60" fill="url(#${u}a)"/>
    <path d="M94 54 Q76 46 60 52 L36 70 Q30 78 38 82 Q44 84 50 78 Q56 86 64 82 Q70 86 76 80 Q84 82 86 74 Z" fill="url(#${u}a)" stroke="#B45309" stroke-width="1.5" opacity=".95"/>${shine(52, 56, 10, 3, -20)}`,
  book: (u) => `<defs>${lin(`${u}a`, '#A5B4FC', '#6366F1', '#3730A3')}</defs>${floor(36)}
    <path d="M60 30 Q40 18 16 22 L16 92 Q40 88 60 100 Z" fill="url(#${u}a)"/><path d="M60 30 Q80 18 104 22 L104 92 Q80 88 60 100 Z" fill="#4F46E5"/>
    <path d="M22 30 Q40 26 56 36 L56 90 Q40 82 22 84 Z" fill="#fff"/><path d="M98 30 Q80 26 64 36 L64 90 Q80 82 98 84 Z" fill="#F1F5F9"/>
    <path d="M28 44 L50 48 M28 54 L50 58 M28 64 L46 67 M70 48 L92 44 M70 58 L92 54" stroke="#CBD5E1" stroke-width="3" stroke-linecap="round"/>`,
};

/** One piece of 3D art. `float` adds the gentle bob (paused for reduced motion). */
export function Art3D({ name, className, float = true }: { name: string; className?: string; float?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const piece = PIECES[name as ArtKey];
  if (!piece) return null;
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn('drop-shadow-[0_14px_14px_rgba(0,0,0,0.25)]', float && 'motion-safe:animate-[a3-float_4.5s_ease-in-out_infinite]', className)} dangerouslySetInnerHTML={{ __html: piece(`a${uid}`) }} />
  );
}

/** Which art suits a post (used when the poster hasn't picked any). */
export function suggestArt(category: string, title: string): ArtKey {
  const t = title.toLowerCase();
  if (/diwali|deepavali|diya/.test(t)) return 'diya';
  if (/birthday|cake/.test(t)) return 'cake';
  if (/launch|release|ship|go.?live/.test(t)) return 'rocket';
  if (/award|winner|\bwins?\b|record|milestone|\d[\d,]*\s*(customers|users|clients|downloads|orders)/.test(t)) return 'trophy';
  if (/welcome|joins|joined|hello/.test(t)) return 'handshake';
  if (/laptop|it |vpn|wifi|wi-fi|system|maintenance/.test(t)) return 'laptop';
  if (/security|policy|compliance|safety/.test(t)) return 'shield';
  if (/idea|hackathon|innovation/.test(t)) return 'bulb';
  if (/gift|bonus|reward/.test(t)) return 'gift';
  if (/handbook|guide|training|learning/.test(t)) return 'book';
  return ({ policy: 'shield', event: 'calendar', celebrate: 'party', urgent: 'bell', update: 'megaphone' } as Record<string, ArtKey>)[category] ?? 'megaphone';
}
