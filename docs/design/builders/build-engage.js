// Company app → Announcements and Kudos: feed, composer, detail + reach, kudos wall, recognition insights.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { sidebar: reportsSidebar, C } = require('./build-reports.js');
const { css: peopleCss, photo, initialsTile } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H6zM6 4h7a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  plus2: '<path d="M12 5v14M5 12h14"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
});

const sidebar = (on) => reportsSidebar().replace('class="sb-i on"', 'class="sb-i"').replace(new RegExp(`<div class="sb-i">(<svg(?:(?!<div)[^])*?</svg>)${on}</div>`), `<div class="sb-i on">$1${on}</div>`);
const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub, actions = '') => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>${actions}</div>`;

const CAT = {
  policy: ['Policy', '#4F46E5', '#EEF0FF', '📘'],
  event: ['Event', '#0D9488', '#E1F5F2', '📅'],
  celebrate: ['Celebration', '#DB2777', '#FDE8F1', '🎉'],
  update: ['Update', '#0284C7', '#E0F2FE', '📣'],
  urgent: ['Urgent', '#DC2626', '#FEE2E2', '⚠️'],
};
const cat = (k) => `<span class="pill" style="background:${CAT[k][2]};color:${CAT[k][1]}">${CAT[k][3]} ${CAT[k][0]}</span>`;

const css = peopleCss.replace('</style>', `
.hero{position:relative;border-radius:18px;overflow:hidden;color:#fff;min-height:200px;display:flex;align-items:flex-end;padding:22px 24px}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(17,24,39,.65))}
.hero > *{position:relative;z-index:1}
.ann{display:flex;gap:14px;padding:14px 16px;border-bottom:1px solid ${C.line};align-items:flex-start}.ann:last-child{border-bottom:0}
.ann .cv{width:86px;height:64px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;font-size:28px}
.ann.unread{background:linear-gradient(90deg,${C.priSoft},#fff 40%)}
.dot{width:8px;height:8px;border-radius:50%;background:${C.pri};flex:none;margin-top:6px}
.reac{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid ${C.border};background:#fff}
.reac.on{background:${C.priSoft};border-color:#C7C9F7;color:${C.priText}}
.tool{display:flex;gap:2px;padding:6px;border-bottom:1px solid ${C.line}}.tool span{width:30px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;color:#374151}.tool span.on{background:${C.line}}
.phone{width:250px;border:8px solid #111827;border-radius:30px;overflow:hidden;background:#F8F9FC;box-shadow:0 20px 40px -18px rgba(0,0,0,.45)}
.funnel{display:flex;flex-direction:column;gap:8px}.funnel div{height:36px;border-radius:9px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:12.5px;font-weight:700;color:#fff}
.kudo{border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;background:#fff;border:1px solid ${C.border};position:relative;overflow:hidden}
.kudo .band{position:absolute;left:0;top:0;bottom:0;width:5px}
.val{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;border:1.5px solid ${C.border};font-size:12px}
.val.on{box-shadow:0 0 0 3px rgba(79,70,229,.15)}
.lb{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid ${C.line};font-size:13px}.lb:last-child{border-bottom:0}
.lb .n{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:${C.line}}
.heat{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.heat span{height:26px;border-radius:6px}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px}
</style>`);

const reac = (list, on = 0) => list.map(([e, n], i) => `<span class="reac ${i === on ? 'on' : ''}">${e} ${n}</span>`).join('');

// ─── Board 1: announcements feed ────────────────────────────
function feed() {
  const items = [
    ['policy', 'Updated leave policy for 2027', 'Earned leave now carries forward up to 10 days. Read the summary and confirm by 20 Oct.', 'Hema Iyer', 2, '2 h ago', true, true, [['👍', 14], ['🙏', 6]], '4 min read', true],
    ['event', 'Diwali celebration — Friday 4 pm, cafeteria', 'Sweets, rangoli contest and a team photo. Families welcome after 6 pm.', 'Hema Iyer', 2, 'Yesterday', true, false, [['🎉', 21], ['❤️', 9]], '1 min read', false],
    ['update', 'New laptops arriving for the Design team', 'IT will swap machines on Wednesday; back up anything stored locally before 10 am.', 'Rohit Singh', 10, '2 days ago', false, false, [['👍', 5]], '1 min read', false],
    ['celebrate', 'Welcome Farah Ali to Legal 👋', 'Farah joins us on 2 Nov from a corporate law firm. Say hello when you see her!', 'Vikram Rao', 5, '3 days ago', false, false, [['👋', 18], ['🎉', 7]], '30 sec read', false],
  ];
  const html = `<div class="app">${sidebar('Announcements')}<div class="col">${header('Engagement &nbsp;›&nbsp; <b>Announcements</b>')}<main class="main">
${top('Engagement', 'Announcements', 'News from HR and leadership — what you need to read and confirm', `<span class="btn pri">${icon('plus2', 14)}New announcement</span>`)}
<div class="g21" style="grid-template-columns:1fr 320px">
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="hero" style="background:radial-gradient(circle at 85% 10%,#F59E0B 0,transparent 40%),linear-gradient(120deg,#4F46E5,#7C3AED 55%,#DB2777)">
      <div style="position:absolute;right:26px;top:18px;font-size:74px;z-index:1">🪔</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:560px">
        <div class="row" style="gap:6px"><span class="pill" style="background:rgba(255,255,255,.2);color:#fff">${icon('pin', 12)} Pinned</span><span class="pill" style="background:rgba(255,255,255,.2);color:#fff">📅 Event · Fri 4 pm</span></div>
        <b style="font-size:24px;line-height:1.2">Diwali celebration — Friday 4 pm, cafeteria</b>
        <span style="font-size:13.5px;opacity:.9">Sweets, rangoli contest and a team photo. Families welcome after 6 pm.</span>
        <div class="row" style="gap:8px;margin-top:4px"><span class="btn sm" style="background:#fff;border:0">✓ I’ll be there · 34</span><span class="btn sm" style="background:rgba(255,255,255,.18);border:0;color:#fff">Maybe</span><span class="xs" style="opacity:.85">${reac([['🎉', 21], ['❤️', 9]], -1).replace(/class="reac /g, 'style="background:rgba(255,255,255,.18);border:0;color:#fff" class="reac ')}</span></div>
      </div>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip on">All</span><span class="chip">Unread · 2</span><span class="chip">${icon('check', 13)} To confirm · 1</span><span style="width:1px;height:22px;background:${C.border}"></span>${Object.keys(CAT).map((k) => `<span class="chip">${CAT[k][3]} ${CAT[k][0]}</span>`).join('')}<div class="search" style="height:34px;flex:0 0 200px;margin-left:auto;font-size:12.5px">${icon('search', 13)} Search</div></div>
    <div class="card" style="overflow:hidden">${items.map(([k, t, b, who, pi, when, unread, ack, rs, read, att]) => `<div class="ann ${unread ? 'unread' : ''}">
      <span class="cv" style="background:${CAT[k][2]}">${CAT[k][3]}</span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <div class="row" style="gap:6px;flex-wrap:wrap">${cat(k)}${ack ? `<span class="pill p-warn">Please confirm · by 20 Oct</span>` : ''}${att ? `<span class="xs mut row" style="gap:3px">${icon('clip', 12)} policy.pdf</span>` : ''}</div>
        <b style="font-size:14.5px">${t}</b><span class="xs mut" style="font-size:12.5px">${b}</span>
        <div class="row xs mut" style="gap:8px">${photo(pi, 20, 20, { round: true })}<span>${who} · ${when} · ${read}</span><span style="margin-left:auto" class="row">${reac(rs, -1)}<span class="reac">${icon('smile', 12)}</span></span></div>
      </div>${unread ? '<span class="dot"></span>' : ''}</div>`).join('')}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec" style="border-color:#FCD9A8;background:linear-gradient(180deg,#FFF7ED,#fff)"><h3>${icon('check', 15)}Needs your confirmation</h3>
      <div class="row" style="gap:10px"><span style="font-size:24px">📘</span><div style="flex:1"><b style="font-size:13px">Updated leave policy for 2027</b><div class="xs mut">Due 20 Oct · 15 days left</div></div></div>
      <span class="btn pri sm" style="align-self:flex-start">Read &amp; confirm</span></div>
    <div class="card sec"><h3>${icon('calcheck', 15)}Coming up</h3>
      ${[['FRI', '9', 'Diwali celebration', '4 pm · Cafeteria · 34 going'], ['WED', '14', 'Laptop swap — Design', '10 am · IT desk'], ['MON', '2', 'Farah Ali joins Legal', 'Say hello 👋']].map(([d, n, t, s]) => `<div class="row" style="gap:10px"><div style="width:42px;border-radius:10px;border:1px solid ${C.border};text-align:center;padding:3px 0"><div class="xs" style="color:${C.bad};font-weight:800;font-size:10px">${d}</div><b style="font-size:16px">${n}</b></div><div><b style="font-size:13px">${t}</b><div class="xs mut">${s}</div></div></div>`).join('')}</div>
    <div class="card sec"><h3>${icon('chart', 15)}Your posts this month<span class="r">HR only</span></h3>
      <div class="row" style="gap:18px">${[['Posts', '6'], ['Avg. read', '82%'], ['Confirmed', '61%']].map(([l, v]) => `<div><div class="xs mut">${l}</div><b style="font-size:19px">${v}</b></div>`).join('')}</div>
      <div class="xs mut">“Leave policy 2027” — 9 people haven’t confirmed yet. <b style="color:${C.pri}">Nudge them</b></div></div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Announcements feed', css, html, 1180);
}

// ─── Board 2: composer ──────────────────────────────────────
function compose() {
  const html = `<div class="app">${sidebar('Announcements')}<div class="col">${header('Engagement &nbsp;›&nbsp; Announcements &nbsp;›&nbsp; <b>New</b>')}<main class="main">
${top('Engagement', 'New announcement', 'Write once — it goes to the right people in-app, and by email if you choose', `<span class="btn">Save draft</span><span class="btn">${icon('clock', 14)}Schedule</span><span class="btn pri">${icon('send', 14)}Publish to 18 people</span>`)}
<div class="g21" style="grid-template-columns:1fr 340px">
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec">
      <div class="fld"><label>Type</label><div class="row" style="gap:8px;flex-wrap:wrap">${Object.keys(CAT).map((k, i) => `<span class="chip ${i === 0 ? 'on' : ''}">${CAT[k][3]} ${CAT[k][0]}</span>`).join('')}</div></div>
      <div class="fld"><label>Cover</label><div class="row" style="gap:8px">${['linear-gradient(120deg,#4F46E5,#7C3AED)', 'linear-gradient(120deg,#0D9488,#22C55E)', 'linear-gradient(120deg,#F59E0B,#DB2777)', 'linear-gradient(120deg,#0284C7,#6366F1)'].map((g, i) => `<span style="width:64px;height:40px;border-radius:9px;background:${g};${i === 0 ? `box-shadow:0 0 0 3px #fff,0 0 0 5px ${C.pri}` : ''};display:flex;align-items:center;justify-content:center;font-size:18px">${['📘', '🌿', '🎉', '📣'][i]}</span>`).join('')}<span class="chip" style="height:40px">${icon('image', 14)} Upload image</span></div></div>
      <div class="fld"><label>Title</label><div class="inp" style="font-size:15px;font-weight:700">Updated leave policy for 2027</div></div>
      <div class="fld"><label>Message</label>
        <div style="border:1px solid ${C.border};border-radius:10px;overflow:hidden">
          <div class="tool"><span class="on">${icon('bold', 14)}</span><span>${icon('italic', 14)}</span><span>${icon('list', 14)}</span><span>${icon('link', 14)}</span><span style="margin-left:auto;width:auto;padding:0 8px;font-size:11.5px;font-weight:700;color:${C.muted}">${icon('sparkle', 13)} Make it shorter</span></div>
          <div style="padding:12px 14px;font-size:13.5px;line-height:1.6;min-height:150px">From 1 Jan 2027:<br>• <b>Earned leave</b> carries forward up to <b>10 days</b> (was 5)<br>• Sick leave can be taken in half days<br>• WFH requests need 1 day’s notice<br><br>The full policy is attached. Please read and confirm by <b>20 Oct</b>.</div>
        </div></div>
      <div class="row" style="gap:10px;padding:10px 12px;border:1px dashed ${C.border};border-radius:10px">${icon('clip', 15)}<b style="font-size:13px">leave-policy-2027.pdf</b><span class="xs mut">412 KB</span><span class="xs" style="margin-left:auto;color:${C.bad};font-weight:700">Remove</span></div>
    </div>
    <div class="card sec"><h3>${icon('users', 15)}Who gets it</h3>
      <div class="row" style="gap:8px"><span class="chip">Everyone</span><span class="chip on">${icon('building', 13)} Departments</span><span class="chip">${icon('pin', 13)} Locations</span></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${['Engineering', 'Data', 'Quality', 'Design'].map((d) => `<span class="tag" style="background:${C.priSoft};border-color:#C7C9F7;color:${C.priText}">${d} ✕</span>`).join('')}<span class="tag">+ Add</span></div>
      <div class="row" style="gap:10px;padding:10px 12px;background:${C.raised};border-radius:10px"><div class="stack">${[0, 1, 3, 4, 9].map((i) => photo(i, 26, 26, { round: true })).join('')}</div><span style="font-size:13px"><b>18 people</b> will see this · 12 get it by email</span></div>
    </div>
    <div class="card sec"><h3>${icon('sliders', 15)}Options</h3>
      ${[['Pin to the top', 'Stays first in everyone’s feed until you unpin it', true], ['Ask people to confirm they’ve read it', 'Due by <b>20 Oct</b> · reminder 2 days before to anyone who hasn’t', true], ['Also send by email', 'In-app is always on', true], ['Allow reactions', '👍 ❤️ 🎉 🙏 — no comments', true], ['Expires', '31 Dec 2026 · then moves to the archive', false]].map(([t, d, on]) => `<div class="row" style="gap:12px;padding:6px 0"><span style="width:34px;height:20px;border-radius:99px;background:${on ? C.pri : '#D1D5DB'};position:relative;flex:none"><i style="position:absolute;top:2px;${on ? 'right' : 'left'}:2px;width:16px;height:16px;border-radius:50%;background:#fff"></i></span><div><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div></div>`).join('')}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px;align-items:center">
    <div class="seg" style="align-self:stretch;justify-content:center"><span class="on">${icon('phone', 12)} In the app</span><span>${icon('mail', 12)} Email</span></div>
    <div class="phone">
      <div style="height:110px;background:linear-gradient(120deg,#4F46E5,#7C3AED);display:flex;align-items:center;justify-content:center;font-size:44px">📘</div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px;background:#fff">
        <div class="row" style="gap:5px">${cat('policy')}<span class="pill p-warn" style="font-size:10px">Confirm by 20 Oct</span></div>
        <b style="font-size:14px;line-height:1.3">Updated leave policy for 2027</b>
        <div style="font-size:11.5px;color:#374151;line-height:1.5">From 1 Jan 2027:<br>• <b>Earned leave</b> carries forward up to 10 days…</div>
        <div class="row xs mut" style="gap:6px">${photo(2, 18, 18, { round: true })}Hema Iyer · just now</div>
        <span class="btn pri sm" style="justify-content:center">✓ I have read this</span>
      </div>
    </div>
    <div class="xs mut" style="text-align:center">Scheduled? It publishes at the time you pick, in the company’s time zone.</div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Announcement composer', css, html, 1180);
}

// ─── Board 3: detail + reach ────────────────────────────────
function detail() {
  const depts = [['Engineering', 9, 8, 6], ['Data', 3, 3, 2], ['Quality', 4, 3, 2], ['Design', 2, 1, 1]];
  const html = `<div class="app">${sidebar('Announcements')}<div class="col">${header('Engagement &nbsp;›&nbsp; Announcements &nbsp;›&nbsp; <b>Updated leave policy</b>')}<main class="main">
<div class="g21" style="grid-template-columns:1fr 360px">
  <div class="card" style="overflow:hidden">
    <div style="height:150px;background:linear-gradient(120deg,#4F46E5,#7C3AED);display:flex;align-items:center;justify-content:center;font-size:60px;position:relative">📘<span class="pill" style="position:absolute;left:18px;top:16px;background:rgba(255,255,255,.2);color:#fff">${icon('pin', 12)} Pinned</span></div>
    <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
      <div class="row" style="gap:6px">${cat('policy')}<span class="pill p-warn">Please confirm by 20 Oct</span></div>
      <b style="font-size:24px;line-height:1.25">Updated leave policy for 2027</b>
      <div class="row xs mut" style="gap:8px">${photo(2, 26, 26, { round: true })}<span><b style="color:${C.fg}">Hema Iyer</b> · HR Manager · 2 h ago · Engineering, Data, Quality, Design</span></div>
      <div style="font-size:14px;line-height:1.7;color:#1F2937">From 1 Jan 2027:<br>• <b>Earned leave</b> carries forward up to <b>10 days</b> (was 5)<br>• Sick leave can be taken in half days<br>• WFH requests need 1 day’s notice<br><br>The full policy is attached. Please read and confirm by <b>20 Oct</b>.</div>
      <div class="row" style="gap:10px;padding:10px 12px;border:1px solid ${C.border};border-radius:10px">${icon('file', 16)}<b style="font-size:13px">leave-policy-2027.pdf</b><span class="xs mut">412 KB</span><span class="btn sm" style="margin-left:auto">${icon('dl', 13)} Download</span></div>
      <div class="row" style="gap:6px">${reac([['👍', 14], ['🙏', 6], ['❤️', 2]])}<span class="reac">${icon('smile', 12)}</span></div>
      <div style="padding:14px;border-radius:12px;background:${C.warnSoft};display:flex;align-items:center;gap:12px"><span style="font-size:22px">✍️</span><div style="flex:1"><b style="font-size:13.5px">HR asked you to confirm you’ve read this</b><div class="xs mut">15 days left</div></div><span class="btn pri">✓ I have read this</span></div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec"><h3>${icon('eye', 15)}Reach<span class="r">only you and HR see this</span></h3>
      <div class="funnel">
        <div style="background:#6366F1;width:100%"><span>Delivered</span><span>18</span></div>
        <div style="background:#818CF8;width:83%"><span>Opened</span><span>15 · 83%</span></div>
        <div style="background:#A5B4FC;width:61%;color:#1E1B4B"><span>Confirmed</span><span>11 · 61%</span></div>
      </div>
      <div class="xs mut">Emailed to 12 · 9 opened the email</div>
    </div>
    <div class="card sec"><h3>${icon('building', 15)}By department</h3>
      ${depts.map(([d, n, r, c]) => `<div><div class="row xs"><b style="flex:1;font-size:12.5px">${d}</b><span class="mut">${c}/${n} confirmed</span></div><div class="bar" style="margin-top:4px;height:7px;display:flex"><i style="width:${(c / n) * 100}%;background:${C.ok}"></i><i style="width:${((r - c) / n) * 100}%;background:#A5B4FC;border-radius:0"></i></div></div>`).join('')}
      <div class="row xs mut" style="gap:12px"><span><span class="sw" style="background:${C.ok}"></span> Confirmed</span><span><span class="sw" style="background:#A5B4FC"></span> Opened only</span><span><span class="sw" style="background:${C.line}"></span> Not opened</span></div>
    </div>
    <div class="card sec"><h3>${icon('alert', 15)}Not confirmed yet<span class="r">7 people</span></h3>
      ${[[1, 'Rahul Das', 'Opened 1 h ago'], [3, 'Karan Mehta', 'Not opened'], [11, 'Dev Menon', 'Not opened'], [4, 'Sameer Gill', 'Opened yesterday']].map(([pi, n, s]) => `<div class="row" style="gap:10px">${photo(pi, 30, 30, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${s}</div></div></div>`).join('')}
      <div class="row"><span class="btn pri sm">${icon('bell', 13)} Nudge all 7</span><span class="btn sm">${icon('dl', 13)} Export</span></div>
      <div class="xs mut">A nudge goes once a day at most. Automatic reminder on 18 Oct.</div>
    </div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Announcement detail & reach', css, html, 1180);
}

// ─── Board 4: kudos wall ────────────────────────────────────
function kudos() {
  const VALS = [['🚀', 'Ownership', '#4F46E5'], ['🤝', 'Teamwork', '#0D9488'], ['💡', 'Innovation', '#F59E0B'], ['❤️', 'Customer first', '#DB2777']];
  const posts = [
    [2, 'Hema Iyer', [[0, 'Priya Sharma'], [3, 'Karan Mehta']], 1, 'Stayed late to get the payroll export fixed before the 30th — the whole company got paid on time because of you two.', '2 h ago', [['👏', 12], ['🙌', 5]], 6],
    [9, 'Ravi Kumar', [[1, 'Rahul Das']], 0, 'Found the release-blocking bug in the leave flow during your first month. Brilliant attention to detail!', 'Yesterday', [['🔥', 8], ['👏', 3]], 3],
    [7, 'Ananya Bose', [[8, 'Meena Joshi']], 3, 'Turned an angry customer call into a renewal. Calm, kind and clear the whole time.', '3 days ago', [['❤️', 15]], 9],
  ];
  const html = `<div class="app">${sidebar('Kudos')}<div class="col">${header('Engagement &nbsp;›&nbsp; <b>Kudos</b>')}<main class="main">
${top('Engagement', 'Kudos', 'Say thank you in public — tag a company value so it counts', `<span class="btn">${icon('sparkle', 14)}Company values</span>`)}
<div class="g21" style="grid-template-columns:1fr 320px">
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec" style="gap:14px">
      <div class="row" style="gap:10px">${photo(6, 36, 36, { round: true })}<div class="inp" style="flex:1;height:40px;gap:6px"><span class="tag" style="background:${C.priSoft};border-color:#C7C9F7;color:${C.priText}">${photo(11, 16, 16, { round: true })} Dev Menon ✕</span><span class="mut">Add more people…</span></div></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${VALS.map(([e, n, c], i) => `<div class="val ${i === 2 ? 'on' : ''}" style="${i === 2 ? `border-color:${c};background:${c}12` : ''}"><span style="font-size:20px">${e}</span><b style="font-size:12.5px;color:${i === 2 ? c : C.fg}">${n}</b></div>`).join('')}</div>
      <div class="inp" style="height:auto;min-height:70px;align-items:flex-start;padding:10px 12px;line-height:1.5">Automated the night-shift rota — saved the ops team hours every week 🙌</div>
      <div class="row xs mut" style="gap:6px">Need words? ${['Thanks for going the extra mile on…', 'You made it easy for us to…', 'Shout-out for…'].map((s) => `<span class="tag">${s}</span>`).join('')}</div>
      <div class="row"><span class="xs mut">Posted on the wall · Dev and his manager are told</span><span class="btn pri" style="margin-left:auto">${icon('heart', 14)} Send kudos</span></div>
    </div>
    <div class="row" style="gap:8px"><span class="chip on">Everyone</span><span class="chip">For me · 4</span><span class="chip">From me</span><span class="chip">My team</span><span style="width:1px;height:22px;background:${C.border}"></span>${VALS.map(([e, n]) => `<span class="chip">${e} ${n}</span>`).join('')}</div>
    ${posts.map(([fp, fn, to, vi, msg, when, rs, plus]) => { const [e, n, c] = VALS[vi]; return `<div class="kudo"><span class="band" style="background:${c}"></span>
      <div class="row" style="gap:12px;align-items:flex-start">
        <div class="stack">${to.map(([pi]) => photo(pi, 54, 54, { round: true })).join('')}</div>
        <div style="flex:1;min-width:0"><div style="font-size:14px"><b>${to.map((t) => t[1]).join(' & ')}</b></div>
          <div class="xs mut row" style="gap:6px;margin-top:2px">from ${photo(fp, 16, 16, { round: true })} <b style="color:${C.fg}">${fn}</b> · ${when}</div></div>
        <span class="pill" style="background:${c}18;color:${c}">${e} ${n}</span>
      </div>
      <div style="font-size:14px;line-height:1.55;color:#1F2937;padding-left:2px">“${msg}”</div>
      <div class="row" style="gap:6px">${reac(rs, vi === 1 ? 0 : -1)}<span class="reac">${icon('smile', 12)}</span><span class="xs mut" style="margin-left:auto">${icon('plus2', 12)} <b style="color:${C.pri}">Add my thanks</b> · ${plus} people agreed</span></div>
    </div>`; }).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card sec" style="background:linear-gradient(160deg,#FFF7ED,#fff 60%)"><h3>${icon('trophy', 15)}Most thanked · October</h3>
      ${[[0, 'Priya Sharma', 7, '🚀'], [8, 'Meena Joshi', 5, '❤️'], [1, 'Rahul Das', 4, '💡'], [3, 'Karan Mehta', 4, '🤝']].map(([pi, n, k, e], i) => `<div class="lb"><span class="n" style="${i === 0 ? 'background:#FCD34D' : i === 1 ? 'background:#E5E7EB' : i === 2 ? 'background:#FDBA74' : ''}">${i + 1}</span>${photo(pi, 30, 30, { round: true })}<b style="flex:1">${n}</b><span class="mut">${e} ${k}</span></div>`).join('')}
    </div>
    <div class="card sec"><h3>${icon('heart', 15)}Your kudos</h3>
      <div class="row" style="gap:18px">${[['Received', '12'], ['Given', '9'], ['This month', '3']].map(([l, v]) => `<div><div class="xs mut">${l}</div><b style="font-size:19px">${v}</b></div>`).join('')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${VALS.map(([e, n, c], i) => `<span class="pill" style="background:${c}18;color:${c}">${e} ${[5, 4, 2, 1][i]}</span>`).join('')}</div>
      <div class="xs mut">Your badges show on your profile and People card.</div></div>
    <div class="card sec"><h3>${icon('sparkle', 15)}Someone to thank?</h3>
      ${[[4, 'Sameer Gill', 'Closed 14 tickets this week'], [11, 'Dev Menon', 'Joined 2 weeks ago'], [5, 'Arjun Nair', 'Finished the design system']].map(([pi, n, s]) => `<div class="row" style="gap:10px">${photo(pi, 30, 30, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${s}</div></div><span class="btn sm">${icon('heart', 12)}</span></div>`).join('')}
    </div>
  </div>
</div>
</main></div></div>`;
  return dcPage('Kudos wall', css, html, 1180);
}

// ─── Board 5: recognition insights (HR) ─────────────────────
function insights() {
  const months = [['May', 18], ['Jun', 24], ['Jul', 21], ['Aug', 30], ['Sep', 27], ['Oct', 34]];
  const max = 34;
  const depts = ['Engineering', 'Sales', 'HR', 'Design', 'Quality'];
  const heat = [[5, 3, 4, 2, 4], [2, 4, 1, 1, 2], [3, 1, 2, 0, 1], [1, 1, 0, 2, 1], [2, 2, 1, 1, 0]];
  const html = `<div class="app">${sidebar('Kudos')}<div class="col">${header('Engagement &nbsp;›&nbsp; Kudos &nbsp;›&nbsp; <b>Insights</b>')}<main class="main">
${top('Engagement', 'Recognition insights', 'Who is being thanked, for what, and who might be missed — HR only', `<div class="seg"><span>30 days</span><span class="on">6 months</span><span>Year</span></div><span class="btn">${icon('dl', 14)}Export</span>`)}
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${[['Kudos sent', '154', '+26% vs previous', C.ok], ['People thanked', '19 of 22', '86% of the company', C.ok], ['People giving', '14', '64% gave at least once', C.warn], ['Not thanked · 90 days', '3', 'see below', C.bad]].map(([l, v, s, c]) => `<div class="card sec" style="gap:4px"><div class="xs mut">${l}</div><b style="font-size:24px">${v}</b><div class="xs" style="color:${c};font-weight:700">${s}</div></div>`).join('')}</div>
<div class="g2">
  <div class="card sec"><h3>${icon('chart', 15)}Kudos per month</h3>
    <div class="row" style="align-items:flex-end;gap:14px;height:150px">${months.map(([m, n]) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end"><b class="xs">${n}</b><div style="width:100%;height:${(n / max) * 100}%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#818CF8,#4F46E5)"></div><span class="xs mut">${m}</span></div>`).join('')}</div></div>
  <div class="card sec"><h3>${icon('sparkle', 15)}Values people are thanked for</h3>
    ${[['🚀 Ownership', 48, '#4F46E5'], ['🤝 Teamwork', 61, '#0D9488'], ['💡 Innovation', 22, '#F59E0B'], ['❤️ Customer first', 17, '#DB2777'], ['No value tagged', 6, '#9CA3AF']].map(([l, n, c]) => `<div><div class="row xs"><b style="flex:1;font-size:12.5px">${l}</b><span class="mut">${n} · ${Math.round((n / 154) * 100)}%</span></div><div class="bar" style="margin-top:4px;height:8px"><i style="width:${(n / 61) * 100}%;background:${c}"></i></div></div>`).join('')}
    <div class="xs mut">💡 Innovation is rarely recognised — maybe highlight it in the next all-hands.</div></div>
</div>
<div class="g2">
  <div class="card sec"><h3>${icon('network', 15)}Who thanks whom<span class="r">rows give · columns receive</span></h3>
    <div style="display:grid;grid-template-columns:90px 1fr;gap:6px;align-items:center">
      <span></span><div class="heat">${depts.map((d) => `<span class="xs mut" style="height:auto;text-align:center;font-size:10.5px">${d.slice(0, 5)}</span>`).join('')}</div>
      ${depts.map((d, r) => `<span class="xs" style="font-weight:700">${d}</span><div class="heat">${heat[r].map((n) => `<span style="background:rgba(79,70,229,${0.08 + n * 0.17});display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${n > 2 ? '#fff' : C.priText}">${n || ''}</span>`).join('')}</div>`).join('')}
    </div>
    <div class="xs mut">Most kudos stay inside a team. Design ↔ Sales never thanked each other.</div></div>
  <div class="card sec"><h3>${icon('alert', 15)}Not thanked in 90 days<span class="r">private to HR</span></h3>
    ${[[11, 'Dev Menon', 'DevOps · joined 2 weeks ago', 'New — say welcome'], [4, 'Sameer Gill', 'Quality · 1 yr', 'Last kudos 5 months ago'], [10, 'Tanvi Shah', 'Quality · 2 yrs', 'Never received one']].map(([pi, n, s, why]) => `<div class="row" style="gap:10px">${photo(pi, 34, 34, { round: true })}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="xs mut">${s}</div></div><span class="pill p-neu">${why}</span></div>`).join('')}
    <div class="row"><span class="btn sm">${icon('mail', 13)} Hint their managers</span></div>
    <div class="xs mut">Managers get a gentle note — never a list of names on the wall.</div></div>
</div>
</main></div></div>`;
  return dcPage('Recognition insights', css, html, 1180);
}

const boards = [
  ['CAAnnouncements.dc.html', 'Company · Announcements — pinned hero, types, unread / to-confirm, coming-up events, poster stats', feed],
  ['CAAnnounceCompose.dc.html', 'Company · New announcement — type, cover, rich text, audience count, confirm-by date, schedule, phone preview', compose],
  ['CAAnnounceDetail.dc.html', 'Company · Announcement detail — reactions, confirm, reach funnel, by department, nudge people', detail],
  ['CAKudos.dc.html', 'Company · Kudos — composer with values, filters, add-my-thanks, most thanked, your badges', kudos],
  ['CAKudosInsights.dc.html', 'Company · Recognition insights (HR) — trend, values, who thanks whom, not thanked in 90 days', insights],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title], i) => {
  canvas.boards[f] = { expand: 'fill', h: 1180, title, w: 1440, x: i * 1520, y: 18900 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n11 = { kind: 'title1', maxW: 7600, text: 'Company · Announcements & Kudos — feed, composer, reach, kudos wall, recognition insights', w: 240, x: 0, y: 18600 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
