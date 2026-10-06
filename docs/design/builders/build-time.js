// Company app → Time: my attendance, team attendance, attendance approvals, my leave (+ apply),
// leave approvals, who's off, holidays, attendance settings, leave types; animation ideas; who sees what.
// Sidebar and top bar stay exactly as in the app (the TIME group keeps its 9 items).
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { C } = require('./build-reports.js');
const { css: peopleCss, photo, PEOPLE } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

Object.assign(P, {
  check2: '<path d="M20 6 9 17l-5-5"/>',
  plus2: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  login2: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  logout2: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  coffee2: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>',
  paper: '<path d="M21.4 11.6 12.6 20.4a6 6 0 0 1-8.5-8.5l8.8-8.8a4 4 0 0 1 5.7 5.7l-8.8 8.8a2 2 0 0 1-2.8-2.8l8.1-8.1"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
});

// ─── Shell: the real sidebar (TIME group open on the current page) ─────────
const TIME = [
  ['calcheck', 'My attendance'], ['usersr', 'Team attendance'], ['check', 'Attendance approvals', 3], ['plane', 'My leave'],
  ['calclock', 'Leave approvals', 4], ['calrange', 'Who’s off'], ['caldays', 'Holidays'], ['clock', 'Attendance settings'], ['tags', 'Leave types'],
];
const sidebar = (on) => `<aside class="sb">
<div class="sb-h"><span class="logo">AP</span><span><b>aakash-portal</b><span>HR workspace</span></span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Home</div><div class="sb-i">${icon('idcard')}My profile</div><div class="sb-i">${icon('chart')}Reports &amp; analytics</div><div class="sb-i">${icon('contact')}People</div>
<div class="sb-g">ORGANIZATION ›</div><div class="sb-g">ENGAGEMENT ›</div><div class="sb-g">WORK ›</div><div class="sb-g">EXPENSES ›</div><div class="sb-g">ASSETS ›</div>
<div class="sb-g">TIME</div>${TIME.map(([ic, l, n]) => `<div class="sb-i${l === on ? ' on' : ''}">${icon(ic)}<span style="flex:1">${l}</span>${n ? `<span class="nb">${n}</span>` : ''}</div>`).join('')}
</aside>`;
const header = (crumb) => `<header class="hdr"><div class="crumb">Time &nbsp;›&nbsp; <b>${crumb}</b></div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Time</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const page = (on, crumb, body) => `<div class="app">${sidebar(on)}<div class="col">${header(crumb)}<main class="main">${body}</main></div></div>`;
const NEW = '<span class="new">New</span>';
const note = (items) => `<div class="card notes"><b class="xs" style="letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">What changes</b>${items.map(([k, t]) => `<div class="xs"><span class="${k === 'new' ? 'k-new' : k === 'q' ? 'k-q' : 'k-old'}">${k === 'new' ? 'New' : k === 'q' ? 'Ask' : 'Today'}</span>${t}</div>`).join('')}</div>`;

const css = peopleCss.replace('</style>', `
.sb-i .nb{font-size:10.5px;font-weight:800;background:${C.pri};color:#fff;border-radius:99px;padding:1px 7px}
.new{display:inline-flex;font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:99px;background:#DCFCE7;color:#166534;vertical-align:middle;margin-left:6px}
.notes{padding:12px 14px;display:flex;flex-direction:column;gap:6px;background:${C.raised}}
.k-new,.k-old,.k-q{display:inline-block;min-width:44px;font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-right:6px}
.k-new{color:#16A34A}.k-old{color:${C.muted}}.k-q{color:${C.warn}}
.xst{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}.tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};text-align:left;padding:8px 10px;background:${C.raised};border-bottom:1px solid ${C.border}}.tbl td{padding:9px 10px;border-bottom:1px solid ${C.line};vertical-align:middle}
.tgl{width:34px;height:20px;border-radius:99px;background:${C.pri};position:relative;flex:none;display:inline-block}.tgl:after{content:'';position:absolute;right:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}.tgl.off{background:#D1D5DB}.tgl.off:after{right:auto;left:3px}
.fld{display:flex;flex-direction:column;gap:5px}.fld label{font-size:12px;font-weight:700}.inp{border:1px solid ${C.border};border-radius:10px;padding:8px 11px;font-size:13px;background:#fff;display:flex;align-items:center;gap:8px}
.av{border-radius:50%;overflow:hidden;flex:none;display:inline-block}
.stack{display:flex}.stack .ph{border:2px solid #fff;margin-left:-8px}.stack .ph:first-child{margin-left:0}
.dot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex:none}
.ln{flex:1;height:2px;border-radius:2px;min-width:14px}
.step{display:flex;align-items:center;gap:6px;font-size:11px}
.sec2{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.muted}}
.num{font-size:24px;font-weight:800;letter-spacing:-.02em}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:5px;border:1px solid ${C.border};border-bottom-width:2px;font-size:10px;font-weight:800;color:#374151;background:#fff}

/* hours ruler (06:00–22:00) */
.rul{position:relative;height:22px}
.rul span{position:absolute;top:0;font-size:9.5px;color:${C.muted};font-weight:700;transform:translateX(-50%)}
.trk{position:relative;height:16px;border-radius:6px;background:${C.raised};border:1px solid ${C.line}}
.blk{position:absolute;top:2px;bottom:2px;border-radius:4px}
.shift{position:absolute;top:-4px;bottom:-4px;border-left:1.5px dashed ${C.pri}55;border-right:1.5px dashed ${C.pri}55;background:${C.pri}08}
.nowl{position:absolute;top:-6px;bottom:-6px;width:2px;background:${C.bad};border-radius:2px;animation:nowm 8s ease-in-out infinite alternate}
.nowl:before{content:'';position:absolute;top:-4px;left:-3px;width:8px;height:8px;border-radius:50%;background:${C.bad}}
@keyframes nowm{to{transform:translateX(6px)}}

/* motion */
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}}
.stg>*{animation:pop .5s cubic-bezier(.2,.8,.2,1) both}
.stg>*:nth-child(2){animation-delay:.05s}.stg>*:nth-child(3){animation-delay:.1s}.stg>*:nth-child(4){animation-delay:.15s}.stg>*:nth-child(5){animation-delay:.2s}.stg>*:nth-child(6){animation-delay:.25s}.stg>*:nth-child(7){animation-delay:.3s}.stg>*:nth-child(n+8){animation-delay:.35s}
@keyframes ringd{from{stroke-dashoffset:var(--c)}}
.ring circle.v{animation:ringd 1.4s cubic-bezier(.2,.8,.2,1) both}
@keyframes pulse{0%{box-shadow:0 0 0 0 ${C.ok}66}100%{box-shadow:0 0 0 14px ${C.ok}00}}
.live{width:9px;height:9px;border-radius:50%;background:${C.ok};display:inline-block;animation:pulse 1.8s ease-out infinite}
@keyframes grow{from{transform:scaleY(0)}}
.hb{transform-origin:bottom;animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes wbar{from{transform:scaleX(0)}}
.wb{transform-origin:left;animation:wbar 1s cubic-bezier(.2,.8,.2,1) both}
</style>`);

const pct = (h) => `${(((h - 6) / 16) * 100).toFixed(2)}%`; // 06:00–22:00 on a track
const ruler = () => `<div class="rul">${[6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => `<span style="left:${pct(h)}">${String(h).padStart(2, '0')}</span>`).join('')}</div>`;
const track = (blocks, { shift = true, now = null, h = 16 } = {}) => `<div class="trk" style="height:${h}px">${shift ? `<i class="shift" style="left:${pct(9.5)};width:calc(${pct(18.5)} - ${pct(9.5)})"></i>` : ''}${blocks.map(([a, b, col, op = 1]) => `<i class="blk wb" style="left:${pct(a)};width:calc(${pct(b)} - ${pct(a)});background:${col};opacity:${op}"></i>`).join('')}${now ? `<i class="nowl" style="left:${pct(now)}"></i>` : ''}</div>`;
const ring = (val, max, col, size = 64, stroke = 7, label = '', sub = '') => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, len = (val / max) * c;
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-block;flex:none"><svg class="ring" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${C.line}" stroke-width="${stroke}"/><circle class="v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${len} ${c}" style="--c:${len}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:${Math.round(size / 4.2)}px;line-height:1">${label}${sub ? `<span style="font-size:9.5px;color:${C.muted};font-weight:700;margin-top:2px">${sub}</span>` : ''}</b></span>`;
};
const av = (i, s = 30) => photo(i, s, s, { round: true, long: PEOPLE[i % PEOPLE.length][5] });
const nm = (i) => PEOPLE[i % PEOPLE.length][0];
const first = (i) => nm(i).split(' ')[0];
const stepper = (steps) =>
  `<div class="row" style="gap:4px;align-items:center">${steps
    .map(([l, who, s], i) => {
      const c = s === 'ok' ? C.ok : s === 'now' ? C.info : s === 'back' ? C.bad : C.border;
      const dot = `<span class="dot" style="background:${s === 'todo' ? '#fff' : `${c}1f`};color:${c};border:2px solid ${c}">${s === 'ok' ? '✓' : s === 'now' ? '●' : s === 'back' ? '!' : i + 1}</span>`;
      return `${i ? `<span class="ln" style="background:${steps[i - 1][2] === 'ok' ? C.ok : C.line}"></span>` : ''}<span class="step">${dot}<span><b style="display:block">${l}</b><span class="s">${who}</span></span></span>`;
    })
    .join('')}</div>`;
const ST = {
  P: ['Present', C.ok, C.okSoft], L: ['Late', C.warn, C.warnSoft], H: ['Half day', '#CA8A04', '#FEF9C3'], A: ['Absent', C.bad, C.badSoft], M: ['Missing check-out', C.violet, '#F1EBFE'],
  V: ['On leave', C.pink, '#FCE7F3'], W: ['Work from home', C.info, C.infoSoft], O: ['Weekend', '#9CA3AF', C.raised], X: ['Holiday', C.teal, '#E6F6F4'], N: ['Not in yet', '#9CA3AF', '#fff'], F: ['', '#D1D5DB', '#fff'],
};
const st = (k, txt) => `<span class="xst" style="background:${ST[k][2]};color:${ST[k][1]};${k === 'N' ? `border:1px solid ${C.border}` : ''}">${txt ?? ST[k][0]}</span>`;

// October 2026 starts on a Thursday. Today = Mon 5 Oct.
const OCT = (() => {
  const pattern = { 1: ['P', 9.4, 18.6], 2: ['X'], 3: ['O'], 4: ['O'], 5: ['P', 9.3, null] };
  return Array.from({ length: 31 }, (_, i) => {
    const d = i + 1, wd = (4 + i) % 7;
    if (pattern[d]) return [d, ...pattern[d]];
    if (wd === 0 || wd === 6) return [d, 'O'];
    return [d, 'F'];
  });
})();
const SEPT = [
  [1, 'P', 9.4, 18.7], [2, 'P', 9.5, 18.9], [3, 'L', 10.2, 19.1], [4, 'P', 9.3, 18.5], [7, 'P', 9.6, 18.8], [8, 'W', 9.5, 18.2], [9, 'P', 9.4, 19.3], [10, 'H', 9.5, 14.0], [11, 'P', 9.2, 18.4],
  [14, 'L', 10.0, 19.0], [15, 'P', 9.4, 18.6], [16, 'P', 9.5, 18.7], [17, 'M', 9.4, null], [18, 'V'], [21, 'P', 9.3, 18.9], [22, 'P', 9.4, 18.8], [23, 'W', 9.8, 18.3], [24, 'P', 9.5, 19.4], [25, 'L', 10.1, 18.9],
  [28, 'P', 9.4, 18.5], [29, 'P', 9.3, 18.7], [30, 'P', 9.5, 18.6],
];

