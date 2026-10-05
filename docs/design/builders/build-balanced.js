// Balanced homes (hero + two columns), Concept B (bento, dark) and the 3D & motion board.
// Uses the EXISTING sidebar and top bar from build-shell.js; Obsidian Gold tokens from build-gold.js.
const fs = require('fs');
const { P, shellCss, sidebar, header } = require('./build-shell.js');
const { light, dark } = require('./build-gold.js');
const dir = __dirname;

Object.assign(P, {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 3v4M21 5h-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
});
const icon = (k, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;

// ───────────────────────── shared content CSS (balanced boards)
const balCss = (t, isDark) => `<style>
.main{flex:1;padding:28px 32px 40px;display:flex;flex-direction:column;gap:20px;font-family:Manrope,system-ui,sans-serif;color:${t.fg};box-sizing:border-box}
.card{background:${t.surface};border:1px solid ${t.border};border-radius:12px;box-shadow:${t.shadow};display:flex;flex-direction:column;min-width:0;box-sizing:border-box}
.card>.hd{display:flex;align-items:center;gap:10px;padding:16px 20px 0}
.card>.hd h2{margin:0;font-size:15px;font-weight:800;flex:1}
.card>.hd a{font-size:13px;font-weight:700;color:${t.link};text-decoration:none}
.card>.bd{padding:14px 20px 18px;display:flex;flex-direction:column;gap:12px;flex:1}
.mut{color:${t.muted}}.sm{font-size:13px}.xs{font-size:12px}
.hero{background:${isDark ? 'linear-gradient(120deg,#1A160F 0%,#15130F 55%,#1E1810 100%)' : 'linear-gradient(120deg,#FFFFFF 0%,#FFFDF8 55%,#FBF2E2 100%)'};position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;right:-80px;top:-120px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,${t.gold}22 0%,transparent 65%);pointer-events:none}
.hero-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px;padding:22px 24px 18px;position:relative;z-index:1}
.hero-top .hi{flex:1 1 320px}
.eyebrow{font-size:12px;font-weight:700;color:${t.link};letter-spacing:.02em}
.hero h1{margin:4px 0 2px;font-size:28px;font-weight:800;letter-spacing:-.02em}
.acts{display:flex;flex-wrap:wrap;gap:8px}
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:8px;font:inherit;font-size:13px;font-weight:700;border:1px solid ${t.borderStrong};background:${t.surface};color:${t.fg};text-decoration:none;white-space:nowrap}
.btn.pri{background:${t.gold};border-color:${t.gold};color:#18181B}
.btn.lg{height:44px;padding:0 20px;font-size:14px}
.strip{display:grid;border-top:1px solid ${t.border};position:relative;z-index:1}
.strip>div{padding:14px 24px;display:flex;align-items:center;gap:12px;min-width:0}
.strip>div+div{border-left:1px solid ${t.border}}
.tile{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.t-gold{background:${t.goldSoft};color:${t.goldText}}.t-ok{background:${t.okSoft};color:${t.ok}}.t-warn{background:${t.warnSoft};color:${t.warn}}.t-bad{background:${t.badSoft};color:${t.bad}}.t-neu{background:${t.neuSoft};color:${t.neu}}
.t-teal{background:${isDark ? '#0F2624' : '#E2F1EF'};color:${isDark ? '#5EB8B0' : '#2C7A7B'}}
.kv b{display:block;font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.kv span{font-size:12px;color:${t.muted}}
.cols{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);gap:20px;align-items:stretch}
.stack{display:flex;flex-direction:column;gap:20px;min-width:0}
.stack>.card:last-child{flex:1}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:99px;font-size:11px;font-weight:700;padding:2px 8px;white-space:nowrap}
.p-ok{background:${t.okSoft};color:${t.ok}}.p-warn{background:${t.warnSoft};color:${t.warn}}.p-bad{background:${t.badSoft};color:${t.bad}}.p-gold{background:${t.goldSoft};color:${t.goldText}}.p-neu{background:${t.neuSoft};color:${t.neu}}.p-teal{background:${isDark ? '#0F2624' : '#E2F1EF'};color:${isDark ? '#5EB8B0' : '#2C7A7B'}}
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.day{border:1px solid ${t.border};border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;min-height:118px;background:${t.surface}}
.day .dn{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:${t.muted};text-transform:uppercase;letter-spacing:.04em}
.day .dn b{font-size:18px;color:${t.fg};letter-spacing:-.02em;text-transform:none}
.day .tm{font-size:11px;color:${t.muted};font-variant-numeric:tabular-nums;display:flex;justify-content:space-between}
.day.today{border-color:${t.gold};box-shadow:0 0 0 1px ${t.gold} inset;background:${isDark ? '#1C1810' : '#FFFBF3'}}
.day.off{background:${isDark ? '#12110E' : '#FBFAF7'}}
.seg{display:flex;gap:4px;background:${t.neuSoft};border-radius:8px;padding:3px}
.seg span{font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;color:${t.muted}}
.seg span.on{background:${t.surface};color:${t.fg};box-shadow:${t.shadow}}
.leave{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.lt{border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px;border:1px solid ${t.border}}
.lt .n{display:flex;align-items:baseline;justify-content:space-between}
.lt .n b{font-size:26px;font-weight:800;letter-spacing:-.02em}
.lt .n span{font-size:12px;color:${t.muted}}
.meter{height:6px;border-radius:99px;background:${t.track};overflow:hidden}
.meter i{display:block;height:100%;border-radius:99px}
.ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ul li{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid ${t.line}}
.ul li:first-child{border-top:0;padding-top:2px}
.ul .tx{flex:1;min-width:0}
.ul .tx b{display:block;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ul .tx span{display:block;font-size:12px;color:${t.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mini{height:30px;padding:0 12px;font-size:12px}
.av{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none;background:${t.goldSoft};color:${t.goldText}}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.st{border:1px solid ${t.border};border-radius:10px;padding:12px}
.st b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em}
.st span{font-size:12px;color:${t.muted}}
.ann{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.an{border:1px solid ${t.border};border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px}
.an b{font-size:14px}
.cnt{min-width:22px;height:22px;border-radius:99px;background:${t.goldSoft};color:${t.goldText};font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.cnt.z{background:${t.neuSoft};color:${t.muted}}
.bars{display:flex;align-items:flex-end;gap:10px;height:120px}
.bars>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:${t.muted};height:100%;justify-content:flex-end}
.bars i{display:block;width:100%;max-width:30px;border-radius:5px 5px 2px 2px}
.dept{display:flex;flex-direction:column;gap:10px}
.dept div{display:grid;grid-template-columns:96px 1fr 28px;gap:10px;align-items:center;font-size:12.5px}
.dept div b{text-align:right;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:12px;font-weight:600;color:${t.muted};padding:10px 12px;border-bottom:1px solid ${t.border}}
td{padding:11px 12px;border-bottom:1px solid ${t.line}}
tr:last-child td{border-bottom:0}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11.5px;color:${t.muted}}
.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:0}
</style>`;

const helmetFonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">`;

function shellPage(title, kind, crumb, t, isDark, h, mainHtml, extraCss = '') {
  const head = `<helmet>\n${helmetFonts}\n<style>body{margin:0;background:${t.bg}}a{color:${t.link}}</style>\n${shellCss(t, isDark)}\n${balCss(t, isDark)}\n${extraCss}\n</helmet>`;
  const html = `<div class="app">\n${sidebar(kind)}\n<div class="col">\n${header(crumb, isDark)}\n<main class="main">\n${mainHtml}\n</main>\n</div>\n</div>\n`;
  return dcPage(title, head, html, h);
}

function dcPage(title, head, html, h) {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n${head}\n${html}</x-dc>\n<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":${h}}}'>\nclass Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}\n</script>\n</body>\n</html>\n`;
}

// Donut from slices [value, colour]
function donut(slices, size = 120, stroke = 14, center = '', track = '#eee') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((n, s) => n + s[0], 0) || 1;
  let off = 0;
  const arcs = slices.map(([v, col]) => {
    const len = (v / sum) * c;
    const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-dasharray="${len} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len;
    return el;
  }).join('');
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>${arcs}</svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">${center}</div></div>`;
}

