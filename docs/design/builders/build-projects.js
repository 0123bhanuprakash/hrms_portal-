// Company app → Projects: portfolio, timeline, project detail, resource planner, my projects.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { sidebar: reportsSidebar, C } = require('./build-reports.js');
const { css: peopleCss, photo } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  gantt: '<path d="M3 6h10M7 12h12M5 18h8"/>',
  kanban: '<rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="9" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  plus2: '<path d="M12 5v14M5 12h14"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  diamond: '<path d="M12 2 22 12 12 22 2 12z"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
});
const sidebar = (on) => reportsSidebar().replace('class="sb-i on"', 'class="sb-i"').replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;

const css = peopleCss.replace('</style>', `
.kpi{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.kpi .card{padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.pc2{border-radius:16px;border:1px solid ${C.border};background:#fff;overflow:hidden;display:flex;flex-direction:column}
.pc2 .band{height:6px}
.pc2 .b{padding:14px;display:flex;flex-direction:column;gap:10px}
.hl{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:99px}
.burn{height:8px;border-radius:99px;background:${C.line};position:relative;overflow:visible}.burn i{position:absolute;left:0;top:0;bottom:0;border-radius:99px}.burn b{position:absolute;top:-4px;width:2px;height:16px;background:${C.fg};border-radius:2px}
.gantt{display:grid;grid-template-columns:220px 1fr;border:1px solid ${C.border};border-radius:14px;overflow:hidden;background:#fff}
.gantt .h{background:${C.raised};font-size:11px;font-weight:800;color:${C.muted};padding:8px 12px;border-bottom:1px solid ${C.border}}
.gantt .r{padding:10px 12px;border-bottom:1px solid ${C.line};font-size:13px;display:flex;align-items:center;gap:8px;height:52px;box-sizing:border-box}
.gantt .t{position:relative;border-bottom:1px solid ${C.line};height:52px}
.gantt .bar{position:absolute;top:12px;height:28px;border-radius:8px;display:flex;align-items:center;gap:6px;padding:0 10px;color:#fff;font-size:11.5px;font-weight:700;box-shadow:0 4px 10px -4px rgba(0,0,0,.25)}
.gantt .ms{position:absolute;top:18px;width:14px;height:14px;transform:rotate(45deg);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15)}
.today{position:absolute;top:0;bottom:0;width:2px;background:${C.bad};z-index:2}
.heat{display:grid;grid-template-columns:200px repeat(8,1fr) 90px;gap:4px;align-items:center}
.heat .c{height:34px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800}
.tabs3{display:flex;gap:18px;border-bottom:1px solid ${C.border};font-size:13.5px;color:${C.muted}}.tabs3 span{padding:9px 0}.tabs3 span.on{color:${C.fg};font-weight:700;box-shadow:inset 0 -2px 0 ${C.pri}}
.tree .n{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid ${C.border};border-radius:12px;background:#fff}
.alloc{height:6px;width:80px;border-radius:99px;background:${C.line};overflow:hidden}.alloc i{display:block;height:100%}
.feed .it{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid ${C.line};font-size:12.5px}.feed .it:last-child{border-bottom:0}
.wk{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.wk div{border-radius:10px;padding:8px 6px;text-align:center;font-size:11px}
</style>`);

const PROJ = [
  ['Atlas — Billing revamp', 'ATL', 'Northwind Retail', '#4F46E5', 'On track', C.ok, C.okSoft, [0, 1, 3, 4], 9, 2, 4, 70, 'Ends 18 Dec', 'Milestones on time · fully staffed'],
  ['Nova mobile app', 'NOV', 'Internal', '#0D9488', 'At risk', C.warn, C.warnSoft, [9, 11, 5], 6, 1, 4, 58, 'Ends 30 Nov', 'Beta due in 6 days · QA role empty'],
  ['Helios data platform', 'HEL', 'Contoso Bank', '#DB2777', 'On track', C.ok, C.okSoft, [2, 6, 8, 7], 7, 1, 5, 45, 'Ends 31 Mar', 'Milestones on time'],
  ['Orion support desk', 'ORI', 'Fabrikam', '#F59E0B', 'Off track', C.bad, C.badSoft, [10, 4], 3, 2, 3, 100, 'Was due 2 Oct', 'Past its end date · 1 milestone overdue'],
];

