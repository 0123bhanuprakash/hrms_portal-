// Company app → Helpdesk: what changes, my tickets, raise a ticket, ticket conversation, ticket queue (list + board),
// agent desk, ticket topics, topic editor, animation ideas (live, light + dark), who sees what.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { sidebar: reportsSidebar, C } = require('./build-reports.js');
const { css: peopleCss, photo } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus2: '<path d="M12 5v14M5 12h14"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  kanban: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5V22h16v-5"/>',
});

const sidebar = (on) =>
  reportsSidebar()
    .replace('<div class="sb-g">TIME</div>', `<div class="sb-g">HELPDESK</div><div class="sb-i">${icon('buoy')}My tickets</div><div class="sb-i">${icon('headset')}Ticket queue</div><div class="sb-i">${icon('tags')}Ticket topics</div><div class="sb-g">TIME</div>`)
    .replace('class="sb-i on"', 'class="sb-i"')
    .replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const NEW = `<span class="new">NEW</span>`;

// Teams (queues) — fixed to IT, HR, Finance
const Q = {
  IT: { l: 'IT', c: C.info, s: C.infoSoft, e: '💻', who: 'Rohit, Kiran', reply: '~2 h' },
  HR: { l: 'HR', c: C.pink, s: '#FCE8F2', e: '🧑‍💼', who: 'Hema', reply: '~4 h' },
  FIN: { l: 'Finance', c: C.ok, s: C.okSoft, e: '💰', who: 'Pooja', reply: '~1 day' },
  DEV: { l: 'DevOps', c: C.violet, s: '#F1EBFE', e: '🚀', who: 'Dev', reply: '~3 h' },
};
const TEAMS = ['IT', 'HR', 'FIN', 'DEV'];
const LIVE = `<span class="xst" style="background:${C.okSoft};color:${C.ok}"><span class="live"></span>Live</span>`;
const PRI = { URGENT: ['Urgent', C.bad, C.badSoft], HIGH: ['High', C.warn, C.warnSoft], MEDIUM: ['Medium', C.info, C.infoSoft], LOW: ['Low', C.muted, C.raised] };
const STS = { OPEN: ['Open', C.info, C.infoSoft], PROG: ['In progress', C.pri, C.priSoft], WAIT: ['Needs your reply', C.warn, C.warnSoft], RES: ['Resolved', C.ok, C.okSoft], CLOSED: ['Closed', C.muted, C.raised] };
const pill = ([l, c, s]) => `<span class="xst" style="background:${s};color:${c}">${l}</span>`;
const team = (k, big) => `<span class="xst" style="background:${Q[k].s};color:${Q[k].c}${big ? ';font-size:11.5px;padding:3px 10px' : ''}">${Q[k].e} ${Q[k].l}</span>`;

// SLA ring: fraction of time used (0..1+)
const ring = (used, size = 38, label = '') => {
  const r = size / 2 - 4, c = 2 * Math.PI * r, f = Math.min(used, 1);
  const col = used >= 1 ? C.bad : used > 0.75 ? C.warn : C.ok;
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${C.line}" stroke-width="4"/><circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="color:${col}">${label}</b></span>`;
};
// SLA burn bar
const burn = (used, text) => {
  const col = used >= 1 ? C.bad : used > 0.75 ? C.warn : C.ok;
  return `<div style="display:flex;flex-direction:column;gap:3px;min-width:120px"><div class="burn"><i style="width:${Math.min(used, 1) * 100}%;background:${col}"></i></div><span class="xs" style="color:${col};font-weight:700">${text}</span></div>`;
};
// Journey (status path)
const journey = (at, waiting) => {
  const steps = ['Sent', 'Picked up', 'Working on it', 'Resolved', 'Closed'];
  return `<div class="jr">${steps.map((s, i) => {
    const done = i < at, now = i === at;
    const col = waiting && now ? C.warn : done || now ? C.pri : C.border;
    return `${i ? `<span class="jl ${done || now ? 'on' : ''}" style="${done || now ? `background:${C.pri}` : ''}"></span>` : ''}<span class="js"><span class="jd ${now ? 'now' : ''}" style="border-color:${col};background:${done ? col : '#fff'};color:${done ? '#fff' : col}">${done ? '✓' : now ? '●' : ''}</span><span class="${now ? '' : 'mut'}" style="${now ? `color:${col};font-weight:800` : ''}">${waiting && now ? 'Waiting for you' : s}</span></span>`;
  }).join('')}</div>`;
};

const css = peopleCss.replace('</style>', `
.new{display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:.06em;padding:2px 6px;border-radius:5px;background:${C.pri};color:#fff;vertical-align:middle;margin-left:4px}
.xst{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.kpi4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi4 .card{padding:12px 14px;display:flex;flex-direction:column;gap:2px;position:relative;overflow:hidden}
.fld{display:flex;flex-direction:column;gap:5px}.fld label{font-size:12px;font-weight:700}.inp{border:1px solid ${C.border};border-radius:10px;padding:8px 11px;font-size:13px;background:#fff;display:flex;align-items:center;gap:8px}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}.tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};text-align:left;padding:8px 10px;background:${C.raised};border-bottom:1px solid ${C.border}}.tbl td{padding:9px 10px;border-bottom:1px solid ${C.line};vertical-align:middle}
.tgl{width:34px;height:20px;border-radius:99px;background:${C.pri};position:relative;flex:none;display:inline-block}.tgl:after{content:'';position:absolute;right:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}.tgl.off{background:#D1D5DB}.tgl.off:after{right:auto;left:3px}
.ring{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none}.ring svg{position:absolute;inset:0}.ring b{font-size:9.5px;font-weight:900;position:relative}
.ring .arc{animation:arcin 1.4s cubic-bezier(.2,.8,.2,1) both}@keyframes arcin{from{stroke-dasharray:0 400}}
.burn{height:6px;border-radius:99px;background:${C.line};overflow:hidden}.burn i{display:block;height:100%;border-radius:99px;transform-origin:left;animation:fw 1.2s cubic-bezier(.2,.8,.2,1) both}
.jr{display:flex;align-items:center;gap:4px}.js{display:flex;align-items:center;gap:6px;font-size:11.5px;white-space:nowrap}
.jd{width:18px;height:18px;border-radius:50%;border:2px solid;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex:none}
.jd.now{animation:pulse 2.6s ease-in-out infinite}@keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${C.pri}40}50%{box-shadow:0 0 0 6px ${C.pri}00}}
.jl{flex:1;min-width:14px;height:2px;border-radius:2px;background:${C.line}}
.tk{border:1px solid ${C.border};border-radius:14px;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:10px;position:relative}
.tk.attn{border-color:${C.warn}88;box-shadow:0 0 0 4px ${C.warnSoft}}
.teamc{border:1.5px solid ${C.border};border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:6px;background:#fff;position:relative;overflow:hidden}
.teamc .em{font-size:28px;width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.teamc.on{border-color:${C.pri};box-shadow:0 0 0 4px ${C.priSoft}}
.live{width:8px;height:8px;border-radius:50%;background:${C.ok};display:inline-block;animation:livep 3s ease-in-out infinite}@keyframes livep{0%,100%{opacity:1}50%{opacity:.35}}
.hero{border-radius:20px;padding:22px 24px;background:linear-gradient(120deg,${C.priSoft},#F5EEFF 55%,#FFF1F6);position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px}
.hero .blob{position:absolute;border-radius:50%;filter:blur(30px);opacity:.55;animation:drift 14s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(40px,-20px)}}
.ask{display:flex;align-items:center;gap:10px;height:50px;border-radius:14px;background:#fff;border:1px solid ${C.border};padding:0 16px;font-size:14.5px;box-shadow:0 8px 24px -14px rgba(79,70,229,.45);position:relative}
.caret{width:2px;height:20px;background:${C.pri};animation:blink 1.1s steps(2) infinite}@keyframes blink{50%{opacity:0}}
.sugg{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid ${C.line}}
.chipq{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:99px;border:1px solid ${C.border};background:#fff;font-size:12px;font-weight:700}
.chipq.on{border-color:${C.pri};background:${C.priSoft};color:${C.priText}}
.bub{max-width:76%;padding:10px 13px;border-radius:16px;font-size:13px;line-height:1.45}
.bub.me{align-self:flex-end;background:${C.pri};color:#fff;border-bottom-right-radius:5px}
.bub.them{align-self:flex-start;background:#fff;border:1px solid ${C.border};border-bottom-left-radius:5px}
.bub.note{align-self:stretch;max-width:none;background:${C.warnSoft};border:1px dashed ${C.warn}88;color:#7C4A03;border-radius:12px}
.evt{align-self:center;font-size:11.5px;color:${C.muted};display:flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;background:${C.raised};border:1px solid ${C.line}}
.typing{display:inline-flex;gap:4px;padding:10px 13px;border-radius:16px;background:#fff;border:1px solid ${C.border};align-self:flex-start}
.typing i{width:6px;height:6px;border-radius:50%;background:${C.muted};animation:dot 1.4s ease-in-out infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.seg span.new,.tabs span.new{padding:2px 5px;border-radius:5px;color:#fff;background:${C.pri}}
.kb{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:5px;border:1px solid ${C.border};border-bottom-width:2px;background:#fff;font-size:10.5px;font-weight:800;color:${C.muted};font-family:monospace}
.col4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start}
.lane{background:${C.raised};border:1px solid ${C.line};border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:520px}
.lane h4{margin:0 2px 2px;font-size:12.5px;display:flex;align-items:center;gap:6px}
.mini{background:#fff;border:1px solid ${C.border};border-radius:12px;padding:10px 11px;display:flex;flex-direction:column;gap:7px;font-size:12px;box-shadow:0 1px 2px rgba(17,24,39,.04)}
.mini.lift{transform:rotate(-2deg) translateY(-4px);box-shadow:0 18px 30px -16px rgba(17,24,39,.35);border-color:${C.pri}}
.mini.ghost{opacity:.35;border-style:dashed}
.drop{border:2px dashed ${C.pri}66;border-radius:12px;height:64px;background:${C.priSoft}66}
.topic{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid ${C.line};font-size:12.5px}
.topic .ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}
.cap{height:8px;border-radius:99px;background:${C.line};overflow:hidden;flex:1}.cap i{display:block;height:100%;border-radius:99px}
.mx td,.mx th{text-align:center}.mx td:first-child,.mx th:first-child{text-align:left}
.y{color:${C.ok};font-weight:900}.n{color:#C4C8D2}.s{font-size:11px;color:${C.muted};font-weight:600}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid ${C.border};border-radius:14px;overflow:hidden;background:#fff}
.cmp>div{padding:12px 14px;font-size:12.5px;border-bottom:1px solid ${C.line}}.cmp>div:nth-child(odd){background:${C.raised};border-right:1px solid ${C.line}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`);

