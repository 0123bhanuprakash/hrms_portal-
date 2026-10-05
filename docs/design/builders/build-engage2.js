// Announcements, round 2: animated / 3D / uploaded covers, a fuller employee feed, an immersive post.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { sidebar: reportsSidebar, C } = require('./build-reports.js');
const { css: peopleCss, photo } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  chevl: '<path d="m15 18-6-6 6-6"/>',
  chevr: '<path d="m9 18 6-6-6-6"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  wand: '<path d="m15 4-1 1M19 8l1-1M18 4l2-2M4 20 14 10M14 4l6 6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  stories: '<circle cx="12" cy="12" r="10" stroke-dasharray="4 3"/><path d="m10 8 6 4-6 4z"/>',
});

const sidebar = (on) => reportsSidebar().replace('class="sb-i on"', 'class="sb-i"').replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;

// ─── 3D-ish art drawn with CSS (stand-ins for a bundled 3D set) ─────
const art = {
  megaphone: (s = 1) => `<div class="a3" style="--s:${s}"><div style="position:absolute;left:18%;top:30%;width:52%;height:40%;background:linear-gradient(160deg,#FDBA74,#F97316 60%,#C2410C);clip-path:polygon(0 30%,100% 0,100% 100%,0 70%);border-radius:8px;box-shadow:inset -6px -8px 14px rgba(0,0,0,.18)"></div><div style="position:absolute;left:66%;top:22%;width:16%;height:56%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FED7AA,#EA580C 70%);box-shadow:0 6px 14px rgba(194,65,12,.45)"></div><div style="position:absolute;left:8%;top:40%;width:14%;height:20%;border-radius:6px;background:linear-gradient(#FB923C,#C2410C)"></div></div>`,
  calendar: (s = 1) => `<div class="a3" style="--s:${s}"><div style="position:absolute;inset:16% 14% 10%;border-radius:16px;background:linear-gradient(170deg,#fff,#E5E7EB);box-shadow:0 14px 24px -8px rgba(0,0,0,.35),inset 0 -6px 10px rgba(0,0,0,.06)"></div><div style="position:absolute;left:14%;right:14%;top:16%;height:24%;border-radius:16px 16px 0 0;background:linear-gradient(#F87171,#DC2626)"></div><div style="position:absolute;left:0;right:0;top:46%;text-align:center;font:800 calc(30px*var(--s)) system-ui;color:#111827">9</div></div>`,
  trophy: (s = 1) => `<div class="a3" style="--s:${s}"><div style="position:absolute;left:24%;top:12%;width:52%;height:44%;border-radius:0 0 40% 40%;background:radial-gradient(circle at 35% 25%,#FEF08A,#EAB308 55%,#A16207);box-shadow:inset -6px -8px 12px rgba(0,0,0,.2)"></div><div style="position:absolute;left:44%;top:55%;width:12%;height:18%;background:linear-gradient(90deg,#CA8A04,#FDE047,#CA8A04)"></div><div style="position:absolute;left:30%;top:72%;width:40%;height:14%;border-radius:6px;background:linear-gradient(#78350F,#451A03)"></div></div>`,
  rocket: (s = 1) => `<div class="a3" style="--s:${s}"><div style="position:absolute;left:36%;top:8%;width:28%;height:62%;border-radius:50% 50% 30% 30%;background:linear-gradient(90deg,#CBD5E1,#fff 40%,#94A3B8);box-shadow:inset -4px -6px 10px rgba(0,0,0,.15)"></div><div style="position:absolute;left:44%;top:26%;width:12%;height:12%;border-radius:50%;background:radial-gradient(circle at 35% 35%,#7DD3FC,#0369A1)"></div><div style="position:absolute;left:28%;top:52%;width:44%;height:20%;background:linear-gradient(#EF4444,#991B1B);clip-path:polygon(0 100%,25% 0,75% 0,100% 100%)"></div><div style="position:absolute;left:42%;top:72%;width:16%;height:20%;border-radius:0 0 50% 50%;background:linear-gradient(#FDE047,#F97316,transparent)"></div></div>`,
  party: (s = 1) => `<div class="a3" style="--s:${s}"><div style="position:absolute;left:16%;top:34%;width:46%;height:54%;background:linear-gradient(135deg,#F472B6,#DB2777 60%,#9D174D);clip-path:polygon(0 100%,100% 0,100% 30%,30% 100%);"></div>${['#FDE047:62%:16%', '#60A5FA:76%:30%', '#34D399:56%:6%', '#F87171:84%:12%', '#A78BFA:70%:44%'].map((x) => { const [c, l, t] = x.split(':'); return `<span style="position:absolute;left:${l};top:${t};width:9%;height:9%;border-radius:3px;background:${c};transform:rotate(25deg)"></span>`; }).join('')}</div>`,
  shield: (s = 1) => `<div class="a3" style="--s:${s}"><div style="position:absolute;left:22%;top:10%;width:56%;height:76%;background:linear-gradient(150deg,#6EE7B7,#10B981 55%,#047857);clip-path:polygon(50% 0,100% 18%,92% 64%,50% 100%,8% 64%,0 18%);box-shadow:inset -6px -8px 12px rgba(0,0,0,.2)"></div><div style="position:absolute;left:0;right:0;top:34%;text-align:center;color:#fff;font:900 calc(26px*var(--s)) system-ui">✓</div></div>`,
};

