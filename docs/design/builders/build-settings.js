// Company app → Settings: Branding, Theme, Delegation, Preferences; animation ideas; who sees what.
// Sidebar and top bar stay exactly as in the app (the SETTINGS group keeps its 4 items).
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { C } = require('./build-reports.js');
const { css: adminCss, note, NEW, av, nm, first } = require('./build-admin.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

Object.assign(P, {
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  drop: '<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 2v20" /><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>',
  baton: '<path d="m4 20 12-12"/><path d="m14 4 6 6-3 3-6-6z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  moon2: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  x2: '<path d="M18 6 6 18M6 6l12 12"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wand: '<path d="m15 4 5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  bellOff: '<path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M2 2l20 20"/>',
});

// ─── Shell ──────────────────────────────────────────────────
const SET = [['image', 'Branding'], ['palette', 'Theme'], ['swap', 'Delegation'], ['sliders', 'Preferences']];
const sidebar = (on) => `<aside class="sb">
<div class="sb-h"><span class="logo">AP</span><span><b>aakash-portal</b><span>HR workspace</span></span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Home</div><div class="sb-i">${icon('idcard')}My profile</div><div class="sb-i">${icon('chart')}Reports &amp; analytics</div><div class="sb-i">${icon('contact')}People</div>
<div class="sb-g">ORGANIZATION ›</div><div class="sb-g">ENGAGEMENT ›</div><div class="sb-g">WORK ›</div><div class="sb-g">EXPENSES ›</div><div class="sb-g">ASSETS ›</div><div class="sb-g">HELPDESK ›</div><div class="sb-g">TIME ›</div><div class="sb-g">ADMINISTRATION ›</div>
<div class="sb-g">SETTINGS</div>${SET.map(([ic, l]) => `<div class="sb-i${l === on ? ' on' : ''}">${icon(ic)}<span style="flex:1">${l}</span></div>`).join('')}
</aside>`;
const header = (crumb) => `<header class="hdr"><div class="crumb">Settings &nbsp;›&nbsp; <b>${crumb}</b></div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Settings</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const page = (on, body, overlay = '') => `<div class="app">${sidebar(on)}<div class="col">${header(on)}<main class="main">${body}</main></div>${overlay}</div>`;

// Brand used across the boards (aakash-portal)
const B = { a: '#E9416A', b: '#7A2BD9', c: '#F59E0B', d: '#0EA5E9', ink: '#1B1530' };
const logo = (s = 40, r = 11) => `<span style="width:${s}px;height:${s}px;border-radius:${r}px;background:linear-gradient(135deg,${B.a},${B.b});color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.round(s * 0.36)}px;flex:none">AP</span>`;
const sw = (c, s = 26, extra = '') => `<span style="width:${s}px;height:${s}px;border-radius:8px;background:${c};display:inline-block;flex:none;box-shadow:inset 0 0 0 1px #0000001a;${extra}"></span>`;
const tog = (on = true) => `<span style="width:34px;height:20px;border-radius:99px;background:${on ? C.pri : '#D1D5DB'};position:relative;display:inline-block;flex:none"><i style="position:absolute;top:3px;${on ? 'right' : 'left'}:3px;width:14px;height:14px;border-radius:50%;background:#fff"></i></span>`;

const css = adminCss.replace('</style>', `
.frame{border-radius:14px;border:1px solid ${C.border};overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(17,24,39,.08)}
.fbar{height:26px;background:${C.raised};border-bottom:1px solid ${C.border};display:flex;align-items:center;gap:6px;padding:0 10px}
.fbar i{width:8px;height:8px;border-radius:50%;background:#E5E7EF;display:inline-block}
.tabx{display:inline-flex;align-items:center;gap:6px;height:20px;padding:0 10px;border-radius:7px 7px 0 0;background:#fff;font-size:10.5px;font-weight:700;margin-top:6px}
.drop{border:2px dashed ${C.pri}66;border-radius:14px;background:${C.priSoft}66;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}
.pane{display:flex;flex-direction:column;gap:12px}
.idx{display:flex;flex-direction:column;gap:2px}.idx span{font-size:12.5px;padding:7px 10px;border-radius:8px;display:flex;gap:8px;align-items:center;color:#374151}.idx span.on{background:${C.priSoft};color:${C.priText};font-weight:800}
.saved{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:${C.ok};background:${C.okSoft};padding:2px 8px;border-radius:99px;animation:pop .4s ease both}
@keyframes pop{from{opacity:0;transform:scale(.7)}}
.mx{width:100%;border-collapse:collapse;font-size:12px}.mx th{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};text-align:center;padding:6px}.mx th:first-child{text-align:left}.mx td{padding:7px 6px;border-top:1px solid ${C.line};text-align:center}.mx td:first-child{text-align:left}
.gantt{position:relative;height:30px;border-radius:8px;background:${C.raised}}
.gantt i{position:absolute;top:5px;bottom:5px;border-radius:6px;display:flex;align-items:center;padding:0 8px;color:#fff;font-size:10.5px;font-weight:800;font-style:normal;white-space:nowrap;overflow:hidden}
@keyframes wave{0%{clip-path:circle(0% at 0% 0%)}100%{clip-path:circle(150% at 0% 0%)}}
.wave{animation:wave 2.6s cubic-bezier(.4,0,.2,1) infinite alternate}
@keyframes flyc{0%{transform:translate(0,0) scale(.4);opacity:0}40%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1);opacity:1}}
.flyc{animation:flyc 1.6s cubic-bezier(.2,.8,.2,1) infinite alternate}
@keyframes sunmoon{0%,40%{transform:rotate(0)}60%,100%{transform:rotate(180deg)}}
@keyframes passb{0%,15%{left:14%}55%,100%{left:72%}}
@keyframes ringd{from{stroke-dashoffset:0}to{stroke-dashoffset:var(--o)}}
@keyframes hand{to{transform:rotate(360deg)}}
@keyframes slidex{0%,20%{left:25%}50%,70%{left:72%}100%{left:25%}}
</style>`);

// ─── 0 · Plan ───────────────────────────────────────────────
function overview() {
  const pages = [
    ['image', 'Branding', 'A brand kit with live previews: browser tab, sign-in page, side menu, email. Drop a logo → colours come out of it → one click to the theme.', B.a],
    ['palette', 'Theme', 'A theme studio: big live preview of real screens, light + dark side by side, phone view, contrast checks, before/after slider, version history.', C.pri],
    ['swap', 'Delegation', '“Going away?” — your approved leave is spotted, the best covers are suggested, a timeline of who covers whom, and a “while you were away” recap.', C.teal],
    ['sliders', 'Preferences', 'One tidy page with an index, search and instant save. Sections: Look, Region, Notifications, Home & views, Accessibility — with a live preview.', C.warn],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Company app · Settings</div><h1 style="margin:4px 0">Plan — Branding, Theme, Delegation, Preferences</h1><div class="sub">Sidebar stays the same (4 items). New things are sections, tabs, drawers and popups inside these pages.</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" class="stg">${pages.map(([ic, t, d, col]) => `<div class="card sec2" style="border-top:3px solid ${col}"><span style="color:${col}">${icon(ic, 20)}</span><b style="font-size:14px">${t}</b><div class="xs mut" style="line-height:1.6">${d}</div></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
  <div class="card sec2"><b>Today (kept)</b>${['Branding: display name, logo, favicon', 'Theme: presets, colours, type, shape, accessibility, undo/redo, publish, what employees can change', 'Delegation: hand over approvals for dates, end early, admin list + on-behalf', 'Preferences: light/dark, region, colour theme, menu style, background, moments, saved views, density, email on/off'].map((t) => `<div class="xs">• ${t}</div>`).join('')}</div>
  <div class="card sec2"><b>Build size (rough)</b>${[['UI only', 'Brand previews, theme studio layout, light+dark side by side, before/after, preferences index + search + instant save, delegation timeline'], ['Small API', 'Logo colours, sign-in message, dark logo, theme versions, delegation suggestions + recap, notification matrix + quiet hours'], ['Bigger', 'Scheduled (seasonal) themes, choosing which approvals to hand over']].map(([a, b]) => `<div class="xs"><b>${a}:</b> <span class="mut">${b}</span></div>`).join('')}</div>
  <div class="card sec2"><b>Questions</b>${['Branding: add a sign-in welcome line + photo, and a logo for dark mode?', 'Theme: keep a version history? Scheduled themes (e.g. Diwali week)?', 'Delegation: hand over all 4 approvals, or let people pick (leave only, expenses…)?', 'Delegation: when leave is approved, just suggest a cover — or set it up automatically?', 'Notifications: per event (in-app / email) + quiet hours — OK?', 'Appearance: add “Auto” (follow device, or dark after sunset)?'].map((t, i) => `<div class="xs">${i + 1}. ${t}</div>`).join('')}</div>
</div>
</div>`;
  return dcPage('Settings — plan', css, html, 760);
}

// ─── 1 · Branding ───────────────────────────────────────────
function branding() {
  const html = page('Branding', `
${top('Branding', 'Your name, logos and sign-in page — see every change live before you save.', `<div class="row" style="gap:8px"><span class="pill p-warn">Unsaved · 2 changes</span><span class="btn">Discard</span><span class="btn pri">${icon('check2', 13)}Save brand</span></div>`)}
<div style="display:grid;grid-template-columns:420px 1fr;gap:16px;align-items:start">
  <div class="pane">
    <div class="card sec2"><b style="font-size:13px">Name</b>
      <div class="f"><label>Display name</label><div class="in">aakash-portal</div></div>
      <div class="f"><label>Short line under the name ${NEW}</label><div class="in">HR workspace</div><span class="h">Shown under the logo in the side menu.</span></div>
    </div>
    <div class="card sec2"><b style="font-size:13px">Logos</b>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        ${[['Light', '#fff', logo(36)], ['Dark ' + NEW.replace('New', 'new'), '#17151F', logo(36)], ['Square icon', '#fff', logo(28, 7)]].map(([l, bg, lg]) => `<div style="display:flex;flex-direction:column;gap:5px;align-items:center"><div style="width:100%;height:70px;border-radius:12px;background:${bg};border:1px solid ${C.border};display:flex;align-items:center;justify-content:center">${lg}</div><span class="xs mut">${l}</span></div>`).join('')}
      </div>
      <div class="drop" style="height:74px">${icon('upload', 18)}<span class="xs"><b>Drop a new logo</b> · PNG or SVG · we crop and make the icon</span></div>
    </div>
    <div class="card sec2" style="border:1.5px solid ${C.pri}55"><b style="font-size:13px">${icon('drop', 14)} Colours from your logo ${NEW}</b>
      <div class="row" style="gap:8px">${[B.a, B.b, B.c, B.d, B.ink].map((c, i) => `<span style="display:flex;flex-direction:column;align-items:center;gap:3px">${sw(c, 34)}<span style="font-size:9.5px;font-family:monospace;color:${C.muted}">${c}</span></span>`).join('')}</div>
      <div class="row" style="gap:8px"><span class="btn sm pri">${icon('palette', 12)}Make a theme from these</span><span class="xs mut">opens Theme with them filled in</span></div>
    </div>
    <div class="card sec2"><b style="font-size:13px">Sign-in page ${NEW}</b>
      <div class="f"><label>Welcome line</label><div class="in">Good to see you at Aakash 👋</div></div>
      <div class="f"><label>Background</label><div class="row" style="gap:6px">${['Our background pack', 'A photo', 'Plain'].map((t, i) => `<span class="pill ${i === 0 ? 'p-pri' : 'p-neu'}">${t}</span>`).join('')}</div></div>
    </div>
  </div>
  <div class="pane">
    <div class="row"><b style="font-size:13px;flex:1">Live preview</b><span class="seg2"><span class="on">${icon('monitor', 11)} Desktop</span><span>${icon('phone', 11)} Phone</span></span></div>
    <div class="frame">
      <div class="fbar"><i></i><i></i><i></i><span class="tabx">${logo(12, 3)} aakash-portal — Home</span></div>
      <div style="display:flex;height:180px">
        <div style="width:170px;border-right:1px solid ${C.border};padding:10px;display:flex;flex-direction:column;gap:6px">
          <div class="row" style="gap:8px">${logo(26, 7)}<span><b style="font-size:11.5px;display:block">aakash-portal</b><span style="font-size:9.5px;color:${C.muted}">HR workspace</span></span></div>
          ${['Home', 'My profile', 'People', 'Leave'].map((t, i) => `<div style="height:20px;border-radius:6px;padding:0 8px;font-size:10px;display:flex;align-items:center;${i === 0 ? `background:${B.a}1f;color:${B.a};font-weight:800` : 'color:#6B7280'}">${t}</div>`).join('')}
        </div>
        <div style="flex:1;padding:14px;background:#FAFAFC;display:flex;flex-direction:column;gap:8px"><div style="height:10px;width:40%;border-radius:4px;background:#E5E7EF"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[0, 1, 2].map((i) => `<div style="height:56px;border-radius:10px;background:#fff;border:1px solid ${C.border};border-top:3px solid ${[B.a, B.b, B.c][i]}"></div>`).join('')}</div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px">
      <div class="frame" style="height:210px;position:relative;background:linear-gradient(135deg,${B.b},${B.a});display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,#ffffff33,transparent 40%),radial-gradient(circle at 80% 70%,#F59E0B55,transparent 45%)"></div>
        <div style="position:relative;width:200px;background:#fff;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:7px;align-items:center;box-shadow:0 20px 40px #0003">${logo(30, 8)}<b style="font-size:12px">Good to see you at Aakash 👋</b><div style="height:20px;width:100%;border-radius:6px;background:${C.raised}"></div><div style="height:20px;width:100%;border-radius:6px;background:${C.raised}"></div><div style="height:22px;width:100%;border-radius:6px;background:${B.a}"></div></div>
        <span class="where" style="position:absolute;left:10px;top:10px">Sign-in page</span>
      </div>
      <div class="frame" style="height:210px;display:flex;flex-direction:column">
        <div style="padding:10px;background:linear-gradient(90deg,${B.a},${B.b});display:flex;align-items:center;gap:8px;color:#fff">${logo(22, 6)}<b style="font-size:11px">aakash-portal</b></div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:6px"><b style="font-size:11.5px">Your leave was approved ✓</b>${[90, 70, 80].map((w) => `<div style="height:7px;width:${w}%;border-radius:4px;background:#EEF0F5"></div>`).join('')}<div style="height:20px;width:90px;border-radius:6px;background:${B.a};margin-top:4px"></div></div>
        <span class="where" style="margin:auto 10px 10px">Email</span>
      </div>
    </div>
  </div>
</div>
${note([['old', 'Display name, logo and favicon upload stay. “Looking for colors?” link to Theme stays.'], ['new', 'Live preview of 4 places your brand shows (tab, menu, sign-in page, email) — updates as you type or drop a logo.'], ['new', 'Dark-mode logo, a square icon made from the logo, a short line under the name, sign-in welcome line + background.'], ['new', 'Colours pulled out of your logo → “Make a theme from these”.'], ['q', 'Do you want the sign-in welcome line + photo, and the dark logo?']])}
`);
  return dcPage('Settings — branding', css, html, 1180);
}

// ─── 2 · Theme studio ───────────────────────────────────────
function theme() {
  const mini = (dark) => {
    const bg = dark ? '#14121C' : '#F7F7FB', card = dark ? '#1F1C2B' : '#fff', line = dark ? '#2C2840' : C.border, txt = dark ? '#E9E6F5' : C.fg, mut = dark ? '#8F8AA8' : C.muted;
    return `<div style="border-radius:12px;overflow:hidden;border:1px solid ${line};background:${bg};display:flex;height:220px">
      <div style="width:90px;background:${card};border-right:1px solid ${line};padding:8px;display:flex;flex-direction:column;gap:5px">${logo(20, 6)}${['Home', 'Leave', 'People', 'Team'].map((t, i) => `<div style="height:16px;border-radius:5px;font-size:9px;padding:0 6px;display:flex;align-items:center;${i === 0 ? `background:${B.a}2a;color:${dark ? '#FF8FB0' : B.a};font-weight:800` : `color:${mut}`}">${t}</div>`).join('')}</div>
      <div style="flex:1;padding:10px;display:flex;flex-direction:column;gap:7px">
        <b style="font-size:11px;color:${txt}">Good morning, Hema</b>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${[['Present', '182'], ['On leave', '9'], ['Waiting', '7']].map(([l, v], i) => `<div style="border-radius:8px;background:${card};border:1px solid ${line};padding:6px"><div style="font-size:8.5px;color:${mut}">${l}</div><b style="font-size:13px;color:${[B.a, B.b, B.c][i]}">${v}</b></div>`).join('')}</div>
        <div style="border-radius:8px;background:${card};border:1px solid ${line};padding:7px;display:flex;flex-direction:column;gap:5px">${[0, 1].map((i) => `<div style="display:flex;align-items:center;gap:6px">${av(i, 16)}<span style="flex:1;height:6px;border-radius:3px;background:${line}"></span><span style="font-size:8.5px;padding:1px 6px;border-radius:99px;background:${['#DCFCE7', '#FEF3C7'][i]};color:${['#166534', '#92400E'][i]}">${['Approved', 'Pending'][i]}</span></div>`).join('')}</div>
        <div style="display:flex;gap:6px;margin-top:auto"><span style="height:20px;padding:0 10px;border-radius:7px;background:${B.a};color:#fff;font-size:9.5px;font-weight:800;display:flex;align-items:center">Apply leave</span><span style="height:20px;padding:0 10px;border-radius:7px;border:1px solid ${line};color:${txt};font-size:9.5px;display:flex;align-items:center">Cancel</span></div>
      </div></div>`;
  };
  const html = page('Theme', `
${top('Theme', 'Your company’s look. A big live preview of real screens — publish when it’s right.', `<div class="row" style="gap:6px"><span class="pill p-warn">Unpublished changes</span><span class="btn sm">${icon('undo', 12)}</span><span class="btn sm">${icon('history', 12)}Versions${NEW}</span><span class="btn pri">${icon('check2', 13)}Publish</span></div>`)}
<div style="display:grid;grid-template-columns:330px 1fr;gap:16px;align-items:start">
  <div class="pane">
    <div class="card sec2"><b style="font-size:13px">${icon('wand', 14)} Start from</b>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[[[B.a, B.b], 'From logo ✦'], [['#4F46E5', '#0EA5E9'], 'Indigo'], [['#0D9488', '#65A30D'], 'Forest'], [['#EA580C', '#F59E0B'], 'Sunset'], [['#111827', '#6B7280'], 'Graphite'], [['#DB2777', '#7C3AED'], 'Berry']].map(([[a, b], n], i) => `<div style="border-radius:10px;border:${i === 0 ? `2px solid ${C.pri}` : `1px solid ${C.border}`};padding:6px;display:flex;flex-direction:column;gap:4px"><div style="height:30px;border-radius:7px;background:linear-gradient(135deg,${a},${b})"></div><span style="font-size:10px;font-weight:700">${n}</span></div>`).join('')}</div>
    </div>
    <div class="card sec2"><b style="font-size:13px">Colours</b>
      ${[['Main', B.a], ['Accent', B.b], ['Highlight', B.c], ['Success', '#16A34A'], ['Warning', '#D97706'], ['Danger', '#DC2626']].map(([l, c]) => `<div class="row" style="gap:8px">${sw(c, 22)}<span class="xs" style="flex:1;font-weight:700">${l}</span><span class="xs mut" style="font-family:monospace">${c}</span></div>`).join('')}
    </div>
    <div class="card sec2"><b style="font-size:13px">${icon('type', 14)} Type · ${icon('crop', 12)} Shape</b>
      <div class="row" style="gap:6px">${['Manrope', 'Inter', 'Poppins'].map((t, i) => `<span class="pill ${i === 0 ? 'p-pri' : 'p-neu'}">${t}</span>`).join('')}</div>
      <div class="row" style="gap:6px">${[2, 8, 14, 22].map((r, i) => `<span style="width:34px;height:24px;border:2px solid ${i === 2 ? C.pri : C.border};border-radius:${r / 2}px"></span>`).join('')}<span class="xs mut">corners</span></div>
    </div>
    <div class="card sec2" style="border:1.5px solid ${C.ok}55"><b style="font-size:13px">${icon('contrast', 14)} Easy to read? ${NEW}</b>
      ${[['Text on background', 'AAA', C.ok], ['White on main colour', 'AA', C.ok], ['Muted text', 'AA', C.ok], ['Highlight on white', '2.1 — too light', C.bad]].map(([l, v, c]) => `<div class="row xs" style="gap:8px"><span style="flex:1">${l}</span><b style="color:${c}">${v}</b></div>`).join('')}
      <span class="btn sm">${icon('wand', 12)}Fix it for me</span>
    </div>
  </div>
  <div class="pane">
    <div class="row" style="gap:8px"><b style="font-size:13px;flex:1">Live preview</b><span class="seg2"><span class="on">Home</span><span>A form</span><span>A table</span><span>Sign-in</span></span><span class="seg2"><span class="on">${icon('monitor', 11)}</span><span>${icon('phone', 11)}</span></span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><span class="where">${icon('sun', 10)} Light</span><div style="margin-top:6px">${mini(false)}</div></div>
      <div><span class="where">${icon('moon2', 10)} Dark</span><div style="margin-top:6px">${mini(true)}</div></div>
    </div>
    <div class="card sec2"><div class="row"><b style="font-size:13px;flex:1">Before / after ${NEW}</b><span class="xs mut">drag the line</span></div>
      <div style="position:relative;height:120px;border-radius:12px;overflow:hidden;border:1px solid ${C.border}">
        <div style="position:absolute;inset:0;background:#F7F7FB;display:flex;gap:8px;padding:12px">${[0, 1, 2].map(() => `<div style="flex:1;border-radius:10px;background:#fff;border:1px solid ${C.border};border-top:3px solid #4F46E5"></div>`).join('')}</div>
        <div style="position:absolute;inset:0;background:#F7F7FB;display:flex;gap:8px;padding:12px;clip-path:inset(0 0 0 52%)">${[B.a, B.b, B.c].map((c) => `<div style="flex:1;border-radius:10px;background:#fff;border:1px solid ${C.border};border-top:3px solid ${c}"></div>`).join('')}</div>
        <div style="position:absolute;top:0;bottom:0;left:52%;width:3px;background:${C.fg}"><span style="position:absolute;top:50%;left:-11px;width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid ${C.fg};transform:translateY(-50%)"></span></div>
        <span class="pill p-neu" style="position:absolute;left:8px;bottom:8px">Published</span><span class="pill p-pri" style="position:absolute;right:8px;bottom:8px">Your edit</span>
      </div>
    </div>
  </div>
