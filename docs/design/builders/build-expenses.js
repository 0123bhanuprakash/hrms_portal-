// Company app → Expenses: my expenses, claim editor, claim tracker, approvals, payments, reports, categories, who-sees-what.
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
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  car: '<path d="M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  bank: '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
});
const sidebar = (on) => reportsSidebar().replace('<div class="sb-g">TIME</div>', `<div class="sb-g">EXPENSES</div><div class="sb-i">${icon('receipt')}Expenses</div><div class="sb-g">TIME</div>`).replace('class="sb-i on"', 'class="sb-i"').replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const rs = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const css = peopleCss.replace('</style>', `
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi .card{padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.k5{grid-template-columns:repeat(5,1fr)}
.xst{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.flag{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap}
.step{display:flex;align-items:center;gap:6px;font-size:11px}
.dot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex:none}
.ln{flex:1;height:2px;border-radius:2px;min-width:14px}
.bar{height:6px;border-radius:99px;background:${C.line};overflow:hidden;display:flex}.bar i{display:block;height:100%}
.fld{display:flex;flex-direction:column;gap:5px}.fld label{font-size:12px;font-weight:700}.inp{border:1px solid ${C.border};border-radius:10px;padding:8px 11px;font-size:13px;background:#fff;display:flex;align-items:center;gap:8px}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}.tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};text-align:left;padding:8px 10px;background:${C.raised};border-bottom:1px solid ${C.border}}.tbl td{padding:9px 10px;border-bottom:1px solid ${C.line};vertical-align:middle}
.rcpt{border-radius:8px;background:linear-gradient(160deg,#fff,#F3F4F8);border:1px solid ${C.border};display:flex;flex-direction:column;gap:3px;padding:6px;font-size:8px;color:${C.muted};box-shadow:0 2px 6px rgba(0,0,0,.06)}
.rcpt i{display:block;height:3px;border-radius:2px;background:#D9DCE5}
.tgl{width:34px;height:20px;border-radius:99px;background:${C.pri};position:relative;flex:none}.tgl:after{content:'';position:absolute;right:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}.tgl.off{background:#D1D5DB}.tgl.off:after{right:auto;left:3px}
.opt{border:1.5px solid ${C.border};border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start;background:#fff}.opt.on{border-color:${C.pri};background:${C.priSoft}66}
.rad{width:15px;height:15px;border-radius:50%;border:2px solid ${C.border};flex:none;margin-top:2px}.opt.on .rad{border:5px solid ${C.pri}}
.drop{border:2px dashed ${C.pri}66;border-radius:14px;background:${C.priSoft}55;padding:14px;display:flex;align-items:center;gap:14px}
.mx td,.mx th{text-align:center}.mx td:first-child,.mx th:first-child{text-align:left}
.y{color:${C.ok};font-weight:900}.n{color:#C4C8D2}.s{font-size:11px;color:${C.muted};font-weight:600}
</style>`);

const ST = {
  draft: ['Draft', C.muted, C.raised],
  wait: ['Waiting', C.info, C.infoSoft],
  back: ['Sent back', C.bad, C.badSoft],
  topay: ['Approved · to be paid', C.violet, '#F1EBFE'],
  paid: ['Paid', C.ok, C.okSoft],
  q: ['Question for you', C.warn, C.warnSoft],
};
const st = (k) => `<span class="xst" style="background:${ST[k][2]};color:${ST[k][1]}">${ST[k][0]}</span>`;
const FLAG = {
  limit: ['Over limit', C.bad, C.badSoft],
  receipt: ['No receipt', C.warn, C.warnSoft],
  dup: ['Possible duplicate', C.violet, '#F1EBFE'],
  old: ['60+ days old', C.muted, C.raised],
  weekend: ['Weekend', C.muted, C.raised],
};
const flag = (k) => `<span class="flag" style="background:${FLAG[k][2]};color:${FLAG[k][1]}">⚑ ${FLAG[k][0]}</span>`;
/** Stepper: [label, who, state ok|now|todo|skip] */
const stepper = (steps) =>
  `<div class="row" style="gap:4px;align-items:center">${steps
    .map(([l, who, s], i) => {
      const c = s === 'ok' ? C.ok : s === 'now' ? C.info : s === 'back' ? C.bad : C.border;
      const dot = `<span class="dot" style="background:${s === 'todo' || s === 'skip' ? '#fff' : `${c}1f`};color:${c};border:2px solid ${c}">${s === 'ok' ? '✓' : s === 'now' ? '●' : s === 'back' ? '!' : s === 'skip' ? '–' : i + 1}</span>`;
      return `${i ? `<span class="ln" style="background:${steps[i - 1][2] === 'ok' ? C.ok : C.line}"></span>` : ''}<span class="step">${dot}<span><b style="display:block;${s === 'skip' ? `color:${C.muted};text-decoration:line-through` : ''}">${l}</b><span class="s">${who}</span></span></span>`;
    })
    .join('')}</div>`;
const rcpt = (w = 44, h = 56, label = 'Receipt') => `<div class="rcpt" style="width:${w}px;height:${h}px"><b style="font-size:8px;color:${C.fg}">${label}</b><i style="width:80%"></i><i style="width:60%"></i><i style="width:70%"></i><i style="width:40%;margin-top:auto;background:${C.fg}55"></i></div>`;
const CAT = {
  travel: ['🚕', 'Local travel'],
  mile: ['🚗', 'Mileage'],
  meal: ['🍽️', 'Client meal'],
  hotel: ['🏨', 'Hotel'],
  perdiem: ['🧳', 'Per diem'],
  internet: ['📶', 'Internet'],
  phone: ['📱', 'Phone'],
  train: ['🚆', 'Train / flight'],
  learn: ['📚', 'Learning'],
};
const cat = (k) => `<span class="row" style="gap:6px"><span style="font-size:14px">${CAT[k][0]}</span>${CAT[k][1]}</span>`;

