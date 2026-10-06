// New sidebar styles (replacing Rail): "Glide" — a floating card that folds to
// icons with tree-line sub-menus (Dribbble reference) — and "Peek" — an icon
// rail that opens over the page on hover, with a pin (Velora reference).
const fs = require('fs');
const path = require('path');
const { dcPage } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

// lucide-style icons (24 grid, stroke)
const I = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  mega: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  life: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  pin: '<path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
const ic = (k, s = 18, extra = '') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${I[k]}</svg>`;

// The real menu (company portal)
const GROUPS = [
  ['Overview', 'home', ['Home', 'My profile', 'Reports & analytics', 'People']],
  ['Organization', 'users', ['Employees', 'Organisation']],
  ['Engagement', 'mega', ['Announcements', 'Kudos']],
  ['Work', 'folder', ['Projects', 'My timesheet', 'Timesheet approvals']],
  ['Expenses', 'receipt', ['My expenses', 'Expense approvals', 'Payments & reports']],
  ['Assets', 'box', ['My assets', 'Asset requests', 'Asset register']],
  ['Helpdesk', 'life', ['My tickets', 'Ticket queue']],
  ['Time', 'clock', ['My attendance', 'My leave', 'Leave approvals', 'Who’s off', 'Holidays']],
  ['Administration', 'shield', ['Users', 'Roles & permissions', 'Access explorer']],
  ['Settings', 'sliders', ['Branding', 'Theme', 'Delegation', 'Preferences']],
];
const COUNTS = { 'Leave approvals': 3, 'Expense approvals': 2, 'Ticket queue': 7, Announcements: 1 };

const css = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
.w{--bg:#F4F4F8;--side:#FFFFFF;--card:#FFFFFF;--border:#E7E7EF;--fg:#16162A;--mut:#74748C;--soft:#F1F0FB;--pri:#5B4FE9;--priS:#EEECFF;--line:#DCDCE8;font-family:Manrope,system-ui,sans-serif;color:var(--fg);background:var(--bg);min-height:100vh;padding:34px 40px}
.w.dark{--bg:#0E0E16;--side:#16161F;--card:#1B1B26;--border:#2A2A3A;--fg:#ECECF5;--mut:#8F8FA8;--soft:#22222F;--pri:#8B80FF;--priS:#2A2650;--line:#33334A}
h1{font-size:26px;font-weight:800;letter-spacing:-.02em}
.sub{color:var(--mut);font-size:14px;margin-top:6px;max-width:980px;line-height:1.5}
.lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.row{display:flex;gap:28px;align-items:flex-start;margin-top:26px}
.cap{display:flex;flex-direction:column;gap:10px}
.cap>b{font-size:12px;letter-spacing:.06em;color:var(--mut)}
/* app frame */
.frame{display:flex;gap:14px;height:820px;border-radius:22px;background:var(--bg);border:1px solid var(--border);padding:14px;overflow:hidden;position:relative}
.page{flex:1;display:flex;flex-direction:column;gap:14px;min-width:0}
.top{height:44px;display:flex;align-items:center;gap:10px;color:var(--mut);font-size:13px}
.ph{background:var(--card);border:1px solid var(--border);border-radius:16px}
/* Glide sidebar */
.gl{width:262px;flex:none;background:var(--side);border:1px solid var(--border);border-radius:20px;box-shadow:0 10px 30px -18px #1a1a4a33;display:flex;flex-direction:column;padding:14px 12px;gap:6px;position:relative}
.gl .brand{display:flex;align-items:center;gap:10px;padding:2px 4px 8px}
.gl .logo{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,var(--pri),#9B5CF6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex:none}
.gl .handle{position:absolute;right:-12px;top:22px;width:24px;height:24px;border-radius:50%;background:var(--card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--mut);box-shadow:0 2px 6px #0000001a}
.gl .srch{display:flex;align-items:center;gap:8px;height:38px;border-radius:11px;border:1px solid var(--border);padding:0 10px;color:var(--mut);font-size:13px;margin-bottom:6px}
.kbd{font-size:10px;font-weight:700;border:1px solid var(--border);border-radius:5px;padding:1px 5px;color:var(--mut);background:var(--bg)}
.gl .sec{padding:10px 8px 4px}
.it{display:flex;align-items:center;gap:10px;height:38px;border-radius:11px;padding:0 10px;font-size:13.5px;font-weight:600;color:var(--mut);position:relative}
.it svg{flex:none}
.it.on{background:var(--soft);color:var(--fg)}
.it.on>svg{color:var(--pri)}
.it .ch{margin-left:auto;color:var(--mut)}
.cnt{margin-left:auto;font-size:10.5px;font-weight:800;min-width:20px;height:18px;border-radius:99px;background:var(--pri);color:#fff;display:flex;align-items:center;justify-content:center;padding:0 6px}
/* tree lines under an open group */
.tree{position:relative;margin:2px 0 4px 26px;padding-left:14px;display:flex;flex-direction:column;gap:2px}
.tree::before{content:'';position:absolute;left:0;top:-4px;bottom:16px;width:1.5px;background:var(--line);border-radius:2px}
.tree .s{position:relative;height:32px;display:flex;align-items:center;padding:0 10px;border-radius:9px;font-size:13px;color:var(--mut);font-weight:600}
.tree .s::before{content:'';position:absolute;left:-14px;top:50%;width:12px;height:12px;margin-top:-12px;border-left:1.5px solid var(--line);border-bottom:1.5px solid var(--line);border-bottom-left-radius:8px}
.tree .s.on{background:var(--soft);color:var(--fg)}
.tree .s.on::after{content:'';position:absolute;left:-17px;top:50%;width:7px;height:7px;margin-top:-4px;border-radius:50%;background:var(--pri);box-shadow:0 0 0 3px var(--priS)}
.me{margin-top:auto;display:flex;align-items:center;gap:10px;padding:10px 8px 2px;border-top:1px solid var(--border)}
.av{width:32px;height:32px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff}
/* folded */
.gl.fold{width:76px;align-items:center;padding:14px 10px}
.gl.fold .it{width:46px;justify-content:center;padding:0}
.fly{position:absolute;left:84px;width:236px;background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 18px 40px -16px #1a1a4a55;padding:10px 10px 10px 8px;z-index:3}
.fly .t{font-size:12px;font-weight:800;padding:2px 8px 8px;display:flex;align-items:center;gap:8px}
.fly .tree{margin-left:12px}
.tip{position:absolute;left:84px;background:var(--fg);color:var(--bg);font-size:12px;font-weight:700;padding:6px 10px;border-radius:8px;white-space:nowrap}
.tip::before{content:'';position:absolute;left:-4px;top:50%;margin-top:-4px;width:8px;height:8px;background:var(--fg);transform:rotate(45deg)}
.dot{position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:#E5484D;border:2px solid var(--side)}
/* live motion demo */
.live .gl{animation:gw 7s cubic-bezier(.65,0,.25,1) infinite;overflow:hidden}
@keyframes gw{0%,8%{width:76px}22%,62%{width:262px}76%,100%{width:76px}}
.live .txt{white-space:nowrap;animation:gt 7s ease infinite}
@keyframes gt{0%,12%{opacity:0;transform:translateX(-6px)}24%,58%{opacity:1;transform:none}66%,100%{opacity:0;transform:translateX(-6px)}}
.live .tree{animation:gtree 7s ease infinite;transform-origin:top;overflow:hidden}
@keyframes gtree{0%,24%{max-height:0;opacity:0}36%,58%{max-height:200px;opacity:1}68%,100%{max-height:0;opacity:0}}
.live .pill{position:absolute;left:12px;right:12px;height:38px;border-radius:11px;background:var(--soft);animation:gp 7s cubic-bezier(.5,1.4,.5,1) infinite;z-index:0}
@keyframes gp{0%,30%{top:var(--a)}40%,100%{top:var(--b)}}
.live .it{z-index:1;background:transparent!important}
.live .handle svg{animation:gh 7s ease infinite}
@keyframes gh{0%,15%{transform:rotate(0)}22%,62%{transform:rotate(180deg)}76%,100%{transform:rotate(0)}}
.frames{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:22px}
.fr{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:340px}
.fr .r svg{flex:none}
.fr .stub{min-height:230px}
.fr .stub{display:flex;gap:8px;flex:1}
.fr .bar{background:var(--side);border:1px solid var(--border);border-radius:14px;padding:10px 8px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.fr .r{display:flex;align-items:center;gap:8px;height:28px;border-radius:8px;padding:0 7px;color:var(--mut);font-size:11.5px;font-weight:600;white-space:nowrap}
.fr .r.on{background:var(--soft);color:var(--fg)}
.fr p{font-size:12px;color:var(--mut);line-height:1.45}
.fr p b{color:var(--fg)}
.tl{display:grid;grid-template-columns:170px 1fr;gap:8px 14px;align-items:center;font-size:12px;margin-top:8px}
.tl .tr{position:relative;height:12px;border-radius:99px;background:var(--soft)}
.tl .tr span{position:absolute;top:0;bottom:0;border-radius:99px;background:var(--c)}
/* Peek (hover) */
.peek{width:68px;flex:none;background:var(--side);border:1px solid var(--border);border-radius:18px;display:flex;flex-direction:column;align-items:center;padding:12px 8px;gap:4px;position:relative}
.peek .it{width:46px;justify-content:center;padding:0}
.peek.open{position:absolute;left:14px;top:14px;bottom:14px;width:252px;align-items:stretch;padding:12px;z-index:4;box-shadow:24px 0 60px -20px #00000088}
.peek.open .it{width:auto;justify-content:flex-start;padding:0 10px}
.pinrow{margin-top:auto;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--mut);padding:8px 10px;border-top:1px solid var(--border)}
.sw{margin-left:auto;width:34px;height:20px;border-radius:99px;background:var(--line);position:relative}
.sw::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff}
.sw.on{background:var(--pri)}.sw.on::after{left:16px}
.dim{position:absolute;inset:14px 14px 14px 90px;border-radius:16px;background:#00000040}
/* phone */
.phone{width:330px;height:680px;border-radius:40px;border:9px solid #111;background:var(--bg);overflow:hidden;position:relative;flex:none}
.pick{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.opt{border:1.5px solid var(--border);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--card)}
.opt.on{border-color:var(--pri);box-shadow:0 0 0 3px var(--priS)}
.sk{height:86px;border-radius:9px;background:var(--bg);border:1px solid var(--border);display:flex;gap:5px;padding:5px;overflow:hidden}
.sk i{display:block;border-radius:4px;background:var(--line)}
.new{font-size:9.5px;font-weight:800;color:#fff;background:var(--pri);border-radius:99px;padding:1px 6px;margin-left:6px}
.note{font-size:12.5px;color:var(--mut);line-height:1.55;max-width:560px}
.note b{color:var(--fg)}
</style>`;

