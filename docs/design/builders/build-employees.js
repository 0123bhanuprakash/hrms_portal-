// Company app → Employees (HR) and Organisation: list with lifecycle, lifecycle board + add wizard,
// employee profile, org chart with insights.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { sidebar: reportsSidebar, C } = require('./build-reports.js');
const { css: peopleCss, photo, initialsTile, ini } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
  kanban: '<rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="9" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  pin: '<path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  zoomin: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomout: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  fit: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
});

const sidebar = (on = 'Employees') => reportsSidebar().replace('class="sb-i on"', 'class="sb-i"').replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const css = peopleCss.replace('</style>', `
.life{display:flex;gap:0;border:1px solid ${C.border};border-radius:12px;overflow:hidden;background:#fff}
.life span{flex:1;padding:10px 12px;font-size:12px;color:${C.muted};border-right:1px solid ${C.line};display:flex;flex-direction:column;gap:2px}
.life span:last-child{border-right:0}.life span b{font-size:18px;color:${C.fg}}.life span.on{background:${C.priSoft};box-shadow:inset 0 -3px 0 ${C.pri}}
.att{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid ${C.line};font-size:13px}.att:last-child{border-bottom:0}
.att .ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.comp{height:6px;width:70px;border-radius:99px;background:${C.line};overflow:hidden}.comp i{display:block;height:100%;border-radius:99px}
.cb{width:16px;height:16px;border-radius:4px;border:1.5px solid #CBD0DC;display:inline-flex;align-items:center;justify-content:center}.cb.on{background:${C.pri};border-color:${C.pri};color:#fff}
tr.sel td{background:#F5F6FF}
.bulk{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:14px;background:${C.fg};color:#fff;box-shadow:0 20px 40px -12px rgba(0,0,0,.45);font-size:13px;z-index:5}
.bulk .btn{background:#1F2937;border-color:#374151;color:#fff}
.col5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:start}
.lane{background:#EEF0F6;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:420px}
.lane h4{margin:0 2px 2px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${C.muted};display:flex;justify-content:space-between}
.kc{background:#fff;border:1px solid ${C.border};border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.kc .act{display:flex;gap:6px}.kc .act span{flex:1;text-align:center;font-size:11.5px;font-weight:700;padding:5px 0;border-radius:7px;border:1px solid ${C.border}}
.kc .act span.p{background:${C.pri};border-color:${C.pri};color:#fff}
.stepper{display:flex;gap:6px}.stepper div{flex:1;display:flex;flex-direction:column;gap:6px;font-size:11.5px;font-weight:700;color:${C.muted}}.stepper div i{height:4px;border-radius:99px;background:${C.line}}.stepper div.on{color:${C.fg}}.stepper div.on i{background:${C.pri}}.stepper div.done i{background:${C.ok}}
.tl2{display:flex;gap:12px;padding-bottom:14px;position:relative}.tl2::before{content:"";position:absolute;left:14px;top:30px;bottom:0;width:2px;background:${C.line}}.tl2:last-child::before{display:none}
.tl2 .d{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;border:2px solid #fff;box-shadow:0 0 0 1px ${C.border}}
.node{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 10px 10px;border-radius:14px;background:#fff;border:1px solid ${C.border};width:150px;box-shadow:0 4px 14px -8px rgba(17,24,39,.25);position:relative}
.node .cnt{position:absolute;bottom:-11px;left:50%;transform:translateX(-50%);font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;background:${C.fg};color:#fff}
.node.focus{border-color:${C.pri};box-shadow:0 0 0 4px ${C.priSoft},0 10px 24px -12px rgba(79,70,229,.6)}
.node .band{position:absolute;top:0;left:0;right:0;height:4px;border-radius:14px 14px 0 0}
.canvas{position:relative;background-color:#F8F9FC;background-image:radial-gradient(#E3E6EE 1px,transparent 1px);background-size:18px 18px;border-radius:14px;border:1px solid ${C.border};overflow:hidden}
.tools{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:4px;background:#fff;border:1px solid ${C.border};border-radius:10px;padding:4px}
.tools span{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:7px;color:#374151}
</style>`);