// ─── Board 1: portfolio ─────────────────────────────────────
function portfolio() {
  const html = `<div class="app">${sidebar('Projects')}<div class="col">${header('Work &nbsp;›&nbsp; <b>Projects</b>')}<main class="main">
${top('Work', 'Projects', 'Every project, how it’s going and who is on it', `<div class="seg"><span class="on">${icon('grid', 12)} Cards</span><span>${icon('kanban', 12)} Board</span><span>${icon('gantt', 12)} Timeline</span></div><span class="btn">${icon('users', 14)}Resource planner</span><span class="btn pri">${icon('plus2', 14)}New project</span>`)}
<div class="kpi">${[['Active projects', '12', '2 starting this month', C.muted], ['Need attention', '3', '1 off track · 2 at risk', C.bad], ['Milestones this month', '7', '5 done · 1 overdue', C.warn], ['People on projects', '38 / 44', '6 on the bench', C.ok], ['Ending in 30 days', '2', 'Nova · Atlas', C.muted]].map(([l, v, sub, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${sub}</span></div>`).join('')}</div>
<div class="row" style="gap:8px;flex-wrap:wrap"><div class="search" style="height:36px;flex:0 0 260px;font-size:13px">${icon('search', 14)} Search name, code or client</div><span class="chip on">All · 14</span><span class="chip">🟢 On track · 9</span><span class="chip">🟠 At risk · 2</span><span class="chip">🔴 Off track · 1</span><span class="chip">Planned · 2</span><span class="chip">Client ▾</span><span class="chip">Manager ▾</span><span class="chip" style="margin-left:auto">Sort: needs attention ▾</span></div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">${PROJ.map(([n, code, client, col, health, hc, hs, team, size, done, total, timePct, end, why], k) => `<div class="pc2"><div class="band" style="background:${col}"></div><div class="b">
  <div class="row" style="gap:10px;align-items:flex-start"><span style="width:40px;height:40px;border-radius:11px;background:${col}18;color:${col};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px">${code}</span><div style="flex:1;min-width:0"><b style="font-size:15px">${n}</b><div class="xs mut">${client} · PM ${['Priya Sharma', 'Ravi Kumar', 'Meena Joshi', 'Karan Mehta'][k]}</div></div><span class="hl" style="background:${hs};color:${hc}" title="${why}">● ${health}</span></div>
  <div><div class="row xs" style="justify-content:space-between"><span class="mut">Milestones <b style="color:${C.fg}">${done} of ${total}</b> done</span><span class="mut">Time gone ${timePct}%</span></div>
    <div class="row" style="gap:4px;margin-top:6px;position:relative">${Array.from({ length: total }, (_, i) => `<span style="flex:1;height:8px;border-radius:99px;background:${i < done ? col : C.line}"></span>`).join('')}<b style="position:absolute;top:-4px;left:${timePct}%;width:2px;height:16px;background:${C.fg};border-radius:2px"></b></div></div>
  <div class="xs" style="color:${hc};font-weight:700">${why}</div>
  <div class="row xs" style="gap:14px"><span class="row" style="gap:4px">${icon('flag', 12)} <b>Next:</b> ${['UAT sign-off · 24 Oct', 'Beta to stores · 11 Oct', 'Data migration · 15 Nov', 'Close-out report · overdue'][k]}</span><span class="mut" style="margin-left:auto">${end}</span></div>
  <div class="row" style="gap:10px;border-top:1px solid ${C.line};padding-top:10px"><div class="stack">${team.map((i) => photo(i, 26, 26, { round: true })).join('')}</div><span class="xs mut">${size} people</span><span class="xs mut" style="margin-left:auto">PM update ${['2 days ago', '9 days ago', 'today', '3 weeks ago'][k]}</span></div>