// ───────────────────────── 1 · Balanced employee home
function balancedEmployee(t, isDark) {
  const days = [
    ['Mon', 28, 'Present', 'p-ok', '09:41', '18:52', ''],
    ['Tue', 29, 'Present', 'p-ok', '09:28', '18:40', ''],
    ['Wed', 30, 'Sick leave', 'p-bad', '', '', 'Approved'],
    ['Thu', 1, 'Late', 'p-warn', '10:12', '19:05', ''],
    ['Fri', 2, 'Holiday', 'p-teal', '', '', 'Gandhi Jayanti'],
    ['Sat', 3, 'Weekly off', 'p-neu', '', '', ''],
    ['Sun', 4, 'Today', 'p-gold', '—', '—', 'Not checked in'],
  ];
  const week = days.map(([d, n, label, cls, i, o, note]) => `<div class="day${label === 'Today' ? ' today' : ''}${['Weekly off', 'Holiday'].includes(label) ? ' off' : ''}"><div class="dn">${d}<b>${n}</b></div><span class="pill ${cls}">${label}</span>${i ? `<div class="tm"><span>In</span><b>${i}</b></div><div class="tm"><span>Out</span><b>${o}</b></div>` : ''}${note ? `<span class="xs mut">${note}</span>` : ''}</div>`).join('');
  const leave = [
    ['Casual', 9, 12, t.gold, 't-gold'], ['Sick', 12, 12, t.bad, 't-bad'], ['Earned', 15, 15, t.ok, 't-ok'], ['Work from home', '∞', null, isDark ? '#5EB8B0' : '#2C7A7B', 't-teal'],
  ].map(([n, a, tot, col, tcls]) => `<div class="lt" style="background:${isDark ? 'transparent' : t.surface}"><div class="row" style="display:flex;align-items:center;gap:8px"><span class="tile ${tcls}" style="width:28px;height:28px;border-radius:8px">${icon(n === 'Work from home' ? 'home' : 'plane', 14)}</span><span class="sm" style="font-weight:700">${n}</span></div><div class="n"><b>${a}</b><span>${tot ? `of ${tot} left` : 'No limit'}</span></div><div class="meter"><i style="width:${tot ? (a / tot) * 100 : 100}%;background:${col};opacity:${tot ? 1 : .35}"></i></div></div>`).join('');

  return `
<section class="card hero" aria-label="Today">
  <div class="hero-top">
    <div class="hi"><div class="eyebrow">Sunday, 4 October</div><h1>Good morning, Amit</h1><div class="mut sm">Welcome to aakash-portal · General shift 09:30 – 18:30</div></div>
    <div class="acts"><a class="btn" href="#">${icon('timer')}Timesheet</a><a class="btn" href="#">${icon('heart')}Give kudos</a><a class="btn" href="#">${icon('home')}Work from home</a><a class="btn pri" href="#">${icon('plane')}Apply leave</a></div>
  </div>
  <div class="strip" style="grid-template-columns:1.1fr 1.2fr 1fr">
    <div><span class="tile t-warn">${icon('alert', 18)}</span><div class="kv"><b style="font-size:15px">1 thing needs you</b><span>Complete your profile · 86%</span></div></div>
    <div><span class="tile t-neu">${icon('clock', 18)}</span><div class="kv"><b style="font-size:15px">Not checked in</b><span>Weekly off today · last out Thu 19:05</span></div></div>
    <div style="justify-content:flex-end"><a class="btn pri lg" href="#" style="width:100%;justify-content:center">${icon('login')}Check in</a></div>
  </div>
</section>

<div class="cols">
  <div class="stack">
    <section class="card"><div class="hd"><h2>My week</h2><div class="seg"><span class="on">Week</span><span>Month</span></div><span class="sm mut" style="margin-left:8px">Sep 28 – Oct 4</span></div>
      <div class="bd"><div class="week">${week}</div>
      <div class="legend"><span><i style="background:${t.ok}"></i>Present</span><span><i style="background:${t.warn}"></i>Late</span><span><i style="background:${t.bad}"></i>Leave</span><span><i style="background:${isDark ? '#5EB8B0' : '#2C7A7B'}"></i>Holiday</span><span><i style="background:${t.gold}"></i>Today</span><span style="margin-left:auto">Avg 8h 11m a day this month</span></div></div></section>

    <section class="card"><div class="hd"><h2>Leave balance</h2><span class="sm mut">36 days available</span><a href="#" style="margin-left:12px">My leave</a></div><div class="bd"><div class="leave">${leave}</div></div></section>

    <div class="pair">
      <section class="card"><div class="hd"><h2>Needs your action</h2><span class="cnt">2</span></div><div class="bd"><ul class="ul">
        <li><span class="tile t-gold">${icon('user')}</span><div class="tx"><b>Complete your profile · 86%</b><span>Add emergency contact</span></div><a class="btn mini" href="#">Open</a></li>
        <li><span class="tile t-warn">${icon('box')}</span><div class="tx"><b>Acknowledge your laptop</b><span>Dell Latitude 5440 · assigned Oct 1</span></div><a class="btn mini" href="#">Confirm</a></li>
        <li><span class="tile t-ok">${icon('check')}</span><div class="tx"><b>Timesheet for last week</b><span>Submitted · waiting for Rohan</span></div><span class="pill p-ok">Done</span></li>
      </ul></div></section>
      <section class="card"><div class="hd"><h2>My projects</h2><span class="pill p-gold">100% allocated</span></div><div class="bd"><ul class="ul">
        <li><span class="tile t-gold">${icon('folder')}</span><div class="tx"><b>EXP-TRX Reimagined</b><span>Since Sep 2026 · lead Rohan</span></div><b class="sm">70%</b></li>
        <li><span class="tile t-teal">${icon('folder')}</span><div class="tx"><b>Mobile onboarding</b><span>Since Aug 2026 · lead Neha</span></div><b class="sm">30%</b></li>
      </ul><div class="meter" style="height:8px;display:flex;margin-top:auto"><i style="width:70%;background:${t.gold};border-radius:99px 0 0 99px"></i><i style="width:30%;background:${isDark ? '#5EB8B0' : '#2C7A7B'};border-radius:0 99px 99px 0"></i></div><span class="xs mut">Hours this week: 32h logged of 40h</span></div></section>
    </div>
  </div>

  <div class="stack">
    <section class="card"><div class="hd"><h2>This month</h2><a href="#">Calendar</a></div><div class="bd"><div class="stats">
      <div class="st"><b style="color:${t.ok}">18</b><span>Present</span></div><div class="st"><b style="color:${isDark ? '#5EB8B0' : '#2C7A7B'}">2</b><span>Work from home</span></div>
      <div class="st"><b style="color:${t.bad}">1</b><span>Leave</span></div><div class="st"><b style="color:${t.warn}">1</b><span>Late</span></div></div></div></section>
    <section class="card"><div class="hd"><h2>Spotlight</h2><span class="sm mut">This week</span></div><div class="bd"><ul class="ul">
      <li><span class="tile t-bad">${icon('cake')}</span><div class="tx"><b>Priya Sharma</b><span>Birthday · Tuesday</span></div><a class="btn mini" href="#">Wish</a></li>
      <li><span class="tile t-gold">${icon('award')}</span><div class="tx"><b>Hema Iyer · 2 years</b><span>Work anniversary · Thursday</span></div><a class="btn mini" href="#">Kudos</a></li>
      <li><span class="tile t-teal">${icon('flag')}</span><div class="tx"><b>Dussehra</b><span>Holiday · Mon, 19 Oct</span></div></li>
    </ul></div></section>
    <section class="card"><div class="hd"><h2>Recent kudos</h2><a href="#">View all</a></div><div class="bd"><ul class="ul">
      <li style="align-items:flex-start"><span class="av">NS</span><div class="tx"><b>Neha → Rohan</b><span style="white-space:normal">Thanks for unblocking the release on Friday night!</span><span class="pill p-gold" style="margin-top:6px">Teamwork</span></div></li>
      <li style="align-items:flex-start"><span class="av">PS</span><div class="tx"><b>Priya → 6 people</b><span style="white-space:normal">Great job on the payroll dry-run, team.</span><span class="pill p-gold" style="margin-top:6px">Excellence</span></div></li>
    </ul></div></section>
  </div>
</div>

<section class="card"><div class="hd"><h2>Announcements</h2><a href="#">View all</a></div><div class="bd"><div class="ann">
  <div class="an"><span class="pill p-gold" style="align-self:flex-start">Policy · needs acknowledgement</span><b>Updated leave policy for 2027</b><span class="sm mut">Carry-forward rules change from January…</span></div>
  <div class="an"><span class="pill p-teal" style="align-self:flex-start">Event</span><b>Diwali celebration · 30 Oct</b><span class="sm mut">Lunch at 1 pm in the cafeteria, all welcome.</span></div>
  <div class="an"><span class="pill p-neu" style="align-self:flex-start">IT</span><b>VPN maintenance on Saturday</b><span class="sm mut">Remote access unavailable 10 pm – 2 am.</span></div>
</div></div></section>`;
}