const css = peopleCss.replace('</style>', `
.a3{position:relative;width:calc(110px*var(--s));height:calc(110px*var(--s));filter:drop-shadow(0 18px 18px rgba(0,0,0,.28));animation:float 4s ease-in-out infinite}
@keyframes float{50%{transform:translateY(-8px) rotate(-3deg)}}
.scene{position:relative;overflow:hidden;border-radius:14px}
.cf{position:absolute;width:7px;height:11px;border-radius:2px;animation:fall 3.4s linear infinite}
@keyframes fall{from{transform:translateY(-30px) rotate(0)}to{transform:translateY(240px) rotate(540deg)}}
.diya{position:absolute;bottom:14px;width:26px;height:12px;border-radius:0 0 14px 14px;background:linear-gradient(#F59E0B,#B45309)}
.diya::after{content:"";position:absolute;left:9px;top:-13px;width:8px;height:14px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:radial-gradient(circle at 50% 70%,#FEF3C7,#F59E0B 60%,transparent 70%);animation:flick .5s ease-in-out infinite alternate}
@keyframes flick{to{transform:scaleY(1.25) rotate(4deg)}}
.spark{position:absolute;width:4px;height:4px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff;animation:tw 2s ease-in-out infinite}
@keyframes tw{50%{opacity:.15}}
.aurora{position:absolute;inset:-40%;background:conic-gradient(from 0deg,#4F46E5,#06B6D4,#22C55E,#A855F7,#4F46E5);filter:blur(30px);animation:spin 12s linear infinite;opacity:.9}
@keyframes spin{to{transform:rotate(360deg)}}
.tabs2{display:flex;gap:4px;border-bottom:1px solid ${C.line}}.tabs2 span{padding:8px 12px;font-size:12.5px;font-weight:700;color:${C.muted}}.tabs2 span.on{color:${C.fg};box-shadow:inset 0 -2px 0 ${C.pri}}
.tile{border-radius:12px;border:1.5px solid ${C.border};overflow:hidden;display:flex;flex-direction:column}.tile.on{border-color:${C.pri};box-shadow:0 0 0 3px ${C.priSoft}}
.tile .t{height:74px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.tile .l{font-size:11.5px;font-weight:700;padding:6px 8px;display:flex;justify-content:space-between}
.ring{width:84px;height:84px;border-radius:50%;background:conic-gradient(${C.pri} 0 62%,${C.line} 0);display:flex;align-items:center;justify-content:center}.ring div{width:66px;height:66px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}
.story{width:62px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;font-weight:700;text-align:center}
.story .o{width:58px;height:58px;border-radius:50%;padding:3px;background:conic-gradient(#F59E0B,#EC4899,#6366F1,#F59E0B)}.story .o.seen{background:${C.line}}
.story .o div{width:100%;height:100%;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:22px}
.grp{font-size:11px;font-weight:800;letter-spacing:.08em;color:${C.muted};text-transform:uppercase;padding:10px 4px 2px}
.ev{display:flex;gap:12px;padding:14px;border-radius:14px;border:1px solid ${C.border};background:#fff}
.reac{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid ${C.border};background:#fff}
.reac.on{background:${C.priSoft};border-color:#C7C9F7;color:${C.priText}}
.burst{position:absolute;font-size:16px;animation:pop 1.6s ease-out infinite}
@keyframes pop{0%{opacity:0;transform:translateY(0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translateY(-46px) scale(1.2)}}
.prog{position:absolute;top:0;left:0;height:3px;background:linear-gradient(90deg,${C.pri},#EC4899);border-radius:0 3px 3px 0}
.dots span{display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.45);margin-right:5px}.dots span.on{width:20px;border-radius:99px;background:#fff}
</style>`);

