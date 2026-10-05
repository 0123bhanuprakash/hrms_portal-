// Super Admin → Plans: overview with tier cards, compare grid, and the plan editor with impact preview.
// Light theme, same top bar as today (from the screenshot); only the page content changes.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, helmetFonts, P } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  up: '<path d="m5 12 7-7 7 7M12 19V5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  hist: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  move: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
});

const T = { bg: '#F7F5F0', side: '#FBFAF7', surface: '#FFFFFF', raised: '#FAF8F4', border: '#E8E3D9', line: '#EFEBE3', fg: '#1C1917', muted: '#78716C', gold: '#B7791F', goldSoft: '#FBF1DF', goldText: '#8A5A12', ok: '#15803D', okSoft: '#E7F6EC', warn: '#B45309', warnSoft: '#FEF3E2', bad: '#C2410C', badSoft: '#FDECE5', info: '#1D4ED8', infoSoft: '#E8EFFD', violet: '#6D28D9', violetSoft: '#F1EAFE', teal: '#0F766E', tealSoft: '#E3F4F1' };

// Feature catalog (19), grouped as in the app
const GROUPS = [
  ['People', [['dir', 'Employee directory'], ['org', 'Organisation structure'], ['docs', 'Employee documents']]],
  ['Time', [['att', 'Attendance'], ['leave', 'Leave'], ['shifts', 'Shifts & rosters', 'beta']]],
  ['Engagement', [['ann', 'Announcements'], ['kudos', 'Kudos']]],
  ['Work', [['assets', 'Assets'], ['help', 'Helpdesk'], ['proj', 'Projects'], ['ts', 'Timesheets']]],
  ['Pay', [['exp', 'Expenses'], ['payroll', 'Payroll'], ['salary', 'Salary & compensation']]],
  ['Insights', [['reports', 'Reports']]],
  ['Administration', [['users', 'Users & roles', 'core'], ['settings', 'Settings & branding', 'core'], ['audit', 'Audit log']]],
];
const ALL = GROUPS.flatMap(([, f]) => f.map((x) => x[0]));
const STARTER = ['dir', 'org', 'att', 'leave', 'users', 'settings'];
const GROWTH = [...STARTER, 'docs', 'payroll', 'salary', 'reports', 'audit'];
const PLANS = [
  { key: 'starter', name: 'Starter', desc: 'Core HR for small teams.', f: STARTER, lim: 50, cos: 0, color: '#0F766E', soft: T.tealSoft, emp: 0 },
  { key: 'growth', name: 'Growth', desc: 'Payroll, documents and reports for growing companies.', f: GROWTH, lim: 500, cos: 0, color: '#1D4ED8', soft: T.infoSoft, emp: 0 },
  { key: 'enterprise', name: 'Enterprise', desc: 'Everything, including beta features.', f: ALL, lim: null, cos: 4, color: '#B7791F', soft: T.goldSoft, emp: 517 },
];
const LABEL = Object.fromEntries(GROUPS.flatMap(([, f]) => f.map((x) => [x[0], x[1]])));
// Share of companies on Enterprise actually using each feature in the last 30 days (illustrative)
const USE = { dir: 100, org: 100, docs: 50, att: 100, leave: 100, shifts: 0, ann: 75, kudos: 50, assets: 25, help: 50, proj: 50, ts: 50, exp: 50, payroll: 25, salary: 25, reports: 75, users: 100, settings: 100, audit: 75 };