const PEOPLE = [
  ['Priya Sharma', 'EMP001', 'Engineering Lead', 'Engineering', 'Ravi Kumar', 'Full-time', 'Active', '2.9 yrs', 100, 0],
  ['Rahul Das', 'EMP014', 'QA Engineer', 'Engineering', 'Priya Sharma', 'Full-time', 'Probation', '5 mo', 72, 3],
  ['Neha Gupta', 'EMP011', 'Sales Associate', 'Sales', 'Meena Joshi', 'Full-time', 'Probation', '5 mo', 58, 4],
  ['Karan Mehta', 'EMP005', 'Engineering Lead', 'Engineering', 'Ravi Kumar', 'Full-time', 'Active', '1.4 yrs', 92, 1],
  ['Sameer Gill', 'EMP019', 'Quality Analyst', 'Quality', 'Vikram Rao', 'Contract', 'Notice period', '1 yr', 88, 5],
  ['Arjun Nair', 'EMP022', 'Product Designer', 'Design', '—', 'Full-time', 'Active', '3 wks', 40, 7],
  ['Hema Iyer', 'EMP003', 'HR Manager', 'Human Resources', 'Vikram Rao', 'Full-time', 'Active', '2.1 yrs', 100, 2],
  ['Ananya Bose', 'EMP024', 'Marketing Associate', 'Marketing', 'Vikram Rao', 'Intern', 'Joining 12 Oct', '—', 20, 6],
];
const statusPill = (s) => (s === 'Active' ? 'p-ok' : s === 'Probation' ? 'p-warn' : s === 'Notice period' ? 'p-bad' : s.startsWith('Joining') ? 'p-pri' : 'p-neu');
const top = (title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">People</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;

// ─── Board 1: employees list ────────────────────────────────
function list() {
  const attn = [
    [C.warnSoft, C.warn, 'calcheck', '2 probations end this month', 'Rahul Das (18 Oct) and Neha Gupta (27 Oct) — confirm or extend', 'Review'],
    [C.badSoft, C.bad, 'flag', '1 exit this month', 'Sameer Gill — last day 29 Oct · exit checklist 2 of 6 done', 'Open checklist'],
    [C.infoSoft, C.info, 'users', '1 person has no manager', 'Arjun Nair — his leave and timesheets have no approver', 'Assign'],
    [C.priSoft, C.pri, 'idcard', '5 profiles are incomplete', 'Missing bank details, PAN or emergency contact', 'Send reminder'],
  ];
  const html = `<div class="app">${sidebar()}<div class="col">${header('People &nbsp;›&nbsp; <b>Employees</b>')}<main class="main">
${top('Employees', 'Everyone in the company — joiners, probation, notice and exits in one place', `<span class="seg" style="display:inline-flex"><span class="on">${icon('list', 13)} Table</span><span>${icon('kanban', 13)} Lifecycle</span></span><span class="btn">${icon('upload', 14)}Import</span><span class="btn pri">${icon('userplus', 14)}Add employee</span>`)}
<div class="life">${[['All', 24, true], ['Joining soon', 1], ['Probation', 3], ['Active', 18], ['Notice period', 1], ['Left · 90 days', 2]].map(([l, n, on]) => `<span class="${on ? 'on' : ''}">${l}<b>${n}</b></span>`).join('')}</div>
<div class="card sec"><h3>${icon('alert', 15)}Needs your attention<span class="r">4 things</span></h3>
  <div class="g2" style="gap:0 24px">${attn.map(([soft, col, ic, t, d, a]) => `<div class="att"><span class="ic" style="background:${soft};color:${col}">${icon(ic, 15)}</span><div style="flex:1;min-width:0"><b>${t}</b><div class="xs mut" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d}</div></div><span class="btn sm">${a}</span></div>`).join('')}</div>
</div>
<div class="card" style="overflow:hidden">
  <div class="row" style="padding:12px 14px;border-bottom:1px solid ${C.border};gap:8px;flex-wrap:wrap"><div class="search" style="height:36px;flex:0 0 280px;font-size:13px">${icon('search', 14)} Search name, email, ID or title</div>
    <span class="chip">${icon('network', 13)}Department ▾</span><span class="chip">${icon('pin', 13)}Location ▾</span><span class="chip">Type ▾</span><span class="chip on">Manager: anyone ▾</span>
    <span class="xs mut" style="margin-left:auto">Saved view: <b style="color:${C.pri}">All employees ▾</b></span><span class="btn sm">${icon('columns', 13)}Columns</span></div>
  <table><thead><tr><th style="width:18px"><span class="cb"></span></th><th>Employee</th><th>Title &amp; team</th><th>Manager</th><th>Type</th><th>Status</th><th>Tenure</th><th>Profile</th><th></th></tr></thead><tbody>
  ${PEOPLE.map((p, i) => { const [n, id, t, d, m, ty, st, ten, comp] = p; const sel = i === 1 || i === 2; return `<tr class="${sel ? 'sel' : ''}"><td><span class="cb ${sel ? 'on' : ''}">${sel ? icon('check2', 10) : ''}</span></td>
    <td><span class="row" style="gap:10px">${i === 7 ? initialsTile(ini(n), 36, 36, C.pink) : photo(p[9], 36, 36, { long: [0, 2, 6, 7].includes(i) })}<span><b>${n}</b><div class="xs mut">${id}</div></span></span></td>
    <td>${t}<div class="xs mut">${d}</div></td><td>${m === '—' ? `<span class="pill p-warn">No manager</span>` : `<span class="mut">${m}</span>`}</td><td class="mut">${ty}</td>
    <td><span class="pill ${statusPill(st)}">${st}</span></td><td class="mut">${ten}</td>
    <td><span class="row" style="gap:6px"><span class="comp"><i style="width:${comp}%;background:${comp === 100 ? C.ok : comp >= 70 ? C.teal : C.warn}"></i></span><span class="xs mut">${comp}%</span></span></td><td class="mut">${icon('dots', 16)}</td></tr>`; }).join('')}
  </tbody></table>
  <div class="row xs mut" style="padding:12px 16px;justify-content:space-between"><span>1–8 of 24</span><span>Rows 25 ▾ · ‹ ›</span></div>
</div>
</main></div>
<div class="bulk"><b>2 selected</b><span class="btn sm">Change manager</span><span class="btn sm">Move team</span><span class="btn sm">${icon('mail', 13)}Remind to finish profile</span><span class="btn sm">${icon('dl', 13)}Export</span><span class="btn sm" style="border:0;background:none">${icon('x', 14)}</span></div></div>`;
  return dcPage('Employees list', css, html, 1180);
}