// ───────────────────────── 2 · Balanced admin home
function balancedAdmin(t, isDark) {
  const teal = isDark ? '#5EB8B0' : '#2C7A7B';
  const approvals = [['calclock', 'Leave requests', 3, 'Oldest 2 days ago'], ['check', 'Attendance corrections', 1, 'Amit · missing check-out'], ['receipt', 'Expense claims', 2, '₹14,300 in total'], ['timer', 'Timesheets', 0, 'All caught up'], ['box', 'Asset requests', 1, 'Monitor for Neha']]
    .map(([ic, n, c, s]) => `<li><span class="tile ${c ? 't-gold' : 't-neu'}">${icon(ic)}</span><div class="tx"><b>${n}</b><span>${s}</span></div><span class="cnt${c ? '' : ' z'}">${c}</span><a class="btn mini" href="#">Review</a></li>`).join('');
  const depts = [['Engineering', 6], ['People', 2], ['Finance', 2], ['Sales', 2], ['Operations', 1]].map(([n, v]) => `<div><span>${n}</span><div class="meter" style="height:8px"><i style="width:${(v / 6) * 100}%;background:${t.gold}"></i></div><b>${v}</b></div>`).join('');
  const months = [['May', 1, 0], ['Jun', 2, 1], ['Jul', 0, 0], ['Aug', 3, 1], ['Sep', 2, 0], ['Oct', 1, 0]];
  const bars = months.map(([m, j, l]) => `<div><div style="display:flex;gap:3px;align-items:flex-end;height:100px;width:100%;justify-content:center"><i style="height:${Math.max(4, j * 30)}px;background:${t.gold};max-width:14px"></i><i style="height:${Math.max(4, l * 30)}px;background:${t.bad};opacity:${l ? 1 : .3};max-width:14px"></i></div>${m}</div>`).join('');
  return `
<section class="card hero" aria-label="Company today">
  <div class="hero-top">
    <div class="hi"><div class="eyebrow">Sunday, 4 October</div><h1>Good morning, test</h1><div class="mut sm">aakash-portal · 13 people in 5 departments</div></div>
    <div class="acts"><a class="btn" href="#">${icon('chart')}Reports</a><a class="btn" href="#">${icon('megaphone')}Post announcement</a><a class="btn pri" href="#">${icon('plus')}Add employee</a></div>
  </div>
  <div class="strip" style="grid-template-columns:repeat(5,1fr)">
    <div><span class="tile t-gold">${icon('users', 18)}</span><div class="kv"><b>13</b><span>Employees · 15 of 15 users active</span></div></div>
    <div><span class="tile t-ok">${icon('calcheck', 18)}</span><div class="kv"><b>9<small class="mut" style="font-size:13px"> / 13</small></b><span>Present today</span></div></div>
    <div><span class="tile t-bad">${icon('plane', 18)}</span><div class="kv"><b>2</b><span>On leave · 1 WFH</span></div></div>
    <div><span class="tile t-warn">${icon('clock', 18)}</span><div class="kv"><b>7</b><span>Waiting for you</span></div></div>
    <div><span class="tile t-teal">${icon('headset', 18)}</span><div class="kv"><b>3</b><span>Tickets to handle</span></div></div>
  </div>
</section>

<div class="cols">
  <div class="stack">
    <section class="card"><div class="hd"><h2>Waiting for your approval</h2><span class="cnt">7</span></div><div class="bd"><ul class="ul">${approvals}</ul></div></section>
    <div class="pair">
      <section class="card"><div class="hd"><h2>Attendance today</h2><a href="#">Team attendance</a></div><div class="bd" style="flex-direction:row;align-items:center;gap:20px">${donut([[9, t.ok], [1, teal], [2, t.bad], [1, t.warn]], 128, 16, `<b style="font-size:24px">9</b><span class="xs mut">of 13 in</span>`, t.track)}
        <ul class="ul" style="flex:1;gap:8px"><li style="border:0;padding:0"><span class="tx sm"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.ok};margin-right:8px"></i>Present</span><b>9</b></li><li style="border:0;padding:0"><span class="tx sm"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${teal};margin-right:8px"></i>Work from home</span><b>1</b></li><li style="border:0;padding:0"><span class="tx sm"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.bad};margin-right:8px"></i>On leave</span><b>2</b></li><li style="border:0;padding:0"><span class="tx sm"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.warn};margin-right:8px"></i>Not in yet</span><b>1</b></li></ul></div></section>
      <section class="card"><div class="hd"><h2>By department</h2><a href="#">People report</a></div><div class="bd"><div class="dept">${depts}</div></div></section>
    </div>
    <section class="card"><div class="hd"><h2>Joiners &amp; leavers</h2><span class="legend"><span><i style="background:${t.gold}"></i>Joined</span><span><i style="background:${t.bad}"></i>Left</span></span></div><div class="bd"><div class="bars">${bars}</div><span class="xs mut">9 joined and 2 left in the last 6 months · 2 on probation ending this month</span></div></section>
  </div>
  <div class="stack">
    <section class="card"><div class="hd"><h2>My day</h2><span class="pill p-neu">Weekly off</span></div><div class="bd" style="flex-direction:row;align-items:center;gap:14px"><span class="tile t-neu" style="width:44px;height:44px">${icon('clock', 20)}</span><div class="kv" style="flex:1"><b style="font-size:15px">Not checked in</b><span>Shift 09:30 – 18:30</span></div><a class="btn pri" href="#">${icon('login')}Check in</a></div></section>
    <section class="card"><div class="hd"><h2>Who’s off this week</h2><a href="#">Calendar</a></div><div class="bd"><ul class="ul">
      <li><span class="av">AV</span><div class="tx"><b>Amit Verma</b><span>Sick leave · Wed</span></div><span class="pill p-bad">Leave</span></li>
      <li><span class="av">KR</span><div class="tx"><b>Kiran Rao</b><span>Mon – Tue</span></div><span class="pill p-teal">WFH</span></li>
      <li><span class="av">SM</span><div class="tx"><b>Sneha Menon</b><span>Earned leave · Thu – Fri</span></div><span class="pill p-bad">Leave</span></li></ul></div></section>
    <section class="card"><div class="hd"><h2>Coming up</h2></div><div class="bd"><ul class="ul">
      <li><span class="tile t-bad">${icon('cake')}</span><div class="tx"><b>Priya Sharma</b><span>Birthday · Tuesday</span></div></li>
      <li><span class="tile t-gold">${icon('award')}</span><div class="tx"><b>Hema Iyer · 2 years</b><span>Anniversary · Thursday</span></div></li>
      <li><span class="tile t-teal">${icon('flag')}</span><div class="tx"><b>Dussehra</b><span>Holiday · Mon, 19 Oct</span></div></li></ul></div></section>
    <section class="card"><div class="hd"><h2>Admin shortcuts</h2></div><div class="bd"><ul class="ul">
      ${[['users', 'Employees', 'Add, import, edit records'], ['shield', 'Roles & permissions', 'Who can do what'], ['clock', 'Attendance settings', 'Shifts, geofence, rules'], ['palette', 'Theme & branding', 'Your portal’s look']].map(([ic, n, s]) => `<li><span class="tile t-neu">${icon(ic)}</span><div class="tx"><b>${n.replace('&', '&amp;')}</b><span>${s}</span></div>${icon('chev', 14)}</li>`).join('')}</ul></div></section>
  </div>
</div>`;
}