</div></div>`).join('')}</div>
<div class="card" style="padding:10px 14px;display:flex;gap:16px;align-items:center;font-size:12px"><b>How health is worked out</b><span class="mut">🔴 past end date, or a milestone more than a week late · 🟠 a milestone due within 7 days that isn’t done, a role with nobody in it, no PM, or someone over 100% · 🟢 everything else — the PM can override it with a note</span></div>
</main></div></div>`;
  return dcPage('Projects portfolio', css, html, 1180);
}

// ─── Board 2: timeline (Gantt) ──────────────────────────────
function timeline() {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const rows = [
    ['Atlas — Billing revamp', '#4F46E5', 12, 64, [[38, '#4F46E5'], [58, '#4F46E5']], 0],
    ['Nova mobile app', '#0D9488', 18, 52, [[44, '#F59E0B']], 9],
    ['Helios data platform', '#DB2777', 30, 98, [[50, '#DB2777'], [74, '#DB2777']], 2],
    ['Orion support desk', '#F59E0B', 2, 30, [], 10],
    ['Vega website refresh', '#64748B', 60, 90, [[70, '#64748B']], 5],
  ];
  const html = `<div class="app">${sidebar('Projects')}<div class="col">${header('Work &nbsp;›&nbsp; <b>Projects</b> &nbsp;›&nbsp; Timeline')}<main class="main">
${top('Work', 'Projects', 'Timeline — when projects run, their milestones, and what overlaps', `<div class="seg"><span>${icon('grid', 12)} Cards</span><span>${icon('kanban', 12)} Board</span><span class="on">${icon('gantt', 12)} Timeline</span></div><div class="seg"><span>Weeks</span><span class="on">Months</span><span>Quarters</span></div>`)}
<div class="gantt">
  <div class="h">Project</div><div class="h" style="display:grid;grid-template-columns:repeat(8,1fr);padding:8px 0">${months.map((m) => `<span style="text-align:center">${m}</span>`).join('')}</div>
  ${rows.map(([n, col, s, e, ms, pi]) => `<div class="r"><span style="width:10px;height:10px;border-radius:3px;background:${col}"></span><b style="flex:1">${n}</b>${photo(pi, 22, 22, { round: true })}</div>
  <div class="t" style="background-image:repeating-linear-gradient(90deg,transparent 0 calc(12.5% - 1px),${C.line} calc(12.5% - 1px) 12.5%)"><div class="today" style="left:31%"></div>
    <div class="bar" style="left:${s}%;width:${e - s}%;background:linear-gradient(90deg,${col},${col}cc)">${e - s > 20 ? `<span style="opacity:.85">${Math.round((e - s) / 12.5)} months</span>` : ''}</div>
    ${ms.map(([m, c]) => `<span class="ms" style="left:calc(${m}% - 7px);background:${c}"></span>`).join('')}
  </div>`).join('')}
</div>
<div class="g2">
  <div class="card sec"><h3>${icon('flag', 15)}Milestones this month</h3>
    ${[['24 Oct', 'Atlas', 'UAT sign-off', 'p-pri', 'Due in 19 days'], ['4 Nov', 'Nova', 'Beta to stores', 'p-warn', 'At risk — 2 blockers'], ['15 Nov', 'Helios', 'Data migration', 'p-ok', 'On track']].map(([d, p, t, cls, s]) => `<div class="row" style="gap:10px"><span style="width:12px;height:12px;transform:rotate(45deg);background:${C.pri};border-radius:2px"></span><b class="xs" style="width:52px">${d}</b><div style="flex:1"><b style="font-size:13px">${t}</b><div class="xs mut">${p}</div></div><span class="pill ${cls}">${s}</span></div>`).join('')}</div>
  <div class="card sec"><h3>${icon('users', 15)}Overlaps to watch</h3>
    <div class="xs mut">People on 2+ projects that run at the same time in November</div>
    ${[[0, 'Priya Sharma', 'Atlas 60% · Helios 40%', 100], [9, 'Ravi Kumar', 'Nova 70% · Vega 50%', 120], [3, 'Karan Mehta', 'Atlas 50% · Nova 30%', 80]].map(([pi, n, s, a]) => `<div class="row" style="gap:10px">${photo(pi, 30, 30, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${s}</div></div><div class="alloc"><i style="width:${Math.min(100, a)}%;background:${a > 100 ? C.bad : a === 100 ? C.ok : C.warn}"></i></div><b class="xs" style="color:${a > 100 ? C.bad : C.fg}">${a}%</b></div>`).join('')}</div>
</div>
</main></div></div>`;
  return dcPage('Projects timeline', css, html, 1180);
}

// ─── Board 3: project detail ────────────────────────────────
function detail() {
  const updates = [
    [C.ok, C.okSoft, 'On track', 'API complete a week early. UAT starts Monday — Karan’s team on point.', '2 days ago', 0],
    [C.warn, C.warnSoft, 'At risk', 'Payment gateway sandbox delayed by the client; we moved work around.', '9 Sep', 0],
    [C.ok, C.okSoft, 'On track', 'Design signed off. Team fully staffed.', '12 Sep', 0],
  ];
  const html = `<div class="app">${sidebar('Projects')}<div class="col">${header('Work &nbsp;›&nbsp; Projects &nbsp;›&nbsp; <b>Atlas — Billing revamp</b>')}<main class="main">
<div class="card" style="overflow:hidden"><div style="height:8px;background:linear-gradient(90deg,#4F46E5,#7C3AED)"></div>
  <div style="padding:16px 20px;display:flex;align-items:center;gap:14px"><span style="width:52px;height:52px;border-radius:14px;background:#4F46E518;color:#4F46E5;display:flex;align-items:center;justify-content:center;font-weight:900">ATL</span>
    <div style="flex:1"><div class="row" style="gap:8px"><b style="font-size:21px">Atlas — Billing revamp</b><span class="hl" style="background:${C.okSoft};color:${C.ok}">● On track</span></div><div class="xs mut" style="font-size:13px">Northwind Retail · 1 Aug – 18 Dec 2026 · PM Priya Sharma</div></div>
    <span class="btn">${icon('activity', 14)}Post update</span><span class="btn">${icon('flag', 14)}Add milestone</span><span class="btn pri">${icon('users', 14)}Assign people</span></div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid ${C.line}">${[['Milestones', '2 of 4 done', 'none late'], ['Timeline', '70% gone', '74 days left'], ['Team', '9 people', '2 leads · 1 on leave today'], ['Next milestone', 'UAT sign-off', '24 Oct · in 19 days'], ['Last PM update', '2 days ago', 'On track']].map(([l, v, sub], i) => `<div style="padding:12px 16px;${i < 4 ? `border-right:1px solid ${C.line}` : ''}"><div class="xs mut">${l}</div><b style="font-size:16px">${v}</b><div class="xs mut">${sub}</div></div>`).join('')}</div>
</div>
<div class="tabs3"><span class="on">Overview</span><span>Team</span><span>Milestones</span><span>Updates</span><span>Settings</span></div>
<div class="card sec"><h3>${icon('flag', 15)}Roadmap<span class="r">today · 5 Oct</span></h3>
  <div style="position:relative;height:86px;margin:6px 10px">
    <div style="position:absolute;left:0;right:0;top:38px;height:6px;border-radius:99px;background:${C.line}"></div>
    <div style="position:absolute;left:0;width:70%;top:38px;height:6px;border-radius:99px;background:linear-gradient(90deg,#4F46E5,#7C3AED)"></div>
    <div style="position:absolute;left:70%;top:20px;bottom:6px;width:2px;background:${C.bad}"></div><span class="xs" style="position:absolute;left:calc(70% + 6px);top:16px;color:${C.bad};font-weight:800">Today</span>
    ${[[0, 'Kick-off', '1 Aug', true], [30, 'Design sign-off', '12 Sep', true], [48, 'API complete', '3 Oct', true], [78, 'UAT sign-off', '24 Oct', false], [100, 'Go-live', '18 Dec', false]].map(([x, t, d, done]) => `<div style="position:absolute;left:${x}%;top:30px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:18px;height:18px;transform:rotate(45deg);border-radius:4px;background:${done ? C.ok : '#fff'};border:3px solid ${done ? C.ok : C.pri}"></span><b class="xs" style="white-space:nowrap">${t}</b><span class="xs mut" style="margin-top:-6px">${d}</span></div>`).join('')}
  </div></div>
<div class="g21">
  <div class="card sec"><h3>${icon('activity', 15)}Status updates<span class="r">the PM posts one a week — everyone on the project sees it</span></h3>
    <div class="row" style="gap:8px;padding:10px;border:1px dashed ${C.border};border-radius:12px">${photo(0, 28, 28, { round: true })}<span class="xs mut" style="flex:1">How’s the project going this week?</span><span class="pill p-ok">🟢</span><span class="pill p-warn">🟠</span><span class="pill p-bad">🔴</span><span class="btn sm pri">Post</span></div>
    ${updates.map(([c, bg, h, t, w, pi]) => `<div class="row" style="gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid ${C.line}">${photo(pi, 30, 30, { round: true })}<div style="flex:1"><div class="row xs" style="gap:6px"><b>Priya Sharma</b><span class="hl" style="background:${bg};color:${c};padding:1px 7px">● ${h}</span><span class="mut">${w}</span></div><div style="font-size:13px;margin-top:3px">${t}</div></div></div>`).join('')}
    <div class="xs mut">No update for 14 days → the PM gets a reminder; HR sees “update overdue”.</div></div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec"><h3>${icon('flag', 15)}Milestones</h3>
      ${[['✓', 'Design sign-off', '12 Sep', C.ok, true, 'Arjun'], ['✓', 'API complete', '3 Oct', C.ok, true, 'Karan'], ['◆', 'UAT sign-off', '24 Oct', C.pri, false, 'Sameer'], ['◆', 'Go-live', '18 Dec', C.muted, false, 'Priya']].map(([m, t, d, c, done, o]) => `<div class="row" style="gap:10px"><span style="width:22px;height:22px;border-radius:50%;background:${done ? C.okSoft : C.priSoft};color:${c};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900">${m}</span><div style="flex:1"><b style="font-size:13px;${done ? `color:${C.muted};text-decoration:line-through` : ''}">${t}</b><div class="xs mut">owner ${o}</div></div><span class="xs mut">${d}</span></div>`).join('')}</div>
    <div class="card sec"><h3>${icon('activity', 15)}Recent activity</h3><div class="feed">
      ${[[2, 'Hema added <b>Dev Menon</b> as Member · 50%', '2 h'], [0, 'Priya marked <b>API complete</b> done', 'Yesterday'], [1, 'Rahul’s leave on 21 Oct goes to Karan (team lead)', 'Mon']].map(([pi, t, w]) => `<div class="it">${photo(pi, 24, 24, { round: true })}<span style="flex:1">${t}</span><span class="xs mut">${w}</span></div>`).join('')}</div></div>
  </div>
</div>
<div class="card sec"><h3>${icon('users', 15)}Team &amp; who approves whom<span class="r">leave and corrections route here first</span></h3>
  <div class="tree" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:start">
    <div class="n" style="grid-column:1/-1;max-width:330px;margin:0 auto">${photo(0, 36, 36, { round: true })}<div style="flex:1"><b style="font-size:13px">Priya Sharma</b><div class="xs mut">Project manager · 60%</div></div><span class="pill p-pri">approves leads</span></div>
    ${[[3, 'Karan Mehta', 'Team lead · Backend', [[1, 'Rahul Das', 50, '🌴 on leave today'], [11, 'Dev Menon', 50, '']]], [4, 'Sameer Gill', 'Team lead · QA', [[10, 'Tanvi Shah', 100, '']]], [5, 'Arjun Nair', 'Team lead · Design', [[7, 'Ananya Bose', 40, '']]]].map(([pi, n, r, kids]) => `<div style="display:flex;flex-direction:column;gap:8px"><div class="n">${photo(pi, 32, 32, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${r}</div></div></div>${kids.map(([k, kn, a, note]) => `<div class="n" style="margin-left:18px">${photo(k, 26, 26, { round: true })}<div style="flex:1"><b style="font-size:12.5px">${kn}</b>${note ? `<div class="xs" style="color:${C.warn}">${note}</div>` : ''}</div><div class="alloc"><i style="width:${a}%;background:#4F46E5"></i></div><span class="xs mut">${a}%</span></div>`).join('')}</div>`).join('')}
  </div>
  <div class="row xs" style="gap:10px;padding:10px 12px;background:${C.warnSoft};border-radius:10px"><b>Open role:</b> QA engineer · 50% from 1 Nov <span class="btn sm" style="margin-left:auto">Find someone free</span></div></div>
</main></div></div>`;
  return dcPage('Project detail', css, html, 1440);
}

// ─── Board 4: resource planner ──────────────────────────────
function planner() {
  const weeks = ['13 Oct', '20 Oct', '27 Oct', '3 Nov', '10 Nov', '17 Nov', '24 Nov', '1 Dec'];
  const people = [
    [0, 'Priya Sharma', 'Engineering Lead', [100, 100, 100, 100, 100, 100, 60, 60]],
    [9, 'Ravi Kumar', 'Eng. Manager', [120, 120, 120, 100, 100, 70, 70, 70]],
    [3, 'Karan Mehta', 'Engineering Lead', [80, 80, 80, 80, 50, 50, 50, 50]],
    [1, 'Rahul Das', 'QA Engineer', [50, 50, 50, 50, 0, 0, 0, 0]],
    [11, 'Dev Menon', 'DevOps', [100, 100, 100, 100, 100, 100, 100, 100]],
    [7, 'Ananya Bose', 'Marketing', [40, 40, 40, 40, 40, 0, 0, 0]],
    [5, 'Arjun Nair', 'Designer', [0, 0, 30, 30, 30, 30, 30, 30]],
  ];
  const tone = (v) => (v > 100 ? [C.badSoft, C.bad] : v === 100 ? [C.okSoft, C.ok] : v >= 50 ? ['#E0E7FF', C.pri] : v > 0 ? [C.warnSoft, C.warn] : [C.raised, '#9CA3AF']);
  const html = `<div class="app">${sidebar('Projects')}<div class="col">${header('Work &nbsp;›&nbsp; Projects &nbsp;›&nbsp; <b>Resource planner</b>')}<main class="main">
${top('Work · PMO', 'Resource planner', 'Who is booked, who is over, and who is free — week by week', `<span class="chip">Department ▾</span><span class="chip">Skill / title ▾</span><div class="seg"><span class="on">8 weeks</span><span>Quarter</span></div><span class="btn">${icon('dl', 14)}Export</span>`)}
<div class="row" style="gap:10px">${[['Over-booked', '1 person', C.bad, C.badSoft], ['Fully booked', '2 people', C.ok, C.okSoft], ['Partly free', '3 people', C.warn, C.warnSoft], ['On the bench next month', '2 people', C.muted, C.raised]].map(([l, v, c, bg]) => `<div class="card" style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px"><span style="width:12px;height:12px;border-radius:4px;background:${bg};border:2px solid ${c}"></span><div><div class="xs mut">${l}</div><b>${v}</b></div></div>`).join('')}</div>
<div class="card sec">
  <div class="heat"><span></span>${weeks.map((w) => `<span class="xs mut" style="text-align:center;font-weight:700">${w}</span>`).join('')}<span class="xs mut" style="text-align:center;font-weight:700">Free next mo.</span>
  ${people.map(([pi, n, t, a]) => `<div class="row" style="gap:8px">${photo(pi, 30, 30, { round: true })}<div><b style="font-size:13px">${n}</b><div class="xs mut">${t}</div></div></div>${a.map((v) => { const [bg, c] = tone(v); return `<div class="c" style="background:${bg};color:${c}">${v ? `${v}%` : '—'}</div>`; }).join('')}<b class="xs" style="text-align:center;color:${a[5] < 50 ? C.ok : C.muted}">${100 - Math.min(100, a[5])}%</b>`).join('')}
  </div>
  <div class="row xs mut" style="gap:14px;border-top:1px solid ${C.line};padding-top:10px">${[[C.badSoft, 'Over 100%'], [C.okSoft, '100%'], ['#E0E7FF', '50–99%'], [C.warnSoft, '1–49%'], [C.raised, 'Free']].map(([c, l]) => `<span class="row" style="gap:5px"><span style="width:12px;height:12px;border-radius:3px;background:${c}"></span>${l}</span>`).join('')}<span style="margin-left:auto">Click a cell to change an allocation · drag across weeks to book someone</span></div>
</div>
<div class="g2">
  <div class="card sec"><h3>${icon('zap', 15)}Fix this first</h3>
    <div class="row" style="gap:10px">${photo(9, 32, 32, { round: true })}<div style="flex:1"><b style="font-size:13px">Ravi Kumar is at 120% until 27 Oct</b><div class="xs mut">Nova 70% + Vega 50% — move 20% of Vega to Arjun (free 70%)?</div></div><span class="btn sm pri">Rebalance</span></div>
    <div class="row" style="gap:10px">${photo(1, 32, 32, { round: true })}<div style="flex:1"><b style="font-size:13px">Rahul Das has nothing from 10 Nov</b><div class="xs mut">Helios needs QA from 15 Nov</div></div><span class="btn sm">Assign</span></div></div>
  <div class="card sec"><h3>${icon('search', 15)}Find someone free</h3>
    <div class="row" style="gap:8px"><span class="chip on">From 10 Nov</span><span class="chip">for 6 weeks</span><span class="chip">at least 50%</span><span class="chip">QA ▾</span></div>
    ${[[1, 'Rahul Das', 'QA Engineer', '100% free'], [5, 'Arjun Nair', 'Designer', '70% free'], [7, 'Ananya Bose', 'Marketing', '100% free from 17 Nov']].map(([pi, n, t, f]) => `<div class="row" style="gap:10px">${photo(pi, 30, 30, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${t}</div></div><span class="pill p-ok">${f}</span><span class="btn sm">Book</span></div>`).join('')}</div>
</div>
</main></div></div>`;
  return dcPage('Resource planner', css, html, 1180);
}

// ─── Board 5: my projects (employee) ────────────────────────
function mine() {
  const html = `<div class="app">${sidebar('Projects')}<div class="col">${header('Work &nbsp;›&nbsp; <b>My projects</b>')}<main class="main">
${top('Work', 'My projects', 'What you’re on, who leads you there, and what’s coming up')}
<div class="g21" style="grid-template-columns:1fr 330px">
  <div style="display:flex;flex-direction:column;gap:14px">
    ${[['Atlas — Billing revamp', 'ATL', '#4F46E5', 60, 'Karan Mehta', 3, 'Team lead', 'UAT sign-off · 24 Oct', 'On track', C.ok, C.okSoft, 'API complete a week early. UAT starts Monday.'], ['Helios data platform', 'HEL', '#DB2777', 40, 'Meena Joshi', 8, 'Project manager', 'Data migration · 15 Nov', 'On track', C.ok, C.okSoft, 'Source systems mapped; migration dry-run next week.']].map(([n, code, col, a, lead, li, lr, ms, h, hc, hs, upd]) => `<div class="pc2"><div class="band" style="background:${col}"></div><div class="b">
      <div class="row" style="gap:12px"><span style="width:44px;height:44px;border-radius:12px;background:${col}18;color:${col};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px">${code}</span><div style="flex:1"><div class="row" style="gap:8px"><b style="font-size:15px">${n}</b><span class="hl" style="background:${hs};color:${hc}">● ${h}</span></div><div class="xs mut">You’re a <b style="color:${C.fg}">Member</b> · ${a}% of your time · until 18 Dec</div></div>
        <div style="width:58px;height:58px;border-radius:50%;background:conic-gradient(${col} 0 ${a}%,${C.line} 0);display:flex;align-items:center;justify-content:center"><div style="width:44px;height:44px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12.5px">${a}%</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        <div class="mini">${photo(li, 30, 30, { round: true })}<div><div class="xs mut">${lr} · approves your leave</div><b style="font-size:12.5px">${lead}</b></div></div>
        <div class="mini" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="xs mut">Next milestone</span><b style="font-size:12.5px">${ms}</b></div>
      </div>
      <div class="row xs" style="gap:8px;padding:8px 10px;background:${C.raised};border-radius:10px">${icon('activity', 13)}<span style="flex:1"><b>Latest update:</b> ${upd}</span></div>
      <div class="row xs mut" style="gap:8px">Team: <div class="stack">${[0, 1, 4, 11, 9].map((i) => photo(i, 22, 22, { round: true })).join('')}</div> +4 · <span>1 away today</span><span style="margin-left:auto"><b style="color:${C.pri}">Open project</b></span></div>
    </div></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="card sec" style="align-items:center;text-align:center"><div style="width:110px;height:110px;border-radius:50%;background:conic-gradient(#4F46E5 0 60%,#DB2777 0 100%);display:flex;align-items:center;justify-content:center"><div style="width:84px;height:84px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:20px">100%</b><span class="xs mut">booked</span></div></div><b style="font-size:13.5px">Your time is fully booked</b><div class="xs mut">Atlas 60% · Helios 40% until 18 Dec · 40% free from 19 Dec</div></div>
    <div class="card sec"><h3>${icon('flag', 15)}Coming up for your projects</h3>
      ${[['24 Oct', 'UAT sign-off', 'Atlas'], ['15 Nov', 'Data migration', 'Helios'], ['18 Dec', 'Go-live', 'Atlas']].map(([d, t, p]) => `<div class="row" style="gap:10px"><span style="width:10px;height:10px;transform:rotate(45deg);background:${C.pri};border-radius:2px"></span><b class="xs" style="width:48px">${d}</b><div><b style="font-size:13px">${t}</b><div class="xs mut">${p}</div></div></div>`).join('')}</div>
    <div class="card sec"><h3>${icon('users', 15)}Away from your teams this week</h3>
      ${[[1, 'Rahul Das', 'Mon–Tue · Atlas'], [8, 'Meena Joshi', 'Fri · Helios']].map(([pi, n, sub]) => `<div class="row" style="gap:10px">${photo(pi, 28, 28, { round: true })}<div><b style="font-size:13px">${n}</b><div class="xs mut">${sub}</div></div></div>`).join('')}</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('My projects', css, html, 1180);
}

const boards = [
  ['CAProjects.dc.html', 'Projects · Portfolio — KPIs, health from milestones + schedule + staffing, next milestone, team, last PM update', portfolio, 1180],
  ['CAProjectsTimeline.dc.html', 'Projects · Timeline — Gantt with milestones and today line, overlaps to watch', timeline, 1180],
  ['CAProjectDetail.dc.html', 'Projects · Project detail — roadmap, weekly PM status updates, milestones with owners, team & approvals, open roles', detail, 1440],
  ['CAResourcePlanner.dc.html', 'Projects · Resource planner (PMO) — weekly allocation heatmap, fix-this-first, find someone free', planner, 1180],
  ['CAMyProjects.dc.html', 'Projects · My projects (employee) — my allocation, my lead/approver, latest update, coming milestones, who’s away', mine, 1180],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 22200 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n13 = { kind: 'title1', maxW: 7600, text: 'Company · Projects — portfolio, timeline, project detail, resource planner, my projects', w: 240, x: 0, y: 21900 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