// ─── Board 2: lifecycle board + add wizard ──────────────────
function lifecycle() {
  const lanes = [
    ['Joining soon', C.pri, [[7, 'Ananya Bose', 'Marketing Associate', 'Starts 12 Oct · 7 days', ['Send welcome', 'Checklist 3/7'], 20]]],
    ['Probation', C.warn, [[1, 'Rahul Das', 'QA Engineer', 'Ends 18 Oct', ['Confirm', 'Extend'], 72], [3, 'Neha Gupta', 'Sales Associate', 'Ends 27 Oct', ['Confirm', 'Extend'], 58], [11, 'Dev Menon', 'DevOps Engineer', 'Ends 4 Jan', ['Confirm', 'Extend'], 80]]],
    ['Active', C.ok, [[0, 'Priya Sharma', 'Engineering Lead', '2.9 yrs · 3 yrs on 21 Oct', ['Profile'], 100], [6, 'Hema Iyer', 'HR Manager', '2.1 yrs', ['Profile'], 100], [9, 'Ravi Kumar', 'Eng. Manager', '3.4 yrs', ['Profile'], 96]]],
    ['Notice period', C.bad, [[5, 'Sameer Gill', 'Quality Analyst', 'Last day 29 Oct', ['Exit checklist 2/6'], 88]]],
    ['Left · 90 days', C.muted, [[8, 'Tanvi Shah', 'Quality Analyst', 'Left 12 Sep', ['Rehire?'], 100], [10, 'Dev V', 'Support', 'Left 2 Aug', ['Profile'], 100]]],
  ];
  const html = `<div class="app">${sidebar()}<div class="col">${header('People &nbsp;›&nbsp; <b>Employees</b>')}<main class="main">
${top('Employees', 'Lifecycle — move people from joining to probation to active, and plan exits', `<span class="seg" style="display:inline-flex"><span>${icon('list', 13)} Table</span><span class="on">${icon('kanban', 13)} Lifecycle</span></span><span class="btn pri">${icon('userplus', 14)}Add employee</span>`)}
<div class="col5">${lanes.map(([l, col, cards]) => `<div class="lane"><h4><span><span style="color:${col}">●</span> ${l}</span><span>${cards.length}</span></h4>
  ${cards.map(([pi, n, t, d, acts, comp]) => `<div class="kc"><div class="row" style="gap:8px">${photo(pi, 34, 34, { long: [0, 3, 6, 7].includes(pi) })}<div style="min-width:0;flex:1"><b style="font-size:13px">${n}</b><div class="xs mut" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</div></div></div>
    <div class="xs" style="color:${col};font-weight:700">${d}</div>
    ${comp < 100 ? `<div class="row xs mut" style="gap:6px"><span class="comp" style="flex:1;width:auto"><i style="width:${comp}%;background:${comp >= 70 ? C.teal : C.warn}"></i></span>profile ${comp}%</div>` : ''}
    <div class="act">${acts.map((a, i) => `<span class="${i === 0 && ['Confirm', 'Send welcome'].includes(a) ? 'p' : ''}">${a}</span>`).join('')}</div></div>`).join('')}
</div>`).join('')}</div>
</main></div>
<div class="dim"></div>
<div class="modal" style="width:620px;top:70px">
  <div style="padding:18px 22px;border-bottom:1px solid ${C.border}" class="row"><div style="flex:1"><b style="font-size:17px">Add employee</b><div class="xs mut">Step 2 of 4 · about 2 minutes</div></div>${icon('x', 16)}</div>
  <div style="padding:16px 22px;display:flex;flex-direction:column;gap:14px">
    <div class="stepper"><div class="done"><i></i>Basics</div><div class="on"><i></i>Job</div><div><i></i>Manager &amp; access</div><div><i></i>Invite</div></div>
    <div class="row" style="gap:16px;align-items:flex-start">
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">
        <div class="fld"><label>Job title</label><div class="inp">Frontend Engineer ▾</div></div>
        <div class="row" style="gap:10px"><div class="fld" style="flex:1"><label>Department</label><div class="inp">Engineering ▾</div></div><div class="fld" style="flex:1"><label>Location</label><div class="inp">Bengaluru HQ ▾</div></div></div>
        <div class="row" style="gap:10px"><div class="fld" style="flex:1"><label>Type</label><div class="inp">Full-time ▾</div></div><div class="fld" style="flex:1"><label>Joining date</label><div class="inp">12 Oct 2026</div></div></div>
        <div class="fld"><label>Probation</label><div class="row xs" style="gap:6px"><span class="chip" style="height:28px">None</span><span class="chip" style="height:28px">3 months</span><span class="chip on" style="height:28px">6 months</span><span class="mut">ends 12 Apr 2027</span></div></div>
      </div>
      <div style="width:210px"><div class="xs mut" style="font-weight:800;letter-spacing:.06em;margin-bottom:8px">PREVIEW</div>
        <div class="card pc">${initialsTile('AK', 208, 130, C.pri)}<div class="body"><b class="n">Arjun Kapoor</b><span class="role">Frontend Engineer</span><div class="row" style="gap:6px;margin-top:4px"><span class="tag">Engineering</span><span class="pill p-pri" style="font-size:10px">Joins 12 Oct</span></div></div></div>
        <div class="xs mut" style="margin-top:8px">ID <b style="color:${C.fg}">EMP025</b> is next in line</div></div>
    </div>
  </div>
  <div class="row" style="padding:14px 22px;border-top:1px solid ${C.border};justify-content:space-between"><span class="btn">Back</span><span class="row"><span class="xs mut">Saved as a draft</span><span class="btn pri">Next: manager &amp; access ${icon('chev', 13)}</span></span></div>
</div></div>`;
  return dcPage('Employees lifecycle', css, html, 1180);
}

