// Company app → Assets: my assets, request catalog + tracker, requests queue, register, asset detail,
// leavers & stock check, asset types, who sees what.
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
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-4M14 21h.01"/>',
  swap: '<path d="m17 3 4 4-4 4"/><path d="M3 7h18"/><path d="m7 21-4-4 4-4"/><path d="M21 17H3"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
});
const sidebar = (on) =>
  reportsSidebar()
    .replace('<div class="sb-g">TIME</div>', `<div class="sb-g">ASSETS</div><div class="sb-i">${icon('box')}Assets</div><div class="sb-g">TIME</div>`)
    .replace('class="sb-i on"', 'class="sb-i"')
    .replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;
const rs = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const css = peopleCss.replace('</style>', `
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi .card{padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.k5{grid-template-columns:repeat(5,1fr)}
.xst{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.step{display:flex;align-items:center;gap:6px;font-size:11px}
.dot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex:none}
.ln{flex:1;height:2px;border-radius:2px;min-width:14px}
.bar{height:6px;border-radius:99px;background:${C.line};overflow:hidden;display:flex}.bar i{display:block;height:100%}
.fld{display:flex;flex-direction:column;gap:5px}.fld label{font-size:12px;font-weight:700}.inp{border:1px solid ${C.border};border-radius:10px;padding:8px 11px;font-size:13px;background:#fff;display:flex;align-items:center;gap:8px}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}.tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};text-align:left;padding:8px 10px;background:${C.raised};border-bottom:1px solid ${C.border}}.tbl td{padding:9px 10px;border-bottom:1px solid ${C.line};vertical-align:middle}
.tgl{width:34px;height:20px;border-radius:99px;background:${C.pri};position:relative;flex:none}.tgl:after{content:'';position:absolute;right:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}.tgl.off{background:#D1D5DB}.tgl.off:after{right:auto;left:3px}
.ast{border-radius:16px;border:1px solid ${C.border};background:#fff;overflow:hidden;display:flex;flex-direction:column}
.ast .art{height:110px;display:flex;align-items:center;justify-content:center;font-size:54px;position:relative}
.ast .b{padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.qr{width:46px;height:46px;border-radius:6px;background:
 conic-gradient(from 90deg at 30% 30%, #111 0 25%, #fff 0 50%, #111 0 75%, #fff 0) 0 0/12px 12px;border:3px solid #fff;box-shadow:0 0 0 1px ${C.border}}
.mx td,.mx th{text-align:center}.mx td:first-child,.mx th:first-child{text-align:left}
.y{color:${C.ok};font-weight:900}.n{color:#C4C8D2}.s{font-size:11px;color:${C.muted};font-weight:600}
.cat{border:1.5px solid ${C.border};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px;background:#fff}.cat.on{border-color:${C.pri};background:${C.priSoft}66}
</style>`);

const TYPE = {
  lap: ['💻', 'Laptop', '#EEF0FF'],
  mon: ['🖥️', 'Monitor', '#E6F6F0'],
  ph: ['📱', 'Phone', '#FEF3E2'],
  id: ['🪪', 'ID card', '#F1EBFE'],
  hs: ['🎧', 'Headset', '#E5F4FB'],
  kb: ['⌨️', 'Keyboard & mouse', '#FDECEC'],
};
const ST = {
  avail: ['Available', C.ok, C.okSoft],
  with: ['With someone', C.info, C.infoSoft],
  repair: ['In repair', C.warn, C.warnSoft],
  lost: ['Lost', C.bad, C.badSoft],
  retired: ['Retired', C.muted, C.raised],
  confirm: ['Not confirmed', C.warn, C.warnSoft],
};
const st = (k) => `<span class="xst" style="background:${ST[k][2]};color:${ST[k][1]}">${ST[k][0]}</span>`;
const stepper = (steps) =>
  `<div class="row" style="gap:4px;align-items:center">${steps
    .map(([l, who, s], i) => {
      const c = s === 'ok' ? C.ok : s === 'now' ? C.info : s === 'back' ? C.bad : C.border;
      const dot = `<span class="dot" style="background:${s === 'todo' ? '#fff' : `${c}1f`};color:${c};border:2px solid ${c}">${s === 'ok' ? '✓' : s === 'now' ? '●' : s === 'back' ? '!' : i + 1}</span>`;
      return `${i ? `<span class="ln" style="background:${steps[i - 1][2] === 'ok' ? C.ok : C.line}"></span>` : ''}<span class="step">${dot}<span><b style="display:block">${l}</b><span class="s">${who}</span></span></span>`;
    })
    .join('')}</div>`;

