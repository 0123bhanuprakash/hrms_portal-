// Super Admin → System: health & performance, data & delivery, readiness & controls.
// Light theme, same top bar / menu as today; only the page content changes.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, helmetFonts, P } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  hdd: '<path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01M10 16h.01"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41z"/><circle cx="7" cy="7" r="1.5"/>',
  broom: '<path d="m13 11 9-9M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2z"/><path d="m6.8 13.8 3.4 3.4"/>',
  hist: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
});

const T = { bg: '#F7F5F0', side: '#FBFAF7', surface: '#FFFFFF', raised: '#FAF8F4', border: '#E8E3D9', line: '#EFEBE3', fg: '#1C1917', muted: '#78716C', gold: '#B7791F', goldSoft: '#FBF1DF', goldText: '#8A5A12', ok: '#15803D', okSoft: '#E7F6EC', okBar: '#34C77B', warn: '#B45309', warnSoft: '#FEF3E2', warnBar: '#F2B65A', bad: '#C2410C', badSoft: '#FDECE5', badBar: '#EF6B4A', info: '#1D4ED8', infoSoft: '#E8EFFD', violet: '#6D28D9', teal: '#0F766E' };

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
.hdr{height:60px;border-bottom:1px solid ${T.line};display:flex;align-items:center;justify-content:space-between;padding:0 30px}
.crumb{font-size:14px;color:${T.muted}}.crumb b{color:${T.fg};font-weight:600}
.op{display:flex;align-items:center;gap:16px;font-size:13px;color:${T.muted}}
.dot{width:8px;height:8px;border-radius:50%;background:#22C55E;display:inline-block}
.tg{width:56px;height:30px;border-radius:99px;background:#F1EEE8;position:relative;border:1px solid ${T.border}}.tg::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#F5B342}
.main{padding:26px 34px 40px;display:flex;flex-direction:column;gap:18px;box-sizing:border-box;width:100%}
h1{margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em}
.sub{color:${T.muted};font-size:14.5px;margin-top:4px}
.row{display:flex;align-items:center;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:9px;border:1px solid ${T.border};background:#fff;color:${T.fg};font-size:13.5px;font-weight:700;white-space:nowrap}
.btn.pri{background:${T.gold};border-color:${T.gold};color:#fff}.btn.sm{height:30px;padding:0 10px;font-size:12.5px}.btn.danger{color:${T.bad};border-color:#F2C9B8}
.card{background:#fff;border:1px solid ${T.border};border-radius:14px;box-shadow:0 1px 2px rgba(28,25,23,.04)}
.sec{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sec h3{margin:0;font-size:14.5px;display:flex;align-items:center;gap:8px}.sec h3 svg{color:${T.muted}}
.sec h3 .r{margin-left:auto;font-size:12px;font-weight:500;color:${T.muted}}
.tabs{display:flex;gap:22px;border-bottom:1px solid ${T.border};font-size:14px;color:${T.muted}}
.tabs span{padding:10px 0;display:flex;gap:6px;align-items:center}.tabs span.on{color:${T.fg};font-weight:700;box-shadow:inset 0 -2px 0 ${T.gold}}
.tabs i{font-style:normal;font-size:11px;font-weight:800;border-radius:99px;padding:1px 7px;background:${T.warnSoft};color:${T.warn}}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.p-ok{background:${T.okSoft};color:${T.ok}}.p-warn{background:${T.warnSoft};color:${T.warn}}.p-bad{background:${T.badSoft};color:${T.bad}}.p-neu{background:${T.line};color:${T.muted}}.p-info{background:${T.infoSoft};color:${T.info}}
.mut{color:${T.muted}}.xs{font-size:12px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.kpi{padding:14px 16px;display:flex;flex-direction:column;gap:4px;position:relative;overflow:hidden}
.kpi span{font-size:12px;color:${T.muted}}.kpi b{font-size:26px;font-weight:800;letter-spacing:-.02em}.kpi small{font-size:12px;color:${T.muted}}
.kpi svg.sp{position:absolute;right:14px;bottom:14px}
/* hero */
.hero{display:flex;align-items:center;gap:20px;padding:20px 22px;border-radius:16px;background:linear-gradient(120deg,#ECF8F0,#F6FBF7 60%,#fff);border:1px solid #CBEBD6;position:relative;overflow:hidden}
.pulse{width:54px;height:54px;border-radius:16px;background:${T.ok};color:#fff;display:flex;align-items:center;justify-content:center;position:relative;flex:none}
.pulse::after{content:"";position:absolute;inset:-6px;border-radius:20px;border:2px solid ${T.okBar};animation:ping 2.4s ease-out infinite}
@keyframes ping{0%{opacity:.7;transform:scale(.9)}100%{opacity:0;transform:scale(1.25)}}
.bars{display:flex;gap:2px;align-items:flex-end;height:30px}.bars i{flex:1;height:100%;border-radius:2px;background:${T.okBar}}
.bars i.w{background:${T.warnBar}}.bars i.b{background:${T.badBar}}.bars i.n{background:#E7E5E4}
.svc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.sv{padding:16px;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden}
.sv .top{display:flex;align-items:center;gap:10px}
.ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.sv b.nm{font-size:15px}
.lat{display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid ${T.line};padding-top:10px}
.lat b{font-size:20px}.lat small{font-size:11px;color:${T.muted}}
.how{border:1px dashed ${T.border};border-radius:10px;padding:10px;background:${T.raised};font-size:12px}
code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:${T.line};padding:1px 6px;border-radius:5px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${T.muted};padding:8px 10px;border-bottom:1px solid ${T.border}}
td{padding:9px 10px;border-bottom:1px solid ${T.line}}
.meter{height:6px;border-radius:99px;background:${T.line};overflow:hidden}.meter i{display:block;height:100%;border-radius:99px;transform-origin:left;animation:fillw 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes fillw{from{transform:scaleX(0)}}
.chart polyline,.chart path.ln{stroke-dasharray:2000;animation:draw 1.6s ease both}@keyframes draw{from{stroke-dashoffset:2000}}
.g2{display:grid;grid-template-columns:1.4fr 1fr;gap:18px}.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.g2e{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid ${T.line};font-size:13px}.li:last-child{border-bottom:0}
.ck{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid ${T.line};font-size:13px}.ck:last-child{border-bottom:0}
.ck i{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;font-style:normal;font-size:11px;font-weight:800;margin-top:1px}
.tl{display:flex;gap:12px;font-size:13px}.tl .d{width:10px;height:10px;border-radius:50%;margin-top:4px;flex:none;box-shadow:0 0 0 3px #fff,0 0 0 4px ${T.border}}
.sw{width:42px;height:24px;border-radius:99px;background:#D6D3D1;position:relative;flex:none}.sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}.sw.on{background:${T.gold}}.sw.on::after{left:21px}
.banner{border-radius:10px;padding:10px 14px;background:#FFF4E0;border:1px solid #F3D9A8;color:#7A4B0B;font-size:12.5px;display:flex;gap:8px;align-items:center}
.tool{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid ${T.line};border-radius:12px;background:${T.raised}}
.tool b{display:block;font-size:13.5px}.tool span.xs{display:block}
</style>\n</helmet>`;

const sidebar = () => `<aside class="sb">
<div class="sb-h"><span class="sb-logo">${icon('shield', 18)}</span><span><b>HRMS Platform</b><span>Super Admin console</span></span></div>
<div class="sb-s">${icon('search', 14)}<span style="flex:1">Search…</span><span class="kbd">Ctrl</span><span class="kbd">K</span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Dashboard</div>
<div class="sb-g">TENANTS</div><div class="sb-i">${icon('building')}Companies</div><div class="sb-i">${icon('plus')}Onboard company</div>
<div class="sb-g">GOVERNANCE</div><div class="sb-i">${icon('file')}Audit logs</div>
<div class="sb-g">PLATFORM</div><div class="sb-i">${icon('layers')}Plans</div><div class="sb-i">${icon('palette')}Themes</div><div class="sb-i on">${icon('server')}System</div>
<div class="sb-f"><span class="av">SA</span><span style="flex:1"><b style="display:block;font-size:14px">Super Admin</b><span class="xs mut">Super Admin</span></span>${icon('updown', 14)}</div>
</aside>`;
const header = () => `<header class="hdr"><div class="crumb">Platform &nbsp;›&nbsp; <b>System</b></div><div class="op"><span><span class="dot"></span>&nbsp; Operational</span><span class="tg"></span></div></header>`;
const top = (tab) => `<div class="row" style="align-items:flex-end"><div style="flex:1"><h1>System</h1><div class="sub">Health, speed and setup of this deployment — and the tools to look after it.</div></div><span class="xs mut">Updated 4 s ago · every 15 s</span><span class="btn">${icon('refresh', 15)}Check now</span></div>
<div class="tabs">${[['health', 'Health & speed'], ['data', 'Data & delivery'], ['ready', 'Readiness & tools', '3']].map(([k, l, n]) => `<span class="${k === tab ? 'on' : ''}">${l}${n ? `<i>${n}</i>` : ''}</span>`).join('')}</div>`;

const rnd = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const spark = (vals, color, w = 90, h = 28, fill = false) => {
  const mx = Math.max(...vals), mn = Math.min(...vals);
  const pts = vals.map((v, i) => [(i * w) / (vals.length - 1), h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="flex:none">${fill ? `<path d="M0,${h} L${line.replace(/ /g, ' L')} L${w},${h} Z" fill="${color}" opacity=".12"/>` : ''}<polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
const ring = (pct, color, size = 92, label = '') => {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-block;flex:none"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${T.line}" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px">${label}</b></span>`;
};
const days90 = (seed, bad = [], warn = [], none = 0) => {
  const out = [];
  for (let i = 0; i < 90; i++) out.push(i < none ? 'n' : bad.includes(i) ? 'b' : warn.includes(i) ? 'w' : '');
  return `<div class="bars">${out.map((c) => `<i class="${c}"></i>`).join('')}</div>`;
};

// ─── Board 1: health & speed ────────────────────────────────
function health() {
  const r = rnd(7);
  const reqs = Array.from({ length: 60 }, (_, i) => 40 + Math.round(30 * Math.sin(i / 7) + r() * 25 + (i > 40 && i < 46 ? 60 : 0)));
  const p95 = Array.from({ length: 60 }, (_, i) => 90 + Math.round(r() * 40 + (i > 40 && i < 46 ? 160 : 0)));
  const W = 700, H = 150;
  const mx = Math.max(...reqs) * 1.1, mp = Math.max(...p95) * 1.1;
  const pts = (arr, m) => arr.map((v, i) => `${((i * W) / 59).toFixed(1)},${(H - (v / m) * (H - 10)).toFixed(1)}`).join(' ');
  const svc = [
    ['Database', 'PostgreSQL · all data', 'db', T.ok, T.okSoft, 'Operational', '4 ms', [5, 4, 6, 4, 5, 4, 7, 5, 4, 4, 5, 4], ''],
    ['Email', 'Gmail SMTP · invites, alerts', 'mail', T.ok, T.okSoft, 'Connected', '612 ms', [580, 640, 600, 610, 590, 700, 620, 612, 605, 630, 615, 612], ''],
    ['Redis', 'Queue & cache', 'zap', T.muted, T.line, 'Not set up', null, null, 'Add <code>REDIS_URL</code> to retry failed emails in the background and share caches between servers.'],
    ['Search', 'Elasticsearch', 'search', T.muted, T.line, 'Not set up', null, null, 'Optional. Add <code>ELASTICSEARCH_URL</code> for fast people search on big companies.'],
  ];
  const slow = [['GET', '/reports/people', 41, 312, 640], ['GET', '/attendance/calendar', 388, 120, 248], ['POST', '/auth/login', 96, 180, 230], ['GET', '/admin/companies', 52, 95, 190], ['GET', '/leave/requests', 214, 48, 110]];
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
${top('health')}
<div class="hero">
  <span class="pulse">${icon('check2', 26)}</span>
  <div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:800">All systems operational</div><div class="xs mut" style="margin-top:2px">No problems in the last 12 days · API up 3 days 4 hours · v0.0.1 · development</div>
    <div style="margin-top:12px">${days90(1, [77], [63, 64, 80], 20)}<div class="row xs mut" style="justify-content:space-between;margin-top:5px"><span>90 days ago</span><span><b style="color:${T.ok}">99.96%</b> uptime</span><span>Today</span></div></div>
  </div>
</div>
<div class="kpis">
  <div class="card kpi"><span>Requests · last hour</span><b>3,214</b><small>54 a minute on average</small>${spark(reqs.slice(-20), T.gold, 90, 30)}</div>
  <div class="card kpi"><span>Typical response (p95)</span><b>118 ms</b><small><span style="color:${T.ok}">▼ 12%</span> vs yesterday</small>${spark(p95.slice(-20), T.teal, 90, 30)}</div>
  <div class="card kpi"><span>Errors · last hour</span><b style="color:${T.ok}">0.2%</b><small>6 server errors · 41 rejected (4xx)</small></div>
  <div class="card kpi"><span>People signed in now</span><b>486</b><small>active in the last 15 minutes · 4 companies</small></div>
</div>
<div class="svc">${svc.map(([n, d, ic, c, soft, st, lat, vals, how]) => `<div class="card sv">
  <div class="top"><span class="ic" style="background:${soft};color:${c}">${icon(ic, 19)}</span><div style="flex:1"><b class="nm">${n}</b><div class="xs mut">${d}</div></div><span class="pill ${lat ? 'p-ok' : 'p-neu'}">${lat ? '<span class="dot" style="width:6px;height:6px;background:currentColor"></span>' : ''}${st}</span></div>
  ${lat ? `<div class="lat"><div><b>${lat}</b><div><small>response · last check</small></div></div>${spark(vals, c, 96, 30, true)}</div>` : `<div class="how">${how}<div class="row" style="margin-top:8px"><span class="btn sm">${icon('copy', 12)}Copy setting</span><span class="xs mut">then restart the API</span></div></div>`}
</div>`).join('')}</div>
<div class="g2">
  <div class="card sec"><h3>${icon('activity', 15)}Traffic &amp; speed<span class="r">last 60 minutes · <span style="color:${T.gold}">■</span> requests / min &nbsp; <span style="color:${T.teal}">■</span> p95 ms</span></h3>
    <svg class="chart" width="100%" viewBox="0 0 ${W} ${H + 20}" preserveAspectRatio="none" style="height:190px">
      ${[0.25, 0.5, 0.75].map((g) => `<line x1="0" x2="${W}" y1="${H * g}" y2="${H * g}" stroke="${T.line}"/>`).join('')}
      <rect x="${(41 * W) / 59}" y="0" width="${(5 * W) / 59}" height="${H}" fill="${T.warnSoft}"/>
      <path d="M0,${H} L${pts(reqs, mx).replace(/ /g, ' L')} L${W},${H} Z" fill="${T.gold}" opacity=".12"/>
      <polyline points="${pts(reqs, mx)}" fill="none" stroke="${T.gold}" stroke-width="2.2"/>
      <polyline points="${pts(p95, mp)}" fill="none" stroke="${T.teal}" stroke-width="2" stroke-dasharray="0" />
      <text x="${(43 * W) / 59}" y="14" font-size="11" fill="${T.warn}" text-anchor="middle" font-family="Manrope">month-end reports</text>
      ${['−60m', '−45m', '−30m', '−15m', 'now'].map((t, i) => `<text x="${(i * W) / 4}" y="${H + 16}" font-size="11" fill="${T.muted}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" font-family="Manrope">${t}</text>`).join('')}
    </svg>
  </div>
  <div class="card sec"><h3>${icon('clock', 15)}Slowest pages<span class="r">p95 · last hour</span></h3>
    <table><thead><tr><th>Endpoint</th><th style="text-align:right">Calls</th><th style="text-align:right">p95</th></tr></thead><tbody>
    ${slow.map(([m, p, n, avg, p9]) => `<tr><td><span class="pill p-neu" style="font-size:10px;padding:1px 6px">${m}</span> <code style="background:none;padding:0">${p}</code><div class="meter" style="margin-top:5px;width:80%"><i style="width:${(p9 / 640) * 100}%;background:${p9 > 500 ? T.warnBar : T.teal}"></i></div></td><td style="text-align:right" class="mut">${n}</td><td style="text-align:right"><b style="color:${p9 > 500 ? T.warn : T.fg}">${p9} ms</b></td></tr>`).join('')}
    </tbody></table>
    <div class="xs mut">Counted on this API server since it started. Over 500 ms is marked.</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('System health', css, html, 1320);
}

// ─── Board 2: data & delivery ───────────────────────────────
function data() {
  const tables = [['attendance_records', 182000, 46], ['audit_logs', 96400, 31], ['notifications', 41200, 9], ['leave_requests', 8300, 3], ['employees', 517, 1]];
  const emails = [['Leave approved', 'priya.aakash@yopmail.com', 'aakash-portal', 'Sent', '2 min ago'], ['Password reset', 'hr@perf-bench.test', 'Perf Bench', 'Sent', '18 min ago'], ['Company admin invite', 'admin@beta-test.local', 'Beta Test Co', 'Failed', '1 h ago', 'Mailbox not found (550)'], ['Timesheet reminder', '42 people', 'aakash-portal', 'Sent', '3 h ago'], ['Expense submitted', 'hema.aakash@yopmail.com', 'aakash-portal', 'Sent', '5 h ago']];
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
${top('data')}
<div class="g3">
  <div class="card sec"><h3>${icon('db', 15)}Database<span class="pill p-ok" style="margin-left:auto">PostgreSQL 16</span></h3>
    <div class="row" style="gap:16px">${ring(62, T.teal, 96, '<span>412</span><small style="font-size:10.5px;color:#78716C;font-weight:600">MB</small>')}
      <div style="flex:1" class="xs"><div class="li"><span class="mut" style="flex:1">Connections</span><b>7 of 20</b></div><div class="li"><span class="mut" style="flex:1">Slow queries (&gt;1 s) today</span><b>0</b></div><div class="li"><span class="mut" style="flex:1">Latest migration</span><b>company_insights</b></div></div></div>
    <div class="xs mut" style="font-weight:700;margin-top:4px">BIGGEST TABLES</div>
    ${tables.map(([n, rows, mb]) => `<div><div class="row xs"><code style="background:none;padding:0;flex:1">${n}</code><span class="mut">${rows.toLocaleString()} rows</span><b style="width:52px;text-align:right">${mb} MB</b></div><div class="meter" style="margin-top:4px"><i style="width:${(mb / 46) * 100}%;background:${T.teal}"></i></div></div>`).join('')}
  </div>
  <div class="card sec"><h3>${icon('hdd', 15)}File storage<span class="pill p-neu" style="margin-left:auto">Local disk</span></h3>
    <div class="row" style="gap:16px">${ring(18, T.gold, 96, '<span>1.8</span><small style="font-size:10.5px;color:#78716C;font-weight:600">GB</small>')}
      <div style="flex:1" class="xs"><div class="li"><span class="mut" style="flex:1">Files</span><b>2,946</b></div><div class="li"><span class="mut" style="flex:1">Disk free</span><b>8.2 GB of 10 GB</b></div><div class="li"><span class="mut" style="flex:1">Added this week</span><b>+64 MB</b></div></div></div>
    <div class="xs mut" style="font-weight:700;margin-top:4px">BY COMPANY</div>
    ${[['Perf Bench', 1.2, '#5B5BF0'], ['aakash-portal', 0.55, '#E9416A'], ['Beta Test Co', 0.03, '#2F5BEA'], ['Acme Test Company', 0.02, '#C2410C']].map(([n, gb, c]) => `<div><div class="row xs"><span style="width:8px;height:8px;border-radius:3px;background:${c}"></span><span style="flex:1">${n}</span><b>${gb} GB</b></div><div class="meter" style="margin-top:4px"><i style="width:${(gb / 1.2) * 100}%;background:${T.gold}"></i></div></div>`).join('')}
    <div class="xs mut">Receipts, documents and logos. Moving to S3 keeps files safe if the server is replaced.</div>
  </div>
  <div class="card sec"><h3>${icon('zap', 15)}Background jobs<span class="pill p-neu" style="margin-left:auto">Inline</span></h3>
    <div class="how" style="font-size:12.5px;line-height:1.55">Without Redis, emails go out <b>during the request</b>. If Gmail is slow, the person clicking waits — and a failed email isn’t tried again.</div>
    <div class="xs mut" style="font-weight:700">WITH REDIS YOU’D SEE</div>
    <div class="row" style="gap:8px">${[['Waiting', '0', T.muted], ['Running', '2', T.info], ['Failed', '1', T.bad], ['Done today', '1,284', T.ok]].map(([l, v, c]) => `<div style="flex:1;border:1px solid ${T.line};border-radius:10px;padding:8px;opacity:.6"><div class="xs mut">${l}</div><b style="font-size:17px;color:${c}">${v}</b></div>`).join('')}</div>
    <div class="row"><span class="btn sm">${icon('copy', 12)}Copy REDIS_URL setting</span><span class="btn sm" style="opacity:.5">${icon('ext', 12)}Open Bull Board</span></div>
  </div>
</div>
<div class="card sec"><h3>${icon('mail', 15)}Email delivery<span class="pill p-ok">Connected · Gmail</span><span class="r">From <code>HRMS &lt;no-reply@…&gt;</code> · checked 1 min ago</span></h3>
  <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${[['Sent today', '214', T.fg], ['Failed today', '1', T.bad], ['Average send time', '0.6 s', T.fg], ['Bounced (7 days)', '3', T.warn]].map(([l, v, c]) => `<div style="border:1px solid ${T.line};border-radius:12px;padding:12px 14px;background:${T.raised}"><div class="xs mut">${l}</div><b style="font-size:22px;color:${c}">${v}</b></div>`).join('')}
  </div>
  <table><thead><tr><th>Email</th><th>To</th><th>Company</th><th>Status</th><th style="text-align:right">When</th><th></th></tr></thead><tbody>
  ${emails.map(([s, to, co, st, when, err]) => `<tr><td><b>${s}</b>${err ? `<div class="xs" style="color:${T.bad}">${err}</div>` : ''}</td><td class="mut">${to}</td><td>${co}</td><td><span class="pill ${st === 'Sent' ? 'p-ok' : 'p-bad'}">${st}</span></td><td style="text-align:right" class="mut">${when}</td><td style="text-align:right">${st === 'Failed' ? `<span class="btn sm">${icon('refresh', 12)}Retry</span>` : ''}</td></tr>`).join('')}
  </tbody></table>
  <div class="row" style="border-top:1px solid ${T.line};padding-top:12px"><span class="xs mut" style="flex:1">Only the subject, recipient and result are kept — never the email body. Cleared after 30 days.</span><span style="display:flex;gap:8px;align-items:center"><span class="btn sm" style="width:220px;justify-content:flex-start;color:${T.muted};font-weight:500">you@example.com</span><span class="btn sm pri">Send test email</span></span></div>
</div>
</main></div></div>`;
  return dcPage('System data', css, html, 1340);
}

// ─── Board 3: readiness & tools ─────────────────────────────
function ready() {
  const checks = [
    [1, 'Strong secrets', 'JWT secrets are long and random; personal data encryption key is set'],
    [1, 'Real email provider', 'Gmail SMTP — people receive invites and resets'],
    [1, 'Database backups', 'Managed by your database host'],
    [0, 'Redis for the email queue', 'Failed emails are not retried. Add REDIS_URL.', 'warn'],
    [0, 'Files on durable storage', 'Uploads are on this server’s disk — lost if it’s replaced. Use S3.', 'warn'],
    [0, 'Running in production mode', 'NODE_ENV is “development”: slower, more logging, detailed errors.', 'bad'],
    [1, 'HTTPS and allowed web addresses', 'CORS limited to WEB_URL'],
  ];
  const done = checks.filter((c) => c[0]).length;
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
${top('ready')}
<div class="g2">
  <div class="card sec"><h3>${icon('check', 15)}Ready for real users?<span class="r">from this server’s settings — values are never shown</span></h3>
    <div class="row" style="gap:20px;align-items:center">${ring((done / checks.length) * 100, T.warnBar, 110, `<span>${done}/${checks.length}</span><small style="font-size:10.5px;color:#78716C;font-weight:600">done</small>`)}
      <div style="flex:1"><div style="font-size:16px;font-weight:800">Almost there — 3 things before going live</div><div class="xs mut" style="margin-top:4px;line-height:1.5">Fine for testing today. Fix the three below before inviting real companies.</div></div></div>
    <div>${checks.map(([ok, t, d, lvl]) => `<div class="ck"><i style="background:${ok ? T.okSoft : lvl === 'bad' ? T.badSoft : T.warnSoft};color:${ok ? T.ok : lvl === 'bad' ? T.bad : T.warn}">${ok ? icon('check2', 11) : '!'}</i><div style="flex:1"><b>${t}</b><div class="xs mut">${d}</div></div>${ok ? '' : `<span class="btn sm">How to fix</span>`}</div>`).join('')}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:18px">
    <div class="card sec"><h3>${icon('wrench', 15)}Maintenance mode</h3>
      <div class="row"><div style="flex:1"><b style="font-size:13.5px">Pause the portal for everyone</b><div class="xs mut">Company users see a notice instead of the app. Super Admins can still sign in.</div></div><span class="sw"></span></div>
      <div class="xs mut" style="font-weight:700">NOTICE PEOPLE WILL SEE</div>
      <div class="banner">${icon('wrench', 14)}<span><b>Scheduled upgrade</b> — HRMS will be unavailable on Sat 10 Oct, 11 PM – 12 AM.</span></div>
      <div class="row"><span class="btn sm">Edit notice</span><span class="btn sm">Show notice in advance</span><span class="xs mut" style="margin-left:auto">Off</span></div>
    </div>
    <div class="card sec"><h3>${icon('lock', 15)}Sign-in safety<span class="r">last 24 hours</span></h3>
      <div class="row" style="gap:8px">${[['Successful sign-ins', '1,912', T.fg], ['Wrong passwords', '23', T.warn], ['Accounts locked', '1', T.bad]].map(([l, v, c]) => `<div style="flex:1;border:1px solid ${T.line};border-radius:10px;padding:10px;background:${T.raised}"><div class="xs mut">${l}</div><b style="font-size:19px;color:${c}">${v}</b></div>`).join('')}</div>
      <div class="li"><span class="av" style="width:30px;height:30px;font-size:10px">VK</span><span style="flex:1"><b>vikram.aakash@yopmail.com</b><div class="xs mut">aakash-portal · locked 12 min ago after 5 wrong passwords</div></span><span class="btn sm">Unlock</span></div>
    </div>
  </div>
</div>
<div class="g2e">
  <div class="card sec"><h3>${icon('wrench', 15)}Tools</h3>
    ${[['refresh', 'Run all health checks now', 'Database, email, Redis and search — results in a few seconds', 'Run'], ['broom', 'Clear access caches', 'Use if a plan or role change doesn’t show up straight away', 'Clear'], ['mail', 'Send a test email', 'Check delivery to any address', 'Send'], ['dl', 'Download diagnostics', 'Versions, settings (no secrets) and recent errors — for support', 'Download']].map(([ic, t, d, b]) => `<div class="tool"><span class="ic" style="background:${T.goldSoft};color:${T.gold};width:34px;height:34px">${icon(ic, 16)}</span><span style="flex:1"><b>${t}</b><span class="xs mut">${d}</span></span><span class="btn sm">${b}</span></div>`).join('')}
  </div>
  <div class="card sec"><h3>${icon('hist', 15)}Incidents &amp; changes<span class="r">last 30 days</span></h3>
    ${[[T.ok, 'All systems operational', 'now'], [T.badBar, 'Email down for 14 minutes', 'Gmail rejected sign-in · 21 Sep, 10:02 – 10:16 · 3 emails not sent'], [T.info, 'Updated to v0.0.1', 'Migration company_insights applied · 3 Oct, 22:51'], [T.warnBar, 'Slow responses for 6 minutes', 'Reports during month-end · 30 Sep, 18:40'], [T.info, 'API restarted', '1 Oct, 09:12']].map(([c, t, d]) => `<div class="tl"><span class="d" style="background:${c}"></span><div><b>${t}</b><div class="xs mut">${d}</div></div></div>`).join('')}
    <div class="row xs mut" style="border-top:1px solid ${T.line};padding-top:10px">${icon('cpu', 13)} API v0.0.1 · Node 24.12 · started 3 days ago · build 3f2aaa8</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('System readiness', css, html, 1300);
}

const boards = [
  ['SASystem.dc.html', 'Super Admin · System — health & speed: 90-day uptime, traffic, slowest pages', health, 1320],
  ['SASystemData.dc.html', 'Super Admin · System — data & delivery: database, files, jobs, email log', data, 1340],
  ['SASystemReady.dc.html', 'Super Admin · System — readiness checklist, maintenance mode, sign-in safety, tools', ready, 1300],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 9900 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n6 = { kind: 'title1', maxW: 4480, text: 'Super Admin · System — health & speed, data & delivery, readiness & tools', w: 240, x: 0, y: 9600 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