const confetti = (n = 18) => Array.from({ length: n }, (_, i) => `<span class="cf" style="left:${(i * 53) % 100}%;top:${-10 - (i % 5) * 12}px;background:${['#FDE047', '#F472B6', '#60A5FA', '#34D399', '#F97316', '#A78BFA'][i % 6]};animation-delay:${(i % 7) * 0.4}s"></span>`).join('');
const sparks = (n = 14) => Array.from({ length: n }, (_, i) => `<span class="spark" style="left:${(i * 37) % 96}%;top:${(i * 23) % 90}%;animation-delay:${(i % 5) * 0.35}s"></span>`).join('');
const diyas = (n = 5) => Array.from({ length: n }, (_, i) => `<span class="diya" style="left:${10 + i * 19}%"></span>`).join('');

// ─── Board 1: cover picker ──────────────────────────────────
function covers() {
  const scenes = [
    ['Confetti', 'linear-gradient(135deg,#7C3AED,#EC4899)', confetti(12), true],
    ['Diyas', 'linear-gradient(180deg,#1E1B4B,#7C2D12)', diyas(4) + sparks(6)],
    ['Sparkles', 'linear-gradient(135deg,#0F172A,#4338CA)', sparks(16)],
    ['Aurora', '#111827', '<div class="aurora"></div>'],
    ['Snow', 'linear-gradient(180deg,#1E3A8A,#60A5FA)', Array.from({ length: 12 }, (_, i) => `<span class="cf" style="left:${(i * 31) % 100}%;width:6px;height:6px;border-radius:50%;background:#fff;animation-duration:${4 + (i % 3)}s;animation-delay:${i * 0.3}s"></span>`).join('')],
    ['Balloons', 'linear-gradient(180deg,#FDF2F8,#FBCFE8)', ['#F472B6', '#60A5FA', '#FBBF24'].map((c, i) => `<span style="position:absolute;left:${22 + i * 22}%;bottom:-10px;width:22px;height:28px;border-radius:50%;background:${c};animation:float ${3 + i}s ease-in-out infinite"></span>`).join('')],
  ];
  const arts = [['Megaphone', art.megaphone(0.62), '#EEF2FF'], ['Calendar', art.calendar(0.62), '#ECFEFF'], ['Trophy', art.trophy(0.62), '#FEFCE8'], ['Rocket', art.rocket(0.62), '#EFF6FF'], ['Party', art.party(0.62), '#FDF2F8'], ['Shield', art.shield(0.62), '#ECFDF5']];
  const html = `<div class="app">${sidebar('Announcements')}<div class="col">${header('Engagement &nbsp;›&nbsp; Announcements &nbsp;›&nbsp; <b>New</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Engagement</div><h1>Cover</h1><div class="sub">Colours, animated scenes, 3D art — or your own image or short animation</div></div><span class="btn">Save draft</span><span class="btn pri">Publish to 23 people</span></div>
<div class="g21" style="grid-template-columns:1fr 360px">
  <div class="card sec" style="gap:14px">
    <div class="tabs2"><span>Colours</span><span class="on">${icon('sparkle', 13)} Animated scenes</span><span>3D art</span><span>${icon('upload', 13)} Upload</span></div>
    <div class="xs mut">Scenes move gently and stop for anyone who prefers less motion.</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${scenes.map(([n, bg, inner, on]) => `<div class="tile ${on ? 'on' : ''}"><div class="t scene" style="background:${bg}">${inner}</div><div class="l"><span>${n}</span>${on ? `<span style="color:${C.pri}">✓</span>` : ''}</div></div>`).join('')}</div>
    <div class="tabs2" style="margin-top:6px"><span class="on">3D art</span><span class="mut" style="margin-left:auto;font-weight:500">floats on the cover · 40+ pieces</span></div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">${arts.map(([n, a, bg], i) => `<div class="tile ${i === 4 ? 'on' : ''}"><div class="t" style="background:${bg};height:84px">${a}</div><div class="l"><span>${n}</span></div></div>`).join('')}</div>
    <div class="tabs2" style="margin-top:6px"><span class="on">${icon('upload', 13)} Upload</span></div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px">
      <div style="border:2px dashed ${C.border};border-radius:14px;padding:20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">${icon('upload', 22)}<b style="font-size:13.5px">Drop an image or a short animation</b><span class="xs mut">JPG · PNG · WebP · GIF · MP4/WebM up to 8 s · Lottie (.json)<br>max 5 MB · videos play muted and loop</span><span class="btn sm">Choose file</span></div>
      <div class="card" style="overflow:hidden">
        <div style="height:120px;position:relative;background:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 200%22><defs><linearGradient id=%22g%22 x1=%220%22 x2=%221%22><stop stop-color=%22%230EA5E9%22/><stop offset=%221%22 stop-color=%22%236366F1%22/></linearGradient></defs><rect width=%22400%22 height=%22200%22 fill=%22url(%23g)%22/><circle cx=%22300%22 cy=%2270%22 r=%2240%22 fill=%22%23FDE68A%22/><path d=%22M0 170 L120 90 L220 160 L300 110 L400 170 V200 H0Z%22 fill=%22%231E3A8A%22/></svg>') center/cover">
          <span style="position:absolute;left:58%;top:38%;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(0,0,0,.25)"></span>
          <span class="pill" style="position:absolute;left:8px;top:8px;background:rgba(17,24,39,.7);color:#fff">${icon('play', 10)} 0:06 loop</span>
        </div>
        <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px">
          <div class="row xs" style="gap:6px">${icon('move', 13)}<b>Drag the dot</b><span class="mut">to keep faces in frame on phones</span></div>
          <div class="row xs" style="gap:8px"><span>Darken for readable text</span><div class="bar" style="flex:1;height:6px"><i style="width:40%;background:${C.pri}"></i></div></div>
        </div>
      </div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="xs mut" style="font-weight:800;letter-spacing:.06em">LIVE PREVIEW</div>
    <div class="scene" style="height:200px;background:linear-gradient(135deg,#7C3AED,#EC4899);color:#fff;padding:18px;display:flex;flex-direction:column;justify-content:flex-end">
      ${confetti(22)}
      <div style="position:absolute;right:14px;top:10px">${art.party(0.95)}</div>
      <div style="position:relative;display:flex;flex-direction:column;gap:6px"><span class="pill" style="background:rgba(255,255,255,.2);color:#fff;align-self:flex-start">🎉 Celebration</span><b style="font-size:19px">We hit 1,000 customers!</b><span class="xs" style="opacity:.9">Cake in the cafeteria at 4 pm</span></div>
    </div>
    <div class="card sec" style="gap:8px"><h3>${icon('sliders', 15)}Motion</h3>
      <div class="seg"><span>Off</span><span class="on">Gentle</span><span>Lively</span></div>
      <div class="xs mut">Lively plays a one-time burst when someone opens the post. People with “reduce motion” on always see a still cover.</div></div>
    <div class="card sec" style="gap:8px"><h3>${icon('wand', 15)}Suggested for “Celebration”</h3>
      <div class="row" style="gap:8px">${['linear-gradient(135deg,#7C3AED,#EC4899)', 'linear-gradient(180deg,#FDF2F8,#FBCFE8)', 'linear-gradient(135deg,#0F172A,#4338CA)'].map((g) => `<span style="flex:1;height:44px;border-radius:9px;background:${g}"></span>`).join('')}</div>
      <div class="xs mut">Type, date and words pick a match (Diwali → diyas, “launch” → rocket).</div></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Announcement covers', css, html, 1180);
}

// ─── Board 2: fuller employee feed ──────────────────────────
function feed() {
  const story = (e, l, seen, bg) => `<div class="story"><div class="o ${seen ? 'seen' : ''}"><div style="background:${bg}">${e}</div></div><span>${l}</span></div>`;
  const html = `<div class="app">${sidebar('Announcements')}<div class="col">${header('Engagement &nbsp;›&nbsp; <b>Announcements</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Engagement</div><h1>Good morning, Aadhya 👋</h1><div class="sub">42 updates since you last looked — 1 needs your confirmation</div></div><span class="btn">${icon('check2', 14)} Mark all read</span></div>
<div class="g21" style="grid-template-columns:1fr 320px">
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:14px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:72px"><span style="width:52px;height:52px;border-radius:50%;background:${C.pri};color:#fff;display:flex;align-items:center;justify-content:center">${icon('play', 18)}</span><b class="xs">Catch up</b><span class="xs mut" style="font-size:10px">3 min</span></div>
      <span style="width:1px;height:60px;background:${C.line}"></span>
      ${story('🎉', 'Celebration', false, '#FDE8F1')}${story('📘', 'Policy', false, '#EEF0FF')}${story('📅', 'Diwali', false, '#E1F5F2')}${story('⚠️', 'VPN', false, '#FEE2E2')}${story('👋', 'New joiners', true, '#FEF3C7')}${story('🏆', 'Q3 wins', true, '#FEF9C3')}
    </div>
    <div class="scene" style="height:230px;background:linear-gradient(135deg,#F59E0B,#EA580C 45%,#DB2777);color:#fff;padding:22px 24px;display:flex;flex-direction:column;justify-content:flex-end">
      ${confetti(16)}
      <div style="position:absolute;right:30px;top:18px">${art.party(1.15)}</div>
      <div style="position:relative;display:flex;flex-direction:column;gap:8px;max-width:520px">
        <div class="row" style="gap:6px"><span class="pill" style="background:rgba(255,255,255,.22);color:#fff">${icon('pin', 11)} Pinned</span><span class="pill" style="background:rgba(255,255,255,.22);color:#fff">🎉 Celebration</span></div>
        <b style="font-size:26px;line-height:1.15">We hit 1,000 customers!</b><span style="font-size:13.5px;opacity:.92">Cake and a team photo in the cafeteria, 4 pm Friday.</span>
        <div class="row" style="gap:10px"><span class="btn sm" style="background:#fff;border:0">✓ I’ll be there · 34</span><div class="stack">${[0, 1, 3, 4].map((i) => photo(i, 24, 24, { round: true })).join('')}</div><span class="xs" style="opacity:.9">+30 going</span></div>
      </div>
      <div class="dots" style="position:absolute;right:22px;bottom:18px"><span class="on"></span><span></span><span></span></div>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip on">All</span><span class="chip">Unread · 42</span><span class="chip">To confirm · 1</span><span class="chip">📘 Policy</span><span class="chip">📅 Event</span><span class="chip">🎉 Celebration</span><span class="chip">⚠️ Urgent</span><div class="search" style="height:34px;flex:0 0 180px;margin-left:auto;font-size:12.5px">${icon('search', 13)} Search</div></div>
    <div class="grp">Today</div>
    <div class="ev" style="border-left:4px solid ${C.bad};position:relative;overflow:hidden">
      <span style="width:46px;height:46px;border-radius:12px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;animation:tw 1.6s infinite">⚠️</span>
      <div style="flex:1"><div class="row" style="gap:6px"><span class="pill p-bad">Urgent</span><span class="xs mut">IT · Rohit Singh · 20 min ago</span></div><b style="font-size:14.5px;display:block;margin-top:4px">VPN maintenance tonight 11 pm – 1 am</b><span class="xs mut">Save your work before 11. Office Wi-Fi is not affected.</span></div>
      <span class="dot" style="width:8px;height:8px;border-radius:50%;background:${C.pri};box-shadow:0 0 0 0 rgba(79,70,229,.5);animation:tw 1.4s infinite"></span>
    </div>
    <div class="ev" style="align-items:center">
      <div style="width:56px;border-radius:12px;border:1px solid ${C.border};text-align:center;padding:4px 0;flex:none"><div class="xs" style="color:${C.bad};font-weight:800;font-size:10px">FRI</div><b style="font-size:22px">9</b><div class="xs mut" style="font-size:10px">4 pm</div></div>
      <div style="flex:1"><div class="row" style="gap:6px"><span class="pill" style="background:#E1F5F2;color:#0D9488">📅 Event</span><span class="xs mut">Hema Iyer · 2 h ago</span></div><b style="font-size:14.5px;display:block;margin-top:4px">Diwali celebration — cafeteria</b>
        <div class="row xs mut" style="gap:8px;margin-top:6px"><div class="stack">${[2, 5, 6, 7, 8].map((i) => photo(i, 22, 22, { round: true })).join('')}</div>34 going · in 4 days</div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="btn sm pri">✓ Going</span><span class="btn sm">${icon('cal', 12)} Add to calendar</span></div>
    </div>
    <div class="grp">This week</div>
    <div class="ev">
      <span style="width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#4F46E5,#7C3AED);display:flex;align-items:center;justify-content:center;flex:none;position:relative">${art.shield(0.5)}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px"><div class="row" style="gap:6px"><span class="pill p-pri">📘 Policy</span><span class="pill p-warn">Confirm by 20 Oct</span><span class="xs mut row" style="gap:3px">${icon('clip', 12)} policy.pdf</span></div><b style="font-size:14.5px">Updated leave policy for 2027</b>
        <div class="row xs" style="gap:8px"><div class="bar" style="width:140px;height:6px"><i style="width:61%;background:${C.ok}"></i></div><span class="mut">61% of the company confirmed</span></div></div>
      <span class="btn pri sm" style="align-self:center">Read &amp; confirm</span>
    </div>
    <div class="ev" style="position:relative">
      <span style="width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#EC4899,#F472B6);display:flex;align-items:center;justify-content:center;flex:none">👋</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px"><div class="row" style="gap:6px"><span class="pill" style="background:#FDE8F1;color:#DB2777">🎉 Welcome</span><span class="xs mut">Vikram Rao · Mon</span></div><b style="font-size:14.5px">Say hello to Farah, Dev and Ishita</b>
        <div class="row" style="gap:8px">${[[9, 'Farah'], [11, 'Dev'], [3, 'Ishita']].map(([i, n]) => `<span class="tag" style="padding:2px 8px 2px 2px">${photo(i, 20, 20, { round: true })} ${n}</span>`).join('')}<span class="btn sm" style="margin-left:auto">👋 Wave</span></div></div>
      <span class="burst" style="right:70px;top:30px">👋</span><span class="burst" style="right:90px;top:34px;animation-delay:.5s">❤️</span>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="card sec" style="align-items:center;text-align:center;gap:8px"><div class="ring"><div><b style="font-size:20px">62%</b><span class="xs mut" style="font-size:10px">read</span></div></div><b style="font-size:13.5px">26 of 42 read this month</b><div class="xs mut">Catch up takes about 3 minutes</div>
      <div class="row" style="gap:6px">${['🔥 4-day streak', '✓ All confirmed'].map((t, i) => `<span class="pill ${i ? 'p-ok' : 'p-warn'}">${t}</span>`).join('')}</div></div>
    <div class="card sec" style="border-color:#FCD9A8;background:linear-gradient(180deg,#FFF7ED,#fff)"><h3>${icon('check2', 15)}Needs your confirmation</h3>
      <div class="row" style="gap:10px"><span style="font-size:24px">📘</span><div style="flex:1"><b style="font-size:13px">Updated leave policy for 2027</b><div class="xs mut">Due 20 Oct · 15 days left</div></div></div><span class="btn pri sm" style="align-self:flex-start">Read &amp; confirm</span></div>
    <div class="card sec"><h3>${icon('cal', 15)}Coming up</h3>
      <div class="row" style="gap:6px">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<div style="flex:1;text-align:center;padding:6px 0;border-radius:9px;${i === 4 ? `background:${C.pri};color:#fff` : `background:${C.raised}`}"><div class="xs" style="font-size:10px;opacity:.8">${d}</div><b style="font-size:13px">${5 + i}</b>${[2, 4].includes(i) ? `<div style="width:5px;height:5px;border-radius:50%;background:${i === 4 ? '#fff' : C.pri};margin:2px auto 0"></div>` : ''}</div>`).join('')}</div>
      ${[['FRI 4 pm', 'Diwali celebration', '34 going'], ['WED 10 am', 'Laptop swap — Design', 'IT desk']].map(([w, t, s]) => `<div class="row" style="gap:10px"><b class="xs" style="width:62px;color:${C.pri}">${w}</b><div><b style="font-size:13px">${t}</b><div class="xs mut">${s}</div></div></div>`).join('')}</div>
    <div class="card sec"><h3>${icon('heart', 15)}Most loved this week</h3>
      ${[['🎉', 'We hit 1,000 customers!', '52'], ['👋', 'Say hello to Farah, Dev…', '31'], ['🏆', 'Q3 wins from Sales', '24']].map(([e, t, n]) => `<div class="row" style="gap:10px"><span style="font-size:20px">${e}</span><b style="flex:1;font-size:12.5px">${t}</b><span class="xs mut">❤️ ${n}</span></div>`).join('')}</div>
    <div class="card sec"><h3>${icon('file', 15)}Policies &amp; documents</h3>
      ${['Leave policy 2027.pdf', 'Travel & expenses.pdf', 'Code of conduct.pdf'].map((d) => `<div class="row xs" style="gap:8px">${icon('clip', 13)}<b style="flex:1">${d}</b><span class="mut">PDF</span></div>`).join('')}</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Announcements — employee feed', css, html, 1340);
}

// ─── Board 3: immersive post + catch-up story ───────────────
function post() {
  const html = `<div class="app">${sidebar('Announcements')}<div class="col">${header('Engagement &nbsp;›&nbsp; Announcements &nbsp;›&nbsp; <b>We hit 1,000 customers!</b>')}<main class="main" style="position:relative">
<div class="prog" style="width:38%"></div>
<div class="g21" style="grid-template-columns:1fr 330px">
  <div class="card" style="overflow:hidden">
    <div class="scene" style="height:250px;border-radius:0;background:linear-gradient(135deg,#7C3AED,#EC4899);display:flex;align-items:center;justify-content:center">${confetti(26)}${art.party(1.7)}<span class="pill" style="position:absolute;left:16px;top:14px;background:rgba(255,255,255,.2);color:#fff">${icon('pin', 11)} Pinned</span></div>
    <div style="padding:20px 26px;display:flex;flex-direction:column;gap:12px">
      <div class="row" style="gap:6px"><span class="pill" style="background:#FDE8F1;color:#DB2777">🎉 Celebration</span><span class="xs mut">1 min read</span></div>
      <b style="font-size:26px;line-height:1.2">We hit 1,000 customers!</b>
      <div class="row xs mut" style="gap:8px">${photo(5, 28, 28, { round: true })}<span><b style="color:${C.fg}">Vikram Rao</b> · Head of Operations · today 9:12</span></div>
      <div style="font-size:14.5px;line-height:1.7">Thank you all — this one belongs to every team. 🙌<br>• <b>Cake</b> in the cafeteria at 4 pm Friday<br>• Team photo at 4:30 — wear something blue</div>
      <div class="ev" style="background:${C.raised}"><div style="width:52px;text-align:center"><div class="xs" style="color:${C.bad};font-weight:800;font-size:10px">FRI</div><b style="font-size:22px">9</b></div><div style="flex:1"><b style="font-size:13.5px">Fri 9 Oct · 4:00 pm · Cafeteria</b><div class="xs mut">Starts in 3 days 06 h</div></div><span class="btn sm pri">✓ Going</span><span class="btn sm">${icon('cal', 12)} .ics</span></div>
      <div class="row" style="gap:6px;position:relative">${[['🎉', 41, 1], ['❤️', 9], ['👏', 6]].map(([e, n, on]) => `<span class="reac ${on ? 'on' : ''}">${e} ${n}</span>`).join('')}<span class="reac">${icon('smile', 12)}</span><span class="burst" style="left:18px;top:-6px">🎉</span><span class="burst" style="left:30px;top:-2px;animation-delay:.4s">🎉</span>
        <span class="xs mut row" style="margin-left:auto;gap:6px">${icon('eye', 13)} Seen by <div class="stack">${[0, 1, 3, 4, 6].map((i) => photo(i, 20, 20, { round: true })).join('')}</div> +118</span></div>
      <div style="border-top:1px solid ${C.line};padding-top:12px;display:flex;flex-direction:column;gap:8px"><b class="xs mut" style="letter-spacing:.06em">MORE LIKE THIS</b>
        <div class="row" style="gap:10px">${[['linear-gradient(135deg,#F59E0B,#DB2777)', '🏆', 'Q3 wins from Sales'], ['linear-gradient(135deg,#0D9488,#22C55E)', '🌿', 'Green office week']].map(([g, e, t]) => `<div class="row" style="gap:8px;flex:1;border:1px solid ${C.border};border-radius:12px;padding:8px"><span style="width:44px;height:36px;border-radius:9px;background:${g};display:flex;align-items:center;justify-content:center">${e}</span><b class="xs">${t}</b></div>`).join('')}</div></div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px;align-items:center">
    <div class="xs mut" style="font-weight:800;letter-spacing:.06em;align-self:flex-start">CATCH-UP · STORY MODE (PHONE)</div>
    <div style="width:270px;height:520px;border:8px solid #111827;border-radius:34px;overflow:hidden;position:relative;background:linear-gradient(180deg,#4F46E5,#7C3AED);color:#fff">
      <div style="position:absolute;left:10px;right:10px;top:10px;display:flex;gap:4px">${[1, 0.4, 0, 0, 0].map((w) => `<span style="flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.35);overflow:hidden"><i style="display:block;height:100%;width:${w * 100}%;background:#fff"></i></span>`).join('')}</div>
      <div class="row xs" style="position:absolute;left:12px;top:22px;gap:6px">${photo(2, 22, 22, { round: true })}<b>Hema Iyer</b><span style="opacity:.75">2 h</span></div>
      <div style="position:absolute;inset:60px 0 auto;display:flex;justify-content:center">${art.shield(1.2)}</div>
      <div style="position:absolute;left:16px;right:16px;bottom:86px;display:flex;flex-direction:column;gap:8px"><span class="pill" style="background:rgba(255,255,255,.2);color:#fff;align-self:flex-start">📘 Policy · 2 of 5</span><b style="font-size:20px;line-height:1.2">Updated leave policy for 2027</b><span style="font-size:12px;opacity:.9">Earned leave now carries forward up to 10 days…</span></div>
      <div style="position:absolute;left:14px;right:14px;bottom:18px;display:flex;gap:8px"><span class="btn sm" style="flex:1;justify-content:center;background:#fff;border:0">✓ I have read this</span><span class="btn sm" style="background:rgba(255,255,255,.18);border:0;color:#fff">🎉</span></div>
      <span style="position:absolute;left:4px;top:50%;opacity:.6">${icon('chevl', 18)}</span><span style="position:absolute;right:4px;top:50%;opacity:.6">${icon('chevr', 18)}</span>
    </div>
    <div class="xs mut" style="text-align:center;max-width:270px">Tap through unread posts like stories — each one is marked read as you go; ones that need confirming stop and wait.</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Announcement post & catch-up', css, html, 1180);
}

const boards = [
  ['CAAnnounceCovers.dc.html', 'Announcements · Covers — colours, animated scenes, 3D art, upload image / short video / Lottie, focal point, motion level', covers, 1180],
  ['CAAnnounceFeed2.dc.html', 'Announcements · Employee feed — greeting, catch-up stories, animated hero carousel, grouped by day, rich cards per type, right rail always full', feed, 1340],
  ['CAAnnouncePost2.dc.html', 'Announcements · Post — animated cover, reading progress, event countdown + .ics, seen by, more like this; phone story mode', post, 1180],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 20500 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n12 = { kind: 'title1', maxW: 4600, text: 'Announcements, round 2 — animated & 3D covers, fuller employee feed, immersive post', w: 240, x: 0, y: 20200 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
