// Company app → Reports & analytics: insights overview, people report, attendance & utilisation.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, helmetFonts, P } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  up: '<path d="m5 12 7-7 7 7M12 19V5"/>',
  down: '<path d="m19 12-7 7-7-7M12 5v14"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  pin: '<path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3"/>',
});

const C = { bg: '#F6F7FB', side: '#FFFFFF', border: '#E5E7EF', line: '#EEF0F5', raised: '#F8F9FC', fg: '#111827', muted: '#6B7280', pri: '#4F46E5', priSoft: '#EEF0FF', priText: '#3730A3', ok: '#059669', okSoft: '#E6F6F0', warn: '#D97706', warnSoft: '#FEF3E2', bad: '#DC2626', badSoft: '#FDECEC', info: '#0284C7', infoSoft: '#E5F4FB', violet: '#7C3AED', teal: '#0D9488', pink: '#DB2777' };
const PAL = [C.pri, C.teal, C.warn, C.pink, C.info, C.violet, '#65A30D'];

const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:${C.bg}}
.app{display:flex;min-height:100vh;font-family:Manrope,system-ui,sans-serif;color:${C.fg};background:${C.bg};position:relative}
.sb{flex:0 0 240px;background:${C.side};border-right:1px solid ${C.border};display:flex;flex-direction:column}
.sb-h{display:flex;gap:10px;align-items:center;padding:14px}
.logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#E9416A,#7A2BD9);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}
.sb-h b{display:block;font-size:14px}.sb-h span{font-size:11px;color:${C.muted}}
.sb-g{padding:12px 14px 3px;font-size:10.5px;font-weight:700;letter-spacing:.07em;color:#9CA3AF}
.sb-i{display:flex;align-items:center;gap:10px;height:34px;margin:0 10px;padding:0 10px;border-radius:7px;font-size:13.5px;color:#374151}
.sb-i svg{color:#9CA3AF}.sb-i.on{background:${C.priSoft};color:${C.priText};font-weight:700}.sb-i.on svg{color:${C.pri}}
.col{flex:1;min-width:0;display:flex;flex-direction:column}
.hdr{height:56px;border-bottom:1px solid ${C.border};display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:rgba(255,255,255,.7)}
.crumb{font-size:13.5px;color:${C.muted}}.crumb b{color:${C.fg}}
.main{padding:24px 30px 40px;display:flex;flex-direction:column;gap:16px}
.eyebrow{font-size:12.5px;color:${C.pri};font-weight:700}
h1{margin:2px 0 0;font-size:26px;font-weight:800;letter-spacing:-.02em}
.sub{color:${C.muted};font-size:14px;margin-top:3px}
.row{display:flex;align-items:center;gap:10px}
.btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:9px;border:1px solid ${C.border};background:#fff;color:${C.fg};font-size:13px;font-weight:700;white-space:nowrap}
.btn.pri{background:${C.pri};border-color:${C.pri};color:#fff}.btn.sm{height:30px;padding:0 10px;font-size:12px}
.card{background:#fff;border:1px solid ${C.border};border-radius:14px;box-shadow:0 1px 2px rgba(17,24,39,.04)}
.sec{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sec h3{margin:0;font-size:14.5px;display:flex;align-items:center;gap:8px}.sec h3 svg{color:${C.muted}}
.sec h3 .r{margin-left:auto;font-size:12px;font-weight:500;color:${C.muted}}
.mut{color:${C.muted}}.xs{font-size:12px}
.tabs{display:flex;gap:4px;background:#fff;border:1px solid ${C.border};border-radius:11px;padding:4px;width:max-content}
.tabs span{display:flex;align-items:center;gap:7px;padding:7px 14px;border-radius:8px;font-size:13px;color:${C.muted};font-weight:600}
.tabs span.on{background:${C.pri};color:#fff}
.fbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:9px;border:1px solid ${C.border};background:#fff;font-size:12.5px;font-weight:600;color:#374151}
.chip.on{border-color:#C7C9F7;background:${C.priSoft};color:${C.priText}}
.seg{display:flex;border:1px solid ${C.border};border-radius:9px;overflow:hidden;background:#fff}.seg span{padding:7px 11px;font-size:12px;font-weight:600;color:${C.muted}}.seg span.on{background:${C.fg};color:#fff}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{padding:14px 16px;display:flex;flex-direction:column;gap:3px;position:relative;overflow:hidden}
.kpi span.l{font-size:12px;color:${C.muted}}.kpi b.v{font-size:25px;font-weight:800;letter-spacing:-.02em}
.delta{font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:2px}
.d-up{color:${C.ok}}.d-dn{color:${C.bad}}.d-flat{color:${C.muted}}
.kpi svg.sp{position:absolute;right:12px;bottom:12px}
.hl{display:flex;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid ${C.border};background:#fff;align-items:flex-start}
.hl .ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.g21{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}.g12{display:grid;grid-template-columns:1fr 1.4fr;gap:16px}
.lib{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid ${C.line};border-radius:12px;background:${C.raised}}
.lib .ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.bar{height:8px;border-radius:99px;background:${C.line};overflow:hidden}.bar i{display:block;height:100%;border-radius:99px;transform-origin:left;animation:fw 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes fw{from{transform:scaleX(0)}}
.chart polyline,.chart path.ln{stroke-dasharray:3000;animation:draw 1.6s ease both}@keyframes draw{from{stroke-dashoffset:3000}}
.heat{display:grid;gap:3px}.heat i{display:block;border-radius:4px;aspect-ratio:1}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${C.muted};padding:8px 10px;border-bottom:1px solid ${C.border}}
td{padding:9px 10px;border-bottom:1px solid ${C.line}}
.av{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;color:#fff;flex:none}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.p-ok{background:${C.okSoft};color:${C.ok}}.p-warn{background:${C.warnSoft};color:${C.warn}}.p-bad{background:${C.badSoft};color:${C.bad}}.p-pri{background:${C.priSoft};color:${C.priText}}.p-neu{background:${C.line};color:${C.muted}}
.dim{position:absolute;inset:0;background:rgba(17,24,39,.35);z-index:4}
.drawer{position:absolute;top:0;right:0;bottom:0;width:440px;background:#fff;border-left:1px solid ${C.border};z-index:5;display:flex;flex-direction:column;box-shadow:-24px 0 50px -20px rgba(0,0,0,.35)}
.modal{position:absolute;left:50%;top:150px;transform:translateX(-50%);width:480px;background:#fff;border:1px solid ${C.border};border-radius:16px;z-index:5;box-shadow:0 30px 60px -20px rgba(0,0,0,.4)}
.fld{display:flex;flex-direction:column;gap:5px;font-size:12.5px}.fld label{font-weight:700}
.inp{height:36px;border:1px solid ${C.border};border-radius:9px;padding:0 11px;display:flex;align-items:center;font-size:13px;gap:8px;background:#fff}
</style>\n</helmet>`;

const sidebar = () => `<aside class="sb">
<div class="sb-h"><span class="logo">AP</span><span><b>aakash-portal</b><span>HR workspace</span></span></div>
<div class="sb-g">OVERVIEW</div><div class="sb-i">${icon('dashboard')}Home</div><div class="sb-i">${icon('idcard')}My profile</div><div class="sb-i on">${icon('chart')}Reports &amp; analytics</div><div class="sb-i">${icon('contact')}People</div>
<div class="sb-g">ORGANIZATION</div><div class="sb-i">${icon('users')}Employees</div><div class="sb-i">${icon('network')}Organisation</div>
<div class="sb-g">ENGAGEMENT</div><div class="sb-i">${icon('megaphone')}Announcements</div><div class="sb-i">${icon('heart')}Kudos</div>
<div class="sb-g">WORK</div><div class="sb-i">${icon('folder')}Projects</div><div class="sb-i">${icon('timer')}Timesheets</div>
<div class="sb-g">TIME</div><div class="sb-i">${icon('calcheck')}Attendance</div><div class="sb-i">${icon('plane')}Leave</div>
</aside>`;
const header = (crumb) => `<header class="hdr"><div class="crumb">Insights &nbsp;›&nbsp; <b>${crumb}</b></div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (tab) => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">Insights</div><h1>Reports &amp; analytics</h1><div class="sub">Everyone in the company · numbers as of today, 4 Oct 2026</div></div>
<span class="btn">${icon('mail', 14)}Schedule</span><span class="btn">${icon('dl', 14)}Export</span></div>
<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
<div class="tabs">${[['overview', 'grid', 'Overview'], ['people', 'users', 'People'], ['time', 'calcheck', 'Attendance &amp; leave'], ['util', 'gauge', 'Utilisation'], ['lib', 'file', 'All reports']].map(([k, ic, l]) => `<span class="${k === tab ? 'on' : ''}">${icon(ic, 14)}${l}</span>`).join('')}</div>
<div class="fbar"><span class="seg"><span>7 d</span><span class="on">This month</span><span>Quarter</span><span>Year</span></span><span class="chip on">${icon('calrange', 13)}1 – 31 Oct</span><span class="chip">${icon('network', 13)}All departments ▾</span><span class="chip">${icon('pin', 13)}All locations ▾</span><span class="chip on">↔ vs last month</span></div></div>`;

const spark = (vals, color, w = 84, h = 28) => {
  const mx = Math.max(...vals), mn = Math.min(...vals);
  const pts = vals.map((v, i) => `${((i * w) / (vals.length - 1)).toFixed(1)},${(h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="sp chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
const donut = (parts, size = 120, label = '') => {
  const r = 44, c = 2 * Math.PI * r, tot = parts.reduce((s, p) => s + p[1], 0);
  let off = 0;
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-block;flex:none"><svg width="${size}" height="${size}" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="${C.line}" stroke-width="16"/>${parts.map(([, v, col]) => { const len = (v / tot) * c; const s = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="16" stroke-dasharray="${len - 2} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; return s; }).join('')}</svg><b style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px">${label}</b></span>`;
};
const AV = [['PS', C.pri], ['HI', C.teal], ['VK', C.warn], ['KM', C.pink], ['RD', C.info], ['NG', C.violet], ['AK', '#65A30D'], ['SR', '#0F766E']];

// ─── Board 1: overview ──────────────────────────────────────
function overview() {
  const kpis = [
    ['Headcount', '24', '+2', 'up', [19, 20, 20, 21, 22, 22, 24], C.pri],
    ['Attendance rate', '93.4%', '+1.8 pts', 'up', [88, 90, 91, 89, 92, 92, 93], C.teal],
    ['Leave days taken', '31', '+9', 'flat', [12, 18, 15, 22, 20, 22, 31], C.warn],
    ['Attrition · 12 mo', '8.3%', '+2.1 pts', 'dn', [4, 5, 5, 6, 7, 7, 8], C.bad],
    ['Billable time', '71%', '−4 pts', 'dn', [78, 76, 77, 75, 74, 73, 71], C.violet],
  ];
  const hl = [
    [C.badSoft, C.bad, 'down', 'Late arrivals doubled on Mondays', '14 late check-ins on Mondays vs 6 last month — mostly Engineering.', 'See attendance'],
    [C.warnSoft, C.warn, 'plane', '3 people have 15+ days of leave unused', 'With 3 months left in the year — they may lose carry-over.', 'See leave balances'],
    [C.okSoft, C.ok, 'up', 'Billable time on Atlas is up 12%', 'Atlas logged 312 billable hours this month, the most of any project.', 'See utilisation'],
    [C.priSoft, C.pri, 'calcheck', '2 probations end this month', 'Rahul Das (18 Oct) and Neha Gupta (27 Oct) need a confirmation decision.', 'Review people'],
  ];
  const lib = [
    ['users', C.pri, C.priSoft, 'People', 'Headcount, joiners & leavers, attrition, diversity', [19, 20, 21, 22, 24], true],
    ['calcheck', C.teal, '#E1F5F2', 'Attendance & leave', 'Attendance rate, late arrivals, leave taken & balances', [88, 90, 89, 92, 93], true],
    ['gauge', C.violet, '#F1EAFE', 'Utilisation', 'Allocation, logged & billable hours per person and project', [78, 76, 75, 73, 71]],
    ['receipt', C.warn, C.warnSoft, 'Expenses', 'Claims by category, approval time, reimbursements', [40, 52, 48, 61, 58]],
    ['box', C.info, C.infoSoft, 'Assets', 'Assets by type and status, requests, returns due', [30, 31, 31, 33, 34]],
    ['headset', C.pink, '#FCE8F2', 'Helpdesk', 'Tickets by topic, time to resolve, open backlog', [12, 9, 14, 8, 6]],
  ];
  // Headcount waterfall: start → +joiners → −leavers → end
  const wf = [['Start of month', 22, 0, C.muted], ['Joined', 3, 22, C.ok], ['Left', -1, 24, C.bad], ['Today', 24, 0, C.pri]];
  const W = 420, H = 150, sc = H / 28;
  const html = `<div class="app">${sidebar()}<div class="col">${header('Reports &amp; analytics')}<main class="main">
${top('overview')}
<div class="kpis">${kpis.map(([l, v, d, dir, s, col]) => `<div class="card kpi"><span class="l">${l}</span><b class="v">${v}</b><span class="delta d-${dir}">${dir === 'up' ? '▲' : dir === 'dn' ? '▼' : '•'} ${d} <span class="mut" style="font-weight:500">vs last month</span></span>${spark(s, col)}</div>`).join('')}</div>
<div class="g21">
  <div class="card sec"><h3>${icon('bulb', 15)}What changed this month<span class="r">found in your data · updated daily</span></h3>
    <div class="g2" style="gap:10px">${hl.map(([soft, col, ic, t, d, a]) => `<div class="hl"><span class="ic" style="background:${soft};color:${col}">${icon(ic, 17)}</span><div style="flex:1"><b style="font-size:13.5px">${t}</b><div class="xs mut" style="margin-top:2px;line-height:1.45">${d}</div><div class="xs" style="color:${C.pri};font-weight:700;margin-top:6px">${a} →</div></div></div>`).join('')}</div>
  </div>
  <div class="card sec"><h3>${icon('users', 15)}Headcount this month<span class="r">22 → 24</span></h3>
    <svg width="100%" viewBox="0 0 ${W} ${H + 34}">
      ${wf.map(([l, v, base, col], i) => { const x = 20 + i * 100; const h = Math.abs(v) * sc; const y = H - (base + Math.max(v, 0)) * sc; return `<rect x="${x}" y="${y}" width="64" height="${h}" rx="6" fill="${col}" opacity="${i === 0 ? .35 : 1}"/><text x="${x + 32}" y="${y - 6}" text-anchor="middle" font-size="13" font-weight="800" font-family="Manrope" fill="${C.fg}">${v > 0 && i > 0 && i < 3 ? '+' : ''}${v}</text><text x="${x + 32}" y="${H + 18}" text-anchor="middle" font-size="11.5" font-family="Manrope" fill="${C.muted}">${l}</text>`; }).join('')}
      <line x1="10" x2="${W - 10}" y1="${H}" y2="${H}" stroke="${C.border}"/>
    </svg>
    <div class="row xs mut" style="gap:14px"><span><b style="color:${C.ok}">+3</b> joined: Arjun, Meera, Sana</span><span><b style="color:${C.bad}">−1</b> left: Dev</span><span style="margin-left:auto">2 more joining next week</span></div>
  </div>
</div>
<div class="card sec"><h3>${icon('file', 15)}Report library<span class="r">★ pinned reports open first · scheduled ones arrive by email</span></h3>
  <div class="g3" style="gap:10px">${lib.map(([ic, col, soft, t, d, s, pin]) => `<div class="lib"><span class="ic" style="background:${soft};color:${col}">${icon(ic, 17)}</span><div style="flex:1;min-width:0"><b style="font-size:13.5px">${t}</b> ${pin ? `<span style="color:${C.warn}">★</span>` : ''}<div class="xs mut" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d}</div></div>${spark(s, col, 60, 24).replace('class="sp chart"', 'class="chart"')}</div>`).join('')}</div>
  <div class="row xs mut">${icon('mail', 13)} <b style="color:${C.fg}">People</b> is emailed to you every Monday at 9 AM · <span style="color:${C.pri};font-weight:700">Manage schedules</span></div>
</div>
</main></div></div>`;
  return dcPage('Reports overview', css, html, 1180);
}

// ─── Board 2: people + drill-down ───────────────────────────
function people() {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const hc = [14, 15, 15, 16, 17, 18, 19, 20, 21, 21, 22, 24], jn = [1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 2, 3], lv = [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1];
  const W = 640, H = 170, bw = W / 12;
  const line = hc.map((v, i) => `${(i * bw + bw / 2).toFixed(1)},${(H - (v / 28) * H).toFixed(1)}`).join(' ');
  const depts = [['Engineering', 9, [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1]], ['Human Resources', 4, [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]], ['Finance', 3, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], ['Sales', 5, [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]], ['Operations', 3, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]];
  const pyramid = [['Director', 1], ['Manager', 4], ['Senior', 7], ['Associate', 9], ['Trainee', 3]];
  const html = `<div class="app">${sidebar()}<div class="col">${header('Reports &amp; analytics')}<main class="main">
${top('people')}
<div class="g21">
  <div class="card sec"><h3>${icon('users', 15)}Headcount, joiners &amp; leavers<span class="r"><span class="seg" style="display:inline-flex"><span class="on">Bars</span><span>Line</span><span>Table</span></span></span></h3>
    <svg width="100%" viewBox="0 0 ${W} ${H + 26}">
      ${[0.25, 0.5, 0.75].map((g) => `<line x1="0" x2="${W}" y1="${H * g}" y2="${H * g}" stroke="${C.line}"/>`).join('')}
      ${months.map((m, i) => `<rect x="${i * bw + bw / 2 - 14}" y="${H - jn[i] * 14}" width="12" height="${jn[i] * 14}" rx="3" fill="${C.ok}"/><rect x="${i * bw + bw / 2 + 2}" y="${H - lv[i] * 14}" width="12" height="${lv[i] * 14}" rx="3" fill="${C.bad}" opacity=".8"/><text x="${i * bw + bw / 2}" y="${H + 18}" text-anchor="middle" font-size="11" font-family="Manrope" fill="${C.muted}">${m}</text>`).join('')}
      <polyline points="${line}" fill="none" stroke="${C.pri}" stroke-width="2.5" stroke-linejoin="round"/>
      ${hc.map((v, i) => `<circle cx="${i * bw + bw / 2}" cy="${H - (v / 28) * H}" r="${i === 11 ? 5 : 3}" fill="#fff" stroke="${C.pri}" stroke-width="2"/>`).join('')}
    </svg>
    <div class="row xs mut" style="gap:16px"><span><span style="color:${C.pri}">●</span> Headcount</span><span><span style="color:${C.ok}">■</span> Joined</span><span><span style="color:${C.bad}">■</span> Left</span><span style="margin-left:auto">Attrition 12 mo <b style="color:${C.bad}">8.3%</b> · average tenure <b style="color:${C.fg}">1.6 years</b></span></div>
  </div>
  <div class="card sec"><h3>${icon('network', 15)}Levels<span class="r">click a bar to see who</span></h3>
    ${pyramid.map(([l, n], i) => `<div class="row" style="justify-content:center;gap:10px"><span class="xs mut" style="width:70px;text-align:right">${l}</span><div style="flex:1;display:flex;justify-content:center"><div style="height:24px;width:${(n / 9) * 100}%;border-radius:6px;background:${PAL[i]};opacity:${i === 3 ? 1 : .8};${i === 3 ? `box-shadow:0 0 0 3px ${C.priSoft}` : ''}"></div></div><b style="width:24px">${n}</b></div>`).join('')}
    <div class="row" style="gap:16px;border-top:1px solid ${C.line};padding-top:10px">${donut([['Male', 14, C.pri], ['Female', 9, C.pink], ['Not set', 1, '#D1D5DB']], 92, '24')}<div class="xs" style="display:flex;flex-direction:column;gap:5px"><b style="font-size:13px">Gender</b><span><span style="color:${C.pri}">●</span> Male 14</span><span><span style="color:${C.pink}">●</span> Female 9</span><span class="mut">● Not set 1</span></div></div>
  </div>
</div>
<div class="g12">
  <div class="card sec"><h3>${icon('down', 15)}Leavers by department · 12 months<span class="r">darker = more people left</span></h3>
    <table><thead><tr><th>Department</th>${months.map((m) => `<th style="padding:8px 2px;text-align:center">${m[0]}</th>`).join('')}<th style="text-align:right">Rate</th></tr></thead><tbody>
    ${depts.map(([d, n, cells]) => { const left = cells.reduce((s, x) => s + x, 0); const rate = Math.round((left / n) * 100); return `<tr style="${d === 'Engineering' ? `background:${C.priSoft}` : ''}"><td><b>${d}</b> <span class="xs mut">${n}</span></td>${cells.map((c) => `<td style="padding:6px 2px"><i style="display:block;height:18px;border-radius:4px;background:${c ? C.bad : C.line};opacity:${c ? .75 : 1}"></i></td>`).join('')}<td style="text-align:right"><span class="pill ${rate > 30 ? 'p-bad' : rate ? 'p-warn' : 'p-ok'}">${rate}%</span></td></tr>`; }).join('')}
    </tbody></table>
  </div>
  <div class="card sec"><h3>${icon('calcheck', 15)}Coming up<span class="r">probation, notice, anniversaries</span></h3>
    ${[['RD', C.info, 'Rahul Das', 'Probation ends 18 Oct', 'p-warn', 'Confirm'], ['NG', C.violet, 'Neha Gupta', 'Probation ends 27 Oct', 'p-warn', 'Confirm'], ['DV', C.muted, 'Dev Verma', 'Last day 31 Oct · serving notice', 'p-bad', 'Exit checklist'], ['PS', C.pri, 'Priya Sharma', '3 years on 21 Oct', 'p-pri', 'Send kudos']].map(([i, col, n, d, cls, a]) => `<div class="row" style="padding:8px 0;border-bottom:1px solid ${C.line}"><span class="av" style="background:${col}">${i}</span><div style="flex:1"><b style="font-size:13.5px">${n}</b><div class="xs"><span class="pill ${cls}" style="padding:1px 7px">${d}</span></div></div><span class="btn sm">${a}</span></div>`).join('')}
  </div>
</div>
</main></div>
<div class="dim"></div>
<aside class="drawer">
  <div style="padding:18px 20px;border-bottom:1px solid ${C.border}"><div class="row"><div style="flex:1"><div class="xs mut">People report › Levels</div><b style="font-size:18px">Associate · 9 people</b></div><span class="btn sm" style="border:0">${icon('x', 15)}</span></div>
    <div class="row xs" style="margin-top:10px;gap:6px"><span class="pill p-pri">Engineering 5</span><span class="pill p-neu">Sales 2</span><span class="pill p-neu">HR 1</span><span class="pill p-neu">Finance 1</span></div></div>
  <div style="padding:8px 20px;flex:1;overflow:hidden">
    ${[['PS', 'Priya Sharma', 'Software Engineer · Engineering', '2.9 yrs'], ['KM', 'Karan Mehta', 'Software Engineer · Engineering', '1.4 yrs'], ['RD', 'Rahul Das', 'QA Engineer · Engineering', '5 mo · probation'], ['AK', 'Arjun Kapoor', 'Frontend Engineer · Engineering', '3 weeks · new'], ['SR', 'Sana Rao', 'Sales Associate · Sales', '2 weeks · new'], ['NG', 'Neha Gupta', 'Sales Associate · Sales', '5 mo · probation'], ['HI', 'Hema Iyer', 'HR Associate · Human Resources', '2.1 yrs'], ['VK', 'Vikram Kumar', 'Accountant · Finance', '1.8 yrs']].map(([i, n, d, t], k) => `<div class="row" style="padding:9px 0;border-bottom:1px solid ${C.line}"><span class="av" style="background:${AV[k % AV.length][1]}">${i}</span><div style="flex:1"><b style="font-size:13.5px">${n}</b><div class="xs mut">${d}</div></div><span class="xs mut">${t}</span></div>`).join('')}
  </div>
  <div class="row" style="padding:14px 20px;border-top:1px solid ${C.border}"><span class="xs mut" style="flex:1">Click any number in Reports to see the people behind it</span><span class="btn sm">${icon('dl', 13)}Export these 9</span></div>
</aside></div>`;
  return dcPage('Reports people', css, html, 1180);
}

// ─── Board 3: attendance & leave + utilisation + schedule ───
function time() {
  // Month heat calendar: attendance % per working day
  const days = [];
  for (let d = 1; d <= 31; d++) {
    const dow = new Date(2026, 9, d).getDay();
    days.push({ d, dow, v: dow === 0 || dow === 6 ? null : [96, 92, 88, 95, 72, 98, 94, 90, 85, 97, 93, 91, 99, 87, 78, 95, 92, 96, 89, 94, 97, 93, 90, 86, 95][d % 25] });
  }
  const shade = (v) => (v === null ? '#F3F4F6' : v >= 95 ? C.teal : v >= 90 ? '#5EC4B8' : v >= 85 ? '#A7E0D8' : '#FCD9A8');
  const lead = (new Date(2026, 9, 1).getDay() + 6) % 7;
  const people = [['PS', 'Priya Sharma', [100, 100, 90, 110]], ['KM', 'Karan Mehta', [80, 85, 70, 75]], ['RD', 'Rahul Das', [40, 50, 45, 30]], ['AK', 'Arjun Kapoor', [100, 120, 115, 105]], ['VK', 'Vikram Kumar', [60, 65, 70, 60]], ['NG', 'Neha Gupta', [90, 95, 100, 90]]];
  const util = (v) => (v > 105 ? C.bad : v >= 85 ? C.teal : v >= 60 ? '#A7E0D8' : '#FCD9A8');
  const html = `<div class="app">${sidebar()}<div class="col">${header('Reports &amp; analytics')}<main class="main">
${top('time')}
<div class="g2">
  <div class="card sec"><h3>${icon('calcheck', 15)}Attendance by day · October<span class="r">93.4% overall</span></h3>
    <div class="row xs mut" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${Array.from({ length: lead }, () => '<i></i>').join('')}${days.map((x) => `<div style="height:40px;border-radius:8px;background:${shade(x.v)};display:flex;flex-direction:column;justify-content:space-between;padding:4px 6px;${x.d === 4 ? `outline:2px solid ${C.fg};outline-offset:1px` : ''}"><span style="font-size:10.5px;font-weight:700;color:${x.v !== null && x.v >= 90 ? '#fff' : C.muted}">${x.d}</span>${x.v !== null ? `<span style="font-size:10px;font-weight:800;color:${x.v >= 90 ? '#fff' : C.fg};text-align:right">${x.v}%</span>` : ''}</div>`).join('')}</div>
    <div class="row xs mut" style="gap:12px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C.teal}"></i> 95%+</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#A7E0D8"></i> 85–94%</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#FCD9A8"></i> below 85%</span><span style="margin-left:auto">Click a day for who was in, on leave or missing</span></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec"><h3>${icon('clock', 15)}Late arrivals by weekday<span class="r">this month vs last</span></h3>
      <div style="display:flex;align-items:flex-end;gap:14px;height:110px;padding:0 6px">${[['Mon', 14, 6], ['Tue', 5, 4], ['Wed', 4, 5], ['Thu', 6, 5], ['Fri', 8, 7]].map(([d, a, b]) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="display:flex;align-items:flex-end;gap:3px;height:90px"><i style="display:block;width:14px;height:${b * 6}px;border-radius:4px;background:#D1D5DB"></i><i style="display:block;width:14px;height:${a * 6}px;border-radius:4px;background:${d === 'Mon' ? C.bad : C.warn}"></i></div><span class="xs mut">${d}</span></div>`).join('')}</div>
    </div>
    <div class="card sec"><h3>${icon('plane', 15)}Leave balances left<span class="r">days people still have this year</span></h3>
      ${[['Casual', 46, 84], ['Sick', 62, 96], ['Earned', 118, 180]].map(([t, left, tot], i) => `<div><div class="row xs"><b style="flex:1">${t}</b><span class="mut">${left} of ${tot} days left</span></div><div class="bar" style="margin-top:4px"><i style="width:${(left / tot) * 100}%;background:${PAL[i + 1]}"></i></div></div>`).join('')}
      <div class="xs" style="color:${C.warn};font-weight:700">3 people have 15+ earned days unused · see who →</div>
    </div>
  </div>
</div>
<div class="card sec"><h3>${icon('gauge', 15)}Utilisation by week · logged ÷ capacity<span class="r"><span class="seg" style="display:inline-flex"><span class="on">Logged</span><span>Billable</span><span>Allocated</span></span></span></h3>
  <table><thead><tr><th>Person</th>${['29 Sep', '6 Oct', '13 Oct', '20 Oct'].map((w) => `<th style="text-align:center">${w}</th>`).join('')}<th>Projects</th><th style="text-align:right">Month</th></tr></thead><tbody>
  ${people.map(([i, n, w], k) => { const avg = Math.round(w.reduce((s, x) => s + x, 0) / w.length); return `<tr><td><span class="row"><span class="av" style="background:${AV[k][1]}">${i}</span><b>${n}</b></span></td>${w.map((v) => `<td style="padding:6px"><div style="height:30px;border-radius:7px;background:${util(v)};display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;color:${v >= 85 ? '#fff' : C.fg}">${v}%</div></td>`).join('')}<td class="xs mut">${['Atlas · Nova', 'Atlas', 'Nova', 'Atlas · Orbit', 'Internal', 'Orbit'][k]}</td><td style="text-align:right"><span class="pill ${avg > 105 ? 'p-bad' : avg >= 85 ? 'p-ok' : 'p-warn'}">${avg > 105 ? 'Over' : avg >= 85 ? 'Healthy' : avg >= 60 ? 'Light' : 'Bench'} · ${avg}%</span></td></tr>`; }).join('')}
  </tbody></table>
</div>
</main></div>
<div class="dim"></div>
<div class="modal">
  <div style="padding:18px 20px;border-bottom:1px solid ${C.border}" class="row"><span class="ic" style="width:36px;height:36px;border-radius:10px;background:${C.priSoft};color:${C.pri};display:flex;align-items:center;justify-content:center">${icon('mail', 17)}</span><div style="flex:1"><b style="font-size:16px">Email this report</b><div class="xs mut">Attendance &amp; leave · with today’s filters</div></div>${icon('x', 16)}</div>
  <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px">
    <div class="fld"><label>How often</label><span class="seg" style="display:inline-flex;width:max-content"><span>Daily</span><span class="on">Weekly</span><span>Monthly</span></span></div>
    <div class="row" style="gap:12px"><div class="fld" style="flex:1"><label>Day</label><div class="inp">Monday ▾</div></div><div class="fld" style="flex:1"><label>Time</label><div class="inp">9:00 AM ▾</div></div></div>
    <div class="fld"><label>Send to</label><div class="inp" style="height:auto;min-height:36px;flex-wrap:wrap;padding:5px 8px;gap:5px"><span class="pill p-pri">You</span><span class="pill p-pri">Hema Iyer</span><span class="xs mut">Add people with report access…</span></div></div>
    <div class="fld"><label>Format</label><div class="row xs" style="gap:14px"><span><b style="color:${C.pri}">◉</b> Summary in the email</span><span>○ PDF</span><span>○ CSV</span></div></div>
  </div>
  <div class="row" style="padding:14px 20px;border-top:1px solid ${C.border};justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">Schedule</span></div>
</div></div>`;
  return dcPage('Reports time', css, html, 1180);
}

const boards = [
  ['CAReports.dc.html', 'Company · Reports — overview: compare to last month, what changed, headcount waterfall, report library', overview, 1180],
  ['CAReportsPeople.dc.html', 'Company · Reports — people: trend, levels, leavers heat table, coming up, click-through to people', people, 1180],
  ['CAReportsTime.dc.html', 'Company · Reports — attendance calendar, late by weekday, leave balances, utilisation by week, schedule email', time, 1180],
];
if (require.main === module) {
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 13700 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n8 = { kind: 'title1', maxW: 4480, text: 'Company · Reports & analytics — overview, people, attendance & utilisation', w: 240, x: 0, y: 13400 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
}
module.exports = { css, sidebar, C, PAL };