const avatar = (n, c) => `<span class="av" style="background:${c}">${n}</span>`;
const pageStub = (title, area = 'Time') => `<div class="page"><div class="top">Home <span style="opacity:.5">›</span> <b style="color:var(--fg)">${title}</b><span style="margin-left:auto;display:flex;gap:10px">${ic('bell', 17)}</span></div>
  <div class="ph" style="height:96px;padding:18px 20px"><div class="lbl">${area}</div><div style="font-size:22px;font-weight:800;margin-top:6px">${title}</div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${[0, 1, 2, 3].map(() => '<div class="ph" style="height:96px"></div>').join('')}</div>
  <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px;flex:1">${'<div class="ph"></div>'.repeat(2)}</div></div>`;

function item(name, icon, { on, open, chev, count } = {}) {
  return `<div class="it${on ? ' on' : ''}">${ic(icon)}<span class="txt">${name}</span>${count ? `<span class="cnt">${count}</span>` : chev ? `<span class="ch">${ic(open ? 'chevD' : 'chevR', 14)}</span>` : ''}</div>`;
}
const tree = (subs, active) => `<div class="tree">${subs.map((s) => `<div class="s${s === active ? ' on' : ''}"><span>${s}</span>${COUNTS[s] ? `<span class="cnt" style="margin-left:auto">${COUNTS[s]}</span>` : ''}</div>`).join('')}</div>`;