// ─── Board 3: employee profile ──────────────────────────────
function profile() {
  const html = `<div class="app">${sidebar()}<div class="col">${header('People &nbsp;›&nbsp; Employees &nbsp;›&nbsp; <b>Rahul Das</b>')}<main class="main">
<div class="card" style="overflow:hidden">
  <div style="height:110px;background:linear-gradient(120deg,${C.pri},#8B5CF6 60%,#EC4899);position:relative"><span class="btn sm" style="position:absolute;right:14px;top:14px;background:rgba(255,255,255,.9);border:0">${icon('edit', 13)}Edit</span></div>
  <div class="row" style="padding:0 22px 18px;margin-top:-46px;align-items:flex-end;gap:16px">
    <div style="border:5px solid #fff;border-radius:22px;box-shadow:0 10px 22px -10px rgba(0,0,0,.4)">${photo(1, 104, 104)}</div>
    <div style="flex:1;padding-bottom:4px"><div class="row" style="gap:8px"><b style="font-size:22px">Rahul Das</b><span class="pill p-warn">Probation · ends 18 Oct</span><span class="pill p-ok">● Checked in 9:47</span></div>
      <div class="mut" style="font-size:13.5px">QA Engineer · Engineering · EMP014 · reports to <b style="color:${C.fg}">Priya Sharma</b></div></div>
    <div class="row" style="padding-bottom:4px"><span class="btn pri">Confirm probation</span><span class="btn">Extend</span><span class="btn">${icon('dots', 15)}</span></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid ${C.line}">${[['Leave left', '9 days', 'Casual 4 · Sick 5'], ['Attendance · Oct', '96%', '1 late'], ['Projects', '2', 'Atlas 60% · Nova 40%'], ['Assets', '2', 'MacBook · ID card'], ['Profile', '72%', '3 things missing']].map(([l, v, s], i) => `<div style="padding:12px 18px;${i < 4 ? `border-right:1px solid ${C.line}` : ''}"><div class="xs mut">${l}</div><b style="font-size:17px">${v}</b><div class="xs mut">${s}</div></div>`).join('')}</div>
</div>
<div class="row" style="gap:20px;border-bottom:1px solid ${C.border};font-size:14px;color:${C.muted};padding:0 4px">${['Overview', 'Job & history', 'Personal', 'Bank & IDs', 'Documents', 'Leave', 'Projects', 'Assets'].map((t, i) => `<span style="padding:10px 0;${i === 0 ? `color:${C.fg};font-weight:700;box-shadow:inset 0 -2px 0 ${C.pri}` : ''}">${t}</span>`).join('')}</div>
<div class="g21">
  <div class="card sec"><h3>${icon('clock', 15)}Employment history<span class="r">every change, with who made it</span></h3>
    ${[[C.pri, C.priSoft, 'userplus', 'Joined as QA Engineer', 'Engineering · Bengaluru HQ · Full-time · probation 6 months', '18 Apr 2026 · added by Hema Iyer'], [C.info, C.infoSoft, 'network', 'Manager changed', 'Karan Mehta → Priya Sharma', '2 Jun 2026 · by Hema Iyer'], [C.teal, '#E1F5F2', 'folder', 'Added to Atlas (60%) and Nova (40%)', 'Projects', '10 Jun 2026 · by Ravi Kumar'], [C.warn, C.warnSoft, 'flag', 'Probation review due', 'Confirm or extend by 18 Oct', 'in 13 days'], [C.ok, C.okSoft, 'rocket', 'Next: confirmation', 'Becomes Active · leave allocation changes', 'after review']].map(([c, soft, ic, t, d, w], i) => `<div class="tl2"><span class="d" style="background:${soft};color:${c}">${icon(ic, 14)}</span><div style="flex:1;${i >= 3 ? 'opacity:.75' : ''}"><b style="font-size:13.5px">${t}</b><div class="xs mut">${d}</div><div class="xs" style="color:${C.muted};margin-top:2px">${w}</div></div></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec"><h3>${icon('check', 15)}Profile · 72%<span class="r">Rahul gets a reminder</span></h3>
      ${[[1, 'Photo'], [1, 'Phone number'], [1, 'Date of birth'], [0, 'Emergency contact'], [0, 'Bank account'], [0, 'PAN']].map(([ok, t]) => `<div class="row xs" style="gap:8px;padding:4px 0"><span style="width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${ok ? C.okSoft : C.warnSoft};color:${ok ? C.ok : C.warn};font-weight:800">${ok ? '✓' : '!'}</span><span style="font-size:13px;${ok ? '' : 'font-weight:700'}">${t}</span>${ok ? '' : '<span class="mut" style="margin-left:auto">missing</span>'}</div>`).join('')}
      <span class="btn sm" style="align-self:flex-start">${icon('mail', 13)}Send reminder</span></div>
    <div class="card sec"><h3>${icon('network', 15)}Team</h3>
      <div class="mini">${photo(0, 34, 34, { long: true })}<div style="flex:1"><b style="font-size:13px">Priya Sharma</b><div class="xs mut">Engineering Lead · manager</div></div></div>
      <div class="row xs mut" style="gap:8px">Works with <div class="stack">${[4, 9, 11, 3].map((i) => photo(i, 28, 28, { round: true })).join('')}</div> +3</div></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Employee profile', css, html, 1180);
}

