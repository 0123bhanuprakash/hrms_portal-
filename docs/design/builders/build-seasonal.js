// Company app → Settings → Theme → Seasonal themes: plan the year, make one, what employees see,
// rules, animation ideas. Lives as a tab on the Theme page (no new sidebar item).
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { C } = require('./build-reports.js');
const { note, NEW, av } = require('./build-admin.js');
const { css: setCss, page, top, logo, sw, tog, B } = require('./build-settings.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

Object.assign(P, {
  sparkle2: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  pin: '<path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
});

// Ready-made seasons (India first, then common ones)
const SEASONS = [
  { k: 'newyear', e: '🎆', n: 'New Year', when: '31 Dec – 1 Jan', m: [11, 30, 11, 30], c: ['#4F46E5', '#DB2777', '#F59E0B'], deco: 'One burst of fireworks' },
  { k: 'sankranti', e: '🪁', n: 'Sankranti · Pongal · Lohri', when: '13 – 15 Jan', m: [0, 12, 0, 14], c: ['#F59E0B', '#0EA5E9', '#16A34A'], deco: 'Kites floating in the corner' },
  { k: 'republic', e: '🎖️', n: 'Republic Day', when: '26 Jan', m: [0, 25, 0, 25], c: ['#F97316', '#FFFFFF', '#16A34A'], deco: 'Tricolour ribbon', on: true },
  { k: 'holi', e: '🌸', n: 'Holi', when: '3 – 4 Mar', m: [2, 2, 2, 3], c: ['#DB2777', '#7C3AED', '#22C55E'], deco: 'Colour splashes', on: true },
  { k: 'eid', e: '🌙', n: 'Eid', when: '20 – 21 Mar', m: [2, 19, 2, 20], c: ['#0F766E', '#FBBF24', '#134E4A'], deco: 'Crescent and lanterns' },
  { k: 'independence', e: '🕊️', n: 'Independence Day', when: '15 Aug', m: [7, 14, 7, 14], c: ['#F97316', '#FFFFFF', '#16A34A'], deco: 'Tricolour ribbon, doves', on: true },
  { k: 'ganesh', e: '🐘', n: 'Ganesh Chaturthi', when: '14 – 15 Sep', m: [8, 13, 8, 14], c: ['#EA580C', '#FACC15', '#B91C1C'], deco: 'Marigold garland' },
  { k: 'gandhi', e: '👓', n: 'Gandhi Jayanti', when: '2 Oct', m: [9, 1, 9, 1], c: ['#78716C', '#FAFAF9', '#16A34A'], deco: 'Calm — a quote, no motion' },
  { k: 'navratri', e: '💃', n: 'Navratri · Dussehra', when: '11 – 20 Oct', m: [9, 10, 9, 19], c: ['#C026D3', '#F59E0B', '#DC2626'], deco: 'Dandiya sticks, festive lights' },
  { k: 'diwali', e: '🪔', n: 'Diwali glow', when: '2 – 8 Nov', m: [10, 1, 10, 7], c: ['#EA580C', '#F59E0B', '#7C2D12'], deco: 'Diyas in the corner, warm glow', on: true },
  { k: 'xmas', e: '🎄', n: 'Christmas · Year end', when: '22 – 30 Dec', m: [11, 21, 11, 29], c: ['#B91C1C', '#15803D', '#F5F5F4'], deco: 'Light snow, tiny stars', on: true },
  { k: 'anniv', e: '🎉', n: 'Company birthday', when: '12 Apr', m: [3, 11, 3, 11], c: [B.a, B.b, B.c], deco: 'Confetti, “10 years of Aakash”', own: true },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dayOfYear = (m, d) => DAYS.slice(0, m).reduce((a, b) => a + b, 0) + d;
const grad = (c) => `linear-gradient(135deg,${c[0]},${c[1]} 60%,${c[2]})`;

const css = setCss.replace('</style>', `
.season{border-radius:14px;border:1px solid ${C.border};background:#fff;overflow:hidden;display:flex;flex-direction:column}
.season .hero{height:74px;position:relative;display:flex;align-items:flex-end;padding:8px 10px;font-size:26px}
.yr{position:relative;height:64px;border-radius:12px;background:${C.raised};border:1px solid ${C.border}}
.yr .mo{position:absolute;top:0;bottom:0;border-left:1px dashed ${C.border};font-size:9.5px;color:${C.muted};padding:3px 4px}
.yr .blk{position:absolute;top:24px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 10px #0002;min-width:22px}
@keyframes flick{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15) translateY(-1px);opacity:.75}}
.flick{display:inline-block;animation:flick 1.4s ease-in-out infinite;transform-origin:bottom}
@keyframes snow{from{transform:translateY(-10px)}to{transform:translateY(140px)}}
.snow i{position:absolute;top:0;width:5px;height:5px;border-radius:50%;background:#fff;animation:snow 4s linear infinite}
@keyframes petal{0%{transform:translate(0,-10px) rotate(0)}100%{transform:translate(30px,140px) rotate(300deg)}}
@keyframes splash{0%{transform:scale(0);opacity:.9}70%{opacity:.6}100%{transform:scale(1.6);opacity:0}}
@keyframes draw{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}
@keyframes fadein{0%,30%{background:#4F46E5}70%,100%{background:#EA580C}}
@keyframes ribbon{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@keyframes kite{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(14px,-10px) rotate(8deg)}}
</style>`);

// ─── 1 · Seasonal tab: plan the year ─────────────────────────
function seasonsTab() {
  const html = page('Theme', `
${top('Theme', 'Your company’s look.', `<span class="pill p-neu">${icon('lock', 11)} Manage seasonal themes ${NEW}</span><span class="btn pri" style="margin-left:8px">${icon('plus', 13)}Add a season</span>`)}
<div class="row" style="gap:6px"><span class="seg2"><span>Look &amp; colours</span><span class="on">🎉 Seasonal ${NEW}</span><span>What employees can change</span></span></div>
<div class="card sec2"><div class="row"><b style="font-size:14px;flex:1">Your year</b><span class="xs mut">Each season switches on at midnight and back to your normal theme by itself.</span></div>
  <div class="yr">
    ${MONTHS.map((m, i) => `<span class="mo" style="left:${(dayOfYear(i, 0) / 365) * 100}%">${m}</span>`).join('')}
    ${SEASONS.filter((s) => s.on || s.own || s.k === 'republic').map((s) => { const a = dayOfYear(s.m[0], s.m[1]), b = s.m[2] < s.m[0] ? 365 : dayOfYear(s.m[2], s.m[3]) + 1; return `<span class="blk" title="${s.n}" style="left:${(a / 365) * 100}%;width:${Math.max(1.6, ((b - a) / 365) * 100)}%;background:${grad(s.c)}">${s.e}</span>`; }).join('')}
    <span style="position:absolute;top:0;bottom:0;left:${(dayOfYear(9, 6) / 365) * 100}%;width:2px;background:${C.bad}"><b style="position:absolute;bottom:-16px;left:-14px;font-size:9.5px;color:${C.bad}">Today</b></span>
  </div>
  <div class="alertrow" style="background:linear-gradient(90deg,#FFF7ED,#FEF3C7);margin-top:10px">${icon('sparkle', 15)}<span style="flex:1"><b>Diwali is on your holiday list (5 Nov).</b> Turn on “Diwali glow” for 2 – 8 Nov? ${NEW}</span><span class="btn sm">Not this year</span><span class="btn sm pri">Turn on</span></div>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px" class="stg">
  ${SEASONS.map((s) => `<div class="season" style="${s.on ? `box-shadow:0 0 0 2px ${C.pri}` : ''}">
    <div class="hero" style="background:${grad(s.c)}"><span${s.k === 'diwali' ? ' class="flick"' : ''}>${s.e}</span>${s.on ? '<span class="pill p-ok" style="position:absolute;right:8px;top:8px">On</span>' : ''}${s.own ? '<span class="pill p-pri" style="position:absolute;right:8px;top:8px">Your own</span>' : ''}</div>
    <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
      <div class="row"><b style="font-size:13px;flex:1">${s.n}</b><span class="xs mut">${s.when}</span></div>
      <div class="xs mut">${s.deco}</div>
      <div class="row" style="gap:4px">${s.c.map((c) => sw(c, 16)).join('')}</div>
      <div class="row" style="gap:6px;margin-top:4px"><span class="btn sm" style="flex:1;justify-content:center">${icon('eye', 12)}Preview</span>${s.on ? `<span class="btn sm">Edit</span>` : `<span class="btn sm pri">Use</span>`}</div>
    </div></div>`).join('')}
</div>
${note([['new', 'A “Seasonal” tab on the Theme page (no new menu item). A year strip shows what is planned; today is the red line.'], ['new', '11 national festivals ready to use (New Year, Sankranti, Republic Day, Holi, Eid, Independence Day, Ganesh Chaturthi, Gandhi Jayanti, Navratri, Diwali, Christmas) + “Your own” (e.g. company birthday).'], ['new', 'Whole company only for now — no office-wise seasons.'], ['new', 'Your holiday list suggests seasons: “Diwali is on your holiday list — turn on Diwali glow?”'], ['old', 'Your normal theme is never changed — a season sits on top for a few days.']])}
`);
  return dcPage('Seasonal — year', css, html, 1180);
}

// ─── 2 · Make / edit a season (popup) ───────────────────────
function editor() {
  const s = SEASONS.find((x) => x.k === 'diwali');
  const overlay = `<div class="ovl"></div>
<div class="mdl" style="width:980px">
  <div class="mh"><span class="mic" style="background:#FFEDD5;color:#EA580C;font-size:20px">🪔</span><div style="flex:1"><b style="font-size:15px">Diwali glow</b><div class="xs mut">A few festive days on top of your normal theme. It switches back by itself.</div></div><span class="mut">${icon('x2', 16)}</span></div>
  <div style="display:grid;grid-template-columns:1fr 400px">
    <div class="mb" style="border-right:1px solid ${C.line}">
      <div class="secn"><i>1</i>When</div>
      <div class="row" style="gap:8px"><div class="in" style="flex:1">${icon('cal', 13)}2 Nov 2026 · in 27 days</div><span class="mut">→</span><div class="in" style="flex:1">8 Nov 2026</div></div>
      <div class="row" style="gap:8px"><span class="cb on">${icon('check2', 10)}</span><span class="xs">Every year on these dates ${NEW} <span class="mut">· Diwali moves each year — we follow your holiday list</span></span></div>
      <div class="secn"><i>2</i>Colours</div>
      <div class="row" style="gap:10px">${[['Main', s.c[0]], ['Accent', s.c[1]], ['Deep', s.c[2]]].map(([l, c]) => `<span style="display:flex;flex-direction:column;align-items:center;gap:3px">${sw(c, 36)}<span class="xs mut">${l}</span></span>`).join('')}<span class="xs mut" style="margin-left:8px">Only the main colours change — your fonts, corners and logo stay.</span></div>
      <div class="secn"><i>3</i>Decoration</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[['🪔', 'Diyas', true], ['✨', 'Sparkles', false], ['🎆', 'Fireworks once', false], ['—', 'None', false]].map(([e, l, on]) => `<div style="border-radius:12px;border:${on ? `2px solid ${C.pri}` : `1px solid ${C.border}`};padding:8px;text-align:center;font-size:20px">${e}<div class="xs" style="font-weight:700">${l}</div></div>`).join('')}</div>
      <div class="secn"><i>4</i>Greeting on Home</div>
      <div class="in">Happy Diwali from all of us at Aakash 🪔</div>
      <div class="secn"><i>5</i>Who sees it</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill p-pri">${icon('check2', 10)} Everyone in the company</span><span class="xs mut">People can switch back to their own theme</span><span class="row" style="gap:6px;margin-left:auto"><span class="xs">Also on the sign-in page</span>${tog(true)}</span></div>
    </div>
    <div class="mb" style="background:${C.raised}">
      <div class="row"><span class="lbl" style="flex:1">Preview</span><span class="seg2"><span class="on">Light</span><span>Dark</span></span></div>
      <div style="border-radius:12px;overflow:hidden;border:1px solid ${C.border};background:#FFFBF5;height:300px;display:flex;position:relative">
        <div style="width:80px;background:#fff;border-right:1px solid #F3E8D9;padding:7px;display:flex;flex-direction:column;gap:5px">${logo(20, 6)}${['Home', 'Leave', 'People'].map((t, i) => `<div style="height:15px;border-radius:5px;font-size:9px;padding:0 6px;display:flex;align-items:center;${i === 0 ? `background:#EA580C22;color:#EA580C;font-weight:800` : 'color:#9CA3AF'}">${t}</div>`).join('')}</div>
        <div style="flex:1;padding:10px;display:flex;flex-direction:column;gap:8px">
          <div style="border-radius:12px;padding:12px;color:#fff;background:linear-gradient(135deg,#EA580C,#F59E0B);position:relative;overflow:hidden"><b style="font-size:12px">Happy Diwali from all of us at Aakash</b><div style="font-size:9.5px;opacity:.9">2 – 8 Nov · enjoy the lights</div><span class="flick" style="position:absolute;right:10px;top:8px;font-size:22px">🪔</span></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${['182', '9', '7'].map((v, i) => `<div style="border-radius:8px;background:#fff;border:1px solid #F3E8D9;padding:6px"><b style="font-size:13px;color:${s.c[i % 2]}">${v}</b></div>`).join('')}</div>
          <div style="height:60px;border-radius:8px;background:#fff;border:1px solid #F3E8D9"></div>
          <span style="height:20px;width:80px;border-radius:7px;background:#EA580C"></span>
        </div>
        <span class="flick" style="position:absolute;right:6px;bottom:4px;font-size:18px">🪔</span><span class="flick" style="position:absolute;right:28px;bottom:4px;font-size:14px;animation-delay:.4s">🪔</span>
      </div>
    </div>
  </div>
  <div class="mf"><span class="xs mut">Starts on its own on 2 Nov at midnight</span><span style="flex:1"></span><span class="btn">Cancel</span><span class="btn">${icon('eye', 12)}Try it on me for 10 min</span><span class="btn pri">Save season</span></div>
</div>`;
  const html = page('Theme', `${top('Theme', 'Your company’s look.')}<div class="card" style="height:700px;opacity:.5"></div>`, overlay);
  return dcPage('Seasonal — edit', css, html, 900);
}

// ─── 3 · What employees see ─────────────────────────────────
function employees() {
  const home = (title, sub, c, deco, extra = '') => `<div style="border-radius:14px;overflow:hidden;border:1px solid ${C.border};background:#fff;display:flex;height:230px;position:relative">
    <div style="width:84px;border-right:1px solid ${C.border};padding:7px;display:flex;flex-direction:column;gap:5px">${logo(20, 6)}${['Home', 'Leave', 'People', 'Team'].map((t, i) => `<div style="height:15px;border-radius:5px;font-size:9px;padding:0 6px;display:flex;align-items:center;${i === 0 ? `background:${c[0]}22;color:${c[0]};font-weight:800` : 'color:#9CA3AF'}">${t}</div>`).join('')}</div>
    <div style="flex:1;padding:10px;display:flex;flex-direction:column;gap:7px">
      <div style="border-radius:12px;padding:11px;color:#fff;background:${grad(c)};position:relative;overflow:hidden"><b style="font-size:12px">${title}</b><div style="font-size:9.5px;opacity:.9">${sub}</div>${extra}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${[0, 1, 2].map((i) => `<div style="height:40px;border-radius:8px;border:1px solid ${C.border};border-top:3px solid ${c[i]}"></div>`).join('')}</div>
      <div style="height:50px;border-radius:8px;border:1px solid ${C.border}"></div>
    </div>${deco}</div>`;
  const snow = `<span class="snow" style="position:absolute;inset:0;pointer-events:none">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i * 0.3) % 4}s;background:#BFDBFE"></i>`).join('')}</span>`;
  const html = page('Theme', `
${top('What employees see', 'The same Home — dressed up for a few days. People who don’t want it can switch decorations off for themselves.')}
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
  <div><span class="where">🪔 Diwali · first visit of the day</span><div style="margin-top:8px">${home('Happy Diwali from all of us at Aakash', '2 – 8 Nov', SEASONS.find((x) => x.k === 'diwali').c, '<span class="flick" style="position:absolute;right:8px;bottom:6px;font-size:20px">🪔</span><span class="flick" style="position:absolute;right:32px;bottom:6px;font-size:16px;animation-delay:.5s">🪔</span>', '<span class="flick" style="position:absolute;right:10px;top:8px;font-size:20px">🪔</span>')}</div></div>
  <div><span class="where">🎄 Year end · light snow on Home only</span><div style="margin-top:8px">${home('Thank you for a great 2026 ✨', 'See you in 2027', SEASONS.find((x) => x.k === 'xmas').c, snow)}</div></div>
  <div><span class="where">🎖️ Republic Day · tricolour ribbon</span><div style="margin-top:8px">${home('Happy Republic Day 🎖️', '26 January', ['#F97316', '#94A3B8', '#16A34A'], '', `<span style="position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#F97316 33%,#fff 33% 66%,#16A34A 66%)"></span>`)}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:start">
  <div class="card sec2"><b style="font-size:13px">Side popup on the first visit ${NEW}</b>
    <div style="border-radius:14px;padding:12px;background:#fff;border:1px solid ${C.border};box-shadow:0 14px 30px #0002;display:flex;flex-direction:column;gap:8px">
      <div class="row" style="gap:10px"><span class="flick" style="font-size:24px">🪔</span><div style="flex:1"><b style="font-size:12.5px">Diwali glow is on for everyone</b><div class="xs mut">2 – 8 Nov · then back to normal</div></div></div>
      <div class="row" style="gap:6px"><span class="btn sm pri" style="flex:1;justify-content:center">Keep it ✨</span><span class="btn sm" style="flex:1;justify-content:center">Switch back to my theme</span></div>
    </div>
    <div class="xs mut">The season goes on for everyone — even people with their own colour theme. Their choice is remembered until the season ends.</div>
  </div>
  <div class="card sec2"><b style="font-size:13px">Sign-in page</b>
    <div style="height:110px;border-radius:12px;background:${grad(SEASONS.find((x) => x.k === 'diwali').c)};position:relative;display:flex;align-items:center;justify-content:center"><div style="width:130px;background:#fff;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:4px;align-items:center">${logo(18, 5)}<b style="font-size:9.5px">Happy Diwali 🪔</b><div style="height:10px;width:100%;border-radius:4px;background:${C.raised}"></div><div style="height:11px;width:100%;border-radius:4px;background:#EA580C"></div></div><span class="flick" style="position:absolute;left:12px;bottom:8px;font-size:18px">🪔</span></div>
  </div>
  <div class="card sec2"><b style="font-size:13px">In Preferences (each person)</b>
    <div class="lbl">During company seasons</div><div class="seg2"><span class="on">Use the season</span><span>Keep my theme</span></div><div class="row" style="gap:10px"><div style="flex:1"><b style="font-size:12.5px">Festive decorations</b><div class="xs mut">Diyas, snow, confetti</div></div>${tog(true)}</div>
    <div class="xs mut">“Less motion” or the Simple background → decorations stay still, no snow or confetti.</div>
  </div>
</div>
${note([['new', 'Home greeting banner in season colours, a small decoration (diyas / snow / ribbon), the sign-in page dressed up too.'], ['new', 'The season is on for everyone. A side popup on the first visit: “Keep it” or “Switch back to my theme” — remembered for that season.'], ['new', 'Each person can switch decorations off in Preferences; less motion makes them still.']])}
`);
  return dcPage('Seasonal — employees', css, html, 900);
}

// ─── 4 · Rules ──────────────────────────────────────────────
function rules() {
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Settings · seasonal themes</div><h1 style="margin:4px 0">How seasons work</h1><div class="sub">Simple rules so nobody has to remember anything.</div></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px" class="stg">
  ${[
    ['🕛', 'Starts and ends by itself', 'On at 00:00 on the first day, back to your normal theme at 00:00 after the last day — in the company time zone.'],
    ['🎨', 'Your normal theme is safe', 'A season only swaps the main colours and adds a decoration. Fonts, corners, logo and your published theme are untouched.'],
    ['📅', 'Every year', 'Tick “every year”: fixed dates repeat (Republic Day); moving festivals (Diwali, Holi, Eid) follow your holiday list.'],
    ['🏢', 'Whole company', 'National festivals only, for everyone. Office-wise seasons can come later.'],
    ['↔️', 'Two at once?', 'You can’t save a season that overlaps another for the same people — we show which one clashes.'],
    ['👤', 'People choose too', 'The season is on for everyone first. A side popup lets anyone switch back to their own theme, or turn decorations off.'],
    ['🌙', 'Dark mode', 'Every season has a dark version made for you; you can check it in the preview.'],
    ['🧘', 'Calm by default', 'Decorations move gently and only on Home. Less motion / Simple background → still pictures.'],
    ['🔒', 'Who can set them', 'New permission “Manage seasonal themes” — given to Company Admin and HR by default; tick it for any other role (e.g. a CEO / Leadership role).'],
  ].map(([e, t, d]) => `<div class="card sec2"><span style="font-size:24px">${e}</span><b style="font-size:13.5px">${t}</b><div class="xs mut" style="line-height:1.6">${d}</div></div>`).join('')}
</div>
<div class="card notes"><b class="xs" style="letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Your answers</b>${['Decided: national festivals only, whole company, new permission for Admin + HR, side popup to keep or switch back.'].map((t, i) => `<div class="xs"><span class="k-new">Done</span>${t}</div>`).join('')}</div>
</div>`;
  return dcPage('Seasonal — rules', css, html, 820);
}

