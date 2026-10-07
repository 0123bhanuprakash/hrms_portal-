// Company app → Resource requests & reassignment (Projects): request a person (Lead → PM → Delivery Director → PMO),
// release / reassign, hold / unhold, reject, request timeline, assignment history on the profile, "Reports to: PMO"
// on employee create, the PMO pool, and PM + Delivery Director on the project form. Light boards + 2 dark copies.
// Sidebar never changes: the inbox is a new tab on Projects; the menu item "Projects" only gets a count badge.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { C } = require('./build-reports.js');
const { photo } = require('./build-people.js');
const { css: adminCss } = require('./build-admin.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  check2: '<path d="M20 6 9 17l-5-5"/>',
  x2: '<path d="M18 6 6 18M6 6l12 12"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  userminus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  brief: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  git: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 9v6M18 12c0 3-3 4-9 4"/>',
  pool: '<path d="M2 12h20M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M6 12V5a2 2 0 0 1 4 0M14 12V5a2 2 0 0 1 4 0"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
});

// ─── People (sample data: demo org + a few design-only names) ─────────────
// [photo index, long hair, title]
const PPL = {
  Priya: [0, true, 'Engineering Lead', 'Priya Sharma'], Karan: [1, false, 'Engineering Lead', 'Karan Mehta'], Hema: [2, true, 'HR Manager', 'Hema Iyer'],
  Neha: [4, true, 'Software Engineer', 'Neha Gupta'], Vikram: [5, false, 'Operations Head · PMO', 'Vikram Rao'], Ravi: [9, false, 'Engineering Manager', 'Ravi Kumar'],
  Dev: [11, false, 'DevOps Engineer', 'Dev Menon'], Amit: [13, false, 'Software Engineer', 'Amit Verma'], Sara: [15, true, 'Mobile Developer', 'Sara Khan'],
  Suresh: [17, false, 'Delivery Director', 'Suresh Pillai'], Kavya: [20, true, 'Senior Front-end Engineer', 'Kavya Nair'], Rohit: [21, false, 'QA Engineer', 'Rohit Shetty'],
  Harish: [22, false, 'Java Developer', 'Harish Gowda'], Farhan: [23, false, 'Project Manager', 'Farhan Ali'], Tanvi: [25, true, 'Intern · Software', 'Tanvi Joshi'],
  Lakshmi: [26, true, 'Business Analyst', 'Lakshmi Iyer'], Nikhil: [27, false, 'DevOps Engineer', 'Nikhil Bhat'], Swati: [29, true, 'QA Engineer', 'Swati Kulkarni'],
  Divya: [30, true, 'HR Executive', 'Divya Shetty'],
};
const av = (n, s = 30) => photo(PPL[n][0], s, s, { round: true, long: PPL[n][1] });
const full = (n) => PPL[n][3];
const ttl = (n) => PPL[n][2];

// Projects
const PJ = {
  ATLAS: { n: 'Atlas Payments', c: '#0D9488', client: 'Zenith Finserv' },
  NIMBUS: { n: 'Nimbus CRM', c: '#7C3AED', client: 'Orbit Retail' },
  HELIX: { n: 'Helix Mobile', c: '#F59E0B', client: 'Sunrise Health' },
  PORTAL: { n: 'People Portal', c: '#0EA5E9', client: null },
  ORION: { n: 'Orion Insurance', c: '#EF4444', client: 'Orion Life' },
};
const pj = (k, sm) => `<span class="pjt${sm ? ' sm' : ''}"><i style="background:${PJ[k].c}"></i>${PJ[k].n}</span>`;

// Request status
const ST = {
  PM: ['Waiting for PM', C.info, C.infoSoft],
  DD: ['With Delivery Director', C.violet, '#F1EBFE'],
  PMO: ['With PMO', '#EA580C', '#FFEDD5'],
  HOLD: ['On hold', C.warn, C.warnSoft],
  FILLED: ['Filled', C.ok, C.okSoft],
  REJ: ['Rejected', C.bad, C.badSoft],
  WD: ['Withdrawn', C.muted, C.line],
  KEPT: ['Kept on project', C.muted, C.line],
  POOL: ['Sent to PMO pool', '#EA580C', '#FFEDD5'],
  MOVED: ['Reassigned', C.ok, C.okSoft],
};
const sp = (k, extra = '') => `<span class="xst" style="background:${ST[k][2]};color:${ST[k][1]}">${k === 'HOLD' ? icon('pause', 10) : k === 'FILLED' || k === 'MOVED' ? icon('check2', 11) : k === 'REJ' ? icon('x2', 11) : '<i class="sd" style="background:currentColor"></i>'}${ST[k][0]}${extra}</span>`;
// Path: Lead → PM → DD → PMO. at = index of current step; end: 'filled' | 'rej' | 'hold'
const STEPS = ['Lead', 'PM', 'Delivery Dir.', 'PMO'];
const pathline = (at, end = '', who = []) => `<div class="pth">${STEPS.map((s, i) => {
  const done = i < at || (end === 'filled' && i <= at);
  const now = i === at && end !== 'filled';
  const col = now ? (end === 'hold' ? C.warn : end === 'rej' ? C.bad : C.pri) : done ? C.ok : '#C8CCD8';
  const mark = done ? '✓' : now ? (end === 'hold' ? '❚❚' : end === 'rej' ? '✕' : '') : '';
  const skipped = end === 'filled' && i > at;
  return `${i ? `<span class="pl" style="background:${i <= at ? C.ok : C.line}${skipped ? ';opacity:.4' : ''}"></span>` : ''}<span class="ps${skipped ? ' skip' : ''}"><span class="pd${now && !end ? ' now' : ''}" style="border-color:${col};background:${done ? col : now ? col + '18' : '#fff'};color:${done ? '#fff' : col}">${mark}</span><span class="pn"><b style="${now ? `color:${col}` : ''}">${s}</b>${who[i] ? `<span>${who[i]}</span>` : ''}</span></span>`;
}).join('')}</div>`;

// Compact path (dots only) + caption, for table rows
const pathMini = (at, end = '', cap = '') => `<div style="display:flex;flex-direction:column;gap:4px"><div class="pth" style="gap:3px;width:150px">${STEPS.map((s, i) => {
  const done = i < at || (end === 'filled' && i <= at);
  const now = i === at && end !== 'filled';
  const col = now ? (end === 'hold' ? C.warn : end === 'rej' ? C.bad : C.pri) : done ? C.ok : '#C8CCD8';
  return `${i ? `<span class="pl" style="background:${i <= at ? C.ok : C.line}"></span>` : ''}<span class="pd${now && !end ? ' now' : ''}" title="${s}" style="width:16px;height:16px;font-size:7.5px;border-color:${col};background:${done ? col : now ? col + '18' : '#fff'};color:${done ? '#fff' : col}">${done ? '✓' : now ? (end === 'hold' ? '❚❚' : end === 'rej' ? '✕' : '') : ''}</span>`;
}).join('')}</div>${cap ? `<span class="xs mut">${cap}</span>` : ''}</div>`;

// Load bar: segments [[projectKey, %]], request %, label
const load = (segs, req = 0, opts = {}) => {
  const used = segs.reduce((a, [, v]) => a + v, 0);
  const over = used + req > 100;
  const free = Math.max(0, 100 - used);
  return `<div class="ld"><div class="ldb">${segs.map(([k, v]) => `<i style="width:${v}%;background:${PJ[k].c}" title="${PJ[k].n} ${v}%"></i>`).join('')}${req ? `<i class="rq ${over ? 'ov' : ''}" style="width:${Math.min(req, 100 - used) || 2}%"></i>` : ''}</div>${opts.noText ? '' : `<div class="ldt"><span>${used}% booked</span><b style="color:${over ? C.bad : free ? C.ok : C.muted}">${over ? `Only ${free}% free — needs ${req}%` : `${free}% free`}</b></div>`}</div>`;
};

const NEW = '<span class="new">New</span>';
const TODAY_PILL = '';

// ─── Shell: the real sidebar. WORK gets 2 approved items: Resource requests (badge) + PMO pool (PMO only). ───
const sidebar = (on, badge = 0, group = 'WORK', pmo = false) => {
  const grp = (g, items) => g === group
    ? `<div class="sb-g">${g}</div>${items.filter(Boolean).map(([ic, l, b, nw]) => `<div class="sb-i${l === on ? ' on' : ''}">${icon(ic)}<span style="flex:1">${l}</span>${b ? `<span class="nb">${b}</span>` : ''}</div>`).join('')}`
    : `<div class="sb-g">${g} ›</div>`;
  return `<aside class="sb">
<div class="sb-h"><span class="logo">AP</span><span><b>aakash-portal</b><span>HR workspace</span></span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Home</div><div class="sb-i">${icon('idcard')}My profile</div><div class="sb-i">${icon('chart')}Reports &amp; analytics</div><div class="sb-i">${icon('contact')}People</div>
${grp('ORGANIZATION', [['users', 'Employees'], ['network', 'Organisation']])}
${grp('ENGAGEMENT', [])}
${grp('WORK', [['folder', 'Projects'], ['inbox', 'Resource requests', badge, true], pmo ? ['pool', 'PMO pool', 0, true] : null, ['timer', 'My timesheet'], ['check', 'Timesheet approvals']])}
<div class="sb-g">EXPENSES ›</div><div class="sb-g">ASSETS ›</div><div class="sb-g">HELPDESK ›</div><div class="sb-g">TIME ›</div><div class="sb-g">ADMINISTRATION ›</div><div class="sb-g">SETTINGS ›</div>
</aside>`;
};
const header = (crumb, live = true) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs" style="gap:12px">${live ? `<span class="xst" style="background:${C.okSoft};color:${C.ok}"><span class="live"></span>Live</span>` : ''}<span class="bell">${icon('bell', 17)}</span><span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const page = (on, badge, crumb, body, overlay = '', group = 'WORK', pmo = false) => `<div class="app">${sidebar(on, badge, group, pmo || /what changes|Who sees what/.test(crumb))}<div class="col">${header(crumb)}<main class="main">${body}</main></div>${overlay}</div>`;
const note = (items) => `<div class="card notes"><b class="xs" style="letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">What changes</b>${items.map(([k, t]) => `<div class="xs"><span class="${k === 'new' ? 'k-new' : k === 'q' ? 'k-q' : 'k-old'}">${k === 'new' ? 'New' : k === 'q' ? 'Ask' : 'Today'}</span>${t}</div>`).join('')}</div>`;
const tabsBar = (items, on) => `<div class="tabs">${items.map(([ic, l, n, isNew]) => `<span class="${l === on ? 'on' : ''}">${icon(ic, 14)}${l}${n !== undefined && n !== null ? `<em class="tc">${n}</em>` : ''}${isNew ? '<em class="tn">New</em>' : ''}</span>`).join('')}</div>`;
const chip = (t, on) => `<span class="chip${on ? ' on' : ''}">${t}</span>`;
const skill = (t, hit) => `<span class="sk${hit === true ? ' hit' : hit === false ? ' miss' : ''}">${hit === true ? icon('check2', 10) : ''}${t}</span>`;
const fld = (label, inner, hint = '', req = false) => `<div class="f"><label>${label}${req ? ' <span style="color:' + C.bad + '">*</span>' : ''}</label>${inner}${hint ? `<span class="h">${hint}</span>` : ''}</div>`;
const inp = (t, cls = '', ic = '') => `<div class="in ${cls}">${ic ? icon(ic, 14) : ''}<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span></div>`;
const personIn = (n, sub, cls = '') => `<div class="in ${cls}" style="height:40px">${av(n, 24)}<span style="flex:1"><b style="font-size:12.5px">${full(n)}</b> <span class="mut xs">· ${sub ?? ttl(n)}</span></span>${icon('chevd', 14)}</div>`;

// Modal + drawer frames (same as components/ui/modal.tsx: icon tile, title, description, body, footer with Ctrl+Enter hint)
const modal = ({ w = 620, ic = 'userplus', tone = 'pri', title, desc, body, foot, style = '' }) => {
  const t = { pri: [C.priSoft, C.pri], warn: [C.warnSoft, C.warn], bad: [C.badSoft, C.bad], ok: [C.okSoft, C.ok] }[tone];
  return `<div class="mdl" style="width:${w}px;${style}"><div class="mh"><span class="mic" style="background:${t[0]};color:${t[1]};border:1px solid ${t[1]}33">${icon(ic, 18)}</span><div style="flex:1"><b style="font-size:15.5px">${title}</b>${desc ? `<div class="xs mut" style="margin-top:3px">${desc}</div>` : ''}</div><span class="mut">${icon('x2', 16)}</span></div><div class="mb">${body}</div><div class="mf"><span class="xs mut row" style="gap:4px;margin-right:auto"><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></span>${foot}</div></div>`;
};
const drawer = ({ w = 580, head, body, foot }) => `<div class="drw" style="width:${w}px"><div class="dh">${head}</div><div class="db">${body}</div><div class="df">${foot}</div></div>`;
const btn = (t, cls = '', ic = '') => `<span class="btn ${cls}">${ic ? icon(ic, 14) : ''}${t}</span>`;

// Request header used in drawers
const reqHead = (id, role, k, stKey, extra = '') => `<div class="row" style="gap:12px;align-items:flex-start"><span class="mic" style="background:${C.priSoft};color:${C.pri};border:1px solid ${C.pri}33">${icon('userplus', 18)}</span><div style="flex:1;min-width:0"><div class="row xs" style="gap:6px"><span class="mono">${id}</span>${pj(k, true)}${sp(stKey)}</div><b style="font-size:17px;display:block;margin-top:4px">${role}</b>${extra}</div><span class="mut">${icon('x2', 16)}</span></div>`;
const kv = (rows) => `<div class="kv">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>`;

// Vertical timeline
const TL = {
  raise: [C.pri, C.priSoft, 'send'], fwd: [C.violet, '#F1EBFE', 'arrow'], hold: [C.warn, C.warnSoft, 'pause'], unhold: [C.info, C.infoSoft, 'play'],
  fill: [C.ok, C.okSoft, 'check2'], rej: [C.bad, C.badSoft, 'x2'], seen: [C.muted, C.line, 'eye'], pool: ['#EA580C', '#FFEDD5', 'pool'], move: [C.teal, '#E6F6F4', 'route'],
  join: [C.pri, C.priSoft, 'userplus'], rel: [C.warn, C.warnSoft, 'userminus'], note: [C.muted, C.line, 'msg'],
};
const tl = (items, opts = {}) => `<div class="tl${opts.dense ? ' dense' : ''}">${items.map(([k, title, who, when, text, tag], i) => `<div class="te${i === 0 && opts.firstNow ? ' first' : ''}"><span class="ti" style="background:${TL[k][1]};color:${TL[k][0]}">${icon(TL[k][2], 13)}</span><div style="flex:1;min-width:0"><div class="row" style="gap:6px;flex-wrap:wrap"><b style="font-size:13px">${title}</b>${tag || ''}<span class="xs mut" style="margin-left:auto;white-space:nowrap">${when}</span></div>${who ? `<div class="row xs mut" style="gap:6px;margin-top:2px">${who}</div>` : ''}${text ? `<div class="quote">${text}</div>` : ''}</div></div>`).join('')}</div>`;
const by = (n, role) => `${av(n, 18)}<span><b style="color:${C.fg}">${full(n)}</b>${role ? ` · ${role}` : ''}</span>`;