function glide({ fold = false, open = 'Time', active = 'My leave', live = false } = {}) {
  const groups = GROUPS.slice(0, 9);
  const sec = (t) => (fold ? '<div style="height:1px;width:28px;background:var(--border);margin:8px 0"></div>' : `<div class="sec lbl txt">${t}</div>`);
  let html = `<div class="gl${fold ? ' fold' : ''}">
    <div class="brand"><span class="logo">AP</span>${fold ? '' : '<span class="txt" style="line-height:1.2"><b style="font-size:14px">aakash-portal</b><br><span style="font-size:11px;color:var(--mut)">People first</span></span>'}</div>
    <span class="handle">${ic(fold ? 'chevR' : 'chevL', 14)}</span>
    ${fold ? `<div class="it">${ic('search')}</div>` : `<div class="srch">${ic('search', 15)}<span class="txt">Search menu</span><span class="kbd" style="margin-left:auto">Ctrl K</span></div>`}
    ${sec('Main')}`;
  groups.forEach(([g, icon, subs], i) => {
    if (i === 4) html += sec('More');
    const isOpen = g === open;
    const total = subs.reduce((n, s) => n + (COUNTS[s] ?? 0), 0);
    html += fold
      ? `<div class="it${isOpen ? ' on' : ''}" style="position:relative">${ic(icon)}${total ? '<span class="dot"></span>' : ''}</div>`
      : item(g, icon, { on: isOpen, open: isOpen, chev: subs.length > 1, count: !isOpen && total ? total : 0 }) + (isOpen ? tree(subs, active) : '');
  });
  html += fold ? '' : `${sec('Pinned')}${item('Who’s off', 'star')}`;
  html += `<div class="me">${avatar('BP', '#E0577A')}${fold ? '' : `<span class="txt" style="line-height:1.2;flex:1;min-width:0"><b style="font-size:13px">Bhanu Prakash</b><br><span style="font-size:11px;color:var(--mut)">HR Manager</span></span>${ic('chevD', 14)}`}</div></div>`;
  return html;
}