// ─── 1 · My attendance ──────────────────────────────────────
function myAttendance() {
  // September (complete month) as the calendar example; weekday of 1 Sep 2026 = Tuesday
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = i + 1, wd = (2 + i) % 7;
    const rec = SEPT.find((s) => s[0] === d);
    if (rec) return rec;
    return wd === 0 || wd === 6 ? [d, 'O'] : [d, 'P', 9.5, 18.5];
  });
  const cell = ([d, k, a, b]) => {
    const [label, col, soft] = ST[k];
    const worked = a && b ? b - a : 0;
    const bar = a ? `<div style="height:5px;border-radius:3px;background:${C.line};overflow:hidden;margin-top:auto"><i class="wb" style="display:block;height:100%;width:${Math.min(100, (worked / 9) * 100)}%;background:${col}"></i></div>` : '';
    return `<div class="dc${d === 17 ? ' sel' : ''}" style="background:${k === 'O' ? C.raised : '#fff'}"><div class="row" style="gap:4px"><b style="font-size:11.5px">${d}</b>${k !== 'P' && k !== 'O' ? `<i class="sdot" style="background:${col}" title="${label}"></i>` : ''}<span style="margin-left:auto;font-size:9.5px;color:${C.muted};font-weight:700">${a && b ? `${worked.toFixed(1)}h` : k === 'V' ? 'Leave' : k === 'M' ? '?' : ''}</span></div>${bar}</div>`;
  };
  const sessions = [[9.4, 13.1, C.ok], [13.9, 18.2, C.ok]];
  const html = page('My attendance', 'My attendance', `
${top('My attendance', 'Check in, see your month and fix missed punches.', `<span class="btn">${icon('dl', 14)}My month (PDF)</span>`)}
<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:16px">
  <div class="card hero">
    <div class="row" style="gap:16px;align-items:flex-start">
      ${ring(4.2, 9, '#FDE68A', 118, 10, '4h 12m', 'of 9h')}
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <div class="row xs" style="gap:6px;color:#C7D2FE"><span class="live"></span>Checked in at 09:18 · Mon 5 Oct · Shift 09:30–18:30</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:-.02em">13:30<span style="font-size:15px;opacity:.6">:42</span></div>
        <div class="xs" style="color:#C7D2FE">On time ✓ &nbsp;·&nbsp; 1 break (12 min) &nbsp;·&nbsp; expected out ~18:40</div>
        <div class="row" style="gap:8px;margin-top:6px"><span class="btn sm" style="background:#fff;color:${C.fg}">${icon('coffee2', 13)}Take a break</span><span class="btn sm" style="background:#ffffff1f;border-color:#ffffff33;color:#fff">${icon('logout2', 13)}Check out</span></div>
      </div>
    </div>
    <div style="margin-top:14px">${ruler().replace(/color:[^;]+;/g, 'color:#A5B4FC;')}${track([[9.3, 12.9, '#A5B4FC'], [13.1, 13.5, '#FDE68A']], { now: 13.5, h: 18 }).replace(`background:${C.raised}`, 'background:#ffffff14').replace(`border:1px solid ${C.line}`, 'border:1px solid #ffffff22')}</div>
    <div class="xs" style="color:#A5B4FC;margin-top:6px">${NEW.replace('New', 'Day line')} Your day on a 06–22 line: worked sessions, break, shift (dashed) and “now”.</div>
  </div>
  <div class="card sec2">
    <div class="row"><b style="font-size:14px;flex:1">This month so far</b><span class="seg"><span>Week</span><span class="on">Month</span><span>Year</span></span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" class="stg">
      ${[['On time', '18/20', C.ok, 'days'], ['Avg in', '09:26', C.pri, '4 min before'], ['Avg hours', '8h 41m', C.teal, '/ day']].map(([l, v, col, s]) => `<div style="padding:10px;border-radius:12px;background:${C.raised}"><div class="lbl">${l}</div><div class="num" style="color:${col}">${v}</div><div class="xs mut">${s}</div></div>`).join('')}
    </div>
    <div class="lbl">Hours per day · September</div>
    <div class="row" style="align-items:flex-end;gap:3px;height:70px">${SEPT.map(([d, k, a, b]) => { const w = a && b ? b - a : k === 'V' ? 0 : 1; const col = ST[k][1]; return `<i class="hb" style="flex:1;height:${Math.max(6, (w / 10) * 100)}%;border-radius:3px 3px 0 0;background:${col};opacity:${k === 'V' ? 0.3 : 0.85};animation-delay:${(d * 0.02).toFixed(2)}s"></i>`; }).join('')}</div>
    <div class="row xs" style="gap:8px;flex-wrap:wrap">${['P', 'L', 'H', 'M', 'W', 'V'].map((k) => `<span class="row" style="gap:4px"><i class="sdot" style="background:${ST[k][1]}"></i>${ST[k][0]}</span>`).join('')}</div>
  </div>
</div>
<div class="row" style="gap:10px;padding:12px 16px;border-radius:14px;background:#F1EBFE">${icon('alert', 16)}<span style="flex:1;font-size:13px"><b>You missed a check-out on Thu 17 Sep.</b> Tell us when you left and your approver will fix it.</span><span class="btn sm">Not now</span><span class="btn sm pri">${icon('edit', 12)}Fix it — left at…</span></div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:16px;align-items:start">
  <div class="card sec2">
    <div class="row"><b style="font-size:14px">September 2026</b><span class="mut xs" style="margin-left:6px">‹ ›</span><span style="flex:1"></span><span class="seg"><span class="on">Calendar</span><span>List</span></span></div>
    <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="lbl" style="text-align:center">${d}</div>`).join('')}<div></div>${days.map(cell).join('')}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">Thu 17 Sep</b>${st('M')}</div>
      ${ruler()}${track([[9.4, 13.2, C.ok], [13.9, 22, C.violet, 0.25]])}
      <div class="xs mut">Checked in 09:24 · no check-out recorded</div>
      <div class="fld"><label>When did you leave?</label><div class="row" style="gap:6px"><span class="inp" style="flex:1">18:40</span><span class="chip">Usual time</span></div></div>
      <div class="fld"><label>Why</label><span class="inp">Forgot to check out — left after the client call</span></div>
      <div class="row xs mut" style="gap:6px">Goes to ${av(0, 18)} <b>Priya</b> (your lead) · no monthly limit</div>
      <span class="btn pri sm" style="align-self:flex-end">Send request</span></div>
    <div class="card sec2"><b style="font-size:13.5px">My correction requests</b>
      ${[['Mon 14 Sep', '10:00 → 09:35', 'ok', 'Approved by Priya'], ['Thu 17 Sep', 'add check-out 18:40', 'now', 'With Priya · 2 h ago']].map(([d, t, s, w]) => `<div class="row xs" style="gap:8px"><span class="dot" style="background:${s === 'ok' ? C.okSoft : C.infoSoft};color:${s === 'ok' ? C.ok : C.info};border:2px solid ${s === 'ok' ? C.ok : C.info}">${s === 'ok' ? '✓' : '●'}</span><span style="flex:1"><b>${d}</b> · ${t}<div class="mut">${w}</div></span></div>`).join('')}</div>
    ${note([['old', 'Check-in card, month calendar, day details, correction requests, 4 totals'], ['new', 'Live ring + day line (sessions, breaks, shift, now)'], ['new', 'Hours bar on every day, month insights (on-time, avg in, avg hours)'], ['new', 'Missed check-out banner → fix in one step'], ['new', 'Week / Month / Year and List views; my month as PDF'], ['new', 'No limit on corrections — over 8 in a month shows an insight to lead / manager / HR']])}
  </div>
</div>`);
  return dcPage('My attendance', css + `<style>