</div>
${note([['old', 'Presets, colours, typography, shape & depth, accessibility, undo/redo, discard, publish — all stay.'], ['new', 'Big preview of real screens (Home / a form / a table / sign-in), light and dark side by side, phone size.'], ['new', '“From logo” preset (made from Branding colours), easy-to-read checks with “Fix it for me”, before/after slider.']])}
`);
  return dcPage('Settings — theme', css, html, 1240);
}

// ─── 3 · Theme versions + employee choices ───────────────────
function themeMore() {
  const html = page('Theme', `
${top('Theme', 'Versions, seasonal themes and what employees can change.')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
  <div class="card sec2"><b style="font-size:14px">${icon('history', 15)} Versions ${NEW}</b>
    <div style="display:flex;flex-direction:column;gap:0;border-left:2px solid ${C.line};margin-left:8px">
    ${[['Now', 'Berry from logo', 'You · today 10:42', [B.a, B.b, B.c], true], ['v4', 'Indigo, rounder corners', 'Hema · 2 Sep', ['#4F46E5', '#0EA5E9', '#F59E0B']], ['v3', 'Indigo', 'Hema · 12 Jun', ['#4F46E5', '#6366F1', '#F59E0B']], ['v2', 'Platform default', 'Setup · 3 Jan', ['#1E40AF', '#3B82F6', '#94A3B8']]].map(([v, t, who, cs, on]) => `<div class="row" style="gap:10px;padding:10px 0 10px 16px;position:relative"><i style="position:absolute;left:-7px;top:16px;width:12px;height:12px;border-radius:50%;background:${on ? C.pri : '#fff'};border:2px solid ${on ? C.pri : C.border}"></i><b style="width:34px;font-size:12px">${v}</b><span class="row" style="gap:3px">${cs.map((c) => sw(c, 16)).join('')}</span><span style="flex:1"><b style="font-size:12.5px;display:block">${t}</b><span class="xs mut">${who}</span></span>${on ? '<span class="pill p-ok">Live</span>' : '<span class="btn sm">Preview</span><span class="btn sm">Restore</span>'}</div>`).join('')}
    </div>
  </div>
  <div class="card sec2"><b style="font-size:14px">${icon('cal', 15)} Seasonal theme ${NEW}</b>
    <div class="xs mut">Switch to a festive look for some days, then back by itself.</div>
    <div class="row" style="gap:10px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#FFF7ED,#FEF3C7)"><span style="font-size:26px">🪔</span><div style="flex:1"><b style="font-size:13px">Diwali glow</b><div class="xs mut">Mon 2 Nov → Sun 8 Nov · then back to “Berry from logo”</div></div><span class="row" style="gap:3px">${['#EA580C', '#F59E0B', '#7C2D12'].map((c) => sw(c, 18)).join('')}</span></div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${['🎄 Year end', '🌸 Holi', '🇮🇳 Independence Day', '+ Your own'].map((t) => `<span class="pill p-neu">${t}</span>`).join('')}</div>
  </div>
</div>
<div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">What employees can change</b><span class="xs mut">only affects the person who chooses</span></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
    ${[['Light / dark', true, `<span class="row" style="gap:4px">${sw('#fff', 30)}${sw('#14121C', 30)}</span>`], ['Their own colour theme', true, `<span class="row" style="gap:4px">${['#4F46E5', '#0D9488', B.a, '#EA580C'].map((c) => sw(c, 22)).join('')}</span>`], ['Menu style', true, `<span class="row" style="gap:4px">${[0, 1, 2].map((i) => `<span style="width:30px;height:24px;border-radius:5px;border:1px solid ${C.border};background:linear-gradient(90deg,${C.priSoft} ${[30, 18, 40][i]}%,#fff 0)"></span>`).join('')}</span>`], ['Page background', false, `<span class="row" style="gap:4px">${['#FDE68A', '#C7D2FE', '#FBCFE8'].map((c) => sw(`radial-gradient(circle,${c},#fff)`, 26)).join('')}</span>`]].map(([t, on, prev]) => `<div style="border:1px solid ${C.border};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;${on ? '' : 'opacity:.6'}">${prev}<div class="row"><b style="font-size:12.5px;flex:1">${t}</b>${tog(on)}</div></div>`).join('')}
  </div>
</div>
${note([['old', 'What employees can change stays (now with small pictures of each choice).'], ['new', 'Versions: every publish is kept — preview or restore an older one.'], ['new', 'Seasonal theme: pick dates, it switches back by itself.'], ['q', 'Keep how many versions (e.g. last 10)? Do you want seasonal themes?']])}
`);
  return dcPage('Settings — theme versions', css, html, 980);
}

// ─── 4 · Delegation ─────────────────────────────────────────
function delegation() {
  const days = Array.from({ length: 21 }, (_, i) => i + 5); // 5–25 Oct
  const html = page('Delegation', `
${top('Delegation', 'Going away? Hand your approvals to a colleague — they cover for you, then it ends by itself.')}
<div style="padding:18px 20px;border-radius:18px;background:linear-gradient(135deg,${C.priSoft},#F0FDFA);display:flex;gap:18px;align-items:center;border:1px solid ${C.pri}22">
  <span style="font-size:38px">🏖️</span>
  <div style="flex:1"><b style="font-size:16px">You’re off Thu 15 – Tue 20 Oct (4 days)</b><div class="xs mut" style="margin-top:3px">Casual leave · approved. <b>7 requests</b> from your team usually come in during a week like this.</div></div>
  <span class="btn pri">${icon('baton', 13)}Find someone to cover</span>
</div>
<div style="display:grid;grid-template-columns:1fr 400px;gap:16px;align-items:start">
  <div class="pane">
    <div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">Your team’s next 3 weeks ${NEW}</b><span class="xs mut">who’s away, who covers</span></div>
      <div style="display:grid;grid-template-columns:110px repeat(21,1fr);gap:2px;font-size:9px;align-items:center">
        <span></span>${days.map((d) => `<span style="text-align:center;color:${C.muted}">${d}</span>`).join('')}
        ${[[1, 'You', [[10, 15, C.pink, '🏖️ Leave']], [[10, 15, C.teal, '→ Priya covers', true]]], [0, 'Priya', [], [[10, 15, C.teal, 'covering you', true]]], [4, 'Neha', [[4, 6, C.pink, 'Leave']], []], [3, 'Rahul', [[16, 20, C.pink, 'Leave']], [[16, 20, C.warn, 'no cover yet', true]]]].map(([i, n, off, cov]) => `<span class="row" style="gap:5px">${av(i, 18)}<b style="font-size:11px">${n}</b></span><div style="grid-column:span 21;position:relative;height:26px;border-radius:6px;background:${C.raised}">${[...off, ...cov].map(([a, b, col, t, dashed]) => `<i style="position:absolute;top:${dashed ? 14 : 3}px;height:${dashed ? 9 : 10}px;left:${(a / 21) * 100}%;width:${((b - a + 1) / 21) * 100}%;border-radius:4px;background:${dashed ? 'transparent' : col};border:${dashed ? `1.5px dashed ${col}` : 'none'};font-size:8.5px;color:${dashed ? col : '#fff'};font-weight:800;font-style:normal;overflow:hidden;white-space:nowrap;padding:0 4px;line-height:${dashed ? 7 : 10}px">${t}</i>`).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="card sec2"><b style="font-size:14px">Handed over</b>
      ${[[0, 'Priya Sharma', '15 – 20 Oct', 'Starts in 9 days', 'Upcoming', 0, C.info], [2, 'Hema Iyer', '1 – 3 Oct', 'Approved 4 for you', 'Ended', 100, C.muted]].map(([i, n, d, s, st, p, col]) => `<div class="row" style="gap:12px;padding:10px;border-radius:12px;border:1px solid ${C.border}">${av(i, 34)}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${d} · ${s}</div><div style="height:5px;border-radius:99px;background:${C.line};margin-top:6px;overflow:hidden"><i class="wb" style="display:block;height:100%;width:${p}%;background:${col}"></i></div></div><span class="pill ${st === 'Ended' ? 'p-neu' : 'p-pri'}">${st}</span>${st !== 'Ended' ? '<span class="btn sm">End now</span>' : ''}</div>`).join('')}
    </div>
  </div>
  <div class="card sec2" style="border:1.5px solid ${C.pri}44">
    <b style="font-size:14px">${icon('baton', 15)} Hand over my approvals</b>
    <div class="secn"><i>1</i>When</div>
    <div class="row" style="gap:8px"><div class="in" style="flex:1">${icon('cal', 13)}15 Oct · in 9 days</div><span class="mut">→</span><div class="in" style="flex:1">20 Oct</div></div>
    <div class="xs" style="color:${C.ok}">${icon('check2', 11)} Filled from your approved leave</div>
    <div class="secn"><i>2</i>Who covers — best fits ${NEW}</div>
    ${[[0, 'Priya Sharma', 'Engineering Lead · same team reach', 'In all 6 days · 2 requests waiting', true], [2, 'Hema Iyer', 'HR · can already approve', 'In 5 of 6 days', false], [4, 'Neha Gupta', 'Team Lead', 'Away 15 Oct', false, true]].map(([i, n, r, f, on, away]) => `<div class="row" style="gap:10px;padding:8px 10px;border-radius:12px;border:${on ? `2px solid ${C.pri}` : `1px solid ${C.border}`};${away ? 'opacity:.5' : ''}">${av(i, 30)}<div style="flex:1"><b style="font-size:12.5px">${n}</b><div class="xs mut">${r}</div><div class="xs" style="color:${away ? C.bad : C.ok}">${f}</div></div>${on ? `<span class="cb on">${icon('check2', 10)}</span>` : ''}</div>`).join('')}
    <div class="secn"><i>3</i>What they approve</div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${['Leave', 'Attendance fixes', 'Expenses', 'Timesheets'].map((t) => `<span class="pill p-pri">${icon('check2', 10)} ${t}</span>`).join('')}</div>
    <div class="f"><label>Note for Priya</label><div class="in ph">e.g. Ask Rahul about the release week</div></div>
    <span class="btn pri" style="justify-content:center">${icon('baton', 13)}Hand over 15 – 20 Oct</span>
  </div>
</div>
${note([['old', 'Hand over for dates, reason, end early, list of mine, “You’re covering for”, admin list + set up on someone’s behalf.'], ['new', '“Going away?” banner from your approved leave; dates filled in for you.'], ['new', 'Best covers: same reach, in office those days, how busy they are. People on leave are faded.'], ['new', 'Team timeline: who’s away and who covers — gaps (“no cover yet”) stand out.'], ['q', 'Pick which approvals to hand over, or always all 4? On leave approval: only suggest, or set it up by itself?']])}
`);
  return dcPage('Settings — delegation', css, html, 1180);
}

// ─── 5 · Delegation: covering + recap + admin ───────────────
function delegationMore() {
  const html = page('Delegation', `
${top('Delegation', 'While you were away, and the company view.')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
  <div class="card sec2" style="background:linear-gradient(135deg,#F0FDFA,#fff)"><b style="font-size:14px">👋 Welcome back — while you were away ${NEW}</b>
    <div class="row" style="gap:10px">${av(0, 36)}<div style="flex:1"><b style="font-size:13px">Priya covered 15 – 20 Oct</b><div class="xs mut">She decided 6 requests for your team</div></div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[['Approved', 5, C.ok], ['Rejected', 1, C.bad], ['Left for you', 2, C.warn]].map(([l, v, c]) => `<div class="tile"><span class="xs mut">${l}</span><b class="big" style="color:${c}">${v}</b></div>`).join('')}</div>
    ${[['Leave · Ravi · 22–23 Oct', 'Approved', C.ok], ['Expense · Neha · ₹1,240 cab', 'Approved', C.ok], ['Attendance · Rahul · 16 Oct', 'Rejected — no reason given', C.bad]].map(([t, s, c]) => `<div class="row xs" style="gap:8px"><span style="flex:1">${t}</span><b style="color:${c}">${s}</b></div>`).join('')}
    <span class="btn sm" style="align-self:flex-start">Say thanks to Priya 💜</span>
  </div>
  <div class="card sec2" style="border:1.5px solid ${C.ok}55"><b style="font-size:14px">You’re covering for Karan ${NEW}</b>
    <div class="row" style="gap:12px">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="${C.line}" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="${C.ok}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 26}" stroke-dashoffset="${2 * Math.PI * 26 * 0.4}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="${C.fg}">3d</text></svg>
      <div style="flex:1"><div class="xs mut">until Fri 9 Oct · his team (9 people)</div><div class="xs" style="margin-top:4px">“Release week — ask Rahul if unsure.” — Karan</div></div>
    </div>
    <div class="alertrow" style="background:${C.warnSoft}">${icon('info', 14)}<span style="flex:1"><b>3 of Karan’s requests</b> are waiting for you</span><span class="btn sm">Open approvals</span></div>
  </div>
</div>
<div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">Company hand-overs (admins)</b><span class="seg2"><span class="on">Timeline</span><span>List</span></span><span class="btn sm" style="margin-left:8px">+ Set up for someone</span></div>
  <div style="display:grid;grid-template-columns:200px 1fr;gap:6px;align-items:center">
    <span></span><div class="row" style="justify-content:space-between;font-size:10px;color:${C.muted}">${['1 Oct', '8 Oct', '15 Oct', '22 Oct', '29 Oct'].map((d) => `<span>${d}</span>`).join('')}</div>
    ${[[1, 'Karan → Sana', 15, 28, C.ok, 'now'], [2, 'Hema → Arjun', 2, 12, C.muted, 'ended'], [0, 'You → Priya', 48, 66, C.info, 'upcoming'], [3, 'Rahul → ?', 52, 64, C.warn, 'on leave, no cover']].map(([i, t, a, b, col, s]) => `<span class="row" style="gap:6px">${av(i, 22)}<b style="font-size:12px">${t}</b></span><div class="gantt"><i style="left:${a}%;width:${b - a}%;background:${col}${s === 'on leave, no cover' ? `;background:repeating-linear-gradient(45deg,${C.warn},${C.warn} 6px,#F59E0B99 6px,#F59E0B99 12px)` : ''}">${s}</i>${s === 'now' ? `<span style="position:absolute;left:21%;top:-3px;bottom:-3px;width:2px;background:${C.bad}"></span>` : ''}</div>`).join('')}
  </div>
</div>
${note([['old', '“You’re covering for”, admin list, end early, set up on someone’s behalf stay.'], ['new', 'Welcome-back recap: what your cover approved / rejected / left for you, with a “say thanks” kudos.'], ['new', 'Covering card with days-left ring, the note from the person, and how many of their requests wait for you.'], ['new', 'Admin timeline (Gantt) with a red “today” line; leave with no cover is striped amber.']])}
`);
  return dcPage('Settings — delegation more', css, html, 1000);
}

// ─── 6 · Preferences ────────────────────────────────────────
function preferences() {
  const html = page('Preferences', `
${top('Preferences', 'Only for you. Changes save as you go.', `<span class="saved">${icon('check2', 11)} Saved</span>`)}
<div style="display:grid;grid-template-columns:200px 1fr 320px;gap:16px;align-items:start">
  <div class="card" style="padding:8px">
    <div class="in ph" style="margin:2px 2px 8px">${icon('search', 13)}Search settings ${NEW}</div>
    <div class="idx">${[['palette', 'Look', true], ['globe', 'Region'], ['bell', 'Notifications'], ['dashboard', 'Home & views'], ['eye', 'Accessibility'], ['keyboard', 'Shortcuts']].map(([ic, l, on]) => `<span class="${on ? 'on' : ''}">${icon(ic, 14)}${l}</span>`).join('')}</div>
  </div>
  <div class="pane">
    <div class="card sec2"><b style="font-size:14px">Look</b>
      <div class="lbl">Light or dark</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[['Light', '#fff', C.fg], ['Dark', '#17151F', '#fff'], ['Auto ' + NEW, 'linear-gradient(90deg,#fff 50%,#17151F 50%)', C.fg]].map(([l, bg, fg], i) => `<div style="border-radius:12px;border:${i === 0 ? `2px solid ${C.pri}` : `1px solid ${C.border}`};padding:8px;display:flex;flex-direction:column;gap:6px"><div style="height:46px;border-radius:8px;background:${bg};border:1px solid ${C.border}"></div><b style="font-size:12px">${l}</b></div>`).join('')}</div>
      <div class="xs mut">Auto = follows your device, or dark after sunset.</div>
      <div class="lbl">Colour theme</div>
      <div class="row" style="gap:8px">${[['Company', `linear-gradient(135deg,${B.a},${B.b})`], ['Indigo', '#4F46E5'], ['Forest', '#0D9488'], ['Sunset', '#EA580C'], ['Graphite', '#374151']].map(([l, c], i) => `<span style="display:flex;flex-direction:column;align-items:center;gap:3px">${sw(c, 32, i === 0 ? `outline:2px solid ${C.pri};outline-offset:2px` : '')}<span style="font-size:10px">${l}</span></span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div class="lbl">Menu style</div><div class="row" style="gap:6px;margin-top:6px">${['Classic', 'Rail', 'Floating'].map((t, i) => `<span class="pill ${i === 0 ? 'p-pri' : 'p-neu'}">${t}</span>`).join('')}</div></div>
        <div><div class="lbl">Page background</div><div class="row" style="gap:6px;margin-top:6px">${['Signature', 'Terra', 'Prism', 'Simple'].map((t, i) => `<span class="pill ${i === 0 ? 'p-pri' : 'p-neu'}">${t}</span>`).join('')}</div></div>
        <div><div class="lbl">Spacing</div><div class="seg2" style="margin-top:6px"><span>Compact</span><span class="on">Normal</span><span>Roomy</span></div></div>
        <div><div class="lbl">Text size</div><div class="seg2" style="margin-top:6px"><span style="font-size:10px">A</span><span class="on">A</span><span style="font-size:14px">A</span></div></div>
      </div>
    </div>
    <div class="card sec2"><b style="font-size:14px">Region</b>
      <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:14px;align-items:center">
        <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="32" fill="#fff" stroke="${C.border}" stroke-width="2"/>${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${35 + Math.sin(a) * 26}" cy="${35 - Math.cos(a) * 26}" r="1.6" fill="${C.muted}"/>`; }).join('')}<line x1="35" y1="35" x2="35" y2="17" stroke="${C.fg}" stroke-width="3" stroke-linecap="round" transform="rotate(300 35 35)"/><line x1="35" y1="35" x2="35" y2="11" stroke="${C.pri}" stroke-width="2" stroke-linecap="round" transform="rotate(180 35 35)"/></svg>
        <div class="f"><label>Time zone</label><div class="in">${icon('globe', 13)}India · Kolkata · 10:30</div><span class="h">Search a city ${NEW}</span></div>
        <div class="f"><label>Date format</label><div class="seg2"><span class="on">31/12/2026</span><span>12/31</span><span>2026-12-31</span></div><span class="h">Week starts on <b>Monday</b> ${NEW}</span></div>
      </div>
    </div>
  </div>
  <div class="card sec2" style="position:sticky;top:0"><b style="font-size:13px">${icon('eye', 14)} How it looks ${NEW}</b>
    <div style="border-radius:12px;overflow:hidden;border:1px solid ${C.border};height:220px;display:flex">
      <div style="width:60px;background:#fff;border-right:1px solid ${C.border};padding:6px;display:flex;flex-direction:column;gap:4px">${logo(18, 5)}${[0, 1, 2, 3].map((i) => `<div style="height:12px;border-radius:4px;background:${i === 0 ? `${B.a}2a` : C.raised}"></div>`).join('')}</div>
      <div style="flex:1;padding:8px;background:radial-gradient(circle at 80% 10%,#FDE68A66,transparent 40%),#FAFAFC;display:flex;flex-direction:column;gap:6px"><b style="font-size:10.5px">Tue, 6 Oct · 10:30</b><div style="height:40px;border-radius:8px;background:#fff;border:1px solid ${C.border}"></div><div style="height:40px;border-radius:8px;background:#fff;border:1px solid ${C.border}"></div><span style="height:18px;width:70px;border-radius:6px;background:${B.a}"></span></div>
    </div>
    <div class="xs mut">Changes show here first — and on the page right away.</div>
    <span class="btn sm">${icon('undo', 12)}Reset everything to company default</span>
  </div>
</div>
${note([['old', 'Light/dark, time zone, date format, colour theme, menu style, background, moments, saved views, density, text size, email notifications — all stay.'], ['new', 'One page with an index and search, saved as you go (no Save button), live “how it looks” preview, reset to company default.'], ['new', 'Auto light/dark, time zone by city with a clock, week start day, a Shortcuts section.'], ['q', 'Add “Auto” light/dark? (You chose only light/dark before.)']])}
`);
  return dcPage('Settings — preferences', css, html, 1180);
}

// ─── 7 · Notifications + accessibility ──────────────────────
function prefMore() {
  const rows = [['Leave & attendance', 'Requests to approve, decisions, reminders'], ['Expenses', 'Claims to approve, paid'], ['Helpdesk', 'Replies on my tickets, assigned to me'], ['Announcements', 'New posts, things to confirm'], ['Kudos & celebrations', 'Kudos to me, birthdays, work anniversaries'], ['Assets', 'Hand-overs to confirm, due back']];
  const html = page('Preferences', `
${top('Preferences', 'Notifications, home and accessibility.', `<span class="saved">${icon('check2', 11)} Saved</span>`)}
<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:16px;align-items:start">
  <div class="card sec2"><b style="font-size:14px">${icon('bell', 15)} Notifications ${NEW}</b>
    <table class="mx"><thead><tr><th>What</th><th>In the app</th><th>Email</th></tr></thead><tbody>
    ${rows.map(([t, d], i) => `<tr><td><b>${t}</b><div class="xs mut">${d}</div></td><td>${tog(true)}</td><td>${tog(i < 3)}</td></tr>`).join('')}
    </tbody></table>
    <div class="row" style="gap:12px;padding:10px;border-radius:12px;background:${C.raised}">${icon('bellOff', 16)}<div style="flex:1"><b style="font-size:12.5px">Quiet hours</b><div class="xs mut">No emails 8 pm – 8 am and on weekends — they wait in a morning summary.</div></div>${tog(true)}</div>
    <div class="row" style="gap:12px;padding:10px;border-radius:12px;background:${C.raised}">${icon('mail', 16)}<div style="flex:1"><b style="font-size:12.5px">Daily summary instead</b><div class="xs mut">One email at 9 am with everything from yesterday.</div></div>${tog(false)}</div>
  </div>
  <div class="pane">
    <div class="card sec2"><b style="font-size:14px">${icon('dashboard', 15)} Home & views</b>
      <div class="xs mut">Drag to choose what your Home shows first.</div>
      ${['My week', 'Waiting for me', 'Who’s off', 'Celebrations', 'Announcements'].map((t, i) => `<div class="row" style="gap:10px;padding:8px 10px;border-radius:10px;border:1px solid ${C.border};${i === 4 ? 'opacity:.5' : ''}"><span class="mut">⋮⋮</span><span style="flex:1;font-size:12.5px;font-weight:700">${t}</span>${tog(i !== 4)}</div>`).join('')}
      <div class="xs mut">Saved views (3) and Moments stay here too.</div>
    </div>
    <div class="card sec2"><b style="font-size:14px">${icon('eye', 15)} Accessibility</b>
      ${[['Less motion', 'No moving backgrounds or confetti', false], ['Stronger contrast', 'Darker text and borders', false], ['Always show focus outline', 'For keyboard users', true], ['Underline links', '', false]].map(([t, d, on]) => `<div class="row" style="gap:10px"><div style="flex:1"><b style="font-size:12.5px">${t}</b>${d ? `<div class="xs mut">${d}</div>` : ''}</div>${tog(on)}</div>`).join('')}
    </div>
  </div>
</div>
${note([['old', 'One email on/off switch today; density, text size and less motion exist.'], ['new', 'Notifications per topic: in the app and/or email; quiet hours; a daily summary.'], ['new', 'Home order (show/hide cards), stronger contrast, focus outline, underline links.'], ['q', 'Is this list of topics right? Should quiet hours be on by default?']])}
`);
  return dcPage('Settings — preferences more', css, html, 980);
}

// ─── 8 · Animation ideas ────────────────────────────────────
function motion() {
  const demos = [
    ['Colours fly out of the logo', 'Branding', 'Drop a logo → 5 colour dots fly out and line up.', `${logo(46, 12)}${[B.a, B.b, B.c, B.d, B.ink].map((c, i) => `<span class="flyc" style="position:absolute;left:50%;top:50%;width:18px;height:18px;border-radius:50%;background:${c};--x:${(i - 2) * 30}px;--y:44px;animation-delay:${i * 0.08}s"></span>`).join('')}`],
    ['Theme wave', 'Theme', 'Publishing sweeps the new colours across the preview from the corner.', `<div style="position:relative;width:160px;height:90px;border-radius:12px;background:linear-gradient(135deg,#4F46E5,#0EA5E9)"><div class="wave" style="position:absolute;inset:0;border-radius:12px;background:linear-gradient(135deg,${B.a},${B.b})"></div></div>`],
    ['Sun ↔ moon', 'Preferences', 'Light/dark switch turns over like a coin.', `<span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(90deg,#FDE68A 50%,#1F1C2B 50%);display:inline-block;animation:sunmoon 3s ease-in-out infinite alternate"></span>`],
    ['Before / after slider', 'Theme', 'The line glides once to show the change, then you drag it.', `<div style="position:relative;width:170px;height:80px;border-radius:10px;overflow:hidden;background:linear-gradient(90deg,#4F46E5 0 50%,${B.a} 50%)"><span style="position:absolute;top:0;bottom:0;width:3px;background:#fff;animation:slidex 3s ease-in-out infinite"></span></div>`],
    ['Baton pass', 'Delegation', 'Handing over: the baton slides from your photo to theirs.', `<div style="position:relative;width:180px;height:50px">${['left:0', 'right:0'].map((p, i) => `<span style="position:absolute;${p};top:8px">${av(i ? 0 : 1, 34)}</span>`).join('')}<span style="position:absolute;top:18px;animation:passb 2.6s ease-in-out infinite alternate;font-size:20px">🏃</span></div>`],
    ['Days-left ring', 'Delegation', 'While covering, a ring empties day by day.', `<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="none" stroke="${C.line}" stroke-width="7"/><circle cx="35" cy="35" r="28" fill="none" stroke="${C.ok}" stroke-width="7" stroke-linecap="round" stroke-dasharray="176" style="--o:120;animation:ringd 3s ease-in-out infinite alternate" transform="rotate(-90 35 35)"/></svg>`],
    ['Clock spins to the new time', 'Preferences', 'Changing time zone turns the clock hands to the new time.', `<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="30" fill="#fff" stroke="${C.border}" stroke-width="2"/><line x1="35" y1="35" x2="35" y2="14" stroke="${C.pri}" stroke-width="3" stroke-linecap="round" style="transform-origin:35px 35px;animation:hand 3s linear infinite"/></svg>`],
    ['“Saved ✓” pill', 'Preferences', 'No Save button — a small pill pops in after each change.', `<span class="saved" style="font-size:14px;padding:6px 14px;animation:pop .5s ease infinite alternate">${icon('check2', 14)} Saved</span>`],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Settings · motion</div><h1 style="margin:4px 0">Animation ideas (live)</h1><div class="sub">Short moves that explain a change. All respect “Less motion” and the Simple background.</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${demos.map(([t, w, d, s]) => `<div class="demo"><div class="stage">${s}</div><span class="where">${w}</span><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}</div>
</div>`;
  return dcPage('Settings — motion', css, html, 760);
}

// ─── 9 · Who sees what ──────────────────────────────────────
function whoSees() {
  const cols = ['Employee', 'Team Lead / Manager', 'HR', 'Company Admin'];
  const rows = [
    ['Branding (edit)', '—', '—', 'if given branding.manage', 'yes'],
    ['Theme (edit, versions, seasonal)', '—', '—', 'if given branding.manage', 'yes'],
    ['Delegation — hand over mine', '—', 'yes (they approve)', 'yes', 'yes'],
    ['Delegation — company timeline, on behalf', '—', '—', 'yes (user.view / user.edit)', 'yes'],
    ['“While you were away” recap', '—', 'yes', 'yes', 'yes'],
    ['Preferences (all sections)', 'yes', 'yes', 'yes', 'yes'],
    ['Choices limited by “What employees can change”', 'yes', 'yes', 'yes', 'no — sets them'],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:14px;min-height:100vh">
<div><div class="eyebrow">Settings</div><h1 style="margin:4px 0">Who sees and does what</h1><div class="sub">Same permissions as today. Nothing new is opened to employees.</div></div>
<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Thing</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? 'xs' : ''}" style="${i ? (c === '—' ? `color:${C.muted}` : `font-weight:700;color:${C.ok}`) : 'font-weight:700'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
</div>`;
  return dcPage('Settings — who sees', css, html, 560);
}

const boards = [
  ['CASetOverview.dc.html', 'Settings · Plan — 4 pages, what’s new, build size, questions', overview, 760],
  ['CASetBranding.dc.html', 'Settings · Branding — brand kit with live previews (tab, menu, sign-in, email), colours from logo', branding, 1180],
  ['CASetTheme.dc.html', 'Settings · Theme studio — real-screen preview, light + dark side by side, easy-to-read checks, before/after', theme, 1240],
  ['CASetThemeMore.dc.html', 'Settings · Theme — versions + restore, seasonal theme, what employees can change', themeMore, 980],
  ['CASetDelegation.dc.html', 'Settings · Delegation — going away banner, best covers, team timeline, hand over', delegation, 1180],
  ['CASetDelegationMore.dc.html', 'Settings · Delegation — welcome-back recap, covering card, company timeline', delegationMore, 1000],
  ['CASetPreferences.dc.html', 'Settings · Preferences — index + search, saved as you go, look + region, live preview', preferences, 1180],
  ['CASetPrefMore.dc.html', 'Settings · Preferences — notifications per topic, quiet hours, home order, accessibility', prefMore, 980],
  ['CASetMotion.dc.html', 'Settings · Animation ideas (live)', motion, 760],
  ['CASetWhoSees.dc.html', 'Settings · Who sees and does what', whoSees, 560],
];
module.exports = { css, sidebar, header, top, page, logo, sw, tog, B };
if (require.main === module) {
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
let maxY = 0;
for (const [f, b] of Object.entries(canvas.boards)) if (!boards.some(([x]) => x === f)) maxY = Math.max(maxY, b.y + b.h);
const Y = Math.ceil((maxY + 700) / 100) * 100;
boards.forEach(([f, title, , h], i) => {
  const pos = i === 0 ? { x: 0, y: Y } : { x: ((i - 1) % 4) * 1520, y: Y + 1100 + Math.floor((i - 1) / 4) * 1520 };
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, ...pos };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
const id = Object.entries(canvas.notes).find(([, n]) => n.text?.startsWith('Company · Settings'))?.[0] ?? `n${Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1}`;
canvas.notes[id] = { kind: 'title1', maxW: 7600, text: 'Company · Settings — branding, theme studio, versions, delegation, preferences, notifications', w: 240, x: 0, y: Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards at y', Y, 'note', id);
}