// ── Board 1: Glide open + folded
function boardGlide() {
  return `<div class="w"><h1>Glide — the new sidebar (replaces Rail)</h1>
  <p class="sub">A floating card, like the Dribbble shot. <b>Open:</b> sections fold out with thin tree lines to their pages, counts sit on the right, a <b>Pinned</b> area holds your own shortcuts. <b>Folded:</b> one icon per section — hover shows its name, click pops its pages out in a small card with the same tree lines. The round handle on the edge folds / unfolds it (also <span class="kbd">Ctrl</span> <span class="kbd">\\</span>).</p>
  <div class="row">
    <div class="cap" style="flex:1.25"><b>OPEN · “TIME” SECTION OPEN, ON “MY LEAVE”</b><div class="frame">${glide()}${pageStub('My leave')}</div></div>
    <div class="cap" style="flex:1"><b>FOLDED · “TIME” PAGES POPPED OUT · TOOLTIP ON HOVER</b><div class="frame">${glide({ fold: true })}
      <div class="fly" style="top:458px"><div class="t">${ic('clock', 15)} Time</div>${tree(GROUPS[7][2], 'My leave')}</div>
      <div class="tip" style="top:333px">Expenses · 2 waiting</div>
      ${pageStub('My leave')}</div></div>
  </div></div>`;
}