const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:${T.bg}}
.app{display:flex;min-height:100vh;font-family:Manrope,system-ui,sans-serif;color:${T.fg};background:${T.bg};position:relative}
.sb{flex:0 0 250px;background:${T.side};border-right:1px solid ${T.line};display:flex;flex-direction:column}
.sb-h{display:flex;gap:10px;align-items:center;padding:16px 14px}
.sb-logo{width:34px;height:34px;border-radius:8px;background:${T.gold};color:#fff;display:flex;align-items:center;justify-content:center}
.sb-h b{display:block;font-size:15px}.sb-h span{font-size:11.5px;color:${T.muted}}
.sb-s{margin:0 14px 10px;height:36px;border:1px solid ${T.border};border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 8px;color:${T.muted};font-size:13px;background:#fff}
.kbd{border:1px solid ${T.border};border-radius:4px;padding:0 5px;font-size:11px;font-family:monospace}
.sb-g{padding:10px 14px 2px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#A8A29E}
.sb-i{display:flex;align-items:center;gap:10px;height:36px;margin:0 14px;padding:0 10px;border-radius:6px;font-size:14px;color:#44403C}
.sb-i svg{color:#A8A29E}
.sb-i.on{background:${T.goldSoft};color:${T.fg};font-weight:700;position:relative}.sb-i.on svg{color:${T.gold}}
.sb-i.on::before{content:"";position:absolute;left:-14px;top:7px;bottom:7px;width:3px;border-radius:0 3px 3px 0;background:${T.gold}}
.sb-f{margin-top:auto;border-top:1px solid ${T.line};padding:10px 14px;display:flex;gap:10px;align-items:center}
.av{width:34px;height:34px;border-radius:8px;background:${T.goldSoft};color:${T.goldText};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex:none}
.col{flex:1;min-width:0;display:flex;flex-direction:column}
.hdr{height:60px;border-bottom:1px solid ${T.line};display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:${T.bg}}
.crumb{font-size:14px;color:${T.muted}}.crumb b{color:${T.fg};font-weight:600}
.op{display:flex;align-items:center;gap:16px;font-size:13px;color:${T.muted}}
.dot{width:8px;height:8px;border-radius:50%;background:#22C55E;display:inline-block}
.tg{width:56px;height:30px;border-radius:99px;background:#F1EEE8;position:relative;border:1px solid ${T.border}}.tg::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#F5B342}
.main{padding:26px 34px 40px;display:flex;flex-direction:column;gap:18px;width:100%;box-sizing:border-box}
.eyebrow{font-size:13px;color:${T.gold};font-weight:600}
h1{margin:2px 0 0;font-size:30px;font-weight:800;letter-spacing:-.02em}
.sub{color:${T.muted};font-size:14.5px;margin-top:4px;max-width:760px}
.row{display:flex;align-items:center;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:9px;border:1px solid ${T.border};background:#fff;color:${T.fg};font:inherit;font-size:13.5px;font-weight:700;white-space:nowrap}
.btn.pri{background:${T.gold};border-color:${T.gold};color:#fff}
.btn.sm{height:32px;padding:0 11px;font-size:12.5px}
.btn.ghost{border-color:transparent;background:none}
.card{background:${T.surface};border:1px solid ${T.border};border-radius:14px;box-shadow:0 1px 2px rgba(28,25,23,.04)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.kpi{padding:14px 16px;display:flex;flex-direction:column;gap:4px;position:relative;overflow:hidden}
.kpi span{font-size:12px;color:${T.muted}}.kpi b{font-size:26px;font-weight:800;letter-spacing:-.02em}
.kpi small{font-size:12px;color:${T.muted}}
.dist{display:flex;height:8px;border-radius:99px;overflow:hidden;background:${T.line};margin-top:6px}.dist i{display:block;height:100%}
.seg{display:flex;border:1px solid ${T.border};border-radius:9px;overflow:hidden;background:#fff}.seg span{height:36px;padding:0 12px;display:flex;align-items:center;gap:6px;color:${T.muted};font-size:13px;font-weight:600}.seg span.on{background:${T.goldSoft};color:${T.goldText}}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.chip{display:inline-flex;align-items:center;font-size:12.5px;padding:4px 10px;border-radius:99px;background:${T.goldSoft};color:${T.goldText};border:1px solid #F3E2C2}
.chip.new{background:${T.okSoft};color:${T.ok};border-color:#CBEBD6;font-weight:700}
.mut{color:${T.muted}}.xs{font-size:12px}
/* tier cards */
.tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch}
.tier{position:relative;display:flex;flex-direction:column;overflow:hidden;transition:transform .25s,box-shadow .25s}
.tier:hover{transform:translateY(-4px);box-shadow:0 18px 40px -18px rgba(28,25,23,.25)}
.tier .band{height:96px;position:relative;overflow:hidden}
.tier .band::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-100%);animation:shine 4.5s ease-in-out infinite}
@keyframes shine{0%,60%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.steps{position:absolute;left:22px;bottom:-1px;display:flex;align-items:flex-end;gap:5px}.steps i{display:block;width:18px;border-radius:4px 4px 0 0;background:rgba(255,255,255,.55)}.steps i.on{background:#fff}
.tier .body{padding:18px 22px 20px;display:flex;flex-direction:column;gap:14px;flex:1}
.tier h2{margin:0;font-size:21px;font-weight:800;display:flex;align-items:center;gap:8px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.stats div{background:${T.raised};border:1px solid ${T.line};border-radius:10px;padding:10px 12px}
.stats b{display:block;font-size:18px;font-weight:800}.stats span{font-size:11.5px;color:${T.muted}}
.ringw{display:flex;align-items:center;gap:12px}
.inc{font-size:12.5px;color:${T.muted};font-weight:600}
.faces{display:flex}.faces span{width:26px;height:26px;border-radius:7px;border:2px solid #fff;margin-left:-6px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;color:#fff}.faces span:first-child{margin-left:0}
.badge-pop{position:absolute;top:14px;right:14px;background:#fff;color:${T.goldText};font-size:11px;font-weight:800;padding:4px 10px;border-radius:99px;box-shadow:0 4px 12px rgba(0,0,0,.12)}
.tfoot{border-top:1px solid ${T.line};padding:12px 22px;display:flex;align-items:center;gap:8px}
.side2{display:grid;grid-template-columns:1.2fr 1fr;gap:18px}
.sec{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sec h3{margin:0;font-size:15px;display:flex;align-items:center;gap:8px}
.li{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid ${T.line};border-radius:10px;background:${T.raised};font-size:13px}
.lg{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11.5px;color:#fff;flex:none}
.meter{height:6px;border-radius:99px;background:${T.line};overflow:hidden}.meter i{display:block;height:100%;border-radius:99px;transform-origin:left;animation:fillw 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes fillw{from{transform:scaleX(0)}}
/* compare */
table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px}
th,td{padding:11px 14px;border-bottom:1px solid ${T.line};text-align:center}
th:first-child,td:first-child{text-align:left}
thead th{position:sticky;top:0;background:#fff;vertical-align:bottom;padding:16px 14px}
.grp td{background:${T.raised};font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};padding:8px 14px}
.yes{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;color:#fff}
.no{display:inline-block;width:14px;height:2px;border-radius:2px;background:#D6D3D1}
.use{display:block;font-size:10.5px;color:${T.muted};margin-top:3px}
.col-hi{background:linear-gradient(${T.goldSoft},${T.goldSoft}) padding-box}
td.col-hi,th.col-hi{background:#FFFBF3}
.diff td{background:#FFFDF8}
/* editor */
.ed{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;align-items:start}
.tabs{display:flex;gap:22px;border-bottom:1px solid ${T.border};font-size:14px;color:${T.muted};padding:0 4px}
.tabs span{padding:10px 0;display:flex;align-items:center;gap:6px}.tabs span.on{color:${T.fg};font-weight:700;box-shadow:inset 0 -2px 0 ${T.gold}}
.tabs i{font-style:normal;font-size:11px;background:${T.line};border-radius:99px;padding:1px 7px;font-weight:700}
.fg{padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.fg h4{margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};display:flex;justify-content:space-between}
.fr{display:flex;align-items:center;gap:12px;padding:9px 8px;border-radius:9px}
.fr:hover{background:${T.raised}}
.fr .nm{flex:1;font-size:14px;font-weight:600}.fr .nm small{display:block;font-size:12px;color:${T.muted};font-weight:500}
.sw{width:38px;height:22px;border-radius:99px;background:#D6D3D1;position:relative;flex:none;transition:background .2s}.sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .2s}
.sw.on{background:${T.gold}}.sw.on::after{left:19px}.sw.lock{opacity:.55}
.fr.chg{background:#FFF8EC;outline:1px dashed #E9C98D}
.fr.chg.off{background:#FFF3EF;outline-color:#F2B8A2}
.tag{font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:99px}
.save{position:sticky;bottom:0;margin-top:4px;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:14px;background:#1C1917;color:#F5F5F4;box-shadow:0 18px 40px -16px rgba(0,0,0,.45);font-size:13.5px}
.save .btn{height:34px}
.impact{border:1px solid #F2C9B8;background:#FFF6F2}
.tl{display:flex;gap:10px;font-size:12.5px}.tl .d{width:8px;height:8px;border-radius:50%;margin-top:5px;flex:none}
</style>\n</helmet>`;

const sidebar = () => `<aside class="sb">
<div class="sb-h"><span class="sb-logo">${icon('shield', 18)}</span><span><b>HRMS Platform</b><span>Super Admin console</span></span></div>
<div class="sb-s">${icon('search', 14)}<span style="flex:1">Search…</span><span class="kbd">Ctrl</span><span class="kbd">K</span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Dashboard</div>
<div class="sb-g">TENANTS</div><div class="sb-i">${icon('building')}Companies</div><div class="sb-i">${icon('plus')}Onboard company</div>
<div class="sb-g">GOVERNANCE</div><div class="sb-i">${icon('file')}Audit logs</div>
<div class="sb-g">PLATFORM</div><div class="sb-i on">${icon('layers')}Plans</div><div class="sb-i">${icon('palette')}Themes</div><div class="sb-i">${icon('server')}System</div>
<div class="sb-f"><span class="av">SA</span><span style="flex:1"><b style="display:block;font-size:14px">Super Admin</b><span class="xs mut">Super Admin</span></span>${icon('updown', 14)}</div>
</aside>`;
const header = (crumb) => `<header class="hdr"><div class="crumb">Platform &nbsp;›&nbsp; ${crumb}</div><div class="op"><span><span class="dot"></span>&nbsp; Operational</span><span class="tg"></span></div></header>`;
const ring = (pct, color, size = 52, label = '') => {
  const r = (size - 7) / 2, c = 2 * Math.PI * r;
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-block;flex:none"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${T.line}" stroke-width="5"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px">${label}</b></span>`;
};
const COS = [['PB', 'Perf Bench', '#5B5BF0'], ['AP', 'aakash-portal', 'linear-gradient(135deg,#E9416A,#7A2BD9)'], ['BT', 'Beta Test Co', '#2F5BEA'], ['AT', 'Acme Test Company', '#C2410C']];
const lg = ([ini, , bg], s = 34) => `<span class="lg" style="width:${s}px;height:${s}px;background:${bg}">${ini}</span>`;

// ─── Board 1: overview ──────────────────────────────────────
function overview() {
  const tier = (p, i) => {
    const prev = PLANS[i - 1];
    const added = prev ? p.f.filter((k) => !prev.f.includes(k)) : p.f;
    const pct = Math.round((p.f.length / 19) * 100);
    return `<div class="card tier">
  <div class="band" style="background:linear-gradient(135deg,${p.color},${p.color}cc)">
    ${p.cos ? '<span class="badge-pop">★ Most used</span>' : ''}
    <div class="steps">${[0, 1, 2].map((s) => `<i class="${s <= i ? 'on' : ''}" style="height:${18 + s * 14}px"></i>`).join('')}</div>
    <div style="position:absolute;right:20px;bottom:14px;color:#fff;text-align:right"><div style="font-size:11px;opacity:.85;font-weight:700;letter-spacing:.08em">TIER ${i + 1}</div><div style="font-size:22px;font-weight:800">${p.lim ? `up to ${p.lim}` : 'Unlimited'}</div><div style="font-size:11.5px;opacity:.85">employees</div></div>
  </div>
  <div class="body">
    <div><h2>${p.name}${i === 2 ? `<span class="pill" style="background:${T.violetSoft};color:${T.violet}">incl. beta</span>` : ''}</h2><div class="mut" style="font-size:14px;margin-top:4px">${p.desc}</div></div>
    <div class="ringw">${ring(pct, p.color, 56, `${p.f.length}`)}<div style="flex:1"><b style="font-size:14px">${p.f.length} of 19 features</b><div class="meter" style="margin-top:6px"><i style="width:${pct}%;background:${p.color}"></i></div></div></div>
    <div><div class="inc">${prev ? `Everything in ${prev.name}, plus` : 'Includes'}</div><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${added.slice(0, 7).map((k) => `<span class="chip ${prev ? 'new' : ''}">${prev ? '+ ' : ''}${LABEL[k]}</span>`).join('')}${added.length > 7 ? `<span class="chip" style="background:#fff">+${added.length - 7} more</span>` : ''}</div></div>
    <div class="stats"><div><b>${p.cos}</b><span>companies</span></div><div><b>${p.emp}</b><span>employees</span></div><div><b>${p.cos ? '0' : '—'}</b><span>near limit</span></div></div>
  </div>
  <div class="tfoot">${p.cos ? `<span class="faces">${COS.map((c) => `<span style="background:${c[2]}">${c[0]}</span>`).join('')}</span><span class="xs mut" style="flex:1">4 companies</span>` : `<span class="xs mut" style="flex:1">No companies yet</span>`}<span class="btn sm">${icon('copy', 13)}Duplicate</span><span class="btn sm pri">Edit</span></div>
</div>`;
  };
  const html = `<div class="app">${sidebar()}<div class="col">${header('<b>Plans</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Platform</div><h1>Plans</h1><div class="sub">Bundles of features and limits. Each company is on one plan; switch individual features per company on its Plan &amp; features tab.</div></div>
<span class="seg"><span class="on">${icon('grid', 14)}Cards</span><span>${icon('table', 14)}Compare</span></span><span class="btn pri">${icon('plus', 15)}New plan</span></div>
<div class="kpis">
  <div class="card kpi"><span>Plans</span><b>3 <small style="font-size:13px;font-weight:600">active · 0 archived</small></b><small>19 features in the catalog · 2 coming soon</small></div>
  <div class="card kpi"><span>Companies by plan</span><b>4</b><div class="dist"><i style="width:2%;background:${PLANS[0].color}"></i><i style="width:2%;background:${PLANS[1].color}"></i><i style="width:96%;background:${PLANS[2].color}"></i></div><small><span style="color:${PLANS[0].color}">●</span> Starter 0 &nbsp; <span style="color:${PLANS[1].color}">●</span> Growth 0 &nbsp; <span style="color:${PLANS[2].color}">●</span> Enterprise 4</small></div>
  <div class="card kpi"><span>Custom switches</span><b>2</b><small>companies with a feature turned on/off outside their plan</small></div>
  <div class="card kpi" style="border-color:#F3E2C2"><span>Trials ending soon</span><b style="color:${T.warn}">1</b><small>Payroll for Beta Test Co · ends in 4 days</small></div>
</div>
<div class="tiers">${PLANS.map(tier).join('')}</div>
<div class="side2">
  <div class="card sec"><h3>${icon('up', 15)}Upgrade candidates<span class="xs mut" style="margin-left:auto;font-weight:500">companies outgrowing their plan</span></h3>
    ${[[COS[1], 'Growth → Enterprise', 'Using 3 features not in Growth (Kudos, Assets, Helpdesk) via custom switches', 82], [COS[0], 'at 493 of 500 employees', 'Would hit the Growth limit — Enterprise has no limit', 99]].map(([c, t, d, v]) => `<div class="li">${lg(c)}<div style="flex:1;min-width:0"><b style="display:block">${c[1]} <span class="mut xs" style="font-weight:600">· ${t}</span></b><span class="xs mut">${d}</span><div class="meter" style="margin-top:6px;width:70%"><i style="width:${v}%;background:${v > 90 ? T.bad : T.warn}"></i></div></div><span class="btn sm">${icon('move', 13)}Move plan</span></div>`).join('')}
    <div class="xs mut">Example data — today every company is on Enterprise, so this list would be empty.</div>
  </div>
  <div class="card sec"><h3>${icon('gift', 15)}Custom switches &amp; trials</h3>
    ${[[COS[2], 'Payroll', 'ON', 'trial · ends 8 Oct', T.warn], [COS[3], 'Kudos', 'OFF', 'turned off · “billing hold”', T.bad], [COS[1], 'Shifts & rosters', 'ON', 'beta access · no end date', T.violet]].map(([c, f, m, d, col]) => `<div class="li">${lg(c, 30)}<div style="flex:1"><b style="display:block">${c[1]}</b><span class="xs mut">${d}</span></div><span class="pill" style="background:${m === 'ON' ? T.okSoft : T.badSoft};color:${m === 'ON' ? T.ok : T.bad}">${f} ${m}</span><span class="dot" style="background:${col}"></span></div>`).join('')}
  </div>
</div>
</main></div></div>`;
  return dcPage('Plans overview', css, html, 1500);
}

// ─── Board 2: compare grid ──────────────────────────────────
function compare() {
  const head = `<tr><th style="width:30%"><div class="xs mut" style="font-weight:600">19 features · 7 groups</div><label class="row xs" style="margin-top:10px;font-weight:600"><span class="sw on" style="transform:scale(.8)"></span>Only show differences</label></th>${PLANS.map((p, i) => `<th class="${i === 1 ? 'col-hi' : ''}"><div style="height:5px;border-radius:99px;background:${p.color};margin-bottom:12px"></div><div style="font-size:17px;font-weight:800">${p.name}</div><div class="xs mut" style="font-weight:600;margin-top:2px">${p.f.length}/19 · ${p.lim ? `${p.lim} employees` : 'unlimited'}</div><div class="xs mut" style="font-weight:500">${p.cos} companies</div></th>`).join('')}</tr>`;
  const limits = `<tr class="grp"><td colspan="4">Limits</td></tr><tr><td><b>Max employees</b><span class="use">active employees per company</span></td>${PLANS.map((p, i) => `<td class="${i === 1 ? 'col-hi' : ''}"><b>${p.lim ?? '∞'}</b></td>`).join('')}</tr>`;
  const body = GROUPS.map(([g, fs]) => `<tr class="grp"><td colspan="4">${g}</td></tr>${fs.map(([k, l, tag]) => {
    const has = PLANS.map((p) => p.f.includes(k));
    const differs = !has.every((h) => h === has[0]);
    return `<tr class="${differs ? 'diff' : ''}"><td><span style="font-weight:600">${l}</span>${tag === 'beta' ? ` <span class="tag" style="background:${T.violetSoft};color:${T.violet}">BETA</span>` : ''}${tag === 'core' ? ` <span class="tag" style="background:${T.line};color:${T.muted}">ALWAYS ON</span>` : ''}</td>${PLANS.map((p, i) => `<td class="${i === 1 ? 'col-hi' : ''}">${has[i] ? `<span class="yes" style="background:${p.color}">${icon('check2', 13)}</span>${p.cos ? `<span class="use">${USE[k]}% use it</span>` : ''}` : '<span class="no"></span>'}</td>`).join('')}</tr>`;
  }).join('')}`).join('');
  const html = `<div class="app">${sidebar()}<div class="col">${header('<b>Plans</b>')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Platform</div><h1>Plans</h1><div class="sub">Compare plans side by side. Click a tick to switch a feature in or out of a plan — you’ll see who’s affected before saving.</div></div>
<span class="seg"><span>${icon('grid', 14)}Cards</span><span class="on">${icon('table', 14)}Compare</span></span><span class="btn pri">${icon('plus', 15)}New plan</span></div>
<div class="card" style="overflow:hidden"><table><thead>${head}</thead><tbody>${limits}${body}</tbody></table></div>
<div class="row xs mut"><span class="yes" style="background:${T.gold};width:16px;height:16px">${icon('check2', 10)}</span> included &nbsp;·&nbsp; <span class="no"></span> not included &nbsp;·&nbsp; “% use it” = share of the plan’s companies that used the feature in the last 30 days &nbsp;·&nbsp; highlighted rows differ between plans</div>
</main></div></div>`;
  return dcPage('Plans compare', css, html, 1640);
}

// ─── Board 3: plan editor ───────────────────────────────────
function editor() {
  const p = PLANS[1];
  const changed = { kudos: 'on', payroll: 'off' };
  const groups = GROUPS.map(([g, fs]) => {
    const on = fs.filter(([k]) => (p.f.includes(k) && changed[k] !== 'off') || changed[k] === 'on').length;
    return `<div class="card fg"><h4><span>${g}</span><span>${on}/${fs.length}</span></h4>${fs.map(([k, l, tag]) => {
      const inPlan = p.f.includes(k);
      const ch = changed[k];
      const isOn = ch ? ch === 'on' : inPlan;
      const note = { org: 'Needs Employee directory', ts: 'Needs Projects', salary: 'Needs Payroll', docs: 'Uploads count toward storage' }[k];
      return `<div class="fr ${ch ? `chg ${ch}` : ''}"><span class="nm">${l}${tag === 'beta' ? ` <span class="tag" style="background:${T.violetSoft};color:${T.violet}">BETA</span>` : ''}${note ? `<small>${note}</small>` : ''}${ch === 'off' ? `<small style="color:${T.bad}">Also turns off Salary &amp; compensation</small>` : ''}</span>${ch ? `<span class="tag" style="background:${ch === 'on' ? T.okSoft : T.badSoft};color:${ch === 'on' ? T.ok : T.bad}">${ch === 'on' ? 'ADDED' : 'REMOVED'}</span>` : ''}<span class="sw ${isOn ? 'on' : ''} ${tag === 'core' ? 'lock' : ''}"></span></div>`;
    }).join('')}</div>`;
  });
  const html = `<div class="app">${sidebar()}<div class="col">${header('Plans &nbsp;›&nbsp; <b>Growth</b>')}<main class="main">
<div class="row" style="align-items:flex-start"><span style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,${p.color},${p.color}bb);display:flex;align-items:center;justify-content:center;color:#fff">${icon('layers', 24)}</span>
<div style="flex:1"><h1 style="font-size:26px">Growth <span class="pill" style="background:${T.okSoft};color:${T.ok};vertical-align:middle">Active</span></h1><div class="sub">Payroll, documents and reports for growing companies. · key <code style="background:${T.line};padding:1px 6px;border-radius:5px">growth</code></div></div>
<span class="btn">${icon('copy', 14)}Duplicate</span><span class="btn">${icon('archive', 14)}Archive</span></div>
<div class="tabs"><span class="on">Features <i>11</i></span><span>Limits</span><span>Companies <i>0</i></span><span>${icon('hist', 14)}History</span></div>
<div class="ed">
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="row"><span class="btn sm">${icon('search', 13)}Find a feature…</span><span class="xs mut" style="flex:1">Features that need another feature switch it on with them.</span><span class="btn sm ghost">Turn all on</span><span class="btn sm ghost">Copy from Starter ▾</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start">${groups.join('')}</div>
    <div class="save"><b style="color:#FCD34D">2 unsaved changes</b><span style="opacity:.75">+ Kudos · − Payroll (and Salary)</span><span style="flex:1"></span><span class="btn sm" style="background:transparent;color:#F5F5F4;border-color:#44403C">Discard</span><span class="btn sm pri">Review &amp; save</span></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;position:sticky;top:0">
    <div class="card sec impact"><h3 style="color:${T.bad}">${icon('alert', 15)}Before you save — who’s affected</h3>
      <div class="xs" style="line-height:1.55">Removing <b>Payroll</b> also removes <b>Salary &amp; compensation</b> for companies on Growth.</div>
      ${[[COS[0], 'used Payroll 12 times in 30 days', T.bad], [COS[1], 'has it switched on directly — not affected', T.ok]].map(([c, d, col]) => `<div class="li" style="background:#fff">${lg(c, 30)}<div style="flex:1"><b style="display:block">${c[1]}</b><span class="xs" style="color:${col}">${d}</span></div></div>`).join('')}
      <div class="xs mut">Data stays — the menu and pages just hide. Turn it back on and everything returns.</div>
    </div>
    <div class="card sec"><h3>${icon('users', 15)}Limits</h3>
      <div class="row"><span style="flex:1;font-size:13.5px;font-weight:600">Max employees</span><span class="btn sm" style="width:90px;justify-content:space-between">500 <span class="mut">▾</span></span></div>
      <div class="xs mut">Companies on this plan today use at most 0 of 500. Set empty for unlimited.</div>
    </div>
    <div class="card sec"><h3>${icon('hist', 15)}Recent changes</h3>
      ${[['Max employees 250 → 500', 'you · 2 days ago', T.gold], ['+ Reports, + Audit log', 'you · 3 days ago', T.ok], ['Plan created', 'seed · 3 days ago', T.muted]].map(([a, b, c]) => `<div class="tl"><span class="d" style="background:${c}"></span><div><b>${a}</b><div class="mut">${b}</div></div></div>`).join('')}
    </div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Plan editor', css, html, 1500);
}

const boards = [
  ['SAPlans.dc.html', 'Super Admin · Plans — tier cards, summary, upgrade candidates, trials', overview, 1500],
  ['SAPlansCompare.dc.html', 'Super Admin · Plans — compare grid with real use', compare, 1640],
  ['SAPlanEditor.dc.html', 'Super Admin · Plans — editor with “who’s affected” before saving', editor, 1500],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(__dirname, '..', 'canvas', 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 7900 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n5 = { kind: 'title1', maxW: 4480, text: 'Super Admin · Plans — tier cards, compare grid, editor with impact preview', w: 240, x: 0, y: 7600 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