// ─── Board 1: What changes ──────────────────────────────────
function overview() {
  const rows = [
    ['My tickets', 'Tabs + plain list (Open / Needs my reply / Resolved / Closed / All)', '“How can we help?” search with quick answers, 3 team cards with live reply time, ticket cards with a journey line and a “needs your reply” highlight'],
    ['Raise a ticket', 'Dialog: team, topic, subject, details, priority, 1 file', 'Full page in 3 short steps; topic asks its own questions; “these answers may help” before you send; link an asset; see who will help and the reply target'],
    ['Ticket page', 'Message list, reply box, targets card, assign / priority / move', 'Chat style conversation, journey line on top, live typing dots, resolve → rate with faces, reopen with reason, “what we did” summary card'],
    ['Ticket queue', '4 numbers, 6 tabs, search, queue + priority filters, list', 'List ↔ Board view, SLA burn bar on every row, saved views, bulk assign, keyboard shortcuts, team workload, preview panel'],
    ['Teams &amp; heads', 'Anyone with the queue permission works every ticket', 'One head per team gets new tickets and assigns them to people under them; a backup when the head is away'],
    ['Live updates', 'Lists refresh every 1 minute', 'WebSocket: new tickets, replies, typing, status and the bell update at once — across the whole app'],
    ['Agent desk', '(part of ticket page)', 'Context panel: the person, their assets, recent tickets, leave today; merge duplicate; saved replies coming soon; “ask for details” template'],
    ['Ticket topics', 'Per team: name, hidden, edit dialog', 'Icon, starting priority, goes to the team head or one person, questions to ask, a quick answer, use count; drag to reorder; new “Teams &amp; heads” tab'],
  ];
  const ideas = [
    ['✈️', 'Paper plane send', 'Your ticket folds and flies to the team card'],
    ['⏱️', 'SLA rings', 'A ring fills as time passes: green → amber → red'],
    ['🧭', 'Journey line', 'Sent → Picked up → Working → Resolved, the dot breathes'],
    ['💬', 'Typing dots', 'See live when the other side is writing (WebSocket)'],
    ['🎉', 'Solved moment', 'Soft check-mark burst + rate with faces'],
    ['🗂️', 'Board view', 'Drag a card to “Working on it”, it lifts and tilts'],
  ];
  const html = `<div class="app">${sidebar('My tickets')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; <b>What changes</b>')}<main class="main">
${top('Helpdesk', 'Helpdesk — what changes', 'Same 3 sidebar items. Teams: IT, HR, Finance + <b>DevOps</b> (new). Each team has a <b>head</b> who assigns tickets. Updates are <b>live</b> (WebSocket). Nothing removed.')}
<div class="card" style="overflow:hidden"><table class="tbl"><tr><th style="width:150px">Screen</th><th>Today</th><th>New design</th></tr>
${rows.map(([s, a, b]) => `<tr><td><b>${s}</b></td><td class="mut">${a}</td><td>${b} ${NEW}</td></tr>`).join('')}</table></div>
<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px">
<div class="card sec"><h3>${icon('sparkle', 16)}Motion &amp; new UI ideas <span class="r">all slow, soft, and off with “Reduce motion”</span></h3>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${ideas.map(([e, t, d]) => `<div class="lib" style="align-items:flex-start"><span style="font-size:22px">${e}</span><div><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div></div>`).join('')}</div></div>
<div class="card sec"><h3>${icon('clock', 16)}Reply targets (stay the same)</h3>
<table class="tbl"><tr><th>Priority</th><th>First reply</th><th>Solve</th></tr>
${[['URGENT', '1 h', '8 h'], ['HIGH', '4 h', '1 day'], ['MEDIUM', '8 h', '3 days'], ['LOW', '1 day', '5 days']].map(([p, a, b]) => `<tr><td>${pill(PRI[p])}</td><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
<div class="xs mut">Resolved tickets close on their own after 7 days. Employees pick up to High; the team can raise to Urgent. Targets stay priority based.</div></div>
</div>
<div class="row xs mut" style="gap:14px">${['Page backgrounds (Signature “Helpdesk” mood) stay behind every screen', 'Dark + light shown on the animation board', 'No anonymous tickets — the person is always shown'].map((t) => `<span class="row" style="gap:6px">${icon('check', 13)}${t}</span>`).join('')}</div>
</main></div></div>`;
  return dcPage('Helpdesk — what changes', css, html, 1000);
}

// ─── Board 2: My tickets ────────────────────────────────────
function mine() {
  const tks = [
    { n: 231, q: 'IT', s: 'VPN disconnects every 20 minutes', topic: 'Network & VPN', st: 'WAIT', at: 2, wait: true, pri: 'HIGH', who: [3, 'Rohit'], last: 'Rohit: “Can you send a screenshot of the error?” · 25 min ago', used: 0.45, due: 'Solve by 6 pm today' },
    { n: 228, q: 'FIN', s: 'Travel claim for Pune trip not paid', topic: 'Reimbursements', st: 'PROG', at: 2, pri: 'MEDIUM', who: [7, 'Pooja'], last: 'Pooja is checking with the bank · 3 h ago', used: 0.6, due: 'Solve by Wed 7 Oct' },
    { n: 226, q: 'HR', s: 'Need an address-proof letter for bank', topic: 'Letters & documents', st: 'OPEN', at: 1, pri: 'LOW', who: null, last: 'Waiting for HR to pick it up · usually ~4 h', used: 0.2, due: 'First reply by 4:30 pm' },
  ];
  const html = `<div class="app">${sidebar('My tickets')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; <b>My tickets</b>')}<main class="main">
<div class="hero"><span class="blob" style="width:220px;height:220px;background:#C7D2FE;right:40px;top:-80px"></span><span class="blob" style="width:180px;height:180px;background:#FBCFE8;right:260px;bottom:-110px;animation-delay:-6s"></span>
<div style="position:relative"><div class="eyebrow">Helpdesk</div><h1>Hi Amit, how can we help?</h1><div class="sub">Ask IT, HR, Finance or DevOps. Type your question — we show quick answers first, then you can raise a ticket. ${NEW}</div></div>
<div style="display:grid;grid-template-columns:1fr 380px;gap:16px;position:relative;align-items:start">
<div style="display:flex;flex-direction:column;gap:8px"><div class="ask">${icon('search', 18)}<span>my salary slip is not showing</span><span class="caret"></span><span style="margin-left:auto" class="kb">/</span></div>
<div class="sugg"><span style="font-size:18px">📄</span><div style="flex:1"><b class="xs">Quick answer · Finance · Payslips</b><div class="xs mut">Payslips appear on the 1st working day. Older ones are in My profile → Documents.</div></div><span class="btn sm">That helped</span></div>
<div class="sugg"><span style="font-size:18px">🗂️</span><div style="flex:1"><b class="xs">Your old ticket #187 · Resolved</b><div class="xs mut">“Payslip for August missing” — Pooja: re-generated it.</div></div><span class="btn sm">Open</span></div>
<div class="row xs mut" style="gap:6px">Not answered? <span class="btn sm pri">${icon('plus2', 12)}Raise a ticket to Finance</span></div></div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${TEAMS.map((k) => `<div class="teamc" style="padding:10px 12px;gap:3px"><span class="em" style="background:${Q[k].s};width:34px;height:34px;font-size:19px;border-radius:10px">${Q[k].e}</span><b style="font-size:13px">${Q[k].l}</b><span class="xs mut">Replies in ${Q[k].reply}</span><span class="row xs" style="gap:5px"><span class="live"></span>${Q[k].who}</span></div>`).join('')}</div>
</div></div>
<div class="row" style="justify-content:space-between"><div class="tabs"><span class="on">Open · 3</span><span>Needs my reply · 1</span><span>Resolved</span><span>Closed</span><span>All</span></div><span class="btn pri">${icon('plus2', 14)}Raise a ticket</span></div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:16px;align-items:start">
<div style="display:flex;flex-direction:column;gap:12px">
${tks.map((t) => `<div class="tk ${t.wait ? 'attn' : ''}"><div class="row" style="gap:10px;align-items:flex-start">${ring(t.used, 44, Math.round(t.used * 100) + '%')}<div style="flex:1;min-width:0"><div class="row xs" style="gap:6px"><span class="mut" style="font-family:monospace;font-weight:800">#${t.n}</span>${team(t.q)}<span class="mut">· ${t.topic}</span>${pill(PRI[t.pri])}</div><b style="font-size:15px;display:block;margin-top:3px">${t.s}</b><div class="xs mut" style="margin-top:2px">${t.last}</div></div>${t.who ? `<span class="row xs" style="gap:6px">${photo(t.who[0], 26, 26, { round: true })}<b>${t.who[1]}</b></span>` : `<span class="xs mut">Not picked up yet</span>`}</div>
<div class="row" style="gap:12px;border-top:1px solid ${C.line};padding-top:10px">${journey(t.at, t.wait)}<span class="xs mut" style="margin-left:auto">${t.due}</span>${t.wait ? `<span class="btn sm pri">Reply</span>` : ''}</div></div>`).join('')}
<div class="xs mut">The ring shows how much of the reply / solve time is used. Green → amber at 75% → red when late. Employees see it too, so they know when to expect help.</div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="gap:10px"><h3>${icon('check', 15)}Recently solved</h3>
${[['#219', 'Laptop battery drains fast', 'IT · 2 days', 5], ['#204', 'PF number in profile wrong', 'HR · 1 day', 4]].map(([n, s, m, r]) => `<div class="row xs" style="gap:8px;align-items:flex-start"><span style="color:${C.ok}">${icon('check2', 16)}</span><div style="flex:1"><b>${n} ${s}</b><div class="mut">${m} · you rated <span style="color:${C.warn}">${'★'.repeat(r)}</span></div></div></div>`).join('')}
<div class="row xs" style="gap:8px;padding:10px;border-radius:10px;background:${C.okSoft}"><span>🎉</span><span style="flex:1"><b>#225 was resolved by Kiran.</b> Fixed? Rate it or reopen.</span><span class="btn sm">Rate</span></div></div>
<div class="card sec" style="gap:8px;background:${C.raised}"><b class="xs">Good to know</b><div class="xs mut">• Reply when the team asks — the clock pauses while it waits for you.<br>• A resolved ticket closes on its own after 7 days.<br>• Problems with a laptop or phone? Use <b>My assets → Problem</b> — it links the device.</div></div>
</div></div>
</main></div></div>`;
  return dcPage('My tickets', css, html, 1180);
}

// ─── Board 3: Raise a ticket ────────────────────────────────
function raise() {
  const topics = ['Laptop & software', 'Network & VPN', 'Email & accounts', 'Access card', 'New software request', 'Other'];
  const html = `<div class="app">${sidebar('My tickets')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; My tickets &nbsp;›&nbsp; <b>Raise a ticket</b>')}<main class="main">
${top('Helpdesk', 'Raise a ticket', 'Three short steps — the right team, the right topic, the right details. Today this is a small dialog; it becomes a page. ' + NEW)}
<div class="row" style="gap:6px">${['1 · Which team', '2 · What is it about', '3 · Details'].map((s, i) => `<span class="chipq ${i === 2 ? 'on' : ''}" style="${i < 2 ? `color:${C.ok};border-color:${C.ok}55` : ''}">${i < 2 ? icon('check2', 12) : ''}${s}</span>${i < 2 ? `<span class="jl on" style="background:${C.ok};max-width:40px"></span>` : ''}`).join('')}</div>
<div style="display:grid;grid-template-columns:1fr 390px;gap:18px;align-items:start">
<div style="display:flex;flex-direction:column;gap:14px">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${TEAMS.map((k) => `<div class="teamc ${k === 'IT' ? 'on' : ''}"><div class="row"><span class="em" style="background:${Q[k].s}">${Q[k].e}</span>${k === 'IT' ? `<span style="margin-left:auto;color:${C.pri}">${icon('check2', 18)}</span>` : ''}</div><b style="font-size:14px">${Q[k].l}</b><span class="xs mut">${{ IT: 'Laptop, software, network, access', HR: 'Letters, policies, leave balance, records', FIN: 'Salary, reimbursements, tax, PF', DEV: 'Servers, deployments, CI/CD, cloud access' }[k]}</span><span class="row xs" style="gap:5px"><span class="live"></span>Usually replies in ${Q[k].reply}</span></div>`).join('')}</div>
<div class="card sec"><b style="font-size:13px">What is it about?</b><div class="row" style="flex-wrap:wrap;gap:8px">${topics.map((t, i) => `<span class="chipq ${i === 1 ? 'on' : ''}">${['💻', '📶', '✉️', '🪪', '🧩', '❓'][i]} ${t}</span>`).join('')}</div></div>
<div class="card sec" style="gap:12px">
<div class="fld"><label>Subject</label><div class="inp">VPN disconnects every 20 minutes</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="fld"><label>Where do you work from? <span class="mut" style="font-weight:500">· asked by this topic</span> ${NEW}</label><div class="inp">Home ▾</div></div><div class="fld"><label>Since when?</label><div class="inp">Today, after the update</div></div></div>
<div class="fld"><label>Tell us more</label><div class="inp" style="min-height:70px;align-items:flex-start">After this morning’s Windows update the VPN drops every ~20 min and I lose my Teams call.</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="fld"><label>Device ${NEW}</label><div class="inp">💻 <b>LAP-0042</b> · MacBook Pro 14" ▾</div></div><div class="fld"><label>Attach</label><div class="inp" style="border-style:dashed;color:${C.muted}">${icon('clip', 14)}vpn-error.png · 212 KB</div></div></div>
<div class="fld"><label>How urgent?</label><div class="row" style="gap:6px">${[['LOW', 'Can wait'], ['MEDIUM', 'Slows me down'], ['HIGH', 'I can’t work']].map(([p, d]) => `<span class="chipq ${p === 'HIGH' ? 'on' : ''}" style="flex:1;flex-direction:column;align-items:flex-start;border-radius:12px;padding:8px 12px"><span style="color:${PRI[p][1]}">${PRI[p][0]}</span><span class="xs mut" style="font-weight:500">${d}</span></span>`).join('')}</div></div>
</div></div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="border-color:${C.warn}66;gap:8px"><h3>💡 Before you send — these may help</h3>
<div class="sugg"><span>📶</span><div class="xs"><b>Quick answer: VPN drops after update</b><div class="mut">Reinstall the VPN app from Company Portal, then restart.</div></div></div>
<div class="sugg"><span>🗂️</span><div class="xs"><b>Neha had the same this week · #229</b><div class="mut">Solved by Kiran in 40 min</div></div></div>
<span class="xs mut">Matched from topic quick answers and past solved tickets (titles only — never other people’s messages).</span></div>
<div class="card sec" style="gap:10px"><h3>Who will help</h3>
<div class="row" style="gap:10px">${photo(3, 38, 38, { round: true })}<div style="flex:1"><b style="font-size:13px">IT team · Rohit Menon (head)</b><div class="xs mut">Rohit assigns it to someone in his team</div></div></div>
<div class="row xs" style="gap:12px"><span>${ring(0, 34, '4h')}</span><span><b>First reply within 4 h</b><div class="mut">Solve within 1 day · High priority</div></span></div>
<div class="row" style="gap:8px;justify-content:flex-end;border-top:1px solid ${C.line};padding-top:10px"><span class="btn">Back</span><span class="btn pri">${icon('send', 14)}Send to IT</span></div></div>
<div class="xs mut">On send, the card folds into a paper plane and flies to the IT team card (see the animation board).</div>
</div></div>
</main></div></div>`;
  return dcPage('Raise a ticket', css, html, 1180);
}

// ─── Board 4: Ticket conversation (employee) ───────────────
function thread() {
  const html = `<div class="app">${sidebar('My tickets')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; My tickets &nbsp;›&nbsp; <b>#231</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Helpdesk · IT</div><h1>#231 VPN disconnects every 20 minutes</h1><div class="row" style="gap:6px;margin-top:6px">${LIVE}${pill(STS.RES)}${pill(PRI.HIGH)}<span class="xst" style="background:${C.raised};color:${C.fg}">Network & VPN</span><span class="xst" style="background:${C.raised};color:${C.fg}">💻 LAP-0042</span></div></div><span class="btn">${icon('undo', 14)}Not fixed — reopen</span><span class="btn pri">${icon('check2', 14)}Yes, it’s fixed</span></div>
<div class="card" style="padding:14px 18px">${journey(3)}</div>
<div style="display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start">
<div class="card" style="padding:18px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(${C.raised},#fff)">
<div class="evt">${icon('send', 12)}You sent this · Mon 5 Oct, 10:12 am</div>
<div class="bub me">After this morning’s Windows update the VPN drops every ~20 min and I lose my Teams call. Screenshot attached.<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#ffffff26;font-size:11.5px">${icon('clip', 12)} vpn-error.png</div></div>
<div class="evt">${photo(3, 18, 18, { round: true })}Rohit (IT head) took it himself · 10:31 am · first reply on time ✓</div>
<div class="row" style="gap:8px;align-items:flex-end">${photo(3, 28, 28, { round: true })}<div class="bub them">Hi Amit — thanks for the screenshot. Can you tell me the VPN app version? Settings → About.</div></div>
<div class="evt" style="background:${C.warnSoft};color:${C.warn};border-color:${C.warn}44">⏸ Waiting for you — the clock paused</div>
<div class="bub me">It says 5.2.1</div>
<div class="row" style="gap:8px;align-items:flex-end">${photo(3, 28, 28, { round: true })}<div class="bub them">That’s the old one. I pushed 5.3 to your laptop — please restart once. 🙏</div></div>
<div class="card" style="align-self:stretch;padding:14px;border-color:${C.ok}55;background:${C.okSoft}55;display:flex;flex-direction:column;gap:6px"><div class="row" style="gap:8px"><span style="color:${C.ok}">${icon('check2', 18)}</span><b style="font-size:13.5px">Resolved by Rohit · 11:48 am</b><span class="xs mut" style="margin-left:auto">took 1 h 36 min</span></div><div class="xs"><b>What we did:</b> updated the VPN app to 5.3 (the old version breaks after the October Windows update).</div></div>
<div class="card" style="align-self:stretch;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center"><b style="font-size:14px">Is it fixed? How was the help?</b>
<div class="row" style="gap:14px;font-size:30px">${['😞', '🙁', '😐', '🙂', '🤩'].map((e, i) => `<span style="${i === 4 ? `transform:scale(1.25);filter:drop-shadow(0 4px 8px ${C.warn}66)` : 'opacity:.55'}">${e}</span>`).join('')}</div>
<div class="inp" style="width:70%;color:${C.muted}">Add a thank-you (optional)…</div><span class="xs mut">Rating 5 = “Great”. If you don’t answer, it closes on its own on Mon 12 Oct.</span></div>
<div class="row" style="gap:8px;align-items:flex-end">${photo(3, 28, 28, { round: true })}<span class="typing"><i></i><i></i><i></i></span><span class="xs mut">Rohit is writing… ${LIVE}</span></div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="gap:10px"><h3>Targets</h3>
<div class="row" style="gap:12px">${ring(0.3, 46, '✓')}<div class="xs"><b>First reply</b><div class="mut">19 min · target 4 h · on time</div></div></div>
<div class="row" style="gap:12px">${ring(0.45, 46, '✓')}<div class="xs"><b>Solved</b><div class="mut">1 h 36 min · target 1 day · on time</div></div></div></div>
<div class="card sec" style="gap:8px"><h3>Helping you</h3><div class="row" style="gap:10px">${photo(3, 36, 36, { round: true })}<div><b style="font-size:13px">Rohit Menon</b><div class="xs mut">IT · solved 41 tickets this month</div></div></div></div>
<div class="card sec" style="gap:8px;background:${C.raised}"><b class="xs">Reopen</b><div class="xs mut">“Not fixed” asks for one line why, puts it back to Rohit and counts as reopened (shown to the team). Possible until it closes.</div></div>
</div></div>
</main></div></div>`;
  return dcPage('Ticket conversation', css, html, 1180);
}

// ─── Board 5: Ticket queue — list ───────────────────────────
function queue() {
  const rows = [
    [234, 'URGENT', 'IT', 'Can’t log in to laptop after password reset', [6, 'Neha Gupta'], null, 1.15, 'Late by 20 min', 'OPEN', true],
    [231, 'HIGH', 'IT', 'VPN disconnects every 20 minutes', [9, 'Amit Shah'], [3, 'Rohit'], 0.82, 'Reply due in 40 min', 'PROG'],
    [233, 'HIGH', 'FIN', 'Salary credited short this month', [11, 'Sara Khan'], [7, 'Pooja'], 0.5, 'Solve by 9 pm', 'PROG'],
    [230, 'MEDIUM', 'HR', 'Need experience letter for visa', [4, 'Karan Mehta'], [8, 'Hema'], 0.4, 'Waiting on employee', 'WAIT'],
    [228, 'MEDIUM', 'FIN', 'Travel claim for Pune trip not paid', [9, 'Amit Shah'], [7, 'Pooja'], 0.6, 'Solve by Wed', 'PROG'],
    [226, 'LOW', 'HR', 'Address-proof letter for bank', [9, 'Amit Shah'], null, 0.2, 'Reply in 6 h', 'OPEN'],
    [225, 'LOW', 'IT', 'Second monitor flickers', [10, 'Meena Rao'], [2, 'Kiran'], 0.1, 'Resolved · auto-closes 12 Oct', 'RES'],
  ];
  const stat = (l, v, sub, c, spark) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:24px;color:${c || C.fg}">${v}</b><span class="xs mut">${sub}</span>${spark ? `<svg style="position:absolute;right:12px;bottom:12px" width="80" height="26"><polyline points="${spark}" fill="none" stroke="${c || C.pri}" stroke-width="2" stroke-linecap="round"/></svg>` : ''}</div>`;
  const html = `<div class="app">${sidebar('Ticket queue')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; <b>Ticket queue</b>')}<main class="main">
${top('Helpdesk', 'Ticket queue', 'Tickets from employees, most urgent first. New tickets appear live — no refresh. You see the teams you work for.', `${LIVE}<div class="seg"><span class="on">${icon('list', 13)} List</span><span>${icon('kanban', 13)} Board ${NEW}</span></div>`)}
<div class="kpi4">${stat('Open', '14', '3 unassigned · 2 waiting on employee', null, '0,20 13,16 26,18 40,10 53,12 66,6 80,8')}${stat('Overdue', '1', 'Past a reply or solve target', C.bad)}${stat('On time (30 days)', '92%', 'Solved on time: 88%', C.ok, '0,18 13,14 26,15 40,9 53,10 66,6 80,4')}${stat('Rating (30 days)', '4.6 ★', '38 solved · 27 rated', C.warn)}</div>
<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="tabs"><span class="on">All open · 14</span><span>Assigned to me · 5</span><span>Unassigned · 3</span><span style="color:${C.bad}">Overdue · 1</span><span>Resolved</span><span>Closed</span></div>
<div class="row" style="gap:6px"><span class="chip">${icon('search', 13)}#number, subject or person…</span><span class="chip">All my teams ▾</span><span class="chip">Any priority ▾</span><span class="chip on">★ My saved view: “VPN this week” ${NEW}</span></div></div>
<div class="row" style="gap:10px;padding:10px 14px;border-radius:12px;background:${C.priSoft};font-size:12.5px"><b style="color:${C.priText}">2 selected</b><span class="btn sm">Assign to… ▾</span><span class="btn sm">Priority ▾</span><span class="btn sm">${icon('merge', 12)}Merge</span><span class="btn sm">Move team ▾</span><span class="xs mut" style="margin-left:auto">Bulk actions ${NEW}</span></div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:16px;align-items:start">
<div class="card" style="overflow:hidden"><table class="tbl"><tr><th style="width:18px"></th><th>Ticket</th><th>From</th><th>Owner</th><th>Target</th><th>Status</th></tr>
${rows.map(([n, p, q, s, from, own, used, txt, st, sel], i) => `<tr style="${i === 1 ? `background:${C.priSoft}55;box-shadow:inset 3px 0 0 ${C.pri}` : ''}"><td><span style="width:15px;height:15px;border-radius:4px;border:1.5px solid ${i < 2 ? C.pri : C.border};background:${i < 2 ? C.pri : '#fff'};display:inline-block"></span></td>
<td><div class="row xs" style="gap:6px"><span class="mut" style="font-family:monospace;font-weight:800">#${n}</span>${pill(PRI[p])}${team(q)}</div><b style="display:block;margin-top:3px">${s}</b></td>
<td><span class="row xs" style="gap:6px">${photo(from[0], 24, 24, { round: true })}${from[1]}</span></td>
<td>${own ? `<span class="row xs" style="gap:6px">${photo(own[0], 22, 22, { round: true })}${own[1]}</span>` : `<span class="btn sm">Assign ▾</span>`}</td>
<td>${burn(used, txt)}</td><td>${pill(st === 'WAIT' ? ['Waiting on employee', C.warn, C.warnSoft] : STS[st])}</td></tr>`).join('')}</table></div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="gap:10px"><h3>${icon('eye', 15)}Preview · #231 ${NEW}</h3><div class="xs mut">Click a row → peek here without leaving the list.</div>
<div class="bub them" style="max-width:none;font-size:12px">Amit: “It says 5.2.1”</div><div class="inp" style="color:${C.muted};font-size:12px">Quick reply…  <span class="kb" style="margin-left:auto">R</span></div></div>
<div class="card sec" style="gap:10px"><h3>${icon('users', 15)}My team’s load ${NEW}<span class="r">team head</span></h3>
${[[3, 'Rohit', 6, 8], [2, 'Kiran', 3, 8], [8, 'Hema', 4, 6], [7, 'Pooja', 5, 6]].map(([pi, n, a, m]) => `<div class="row xs" style="gap:8px">${photo(pi, 22, 22, { round: true })}<b style="width:44px">${n}</b><span class="cap"><i style="width:${(a / m) * 100}%;background:${a / m > 0.8 ? C.warn : C.ok}"></i></span><span class="mut">${a} open</span></div>`).join('')}
<div class="xs mut">Only the team head sees this — it helps to assign fairly. Not a score.</div></div>
<div class="card sec" style="gap:6px;background:${C.raised}"><b class="xs">Keyboard ${NEW}</b><div class="xs mut" style="display:grid;grid-template-columns:auto 1fr;gap:5px 10px;align-items:center"><span><span class="kb">J</span> <span class="kb">K</span></span><span>next / previous</span><span><span class="kb">A</span></span><span>assign</span><span><span class="kb">R</span></span><span>reply</span><span><span class="kb">E</span></span><span>resolve</span><span><span class="kb">/</span></span><span>search</span></div></div>
</div></div>
</main></div></div>`;
  return dcPage('Ticket queue', css, html, 1180);
}

// ─── Board 6: Ticket queue — board view ─────────────────────
function board() {
  const card = (n, p, q, s, from, own, used, txt, extra = '') => `<div class="mini ${extra}"><div class="row" style="gap:6px"><span class="mut" style="font-family:monospace;font-weight:800">#${n}</span>${pill(PRI[p])}<span style="margin-left:auto">${ring(used, 26, '')}</span></div><b style="font-size:12.5px;line-height:1.35">${s}</b><div class="row" style="gap:6px">${team(q)}<span class="row xs mut" style="gap:4px;margin-left:auto">${photo(from, 18, 18, { round: true })}${own !== null ? `→ ${photo(own, 18, 18, { round: true })}` : ''}</span></div><span class="xs" style="color:${used >= 1 ? C.bad : used > 0.75 ? C.warn : C.muted};font-weight:700">${txt}</span></div>`;
  const lanes = [
    ['New · not picked up', C.info, [card(234, 'URGENT', 'IT', 'Can’t log in after password reset', 6, null, 1.1, 'Late by 20 min'), card(226, 'LOW', 'HR', 'Address-proof letter for bank', 9, null, 0.2, 'Being moved…', 'ghost'), card(235, 'MEDIUM', 'FIN', 'Form 16 for last year', 4, null, 0.1, 'Reply in 7 h')]],
    ['Working on it', C.pri, [card(231, 'HIGH', 'IT', 'VPN disconnects every 20 minutes', 9, 3, 0.82, 'Reply due in 40 min'), `<div style="position:relative"><div class="drop"></div><div class="mini lift" style="position:absolute;left:10px;right:-14px;top:-10px;z-index:3">${'<div class="row" style="gap:6px"><span class="mut" style="font-family:monospace;font-weight:800">#226</span>' + pill(PRI.LOW) + '</div><b style="font-size:12.5px">Address-proof letter for bank</b><span class="xs" style="color:' + C.pri + ';font-weight:800">Drop → assign to me &amp; start</span>'}</div></div>`, card(233, 'HIGH', 'FIN', 'Salary credited short', 11, 7, 0.5, 'Solve by 9 pm'), card(228, 'MEDIUM', 'FIN', 'Travel claim not paid', 9, 7, 0.6, 'Solve by Wed')]],
    ['Waiting on employee', C.warn, [card(230, 'MEDIUM', 'HR', 'Experience letter for visa', 4, 8, 0.4, 'Clock paused · asked 1 day ago'), `<div class="xs mut" style="padding:4px">Nudge after 3 days: “Still need help?” ${NEW}</div>`]],
    ['Resolved · closes in 7 days', C.ok, [card(225, 'LOW', 'IT', 'Second monitor flickers', 10, 2, 0.1, 'Auto-closes 12 Oct'), card(222, 'MEDIUM', 'HR', 'Leave balance looks wrong', 5, 8, 0.3, 'Rated ★★★★★')]],
  ];
  const html = `<div class="app">${sidebar('Ticket queue')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; Ticket queue &nbsp;›&nbsp; <b>Board</b>')}<main class="main">
${top('Helpdesk', 'Ticket queue — Board view ' + NEW, 'Same tickets, same filters, shown as lanes. Drag a card to change status; dropping on “Resolved” asks “What did you do?”. Cards move live.', `${LIVE}<div class="seg"><span>${icon('list', 13)} List</span><span class="on">${icon('kanban', 13)} Board</span></div>`)}
<div class="row" style="gap:6px"><span class="chip">All my teams ▾</span><span class="chip">Any priority ▾</span><span class="chip on">Group by: Status ▾</span><span class="chip">Group by: Owner</span><span class="chip">Group by: Team</span></div>
<div class="col4" style="position:relative">${lanes.map(([t, c, items], li) => `<div class="lane"><h4><i style="width:9px;height:9px;border-radius:50%;background:${c};display:inline-block"></i>${t}<span class="mut" style="margin-left:auto;font-weight:600">${items.filter((x) => x.includes('mini')).length}</span></h4>${items.join('')}</div>`).join('')}</div>
<div class="row xs mut" style="gap:16px">${['Team head: group by Owner and drop a card on a person to assign it', 'Moving back to “New” un-assigns it', 'Waiting lane = the employee was asked for details; their reply moves it back automatically'].map((t) => `<span class="row" style="gap:6px">${icon('check', 13)}${t}</span>`).join('')}</div>
</main></div></div>`;
  return dcPage('Ticket queue — board', css, html, 1180);
}

// ─── Board 7: Agent desk (ticket page for the team) ─────────
function desk() {
  const html = `<div class="app">${sidebar('Ticket queue')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; Ticket queue &nbsp;›&nbsp; <b>#231</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Helpdesk · IT</div><h1>#231 VPN disconnects every 20 minutes</h1><div class="row" style="gap:6px;margin-top:6px">${pill(STS.PROG)}${pill(PRI.HIGH)}<span class="xst" style="background:${C.raised};color:${C.fg}">Network & VPN</span>${burn(0.82, 'Reply due in 40 min')}</div></div><span class="btn">${icon('merge', 14)}Merge</span><span class="btn pri">${icon('check2', 14)}Resolve</span></div>
<div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start">
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
<div class="row" style="gap:8px;align-items:flex-end">${photo(9, 28, 28, { round: true })}<div class="bub them">After this morning’s Windows update the VPN drops every ~20 min… <span class="xs mut">10:12</span></div></div>
<div class="bub me">Hi Amit — can you tell me the VPN app version? <span style="opacity:.7;font-size:11px">10:31 · asked for details</span></div>
<div class="bub note">${icon('lock', 12)} <b>Internal note · Kiran:</b> 3 people with 5.2.1 had this — #229 too. Push 5.3 via MDM.</div>
<div class="row" style="gap:8px;align-items:flex-end">${photo(9, 28, 28, { round: true })}<div class="bub them">It says 5.2.1 <span class="xs mut">11:02</span></div></div>
</div>
<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
<div class="row" style="gap:6px"><div class="seg"><span class="on">Reply to Amit</span><span>${icon('lock', 12)} Internal note</span></div><span class="chip on" style="margin-left:auto">${icon('bolt', 13)}Saved replies ▾ <span class="xst" style="background:${C.raised};color:${C.muted}">Coming soon</span></span></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;opacity:.45">${[['VPN: update app', 'IT · used 14×'], ['Restart & retry', 'IT · used 22×'], ['Ask for screenshot', 'All teams · 31×']].map(([a, b], i) => `<div class="sugg" style="padding:8px 10px;${i === 0 ? `border-color:${C.pri};background:${C.priSoft}66` : ''}"><div class="xs"><b>${a}</b><div class="mut">${b}</div></div></div>`).join('')}</div>
<div class="inp" style="min-height:64px;align-items:flex-start">That’s the old one. I pushed 5.3 to your laptop — please restart once. 🙏</div>
<div class="row" style="gap:10px"><span class="xs mut">${icon('clip', 13)} Attach</span><label class="row xs" style="gap:6px"><span class="tgl off"></span>Ask Amit for details (pauses the clock)</label><span class="btn sm" style="margin-left:auto">Send &amp; resolve</span><span class="btn sm pri">${icon('send', 12)}Send</span></div></div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="gap:10px"><h3>Raised by</h3><div class="row" style="gap:10px">${photo(9, 40, 40, { round: true })}<div><b style="font-size:13.5px">Amit Shah</b><div class="xs mut">Software Engineer · Engineering</div><div class="xs mut">Team lead Priya · Pune · IST</div></div></div>
<div class="row xs" style="gap:6px;flex-wrap:wrap"><span class="xst" style="background:${C.okSoft};color:${C.ok}">● Working today</span><span class="xst" style="background:${C.infoSoft};color:${C.info}">🏠 From home</span></div></div>
<div class="card sec" style="gap:8px"><h3>${icon('box', 15)}Their devices ${NEW}</h3>${[['💻', 'LAP-0042', 'MacBook Pro 14" · linked'], ['🖥️', 'MON-0018', 'Dell 27"'], ['🎧', 'HDS-0031', 'Jabra headset']].map(([e, t, d], i) => `<div class="row xs" style="gap:8px">${e}<b style="font-family:monospace">${t}</b><span class="mut">${d}</span>${i === 0 ? `<span style="margin-left:auto;color:${C.pri}">${icon('clip', 12)}</span>` : ''}</div>`).join('')}</div>
<div class="card sec" style="gap:8px"><h3>${icon('buoy', 15)}Their recent tickets ${NEW}</h3>${[['#219', 'Laptop battery drains fast', 'Solved · ★5'], ['#187', 'Payslip for August missing', 'Finance · solved']].map(([n, s, m]) => `<div class="xs"><b>${n}</b> ${s}<div class="mut">${m}</div></div>`).join('')}</div>
<div class="card sec" style="gap:8px"><h3>Similar open ${NEW}</h3><div class="xs"><b>#229</b> VPN drops after update · Neha<div class="mut">Kiran · solved 40 min</div></div><span class="btn sm" style="align-self:flex-start">${icon('merge', 12)}Merge into #231</span></div>
<div class="card sec" style="gap:8px;font-size:12.5px"><h3>Owner &amp; details</h3><div class="row xs" style="gap:8px">${photo(3, 24, 24, { round: true })}<b>Rohit Menon</b><span class="mut" style="margin-left:auto">Change ▾</span></div><div class="xs mut">Priority High ▾ · Topic Network &amp; VPN ▾ · Wrong team? Move ▾</div></div>
</div></div>
</main></div></div>`;
  return dcPage('Agent desk', css, html, 1180);
}

// ─── Board 8: Ticket topics ─────────────────────────────────
function topics() {
  const T = {
    IT: [['💻', 'Laptop & software', 'MEDIUM', 'Rohit', 38, true], ['📶', 'Network & VPN', 'HIGH', 'Rohit', 21, true], ['✉️', 'Email & accounts', 'MEDIUM', 'Kiran', 17, false], ['🪪', 'Access card', 'LOW', 'Team', 6, false], ['🧩', 'New software request', 'LOW', 'Kiran', 9, false]],
    HR: [['📄', 'Letters & documents', 'LOW', 'Hema', 24, true], ['🌴', 'Leave balance', 'MEDIUM', 'Hema', 12, false], ['📘', 'Policies', 'LOW', 'Team', 7, true], ['🪪', 'Records & profile', 'MEDIUM', 'Hema', 5, false]],
    DEV: [['☁️', 'Cloud access', 'HIGH', 'Dev', 7, true], ['🚀', 'Deployments & releases', 'HIGH', 'Head', 11, false], ['🔑', 'Repo & CI/CD access', 'MEDIUM', 'Dev', 9, true], ['🖥️', 'Servers & databases', 'URGENT', 'Head', 3, false]],
    FIN: [['🧾', 'Reimbursements', 'MEDIUM', 'Pooja', 19, true], ['💸', 'Salary & payslips', 'HIGH', 'Pooja', 15, true], ['🧮', 'Tax & Form 16', 'MEDIUM', 'Team', 8, false], ['🏦', 'PF & bank details', 'MEDIUM', 'Pooja', 4, false]],
  };
  const maxUse = 38;
  const html = `<div class="app">${sidebar('Ticket topics')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; <b>Ticket topics</b>')}<main class="main">
${top('Helpdesk', 'Ticket topics', 'The topics employees pick when they raise a ticket. Each team manages its own. Now a topic can also route, ask and answer.', `<span class="btn">${icon('eye', 14)}Preview as employee</span>`)}
<div class="tabs"><span class="on">${icon('tags', 14)}Topics</span><span>${icon('users', 14)}Teams &amp; heads ${NEW}</span></div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;align-items:start">
${TEAMS.map((k) => [k, T[k]]).map(([k, list]) => `<div class="card" style="overflow:hidden"><div class="row" style="padding:12px 14px;border-bottom:1px solid ${C.border};background:${Q[k].s}55"><span style="font-size:20px">${Q[k].e}</span><b style="font-size:14px">${Q[k].l}</b><span class="xs mut">${list.length} topics</span><span class="btn sm" style="margin-left:auto">${icon('plus2', 12)}Add</span></div>
${list.map(([e, n, p, who, use, qa], i) => `<div class="topic" style="${k === 'IT' && i === 1 ? `background:${C.priSoft}55` : ''}"><span class="mut" style="cursor:grab">${icon('grip', 14)}</span><span class="ic" style="background:${Q[k].s}">${e}</span><div style="flex:1;min-width:0"><b>${n}</b><div class="row xs mut" style="gap:6px;margin-top:2px">${pill(PRI[p])}<span>→ ${who}</span>${qa ? `<span style="color:${C.ok}">${icon('book', 11)} answer</span>` : ''}</div></div><div style="width:58px;display:flex;flex-direction:column;gap:2px;align-items:flex-end"><span class="xs mut">${use} / 30d</span><span class="cap" style="width:58px;flex:none"><i style="width:${(use / maxUse) * 100}%;background:${Q[k].c}"></i></span></div><span class="mut">${icon('pencil', 13)}</span></div>`).join('')}
<div class="topic" style="opacity:.5;border-bottom:none"><span class="mut">${icon('grip', 14)}</span><span class="ic" style="background:${C.raised}">🗃️</span><b style="flex:1">Old: Hardware (2024)</b><span class="xst" style="background:${C.raised};color:${C.muted}">Hidden</span></div></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
${[['grip', 'Drag to reorder', 'The order here is the order employees see.'], ['users', 'Routing', 'New tickets go to the team head to assign, or straight to one person.'], ['book', 'Quick answer', 'Shown while the employee types — many tickets never need sending.'], ['chart', 'Use count', 'See which topics are busy; hide the ones nobody uses.']].map(([ic, t, d]) => `<div class="lib" style="align-items:flex-start"><span class="ic" style="background:${C.priSoft};color:${C.pri}">${icon(ic, 16)}</span><div><b style="font-size:13px">${t} ${NEW}</b><div class="xs mut">${d}</div></div></div>`).join('')}
</div>
</main></div></div>`;
  return dcPage('Ticket topics', css, html, 1000);
}

// ─── Board 9: Topic editor ──────────────────────────────────
function topicEditor() {
  const html = `<div class="app">${sidebar('Ticket topics')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; Ticket topics &nbsp;›&nbsp; <b>Network &amp; VPN</b>')}<main class="main" style="position:relative">
${top('Helpdesk', 'Edit topic — Network &amp; VPN', 'Opens as a wide side panel from Ticket topics. Left: settings. Right: live preview of what the employee sees.')}
<div style="display:grid;grid-template-columns:1fr 420px;gap:18px;align-items:start">
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec"><h3>Basics</h3>
<div style="display:grid;grid-template-columns:80px 1fr 160px;gap:10px"><div class="fld"><label>Icon</label><div class="inp" style="justify-content:center;font-size:18px">📶</div></div><div class="fld"><label>Name</label><div class="inp">Network &amp; VPN</div></div><div class="fld"><label>Team</label><div class="inp">💻 IT ▾</div></div></div>
<div class="fld"><label>Short help line</label><div class="inp">Wi-Fi, VPN, slow internet in office</div></div>
<label class="row xs" style="gap:8px"><span class="tgl"></span><b>Employees can pick it</b></label></div>
<div class="card sec"><h3>Routing &amp; targets ${NEW}</h3>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="fld"><label>New tickets go to</label><div class="inp">IT head (Rohit) — he assigns ▾</div><span class="xs mut">or straight to one person, e.g. Kiran</span></div><div class="fld"><label>Starting priority</label><div class="inp">${pill(PRI.HIGH)} ▾</div><span class="xs mut">Employee can still change it</span></div></div>
<div class="xs mut" style="padding:8px 10px;border-radius:10px;background:${C.raised}">Reply targets always follow the priority: Urgent 1 h / 8 h · High 4 h / 1 day · Medium 8 h / 3 days · Low 1 day / 5 days.</div></div>
<div class="card sec"><h3>Questions to ask ${NEW}</h3>
${[['Where do you work from?', 'Choice: Office / Home / Client site', true], ['Since when?', 'Short text', false], ['Which device?', 'Their assets (from My assets)', true]].map(([q, t, r]) => `<div class="row xs" style="gap:8px;padding:8px 10px;border:1px solid ${C.line};border-radius:10px"><span class="mut">${icon('grip', 13)}</span><b style="flex:1">${q}</b><span class="mut">${t}</span>${r ? `<span class="xst" style="background:${C.priSoft};color:${C.priText}">Required</span>` : ''}</div>`).join('')}
<span class="btn sm" style="align-self:flex-start">${icon('plus2', 12)}Add a question</span></div>
<div class="card sec"><h3>${icon('book', 15)}Quick answer ${NEW}</h3><div class="inp" style="min-height:58px;align-items:flex-start">VPN drops after a Windows update? Reinstall the VPN app from Company Portal, then restart your laptop.</div><div class="xs mut">Shown above “Send” when an employee picks this topic or types similar words. Answered 9 people this month without a ticket.</div></div>
</div>
<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px;background:${C.raised};position:sticky;top:0"><div class="row xs" style="gap:6px"><span class="live"></span><b>Live preview · what Amit sees</b></div>
<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
<span class="chipq on" style="align-self:flex-start">📶 Network &amp; VPN</span><span class="xs mut">Wi-Fi, VPN, slow internet in office</span>
<div class="sugg" style="border-color:${C.warn}66"><span>💡</span><div class="xs"><b>Quick answer</b><div class="mut">VPN drops after a Windows update? Reinstall the VPN app…</div></div></div>
<div class="fld"><label>Where do you work from? *</label><div class="inp">Choose ▾</div></div>
<div class="fld"><label>Since when?</label><div class="inp" style="color:${C.muted}">e.g. this morning</div></div>
<div class="fld"><label>Which device? *</label><div class="inp">💻 LAP-0042 ▾</div></div>
<div class="row xs" style="gap:8px;border-top:1px solid ${C.line};padding-top:8px">${photo(3, 22, 22, { round: true })}<span>Goes to the <b>IT head</b> · first reply within 4 h (High)</span></div></div>
<div class="row" style="gap:8px;justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">Save topic</span></div></div>
</div>
</main></div></div>`;
  return dcPage('Topic editor', css, html, 1180);
}

// ─── Board 10: Animation ideas (live, light + dark) ─────────
function motion() {
  const D = { bg: '#0E1220', card: '#171C2E', line: '#262D45', fg: '#E6E8F2', muted: '#8C93AD' };
  const mcss = css.replace('</style>', `
.demo{border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px;border:1px solid ${C.border};background:#fff}
.demo.dk{background:${D.card};border-color:${D.line};color:${D.fg}}.demo.dk .mut{color:${D.muted}}
.stage{height:150px;border-radius:12px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,#fff,#EEF0F8)}
.dk .stage{background:radial-gradient(circle at 50% 30%,#232A44,${D.bg})}
.where{font-size:10.5px;font-weight:800;color:${C.pri};text-transform:uppercase;letter-spacing:.06em}.dk .where{color:#A5B4FC}
/* 1 paper plane */
.form{width:90px;height:60px;border-radius:8px;background:#fff;border:1px solid ${C.border};box-shadow:0 6px 16px -8px rgba(0,0,0,.3);position:absolute;left:30px;top:45px;animation:fold 7s ease-in-out infinite}
.dk .form{background:#2A3150;border-color:#3A4366}
.plane{position:absolute;left:50px;top:60px;font-size:30px;opacity:0;animation:fly 7s ease-in-out infinite}
.dest{position:absolute;right:22px;top:50px;width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:${C.infoSoft};animation:catch 7s ease-in-out infinite}
@keyframes fold{0%,18%{transform:scale(1);opacity:1}30%,100%{transform:scale(.2) rotate(-20deg);opacity:0}}
@keyframes fly{0%,26%{opacity:0;transform:translate(0,0) rotate(0)}32%{opacity:1}60%{opacity:1;transform:translate(150px,-30px) rotate(12deg)}66%,100%{opacity:0;transform:translate(170px,-10px) scale(.4)}}
@keyframes catch{0%,58%{transform:scale(1);box-shadow:0 0 0 0 ${C.info}55}66%{transform:scale(1.12);box-shadow:0 0 0 10px ${C.info}00}76%,100%{transform:scale(1)}}
/* 2 SLA ring countdown */
.sla{width:96px;height:96px}.sla circle.a{stroke-dasharray:264;animation:slaf 12s linear infinite,slac 12s linear infinite}
@keyframes slaf{from{stroke-dashoffset:264}to{stroke-dashoffset:0}}
@keyframes slac{0%,70%{stroke:${C.ok}}75%,92%{stroke:${C.warn}}95%,100%{stroke:${C.bad}}}
.slat{position:absolute;font-weight:900;font-size:13px}
/* 3 journey fill */
.jfill{width:85%;height:4px;border-radius:4px;background:${C.line};position:relative}.dk .jfill{background:${D.line}}
.jfill i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:${C.pri};animation:jf 9s ease-in-out infinite}
.jfill b{position:absolute;top:-7px;width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid ${C.pri};margin-left:-9px;animation:jb 9s ease-in-out infinite}
.jfill span{position:absolute;top:16px;font-size:9.5px;font-weight:700;transform:translateX(-50%);white-space:nowrap}.jfill span:first-of-type{transform:none}.jfill span:last-of-type{transform:translateX(-100%)}
@keyframes jf{0%{width:0}25%{width:33%}50%{width:66%}75%,100%{width:100%}}
@keyframes jb{0%{left:0}25%{left:33%}50%{left:66%}75%,100%{left:100%}}
/* 4 typing */
.tp{display:inline-flex;gap:5px;padding:12px 15px;border-radius:16px;background:#fff;border:1px solid ${C.border}}.dk .tp{background:#2A3150;border-color:#3A4366}
.tp i{width:8px;height:8px;border-radius:50%;background:${C.muted};animation:dot 1.4s ease-in-out infinite}.tp i:nth-child(2){animation-delay:.2s}.tp i:nth-child(3){animation-delay:.4s}
/* 5 solved burst */
.solved{position:relative;width:70px;height:70px;border-radius:50%;background:${C.ok};display:flex;align-items:center;justify-content:center;color:#fff;font-size:34px;font-weight:900;animation:pop 6s ease-in-out infinite}
@keyframes pop{0%,10%{transform:scale(0)}20%{transform:scale(1.15)}26%,85%{transform:scale(1)}95%,100%{transform:scale(0)}}
.ray{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;opacity:0;animation:ray 6s ease-out infinite}
@keyframes ray{0%,16%{transform:translate(-50%,-50%) rotate(var(--r)) translateY(0);opacity:0}20%{opacity:1}40%,100%{transform:translate(-50%,-50%) rotate(var(--r)) translateY(-62px);opacity:0}}
/* 6 faces rating */
.faces{display:flex;gap:10px;font-size:28px}.faces span{animation:face 7.5s ease-in-out infinite;opacity:.45}
${[0, 1, 2, 3, 4].map((i) => `.faces span:nth-child(${i + 1}){animation-delay:${i * 0.6}s}`).join('')}
@keyframes face{0%,8%{transform:scale(1);opacity:.45}4%{transform:scale(1.35) translateY(-4px);opacity:1}}
/* 7 new ticket slides in */
.qlist{width:85%;display:flex;flex-direction:column;gap:6px}
.qr{height:24px;border-radius:7px;background:#fff;border:1px solid ${C.border};display:flex;align-items:center;gap:6px;padding:0 8px;font-size:10px;font-weight:700}
.dk .qr{background:#2A3150;border-color:#3A4366}
.qr.in{animation:slin 7s ease-in-out infinite;border-color:${C.pri}}
@keyframes slin{0%,10%{transform:translateY(-34px);opacity:0}22%,80%{transform:translateY(0);opacity:1;box-shadow:0 0 0 3px ${C.pri}22}100%{opacity:1;box-shadow:none}}
/* 8 overdue soft glow */
.od{padding:10px 14px;border-radius:12px;border:1.5px solid ${C.bad};font-weight:800;font-size:12px;color:${C.bad};background:${C.badSoft};animation:glow 4s ease-in-out infinite}
.dk .od{background:#3A1620}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 ${C.bad}00}50%{box-shadow:0 0 0 8px ${C.bad}22}}
/* 9 all clear */
.clear{display:flex;flex-direction:column;align-items:center;gap:4px}.clear .w{font-size:40px;animation:float 8s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}
/* 10 drag lift */
.lift2{width:120px;padding:10px;border-radius:10px;background:#fff;border:1px solid ${C.border};font-size:11px;font-weight:700;animation:lift 7s ease-in-out infinite}
.dk .lift2{background:#2A3150;border-color:#3A4366}
@keyframes lift{0%,15%{transform:translate(-70px,0) rotate(0);box-shadow:none}30%{transform:translate(-60px,-8px) rotate(-3deg);box-shadow:0 18px 26px -14px rgba(0,0,0,.5)}60%{transform:translate(60px,-8px) rotate(2deg);box-shadow:0 18px 26px -14px rgba(0,0,0,.5)}72%,100%{transform:translate(70px,0) rotate(0);box-shadow:none}}
.lanes2{position:absolute;inset:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.lanes2 i{border:1.5px dashed ${C.border};border-radius:10px}.dk .lanes2 i{border-color:${D.line}}
@keyframes dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
</style>`);
  const demos = [
    ['✈️ Paper plane', 'Raise a ticket · Send', 'The form folds into a plane and lands on the team card, which gives a small “caught it” pulse.', `<div class="form"></div><div class="plane">✈️</div><div class="dest">💻</div>`],
    ['⏱️ SLA ring', 'My tickets · queue', 'The ring fills as time passes. Colour turns amber at 75%, red when late. Ticks once a minute — not a ticking clock.', `<svg class="sla" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#8882" stroke-width="8"/><circle class="a" cx="50" cy="50" r="42" fill="none" stroke-width="8" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><span class="slat">4 h</span>`],
    ['🧭 Journey line', 'Ticket page · My tickets', 'The line fills to the next stop when the status changes; the current dot breathes slowly.', `<div class="jfill"><i></i><b></b>${['Sent', 'Picked', 'Working', 'Solved'].map((s, i) => `<span style="left:${i * 33}%">${s}</span>`).join('')}</div>`],
    ['💬 Typing dots', 'Ticket page', '“Rohit is writing…” — sent live over the WebSocket, hides after 5 s of no typing.', `<div class="tp"><i></i><i></i><i></i></div>`],
    ['🎉 Solved moment', 'When it is resolved', 'A green check pops and 8 soft dots float out — once, then rate with faces.', `<div class="solved">✓${Array.from({ length: 8 }, (_, i) => `<span class="ray" style="--r:${i * 45}deg;background:${[C.ok, C.pri, C.warn, C.pink][i % 4]};animation-delay:0s"></span>`).join('')}</div>`],
    ['😊 Rate with faces', 'Close and rate', 'Faces grow a little as you hover; the chosen one stays big.', `<div class="faces">${['😞', '🙁', '😐', '🙂', '🤩'].map((e) => `<span>${e}</span>`).join('')}</div>`],
    ['📥 New ticket arrives', 'Ticket queue', 'New tickets slide in live from the top with a short highlight.', `<div class="qlist"><div class="qr in">#235 Form 16 for last year</div><div class="qr">#234 Can’t log in after reset</div><div class="qr">#233 Salary credited short</div></div>`],
    ['🔴 Overdue glow', 'Queue · board', 'Late tickets get a slow soft red halo — no shaking, no blinking text.', `<div class="od">Late by 20 min</div>`],
    ['🗂️ Drag between lanes', 'Board view', 'The card lifts and tilts while dragged, then settles into the new lane.', `<div class="lanes2"><i></i><i></i></div><div class="lift2">#226 Address-proof letter</div>`],
    ['🌤️ All clear', 'Empty queue · no open tickets', 'A calm floating cloud: “Nothing waiting. Nice work, team.”', `<div class="clear"><span class="w">🌤️</span><b style="font-size:12px">Nothing waiting</b></div>`],
  ];
  const tile = ([t, where, d, stage], dark) => `<div class="demo ${dark ? 'dk' : ''}"><div class="stage">${stage}</div><b style="font-size:13.5px">${t}</b><span class="where">${where}</span><div class="xs mut">${d}</div></div>`;
  const html = `<div class="app">${sidebar('Ticket queue')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; <b>Animation ideas</b>')}<main class="main">
${top('Helpdesk', 'Animation ideas (live)', 'Light on the left, dark on the right. Pure CSS (transform + opacity), play once on the event or loop very slowly; all stop with “Reduce motion” and follow Lively / Calm / Off.')}
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">${demos.slice(0, 5).map((d) => tile(d, false)).join('')}</div>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">${demos.slice(5).map((d) => tile(d, true)).join('')}</div>
<div class="row xs mut" style="gap:16px">${['Each idea works in both themes — top row shown light, bottom row dark', 'Calm = only the rings and journey line (no plane, no burst)', 'Off = still frames, colours keep the meaning'].map((t) => `<span class="row" style="gap:6px">${icon('check', 13)}${t}</span>`).join('')}</div>
</main></div></div>`;
  return dcPage('Helpdesk — animation ideas', mcss, html, 1000);
}

// ─── Board 11: Who sees what ────────────────────────────────
function who() {
  const roles = ['Employee', 'Team member', 'Team head', 'Company admin'];
  const rows = [
    ['Raise a ticket, see my own tickets', 'y', 'y', 'y', 'y'],
    ['See quick answers while typing', 'y', 'y', 'y', 'y'],
    ['See the queue of my team (IT / HR / Finance / DevOps)', 'n', 'y', 'y', 's:if given that queue'],
    ['Get every new ticket of the team first', 'n', 'n', 'y', 'n'],
    ['Assign / re-assign to people in the team', 'n', 'n', 'y', 's:if given that queue'],
    ['Reply, internal notes, resolve', 'n', 's:tickets assigned to me', 'y', 's:in their queues'],
    ['See the person’s devices & recent tickets', 'n', 's:while handling', 's:while handling', 'n'],
    ['Saved replies (coming soon)', 'n', 's:later', 's:later', 's:later'],
    ['Board view, bulk actions, saved views', 'n', 'y', 'y', 's:in their queues'],
    ['Ticket topics & Teams tab', 'n', 'n', 's:own team', 'y'],
    ['Team load panel', 'n', 'n', 'y', 's:in their queues'],
    ['Choose the head and backup of a team', 'n', 'n', 'n', 'y'],
  ];
  const cell = (v) => (v === 'y' ? '<span class="y">✓</span>' : v === 'n' ? '<span class="n">—</span>' : `<span class="s">${v.slice(2)}</span>`);
  const html = `<div class="app">${sidebar('Ticket topics')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; <b>Who sees what</b>')}<main class="main">
${top('Helpdesk', 'Who sees and does what', 'Same idea as today: ticket.view / ticket.create for everyone, ticket.handle_it / _hr / _finance for the teams + new ticket.handle_devops. The team head is chosen in Ticket topics → Teams &amp; heads.')}
<div class="card" style="overflow:hidden"><table class="tbl mx"><tr><th>What</th>${roles.map((r) => `<th>${r}</th>`).join('')}</tr>
${rows.map(([w, ...v]) => `<tr><td><b>${w}</b></td>${v.map((x) => `<td>${cell(x)}</td>`).join('')}</tr>`).join('')}</table></div>
<div class="g2">
<div class="card sec" style="gap:8px"><h3>${icon('shield', 15)}Privacy rules</h3><div class="xs mut">• Quick-answer matches show only <b>titles</b> of solved tickets, never other people’s messages — and only the employee’s own past tickets by name.<br>• Internal notes are never shown to the employee.<br>• Agents see the person’s devices only while handling their ticket.</div></div>
<div class="card sec" style="gap:8px"><h3>${icon('alert', 15)}Still not included</h3><div class="xs mut">• Anonymous tickets (decided: no).<br>• Email-to-ticket and AI auto-replies — later ideas.<br>• Tickets between teams of different companies — never.</div></div>
</div>
</main></div></div>`;
  return dcPage('Helpdesk — who sees what', css, html, 1000);
}

// ─── Board: Teams & heads ───────────────────────────────────
function teams() {
  const T = [
    ['IT', [3, 'Rohit Menon', 'IT Head'], [[1, 'Kiran Shetty', 'IT Support', 3, 8, 'Laptops, email']], 'Kiran'],
    ['HR', [2, 'Hema Iyer', 'HR Manager'], [[6, 'Divya Pillai', 'HR Executive', 2, 6, 'Letters, records']], 'Divya'],
    ['FIN', [10, 'Pooja Reddy', 'Finance Lead'], [], 'Company admin'],
    ['DEV', [11, 'Dev Menon', 'DevOps Lead'], [[7, 'Arjun Nair', 'DevOps Engineer', 1, 6, 'CI/CD, cloud']], 'Arjun'],
  ];
  const inbox = [
    [236, 'HIGH', 'Laptop fan very loud since morning', 4, 'Kiran', '3 open · knows laptops'],
    [237, 'MEDIUM', 'Outlook asks for password again and again', 5, 'Kiran', 'topic “Email & accounts”'],
    [234, 'URGENT', 'Can’t log in to laptop after password reset', 4, 'Rohit (me)', 'Urgent — Kiran is in a meeting'],
  ];
  const html = `<div class="app">${sidebar('Ticket topics')}<div class="col">${header('Helpdesk &nbsp;›&nbsp; Ticket topics &nbsp;›&nbsp; <b>Teams &amp; heads</b>')}<main class="main">
${top('Helpdesk', 'Teams &amp; heads ' + NEW, 'Every team has one head. New tickets go to the head, who assigns them to people under them. A backup takes over when the head is on leave.', `<span class="btn pri">${icon('plus2', 14)}Add a team</span>`)}
<div class="tabs"><span>${icon('tags', 14)}Topics</span><span class="on">${icon('users', 14)}Teams &amp; heads</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
${T.map(([k, head, mem, backup]) => `<div class="card" style="overflow:hidden"><div class="row" style="padding:11px 14px;border-bottom:1px solid ${C.border};background:${Q[k].s}55"><span style="font-size:20px">${Q[k].e}</span><b style="font-size:14px">${Q[k].l}</b>${k === 'DEV' ? NEW : ''}<span class="xs mut" style="margin-left:auto">${mem.length + 1} people</span></div>
<div style="padding:12px 14px;display:flex;flex-direction:column;gap:9px">
<div class="row" style="gap:10px">${photo(head[0], 34, 34, { round: true })}<div style="flex:1"><b style="font-size:13px">${head[1]}</b> <span class="xst" style="background:${C.warnSoft};color:${C.warn}">👑 Head</span><div class="xs mut">${head[2]} · gets every new ${Q[k].l} ticket</div></div><span class="mut xs">Change ▾</span></div>
${mem.length ? mem.map(([pi, n, r, a, m, sk]) => `<div class="row" style="gap:10px;padding-left:16px;border-left:2px solid ${C.line};margin-left:16px">${photo(pi, 28, 28, { round: true })}<div style="flex:1"><b style="font-size:12.5px">${n}</b><div class="xs mut">${r} · good at: ${sk}</div></div><span class="cap" style="max-width:70px"><i style="width:${(a / m) * 100}%;background:${C.ok}"></i></span><span class="xs mut">${a} open</span></div>`).join('') : `<div class="xs mut" style="padding-left:16px">No one under ${head[1].split(' ')[0]} yet — she handles every Finance ticket herself.</div>`}
<div class="row xs" style="gap:8px;border-top:1px solid ${C.line};padding-top:8px"><span class="mut">Backup when the head is away:</span><b>${backup}</b><span class="mut" style="margin-left:auto">Only the head assigns</span></div>
</div></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;align-items:start">
<div class="card sec" style="gap:10px"><h3>${icon('headset', 15)}Rohit’s “To assign” list <span class="r">${LIVE}</span></h3>
${inbox.map(([n, p, s, from, sug, why]) => `<div class="row" style="gap:10px;padding:9px 10px;border:1px solid ${C.line};border-radius:12px"><span class="mut" style="font-family:monospace;font-weight:800;font-size:12px">#${n}</span>${pill(PRI[p])}<div style="flex:1;min-width:0"><b style="font-size:12.5px">${s}</b><div class="xs mut">Suggested: <b style="color:${C.fg}">${sug}</b> · ${why}</div></div><span class="btn sm pri">Assign to ${sug.split(' ')[0]}</span><span class="btn sm">Other ▾</span></div>`).join('')}
<div class="xs mut">The suggestion uses who is free, who is on leave today and who solved this topic before. The head always decides.</div></div>
<div class="card sec" style="gap:10px"><h3>${icon('alert', 15)}So nothing gets stuck</h3>
${[['Not assigned in 30 min (Urgent / High)', 'remind the head again'], ['Head on leave today', 'new tickets go to the backup'], ['Assigned person on leave', 'head sees “needs a new owner”'], ['Reply target 75% used', 'warn the owner and the head']].map(([a, b]) => `<div class="row xs" style="gap:8px;align-items:flex-start"><span style="color:${C.pri}">${icon('check2', 14)}</span><span><b>${a}</b> → <span class="mut">${b}</span></span></div>`).join('')}
<div class="xs mut" style="padding:8px 10px;border-radius:10px;background:${C.raised}">DevOps is a new 4th team with its own permission (ticket.handle_devops) and its own topics.</div></div>
</div>
</main></div></div>`;
  return dcPage('Teams & heads', css, html, 1180);
}

// ─── Board: Live updates (WebSocket) ────────────────────────
function live() {
  const lcss = css.replace('</style>', `
.toast{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:14px;background:#fff;border:1px solid ${C.border};box-shadow:0 14px 30px -16px rgba(17,24,39,.35);width:320px;font-size:12.5px;animation:tin 8s ease-in-out infinite}
.toast:nth-child(2){animation-delay:2.6s}.toast:nth-child(3){animation-delay:5.2s}
@keyframes tin{0%,4%{opacity:0;transform:translateX(30px)}10%,40%{opacity:1;transform:none}48%,100%{opacity:0;transform:translateX(30px)}}
.bell{position:relative;width:40px;height:40px;border-radius:12px;border:1px solid ${C.border};background:#fff;display:flex;align-items:center;justify-content:center;animation:ring 8s ease-in-out infinite}
.bell i{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:${C.bad};color:#fff;font-size:10px;font-weight:900;font-style:normal;display:flex;align-items:center;justify-content:center;animation:bump 8s ease-in-out infinite}
@keyframes ring{0%,4%,14%,100%{transform:rotate(0)}6%{transform:rotate(14deg)}8%{transform:rotate(-12deg)}10%{transform:rotate(8deg)}12%{transform:rotate(-4deg)}}
@keyframes bump{0%,4%,12%,100%{transform:scale(1)}7%{transform:scale(1.35)}}
.conn{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;border:1px solid ${C.border};background:#fff;font-size:12.5px}
.flow{display:flex;align-items:center;gap:8px;font-size:12px}.flow .bx{padding:10px 12px;border-radius:12px;border:1px solid ${C.border};background:#fff;text-align:center;min-width:110px}
.flow .ar{flex:1;height:2px;background:repeating-linear-gradient(90deg,${C.pri} 0 6px,transparent 6px 12px);background-size:24px 2px;animation:dash 1.6s linear infinite;min-width:40px}
@keyframes dash{to{background-position:24px 0}}
</style>`);
  const what = [
    ['Helpdesk', 'New tickets in the queue, replies, “is writing…”, status changes, assignments', 'Now: refresh on open'],
    ['Notification bell', 'Every module: leave approved, expense paid, asset handed over, kudos, announcement', 'Now: every 1 min'],
    ['Sidebar badges', 'Counts like “3 to approve”, “2 tickets” change at once', 'Now: every 1 min'],
    ['Home & attendance', 'Who is in / away today, check-ins', 'Now: every 1 min'],
    ['Announcements & kudos', 'Reactions and read counts tick up live', 'Now: on refresh'],
    ['Super Admin', 'Maintenance mode switch reaches every open tab at once', 'Now: polling'],
  ];
  const html = `<div class="app">${sidebar('Ticket queue')}<div class="col"><header class="hdr"><div class="crumb">Helpdesk &nbsp;›&nbsp; <b>Live updates</b></div><div class="row xs" style="gap:12px">${LIVE}<span class="bell">${icon('bell', 18)}<i>3</i></span></div></header><main class="main" style="position:relative">
${top('Whole app', 'Live updates (WebSocket) ' + NEW, 'One live connection per open tab. Things appear the moment they happen — not after the next refresh. If the connection drops, the app quietly goes back to refreshing every minute.')}
<div style="display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start">
<div style="display:flex;flex-direction:column;gap:14px">
<div class="card" style="overflow:hidden"><table class="tbl"><tr><th>Where</th><th>What becomes live</th><th>Today</th></tr>${what.map(([a, b, c]) => `<tr><td><b>${a}</b></td><td>${b}</td><td class="mut">${c}</td></tr>`).join('')}</table></div>
<div class="card sec" style="gap:12px"><h3>${icon('server', 15)}How it works (simple)</h3>
<div class="flow"><div class="bx"><b>Kiran replies</b><div class="xs mut">saves in the API</div></div><span class="ar"></span><div class="bx"><b>API sends an event</b><div class="xs mut">“ticket 231 has a reply”</div></div><span class="ar"></span><div class="bx"><b>Amit’s open tab</b><div class="xs mut">shows it at once</div></div></div>
<div class="xs mut">• Socket.IO inside the NestJS API, signed in with the same login token.<br>• Each person joins only their own “rooms”: <b>me</b>, <b>my company</b>, and <b>my team queues</b> — so nobody gets events they may not see.<br>• Events say “something changed”; the page then loads the data through the normal API (same permission checks).<br>• One API server needs nothing extra. With 2+ servers we add Redis (already on the plan).</div></div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<b class="xs mut">Pop-ups (bottom right, 6 s, max 3)</b>
<div style="display:flex;flex-direction:column;gap:8px;min-height:230px">
<div class="toast"><span style="font-size:18px">🎫</span><div style="flex:1"><b>New IT ticket #236</b><div class="mut">Neha · Laptop fan very loud · High</div></div><span class="btn sm">Assign</span></div>
<div class="toast"><span style="font-size:18px">💬</span><div style="flex:1"><b>Rohit replied on #231</b><div class="mut">“I pushed 5.3 to your laptop…”</div></div></div>
<div class="toast"><span style="font-size:18px">✅</span><div style="flex:1"><b>Leave approved</b><div class="mut">Priya approved 12–13 Oct</div></div></div>
</div>
<b class="xs mut">Connection status (top bar, tiny)</b>
<div class="conn"><span class="live"></span><b>Live</b><span class="mut">— normal, almost invisible</span></div>
<div class="conn"><span style="width:8px;height:8px;border-radius:50%;background:${C.warn}"></span><b>Reconnecting…</b><span class="mut">— after Wi-Fi drops</span></div>
<div class="conn"><span style="width:8px;height:8px;border-radius:50%;background:${C.muted}"></span><b>Offline</b><span class="mut">— refreshing every minute</span></div>
<div class="xs mut">New in Preferences: turn pop-ups off — the bell still counts.</div>
</div></div>
</main></div></div>`;
  return dcPage('Live updates', lcss, html, 1000);
}

const boards = [
  ['CAHelpOverview.dc.html', 'Helpdesk · What changes — today vs new for every screen, motion ideas, reply targets', overview, 1000],
  ['CAHelpMine.dc.html', 'Helpdesk · My tickets — “How can we help?” search with quick answers, team cards, ticket cards with SLA ring + journey line', mine, 1180],
  ['CAHelpRaise.dc.html', 'Helpdesk · Raise a ticket — team → topic → details, topic questions, link a device, “these may help”, who will help', raise, 1180],
  ['CAHelpThread.dc.html', 'Helpdesk · Ticket conversation — chat style, journey, paused clock, “what we did”, rate with faces, typing dots', thread, 1180],
  ['CAHelpQueue.dc.html', 'Helpdesk · Ticket queue — KPIs, SLA burn bars, saved views, bulk actions, preview panel, team load, keyboard', queue, 1180],
  ['CAHelpBoard.dc.html', 'Helpdesk · Ticket queue (Board) — lanes New / Working / Waiting / Resolved, drag to take & move', board, 1180],
  ['CAHelpDesk.dc.html', 'Helpdesk · Agent desk — conversation + saved replies, internal note, person’s devices & recent tickets, merge similar', desk, 1180],
  ['CAHelpTeams.dc.html', 'Helpdesk · Teams & heads — IT, HR, Finance + DevOps; head gets new tickets and assigns to people under them; backup; nothing gets stuck', teams, 1180],
  ['CAHelpLive.dc.html', 'Whole app · Live updates (WebSocket) — what becomes live, pop-ups, bell, connection status, how it works', live, 1000],
  ['CAHelpTopics.dc.html', 'Helpdesk · Ticket topics — per team, icons, priority, auto-assign, quick answer, use count, drag to reorder', topics, 1000],
  ['CAHelpTopicEdit.dc.html', 'Helpdesk · Topic editor — routing, own targets, questions to ask, quick answer, live employee preview', topicEditor, 1180],
  ['CAHelpMotion.dc.html', 'Helpdesk · Animation ideas (live, light + dark) — paper plane, SLA ring, journey, typing, solved, faces, new row, overdue, drag, all clear', motion, 1000],
  ['CAHelpWhoSees.dc.html', 'Helpdesk · Who sees and does what — Employee, IT / HR / Finance teams, Company admin', who, 1000],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
const ROW_Y = 51700;
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: (i % 4) * 1520, y: ROW_Y + Math.floor(i / 4) * 1300 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n21 = { kind: 'title1', maxW: 6000, text: 'Company · Helpdesk — my tickets, raise, conversation, queue (list + board), agent desk, teams & heads, live updates, topics, animations, who sees what', w: 240, x: 0, y: ROW_Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