// ───────────────────────── 3 · Balanced super admin
function balancedSuper(t, isDark) {
  const teal = isDark ? '#5EB8B0' : '#2C7A7B';
  const rows = [['aakash-portal', 'Enterprise', 13, 200, 15, 'Active'], ['perf-bench', 'Enterprise', 493, 500, 495, 'Active'], ['Nova Retail', 'Growth', 46, 50, 41, 'Active'], ['Blue Fin Labs', 'Starter', 8, 25, 9, 'Suspended']]
    .map(([n, p, e, m, u, s]) => { const near = e / m >= 0.9; return `<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="av" style="border-radius:8px">${n.slice(0, 2).toUpperCase()}</span><b>${n}</b></div></td><td><span class="pill p-gold">${p}</span></td><td style="min-width:170px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${e} of ${m}</span>${near ? `<b style="color:${t.warn}">near limit</b>` : ''}</div><div class="meter"><i style="width:${(e / m) * 100}%;background:${near ? t.warn : t.gold}"></i></div></td><td>${u}</td><td><span class="pill ${s === 'Active' ? 'p-ok' : 'p-bad'}">${s}</span></td></tr>`; }).join('');
  const signup = [3, 5, 2, 6, 4, 8].map((v, i) => `<div><i style="height:${v * 12}px;background:${t.gold}"></i>${['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]}</div>`).join('');
  return `
<section class="card hero" aria-label="Platform">
  <div class="hero-top">
    <div class="hi"><div class="eyebrow">Platform overview</div><h1>Good morning</h1><div class="mut sm">All services operational · last checked 1 minute ago</div></div>
    <div class="acts"><a class="btn" href="#">${icon('layers')}Plans</a><a class="btn" href="#">${icon('file')}Audit logs</a><a class="btn pri" href="#">${icon('plus')}Onboard company</a></div>
  </div>
  <div class="strip" style="grid-template-columns:repeat(4,1fr)">
    <div><span class="tile t-gold">${icon('building', 18)}</span><div class="kv"><b>4</b><span>Companies · 3 active</span></div></div>
    <div><span class="tile t-teal">${icon('users', 18)}</span><div class="kv"><b>560</b><span>Employees across tenants</span></div></div>
    <div><span class="tile t-ok">${icon('activity', 18)}</span><div class="kv"><b>62</b><span>Users active today</span></div></div>
    <div><span class="tile t-warn">${icon('alert', 18)}</span><div class="kv"><b>1</b><span>Company near its limit</span></div></div>
  </div>
</section>
<div class="cols">
  <div class="stack">
    <section class="card"><div class="hd"><h2>Companies</h2><span class="sm mut">Plan and seats used</span><a href="#" style="margin-left:12px">All companies</a></div><div class="bd" style="padding:6px 8px 10px"><table><thead><tr><th>Company</th><th>Plan</th><th>Employees · limit</th><th>Users</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div class="pair">
      <section class="card"><div class="hd"><h2>New companies</h2><span class="sm mut">Last 6 months</span></div><div class="bd"><div class="bars">${signup}</div></div></section>
      <section class="card"><div class="hd"><h2>Company status</h2></div><div class="bd" style="flex-direction:row;align-items:center;gap:18px">${donut([[3, t.ok], [0, t.muted], [1, t.bad]], 120, 16, '<b style="font-size:22px">4</b><span class="xs mut">companies</span>', t.track)}<div class="sm" style="display:flex;flex-direction:column;gap:8px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.ok};margin-right:8px"></i>Active 3</span><span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.muted};margin-right:8px"></i>Inactive 0</span><span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.bad};margin-right:8px"></i>Suspended 1</span></div></div></section>
    </div>
  </div>
  <div class="stack">
    <section class="card"><div class="hd"><h2>System</h2><a href="#">Details</a></div><div class="bd"><ul class="ul">
      ${[['PostgreSQL', 'Operational', 'p-ok'], ['Redis (email queue)', 'Not configured', 'p-neu'], ['Email · Gmail', 'Connected', 'p-ok'], ['File storage', 'Local disk', 'p-neu'], ['API', 'v1.0 · production', 'p-gold']].map(([n, s, c]) => `<li><div class="tx"><b>${n}</b></div><span class="pill ${c}">${s}</span></li>`).join('')}</ul></div></section>
    <section class="card"><div class="hd"><h2>Recent activity</h2><a href="#">Audit logs</a></div><div class="bd"><ul class="ul">
      ${[['plus', 't-gold', 'Nova Retail onboarded', '2 hours ago · you'], ['layers', 't-teal', 'Growth plan limits changed', 'Yesterday · you'], ['alert', 't-bad', 'Blue Fin Labs suspended', 'Oct 1 · billing'], ['palette', 't-neu', 'Theme “Obsidian Gold” published', 'Sep 30 · aakash-portal']].map(([ic, c, n, s]) => `<li><span class="tile ${c}">${icon(ic)}</span><div class="tx"><b>${n}</b><span>${s}</span></div></li>`).join('')}</ul></div></section>
  </div>
</div>`;
}