// Candidate row (picker)
const cand = ({ n, match, skills, segs, req, under, sel, note: nt, pool }) => {
  const used = segs.reduce((a, [, v]) => a + v, 0);
  const over = used + req > 100;
  const blocked = over || under === false;
  return `<div class="cd${sel ? ' sel' : ''}${blocked ? ' blk' : ''}"><span class="rad${sel ? ' on' : ''}"></span>${av(n, 34)}<div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b style="font-size:13px">${full(n)}</b><span class="xs mut">${ttl(n)}</span>${match ? `<span class="mt" style="background:${match >= 80 ? C.okSoft : match >= 50 ? C.warnSoft : C.line};color:${match >= 80 ? C.ok : match >= 50 ? C.warn : C.muted}">${match}% match</span>` : ''}</div><div class="row" style="gap:4px;margin-top:4px;flex-wrap:wrap">${skills}</div>${nt ? `<div class="xs" style="margin-top:4px;color:${over ? C.bad : C.muted}">${nt}</div>` : ''}</div><div style="width:190px;flex:none;display:flex;flex-direction:column;gap:4px">${load(segs, req)}${under === true ? `<span class="tagu ok">${icon('check2', 10)}On your projects</span>` : under === false ? `<span class="tagu lk">${icon('lock', 10)}${pool ? 'PMO pool · PMO assigns' : 'Not under you · PMO only'}</span>` : pool ? `<span class="tagu pmo">${icon('pool', 10)}PMO pool</span>` : ''}</div></div>`;
};

// ─── CSS ──────────────────────────────────────────────
const css = adminCss.replace('</style>', `
.nb{min-width:20px;height:18px;padding:0 6px;border-radius:99px;background:${C.pri};color:#fff;font-size:10.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px ${C.priSoft}}
.sb-i.on .nb{box-shadow:none}
.tn2{font-style:normal;font-size:8.5px;font-weight:900;padding:1px 5px;border-radius:99px;background:#DCFCE7;color:#166534;text-transform:uppercase;vertical-align:middle}
.xst{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.xst .sd{width:6px;height:6px;border-radius:50%;display:inline-block}
.live{width:8px;height:8px;border-radius:50%;background:${C.ok};display:inline-block;animation:breathe 7s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:1}50%{opacity:.4}}
.bell{position:relative;display:inline-flex}
.mono{font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:11.5px;color:${C.muted}}
.pjt{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;white-space:nowrap}.pjt i{width:9px;height:9px;border-radius:3px;display:inline-block}
.pjt.sm{font-size:11px;padding:2px 8px;border-radius:99px;background:${C.raised};border:1px solid ${C.line}}
.pth{display:flex;align-items:center;gap:4px}
.ps{display:flex;align-items:center;gap:6px;white-space:nowrap}.ps.skip{opacity:.4}
.pd{width:20px;height:20px;border-radius:50%;border:2px solid;display:inline-flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:900;flex:none}
.pd.now{animation:soft 7s ease-in-out infinite}@keyframes soft{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.pn{display:flex;flex-direction:column;line-height:1.15}.pn b{font-size:11px}.pn span{font-size:10px;color:${C.muted}}
.pl{flex:1;min-width:12px;height:2px;border-radius:2px}
.ld{display:flex;flex-direction:column;gap:3px}
.ldb{height:8px;border-radius:99px;background:${C.line};overflow:hidden;display:flex}
.ldb i{display:block;height:100%;transform-origin:left;animation:fw 1.2s cubic-bezier(.2,.8,.2,1) both}
.ldb i.rq{background:repeating-linear-gradient(135deg,${C.pri} 0 4px,${C.pri}88 4px 8px)}.ldb i.rq.ov{background:repeating-linear-gradient(135deg,${C.bad} 0 4px,${C.bad}88 4px 8px)}
.ldt{display:flex;justify-content:space-between;font-size:10.5px;color:${C.muted};gap:6px}.ldt b{font-size:10.5px}
.sk{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:${C.raised};border:1px solid ${C.line};color:#374151;white-space:nowrap}
.sk.hit{background:${C.okSoft};border-color:${C.ok}33;color:${C.ok}}.sk.miss{opacity:.55;text-decoration:line-through}
.sk.big{font-size:12px;padding:4px 10px;border-radius:99px}
.mt{font-size:10px;font-weight:900;padding:1px 7px;border-radius:99px}
.cd{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid ${C.border};border-radius:12px;background:#fff}
.cd.sel{border-color:${C.pri};box-shadow:0 0 0 3px ${C.priSoft}}.cd.blk{background:${C.raised}}.cd.blk .ph{opacity:.6}
.rad{width:16px;height:16px;border-radius:50%;border:2px solid #CBD2DE;flex:none;margin-top:9px;background:#fff}.rad.on{border:5px solid ${C.pri}}
.tagu{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;align-self:flex-start}
.tagu.ok{background:${C.okSoft};color:${C.ok}}.tagu.lk{background:${C.line};color:${C.muted}}.tagu.pmo{background:#FFEDD5;color:#C2410C}
.kv{display:grid;grid-template-columns:120px 1fr;gap:7px 12px;font-size:12.5px}.kv span{color:${C.muted}}.kv b{font-weight:700}
.quote{margin-top:6px;padding:8px 11px;border-radius:10px;background:${C.raised};border:1px solid ${C.line};font-size:12.5px;line-height:1.45}
.tl{display:flex;flex-direction:column;position:relative}
.tl:before{content:'';position:absolute;left:14px;top:10px;bottom:10px;width:2px;background:${C.line}}
.te{display:flex;gap:12px;padding:8px 0;position:relative}
.tl.dense .te{padding:5px 0}
.ti{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;position:relative;box-shadow:0 0 0 4px #fff}
.te.first .ti{animation:soft 7s ease-in-out infinite}
.pref{border:1.5px solid ${C.border};border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;background:#fff;position:relative}
.pref.ok{border-color:${C.ok}66;background:linear-gradient(180deg,${C.okSoft}66,#fff)}
.pref.lk{border-style:dashed;background:${C.raised}}
.banner{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:12px;font-size:12.5px;line-height:1.45}
.banner.warn{background:${C.warnSoft};color:#7C4A03;border:1px solid ${C.warn}44}.banner.info{background:${C.infoSoft};color:#0C4A6E;border:1px solid ${C.info}33}
.banner.bad{background:${C.badSoft};color:#7F1D1D;border:1px solid ${C.bad}33}.banner.ok{background:${C.okSoft};color:#065F46;border:1px solid ${C.ok}33}
.banner.pri{background:${C.priSoft};color:${C.priText};border:1px solid ${C.pri}33}
.opt{border:1.5px solid ${C.border};border-radius:12px;padding:11px 12px;display:flex;gap:10px;align-items:flex-start;background:#fff}
.opt.on{border-color:${C.pri};background:${C.priSoft}55;box-shadow:0 0 0 3px ${C.priSoft}}
.opt .oi{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.ta{min-height:64px;border:1px solid ${C.border};border-radius:9px;padding:9px 11px;font-size:12.5px;background:#fff;line-height:1.45}
.ta.foc{border-color:${C.pri};box-shadow:0 0 0 3px ${C.priSoft}}
.tabs em.tc{font-style:normal;font-size:10.5px;font-weight:800;padding:0 6px;border-radius:99px;background:${C.line};color:${C.muted}}
.tabs span.on em.tc{background:rgba(255,255,255,.25);color:#fff}
.tabs em.tn{font-style:normal;font-size:9px;font-weight:900;padding:1px 6px;border-radius:99px;background:#DCFCE7;color:#166534;text-transform:uppercase}
.rq-row{display:grid;grid-template-columns:76px minmax(0,1.5fr) 100px 160px minmax(0,1.5fr) 96px;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid ${C.line};font-size:12.5px}
.rq-row.h{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};background:${C.raised};padding:9px 14px}
.rq-row.attn{background:linear-gradient(90deg,${C.priSoft}88,transparent 40%)}
.hdcell{padding:12px 16px;border-right:1px solid ${C.border}}
.ib{display:grid;grid-template-columns:4px 1fr;border:1px solid ${C.border};border-radius:14px;background:#fff;overflow:hidden}
.ib>i{display:block}.ib>div{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.cap{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:${C.pri};display:flex;align-items:center;gap:8px}
.cap i{font-style:normal;width:22px;height:22px;border-radius:50%;background:${C.pri};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
.panel{position:relative;border-radius:18px;background:${C.bg};border:1px solid ${C.border};overflow:hidden}
.panel .mdl,.panel .drw{position:relative;left:auto;top:auto;transform:none;box-shadow:0 18px 50px -20px rgba(17,24,39,.35);border:1px solid ${C.border}}
.panel .drw{width:auto!important;border-radius:16px}.panel .mdl{width:auto!important}
.flowb{display:flex;align-items:stretch;gap:0}
.fstep{flex:1;border:1px solid ${C.border};border-radius:14px;background:#fff;padding:12px;display:flex;flex-direction:column;gap:6px;position:relative}
.farr{width:34px;display:flex;align-items:center;justify-content:center;color:${C.muted};flex:none}
.act{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px}
.mx td,.mx th{text-align:center}.mx td:first-child,.mx th:first-child{text-align:left}
.y{color:${C.ok};font-weight:900}.n{color:#C4C8D2}.s{font-size:11px;color:${C.muted};font-weight:600}
.btn.dng{color:${C.bad};border-color:${C.bad}44}.btn.wrn{color:#B45309;border-color:${C.warn}55}.btn.dis{opacity:.45}
.btn.ok{background:${C.ok};border-color:${C.ok};color:#fff}
.radio-card{border:1.5px solid ${C.border};border-radius:12px;padding:12px;display:flex;gap:10px;align-items:flex-start;background:#fff;flex:1}
.radio-card.on{border-color:${C.pri};background:${C.priSoft}55;box-shadow:0 0 0 3px ${C.priSoft}}
.pool-card{border:1px solid ${C.border};border-radius:14px;background:#fff;padding:12px 14px;display:flex;flex-direction:column;gap:9px}
.days{font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px}
.rise>*{animation:rise .6s cubic-bezier(.2,.8,.2,1) both}.rise>*:nth-child(2){animation-delay:.08s}.rise>*:nth-child(3){animation-delay:.16s}.rise>*:nth-child(4){animation-delay:.24s}.rise>*:nth-child(5){animation-delay:.32s}.rise>*:nth-child(6){animation-delay:.4s}

.ovl{z-index:2}.drw,.mdl{z-index:4}.main>.notes{max-width:530px}.main .notes{position:relative;z-index:3;box-shadow:0 14px 34px -14px rgba(17,24,39,.45)}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`);

// ═════════════════════════ Board 0 · What changes ═════════════════════════
function overview() {
  const rows = [
    ['Project page', 'Tabs Overview / Team / Milestones / Updates. “Open roles” card (PM/PMO opens a seat; PMO uses “Find someone free”).', 'New <b>Requests</b> tab. Leads get <b>Request a person</b> and <b>Release</b> (on a Team row). Open roles become requests with an approval path.'],
    ['Project form', 'Name, code, type, client, status, dates, colour. PM is added as a team member (role “Project manager”).', '<b>Project manager</b> + <b>Delivery Director</b> pickers. DD is suggested from the PM’s reporting manager.'],
    ['Assign people', 'Only PMO (project.manage) assigns. Allocation ≤ 100% is blocked (kept).', 'PM and Delivery Director can also <b>fill a request directly</b> — only with people already on their projects.'],
    ['Inbox', '—', 'New page <b>Work → Resource requests</b> (Leads, PMs, DDs, PMO) with a count badge: Waiting for me / On hold / Raised by me / Done. Live. Each project keeps a small Requests tab.'],
    ['Decisions', '—', 'Fill directly · Approve → next step · <b>Hold</b> (reason) · <b>Unhold</b> · Reject (reason). Everything goes in the history.'],
    ['Release', 'PMO edits the end date or removes the person.', 'Lead asks: “no longer needed” + last date. PM / DD: send to PMO pool, reassign to another of their projects, hold, or keep.'],
    ['Employee profile', 'Projects tab: allocation bar + current projects.', '<b>Assignment history</b> timeline (requested, assigned, reassigned, released, pool). Leads get <b>Request back</b>.'],
    ['Add employee', 'Step 3 “Manager”: pick a person or nobody.', '“Reports to”: <b>a person</b> or <b>the PMO</b>. People under PMO form the PMO pool.'],
    ['Resource planner', 'Weekly heatmap, counts, “Open roles — who could take them”.', 'Grid kept (reached from Projects). Open roles card → <b>Requests waiting for the PMO</b>.'],
    ['PMO pool', '—', 'New page <b>Work → PMO pool</b> (PMO only): free %, skills, since when, last project, Assign to project.'],
    ['Skills', 'Not stored today.', 'Skill chips on each person (needed for “best match”). See question 2.'],
  ];
  const html = page('Resource requests', 4, 'Work &nbsp;›&nbsp; <b>Resource requests — what changes</b>', `
${top('Work', 'Resource requests &amp; reassignment', 'Leads ask for people and release people. Each request goes Lead → Project Manager → Delivery Director → PMO. Anyone on the way can fill it, hold it or reject it. The Work menu gets two new items: <b>Resource requests</b> and <b>PMO pool</b> (PMO only).')}
<div class="card sec" style="gap:14px"><h3>${icon('route', 16)}Two directions <span class="r">sample: Atlas Payments · PM Ravi Kumar · Delivery Director Suresh Pillai · PMO Vikram Rao</span></h3>
<div class="cap" style="color:${C.pri}">A · Request a person</div>
<div class="flowb">
${[
    ['Priya', 'Team Lead', 'Raises the request: role, skills, %, dates, reason, preferred person (optional).', [['send', 'Raise', C.pri]]],
    ['Ravi', 'Project Manager', 'Fills it from people on his projects, or sends it up.', [['check2', 'Fill', C.ok], ['arrow', 'Approve →', C.violet], ['pause', 'Hold', C.warn], ['x2', 'Reject', C.bad]]],
    ['Suresh', 'Delivery Director', 'Same choices, with people on all projects he directs.', [['check2', 'Fill', C.ok], ['arrow', 'Approve →', '#EA580C'], ['pause', 'Hold', C.warn], ['x2', 'Reject', C.bad]]],
    ['Vikram', 'PMO', 'Assigns the preferred person or anyone free (PMO pool first).', [['check2', 'Assign', C.ok], ['pause', 'Hold', C.warn], ['x2', 'Reject', C.bad]]],
  ].map(([n, r, d, acts], i) => `${i ? `<span class="farr">${icon('arrow', 18)}</span>` : ''}<div class="fstep"><div class="row" style="gap:8px">${av(n, 30)}<div><b style="font-size:13px">${full(n)}</b><div class="xs mut">${r}</div></div></div><div class="xs mut">${d}</div><div class="row" style="gap:4px;flex-wrap:wrap;margin-top:auto">${acts.map(([ic, t, c]) => `<span class="act" style="background:${c}18;color:${c}">${icon(ic, 10)}${t}</span>`).join('')}</div></div>`).join('')}
</div>
<div class="cap" style="color:#C2410C;margin-top:4px">B · Release (the other way)</div>
<div class="flowb">
${[
    ['Karan', 'Team Lead', '“Sara is no longer needed” + reason + last day (31 Oct).', [['userminus', 'Release', C.warn]]],
    ['Ravi', 'PM (or Suresh, DD)', 'Decides what happens next.', [['pool', 'PMO pool', '#EA580C'], ['route', 'Reassign', C.teal], ['pause', 'Hold', C.warn], ['undo', 'Keep', C.muted]]],
    ['Vikram', 'PMO', 'Sees Sara in the PMO pool from 1 Nov, free 60%.', [['pool', 'Pool', '#EA580C']]],
    ['Priya', 'Any Lead, later', 'Can “Request back” a released person — the form is pre-filled.', [['undo', 'Request back', C.pri]]],
  ].map(([n, r, d, acts], i) => `${i ? `<span class="farr">${icon('arrow', 18)}</span>` : ''}<div class="fstep"><div class="row" style="gap:8px">${av(n, 30)}<div><b style="font-size:13px">${full(n)}</b><div class="xs mut">${r}</div></div></div><div class="xs mut">${d}</div><div class="row" style="gap:4px;flex-wrap:wrap;margin-top:auto">${acts.map(([ic, t, c]) => `<span class="act" style="background:${c}18;color:${c}">${icon(ic, 10)}${t}</span>`).join('')}</div></div>`).join('')}
</div></div>
<div style="display:grid;grid-template-columns:1.55fr 1fr;gap:16px;align-items:start">
<div class="card" style="overflow:hidden"><table class="tbl"><tr><th style="width:120px">Where</th><th>Today (kept)</th><th>New</th></tr>
${rows.map(([s, a, b]) => `<tr><td><b>${s}</b></td><td class="mut">${a}</td><td>${b}</td></tr>`).join('')}</table></div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="gap:8px"><h3>${icon('shield', 15)}Hard rules (kept)</h3>
${['Nobody goes over <b>100%</b> on overlapping dates — pickers block it.', 'PM / DD can only assign people <b>already on their projects</b>. Anyone else → only the PMO.', 'Hold and Reject <b>always need a reason</b>. The Lead is told.', 'Every step is saved: who, when, what, why.'].map((t) => `<div class="xs row" style="gap:8px;align-items:flex-start"><span style="color:${C.ok}">${icon('check2', 14)}</span><span>${t}</span></div>`).join('')}</div>
<div class="card sec" style="gap:8px"><h3>${icon('sparkle', 15)}Motion (slow, soft)</h3>
${['The current step dot breathes (7 s).', 'Load bars fill once when a picker opens.', 'A new request slides into the inbox; the menu count fades to the new number.', 'Still frames with “Reduce motion”. Calm = no slide. Off = nothing moves.'].map((t) => `<div class="xs mut">• ${t}</div>`).join('')}</div>
<div class="card sec" style="gap:6px;background:${C.raised}"><b class="xs">Boards in this row</b><div class="xs mut">Project tab · Request form · PM review · Not under you · Hold · Reject · Delivery Director · PMO · Release · Release decision · Inbox · My requests · Timeline · Assignment history · Add employee · PMO pool · Project form · Who sees what · Dark ×2</div></div>
</div></div>`);
  return dcPage('Resource requests — what changes', css, html, 1480);
}

