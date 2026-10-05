// Super Admin → Companies: enhanced list, card view with onboarding pipeline, and the company panel.
// Same sidebar and top bar as today (from the screenshot); only the page content changes.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, helmetFonts, P } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41z"/><circle cx="7" cy="7" r="1.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  arrowUp: '<path d="m18 15-6-6-6 6"/>',
  hdd: '<path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  shieldc: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
});

const T = { bg: '#0B0A08', side: '#0E0D0B', surface: '#15130F', raised: '#1B1813', border: '#2A261F', line: '#221F19', fg: '#EDEDEF', muted: '#A9A59C', gold: '#D69E3A', goldSoft: '#2E2414', goldText: '#E8BD6E', ok: '#5FD39B', okSoft: '#12291D', warn: '#F2B65A', warnSoft: '#2E2210', bad: '#FF8A7A', badSoft: '#341714', info: '#7FB3F5', infoSoft: '#16233A', teal: '#5EB8B0' };

const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:${T.bg}}
.app{display:flex;min-height:100vh;font-family:Manrope,system-ui,sans-serif;color:${T.fg};background:${T.bg};position:relative}
.sb{flex:0 0 270px;background:${T.side};border-right:1px solid ${T.line};display:flex;flex-direction:column}
.sb-h{display:flex;gap:10px;align-items:center;padding:16px 14px}
.sb-logo{width:34px;height:34px;border-radius:8px;background:${T.gold};color:#18181B;display:flex;align-items:center;justify-content:center}
.sb-h b{display:block;font-size:15px}.sb-h span{font-size:11.5px;color:${T.muted}}
.sb-s{margin:0 14px 10px;height:36px;border:1px solid ${T.border};border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 8px;color:${T.muted};font-size:13px}
.kbd{border:1px solid ${T.border};border-radius:4px;padding:0 5px;font-size:11px;font-family:monospace}
.sb-g{padding:10px 14px 2px;font-size:11px;font-weight:600;letter-spacing:.06em;color:#7C7C85}
.sb-i{display:flex;align-items:center;gap:10px;height:36px;margin:0 14px;padding:0 10px;border-radius:6px;font-size:14px;color:#C9C9CF}
.sb-i svg{color:#8B8B93}
.sb-i.on{background:#1E1B16;color:#F4F4F5;position:relative}.sb-i.on svg{color:${T.gold}}
.sb-i.on::before{content:"";position:absolute;left:-14px;top:7px;bottom:7px;width:3px;border-radius:0 3px 3px 0;background:${T.gold}}
.sb-f{margin-top:auto;border-top:1px solid ${T.line};padding:10px 14px;display:flex;gap:10px;align-items:center}
.av{width:34px;height:34px;border-radius:8px;background:${T.goldSoft};color:${T.goldText};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex:none}
.col{flex:1;min-width:0;display:flex;flex-direction:column}
.hdr{height:64px;border-bottom:1px solid ${T.line};display:flex;align-items:center;justify-content:space-between;padding:0 30px}
.crumb{font-size:14px;color:${T.muted}}.crumb b{color:${T.fg}}
.op{display:flex;align-items:center;gap:16px;font-size:13px}
.dot{width:8px;height:8px;border-radius:50%;background:${T.ok};display:inline-block}
.tg{width:56px;height:30px;border-radius:99px;background:#1b1d2b;position:relative;border:1px solid ${T.border}}.tg::after{content:"";position:absolute;right:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#e8e9f3}
.main{padding:28px 32px 40px;display:flex;flex-direction:column;gap:18px;max-width:1500px;width:100%;box-sizing:border-box;margin:0 auto}
h1{margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em}
.sub{color:${T.muted};font-size:14.5px;margin-top:4px}
.row{display:flex;align-items:center;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:9px;border:1px solid ${T.border};background:${T.surface};color:${T.fg};font:inherit;font-size:13.5px;font-weight:700;white-space:nowrap}
.btn.pri{background:${T.gold};border-color:${T.gold};color:#18181B}
.btn.sm{height:32px;padding:0 11px;font-size:12.5px}
.card{background:${T.surface};border:1px solid ${T.border};border-radius:14px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{padding:14px 16px;display:flex;flex-direction:column;gap:4px;position:relative;overflow:hidden}
.kpi span{font-size:12px;color:${T.muted}}.kpi b{font-size:26px;font-weight:800;letter-spacing:-.02em}
.kpi small{font-size:11.5px;color:${T.muted}}
.kpi svg.sp{position:absolute;right:12px;bottom:12px}
.attn{display:flex;align-items:stretch;gap:10px;padding:12px;overflow:hidden}
.attn .t{display:flex;align-items:center;gap:8px;padding:0 6px;font-weight:800;font-size:13px;white-space:nowrap}
.alert{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:12.5px;border:1px solid ${T.border};background:${T.raised}}
.alert b{display:block;font-size:13px}.alert span{color:${T.muted}}
.alert .ic{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.tools{display:flex;align-items:center;gap:10px;padding:12px;flex-wrap:wrap}
.tabs{display:flex;gap:4px}
.tab{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:8px;font-size:13.5px;color:#C9C5BC}
.tab i{font-style:normal;font-size:11px;font-weight:800;min-width:18px;height:18px;border-radius:99px;background:#26221B;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.tab.on{background:${T.gold};color:#18181B;font-weight:700}.tab.on i{background:rgba(0,0,0,.18)}
.chip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:8px;border:1px dashed ${T.border};font-size:12.5px;color:${T.muted}}
.chip.set{border-style:solid;color:${T.goldText};background:${T.goldSoft};border-color:#4A3A1C}
.srch{margin-left:auto;display:flex;align-items:center;gap:8px;height:38px;width:300px;border:1px solid ${T.border};border-radius:9px;padding:0 12px;color:${T.muted};font-size:13.5px}
.seg{display:flex;border:1px solid ${T.border};border-radius:9px;overflow:hidden}.seg span{width:38px;height:36px;display:flex;align-items:center;justify-content:center;color:${T.muted}}.seg span.on{background:#26221B;color:${T.fg}}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${T.muted};padding:12px 10px;border-bottom:1px solid ${T.border};white-space:nowrap}
th.sorted{color:${T.goldText}}
td{padding:12px 10px;border-bottom:1px solid ${T.line};vertical-align:middle}
tr.sel td{background:#1A1610}
tr:hover td{background:#171510}
.cb{width:16px;height:16px;border-radius:4px;border:1.5px solid #4A453C;display:inline-flex;align-items:center;justify-content:center}
.cb.on{background:${T.gold};border-color:${T.gold};color:#18181B}
.co{display:flex;align-items:center;gap:12px}
.lg{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex:none;position:relative}
.co b{display:block;font-size:14.5px}.co small{display:block;font-size:12px;color:${T.muted}}
.tg2{display:inline-flex;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:99px;background:#26221B;color:#C9C5BC;margin-right:4px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}
.p-ok{background:${T.okSoft};color:${T.ok}}.p-neu{background:#24211B;color:#C9C5BC}.p-bad{background:${T.badSoft};color:${T.bad}}.p-gold{background:${T.goldSoft};color:${T.goldText}}.p-warn{background:${T.warnSoft};color:${T.warn}}.p-info{background:${T.infoSoft};color:${T.info}}
.meter{height:6px;border-radius:99px;background:#26221B;overflow:hidden;margin-top:5px;width:96px}.meter i{display:block;height:100%;border-radius:99px}
.mut{color:${T.muted}}.xs{font-size:12px}
.health{display:flex;align-items:center;gap:8px}
.foot{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;font-size:13px;color:${T.muted}}
.bulk{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:14px;background:#221E17;border:1px solid #4A3A1C;box-shadow:0 20px 40px -12px #000;font-size:13.5px;z-index:5}
.bulk b{color:${T.goldText};margin-right:8px}
/* cards */
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cc{padding:18px;display:flex;flex-direction:column;gap:14px;transition:transform .2s}
.cc:hover{transform:translateY(-3px)}
.cc .top{display:flex;align-items:flex-start;gap:12px}
.stats3{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.stats3 div{background:${T.raised};border:1px solid ${T.line};border-radius:10px;padding:10px}
.stats3 span{display:block;font-size:11px;color:${T.muted}}.stats3 b{font-size:18px}
.pipe{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px}
.stage{background:${T.raised};border:1px solid ${T.line};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:110px}
.stage .h{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:${T.muted};text-transform:uppercase;letter-spacing:.05em}
.mini{display:flex;align-items:center;gap:8px;padding:8px;border-radius:9px;background:${T.surface};border:1px solid ${T.border};font-size:12.5px}
.mini .lg{width:26px;height:26px;font-size:10px;border-radius:7px}
/* drawer */
.dim{position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:4}
.drawer{position:absolute;top:0;right:0;bottom:0;width:620px;background:${T.surface};border-left:1px solid ${T.border};z-index:5;display:flex;flex-direction:column;box-shadow:-30px 0 60px -20px #000}
.dh{padding:20px 22px 0;display:flex;flex-direction:column;gap:14px}
.dtabs{display:flex;gap:18px;border-bottom:1px solid ${T.border};padding:0 22px;font-size:13.5px;color:${T.muted}}
.dtabs span{padding:10px 0}.dtabs span.on{color:${T.fg};font-weight:700;box-shadow:inset 0 -2px 0 ${T.gold}}
.db{padding:18px 22px;display:flex;flex-direction:column;gap:16px;overflow:hidden}
.sec{border:1px solid ${T.border};border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}
.sec h3{margin:0;font-size:13.5px;display:flex;align-items:center;gap:8px}
.ck{display:flex;align-items:center;gap:8px;font-size:13px}
.ck i{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-style:normal}
.df{margin-top:auto;padding:14px 22px;border-top:1px solid ${T.border};display:flex;gap:8px}
.ad{display:grid;grid-template-columns:120px 1fr 40px;gap:10px;align-items:center;font-size:12.5px}
.ad .meter{width:auto;margin:0}
@keyframes fillw{from{transform:scaleX(0)}}
.meter i{transform-origin:left;animation:fillw 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes draw{from{stroke-dashoffset:300}}
.spk polyline{stroke-dasharray:300;animation:draw 1.4s ease both}
</style>\n</helmet>`;

const sidebar = () => `<aside class="sb">
<div class="sb-h"><span class="sb-logo">${icon('shield', 18)}</span><span><b>HRMS Platform</b><span>Super Admin console</span></span></div>
<div class="sb-s">${icon('search', 14)}<span style="flex:1">Search…</span><span class="kbd">Ctrl</span><span class="kbd">K</span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Dashboard</div>
<div class="sb-g">TENANTS</div><div class="sb-i on">${icon('building')}Companies</div><div class="sb-i">${icon('plus')}Onboard company</div>
<div class="sb-g">GOVERNANCE</div><div class="sb-i">${icon('file')}Audit logs</div>
<div class="sb-g">PLATFORM</div><div class="sb-i">${icon('layers')}Plans</div><div class="sb-i">${icon('palette')}Themes</div><div class="sb-i">${icon('server')}System</div>
<div class="sb-f"><span class="av">SA</span><span style="flex:1"><b style="display:block;font-size:14px">Super Admin</b><span class="xs mut">Super Admin</span></span>${icon('updown', 14)}</div>
</aside>`;
const header = (crumb) => `<header class="hdr"><div class="crumb">Platform &nbsp;›&nbsp; <b>${crumb}</b></div><div class="op"><span><span class="dot"></span>&nbsp; Operational</span><span class="tg"></span></div></header>`;

const spark = (vals, color, w = 90, h = 28) => {
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  return `<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${vals.map((v, i) => `${((i * w) / (vals.length - 1)).toFixed(1)},${(h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6)).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
const ring = (pct, color, size = 34, label = '') => {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-block;flex:none"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#26221B" stroke-width="4"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10.5px">${label || pct}</b></span>`;
};

// Real companies (from the dev database), with computed health / setup
const COS = [
  { name: 'Perf Bench', slug: 'perf-bench', email: 'x@perf-bench.test', st: 'Active', plan: 'Enterprise', emp: 493, lim: null, users: 493, act7: 100, health: 92, setup: 80, last: '2 min ago', created: '21 hours ago', color: '#5B5BF0', ini: 'PB', tags: ['Load test'], prefix: 'EMP', trend: [380, 420, 450, 470, 480, 490, 493] },
  { name: 'aakash-portal', slug: 'aakash-portal', email: 'bhanu@yopmail.com', st: 'Active', plan: 'Enterprise', emp: 24, lim: null, users: 26, act7: 58, health: 84, setup: 100, last: 'just now', created: '3 days ago', color: 'logo', ini: 'AP', tags: ['Demo', 'Pilot'], prefix: 'AAK', trend: [4, 9, 12, 13, 15, 16, 15] },
  { name: 'Beta Test Co', slug: 'beta-test', email: 'hello@beta-test.local', st: 'Inactive', plan: 'Enterprise', emp: 0, lim: null, users: 1, act7: 100, health: 31, setup: 10, last: '3 days ago', created: '3 days ago', color: '#2F5BEA', ini: 'BT', tags: [], prefix: 'BTA', trend: [1, 1, 0, 0, 0, 0, 0] },
  { name: 'Acme Test Company', slug: 'acme-test', email: 'hello@acme-test.local', st: 'Suspended', plan: 'Enterprise', emp: 0, lim: null, users: 2, act7: 50, health: 12, setup: 10, last: '3 days ago', created: '3 days ago', color: '#C2410C', ini: 'AT', tags: ['Billing hold'], prefix: 'ACME', trend: [2, 1, 1, 0, 0, 0, 0] },
];
const stPill = (st) => `<span class="pill ${st === 'Active' ? 'p-ok' : st === 'Suspended' ? 'p-bad' : 'p-neu'}"><span class="dot" style="background:currentColor;width:6px;height:6px"></span>${st}</span>`;
const hTone = (h) => (h >= 75 ? T.ok : h >= 45 ? T.warn : T.bad);
const hLabel = (h) => (h >= 75 ? 'Healthy' : h >= 45 ? 'Watch' : 'At risk');
const logo = (c, size = 40) => c.color === 'logo'
  ? `<span class="lg" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#E9416A,#7A2BD9)">${c.ini}</span>`
  : `<span class="lg" style="width:${size}px;height:${size}px;background:${c.color}">${c.ini}</span>`;
const accent = (c) => (c.color === 'logo' ? T.gold : c.color);

const kpis = `<div class="kpis">
  <div class="card kpi"><span>Companies</span><b>4</b><small><span style="color:${T.ok}">▲ 4</span> this month</small>${spark([0, 0, 1, 1, 3, 3, 4], T.gold)}</div>
  <div class="card kpi"><span>Active · Inactive · Suspended</span><b>2 <small style="font-size:14px">· 1 · 1</small></b><div class="meter" style="width:100%;display:flex"><i style="width:50%;background:${T.ok};border-radius:0"></i><i style="width:25%;background:#6B6760;border-radius:0"></i><i style="width:25%;background:${T.bad};border-radius:0"></i></div></div>
  <div class="card kpi"><span>Employees across tenants</span><b>517</b><small>543 portal users</small>${spark([300, 360, 410, 460, 495, 510, 517], T.teal)}</div>
  <div class="card kpi"><span>Active this week</span><b>98%</b><small>532 of 543 users signed in</small>${spark([60, 72, 80, 88, 93, 96, 98], T.ok)}</div>
  <div class="card kpi" style="border-color:#4A3A1C"><span>Needs attention</span><b style="color:${T.warn}">3</b><small>see below</small></div>
</div>`;
const attention = `<div class="card attn"><div class="t">${icon('alert', 16)}Needs attention</div>
  <div class="alert"><span class="ic" style="background:${T.badSoft};color:${T.bad}">${icon('pause', 15)}</span><div><b>Acme Test Company is suspended</b><span>3 days · reason: billing hold</span></div><span class="btn sm" style="margin-left:auto">Review</span></div>
  <div class="alert"><span class="ic" style="background:${T.warnSoft};color:${T.warn}">${icon('clock', 15)}</span><div><b>Beta Test Co hasn’t set up</b><span>0 employees · no sign-in for 3 days</span></div><span class="btn sm" style="margin-left:auto">Nudge admin</span></div>
  <div class="alert"><span class="ic" style="background:${T.infoSoft};color:${T.info}">${icon('caldays', 15)}</span><div><b>Perf Bench has no holidays</b><span>setup 80% · leave counts may be off</span></div><span class="btn sm" style="margin-left:auto">Open</span></div>
</div>`;
const tools = (view) => `<div class="card tools">
  <div class="tabs"><span class="tab on">All <i>4</i></span><span class="tab">Active <i>2</i></span><span class="tab">Inactive <i>1</i></span><span class="tab">Suspended <i>1</i></span></div>
  <span class="chip">${icon('layers', 13)}Plan: Any</span><span class="chip set">${icon('activity', 13)}Health: Any ▾</span><span class="chip">${icon('caldays', 13)}Created: Any</span><span class="chip">${icon('tag', 13)}Tags</span>
  <span class="srch">${icon('search', 15)}Search name, slug, email or admin…</span>
  <span class="btn sm">${icon('columns', 14)}Columns</span>
  <span class="seg"><span class="${view === 'list' ? 'on' : ''}">${icon('list', 15)}</span><span class="${view === 'grid' ? 'on' : ''}">${icon('grid', 15)}</span></span>
</div>`;

function table(selected = []) {
  const rows = COS.map((c, i) => {
    const sel = selected.includes(i);
    return `<tr class="${sel ? 'sel' : ''}">
<td style="width:20px"><span class="cb ${sel ? 'on' : ''}">${sel ? icon('check2', 11) : ''}</span></td>
<td><div class="co"><span style="width:3px;height:40px;border-radius:2px;background:${accent(c)}"></span>${logo(c)}<div><b>${c.name}</b><small>${c.slug}</small><div style="margin-top:3px">${c.tags.map((t) => `<span class="tg2">${t}</span>`).join('')}</div></div></div></td>
<td><span class="pill p-gold">${c.plan}</span></td>
<td><div class="xs"><b style="font-size:13.5px">${c.emp}</b> <span class="mut">${c.lim ? `of ${c.lim}` : '· no limit'}</span></div><div class="meter"><i style="width:${c.lim ? (c.emp / c.lim) * 100 : Math.min(100, c.emp / 5)}%;background:${T.gold};${c.lim ? '' : 'opacity:.45'}"></i></div></td>
<td><div class="row" style="gap:8px">${spark(c.trend, c.st === 'Active' ? T.teal : '#6B6760', 52, 22)}<div class="xs"><b style="font-size:13.5px">${c.users}</b><div class="mut">${c.act7}% active</div></div></div></td>
<td><div class="health">${ring(c.health, hTone(c.health))}<span class="xs" style="color:${hTone(c.health)};font-weight:700">${hLabel(c.health)}</span></div></td>
<td><div class="xs"><b>${c.setup}%</b></div><div class="meter" style="width:80px"><i style="width:${c.setup}%;background:${c.setup === 100 ? T.ok : T.warn}"></i></div></td>
<td class="xs mut">${c.last}</td>
<td>${stPill(c.st)}</td>
<td class="mut">${icon('dots', 18)}</td></tr>`;
  }).join('');
  return `<div class="card" style="overflow:hidden"><table><thead><tr><th><span class="cb"></span></th><th>Company ⇅</th><th>Plan</th><th>Employees · limit</th><th>Users · 7 days</th><th>Health ⇅</th><th>Setup</th><th class="sorted">Last activity ↓</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>
<div class="foot"><span><b style="color:${T.fg}">1–4</b> of 4 · saved view: <span style="color:${T.goldText}">All companies</span></span><span class="row">Rows 25 ▾ &nbsp; Page 1 of 1 <span class="btn sm">‹</span><span class="btn sm">›</span></span></div></div>`;
}

function listBoard() {
  const html = `<div class="app">${sidebar()}<div class="col">${header('Companies')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><h1>Companies</h1><div class="sub">Every tenant on the platform — health, usage and what needs attention.</div></div><span class="btn">${icon('download', 15)}Export</span><span class="btn pri">${icon('plus', 15)}Onboard company</span></div>
${kpis}${attention}${tools('list')}${table([2, 3])}
</main></div>
<div class="bulk"><b>2 selected</b><span class="btn sm">${icon('mail', 13)}Message admins</span><span class="btn sm">${icon('layers', 13)}Change plan</span><span class="btn sm">${icon('tag', 13)}Add tag</span><span class="btn sm">${icon('download', 13)}Export</span><span class="btn sm" style="color:${T.bad}">${icon('pause', 13)}Suspend</span><span class="btn sm" style="border:0;background:none">${icon('x', 14)}</span></div>
</div>`;
  return dcPage('Companies list', css, html, 1000);
}

function cardsBoard() {
  const stages = [
    ['Created', [COS[3]], 'No admin sign-in yet'],
    ['Admin invited', [COS[2]], 'Waiting for first setup'],
    ['Setting up', [COS[0]], 'Holidays missing'],
    ['Live', [COS[1]], 'All set up'],
  ];
  const pipe = `<div class="card"><div class="row" style="padding:14px 16px 0"><b style="font-size:15px;flex:1">Onboarding pipeline</b><span class="xs mut">Where each company is in setup · drag isn’t needed — it moves on its own</span></div>
  <div class="pipe">${stages.map(([s, list, hint], i) => `<div class="stage" style="${i === 3 ? `border-color:#1F4A33` : ''}"><div class="h"><span>${s}</span><span>${list.length}</span></div>${list.map((c) => `<div class="mini">${logo(c, 26)}<span style="flex:1"><b style="display:block">${c.name}</b><span class="mut" style="font-size:11px">${hint}</span></span></div>`).join('')}</div>`).join('')}</div></div>`;
  const cards = COS.map((c) => `<div class="card cc" style="border-top:3px solid ${accent(c)}">
  <div class="top">${logo(c, 46)}<div style="flex:1;min-width:0"><b style="font-size:16px;display:block">${c.name}</b><span class="xs mut">${c.slug} · ${c.email}</span><div style="margin-top:6px" class="row">${stPill(c.st)}<span class="pill p-gold">${c.plan}</span>${c.tags.map((t) => `<span class="tg2">${t}</span>`).join('')}</div></div><span class="mut">${icon('dots', 18)}</span></div>
  <div class="stats3"><div><span>Employees</span><b>${c.emp}</b></div><div><span>Users</span><b>${c.users}</b></div><div><span>Active 7d</span><b>${c.act7}%</b></div><div><span>ID prefix</span><b style="font-family:monospace;font-size:15px">${c.prefix}</b></div></div>
  <div class="row" style="gap:14px"><div class="health">${ring(c.health, hTone(c.health), 44)}<div><b style="display:block;color:${hTone(c.health)}">${hLabel(c.health)}</b><span class="xs mut">health score</span></div></div>
  <div style="flex:1"><div class="row xs" style="justify-content:space-between"><span class="mut">Setup</span><b>${c.setup}%</b></div><div class="meter" style="width:100%"><i style="width:${c.setup}%;background:${c.setup === 100 ? T.ok : T.warn}"></i></div><div class="row xs mut" style="justify-content:space-between;margin-top:6px"><span>Sign-ins this week</span>${spark(c.trend, c.st === 'Active' ? T.teal : '#6B6760', 90, 22)}</div></div></div>
  <div class="row" style="border-top:1px solid ${T.line};padding-top:12px"><span class="xs mut" style="flex:1">Last activity ${c.last} · created ${c.created}</span><span class="btn sm">${icon('eye', 13)}View as admin</span><span class="btn sm pri">Open</span></div>
</div>`).join('');
  const html = `<div class="app">${sidebar()}<div class="col">${header('Companies')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><h1>Companies</h1><div class="sub">Card view — the same filters, with each company’s health at a glance.</div></div><span class="btn">${icon('download', 15)}Export</span><span class="btn pri">${icon('plus', 15)}Onboard company</span></div>
${pipe}${tools('grid')}<div class="cards">${cards}</div>
</main></div></div>`;
  return dcPage('Companies cards', css, html, 1380);
}

function drawerBoard() {
  const c = COS[0];
  const adopt = [['Attendance', 96], ['Leave', 88], ['Timesheets', 74], ['Expenses', 41], ['Assets', 33], ['Helpdesk', 22], ['Kudos', 18]];
  const html = `<div class="app">${sidebar()}<div class="col">${header('Companies')}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><h1>Companies</h1><div class="sub">Every tenant on the platform — health, usage and what needs attention.</div></div><span class="btn">${icon('download', 15)}Export</span><span class="btn pri">${icon('plus', 15)}Onboard company</span></div>
${kpis}${tools('list')}${table()}
</main></div>
<div class="dim"></div>
<aside class="drawer">
  <div class="dh">
    <div class="row" style="align-items:flex-start">${logo(c, 52)}<div style="flex:1"><b style="font-size:20px;display:block">${c.name}</b><span class="xs mut">${c.slug} · ${c.email} · created ${c.created}</span><div class="row" style="margin-top:8px">${stPill(c.st)}<span class="pill p-gold">${c.plan}</span><span class="tg2">Load test</span><span class="tg2">+ tag</span></div></div><span class="btn sm" style="border:0;background:none">${icon('x', 16)}</span></div>
    <div class="stats3"><div><span>Employees</span><b>493</b><span>no limit</span></div><div><span>Signed in this week</span><b>100%</b></div><div><span>Storage</span><b>1.2 GB</b></div><div><span>Health</span><b style="color:${T.ok}">92</b></div></div>
  </div>
  <div class="dtabs" style="margin-top:14px"><span class="on">Overview</span><span>Usage</span><span>Admins</span><span>Plan &amp; limits</span><span>Activity</span><span>Notes</span></div>
  <div class="db">
    <div class="sec"><h3>${icon('activity', 15)}Daily active users · 30 days<span class="xs mut" style="margin-left:auto">avg 471</span></h3>${spark([300, 340, 380, 400, 430, 420, 450, 460, 470, 455, 480, 470, 490, 485, 493], T.teal, 570, 70)}</div>
    <div class="row" style="gap:16px;align-items:stretch">
      <div class="sec" style="flex:1"><h3>${icon('layers', 15)}Modules in use</h3>${adopt.map(([n, v]) => `<div class="ad"><span>${n}</span><div class="meter"><i style="width:${v}%;background:${T.gold}"></i></div><b style="text-align:right">${v}%</b></div>`).join('')}</div>
      <div class="sec" style="flex:1"><h3>${icon('check', 15)}Setup checklist · 80%</h3>
        ${[['Departments added', 1], ['Employees imported', 1], ['Attendance policy set', 1], ['Leave types set', 1], ['Holidays added', 0], ['Logo uploaded', 0]].map(([n, ok]) => `<div class="ck"><i style="background:${ok ? T.okSoft : T.warnSoft};color:${ok ? T.ok : T.warn}">${ok ? icon('check2', 11) : '!'}</i>${n}</div>`).join('')}
        <span class="btn sm" style="align-self:flex-start">${icon('mail', 13)}Remind the admin</span></div>
    </div>
    <div class="sec"><h3>${icon('file', 15)}Recent activity</h3>
      ${[['Company onboarded', 'you · 21 hours ago'], ['493 employees imported', 'hr@perf-bench.test · 21 hours ago'], ['Theme “Indigo Classic” published', 'hr@perf-bench.test · 20 hours ago']].map(([a, b]) => `<div class="row xs"><span class="dot" style="background:${T.gold}"></span><b style="font-size:13px">${a}</b><span class="mut" style="margin-left:auto">${b}</span></div>`).join('')}</div>
  </div>
  <div class="df"><span class="btn sm">${icon('eye', 13)}View as admin</span><span class="btn sm">${icon('key', 13)}Reset admin password</span><span class="btn sm">${icon('layers', 13)}Change plan</span><span class="btn sm" style="margin-left:auto;color:${T.bad}">${icon('pause', 13)}Suspend</span></div>
</aside></div>`;
  return dcPage('Company panel', css, html, 1000);
}

const boards = [
  ['SACompanies.dc.html', 'Super Admin · Companies — list with health, usage, attention and bulk actions', listBoard, 1000],
  ['SACompaniesCards.dc.html', 'Super Admin · Companies — card view + onboarding pipeline', cardsBoard, 1380],
  ['SACompanyPanel.dc.html', 'Super Admin · Companies — click a company: side panel', drawerBoard, 1000],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(__dirname, '..', 'canvas', 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 6100 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n4 = { kind: 'title1', maxW: 4480, text: 'Super Admin · Companies — richer list, cards, company panel', w: 240, x: 0, y: 5800 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