// ───────────────────────── Concept B · bento (dark, glass, motion-ready)
const bentoCss = (t) => `<style>
.main{flex:1;padding:24px 28px 36px;font-family:Manrope,system-ui,sans-serif;color:${t.fg};box-sizing:border-box;background:radial-gradient(1200px 500px at 70% -10%,#3A2A10 0%,transparent 60%),${t.bg}}
.bento{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:minmax(92px,auto);gap:16px}
.b{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px 20px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;min-width:0;position:relative;overflow:hidden;backdrop-filter:blur(12px);box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 20px 40px -24px rgba(0,0,0,.8);animation:rise .6s cubic-bezier(.2,.8,.2,1) both}
.b h3{margin:0;font-size:13px;font-weight:700;color:${t.muted};letter-spacing:.02em;display:flex;align-items:center;gap:8px}
.b h3 a{margin-left:auto;color:${t.link};text-decoration:none;font-size:12px}
.s3{grid-column:span 3}.s4{grid-column:span 4}.s5{grid-column:span 5}.s6{grid-column:span 6}.s7{grid-column:span 7}.s8{grid-column:span 8}.s12{grid-column:span 12}.r2{grid-row:span 2}.r3{grid-row:span 3}
.heroB{background:radial-gradient(500px 260px at 85% 30%,rgba(214,158,58,.35),transparent 65%),linear-gradient(135deg,#1C160C,#100E0B 60%);border-color:rgba(214,158,58,.25)}
.heroB h1{margin:0;font-size:34px;font-weight:800;letter-spacing:-.03em;color:#FFF7E8}
.eb{font-size:12px;font-weight:700;color:${t.link}}
.chip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:99px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:12.5px;font-weight:700;color:${t.fg};text-decoration:none}
.chip.gold{background:${t.gold};border-color:${t.gold};color:#18181B}
.big{font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.mut{color:${t.muted}}.xs{font-size:12px}.sm{font-size:13px}
.orb{position:absolute;right:48px;top:50%;width:190px;height:190px;margin-top:-95px;perspective:700px}
.orb .ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(214,158,58,.55);transform:rotateX(68deg);animation:spin 9s linear infinite}
.orb .ring.r2{inset:18px;border-color:rgba(255,247,232,.25);animation-duration:13s;animation-direction:reverse}
.orb .core{position:absolute;inset:48px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFE3A8,#D69E3A 45%,#6E470C 100%);box-shadow:0 0 60px rgba(214,158,58,.55),inset -10px -14px 30px rgba(0,0,0,.45);animation:float 5s ease-in-out infinite}
.orb .core::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.55),transparent 35%)}
.ci{position:relative;display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:14px;background:${t.gold};color:#18181B;font-weight:800;font-size:15px;text-decoration:none;box-shadow:0 10px 30px -8px rgba(214,158,58,.7)}
.ci::before{content:"";position:absolute;inset:-6px;border-radius:18px;border:2px solid ${t.gold};opacity:0;animation:pulse 2.4s ease-out infinite}
.tl{display:flex;flex-direction:column;gap:0;position:relative;padding-left:18px}
.tl::before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:linear-gradient(${t.gold},rgba(255,255,255,.08))}
.tl div{position:relative;padding:7px 0;display:flex;justify-content:space-between;font-size:13px}
.tl div::before{content:"";position:absolute;left:-17px;top:12px;width:10px;height:10px;border-radius:50%;background:${t.bg};border:2px solid ${t.gold}}
.tl div.dim::before{border-color:rgba(255,255,255,.2)}
.tl b{font-variant-numeric:tabular-nums}
.ringw{position:relative;width:96px;height:96px;flex:none}
.spark{display:flex;align-items:flex-end;gap:5px;height:44px}
.spark i{flex:1;border-radius:4px 4px 1px 1px;background:linear-gradient(${t.gold},rgba(214,158,58,.25));animation:grow .9s cubic-bezier(.2,.8,.2,1) both;transform-origin:bottom}
.lv{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lv>div{border-radius:12px;padding:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}
.lv b{font-size:22px;font-weight:800}
.bar2{height:5px;border-radius:99px;background:rgba(255,255,255,.08);margin-top:8px;overflow:hidden}
.bar2 i{display:block;height:100%;border-radius:99px;animation:fill 1.1s cubic-bezier(.2,.8,.2,1) both}
.wk{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.wk div{border-radius:12px;padding:10px 8px;text-align:center;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:6px;align-items:center}
.wk div b{font-size:17px}
.wk div.on{border-color:${t.gold};background:rgba(214,158,58,.12)}
.dot{width:8px;height:8px;border-radius:50%}
.pp{display:flex;align-items:center;gap:10px;font-size:13px}
.pp .av{width:30px;height:30px;border-radius:50%;background:#2E2414;color:#E8BD6E;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.tilt{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.tilt:hover{transform:perspective(900px) rotateX(4deg) rotateY(-5deg) translateY(-3px);box-shadow:0 30px 50px -24px rgba(0,0,0,.9),0 0 0 1px rgba(214,158,58,.3)}
@keyframes spin{to{transform:rotateX(68deg) rotateZ(360deg)}}
@keyframes float{50%{transform:translateY(-8px)}}
@keyframes pulse{0%{opacity:.7;transform:scale(.96)}100%{opacity:0;transform:scale(1.12)}}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleY(0)}}
@keyframes fill{from{width:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>`;

