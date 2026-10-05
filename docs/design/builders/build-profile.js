// Super Admin → Profile & security: account, security (2-step, password, devices), activity & appearance.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, helmetFonts, P } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  hist: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  plus2: '<path d="M12 5v14M5 12h14"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
});

const T = { bg: '#F7F5F0', side: '#FBFAF7', border: '#E8E3D9', line: '#EFEBE3', raised: '#FAF8F4', fg: '#1C1917', muted: '#78716C', gold: '#B7791F', goldSoft: '#FBF1DF', goldText: '#8A5A12', ok: '#15803D', okSoft: '#E7F6EC', okBar: '#34C77B', warn: '#B45309', warnSoft: '#FEF3E2', warnBar: '#F2B65A', bad: '#C2410C', badSoft: '#FDECE5', info: '#1D4ED8', infoSoft: '#E8EFFD', violet: '#6D28D9', violetSoft: '#F1EAFE' };

const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:${T.bg}}
.app{display:flex;min-height:100vh;font-family:Manrope,system-ui,sans-serif;color:${T.fg};background:${T.bg};position:relative}
.sb{flex:0 0 250px;background:${T.side};border-right:1px solid ${T.line};display:flex;flex-direction:column}
.sb-h{display:flex;gap:10px;align-items:center;padding:16px 14px}
.sb-logo{width:34px;height:34px;border-radius:8px;background:${T.gold};color:#fff;display:flex;align-items:center;justify-content:center}
.sb-h b{display:block;font-size:15px}.sb-h span{font-size:11.5px;color:${T.muted}}
.sb-s{margin:0 14px 10px;height:36px;border:1px solid ${T.border};border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 8px;color:${T.muted};font-size:13px;background:#fff}
.kbd{border:1px solid ${T.border};border-radius:4px;padding:0 5px;font-size:11px;font-family:monospace;background:#fff}
.sb-g{padding:10px 14px 2px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#A8A29E}
.sb-i{display:flex;align-items:center;gap:10px;height:36px;margin:0 14px;padding:0 10px;border-radius:6px;font-size:14px;color:#44403C}
.sb-i svg{color:#A8A29E}
.sb-f{margin-top:auto;border-top:1px solid ${T.line};padding:10px 14px;display:flex;gap:10px;align-items:center;background:${T.goldSoft}}
.av{width:34px;height:34px;border-radius:8px;background:${T.gold};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex:none}
.col{flex:1;min-width:0;display:flex;flex-direction:column}
.hdr{height:60px;border-bottom:1px solid ${T.line};display:flex;align-items:center;justify-content:space-between;padding:0 30px}
.crumb{font-size:14px;color:${T.muted}}.crumb b{color:${T.fg};font-weight:600}
.op{display:flex;align-items:center;gap:16px;font-size:13px;color:${T.muted}}
.dot{width:8px;height:8px;border-radius:50%;background:#22C55E;display:inline-block}
.tg{width:56px;height:30px;border-radius:99px;background:#F1EEE8;position:relative;border:1px solid ${T.border}}.tg::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#F5B342}
.main{padding:26px 34px 40px;display:flex;flex-direction:column;gap:18px;box-sizing:border-box;width:100%}
.row{display:flex;align-items:center;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:9px;border:1px solid ${T.border};background:#fff;color:${T.fg};font-size:13.5px;font-weight:700;white-space:nowrap}
.btn.pri{background:${T.gold};border-color:${T.gold};color:#fff}.btn.sm{height:30px;padding:0 10px;font-size:12.5px}.btn.danger{color:${T.bad};border-color:#F2C9B8}.btn.ghost{border-color:transparent;background:none}
.card{background:#fff;border:1px solid ${T.border};border-radius:14px;box-shadow:0 1px 2px rgba(28,25,23,.04)}
.sec{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.sec h3{margin:0;font-size:15px;display:flex;align-items:center;gap:8px}.sec h3 svg{color:${T.muted}}
.sec h3 .r{margin-left:auto;font-size:12px;font-weight:500;color:${T.muted}}
.mut{color:${T.muted}}.xs{font-size:12px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.p-ok{background:${T.okSoft};color:${T.ok}}.p-warn{background:${T.warnSoft};color:${T.warn}}.p-bad{background:${T.badSoft};color:${T.bad}}.p-neu{background:${T.line};color:${T.muted}}.p-gold{background:${T.goldSoft};color:${T.goldText}}.p-info{background:${T.infoSoft};color:${T.info}}
/* layout: sub-nav + content */
.wrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px;align-items:start}
.snav{position:sticky;top:0;display:flex;flex-direction:column;gap:2px}
.snav a{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;font-size:14px;color:#44403C;text-decoration:none}
.snav a svg{color:${T.muted}}.snav a.on{background:#fff;border:1px solid ${T.border};font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.04)}.snav a.on svg{color:${T.gold}}
.snav a i{margin-left:auto;font-style:normal;font-size:11px;font-weight:800;padding:1px 7px;border-radius:99px;background:${T.warnSoft};color:${T.warn}}
.ttl h1{margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em}.ttl p{margin:4px 0 0;color:${T.muted};font-size:14.5px}
/* hero */
.hero{position:relative;overflow:hidden;border-radius:18px;border:1px solid ${T.border};background:#fff}
.cover{height:118px;background:radial-gradient(120% 140% at 0% 0%,#F7D79A 0%,#E9B45A 35%,#B7791F 70%,#7A4B0B 100%);position:relative}
.cover::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.08) 0 2px,transparent 2px 14px)}
.cover .shine{position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%);animation:sh 5s ease-in-out infinite}
@keyframes sh{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.hb{display:flex;align-items:flex-end;gap:18px;padding:0 24px 20px;margin-top:-44px;position:relative}
.big{width:96px;height:96px;border-radius:24px;background:linear-gradient(135deg,#1C1917,#44403C);color:#F7D79A;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;border:4px solid #fff;box-shadow:0 10px 24px -10px rgba(0,0,0,.4);position:relative;flex:none}
.big .cam{position:absolute;right:-6px;bottom:-6px;width:30px;height:30px;border-radius:10px;background:#fff;border:1px solid ${T.border};display:flex;align-items:center;justify-content:center;color:${T.fg}}
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid ${T.line}}
.facts div{padding:14px 20px;border-right:1px solid ${T.line}}.facts div:last-child{border-right:0}
.facts span{display:block;font-size:11.5px;color:${T.muted}}.facts b{font-size:15px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:18px}.g21{display:grid;grid-template-columns:1.25fr 1fr;gap:18px}
.fld{display:flex;flex-direction:column;gap:5px}.fld label{font-size:12.5px;font-weight:700}
.inp{height:38px;border:1px solid ${T.border};border-radius:9px;padding:0 12px;display:flex;align-items:center;font-size:13.5px;background:#fff;gap:8px}
.inp.ro{background:${T.raised};color:${T.muted}}
.tl{display:flex;gap:12px;font-size:13px;padding:8px 0;border-bottom:1px solid ${T.line}}.tl:last-child{border-bottom:0}
.tl .d{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.ck{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid ${T.line};font-size:13.5px}.ck:last-child{border-bottom:0}
.ck i{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;font-style:normal;font-size:11px;font-weight:800}
.steps{display:flex;gap:8px}.steps span{flex:1;height:5px;border-radius:99px;background:${T.line}}.steps span.on{background:${T.gold}}
.qr{width:150px;height:150px;border-radius:14px;border:1px solid ${T.border};padding:10px;background:#fff;flex:none}
.codes{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-family:ui-monospace,Menlo,monospace;font-size:13px}
.codes span{padding:7px 10px;border-radius:8px;background:${T.raised};border:1px solid ${T.line};text-align:center;letter-spacing:.06em}
.otp{display:flex;gap:8px}.otp span{width:42px;height:50px;border-radius:10px;border:1.5px solid ${T.border};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800}.otp span.f{border-color:${T.gold};box-shadow:0 0 0 3px ${T.goldSoft}}
.dev{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid ${T.line};border-radius:12px}
.dev.cur{border-color:#E9C98D;background:#FFFBF3}
.dev .ic{width:40px;height:40px;border-radius:11px;background:${T.raised};display:flex;align-items:center;justify-content:center;flex:none;color:${T.muted}}
.meter{height:6px;border-radius:99px;background:${T.line};overflow:hidden;display:flex;gap:3px}.meter i{flex:1;border-radius:99px;background:${T.line}}
.sw{width:42px;height:24px;border-radius:99px;background:#D6D3D1;position:relative;flex:none}.sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}.sw.on{background:${T.gold}}.sw.on::after{left:21px}
.setrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid ${T.line}}.setrow:last-child{border-bottom:0}
.setrow b{display:block;font-size:13.5px}.setrow span.xs{display:block}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${T.muted};padding:8px 10px;border-bottom:1px solid ${T.border}}
td{padding:10px;border-bottom:1px solid ${T.line}}
tr.sus td{background:#FFF7F3}
.chips{display:flex;gap:6px}.chips span{padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:600;color:${T.muted}}.chips span.on{background:${T.gold};color:#fff}
.tile{border:1px solid ${T.border};border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:8px;position:relative}
.tile.on{border-color:${T.gold};box-shadow:0 0 0 3px ${T.goldSoft}}
.sk{height:74px;border-radius:8px;background:${T.raised};display:flex;gap:4px;padding:6px;overflow:hidden}
.sk i{display:block;border-radius:4px;background:#E7E1D6}
.team{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid ${T.line}}.team:last-child{border-bottom:0}
.kb{display:grid;grid-template-columns:1fr auto;gap:8px 14px;font-size:13px}
</style>\n</helmet>`;

const sidebar = () => `<aside class="sb">
<div class="sb-h"><span class="sb-logo">${icon('shield', 18)}</span><span><b>HRMS Platform</b><span>Super Admin console</span></span></div>
<div class="sb-s">${icon('search', 14)}<span style="flex:1">Search…</span><span class="kbd">Ctrl</span><span class="kbd">K</span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Dashboard</div>
<div class="sb-g">TENANTS</div><div class="sb-i">${icon('building')}Companies</div><div class="sb-i">${icon('plus')}Onboard company</div>
<div class="sb-g">GOVERNANCE</div><div class="sb-i">${icon('file')}Audit logs</div>
<div class="sb-g">PLATFORM</div><div class="sb-i">${icon('layers')}Plans</div><div class="sb-i">${icon('palette')}Themes</div><div class="sb-i">${icon('server')}System</div>
<div class="sb-f"><span class="av">BP</span><span style="flex:1"><b style="display:block;font-size:14px">Bhanu Prakash</b><span class="xs mut">Super Admin</span></span>${icon('updown', 14)}</div>
</aside>`;
const header = () => `<header class="hdr"><div class="crumb">Platform &nbsp;›&nbsp; <b>Profile &amp; security</b></div><div class="op"><span><span class="dot"></span>&nbsp; Operational</span><span class="tg"></span></div></header>`;
const snav = (on) => `<nav class="snav">${[['account', 'user', 'Account'], ['security', 'lock', 'Security', '2'], ['activity', 'hist', 'Sign-in activity'], ['appearance', 'palette', 'Appearance'], ['shortcuts', 'kbd', 'Shortcuts']].map(([k, ic, l, n]) => `<a class="${k === on ? 'on' : ''}">${icon(ic, 16)}${l}${n ? `<i>${n}</i>` : ''}</a>`).join('')}</nav>`;
const ttl = `<div class="ttl"><h1>Profile &amp; security</h1><p>Your Super Admin account — keep it locked down, it can change every company.</p></div>`;
const ring = (pct, color, size = 88, label = '') => {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-block;flex:none"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${T.line}" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px">${label}</b></span>`;
};
const qr = () => {
  let s = 1;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const n = 25, cells = [];
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let on;
    if (finder(x, y)) {
      const fx = x >= n - 7 ? x - (n - 7) : x, fy = y >= n - 7 ? y - (n - 7) : y;
      on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
    } else on = r() > 0.52;
    if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  }
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="${T.fg}">${cells.join('')}</svg>`;
};

// ─── Board 1: account ───────────────────────────────────────
function account() {
  const acts = [['building', T.info, T.infoSoft, 'Moved Beta Test Co to Growth', 'Companies · 2 hours ago'], ['wrench', T.warn, T.warnSoft, 'Turned maintenance mode off', 'System · yesterday 23:40'], ['layers', T.violet, T.violetSoft, 'Added Kudos to Growth', 'Plans · 2 days ago · applied to 3 companies'], ['plus', T.ok, T.okSoft, 'Onboarded Perf Bench', 'Companies · 3 days ago'], ['palette', T.goldText, T.goldSoft, 'Published theme “Indigo Classic”', 'Themes · 4 days ago']];
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
${ttl}
<div class="wrap">${snav('account')}
<div style="display:flex;flex-direction:column;gap:18px">
  <div class="hero">
    <div class="cover"><span class="shine"></span><span class="btn sm" style="position:absolute;right:14px;top:14px;background:rgba(255,255,255,.85);border:0">${icon('camera', 13)}Change cover</span></div>
    <div class="hb"><span class="big">BP<span class="cam">${icon('camera', 15)}</span></span>
      <div style="flex:1;padding-bottom:6px"><div class="row" style="gap:8px"><b style="font-size:22px">Bhanu Prakash</b><span class="pill p-gold">${icon('shield', 12)}Super Admin</span><span class="pill p-ok">● Active now</span></div><div class="mut" style="font-size:13.5px;margin-top:3px">0123bhanusingh@gmail.com · Asia/Kolkata (IST)</div></div>
      <div style="padding-bottom:6px" class="row">${ring(60, T.warnBar, 64, '<span style="font-size:15px">3/5</span>')}<div><b style="font-size:13.5px">Security score</b><div class="xs mut">2 things to do</div><a class="xs" style="color:${T.gold};font-weight:700">Improve →</a></div></div>
    </div>
    <div class="facts"><div><span>Member since</span><b>21 Sep 2026</b></div><div><span>Last sign-in</span><b>Today, 09:12</b><span>Chrome on Windows · Hyderabad</span></div><div><span>Password changed</span><b>14 days ago</b></div><div><span>Your actions · 30 days</span><b>128</b><span>across 4 companies</span></div></div>
  </div>
  <div class="g21">
    <div class="card sec"><h3>${icon('edit', 15)}Your details<span class="r">used in emails and the audit log</span></h3>
      <div class="g2"><div class="fld"><label>First name</label><div class="inp">Bhanu</div></div><div class="fld"><label>Last name</label><div class="inp">Prakash</div></div></div>
      <div class="fld"><label>Email</label><div class="inp ro">${icon('mail', 14)}0123bhanusingh@gmail.com<span class="pill p-ok" style="margin-left:auto">Verified</span></div><span class="xs mut">To change it we send a link to the new address first.</span></div>
      <div class="g2"><div class="fld"><label>Time zone</label><div class="inp">${icon('globe', 14)}Asia/Kolkata (IST) ▾</div></div><div class="fld"><label>Date format</label><div class="inp">04 Oct 2026 ▾</div></div></div>
      <div class="row" style="justify-content:flex-end"><span class="btn ghost">Discard</span><span class="btn pri">Save</span></div>
    </div>
    <div class="card sec"><h3>${icon('hist', 15)}Your recent actions<span class="r"><a style="color:${T.gold};font-weight:700">Audit log →</a></span></h3>
      ${acts.map(([ic, c, soft, t, d]) => `<div class="tl"><span class="d" style="background:${soft};color:${c}">${icon(ic, 15)}</span><div><b>${t}</b><div class="xs mut">${d}</div></div></div>`).join('')}
    </div>
  </div>
</div></div>
</main></div></div>`;
  return dcPage('Profile account', css, html, 1060);
}

// ─── Board 2: security ──────────────────────────────────────
function security() {
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
${ttl}
<div class="wrap">${snav('security')}
<div style="display:flex;flex-direction:column;gap:18px">
  <div class="card sec" style="flex-direction:row;align-items:center;gap:22px">
    ${ring(60, T.warnBar, 104, '3/5<small style="font-size:10.5px;color:#78716C;font-weight:600">secure</small>')}
    <div style="flex:1"><b style="font-size:17px">Your account is fairly safe — 2 steps to make it strong</b>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:8px">
        ${[[1, 'Strong password'], [0, 'Two-step sign-in'], [1, 'Email verified'], [0, 'Recovery codes saved'], [1, 'Only your devices signed in']].map(([ok, t]) => `<div class="ck"><i style="background:${ok ? T.okSoft : T.warnSoft};color:${ok ? T.ok : T.warn}">${ok ? icon('check2', 11) : '!'}</i>${t}</div>`).join('')}
      </div></div>
  </div>
  <div class="g2">
    <div class="card sec" style="border-color:#E9C98D"><h3>${icon('phone', 15)}Two-step sign-in<span class="pill p-warn" style="margin-left:auto">Off</span></h3>
      <div class="steps"><span class="on"></span><span class="on"></span><span></span></div>
      <div class="xs mut" style="font-weight:700">STEP 2 OF 3 — SCAN WITH YOUR AUTHENTICATOR APP</div>
      <div class="row" style="align-items:flex-start;gap:16px">${qr()}
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px"><span>Open Google Authenticator, Microsoft Authenticator or 1Password and scan the code.</span>
          <span class="xs mut">Can’t scan? Enter this key:</span><span class="inp" style="font-family:monospace;font-size:12.5px;letter-spacing:.08em">JBSW Y3DP EHPK 3PXP ${icon('copy', 13)}</span>
          <span class="xs mut">Then type the 6-digit code it shows:</span>
          <div class="otp"><span>4</span><span>8</span><span>2</span><span class="f"></span><span></span><span></span></div></div></div>
      <div class="row" style="justify-content:flex-end"><span class="btn ghost">Cancel</span><span class="btn pri">Verify &amp; turn on</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="card sec"><h3>${icon('key', 15)}Recovery codes<span class="r">step 3</span></h3>
        <span class="xs mut">If you lose your phone, each code signs you in once. Keep them somewhere safe — we show them only now.</span>
        <div class="codes">${['7KQ4-M2XP', 'B9LD-3TRW', 'Z5HN-8CEV', 'P1YG-6QAF', 'R3MU-0JKS', 'W8TB-5LNE', 'D2VC-9HXQ', 'F6PA-4ZUM'].map((c) => `<span>${c}</span>`).join('')}</div>
        <div class="row"><span class="btn sm">${icon('dl', 13)}Download</span><span class="btn sm">${icon('copy', 13)}Copy</span><span class="xs mut" style="margin-left:auto">8 left</span></div>
      </div>
      <div class="card sec"><h3>${icon('lock', 15)}Password<span class="r">changed 14 days ago</span></h3>
        <div class="fld"><label>New password</label><div class="inp">•••••••••••••${icon('eye', 14)}</div></div>
        <div class="meter">${[1, 1, 1, 1, 0].map((on, i) => `<i style="${on ? `background:${i < 2 ? T.warnBar : T.okBar}` : ''}"></i>`).join('')}</div>
        <div class="row xs" style="flex-wrap:wrap;gap:6px 14px">${[[1, '12+ characters'], [1, 'Upper & lower case'], [1, 'A number'], [0, 'A symbol'], [1, 'Not used before']].map(([ok, t]) => `<span style="color:${ok ? T.ok : T.muted}">${ok ? '✓' : '○'} ${t}</span>`).join('')}</div>
        <label class="row xs"><span class="sw on" style="transform:scale(.75)"></span>Sign out my other devices after changing</label>
        <div class="row" style="justify-content:flex-end"><span class="btn pri">Change password</span></div>
      </div>
    </div>
  </div>
  <div class="g21">
    <div class="card sec"><h3>${icon('monitor', 15)}Signed-in devices<span class="r">3 devices</span><span class="btn sm danger">${icon('logout', 13)}Sign out all others</span></h3>
      ${[['monitor', 'Chrome on Windows', 'Hyderabad, IN · 49.36.x.x', 'Active now', true], ['phone', 'Safari on iPhone', 'Hyderabad, IN · 106.208.x.x', '2 hours ago'], ['monitor', 'Edge on Windows', 'Bengaluru, IN · 122.171.x.x', '3 days ago · new place']].map(([ic, n, w, when, cur]) => `<div class="dev ${cur ? 'cur' : ''}"><span class="ic">${icon(ic, 18)}</span><div style="flex:1"><b style="font-size:13.5px">${n}</b> ${cur ? '<span class="pill p-gold" style="font-size:10px">This device</span>' : ''}<div class="xs mut">${w} · ${when}</div></div>${cur ? '' : '<span class="btn sm">Sign out</span>'}</div>`).join('')}
    </div>
    <div class="card sec"><h3>${icon('shield', 15)}Protection</h3>
      ${[['Email me when a new device signs in', 'With the device, place and a “wasn’t me” link', true], ['Sign me out after inactivity', 'After 30 minutes without using the console', true], ['Ask for my password again', 'Before suspending a company or changing plans', false]].map(([t, d, on]) => `<div class="setrow"><span style="flex:1"><b>${t}</b><span class="xs mut">${d}</span></span><span class="sw ${on ? 'on' : ''}"></span></div>`).join('')}
    </div>
  </div>
</div></div>
</main></div></div>`;
  return dcPage('Profile security', css, html, 1380);
}

// ─── Board 3: activity, team, appearance ────────────────────
function activity() {
  const rows = [['ok', 'Signed in', 'Chrome on Windows', 'Hyderabad, IN', '49.36.x.x', 'Today 09:12'], ['ok', 'Signed in', 'Safari on iPhone', 'Hyderabad, IN', '106.208.x.x', 'Today 07:40'], ['bad', 'Wrong password', 'Firefox on Linux', 'Frankfurt, DE', '185.220.x.x', 'Yesterday 02:13', true], ['bad', 'Wrong password', 'Firefox on Linux', 'Frankfurt, DE', '185.220.x.x', 'Yesterday 02:12', true], ['ok', 'Password changed', 'Chrome on Windows', 'Hyderabad, IN', '49.36.x.x', '20 Sep'], ['ok', 'Signed in', 'Edge on Windows', 'Bengaluru, IN', '122.171.x.x', '1 Oct']];
  const tiles = [['Classic', [[0, 1]], true], ['Rail', [[0, 0.3]]], ['Floating', [[0, 1]]], ['Collapsible', [[0, 1]]]];
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
${ttl}
<div class="wrap">${snav('activity')}
<div style="display:flex;flex-direction:column;gap:18px">
  <div class="card sec"><h3>${icon('hist', 15)}Sign-in activity<span class="r">last 30 days · only your account</span></h3>
    <div class="row"><div class="chips"><span class="on">All</span><span>Successful</span><span>Failed</span></div><span class="pill p-bad" style="margin-left:auto">2 failed tries from a new place</span><span class="btn sm">${icon('dl', 13)}Export</span></div>
    <table><thead><tr><th>Event</th><th>Device</th><th>Place</th><th>IP</th><th style="text-align:right">When</th></tr></thead><tbody>
    ${rows.map(([s, e, d, p, ip, w, sus]) => `<tr class="${sus ? 'sus' : ''}"><td><span class="pill ${s === 'ok' ? 'p-ok' : 'p-bad'}">${e}</span>${sus ? ` <span class="xs" style="color:${T.bad};font-weight:700">new place</span>` : ''}</td><td>${d}</td><td>${p}</td><td class="mut" style="font-family:monospace;font-size:12px">${ip}</td><td style="text-align:right" class="mut">${w}</td></tr>`).join('')}
    </tbody></table>
    <div class="row" style="background:${T.badSoft};border-radius:10px;padding:10px 12px;font-size:13px"><span style="color:${T.bad}">${icon('alert', 16)}</span><span style="flex:1"><b>Wasn’t you?</b> Change your password and sign out every device in one step.</span><span class="btn sm danger">Secure my account</span></div>
  </div>
  <div class="g2">
    <div class="card sec"><h3>${icon('shield', 15)}Platform admins<span class="r">people who can change every company</span></h3>
      ${[['BP', 'Bhanu Prakash', 'You · 2-step off', 'p-warn', 'Active now'], ['RK', 'Ravi Kumar', '2-step on', 'p-ok', '3 hours ago']].map(([i, n, s, cls, w]) => `<div class="team"><span class="av" style="background:${i === 'BP' ? T.gold : '#44403C'}">${i}</span><div style="flex:1"><b style="font-size:13.5px">${n}</b><div class="xs mut">last active ${w}</div></div><span class="pill ${cls}">${s}</span></div>`).join('')}
      <div class="row"><span class="btn sm">${icon('plus2', 13)}Invite a Super Admin</span><span class="xs mut">They get an email to set a password and 2-step sign-in.</span></div>
    </div>
    <div class="card sec"><h3>${icon('palette', 15)}Appearance<span class="r">Menu style · Moments · Display — one place</span></h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${tiles.map(([n, , on], i) => `<div class="tile ${on ? 'on' : ''}"><div class="sk">${i === 1 ? '<i style="width:14px"></i><i style="flex:1;background:#F2EEE6"></i>' : i === 2 ? '<i style="width:30px;border-radius:7px;margin:2px"></i><i style="flex:1;background:#F2EEE6"></i>' : '<i style="width:30px"></i><i style="flex:1;background:#F2EEE6"></i>'}</div><b style="font-size:12px">${n}</b></div>`).join('')}</div>
      <div class="setrow"><span style="flex:1"><b>Moments in the sky</b><span class="xs mut">Festivals, monsoon, Friday wind-down</span></span><span class="sw on"></span></div>
      <div class="setrow"><span style="flex:1"><b>Density · Text size · Motion</b><span class="xs mut">Comfortable · Normal · Full</span></span><span class="btn sm">Change</span></div>
    </div>
  </div>
  <div class="card sec"><h3>${icon('kbd', 15)}Keyboard shortcuts<span class="r">press <span class="kbd">?</span> anywhere</span></h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 30px">${[['Search everything', 'Ctrl K'], ['Go to Companies', 'g c'], ['Go to Plans', 'g p'], ['Go to System', 'g s'], ['Focus page search', '/'], ['Onboard a company', 'g n']].map(([t, k]) => `<div class="row" style="justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid ${T.line}"><span>${t}</span><span>${k.split(' ').map((x) => `<span class="kbd">${x}</span>`).join(' ')}</span></div>`).join('')}</div>
  </div>
</div></div>
</main></div></div>`;
  return dcPage('Profile activity', css, html, 1300);
}

const boards = [
  ['SAProfile.dc.html', 'Super Admin · Profile — account: cover, security score, details, your recent actions', account, 1060],
  ['SAProfileSecurity.dc.html', 'Super Admin · Profile — security: 2-step sign-in, recovery codes, password, devices, protection', security, 1380],
  ['SAProfileActivity.dc.html', 'Super Admin · Profile — sign-in activity, platform admins, appearance, shortcuts', activity, 1300],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 11800 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n7 = { kind: 'title1', maxW: 4480, text: 'Super Admin · Profile & security — account, 2-step sign-in, activity & appearance', w: 240, x: 0, y: 11500 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