// ─── 5 · Motion ─────────────────────────────────────────────
function motion() {
  const demos = [
    ['Diyas flicker', 'Diwali', 'Two or three small lamps in the corner gently flicker.', `<span class="flick" style="font-size:40px">🪔</span><span class="flick" style="font-size:30px;animation-delay:.5s">🪔</span>`],
    ['Light snow', 'Year end', 'A few soft flakes fall on Home only.', `<span class="snow" style="position:absolute;inset:0;background:#1E3A8A">${Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 23) % 100}%;animation-delay:${(i * 0.25) % 4}s"></i>`).join('')}</span>`],
    ['Colour splash', 'Holi', 'Soft colour circles bloom and fade once.', ['#DB2777', '#7C3AED', '#22C55E', '#F59E0B'].map((c, i) => `<span style="position:absolute;left:${20 + i * 18}%;top:${30 + (i % 2) * 20}%;width:40px;height:40px;border-radius:50%;background:${c};animation:splash 2.4s ease-out ${i * 0.4}s infinite"></span>`).join('')],
    ['Rangoli draws itself', 'Diwali / Onam', 'A flower ring is drawn around the greeting.', `<svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="#F59E0B" stroke-width="4" stroke-dasharray="400" style="animation:draw 2.5s ease infinite alternate"/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<circle cx="${50 + Math.cos(a) * 38}" cy="${50 + Math.sin(a) * 38}" r="6" fill="${['#EA580C', '#DB2777'][i % 2]}"/>`; }).join('')}</svg>`],
    ['Colours change at midnight', 'All seasons', 'The first visit fades from your colours to the season’s.', `<span style="width:150px;height:70px;border-radius:12px;animation:fadein 3s ease-in-out infinite alternate"></span>`],
    ['Tricolour ribbon', 'Republic / Independence Day', 'A ribbon slides once along the banner.', `<div style="width:180px;height:16px;border-radius:99px;overflow:hidden;background:${C.line}"><span style="display:block;height:100%;width:100%;background:linear-gradient(90deg,#F97316 33%,#fff 33% 66%,#16A34A 66%);animation:ribbon 2.4s ease-in-out infinite"></span></div>`],
    ['Kite floats', 'Independence Day / Sankranti', 'A small kite drifts in the corner.', `<span style="font-size:40px;animation:kite 3s ease-in-out infinite;display:inline-block">🪁</span>`],
    ['Petals fall', 'Onam / Holi', 'A few petals drift down once.', Array.from({ length: 6 }, (_, i) => `<span style="position:absolute;left:${10 + i * 14}%;top:0;font-size:16px;animation:petal 3.5s linear ${i * 0.5}s infinite">🌸</span>`).join('')],
  ];
  const html = `<div style="padding:28px;background:${C.bg};font-family:Manrope,system-ui,sans-serif;display:flex;flex-direction:column;gap:16px;min-height:100vh">
<div><div class="eyebrow">Seasonal themes · motion</div><h1 style="margin:4px 0">Decoration ideas (live)</h1><div class="sub">Gentle, small and only on Home. All stop with “Less motion” or when decorations are off.</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${demos.map(([t, w, d, s]) => `<div class="demo"><div class="stage">${s}</div><span class="where">${w}</span><b style="font-size:13px">${t}</b><div class="xs mut">${d}</div></div>`).join('')}</div>
</div>`;
  return dcPage('Seasonal — motion', css, html, 760);
}