// ─── Board 1: My expenses ───────────────────────────────────
function mine() {
  const claims = [
    ['Client visit — Northwind, Pune', 'Apollo · client, re-billable', 9850, 5, 'wait', [['Team lead', 'Priya ✓ 2 Oct', 'ok'], ['Finance', 'with Meera · 1 day', 'now'], ['HR', 'Hema ✓ 3 Oct', 'ok'], ['Paid', 'after approval', 'todo']], 'Finance is checking the hotel bill — HR has approved'],
    ['September internet & phone', 'Recurring · General', 1499, 2, 'topay', [['Manager', 'Ravi ✓', 'ok'], ['Finance', 'Meera ✓', 'ok'], ['HR', 'Hema ✓', 'ok'], ['Paid', 'Finance marks it paid', 'now']], 'Approved — Finance will mark it paid once it’s in your account'],
    ['Team offsite snacks', 'General', 2300, 1, 'q', [['Manager', 'Ravi asked a question', 'back'], ['Finance', '—', 'todo'], ['HR', '—', 'todo'], ['Paid', '—', 'todo']], '“How many people was this for?” — reply without resubmitting'],
    ['AWS certification exam', 'Learning', 12500, 1, 'paid', [['Manager', 'Ravi ✓', 'ok'], ['Finance', 'Meera ✓', 'ok'], ['HR', 'Hema ✓', 'ok'], ['Paid', '28 Sep · UTR …4471', 'ok']], 'Paid to your bank account ending 2209'],
  ];
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; <b>My expenses</b>')}<main class="main">
${top('Expenses', 'My expenses', 'Snap a receipt, add it to a claim, and follow it to your bank account', `<span class="btn">${icon('copy', 14)}Copy last month</span><span class="btn">${icon('camera', 14)}Scan receipts</span><span class="btn pri">${icon('plus2', 14)}New claim</span>`)}
<div class="kpi">${[['Claimed this month', rs(13649), '3 claims · 8 receipts', C.muted], ['Waiting for approval', rs(12150), 'oldest 3 days — with Finance', C.info], ['Approved, to be paid', rs(1499), 'Finance marks it paid', C.violet], ['Paid this year', rs(46820), '11 claims · avg 4 days to pay', C.ok]].map(([l, v, s, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${s}</span></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:18px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="gap:8px"><span class="chip on">All · 14</span><span class="chip">Needs me · 1</span><span class="chip">Waiting · 1</span><span class="chip">To be paid · 1</span><span class="chip">Paid · 11</span><span class="chip">Drafts · 1</span><div class="search" style="height:34px;margin-left:auto;flex:0 0 220px;font-size:12.5px">${icon('search', 13)} Search claims</div></div>
    ${claims.map(([t, sub, amt, n, s, steps, note]) => `<div class="card" style="padding:14px 16px;gap:10px">
      <div class="row" style="gap:12px;align-items:flex-start"><div style="flex:1"><div class="row" style="gap:8px"><b style="font-size:14.5px">${t}</b>${st(s)}</div><div class="xs mut">${sub} · ${n} item${n > 1 ? 's' : ''}</div></div><div style="text-align:right"><b style="font-size:18px">${rs(amt)}</b>${s === 'wait' ? `<div class="xs mut">claimed</div>` : ''}</div></div>
      ${stepper(steps)}
      <div class="row xs" style="gap:8px;padding:7px 10px;border-radius:9px;background:${s === 'q' ? C.warnSoft : C.raised}">${s === 'q' ? icon('msg', 13) : icon('clock', 13)}<span style="flex:1">${note}</span>${s === 'q' ? '<span class="btn sm pri">Reply</span>' : ''}</div>
    </div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:14px;gap:10px"><b style="font-size:13.5px">Your limits this month</b>
      ${[['internet', 1000, 999], ['phone', 500, 500], ['meal', 3000, 1850], ['learn', 25000, 12500]].map(([k, cap, used]) => `<div><div class="row xs" style="justify-content:space-between">${cat(k)}<b>${rs(used)} <span class="mut" style="font-weight:600">/ ${rs(cap)}${k === 'learn' ? ' a year' : ''}</span></b></div><div class="bar" style="margin-top:5px"><i style="width:${(used / cap) * 100}%;background:${used >= cap ? C.bad : C.pri}"></i></div></div>`).join('')}
      <div class="xs mut">Phone is used up — more needs a reason and goes to Finance as an exception</div></div>
    <div class="card" style="padding:14px;gap:8px;background:linear-gradient(135deg,#F1EBFE,#fff)"><b style="font-size:13.5px">${icon('repeat', 14)} Monthly bills</b><div class="xs mut">Internet ₹999 and phone ₹500 every month — one click makes October’s claim from September, you just attach the bills.</div><span class="btn sm" style="align-self:flex-start">${icon('copy', 12)}Make October’s claim</span></div>
    <div class="card" style="padding:14px;gap:6px"><b style="font-size:13.5px">${icon('bank', 14)} Paid to</b><div class="xs">HDFC Bank · account ending <b>2209</b></div><div class="xs mut">From your profile · scheduled pay runs are coming soon</div></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('My expenses', css, html, 1180);
}

// ─── Board 2: Claim editor ──────────────────────────────────
function editor() {
  const items = [
    ['1 Oct', 'train', 'Bengaluru → Pune flight', 6200, 'ok', ''],
    ['1 Oct', 'travel', 'Cab home → airport', 540, 'ok', ''],
    ['2 Oct', 'hotel', 'Hotel Orchid, 1 night', 4200, 'limit', 'City cap ₹3,500 — add a reason'],
    ['2 Oct', 'meal', 'Dinner with Northwind (4 people)', 2600, 'ok', 'attendees: 4'],
    ['3 Oct', 'travel', 'Cab to client office', 640, 'receipt', 'Receipt needed above ₹500'],
  ];
  const total = items.reduce((n, i) => n + i[3], 0);
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; My expenses &nbsp;›&nbsp; <b>New claim</b>')}<main class="main">
${top('Expenses', 'Client visit — Northwind, Pune', 'Draft · last saved just now', `<span class="btn">Save draft</span><span class="btn pri">Send for approval · ${rs(total)}</span>`)}
<div style="display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="card" style="padding:14px 16px;display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px">
      <div class="fld"><label>What’s it for</label><div class="inp"><b>Client visit — Northwind, Pune</b></div></div>
      <div class="fld"><label>Project</label><div class="inp"><span style="width:9px;height:9px;border-radius:3px;background:#4F46E5"></span><b style="flex:1">Apollo</b><span class="xst" style="background:${C.okSoft};color:${C.ok}">re-billable</span></div></div>
      <div class="fld"><label>Trip dates</label><div class="inp"><b>1 – 3 Oct</b> <span class="mut xs">· Pune</span></div></div>
    </div>
    <div class="drop">${icon('camera', 26)}<div style="flex:1"><b style="font-size:14px">Drop receipts here — or take photos on your phone</b><div class="xs mut">Each receipt becomes an item. You pick the category and type the amount; PDFs, JPG, PNG up to 10 MB.</div></div><span class="btn sm">${icon('up', 12)}Choose files</span></div>
    <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th style="width:56px">Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th><th>Receipt</th><th>Check</th></tr></thead><tbody>
      ${items.map(([d, k, desc, amt, chk, why]) => `<tr><td class="mut">${d}</td><td style="white-space:nowrap">${cat(k)}</td><td>${desc}${why && chk === 'ok' ? `<div class="xs mut">${why}</div>` : ''}</td><td style="text-align:right"><b>${rs(amt)}</b></td><td>${['mile', 'perdiem'].includes(k) ? '<span class="xs mut">—</span>' : chk === 'receipt' ? `<span class="btn sm">${icon('up', 11)}Attach</span>` : rcpt(30, 38, '')}</td><td>${chk === 'ok' ? `<span class="xst" style="background:${C.okSoft};color:${C.ok}">✓ ok</span>` : chk === 'limit' ? `<div>${flag('limit')}<div class="xs" style="color:${C.bad};margin-top:3px">${why}</div><div class="inp" style="margin-top:4px;padding:4px 8px;font-size:11.5px;color:${C.muted}">Reason: only hotel near the client office</div></div>` : `<div>${flag('receipt')}<div class="xs" style="color:${C.warn};margin-top:3px">${why}</div></div>`}</td></tr>`).join('')}
      <tr><td></td><td colspan="5"><span class="btn sm">${icon('plus2', 12)}Add an item</span></td></tr>
    </tbody></table></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:16px;gap:10px"><div class="row"><span class="mut xs" style="flex:1">Total</span><b style="font-size:24px">${rs(total)}</b></div>
      <div class="xs mut">5 items · 4 receipts · re-billable to Northwind via Apollo</div>
      <div style="border-top:1px solid ${C.line};padding-top:10px;display:flex;flex-direction:column;gap:7px">
        ${[['ok', 'Dates within 90 days'], ['ok', 'No duplicates found'], ['warn', 'Hotel over city cap — reason added'], ['bad', 'Cab needs a receipt (₹640 > ₹500)']].map(([s, t]) => `<div class="row xs" style="gap:8px"><span style="color:${s === 'ok' ? C.ok : s === 'warn' ? C.warn : C.bad};font-weight:900">${s === 'ok' ? '✓' : s === 'warn' ? '!' : '✕'}</span>${t}</div>`).join('')}</div></div>
    <div class="card" style="padding:16px;gap:10px"><b style="font-size:13.5px">Who approves</b>
      ${[[0, 'Priya Sharma', 'Team lead · Apollo', 'step 1'], [3, 'Finance', 'Meera Iyer + 1 more', 'step 2 · together with HR'], [8, 'HR', 'Hema Iyer + 1 more', 'step 2']].map(([pi, n, r, s]) => `<div class="row" style="gap:10px;${s === 'skipped' ? 'opacity:.5' : ''}">${photo(pi, 30, 30, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${r}</div></div><span class="xs mut">${s}</span></div>`).join('')}
      <div class="xs mut" style="border-top:1px solid ${C.line};padding-top:8px">Hotel over the cap is flagged to them as an exception — they can approve or lower it.</div></div>
    <div class="card" style="padding:14px;gap:6px;background:${C.raised}"><b class="xs">After approval</b><div class="xs mut">Finance pays you and marks the claim paid — you get a notification with the reference.</div></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Claim editor', css, html, 1180);
}

// ─── Board 3: Claim tracker ─────────────────────────────────
function tracker() {
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; My expenses &nbsp;›&nbsp; <b>Client visit — Northwind</b>')}<main class="main">
<div class="card" style="padding:18px 20px;gap:14px">
  <div class="row" style="gap:14px;align-items:flex-start"><div style="flex:1"><div class="row" style="gap:8px"><h1 style="margin:0">Client visit — Northwind, Pune</h1>${st('wait')}</div><div class="sub">Apollo · re-billable · sent 2 Oct · 5 items</div></div>
    <div style="text-align:right"><div class="xs mut">Claimed ${rs(14180)}</div><b style="font-size:24px">${rs(13480)}</b><div class="xs" style="color:${C.warn};font-weight:700">₹700 lowered by Finance</div></div></div>
  <div style="padding:12px 14px;border-radius:12px;background:${C.raised}">${stepper([['Sent', 'You · 2 Oct 6:10 pm', 'ok'], ['Team lead', 'Priya ✓ 2 Oct 7:30 pm', 'ok'], ['Finance', 'Meera · since 3 Oct', 'now'], ['HR', 'Hema ✓ 3 Oct 10:05', 'ok'], ['Paid', 'after Finance', 'todo']])}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 380px;gap:18px;align-items:start">
  <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th>Item</th><th>Receipt</th><th style="text-align:right">Claimed</th><th style="text-align:right">Approved</th></tr></thead><tbody>
    ${[['train', 'Bengaluru → Pune flight', 6200, 6200, ''], ['hotel', 'Hotel Orchid, 1 night', 4200, 3500, 'Lowered to the city cap — Meera (Finance)'], ['meal', 'Dinner with Northwind (4 people)', 2600, 2600, ''], ['travel', 'Cab home → airport', 540, 540, ''], ['travel', 'Cab to client office', 640, 640, '']].map(([k, d, a, b, why]) => `<tr><td><div style="font-weight:700">${d}</div><div class="xs mut">${CAT[k][0]} ${CAT[k][1]}</div>${why ? `<div class="xs" style="color:${C.warn};font-weight:700;margin-top:3px">↓ ${why}</div>` : ''}</td><td>${['mile', 'perdiem'].includes(k) ? '<span class="xs mut">—</span>' : rcpt(30, 38, '')}</td><td style="text-align:right;${a !== b ? 'text-decoration:line-through;color:' + C.muted : ''}">${rs(a)}</td><td style="text-align:right"><b>${rs(b)}</b></td></tr>`).join('')}
  </tbody></table></div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:14px;gap:10px"><b style="font-size:13.5px">${icon('msg', 14)} Conversation</b>
      ${[[3, 'Meera (Finance)', 'Was the dinner for 4 people from Northwind? Please add their names.', '3 Oct 11:02'], [0, 'You', 'Yes — Anil, Sujata, Rohan (Northwind) and me. Added to the item.', '3 Oct 11:40'], [3, 'Meera (Finance)', 'Thanks! Hotel lowered to the ₹3,500 city cap, rest is fine.', '3 Oct 12:15']].map(([pi, n, t, w]) => `<div class="row" style="gap:8px;align-items:flex-start">${photo(pi, 26, 26, { round: true })}<div style="flex:1;padding:7px 10px;border-radius:10px;background:${n === 'You' ? C.priSoft : C.raised}"><div class="row xs" style="justify-content:space-between"><b>${n}</b><span class="mut">${w}</span></div><div style="font-size:12.5px;margin-top:2px">${t}</div></div></div>`).join('')}
      <div class="inp" style="color:${C.muted}">Write a reply…</div>
      <div class="xs mut">Questions don’t send the claim back — it stays with Finance.</div></div>
    <div class="card" style="padding:14px;gap:8px"><b style="font-size:13.5px">History</b>
      ${[['Lowered hotel ₹4,200 → ₹3,500', 'Meera · 3 Oct 12:15'], ['Approved', 'Hema (HR) · 3 Oct 10:05'], ['Approved', 'Priya (team lead) · 2 Oct 7:30 pm'], ['Sent for approval', 'You · 2 Oct 6:10 pm'], ['Created from 5 receipts', 'You · 2 Oct 5:48 pm']].map(([t, s]) => `<div class="row xs" style="gap:8px"><span style="width:7px;height:7px;border-radius:50%;background:${C.pri}"></span><b style="flex:1">${t}</b><span class="mut">${s}</span></div>`).join('')}</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Claim tracker', css, html, 1180);
}

// ─── Board 4: Approvals ─────────────────────────────────────
function approvals() {
  const queue = [
    [1, 'Rahul Das', 'Client visit — Northwind', 14180, '2 days', ['limit'], true],
    [2, 'Neha Gupta', 'September internet', 999, '1 day', [], false],
    [4, 'Sara Khan', 'Design conference ticket', 8500, '3 days', ['old'], false],
    [5, 'Karan Mehta', 'Team lunch', 4200, '5 h', ['dup'], false],
    [6, 'Divya Rao', 'Cab rides — Sept', 1840, '1 day', ['receipt', 'weekend'], false],
    [7, 'Amit Verma', 'Phone bill', 499, '6 h', [], false],
  ];
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; <b>Expense approvals</b>')}<main class="main">
${top('Expenses', 'Expense approvals', 'Your step for each claim — clean ones in one go, flagged ones with the receipt next to it', `<span class="btn">${icon('dl', 14)}Export</span>`)}
<div class="kpi">${[['Waiting for you', '6 claims', rs(31566) + ' in total', C.info], ['Clean — no flags', '2', 'approve together', C.ok], ['Flagged', '4', 'over limit · duplicate · no receipt', C.warn], ['You usually take', '0.8 days', 'team target: 2 days', C.muted]].map(([l, v, s, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${s}</span></div>`).join('')}</div>
<div class="row" style="gap:8px"><span class="chip on">Waiting for me · 6</span><span class="chip">Questions I asked · 1</span><span class="chip">Decided · 38</span><span class="chip">My team’s spend</span>
  <div class="row" style="gap:8px;margin-left:auto;padding:6px 8px 6px 14px;border-radius:12px;background:${C.fg};color:#fff;font-size:12.5px"><b>2 clean claims · ${rs(1498)}</b><span class="btn sm pri">Approve both</span></div></div>
<div style="display:grid;grid-template-columns:400px 1fr;gap:16px;align-items:start">
  <div class="card" style="padding:0;overflow:hidden">${queue.map(([pi, n, t, a, age, flags, on]) => `<div class="row" style="gap:10px;padding:11px 14px;border-bottom:1px solid ${C.line};${on ? `background:${C.priSoft};box-shadow:inset 3px 0 0 ${C.pri}` : ''}">${photo(pi, 32, 32, { round: true })}<div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b style="font-size:13px;flex:1">${n}</b><b style="font-size:13px">${rs(a)}</b></div><div class="xs mut" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t} · waiting ${age}</div><div class="row" style="gap:4px;margin-top:4px;flex-wrap:wrap">${flags.length ? flags.map(flag).join('') : `<span class="flag" style="background:${C.okSoft};color:${C.ok}">✓ clean</span>`}</div></div></div>`).join('')}</div>
  <div class="card" style="padding:16px;gap:12px">
    <div class="row" style="gap:12px">${photo(1, 40, 40, { round: true })}<div style="flex:1"><b style="font-size:15px">Rahul Das · Client visit — Northwind</b><div class="xs mut">Apollo (re-billable) · 5 items · sent 2 Oct · you approve as <b style="color:${C.fg}">team lead</b></div></div><b style="font-size:20px">${rs(14180)}</b></div>
    <div style="display:grid;grid-template-columns:1fr 210px;gap:14px">
      <table class="tbl"><thead><tr><th>Item</th><th style="text-align:right">Amount</th><th style="text-align:right">Decide</th></tr></thead><tbody>
        ${[['Flight Bengaluru → Pune', 6200, ''], ['Hotel Orchid · 1 night', 4200, 'limit'], ['Dinner with Northwind (4)', 2600, ''], ['Cab home → airport', 540, ''], ['Cab to client office', 640, '']].map(([d, a, f], i) => `<tr style="${i === 1 ? `background:${C.badSoft}55` : ''}"><td>${d}${f ? `<div style="margin-top:3px">${flag(f)} <span class="xs mut">reason: “only hotel near the client office”</span></div>` : ''}</td><td style="text-align:right"><b>${rs(a)}</b></td><td style="text-align:right;white-space:nowrap"><span class="xst" style="background:${C.okSoft};color:${C.ok}">✓</span> <span class="xst" style="background:${C.raised};color:${C.muted}">✕ item</span></td></tr>`).join('')}
      </tbody></table>
      <div style="display:flex;flex-direction:column;gap:8px"><div class="xs mut" style="font-weight:700">Hotel receipt</div><div class="rcpt" style="width:100%;height:230px;font-size:11px;padding:12px"><b style="font-size:12px;color:${C.fg}">HOTEL ORCHID, PUNE</b><span>Invoice #OR-22817</span><i style="width:90%;margin-top:8px"></i><i style="width:70%"></i><i style="width:80%"></i><i style="width:60%"></i><span style="margin-top:auto;font-weight:800;color:${C.fg}">Total ₹4,200.00</span><span>GSTIN 27AAACO1234F1Z5</span></div><span class="btn sm">Open full size</span></div>
    </div>
    <div class="row xs" style="gap:8px;padding:8px 10px;border-radius:10px;background:${C.raised}">${icon('alert', 13)}<span style="flex:1">Team leads approve or reject items; <b>Finance and HR</b> can lower amounts.</span></div>
    <div class="row" style="gap:8px;justify-content:flex-end"><span class="btn">${icon('msg', 14)}Ask a question</span><span class="btn" style="color:${C.bad}">${icon('undo', 14)}Send back</span><span class="btn pri">${icon('check2', 14)}Approve 5 items · ${rs(14180)}</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Expense approvals', css, html, 1180);
}

// ─── Board 5: Payments ──────────────────────────────────────
function payments() {
  const ppl = [
    [1, 'Rahul Das', 2, 14828, 'HDFC ••2209', true],
    [2, 'Neha Gupta', 1, 999, 'ICICI ••5531', true],
    [4, 'Sara Khan', 1, 8500, 'SBI ••0918', true],
    [6, 'Divya Rao', 2, 3340, '', false],
    [7, 'Amit Verma', 1, 499, 'Axis ••7710', true],
    [8, 'Meena Joshi', 3, 6240, 'HDFC ••1180', true],
  ];
  const sel = ppl.filter((p) => p[5]);
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; <b>Payments</b>')}<main class="main">
${top('Expenses', 'Payments <span class="xst" style="background:#F1EBFE;color:#7C3AED;vertical-align:middle;font-size:12px">Coming soon</span>', 'Upcoming: pay approved claims in one batch and download the bank file', `<span class="btn">${icon('dl', 14)}Export</span>`)}
<div class="row" style="gap:10px;padding:10px 14px;border-radius:12px;background:#F1EBFE;color:#5B21B6;font-size:12.5px">${icon('clock', 15)}<span style="flex:1"><b>Upcoming feature.</b> Today Finance marks each approved claim paid from the claim page. This screen is how batches will work once payments are switched on.</span></div>
<div class="kpi">${[['To be paid', rs(34406), '10 claims · 6 people', C.violet], ['Next pay run', 'Thu 15 Oct', 'in 10 days · cut-off Mon 12 Oct', C.info], ['Paid this month', rs(42100), 'batch #12 · 30 Sep', C.ok], ['Missing bank details', '1 person', 'Divya Rao — asked to update', C.bad]].map(([l, v, s, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${s}</span></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start">
  <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th style="width:28px"></th><th>Person</th><th>Claims</th><th>Bank account</th><th style="text-align:right">Amount</th></tr></thead><tbody>
    ${ppl.map(([pi, n, c, a, bank, ok]) => `<tr style="${ok ? '' : 'opacity:.6'}"><td><input type="checkbox" ${ok ? 'checked' : 'disabled'} style="accent-color:${C.pri}"></td><td><div class="row" style="gap:8px">${photo(pi, 28, 28, { round: true })}<b>${n}</b></div></td><td class="mut">${c} claim${c > 1 ? 's' : ''} <span class="xs" style="color:${C.pri};font-weight:700">view</span></td><td>${bank ? bank : flag('receipt').replace('No receipt', 'No bank details')}</td><td style="text-align:right"><b>${rs(a)}</b></td></tr>`).join('')}
  </tbody></table></div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:16px;gap:10px;border-color:${C.pri}66"><b style="font-size:14px">Payment batch #13</b>
      <div class="row"><span class="xs mut" style="flex:1">${sel.length} people · ${sel.reduce((n, p) => n + p[2], 0)} claims</span><b style="font-size:22px">${rs(sel.reduce((n, p) => n + p[3], 0))}</b></div>
      ${[['1', 'Create the batch', 'locks these claims so nobody edits them', true], ['2', 'Download the bank file', 'NEFT bulk upload (CSV) — one row per person', false], ['3', 'Mark the batch paid', 'payment date + UTR per person (or one batch reference)', false]].map(([n, t, s, on]) => `<div class="row" style="gap:10px;align-items:flex-start"><span class="dot" style="background:${on ? C.pri : '#fff'};color:${on ? '#fff' : C.muted};border:2px solid ${on ? C.pri : C.border}">${n}</span><div><b style="font-size:13px">${t}</b><div class="xs mut">${s}</div></div></div>`).join('')}
      <span class="btn" style="justify-content:center;opacity:.6">Coming soon · Create batch · ${rs(sel.reduce((n, p) => n + p[3], 0))}</span>
      <div class="xs mut">Everyone is told “Paid ₹… to your account ending …” when you mark it paid.</div></div>
    <div class="card" style="padding:14px;gap:8px"><b style="font-size:13.5px">Earlier batches</b>
      ${[['#12', '30 Sep', 9, 42100], ['#11', '15 Sep', 7, 28640], ['#10', '31 Aug', 11, 51920]].map(([b, d, n, a]) => `<div class="row xs" style="gap:10px"><b style="width:30px">${b}</b><span class="mut" style="flex:1">${d} · ${n} people</span><b>${rs(a)}</b><span class="xst" style="background:${C.okSoft};color:${C.ok}">Paid</span>${icon('dl', 13)}</div>`).join('')}</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Payments', css, html, 1180);
}

// ─── Board 6: Reports ───────────────────────────────────────
function reports() {
  const months = [['Nov', 1.21], ['Dec', 1.48], ['Jan', 0.94], ['Feb', 1.12], ['Mar', 1.66], ['Apr', 1.30], ['May', 1.41], ['Jun', 1.18], ['Jul', 1.52], ['Aug', 1.73], ['Sep', 1.62], ['Oct', 0.42]];
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; <b>Spend reports</b>')}<main class="main">
${top('Expenses', 'Spend reports', 'Where the money goes — by month, category, team and project', `<span class="chip">Last 12 months ▾</span><span class="btn">${icon('dl', 14)}Export CSV</span>`)}
<div class="kpi k5">${[['Spent (approved)', '₹16.2L', '↑ 9% vs previous 12 months', C.muted], ['Re-billable to clients', '₹4.1L', '25% — invoice these', C.ok], ['Waiting in approvals', rs(31566), '6 claims', C.info], ['Approved, not paid', rs(34406), 'paid 15 Oct', C.violet], ['Avg time to pay', '4.2 days', 'Finance step 1.9 days', C.muted]].map(([l, v, s, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:20px">${v}</b><span class="xs" style="color:${c};font-weight:700">${s}</span></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">
  <div class="card" style="padding:16px;gap:10px"><div class="row"><b style="flex:1">Monthly spend</b><span class="xs mut">₹ lakh · ▮ re-billable ▮ company</span></div>
    <div class="row" style="align-items:flex-end;gap:10px;height:170px;padding-top:10px">${months.map(([m, v], i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;display:flex;flex-direction:column;border-radius:6px 6px 0 0;overflow:hidden;height:${v * 90}px"><i style="flex:${0.25 + (i % 3) * 0.05};background:${C.ok}"></i><i style="flex:1;background:${i === 11 ? C.priSoft : C.pri}"></i></div><span class="xs mut">${m}</span></div>`).join('')}</div></div>
  <div class="card" style="padding:16px;gap:10px"><b>By category</b>
    ${[['train', 520000], ['hotel', 380000], ['meal', 210000], ['learn', 190000], ['travel', 210000], ['internet', 110000], ['phone', 60000]].map(([k, v]) => `<div style="display:grid;grid-template-columns:130px 1fr 70px;gap:8px;align-items:center;font-size:12px">${cat(k)}<div class="bar" style="height:10px"><i style="width:${(v / 520000) * 100}%;background:${C.pri}"></i></div><b style="text-align:right">₹${(v / 100000).toFixed(1)}L</b></div>`).join('')}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
  <div class="card" style="padding:16px;gap:10px"><b>By team</b>
    ${[['Engineering', 6.1, '↑ 4%'], ['Sales', 5.2, '↑ 21%'], ['Design', 1.4, '↓ 8%'], ['HR & Admin', 0.9, '—']].map(([d, v, t]) => `<div><div class="row xs" style="justify-content:space-between"><b>${d}</b><span class="mut">₹${v}L · ${t} vs last year</span></div><div class="bar" style="margin-top:4px;height:8px"><i style="width:${(v / 6.1) * 100}%;background:${C.pri}"></i></div></div>`).join('')}</div>
  <div class="card" style="padding:16px;gap:8px"><b>By project</b>
    ${[['Apollo', '#4F46E5', '₹2.6L', 'client · re-billable'], ['Zeus', '#0D9488', '₹1.5L', 'client · re-billable'], ['Nova', '#DB2777', '₹0.8L', 'company · investment'], ['No project', '#64748B', '₹11.3L', '']].map(([n, c, v, s]) => `<div class="row xs" style="gap:8px"><span style="width:9px;height:9px;border-radius:3px;background:${c}"></span><b style="flex:1">${n}</b><span class="mut">${s}</span><b>${v}</b></div>`).join('')}</div>
  <div class="card" style="padding:16px;gap:8px"><b>Exceptions to look at</b>
    ${[['limit', '12 approved over the limit', '₹38,400 above caps'], ['receipt', '3 paid without a receipt', 'below ₹500 — allowed'], ['dup', '2 possible duplicates', 'both rejected'], ['old', '5 claimed 60+ days late', 'mostly Sales']].map(([f, t, s]) => `<div class="row xs" style="gap:8px">${flag(f).replace(/⚑ [^<]+/, '⚑')}<span style="flex:1"><b>${t}</b><div class="mut">${s}</div></span></div>`).join('')}</div>
</div>
</main></div></div>`;
  return dcPage('Spend reports', css, html, 1180);
}

// ─── Board 7: Categories ────────────────────────────────────
function categories() {
  const rows = [
    ['train', 'Amount', '—', '—', 'Above ₹0', 'Manager → Finance + HR', true, 18],
    ['hotel', 'Amount', '₹3,500 / night (tier 1)', '—', 'Always', 'Manager → Finance + HR', true, 9],
    ['meal', 'Amount', '₹1,000 / person', '₹3,000', 'Above ₹500', 'Manager → Finance + HR', false, 14],
    ['internet', 'Amount', '—', '₹1,000', 'Always', 'Manager → Finance + HR', false, 31],
    ['learn', 'Amount', '₹25,000', '₹25,000 / year', 'Always', 'Manager → Finance + HR', false, 4],
  ];
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; <b>Expense categories</b>')}<main class="main">
${top('Expenses', 'Expense categories', 'What people can claim, the limits and when a receipt is needed — every claim goes manager → Finance + HR', `<span class="btn pri">${icon('plus2', 14)}Add category</span>`)}
<div style="display:grid;grid-template-columns:1fr 400px;gap:18px;align-items:start">
  <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th>Category</th><th>Limit</th><th>Per month</th><th>Receipt</th><th>Approved by</th><th style="text-align:right">This month</th></tr></thead><tbody>
    ${rows.map(([k, type, lim, mo, r, flow, proj, n], i) => `<tr style="${i === 1 ? `background:${C.priSoft}66;box-shadow:inset 3px 0 0 ${C.pri}` : ''}"><td><b>${cat(k)}</b>${proj ? `<div class="xs mut">project required</div>` : ''}</td><td class="xs">${lim}</td><td class="xs">${mo}</td><td class="xs">${r}</td><td class="xs">${flow}</td><td style="text-align:right" class="xs"><b>${n}</b> items</td></tr>`).join('')}
  </tbody></table></div>
  <div class="card" style="padding:18px;gap:12px"><div class="row"><b style="font-size:15px;flex:1">🏨 Hotel</b><span class="tgl"></span></div>
    <div class="fld"><label>Description</label><div class="inp">Room for work travel, per night</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="fld"><label>Limit per item</label><div class="inp"><b>₹3,500</b></div></div><div class="fld"><label>Most per month</label><div class="inp"><span class="mut">No limit</span></div></div></div>
    <div class="fld"><label>Receipt needed</label><div class="inp"><b>Always</b> ▾</div></div>
    <div class="fld"><label>Who approves</label><div style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:${C.raised}">
      ${[['1', 'Manager step', 'their team lead / PM / line manager'], ['2', 'Finance + HR', 'both, on every claim']].map(([n, t, s]) => `<div class="row" style="gap:10px"><span class="dot" style="background:${C.priSoft};color:${C.pri};border:2px solid ${C.pri}">${n}</span><div style="flex:1"><b style="font-size:12.5px">${t}</b><div class="xs mut">${s}</div></div></div>`).join('')}<div class="xs mut">Same for every category</div></div></div>
    <div class="row xs" style="gap:8px"><span class="tgl off"></span>Project must be picked</div>
    <div class="row xs" style="gap:8px"><span class="tgl"></span>Over the limit: allow with a reason (flagged to approvers)</div>
    <div class="row" style="gap:8px;justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">Save</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Expense categories', css, html, 1180);
}

// ─── Board 8: Who sees what ─────────────────────────────────
function matrix() {
  const roles = ['Employee', 'Team lead / PM', 'Line manager', 'HR', 'Finance', 'Company admin'];
  const Y = '<span class="y">✓</span>';
  const N = '<span class="n">—</span>';
  const s = (t) => `<span class="s">${t}</span>`;
  const rows = [
    ['MY EXPENSES', null],
    ['Create claims, scan receipts', [Y, Y, Y, Y, Y, Y]],
    ['Track own claims, reply to questions, see limits left', [Y, Y, Y, Y, Y, Y]],
    ['Copy last month’s bills (recurring)', [Y, Y, Y, Y, Y, Y]],
    ['APPROVALS', null],
    ['Manager step — approve / send back / ask', [N, s('people they lead on a project'), s('direct reports'), s('only if they’re someone’s manager'), s('only if they’re someone’s manager'), Y]],
    ['Approve or reject single items', [N, Y, Y, Y, Y, Y]],
    ['Lower an amount (with a reason)', [N, N, N, Y, Y, Y]],
    ['Finance step', [N, N, N, N, Y, Y]],
    ['HR step (every claim)', [N, N, N, Y, N, Y]],
    ['Bulk-approve clean claims', [N, Y, Y, Y, Y, Y]],
    ['SEEING CLAIMS', null],
    ['Claims they approve (with receipts)', [N, Y, Y, Y, Y, Y]],
    ['All claims of their team', [N, N, s('whole reporting tree'), s('everyone'), s('everyone'), s('everyone')]],
    ['Team spend summary', [N, s('their project people'), Y, Y, Y, Y]],
    ['PAYMENTS & REPORTS', null],
    ['Mark a claim paid', [N, N, N, N, Y, Y]], ['Payment batches & bank file (coming soon)', [N, N, N, N, Y, Y]],
    ['Spend reports & CSV export', [N, N, N, Y, Y, Y]],
    ['Exceptions report (over limit, duplicates…)', [N, N, N, Y, Y, Y]],
    ['SETUP', null],
    ['Categories, limits, receipt rules, who approves', [N, N, N, Y, Y, Y]],
    ['Pay-run dates (coming soon)', [N, N, N, N, Y, Y]],
  ];
  const html = `<div class="app">${sidebar('Expenses')}<div class="col">${header('Expenses &nbsp;›&nbsp; <b>Who sees what</b>')}<main class="main">
${top('Expenses', 'Who sees and does what', 'Everyone is also an employee — the extra columns add to the first one. Approvers never decide their own claims.')}
<div class="card" style="padding:0;overflow:hidden"><table class="tbl mx"><thead><tr><th style="width:36%">What</th>${roles.map((r) => `<th>${r}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(([t, cells]) => (cells ? `<tr><td><b style="font-weight:600">${t}</b></td>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>` : `<tr><td colspan="7" style="background:${C.raised};font-size:10.5px;font-weight:900;letter-spacing:.08em;color:${C.muted}">${t}</td></tr>`)).join('')}
</tbody></table></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
  ${[['Sidebar: Employee', 'My expenses'], ['Sidebar: Team lead / PM / line manager', 'My expenses · Expense approvals'], ['Sidebar: HR / Finance / Admin', 'My expenses · Expense approvals · Payments (Finance) · Spend reports · Expense categories']].map(([t, s2]) => `<div class="card" style="padding:12px 14px;gap:4px"><b style="font-size:13px">${t}</b><span class="xs mut">${s2}</span></div>`).join('')}
</div>
</main></div></div>`;
  return dcPage('Expenses — who sees what', css, html, 1180);
}

const boards = [
  ['CAExpensesMine.dc.html', 'Expenses · My expenses — month summary, claim cards with live step tracker, limits left this month, monthly bills, paid-to account', mine, 1180],
  ['CAExpenseEditor.dc.html', 'Expenses · Claim editor — receipt drop, inline policy checks, over-limit allowed with a reason, who approves (manager → Finance + HR)', editor, 1180],
  ['CAExpenseTracker.dc.html', 'Expenses · Claim tracker — steps with names & times, lowered amounts explained, Q&A without sending back, history', tracker, 1180],
  ['CAExpenseApprovals.dc.html', 'Expenses · Approvals — flags (over limit, duplicate, no receipt), bulk-approve clean claims, receipt beside items, per-item decide, ask a question', approvals, 1180],
  ['CAExpensePayments.dc.html', 'Expenses · Payments (Finance) — COMING SOON — grouped by person, payment batch → bank file → mark paid (today: mark each claim paid)', payments, 1180],
  ['CAExpenseReports.dc.html', 'Expenses · Spend reports — monthly trend, re-billable vs company, category, team, project, exceptions', reports, 1180],
  ['CAExpenseCategories.dc.html', 'Expenses · Categories — per-item & monthly limits, receipt rule, over-limit with a reason; every claim manager → Finance + HR', categories, 1180],
  ['CAExpenseWhoSees.dc.html', 'Expenses · Who sees and does what — Employee, Team lead/PM, Line manager, HR, Finance, Company admin', matrix, 1180],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: (i % 4) * 1520, y: 27400 + Math.floor(i / 4) * 1400 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n15 = { kind: 'title1', maxW: 6000, text: 'Company · Expenses — my expenses, claim editor, tracker, approvals, payments, spend reports, categories, who sees what', w: 240, x: 0, y: 27100 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