function bentoEmployee(t) {
  const d = (i) => `style="animation-delay:${i * 60}ms"`;
  const ring = (pct, col, label, sub) => { const r = 40, c = 2 * Math.PI * r; return `<div class="ringw"><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 48 48)"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:20px">${label}</b><span class="xs mut">${sub}</span></div></div>`; };
  return `
<div class="bento">
  <section class="b heroB s8 r2 tilt" ${d(0)}>
    <div class="eb">Sunday, 4 October · 09:12</div>
    <h1>Good morning, Amit</h1>
    <div class="mut sm" style="max-width:420px">One thing needs you today. Your shift starts at 09:30 — have a good one.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto"><a class="chip gold" href="#">${icon('plane', 14)}Apply leave</a><a class="chip" href="#">${icon('home', 14)}WFH</a><a class="chip" href="#">${icon('timer', 14)}Timesheet</a><a class="chip" href="#">${icon('heart', 14)}Kudos</a></div>
    <div class="orb" aria-hidden="true"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
  </section>
  <section class="b s4 r2" ${d(1)}>
    <h3>${icon('clock', 14)}Today</h3>
    <div style="display:flex;align-items:center;gap:16px">${ring(0, t.gold, '0h', 'of 8h')}<div><div class="xs mut">Shift</div><b>09:30 – 18:30</b><div class="xs mut" style="margin-top:4px">General</div></div></div>
    <div class="tl"><div><span>Check in</span><b>—</b></div><div class="dim"><span>Lunch</span><b class="mut">13:30</b></div><div class="dim"><span>Shift ends</span><b class="mut">18:30</b></div></div>
    <a class="ci" href="#" style="margin-top:auto;justify-content:center">${icon('login', 18)}Check in</a>
  </section>

  <section class="b s3 tilt" ${d(2)}><h3>${icon('calcheck', 14)}Present this month</h3><div class="big" style="color:#5FD39B">18</div><div class="spark">${[6, 8, 7, 9, 8, 5, 8, 9].map((v, i) => `<i style="height:${v * 10}%;animation-delay:${300 + i * 50}ms"></i>`).join('')}</div></section>
  <section class="b s3 tilt" ${d(3)}><h3>${icon('timer', 14)}Avg hours / day</h3><div class="big">8h 11m</div><span class="xs mut">▲ 22 min vs September</span></section>
  <section class="b s3 tilt" ${d(4)}><h3>${icon('folder', 14)}Logged this week</h3><div class="big">32<span class="mut" style="font-size:18px">/40h</span></div><div class="bar2"><i style="width:80%;background:${t.gold}"></i></div></section>
  <section class="b s3 tilt" ${d(5)}><h3>${icon('alert', 14)}Needs you</h3><div class="big" style="color:#F2B65A">1</div><span class="xs mut">Complete your profile · 86%</span></section>

  <section class="b s7" ${d(6)}><h3>${icon('calrange', 14)}My week<a href="#">Full calendar</a></h3><div class="wk">
    ${[['Mon', 28, '#5FD39B', '8h 51m'], ['Tue', 29, '#5FD39B', '9h 12m'], ['Wed', 30, '#FF8A7A', 'Sick'], ['Thu', 1, '#F2B65A', 'Late'], ['Fri', 2, '#5EB8B0', 'Holiday'], ['Sat', 3, 'rgba(255,255,255,.2)', 'Off'], ['Sun', 4, t.gold, 'Today']].map(([w, n, c, s]) => `<div class="${s === 'Today' ? 'on' : ''}"><span class="xs mut">${w}</span><b>${n}</b><span class="dot" style="background:${c}"></span><span class="xs mut">${s}</span></div>`).join('')}
  </div></section>
  <section class="b s5" ${d(7)}><h3>${icon('plane', 14)}Leave balance<a href="#">My leave</a></h3><div class="lv">
    ${[['Casual', 9, 12, t.gold], ['Sick', 12, 12, '#FF8A7A'], ['Earned', 15, 15, '#5FD39B'], ['WFH', '∞', 0, '#5EB8B0']].map(([n, a, tot, c]) => `<div><span class="xs mut">${n}</span><div><b>${a}</b><span class="xs mut">${tot ? ` / ${tot}` : ' no limit'}</span></div><div class="bar2"><i style="width:${tot ? (a / tot) * 100 : 100}%;background:${c}"></i></div></div>`).join('')}
  </div></section>

  <section class="b s4" ${d(8)}><h3>${icon('sparkle', 14)}Spotlight</h3>
    <div class="pp"><span class="av">PS</span><div style="flex:1"><b>Priya Sharma</b><div class="xs mut">Birthday · Tuesday</div></div>${icon('cake', 16)}</div>
    <div class="pp"><span class="av">HI</span><div style="flex:1"><b>Hema Iyer · 2 yrs</b><div class="xs mut">Anniversary · Thursday</div></div>${icon('award', 16)}</div>
    <div class="pp"><span class="av" style="background:#0F2624;color:#5EB8B0">${icon('flag', 13)}</span><div style="flex:1"><b>Dussehra</b><div class="xs mut">Mon, 19 Oct</div></div></div></section>
  <section class="b s4" ${d(9)}><h3>${icon('folder', 14)}My projects</h3>
    <div class="pp"><div style="flex:1"><b>EXP-TRX Reimagined</b><div class="bar2"><i style="width:70%;background:${t.gold}"></i></div></div><b>70%</b></div>
    <div class="pp"><div style="flex:1"><b>Mobile onboarding</b><div class="bar2"><i style="width:30%;background:#5EB8B0"></i></div></div><b>30%</b></div>
    <span class="xs mut" style="margin-top:auto">100% allocated · lead Rohan</span></section>
  <section class="b s4" ${d(10)}><h3>${icon('heart', 14)}Kudos<a href="#">View all</a></h3>
    <div class="pp" style="align-items:flex-start"><span class="av">NS</span><div><b>Neha → Rohan</b><div class="xs mut">Thanks for unblocking Friday’s release!</div></div></div>
    <div class="pp" style="align-items:flex-start"><span class="av">PS</span><div><b>Priya → 6 people</b><div class="xs mut">Great job on the payroll dry-run.</div></div></div></section>

  <section class="b s12" ${d(11)} style="flex-direction:row;align-items:center;gap:16px"><span style="width:40px;height:40px;border-radius:12px;background:rgba(214,158,58,.15);color:${t.gold};display:flex;align-items:center;justify-content:center">${icon('megaphone', 18)}</span><div style="flex:1"><b>Updated leave policy for 2027</b><div class="xs mut">Needs your acknowledgement · posted by People team, 2 days ago</div></div><a class="chip" href="#">Read</a><a class="chip gold" href="#">Acknowledge</a></section>
</div>`;
}

function bentoAdmin(t) {
  const d = (i) => `style="animation-delay:${i * 60}ms"`;
  const kpi = (i, ic, label, val, sub, col) => `<section class="b s3 tilt" ${d(i)}><h3>${icon(ic, 14)}${label}</h3><div class="big" style="color:${col}">${val}</div><span class="xs mut">${sub}</span></section>`;
  return `
<div class="bento">
  <section class="b heroB s8 r2" ${d(0)}>
    <div class="eb">Sunday, 4 October</div><h1>Company pulse</h1>
    <div class="mut sm">9 of 13 in today · 7 approvals waiting · nothing overdue</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto"><a class="chip gold" href="#">${icon('plus', 14)}Add employee</a><a class="chip" href="#">${icon('megaphone', 14)}Announce</a><a class="chip" href="#">${icon('chart', 14)}Reports</a></div>
    <div class="orb" aria-hidden="true"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
  </section>
  <section class="b s4 r2" ${d(1)}><h3>${icon('calcheck', 14)}Attendance today<a href="#">Team</a></h3>
    <div style="display:flex;align-items:center;gap:16px">${donut([[9, '#5FD39B'], [1, '#5EB8B0'], [2, '#FF8A7A'], [1, '#F2B65A']], 120, 14, '<b style="font-size:24px">69%</b><span class="xs mut">in</span>', 'rgba(255,255,255,.08)')}
    <div class="sm" style="display:flex;flex-direction:column;gap:8px">${[['#5FD39B', 'Present', 9], ['#5EB8B0', 'WFH', 1], ['#FF8A7A', 'Leave', 2], ['#F2B65A', 'Not in', 1]].map(([c, n, v]) => `<span><i class="dot" style="display:inline-block;background:${c};margin-right:8px"></i>${n} <b>${v}</b></span>`).join('')}</div></div>
    <div class="spark" style="margin-top:auto">${[7, 9, 8, 10, 9, 4, 9].map((v, i) => `<i style="height:${v * 9}%;animation-delay:${300 + i * 50}ms"></i>`).join('')}</div><span class="xs mut">Check-ins by hour, 08:00 – 14:00</span></section>
  ${kpi(2, 'users', 'Employees', 13, '5 departments · 2 on probation', '#FFF7E8')}
  ${kpi(3, 'clock', 'Waiting for you', 7, 'across 5 modules', '#F2B65A')}
  ${kpi(4, 'headset', 'Tickets', 3, '1 unassigned', '#5EB8B0')}
  ${kpi(5, 'receipt', 'Claims this month', '₹48k', '₹14.3k waiting', '#FFF7E8')}
  <section class="b s7" ${d(6)}><h3>${icon('check', 14)}Waiting for your approval</h3>
    ${[['Leave requests', 3, 'Oldest 2 days'], ['Expense claims', 2, '₹14,300'], ['Attendance corrections', 1, 'Amit · missing out'], ['Asset requests', 1, 'Monitor for Neha']].map(([n, c, s]) => `<div class="pp" style="padding:4px 0"><div style="flex:1"><b>${n}</b><div class="xs mut">${s}</div></div><span class="chip" style="height:26px;padding:0 10px">${c}</span><a class="chip gold" href="#" style="height:30px">Review</a></div>`).join('')}</section>
  <section class="b s5" ${d(7)}><h3>${icon('plane', 14)}Who’s off this week<a href="#">Calendar</a></h3>
    ${[['AV', 'Amit Verma', 'Sick · Wed', '#FF8A7A'], ['KR', 'Kiran Rao', 'WFH · Mon – Tue', '#5EB8B0'], ['SM', 'Sneha Menon', 'Earned · Thu – Fri', '#FF8A7A']].map(([a, n, s, c]) => `<div class="pp"><span class="av">${a}</span><div style="flex:1"><b>${n}</b><div class="xs mut">${s}</div></div><span class="dot" style="background:${c}"></span></div>`).join('')}</section>
</div>`;
}