const boards = [
  ['CASeasonYear.dc.html', 'Seasonal themes · Plan the year — year strip, 11 national festivals + your own, holiday-list suggestion', seasonsTab, 1380],
  ['CASeasonEdit.dc.html', 'Seasonal themes · Make a season — dates, every year, colours, decoration, greeting, who sees it, live preview', editor, 900],
  ['CASeasonEmployees.dc.html', 'Seasonal themes · What employees see — Home banner, decorations, sign-in page, first-visit toast, turn off', employees, 900],
  ['CASeasonRules.dc.html', 'Seasonal themes · How seasons work — rules + questions', rules, 820],
  ['CASeasonMotion.dc.html', 'Seasonal themes · Decoration ideas (live)', motion, 760],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
let maxY = 0;
for (const [f, b] of Object.entries(canvas.boards)) if (!boards.some(([x]) => x === f)) maxY = Math.max(maxY, b.y + b.h);
const Y = Math.ceil((maxY + 700) / 100) * 100;
boards.forEach(([f, title, , h], i) => {
  const pos = { x: (i % 3) * 1520, y: Y + Math.floor(i / 3) * 1500 };
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, ...pos };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
const id = Object.entries(canvas.notes).find(([, n]) => n.text?.startsWith('Company · Seasonal themes'))?.[0] ?? `n${Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1}`;
canvas.notes[id] = { kind: 'title1', maxW: 7600, text: 'Company · Seasonal themes — plan the year, make a season, what employees see, rules, decorations', w: 240, x: 0, y: Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards at y', Y, 'note', id);