// ═════════════════════════ Board 1 · Project page — Requests tab (Lead) ═════════════════════════
const projectHeader = (actions) => `<div><span class="btn sm" style="border:none;background:none;padding:0;color:${C.muted}">${icon('arrow', 13)} Projects</span></div>
<div class="card" style="overflow:hidden"><span style="display:block;height:8px;background:linear-gradient(90deg,${PJ.ATLAS.c},${PJ.ATLAS.c}aa)"></span>
<div class="row" style="gap:16px;padding:18px 20px"><span style="width:56px;height:56px;border-radius:16px;background:${PJ.ATLAS.c}1f;color:${PJ.ATLAS.c};display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:900;font-size:12px">ATLA</span>
<div style="flex:1"><div class="row" style="gap:8px"><h1 style="font-size:23px;margin:0">Atlas Payments</h1><span class="pill p-ok"><i class="dot" style="background:${C.ok}"></i>On track</span><span class="pill p-pri">${icon('brief', 11)}Client · billable</span></div>
<div class="sub" style="font-size:13px">Zenith Finserv · 1 Apr 2026 – 31 Mar 2027 · PM Ravi Kumar · <b style="color:${C.fg}">Delivery Director Suresh Pillai</b> ${NEW}</div></div>
${actions}</div>
<div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid ${C.border}">${[['Milestones', '2 of 5 done', 'none late'], ['Timeline', '51% gone', '175 days left'], ['Team', '9 people', '2 leads · 8 billed'], ['Next milestone', 'Checkout UAT', '15 Nov · in 39 days'], ['Open requests', '3 open', '1 on hold']].map(([l, v, s], i) => `<div class="hdcell" style="${i === 4 ? 'border-right:none' : ''}"><div class="xs mut">${l}</div><b style="font-size:15px">${v}</b><div class="xs mut">${s}${i === 4 ? ' ' + NEW : ''}</div></div>`).join('')}</div></div>`;

function projectTab() {
  const reqs = [
    ['RR-0148', 'Senior React developer', '50% · 20 Oct → 31 Mar', 'Kavya Nair', 'PM', pathMini(1, '', 'with Ravi (PM)'), 'Priya · today 10:12', true],
    ['RR-0147', 'QA engineer (automation)', '100% · from 1 Nov', '—', 'DD', pathMini(2, '', 'with Suresh (DD)'), 'Priya · 5 Oct'],
    ['RR-0145', 'DevOps engineer', '30% · 15 Oct → 31 Dec', 'Dev Menon', 'PMO', pathMini(3, '', 'with Vikram (PMO)'), 'Karan · 3 Oct'],
    ['RR-0141', 'Business analyst', '50% · from 1 Nov', '—', 'HOLD', pathMini(1, 'hold', 'held by Ravi'), 'Priya · 29 Sep'],
    ['RR-0139', 'Java backend developer', '100% · from 1 Oct', 'Harish Gowda', 'FILLED', pathMini(3, 'filled', 'filled by Vikram'), 'Priya · 18 Sep'],
    ['RR-0136', 'UI designer', '50% · from 1 Oct', '—', 'REJ', pathMini(2, 'rej', 'stopped at Suresh'), 'Priya · 12 Sep'],
  ];
  const body = `${projectHeader(`<div class="row" style="gap:8px">${btn('Post update', '', 'msg')}${btn('Release someone', 'wrn', 'userminus')}${btn('Request a person', 'pri', 'userplus')}</div>`)}
${tabsBar([['activity', 'Overview'], ['users', 'Team', 9], ['flag', 'Milestones', 5], ['msg', 'Updates', 7], ['inbox', 'Requests', 4, true]], 'Requests')}
<div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start">
<div style="display:flex;flex-direction:column;gap:12px">
<div class="row" style="justify-content:space-between"><div class="row" style="gap:6px">${chip('Open · 4', true)}${chip('On hold · 1')}${chip('Filled · 6')}${chip('Rejected · 1')}${chip('Releases · 1')}</div><span class="xs" style="color:${C.pri};font-weight:700">Only Atlas Payments · open all in Work → Resource requests →</span></div>
<div class="card" style="overflow:hidden"><div class="rq-row h"><span>Request</span><span>Role · when</span><span>Preferred</span><span>Where it is</span><span>Status</span><span>Raised</span></div>
${reqs.map(([id, role, when, pref, st, pth, raised, attn]) => `<div class="rq-row${attn ? ' attn' : ''}"><span class="mono">${id}</span><div><b>${role}</b><div class="xs mut">${when}</div></div><span class="row xs" style="gap:6px">${pref !== '—' ? `${av(pref.split(' ')[0], 22)}<b>${pref.split(' ')[0]}</b>` : '<span class="mut">Anyone</span>'}</span><div>${pth}</div><div>${sp(st)}${st === 'HOLD' ? `<div class="xs mut" style="margin-top:3px">Ravi: “Client has not signed the change yet”</div>` : st === 'REJ' ? `<div class="xs mut" style="margin-top:3px">Suresh: “Design moves to the client team”</div>` : st === 'FILLED' ? `<div class="xs mut" style="margin-top:3px">Harish · by Vikram (PMO)</div>` : ''}</div><span class="xs mut">${raised}</span></div>`).join('')}
<div class="rq-row" style="background:${C.warnSoft}55"><span class="mono">RL-0032</span><div><b>Release · Sara Khan</b><div class="xs mut">Last day 31 Oct · “Mobile part is done”</div></div><span class="row xs" style="gap:6px">${av('Sara', 22)}<b>Sara</b></span><div class="xs mut">Karan → <b style="color:${C.fg}">Ravi decides</b></div><div>${sp('PM')}</div><span class="xs mut">Karan · today 9:40</span></div>
</div>
<div class="xs mut row" style="gap:6px">${icon('info', 13)}Click a row to open the request with its full timeline. Rejected ones show <b>Raise again</b>; released people show <b>Request back</b>.</div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div class="card sec" style="gap:10px"><h3>${icon('git', 15)}Who decides here</h3>
${[['Priya', 'Team Lead · you', 'Raises'], ['Ravi', 'Project manager', 'Step 1'], ['Suresh', 'Delivery Director', 'Step 2'], ['Vikram', 'PMO', 'Step 3']].map(([n, r, s]) => `<div class="row" style="gap:10px">${av(n, 28)}<div style="flex:1"><b class="xs">${full(n)}</b><div class="xs mut">${r}</div></div><span class="pill p-neu">${s}</span></div>`).join('')}</div>
<div class="card sec" style="gap:8px"><h3>${icon('users', 15)}Team · release from a row</h3>
${[['Amit', '100%', 'Priya'], ['Neha', '100%', 'Priya'], ['Sara', '60%', 'Karan']].map(([n, a, l]) => `<div class="row" style="gap:10px">${av(n, 26)}<div style="flex:1"><b class="xs">${full(n)}</b><div class="xs mut">Lead ${l}</div></div><b class="xs">${a}</b><span class="mut" title="More">${icon('more', 16)}</span></div>`).join('')}
<div class="xs" style="padding:8px 10px;border-radius:10px;background:${C.raised};border:1px solid ${C.line}">Row menu for a Lead (own members only): <b>Release from project…</b> · View history</div></div>
${note([['old', 'Header, health, the 5 numbers and the first 4 tabs stay.'], ['new', 'Small Requests tab (this project only) with status + 4-step path; the full inbox is Work → Resource requests.'], ['new', 'Leads: Request a person, Release someone. Members do not see the tab.'], ['q', 'Merge “Open roles” into requests? (question 1)']])}
</div></div>`;
  return dcPage('Project page — Requests tab', css, page('Projects', 0, 'Projects &nbsp;›&nbsp; <b>Atlas Payments</b>', body), 1180);
}

// ═════════════════════════ Board 2 · Request a person (popup) ═════════════════════════
function requestForm() {
  const body = `
<div style="display:grid;grid-template-columns:1fr 150px;gap:12px">${fld('Role needed', inp('Senior React developer', 'foc'), '', true)}${fld('Allocation', `<div class="in" style="justify-content:space-between"><b>50</b><span class="mut">%</span></div>`, '5–100, steps of 5', true)}</div>
${fld('Skills', `<div class="in" style="height:auto;min-height:38px;flex-wrap:wrap;padding:6px 8px;gap:5px">${['React', 'TypeScript', 'Payments UI', 'Jest'].map((s) => `<span class="sk big" style="background:${C.priSoft};color:${C.priText};border-color:${C.pri}33">${s} ${icon('x2', 10)}</span>`).join('')}<span class="mut xs">Add a skill…</span></div>`, 'Used to find the best match. Pick from the company list or type a new one.')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${fld('From', inp('20 Oct 2026', '', 'cal'), '', true)}${fld('Until (optional)', inp('31 Mar 2027', '', 'cal'), 'Blank = until the project ends')}</div>
${fld('Why do you need this person?', `<div class="ta">Checkout revamp UAT is on 15 Nov. We are one front-end developer short — Neha is on the API side now.</div>`, 'Your PM, Delivery Director and the PMO read this.', true)}
<div class="f"><label>Preferred person <span class="mut" style="font-weight:600">(optional)</span></label>
<div class="pref ok">${av('Kavya', 40)}<div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b>Kavya Nair</b><span class="xs mut">Senior Front-end Engineer</span></div>
<div class="row" style="gap:4px;margin-top:5px">${skill('React', true)}${skill('TypeScript', true)}${skill('Payments UI', true)}${skill('Jest', false)}</div>
<div class="xs mut" style="margin-top:6px">On ${pj('NIMBUS')} 50% until 31 Dec · PM there is Ravi</div></div>
<div style="width:180px">${load([['NIMBUS', 50]], 50)}<span class="tagu ok" style="margin-top:5px">${icon('check2', 10)}Ravi (your PM) can assign her</span></div></div>
<span class="h">Search shows each person’s free % for your dates. You can still send the request if they are busy — approvers will see it.</span></div>
<div class="banner pri">${icon('route', 16)}<span>Goes to <b>Ravi Kumar</b> (PM) first → <b>Suresh Pillai</b> (Delivery Director) → <b>PMO</b>. You will see every step under <b>Work → Resource requests</b>.</span></div>`;
  const overlay = `<div class="ovl"></div>${modal({ w: 660, ic: 'userplus', title: 'Request a person for Atlas Payments', desc: 'Tell your PM who you need. Anyone on the way can fill it.', body, foot: `${btn('Cancel')}${btn('Send request', 'pri', 'send')}`, style: 'top:52%' })}`;
  const side = `<div style="position:absolute;right:28px;top:96px;width:300px;display:flex;flex-direction:column;gap:10px;z-index:5">
<div class="card sec" style="gap:8px"><b class="xs">Picker — when you search “Am”</b>
<div class="cd blk" style="padding:8px">${av('Amit', 26)}<div style="flex:1"><b class="xs">Amit Verma</b><div class="xs" style="color:${C.bad}">0% free · on Atlas 100%</div></div></div>
<div class="cd" style="padding:8px">${av('Tanvi', 26)}<div style="flex:1"><b class="xs">Tanvi Joshi</b><div class="xs" style="color:${C.ok}">100% free · PMO pool</div></div></div>
<div class="xs mut">Busy people stay in the list but show red. The <b>Send</b> button still works — busy is a warning here, the hard block is when someone assigns.</div></div>
${note([['old', '“Open a role” dialog had role, % and from date only.'], ['new', 'Skills, end date, reason (required), preferred person with live load.'], ['new', 'Shows the path and who can assign the preferred person.'], ['q', 'Preferred person: show to the employee? (q 7)']])}</div>`;
  return dcPage('Request a person — popup', css, page('Projects', 0, 'Projects &nbsp;›&nbsp; <b>Atlas Payments</b>', `${projectHeader('')}${tabsBar([['activity', 'Overview'], ['users', 'Team', 9], ['flag', 'Milestones', 5], ['msg', 'Updates', 7], ['inbox', 'Requests', 4, true]], 'Requests')}<div class="card" style="height:420px"></div>`, overlay + side), 1080);
}