// ───────────────────────── 3D & motion board
function motionBoard(t) {
  return `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:#0B0A08}
.mb{font-family:Manrope,system-ui,sans-serif;color:#EDEDEF;padding:40px;background:radial-gradient(900px 400px at 80% 0%,#2E2210,transparent 60%),#0B0A08;min-height:100vh;box-sizing:border-box}
.mb h1{margin:0 0 6px;font-size:30px;font-weight:800;letter-spacing:-.02em}
.mb>p{margin:0 0 28px;color:#A9A59C;max-width:820px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.demo{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:14px;min-height:300px;box-sizing:border-box}
.demo h2{margin:0;font-size:16px;font-weight:800}
.demo p{margin:0;color:#A9A59C;font-size:13px;line-height:1.5}
.stage{flex:1;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(0,0,0,.25);min-height:170px;position:relative;overflow:hidden}
.tag{align-self:flex-start;font-size:11px;font-weight:800;padding:3px 8px;border-radius:99px;background:#2E2414;color:#E8BD6E}
.tag.g2{background:#12291D;color:#5FD39B}.tag.g3{background:#0F2624;color:#5EB8B0}
/* 1 count up */
@property --n{syntax:'<integer>';inherits:false;initial-value:0}
.count{font-size:64px;font-weight:800;letter-spacing:-.03em;animation:cnt 2.2s cubic-bezier(.2,.8,.2,1) infinite alternate;counter-reset:n var(--n)}
.count::after{content:counter(n)}
@keyframes cnt{from{--n:0}to{--n:493}}
/* 2 ring */
.rg circle.v{stroke-dasharray:0 252;animation:ring 2.4s cubic-bezier(.2,.8,.2,1) infinite alternate}
@keyframes ring{to{stroke-dasharray:190 252}}
/* 3 tilt card */
.tc{width:220px;height:140px;border-radius:16px;background:linear-gradient(135deg,#2A2114,#15130F);border:1px solid rgba(214,158,58,.35);padding:16px;box-sizing:border-box;transform:perspective(700px) rotateX(10deg) rotateY(-18deg);animation:tilt 5s ease-in-out infinite;box-shadow:-20px 30px 40px -20px rgba(0,0,0,.9)}
.tc b{font-size:28px;display:block;margin-top:10px}
.tc::after{content:"";position:absolute;inset:0;border-radius:16px;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.12) 45%,transparent 60%);background-size:250% 100%;animation:shine 5s ease-in-out infinite}
.tc{position:relative}
@keyframes tilt{50%{transform:perspective(700px) rotateX(-6deg) rotateY(16deg)}}
@keyframes shine{0%{background-position:120% 0}100%{background-position:-120% 0}}
/* 4 3D badge cube */
.scene{width:120px;height:120px;perspective:600px}
.cube{width:100%;height:100%;position:relative;transform-style:preserve-3d;animation:cube 8s linear infinite}
.cube div{position:absolute;inset:0;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:1px solid rgba(214,158,58,.5);background:rgba(214,158,58,.12);color:#F0C985;backface-visibility:visible}
.cube .f1{transform:translateZ(60px)}.cube .f2{transform:rotateY(90deg) translateZ(60px)}.cube .f3{transform:rotateY(180deg) translateZ(60px)}.cube .f4{transform:rotateY(-90deg) translateZ(60px)}.cube .f5{transform:rotateX(90deg) translateZ(60px)}.cube .f6{transform:rotateX(-90deg) translateZ(60px)}
@keyframes cube{to{transform:rotateX(-20deg) rotateY(360deg)}}
.cube{transform:rotateX(-20deg)}
/* 5 isometric stack */
.iso{position:relative;width:200px;height:150px;transform:rotateX(55deg) rotateZ(-45deg);transform-style:preserve-3d}
.iso div{position:absolute;inset:0;border-radius:14px;border:1px solid rgba(255,255,255,.15);animation:lift 3.6s ease-in-out infinite}
.iso .l1{background:rgba(94,184,176,.25)}.iso .l2{background:rgba(214,158,58,.3);animation-delay:.2s}.iso .l3{background:rgba(255,247,232,.12);animation-delay:.4s;display:flex;align-items:center;justify-content:center;font-weight:800;color:#FFF7E8}
@keyframes lift{0%,100%{transform:translateZ(0)}50%{transform:translateZ(var(--z))}}
.iso .l1{--z:0px}.iso .l2{--z:26px}.iso .l3{--z:52px}
/* 6 check-in */
.cib{position:relative;display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 26px;border-radius:14px;background:#D69E3A;color:#18181B;font-weight:800;font-size:16px}
.cib::before,.cib::after{content:"";position:absolute;inset:-6px;border-radius:18px;border:2px solid #D69E3A;opacity:0;animation:pl 2.4s ease-out infinite}
.cib::after{animation-delay:1.2s}
@keyframes pl{0%{opacity:.8;transform:scale(.95)}100%{opacity:0;transform:scale(1.25)}}
.conf i{position:absolute;width:8px;height:12px;border-radius:2px;top:50%;left:50%;animation:conf 2.4s ease-out infinite}
@keyframes conf{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(540deg);opacity:0}}
/* 7 stagger */
.st{display:grid;grid-template-columns:repeat(3,52px);gap:8px}
.st i{height:40px;border-radius:10px;background:rgba(214,158,58,.25);border:1px solid rgba(214,158,58,.35);animation:rise 2.8s cubic-bezier(.2,.8,.2,1) infinite}
@keyframes rise{0%{opacity:0;transform:translateY(14px) scale(.96)}25%,80%{opacity:1;transform:none}100%{opacity:0}}
/* 8 skeleton */
.sk{width:240px;display:flex;flex-direction:column;gap:10px}
.sk i{height:14px;border-radius:7px;background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.05) 75%);background-size:200% 100%;animation:sk 1.4s linear infinite}
@keyframes sk{from{background-position:200% 0}to{background-position:-200% 0}}
/* 9 globe */
.globe{width:150px;height:150px;border-radius:50%;position:relative;background:radial-gradient(circle at 35% 30%,#3A2A10,#0B0A08 70%);box-shadow:inset 0 0 30px rgba(214,158,58,.35),0 0 50px rgba(214,158,58,.25);overflow:hidden}
.globe::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 18px,rgba(214,158,58,.35) 18px 19px);animation:gl 6s linear infinite;border-radius:50%}
.globe::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 18px,rgba(214,158,58,.2) 18px 19px);border-radius:50%}
.globe b{position:absolute;width:8px;height:8px;border-radius:50%;background:#FFE3A8;box-shadow:0 0 12px #FFE3A8;animation:blink 2s ease-in-out infinite;z-index:1}
@keyframes gl{to{background-position:38px 0}}
@keyframes blink{50%{opacity:.2}}
.plan{margin-top:28px;display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:20px}
.plan .demo{min-height:0}
.plan ul{margin:0;padding-left:18px;color:#C9C5BC;font-size:13px;line-height:1.7}
.plan b{color:#F0C985}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>\n</helmet>`;
}