// ─── Board 4: organisation ──────────────────────────────────
function org() {
  const n = (pi, name, role, cnt, band, cls = '', long = false) => `<div class="node ${cls}"><span class="band" style="background:${band}"></span>${photo(pi, 52, 52, { long })}<b style="font-size:12.5px">${name}</b><span class="xs mut" style="text-align:center;line-height:1.2">${role}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}</div>`;
  const line = (x1, y1, x2, y2) => `<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" fill="none" stroke="#C7CBD8" stroke-width="2"/>`;
  const html = `<div class="app">${sidebar('Organisation')}<div class="col">${header('Organisation &nbsp;›&nbsp; <b>Org chart</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Organisation</div><h1>Organisation</h1><div class="sub">Who reports to whom, how teams nest, levels and offices</div></div><span class="btn">${icon('image', 14)}Export image</span></div>
<div class="row" style="gap:20px;border-bottom:1px solid ${C.border};font-size:14px;color:${C.muted};padding:0 4px">${['Org chart', 'Departments', 'Levels & titles', 'Locations', 'Insights'].map((t, i) => `<span style="padding:10px 0;${i === 0 ? `color:${C.fg};font-weight:700;box-shadow:inset 0 -2px 0 ${C.pri}` : ''}">${t}${i === 4 ? ' <span class="pill p-warn" style="font-size:10px;padding:1px 6px">3</span>' : ''}</span>`).join('')}</div>
<div class="g21" style="grid-template-columns:1fr 330px">
  <div class="canvas" style="height:560px">
    <div class="row" style="position:absolute;left:12px;top:12px;gap:8px"><div class="search" style="height:34px;width:230px;flex:none;font-size:13px">${icon('search', 14)} Find a person…</div><span class="chip on" style="height:34px">Colour: department ▾</span><span class="chip" style="height:34px">Show: photos ▾</span></div>
    <div class="tools"><span>${icon('zoomin', 15)}</span><span>${icon('zoomout', 15)}</span><span>${icon('fit', 15)}</span></div>
    <svg style="position:absolute;inset:0" width="100%" height="100%" viewBox="0 0 900 560" preserveAspectRatio="none">${line(450, 175, 220, 245)}${line(450, 175, 450, 245)}${line(450, 175, 680, 245)}${line(220, 380, 130, 420)}${line(220, 380, 310, 420)}</svg>
    <div style="position:absolute;left:375px;top:60px">${n(5, 'Vikram Rao', 'Head of Operations · CEO office', 23, C.muted)}</div>
    <div style="position:absolute;left:145px;top:245px">${n(9, 'Ravi Kumar', 'Engineering Manager', 9, C.pri, 'focus')}</div>
    <div style="position:absolute;left:375px;top:245px">${n(2, 'Hema Iyer', 'HR Manager', 2, C.teal, '', true)}</div>
    <div style="position:absolute;left:605px;top:245px">${n(8, 'Meena Joshi', 'Sales Manager', 3, C.warn, '', true)}</div>
    <div style="position:absolute;left:55px;top:420px;transform:scale(.85);transform-origin:top left">${n(0, 'Priya Sharma', 'Engineering Lead', 4, C.pri, '', true)}</div>
    <div style="position:absolute;left:240px;top:420px;transform:scale(.85);transform-origin:top left">${n(1, 'Karan Mehta', 'Engineering Lead', 3, C.pri)}</div>
    <div class="xs mut" style="position:absolute;left:12px;bottom:10px">Drag a card onto a manager to change reporting — you’ll see who’s affected first · click a count to expand</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="card sec"><h3>${icon('network', 15)}Ravi Kumar’s team<span class="r">focused</span></h3>
      <div class="row" style="gap:16px">${[['Direct', 2], ['Whole team', 9], ['Levels', 3]].map(([l, v]) => `<div><div class="xs mut">${l}</div><b style="font-size:20px">${v}</b></div>`).join('')}</div>
      <div class="row xs mut" style="gap:8px"><div class="stack">${[0, 1, 4, 11, 3].map((i) => photo(i, 28, 28, { round: true })).join('')}</div>+4</div>
      <div class="row"><span class="btn sm">Open profile</span><span class="btn sm">Show only this team</span></div></div>
    <div class="card sec"><h3>${icon('alert', 15)}Org health<span class="r">3 to look at</span></h3>
      ${[[C.warn, 'Vikram has 9 direct reports', 'More than 8 can be hard to manage well'], [C.info, 'Arjun Nair has no manager', 'His approvals have nowhere to go'], [C.muted, 'Design has no head', 'Set one in Departments']].map(([c, t, d]) => `<div class="att"><span style="width:8px;height:8px;border-radius:50%;background:${c};flex:none"></span><div style="flex:1"><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div><span class="xs" style="color:${C.pri};font-weight:700">Fix</span></div>`).join('')}</div>
    <div class="card sec"><h3>${icon('building', 15)}Departments</h3>
      ${[['Engineering', 9, C.pri, 'Ravi Kumar'], ['Sales', 3, C.warn, 'Meena Joshi'], ['Human Resources', 2, C.teal, 'Hema Iyer'], ['Design', 1, C.pink, 'No head']].map(([d, c, col, h]) => `<div><div class="row xs"><span style="width:8px;height:8px;border-radius:3px;background:${col}"></span><b style="flex:1;font-size:13px">${d}</b><span class="mut">${h} · ${c}</span></div><div class="bar" style="margin-top:4px;height:6px"><i style="width:${(c / 9) * 100}%;background:${col}"></i></div></div>`).join('')}</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Organisation', css, html, 1180);
}

const boards = [
  ['CAEmployees.dc.html', 'Company · Employees — lifecycle counts, needs attention, richer table with profile %, bulk actions', list, 1180],
  ['CAEmployeesLifecycle.dc.html', 'Company · Employees — lifecycle board (joining → probation → active → notice → left) + add-employee steps', lifecycle, 1180],
  ['CAEmployeeProfile.dc.html', 'Company · Employee profile — header with actions, at-a-glance numbers, employment history, profile checklist', profile, 1180],
  ['CAOrganisation.dc.html', 'Company · Organisation — photo org chart with zoom & focus, team panel, org health, departments', org, 1180],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 17200 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n10 = { kind: 'title1', maxW: 6000, text: 'Company · Employees & Organisation — list, lifecycle, profile, org chart', w: 240, x: 0, y: 16900 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