// ─── Board 1: My assets ─────────────────────────────────────
function mine() {
  const items = [
    ['lap', 'MacBook Pro 14" M3', 'LAP-0042', 'Since 12 Jan 2025 · Good', 'Warranty till Jan 2027', true],
    ['mon', 'Dell U2723QE 27"', 'MON-0018', 'Since 3 Mar 2025 · Good', 'Warranty till Mar 2028', true],
    ['ph', 'Test phone (loan)', 'PHN-0011', 'Loan · 1 – 20 Oct', 'Due back Tue 20 Oct', true],
    ['hs', 'Jabra Evolve2 65', 'HDS-0031', 'Handed over today by Rohit (IT)', 'Please confirm you got it', false],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>My assets</b>')}<main class="main">
${top('Assets', 'My assets', 'Company equipment you have — keep or on loan; confirm what you receive, report problems, ask for something new', `<span class="btn">${icon('wrench', 14)}Report a problem</span><span class="btn pri">${icon('plus2', 14)}Request something</span>`)}
<div class="row" style="gap:10px;padding:12px 16px;border-radius:14px;background:${C.warnSoft}">${icon('alert', 16)}<span style="flex:1;font-size:13px"><b>Rohit (IT) handed you a headset today.</b> Confirm you received it and that it works.</span><span class="btn sm">It has a problem</span><span class="btn sm pri">${icon('check2', 12)}I got it</span></div>
<div style="display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start">
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">
    ${items.map(([k, n, tag, since, w, ok]) => `<div class="ast"><div class="art" style="background:${TYPE[k][2]}">${TYPE[k][0]}<span class="xst" style="position:absolute;top:10px;left:10px;background:#fff;color:${C.fg}">${TYPE[k][1]}</span>${ok ? '' : `<span style="position:absolute;top:10px;right:10px">${st('confirm')}</span>`}</div>
      <div class="b"><b style="font-size:14px">${n}</b><div class="row xs" style="gap:6px"><span class="mut" style="font-family:monospace;font-weight:800">${tag}</span><span class="mut">· ${since}</span></div>${w ? `<div class="xs" style="color:${ok ? C.muted : C.warn};font-weight:${ok ? 500 : 700}">${w}</div>` : ''}
      <div class="row" style="gap:6px;border-top:1px solid ${C.line};padding-top:8px;margin-top:2px"><span class="btn sm">${icon('wrench', 12)}Problem</span><span class="btn sm">${icon('swap', 12)}Swap / upgrade</span><span class="btn sm">${icon('undo', 12)}Return</span></div></div></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:14px;gap:10px"><b style="font-size:13.5px">My requests</b>
      <div><div class="row" style="gap:8px"><span style="font-size:20px">🖥️</span><div style="flex:1"><b style="font-size:13px">Second monitor</b><div class="xs mut">“Design reviews need two screens” · 2 days ago</div></div></div>
      <div style="margin-top:8px">${stepper([['Team lead', 'Priya ✓', 'ok'], ['Manager', 'Ravi ✓', 'ok'], ['HR', 'Hema · now', 'now'], ['IT head', 'next', 'todo'], ['Hand-over', 'IT', 'todo']])}</div></div>
      <div class="row xs" style="gap:8px;border-top:1px solid ${C.line};padding-top:8px"><span style="font-size:16px">⌨️</span><span style="flex:1"><b>Keyboard & mouse</b> · handed over 20 Sep</span><span class="xst" style="background:${C.okSoft};color:${C.ok}">Done</span></div></div>
    <div class="card" style="padding:14px;gap:8px"><b style="font-size:13.5px">${icon('wrench', 14)} Problems I reported</b>
      <div class="row xs" style="gap:8px"><span style="font-size:16px">💻</span><span style="flex:1"><b>LAP-0042</b> · battery drains fast<div class="mut">IT ticket #214 · in progress</div></span></div>
      <div class="xs mut">“Problem” opens an IT helpdesk ticket linked to the asset.</div></div>
    <div class="card" style="padding:14px;gap:6px;background:${C.raised}"><b class="xs">Yearly check · due 31 Oct</b><div class="xs mut">Once a year IT asks everyone to confirm they still have their things. Takes 10 seconds.</div><span class="btn sm" style="align-self:flex-start">${icon('check2', 12)}Confirm all 4</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('My assets', css, html, 1180);
}

// ─── Board 2: Request catalog ───────────────────────────────
function request() {
  const cats = [
    ['lap', 'Laptop', 'For new joiners or a broken one · IT picks the model', '2 available', '1–2 days', false],
    ['mon', 'Monitor', '27" 4K · a second screen needs a reason', '5 available', 'same day', true],
    ['hs', 'Headset', 'Noise-cancelling, for calls', '0 available', 'ordered on request · ~1 week', false],
    ['ph', 'Phone', 'Only for roles on call', '1 available', '2–3 days', false],
    ['kb', 'Keyboard & mouse', 'Wireless set', '8 available', 'same day', false],
    ['id', 'ID card', 'Lost or damaged card', 'printed', 'next day', false],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; My assets &nbsp;›&nbsp; <b>Request something</b>')}<main class="main">
${top('Assets', 'Request something', 'Pick what you need, to keep or for a while — approved by your team lead, manager, HR and IT head, then IT hands it over')}
<div style="display:grid;grid-template-columns:1fr 380px;gap:18px;align-items:start">
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
    ${cats.map(([k, n, d, av, lead, on]) => `<div class="cat ${on ? 'on' : ''}"><div class="row"><span style="font-size:30px;width:52px;height:52px;border-radius:14px;background:${TYPE[k][2]};display:flex;align-items:center;justify-content:center">${TYPE[k][0]}</span>${on ? `<span style="margin-left:auto;color:${C.pri}">${icon('check2', 18)}</span>` : ''}</div><b style="font-size:14px">${n}</b><div class="xs mut">${d}</div><div class="row xs" style="gap:6px;margin-top:2px"><span class="xst" style="background:${av.startsWith('0') ? C.warnSoft : C.okSoft};color:${av.startsWith('0') ? C.warn : C.ok}">${av}</span><span class="mut">${lead}</span></div></div>`).join('')}
  </div>
  <div class="card" style="padding:18px;gap:12px;border-color:${C.pri}55"><div class="row" style="gap:10px"><span style="font-size:26px">🖥️</span><div><b style="font-size:15px">Monitor</b><div class="xs mut">5 available · usually handed over the same day</div></div></div>
    <div class="fld"><label>Why do you need it?</label><div class="inp" style="min-height:56px;align-items:flex-start">Design reviews need two screens — I compare specs and mock-ups side by side</div></div>
    <div class="fld"><label>How long?</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div class="cat" style="padding:9px 10px"><b style="font-size:12.5px">To keep</b><span class="xs mut">until I return it</span></div>
      <div class="cat on" style="padding:9px 10px"><b style="font-size:12.5px">For a while (loan)</b><span class="xs mut">gets a return date</span></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div class="fld"><label>From</label><div class="inp"><b>Fri 9 Oct</b></div></div><div class="fld"><label>Return by</label><div class="inp"><b>Fri 30 Oct</b></div></div><div class="fld"><label>For</label><div class="inp"><b>Me</b> ▾</div></div></div>
    <div class="xs mut">Loans get a reminder 2 days before the return date; IT sees overdue loans.</div>
    <div class="xs mut">Managers can also request for someone in their team — e.g. a laptop for a new joiner before day 1.</div>
    <div style="padding:10px 12px;border-radius:12px;background:${C.raised};display:flex;flex-direction:column;gap:6px"><b class="xs">Who approves</b>${[[0, 'Priya Sharma', '1 · your team lead'], [5, 'Ravi Kumar', '2 · your manager'], [8, 'Hema Iyer', '3 · HR'], [3, 'Rohit Menon', '4 · IT head']].map(([pi, n2, r]) => `<div class="row xs" style="gap:8px">${photo(pi, 24, 24, { round: true })}<b>${n2}</b><span class="mut">· ${r}</span></div>`).join('')}<div class="xs mut">One after another — then IT hands it over and you confirm. A step is skipped when there’s nobody for it (no team lead) or when that person asked (a manager requesting for their team).</div></div>
    <div class="row" style="gap:8px;justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">Send request</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Request something', css, html, 1180);
}

// ─── Board 3: Requests queue (IT head / HR) ─────────────────
function queue() {
  const rows = [
    [1, 'Rahul Das', 'mon', 'Second monitor · loan till 30 Oct', 'Design reviews need two screens', 'Fri 9 Oct', [['Team lead', 'Priya ✓', 'ok'], ['Manager', 'Ravi ✓', 'ok'], ['HR', 'Hema ✓', 'ok'], ['IT head', 'you', 'now']], '5 in stock'],
    [6, 'Divya Rao', 'lap', 'Laptop for Ishaan (new joiner)', 'Manager request — joins Mon 12 Oct', 'Mon 12 Oct', [['Manager', 'Divya (asked)', 'ok'], ['HR', 'Hema ✓', 'ok'], ['IT head', 'you', 'now']], '2 in stock'],
    [4, 'Sara Khan', 'hs', 'Headset', 'Calls with US clients', '—', [['Team lead', 'Karan ✓', 'ok'], ['Manager', 'Ravi ✓', 'ok'], ['HR', 'Hema ✓', 'ok'], ['IT head', 'you', 'now']], 'none — order'],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Asset requests</b>')}<main class="main">
${top('Assets', 'Asset requests', 'Team lead → manager → HR → IT head, one after another — then IT hands over a matching asset')}
<div class="kpi">${[['Waiting for you', '3', 'oldest 2 days', C.info], ['To hand over', '2', 'approved by everyone', C.violet], ['Needed this week', '2', 'a new joiner on Mon', C.warn], ['Out of stock', 'Headset', '1 request waiting · order 2', C.bad]].map(([l, v, s, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${s}</span></div>`).join('')}</div>
<div class="row" style="gap:8px"><span class="chip on">Waiting for me · 3</span><span class="chip">To hand over · 2</span><span class="chip">All requests</span></div>
<div style="display:grid;grid-template-columns:1fr 400px;gap:16px;align-items:start">
  <div class="card" style="padding:0;overflow:hidden">${rows.map(([pi, n, k, what, why, by, steps, stock], i) => `<div style="padding:14px 16px;border-bottom:1px solid ${C.line};display:flex;flex-direction:column;gap:8px;${i === 0 ? `background:${C.priSoft}66;box-shadow:inset 3px 0 0 ${C.pri}` : ''}">
    <div class="row" style="gap:10px">${photo(pi, 34, 34, { round: true })}<div style="flex:1"><b style="font-size:13.5px">${n} · ${TYPE[k][0]} ${what}</b><div class="xs mut">“${why}” · needed by ${by}</div></div><span class="xst" style="background:${stock.startsWith('none') ? C.badSoft : C.okSoft};color:${stock.startsWith('none') ? C.bad : C.ok}">${stock}</span></div>
    ${stepper(steps)}
  </div>`).join('')}</div>
  <div class="card" style="padding:16px;gap:12px"><b style="font-size:14px">Hand over to Rahul · Second monitor</b><div class="xs mut">Approved by Priya (team lead), Ravi (manager), Hema (HR) and you · loan till Fri 30 Oct</div>
    <div class="xs mut" style="font-weight:700">Best match from stock</div>
    ${[['MON-0021', 'Dell U2723QE · New', 'never used · warranty till 2028', true], ['MON-0011', 'Dell U2720Q · Good', 'returned 14 Aug by Neha', false], ['MON-0009', 'LG 27UL500 · Fair', 'bought 2021', false]].map(([t, n, s, on]) => `<div class="row" style="gap:10px;padding:9px 10px;border-radius:12px;border:1.5px solid ${on ? C.pri : C.border};${on ? `background:${C.priSoft}55` : ''}"><span style="font-size:20px">🖥️</span><div style="flex:1"><b style="font-size:12.5px;font-family:monospace">${t}</b> <span class="xs">${n}</span><div class="xs mut">${s}</div></div>${on ? icon('check2', 16) : ''}</div>`).join('')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="fld"><label>Hand-over</label><div class="inp"><b>Today, 4 pm</b></div></div><div class="fld"><label>Condition</label><div class="inp"><b>New</b> ▾</div></div></div>
    <div style="padding:10px;border-radius:10px;background:${C.raised};display:flex;flex-direction:column;gap:5px">${['Cable and power adapter', 'Stand attached', 'Tag sticker on the back'].map((t) => `<div class="row xs" style="gap:8px"><span style="color:${C.ok};font-weight:900">✓</span>${t}</div>`).join('')}<div class="xs mut">Checklist from the asset type</div></div>
    <span class="btn pri" style="justify-content:center">Hand over MON-0021</span>
    <div class="xs mut">Rahul is asked to confirm he received it.</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Asset requests', css, html, 1180);
}

// ─── Board 4: Register ──────────────────────────────────────
function register() {
  const rows = [
    ['lap', 'LAP-0042', 'MacBook Pro 14" M3', 'with', [0, 'Priya Sharma'], 'Bengaluru', 'Jan 2027', '₹1,62,000', '₹1,08,000'],
    ['lap', 'LAP-0038', 'ThinkPad T14 Gen 4', 'repair', null, 'Vendor · 9 days', 'Mar 2026', '₹98,500', '₹49,250'],
    ['mon', 'MON-0021', 'Dell U2723QE 27"', 'avail', null, 'IT store', 'Feb 2028', '₹42,000', '₹42,000'],
    ['ph', 'PHN-0007', 'iPhone 14', 'with', [5, 'Karan Mehta'], 'Pune', 'expired', '₹69,900', '₹23,300'],
    ['hs', 'HDS-0031', 'Jabra Evolve2 65', 'confirm', [7, 'Amit Verma'], 'Bengaluru', 'Aug 2027', '₹18,400', '₹18,400'],
    ['lap', 'LAP-0012', 'MacBook Air M1', 'lost', [6, 'Divya Rao'], '—', 'expired', '₹92,900', '₹0'],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Asset register</b>')}<main class="main">
${top('Assets', 'Asset register', 'Every laptop, phone and card — where it is and who has it', `<span class="btn" style="opacity:.6">${icon('qr', 14)}QR labels &amp; scan <span class="xst" style="background:#F1EBFE;color:#7C3AED">Coming soon</span></span><span class="btn">${icon('up', 14)}Import CSV</span><span class="btn pri">${icon('plus2', 14)}Add asset</span>`)}
<div class="kpi k5">${[['Assets', '214', '₹1.38 Cr bought', C.muted], ['With people', '171', '6 not confirmed', C.info], ['Available', '28', 'Headsets: none left', C.ok], ['Needs attention', '9', '4 warranty · 3 repair · 2 old', C.warn], ['Lost this year', '2', '₹1,12,800', C.bad]].map(([l, v, s, c]) => `<div class="card"><span class="xs mut">${l}</span><b style="font-size:22px">${v}</b><span class="xs" style="color:${c};font-weight:700">${s}</span></div>`).join('')}</div>
<div style="display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:8px;flex-wrap:wrap"><div class="search" style="height:34px;flex:0 0 240px;font-size:12.5px">${icon('search', 13)} Tag, serial, model or person</div><span class="chip">Type ▾</span><span class="chip">Status ▾</span><span class="chip">Location ▾</span><span class="chip">Warranty ▾</span><div class="row" style="gap:2px;margin-left:auto;border:1px solid ${C.border};border-radius:10px;padding:2px"><span class="chip on" style="border:0">${icon('list', 12)} List</span><span class="chip" style="border:0">${icon('users', 12)} By person</span><span class="chip" style="border:0">${icon('grid', 12)} By type</span></div></div>
    <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th style="width:24px"></th><th>Asset</th><th>Status</th><th>With</th><th>Where</th><th>Warranty</th><th>Bought</th><th style="text-align:right">Cost</th></tr></thead><tbody>
      ${rows.map(([k, tag, n, s, who, loc, w, cost]) => `<tr><td><input type="checkbox" style="accent-color:${C.pri}"></td><td><div class="row" style="gap:8px"><span style="font-size:18px">${TYPE[k][0]}</span><div><b style="font-family:monospace">${tag}</b><div class="xs mut">${n}</div></div></div></td><td>${st(s)}</td><td>${who ? `<div class="row" style="gap:6px">${photo(who[0], 22, 22, { round: true })}<span class="xs">${who[1]}</span></div>` : '<span class="xs mut">—</span>'}</td><td class="xs">${loc}</td><td class="xs" style="${w === 'expired' ? `color:${C.bad};font-weight:700` : ''}">${w}</td><td class="xs mut">${tag.startsWith('LAP-00') ? 'Jan 2025' : 'Mar 2024'}</td><td class="xs" style="text-align:right"><b>${cost}</b></td></tr>`).join('')}
    </tbody></table></div>
    <div class="row xs" style="gap:8px;padding:8px 12px;border-radius:12px;background:${C.fg};color:#fff;align-self:flex-start"><b>2 selected</b><span class="btn sm">Assign</span><span class="btn sm">Move location</span></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:14px;gap:9px"><b style="font-size:13.5px">Needs attention</b>
      ${[['🛡️', 'Warranty ends in 30 days', '4 assets', C.warn], ['🔧', 'In repair over 7 days', 'LAP-0038 · 9 days', C.warn], ['📅', 'Loans due back this week', '3 · 1 overdue (PHN-0004)', C.bad], ['⏳', 'Older than 4 years', '2 laptops — plan a refresh', C.muted], ['✋', 'Handed over, not confirmed', '6 people', C.info], ['📦', 'Out of stock', 'Headset · 1 request waiting', C.bad]].map(([e, t, s, c]) => `<div class="row" style="gap:10px"><span style="font-size:18px">${e}</span><div style="flex:1"><b style="font-size:12.5px">${t}</b><div class="xs" style="color:${c};font-weight:700">${s}</div></div><span class="xs" style="color:${C.pri};font-weight:700">View</span></div>`).join('')}</div>
    <div class="card" style="padding:14px;gap:8px"><b style="font-size:13.5px">Stock by type</b>
      ${[['lap', 2, 5], ['mon', 5, 3], ['hs', 0, 2], ['kb', 8, 4]].map(([k, have, min]) => `<div><div class="row xs" style="justify-content:space-between"><span>${TYPE[k][0]} ${TYPE[k][1]}</span><b style="color:${have < min ? C.bad : C.fg}">${have} <span class="mut" style="font-weight:500">/ keep ${min}</span></b></div><div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, (have / Math.max(min, 1)) * 60)}%;background:${have < min ? C.bad : C.ok}"></i></div></div>`).join('')}</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Asset register', css, html, 1180);
}

// ─── Board 5: Asset detail ──────────────────────────────────
function detail() {
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; Asset register &nbsp;›&nbsp; <b>LAP-0042</b>')}<main class="main">
<div class="card" style="padding:0;overflow:hidden"><div style="display:grid;grid-template-columns:220px 1fr auto;gap:0">
  <div style="background:${TYPE.lap[2]};display:flex;align-items:center;justify-content:center;font-size:84px">💻</div>
  <div style="padding:18px 20px;display:flex;flex-direction:column;gap:6px"><div class="row" style="gap:8px"><h1 style="margin:0;font-family:monospace">LAP-0042</h1>${st('with')}</div><div style="font-size:15px;font-weight:700">MacBook Pro 14" M3 · 18 GB · 512 GB</div><div class="xs mut">Serial C02XK1JHMD6T · bought 12 Jan 2025 from iStore Bengaluru · ₹1,62,000</div>
    <div class="row" style="gap:10px;margin-top:4px">${photo(0, 30, 30, { round: true })}<div><b style="font-size:13px">With Priya Sharma</b><div class="xs mut">since 12 Jan 2025 · confirmed · Bengaluru office</div></div></div>
    <div class="row" style="gap:6px;margin-top:6px"><span class="btn sm">${icon('undo', 12)}Take back</span><span class="btn sm">${icon('swap', 12)}Swap</span><span class="btn sm">${icon('wrench', 12)}Send for repair</span><span class="btn sm">Mark lost</span><span class="btn sm">Retire</span></div></div>
  <div style="padding:18px;display:flex;flex-direction:column;align-items:center;gap:6px;border-left:1px solid ${C.line}"><div style="width:86px;height:86px;border-radius:10px;border:2px dashed ${C.border};display:flex;align-items:center;justify-content:center;color:${C.muted}">${icon('qr', 30)}</div><span class="xs mut">QR label</span><span class="xst" style="background:#F1EBFE;color:#7C3AED">Coming soon</span></div>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid ${C.line}">${[['Bought', '₹1,62,000', '12 Jan 2025 · iStore'], ['Warranty', 'till 12 Jan 2027', '15 months left'], ['Repairs', '1 · ₹4,500', 'battery, Jun 2025'], ['Condition', 'Good', 'checked at last hand-over']].map(([l, v, s], i) => `<div style="padding:12px 16px;${i < 3 ? `border-right:1px solid ${C.line}` : ''}"><div class="xs mut">${l}</div><b style="font-size:16px">${v}</b><div class="xs mut">${s}</div></div>`).join('')}</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr 340px;gap:16px;align-items:start">
  <div class="card" style="padding:14px 16px;gap:10px"><b style="font-size:13.5px">History</b>
    ${[['👤', 'Handed to Priya Sharma', '12 Jan 2025 · condition New · by Rohit', C.info], ['🔧', 'Repair — battery replaced', 'Jun 2025 · Apple service · ₹4,500 · 6 days', C.warn], ['✅', 'Yearly check — Priya confirmed', '28 Oct 2025', C.ok], ['🧾', 'Bought from iStore Bengaluru', '12 Jan 2025 · invoice INV-88213', C.muted]].map(([e, t, s, c]) => `<div class="row" style="gap:10px;align-items:flex-start"><span style="width:28px;height:28px;border-radius:50%;background:${c}1a;display:flex;align-items:center;justify-content:center;flex:none">${e}</span><div><b style="font-size:12.5px">${t}</b><div class="xs mut">${s}</div></div></div>`).join('')}</div>
  <div class="card" style="padding:14px 16px;gap:10px"><b style="font-size:13.5px">Specs</b>
    ${[['Processor', 'Apple M3 Pro'], ['Memory', '18 GB'], ['Storage', '512 GB SSD'], ['OS', 'macOS 15'], ['MDM enrolled', 'Yes']].map(([k, v]) => `<div class="row xs" style="justify-content:space-between;border-bottom:1px solid ${C.line};padding-bottom:6px"><span class="mut">${k}</span><b>${v}</b></div>`).join('')}
    <div class="xs mut">Fields come from the Laptop type</div></div>
  <div class="card" style="padding:14px 16px;gap:8px"><b style="font-size:13.5px">${icon('doc', 14)} Documents</b>
    ${[['Invoice INV-88213.pdf', '312 KB'], ['Warranty card.jpg', '1.2 MB'], ['Repair bill Jun 2025.pdf', '180 KB']].map(([n, s]) => `<div class="row xs" style="gap:8px;padding:7px 9px;border:1px solid ${C.border};border-radius:9px">${icon('doc', 13)}<b style="flex:1">${n}</b><span class="mut">${s}</span></div>`).join('')}
    <span class="btn sm" style="align-self:flex-start">${icon('up', 12)}Add a file</span></div>
</div>
</main></div></div>`;
  return dcPage('Asset detail', css, html, 1180);
}

// ─── Board 6: Returns & yearly check ────────────────────────
function returns() {
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Returns & checks</b>')}<main class="main">
${top('Assets', 'Returns & yearly check', 'Loans due back, people leaving with company assets, and the once-a-year “do you still have it?” check')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
  <div class="card" style="padding:16px;gap:12px"><div class="row"><b style="font-size:14.5px;flex:1">Leaving soon — collect assets</b><span class="xs mut">from Employees › notice</span></div>
    ${[[5, 'Karan Mehta', 'Last day Fri 16 Oct', [['lap', 'LAP-0031', false], ['ph', 'PHN-0007', false], ['id', 'ID-0099', false]]], [6, 'Divya Rao', 'Last day Mon 2 Nov', [['lap', 'LAP-0019', true], ['id', 'ID-0102', false]]]].map(([pi, n, when, items]) => `<div style="border:1px solid ${C.border};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px"><div class="row" style="gap:10px">${photo(pi, 32, 32, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${when}</div></div><span class="xst" style="background:${C.warnSoft};color:${C.warn}">${items.filter((x) => !x[2]).length} to collect</span></div>
      ${items.map(([k, tag, done]) => `<div class="row xs" style="gap:8px;padding:6px 8px;border-radius:9px;background:${done ? C.okSoft : C.raised}"><span style="font-size:15px">${TYPE[k][0]}</span><b style="font-family:monospace">${tag}</b><span class="mut" style="flex:1">${TYPE[k][1]}</span>${done ? `<span style="color:${C.ok};font-weight:800">✓ returned · Good</span>` : '<span class="btn sm">Take back</span>'}</div>`).join('')}
      <div class="xs mut">HR sees this on the exit checklist (“Company assets returned”)</div></div>`).join('')}
  </div>
  <div class="card" style="padding:16px;gap:12px"><div class="row"><b style="font-size:14.5px;flex:1">Yearly check 2026</b><span class="xst" style="background:${C.infoSoft};color:${C.info}">open till 31 Oct</span></div>
    <div class="row" style="gap:16px;align-items:center"><div style="width:110px;height:110px;border-radius:50%;background:conic-gradient(${C.ok} 0 72%,${C.warn} 72% 80%,${C.line} 80%);display:flex;align-items:center;justify-content:center"><div style="width:82px;height:82px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:20px">72%</b><span class="xs mut">confirmed</span></div></div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px">${[[C.ok, '123 people confirmed all their assets'], [C.warn, '14 reported something (damaged / not with them)'], [C.line, '34 haven’t answered yet']].map(([c, t]) => `<div class="row" style="gap:8px"><span style="width:10px;height:10px;border-radius:3px;background:${c}"></span>${t}</div>`).join('')}</div></div>
    <div class="xs mut" style="font-weight:700">Reported</div>
    ${[[1, 'Rahul Das', 'MON-0014', 'Screen has a dead pixel line'], [7, 'Amit Verma', 'KB-0040', 'I don’t have this — gave it back in March']].map(([pi, n, tag, t]) => `<div class="row xs" style="gap:8px;padding:8px 10px;border-radius:10px;background:${C.warnSoft}">${photo(pi, 22, 22, { round: true })}<b>${n}</b><b style="font-family:monospace">${tag}</b><span style="flex:1">“${t}”</span><span class="btn sm">Open</span></div>`).join('')}
    <div class="row" style="gap:8px"><span class="btn sm">Remind the 34</span><span class="btn sm">Close the check</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Returns & yearly check', css, html, 1180);
}

// ─── Board 7: Asset types ───────────────────────────────────
function types() {
  const rows = [
    ['lap', 'LAP', '3 years', '12 months', 5, 2, true, 46],
    ['mon', 'MON', '5 years', '36 months', 3, 5, true, 38],
    ['ph', 'PHN', '3 years', '12 months', 1, 1, true, 14],
    ['hs', 'HDS', '2 years', '24 months', 2, 0, true, 22],
    ['kb', 'KB', '2 years', '12 months', 4, 8, true, 31],
    ['id', 'ID', '—', '—', 10, 25, false, 171],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Asset types</b>')}<main class="main">
${top('Assets', 'Asset types', 'Kinds of equipment — tag prefix, warranty, stock to keep, what people can request, and starter kits', `<span class="btn pri">${icon('plus2', 14)}Add type</span>`)}
<div style="display:grid;grid-template-columns:1fr 400px;gap:18px;align-items:start">
  <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th>Type</th><th>Prefix</th><th>Replace after</th><th>Warranty</th><th>Keep in stock</th><th>Requestable</th><th style="text-align:right">Assets</th></tr></thead><tbody>
    ${rows.map(([k, pre, life, w, min, have, req, n], i) => `<tr style="${i === 0 ? `background:${C.priSoft}66;box-shadow:inset 3px 0 0 ${C.pri}` : ''}"><td><b>${TYPE[k][0]} ${TYPE[k][1]}</b></td><td style="font-family:monospace;font-weight:800">${pre}-</td><td class="xs">${life}</td><td class="xs">${w}</td><td class="xs"><b style="color:${have < min ? C.bad : C.fg}">${have}</b> <span class="mut">/ ${min}</span></td><td>${req ? `<span class="xst" style="background:${C.okSoft};color:${C.ok}">Yes</span>` : `<span class="xst" style="background:${C.raised};color:${C.muted}">IT only</span>`}</td><td style="text-align:right" class="xs"><b>${n}</b></td></tr>`).join('')}
  </tbody></table></div>
  <div class="card" style="padding:18px;gap:12px"><div class="row"><b style="font-size:15px;flex:1">💻 Laptop</b><span class="tgl"></span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="fld"><label>Tag prefix</label><div class="inp"><b style="font-family:monospace">LAP</b> → LAP-0043</div></div><div class="fld"><label>Icon</label><div class="inp">💻 ▾</div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div class="fld"><label>Replace after</label><div class="inp"><b>4</b> years</div></div><div class="fld"><label>Warranty</label><div class="inp"><b>12</b> months</div></div><div class="fld"><label>Keep in stock</label><div class="inp"><b>5</b></div></div></div>
    <div class="fld"><label>Extra fields</label><div style="display:flex;flex-wrap:wrap;gap:6px">${['Processor', 'Memory', 'Storage', 'OS', 'MDM enrolled'].map((f) => `<span class="chip">${f} ×</span>`).join('')}<span class="chip" style="color:${C.pri}">+ field</span></div></div>
    <div class="fld"><label>Hand-over checklist</label><div style="display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:10px;background:${C.raised}">${['Charger', 'Laptop sleeve', 'MDM enrolled', 'Tag sticker on the base'].map((t) => `<div class="row xs" style="gap:8px"><span style="color:${C.ok};font-weight:900">✓</span>${t}</div>`).join('')}</div></div>
    <div class="row xs" style="gap:10px"><span class="tgl"></span><div><b>People can request it</b><div class="mut">shows in “Request something” with what’s in stock</div></div></div>
    <div class="row xs" style="gap:10px"><span class="tgl"></span><div><b>Can be lent for a while</b><div class="mut">loan up to <b>30 days</b>, with a return date and reminder</div></div></div>
    <div class="row" style="gap:8px;justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">Save</span></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Asset types', css, html, 1180);
}

// ─── Board 9: Starter kits ──────────────────────────────────
function kits() {
  const kitsList = [
    ['Everyone', 'every new employee', ['lap', 'id', 'kb'], true],
    ['Managers & senior leads', 'role Manager or Team lead · designation “Senior …”', ['mon', 'hs'], false],
    ['Engineering', 'department Engineering', ['mon'], false],
    ['Sales', 'department Sales', ['ph'], false],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Starter kits</b>')}<main class="main">
${top('Assets', 'Starter kits', 'New joiners get their things automatically — IT is asked to have them ready by the joining date', `<span class="btn pri">${icon('plus2', 14)}Add a kit rule</span>`)}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:16px;gap:10px"><b style="font-size:14.5px">Who gets what</b><div class="xs mut">Rules add up — a senior engineer gets Everyone + Managers & senior leads + Engineering.</div>
      ${kitsList.map(([n, who, items, base], i) => `<div style="border:1.5px solid ${i === 1 ? C.pri : C.border};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;${i === 1 ? `background:${C.priSoft}55` : ''}"><div class="row"><b style="font-size:13.5px;flex:1">${n}</b>${base ? '<span class="xst" style="background:#EEF0FF;color:#3730A3">base kit</span>' : '<span class="xst" style="background:#E6F6F0;color:#059669">+ extra</span>'}</div><div class="xs mut">${who}</div><div class="row" style="gap:6px;flex-wrap:wrap">${items.map((k) => `<span class="chip" style="font-size:12px">${TYPE[k][0]} ${TYPE[k][1]}</span>`).join('')}</div></div>`).join('')}
    </div>
    <div class="card" style="padding:16px;gap:10px;border-color:${C.pri}55"><b style="font-size:14px">Edit · Managers & senior leads</b>
      <div class="fld"><label>Who</label><div style="display:flex;flex-wrap:wrap;gap:6px"><span class="chip on">Role: Manager</span><span class="chip on">Role: Team lead</span><span class="chip on">Designation contains “Senior”</span><span class="chip" style="color:${C.pri}">+ department / location</span></div></div>
      <div class="fld"><label>Extra items</label><div style="display:flex;flex-direction:column;gap:6px">${[['mon', 1], ['hs', 1]].map(([k, q]) => `<div class="row" style="gap:8px;padding:7px 10px;border:1px solid ${C.border};border-radius:10px"><span style="font-size:18px">${TYPE[k][0]}</span><b style="flex:1;font-size:13px">${TYPE[k][1]}</b><span class="inp" style="padding:3px 8px">× <b>${q}</b></span></div>`).join('')}<span class="btn sm" style="align-self:flex-start">${icon('plus2', 12)}Add item</span></div></div>
      <div class="row xs" style="gap:10px"><span class="tgl"></span><div><b>Also when someone is promoted into this group</b><div class="mut">IT is asked to hand over the extra items (e.g. a monitor for a new manager)</div></div></div>
      <div class="row" style="gap:8px;justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">Save</span></div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="card" style="padding:16px;gap:10px"><div class="row"><b style="font-size:14.5px;flex:1">New joiners to prepare</b><span class="xs mut">from Employees › add employee</span></div>
      ${[[9, 'Ishaan Verma', 'Software Engineer · Engineering', 'Joins Mon 12 Oct · in 7 days', [['lap', 'LAP-0044 reserved', 'ok'], ['id', 'printing', 'wait'], ['kb', 'KB-0052 reserved', 'ok'], ['mon', 'MON-0021 reserved', 'ok']]], [2, 'Meera Nair', 'Engineering Manager', 'Joins Mon 19 Oct · in 14 days', [['lap', 'LAP-0045 reserved', 'ok'], ['id', 'to print', 'todo'], ['kb', 'KB-0053 reserved', 'ok'], ['mon', 'none in stock — order', 'bad'], ['hs', 'none in stock — order', 'bad']]]].map(([pi, n, r, when, items]) => `<div style="border:1px solid ${C.border};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:7px"><div class="row" style="gap:10px">${photo(pi, 32, 32, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${r}</div></div><span class="xs" style="font-weight:700;color:${C.info}">${when}</span></div>
        ${items.map(([k, t, stt]) => `<div class="row xs" style="gap:8px;padding:5px 8px;border-radius:8px;background:${stt === 'ok' ? C.okSoft : stt === 'bad' ? C.badSoft : C.raised}"><span style="font-size:14px">${TYPE[k][0]}</span><b style="width:120px">${TYPE[k][1]}</b><span style="flex:1;color:${stt === 'bad' ? C.bad : stt === 'ok' ? C.ok : C.muted};font-weight:700">${t}</span></div>`).join('')}
        <div class="row" style="gap:6px"><span class="btn sm">Reserve from stock</span><span class="btn sm">Hand over on day 1</span></div></div>`).join('')}
    </div>
    <div class="card" style="padding:16px;gap:8px;background:${C.raised}"><b style="font-size:13.5px">In the add-employee form</b>
      <div class="row xs" style="gap:8px;padding:9px 11px;border-radius:10px;background:#fff;border:1px solid ${C.border}">📦<span style="flex:1"><b>Starter kit:</b> Laptop, ID card, Keyboard & mouse, Monitor <span class="mut">(Everyone + Engineering)</span></span><span class="xs" style="color:${C.pri};font-weight:700">Change</span></div>
      <div class="xs mut">HR can add or remove items for this person. The kit needs no approvals — it’s company policy — and goes straight to IT “to prepare”.</div></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Starter kits', css, html, 1180);
}

// ─── Board 8: Who sees what ─────────────────────────────────
function matrix() {
  const roles = ['Employee', 'Line manager', 'IT head / IT admin', 'HR', 'Company admin'];
  const Y = '<span class="y">✓</span>';
  const N = '<span class="n">—</span>';
  const s = (t) => `<span class="s">${t}</span>`;
  const rows = [
    ['MY ASSETS', null],
    ['See own assets, confirm hand-overs, yearly check', [Y, Y, Y, Y, Y]],
    ['Report a problem (IT ticket), ask to return / swap', [Y, Y, Y, Y, Y]],
    ['Request something from the catalog', [Y, Y, Y, Y, Y]],
    ['Request for someone in their team (e.g. new joiner)', [N, Y, Y, Y, Y]],
    ['Ask to keep it or for a while (loan with a return date)', [Y, Y, Y, Y, Y]],
    ['REQUESTS', null],
    ['1 · Approve as team lead', [N, s('if they’re the person’s team lead'), N, N, Y]],
    ['2 · Approve as manager', [N, Y, N, N, Y]],
    ['3 · Approve as HR', [N, N, N, Y, Y]],
    ['4 · Approve as IT head', [N, N, Y, N, Y]],
    ['Hand over an asset (pick from stock, checklist)', [N, N, Y, N, Y]],
    ['See requests', [s('own'), s('their team'), s('all'), s('all'), s('all')]],
    ['REGISTER', null],
    ['See assets', [s('own'), s('their team’s'), s('all'), s('all'), s('all')]],
    ['Add, import, edit, print labels, scan', [N, N, Y, N, Y]],
    ['Assign, take back, repair, lost, retire', [N, N, Y, N, Y]],
    ['Costs and documents', [N, N, Y, s('read'), Y]],
    ['RETURNS & CHECKS', null],
    ['Leavers’ assets to collect', [N, s('their team'), Y, Y, Y]],
    ['Run the yearly check, see who reported what', [N, N, Y, s('read'), Y]],
    ['Loans due back / overdue', [s('own'), s('their team'), Y, Y, Y]],
    ['QR labels & scanning (coming soon)', [N, N, Y, N, Y]],
    ['Starter kits for new joiners (prepare & hand over)', [N, s('see their joiner’s kit'), Y, Y, Y]],
    ['SETUP', null],
    ['Starter kit rules (who gets what)', [N, N, Y, Y, Y]],
    ['Asset types, fields, stock levels, checklists', [N, N, Y, N, Y]],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Who sees what</b>')}<main class="main">
${top('Assets', 'Who sees and does what', 'Everyone is also an employee — the other columns add to the first. Nobody approves their own request.')}
<div class="card" style="padding:0;overflow:hidden"><table class="tbl mx"><thead><tr><th style="width:38%">What</th>${roles.map((r) => `<th>${r}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(([t, cells]) => (cells ? `<tr><td><b style="font-weight:600">${t}</b></td>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>` : `<tr><td colspan="6" style="background:${C.raised};font-size:10.5px;font-weight:900;letter-spacing:.08em;color:${C.muted}">${t}</td></tr>`)).join('')}
</tbody></table></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
  ${[['Sidebar: Employee / manager', 'My assets'], ['Sidebar: IT head', 'My assets · Asset requests · Asset register · Returns & checks · Asset types'], ['Sidebar: HR', 'My assets · Asset requests · Asset register (read) · Returns & checks']].map(([t, s2]) => `<div class="card" style="padding:12px 14px;gap:4px"><b style="font-size:13px">${t}</b><span class="xs mut">${s2}</span></div>`).join('')}
</div>
</main></div></div>`;
  return dcPage('Assets — who sees what', css, html, 1180);
}

// ─── Board 10: Motion ideas (live) ──────────────────────────
function motion() {
  const mcss = css.replace('</style>', `
.demo{border:1px solid ${C.border};border-radius:16px;background:#fff;padding:16px;display:flex;flex-direction:column;gap:10px}
.stage{height:170px;border-radius:12px;background:linear-gradient(160deg,#F6F7FB,#EEF0FF);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.box{position:absolute;bottom:26px;width:96px;height:62px;background:#C8A27A;border-radius:6px;box-shadow:inset 0 -8px 0 rgba(0,0,0,.08)}
.lid{position:absolute;bottom:86px;width:104px;height:14px;background:#B88E63;border-radius:4px;transform-origin:left bottom;animation:lid 4s ease-in-out infinite}
.rise{position:absolute;bottom:40px;font-size:46px;animation:rise 4s ease-in-out infinite}
.stamp{position:absolute;top:16px;right:18px;background:${C.ok};color:#fff;font-weight:900;font-size:12px;padding:5px 10px;border-radius:99px;opacity:0;animation:stamp 4s ease-in-out infinite}
@keyframes lid{0%,15%{transform:rotate(0)}35%,80%{transform:rotate(-70deg)}100%{transform:rotate(0)}}
@keyframes rise{0%,25%{transform:translateY(30px) scale(.6);opacity:0}45%,80%{transform:translateY(-30px) scale(1);opacity:1}100%{transform:translateY(30px) scale(.6);opacity:0}}
@keyframes stamp{0%,50%{opacity:0;transform:scale(2) rotate(-12deg)}58%,85%{opacity:1;transform:scale(1) rotate(-12deg)}100%{opacity:0}}
.kitbox{position:absolute;bottom:22px;width:150px;height:56px;border:3px dashed ${C.pri};border-radius:12px;background:#ffffff88}
.drop{position:absolute;font-size:28px;top:-40px;animation:drop 5s ease-in infinite}
.drop:nth-of-type(1){left:calc(50% - 60px);animation-delay:0s}.drop:nth-of-type(2){left:calc(50% - 22px);animation-delay:.7s}.drop:nth-of-type(3){left:calc(50% + 16px);animation-delay:1.4s}.drop:nth-of-type(4){left:calc(50% + 50px);animation-delay:2.1s}
@keyframes drop{0%{top:-40px;opacity:0}12%{opacity:1}28%,85%{top:104px;opacity:1}100%{top:104px;opacity:0}}
@property --p{syntax:'<percentage>';inherits:false;initial-value:0%}
.ring{position:absolute;top:14px;right:14px;width:46px;height:46px;border-radius:50%;background:conic-gradient(${C.ok} var(--p),${C.line} 0);animation:fill 5s linear infinite}
.ring:after{content:'';position:absolute;inset:6px;border-radius:50%;background:#fff}
@keyframes fill{0%{--p:0%}20%{--p:25%}34%{--p:50%}48%{--p:75%}62%,100%{--p:100%}}
.track{position:absolute;left:30px;right:30px;top:80px;height:4px;background:${C.line};border-radius:4px}
.trackfill{position:absolute;left:0;top:0;bottom:0;background:${C.ok};border-radius:4px;animation:tf 6s ease-in-out infinite}
@keyframes tf{0%{width:0}25%{width:33%}50%{width:66%}75%,100%{width:100%}}
.node{position:absolute;top:-9px;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid ${C.border}}
.node.n0{left:-4px;animation:nd 6s infinite 0s}.node.n1{left:calc(33% - 11px);animation:nd 6s infinite 1.5s}.node.n2{left:calc(66% - 11px);animation:nd 6s infinite 3s}.node.n3{right:-4px;animation:nd 6s infinite 4.5s}
@keyframes nd{0%{border-color:${C.border}}4%{border-color:${C.info};box-shadow:0 0 0 0 ${C.info}88}14%{box-shadow:0 0 0 10px ${C.info}00;border-color:${C.ok};background:${C.okSoft}}100%{border-color:${C.ok};background:${C.okSoft}}}
.tl{position:absolute;top:104px;font-size:10.5px;font-weight:800;color:${C.muted};transform:translateX(-50%)}
@property --q{syntax:'<percentage>';inherits:false;initial-value:100%}
@property --c{syntax:'<color>';inherits:false;initial-value:#059669}
.cd{width:110px;height:110px;border-radius:50%;background:conic-gradient(var(--c) var(--q),${C.line} 0);animation:cd 6s linear infinite;display:flex;align-items:center;justify-content:center;position:relative}
.cd:after{content:'';position:absolute;inset:10px;border-radius:50%;background:#fff}
.cd b{position:relative;z-index:1;font-size:13px;text-align:center}
@keyframes cd{0%{--q:100%;--c:${C.ok}}60%{--q:20%;--c:${C.ok}}62%{--c:${C.warn}}85%{--q:0%;--c:${C.warn}}88%{--q:100%;--c:${C.bad};transform:translateX(0)}90%{transform:translateX(-4px)}92%{transform:translateX(4px)}94%,100%{--q:100%;--c:${C.bad};transform:translateX(0)}}
.stock{width:220px;display:flex;flex-direction:column;gap:12px}
.sbar{height:12px;border-radius:99px;background:${C.line};overflow:hidden}.sbar i{display:block;height:100%;border-radius:99px}
.low i{background:${C.bad};width:12%;animation:lowp 1.6s ease-in-out infinite}
@keyframes lowp{0%,100%{opacity:1}50%{opacity:.45}}
.okb i{background:${C.ok};animation:refill 4s ease-out infinite}
@keyframes refill{0%{width:15%}40%,100%{width:85%}}
.conf{position:absolute;width:8px;height:12px;border-radius:2px;top:50%;left:50%;animation:burst 3s ease-out infinite;opacity:0}
@keyframes burst{0%{transform:translate(0,0) rotate(0);opacity:0}8%{opacity:1}60%{opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(540deg);opacity:0}}
.badge{background:#fff;border-radius:99px;padding:10px 16px;font-weight:900;font-size:14px;box-shadow:0 10px 30px -10px rgba(0,0,0,.3);animation:pop 3s ease-out infinite;position:relative;z-index:1}
@keyframes pop{0%{transform:scale(.6);opacity:0}12%{transform:scale(1.08);opacity:1}20%,85%{transform:scale(1);opacity:1}100%{opacity:0}}
.tilt{width:190px;border-radius:16px;border:1px solid ${C.border};background:#fff;overflow:hidden;animation:tilt 5s ease-in-out infinite;position:relative}
.tilt .art2{height:84px;background:#EEF0FF;display:flex;align-items:center;justify-content:center;font-size:40px}
.tilt:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.7) 45%,transparent 60%);transform:translateX(-120%);animation:shine 5s ease-in-out infinite}
@keyframes tilt{0%,100%{transform:perspective(600px) rotateY(0) rotateX(0)}30%{transform:perspective(600px) rotateY(14deg) rotateX(6deg)}60%{transform:perspective(600px) rotateY(-12deg) rotateX(-4deg)}}
@keyframes shine{0%,20%{transform:translateX(-120%)}50%,100%{transform:translateX(120%)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`);
  const confetti = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const r = 70 + (i % 3) * 18;
    const colors = [C.pri, C.ok, C.warn, C.pink, C.info, C.violet];
    return `<i class="conf" style="background:${colors[i % 6]};--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r)}px"></i>`;
  }).join('');
  const demos = [
    ['Hand-over “unboxing”', 'Plays once when IT hands something over and when the employee taps “I got it” — the lid opens, the item rises, a ✓ stamp lands.', `<div class="box"></div><div class="lid"></div><div class="rise">💻</div><div class="stamp">✓ Received</div>`],
    ['Starter kit packing', 'New joiner card (IT and HR): items drop into the box as IT reserves them; the ring fills to “ready for day 1”.', `<div class="kitbox"></div><span class="drop">💻</span><span class="drop">🪪</span><span class="drop">⌨️</span><span class="drop">🖥️</span><div class="ring"></div>`],
    ['Request on its way', 'The tracker fills step by step — team lead → manager → HR → IT head — and each step glows once as it’s approved.', `<div class="track"><div class="trackfill"></div><span class="node n0"></span><span class="node n1"></span><span class="node n2"></span><span class="node n3"></span></div>${[['Team lead', 0], ['Manager', 33], ['HR', 66], ['IT head', 100]].map(([t, x]) => `<span class="tl" style="left:calc(30px + (100% - 60px) * ${x / 100})">${t}</span>`).join('')}`],
    ['Loan countdown', 'On a loaned item: the ring empties as the return date nears — amber 2 days before, a small shake and red when overdue.', `<div class="cd"><b>5 days<br><span class="xs mut" style="font-weight:600">to return</span></b></div>`],
    ['Low stock', 'Register and types: a low-stock bar gently pulses until it’s restocked; restocking fills it smoothly.', `<div class="stock"><div class="xs" style="font-weight:800">🎧 Headset · 0 / keep 2</div><div class="sbar low"><i></i></div><div class="xs" style="font-weight:800">🖥️ Monitor · restocked</div><div class="sbar okb"><i></i></div></div>`],
    ['All confirmed', 'Yearly check: a short confetti burst when someone confirms all their things — and once for IT when the whole company is done.', `${confetti}<div class="badge">🎉 All 4 confirmed</div>`],
    ['Asset card tilt', 'My assets: cards tilt slightly toward the pointer with a soft shine (desktop only).', `<div class="tilt"><div class="art2">💻</div><div style="padding:10px 12px"><b style="font-size:13px">MacBook Pro 14"</b><div class="xs mut" style="font-family:monospace;font-weight:800">LAP-0042</div></div></div>`],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Animation ideas</b>')}<main class="main">
${top('Assets', 'Animation ideas (live)', 'Short moments for real events — hand-overs, kits, approvals, loans — not decoration. All off when “reduce motion” is on.')}
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
  ${demos.map(([t, d, stage]) => `<div class="demo"><div class="stage">${stage}</div><b style="font-size:13.5px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}
  <div class="demo" style="background:${C.raised}"><b style="font-size:13.5px">Rules</b>${['Play on an event, once — no endless loops (except a waiting pulse)', 'Under 1.2 seconds, never blocks clicking', 'Follow the user’s theme and motion settings', 'Nothing moves when the device asks for reduced motion'].map((r) => `<div class="row xs" style="gap:8px;align-items:flex-start"><span style="color:${C.ok};font-weight:900">✓</span>${r}</div>`).join('')}</div>
</div>
</main></div></div>`;
  return dcPage('Assets — animation ideas', mcss, html, 1180);
}

// ─── Board 11: Product animations (live) ────────────────────
function products() {
  const pcss = css.replace('</style>', `
.demo{border:1px solid ${C.border};border-radius:16px;background:#fff;padding:14px;display:flex;flex-direction:column;gap:8px}
.stage{height:160px;border-radius:12px;background:radial-gradient(circle at 50% 30%,#FFFFFF,#E9ECF6);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.where{font-size:10.5px;font-weight:800;color:${C.pri};text-transform:uppercase;letter-spacing:.06em}
/* laptop: lid opens, screen boots */
.lap{position:relative;width:180px;height:120px;perspective:500px}
.lap .scr{position:absolute;left:22px;bottom:16px;width:136px;height:88px;background:#111827;border:5px solid #374151;border-radius:9px 9px 2px 2px;transform-origin:bottom;animation:lid 4.5s ease-in-out infinite;overflow:hidden}
.lap .scr i{position:absolute;inset:0;background:linear-gradient(135deg,#4F46E5,#DB2777);opacity:0;animation:boot 4.5s ease-in-out infinite}
.lap .scr b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;opacity:0;animation:boot 4.5s ease-in-out infinite;animation-delay:.25s}
.lap .base{position:absolute;left:4px;bottom:8px;width:172px;height:10px;background:linear-gradient(#D1D5DB,#9CA3AF);border-radius:2px 2px 12px 12px}
.lap .base:after{content:'';position:absolute;left:72px;top:0;width:28px;height:4px;background:#6B7280;border-radius:0 0 6px 6px}
@keyframes lid{0%,8%{transform:rotateX(-86deg)}32%,84%{transform:rotateX(0)}100%{transform:rotateX(-86deg)}}
@keyframes boot{0%,34%{opacity:0}44%,80%{opacity:1}88%,100%{opacity:0}}
/* phone: rises, lights up, notification */
.ph{position:relative;width:66px;height:124px;border-radius:16px;background:#111827;border:4px solid #374151;animation:phup 4.5s ease-in-out infinite;overflow:hidden}
.ph i{position:absolute;inset:0;background:linear-gradient(160deg,#0EA5E9,#7C3AED);opacity:0;animation:boot 4.5s ease-in-out infinite}
.ph:before{content:'';position:absolute;top:5px;left:50%;width:18px;height:5px;margin-left:-9px;border-radius:9px;background:#000;z-index:2}
.note{position:absolute;top:22px;left:50%;transform:translateX(-50%);background:#fff;border-radius:10px;padding:4px 8px;font-size:9px;font-weight:800;white-space:nowrap;z-index:3;opacity:0;animation:note 4.5s ease-in-out infinite}
@keyframes phup{0%,6%{transform:translateY(60px) rotate(-8deg);opacity:0}28%,86%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(60px);opacity:0}}
@keyframes note{0%,48%{opacity:0;transform:translate(-50%,-8px)}56%,80%{opacity:1;transform:translate(-50%,0)}90%,100%{opacity:0}}
/* monitor: power-on line */
.mon{position:relative;width:170px;height:118px}
.mon .scr{position:absolute;left:0;top:0;width:170px;height:96px;background:#111827;border:5px solid #374151;border-radius:8px;overflow:hidden}
.mon .scr i{position:absolute;inset:0;background:linear-gradient(135deg,#059669,#0EA5E9);transform:scaleX(0) scaleY(.03);animation:power 4.5s ease-in-out infinite}
.mon .neck{position:absolute;left:78px;top:96px;width:14px;height:14px;background:#9CA3AF}.mon .foot{position:absolute;left:55px;top:108px;width:60px;height:7px;border-radius:6px;background:#9CA3AF}
@keyframes power{0%,12%{transform:scaleX(0) scaleY(.03)}26%{transform:scaleX(1) scaleY(.03)}38%,82%{transform:scaleX(1) scaleY(1)}92%,100%{transform:scaleX(0) scaleY(.03)}}
/* ID card: 3D flip */
.idc{width:150px;height:96px;perspective:700px}
.idc .in{position:relative;width:100%;height:100%;transform-style:preserve-3d;animation:flip 4.5s ease-in-out infinite}
.idc .f,.idc .bk{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;box-shadow:0 10px 24px -10px rgba(0,0,0,.35);padding:10px;display:flex;gap:8px}
.idc .f{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff}
.idc .bk{background:#fff;transform:rotateY(180deg);flex-direction:column;justify-content:center;align-items:center;border:1px solid ${C.border}}
.idc .ph2{width:38px;height:46px;border-radius:7px;background:#ffffff40}
.bars{width:110px;height:24px;background:repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 4px,#111 4px 5px,#fff 5px 8px)}
@keyframes flip{0%,30%{transform:rotateY(0)}45%,80%{transform:rotateY(180deg)}95%,100%{transform:rotateY(360deg)}}
/* headset: sound waves */
.hs{position:relative;font-size:58px}
.wave{position:absolute;top:50%;width:26px;height:26px;margin-top:-13px;border:3px solid ${C.info};border-radius:50%;opacity:0;animation:wave 2.2s ease-out infinite}
.wave.l{left:-18px}.wave.r{right:-18px}.wave.d{animation-delay:.7s}
@keyframes wave{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.2);opacity:0}}
/* keyboard + mouse */
.kb{display:grid;grid-template-columns:repeat(8,16px);gap:4px;padding:8px;border-radius:10px;background:#D1D5DB}
.kb span{height:14px;border-radius:3px;background:#fff;box-shadow:0 2px 0 #9CA3AF;animation:key 3.2s infinite}
${Array.from({ length: 24 }, (_, i) => `.kb span:nth-child(${i + 1}){animation-delay:${((i * 7) % 24) * 0.13}s}`).join('')}
@keyframes key{0%,6%,100%{transform:translateY(0);background:#fff;box-shadow:0 2px 0 #9CA3AF}3%{transform:translateY(2px);background:${C.priSoft};box-shadow:0 0 0 #9CA3AF}}
.mouse{position:relative;width:30px;height:46px;border-radius:15px;background:#fff;border:2px solid #9CA3AF;margin-left:16px}
.mouse:before{content:'';position:absolute;left:13px;top:6px;width:2px;height:10px;background:#9CA3AF;border-radius:2px}
.ripple{position:absolute;left:4px;top:4px;width:10px;height:10px;border-radius:50%;background:${C.pri};animation:rip 1.6s ease-out infinite}
@keyframes rip{0%{transform:scale(.3);opacity:.9}100%{transform:scale(3);opacity:0}}
/* states */
.state{position:relative;font-size:46px;width:90px;height:90px;display:flex;align-items:center;justify-content:center}
.wr{position:absolute;right:-6px;top:-4px;font-size:24px;animation:wr 1.2s ease-in-out infinite;transform-origin:70% 70%}
@keyframes wr{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(25deg)}}
.spark{position:absolute;right:6px;top:22px;width:5px;height:5px;border-radius:50%;background:${C.warn};animation:spark 1.2s ease-out infinite}
@keyframes spark{0%{transform:translate(0,0);opacity:1}100%{transform:translate(14px,-12px);opacity:0}}
.hg{position:absolute;right:-8px;top:-6px;font-size:24px;animation:hg 3s ease-in-out infinite}
@keyframes hg{0%,40%{transform:rotate(0)}55%,100%{transform:rotate(180deg)}}
.intobox{animation:intobox 3.6s ease-in-out infinite}
@keyframes intobox{0%,10%{transform:translateY(-40px);opacity:1}45%,70%{transform:translateY(18px) scale(.7);opacity:0}100%{transform:translateY(-40px);opacity:1}}
.cbox{position:absolute;bottom:4px;width:84px;height:40px;background:#C8A27A;border-radius:6px}
.radar{position:absolute;inset:0;border:2px dashed ${C.bad};border-radius:50%;animation:radar 2s ease-out infinite}
@keyframes radar{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.4);opacity:0}}
.lostit{opacity:.35;filter:grayscale(1)}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`);
  const items = [
    ['💻 Laptop', 'Hand-over & “I got it”', 'The lid opens and the screen boots to the company logo — then settles closed. Also on hover in My assets.', `<div class="lap"><div class="scr"><i></i><b>aakash</b></div><div class="base"></div></div>`],
    ['📱 Phone', 'Hand-over', 'The phone rises, the screen lights up and a “Received ✓” notification drops in.', `<div class="ph"><i></i></div><div class="note">✓ Received</div>`],
    ['🖥️ Monitor', 'Hand-over · back from repair', 'An old-TV style power-on line opens into a glowing screen.', `<div class="mon"><div class="scr"><i></i></div><div class="neck"></div><div class="foot"></div></div>`],
    ['🪪 ID card', 'Printed · handed over', 'The card flips in 3D: photo and name on the front, barcode on the back.', `<div class="idc"><div class="in"><div class="f"><div class="ph2"></div><div><b style="font-size:12px;display:block">Ishaan Verma</b><span style="font-size:9.5px;opacity:.8">Software Engineer</span><div style="font-size:9px;margin-top:14px;opacity:.8">ID-0108</div></div></div><div class="bk"><div class="bars"></div><span style="font-size:9px;color:${C.muted};margin-top:6px">aakash-portal · ID-0108</span></div></div></div>`],
    ['🎧 Headset', 'Hand-over · problem fixed', 'Sound waves pulse from both ear cups.', `<div class="hs">🎧<span class="wave l"></span><span class="wave r"></span><span class="wave l d"></span><span class="wave r d"></span></div>`],
    ['⌨️ Keyboard & mouse', 'Hand-over', 'Keys press in a little typing ripple; the mouse clicks.', `<div class="row" style="align-items:center"><div class="kb">${'<span></span>'.repeat(24)}</div><div class="mouse"><span class="ripple"></span></div></div>`],
  ];
  const states = [
    ['In repair', 'A small wrench works on the device, with sparks.', `<div class="state">💻<span class="wr">🔧</span><span class="spark"></span></div>`],
    ['On loan', 'An hourglass turns over — the countdown to the return date.', `<div class="state">📱<span class="hg">⏳</span></div>`],
    ['Returned', 'The item drops back into the box.', `<div class="state"><span class="intobox">🖥️</span><span class="cbox"></span></div>`],
    ['Lost', 'Greyed out with a search ping.', `<div class="state"><span class="lostit">💻</span><span class="radar"></span></div>`],
  ];
  const html = `<div class="app">${sidebar('Assets')}<div class="col">${header('Assets &nbsp;›&nbsp; <b>Product animations</b>')}<main class="main">
${top('Assets', 'Product animations (live)', 'Each kind of asset gets its own small moment — built in CSS (no videos), so they load instantly and follow light / dark themes')}
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
  ${items.map(([t, where, d, stage]) => `<div class="demo"><div class="stage">${stage}</div><div class="row"><b style="font-size:13.5px;flex:1">${t}</b><span class="where">${where}</span></div><div class="xs mut">${d}</div></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr) 1.3fr;gap:14px">
  ${states.map(([t, d, stage]) => `<div class="demo"><div class="stage" style="height:120px">${stage}</div><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}
  <div class="demo" style="background:${C.raised}"><b style="font-size:13px">Ideas taken from the web</b>
    ${[['3D lid opening', 'CSS perspective + rotateX, as in many CodePen laptop mock-ups'], ['Card flip', 'two faces with backface-visibility — the classic 3D flip'], ['Apple-style product reveal', 'the device turns as you scroll — later, for the asset page hero'], ['Micro-interactions', 'small check / ripple / pulse feedback, as on Dribbble device-management apps']].map(([a, b]) => `<div class="xs"><b>${a}</b> — <span class="mut">${b}</span></div>`).join('')}
    <div class="xs mut" style="margin-top:4px">All play once on the event, under ~1.5 s, and stop with “reduce motion”.</div></div>
</div>
</main></div></div>`;
  return dcPage('Assets — product animations', pcss, html, 1180);
}

const boards = [
  ['CAAssetsMine.dc.html', 'Assets · My assets — cards (kept & on loan), confirm hand-over, report a problem (IT ticket), swap / return, request tracker, yearly check', mine, 1180],
  ['CAAssetRequest.dc.html', 'Assets · Request something — catalog with stock, keep or loan (return date), for me / my team, team lead → manager → HR → IT head', request, 1180],
  ['CAAssetRequests.dc.html', 'Assets · Requests — queue with steps (team lead → manager → HR → IT head) & stock, hand over: best match, condition, checklist', queue, 1180],
  ['CAAssetRegister.dc.html', 'Assets · Register — KPIs, list / by person / by type, bulk actions, needs attention (incl. loans due), stock; QR coming soon', register, 1180],
  ['CAAssetDetail.dc.html', 'Assets · Asset detail — bought, warranty, repairs, history, specs, documents (QR label coming soon)', detail, 1180],
  ['CAAssetReturns.dc.html', 'Assets · Returns & yearly check — leavers’ assets to collect, “do you still have it?” campaign', returns, 1180],
  ['CAAssetTypes.dc.html', 'Assets · Types — prefix, icon, replace after, warranty, keep-in-stock, extra fields, hand-over checklist, requestable, loans', types, 1180],
  ['CAAssetWhoSees.dc.html', 'Assets · Who sees and does what — Employee, Line manager, IT head, HR, Company admin', matrix, 1180],
  ['CAAssetKits.dc.html', 'Assets · Starter kits — who gets what (rules add up), new joiners to prepare (reserved / to order), kit in the add-employee form, promotions', kits, 1180],
  ['CAAssetProducts.dc.html', 'Assets · Product animations (live) — laptop lid opens & boots, phone lights up, monitor powers on, ID card flips, headset waves, keys type; repair / loan / returned / lost', products, 1180],
  ['CAAssetMotion.dc.html','Assets · Animation ideas (live) — hand-over unboxing, kit packing, request tracker, loan countdown, low stock, all confirmed, card tilt', motion, 1180],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: (i % 4) * 1520, y: 30500 + Math.floor(i / 4) * 1400 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n16 = { kind: 'title1', maxW: 6000, text: 'Company · Assets — my assets, request catalog, requests & hand-over, register, asset detail, returns & yearly check, types, who sees what', w: 240, x: 0, y: 30200 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