.hero{padding:18px 20px;background:linear-gradient(135deg,#1E1B4B,#312E81 60%,#4338CA);color:#fff;border:0;position:relative;overflow:hidden}
.hero .trk{background:#ffffff14;border-color:#ffffff22}.hero .shift{border-color:#ffffff55;background:#ffffff0d}
.hero:after{content:'';position:absolute;right:-60px;top:-80px;width:260px;height:260px;border-radius:50%;background:radial-gradient(closest-side,#818CF855,transparent)}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.dc{height:62px;border:1px solid ${C.line};border-radius:10px;padding:6px 7px;display:flex;flex-direction:column;animation:pop .45s cubic-bezier(.2,.8,.2,1) both}
.dc.sel{border-color:${C.violet};box-shadow:0 0 0 3px ${C.violet}22}
.sdot{width:7px;height:7px;border-radius:50%;display:inline-block}
${Array.from({ length: 31 }, (_, i) => `.cal .dc:nth-of-type(${i + 9}){animation-delay:${(i * 0.018).toFixed(3)}s}`).join('')}
</style>`, html, 1400);
}

// ─── 2 · Team attendance ────────────────────────────────────
function teamAttendance() {
  const rows = [
    [0, 'P', [[9.3, 13.0], [13.6, 13.6]], '09:18', '—', 'In office'],
    [4, 'L', [[10.2, 13.6]], '10:12', '—', 'Late 27m'],
    [1, 'W', [[9.5, 13.6]], '09:31', '—', 'WFH'],
    [9, 'P', [[8.9, 12.4], [12.9, 13.6]], '08:54', '—', 'In office'],
    [7, 'W', [[9.9, 13.6]], '09:55', '—', 'WFH'],
    [3, 'V', [], '—', '—', 'Casual leave'],
    [6, 'N', [], '—', '—', 'Not in yet'],
    [11, 'M', [[9.4, 13.6]], '09:24', '—', 'Missed check-out'],
  ];
  const html = page('Team attendance', 'Team attendance', `
${top('Team attendance', 'Your team · Monday 5 Oct · live', `<span class="btn">${icon('bell', 14)}Nudge 2 not in yet</span><span class="btn">${icon('dl', 14)}Export Oct</span>`)}
<div class="row" style="gap:12px">
  <div class="tabs"><span class="on">${icon('activity', 14)}Today ${NEW}</span><span>${icon('grid', 14)}Month grid ${NEW}</span><span>${icon('list', 14)}List</span></div>
  <span style="flex:1"></span><span class="chip">‹ Mon 5 Oct ›</span><span class="chip">${icon('network', 13)}Engineering ▾</span><span class="chip">${icon('search', 13)}Search</span>
</div>
<div class="presence stg">
  ${[['In office', 9, C.ok, [0, 9, 2]], ['Work from home', 4, C.info, [1, 7]], ['Late', 2, C.warn, [4]], ['On leave', 2, C.pink, [3, 10]], ['Not in yet', 3, '#9CA3AF', [6, 5, 8]]].map(([l, n, col, ppl]) => `<div class="pz" style="border-top:3px solid ${col}"><div class="row"><span class="lbl" style="flex:1">${l}</span><b class="num" style="font-size:22px;color:${col}">${n}</b></div><div class="stack">${ppl.map((i) => av(i, 26)).join('')}${n > ppl.length ? `<span class="more">+${n - ppl.length}</span>` : ''}</div></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start">
  <div class="card" style="padding:14px 16px">
    <div class="row" style="margin-bottom:6px"><b style="font-size:14px;flex:1">Today’s timeline</b><span class="xs mut row" style="gap:6px"><span class="live"></span>Updates live · now 13:36</span></div>
    <div style="display:grid;grid-template-columns:190px 1fr 92px;gap:8px 12px;align-items:center">
      <span></span>${ruler()}<span></span>
      ${rows.map(([i, k, blocks, inT, , lab]) => `<div class="row" style="gap:8px">${av(i, 28)}<span style="min-width:0"><b style="font-size:12.5px;display:block">${nm(i)}</b><span class="xs mut">${PEOPLE[i][1]}</span></span></div>${track(blocks.map(([a, b]) => [a, b, ST[k][1]]), { now: 13.6 })}<span>${st(k, lab)}</span>`).join('')}
    </div>
    <div class="xs mut" style="margin-top:10px">Bars grow as people work · dashed = shift · red line = now. Click a person → their month.</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><b style="font-size:13.5px">Needs your attention ${NEW}</b>
      ${[['M', '3 missing check-outs yesterday', 'Remind them to fix it'], ['A', '1 absent without leave (Fri)', 'Ask Ananya'], ['L', 'Neha late 3 times this week', 'See her week'], ['M', 'Karan: 9 corrections this month (over 8)', 'See his month']].map(([k, t, a]) => `<div class="row xs" style="gap:8px;align-items:flex-start"><i class="sdot" style="margin-top:4px;background:${ST[k][1]}"></i><span style="flex:1"><b>${t}</b><div style="color:${C.pri};font-weight:700">${a} →</div></span></div>`).join('')}</div>
    <div class="card sec2"><b style="font-size:13.5px">This week · on time</b>
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<div class="row xs" style="gap:8px"><span style="width:28px" class="mut">${d}</span><div class="bar" style="flex:1;height:8px"><i class="wb" style="width:${[86, 0, 0, 0, 0][i] || 4}%;background:${i ? C.line : C.ok}"></i></div><b style="width:34px;text-align:right">${i ? '—' : '86%'}</b></div>`).join('')}</div>
    ${note([['old', 'Day table with status chips, search, department, export, edit a day'], ['new', 'Presence strip (who’s where right now) with faces'], ['new', 'Live day timeline (Gantt) with “now” line'], ['new', 'Month grid: people × days heatmap'], ['new', 'Needs attention + nudge (in-app reminder only)'], ['new', 'Team leads, managers and HR can nudge']])}
  </div>
</div>
<div class="card" style="padding:14px 16px">
  <div class="row" style="margin-bottom:8px"><b style="font-size:14px;flex:1">Month grid · October ${NEW}</b><span class="xs mut">Each square = one day · hover for in/out</span></div>
  <div style="display:grid;grid-template-columns:150px repeat(31,1fr);gap:3px;align-items:center">
    <span></span>${Array.from({ length: 31 }, (_, d) => `<span style="font-size:9px;text-align:center;color:${C.muted};font-weight:700">${d + 1}</span>`).join('')}
    ${[0, 4, 1, 9, 7, 3].map((i, r) => `<span class="row xs" style="gap:6px">${av(i, 20)}<b>${nm(i)}</b></span>${OCT.map(([d, k]) => { const kk = k === 'F' ? 'F' : k === 'P' && r === 1 && d === 1 ? 'L' : r === 4 && d === 1 ? 'W' : r === 5 && d === 1 ? 'V' : k; return `<i class="sq" style="background:${kk === 'F' ? '#fff' : kk === 'O' ? C.raised : ST[kk][1]};${kk === 'F' ? `border:1px dashed ${C.border}` : ''};opacity:${kk === 'O' ? 1 : 0.85};animation-delay:${(d * 0.015 + r * 0.04).toFixed(3)}s"></i>`; }).join('')}`).join('')}
  </div>
</div>`);
  return dcPage('Team attendance', css + `<style>
.presence{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.pz{background:#fff;border:1px solid ${C.border};border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.more{width:26px;height:26px;border-radius:50%;background:${C.raised};border:2px solid #fff;margin-left:-8px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;color:${C.muted}}
.sdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.sq{display:block;aspect-ratio:1;border-radius:3px;animation:pop .4s ease both}
.bar{border-radius:99px;background:${C.line};overflow:hidden}.bar i{display:block;height:100%;border-radius:99px}
</style>`, html, 1300);
}

// ─── 3 · Attendance approvals ───────────────────────────────
function attApprovals() {
  const items = [
    [4, 'Thu 1 Oct', [[10.2, 18.9]], [[9.5, 18.9]], 'Badge reader was down; I came at 09:30 with Priya', '2 h ago', '2 this month', 'Line manager'],
    [11, 'Fri 2 Oct', [[9.4, 9.4]], [[9.4, 18.6]], 'Forgot to check out after the release', '5 h ago', '1 this month', 'Team lead · Atlas'],
    [1, 'Wed 30 Sep', [], [[9.5, 18.5]], 'Worked from client site in Whitefield, no laptop', 'Yesterday', '9 this month · over 8', 'Team lead · Atlas'],
  ];
  const html = page('Attendance approvals', 'Attendance approvals', `
${top('Attendance approvals', 'Correction requests from people you approve for. Approved times replace what is on record.', `<span class="btn">${icon('kbd', 14)}Shortcuts</span>`)}
<div class="row" style="gap:12px"><div class="tabs"><span class="on">Pending <b style="margin-left:4px">3</b></span><span>Approved</span><span>Rejected</span></div><span style="flex:1"></span><span class="chip on">${icon('check2', 13)}Select all</span><span class="btn sm pri">${icon('check2', 12)}Approve 3 selected ${NEW}</span></div>
<div style="display:grid;grid-template-columns:1fr 310px;gap:16px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px" class="stg">
    ${items.map(([i, d, cur, req, why, when, used, role], n) => `<div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;${n === 0 ? `box-shadow:0 0 0 2px ${C.pri}33` : ''}">
      <div class="row" style="gap:10px"><span class="cb${n < 3 ? ' on' : ''}"></span>${av(i, 34)}<span style="flex:1"><b>${nm(i)}</b> <span class="mut xs">· ${d} · asked ${when}</span><div class="xs mut">You approve as: ${role}</div></span><span class="xst" style="background:${n === 2 ? C.warnSoft : C.raised};color:${n === 2 ? C.warn : C.muted}">${used}</span></div>
      <div style="display:grid;grid-template-columns:80px 1fr;gap:4px 10px;align-items:center">
        <span></span>${ruler()}
        <span class="xs mut">On record</span>${track(cur.map(([a, b]) => [a, b === a ? a + 0.12 : b, '#9CA3AF']))}
        <span class="xs" style="font-weight:800;color:${C.pri}">Asked for</span>${track(req.map(([a, b]) => [a, b, C.pri]))}
      </div>
      <div class="row" style="gap:10px"><span class="xs" style="flex:1">“${why}”</span>
      <span class="btn sm">${icon('x', 12)}Reject</span><span class="btn sm pri">${icon('check2', 12)}Approve</span></div></div>`).join('')}
    <div class="xs mut row" style="gap:6px">Keyboard: <span class="kbd">J</span><span class="kbd">K</span> move · <span class="kbd">A</span> approve · <span class="kbd">R</span> reject · approved cards swipe away</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><div class="row" style="gap:8px">${av(4, 30)}<b style="flex:1">${nm(4)} · last 30 days</b></div>
      <div class="heat" style="grid-template-columns:repeat(10,1fr)">${SEPT.concat([[1, 'L'], [2, 'P']]).slice(0, 30).map(([, k]) => `<i style="background:${ST[k][1]};opacity:.85"></i>`).join('')}</div>
      <div class="xs mut">Late 3× · 1 missing check-out · 2 corrections. Helps you judge the request. ${NEW}</div></div>
    <div class="card sec2"><b style="font-size:13.5px">Waiting the longest</b><div class="xs">${st('A', '2 days')} Karan’s request for Wed 30 Sep — reminder sent to you this morning</div></div>
    ${note([['old', 'Pending / Approved / Rejected tabs, approve, reject with note, swipe away, delegation banner'], ['new', 'Before → after shown on a time line (not just numbers)'], ['new', 'Select many → approve together'], ['new', 'Person’s last 30 days next to the request'], ['new', 'Corrections this month — flagged when over 8; “waiting longest”'], ['new', 'Keyboard shortcuts']])}
  </div>
</div>`);
  return dcPage('Attendance approvals', css + `<style>
.cb{width:16px;height:16px;border-radius:5px;border:1.5px solid ${C.border};flex:none}.cb.on{background:${C.pri};border-color:${C.pri};box-shadow:inset 0 0 0 3px #fff}
.heat i{aspect-ratio:1;border-radius:3px;display:block}
</style>`, html, 1180);
}

// ─── 4 · My leave ───────────────────────────────────────────
function myLeave() {
  const bal = [['Casual leave', 'CL', 7.5, 12, C.pri, '1 credited on 1 Nov'], ['Sick leave', 'SL', 9, 10, C.teal, ''], ['Earned leave', 'EL', 15, 18, C.warn, '5 lapse on 31 Dec ⚠'], ['Work from home', 'WFH', 6, 0, C.info, 'No limit · used 6']];
  const html = page('My leave', 'My leave', `
${top('My leave', 'Balances, plans and requests.', `<span class="btn">${icon('caldays', 14)}Holidays</span><span class="btn pri">${icon('plane', 14)}Apply for leave</span>`)}
<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px">
  <div class="card trip">
    <div class="row" style="gap:16px">
      <div style="flex:1"><div class="lbl" style="color:#FDE68A">Next time off</div><div style="font-size:24px;font-weight:800;margin-top:2px">Diwali trip · 9–13 Nov</div><div class="xs" style="opacity:.85;margin-top:2px">Earned leave · 3 working days + Diwali holiday + weekend = <b>5 days away</b></div>
      <div class="row" style="gap:8px;margin-top:10px">${stepper([['Applied', '2 Oct', 'ok'], ['Priya', 'approved', 'ok'], ['Ravi', 'now', 'now']]).replace(/color:#[0-9A-F]{6}/gi, (m) => m)}</div></div>
      <div class="cd"><b>34</b><span>days to go</span></div>
    </div>
    <svg class="plane" width="70" height="40" viewBox="0 0 70 40"><path d="M2 22 L40 18 L58 4 L64 6 L52 20 L68 22 L64 26 L52 24 L58 36 L52 38 L40 26 L2 24 Z" fill="#fff" opacity=".9"/></svg>
  </div>
  <div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">Plan a break ${NEW}</b><span class="xs mut">long weekends coming up</span></div>
    ${[['Fri 23 Oct', 'Take 1 day → 3-day weekend', 'Dussehra is Thu 22'], ['Mon 9 Nov', 'Take 3 days → 9 days off', 'Diwali Tue 10 + weekends'], ['Thu 24 Dec', 'Take 1 day → 4-day weekend', 'Christmas Fri 25']].map(([d, t, w]) => `<div class="row xs" style="gap:10px;padding:8px 10px;border-radius:10px;background:${C.raised}"><span style="font-size:18px">🗓️</span><span style="flex:1"><b>${t}</b><div class="mut">${d} · ${w}</div></span><span class="btn sm">Plan</span></div>`).join('')}</div>
</div>
<div class="row"><b style="font-size:15px;flex:1">Balances · 2026</b><span class="chip">‹ 2026 ›</span></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" class="stg">
  ${bal.map(([n, code, left, tot, col, hint]) => `<div class="card sec2" style="flex-direction:row;align-items:center;gap:12px">${tot ? ring(left, tot, col, 66, 8, String(left), `of ${tot}`) : ring(1, 1, col + '55', 66, 8, '∞', '')}<span style="flex:1;min-width:0"><b style="font-size:13.5px">${n}</b><div class="xs mut">${code}${tot ? ` · ${tot - left} used` : ''}</div>${hint ? `<div class="xs" style="font-weight:700;color:${hint.includes('⚠') ? C.warn : C.muted}">${hint}</div>` : ''}</span></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:16px;align-items:start">
  <div class="card sec2">
    <div class="row"><b style="font-size:14px;flex:1">My year</b><span class="seg"><span class="on">Year</span><span>Requests</span></span></div>
    <div class="year">${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, mi) => `<div><div class="lbl" style="text-align:center">${m}</div><div class="mg">${Array.from({ length: 31 }, (_, d) => { const key = `${mi}-${d}`; const lv = { '2-11': C.teal, '2-12': C.teal, '4-4': C.pri, '4-5': C.pri, '4-6': C.pri, '4-7': C.pri, '4-8': C.pri, '7-14': C.pri, '8-17': C.info, '8-22': C.info, '10-8': C.warn, '10-9': C.warn, '10-10': C.warn, '11-23': C.warn }[key]; const hol = ['0-25', '7-14', '9-1', '10-9', '11-24'].includes(key); return `<i style="background:${lv || (hol ? '#99F6E4' : C.line)};${lv && mi >= 9 ? 'outline:1.5px dashed ' + lv + ';background:' + lv + '55' : ''}"></i>`; }).join('')}</div></div>`).join('')}</div>
    <div class="row xs" style="gap:12px">${[['Casual', C.pri], ['Sick', C.teal], ['Earned', C.warn], ['WFH', C.info], ['Holiday', '#99F6E4']].map(([l, c]) => `<span class="row" style="gap:4px"><i style="width:9px;height:9px;border-radius:3px;background:${c}"></i>${l}</span>`).join('')}<span class="mut">dashed = planned / pending</span></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><b style="font-size:13.5px">Requests</b>
      ${[['Earned leave', '9–11 Nov · 3 days', 'now', 'With Ravi (level 2)'], ['Sick leave', '12–13 Mar · 2 days', 'ok', 'Approved by Priya'], ['Casual leave', '23 Dec · 1 day', 'todo', 'Draft — not sent']].map(([t, d, s, w]) => `<div class="row xs" style="gap:8px"><span class="dot" style="background:${s === 'ok' ? C.okSoft : s === 'now' ? C.infoSoft : '#fff'};color:${s === 'ok' ? C.ok : s === 'now' ? C.info : C.muted};border:2px solid ${s === 'ok' ? C.ok : s === 'now' ? C.info : C.border}">${s === 'ok' ? '✓' : s === 'now' ? '●' : '…'}</span><span style="flex:1"><b>${t}</b> · ${d}<div class="mut">${w}</div></span></div>`).join('')}</div>
    ${note([['old', 'Balance cards, year switch, requests list with status tabs, cancel, apply dialog'], ['new', 'Next trip hero with countdown + approval steps'], ['new', 'Balance rings; credits coming; days that will lapse'], ['new', 'Plan a break: long weekends from the holiday list'], ['new', 'My year: 12-month view of leave + holidays'], ['new', 'Drafts (save a request without sending)']])}
  </div>
</div>`);
  return dcPage('My leave', css + `<style>
.trip{padding:18px 20px;background:linear-gradient(120deg,#0F766E,#0E7490 55%,#1D4ED8);color:#fff;border:0;position:relative;overflow:hidden}
.trip .step b,.trip .step .s{color:#fff}.trip .step .s{opacity:.75}
.cd{width:92px;height:92px;border-radius:20px;background:#ffffff22;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
.cd b{font-size:34px;line-height:1}.cd span{font-size:10.5px;opacity:.85;font-weight:700}
.plane{position:absolute;right:120px;top:10px;animation:fly 9s ease-in-out infinite}
@keyframes fly{0%{transform:translate(-40px,20px) rotate(-8deg);opacity:0}15%{opacity:1}60%{transform:translate(60px,-6px) rotate(-14deg);opacity:1}100%{transform:translate(160px,-30px) rotate(-18deg);opacity:0}}
.year{display:grid;grid-template-columns:repeat(12,1fr);gap:8px}
.mg{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;margin-top:4px}.mg i{display:block;aspect-ratio:1;border-radius:2px}
</style>`, html, 1180);
}

// ─── 5 · Apply for leave (dialog) ───────────────────────────
function applyLeave() {
  const types = [['Casual', 7.5, C.pri, true], ['Sick', 9, C.teal, false], ['Earned', 15, C.warn, false], ['Work from home', '∞', C.info, false], ['Unpaid', '∞', '#6B7280', false]];
  // Nov 2026: 1 Nov = Sunday
  const nov = Array.from({ length: 30 }, (_, i) => [i + 1, (0 + i) % 7]);
  const html = page('My leave', 'My leave', `
${top('My leave', 'Balances, plans and requests.', `<span class="btn pri">${icon('plane', 14)}Apply for leave</span>`)}
<div class="scrim"></div>
<div class="dlg">
  <div class="row"><b style="font-size:18px;flex:1">Apply for leave</b><span class="mut">${icon('x', 16)}</span></div>
  <div class="lbl">1 · What kind</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${types.map(([t, b, col, on]) => `<div class="tc${t === 'Earned' ? ' on' : ''}" style="--c:${col}"><i style="background:${col}"></i><b>${t}</b><span>${b === '∞' ? 'No limit' : `${b} left`}</span></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:16px">
    <div><div class="lbl" style="margin-bottom:6px">2 · When — drag across days</div>
      <div class="cal2">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span class="lbl" style="text-align:center">${d}</span>`).join('')}${nov.map(([d, wd]) => { const inR = d >= 9 && d <= 13; const hol = d === 10; const we = wd === 0 || wd === 6; const off = { 11: [3], 12: [3, 9] }[d]; return `<div class="c${inR ? ' r' : ''}${d === 9 ? ' s' : ''}${d === 13 ? ' e' : ''}${we ? ' we' : ''}"><b>${d}</b>${hol ? '<span class="hol">Diwali</span>' : ''}${off ? `<span class="faces">${off.map((i) => av(i, 14)).join('')}</span>` : ''}</div>`; }).join('')}</div>
      <div class="row xs" style="gap:10px;margin-top:6px"><span class="row" style="gap:4px"><i style="width:9px;height:9px;border-radius:3px;background:${C.warn}"></i>your days</span><span class="row" style="gap:4px"><i style="width:9px;height:9px;border-radius:3px;background:#99F6E4"></i>holiday</span><span class="row" style="gap:4px">${av(3, 12)} teammates off</span></div></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="lbl">3 · Check</div>
      <div class="sumc"><div class="row"><span style="flex:1"><b style="font-size:22px">4 days</b><div class="xs mut">Mon 9 – Fri 13 Nov · Diwali (Tue) not counted</div></div>${ring(11, 18, C.warn, 58, 7, '11', 'after')}</div>
        <div class="row xs" style="gap:6px;margin-top:8px"><span class="seg"><span class="on">Full days</span><span>Half day</span></span><span class="mut">(half day for 1-day requests)</span></div></div>
      <div class="warn">${icon('users', 14)}<span><b>2 of 6 in your team are off on 11–12 Nov</b> (Rahul, Arjun). You can still apply. ${NEW}</span></div>
      <div class="fld"><label>Reason</label><span class="inp" style="min-height:44px;align-items:flex-start">Family trip home for Diwali</span></div>
      <div class="row xs mut" style="gap:6px">${icon('paper', 13)} Attach a document <span class="mut">(asked for sick leave over 2 days)</span> ${NEW}</div>
      <div><div class="lbl" style="margin-bottom:6px">Who approves</div>${stepper([['Priya', 'team lead', 'todo'], ['Ravi', 'manager', 'todo']])}</div>
      <div class="row" style="gap:8px;margin-top:auto"><span class="btn">Save draft</span><span style="flex:1"></span><span class="btn">Cancel</span><span class="btn pri">${icon('plane', 13)}Send request</span></div>
    </div>
  </div>
</div>`);
  return dcPage('Apply for leave', css + `<style>
.scrim{position:absolute;inset:0;background:rgba(17,24,39,.42);z-index:4}
.dlg{position:absolute;left:50%;top:110px;transform:translateX(-50%);width:900px;background:#fff;border-radius:18px;z-index:5;padding:20px 22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 40px 80px -30px rgba(0,0,0,.5);animation:pop .4s cubic-bezier(.2,.8,.2,1) both}
.tc{border:1.5px solid ${C.border};border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:2px;position:relative}
.tc i{width:22px;height:4px;border-radius:9px;margin-bottom:4px}.tc b{font-size:13px}.tc span{font-size:11px;color:${C.muted};font-weight:700}
.tc.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 8%,#fff);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 18%,transparent)}
.cal2{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal2 .c{height:46px;border:1px solid ${C.line};border-radius:8px;padding:4px 5px;position:relative;display:flex;flex-direction:column;font-size:11px}
.cal2 .c.we{background:${C.raised};color:${C.muted}}
.cal2 .c.r{background:${C.warn}22;border-color:${C.warn}66}.cal2 .c.s,.cal2 .c.e{background:${C.warn};color:#fff;border-color:${C.warn}}
.cal2 .hol{font-size:8.5px;font-weight:800;background:#99F6E4;color:#115E59;border-radius:4px;padding:0 3px;margin-top:auto;align-self:flex-start}
.cal2 .faces{position:absolute;right:3px;bottom:3px;display:flex}.cal2 .faces .ph{margin-left:-4px;border:1.5px solid #fff}
.sumc{border:1px solid ${C.border};border-radius:12px;padding:12px}
.warn{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:${C.warnSoft};color:#92400E;font-size:12px}
</style>`, html, 1180);
}

// ─── 6 · Leave approvals ────────────────────────────────────
function leaveApprovals() {
  const reqs = [
    [2, 'Earned leave', 'Mon 9 – Fri 13 Nov', 4, 'Family trip home for Diwali', [[9, 13, 'me'], [11, 12, 3], [12, 12, 7]], '11 left after', 'Level 2 of 2 · Priya approved', false],
    [4, 'Sick leave', 'Tue 6 – Wed 7 Oct', 2, 'Fever — doctor’s note attached 📎', [[6, 7, 'me']], '7 left after', 'Level 1 of 1', false],
    [7, 'Casual leave', 'Fri 23 Oct', 1, 'Long weekend with family', [[23, 23, 'me'], [23, 23, 1], [23, 23, 9]], '6.5 left after', 'Level 1 of 1', true],
  ];
  const strip = (from, to, marks, first = 4) => `<div class="ms">${Array.from({ length: to - from + 1 }, (_, k) => { const d = from + k; const wd = (d - 1 + first) % 7; const mine = marks.find((m) => m[2] === 'me' && d >= m[0] && d <= m[1]); const others = marks.filter((m) => m[2] !== 'me' && d >= m[0] && d <= m[1]); return `<div class="m${mine ? ' me' : ''}${wd === 0 || wd === 6 ? ' we' : ''}"><span>${d}</span>${others.length ? `<span class="faces">${others.map((m) => av(m[2], 13)).join('')}</span>` : ''}</div>`; }).join('')}</div>`;
  const html = page('Leave approvals', 'Leave approvals', `
${top('Leave approvals', 'Requests waiting for your decision, and leave across the people you look after.')}
<div class="row" style="gap:12px"><div class="tabs"><span class="on">Waiting for me <b style="margin-left:4px">3</b></span><span>All requests</span><span>Team calendar ${NEW}</span></div><span style="flex:1"></span><span class="chip">${icon('filter', 13)}Type ▾</span><span class="btn sm pri">Approve 2 without clashes ${NEW}</span></div>
<div style="display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px" class="stg">
    ${reqs.map(([i, t, range, days, why, marks, after, lvl, clash], n) => `<div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
      <div class="row" style="gap:10px">${av(i, 36)}<span style="flex:1"><b>${nm(i)}</b> <span class="xs mut">· ${PEOPLE[i][1]}</span><div class="xs"><b style="color:${[C.warn, C.teal, C.pri][n]}">${t}</b> · ${range} · <b>${days} day${days > 1 ? 's' : ''}</b></div></span><span class="xs mut" style="text-align:right">${lvl}<div>${after}</div></span></div>
      <div class="row" style="gap:12px;align-items:flex-start">${strip(n === 1 ? 5 : n === 2 ? 21 : 8, n === 1 ? 9 : n === 2 ? 26 : 14, marks, n === 0 ? 0 : 4)}<div class="xs" style="flex:1">“${why}”${clash ? `<div class="warn2">${icon('alert', 12)} 3 of 6 in Design off on Fri 23</div>` : `<div class="ok2">${icon('check2', 12)} Team covered</div>`}</div></div>
      <div class="row" style="gap:8px;justify-content:flex-end"><span class="btn sm">Ask a question</span><span class="btn sm">${icon('x', 12)}Reject</span><span class="btn sm pri">${icon('check2', 12)}Approve</span></div></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><b style="font-size:13.5px">Your team in the next 4 weeks</b>
      ${[['Oct wk 2', 1], ['Oct wk 3', 0], ['Oct wk 4', 3], ['Nov wk 1', 2]].map(([w, n]) => `<div class="row xs" style="gap:8px"><span style="width:60px" class="mut">${w}</span><div style="flex:1;display:flex;gap:2px">${Array.from({ length: 6 }, (_, k) => `<i style="flex:1;height:12px;border-radius:3px;background:${k < n ? (n >= 3 ? C.bad : C.warn) : C.okSoft}"></i>`).join('')}</div><b style="width:40px;text-align:right">${6 - n}/6 in</b></div>`).join('')}
      <div class="xs mut">Red = half the team or more away.</div></div>
    <div class="card sec2"><b style="font-size:13.5px">After you approve</b><div class="xs mut">Card swipes away, the person is told, and the next level (if any) gets it. A confetti burst when the queue is empty.</div></div>
    ${note([['old', 'Waiting for me / All requests, status filter, approve / reject with note, swipe away, delegation'], ['new', 'Mini calendar per request with teammates already off'], ['new', 'Clash warning + team coverage for the next 4 weeks'], ['new', 'Balance after approval; level x of y; attachments'], ['new', '“Ask a question” (sends back, keeps it pending)'], ['new', 'Too many off → warning only, approval is never blocked']])}
  </div>
</div>`);
  return dcPage('Leave approvals', css + `<style>
.ms{display:flex;gap:3px}.ms .m{width:38px;height:42px;border-radius:8px;border:1px solid ${C.line};position:relative;font-size:10.5px;font-weight:800;padding:3px 5px;color:${C.muted}}
.ms .m.we{background:${C.raised}}.ms .m.me{background:${C.pri};color:#fff;border-color:${C.pri}}
.ms .faces{position:absolute;right:2px;bottom:2px;display:flex}.ms .faces .ph{margin-left:-4px;border:1.5px solid #fff}
.warn2{margin-top:6px;display:inline-flex;gap:4px;align-items:center;padding:3px 8px;border-radius:99px;background:${C.warnSoft};color:#92400E;font-weight:700}
.ok2{margin-top:6px;display:inline-flex;gap:4px;align-items:center;padding:3px 8px;border-radius:99px;background:${C.okSoft};color:${C.ok};font-weight:700}
</style>`, html, 1180);
}

// ─── 7 · Who's off ──────────────────────────────────────────
function whosOff() {
  const ppl = [[3, 'V', 5, 6, 'Casual'], [10, 'V', 5, 9, 'Earned'], [7, 'W', 5, 5, 'WFH'], [1, 'V', 12, 16, 'Earned'], [9, 'W', 7, 8, 'WFH'], [5, 'V', 19, 23, 'Paternity'], [2, 'V', 23, 23, 'Casual'], [0, 'V', 26, 27, 'Sick']];
  const html = page('Who’s off', 'Who’s off', `
${top('Who’s off', 'Approved and pending leave across the people you look after.', `<span class="btn">${icon('dl', 14)}Add to my calendar (.ics)</span>`)}
<div class="today">
  <div><div class="lbl" style="color:#FBCFE8">Away today · Mon 5 Oct</div><div class="row" style="gap:14px;margin-top:10px">${[[10, 'Earned leave', 'back Fri 9'], [7, 'Work from home', 'today'], [3, 'Casual leave', 'back Wed 7']].map(([i, t, b]) => `<div class="row" style="gap:8px">${av(i, 38)}<span><b style="font-size:13px">${first(i)}</b><div class="xs" style="opacity:.8">${t} · ${b}</div></span></div>`).join('')}</div></div>
  <div class="row" style="gap:12px;margin-left:auto">${[['Off this week', '4'], ['Off next week', '2'], ['Next holiday', 'Dussehra 22 Oct']].map(([l, v]) => `<div class="tk"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
</div>
<div class="row" style="gap:12px"><div class="tabs"><span>Calendar</span><span class="on">Timeline ${NEW}</span><span>List</span></div><span style="flex:1"></span><span class="chip">‹ October 2026 ›</span><span class="chip">${icon('network', 13)}All departments ▾</span><span class="chip on">Show pending</span></div>
<div class="card" style="padding:14px 16px">
  <div style="display:grid;grid-template-columns:170px repeat(31,1fr);gap:0;align-items:center" class="tl">
    <span class="lbl">Person</span>${OCT.map(([d, k]) => `<span class="dh${k === 'O' ? ' we' : ''}${d === 5 ? ' td' : ''}${d === 2 || d === 22 ? ' hl' : ''}">${d}</span>`).join('')}
    ${ppl.map(([i, k, a, b, t], r) => `<span class="row xs" style="gap:6px;padding:5px 0">${av(i, 22)}<b>${nm(i)}</b></span><span style="grid-column:span 31;position:relative;height:28px;border-bottom:1px solid ${C.line}"><i class="lv${r === 6 ? ' pend' : ''}" style="left:${((a - 1) / 31) * 100}%;width:${((b - a + 1) / 31) * 100}%;--c:${k === 'W' ? C.info : [C.pri, C.warn, C.teal, C.pink][r % 4]};animation-delay:${(r * 0.07).toFixed(2)}s">${t}${r === 6 ? ' · pending' : ''}</i></span>`).join('')}
    <span class="lbl" style="padding-top:8px">Team in</span>${OCT.map(([d, k]) => { const away = ppl.filter(([, , a, b]) => d >= a && d <= b).length; const pctIn = 100 - away * 14; return `<span style="padding-top:8px;display:flex;justify-content:center"><i style="width:70%;height:${k === 'O' ? 4 : 26}px;border-radius:3px;background:${k === 'O' ? C.line : pctIn < 75 ? C.warn : C.ok};opacity:.7;align-self:flex-end"></i></span>`; }).join('')}
  </div>
  <div class="xs mut" style="margin-top:8px">Hover a bar → type, dates, approver · click → pin the details. Bottom row: how much of the team is in each day ${NEW}.</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
  <div class="card sec2"><b style="font-size:13.5px">Holidays this month</b>${[['Fri 2 Oct', 'Gandhi Jayanti', '🕊️'], ['Thu 22 Oct', 'Dussehra', '🏹']].map(([d, n, e]) => `<div class="row xs" style="gap:8px"><span style="font-size:18px">${e}</span><span style="flex:1"><b>${n}</b><div class="mut">${d}</div></span></div>`).join('')}</div>
  <div class="card sec2"><b style="font-size:13.5px">Birthdays & anniversaries</b><div class="xs mut">Shown on the same calendar (day + month only) — optional layer ${NEW}</div><div class="row" style="gap:6px">${[8, 11, 6].map((i) => av(i, 26)).join('')}</div></div>
  ${note([['old', 'Month calendar, hover preview + pin, department filter, Calendar / List'], ['new', 'Away today hero + week counts'], ['new', 'Timeline view (people × days) with pending shown dashed'], ['new', '“Team in” capacity row'], ['new', 'Add to my calendar (.ics); birthdays layer']])}
</div>`);
  return dcPage('Who’s off', css + `<style>
.today{display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:16px;background:linear-gradient(120deg,#831843,#9D174D 50%,#BE185D);color:#fff}
.tk{background:#ffffff1f;border-radius:12px;padding:8px 12px;display:flex;flex-direction:column}.tk span{font-size:10.5px;opacity:.8;font-weight:700}.tk b{font-size:15px}
.tl .dh{font-size:9.5px;font-weight:800;color:${C.muted};text-align:center;padding:4px 0;border-radius:4px}.tl .dh.we{color:#C4C8D2}.tl .dh.td{background:${C.pri};color:#fff}.tl .dh.hl{background:#CCFBF1;color:#115E59}
.lv{position:absolute;top:4px;height:20px;border-radius:6px;background:color-mix(in srgb,var(--c) 18%,#fff);border:1.5px solid var(--c);color:var(--c);font-size:10px;font-weight:800;font-style:normal;display:flex;align-items:center;padding:0 6px;white-space:nowrap;overflow:hidden;transform-origin:left;animation:wbar .7s cubic-bezier(.2,.8,.2,1) both}
.lv.pend{border-style:dashed;background:#fff}
</style>`, html, 1180);
}

// ─── 8 · Holidays ───────────────────────────────────────────
function holidays() {
  const H = [['Thu 1 Jan', 'New Year', '🎆', 'all'], ['Mon 26 Jan', 'Republic Day', '🇮🇳', 'all'], ['Wed 4 Mar', 'Holi', '🎨', 'all'], ['Fri 3 Apr', 'Good Friday', '✝️', 'opt'], ['Fri 1 May', 'Maharashtra Day', '🏳️', 'mum'], ['Sat 15 Aug', 'Independence Day', '🇮🇳', 'all'], ['Mon 14 Sep', 'Ganesh Chaturthi', '🐘', 'all'], ['Fri 2 Oct', 'Gandhi Jayanti', '🕊️', 'all'], ['Thu 22 Oct', 'Dussehra', '🏹', 'all'], ['Tue 10 Nov', 'Diwali', '🪔', 'all'], ['Sun 1 Nov', 'Kannada Rajyotsava', '🟡', 'blr'], ['Fri 25 Dec', 'Christmas', '🎄', 'all']];
  const tagOf = { all: ['Everyone', C.muted, C.raised], opt: ['Optional', C.violet, '#F1EBFE'], mum: ['Mumbai', C.info, C.infoSoft], blr: ['Bengaluru', '#CA8A04', '#FEF9C3'] };
  const html = page('Holidays', 'Holidays', `
${top('Holiday calendar', 'Company holidays · 2026. They count as days off in attendance and leave.', `<span class="btn">${icon('dl', 14)}Add to my calendar</span><span class="btn">Import India 2027 ${NEW}</span><span class="btn pri">${icon('plus2', 14)}Add holiday</span>`)}
<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">
  <div class="card nexth">
    <div style="flex:1"><div class="lbl" style="color:#FDE68A">Next holiday</div><div style="font-size:30px;font-weight:800;margin-top:4px">Dussehra</div><div class="xs" style="opacity:.85">Thursday 22 October · everyone</div>
      <div class="row" style="gap:8px;margin-top:12px"><span class="flip"><b>1</b></span><span class="flip"><b>7</b></span><span class="xs" style="opacity:.85;font-weight:700">days to go</span></div>
      <div class="xs" style="margin-top:12px;padding:8px 10px;border-radius:10px;background:#ffffff1f">💡 Take Fri 23 off → <b>4-day weekend</b>. <u>Plan it</u></div></div>
    <div class="bow">🏹</div>
  </div>
  <div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">Optional holidays ${NEW}</b><span class="xst" style="background:#F1EBFE;color:${C.violet}">Pick up to 5</span></div>
    ${[['Good Friday', 'Fri 3 Apr', true], ['Eid al-Fitr', 'Fri 20 Mar', false], ['Onam', 'Wed 26 Aug', true], ['Guru Nanak Jayanti', 'Tue 24 Nov', false]].map(([n, d, on]) => `<div class="row xs" style="gap:8px;padding:6px 8px;border-radius:9px;border:1.5px solid ${on ? C.violet : C.line};background:${on ? '#F5F3FF' : '#fff'}"><span class="dot" style="background:${on ? C.violet : '#fff'};border:2px solid ${on ? C.violet : C.border};color:#fff">${on ? '✓' : ''}</span><b style="flex:1">${n}</b><span class="mut">${d}</span></div>`).join('')}
    <div class="xs mut">Each person picks up to 5 (company setting); picked days count as holidays for them only.</div></div>
</div>
<div class="row" style="gap:12px"><div class="tabs"><span class="on">Year</span><span>List</span></div><span style="flex:1"></span><span class="chip">‹ 2026 ›</span><span class="chip on">${icon('pin', 13)}My location: Bengaluru ${NEW}</span></div>
<div style="display:grid;grid-template-columns:1fr 380px;gap:16px;align-items:start">
  <div class="card sec2"><div class="yr">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, mi) => { const start = new Date(Date.UTC(2026, mi, 1)).getUTCDay(); const len = new Date(Date.UTC(2026, mi + 1, 0)).getUTCDate(); const hs = H.filter((h) => h[0].split(' ')[2] === m).map((h) => [Number(h[0].split(' ')[1]), h]); return `<div class="mo${mi === 9 ? ' cur' : ''}"><b>${m}</b><div class="mg">${'<i class="e"></i>'.repeat((start + 6) % 7)}${Array.from({ length: len }, (_, d) => { const h = hs.find((x) => x[0] === d + 1); return `<i class="${h ? `h ${h[1][3]}` : ''}" title="${h ? h[1][1] : ''}">${h ? h[1][2] : ''}</i>`; }).join('')}</div></div>`; }).join('')}</div></div>
  <div class="card sec2"><b style="font-size:13.5px">Upcoming</b>
    ${H.slice(8).map(([d, n, e, k]) => `<div class="row xs" style="gap:10px"><span class="em">${e}</span><span style="flex:1"><b style="font-size:13px">${n}</b><div class="mut">${d}</div></span><span class="xst" style="background:${tagOf[k][2]};color:${tagOf[k][1]}">${tagOf[k][0]}</span></div>`).join('')}
    ${note([['old', 'Year list, add / edit / delete, optional flag'], ['new', 'Next-holiday hero with countdown + long-weekend tip'], ['new', 'Year view with holiday art; add to calendar (.ics)'], ['new', 'Per-location holidays (Bengaluru / Mumbai)'], ['new', 'Optional holidays: everyone picks N of M'], ['new', 'Import a national list for next year'], ['new', 'How many optional holidays a person can pick is a setting (5 for now)']])}</div>
</div>`);
  return dcPage('Holidays', css + `<style>
.nexth{display:flex;gap:16px;padding:20px 22px;background:linear-gradient(120deg,#7C2D12,#9A3412 50%,#C2410C);color:#fff;border:0;overflow:hidden;position:relative}
.bow{font-size:92px;align-self:center;animation:sway 4s ease-in-out infinite alternate;filter:drop-shadow(0 10px 20px rgba(0,0,0,.3))}
@keyframes sway{to{transform:rotate(-8deg) translateY(-6px)}}
.flip{width:40px;height:52px;border-radius:9px;background:#fff;color:#9A3412;display:flex;align-items:center;justify-content:center;font-size:30px;position:relative;overflow:hidden;box-shadow:0 6px 14px rgba(0,0,0,.25)}
.flip:after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:#00000018}
.flip b{animation:flipin .8s cubic-bezier(.2,.8,.2,1) both}@keyframes flipin{from{transform:rotateX(90deg)}}
.yr{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.mo{display:flex;flex-direction:column;gap:5px}.mo b{font-size:12px}.mo.cur b{color:${C.pri}}
.mo .mg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.mo .mg i{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:4px;background:${C.raised};font-size:10px;font-style:normal}
.mo .mg i.e{background:transparent}.mo .mg i.h{background:#FFEDD5;box-shadow:inset 0 0 0 1.5px #FDBA74;animation:pop .5s ease both}
.mo .mg i.h.opt{background:#F5F3FF;box-shadow:inset 0 0 0 1.5px #C4B5FD}.mo .mg i.h.mum{background:${C.infoSoft};box-shadow:inset 0 0 0 1.5px #7DD3FC}.mo .mg i.h.blr{background:#FEF9C3;box-shadow:inset 0 0 0 1.5px #FDE047}
.em{width:34px;height:34px;border-radius:10px;background:${C.raised};display:flex;align-items:center;justify-content:center;font-size:18px}
</style>`, html, 1180);
}

// ─── 9 · Attendance settings ────────────────────────────────
function attSettings() {
  const html = page('Attendance settings', 'Attendance settings', `
${top('Attendance settings', 'Rules for the whole company. Times are in Asia/Kolkata.', `<span class="btn">Discard</span><span class="btn pri">Save changes</span>`)}
<div class="row" style="gap:12px"><div class="tabs"><span class="on">${icon('clock', 14)}Shift & day rules</span><span>${icon('layers', 14)}Shifts ${NEW}</span><span>${icon('bell', 14)}Reminders ${NEW}</span><span>${icon('edit', 14)}Corrections</span></div></div>
<div style="display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec2"><b style="font-size:14px">Your working day — drag to change</b>
      <div style="position:relative;padding:28px 0 6px">
        ${ruler()}
        <div class="big">
          <i class="zone late" style="left:${pct(9.75)};width:calc(${pct(13.5)} - ${pct(9.75)})"><span>Late after 09:45</span></i>
          <i class="zone grace" style="left:${pct(9.5)};width:calc(${pct(9.75)} - ${pct(9.5)})"></i>
          <i class="sh" style="left:${pct(9.5)};width:calc(${pct(18.5)} - ${pct(9.5)})"><span class="hd l">09:30</span><b>General shift · 9 h</b><span class="hd r">18:30</span></i>
        </div>
        <div class="row xs" style="gap:14px;margin-top:10px"><span class="row" style="gap:5px"><i class="sw" style="background:${C.pri}"></i>Shift</span><span class="row" style="gap:5px"><i class="sw" style="background:${C.ok}55"></i>Grace 15 min</span><span class="row" style="gap:5px"><i class="sw" style="background:repeating-linear-gradient(45deg,${C.warn}55 0 3px,transparent 3px 6px)"></i>Counts as late</span></div>
      </div>
      <div class="row" style="gap:6px"><span class="lbl" style="width:110px">Working days</span>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => `<span class="pill${i < 5 ? ' on' : ''}">${d}</span>`).join('')}</div>
    </div>
    <div class="card sec2"><b style="font-size:14px">How hours become a day</b>
      <div class="scale"><i style="width:44%;background:${C.badSoft}"><b style="color:${C.bad}">Absent</b><span>under 4 h</span></i><i style="width:44%;background:#FEF9C3"><b style="color:#A16207">Half day</b><span>4 h – 8 h</span></i><i style="flex:1;background:${C.okSoft}"><b style="color:${C.ok}">Present</b><span>8 h +</span></i></div>
      <div class="row xs mut" style="gap:6px">Drag the two markers ▲ · today: half day 4 h, full day 8 h</div>
    </div>
    <div class="card sec2"><b style="font-size:14px">More rules ${NEW}</b>
      ${[['Forgot to check out', 'Close the day automatically at shift end + 2 h, and mark it “missing check-out”', true], ['Late too often', 'After 3 late arrivals in a month, tell the line manager', true], ['Corrections', 'No monthly limit, up to 30 days back · tell lead / manager / HR when someone asks for more than 8 in a month', true], ['Web check-in', 'People can check in from the browser', true], ['Office network only', 'Check in only from the office Wi-Fi / IP list — coming soon', false]].map(([t, d, on]) => `<div class="row" style="gap:12px"><span style="flex:1"><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></span><span class="tgl${on ? '' : ' off'}"></span></div>`).join('')}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2 try"><b style="font-size:13.5px">Try it ${NEW}</b><div class="xs mut">See what your rules do before you save</div>
      ${[['In 09:40 · out 18:35', 'P', 'Present · on time (in grace)'], ['In 09:52 · out 18:40', 'L', 'Present · late 7 min'], ['In 10:00 · out 14:30', 'H', 'Half day · 4 h 30 m'], ['In 09:30 · no check-out', 'M', 'Closed at 20:30 · missing check-out']].map(([a, k, r]) => `<div class="row xs" style="gap:8px;padding:8px 10px;border-radius:10px;background:${C.raised}"><span style="flex:1;font-family:monospace;font-weight:700">${a}</span>${st(k, r)}</div>`).join('')}</div>
    <div class="card sec2"><b style="font-size:13.5px">Shifts ${NEW}</b>
      ${[['General', '09:30–18:30', 'Everyone (default)', C.pri], ['Night', '21:00–06:00', 'Night-shift project members', C.violet], ['Support early', '07:00–16:00', 'Helpdesk team', C.teal]].map(([n, t, w, c]) => `<div class="row xs" style="gap:8px"><i class="sw" style="background:${c}"></i><b style="width:90px">${n}</b><span class="mut" style="flex:1">${t} · ${w}</span></div>`).join('')}</div>
    ${note([['old', 'Working days, shift start / end, grace, half / full day hours, correction window, web check-in'], ['new', 'Visual shift bar with grace and late zones'], ['new', '“Try it” preview of what the rules do'], ['new', 'Auto close forgotten check-outs; late-too-often alert; correction limit'], ['new', 'More than one shift (e.g. Night, Support early)'], ['new', 'Night shift added; people or project members are assigned to a shift']])}
  </div>
</div>`);
  return dcPage('Attendance settings', css + `<style>
.big{position:relative;height:54px;border-radius:12px;background:${C.raised};border:1px solid ${C.line};margin-top:6px}
.zone{position:absolute;top:0;bottom:0}.zone.grace{background:${C.ok}33}.zone.late{background:repeating-linear-gradient(45deg,${C.warn}33 0 4px,transparent 4px 8px)}
.zone.late span{position:absolute;bottom:0;left:6px;font-size:8.5px;font-weight:800;color:${C.warn};white-space:nowrap}
.sh{position:absolute;top:10px;bottom:10px;border-radius:9px;background:linear-gradient(90deg,${C.pri},#6366F1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 8px 18px -8px ${C.pri};animation:wbar .9s cubic-bezier(.2,.8,.2,1) both}
.hd{position:absolute;top:-26px;font-size:10.5px;font-weight:800;color:${C.pri};background:#fff;border:1px solid ${C.border};border-radius:6px;padding:1px 6px}.hd.l{left:-20px}.hd.r{right:-20px}
.sh:before,.sh:after{content:'';position:absolute;top:50%;width:10px;height:22px;margin-top:-11px;border-radius:4px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}.sh:before{left:-5px}.sh:after{right:-5px}
.sw{width:12px;height:12px;border-radius:4px;display:inline-block;flex:none}
.pill{padding:6px 11px;border-radius:99px;border:1.5px solid ${C.border};font-size:12px;font-weight:700;color:${C.muted}}.pill.on{border-color:${C.pri};background:${C.priSoft};color:${C.priText}}
.scale{display:flex;height:48px;border-radius:10px;overflow:hidden;gap:2px}.scale i{display:flex;flex-direction:column;justify-content:center;padding:0 12px;font-style:normal;position:relative}.scale i b{font-size:12.5px}.scale i span{font-size:10.5px;color:${C.muted};font-weight:700}
.scale i:not(:last-child):after{content:'▲';position:absolute;right:-7px;bottom:-14px;font-size:11px;color:${C.fg}}
</style>`, html, 1180);
}

// ─── 10 · Leave types ───────────────────────────────────────
function leaveTypes() {
  const T = [['Casual leave', 'CL', C.pri, '12 / year', 'Monthly · 1 a month', '1 approval', ['Half days']], ['Sick leave', 'SL', C.teal, '10 / year', 'Up front', '1 approval', ['Doc after 2 days']], ['Earned leave', 'EL', C.warn, '18 / year', 'Monthly · 1.5 a month', '2 approvals', ['Carry 10', '7 days notice']], ['Work from home', 'WFH', C.info, 'No limit', '—', '1 approval', ['Counts as working']], ['Maternity', 'ML', C.pink, '182 days', 'Up front', '1 approval', ['Women only', 'Calendar days']], ['Unpaid', 'LOP', '#6B7280', 'No limit', '—', '2 approvals', ['Unpaid']]];
  const html = page('Leave types', 'Leave types', `
${top('Leave types', 'What people can take, how much, and who approves it.', `<span class="btn">${icon('calcheck', 14)}Year-end ${NEW}</span><span class="btn pri">${icon('plus2', 14)}Add type</span>`)}
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px" class="stg">
  ${T.map(([n, code, col, q, acc, appr, tags], i) => `<div class="card lt${i === 2 ? ' on' : ''}" style="--c:${col}"><div class="row" style="gap:10px"><span class="code">${code}</span><span style="flex:1"><b style="font-size:14px">${n}</b><div class="xs mut">${q} · ${acc}</div></span><span class="mut">${icon('edit', 14)}</span></div><div class="row" style="gap:5px;flex-wrap:wrap"><span class="xst" style="background:${C.raised};color:${C.muted}">${appr}</span>${tags.map((t) => `<span class="xst" style="background:color-mix(in srgb,${col} 10%,#fff);color:${col}">${t}</span>`).join('')}</div><div class="row xs mut" style="gap:6px">Used this year<div class="bar" style="flex:1;height:6px"><i class="wb" style="width:${[38, 22, 41, 60, 4, 8][i]}%;background:${col}"></i></div><b>${[38, 22, 41, 60, 4, 8][i]}%</b></div></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start">
  <div class="card sec2"><div class="row"><b style="font-size:15px;flex:1">Edit · Earned leave</b><span class="code" style="--c:${C.warn}">EL</span></div>
    <div class="sentence">People get <u>18 days</u> a year, added <u>1.5 each month</u>. They can take up to <u>10 days</u> at a time with <u>7 days’</u> notice, and <u>2 levels</u> approve. Up to <u>10 days</u> carry into next year ${NEW}<span class="xs mut" style="display:block;margin-top:4px;font-weight:600">The sentence updates as you change the fields below.</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${[['Days per year', '18'], ['Credited', 'Monthly ▾'], ['Max at a time', '10'], ['Notice (days)', '7'], ['Approval levels', '2'], ['Carry forward up to', '10'], ['Carried days expire', '31 Mar ▾'], ['Only for', 'Everyone ▾']].map(([l, v], i) => `<div class="fld"><label>${l}${i === 6 ? NEW : ''}</label><span class="inp">${v}</span></div>`).join('')}
    </div>
    <div class="lbl" style="margin-top:4px">More rules ${NEW}</div>
    ${[['Not during probation', 'New joiners can use it after probation ends', true], ['Ask for a document', 'When a request is longer than 2 days', false], ['Weekends in between count', '“Sandwich rule” — Fri + Mon off counts Sat & Sun too', false], ['Allow a negative balance', 'Up to 2 days in advance', false]].map(([t, d, on]) => `<div class="row" style="gap:12px"><span style="flex:1"><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></span><span class="tgl${on ? '' : ' off'}"></span></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><b style="font-size:13.5px">Year-end preview · 31 Dec ${NEW}</b>
      <div class="row" style="gap:10px">${ring(31, 52, C.ok, 62, 7, '31', 'carry')}${ring(21, 52, C.bad, 62, 7, '21', 'lapse')}<span class="xs mut" style="flex:1">Earned leave days across 24 people. 3 people would lose 5+ days — remind them now?</span></div>
      <span class="btn sm" style="align-self:flex-start">${icon('bell', 12)}Remind the 3</span></div>
    <div class="card sec2"><b style="font-size:13.5px">Balance changes (HR)</b><div class="xs mut">Add or take away days for one person with a reason — already possible; history shown per person.</div></div>
    ${note([['old', 'Type cards, name / code / colour, category, quota, accrual, approval levels, notice, max days, gender, carry forward, half day'], ['new', 'Plain-English policy sentence'], ['new', 'Usage per type this year'], ['new', 'Probation rule, document rule, sandwich rule, negative balance, carried days expiry'], ['new', 'Year-end preview + reminders'], ['new', 'Every new rule is a per-type setting HR can switch on and tune']])}
  </div>
</div>`);
  return dcPage('Leave types', css + `<style>
.lt{padding:14px 16px;display:flex;flex-direction:column;gap:10px;border-top:3px solid var(--c)}.lt.on{box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 40%,transparent)}
.code{font-family:monospace;font-weight:900;font-size:12px;padding:6px 8px;border-radius:9px;background:color-mix(in srgb,var(--c) 14%,#fff);color:var(--c)}
.sentence{font-size:15px;line-height:1.6;padding:12px 14px;border-radius:12px;background:${C.raised};font-weight:600}.sentence u{text-decoration:none;background:${C.warnSoft};color:#92400E;padding:0 5px;border-radius:5px;font-weight:800}
.bar{border-radius:99px;background:${C.line};overflow:hidden}.bar i{display:block;height:100%;border-radius:99px}
</style>`, html, 1180);
}

// ─── 11 · Animation ideas (live) ────────────────────────────
function motion() {
  const demos = [
    ['Check-in', 'My attendance · Home', 'The ring fills from 0, a soft pulse shows you are “live”, time ticks.', `<div style="display:flex;align-items:center;gap:14px">${ring(4.2, 9, C.ok, 90, 9, '4h 12m', 'worked')}<span class="live" style="width:12px;height:12px"></span></div>`],
    ['Day line “now”', 'Team attendance', 'Bars grow to the current time; the red “now” line drifts with the clock.', `<div style="width:100%">${ruler()}${track([[9.3, 13.4, C.ok]], { now: 13.4 })}<div style="height:8px"></div>${track([[10.1, 13.4, C.warn]], { now: 13.4 })}</div>`],
    ['Missed punch nudge', 'My attendance', 'The violet day wobbles once and a “Fix it” chip slides in.', `<div class="wob">17<span>?</span></div><span class="fixchip">Fix it →</span>`],
    ['Calendar fill', 'My attendance · Holidays', 'Days pop in one by one (20 ms apart) with their colour.', `<div class="mini">${SEPT.slice(0, 21).map(([, k], i) => `<i style="background:${ST[k][1]};animation-delay:${(i * 0.05).toFixed(2)}s"></i>`).join('')}</div>`],
    ['Leave sent = plane takes off', 'Apply for leave', 'On “Send request” a paper plane flies off the button, then the card lands in Requests.', `<div class="runway"><svg class="pl" width="44" height="26" viewBox="0 0 70 40"><path d="M2 22 L40 18 L58 4 L64 6 L52 20 L68 22 L64 26 L52 24 L58 36 L52 38 L40 26 L2 24 Z" fill="${C.pri}"/></svg><span class="btn sm pri">Send request</span></div>`],
    ['Balance count-up', 'My leave', 'Rings and numbers count up to the balance; a used day “drains” the ring.', `<div class="row" style="gap:10px">${ring(7.5, 12, C.pri, 70, 8, '7.5', 'CL')}${ring(15, 18, C.warn, 70, 8, '15', 'EL')}</div>`],
    ['Holiday flip clock', 'Holidays · Who’s off', 'Days-to-go digits flip like a station board.', `<div class="row" style="gap:6px"><span class="flp"><b>1</b></span><span class="flp"><b>7</b></span><span class="xs mut">days</span></div>`],
    ['Approve → swipe + confetti', 'Both approval pages', 'Already built: the card swipes away. New: confetti when the queue is empty.', `<div class="confetti">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 7) % 100}%;background:${[C.pri, C.warn, C.ok, C.pink, C.info][i % 5]};animation-delay:${(i * 0.12).toFixed(2)}s"></i>`).join('')}<b>All caught up 🎉</b></div>`],
    ['Shift drag', 'Attendance settings', 'Handles snap to 15 min; grace and late zones follow.', `<div style="width:100%;position:relative;height:36px;border-radius:9px;background:${C.raised}"><i class="dragsh"></i></div>`],
  ];
  const html = page('My attendance', 'Animation ideas', `
${top('Time · animation ideas (live)', 'Small, meaningful motion — each plays once on an event (under ~1.5 s), follows the theme colours, and stops with “Reduce motion”.')}
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
  ${demos.map(([t, w, d, stage]) => `<div class="demo"><div class="stage">${stage}</div><div class="row"><b style="font-size:13.5px;flex:1">${t}</b><span class="where">${w}</span></div><div class="xs mut">${d}</div></div>`).join('')}
</div>
<div class="card notes">${['The page backgrounds (Signature / Terra / Prism / Simple) already give each Time page its own mood — Terra shows the sun path on Attendance.', 'Nothing loops forever except the live dot and the “now” line; no streak plants (you said no to that earlier).', 'All CSS — no videos, no libraries.'].map((t) => `<div class="xs">• ${t}</div>`).join('')}</div>`);
  return dcPage('Time — animation ideas', css + `<style>
.demo{background:#fff;border:1px solid ${C.border};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px}
.stage{height:130px;border-radius:12px;background:${C.raised};display:flex;align-items:center;justify-content:center;gap:10px;padding:0 16px;position:relative;overflow:hidden}
.where{font-size:10.5px;font-weight:800;color:${C.pri};background:${C.priSoft};padding:2px 8px;border-radius:99px}
.wob{width:58px;height:58px;border-radius:12px;border:2px solid ${C.violet};background:#F5F3FF;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:18px;animation:wob 2.4s ease-in-out infinite}
.wob span{font-size:11px;color:${C.violet}}@keyframes wob{0%,60%,100%{transform:rotate(0)}65%{transform:rotate(-6deg)}75%{transform:rotate(5deg)}85%{transform:rotate(-3deg)}}
.fixchip{font-size:12px;font-weight:800;padding:6px 10px;border-radius:99px;background:${C.pri};color:#fff;animation:slidein 2.4s ease-in-out infinite}@keyframes slidein{0%,55%{opacity:0;transform:translateX(-14px)}70%,100%{opacity:1;transform:none}}
.mini{display:grid;grid-template-columns:repeat(7,18px);gap:4px}.mini i{width:18px;height:18px;border-radius:4px;animation:pop .4s ease both;animation-iteration-count:1}
.runway{position:relative;width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center;padding-bottom:22px}
.pl{position:absolute;left:44%;bottom:30px;animation:takeoff 2.6s cubic-bezier(.5,0,.3,1) infinite}@keyframes takeoff{0%,20%{transform:translate(0,0) rotate(0);opacity:1}80%{transform:translate(140px,-90px) rotate(-22deg);opacity:1}100%{transform:translate(170px,-110px) rotate(-24deg);opacity:0}}
.flp{width:38px;height:50px;border-radius:9px;background:${C.fg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;position:relative;overflow:hidden}.flp:after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:#ffffff33}
.flp b{animation:flipin 1.6s cubic-bezier(.2,.8,.2,1) infinite}@keyframes flipin{0%{transform:rotateX(90deg)}40%,100%{transform:none}}
.confetti{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}.confetti b{font-size:14px}
.confetti i{position:absolute;top:-10px;width:7px;height:11px;border-radius:2px;animation:fall 2.2s ease-in infinite}@keyframes fall{to{transform:translateY(150px) rotate(320deg);opacity:.2}}
.dragsh{position:absolute;top:6px;bottom:6px;left:20%;width:50%;border-radius:7px;background:${C.pri};animation:drag 3s ease-in-out infinite alternate}@keyframes drag{to{left:26%;width:56%}}
</style>`, html, 1180);
}

// ─── 12 · Who sees what ─────────────────────────────────────
function matrix() {
  const roles = ['Employee', 'Team lead / PM', 'Line manager', 'HR', 'Company admin'];
  const rows = [
    ['My attendance', ['✓', '✓', '✓', '✓', '✓']], ['Team attendance (today, timeline, month grid)', ['—', 'Project team', 'Reporting line', 'Everyone', 'Everyone']], ['Nudge someone to check in', ['—', 'Project team', 'Reporting line', '✓', '✓']],
    ['Attendance approvals', ['—', 'Project team', 'Reporting line', 'On behalf', '✓']], ['Edit someone’s day directly', ['—', '—', '—', '✓', '✓']],
    ['My leave · apply · drafts', ['✓', '✓', '✓', '✓', '✓']], ['Leave approvals', ['—', 'Project team', 'Reporting line', 'On behalf', '✓']], ['Who’s off', ['Own team', 'Project team', 'Reporting line', 'Everyone', 'Everyone']],
    ['Holidays · pick optional ones', ['✓', '✓', '✓', '✓', '✓']], ['Add / import holidays', ['—', '—', '—', '✓', '✓']], ['Attendance settings & shifts', ['—', '—', '—', '✓', '✓']], ['Leave types · year-end', ['—', '—', '—', '✓', '✓']],
  ];
  const html = page('Attendance settings', 'Who sees what', `
${top('Time · who sees and does what', 'Same permissions as today (attendance.* / leave.*) plus scope. Updated with your answers.')}
<div class="card" style="overflow:hidden"><table class="tbl mx"><tr><th>Page / action</th>${roles.map((r) => `<th>${r}</th>`).join('')}</tr>${rows.map(([p, v]) => `<tr><td><b>${p}</b></td>${v.map((x) => `<td>${x === '✓' ? '<span class="y">✓</span>' : x === '—' ? '<span class="n">—</span>' : x === '?' ? `<span class="xst" style="background:${C.warnSoft};color:${C.warn}">?</span>` : `<span class="s">${x}</span>`}</td>`).join('')}</tr>`).join('')}</table></div>
<div class="card notes"><div class="xs">• Approval routing stays as decided: project lead / PM first, line manager can also approve, HR can approve on behalf; nobody approves their own request.</div><div class="xs">• “Employee · Own team” on Who’s off = the people who share their manager or project — confirmed.</div></div>`);
  return dcPage('Time — who sees what', css + `<style>.mx td,.mx th{text-align:center}.mx td:first-child,.mx th:first-child{text-align:left}.y{color:${C.ok};font-weight:900}.n{color:#C4C8D2}.s{font-size:11px;color:${C.muted};font-weight:700}</style>`, html, 940);
}

// ─── Overview ───────────────────────────────────────────────
function overview() {
  const pages = [
    ['calcheck', 'My attendance', 'Live ring + day line, hours on every day, missed-punch fix, insights', C.pri],
    ['usersr', 'Team attendance', 'Presence strip, live timeline, month grid, needs attention + nudge', C.ok],
    ['check', 'Attendance approvals', 'Before → after on a time line, bulk approve, last 30 days, shortcuts', C.info],
    ['plane', 'My leave', 'Next-trip hero, balance rings, lapse warning, long-weekend planner, my year', C.teal],
    ['plane', 'Apply for leave', 'Type cards, drag dates, teammates off, live day count, approvers, drafts', C.warn],
    ['calclock', 'Leave approvals', 'Mini calendar with who else is off, clash warning, coverage, ask a question', C.pink],
    ['calrange', 'Who’s off', 'Away-today hero, timeline view, team-in capacity row, .ics, birthdays layer', C.violet],
    ['caldays', 'Holidays', 'Next-holiday countdown, year view, per location, optional picks, import', '#C2410C'],
    ['clock', 'Attendance settings', 'Drag the shift, grace / late zones, try-it preview, auto close, shifts', C.pri],
    ['tags', 'Leave types', 'Policy sentence, usage, probation / document / sandwich rules, year-end', C.warn],
  ];
  const html = page('My attendance', 'Overview', `
${top('Time — plan', 'The 9 Time pages stay where they are in the menu (sidebar and top bar unchanged). Each gets a fresh layout, live visuals and a few new features.')}
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px" class="stg">${pages.map(([ic, t, d, col]) => `<div class="card sec2" style="border-top:3px solid ${col}"><span style="color:${col}">${icon(ic, 20)}</span><b style="font-size:14px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}</div>
<div class="g3">
  <div class="card sec2"><b>Ideas used</b>${['Live timelines (Gantt bars with a “now” line) — like Deputy / Rippling', 'Balance rings and a 12-month year view', 'Team-coverage checks while applying and approving', 'Long-weekend planner from the holiday list', 'Plain-English policy sentence (Notion / Linear style settings)', 'Keyboard shortcuts and bulk actions for approvers'].map((t) => `<div class="xs">• ${t}</div>`).join('')}</div>
  <div class="card sec2"><b>Build size (rough)</b>${[['UI only (no API change)', 'My attendance, Team today/timeline, Who’s off timeline, Holidays hero, approval visuals'], ['Small API', 'Month grid, last 30 days, coverage, drafts, nudge, try-it preview, year-end preview'], ['Bigger', 'Multiple shifts, per-location + optional holidays, new leave rules, auto close']].map(([a, b]) => `<div class="xs"><b>${a}:</b> <span class="mut">${b}</span></div>`).join('')}</div>
  <div class="card sec2"><b>Your answers</b>${['Corrections: no limit — insight to higher-ups when someone goes over 8 a month', 'Nudge: team lead, manager and HR', 'Too many people off: warning only', 'Shifts: add a Night shift', 'Optional holidays: 5 for now, set by the company', 'New leave rules: all of them, as settings HR can tune', 'Employees see their own team on Who’s off'].map((t, i) => `<div class="xs"><b>${i + 1}.</b> ${t}</div>`).join('')}</div>
</div>`);
  return dcPage('Time — plan', css, html, 900);
}

const boards = [
  ['CATimeOverview.dc.html', 'Time · Plan — 9 pages, what’s new on each, ideas used, build size, questions', overview, 900],
  ['CATimeMine.dc.html', 'Time · My attendance — live ring + day line, hours per day, missed check-out fix, insights, Week / Month / Year', myAttendance, 1400],
  ['CATimeTeam.dc.html', 'Time · Team attendance — presence strip, live timeline with “now”, needs attention + nudge, month grid', teamAttendance, 1300],
  ['CATimeApprovals.dc.html', 'Time · Attendance approvals — before → after on a time line, bulk approve, last 30 days, shortcuts', attApprovals, 1180],
  ['CALeaveMine.dc.html', 'Time · My leave — next trip countdown, balance rings, lapse warning, long-weekend planner, my year', myLeave, 1180],
  ['CALeaveApply.dc.html', 'Time · Apply for leave — type cards, drag dates, teammates off, live count, approvers, document, drafts', applyLeave, 1180],
  ['CALeaveApprovals.dc.html', 'Time · Leave approvals — mini calendar with who else is off, clash warning, coverage, ask a question', leaveApprovals, 1180],
  ['CALeaveWhosOff.dc.html', 'Time · Who’s off — away today, timeline view, team-in capacity, .ics, birthdays layer', whosOff, 1180],
  ['CATimeHolidays.dc.html', 'Time · Holidays — next holiday countdown, year view, per location, optional picks, import, long weekends', holidays, 1180],
  ['CATimeSettings.dc.html', 'Time · Attendance settings — drag the shift, grace / late zones, try-it preview, auto close, more shifts', attSettings, 1180],
  ['CALeaveTypes.dc.html', 'Time · Leave types — policy sentence, usage, new rules (probation, document, sandwich), year-end preview', leaveTypes, 1180],
  ['CATimeMotion.dc.html', 'Time · Animation ideas (live) — check-in ring, now line, missed punch, calendar fill, plane take-off, count-up, flip clock, confetti', motion, 1180],
  ['CATimeWhoSees.dc.html', 'Time · Who sees and does what — employee, team lead / PM, line manager, HR, company admin', matrix, 940],
];
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
canvas.notes.n21 = { kind: 'title1', maxW: 7600, text: 'Company · Time — my attendance, team attendance, approvals, my leave, apply, leave approvals, who’s off, holidays, attendance settings, leave types', w: 240, x: 0, y: Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards at y', Y);