function motionHtml() {
  const conf = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const c = ['#D69E3A', '#5FD39B', '#5EB8B0', '#FF8A7A', '#FFF7E8'][i % 5]; return `<i style="background:${c};--x:${Math.round(Math.cos(a) * 120)}px;--y:${Math.round(Math.sin(a) * 80)}px;animation-delay:${(i % 3) * 0.05}s"></i>`; }).join('');
  return `<div class="mb">
<h1>3D &amp; motion — what we can add</h1>
<p>Live previews (these boxes are animating now). Motion is there to explain change — numbers arriving, a check-in being recorded — not to decorate. Everything respects “Reduce motion” in Preferences and the device setting.</p>
<div class="g">
  <div class="demo"><span class="tag">Numbers</span><h2>Count-up KPIs</h2><div class="stage"><div class="count" aria-label="493"></div></div><p>Dashboard numbers roll up from 0 when they first load or change. Pure CSS, no library.</p></div>
  <div class="demo"><span class="tag">Progress</span><h2>Rings &amp; bars that fill</h2><div class="stage"><svg class="rg" width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="9"/><circle class="v" cx="50" cy="50" r="40" fill="none" stroke="#D69E3A" stroke-width="9" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg></div><p>Today’s hours ring, leave meters and allocation bars ease to their value.</p></div>
  <div class="demo"><span class="tag g2">Celebrate</span><h2>Check-in moment</h2><div class="stage conf"><span class="cib">${icon('login', 18)}Check in</span>${conf}</div><p>A soft pulse invites the tap; a short burst confirms it. Same for “Leave approved” and kudos received.</p></div>
  <div class="demo"><span class="tag g3">3D</span><h2>Tilt + shine cards</h2><div class="stage"><div class="tc"><span style="font-size:12px;color:#A9A59C">Leave balance</span><b>36 days</b><span style="font-size:12px;color:#E8BD6E">Casual 9 · Sick 12 · Earned 15</span></div></div><p>Cards lean toward the pointer on hover with a light sweep. Desktop only, off on touch.</p></div>
  <div class="demo"><span class="tag g3">3D</span><h2>Rotating badge</h2><div class="stage"><div class="scene"><div class="cube"><div class="f1">AMIT</div><div class="f2">2 YRS</div><div class="f3">EMP-012</div><div class="f4">ENG</div><div class="f5"></div><div class="f6"></div></div></div></div><p>A 3D ID badge on My profile and for work anniversaries. CSS 3D transforms.</p></div>
  <div class="demo"><span class="tag g3">3D</span><h2>Isometric layers</h2><div class="stage"><div class="iso"><div class="l1"></div><div class="l2"></div><div class="l3">aakash</div></div></div><p>Org structure / plan tiers as floating layers — for empty states, onboarding and the login page.</p></div>
  <div class="demo"><span class="tag">Page</span><h2>Staggered entrance</h2><div class="stage"><div class="st">${Array.from({ length: 9 }, (_, i) => `<i style="animation-delay:${i * 70}ms"></i>`).join('')}</div></div><p>Cards rise in one after another (60 ms apart) when a page opens — feels fast, not flashy.</p></div>
  <div class="demo"><span class="tag">Loading</span><h2>Shimmer skeletons</h2><div class="stage"><div class="sk"><i style="width:60%"></i><i></i><i style="width:85%"></i><i style="width:40%"></i></div></div><p>Loading shapes match the real card, so nothing jumps when data arrives.</p></div>
  <div class="demo"><span class="tag g3">3D</span><h2>Live globe (Super Admin)</h2><div class="stage"><div class="globe"><b style="left:40%;top:38%"></b><b style="left:62%;top:55%;animation-delay:.6s"></b><b style="left:30%;top:62%;animation-delay:1.2s"></b></div></div><p>Tenants and live sign-ins as glowing points. A real WebGL globe (three.js) would load only on that page.</p></div>
</div>
<div class="plan">
  <div class="demo"><span class="tag">Plan</span><h2>How we’d build it</h2><ul>
    <li><b>Motion tokens</b> in the theme: fast 150 ms, base 240 ms, slow 600 ms; one easing curve.</li>
    <li><b>CSS first</b> (count-up, fills, shimmer, stagger, tilt, cube) — zero extra download.</li>
    <li><b>Framer Motion</b> (~35 kB) only for layout moves: cards re-ordering, list items leaving, page transitions.</li>
    <li><b>three.js / react-three-fiber</b> only for the Super Admin globe and the login hero — loaded on demand, never on employee pages.</li>
    <li>One switch: <b>Reduce motion</b> (already in Preferences) turns all of it off.</li></ul></div>
  <div class="demo"><span class="tag g2">Where</span><h2>Where it appears</h2><ul>
    <li>Homes: count-up KPIs, ring/bar fills, staggered cards</li>
    <li>Check-in, leave approved, kudos: celebration burst</li>
    <li>Leave &amp; profile: tilt cards, 3D badge</li>
    <li>Login &amp; empty states: isometric art</li>
    <li>Super Admin: live globe</li>
    <li>Everywhere: shimmer loading, smooth menu &amp; dialog transitions</li></ul></div>
  <div class="demo"><span class="tag g3">Guardrails</span><h2>Keeps it fast &amp; calm</h2><ul>
    <li>Animate only transform &amp; opacity (60 fps, no layout jank)</li>
    <li>Nothing loops on work pages except the check-in invite</li>
    <li>3D off on phones and low-power devices</li>
    <li>Page weight budget: +0 kB for CSS effects, 3D lazy-loaded</li>
    <li>Screen readers get the final value, not the animation</li></ul></div>
</div>
</div>`;
}

module.exports = { P, icon, balCss, bentoCss, helmetFonts, shellPage, dcPage, donut };
if (require.main !== module) return;
// ───────────────────────── write boards
const out = [
  ['BalEmployee', 'Balanced · Employee home (hero + two columns)', () => shellPage('Balanced employee home', 'employee', 'Home', light, false, 1560, balancedEmployee(light, false))],
  ['BalAdmin', 'Balanced · Company Admin / HR home', () => shellPage('Balanced admin home', 'admin', 'Home', light, false, 1500, balancedAdmin(light, false))],
  ['BalSuper', 'Balanced · Super Admin overview', () => shellPage('Balanced super admin', 'super', 'Platform', light, false, 1060, balancedSuper(light, false))],
  ['BalEmployeeDark', 'Balanced · Employee home (dark)', () => shellPage('Balanced employee home dark', 'employee', 'Home', dark, true, 1560, balancedEmployee(dark, true))],
  ['BentoEmployee', 'Concept B · “Bento” employee home — glass, 3D orb, motion', () => shellPage('Bento employee home', 'employee', 'Home', dark, true, 1180, bentoEmployee(dark), bentoCss(dark))],
  ['BentoAdmin', 'Concept B · “Bento” Company Admin home', () => shellPage('Bento admin home', 'admin', 'Home', dark, true, 1000, bentoAdmin(dark), bentoCss(dark))],
  ['Motion3D', '3D & motion — live previews and plan', () => dcPage('3D and motion', motionBoard(dark), motionHtml(), 1620)],
];
for (const [file, , fn] of out) fs.writeFileSync(`${dir}/project/${file}.dc.html`, fn());
console.log('built', out.map((o) => o[0]).join(', '));
