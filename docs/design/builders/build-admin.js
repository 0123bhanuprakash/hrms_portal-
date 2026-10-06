// Company app → Administration: Users, Roles & permissions, Access explorer; animation ideas;
// who sees what; plus a review of every popup form in the app and a new form kit.
// Sidebar and top bar stay exactly as in the app (the ADMINISTRATION group keeps its 3 items).
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { C } = require('./build-reports.js');
const { css: peopleCss, photo, PEOPLE } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

Object.assign(P, {
  check2: '<path d="M20 6 9 17l-5-5"/>',
  x2: '<path d="M18 6 6 18M6 6l12 12"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  wand: '<path d="m15 4 5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  diff: '<path d="M12 3v14M5 10h14"/><path d="M5 21h14"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
});

// ─── Shell: the real sidebar (ADMINISTRATION group open on the current page) ─────────
const ADM = [['usercog', 'Users'], ['shield', 'Roles & permissions'], ['scan', 'Access explorer']];
const sidebar = (on) => `<aside class="sb">
<div class="sb-h"><span class="logo">AP</span><span><b>aakash-portal</b><span>HR workspace</span></span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Home</div><div class="sb-i">${icon('idcard')}My profile</div><div class="sb-i">${icon('chart')}Reports &amp; analytics</div><div class="sb-i">${icon('contact')}People</div>
<div class="sb-g">ORGANIZATION ›</div><div class="sb-g">ENGAGEMENT ›</div><div class="sb-g">WORK ›</div><div class="sb-g">EXPENSES ›</div><div class="sb-g">ASSETS ›</div><div class="sb-g">HELPDESK ›</div><div class="sb-g">TIME ›</div>
<div class="sb-g">ADMINISTRATION</div>${ADM.map(([ic, l]) => `<div class="sb-i${l === on ? ' on' : ''}">${icon(ic)}<span style="flex:1">${l}</span></div>`).join('')}
<div class="sb-g">SETTINGS ›</div>
</aside>`;
const header = (crumb) => `<header class="hdr"><div class="crumb">Administration &nbsp;›&nbsp; <b>${crumb}</b></div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const page = (on, crumb, body, overlay = '') => `<div class="app">${sidebar(on)}<div class="col">${header(crumb)}<main class="main">${body}</main></div>${overlay}</div>`;
const NEW = '<span class="new">New</span>';
const note = (items) => `<div class="card notes"><b class="xs" style="letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">What changes</b>${items.map(([k, t]) => `<div class="xs"><span class="${k === 'new' ? 'k-new' : k === 'q' ? 'k-q' : k === 'fix' ? 'k-fix' : 'k-old'}">${k === 'new' ? 'New' : k === 'q' ? 'Ask' : k === 'fix' ? 'Fix' : 'Today'}</span>${t}</div>`).join('')}</div>`;
const av = (i, s = 30) => photo(i, s, s, { round: true, long: PEOPLE[i % PEOPLE.length][5] });
const nm = (i) => PEOPLE[i % PEOPLE.length][0];
const first = (i) => nm(i).split(' ')[0];
const email = (i) => `${first(i).toLowerCase()}.aakash@yopmail.com`;

// Role colours (each role gets its own colour everywhere: chip, card stripe, explorer source)
const ROLE = {
  admin: ['Company Admin', '#B45309', '#FEF3C7'], hr: ['HR', C.pink, '#FCE7F3'], manager: ['Manager', C.pri, C.priSoft], lead: ['Team Lead', C.teal, '#E6F6F4'],
  it: ['IT Admin', C.info, C.infoSoft], fin: ['Finance', '#65A30D', '#ECFCCB'], devops: ['DevOps', C.violet, '#F1EBFE'], pmo: ['PMO', '#EA580C', '#FFEDD5'], emp: ['Employee', '#475569', '#F1F5F9'],
};
const rc = (k, extra = '') => `<span class="rchip" style="background:${ROLE[k][2]};color:${ROLE[k][1]}">${k === 'admin' ? icon('crown', 11) : ''}${ROLE[k][0]}${extra}</span>`;
const SCOPES = [['Self', 'Only themselves'], ['Direct', 'Direct reports'], ['Team', 'Whole team below'], ['Dept', 'Their department'], ['Dept+', 'Dept + sub-depts'], ['Office', 'Their office'], ['Company', 'Whole company']];
const ladder = (on, { compact = false, lockAfter = 99 } = {}) => `<span class="ladder${compact ? ' cp' : ''}">${SCOPES.map(([k, l], i) => `<span class="${i === on ? 'on' : i < on ? 'past' : ''}${i > lockAfter ? ' lk' : ''}" title="${l}">${compact ? '' : k}</span>`).join('')}</span>`;

const css = peopleCss.replace('</style>', `
.new{display:inline-flex;font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:99px;background:#DCFCE7;color:#166534;vertical-align:middle;margin-left:6px}
.notes{padding:12px 14px;display:flex;flex-direction:column;gap:6px;background:${C.raised}}
.k-new,.k-old,.k-q,.k-fix{display:inline-block;min-width:44px;font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-right:6px}
.k-new{color:#16A34A}.k-old{color:${C.muted}}.k-q{color:${C.warn}}.k-fix{color:${C.bad}}
.sec2{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.lbl{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:${C.muted}}
.num{font-size:24px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.rchip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}.tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};text-align:left;padding:8px 10px;background:${C.raised};border-bottom:1px solid ${C.border}}.tbl td{padding:9px 10px;border-bottom:1px solid ${C.line};vertical-align:middle}
.tbl tr.sel td{background:${C.priSoft}}
.cb{width:15px;height:15px;border-radius:4px;border:1.5px solid #CBD2DE;display:inline-flex;align-items:center;justify-content:center;background:#fff;flex:none}.cb.on{background:${C.pri};border-color:${C.pri};color:#fff}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.ladder{display:inline-flex;border-radius:9px;background:${C.raised};border:1px solid ${C.border};padding:2px;gap:2px}
.ladder span{font-size:10.5px;font-weight:700;padding:4px 7px;border-radius:7px;color:${C.muted};white-space:nowrap}
.ladder span.past{background:${C.priSoft};color:${C.priText}}.ladder span.on{background:${C.pri};color:#fff}.ladder span.lk{opacity:.35}
.ladder.cp span{width:16px;height:10px;padding:0;border-radius:3px}
.tile{padding:12px;border-radius:12px;background:${C.raised};display:flex;flex-direction:column;gap:2px}
.alertrow{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;font-size:12.5px}
.ovl{position:absolute;inset:0;background:rgba(17,24,39,.38);backdrop-filter:blur(2px)}
.drw{position:absolute;top:0;right:0;bottom:0;width:520px;background:#fff;border-left:1px solid ${C.border};box-shadow:-20px 0 50px rgba(17,24,39,.15);display:flex;flex-direction:column}
.drw .dh{padding:18px 20px;border-bottom:1px solid ${C.border}}.drw .db{flex:1;overflow:hidden;padding:16px 20px;display:flex;flex-direction:column;gap:12px}.drw .df{padding:12px 20px;border-top:1px solid ${C.border};display:flex;gap:8px;justify-content:flex-end;background:${C.raised}}
.mdl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:16px;box-shadow:0 30px 80px rgba(17,24,39,.3);display:flex;flex-direction:column;overflow:hidden}
.mh{padding:16px 20px;display:flex;gap:12px;align-items:flex-start;border-bottom:1px solid ${C.line}}.mb{padding:16px 20px;display:flex;flex-direction:column;gap:14px}.mf{padding:12px 20px;border-top:1px solid ${C.border};display:flex;gap:8px;align-items:center;background:${C.raised}}
.mic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.f{display:flex;flex-direction:column;gap:5px}.f>label{font-size:12px;font-weight:700}.f .h{font-size:11px;color:${C.muted}}.f .er{font-size:11px;color:${C.bad};font-weight:700}
.in{height:36px;border:1px solid ${C.border};border-radius:9px;padding:0 11px;display:flex;align-items:center;gap:8px;font-size:12.5px;background:#fff}.in.ph{color:#9CA3AF}.in.foc{border-color:${C.pri};box-shadow:0 0 0 3px ${C.priSoft}}.in.bad{border-color:${C.bad};box-shadow:0 0 0 3px ${C.badSoft}}.in.ok{border-color:${C.ok}}
.secn{display:flex;gap:10px;align-items:center;font-size:12.5px;font-weight:800}.secn i{width:20px;height:20px;border-radius:50%;background:${C.priSoft};color:${C.pri};font-style:normal;font-size:11px;display:flex;align-items:center;justify-content:center}
.kbd{font-size:10px;font-weight:800;border:1px solid ${C.border};border-bottom-width:2px;border-radius:5px;padding:0 5px;color:${C.muted};background:#fff}
.bad2{background:${C.badSoft};color:${C.bad}}.good2{background:${C.okSoft};color:${C.ok}}
.prob{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:start;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid ${C.border}}
.prob .n2{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}
.big{font-size:22px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
/* motion */
.stg>*{animation:rise .5s cubic-bezier(.2,.8,.2,1) both}.stg>*:nth-child(2){animation-delay:.06s}.stg>*:nth-child(3){animation-delay:.12s}.stg>*:nth-child(4){animation-delay:.18s}.stg>*:nth-child(5){animation-delay:.24s}.stg>*:nth-child(6){animation-delay:.3s}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
@keyframes wbar{from{transform:scaleX(0)}}.wb{transform-origin:left;animation:wbar 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes ripple{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.5);opacity:0}}
.rip{position:absolute;border-radius:50%;border:2px solid ${C.pri};animation:ripple 2.4s ease-out infinite}
@keyframes fly{0%,20%{transform:translate(0,0) scale(1);opacity:1}60%{transform:translate(170px,0) scale(.9);opacity:1}75%,100%{transform:translate(170px,0) scale(.9);opacity:0}}
@keyframes land{0%,58%{opacity:0;transform:scale(.6)}70%,100%{opacity:1;transform:scale(1)}}
@keyframes shimmer{0%{background-position:-120px 0}100%{background-position:220px 0}}
.shim{background:linear-gradient(100deg,#FEF3C7 30%,#FFFBEB 50%,#FEF3C7 70%);background-size:200px 100%;animation:shimmer 2.2s linear infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(217,119,6,.45)}50%{box-shadow:0 0 0 7px rgba(217,119,6,0)}}
.pulse{animation:pulse 1.8s ease-in-out infinite}
@keyframes slideL{0%,15%{left:3px}45%,60%{left:calc(57% + 3px)}90%,100%{left:3px}}
@keyframes dash{to{stroke-dashoffset:0}}.path{stroke-dasharray:240;stroke-dashoffset:240;animation:dash 1.6s ease forwards}
@keyframes tick{0%,30%{transform:scale(0)}45%{transform:scale(1.2)}55%,100%{transform:scale(1)}}
@keyframes morph{0%,30%{width:110px;border-radius:9px}45%,100%{width:36px;border-radius:50%}}
@keyframes txt{0%,28%{opacity:1}33%,100%{opacity:0}}
@keyframes shake{0%,100%{transform:none}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
.shake{animation:shake .5s ease 1s 1}
@keyframes sheet{0%,10%{transform:translateY(100%)}35%,100%{transform:none}}
@keyframes cnt{from{opacity:.2;transform:translateY(6px)}}
.demo{background:#fff;border:1px solid ${C.border};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px}
.stage{height:130px;border-radius:12px;background:${C.raised};display:flex;align-items:center;justify-content:center;gap:10px;padding:0 16px;position:relative;overflow:hidden}
.where{font-size:10.5px;font-weight:800;color:${C.pri};background:${C.priSoft};padding:2px 8px;border-radius:99px;align-self:flex-start}
.seg2{display:inline-flex;background:${C.raised};border:1px solid ${C.border};border-radius:9px;padding:2px}.seg2 span{font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:7px;color:${C.muted}}.seg2 span.on{background:#fff;color:${C.fg};box-shadow:0 1px 2px rgba(0,0,0,.08)}
</style>`);

// ─── 1 · Users ──────────────────────────────────────────────
const USERS = [
  [2, 'admin,hr', 'act', '2 min ago', 'HR001', 0],
  [0, 'manager,lead', 'act', '1 h ago', 'AK002', 0],
  [1, 'lead', 'act', 'yesterday', 'AK003', 0],
  [3, 'fin', 'act', '3 days ago', 'AK004', 0],
  [4, 'it,devops', 'act', 'today', 'AK005', 0],
  [5, 'emp', 'inv', 'Never', 'AK006', 9],
  [6, 'emp', 'inv', 'Never', 'AK007', 2],
  [7, 'pmo,emp', 'act', '41 days ago', 'AK008', 0],
  [8, 'emp', 'off', '2 months ago', 'AK009', 0],
];
const statusPill = (s, days) =>
  s === 'act' ? `<span class="pill p-ok"><i class="dot" style="background:${C.ok}"></i>Active</span>`
  : s === 'inv' ? `<span class="pill p-pri"><i class="dot" style="background:${C.info}"></i>Invited · ${days}d</span>`
  : `<span class="pill p-neu"><i class="dot" style="background:#9CA3AF"></i>Inactive</span>`;
const userRow = ([i, roles, s, last, eid, d], sel) => `<tr class="${sel ? 'sel' : ''}"><td style="width:24px"><span class="cb${sel ? ' on' : ''}">${sel ? icon('check2', 10) : ''}</span></td>
<td><div class="row" style="gap:10px">${av(i, 34)}<div><b style="font-size:13px">${nm(i)}</b>${i === 2 ? ' <span class="pill p-neu" style="font-size:10px">You</span>' : ''}<div class="xs mut">${email(i)} · <span style="font-family:monospace">${eid}</span></div></div></div></td>
<td><div class="row" style="gap:4px;flex-wrap:wrap">${roles.split(',').map((k) => rc(k)).join('')}</div></td>
<td>${statusPill(s, d)}</td>
<td class="xs ${last === 'Never' || last.startsWith('41') ? '' : 'mut'}" style="${last.startsWith('41') ? `color:${C.warn};font-weight:700` : ''}">${last}</td>
<td style="text-align:right;color:${C.muted}">${icon('more', 16)}</td></tr>`;

function users() {
  const html = page('Users', 'Users', `
${top('Administration', 'Users', 'Everyone who can sign in, and the roles that decide what they can do.', `<div class="row" style="gap:8px"><span class="btn">${icon('upload', 14)}Invite many${NEW}</span><span class="btn pri">${icon('plus', 14)}Invite user</span></div>`)}
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" class="stg">
  ${[['Active', 186, C.ok, 'signed in this month: 171'], ['Invited, not joined', 4, C.info, '2 waiting over 7 days'], ['Inactive', 9, '#9CA3AF', 'can’t sign in, data kept'], ['Admins', 3, '#B45309', 'Company Admin role']].map(([l, v, col, s]) => `<div class="card sec2" style="gap:2px;border-top:3px solid ${col}"><div class="lbl">${l}</div><div class="num" style="color:${col};animation:cnt .8s ease both">${v}</div><div class="xs mut">${s}</div></div>`).join('')}
</div>
<div class="card sec2" style="gap:8px">
  <div class="row"><b style="font-size:13.5px;flex:1">${icon('sparkle', 15)} Needs a look ${NEW}</b><span class="xs mut">3 things</span></div>
  <div class="alertrow" style="background:${C.infoSoft}">${icon('mail', 15)}<span style="flex:1"><b>2 invites</b> are older than 7 days — Vikram and Ananya never signed in.</span><span class="btn sm">Resend both</span></div>
  <div class="alertrow" style="background:${C.warnSoft}">${icon('alert', 15)}<span style="flex:1"><b>Arjun</b> has the PMO role but hasn’t signed in for 41 days.</span><span class="btn sm">Review access</span></div>
  <div class="alertrow" style="background:#F1EBFE">${icon('shield', 15)}<span style="flex:1"><b>3 people</b> can see salary and bank details (Company Admin, HR, Finance).</span><span class="btn sm">See who</span></div>
</div>
<div class="card" style="overflow:hidden">
  <div class="row" style="padding:10px 12px;gap:10px;border-bottom:1px solid ${C.border}">
    <span class="seg2"><span class="on">All 199</span><span>Active 186</span><span>Invited 4</span><span>Inactive 9</span></span>
    <span style="flex:1"></span>
    <span class="in ph" style="width:220px">${icon('search', 14)}Search name, email or ID</span>
  </div>
  <div class="row" style="padding:8px 12px;gap:6px;border-bottom:1px solid ${C.line};flex-wrap:wrap"><span class="xs mut" style="margin-right:4px">Role</span>${Object.keys(ROLE).map((k) => rc(k, `<span style="opacity:.6;font-weight:700"> ${{ admin: 3, hr: 4, manager: 11, lead: 40, it: 2, fin: 3, devops: 5, pmo: 2, emp: 199 }[k]}</span>`)).join('')}<span class="xs mut" style="margin-left:auto">${NEW} click a role to filter</span></div>
  <div class="row" style="padding:8px 12px;gap:10px;background:${C.priSoft};font-size:12.5px"><b style="color:${C.priText}">2 selected</b><span class="btn sm">${icon('shield', 12)}Add a role</span><span class="btn sm">${icon('mail', 12)}Resend invites</span><span class="btn sm" style="color:${C.bad}">${icon('x2', 12)}Deactivate</span><span style="flex:1"></span><span class="xs mut">${NEW} bulk actions</span></div>
  <table class="tbl"><thead><tr><th></th><th>User</th><th>Roles</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>${USERS.map((u, i) => userRow(u, i === 5 || i === 6)).join('')}</tbody></table>
</div>
${note([['old', 'Table with name, roles, status, last sign-in, the ⋯ menu, tabs and role filter stay.'], ['new', 'Count tiles, “Needs a look” (old invites, unused access, who sees salary), role chips as filter, bulk select, Invite many.'], ['new', 'Each role has its own colour — the same colour on Roles and in the Access explorer.'], ['new', 'Click a row → the person drawer (next board) instead of only the ⋯ menu.'], ['fix', '“No employee profile” badge goes away: everyone is an employee now.']])}
`);
  return dcPage('Admin — users', css, html, 1180);
}

// ─── 2 · Person drawer ──────────────────────────────────────
function userDrawer() {
  const overlay = `<div class="ovl"></div><div class="drw">
  <div class="dh"><div class="row" style="gap:12px">${av(1, 52)}<div style="flex:1"><b style="font-size:17px">${nm(1)}</b><div class="xs mut">${email(1)} · AK002 · Engineering Lead</div><div class="row" style="gap:6px;margin-top:6px">${statusPill('act')}<span class="xs mut">Last sign-in 1 h ago · Chrome on Windows</span></div></div></div>
  <div class="row" style="gap:6px;margin-top:12px"><span class="seg2"><span class="on">Access</span><span>Sign-in</span><span>History</span></span><span style="flex:1"></span><span class="btn sm">${icon('scan', 12)}Explain</span></div></div>
  <div class="db">
    <div class="lbl">Roles · drag to reorder is not needed — tick to add</div>
    ${[['manager', true, 33, 'Approves leave & attendance for their team'], ['lead', true, 31, 'Timesheets and project work for their team'], ['hr', false, 59, 'People records, leave types, documents'], ['fin', false, 29, 'Expenses, payments, salary details']].map(([k, on, n, d]) => `<div class="row" style="gap:10px;padding:10px 12px;border-radius:12px;border:1px solid ${on ? ROLE[k][1] + '55' : C.border};background:${on ? ROLE[k][2] + '88' : '#fff'}"><span class="cb${on ? ' on' : ''}" style="${on ? `background:${ROLE[k][1]};border-color:${ROLE[k][1]}` : ''}">${on ? icon('check2', 10) : ''}</span><div style="flex:1"><b style="font-size:12.5px;color:${on ? ROLE[k][1] : C.fg}">${ROLE[k][0]}</b><div class="xs mut">${d}</div></div><span class="xs mut">${n} perms</span></div>`).join('')}
    <div class="card" style="padding:12px;border:1.5px dashed ${C.pri};background:${C.priSoft}66">
      <div class="row" style="gap:8px"><b style="font-size:12.5px;flex:1">${icon('diff', 14)} If you add HR ${NEW}</b><span class="xs" style="color:${C.ok};font-weight:800">+28 permissions</span><span class="xs" style="color:${C.warn};font-weight:800">4 sensitive</span></div>
      <div class="xs" style="line-height:1.7;margin-top:6px">Karan could also <b>see everyone’s salary</b> ⚠, <b>edit any employee</b>, <b>manage leave types</b>, <b>open documents</b> ⚠ — across the <b>whole company</b> (today: only his 9 reports).</div>
    </div>
    <div class="lbl">Reaches today</div>
    <div class="row" style="gap:10px">${[['Himself', 1], ['Direct reports', 6], ['Whole team', 9]].map(([l, v]) => `<div class="tile" style="flex:1"><span class="xs mut">${l}</span><b class="big">${v}</b></div>`).join('')}</div>
    <div class="lbl">Covering for someone</div>
    <div class="alertrow" style="background:${C.okSoft}">${icon('swap', 14)}<span style="flex:1">Covering Priya’s leave approvals until <b>12 Oct</b> (delegation)</span></div>
  </div>
  <div class="df"><span class="btn sm" style="margin-right:auto;color:${C.bad}">Deactivate</span><span class="btn sm">${icon('key', 12)}Send password reset</span><span class="btn sm pri">Save roles</span></div>
</div>`;
  const html = page('Users', 'Users', `
${top('Administration', 'Users', 'Everyone who can sign in, and the roles that decide what they can do.')}
<div class="card" style="overflow:hidden;opacity:.55"><table class="tbl"><thead><tr><th></th><th>User</th><th>Roles</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>${USERS.slice(0, 7).map((u) => userRow(u)).join('')}</tbody></table></div>
<div style="width:560px">${note([['new', 'Person drawer: roles as tick cards, “If you add HR” shows what changes before saving (+28, 4 sensitive, reach).'], ['new', 'Sign-in tab: devices & sessions with “Sign out everywhere”. History tab: who changed their roles and when.'], ['old', 'Edit roles, resend invite, password reset and deactivate move here (the ⋯ menu stays too).'], ['q', 'Should a Company Admin see the sign-in devices (browser, city)? Or only “last sign-in”?']])}</div>
`, overlay);
  return dcPage('Admin — person', css, html, 1000);
}

// ─── 3 · Invite ─────────────────────────────────────────────
function invite() {
  const overlay = `<div class="ovl"></div>
<div class="mdl" style="width:860px">
  <div class="mh"><span class="mic" style="background:${C.priSoft};color:${C.pri}">${icon('plus', 18)}</span><div style="flex:1"><b style="font-size:15px">Invite people</b><div class="xs mut">They get an email with a sign-in link. Everyone becomes an employee too.</div></div><span class="seg2"><span class="on">One person</span><span>Many${NEW}</span></span><span class="mut">${icon('x2', 16)}</span></div>
  <div style="display:grid;grid-template-columns:1fr 300px">
    <div class="mb" style="border-right:1px solid ${C.line}">
      <div class="secn"><i>1</i>Who</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="f"><label>First name *</label><div class="in">Meera</div></div><div class="f"><label>Last name *</label><div class="in">Joshi</div></div></div>
      <div class="f"><label>Work email *</label><div class="in foc">meera.joshi@aakash.in<span style="margin-left:auto;color:${C.ok}">${icon('check2', 14)}</span></div><span class="h">Not used yet ✓</span></div>
      <div class="secn"><i>2</i>Roles <span class="xs mut" style="font-weight:600">· Employee is always on</span></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${rc('emp', ' ✓')}${['manager', 'lead', 'hr', 'fin', 'it', 'pmo'].map((k) => `<span class="rchip" style="background:#fff;border:1px dashed ${ROLE[k][1]}88;color:${ROLE[k][1]}">+ ${ROLE[k][0]}</span>`).join('')}</div>
      <div class="secn"><i>3</i>Job <span class="xs mut" style="font-weight:600">· optional, can be filled later</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="f"><label>Department</label><div class="in">Engineering<span style="margin-left:auto" class="mut">${icon('chevd', 14)}</span></div></div>
        <div class="f"><label>Job title</label><div class="in">Software Engineer<span style="margin-left:auto" class="mut">${icon('chevd', 14)}</span></div></div>
        <div class="f"><label>Reports to</label><div class="in">${av(1, 20)}Karan Mehta<span style="margin-left:auto" class="mut">${icon('chevd', 14)}</span></div></div>
        <div class="f"><label>Joining date</label><div class="in">${icon('cal', 14)}Mon 12 Oct 2026</div></div>
      </div>
    </div>
    <div class="mb" style="background:${C.raised}">
      <div class="lbl">Preview ${NEW}</div>
      <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center">
        <span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#E9416A,#7A2BD9);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px">MJ</span>
        <b>Meera Joshi</b><span class="xs mut">Software Engineer · Engineering</span><span class="xs mut">Reports to Karan Mehta · AK214</span>${rc('emp')}
      </div>
      <div class="xs" style="line-height:1.7"><b>She will be able to</b><br>• apply for leave, check in, timesheets<br>• see the people directory<br>• raise tickets and expense claims</div>
      <div class="card" style="padding:10px;font-size:11.5px;line-height:1.6">${icon('mail', 13)} <b>Email</b><br><span class="mut">“Hi Meera, aakash-portal invited you…”</span></div>
    </div>
  </div>
  <div class="mf"><span class="xs mut"><span class="kbd">Ctrl</span> + <span class="kbd">Enter</span> to send</span><span style="flex:1"></span><span class="btn">Cancel</span><span class="btn">Send &amp; add another</span><span class="btn pri">${icon('mail', 13)}Send invite</span></div>
</div>`;
  const many = `<div class="card sec2" style="width:420px;position:absolute;right:40px;bottom:40px;z-index:3;box-shadow:0 20px 50px rgba(0,0,0,.25)">
  <b style="font-size:13px">“Many” tab ${NEW}</b>
  <div class="in" style="height:70px;align-items:flex-start;padding-top:8px;line-height:1.6;font-size:11.5px;color:${C.muted}">ravi@aakash.in, sana@aakash.in<br>john@ — paste emails or a CSV</div>
  <div class="row" style="gap:6px;flex-wrap:wrap">${['ravi@aakash.in', 'sana@aakash.in'].map((e) => `<span class="pill p-ok">${icon('check2', 10)} ${e}</span>`).join('')}<span class="pill" style="background:${C.badSoft};color:${C.bad}">john@ — not an email</span></div>
  <div class="xs mut">All get the Employee role. Roles &amp; job can be set after. <b>2 ready</b> · Send 2 invites</div>
</div>`;
  const html = page('Users', 'Users', `${top('Administration', 'Users', 'Everyone who can sign in, and the roles that decide what they can do.')}<div class="card" style="height:640px;opacity:.5"></div>`, overlay + many);
  return dcPage('Admin — invite', css, html, 900);
}

// ─── 4 · Roles list ─────────────────────────────────────────
const MODS = ['People', 'Time', 'Work', 'Money', 'Assets', 'Help', 'Admin'];
const RL = [
  ['admin', 'Everything, including features added later', 3, 'all', [9, 9, 9, 9, 9, 9, 9], 0],
  ['hr', 'People records, leave, documents, onboarding', 4, 59, [9, 8, 3, 4, 3, 6, 2], 6],
  ['manager', 'Approves for their team, sees team reports', 11, 33, [5, 6, 4, 2, 2, 1, 0], 1],
  ['lead', 'Timesheets and projects for their team', 40, 31, [3, 5, 6, 1, 1, 1, 0], 0],
  ['it', 'Assets, IT tickets, devices', 2, 39, [2, 1, 1, 0, 9, 7, 3], 1],
  ['fin', 'Expenses, payments, salary details', 3, 29, [2, 1, 0, 9, 1, 3, 0], 4],
  ['devops', 'DevOps ticket queue (servers, deployments)', 5, 14, [1, 1, 1, 0, 1, 6, 0], 0],
  ['pmo', 'All projects and allocations', 2, 22, [1, 2, 9, 1, 0, 1, 0], 0],
  ['emp', 'Every person — self-service', 199, 26, [2, 3, 2, 2, 1, 2, 0], 0],
];
function roles() {
  const card = ([k, d, users, perms, heat, sens], i) => `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px;border-top:3px solid ${ROLE[k][1]}${i === 1 || i === 5 ? `;box-shadow:0 0 0 2px ${C.pri}` : ''}">
  <div class="row" style="gap:8px">${i === 1 || i === 5 ? `<span class="cb on">${icon('check2', 10)}</span>` : ''}<b style="font-size:14px;color:${ROLE[k][1]};flex:1" class="row">${k === 'admin' ? icon('crown', 15) : ''} ${ROLE[k][0]}</b>${k === 'admin' ? `<span class="pill shim" style="color:#92400E">${icon('lock', 10)} locked</span>` : `<span class="mut">${icon('more', 15)}</span>`}</div>
  <div class="xs mut" style="min-height:30px">${d}</div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${heat.map((h, j) => `<div title="${MODS[j]}" style="height:22px;border-radius:5px;background:${ROLE[k][1]};opacity:${h ? 0.12 + h / 10 : 0.05}"></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${MODS.map((m) => `<span style="font-size:8.5px;color:${C.muted};text-align:center">${m}</span>`).join('')}</div>
  <div class="row" style="gap:8px"><span class="row" style="gap:0">${[0, 1, 2].slice(0, Math.min(3, users)).map((j) => `<span style="margin-left:${j ? -8 : 0}px;border:2px solid #fff;border-radius:50%;display:inline-flex">${av(i + j * 3, 22)}</span>`).join('')}</span><span class="xs mut">${users} ${users === 1 ? 'person' : 'people'}</span><span style="flex:1"></span><span class="xs" style="font-weight:800">${perms === 'all' ? 'All' : perms} perms</span>${sens ? `<span class="pill" style="background:${C.warnSoft};color:${C.warn}">${icon('alert', 10)} ${sens}</span>` : ''}</div>
</div>`;
  const html = page('Roles & permissions', 'Roles & permissions', `
${top('Administration', 'Roles &amp; permissions', 'A role is a bundle of permissions. A person can hold several — their access is all of them together.', `<div class="row" style="gap:8px"><span class="btn">${icon('scan', 14)}Access explorer</span><span class="btn">${icon('wand', 14)}Start from a template${NEW}</span><span class="btn pri">${icon('plus', 14)}New role</span></div>`)}
<div class="row" style="gap:10px;padding:10px 14px;border-radius:12px;background:${C.priSoft}"><b style="color:${C.priText};font-size:12.5px">2 roles selected</b><span class="btn sm pri">${icon('diff', 12)}Compare HR vs Finance${NEW}</span><span class="xs mut" style="flex:1">Tick 2–3 roles to compare them side by side.</span><span class="seg2"><span class="on">Cards</span><span>Grid${NEW}</span></span></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px" class="stg">${RL.map(card).join('')}</div>
${note([['old', 'Role cards with name, description, permission count, user count, ⋯ menu (edit, duplicate, deactivate).'], ['new', 'Colour per role, mini heat strip (how much of each module the role touches), face stack of who holds it, sensitive count.'], ['new', 'Compare 2–3 roles; “Grid” view = all roles × all modules in one table; templates (Recruiter, Payroll officer, Auditor read-only…).'], ['q', 'Templates: which ones do you want? My list: Recruiter, Payroll officer, Office admin, Auditor (view only), Intern.']])}
`);
  return dcPage('Admin — roles', css, html, 1240);
}

// ─── 5 · Role editor ────────────────────────────────────────
function roleEditor() {
  const perm = (label, key, on, scope, { sens = false, lock = 99, req = '', locked = false } = {}) => `<div class="row" style="gap:10px;padding:9px 12px;border-bottom:1px solid ${C.line}">
  <span class="cb${on ? ' on' : ''}">${on ? icon('check2', 10) : ''}</span>
  <div style="flex:1;min-width:0"><div class="row" style="gap:5px;font-size:12.5px;font-weight:700">${label}${sens ? `<span style="color:${C.warn}">${icon('alert', 12)}</span>` : ''}${locked ? `<span class="mut">${icon('lock', 11)}</span>` : ''}</div><div class="xs mut"><span style="font-family:monospace">${key}</span>${req ? ` · needs <b>${req}</b>` : ''}</div></div>
  ${scope !== null && on ? ladder(scope, { lockAfter: lock }) : scope === null && on ? `<span class="xs mut">no scope</span>` : ''}
</div>`;
  const html = page('Roles & permissions', 'Roles & permissions', `
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="xs mut">‹ Roles &amp; permissions</div><h1 style="color:${ROLE.manager[1]}">Manager</h1><div class="sub">11 people · 33 permissions · 1 sensitive</div></div><div class="row" style="gap:8px"><span class="btn">${icon('eye', 14)}Preview as Karan${NEW}</span><span class="btn">${icon('copy', 14)}Duplicate</span></div></div>
<div style="display:grid;grid-template-columns:200px 1fr 300px;gap:14px;align-items:start">
  <div class="card" style="padding:8px;display:flex;flex-direction:column;gap:2px">
    <div class="in ph" style="margin:4px 4px 8px">${icon('search', 13)}Search permissions</div>
    ${[['People', 5, 12], ['Time', 6, 14], ['Work', 4, 10], ['Money', 2, 8], ['Assets', 2, 9], ['Helpdesk', 1, 7], ['Admin', 0, 6]].map(([m, a, t], i) => {
      const r = 8, c = 2 * Math.PI * r;
      return `<div class="row" style="gap:8px;padding:7px 8px;border-radius:8px;${i === 1 ? `background:${C.priSoft};font-weight:800;color:${C.priText}` : ''}font-size:12.5px"><svg width="20" height="20"><circle cx="10" cy="10" r="${r}" fill="none" stroke="${C.line}" stroke-width="3"/><circle cx="10" cy="10" r="${r}" fill="none" stroke="${C.pri}" stroke-width="3" stroke-dasharray="${(a / t) * c} ${c}" transform="rotate(-90 10 10)" stroke-linecap="round"/></svg><span style="flex:1">${m}</span><span class="xs mut">${a}/${t}</span></div>`;
    }).join('')}
    <div class="xs mut" style="padding:8px">${NEW} module list with progress rings — jump instead of scrolling</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="overflow:hidden">
      <div class="row" style="padding:10px 12px;background:${C.raised};border-bottom:1px solid ${C.border}"><b style="flex:1;font-size:13px">Attendance</b><span class="xs mut">4/6</span><span class="btn sm" style="margin-left:8px">Set all to: ${ladder(2, { compact: true })}</span></div>
      ${perm('See attendance', 'attendance.view', true, 2)}
      ${perm('Approve corrections', 'attendance.approve', true, 2, { req: 'See attendance' })}
      ${perm('Edit anyone’s day', 'attendance.edit', true, 1)}
      ${perm('Export attendance', 'attendance.export', true, 2)}
      ${perm('Attendance settings', 'attendance.policy', false, null)}
      ${perm('Change company holidays', 'attendance.holidays', false, null, { locked: true })}
    </div>
    <div class="card" style="overflow:hidden">
      <div class="row" style="padding:10px 12px;background:${C.raised};border-bottom:1px solid ${C.border}"><b style="flex:1;font-size:13px">Leave</b><span class="xs mut">2/8</span></div>
      ${perm('See leave', 'leave.view', true, 2)}
      ${perm('Approve leave', 'leave.approve', true, 2, { req: 'See leave' })}
      ${perm('See leave balances of others', 'leave.balance_view', false, null, { sens: true })}
    </div>
    <div class="xs mut">${NEW} Scope is a <b>ladder</b> (Only themselves → Whole company) instead of a dropdown. Faded steps = you can’t give more than you have yourself.</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><b style="font-size:13px">${icon('sparkle', 14)} In plain words ${NEW}</b>
      <div style="font-size:12.5px;line-height:1.7">A <b>Manager</b> can <u style="text-decoration:none;background:${C.priSoft};padding:0 4px;border-radius:4px">see and approve</u> attendance and leave for <u style="text-decoration:none;background:${C.priSoft};padding:0 4px;border-radius:4px">their whole team below</u>, edit a day only for <u style="text-decoration:none;background:${C.priSoft};padding:0 4px;border-radius:4px">direct reports</u>, and export team reports.</div>
    </div>
    <div class="card sec2" style="border:1.5px solid ${C.warn}66"><b style="font-size:13px">${icon('diff', 14)} Unsaved changes ${NEW}</b>
      ${[['+', 'Export attendance', 'whole team', C.ok], ['↑', 'See attendance', 'direct → whole team', C.info], ['−', 'Attendance settings', '', C.bad]].map(([s, l, d, col]) => `<div class="row xs" style="gap:8px"><b style="width:16px;height:16px;border-radius:5px;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center">${s}</b><span style="flex:1"><b>${l}</b> ${d ? `<span class="mut">· ${d}</span>` : ''}</span></div>`).join('')}
      <div class="alertrow" style="background:${C.warnSoft};padding:7px 10px;font-size:11.5px">Applies to <b>&nbsp;11 people&nbsp;</b> on their next click.</div>
    </div>
  </div>
</div>
<div class="row" style="gap:10px;padding:12px 16px;border-radius:14px;background:#fff;border:1px solid ${C.border};box-shadow:0 -8px 24px rgba(0,0,0,.06)"><span class="xs" style="flex:1"><b>3 changes</b> · applies to 11 people</span><span class="btn sm">Discard</span><span class="btn sm pri">Save changes</span></div>
${note([['old', 'Name, description, permission tick list per feature, scope dropdown, dependency auto-tick, sticky save bar, duplicate, locked Company Admin.'], ['new', 'Module rail with rings, scope ladder, “Set all to”, plain-words summary, change list (+ / ↑ / −) before saving, Preview as a person.'], ['q', 'Preview as Karan = a read-only list of what Karan would see/do. Not real “view as” (you said no impersonation) — OK?']])}
`);
  return dcPage('Admin — role editor', css, html, 1180);
}

// ─── 6 · Compare roles + grid ───────────────────────────────
function compare() {
  const rows = [
    ['People', 'See employees', 'co', 'co'], ['People', 'Edit employees', 'co', '—'], ['People', 'See salary ⚠', 'co', 'co'], ['People', 'Bank details ⚠', '—', 'co'],
    ['Time', 'Approve leave', 'co', '—'], ['Time', 'Leave types', '✓', '—'], ['Money', 'Approve expenses', '—', 'co'], ['Money', 'Mark paid', '—', '✓'], ['Assets', 'Asset register', 'co', 'co'],
  ];
  const cell = (v, col) => v === '—' ? `<span class="mut">—</span>` : v === '✓' ? `<b style="color:${col}">✓</b>` : `<span class="rchip" style="background:${col}1a;color:${col}">Whole company</span>`;
  const html = page('Roles & permissions', 'Roles & permissions', `
${top('Roles &amp; permissions', 'Compare roles', 'What is the same, what is different.', `<span class="seg2"><span class="on">Only differences</span><span>Everything</span></span>`)}
<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;align-items:start">
<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Permission</th><th style="color:${ROLE.hr[1]}">HR · 4 people</th><th style="color:${ROLE.fin[1]}">Finance · 3 people</th></tr></thead><tbody>
${rows.map(([m, l, a, b]) => `<tr style="${a !== b ? `background:${C.warnSoft}55` : ''}"><td><span class="xs mut">${m} · </span><b>${l}</b></td><td>${cell(a, ROLE.hr[1])}</td><td>${cell(b, ROLE.fin[1])}</td></tr>`).join('')}
</tbody></table><div class="row xs" style="padding:10px 12px;gap:8px;background:${C.raised}"><span style="flex:1">Same: <b>19</b> · Only HR: <b>40</b> · Only Finance: <b>10</b></span><span class="btn sm">${icon('copy', 12)}Make a role from both</span></div></div>
<div class="card sec2"><b style="font-size:13px">Grid — every role × every module ${NEW}</b>
<div style="display:grid;grid-template-columns:110px repeat(7,1fr);gap:4px;font-size:10.5px;align-items:center">
<span></span>${MODS.map((m) => `<b style="text-align:center;color:${C.muted}">${m}</b>`).join('')}
${RL.map(([k, , , , heat]) => `<b style="color:${ROLE[k][1]}">${ROLE[k][0]}</b>${heat.map((h) => `<span style="height:24px;border-radius:6px;background:${ROLE[k][1]};opacity:${h ? 0.12 + h / 10 : 0.04};display:block"></span>`).join('')}`).join('')}
</div><div class="xs mut">Darker = more of that module. Click a square → the role editor opens on that module.</div></div>
</div>
${note([['new', 'Compare 2–3 roles: differences highlighted, “Only differences” switch, make a combined role.'], ['new', 'Grid view of all roles. Helps spot a role that has too much (e.g. Team Lead touching Money).']])}
`);
  return dcPage('Admin — compare', css, html, 900);
}

// ─── 7 · Access explorer: what can someone do ───────────────
function explorerUser() {
  const rings = `<div style="position:relative;width:260px;height:260px;flex:none">
  ${[[260, '#EEF0FF', 'Whole company · 199'], [190, '#E0E7FF', 'Engineering · 48'], [124, '#C7D2FE', 'Team below · 9'], [62, C.pri, '']].map(([s, bg, l], i) => `<div style="position:absolute;left:${(260 - s) / 2}px;top:${(260 - s) / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:${bg};${i === 3 ? 'display:flex;align-items:center;justify-content:center' : ''}">${i === 3 ? av(1, 52) : `<span style="position:absolute;top:${i === 0 ? 10 : 8}px;left:0;right:0;text-align:center;font-size:10.5px;font-weight:800;color:${C.priText}">${l}</span>`}</div>`).join('')}
  <span class="rip" style="left:99px;top:99px;width:62px;height:62px"></span>
</div>`;
  const prow = (label, feat, scope, reach, src, sens) => `<div class="row" style="gap:10px;padding:9px 12px;border-bottom:1px solid ${C.line}"><div style="flex:1;min-width:0"><b style="font-size:12.5px">${label}</b>${sens ? ` <span style="color:${C.warn}">${icon('alert', 11)}</span>` : ''}<div class="xs mut">${feat}</div></div>${ladder(scope, { compact: true })}<span class="xs mut" style="width:70px;text-align:right">${icon('users', 11)} ${reach}</span><span style="width:150px;display:flex;gap:4px;justify-content:flex-end">${src}</span></div>`;
  const html = page('Access explorer', 'Access explorer', `
${top('Roles &amp; permissions', 'Access explorer', 'See what someone can do and why — or who can reach a person’s records.')}
<div class="row" style="gap:10px"><span class="seg2"><span class="on">${icon('user', 12)} What can someone do?</span><span>${icon('eye', 12)} Who can access someone?</span><span>${icon('alert', 12)} Sensitive data check${NEW}</span></span></div>
<div class="row" style="gap:10px"><div class="in foc" style="flex:1;height:44px">${av(1, 26)}<b>Karan Mehta</b><span class="mut">· Engineering Lead</span><span style="margin-left:auto" class="xs mut">type a name… ${NEW} search with photos</span></div><div class="in ph" style="width:260px;height:44px">${icon('search', 14)}Filter: salary, approve…</div></div>
<div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">
  <div class="card sec2" style="align-items:center">
    ${rings}
    <div class="xs mut" style="text-align:center">${NEW} <b>Reach rings</b> — how far his access goes. Hover a ring to light up those permissions.</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center">${rc('manager')}${rc('lead')}${rc('emp')}<span class="rchip" style="background:${C.okSoft};color:${C.ok}">${icon('swap', 10)} covering Priya</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%"><div class="tile"><span class="xs mut">Permissions</span><b class="big">58</b><span class="xs" style="color:${C.warn}">1 sensitive</span></div><div class="tile"><span class="xs mut">Dormant</span><b class="big">2</b><span class="xs mut">feature off</span></div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="overflow:hidden"><div class="row" style="padding:8px 12px;background:${C.raised};border-bottom:1px solid ${C.border}"><b class="lbl" style="flex:1">Time</b><span class="xs mut">scope · reach · from</span></div>
      ${prow('Approve leave', 'Leave', 2, 9, rc('manager') + `<span class="rchip" style="background:${C.okSoft};color:${C.ok}">${icon('swap', 10)}Priya</span>`)}
      ${prow('See attendance', 'Attendance', 2, 9, rc('manager'))}
      ${prow('Edit anyone’s day', 'Attendance', 1, 6, rc('manager'))}
      ${prow('Approve timesheets', 'Timesheets', 2, 9, rc('lead'))}
    </div>
    <div class="card" style="padding:14px;border:1.5px solid ${C.pri}55">
      <b style="font-size:12.5px">${icon('route', 14)} Why can Karan approve leave for Ravi? ${NEW}</b>
      <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap;font-size:12px">
        ${[['Karan', C.fg], ['has role Manager', ROLE.manager[1]], ['→ Approve leave', C.pri], ['→ Whole team below', C.info], ['→ Ravi reports to Neha, who reports to Karan', C.ok]].map(([t, col], i) => `<span style="padding:5px 10px;border-radius:9px;background:${col}14;color:${col};font-weight:800;animation:rise .4s ease ${i * 0.25}s both">${t}</span>`).join('')}
      </div>
    </div>
  </div>
</div>
${note([['old', 'Person picker, filter, roles, permission count, team size, each permission with scope pill, reach and source chips, delegation card, dormant list.'], ['new', 'Search with photos, reach rings, scope as a mini ladder, “Why can X do Y for Z?” path, Sensitive data check tab.']])}
`);
  return dcPage('Admin — explorer person', css, html, 1050);
}

// ─── 8 · Access explorer: who can access someone + sensitive check ───────────
function explorerWho() {
  const groups = [
    ['Their manager chain', C.pri, [[1, 'Karan Mehta', 'Manager · whole team below', 'manager'], [4, 'Neha Gupta', 'Team Lead · direct reports', 'lead']]],
    ['Company-wide', C.pink, [[2, 'Hema Iyer', 'HR · whole company', 'hr'], [3, 'Arjun Nair', 'Company Admin · everything', 'admin']]],
    ['Covering (delegation)', C.ok, [[0, 'Priya Sharma', 'Covering Karan until 12 Oct', 'manager']]],
  ];
  const html = page('Access explorer', 'Access explorer', `
${top('Roles &amp; permissions', 'Access explorer', 'See what someone can do and why — or who can reach a person’s records.')}
<div class="row" style="gap:10px"><span class="seg2"><span>${icon('user', 12)} What can someone do?</span><span class="on">${icon('eye', 12)} Who can access someone?</span><span>${icon('alert', 12)} Sensitive data check</span></span></div>
<div class="row" style="gap:10px;font-size:14px;font-weight:700;flex-wrap:wrap">Who can <span class="in foc" style="height:38px">Approve leave ${icon('chevd', 14)}</span> for <span class="in foc" style="height:38px">${av(9, 22)}Ravi Kumar ${icon('chevd', 14)}</span> ? <span class="xs mut" style="font-weight:600">${NEW} reads like a sentence</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
  <div class="card sec2">
    <div class="row"><b style="flex:1;font-size:14px">5 people can</b><span class="xs mut">nobody approves their own request</span></div>
    <svg width="100%" height="230" viewBox="0 0 520 230">
      <g>${[[60, C.pri], [130, C.pri], [260, C.pink], [330, C.pink], [460, C.ok]].map(([x, col], i) => `<path class="path" d="M260 205 C 260 150, ${x} 140, ${x} 70" fill="none" stroke="${col}" stroke-width="2" stroke-opacity=".55" style="animation-delay:${i * 0.15}s"/>`).join('')}</g>
    </svg>
    <div style="position:relative;margin-top:-232px;height:232px">
      ${[[60, 1], [130, 4], [260, 2], [330, 7], [460, 0]].map(([x, i]) => `<span style="position:absolute;left:calc(${(x / 520) * 100}% - 20px);top:30px;display:flex;flex-direction:column;align-items:center;gap:2px">${av(i, 40)}<b style="font-size:10.5px">${first(i)}</b></span>`).join('')}
      <span style="position:absolute;left:calc(50% - 26px);bottom:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border-radius:14px;background:${C.priSoft}">${av(9, 44)}<b style="font-size:10.5px">Ravi</b></span>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">
    ${groups.map(([g, col, ps]) => `<div class="card" style="overflow:hidden;border-left:3px solid ${col}"><div class="lbl" style="padding:8px 12px;color:${col}">${g}</div>${ps.map(([i, n, why, k]) => `<div class="row" style="gap:10px;padding:8px 12px;border-top:1px solid ${C.line}">${av(i, 30)}<div style="flex:1"><b style="font-size:12.5px">${n}</b><div class="xs mut">${why}</div></div>${rc(k)}</div>`).join('')}</div>`).join('')}
  </div>
</div>
<div class="card sec2" style="border-top:3px solid ${C.warn}">
  <div class="row"><b style="font-size:14px;flex:1">${icon('alert', 15)} Sensitive data check ${NEW}</b><span class="xs mut">third tab · a one-page answer to “who can see private data?”</span></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px" class="stg">
  ${[['See salary', 3, ['admin', 'hr', 'fin']], ['Bank details', 2, ['admin', 'fin']], ['Personal documents', 4, ['admin', 'hr']], ['Change roles', 3, ['admin']]].map(([l, n, ks]) => `<div class="tile" style="gap:6px"><span class="xs mut">${l}</span><b class="big" style="color:${n > 3 ? C.warn : C.fg}">${n} people</b><div class="row" style="gap:4px;flex-wrap:wrap">${ks.map((k) => rc(k)).join('')}</div></div>`).join('')}
  </div>
</div>
${note([['old', 'Person + permission dropdowns, list with name, reason and source chips.'], ['new', 'Sentence picker, lines from each person to Neel, grouped by why (manager chain / company-wide / covering).'], ['new', 'Sensitive data check: salary, bank, documents, role changes — who and through which role.']])}
`);
  return dcPage('Admin — explorer who', css, html, 1140);
}

// ─── 9 · Animation ideas ────────────────────────────────────
function motion() {
  const demos = [
    ['Role flies to the person', 'Users · drawer', 'When you add a role it slides into the person’s role list.', `<span style="position:absolute;left:30px;animation:fly 3s ease-in-out infinite">${rc('hr')}</span><span style="position:absolute;right:30px;display:flex;gap:4px;align-items:center">${av(0, 30)}<span style="animation:land 3s ease-in-out infinite">${rc('hr')}</span></span>`],
    ['Scope ladder slides', 'Role editor', 'The dark step glides to the new scope; steps below light up.', `<span style="position:relative;display:inline-flex;width:220px;height:30px;border-radius:9px;background:#fff;border:1px solid ${C.border}"><i style="position:absolute;top:3px;width:40%;height:22px;border-radius:7px;background:${C.pri};animation:slideL 3s ease-in-out infinite"></i><span style="position:relative;display:flex;justify-content:space-around;width:100%;align-items:center;font-size:10.5px;font-weight:800;color:${C.muted}"><span>Own</span><span>Team</span><span>Company</span></span></span>`],
    ['Reach rings ripple', 'Access explorer', 'A ring pulses out from the person to the widest scope they have.', `<span style="position:relative;width:90px;height:90px;display:flex;align-items:center;justify-content:center">${av(0, 36)}<span class="rip" style="left:0;top:0;width:90px;height:90px"></span><span class="rip" style="left:0;top:0;width:90px;height:90px;animation-delay:1.2s"></span></span>`],
    ['Count rolls', 'Role editor, explorer', 'Permission counts roll up/down as you tick.', `<b class="big" style="font-size:40px;color:${C.pri};animation:cnt 1s ease infinite alternate">33 → 36</b>`],
    ['Locked admin shimmer', 'Roles', 'The Company Admin card has a soft gold shimmer and a lock.', `<span class="pill shim" style="color:#92400E;font-size:13px;padding:8px 14px">${icon('crown', 14)} Company Admin · locked</span>`],
    ['Sensitive pulse', 'Role editor', 'Ticking a ⚠ permission gives one amber pulse — a “are you sure” feeling without a popup.', `<span class="row pulse" style="gap:8px;padding:8px 12px;border-radius:10px;background:#fff;border:1px solid ${C.warn}"><span class="cb on" style="background:${C.warn};border-color:${C.warn}">${icon('check2', 10)}</span><b style="font-size:12.5px">See salary</b><span style="color:${C.warn}">${icon('alert', 13)}</span></span>`],
    ['Why-path draws', 'Access explorer', 'The “why” chips appear one after another like a path.', `${['Karan', 'Manager', 'Approve leave', 'Neel'].map((t, i) => `<span style="padding:5px 9px;border-radius:9px;background:${C.priSoft};color:${C.priText};font-weight:800;font-size:11.5px;animation:rise .5s ease ${i * 0.3}s infinite alternate">${t}</span>`).join('<span class="mut">›</span>')}`],
    ['Save button turns into a tick', 'Every popup form', 'Button shrinks to a round ✓, then the popup closes.', `<span style="position:relative;height:36px;display:flex;align-items:center;justify-content:center;background:${C.pri};color:#fff;font-weight:800;font-size:12.5px;animation:morph 2.6s ease infinite alternate;overflow:hidden"><span style="animation:txt 2.6s ease infinite alternate">Save</span><span style="position:absolute;animation:tick 2.6s ease infinite alternate">${icon('check2', 16)}</span></span>`],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Administration · motion</div><h1 style="margin:4px 0">Animation ideas (live)</h1><div class="sub">Short, one-time moves that explain what changed. Everything respects “reduce motion” and the Simple background pack.</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${demos.map(([t, w, d, s]) => `<div class="demo"><div class="stage">${s}</div><span class="where">${w}</span><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}</div>
</div>`;
  return dcPage('Admin — motion', css, html, 760);
}

// ─── 10 · Who sees what ─────────────────────────────────────
function whoSees() {
  const cols = ['Employee', 'Team Lead / Manager', 'HR', 'IT Admin', 'Company Admin'];
  const rows = [
    ['Users page', '—', '—', 'see (if given user.view)', 'see', 'see + change'],
    ['Invite people', '—', '—', 'Employee role only', '—', 'any role'],
    ['Change someone’s roles', '—', '—', '—', '—', 'yes (not their own)'],
    ['Person drawer · sign-in devices', '—', '—', '—', '—', 'ask (Q)'],
    ['Roles page / editor', '—', '—', 'view', 'view', 'view + edit'],
    ['Access explorer', '—', '—', 'yes', 'yes', 'yes'],
    ['Sensitive data check', '—', '—', '—', '—', 'yes'],
    ['“If you add this role” preview', '—', '—', '—', '—', 'yes'],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:14px;min-height:100vh">
<div><div class="eyebrow">Administration</div><h1 style="margin:4px 0">Who sees and does what</h1><div class="sub">Same permissions as today (user.view, user.invite, user.assign_roles, role.view, role.manage). Nothing new is opened to employees.</div></div>
<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Thing</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? 'xs' : ''}" style="${i ? (c === '—' ? `color:${C.muted}` : `font-weight:700;color:${c.includes('ask') ? C.warn : C.ok}`) : 'font-weight:700'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<div class="card notes"><div class="xs">• “HR” column = the default HR role. Any custom role with the same permissions gets the same.</div><div class="xs">• Nobody can give a permission they don’t have themselves (already the rule).</div><div class="xs">• Nobody can change their own roles (already the rule).</div></div>
</div>`;
  return dcPage('Admin — who sees', css, html, 640);
}

// ─── 11 · Popup forms review ────────────────────────────────
function formsReview() {
  const probs = [
    ['1', 'Tall popups go off the screen', 'Invite user, Add asset, Hand over… — the title is cut at the top and the buttons at the bottom on a laptop screen. The popup has no max height.', 'fix', '~15 forms'],
    ['2', 'Plain dropdowns for people', 'Choosing a person (manager, holder, approver) is a long list with no search and no photos. 112 plain dropdowns in total.', 'fix', '112'],
    ['3', 'Errors only at the top', 'A red box at the top says “Choose at least one role” — the field itself is not marked. 26 forms do this.', 'fix', '26'],
    ['4', 'Typed text lost by a click outside', 'Clicking the dark area closes the popup — everything typed is gone. No “discard changes?” check.', 'fix', 'all'],
    ['5', 'Phone: small centered box', 'On a phone the popup is a centered card; the keyboard covers the buttons.', 'fix', 'all'],
    ['6', 'Widths all different', 'max-w-md / lg / xl / 2xl chosen one by one — similar forms look different.', 'tidy', '53'],
    ['7', 'Long forms are one long column', 'No sections, no steps. Invite = 9 fields in a row.', 'tidy', '~10'],
    ['8', 'Native date boxes', '38 date fields show the browser’s own picker (looks different on each browser, no quick picks).', 'tidy', '38'],
    ['9', 'Same grey icon on every popup', 'The header icon is always grey; the popup doesn’t tell you if it’s an add, an edit or a danger action.', 'tidy', 'all'],
    ['10', 'Old text', 'Invite still shows “Also add them as an employee” — now everyone is an employee anyway.', 'fix', '1'],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Whole app · popup forms</div><h1 style="margin:4px 0">Popup forms — review</h1><div class="sub">I looked at the ~80 popups in the app (Modal and Drawer). They all share one base, so most fixes are made once and every form gets them.</div></div>
<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:18px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:8px" class="stg">${probs.map(([n, t, d, k, c]) => `<div class="prob"><span class="n2" style="background:${k === 'fix' ? C.badSoft : C.warnSoft};color:${k === 'fix' ? C.bad : C.warn}">${n}</span><div><b style="font-size:13px">${t}</b><div class="xs mut" style="line-height:1.55">${d}</div></div><span class="pill ${k === 'fix' ? 'p-bad' : 'p-warn'}">${c}</span></div>`).join('')}</div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card sec2"><b style="font-size:13px">Today — Invite user on a 1366×768 laptop</b>
      <div style="position:relative;height:300px;border-radius:12px;background:#1F2433;overflow:hidden">
        <div style="position:absolute;left:50%;transform:translateX(-50%);top:-46px;width:300px;height:400px;background:#2A3042;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px">
          <div style="height:12px;width:60%;background:#3B4258;border-radius:4px"></div>${Array.from({ length: 9 }, () => `<div style="height:22px;border-radius:6px;background:#3B4258"></div>`).join('')}
          <div class="row" style="gap:6px;justify-content:flex-end"><span style="width:50px;height:22px;border-radius:6px;background:#3B4258"></span><span style="width:70px;height:22px;border-radius:6px;background:#B7791F"></span></div>
        </div>
        <span style="position:absolute;top:6px;right:8px" class="pill p-bad">title cut</span><span style="position:absolute;bottom:6px;right:8px" class="pill p-bad">buttons cut</span>
      </div>
    </div>
    <div class="card sec2"><b style="font-size:13px">Good already (keep)</b>${['One shared Modal / Drawer — fixes reach every form', 'Escape + focus trap, can’t close while saving', 'Field with label, hint, error, required star', 'Footer with Cancel + main button on the right'].map((t) => `<div class="xs">✓ ${t}</div>`).join('')}</div>
  </div>
</div>
</div>`;
  return dcPage('Forms — review', css, html, 900);
}

// ─── 12 · New form kit ──────────────────────────────────────
function formKit() {
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Whole app · popup forms</div><h1 style="margin:4px 0">New form kit</h1><div class="sub">Built once into Modal / Drawer / Field, then used by every form.</div></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
  <div class="card sec2"><span class="where">A · Fits the screen</span>
    <div style="border:1px solid ${C.border};border-radius:12px;overflow:hidden;height:250px;display:flex;flex-direction:column">
      <div class="row" style="padding:10px;border-bottom:1px solid ${C.line};gap:8px"><span class="mic" style="width:28px;height:28px;background:${C.priSoft};color:${C.pri}">${icon('plus', 14)}</span><b style="font-size:12px">Header stays</b></div>
      <div style="flex:1;padding:10px;display:flex;flex-direction:column;gap:6px;overflow:hidden;background:linear-gradient(${C.raised},#fff)">${Array.from({ length: 6 }, () => `<div style="height:20px;border-radius:6px;background:${C.line}"></div>`).join('')}<div class="xs mut" style="text-align:center">↕ only the middle scrolls</div></div>
      <div class="row" style="padding:10px;border-top:1px solid ${C.border};gap:6px;justify-content:flex-end;background:${C.raised}"><span class="btn sm">Cancel</span><span class="btn sm pri">Save</span></div>
    </div>
    <div class="xs mut">Max height = screen − 32px. Header and buttons never leave the screen.</div></div>
  <div class="card sec2"><span class="where">B · Three sizes only</span>
    ${[['S · 420px', 'Yes/no, one or two fields (reject with reason, rename)', 30], ['M · 560px', 'Normal forms (correct a day, hand over asset)', 55], ['L · 760px', 'Two columns or with a preview (invite, add asset)', 85], ['Side panel', 'Long or “edit while looking at the page” (role, project)', 100]].map(([t, d, w]) => `<div><div class="row" style="gap:8px"><b style="font-size:12px;width:80px">${t}</b><div style="flex:1;height:10px;border-radius:99px;background:${C.line}"><i class="wb" style="display:block;height:100%;width:${w}%;border-radius:99px;background:${C.pri}"></i></div></div><div class="xs mut">${d}</div></div>`).join('')}</div>
  <div class="card sec2"><span class="where">C · Icon tells the kind</span>
    ${[['plus', 'Add something', C.pri, C.priSoft], ['edit', 'Edit', C.teal, '#E6F6F4'], ['check', 'Approve', C.ok, C.okSoft], ['alert', 'Danger / remove', C.bad, C.badSoft]].map(([ic, t, col, bg]) => `<div class="row" style="gap:10px"><span class="mic" style="width:32px;height:32px;background:${bg};color:${col}">${icon(ic, 16)}</span><b style="font-size:12.5px">${t}</b></div>`).join('')}
    <div class="xs mut">Danger popups also get a red main button and type-to-confirm for big ones (delete a role with people).</div></div>
  <div class="card sec2"><span class="where">D · People picker with search</span>
    <div class="in foc">${icon('search', 13)}kar<span style="margin-left:auto" class="xs mut">↑↓ Enter</span></div>
    <div style="border:1px solid ${C.border};border-radius:10px;overflow:hidden">${[[1, 'Karan Mehta', 'Engineering Lead'], [9, 'Karthik S', 'QA Engineer']].map(([i, n, t], j) => `<div class="row" style="gap:8px;padding:7px 10px;${j === 0 ? `background:${C.priSoft}` : ''}">${av(i, 26)}<div style="flex:1"><b style="font-size:12px"><u style="text-decoration:none;background:#FEF08A">Kar</u>${n.slice(3)}</b><div class="xs mut">${t}</div></div>${j === 0 ? icon('check2', 13) : ''}</div>`).join('')}</div>
    <div class="xs mut">Replaces plain dropdowns for people, departments, job titles. Same look everywhere.</div></div>
  <div class="card sec2"><span class="where">E · Errors next to the field</span>
    <div class="f shake"><label>Work email *</label><div class="in bad">meera@aakash</div><span class="er">${icon('alert', 11)} Add the end, like meera@aakash.in</span></div>
    <div class="f"><label>Reason</label><div class="in" style="height:54px;align-items:flex-start;padding-top:8px">Family function</div><span class="h" style="text-align:right">15 / 300</span></div>
    <div class="xs mut">On Save: the first wrong field shakes once and gets focus. Server errors go to the right field when we know which.</div></div>
  <div class="card sec2"><span class="where">F · Don’t lose what you typed</span>
    <div style="border:1px solid ${C.border};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;background:${C.raised}"><b style="font-size:12.5px">Discard your changes?</b><div class="xs mut">You typed in 3 fields.</div><div class="row" style="gap:6px;justify-content:flex-end"><span class="btn sm">Discard</span><span class="btn sm pri">Keep editing</span></div></div>
    <div class="xs mut">Shown only when something was typed. Short forms (apply leave, claim) also keep a draft — like Apply leave already does.</div></div>
  <div class="card sec2"><span class="where">G · Keyboard</span>
    ${[['Ctrl + Enter', 'Save / send'], ['Esc', 'Close (asks if typed)'], ['Tab', 'Next field — autofocus on the first']].map(([k, d]) => `<div class="row xs" style="gap:8px">${k.split(' + ').map((x) => `<span class="kbd">${x}</span>`).join('+')}<span class="mut">${d}</span></div>`).join('')}
    <div class="xs mut">The hint sits in the footer, left side.</div></div>
  <div class="card sec2"><span class="where">H · Date picks</span>
    <div class="row" style="gap:6px;flex-wrap:wrap">${['Today', 'Tomorrow', 'Next Mon', '+1 week'].map((t, i) => `<span class="pill ${i === 2 ? 'p-pri' : 'p-neu'}">${t}</span>`).join('')}</div>
    <div class="in">${icon('cal', 14)}Mon 12 Oct 2026<span class="xs mut" style="margin-left:auto">in 6 days</span></div>
    <div class="xs mut">Our own calendar (same as Apply leave), with quick chips and “in N days”.</div></div>
  <div class="card sec2"><span class="where">I · Done moment</span>
    <div class="row" style="gap:10px;justify-content:center;padding:14px;border-radius:12px;background:${C.raised}"><span style="position:relative;height:36px;display:flex;align-items:center;justify-content:center;background:${C.ok};color:#fff;font-weight:800;font-size:12.5px;animation:morph 2.6s ease infinite alternate;overflow:hidden"><span style="animation:txt 2.6s ease infinite alternate">Saved</span><span style="position:absolute;animation:tick 2.6s ease infinite alternate">${icon('check2', 16)}</span></span></div>
    <div class="xs mut">Button → ✓, popup closes, the new row flashes once in the list.</div></div>
</div>
</div>`;
  return dcPage('Forms — kit', css, html, 1180);
}

// ─── 13 · Forms redone ──────────────────────────────────────
function formsRedone() {
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Whole app · popup forms</div><h1 style="margin:4px 0">Three real forms, before → after</h1><div class="sub">Hand over an asset (M), Reject a request (S), Correct a day on a phone (bottom sheet).</div></div>
<div style="display:grid;grid-template-columns:1.2fr 1fr .8fr;gap:18px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:10px">
    <div class="lbl">Hand over LAP-0142 · M</div>
    <div style="position:relative;border-radius:16px;background:#fff;box-shadow:0 20px 50px rgba(17,24,39,.15);overflow:hidden">
      <div class="mh"><span class="mic" style="background:${C.priSoft};color:${C.pri}">${icon('box', 18)}</span><div style="flex:1"><b style="font-size:14px">Hand over LAP-0142</b><div class="xs mut">MacBook Pro 14 · in store since 2 Sep</div></div>${icon('x2', 15)}</div>
      <div class="mb">
        <div class="f"><label>Give to *</label><div class="in foc">${av(6, 22)}<b>Ananya Bose</b><span class="mut">· starts Mon</span><span style="margin-left:auto" class="xs" style="color:${C.ok}">has no laptop ✓</span></div></div>
        <div class="f"><label>Type</label><span class="seg2" style="align-self:flex-start"><span class="on">To keep</span><span>Loan — comes back</span></span></div>
        <div class="f"><label>Condition</label><div class="row" style="gap:6px">${['New', 'Good', 'Fair', 'Damaged'].map((t, i) => `<span class="pill ${i === 1 ? 'p-pri' : 'p-neu'}">${t}</span>`).join('')}</div></div>
        <div class="f"><label>Note</label><div class="in ph">Charger + sleeve included</div></div>
        <div class="alertrow" style="background:${C.infoSoft};font-size:11.5px">${icon('bell', 13)} Ananya gets a notification to confirm he received it.</div>
      </div>
      <div class="mf"><span class="xs mut"><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></span><span style="flex:1"></span><span class="btn sm">Cancel</span><span class="btn sm pri">Hand over</span></div>
    </div>
    <div class="xs mut">Before: plain dropdown of all employees, condition as dropdown, no context in the header.</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div class="lbl">Reject leave · S · danger</div>
    <div style="border-radius:16px;background:#fff;box-shadow:0 20px 50px rgba(17,24,39,.15);overflow:hidden">
      <div class="mh"><span class="mic" style="background:${C.badSoft};color:${C.bad}">${icon('x2', 18)}</span><div style="flex:1"><b style="font-size:14px">Reject Neel’s leave?</b><div class="xs mut">Casual · Thu 15 – Fri 16 Oct · 2 days</div></div></div>
      <div class="mb"><div class="f"><label>Reason (Neel will see this) *</label><div class="in" style="height:64px;align-items:flex-start;padding-top:8px">Release week — can you move it by a week?</div><span class="h" style="text-align:right">42 / 300</span></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${['Release week', 'Too many off', 'Please add a document'].map((t) => `<span class="pill p-neu">+ ${t}</span>`).join('')}</div></div>
      <div class="mf"><span style="flex:1"></span><span class="btn sm">Cancel</span><span class="btn sm" style="background:${C.bad};color:#fff;border-color:${C.bad}">Reject</span></div>
    </div>
    <div class="xs mut">${NEW} quick reason chips. Danger colour on icon and button.</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div class="lbl">Correct a day · phone</div>
    <div style="width:250px;height:470px;border-radius:30px;border:8px solid #111827;background:#E5E7EF;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:rgba(17,24,39,.35)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;padding:10px 14px 14px;display:flex;flex-direction:column;gap:10px;animation:sheet 3s ease infinite alternate">
        <span style="width:40px;height:4px;border-radius:9px;background:${C.border};align-self:center"></span>
        <b style="font-size:14px">Correct Thu 17 Sep</b>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label>In</label><div class="in">09:24</div></div><div class="f"><label>Out</label><div class="in foc">18:40</div></div></div>
        <div class="f"><label>Why</label><div class="in ph">Forgot to check out</div></div>
        <span class="btn pri" style="justify-content:center">Send for approval</span>
      </div>
    </div>
    <div class="xs mut">${NEW} On phones every popup opens as a bottom sheet; button stays above the keyboard; swipe down to close.</div>
  </div>
</div>
</div>`;
  return dcPage('Forms — redone', css, html, 760);
}

// ─── 0 · Plan ───────────────────────────────────────────────
function overview() {
  const pages = [
    ['usercog', 'Users', 'Count tiles, “Needs a look”, role-colour filter, bulk actions, person drawer, invite with preview, invite many', C.pri],
    ['shield', 'Roles & permissions', 'Colour + heat strip per role, compare, grid, templates; editor with module rail, scope ladder, plain words, change list', ROLE.hr[1]],
    ['scan', 'Access explorer', 'Search with photos, reach rings, “why” path, sentence picker, lines to the person, sensitive data check', C.teal],
    ['layers', 'Popup forms (whole app)', 'Fits the screen, 3 sizes, people picker, errors at the field, don’t lose typing, phone sheet, keyboard, done moment', C.warn],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Company app · Administration</div><h1 style="margin:4px 0">Plan — Users, Roles &amp; permissions, Access explorer + popup forms</h1><div class="sub">Sidebar stays the same (3 items). New things are tabs, drawers and popups inside these pages.</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" class="stg">${pages.map(([ic, t, d, col]) => `<div class="card sec2" style="border-top:3px solid ${col}"><span style="color:${col}">${icon(ic, 20)}</span><b style="font-size:14px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
  <div class="card sec2"><b>Ideas used</b>${['Role colours everywhere (like Linear labels / Notion tags)', '“What changes if…” before saving — like GitHub’s diff', 'Reach rings + why-path — like Google Cloud “Policy troubleshooter”', 'Sensitive data check — like Okta / Rippling access reviews', 'Bottom sheets on phones — like iOS'].map((t) => `<div class="xs">• ${t}</div>`).join('')}</div>
  <div class="card sec2"><b>Build size (rough)</b>${[['UI only', 'Role colours, heat strip, compare, grid, scope ladder, plain words, change list, reach rings, why path, form kit'], ['Small API', '“Needs a look” counts, bulk actions, invite many, role-add preview, sensitive data check'], ['Bigger', 'Sign-in devices / sign out everywhere list, role history, templates']].map(([a, b]) => `<div class="xs"><b>${a}:</b> <span class="mut">${b}</span></div>`).join('')}</div>
  <div class="card sec2"><b>Questions</b>${['Show sign-in devices (browser, city) in the person drawer?', 'Which role templates? (Recruiter, Payroll officer, Office admin, Auditor view-only, Intern)', '“Preview as Karan” as a read-only list — OK (no real impersonation)?', 'Role colour: chosen by the admin, or automatic?', 'Popup forms: change all ~80 at once, or Administration + the most used first?'].map((t, i) => `<div class="xs">${i + 1}. ${t}</div>`).join('')}</div>
</div>
</div>`;
  return dcPage('Admin — plan', css, html, 760);
}

const boards = [
  ['CAAdmOverview.dc.html', 'Administration · Plan — 3 pages + popup forms, ideas, build size, questions', overview, 760],
  ['CAAdmUsers.dc.html', 'Administration · Users — count tiles, needs a look, role-colour filter, bulk actions', users, 1180],
  ['CAAdmPerson.dc.html', 'Administration · Users → person drawer — roles as tick cards, “if you add HR” preview, reach, covering', userDrawer, 1000],
  ['CAAdmInvite.dc.html', 'Administration · Invite — sections, role chips, live preview, invite many', invite, 900],
  ['CAAdmRoles.dc.html', 'Administration · Roles — colour, heat strip per module, who holds it, compare, grid, templates', roles, 1240],
  ['CAAdmRoleEditor.dc.html', 'Administration · Role editor — module rail, scope ladder, plain words, change list', roleEditor, 1180],
  ['CAAdmCompare.dc.html', 'Administration · Compare roles + all-roles grid', compare, 900],
  ['CAAdmExplorerPerson.dc.html', 'Administration · Access explorer — what can someone do: reach rings, why-path', explorerUser, 1050],
  ['CAAdmExplorerWho.dc.html', 'Administration · Access explorer — who can access someone + sensitive data check', explorerWho, 1140],
  ['CAAdmMotion.dc.html', 'Administration · Animation ideas (live)', motion, 760],
  ['CAAdmWhoSees.dc.html', 'Administration · Who sees and does what', whoSees, 640],
  ['CAFormsReview.dc.html', 'Popup forms · Review — 10 problems found across ~80 popups', formsReview, 900],
  ['CAFormsKit.dc.html', 'Popup forms · New form kit — fits screen, sizes, people picker, inline errors, keep typing, keyboard, dates, done', formKit, 1180],
  ['CAFormsRedone.dc.html', 'Popup forms · Three real forms before → after (asset hand-over, reject, phone sheet)', formsRedone, 760],
];
module.exports = { css, note, NEW, av, nm, first, sidebarFor: null };
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
const id = Object.entries(canvas.notes).find(([, n]) => n.text?.startsWith('Company · Administration'))?.[0] ?? `n${Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1}`;
canvas.notes[id] = { kind: 'title1', maxW: 7600, text: 'Company · Administration — users, person drawer, invite, roles, role editor, compare, access explorer + popup forms review and new form kit', w: 240, x: 0, y: Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards at y', Y, 'note', id);
}
