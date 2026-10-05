// Company app → Timesheets (Tempo-style): week calendar, log work, submit, approvals, reports, rules.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { sidebar: reportsSidebar, C } = require('./build-reports.js');
const { css: peopleCss, photo } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus2: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
});
const sidebar = (on) => reportsSidebar().replace('class="sb-i on"', 'class="sb-i"').replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;

// Projects this person logs against
const PJ = {
  ATL: { n: 'Atlas — Billing revamp', c: '#4F46E5', type: 'Client · billable' },
  HEL: { n: 'Helios data platform', c: '#DB2777', type: 'Client · billable' },
  NOV: { n: 'Nova mobile app', c: '#0D9488', type: 'Internal · investment' },
  GEN: { n: 'General / not on a project', c: '#64748B', type: 'Internal · investment' },
};
const HH = 46; // px per hour
const H0 = 8; // first hour on the grid
const t2y = (t) => (t - H0) * HH;
const fmt = (t) => `${String(Math.floor(t)).padStart(2, '0')}:${t % 1 ? String(Math.round((t % 1) * 60)).padStart(2, '0') : '00'}`;
const dur = (a, b) => { const m = Math.round((b - a) * 60); return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`; };

const css = peopleCss.replace('</style>', `
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi .card{padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.seg2{display:inline-flex;border:1px solid ${C.border};border-radius:10px;background:#fff;padding:2px}.seg2 span{padding:5px 12px;border-radius:8px;font-size:12.5px;font-weight:700;color:${C.muted};display:inline-flex;gap:6px;align-items:center}.seg2 span.on{background:${C.priSoft};color:${C.priText}}
.cal{display:grid;grid-template-columns:56px repeat(5,1fr) .55fr .55fr;border:1px solid ${C.border};border-radius:14px;overflow:hidden;background:#fff}
.cal .dh{padding:8px 10px;border-bottom:1px solid ${C.border};border-left:1px solid ${C.line};background:${C.raised};display:flex;flex-direction:column;gap:4px}
.cal .col{position:relative;border-left:1px solid ${C.line}}
.cal .hr{position:absolute;left:0;right:0;border-top:1px dashed ${C.line}}
.cal .tl{position:relative}.cal .tl span{position:absolute;right:8px;font-size:10.5px;color:${C.muted};transform:translateY(-6px)}
.blk{position:absolute;left:8px;right:5px;border-radius:9px;padding:5px 8px;font-size:11.5px;line-height:1.3;overflow:hidden;box-sizing:border-box;border-left:4px solid}
.blk b{display:block;font-size:11.5px}.blk .d{color:#374151;display:block}.blk .t{font-size:10.5px;opacity:.8;font-weight:700}
.att{position:absolute;left:0;width:4px;border-radius:0 4px 4px 0;background:${C.ok};opacity:.55}
.ghost{position:absolute;left:8px;right:5px;border:2px dashed ${C.pri};border-radius:9px;background:${C.priSoft}aa;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;color:${C.priText}}
.now{position:absolute;left:0;right:0;height:2px;background:${C.bad};z-index:3}.now:before{content:'';position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:${C.bad}}
.tst{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:99px;width:max-content}
.prj{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid ${C.border};border-radius:12px;background:#fff}
.prj .sw{width:10px;height:28px;border-radius:4px}
.bar{height:6px;border-radius:99px;background:${C.line};overflow:hidden;display:flex}.bar i{display:block;height:100%}
.fld{display:flex;flex-direction:column;gap:5px}.fld label{font-size:12px;font-weight:700}.inp{border:1px solid ${C.border};border-radius:10px;padding:9px 11px;font-size:13px;background:#fff;display:flex;align-items:center;gap:8px}
.tg{display:grid;grid-template-columns:200px repeat(7,1fr) 110px 120px;align-items:center;border-bottom:1px solid ${C.line}}
.tg>div{padding:9px 10px;font-size:12.5px}
.cell{border-radius:8px;text-align:center;font-weight:800;font-size:12px;padding:7px 0}
.sheet{position:fixed}
.ov{position:relative;border-radius:18px;overflow:hidden}
.kbd{display:inline-block;border:1px solid ${C.border};border-bottom-width:2px;border-radius:5px;padding:0 5px;font-size:10.5px;font-weight:700;background:#fff}
.opt{border:1.5px solid ${C.border};border-radius:12px;padding:12px;display:flex;gap:10px;align-items:flex-start;background:#fff}.opt.on{border-color:${C.pri};background:${C.priSoft}66}
.rad{width:16px;height:16px;border-radius:50%;border:2px solid ${C.border};flex:none;margin-top:2px}.opt.on .rad{border:5px solid ${C.pri}}
.tgl{width:34px;height:20px;border-radius:99px;background:${C.pri};position:relative;flex:none}.tgl:after{content:'';position:absolute;right:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}.tgl.off{background:#D1D5DB}.tgl.off:after{right:auto;left:3px}
</style>`);

const ST = {
  approved: ['✓ Approved', C.ok, C.okSoft],
  submitted: ['● Waiting', C.info, C.infoSoft],
  draft: ['Draft', C.muted, C.raised],
  back: ['↩ Sent back', C.bad, C.badSoft],
  leave: ['Leave', C.violet, '#F1EBFE'],
  none: ['Not logged', C.warn, C.warnSoft],
};
const st = (k) => `<span class="tst" style="background:${ST[k][2]};color:${ST[k][1]}">${ST[k][0]}</span>`;

// One week of blocks: [dayIndex, from, to, project, description]
const WEEK = [
  [0, 9.5, 10, 'GEN', 'Stand-up + inbox'], [0, 10, 12, 'ATL', 'Invoice API — pagination & filters'], [0, 13, 15, 'HEL', 'Pipeline review with Meena'], [0, 15.25, 18, 'ATL', 'Invoice API — tests'],
  [1, 9.5, 10, 'GEN', 'Stand-up'], [1, 10, 12, 'ATL', 'Fix rounding bug in tax calc'], [1, 13, 15, 'ATL', 'Code review — Karan’s PR #412'], [1, 15, 17.5, 'HEL', 'Schema mapping for ledger'],
  [2, 9.5, 10, 'GEN', 'Stand-up'], [2, 10, 11.5, 'NOV', 'Push notification spike'], [2, 11.5, 13, 'ATL', 'UAT prep with client'],
  [3, 9.5, 10, 'GEN', 'Stand-up'], [3, 10, 12.5, 'ATL', 'Invoice export to PDF'],
];
const ATT = [[9.4, 18.3], [9.6, 18], [9.3, 17.8], [9.5, null], null, null, null];

function weekCal({ ghost = true, now = 14.6, statuses = ['submitted', 'submitted', 'draft', 'draft', 'leave', '', ''], hFrom = H0, hTo = 19 } = {}) {
  const days = ['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9', 'Sat 10', 'Sun 11'];
  const hgt = (hTo - hFrom) * HH;
  const tot = days.map((_, d) => WEEK.filter((w) => w[0] === d).reduce((n, w) => n + (w[2] - w[1]), 0));
  const head = `<div class="dh" style="border-left:0"></div>${days.map((d, i) => `<div class="dh" ${i > 4 ? `style="background:#F1F2F6"` : ''}><div class="row" style="justify-content:space-between"><b style="font-size:12.5px;${i === 3 ? `color:${C.pri}` : ''}">${d}${i === 3 ? ' · today' : ''}</b>${statuses[i] ? st(statuses[i]) : ''}</div>${i < 4 ? `<div class="xs mut"><b style="color:${C.fg}">${dur(0, tot[i])}</b> logged · ${ATT[i][1] ? `${dur(ATT[i][0], ATT[i][1])} in office` : 'checked in 9:30'}</div><div class="bar"><i style="width:${Math.min(100, (tot[i] / 8) * 100)}%;background:${tot[i] >= 8 ? C.ok : C.pri}"></i></div>` : i === 4 ? `<div class="xs mut">Casual leave</div><div class="bar"></div>` : `<div class="xs mut">Weekend</div>`}</div>`).join('')}`;
  const hours = Array.from({ length: hTo - hFrom }, (_, i) => hFrom + i);
  const tl = `<div class="tl" style="height:${hgt}px">${hours.map((h) => `<span style="top:${(h - hFrom) * HH}px">${h > 12 ? h - 12 : h} ${h >= 12 ? 'pm' : 'am'}</span>`).join('')}</div>`;
  const cols = days.map((_, d) => {
    const lines = hours.map((h) => `<div class="hr" style="top:${(h - hFrom) * HH}px"></div>`).join('');
    const a = ATT[d];
    const att = a ? `<div class="att" style="top:${(a[0] - hFrom) * HH}px;height:${((a[1] ?? now) - a[0]) * HH}px" title="Checked in"></div>` : '';
    const blocks = WEEK.filter((w) => w[0] === d).map(([, f, t, p, desc]) => {
      const pj = PJ[p];
      const small = t - f <= 0.5;
      return `<div class="blk" style="top:${(f - hFrom) * HH + 1}px;height:${(t - f) * HH - 3}px;background:${pj.c}14;border-color:${pj.c}">${small ? `<span class="t" style="color:${pj.c}">${p} · ${desc}</span>` : `<b style="color:${pj.c}">${pj.n.split(' —')[0]}</b><span class="d">${desc}</span><span class="t">${fmt(f)}–${fmt(t)} · ${dur(f, t)}</span>`}</div>`;
    }).join('');
    const leave = d === 4 ? `<div style="position:absolute;inset:6px;border-radius:10px;background:repeating-linear-gradient(135deg,#F1EBFE 0 10px,#F8F5FF 10px 20px);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;color:${C.violet};font-weight:800;font-size:12px">🌴 Casual leave<span class="xs" style="font-weight:600">Nothing to log</span></div>` : '';
    const g = ghost && d === 3 ? `<div class="ghost" style="top:${(13.5 - hFrom) * HH}px;height:${1.5 * HH - 3}px">+ 1:30 pm – 3:00 pm · 1h 30m</div>` : '';
    const nw = d === 3 ? `<div class="now" style="top:${(now - hFrom) * HH}px"></div>` : '';
    const wk = d > 4 ? 'background:#FAFAFC' : '';
    return `<div class="col" style="height:${hgt}px;${wk}">${lines}${att}${blocks}${leave}${g}${nw}</div>`;
  }).join('');
  return `<div class="cal">${head}${tl}${cols}</div>`;
}

// ─── Board 1: My timesheet — week calendar ───────────────────
function myWeek() {
  const proj = [['ATL', '60%', 13.75, 24], ['HEL', '40%', 4.5, 16], ['NOV', 'helping', 1.5, null], ['GEN', '', 2, null]];
  const html = `<div class="app">${sidebar('Timesheets')}<div class="col">${header('Work &nbsp;›&nbsp; <b>Timesheets</b>')}<main class="main">
${top('Work', 'My timesheet', 'Drag on the calendar to log what you worked on · Submit sends every day you haven’t sent yet', `<span class="btn">${icon('copy', 14)}Copy last week</span><span class="btn pri">${icon('send', 14)}Submit Wed–Thu</span>`)}
<div class="row" style="gap:10px"><span class="btn sm">‹</span><b style="font-size:15px">5 – 11 Oct 2026</b><span class="btn sm">›</span><span class="btn sm">Today</span>
  <span class="xs mut" style="margin-left:6px">Week total <b style="color:${C.fg}">21h 45m</b> of 32h expected (4 working days)</span>
  <div class="seg2" style="margin-left:auto"><span>${icon('cal', 12)}Day</span><span class="on">${icon('cal', 12)}Week</span><span>${icon('list', 12)}List</span></div></div>
<div style="display:grid;grid-template-columns:270px 1fr;gap:16px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:12px;gap:10px;background:linear-gradient(135deg,#EEF0FF,#fff)"><div class="row xs" style="justify-content:space-between"><b>Timer</b><span class="tst" style="background:${C.okSoft};color:${C.ok}">● running</span></div>
      <div class="row" style="gap:10px"><span style="width:10px;height:34px;border-radius:4px;background:#4F46E5"></span><div style="flex:1"><b style="font-size:13px">Atlas</b><div class="xs mut">UAT checklist</div></div><b style="font-size:20px;font-variant-numeric:tabular-nums">00:42</b></div>
      <div class="row" style="gap:6px"><span class="btn sm" style="flex:1;justify-content:center">${icon('stop', 12)}Stop &amp; log</span><span class="btn sm">Discard</span></div></div>
    <div class="card" style="padding:12px;gap:8px"><b style="font-size:13px">Log against</b><div class="xs mut">Your projects from the PMO — drag one onto the calendar</div>
      ${proj.map(([k, alloc, done, exp]) => { const p = PJ[k]; return `<div class="prj"><span class="sw" style="background:${p.c}"></span><div style="flex:1;min-width:0"><b style="font-size:12.5px">${p.n.split(' —')[0]}</b><div class="xs mut">${p.type}${alloc ? ` · ${alloc}` : ''}</div>${exp ? `<div class="bar" style="margin-top:5px"><i style="width:${(done / exp) * 100}%;background:${p.c}"></i></div>` : ''}</div><b class="xs">${dur(0, done)}${exp ? `<span class="mut" style="font-weight:600"> / ${exp}h</span>` : ''}</b></div>`; }).join('')}</div>
    <div class="card" style="padding:12px;gap:8px;border-color:#FCD9A8;background:#FFFBF3"><b style="font-size:13px">⚡ Gaps to fill</b>
      ${[['Mon 5', '12:00–13:00', 'lunch?'], ['Wed 7', '1:00 pm – 5:48 pm', '4h 48m in office, not logged'], ['Tue 6', '5:30 – 6:00 pm', '30m']].map(([d, t, s]) => `<div class="row xs" style="gap:8px"><b style="width:44px">${d}</b><span style="flex:1">${t}<div class="mut">${s}</div></span><span class="btn sm">Fill</span></div>`).join('')}
      <div class="xs mut">From your check-in / check-out times</div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">
    ${weekCal()}
    <div class="row xs mut" style="gap:16px"><span class="row" style="gap:5px"><span style="width:4px;height:14px;background:${C.ok};opacity:.6;border-radius:2px"></span>Checked in</span><span class="row" style="gap:5px"><span style="width:14px;height:10px;border:2px dashed ${C.pri};border-radius:3px"></span>Dragging a new block</span><span class="row" style="gap:5px"><span style="width:12px;height:2px;background:${C.bad}"></span>Now</span><span style="margin-left:auto">Shortcuts: <span class="kbd">N</span> new · <span class="kbd">C</span> copy yesterday · <span class="kbd">←</span><span class="kbd">→</span> week · <span class="kbd">T</span> timer</span></div>
  </div>
</div>
<div class="card" style="padding:12px 16px;flex-direction:row;align-items:center;gap:18px">
  <b style="font-size:13px">This week</b>
  <div style="flex:1"><div class="bar" style="height:12px">${[['#4F46E5', 13.75], ['#DB2777', 4.5], ['#0D9488', 1.5], ['#64748B', 2]].map(([c, h]) => `<i style="width:${(h / 21.75) * 100}%;background:${c}"></i>`).join('')}</div></div>
  <span class="xs"><b style="color:${C.ok}">18h 15m billable</b> · <b style="color:${C.muted}">3h 30m investment</b></span>
  <span class="xs mut">Mon–Tue: Atlas time with <b style="color:${C.fg}">Sameer</b> (Atlas lead) · Helios with <b style="color:${C.fg}">Meena</b> (Helios lead)</span>
</div>
</main></div></div>`;
  return dcPage('My timesheet — week', css, html, 1180);
}

// ─── Board 2: Day view + log work panel ──────────────────────
function logWork() {
  const blocks = WEEK.filter((w) => w[0] === 3);
  const hFrom = 9, hTo = 18;
  const hours = Array.from({ length: hTo - hFrom }, (_, i) => hFrom + i);
  const H = 56;
  const day = `<div class="card" style="padding:0;overflow:hidden"><div class="row" style="padding:12px 16px;border-bottom:1px solid ${C.line};gap:10px"><span class="btn sm">‹</span><b>Thursday 8 Oct</b><span class="btn sm">›</span><span class="xs mut" style="margin-left:auto">In office 9:30 → now · <b style="color:${C.fg}">3h logged</b> of 8h</span></div>
  <div style="display:grid;grid-template-columns:60px 1fr;position:relative">
    <div style="position:relative;height:${(hTo - hFrom) * H}px">${hours.map((h) => `<span class="xs mut" style="position:absolute;right:10px;top:${(h - hFrom) * H - 6}px">${h > 12 ? h - 12 : h} ${h >= 12 ? 'pm' : 'am'}</span>`).join('')}</div>
    <div style="position:relative;height:${(hTo - hFrom) * H}px;border-left:1px solid ${C.line}">
      ${hours.map((h) => `<div class="hr" style="position:absolute;left:0;right:0;top:${(h - hFrom) * H}px;border-top:1px dashed ${C.line}"></div>`).join('')}
      <div class="att" style="top:${(9.5 - hFrom) * H}px;height:${(14.6 - 9.5) * H}px"></div>
      ${blocks.map(([, f, t, p, desc]) => { const pj = PJ[p]; return `<div class="blk" style="left:14px;right:14px;top:${(f - hFrom) * H + 1}px;height:${(t - f) * H - 4}px;background:${pj.c}14;border-color:${pj.c};display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><b style="color:${pj.c}">${pj.n}</b><span class="d">${desc}</span></div><span class="t">${fmt(f)}–${fmt(t)} · ${dur(f, t)}</span></div>`; }).join('')}
      <div style="position:absolute;left:14px;right:14px;top:${(12.5 - hFrom) * H + 1}px;height:${H - 4}px;border-radius:9px;background:repeating-linear-gradient(135deg,#FEF3E2 0 8px,#FFFAF0 8px 16px);display:flex;align-items:center;padding:0 12px;font-size:12px;color:${C.warn};font-weight:700;gap:8px">12:30 – 1:30 pm · not logged <span class="btn sm" style="margin-left:auto">Mark as break</span></div>
      <div class="ghost" style="left:14px;right:14px;top:${(13.5 - hFrom) * H}px;height:${1.5 * H - 3}px">1:30 pm – 3:00 pm · 1h 30m</div>
      <div class="now" style="top:${(14.6 - hFrom) * H}px"></div>
    </div>
  </div></div>`;
  const form = `<div class="card" style="padding:18px;gap:14px;box-shadow:0 30px 60px -20px rgba(17,24,39,.35);border-color:${C.pri}55">
    <div class="row"><b style="font-size:16px;flex:1">Log work</b><span class="xs mut">Thu 8 Oct</span></div>
    <div class="fld"><label>Project</label><div class="inp" style="border-color:${C.pri}"><span style="width:10px;height:10px;border-radius:3px;background:#4F46E5"></span><b style="flex:1">Atlas — Billing revamp</b><span class="xs mut">▾</span></div>
      <div style="border:1px solid ${C.border};border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:2px;margin-top:2px">
        <div class="xs mut" style="padding:4px 8px;font-weight:800;letter-spacing:.06em">YOUR PROJECTS</div>
        ${[['ATL', 'Member · 60%', true], ['HEL', 'Member · 40%', false], ['NOV', 'Helping out this week', false]].map(([k, sub, on]) => `<div class="row" style="gap:10px;padding:7px 8px;border-radius:9px;${on ? `background:${C.priSoft}` : ''}"><span style="width:10px;height:10px;border-radius:3px;background:${PJ[k].c}"></span><span style="flex:1;font-size:13px"><b>${PJ[k].n}</b><div class="xs mut">${sub} · ${PJ[k].type}</div></span>${on ? icon('check2', 14) : ''}</div>`).join('')}
        <div class="row" style="gap:10px;padding:7px 8px;border-top:1px solid ${C.line}"><span style="width:10px;height:10px;border-radius:3px;background:#64748B"></span><span style="flex:1;font-size:13px"><b>General</b><div class="xs mut">Meetings, learning, admin — not on a project</div></span></div>
      </div></div>
    <div class="fld"><label>What did you work on?</label><div class="inp" style="min-height:62px;align-items:flex-start;color:${C.fg}">Walked the client through UAT checklist, logged 4 defects in Jira (ATL-221 → 224)</div></div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:end">
      <div class="fld"><label>From</label><div class="inp"><b>1:30 pm</b></div></div><span class="mut" style="padding-bottom:10px">→</span>
      <div class="fld"><label>To</label><div class="inp"><b>3:00 pm</b></div></div>
      <div class="fld"><label>&nbsp;</label><div class="inp" style="background:${C.raised}"><b>1h 30m</b></div></div></div>
    <div class="row xs" style="gap:8px;padding:8px 10px;border-radius:10px;background:${C.badSoft};color:${C.bad}">${icon('alert', 13)}<span><b>Overlaps another block.</b> You logged Atlas · “Invoice export to PDF” 10:00 – 12:30 — change the times so they don’t cross.</span></div>
    <div class="xs mut" style="margin-top:-6px">Shown only if the times cross another block — the example above is fine at 1:30 – 3:00.</div>
    <div class="row xs" style="gap:6px;flex-wrap:wrap"><span class="mut">Type:</span>${['Development', 'Meeting', 'Review', 'Testing', 'Support', 'Learning'].map((t, i) => `<span class="chip ${i === 3 ? 'on' : ''}" style="font-size:11.5px">${t}</span>`).join('')}</div>
    <div class="row xs" style="gap:8px;padding:9px 11px;border-radius:10px;background:${C.okSoft};color:${C.ok};font-weight:700">${icon('check2', 13)}Billable — Atlas is a client project<span class="mut" style="margin-left:auto;font-weight:600">set by the PMO</span></div>
    <div class="row xs" style="gap:10px"><span class="tgl off"></span><span>Repeat Mon–Fri this week</span></div>
    <div class="row" style="gap:8px;border-top:1px solid ${C.line};padding-top:12px"><span class="xs mut" style="flex:1"><span class="kbd">Enter</span> save · <span class="kbd">Shift</span>+<span class="kbd">Enter</span> save &amp; next</span><span class="btn">Cancel</span><span class="btn pri">Save</span></div>
  </div>`;
  const html = `<div class="app">${sidebar('Timesheets')}<div class="col">${header('Work &nbsp;›&nbsp; Timesheets &nbsp;›&nbsp; <b>Day</b>')}<main class="main">
${top('Work', 'Log work', 'Drag across the day (or press N) — pick a project, say what you did, done', `<div class="seg2"><span class="on">${icon('cal', 12)}Day</span><span>${icon('cal', 12)}Week</span><span>${icon('list', 12)}List</span></div>`)}
<div style="display:grid;grid-template-columns:1fr 430px;gap:18px;align-items:start">${day}${form}</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
  ${[['Only your projects', 'The picker lists what the PMO assigned you, plus General. Billable comes from the project type and your “billed” switch — nobody types it.'], ['Always a time range', 'Log 10:00–12:00. Typing just “2h” places the block right after your last one — drag to adjust. No future time.'], ['No overlapping blocks', 'You can’t be on two things at once: a block can’t cross another one, even on a different project.'], ['Uses your attendance', 'Your check-in/out shows as a green line, and unlogged time in the office turns up as a gap you can fill in one click.']].map(([t, s]) => `<div class="card" style="padding:12px 14px;gap:4px"><b style="font-size:13px">${t}</b><span class="xs mut">${s}</span></div>`).join('')}
</div>
</main></div></div>`;
  return dcPage('Log work — day view', css, html, 1180);
}

// ─── Board 3: Submit for approval ───────────────────────────
function submit() {
  const rows = [['Mon 5', '8h 15m', '8h 54m', 'ok', 'Submitted'], ['Tue 6', '7h 30m', '8h 24m', 'ok', 'Submitted'], ['Wed 7', '3h', '8h 30m', 'gap', ''], ['Thu 8', '4h 30m', 'still in', 'ok', ''], ['Fri 9', '—', 'Casual leave', 'leave', '']];
  const modal = `<div class="card" style="width:640px;padding:0;overflow:hidden;box-shadow:0 40px 80px -20px rgba(17,24,39,.45)">
    <div style="padding:18px 20px;border-bottom:1px solid ${C.line}"><b style="font-size:17px">Submit for approval</b><div class="xs mut">Sends every day you’ve logged but not sent yet, up to today</div></div>
    <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="opt"><span class="rad"></span><div><b style="font-size:13px">Just today</b><div class="xs mut">Thu 8 Oct · 4h 30m</div></div></div>
        <div class="opt on"><span class="rad"></span><div><b style="font-size:13px">Everything not sent yet</b><div class="xs mut">Wed 7 – Thu 8 · 7h 30m</div></div></div>
      </div>
      <div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden">
        ${rows.map(([d, l, a, k, s]) => `<div class="row" style="gap:12px;padding:9px 12px;border-bottom:1px solid ${C.line};font-size:12.5px;${s ? 'opacity:.55' : ''}"><b style="width:52px">${d}</b><span style="width:70px"><b>${l}</b></span><span class="mut" style="flex:1">${k === 'leave' ? a : `in office ${a}`}</span>${s ? `<span class="tst" style="background:${C.infoSoft};color:${C.info}">already sent</span>` : k === 'gap' ? `<span class="tst" style="background:${C.warnSoft};color:${C.warn}">⚠ 5h 30m in office not logged</span>` : k === 'leave' ? `<span class="tst" style="background:#F1EBFE;color:${C.violet}">on leave — skipped</span>` : `<span class="tst" style="background:${C.okSoft};color:${C.ok}">✓ looks right</span>`}</div>`).join('')}
      </div>
      <div class="row xs" style="gap:8px;padding:10px 12px;border-radius:10px;background:${C.warnSoft}">${icon('alert', 14)}<span style="flex:1"><b>Wednesday looks short.</b> You can still submit — add a note so your manager knows why.</span><span class="btn sm">Fill the gap</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[['ATL', '6h'], ['NOV', '1h 30m']].map(([k, h]) => `<div class="row" style="gap:8px;padding:8px 10px;border:1px solid ${C.border};border-radius:10px"><span style="width:8px;height:22px;border-radius:3px;background:${PJ[k].c}"></span><span class="xs" style="flex:1"><b>${PJ[k].n.split(' —')[0]}</b><div class="mut">${PJ[k].type}</div></span><b>${h}</b></div>`).join('')}</div>
      <div class="fld"><label>Note for your manager <span class="mut" style="font-weight:500">(optional)</span></label><div class="inp" style="color:${C.muted}">Wed afternoon: helped HR with interviews — logging under General</div></div>
      <div style="border-radius:12px;background:${C.raised};padding:10px 12px;display:flex;flex-direction:column;gap:8px"><div class="xs mut" style="font-weight:700">Goes to the lead on each project</div>
        ${[[2, 'Sameer Khan', 'your Atlas lead', 'ATL', '6h'], [5, 'Ravi Kumar', 'Nova PM — no lead set for you', 'NOV', '1h 30m']].map(([pi, n, r, k, h]) => `<div class="row" style="gap:10px">${photo(pi, 28, 28, { round: true })}<div style="flex:1"><b style="font-size:12.5px">${n}</b> <span class="xs mut">· ${r}</span></div><span class="xs" style="color:${PJ[k].c};font-weight:800">${k} · ${h}</span></div>`).join('')}
        <div class="xs mut">General time goes to your line manager · each lead sees only their project’s blocks</div></div>
    </div>
    <div class="row" style="gap:8px;padding:14px 20px;border-top:1px solid ${C.line};background:${C.raised}"><span class="xs mut" style="flex:1">${icon('lock', 12)} Approved days are locked</span><span class="btn">Cancel</span><span class="btn pri">${icon('send', 14)}Submit 2 days</span></div>
  </div>`;
  const track = `<div class="card" style="padding:16px;gap:12px"><b style="font-size:14px">What happens next</b>
    ${[[C.ok, '✓', 'Mon 5 approved', 'Sameer (Atlas) and Meena (Helios) · yesterday'], [C.warn, '◐', 'Tue 6 partly approved', 'Atlas ✓ Sameer · Helios waiting on Meena'], [C.info, '●', 'Wed 7 – Thu 8 waiting', 'Sent today 6:40 pm'], [C.bad, '↩', 'Last week: Thu 1 sent back', '“Please split the Helios time by task” — fixed &amp; resent'], [C.muted, '○', 'Fri 9', 'On leave — nothing to submit']].map(([c, m, t, s]) => `<div class="row" style="gap:10px;align-items:flex-start"><span style="width:24px;height:24px;border-radius:50%;background:${c}1a;color:${c};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;flex:none">${m}</span><div><b style="font-size:13px">${t}</b><div class="xs mut">${s}</div></div></div>`).join('')}
    <div style="border-top:1px solid ${C.line};padding-top:10px;display:flex;flex-direction:column;gap:6px"><b class="xs">Sent back? It comes with a note on the exact block</b>
      <div class="blk" style="position:relative;left:0;right:0;height:auto;background:#DB277714;border-color:#DB2777"><b style="color:#DB2777">Helios</b><span class="d">Schema mapping for ledger · 2h 30m</span></div>
      <div class="row xs" style="gap:8px;padding:8px 10px;border-radius:10px;background:${C.badSoft}">${photo(0, 22, 22, { round: true })}<span><b>Meena (Helios lead):</b> Split this — part of it was the Atlas tax bug?</span></div></div>
    <div class="row" style="gap:8px"><span class="btn sm">${icon('undo', 12)}Recall Wed–Thu</span><span class="xs mut">until someone acts on it</span></div>
  </div>`;
  const html = `<div class="app">${sidebar('Timesheets')}<div class="col">${header('Work &nbsp;›&nbsp; <b>Timesheets</b>')}<main class="main">
${top('Work', 'My timesheet', 'Press Submit whenever you like — Monday alone, then Tue–Fri together on Friday')}
<div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start">
  <div style="position:relative;border-radius:16px;overflow:hidden;background:rgba(17,24,39,.42);padding:30px;display:flex;justify-content:center">${modal}</div>
  ${track}
</div>
</main></div></div>`;
  return dcPage('Submit for approval', css, html, 1180);
}

// ─── Board 4: Manager approvals — team week ─────────────────
function approvals() {
  const ppl = [
    [1, 'Rahul Das', 'Developer · Atlas', [['approved', 8], ['approved', 7.5], ['submitted', 8.25], ['submitted', 8], ['submitted', 6], null, null], 'submitted'],
    [2, 'Aadhya Bose', 'QA · Atlas, Helios', [['submitted', 8], ['submitted', 8], ['submitted', 7.75], ['submitted', 8], ['submitted', 8], null, null], 'submitted'],
    [3, 'Karan Mehta', 'Developer · Nova', [['approved', 8], ['approved', 8], ['back', 4], ['draft', 6], ['leave', 0], null, null], 'back'],
    [4, 'Sara Khan', 'Designer · Helios', [['draft', 8], ['draft', 7], ['none', 0], ['none', 0], ['none', 0], null, null], 'none'],
    [5, 'Meena Joshi', 'Data engineer · Helios', [['approved', 8], ['approved', 8], ['approved', 8], ['approved', 8], ['approved', 8.5], null, null], 'approved'],
  ];
  const cellBg = { approved: [C.okSoft, C.ok], submitted: [C.infoSoft, C.info], draft: [C.raised, C.muted], back: [C.badSoft, C.bad], none: ['#fff', C.warn], leave: ['#F1EBFE', C.violet] };
  const grid = `<div class="card" style="padding:0;overflow:hidden">
    <div class="tg" style="background:${C.raised};font-weight:800;color:${C.muted};font-size:11px"><div>PERSON</div>${['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9', 'Sat', 'Sun'].map((d) => `<div style="text-align:center;font-size:11px">${d}</div>`).join('')}<div style="text-align:right">TOTAL</div><div></div></div>
    ${ppl.map(([pi, n, r, ds, s], k) => {
      const tot = ds.reduce((a, d) => a + (d ? d[1] : 0), 0);
      return `<div class="tg" style="${k === 0 ? `background:${C.priSoft}55` : ''}"><div class="row" style="gap:8px"><input type="checkbox" ${s === 'submitted' ? 'checked' : ''} style="accent-color:${C.pri}">${photo(pi, 30, 30, { round: true })}<div style="min-width:0"><b style="font-size:12.5px">${n}</b><div class="xs mut">${r}</div></div></div>
        ${ds.map((d) => !d ? `<div><div class="cell" style="color:${C.border}">·</div></div>` : `<div><div class="cell" style="background:${cellBg[d[0]][0]};color:${cellBg[d[0]][1]};${d[0] === 'none' ? `border:1.5px dashed ${C.warn}` : ''}">${d[0] === 'leave' ? '🌴' : d[0] === 'none' ? '—' : dur(0, d[1]).replace(' ', '')}</div></div>`).join('')}
        <div style="text-align:right"><b>${dur(0, tot)}</b><div class="xs mut">of 40h</div></div>
        <div style="text-align:right">${s === 'submitted' ? `<span class="btn sm pri">Approve</span>` : s === 'none' ? `<span class="btn sm">Nudge</span>` : st(s)}</div></div>
      ${k === 0 ? `<div style="padding:10px 16px 14px 56px;border-bottom:1px solid ${C.line};background:${C.priSoft}33;display:flex;flex-direction:column;gap:6px">
        <div class="row xs" style="gap:8px"><b>Wed 7 · 8h 15m</b><span class="mut">in office 9:20 – 6:05 (8h 45m)</span><span class="mut" style="margin-left:auto">Note: “Long UAT day”</span></div>
        ${[['ATL', '9:30–12:30', 'UAT run with Northwind — 3 defects logged', '3h'], ['ATL', '1:30–4:00', 'Fix tax rounding (ATL-219)', '2h 30m']].map(([p, t, d, h]) => `<div class="row xs" style="gap:10px;padding:6px 10px;background:#fff;border:1px solid ${C.line};border-left:4px solid ${PJ[p].c};border-radius:8px"><b style="width:52px;color:${PJ[p].c}">${p}</b><span class="mut" style="width:78px">${t}</span><span style="flex:1">${d}</span><b>${h}</b><span class="mut" title="Comment on this block">${icon('msg', 13)}</span></div>`).join('')}
        <div class="row xs mut" style="gap:10px;padding:6px 10px;border:1px dashed ${C.border};border-radius:8px">${icon('lock', 12)}<span style="flex:1">2h 45m on Helios and General — approved by Meena (Helios lead) and Priya (line manager)</span></div>
        <div class="row" style="gap:8px;margin-top:4px"><span class="btn sm pri">${icon('check2', 12)}Approve Atlas time Wed–Fri</span><span class="btn sm">Approve Wed only</span><span class="btn sm" style="color:${C.bad}">${icon('undo', 12)}Send back…</span></div></div>` : ''}`;
    }).join('')}
  </div>`;
  const html = `<div class="app">${sidebar('Timesheets')}<div class="col">${header('Work &nbsp;›&nbsp; Timesheets &nbsp;›&nbsp; <b>Approvals</b>')}<main class="main">
${top('Work', 'Team timesheets', 'Time people logged on projects you lead — open a day to see what they did, approve days or the week', `<span class="btn">${icon('dl', 14)}Export</span>`)}
<div class="kpi">${[['Waiting on you', '9 days', '2 people · oldest 2 days', C.info], ['Not logged yet', '1 person', 'Sara — Wed to Fri', C.warn], ['Sent back', '1 day', 'Karan · Wed 7', C.bad], ['Team this week', '186h', '78% billable · 22% investment', C.ok]].map(([l, v, sub, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${sub}</span></div>`).join('')}</div>
<div class="row" style="gap:8px"><span class="btn sm">‹</span><b>5 – 11 Oct</b><span class="btn sm">›</span><span class="chip on" style="margin-left:10px">Waiting on me · 2</span><span class="chip">Everyone · 5</span><span class="chip">Not logged · 1</span><span class="chip">Project ▾</span>
  <div class="row" style="gap:8px;margin-left:auto;padding:6px 8px 6px 14px;border-radius:12px;background:${C.fg};color:#fff;font-size:12.5px"><b>2 selected · 9 days</b><span class="btn sm pri">Approve all</span></div></div>
${grid}
<div class="row xs mut" style="gap:14px">${[['approved', 'Approved'], ['submitted', 'Waiting'], ['draft', 'Draft — not sent yet'], ['back', 'Sent back'], ['none', 'Nothing logged'], ['leave', 'On leave']].map(([k, l]) => `<span class="row" style="gap:5px"><span style="width:14px;height:12px;border-radius:3px;background:${cellBg[k][0]};border:1px solid ${cellBg[k][1]}55"></span>${l}</span>`).join('')}<span style="margin-left:auto">You approve the projects where you’re the person’s lead (or PM if no lead is set)</span></div>
</main></div></div>`;
  return dcPage('Team timesheets — approvals', css, html, 1240);
}

// ─── Board 5: Reports ───────────────────────────────────────
function reports() {
  const pj = [['Atlas — Billing revamp', '#4F46E5', 412, 18, 380], ['Helios data platform', '#DB2777', 276, 22, 300], ['Nova mobile app', '#0D9488', 0, 164, 160], ['Orion support desk', '#F59E0B', 96, 0, 120], ['General', '#64748B', 0, 118, null]];
  const max = 440;
  const html = `<div class="app">${sidebar('Timesheets')}<div class="col">${header('Work &nbsp;›&nbsp; Timesheets &nbsp;›&nbsp; <b>Report</b>')}<main class="main">
${top('Work', 'Time report', 'Where the time went — by project, by person, planned vs logged', `<span class="chip">September 2026 ▾</span><span class="btn">${icon('dl', 14)}Export CSV</span>`)}
<div class="kpi">${[['Logged', '1,102h', '44 people · 96% filled', C.ok], ['Billable', '784h · 71%', '↑ 4 pts vs August', C.ok], ['In office, not logged', '61h', '9 people · mostly Fridays', C.warn], ['Waiting approval', '38h', 'oldest from 21 Sep', C.info]].map(([l, v, sub, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${sub}</span></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:16px">
  <div class="card" style="padding:16px;gap:12px"><div class="row"><b style="flex:1">Hours by project</b><span class="xs mut">▮ billable ▮ investment &nbsp;|&nbsp; planned</span></div>
    ${pj.map(([n, c, b, i, plan]) => `<div style="display:grid;grid-template-columns:170px 1fr 90px;gap:10px;align-items:center"><span class="row xs" style="gap:6px"><span style="width:9px;height:9px;border-radius:3px;background:${c}"></span><b>${n.split(' —')[0]}</b></span>
      <div style="position:relative;height:18px;background:${C.raised};border-radius:6px"><div style="position:absolute;left:0;top:0;bottom:0;width:${(b / max) * 100}%;background:${c};border-radius:6px 0 0 6px"></div><div style="position:absolute;left:${(b / max) * 100}%;top:0;bottom:0;width:${(i / max) * 100}%;background:repeating-linear-gradient(135deg,${c}88 0 5px,${c}44 5px 10px);border-radius:0 6px 6px 0"></div>${plan ? `<b style="position:absolute;left:${(plan / max) * 100}%;top:-3px;bottom:-3px;width:2px;background:${C.fg}"></b>` : ''}</div>
      <span class="xs" style="text-align:right"><b>${b + i}h</b>${plan ? `<span class="mut"> / ${plan}h</span>` : ''}</span></div>`).join('')}
    <div class="xs mut">Planned = people’s allocation on the project × working days (from the resource planner)</div></div>
  <div class="card" style="padding:16px;gap:10px"><b>Planned vs logged — people</b>
    ${[[1, 'Rahul Das', 'Atlas 100%', 100, 96], [2, 'Aadhya Bose', 'Atlas 50 · Helios 50', 100, 104], [3, 'Karan Mehta', 'Nova 100%', 100, 71], [6, 'Divya Rao', 'bench', 0, 38], [4, 'Sara Khan', 'Helios 100%', 100, 55]].map(([pi, n, a, plan, done]) => `<div class="row" style="gap:10px">${photo(pi, 28, 28, { round: true })}<div style="width:140px"><b style="font-size:12.5px">${n}</b><div class="xs mut">${a}</div></div><div style="flex:1;position:relative;height:8px;border-radius:99px;background:${C.line}"><div style="position:absolute;left:0;top:0;bottom:0;width:${Math.min(done, 100)}%;border-radius:99px;background:${done < 80 ? C.warn : done > 100 ? C.bad : C.ok}"></div></div><b class="xs" style="width:44px;text-align:right">${done}%</b></div>`).join('')}
    <div class="xs mut">Logged hours as a share of working hours · Divya is on the bench but logging General time</div></div>
</div>
<div class="card" style="padding:0;overflow:hidden"><div class="row" style="padding:12px 16px;border-bottom:1px solid ${C.line}"><b style="flex:1">Entries</b><span class="search" style="height:32px;flex:0 0 240px;font-size:12.5px">${icon('search', 13)} Search descriptions</span><span class="chip" style="margin-left:8px">Person ▾</span><span class="chip">Project ▾</span><span class="chip">Billable ▾</span><span class="chip">Status ▾</span></div>
  ${[['30 Sep', 1, 'Rahul Das', 'ATL', 'Invoice export to PDF', '2h 30m', 'approved'], ['30 Sep', 2, 'Aadhya Bose', 'HEL', 'Regression pass on ledger import', '4h', 'approved'], ['29 Sep', 3, 'Karan Mehta', 'NOV', 'Push notification spike', '1h 30m', 'submitted'], ['29 Sep', 6, 'Divya Rao', 'GEN', 'Onboarding docs for interns', '3h', 'draft']].map(([d, pi, n, p, desc, h, s]) => `<div class="row" style="gap:12px;padding:9px 16px;border-bottom:1px solid ${C.line};font-size:12.5px"><span class="mut" style="width:48px">${d}</span>${photo(pi, 24, 24, { round: true })}<span style="width:110px">${n}</span><span style="width:60px;color:${PJ[p].c};font-weight:800">${p}</span><span style="flex:1">${desc}</span><b style="width:60px;text-align:right">${h}</b><span style="width:96px;text-align:right">${st(s)}</span></div>`).join('')}</div>
</main></div></div>`;
  return dcPage('Time report', css, html, 1180);
}

// ─── Board 6: Rules (admin) ─────────────────────────────────
function rules() {
  const opt = (on, t, s) => `<div class="opt ${on ? 'on' : ''}"><span class="rad"></span><div><b style="font-size:13px">${t}</b><div class="xs mut">${s}</div></div></div>`;
  const tg = (on, t, s) => `<div class="row" style="gap:12px;padding:10px 0;border-bottom:1px solid ${C.line}"><div style="flex:1"><b style="font-size:13px">${t}</b><div class="xs mut">${s}</div></div><span class="tgl ${on ? '' : 'off'}"></span></div>`;
  const html = `<div class="app">${sidebar('Timesheets')}<div class="col">${header('Settings &nbsp;›&nbsp; <b>Timesheet rules</b>')}<main class="main">
${top('Settings', 'Timesheet rules', 'How your company logs and approves time — HR / company admin')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
  <div class="card" style="padding:18px;gap:12px"><b style="font-size:15px">Submitting</b>
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:${C.raised}">
      ${[['Time ranges, always', '10:00 – 12:00 + project + what you did'], ['No overlapping blocks', 'A block can’t cross another one, even on a different project'], ['Submit whenever', 'Sends every logged day not sent yet, up to today — daily or weekly is each person’s choice']].map(([t, d]) => `<div class="row" style="gap:10px">${icon('check2', 14)}<div><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div></div>`).join('')}
    </div>
    ${tg(true, 'A description is required', 'At least a few words on every block')}
    ${tg(true, 'Warn when logged time doesn’t match attendance', 'Shows the gap when submitting — doesn’t block it')}
    ${tg(false, 'Block logging more than attendance', 'Can’t log 10h on a day you were in for 8h')}
    <div class="row" style="gap:12px;padding:10px 0"><div style="flex:1"><b style="font-size:13px">Lock unsubmitted time after</b><div class="xs mut">After this, only HR can open the period again</div></div><span class="inp" style="padding:6px 10px"><b>14 days</b> ▾</span></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:18px">
    <div class="card" style="padding:18px;gap:12px"><b style="font-size:15px">Approving</b>
      <div style="display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;background:${C.raised}">
        ${[['Project time', 'the person’s team lead on that project'], ['No lead set', 'the project’s PM'], ['General time', 'the line manager']].map(([a, b]) => `<div class="row xs" style="gap:8px"><b style="width:96px">${a}</b><span class="mut">→</span><span>${b}</span></div>`).join('')}
        <div class="xs mut">A day with two projects is “partly approved” until both leads have approved.</div>
      </div>
      ${tg(true, 'HR can approve on anyone’s behalf', 'Uses the existing approval delegation')}
    </div>
    <div class="card" style="padding:18px;gap:10px"><b style="font-size:15px">Reminders</b>
      ${[['Daily', '6:30 pm', 'if today has nothing logged and you checked in'], ['Weekly', 'Mon 10:00 am', 'for last week, if anything is unsubmitted'], ['Managers', 'Tue 10:00 am', 'when someone’s days have waited 2+ days']].map(([t, w, s]) => `<div class="row" style="gap:12px"><b style="width:76px;font-size:13px">${t}</b><span class="inp" style="padding:5px 10px;font-size:12.5px"><b>${w}</b></span><span class="xs mut" style="flex:1">${s}</span><span class="tgl"></span></div>`).join('')}
    </div>
    <div class="card" style="padding:14px 16px;gap:4px;background:${C.raised}"><b style="font-size:13px">Working day: 8h · Mon–Fri</b><span class="xs mut">From the attendance shift — used for “expected” hours. Leave and holidays count as nothing to log.</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Timesheet rules', css, html, 1000);
}

const boards = [
  ['CATimesheetWeek.dc.html', 'Timesheets · My week (Tempo-style) — calendar of work blocks per project, attendance line, timer, my projects, gaps to fill', myWeek, 1180],
  ['CATimesheetLog.dc.html', 'Timesheets · Log work — day view, drag a time range, pick one of my projects, describe the work; billable comes from the project', logWork, 1180],
  ['CATimesheetSubmit.dc.html', 'Timesheets · Submit — today or the rest of the week, checks against attendance, goes to my manager; sent-back notes on a block', submit, 1180],
  ['CATimesheetApprovals.dc.html', 'Timesheets · Team approvals — people × days grid, open a day to see blocks, approve days or week, send back with a note', approvals, 1240],
  ['CATimesheetReport.dc.html', 'Timesheets · Report — hours by project (billable/investment vs planned), planned vs logged per person, searchable entries', reports, 1180],
  ['CATimesheetRules.dc.html', 'Timesheets · Rules (HR/admin) — daily/weekly/either, times vs durations, attendance checks, who approves, reminders', rules, 1000],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: (i % 3) * 1520, y: 24200 + Math.floor(i / 3) * 1400 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n14 = { kind: 'title1', maxW: 4500, text: 'Company · Timesheets (Tempo-style) — my week, log work, submit, team approvals, report, rules', w: 240, x: 0, y: 23900 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