// ── Board 2: motion
function boardMotion() {
  const a = 120 + 4 * 0; // pill positions inside the live demo (approx rows)
  const frames = [
    [76, 'Folded', 'Only icons. A red dot means something inside is waiting.'],
    [150, 'Opening · 120 ms', 'The card <b>widens with a soft spring</b>; icons stay put so nothing jumps.'],
    [210, 'Opening · 220 ms', 'Labels <b>fade and slide in</b> from the left, top to bottom (20 ms apart).'],
    [262, 'Open · 320 ms', 'The current section <b>unfolds its tree</b> — lines draw down, pages drop in.'],
  ];
  return `<div class="w"><h1>Glide — how it moves</h1>
  <p class="sub">Left: the real thing, looping (fold → open → fold). The highlight <b>glides</b> from one page to the next instead of jumping, and the edge handle turns as it opens. Right: the same moment frame by frame.</p>
  <div class="row">
    <div class="cap live"><b>LIVE · LOOPS EVERY 7 S</b><div class="frame" style="width:560px;height:760px">
      <div class="gl" style="position:relative">
        <div class="pill" style="--a:${a + 58}px;--b:${a + 330}px"></div>
        <div class="brand"><span class="logo">AP</span><span class="txt" style="line-height:1.2"><b style="font-size:14px">aakash-portal</b></span></div>
        <span class="handle">${ic('chevR', 14)}</span>
        ${GROUPS.slice(0, 8).map(([g, icon, subs], i) => item(g, icon, {}) + (i === 7 ? tree(subs.slice(0, 3), 'My leave') : '')).join('')}
      </div>
      <div class="page"><div class="ph" style="height:90px"></div><div class="ph" style="flex:1"></div></div>
    </div></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:18px">
      <div class="frames">${frames.map(([w, t, p], i) => `<div class="fr"><span class="lbl">${t}</span><div class="stub"><div class="bar" style="width:${Math.round(w * 0.62)}px">${GROUPS.slice(0, 6).map(([g, icon], k) => `<div class="r${k === 1 ? ' on' : ''}">${ic(icon, 15)}${w > 100 ? `<span style="opacity:${i === 1 ? 0 : i === 2 ? (k < 3 ? 1 : 0.35) : 1}">${g}</span>` : ''}</div>`).join('')}${i === 3 ? `<div style="margin-left:18px;border-left:1.5px solid var(--line);padding-left:8px;display:flex;flex-direction:column;gap:4px">${['Employees', 'Organisation'].map((s, k) => `<div class="r${k === 0 ? ' on' : ''}" style="height:22px">${s}</div>`).join('')}</div>` : ''}</div><div style="flex:1;border-radius:12px;background:var(--bg);border:1px dashed var(--border)"></div></div><p>${p}</p></div>`).join('')}</div>
      <div class="ph" style="padding:18px 20px"><div class="lbl">Timing</div><div class="tl">${[
        ['Card widens', 0, 320, 'var(--pri)'],
        ['Handle turns', 0, 260, '#9B5CF6'],
        ['Labels fade + slide in', 90, 260, '#0EA5E9'],
        ['Tree lines draw', 220, 200, '#16A34A'],
        ['Highlight glides', 0, 280, '#F59E0B'],
        ['Popped-out card (folded)', 0, 180, '#E0577A'],
      ].map(([l, s, d, c]) => `<span>${l}</span><div class="tr"><span style="left:${(s / 500) * 100}%;width:${(d / 500) * 100}%;--c:${c}"></span></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mut);margin:6px 0 0 184px">${[0, 100, 200, 300, 400, 500].map((t) => `<span>${t} ms</span>`).join('')}</div></div>
      <p class="note"><b>Remembers your choice</b> (open or folded) on your account. With <b>Reduce motion</b> on it simply switches. On screens under 1024 px it is always the phone drawer.</p>
    </div>
  </div></div>`;
}

// ── Board 3: Peek (hover) in dark
function boardPeek() {
  const rail = (open) => `<div class="peek${open ? ' open' : ''}">
    <div class="brand" style="display:flex;align-items:center;gap:10px;padding:2px 2px 10px"><span class="logo" style="width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--pri),#9B5CF6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px">AP</span>${open ? '<b style="font-size:14px">aakash-portal</b>' : ''}</div>
    ${GROUPS.map(([g, icon, subs]) => {
      const total = subs.reduce((n, s) => n + (COUNTS[s] ?? 0), 0);
      return open ? item(g, icon, { on: g === 'Expenses', count: total }) + (g === 'Expenses' ? tree(subs, 'Expense approvals') : '') : `<div class="it${g === 'Expenses' ? ' on' : ''}" style="position:relative">${ic(icon)}${total ? '<span class="dot"></span>' : ''}</div>`;
    }).join('')}
    ${open ? `<div class="pinrow">${ic('pin', 15)} Keep open<span class="sw"></span></div>` : `<div style="margin-top:auto;color:var(--mut);padding:8px">${ic('pin', 16)}</div>`}
  </div>`;
  return `<div class="w dark"><h1>Peek — icons that open on hover</h1>
  <p class="sub">Like the Velora sidebar. At rest it is a slim icon rail, so pages get the most room. <b>Point at it (or Tab into it)</b> and it opens <b>over</b> the page — the page doesn’t move. Move away and it slides shut. <b>Keep open</b> pins it like a normal sidebar.</p>
  <div class="row">
    <div class="cap" style="flex:1"><b>AT REST · 68 PX</b><div class="frame" style="height:780px">${rail(false)}${pageStub('Expense approvals', 'Expenses')}</div></div>
    <div class="cap" style="flex:1"><b>POINTED AT · OPENS OVER THE PAGE (180 MS)</b><div class="frame" style="height:780px"><div class="peek"></div>${pageStub('Expense approvals', 'Expenses')}<div class="dim"></div>${rail(true)}</div></div>
  </div>
  <p class="note" style="margin-top:18px"><b>Small delay on purpose:</b> it opens after the pointer rests 150 ms, so sweeping past to the page doesn’t flash it open. Closes 250 ms after the pointer leaves.</p></div>`;
}

// ── Board 4: phone + picker
function boardPhone() {
  const phone = (dark) => `<div class="phone w${dark ? ' dark' : ''}" style="padding:0">
    <div style="position:absolute;inset:0;padding:46px 0 0">${pageStub('My leave').replace('class="page"', 'class="page" style="padding:0 14px;opacity:.5"')}</div>
    <div style="position:absolute;inset:0;background:#0006"></div>
    <div style="position:absolute;left:0;top:0;bottom:0;width:270px;background:var(--side);border-radius:0 24px 24px 0;padding:46px 12px 14px;display:flex;flex-direction:column;gap:4px;box-shadow:20px 0 50px #0005">
      <div style="display:flex;align-items:center;gap:10px;padding:0 6px 10px"><span class="logo" style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,var(--pri),#9B5CF6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px">AP</span><b style="font-size:14px;flex:1">aakash-portal</b><span style="color:var(--mut)">${ic('x', 18)}</span></div>
      <div class="srch" style="display:flex;align-items:center;gap:8px;height:36px;border-radius:11px;border:1px solid var(--border);padding:0 10px;color:var(--mut);font-size:13px;margin-bottom:6px">${ic('search', 15)} Search menu</div>
      ${GROUPS.slice(0, 7).map(([g, icon, subs]) => item(g, icon, { on: g === 'Time', chev: true }) ).join('')}
      ${item('Time', 'clock', { on: true, open: true, chev: true })}${tree(['My attendance', 'My leave', 'Leave approvals'], 'My leave')}
      <div class="me" style="margin-top:auto">${avatar('BP', '#E0577A')}<b style="font-size:13px">Bhanu Prakash</b></div>
    </div></div>`;
  const opts = [
    ['Classic', 'Every section open', false, false, '<i style="width:30%"></i><span style="flex:1;display:grid;gap:5px;grid-template-rows:1fr 2fr"><i></i><i></i></span>'],
    ['Glide', 'Floating card that folds to icons', true, true, '<i style="width:30%;border-radius:8px;background:var(--pri);opacity:.6"></i><span style="flex:1;display:grid;gap:5px;grid-template-rows:1fr 2fr"><i></i><i></i></span>'],
    ['Peek', 'Icons that open on hover', true, false, '<i style="width:12%;background:var(--pri);opacity:.6"></i><span style="flex:1;display:grid;gap:5px;grid-template-rows:1fr 2fr"><i></i><i></i></span>'],
    ['Floating', 'Rounded card with quick search', false, false, '<i style="width:30%;border-radius:8px"></i><span style="flex:1;display:grid;gap:5px;grid-template-rows:1fr 2fr"><i></i><i></i></span>'],
    ['Collapsible', 'Sections fold away', false, false, '<i style="width:30%"></i><span style="flex:1;display:grid;gap:5px;grid-template-rows:1fr 2fr"><i></i><i></i></span>'],
  ];
  return `<div class="w"><h1>Phone drawer + where you pick it</h1>
  <p class="sub">On phones every style becomes the same slide-in drawer (with the tree lines). In <b>Preferences → Look</b> (and the company default in <b>Settings → Theme</b>) the list loses <b>Rail</b> and gains <b>Glide</b> and <b>Peek</b>.</p>
  <div class="row">
    <div class="cap"><b>PHONE · LIGHT</b>${phone(false)}</div>
    <div class="cap"><b>PHONE · DARK</b>${phone(true)}</div>
    <div class="cap" style="flex:1"><b>PREFERENCES → MENU STYLE</b><div class="ph" style="padding:18px;display:flex;flex-direction:column;gap:14px"><div style="font-weight:800">Menu style</div><div class="pick" style="grid-template-columns:repeat(3,1fr)">${opts.map(([n, t, isNew, on, sk]) => `<div class="opt${on ? ' on' : ''}"><div class="sk">${sk}</div><b style="font-size:13px">${n}${isNew ? '<span class="new">NEW</span>' : ''}</b><span style="font-size:11.5px;color:var(--mut)">${t}</span></div>`).join('')}</div><p class="note">Removed: <b>Rail</b> — anyone who had it is back on the company default (already done).</p></div></div>
  </div></div>`;
}

const boards = [
  ['CASideGlide.dc.html', 'Sidebar · Glide — open and folded (light)', () => dcPage('Sidebar — Glide', css, boardGlide(), 1060), 1060],
  ['CASideMotion.dc.html', 'Sidebar · Glide — how it moves (live loop + frames + timing)', () => dcPage('Sidebar — motion', css, boardMotion(), 980), 980],
  ['CASidePeek.dc.html', 'Sidebar · Peek — icon rail that opens on hover (dark)', () => dcPage('Sidebar — Peek', css, boardPeek(), 1060), 1060],
  ['CASidePhone.dc.html', 'Sidebar · phone drawer + menu style picker', () => dcPage('Sidebar — phone + picker', css, boardPhone(), 920), 920],
];
if (require.main === module) {
  for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
  const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
  // keep the chart boards from this session too
  const local = JSON.parse(fs.readFileSync(path.join(OUT, 'canvas.json'), 'utf8'));
  for (const [f, b] of Object.entries(local.boards)) if (!canvas.boards[f]) canvas.boards[f] = b;
  for (const [k, n] of Object.entries(local.notes)) if (!canvas.notes[k]) canvas.notes[k] = n;
  for (const f of local.order) if (!canvas.order.includes(f)) canvas.order.push(f);
  let maxY = 0;
  for (const [f, b] of Object.entries(canvas.boards)) if (!boards.some(([x]) => x === f)) maxY = Math.max(maxY, b.y + b.h);
  const Y = Math.ceil((maxY + 700) / 100) * 100;
  boards.forEach(([f, title, , h], i) => {
    canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: (i % 2) * 1520, y: Y + Math.floor(i / 2) * 1300 };
    if (!canvas.order.includes(f)) canvas.order.push(f);
  });
  const id = Object.entries(canvas.notes).find(([, n]) => n.text?.startsWith('Sidebar · new styles'))?.[0] ?? `n${Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1}`;
  canvas.notes[id] = { kind: 'title1', maxW: 7600, text: 'Sidebar · new styles — Glide (folds to icons, tree-line pages) and Peek (opens on hover); Rail removed', w: 240, x: 0, y: Y - 300 };
  fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
  console.log('built', boards.length, 'boards at y', Y, 'note', id);
}