// ═════════════════════════ Inbox page (used behind drawers) ═════════════════════════
const inboxRows = [
  ['RR-0148', 'ATLAS', 'Senior React developer', '50% · from 20 Oct', 'Priya', 'Kavya', 'PM', 'today 10:12', true],
  ['RL-0032', 'ATLAS', 'Release · Sara Khan', 'last day 31 Oct', 'Karan', 'Sara', 'PM', 'today 9:40', true, true],
  ['RR-0150', 'NIMBUS', 'Data engineer', '100% · from 1 Nov', 'Karan', null, 'PM', 'yesterday', true],
  ['RR-0149', 'NIMBUS', 'Manual tester', '50% · from 15 Oct', 'Karan', 'Rohit', 'PM', '5 Oct · 2 days', true],
];
function inboxPage({ tab = 'Waiting for me', dim = false } = {}) {
  return `${top('Work', 'Resource requests ' + NEW, 'Ravi Kumar · Project manager — requests and releases waiting for you on all your projects.', `${btn('Request a person', '', 'userplus')}`)}
<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
<div class="seg2">${[['Waiting for me', 4], ['On hold', 1], ['Raised by me', 0], ['Done', 12]].map(([l, n]) => `<span class="${l === tab ? 'on' : ''}">${l} · ${n}</span>`).join('')}</div>
<div class="row" style="gap:6px">${chip(`${icon('folder', 13)}All my projects ${icon('chevd', 12)}`)}${chip('Requests + releases')}${chip(`${icon('search', 13)}Search`)}</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${[['Waiting for me', '4', C.pri, 'oldest 2 days'], ['On hold', '1', C.warn, 'RR-0141 · 8 days'], ['Filled this month', '6', C.ok, '2 directly by you'], ['People free on my projects', '2', C.teal, 'Kavya 50% · Swati 50%']].map(([l, v, c, s]) => `<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><span class="xs mut">${l}</span><b style="font-size:24px;color:${c}">${v}</b><span class="xs mut">${s}</span></div>`).join('')}</div>
<div class="card" style="overflow:hidden${dim ? '' : ''}">
${inboxRows.map(([id, k, role, when, lead, pref, st, age, unread, rel]) => `<div class="row" style="gap:12px;padding:13px 16px;border-bottom:1px solid ${C.line};${id === 'RR-0148' && dim ? `background:${C.priSoft}` : ''}"><span style="width:8px;height:8px;border-radius:50%;background:${unread ? C.pri : 'transparent'}"></span><span class="mic" style="width:34px;height:34px;background:${rel ? C.warnSoft : C.priSoft};color:${rel ? C.warn : C.pri}">${icon(rel ? 'userminus' : 'userplus', 16)}</span><div style="flex:1;min-width:0"><div class="row xs" style="gap:6px"><span class="mono">${id}</span>${pj(k, true)}</div><b style="font-size:13.5px">${role}</b> <span class="xs mut">· ${when}</span></div><span class="row xs" style="gap:6px;width:150px">${av(lead, 22)}<span>from <b>${lead}</b></span></span><span class="row xs" style="gap:6px;width:150px">${pref ? `${av(pref, 22)}<span>${rel ? '' : 'wants '}<b>${pref}</b></span>` : '<span class="mut">No preference</span>'}</span>${sp(st)}<span class="xs mut" style="width:90px;text-align:right">${age}</span></div>`).join('')}
</div>`;
}

// ═════════════════════════ Board 3 · PM review drawer ═════════════════════════
function reviewBody() {
  return `<div class="banner info" style="padding:9px 12px">${icon('info', 15)}<span>You are the <b>Project manager</b> on Atlas Payments. You can fill this with people on <b>your projects</b> (Atlas, Nimbus CRM).</span></div>
<div class="card sec" style="gap:10px;padding:12px 14px">${kv([['Raised by', `<span class="row" style="gap:6px">${av('Priya', 18)}Priya Sharma · Team Lead · today 10:12</span>`], ['Allocation', '50% · 20 Oct 2026 → 31 Mar 2027'], ['Skills', `<span class="row" style="gap:4px">${['React', 'TypeScript', 'Payments UI', 'Jest'].map((s) => skill(s)).join('')}</span>`], ['Why', '“Checkout revamp UAT is on 15 Nov. We are one front-end developer short.”']])}</div>
<div class="lbl">Preferred person</div>
<div class="pref ok"><span class="rad on"></span>${av('Kavya', 38)}<div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b>Kavya Nair</b><span class="mt" style="background:${C.okSoft};color:${C.ok}">92% match</span></div><div class="row" style="gap:4px;margin-top:4px">${skill('React', true)}${skill('TypeScript', true)}${skill('Payments UI', true)}${skill('Jest', false)}</div><div class="xs mut" style="margin-top:5px">On Nimbus CRM 50% (you are PM there) until 31 Dec</div></div><div style="width:160px">${load([['NIMBUS', 50]], 50)}<span class="tagu ok" style="margin-top:5px">${icon('check2', 10)}On your projects</span></div></div>
<div class="row" style="justify-content:space-between"><span class="lbl">Or someone who fits better</span><span class="xs mut">sorted by skills, then free %</span></div>
${cand({ n: 'Swati', match: 55, skills: `${skill('TypeScript', true)}${skill('Jest', true)}${skill('React', false)}`, segs: [['NIMBUS', 50]], req: 50, under: true, note: 'QA engineer — knows the code, not React' })}
${cand({ n: 'Amit', match: 75, skills: `${skill('React', true)}${skill('TypeScript', true)}${skill('Payments UI', true)}`, segs: [['ATLAS', 100]], req: 50, under: true, note: 'Already 100% on Atlas — would go over 100%' })}
${cand({ n: 'Tanvi', match: 50, skills: `${skill('React', true)}${skill('TypeScript', false)}`, segs: [], req: 50, under: false, pool: true, note: '' })}
<div class="xs mut">People not on your projects are shown greyed so you know they exist — only the PMO can assign them.</div>`;
}
function reviewFoot(who = 'Kavya') {
  return `${btn('Reject', 'dng', 'x2')}${btn('Hold', 'wrn', 'pause')}<span style="flex:1"></span>${btn('Approve → Suresh (DD)', '', 'arrow')}${btn(`Fill with ${who} · 50%`, 'pri', 'check2')}`;
}
function reviewPM() {
  const overlay = `<div class="ovl"></div>${drawer({
    w: 640,
    head: reqHead('RR-0148', 'Senior React developer', 'ATLAS', 'PM', `<div style="margin-top:10px">${pathline(1, '', ['Priya', 'Ravi · you', 'Suresh', 'Vikram'])}</div>`),
    body: reviewBody(),
    foot: reviewFoot(),
  })}`;
  const left = `${inboxPage({ dim: true })}${note([['old', 'Today only the PMO assigns, from the member dialog.'], ['new', 'PM opens the request in a side drawer. Preferred person first, then best matches with free %.'], ['new', '“Fill with Kavya” makes the assignment at once: Member, team lead Priya, 50% from 20 Oct.'], ['new', 'Over 100% → the row is greyed and the Fill button is off.']])}`;
  return dcPage('PM review — fill or approve', css, page('Resource requests', 4, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', left, overlay), 1120);
}

// ═════════════════════════ Board 4 · Preferred person NOT under you ═════════════════════════
function notUnder() {
  const body = `<div class="card sec" style="gap:10px;padding:12px 14px">${kv([['Raised by', `<span class="row" style="gap:6px">${av('Karan', 18)}Karan Mehta · Team Lead · 3 Oct</span>`], ['Allocation', '30% · 15 Oct → 31 Dec 2026'], ['Skills', `<span class="row" style="gap:4px">${['Kubernetes', 'AWS', 'CI/CD'].map((s) => skill(s)).join('')}</span>`], ['Why', '“Payment gateway goes live in December. We need someone for the release pipeline.”']])}</div>
<div class="lbl">Preferred person</div>
<div class="pref lk">${av('Dev', 38)}<div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b>Dev Menon</b><span class="mt" style="background:${C.okSoft};color:${C.ok}">100% match</span></div><div class="row" style="gap:4px;margin-top:4px">${skill('Kubernetes', true)}${skill('AWS', true)}${skill('CI/CD', true)}</div><div class="xs mut" style="margin-top:5px">On ${pj('HELIX')} 70% · PM there is Farhan Ali</div></div><div style="width:170px">${load([['HELIX', 70]], 30)}<span class="tagu lk" style="margin-top:5px">${icon('lock', 10)}Not under you</span></div></div>
<div class="banner warn">${icon('lock', 16)}<span><b>Dev is not on any of your projects</b>, so you can’t assign him. You can still <b>approve</b> — the request goes to Suresh (Delivery Director) and then the PMO, who can assign anyone. Your note will travel with it.</span></div>
<div class="lbl">People on your projects</div>
<div class="card" style="padding:16px;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center;background:${C.raised}"><span style="font-size:22px">🔍</span><b class="xs">Nobody on Atlas or Nimbus CRM has these skills and 30% free.</b><span class="xs mut">Closest: Amit Verma (CI/CD) — 0% free.</span></div>
${fld('Note for the next step (optional)', `<div class="ta" style="min-height:48px">Agree we need this. Dev knows our stack from Helix — please check with Farhan.</div>`)}`;
  const overlay = `<div class="ovl"></div>${drawer({
    w: 640,
    head: reqHead('RR-0145', 'DevOps engineer', 'ATLAS', 'PM', `<div style="margin-top:10px">${pathline(1, '', ['Karan', 'Ravi · you', 'Suresh', 'Vikram'])}</div>`),
    body,
    foot: `${btn('Reject', 'dng', 'x2')}${btn('Hold', 'wrn', 'pause')}<span style="flex:1"></span>${btn('Fill directly', 'dis', 'lock')}${btn('Approve → Suresh (DD)', 'pri', 'arrow')}`,
  })}`;
  const left = `${inboxPage({})}${note([['new', 'Preferred-person card turns dashed with a lock and says why.'], ['new', '“Fill directly” is off (tooltip: “Only people on your projects”). Approve is the main button.'], ['new', 'A note box so the PM can pass context up the chain.'], ['q', 'Should Dev’s current PM (Farhan) be asked / told before the PMO moves him? (q 5)']])}`;
  return dcPage('Preferred person not under you', css, page('Resource requests', 4, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', left, overlay), 1120);
}

// ═════════════════════════ Board 5 · Hold + unhold (states) ═════════════════════════
function holdBoard() {
  const p1 = modal({
    w: 470, ic: 'pause', tone: 'warn', title: 'Put RR-0141 on hold', desc: 'Business analyst · Atlas Payments · from Priya',
    body: `${fld('Why on hold?', `<div class="ta foc">Client has not signed the change request yet. I will check again on 14 Oct.</div>`, 'Required. Priya sees this word for word.', true)}
<div class="row" style="gap:6px;flex-wrap:wrap">${['Waiting for client sign-off', 'Budget not approved yet', 'Someone frees up soon'].map((t, i) => `<span class="chip" style="height:28px;font-size:11.5px${i === 0 ? `;border-color:${C.warn};background:${C.warnSoft};color:#92400E` : ''}">${t}</span>`).join('')}</div>
${fld('Remind me on (optional)', inp('14 Oct 2026', '', 'cal'), 'We nudge you that day. Nothing happens on its own.')}
<div class="banner warn" style="padding:9px 11px">${icon('bell', 14)}<span>Priya gets: “Ravi put your request on hold: Client has not signed…”</span></div>`,
    foot: `${btn('Cancel')}${btn('Put on hold', 'pri', 'pause')}`,
  });
  const p2 = drawer({
    head: reqHead('RR-0141', 'Business analyst', 'ATLAS', 'HOLD', `<div style="margin-top:10px">${pathline(1, 'hold')}</div>`),
    body: `<div class="banner warn">${icon('pause', 16)}<div><b>On hold since 29 Sep · by you</b><div style="margin-top:3px">“Client has not signed the change request yet. I will check again on 14 Oct.”</div><div class="xs" style="margin-top:5px;opacity:.8">8 days on hold · reminder 14 Oct</div></div></div>
<div class="card sec" style="gap:8px;padding:12px 14px">${kv([['Allocation', '50% · from 1 Nov 2026'], ['Skills', `<span class="row" style="gap:4px">${skill('Payments')}${skill('JIRA')}${skill('UAT')}</span>`]])}</div>
<div class="xs mut">While on hold, Fill / Approve / Reject are locked. Unhold first — then decide.</div>`,
    foot: `<span style="flex:1"></span>${btn('Fill', 'dis sm')}${btn('Approve', 'dis sm')}${btn('Reject', 'dis sm')}${btn('Unhold', 'pri sm', 'play')}`,
  });
  const p3 = drawer({
    head: reqHead('RR-0141', 'Business analyst', 'ATLAS', 'PM', `<div style="margin-top:10px">${pathline(1, '')}</div>`),
    body: `<div class="banner ok">${icon('play', 16)}<div><b>Back in your hands</b><div style="margin-top:3px">You took it off hold today 11:05. Priya was told.</div></div></div>
${fld('Unhold note (optional)', `<div class="ta" style="min-height:44px">Client signed on 6 Oct.</div>`)}
<div class="row" style="gap:10px;padding:10px 12px;border:1px dashed ${C.border};border-radius:12px;background:${C.raised}">${av('Lakshmi', 30)}<div style="flex:1"><b class="xs">Lakshmi Iyer · 88% match</b><div class="xs mut">50% free · on People Portal (not yours) — PMO only</div></div>${icon('lock', 14)}</div>
<div class="xs mut">Nobody on your projects fits → approve to Suresh with a note.</div>`,
    foot: `${btn('Reject', 'dng sm')}${btn('Hold again', 'wrn sm')}<span style="flex:1"></span>${btn('Approve → Suresh', 'pri sm', 'arrow')}`,
  });
  const html = `<div class="app" style="display:block;padding:28px 34px"><div class="eyebrow">Projects · Requests</div><h1>Hold and unhold</h1><div class="sub">Every step (PM, Delivery Director, PMO) can hold. A reason is required. The Lead is told. Only the person who holds it — or someone above at a later step — acts next.</div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px;align-items:start">
<div style="display:flex;flex-direction:column;gap:10px"><div class="cap"><i>1</i>Ravi puts it on hold</div><div class="panel" style="padding:16px">${p1}</div></div>
<div style="display:flex;flex-direction:column;gap:10px"><div class="cap" style="color:#B45309"><i style="background:${C.warn}">2</i>On hold — buttons locked</div><div class="panel" style="padding:14px">${p2}</div></div>
<div style="display:flex;flex-direction:column;gap:10px"><div class="cap" style="color:${C.ok}"><i style="background:${C.ok}">3</i>Unhold → decide</div><div class="panel" style="padding:14px">${p3}</div></div>
</div>
<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin-top:18px">
<div class="card sec"><h3>${icon('history', 15)}What the history saves</h3>${tl([
    ['unhold', 'Taken off hold', by('Ravi', 'PM'), '7 Oct · 11:05', '“Client signed on 6 Oct.”'],
    ['hold', 'Put on hold', by('Ravi', 'PM'), '29 Sep · 16:20', '“Client has not signed the change request yet. I will check again on 14 Oct.”'],
    ['raise', 'Raised', by('Priya', 'Team Lead'), '29 Sep · 11:02', ''],
  ], { dense: true })}</div>
<div class="card sec" style="gap:8px"><h3>${icon('bell', 15)}Who is told</h3>
<table class="tbl"><tr><th>Event</th><th>Lead</th><th>Holder</th><th>Note</th></tr>
<tr><td><b>Hold</b></td><td class="y">✓</td><td class="n">—</td><td class="s">reason in the message</td></tr>
<tr><td><b>Reminder day</b></td><td class="n">—</td><td class="y">✓</td><td class="s">only if a date was set</td></tr>
<tr><td><b>Unhold</b></td><td class="y">✓</td><td class="n">—</td><td class="s">with the note</td></tr>
<tr><td><b>7+ days on hold</b></td><td class="n">—</td><td class="y">✓</td><td class="s">one weekly nudge (ask q 6)</td></tr></table></div>
</div></div>`;
  return dcPage('Hold and unhold', css, html, 1080);
}

// ═════════════════════════ Board 6 · Reject + Lead view + Raise again ═════════════════════════
function rejectBoard() {
  const p1 = modal({
    w: 470, ic: 'x2', tone: 'bad', title: 'Reject RR-0136?', desc: 'UI designer · 50% · Atlas Payments · from Priya',
    body: `${fld('Reason', `<div class="ta foc">Design work moves to the client’s own team from November. Please plan with their designer.</div>`, 'Required. The request closes and goes back to Priya.', true)}
<div class="banner bad" style="padding:9px 11px">${icon('info', 14)}<span>It closes for everyone in the chain. Priya can <b>raise it again</b> with the same details.</span></div>`,
    foot: `${btn('Cancel')}<span class="btn" style="background:${C.bad};border-color:${C.bad};color:#fff">${icon('x2', 14)}Reject request</span>`,
  });
  const leadCard = `<div class="card" style="overflow:hidden"><span style="display:block;height:4px;background:${C.bad}"></span><div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
<div class="row xs" style="gap:6px"><span class="mono">RR-0136</span>${pj('ATLAS', true)}${sp('REJ')}<span class="mut" style="margin-left:auto">5 Oct</span></div>
<b style="font-size:15px">UI designer · 50% from 1 Oct</b>
${pathline(2, 'rej', ['You', 'Ravi ✓', 'Suresh ✕'])}
<div class="banner bad">${av('Suresh', 26)}<div><b>Suresh Pillai (Delivery Director)</b><div style="margin-top:2px">“Design work moves to the client’s own team from November. Please plan with their designer.”</div></div></div>
<div class="row" style="gap:8px">${btn('View timeline', 'sm', 'history')}<span style="flex:1"></span>${btn('Raise again', 'pri sm', 'undo')}</div></div></div>`;
  const again = modal({
    w: 470, ic: 'undo', title: 'Raise again — UI designer', desc: 'Copied from RR-0136. Change what you need.',
    body: `<div style="display:grid;grid-template-columns:1fr 110px;gap:10px">${fld('Role needed', inp('UI designer (handover only)', 'foc'))}${fld('Allocation', inp('<b>25</b> %'))}</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${fld('From', inp('1 Nov 2026', '', 'cal'))}${fld('Until', inp('30 Nov 2026', '', 'cal'))}</div>
${fld('Why', `<div class="ta" style="min-height:48px">Only one month at 25% to hand the design system over to the client team.</div>`)}
<div class="banner info" style="padding:8px 11px">${icon('route', 14)}<span>Linked to RR-0136 — approvers see the old reason.</span></div>`,
    foot: `${btn('Cancel')}${btn('Send request', 'pri', 'send')}`,
  });
  const html = `<div class="app" style="display:block;padding:28px 34px"><div class="eyebrow">Projects · Requests</div><h1>Reject — and raise again</h1><div class="sub">Reject needs a reason and closes the request. The Lead sees who rejected it and why, and can raise it again pre-filled.</div>
<div style="display:grid;grid-template-columns:460px minmax(0,1fr) 460px;gap:18px;margin-top:20px;align-items:start">
<div style="display:flex;flex-direction:column;gap:10px"><div class="cap" style="color:${C.bad}"><i style="background:${C.bad}">1</i>Suresh rejects</div><div class="panel" style="padding:16px">${p1}</div></div>
<div style="display:flex;flex-direction:column;gap:10px"><div class="cap"><i>2</i>Priya’s view (My requests)</div><div class="panel" style="padding:16px;display:flex;flex-direction:column;gap:12px">${leadCard}
<div class="toast" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid ${C.border};box-shadow:0 12px 30px -16px rgba(17,24,39,.35);font-size:12px"><span style="font-size:18px">🔔</span><div style="flex:1"><b>Suresh rejected RR-0136</b><div class="mut">“Design work moves to the client’s own team…”</div></div></div></div></div>
<div style="display:flex;flex-direction:column;gap:10px"><div class="cap"><i>3</i>Raise again (pre-filled)</div><div class="panel" style="padding:16px">${again}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:18px">
${note([['new', 'Reject = danger popup with a required reason (min 10 letters).'], ['new', 'Lead gets a bell + email with the reason.']])}
${note([['new', 'Rejected card stays in “My requests → Closed”, red stripe, reason quoted, path shows where it stopped.']])}
${note([['new', '“Raise again” copies role, skills, %, dates, reason and preferred person; links the new request to the old one.'], ['q', 'Can a Lead withdraw a request before it is filled? (q 8)']])}
</div></div>`;
  return dcPage('Reject and raise again', css, html, 800);
}

// ═════════════════════════ Board 7 · Delivery Director view ═════════════════════════
function ddView() {
  const body = `<div class="banner info" style="padding:9px 12px">${icon('info', 15)}<span>You are <b>Delivery Director</b> on 4 projects (Atlas, Nimbus CRM, Helix Mobile, Orion Insurance). You can fill this with anyone on them.</span></div>
<div class="card sec" style="gap:10px;padding:12px 14px">${kv([['Raised by', `<span class="row" style="gap:6px">${av('Priya', 18)}Priya Sharma · 5 Oct</span>`], ['Allocation', '100% · from 1 Nov 2026'], ['Skills', `<span class="row" style="gap:4px">${['Playwright', 'Selenium', 'API testing'].map((s) => skill(s)).join('')}</span>`], ['Why', '“Release every 2 weeks from November — we need test automation.”']])}</div>
<div class="quote" style="margin:0;display:flex;gap:10px;background:${C.priSoft};border-color:${C.pri}33">${av('Ravi', 26)}<div><b class="xs">Ravi Kumar (PM) approved · 6 Oct</b><div class="xs" style="margin-top:2px">“Agree. Nobody free on my projects. Swati is only 50% free.”</div></div></div>
<div class="row" style="justify-content:space-between"><span class="lbl">People on your projects</span><span class="xs mut">no preferred person</span></div>
${cand({ n: 'Swati', match: 80, skills: `${skill('Playwright', true)}${skill('Selenium', true)}${skill('API testing', false)}`, segs: [['NIMBUS', 50]], req: 100, under: true, note: 'Only 50% free — needs 100%' })}
${cand({ n: 'Harish', match: 40, skills: `${skill('API testing', true)}${skill('Playwright', false)}`, segs: [['ATLAS', 100]], req: 100, under: true, note: '0% free' })}
<div class="lbl">Outside your projects</div>
${cand({ n: 'Rohit', match: 100, skills: `${skill('Playwright', true)}${skill('Selenium', true)}${skill('API testing', true)}`, segs: [], req: 100, under: false, pool: true, note: 'In the PMO pool since 22 Sep · 100% free' })}
<div class="banner pri">${icon('sparkle', 15)}<span>Tip: <b>Rohit Shetty</b> in the PMO pool fits 100%. Approve and add a note — the PMO can assign him in one click.</span></div>`;
  const overlay = `<div class="ovl"></div>${drawer({
    w: 640,
    head: reqHead('RR-0147', 'QA engineer (automation)', 'ATLAS', 'DD', `<div style="margin-top:10px">${pathline(2, '', ['Priya', 'Ravi ✓', 'Suresh · you', 'Vikram'])}</div>`),
    body,
    foot: `${btn('Reject', 'dng', 'x2')}${btn('Hold', 'wrn', 'pause')}<span style="flex:1"></span>${btn('Fill directly', 'dis')}${btn('Approve → PMO', 'pri', 'arrow')}`,
  })}`;
  const left = `${top('Work', 'Resource requests', 'Suresh Pillai · Delivery Director — Atlas, Nimbus CRM, Helix Mobile, Orion Insurance', '')}
<div class="seg2">${[['Waiting for me', 2], ['On hold', 0], ['Done', 21]].map(([l, n], i) => `<span class="${i === 0 ? 'on' : ''}">${l} · ${n}</span>`).join('')}</div>
<div class="card" style="overflow:hidden">${[['RR-0147', 'ATLAS', 'QA engineer (automation)', '100% · from 1 Nov', 'Ravi approved 6 Oct'], ['RL-0029', 'HELIX', 'Release · Nikhil Bhat', 'last day 15 Oct', 'Farhan sent it up']].map(([id, k, r, w, s], i) => `<div class="row" style="gap:12px;padding:13px 16px;border-bottom:1px solid ${C.line};${i === 0 ? `background:${C.priSoft}` : ''}"><div style="flex:1"><div class="row xs" style="gap:6px"><span class="mono">${id}</span>${pj(k, true)}</div><b>${r}</b> <span class="xs mut">· ${w}</span></div><span class="xs mut">${s}</span>${sp('DD')}</div>`).join('')}</div>
${note([['new', 'Same drawer as the PM. Candidates = people on every project where Suresh is Delivery Director.'], ['new', 'Shows the PM’s note on top so Suresh knows what was already checked.'], ['new', 'Pool people are shown (locked) with a tip, so the PMO step is faster.'], ['q', 'May an approver fill at a lower % than asked (e.g. Swati at 50%)? (q 4)']])}`;
  return dcPage('Delivery Director view', css, page('Resource requests', 2, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', left, overlay), 1120);
}

// ═════════════════════════ Board 8 · PMO view ═════════════════════════
function pmoView() {
  const body = `<div class="banner pri" style="padding:9px 12px">${icon('shield', 15)}<span>You are <b>PMO</b>. You can assign <b>anyone</b> who has the free time. The 100% rule still applies.</span></div>
<div class="card sec" style="gap:10px;padding:12px 14px">${kv([['Raised by', `<span class="row" style="gap:6px">${av('Karan', 18)}Karan Mehta · 3 Oct</span>`], ['Allocation', '30% · 15 Oct → 31 Dec 2026'], ['Skills', `<span class="row" style="gap:4px">${['Kubernetes', 'AWS', 'CI/CD'].map((s) => skill(s)).join('')}</span>`], ['Path so far', 'Ravi approved 4 Oct · Suresh approved 6 Oct']])}</div>
<div class="lbl">Preferred person</div>
<div class="pref ok"><span class="rad on"></span>${av('Dev', 38)}<div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b>Dev Menon</b><span class="mt" style="background:${C.okSoft};color:${C.ok}">100% match</span></div><div class="row" style="gap:4px;margin-top:4px">${skill('Kubernetes', true)}${skill('AWS', true)}${skill('CI/CD', true)}</div><div class="xs mut" style="margin-top:5px">Helix Mobile 70% → after this 100% booked. Farhan (his PM) will be told.</div></div><div style="width:170px">${load([['HELIX', 70]], 30)}<span class="tagu ok" style="margin-top:5px">${icon('check2', 10)}Fits — 30% free</span></div></div>
<div class="row" style="justify-content:space-between"><span class="lbl">Or anyone available</span><div class="seg2" style="transform:scale(.9);transform-origin:right"><span class="on">PMO pool first</span><span>Everyone</span></div></div>
${cand({ n: 'Nikhil', match: 90, skills: `${skill('Kubernetes', true)}${skill('AWS', true)}${skill('CI/CD', false)}`, segs: [], req: 30, pool: true, note: 'PMO pool · free since 15 Oct (released from Helix)' })}
${cand({ n: 'Tanvi', match: 20, skills: `${skill('AWS', true)}`, segs: [], req: 30, pool: true, note: 'Intern · joined 1 Oct · reports to PMO' })}
<div class="card sec" style="gap:8px;padding:12px 14px;background:${C.raised}"><b class="xs">Assign as</b><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">${fld('Role', inp('Member'))}${fld('Team lead', inp('Karan Mehta'))}${fld('Billed', inp('Yes — client pays'))}</div></div>`;
  const overlay = `<div class="ovl"></div>${drawer({
    w: 640,
    head: reqHead('RR-0145', 'DevOps engineer', 'ATLAS', 'PMO', `<div style="margin-top:10px">${pathline(3, '', ['Karan', 'Ravi ✓', 'Suresh ✓', 'Vikram · you'])}</div>`),
    body,
    foot: `${btn('Reject', 'dng', 'x2')}${btn('Hold', 'wrn', 'pause')}<span style="flex:1"></span>${btn('Assign Dev Menon · 30%', 'pri', 'check2')}`,
  })}`;
  const left = `${top('Work', 'Resource requests', 'Vikram Rao · PMO — every request that reached the PMO', btn('PMO pool', '', 'pool'))}
<div class="seg2">${[['Waiting for me', 3], ['On hold', 0], ['All open', 9], ['Done', 40]].map(([l, n], i) => `<span class="${i === 0 ? 'on' : ''}">${l} · ${n}</span>`).join('')}</div>
<div class="card" style="overflow:hidden">${[['RR-0145', 'ATLAS', 'DevOps engineer', '30% · 15 Oct', 'Dev Menon'], ['RR-0143', 'HELIX', 'Android developer', '100% · 1 Nov', '—'], ['RR-0140', 'PORTAL', 'Intern (React)', '50% · now', 'Tanvi Joshi']].map(([id, k, r, w, p], i) => `<div class="row" style="gap:12px;padding:13px 16px;border-bottom:1px solid ${C.line};${i === 0 ? `background:${C.priSoft}` : ''}"><div style="flex:1"><div class="row xs" style="gap:6px"><span class="mono">${id}</span>${pj(k, true)}</div><b>${r}</b> <span class="xs mut">· ${w}</span></div><span class="xs mut">wants ${p}</span>${sp('PMO')}</div>`).join('')}</div>
${note([['old', 'PMO already assigns from the member dialog and the planner — kept.'], ['new', 'Requests reach the PMO with the whole path and notes.'], ['new', '“PMO pool first” lists people under PMO / on the bench, then everyone with free time.'], ['new', 'Assign also sets role, team lead (the requesting Lead) and billed.']])}`;
  return dcPage('PMO view — assign', css, page('Resource requests', 3, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', left, overlay, 'WORK', true), 1120);
}

// ═════════════════════════ Board 9 · Release popup (Lead) ═════════════════════════
function releaseForm() {
  const body = `<div class="pref">${av('Sara', 40)}<div style="flex:1"><b>Sara Khan</b><div class="xs mut">Mobile Developer · your team · 60% on Atlas since 2 Jun 2026</div><div class="row" style="gap:4px;margin-top:5px">${skill('React Native')}${skill('Kotlin')}${skill('Swift')}</div></div><div style="width:170px">${load([['ATLAS', 60], ['NIMBUS', 40]], 0)}</div></div>
${fld('Why is Sara no longer needed?', `<div class="row" style="gap:6px;flex-wrap:wrap">${['Work is finished', 'Skills no longer needed', 'Project scope cut', 'Other'].map((t, i) => `<span class="chip" style="height:30px;font-size:12px${i === 0 ? `;border-color:${C.pri};background:${C.priSoft};color:${C.priText}` : ''}">${t}</span>`).join('')}</div><div class="ta" style="margin-top:6px">The mobile part of checkout is done and live. Sara did great work — she is ready for a new project.</div>`, 'Required. Ravi and Suresh read this. Sara reads it only after a decision.', true)}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${fld('Last day on Atlas Payments', inp('31 Oct 2026', 'foc', 'cal'), 'Today or later. Allocation ends after this day.', true)}${fld('Hand-over', inp('Kotlin module → Amit'), 'Optional')}</div>
<div class="banner pri">${icon('route', 16)}<span>Goes to <b>Ravi Kumar</b> (PM). He or Suresh decides: PMO pool, move to another project, hold, or keep Sara here.</span></div>`;
  const overlay = `<div class="ovl"></div>${modal({ w: 640, ic: 'userminus', tone: 'warn', title: 'Release Sara Khan from Atlas Payments', desc: 'Ask your PM to free Sara’s time on this project.', body, foot: `${btn('Cancel')}${btn('Send to Ravi', 'pri', 'send')}`, style: 'top:50%' })}`;
  const side = `<div style="position:absolute;right:28px;top:96px;width:280px;display:flex;flex-direction:column;gap:10px;z-index:5">${note([['old', 'Only the PMO could end an assignment (edit end date / remove).'], ['new', 'Lead raises a release from the Team row menu or the “Release someone” button.'], ['new', 'Reason chips + text, last day, optional hand-over.'], ['new', 'Sara stays on the project until the decision and the last day.'], ['q', 'Tell Sara when the Lead asks, or only after the PM decides? (q 9)']])}</div>`;
  return dcPage('Release — Lead popup', css, page('Projects', 0, 'Projects &nbsp;›&nbsp; <b>Atlas Payments</b>', `${projectHeader('')}${tabsBar([['activity', 'Overview'], ['users', 'Team', 9], ['flag', 'Milestones', 5], ['msg', 'Updates', 7], ['inbox', 'Requests', 4, true]], 'Team')}<div class="card" style="height:400px"></div>`, overlay + side), 1000);
}

// ═════════════════════════ Board 10 · Release decision (PM / DD) ═════════════════════════
function releaseDecide() {
  const opt = (on, ic, col, t, d, extra = '') => `<div class="opt${on ? ' on' : ''}"><span class="rad${on ? ' on' : ''}" style="margin-top:7px"></span><span class="oi" style="background:${col}18;color:${col}">${icon(ic, 16)}</span><div style="flex:1"><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div>${extra}</div></div>`;
  const body = `<div class="card sec" style="gap:10px;padding:12px 14px"><div class="row" style="gap:10px">${av('Sara', 36)}<div style="flex:1"><b>Sara Khan</b><div class="xs mut">Mobile Developer · Atlas 60% + Nimbus CRM 40%</div></div><div style="width:150px">${load([['ATLAS', 60], ['NIMBUS', 40]], 0)}</div></div>
${kv([['Asked by', `<span class="row" style="gap:6px">${av('Karan', 18)}Karan Mehta · Team Lead · today 9:40</span>`], ['Reason', 'Work is finished — “The mobile part of checkout is done and live.”'], ['Last day', '31 Oct 2026 · hand-over to Amit']])}</div>
<div class="lbl">What happens to Sara?</div>
${opt(false, 'pool', '#EA580C', 'Send to PMO pool', 'Atlas ends 31 Oct. From 1 Nov Sara shows to the PMO as 60% free.')}
${opt(true, 'route', C.teal, 'Reassign to another of my projects', 'Move her time straight to a project where you are PM.', `<div style="display:grid;grid-template-columns:1.3fr 90px 1fr 1fr;gap:8px;margin-top:9px">${fld('Project', `<div class="in">${pj('NIMBUS')}${icon('chevd', 13)}</div>`)}${fld('%', inp('<b>60</b>'))}${fld('Starts', inp('1 Nov 2026', '', 'cal'))}${fld('Team lead', inp('Karan Mehta'))}</div><div style="margin-top:8px">${load([['NIMBUS', 40]], 60)}</div><div class="xs" style="color:${C.ok};margin-top:3px;font-weight:700">${icon('check2', 11)} Fits: 40% + 60% = 100% from 1 Nov</div>`)}
${opt(false, 'pause', C.warn, 'Hold', 'Decide later. A reason is required; Karan is told.')}
${opt(false, 'undo', C.muted, 'Keep on Atlas (decline)', 'Sara stays. A reason is required; Karan is told.')}`;
  const overlay = `<div class="ovl"></div>${drawer({
    w: 640,
    head: `<div class="row" style="gap:12px;align-items:flex-start"><span class="mic" style="background:${C.warnSoft};color:${C.warn};border:1px solid ${C.warn}33">${icon('userminus', 18)}</span><div style="flex:1"><div class="row xs" style="gap:6px"><span class="mono">RL-0032</span>${pj('ATLAS', true)}${sp('PM')}</div><b style="font-size:17px;display:block;margin-top:4px">Release · Sara Khan</b></div><span class="mut">${icon('x2', 16)}</span></div>`,
    body,
    foot: `<span class="xs mut" style="margin-right:auto">Sara, Karan and the Nimbus lead are told after you confirm.</span>${btn('Cancel')}${btn('Reassign to Nimbus CRM', 'pri', 'route')}`,
  })}`;
  const left = `${inboxPage({})}${note([['new', 'Four clear choices as cards. Only the chosen one opens its fields.'], ['new', 'Reassign: only projects where Ravi is PM (or Suresh is DD). The 100% check runs live.'], ['new', 'PMO pool: Sara appears in the PMO pool on 1 Nov with “Released from Atlas”.'], ['new', 'Suresh (DD) sees the same drawer for releases on his projects.'], ['q', 'Release: PM only, or should it also climb to DD / PMO like requests? (q 10)']])}`;
  return dcPage('Release decision — PM / DD', css, page('Resource requests', 4, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', left, overlay), 1120);
}

// ═════════════════════════ Board 11 · Inbox ═════════════════════════
function inbox() {
  const body = `${inboxPage({})}
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
<div class="card sec" style="gap:10px"><h3>${icon('pause', 15)}On hold · 1</h3><div class="ib"><i style="background:${C.warn}"></i><div><div class="row xs" style="gap:6px"><span class="mono">RR-0141</span>${pj('ATLAS', true)}</div><b class="xs">Business analyst · 50%</b><div class="xs mut">“Client has not signed…” · 8 days · reminder 14 Oct</div><div>${btn('Unhold', 'sm', 'play')}</div></div></div></div>
<div class="card sec" style="gap:10px"><h3>${icon('check2', 15)}Done this week</h3>${[['FILLED', 'RR-0146 · Kavya → Nimbus CRM', 'by Suresh (DD)'], ['FILLED', 'RR-0139 · Harish → Atlas', 'by Vikram (PMO)'], ['REJ', 'RR-0136 · UI designer', 'by Suresh']].map(([s, t, b]) => `<div class="row xs" style="gap:8px">${sp(s)}<span style="flex:1"><b>${t}</b> <span class="mut">${b}</span></span></div>`).join('')}</div>
<div class="card sec" style="gap:10px"><h3>${icon('bell', 15)}Live + menu</h3>
<div style="padding:8px;border-radius:12px;background:${C.raised};display:flex;flex-direction:column;gap:2px"><div class="sb-g" style="padding:2px 10px">WORK</div><span class="sb-i" style="margin:0">${icon('folder')}<span style="flex:1">Projects</span></span><span class="sb-i on" style="margin:0">${icon('inbox')}<span style="flex:1">Resource requests</span><span class="nb">4</span></span><span class="sb-i" style="margin:0">${icon('pool')}<span style="flex:1">PMO pool</span><span class="xs mut">PMO only</span></span></div>
<div class="xs mut">Badge = requests + releases waiting for <b>me</b>. Shown to Leads, PMs, Delivery Directors and PMO only. New ones slide in live; the count fades to the new number.</div></div>
</div>`;
  return dcPage('Resource requests inbox', css, page('Resource requests', 4, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', body), 960);
}

// ═════════════════════════ Board 12 · My requests (Lead) ═════════════════════════
function mine() {
  const card = ({ id, k, role, when, st, pth, msg, msgWho, acts = '', stripe }) => `<div class="card" style="overflow:hidden"><span style="display:block;height:4px;background:${stripe}"></span><div style="padding:13px 16px;display:flex;flex-direction:column;gap:9px">
<div class="row xs" style="gap:6px"><span class="mono">${id}</span>${pj(k, true)}${sp(st)}</div>
<b style="font-size:14.5px">${role} <span class="xs mut" style="font-weight:600">· ${when}</span></b>${pth}
${msg ? `<div class="quote" style="margin:0;display:flex;gap:8px">${av(msgWho, 22)}<span class="xs">${msg}</span></div>` : ''}
${acts ? `<div class="row" style="gap:6px;justify-content:flex-end">${acts}</div>` : ''}</div></div>`;
  const body = `${top('Work', 'Resource requests', 'Priya Sharma · Team Lead on Atlas Payments — what you asked for and where it is', btn('Request a person', 'pri', 'userplus'))}
<div class="seg2"><span class="on">Raised by me · 5 open</span><span>Closed · 9</span><span>Released people · 2</span></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:start">
${card({ id: 'RR-0148', k: 'ATLAS', role: 'Senior React developer', when: '50% · 20 Oct', st: 'PM', pth: pathline(1, '', ['You', 'Ravi']), msg: 'Waiting for <b>Ravi Kumar</b> since today 10:12. He has seen it.', msgWho: 'Ravi', stripe: C.info, acts: btn('Withdraw', 'sm') })}
${card({ id: 'RR-0147', k: 'ATLAS', role: 'QA engineer (automation)', when: '100% · 1 Nov', st: 'DD', pth: pathline(2, '', ['You', 'Ravi ✓', 'Suresh']), msg: 'Ravi approved: “Agree. Nobody free on my projects.”', msgWho: 'Ravi', stripe: C.violet })}
${card({ id: 'RR-0145', k: 'ATLAS', role: 'DevOps engineer', when: '30% · 15 Oct', st: 'PMO', pth: pathline(3, '', ['Karan', 'Ravi ✓', 'Suresh ✓', 'Vikram']), msg: 'With the PMO. Preferred person <b>Dev Menon</b> has 30% free.', msgWho: 'Vikram', stripe: '#EA580C' })}
${card({ id: 'RR-0141', k: 'ATLAS', role: 'Business analyst', when: '50% · 1 Nov', st: 'HOLD', pth: pathline(1, 'hold', ['You', 'Ravi']), msg: '<b>On hold</b> — “Client has not signed the change request yet. I will check again on 14 Oct.”', msgWho: 'Ravi', stripe: C.warn })}
${card({ id: 'RR-0139', k: 'ATLAS', role: 'Java backend developer', when: '100% · 1 Oct', st: 'FILLED', pth: pathline(3, 'filled', ['You', 'Ravi ✓', 'Suresh ✓', 'Vikram ✓']), msg: '<b>Harish Gowda</b> joined your team on 1 Oct · assigned by Vikram (PMO).', msgWho: 'Harish', stripe: C.ok, acts: btn('Say welcome', 'sm', 'heart') })}
${card({ id: 'RR-0136', k: 'ATLAS', role: 'UI designer', when: '50% · 1 Oct', st: 'REJ', pth: pathline(2, 'rej', ['You', 'Ravi ✓', 'Suresh ✕']), msg: '<b>Rejected</b> — “Design work moves to the client’s own team from November.”', msgWho: 'Suresh', stripe: C.bad, acts: btn('Raise again', 'pri sm', 'undo') })}
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
<div class="card sec" style="gap:10px"><h3>${icon('undo', 15)}Released people — request back</h3>${[['Rohit', 'Released from Atlas 30 Jun → Orion → PMO pool since 22 Sep', '100% free'], ['Sara', 'Release asked by Karan · last day 31 Oct', 'decision pending']].map(([n, t, f], i) => `<div class="row" style="gap:10px">${av(n, 30)}<div style="flex:1"><b class="xs">${full(n)}</b><div class="xs mut">${t}</div></div><span class="xs" style="font-weight:800;color:${i ? C.muted : C.ok}">${f}</span>${i ? '' : btn('Request back', 'sm', 'undo')}</div>`).join('')}</div>
${note([['new', 'Lead’s own view: plain words for each status — Waiting for PM, With Delivery Director, With PMO, On hold (reason), Filled (who), Rejected (reason).'], ['new', 'Withdraw while nobody has filled it (ask q 8). Raise again on rejected ones.'], ['new', 'Released people list with “Request back” (pre-filled).']])}
</div>`;
  return dcPage('My requests — Lead view', css, page('Resource requests', 0, 'Work &nbsp;›&nbsp; <b>Resource requests</b>', body), 920);
}

// ═════════════════════════ Board 13 · Request timeline ═════════════════════════
function timeline() {
  const body = `<div><span class="btn sm" style="border:none;background:none;padding:0;color:${C.muted}">${icon('arrow', 13)} Requests</span></div>
<div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:14px"><div class="row" style="gap:14px;align-items:flex-start"><span class="mic" style="width:48px;height:48px;background:${C.okSoft};color:${C.ok}">${icon('check2', 22)}</span><div style="flex:1"><div class="row xs" style="gap:6px"><span class="mono">RR-0146</span>${pj('NIMBUS', true)}${sp('FILLED')}</div><h1 style="font-size:22px;margin-top:4px">Senior front-end engineer · 50%</h1><div class="sub" style="font-size:13px">Raised by Karan Mehta · 26 Sep → filled 3 Oct by Suresh Pillai with <b>Kavya Nair</b> · took 7 days (3 on hold)</div></div>${btn('Copy as new', '', 'undo')}</div>
${pathline(2, 'filled', ['Karan', 'Ravi ✓', 'Suresh ✓ filled', 'Vikram'])}</div>
<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start">
<div class="card sec"><h3>${icon('history', 15)}Step history <span class="r">newest first · IST</span></h3>
${tl([
    ['fill', 'Filled — Kavya Nair assigned 50% from 6 Oct', by('Suresh', 'Delivery Director'), '3 Oct · 15:42', 'Member · team lead Karan · billed. Kavya and Karan were told.', sp('FILLED')],
    ['unhold', 'Taken off hold', by('Suresh', 'Delivery Director'), '3 Oct · 15:30', '“Helix sprint ended early — Kavya is free from 6 Oct.”'],
    ['hold', 'Put on hold', by('Suresh', 'Delivery Director'), '30 Sep · 10:05', '“Kavya is the best fit but busy on Helix until 5 Oct. Holding 1 week.”', sp('HOLD')],
    ['fwd', 'Approved → Delivery Director', by('Ravi', 'Project manager'), '29 Sep · 18:20', '“Nobody free on my projects. Kavya on Helix would be ideal.”'],
    ['seen', 'Opened by Ravi', by('Ravi'), '27 Sep · 09:14', ''],
    ['raise', 'Raised', by('Karan', 'Team Lead'), '26 Sep · 17:48', '“Nimbus web app redesign starts 6 Oct. Need a strong React person for 3 months.” · preferred: Kavya Nair'],
  ], { firstNow: false })}</div>
<div style="display:flex;flex-direction:column;gap:14px">
<div class="card sec" style="gap:10px"><h3>${icon('info', 15)}Request</h3>${kv([['Project', pj('NIMBUS')], ['Role', 'Senior front-end engineer'], ['Skills', `<span class="row" style="gap:4px;flex-wrap:wrap">${skill('React')}${skill('TypeScript')}${skill('Figma')}</span>`], ['Allocation', '50% · 6 Oct → 31 Dec 2026'], ['Preferred', `<span class="row" style="gap:6px">${av('Kavya', 18)}Kavya Nair</span>`]])}</div>
<div class="card sec" style="gap:8px"><h3>${icon('clock', 15)}Time at each step</h3>${[['Waiting for PM', 3, C.info], ['With Delivery Director', 1, C.violet], ['On hold', 3, C.warn]].map(([l, d, c]) => `<div class="row xs" style="gap:8px"><span style="width:150px">${l}</span><div class="bar" style="flex:1"><i style="width:${d * 14}%;background:${c}"></i></div><b style="width:50px;text-align:right">${d} day${d > 1 ? 's' : ''}</b></div>`).join('')}</div>
${note([['new', 'A page per request (also opens from the drawer “Timeline”). Every event: who, role, when (IST), note.'], ['new', 'Hold and unhold always show their reasons. Rejected shows the reason in red.'], ['new', 'The same events go to each person’s Assignment history.']])}
</div></div>`;
  return dcPage('Request timeline', css, page('Resource requests', 4, 'Work &nbsp;›&nbsp; Resource requests &nbsp;›&nbsp; <b>RR-0146</b>', body), 980);
}

// ═════════════════════════ Board 14 · Employee profile — Assignment history ═════════════════════════
function history() {
  const body = `<div><span class="btn sm" style="border:none;background:none;padding:0;color:${C.muted}">${icon('arrow', 13)} Employees</span></div>
<div class="card" style="padding:18px 20px;display:flex;gap:16px;align-items:center">${photo(PPL.Rohit[0], 72, 72, { round: true })}<div style="flex:1"><div class="row" style="gap:8px"><h1 style="font-size:22px;margin:0">Rohit Shetty</h1><span class="pill p-ok">Active</span><span class="pill" style="background:#FFEDD5;color:#C2410C">${icon('pool', 11)}PMO pool</span></div><div class="sub" style="font-size:13px">QA Engineer · Engineering · Bengaluru HQ · AAK014 · reports to <b style="color:${C.fg}">PMO</b></div></div>${btn('Request Rohit back to Atlas', 'pri', 'undo')}</div>
${tabsBar([['layers', 'Overview'], ['user', 'Personal'], ['file', 'Documents'], ['plane', 'Leave'], ['folder', 'Projects'], ['box', 'Assets']], 'Projects')}
<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start">
<div class="card sec"><h3>${icon('history', 15)}Assignment history ${NEW}<span class="r">${chip('All')} ${chip('Only moves')}</span></h3>
${tl([
    ['pool', 'Sent to PMO pool', by('Suresh', 'Delivery Director'), '21 Sep 2026', 'Released from <b>Orion Insurance</b> — “Phase 2 ended.” Free 100% from 22 Sep.', sp('POOL')],
    ['rel', 'Release asked', by('Karan', 'Team Lead · Orion'), '12 Sep 2026', '“Phase 2 testing complete. Last day 21 Sep.”'],
    ['move', 'Reassigned Atlas Payments → Orion Insurance · 100%', by('Ravi', 'PM'), '30 Jun 2026', 'Release RL-0011 from Priya → reassigned directly. Team lead Karan.', sp('MOVED')],
    ['rel', 'Release asked from Atlas Payments', by('Priya', 'Team Lead · Atlas'), '20 Jun 2026', '“Automation suite is done; manual testing moves to the client.”'],
    ['fill', 'Assigned to Atlas Payments · Member · 100%', by('Vikram', 'PMO'), '6 Jan 2026', 'Request RR-0061 from Priya — Lead → Ravi ✓ → Suresh ✓ → PMO assigned.'],
    ['join', 'Joined · reports to PMO', by('Hema', 'HR'), '2 Jan 2026', 'Added to the PMO pool on day 1.'],
  ])}</div>
<div style="display:flex;flex-direction:column;gap:14px">
<div class="card sec" style="gap:10px"><h3>${icon('folder', 15)}Projects <span class="r">0% allocated today · 100% free</span></h3>${load([], 0, { noText: true })}<div class="xs mut">Not on any project right now. In the PMO pool for <b>15 days</b>.</div></div>
<div class="card sec" style="gap:8px"><h3>${icon('star', 15)}Skills ${NEW}</h3><div class="row" style="gap:5px;flex-wrap:wrap">${['Playwright', 'Selenium', 'API testing', 'Postman', 'JMeter'].map((s) => skill(s)).join('')}</div><div class="xs mut">Used for “best match” in request pickers.</div></div>
<div class="card sec" style="gap:8px;border-color:${C.pri}55"><h3>${icon('undo', 15)}Request back</h3><div class="xs">Priya sees this because Rohit worked on <b>her team on Atlas</b>. The button opens “Request a person” pre-filled: QA engineer, his skills, 100%, preferred = Rohit.</div><div class="xs mut">Rohit is in the PMO pool, so the request will reach the PMO to assign.</div></div>
${note([['old', 'Projects tab shows the allocation bar and current projects (kept).'], ['new', 'Assignment history: requested, assigned, reassigned, release asked, released, PMO pool — who / when / note / project.'], ['q', 'Who may see this history? (q 11)']])}
</div></div>`;
  return dcPage('Employee profile — Assignment history', css, page('Employees', 0, 'Employees &nbsp;›&nbsp; <b>Rohit Shetty</b>', body, '', 'ORGANIZATION'), 1040);
}

// ═════════════════════════ Board 15 · Add employee — Reports to: person / PMO ═════════════════════════
function empCreate() {
  const steps = ['Basics', 'Job', 'Manager', 'Review'];
  const body = `<div class="row" style="gap:8px">${steps.map((s, i) => `<div style="flex:1"><span style="display:block;height:4px;border-radius:99px;background:${i < 2 ? C.ok : i === 2 ? C.pri : C.line}"></span><span class="xs" style="font-weight:700;color:${i === 2 ? C.fg : C.muted}">${s}</span></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1fr 190px;gap:18px">
<div style="display:flex;flex-direction:column;gap:12px">
<div class="f"><label>Reports to ${NEW}</label><div class="row" style="gap:10px;align-items:stretch">
<div class="radio-card"><span class="rad" style="margin-top:2px"></span><div><b style="font-size:13px">A person</b><div class="xs mut">Pick their manager — approves leave and timesheets, sees them in “my team”.</div></div></div>
<div class="radio-card on"><span class="rad on" style="margin-top:2px"></span><div><b style="font-size:13px">The PMO</b><div class="xs mut">Joins the <b>PMO pool</b>. The PMO assigns them to projects.</div></div></div></div></div>
<div class="banner pri">${icon('pool', 16)}<div><b>Tanvi will be in the PMO pool from 1 Oct</b><div style="margin-top:3px">• On a project: leave and corrections go to her team lead / PM (as today).<br>• Not on a project: the PMO (Vikram Rao) approves.<br>• Shows under “PMO” in the organisation chart.</div></div></div>
<div class="f" style="opacity:.45"><label>Reporting manager</label>${inp('— Choose a person', 'ph')}<span class="h">Not needed when reporting to the PMO</span></div>
<div class="xs mut">Works for every job title and department — Software Engineer, SE Lead, Intern, HR Executive, DevOps Engineer, Finance…</div>
<p class="xs mut" style="margin:0;padding:10px;border-radius:10px;background:${C.raised}">They start with the <b style="color:${C.fg}">Employee</b> role (self-service). Give them more access later from Users &amp; roles.</p>
</div>
<div><div class="lbl" style="margin-bottom:6px">Preview</div><div class="card" style="overflow:hidden"><div style="height:96px;background:linear-gradient(135deg,#6366F1,#A855F7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:28px">TJ</div><div style="padding:10px;display:flex;flex-direction:column;gap:4px"><b class="xs">Tanvi Joshi</b><span class="xs mut">Intern · Software</span><div class="row" style="gap:4px;flex-wrap:wrap"><span class="pill p-neu" style="font-size:10px">Engineering</span><span class="pill" style="font-size:10px;background:#FFEDD5;color:#C2410C">PMO pool</span></div></div></div><div class="xs mut" style="margin-top:6px">ID <b class="mono" style="color:${C.fg}">AAK021</b> is next</div></div>
</div>`;
  const overlay = `<div class="ovl"></div>${modal({ w: 720, ic: 'userplus', title: 'Add employee', desc: 'Step 3 of 4 · about 2 minutes', body, foot: `${btn('Back')}${btn('Next: Review', 'pri', 'arrow')}`, style: 'top:50%' })}`;
  const side = `<div style="position:absolute;right:24px;top:90px;width:250px;display:flex;flex-direction:column;gap:10px;z-index:5">
<div class="card sec" style="gap:8px"><b class="xs">Also in the edit drawer</b><div class="xs mut">Employee → Edit → “Reports to: Person / PMO”. Moving someone to the PMO keeps their projects.</div></div>
<div class="card sec" style="gap:8px"><b class="xs">Review step</b>${kv([['Manager', '<span style="color:#C2410C">PMO pool</span>'], ['Joins', '1 Oct 2026']])}</div>
${note([['old', 'Step 3 “Manager”: pick a person or “Nobody (top of the organisation)”.'], ['new', 'Choice first: a person or the PMO.'], ['q', 'If PMO: who approves leave on the bench — any PMO person, or one named PMO lead? (q 12)']])}</div>`;
  return dcPage('Add employee — Reports to Person or PMO', css, page('Employees', 0, 'Employees', `${top('Organization', 'Employees', '42 people · 3 joining this month', btn('Add employee', 'pri', 'userplus'))}<div class="card" style="height:600px"></div>`, overlay + side, 'ORGANIZATION'), 1000);
}

// ═════════════════════════ Board 16 · PMO pool ═════════════════════════
function pool() {
  const P2 = [
    ['Rohit', 100, '22 Sep', 15, 'Orion Insurance', ['Playwright', 'Selenium', 'API testing'], 'Released · Phase 2 ended', [], 'RR-0147 QA automation · 100% match'],
    ['Harish', 0, '—', 0, 'Atlas Payments', ['Java', 'Spring', 'Kafka'], 'Assigned 1 Oct', [['ATLAS', 100]], null],
    ['Tanvi', 100, '1 Oct', 6, 'New joiner', ['React', 'JavaScript', 'AWS'], 'Intern · reports to PMO', [], 'RR-0140 Intern (React) · People Portal'],
    ['Nikhil', 100, '16 Oct', 0, 'Helix Mobile', ['Kubernetes', 'AWS', 'Terraform'], 'Coming: released from Helix on 15 Oct', [['HELIX', 100]], 'RR-0145 DevOps · 90% match'],
    ['Lakshmi', 50, '1 Aug', 67, 'People Portal 50%', ['Payments', 'JIRA', 'UAT'], 'Half free for 2 months', [['PORTAL', 50]], 'RR-0141 Business analyst (on hold)'],
    ['Sara', 60, '1 Nov', 0, 'Atlas Payments', ['React Native', 'Kotlin', 'Swift'], 'Coming: if Ravi sends her to the pool', [['ATLAS', 60], ['NIMBUS', 40]], null],
  ].filter((p) => p[0] !== 'Harish');
  const card = ([n, free, since, days, last, sk, why, segs, fit]) => `<div class="pool-card"><div class="row" style="gap:10px">${av(n, 40)}<div style="flex:1;min-width:0"><b>${full(n)}</b><div class="xs mut">${ttl(n)}</div></div><span class="days" style="background:${days > 30 ? C.warnSoft : days ? C.okSoft : C.infoSoft};color:${days > 30 ? C.warn : days ? C.ok : C.info}">${days ? `${days} days` : 'soon'}</span></div>
<div class="row" style="gap:4px;flex-wrap:wrap">${sk.map((s) => skill(s)).join('')}</div>
${load(segs, 0, { noText: true })}<div class="row xs" style="justify-content:space-between"><span class="mut">Free from <b style="color:${C.fg}">${since}</b></span><b style="color:${C.ok}">${free}% free</b></div>
<div class="xs mut">Last: <b style="color:${C.fg}">${last}</b> · ${why}</div>
${fit ? `<div class="xs" style="padding:6px 8px;border-radius:8px;background:${C.priSoft};color:${C.priText}">${icon('zap', 11)} Fits ${fit}</div>` : ''}
<div class="row" style="gap:6px">${btn('History', 'sm', 'history')}<span style="flex:1"></span>${btn('Assign to project', 'pri sm', 'userplus')}</div></div>`;
  const body = `${top('Work', 'PMO pool ' + NEW, 'People who report to the PMO, people released to the pool and people coming free soon. Assign them to projects.', `${btn('Resource planner', '', 'calcheck')}${btn('Export', '', 'file')}`)}
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${[['In the pool now', '3', '#EA580C', 'reports to PMO or released'], ['100% free', '2', C.ok, 'Rohit · Tanvi'], ['Coming in 30 days', '2', C.info, 'Nikhil 16 Oct · Sara 1 Nov'], ['Requests with PMO', '3', C.pri, '2 have a fit here']].map(([l, v, c, s]) => `<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><span class="xs mut">${l}</span><b style="font-size:24px;color:${c}">${v}</b><span class="xs mut">${s}</span></div>`).join('')}</div>
<div class="row" style="gap:6px;flex-wrap:wrap">${chip('All', true)}${chip('Free now')}${chip('Coming soon')}${chip('Reports to PMO')}${chip('Released')}${chip(`${icon('star', 12)}Skill: any ${icon('chevd', 12)}`)}${chip(`${icon('search', 13)}Search people or skills`)}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px" class="rise">${P2.map(card).join('')}</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
<div class="card sec" style="gap:8px"><h3>${icon('calcheck', 15)}Resource planner (from Projects)</h3><div class="xs mut">Weekly grid stays. Its “Open roles — who could take them” card becomes:</div>
<div class="ib"><i style="background:#EA580C"></i><div><b class="xs">Requests waiting for the PMO · 3</b><div class="xs mut">RR-0145 DevOps · RR-0143 Android · RR-0140 Intern</div><span class="xs" style="color:${C.pri};font-weight:700">Open in Resource requests →</span></div></div></div>
<div class="card sec" style="gap:8px"><h3>${icon('info', 15)}Who is in the pool</h3><div class="xs">• Everyone who <b>reports to the PMO</b> and has free time.<br>• Anyone a PM / DD <b>sent to the PMO pool</b> (from their last day).<br>• “Coming” = release approved or assignment ending in the next 30 days.</div></div>
${note([['new', 'Own page in the Work menu — PMO only.'], ['new', 'Cards: free %, skills, since when, last project, best-fit request.'], ['new', '“Assign to project” opens the existing assign dialog pre-filled (100% check kept).']])}
</div>`;
  return dcPage('PMO pool — bench', css, page('PMO pool', 3, 'Work &nbsp;›&nbsp; <b>PMO pool</b>', body, '', 'WORK', true), 1120);
}

// ═════════════════════════ Board 17 · Project create / edit — PM + DD ═════════════════════════
function projectForm() {
  const body = `<div style="display:grid;grid-template-columns:1fr 140px;gap:12px">${fld('Name', inp('Atlas Payments'), '', true)}${fld('Code', inp('<span class="mono" style="color:' + C.fg + '">ATLAS</span>'), 'e.g. APOLLO', true)}</div>
<div class="row" style="gap:10px"><div class="radio-card on"><span class="mic" style="width:28px;height:28px;background:${C.priSoft};color:${C.pri}">${icon('brief', 14)}</span><div><b class="xs">Client project</b><div class="xs mut">Billable</div></div></div><div class="radio-card"><span class="mic" style="width:28px;height:28px;background:${C.line};color:${C.muted}">${icon('building', 14)}</span><div><b class="xs">Company project</b><div class="xs mut">Investment</div></div></div></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">${fld('Client', inp('Zenith Finserv'), '', true)}${fld('Starts', inp('1 Apr 2026', '', 'cal'))}${fld('Ends', inp('31 Mar 2027', '', 'cal'))}</div>
<div style="border:1.5px solid ${C.pri}55;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:12px;background:${C.priSoft}33">
<div class="row" style="gap:8px"><b style="font-size:13px">People in charge</b>${NEW}<span class="xs mut" style="margin-left:auto">Requests and approvals follow these two</span></div>
<div style="display:grid;grid-template-columns:1fr 110px;gap:10px">${fld('Project manager', personIn('Ravi', 'Engineering Manager · PM on 2 projects', 'foc'), '', true)}${fld('Time here', inp('<b>30</b> %'), 'Added as PM member')}</div>
${fld('Delivery Director', `${personIn('Suresh', 'Delivery Director · 4 projects · 3 PMs')}<div class="row xs" style="gap:6px;margin-top:6px;padding:7px 10px;border-radius:9px;background:#fff;border:1px dashed ${C.pri}66"><span style="color:${C.pri}">${icon('sparkle', 13)}</span><span style="flex:1">Suggested: <b>Suresh Pillai</b> — Ravi’s reporting manager.</span><span class="xs" style="color:${C.ok};font-weight:800">${icon('check2', 11)} Used</span></div>`, 'Approves requests after the PM. You can pick anyone.', true)}
<div class="xs mut">Request path for this project: Team lead → <b style="color:${C.fg}">Ravi Kumar</b> → <b style="color:${C.fg}">Suresh Pillai</b> → PMO</div>
</div>
<div class="row" style="gap:10px;align-items:flex-end"><div style="flex:1">${fld('Status', inp('Active'))}</div><div style="flex:2">${fld('Colour', `<div class="row" style="gap:6px;height:36px">${['#0D9488', '#4F46E5', '#DB2777', '#F59E0B', '#0EA5E9', '#7C3AED'].map((c, i) => `<span style="width:24px;height:24px;border-radius:50%;background:${c};${i === 0 ? `box-shadow:0 0 0 2px #fff,0 0 0 4px ${c}` : ''}"></span>`).join('')}</div>`)}</div></div>`;
  const overlay = `<div class="ovl"></div>${modal({ w: 680, ic: 'folder', title: 'Edit Atlas Payments', desc: '', body, foot: `${btn('Cancel')}${btn('Save', 'pri')}`, style: 'top:51%' })}`;
  const side = `<div style="position:absolute;right:24px;top:90px;width:300px;display:flex;flex-direction:column;gap:10px;z-index:5">
<div class="card sec" style="gap:8px"><b class="xs">When the PMO changes the PM</b><div class="xs mut">Pick Farhan Ali → the Delivery Director box suggests <b>Farhan’s</b> reporting manager. If Suresh was set by hand, we ask: “Keep Suresh or use the suggestion?”</div></div>
<div class="card sec" style="gap:8px"><b class="xs">Open requests when people change</b><div class="xs mut">Requests waiting for the old PM / DD move to the new one. The timeline says “moved to Farhan (PM changed)”.</div></div>
<div class="card sec" style="gap:8px"><b class="xs">Suresh’s projects</b>${['ATLAS', 'NIMBUS', 'HELIX', 'ORION'].map((k) => `<div class="row xs" style="justify-content:space-between">${pj(k)}<span class="mut">${{ ATLAS: 'Ravi', NIMBUS: 'Ravi', HELIX: 'Farhan', ORION: 'Farhan' }[k]}</span></div>`).join('')}</div>
${note([['old', 'Name, code, type, client, status, dates, colour, description stay. PM was added in “Assign people” only.'], ['new', 'PM + Delivery Director pickers (PMO only). DD suggested from the PM’s manager.'], ['q', 'Several PMs on one project — any of them can act? (q 3)']])}</div>`;
  return dcPage('Project form — PM and Delivery Director', css, page('Projects', 3, 'Projects &nbsp;›&nbsp; <b>Atlas Payments</b>', `${projectHeader('')}<div class="card" style="height:520px"></div>`, overlay + side, 'WORK', true), 1060);
}

// ═════════════════════════ Board 18 · Who sees and does what ═════════════════════════
function who() {
  const cols = ['Team Lead', 'Project Manager', 'Delivery Director', 'PMO', 'HR', 'Employee'];
  const Y = '<span class="y">✓</span>', N = '<span class="n">—</span>', S = (t) => `<span class="s">${t}</span>`;
  const rows = [
    ['Menu: Work → Resource requests', Y, Y, Y, Y, N, N],
    ['Menu: Work → PMO pool', N, N, N, Y, N, N],
    ['See the project Requests tab', Y, Y, Y, Y, S('view'), N],
    ['Raise “Request a person”', S('own project'), Y, N, N, N, N],
    ['Release a member', S('own members'), Y, Y, Y, N, N],
    ['Fill directly', N, S('people on own projects'), S('people on own projects'), S('anyone'), N, N],
    ['Approve → next step', N, Y, Y, '—', N, N],
    ['Hold / Unhold (reason)', N, Y, Y, Y, N, N],
    ['Reject (reason)', N, Y, Y, Y, N, N],
    ['Release decision (pool / reassign / hold / keep)', N, Y, Y, S('ask q 10'), N, N],
    ['Set PM + Delivery Director on a project', N, N, N, Y, N, N],
    ['“Reports to: PMO” on add employee', N, N, N, S('if employee.create'), Y, N],
    ['Assignment history on a profile', S('own team'), S('people on projects'), S('people on projects'), Y, Y, S('own')],
    ['Request back a released person', S('who worked for them'), N, N, N, N, N],
  ];
  const notif = [
    ['Request raised', 'PM', 'bell + email'], ['Approved → next step', 'next approver + Lead', 'bell'], ['On hold / unhold', 'Lead', 'bell + email (reason)'], ['Rejected', 'Lead', 'bell + email (reason)'],
    ['Filled', 'Lead, the person, their current PM', 'bell + email'], ['Release asked', 'PM', 'bell'], ['Release decided', 'Lead, the person, PMO (if pool), new lead (if reassigned)', 'bell + email'],
  ];
  const html = page('Resource requests', 4, 'Work &nbsp;›&nbsp; <b>Who sees what</b>', `${top('Work', 'Resource requests — who sees and does what', 'Authority comes from the project roles (Team Lead, Project Manager, Delivery Director) and project.manage (PMO). Menu items show only to people who hold that role somewhere.')}
<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px;align-items:start">
<div class="card" style="overflow:hidden"><table class="tbl mx"><tr><th>Action</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${rows.map(([a, ...v]) => `<tr><td><b>${a}</b></td>${v.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>
<div style="display:flex;flex-direction:column;gap:14px">
<div class="card" style="overflow:hidden"><table class="tbl"><tr><th>Event</th><th>Who is told</th><th>How</th></tr>${notif.map(([e, w, h]) => `<tr><td><b>${e}</b></td><td>${w}</td><td class="mut">${h}</td></tr>`).join('')}</table></div>
<div class="card sec" style="gap:8px"><h3>${icon('info', 15)}Edge cases (our default)</h3>${['Same person is PM and DD → the DD step is skipped automatically.', 'DD is also PMO → the PMO step is skipped (DD can assign anyone).', 'Project has no DD → PM approves straight to PMO.', 'Approver on leave → delegation (existing) applies.', 'Nobody can approve their own request.'].map((t) => `<div class="xs">• ${t}</div>`).join('')}</div>
</div></div>`);
  return dcPage('Resource requests — who sees what', css, html, 1020);
}

// ═════════════════════════ Dark copies ═════════════════════════
const DARK = [
  [/#F6F7FB/gi, '#0E0D15'], [/#E5E7EF/gi, '#2B2939'], [/#EEF0F5/gi, '#232130'], [/#F8F9FC/gi, '#15141E'], [/#111827/gi, '#ECEAF4'], [/#6B7280/gi, '#9C99B0'],
  [/#374151/gi, '#CFCCE0'], [/#9CA3AF/gi, '#7D7A92'], [/#EEF0FF/gi, '#26244A'], [/#3730A3/gi, '#C3C0FF'], [/#E6F6F0/gi, '#0F2B23'], [/#FEF3E2/gi, '#33240D'],
  [/#FDECEC/gi, '#3A1719'], [/#E5F4FB/gi, '#0D2735'], [/rgba\(255,255,255,\.7\)/g, 'rgba(25,23,36,.7)'], [/#CBD2DE/gi, '#3A3850'], [/#D1D5DB/gi, '#3A3850'],
  [/#FFEDD5/gi, '#3A2312'], [/#F1EBFE/gi, '#2A1F45'], [/#E6F6F4/gi, '#0F2A28'], [/#DCFCE7/gi, '#11301C'], [/#166534/gi, '#86EFAC'], [/#7C4A03/gi, '#F5C77A'],
  [/#0C4A6E/gi, '#9BD3F5'], [/#7F1D1D/gi, '#FCA5A5'], [/#065F46/gi, '#86EFAC'], [/#C8CCD8/gi, '#4A475E'], [/#C4C8D2/gi, '#4A475E'], [/#92400E/gi, '#F5C77A'], [/#C2410C/gi, '#FDBA74'],
];
function darkify(s) {
  let out = s.replace(/color:\s*#fff\b/gi, 'color:__W__').replace(/#ffffff\b/gi, '#191724').replace(/#fff(?![0-9a-f])/gi, '#191724');
  for (const [re, v] of DARK) out = out.replace(re, v);
  return out.replace(/__W__/g, '#fff').replace('<title>', '<title>Dark · ');
}

// ═════════════════════════ Write + place ═════════════════════════
const boards = [
  ['CAResOverview.dc.html', 'Resource requests · What changes — two flows (request up, release down), today vs new, hard rules, motion', overview, 1480],
  ['CAResProjectTab.dc.html', 'Resource requests · Project page — new Requests tab with status + 4-step path; Lead actions Request a person / Release', projectTab, 1180],
  ['CAResRequestForm.dc.html', 'Resource requests · “Request a person” popup — role, skills, %, dates, reason, preferred person with live load', requestForm, 1080],
  ['CAResReviewPM.dc.html', 'Resource requests · PM review drawer — preferred person, best matches by skills + free %, Fill / Approve → DD / Hold / Reject', reviewPM, 1120],
  ['CAResNotUnder.dc.html', 'Resource requests · PM review, preferred person NOT under you — locked card, “only PMO can assign”, approve onward with a note', notUnder, 1120],
  ['CAResHold.dc.html', 'Resource requests · Hold → On hold (locked) → Unhold → decide; reasons, reminder, who is told, history', holdBoard, 1080],
  ['CAResReject.dc.html', 'Resource requests · Reject with reason → Lead’s rejected card → Raise again (pre-filled, linked)', rejectBoard, 800],
  ['CAResDD.dc.html', 'Resource requests · Delivery Director view — PM’s note, people on all DD projects, pool tip, Approve → PMO', ddView, 1120],
  ['CAResPMO.dc.html', 'Resource requests · PMO view — assign the preferred person or anyone free (PMO pool first), role / lead / billed', pmoView, 1120],
  ['CAResRelease.dc.html', 'Resource requests · Release popup (Lead) — reason chips, last day, hand-over; goes to the PM', releaseForm, 1000],
  ['CAResReleaseDecide.dc.html', 'Resource requests · Release decision (PM / DD) — PMO pool · Reassign to my project (100% check) · Hold · Keep', releaseDecide, 1120],
  ['CAResInbox.dc.html', 'Resource requests · Inbox — own page Work → Resource requests (menu badge): Waiting for me / On hold / Done, filters, live', inbox, 960],
  ['CAResMine.dc.html', 'Resource requests · My requests (Lead) — plain statuses with reasons, withdraw, raise again, released people → Request back', mine, 920],
  ['CAResTimeline.dc.html', 'Resource requests · Request timeline — every step incl. hold / unhold reasons, who filled with whom, time per step', timeline, 980],
  ['CAResHistory.dc.html', 'Resource requests · Employee profile → Projects — Assignment history timeline, skills, Request back', history, 1040],
  ['CAResEmpCreate.dc.html', 'Resource requests · Add employee step 3 — “Reports to: a person / the PMO” (PMO pool)', empCreate, 1000],
  ['CAResPool.dc.html', 'Resource requests · PMO pool — own page Work → PMO pool (PMO only): free %, skills, since when, last project, Assign; planner card change', pool, 1120],
  ['CAResProjectForm.dc.html', 'Resource requests · Project form — Project manager + Delivery Director (suggested from the PM’s manager)', projectForm, 1060],
  ['CAResWho.dc.html', 'Resource requests · Who sees and does what — Lead / PM / DD / PMO / HR / Employee, notifications, edge cases', who, 1020],
  ['CAResInboxDark.dc.html', 'Resource requests · Inbox (dark)', () => darkify(inbox()), 960],
  ['CAResReviewDark.dc.html', 'Resource requests · PM review drawer (dark)', () => darkify(reviewPM()), 1120],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());

const canvas = JSON.parse(fs.readFileSync(path.join(OUT, 'canvas.json'), 'utf8'));
// Lowest existing board bottom, ignoring our own boards (so re-runs stay in place)
let lowest = 0;
for (const [k, b] of Object.entries(canvas.boards)) if (!k.startsWith('CARes')) lowest = Math.max(lowest, b.y + b.h);
const ROW_Y = Math.ceil((lowest + 600) / 100) * 100;
let y = ROW_Y;
for (let r = 0; r < boards.length; r += 4) {
  const row = boards.slice(r, r + 4);
  row.forEach(([f, title, , h], i) => {
    canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y };
    if (!canvas.order.includes(f)) canvas.order.push(f);
  });
  y += Math.max(...row.map((b) => b[3])) + 120;
}
let key = Object.entries(canvas.notes).find(([, n]) => n.text && n.text.startsWith('Company · Resource requests'))?.[0];
if (!key) key = 'n' + (Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1);
canvas.notes[key] = { kind: 'title1', maxW: 6000, text: 'Company · Resource requests & reassignment — request a person (Lead → PM → Delivery Director → PMO), hold / reject, release & reassign, inbox, timelines, Reports to PMO, PMO pool, PM + DD on projects', w: 240, x: 0, y: ROW_Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('row y', ROW_Y, 'note', key, '\nbuilt', boards.map((b) => b[0]).join(', '));
