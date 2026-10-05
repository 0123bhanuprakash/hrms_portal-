// Next round of boards for the final canvas: Joiners & leavers designs, atmosphere animations,
// component ideas, Who's off calendar + company icon, and multi-session check-in.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, helmetFonts } = require('./build-balanced.js');
const { face } = require('./build-mix.js');
const { light: L } = require('./build-gold.js');
const OUT = path.join(__dirname, '..', 'canvas');

const baseCss = (extra) => `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:${L.bg}}
.w{font-family:Manrope,system-ui,sans-serif;color:${L.fg};padding:40px;background:${L.bg};box-sizing:border-box}
.w h1{margin:0 0 6px;font-size:28px;font-weight:800;letter-spacing:-.02em}
.w>p.lead{margin:0 0 24px;color:${L.muted};max-width:980px;line-height:1.5}
.card{background:${L.surface};border:1px solid ${L.border};border-radius:14px;box-shadow:${L.shadow};padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;min-width:0}
.card h2{margin:0;font-size:15px;font-weight:800}
.hd{display:flex;align-items:center;gap:10px}.hd h2{flex:1}
.tag{font-size:11px;font-weight:800;padding:3px 9px;border-radius:99px;background:${L.goldSoft};color:${L.goldText};white-space:nowrap}
.tag.ok{background:${L.okSoft};color:${L.ok}}.tag.neu{background:${L.neuSoft};color:${L.neu}}
.mut{color:${L.muted}}.xs{font-size:12px}.sm{font-size:13px}
.why{font-size:12.5px;color:${L.muted};line-height:1.5;border-top:1px solid ${L.line};padding-top:10px;margin-top:auto}
.why b{color:${L.fg}}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
@keyframes rise{from{opacity:0;transform:translateY(10px)}}
@keyframes growy{from{transform:scaleY(0)}}
@keyframes fillw{from{transform:scaleX(0)}}
@keyframes pop{from{opacity:0;transform:scale(.7)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
${extra}
</style>\n</helmet>`;

// ───────────────────────── 1 · Joiners & leavers
function joinersBoard() {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const joined = [0, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 1];
  const left = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0];
  let head = 4;
  const heads = months.map((_, i) => (head += joined[i] - left[i]));
  const G = L.ok, R = L.bad;
  // A · mirrored bars + net headcount line
  const W = 600, H = 220, mid = 120, unit = 26, colW = W / 12;
  const bars = months.map((m, i) => `<g style="animation:rise .5s ${i * 0.04}s both">${joined[i] ? `<rect x="${i * colW + 12}" y="${mid - joined[i] * unit}" width="${colW - 24}" height="${joined[i] * unit}" rx="5" fill="${G}"/>` : ''}${left[i] ? `<rect x="${i * colW + 12}" y="${mid + 2}" width="${colW - 24}" height="${left[i] * unit}" rx="5" fill="${R}"/>` : ''}<text x="${i * colW + colW / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${L.muted}" font-family="Manrope">${m}</text></g>`).join('');
  const hmax = Math.max(...heads), hmin = Math.min(...heads);
  const pts = heads.map((h, i) => `${(i * colW + colW / 2).toFixed(1)},${(20 + (1 - (h - hmin) / (hmax - hmin || 1)) * 50).toFixed(1)}`).join(' ');
  const optA = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-label="Joiners above the line, leavers below"><line x1="0" x2="${W}" y1="${mid + 1}" y2="${mid + 1}" stroke="${L.borderStrong}"/>${bars}<polyline points="${pts}" fill="none" stroke="${L.gold}" stroke-width="2.5" stroke-dasharray="600" stroke-dashoffset="600" style="animation:dash 1.6s .5s forwards"/>${heads.map((h, i) => `<circle cx="${i * colW + colW / 2}" cy="${20 + (1 - (h - hmin) / (hmax - hmin || 1)) * 50}" r="3.5" fill="${L.surface}" stroke="${L.gold}" stroke-width="2"/>`).join('')}<text x="${W - 4}" y="14" text-anchor="end" font-size="11" fill="${L.goldText}" font-weight="700" font-family="Manrope">headcount ${heads.at(-1)}</text></svg>`;
  // B · headcount bridge (waterfall)
  const steps = [['Start of year', 4, 'base'], ['Joined', 9, 'up'], ['Left', -2, 'down'], ['Today', 11, 'base']];
  let run = 0;
  const bw = 120, bscale = 12;
  const optB = `<svg viewBox="0 0 600 220" width="100%" height="220">${steps.map(([lbl, v, kind], i) => {
    let y0, h, col;
    if (kind === 'base') { y0 = 180 - v * bscale; h = v * bscale; col = L.gold; run = v; }
    else if (kind === 'up') { y0 = 180 - (run + v) * bscale; h = v * bscale; col = G; run += v; }
    else { y0 = 180 - run * bscale; h = -v * bscale; col = R; run += v; }
    const x = 30 + i * 145;
    return `<g style="animation:pop .5s ${i * 0.15}s both;transform-origin:${x + bw / 2}px 180px"><rect x="${x}" y="${y0}" width="${bw}" height="${h}" rx="8" fill="${col}"/><text x="${x + bw / 2}" y="${y0 - 8}" text-anchor="middle" font-size="16" font-weight="800" fill="${L.fg}" font-family="Manrope">${kind === 'up' ? '+' : ''}${v}</text><text x="${x + bw / 2}" y="204" text-anchor="middle" font-size="12" fill="${L.muted}" font-family="Manrope">${lbl}</text>${i < 3 ? `<line x1="${x + bw}" x2="${x + 145}" y1="${kind === 'down' ? y0 + h : y0}" y2="${kind === 'down' ? y0 + h : y0}" stroke="${L.borderStrong}" stroke-dasharray="3 4"/>` : ''}</g>`;
  }).join('')}<line x1="20" x2="590" y1="180" y2="180" stroke="${L.borderStrong}"/></svg>`;
  // C · faces on a timeline
  const ev = [[2, 'priya', 'j'], [2, 'kiran', 'j'], [3, 'hema', 'j'], [4, 'arjun', 'l'], [5, 'rohan', 'j'], [6, 'neha', 'j'], [6, 'sneha', 'j'], [8, 'amit', 'j'], [9, 'kiran', 'l'], [9, 'priya', 'j'], [11, 'hema', 'j']];
  const optC = `<div class="tl"><div class="axis">${months.map((m) => `<span>${m}</span>`).join('')}</div>${ev.map(([mi, who, k], i) => `<span class="fc ${k}" style="left:calc(${((mi + 0.5) / 12) * 100}% - 17px);${k === 'j' ? `bottom:calc(50% + ${6 + (ev.slice(0, i).filter((e) => e[0] === mi && e[2] === k).length) * 30}px)` : `top:calc(50% + ${6 + (ev.slice(0, i).filter((e) => e[0] === mi && e[2] === k).length) * 30}px)`};animation-delay:${i * 0.07}s" title="${k === 'j' ? 'Joined' : 'Left'}">${face(who, 30)}</span>`).join('')}<span class="lg j">Joined</span><span class="lg l">Left</span></div>`;
  // D · story tiles
  const spark = (vals, col) => { const mx = Math.max(...vals), mn = Math.min(...vals); return `<svg width="90" height="30" viewBox="0 0 90 30"><polyline points="${vals.map((v, i) => `${(i * 90) / (vals.length - 1)},${28 - ((v - mn) / (mx - mn || 1)) * 24}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/></svg>`; };
  const optD = `<div class="tiles"><div class="big"><span class="xs mut">People today</span><b>13</b><span class="xs" style="color:${G};font-weight:700">▲ 9 this year</span>${spark(heads, L.gold)}</div>
    <div class="t"><span class="xs mut">Joined</span><b style="color:${G}">9</b>${spark(joined, G)}</div>
    <div class="t"><span class="xs mut">Left</span><b style="color:${R}">2</b>${spark(left, R)}</div>
    <div class="t"><span class="xs mut">Attrition</span><b>15%</b><span class="xs mut">12 months</span></div>
    <div class="t"><span class="xs mut">Avg tenure</span><b>1.4 yrs</b><span class="xs mut">company-wide</span></div>
    <div class="t"><span class="xs mut">Probation ends</span><b>2</b><span class="xs mut">this month</span></div></div>`;
  const opt = (title, tag, body, why) => `<section class="card"><div class="hd"><h2>${title}</h2>${tag}</div>${body}<div class="why">${why}</div></section>`;
  const extra = `
@keyframes dash{to{stroke-dashoffset:0}}
.tl{position:relative;height:250px}
.tl .axis{position:absolute;left:0;right:0;top:50%;display:grid;grid-template-columns:repeat(12,1fr);border-top:2px solid ${L.borderStrong};font-size:11px;color:${L.muted};text-align:center;padding-top:4px;transform:translateY(-1px)}
.tl .axis span{margin-top:12px}
.tl .fc{position:absolute;animation:pop .45s cubic-bezier(.3,1.6,.5,1) both;transition:transform .2s}
.tl .fc:hover{transform:scale(1.25);z-index:2}
.tl .fc.j svg{box-shadow:0 0 0 2px ${L.ok}}.tl .fc.l svg{box-shadow:0 0 0 2px ${L.bad};filter:grayscale(.4)}
.tl .lg{position:absolute;left:0;font-size:11px;font-weight:800}.tl .lg.j{top:0;color:${L.ok}}.tl .lg.l{bottom:0;color:${L.bad}}
.tiles{display:grid;grid-template-columns:1.3fr 1fr 1fr;grid-template-rows:auto auto;gap:10px}
.tiles>div{border:1px solid ${L.border};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px;animation:rise .5s both;transition:transform .25s,box-shadow .25s}
.tiles>div:hover{transform:translateY(-3px);box-shadow:0 12px 24px -16px ${L.gold}}
.tiles b{font-size:24px;font-weight:800;letter-spacing:-.02em}
.tiles .big{grid-row:span 2;background:linear-gradient(160deg,${L.goldSoft},${L.surface})}
.tiles .big b{font-size:44px}
.legend{display:flex;gap:14px;font-size:12px;color:${L.muted}}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}`;
  const html = `<div class="w"><h1>Joiners &amp; leavers — four more engaging designs</h1><p class="lead">Same data as today (people report: joiners, leavers and headcount per month). My pick: <b>D on top + A below</b> as the default, with B (bridge) and C (faces) offered in the card’s “View as” switch.</p>
<div class="g2">
${opt('A · Mirror bars + headcount line', '<span class="tag ok">Recommended chart</span>', `<div class="legend"><span><i style="background:${G}"></i>Joined (above)</span><span><i style="background:${R}"></i>Left (below)</span><span><i style="background:${L.gold}"></i>Headcount</span></div>${optA}`, '<b>Why it works:</b> joiners and leavers read as gains and losses at a glance; the gold line shows the result. Hover a month for names.')}
${opt('B · Headcount bridge', '<span class="tag">View as option</span>', optB, '<b>Why it works:</b> tells the year’s story in four bars — where we started, who came, who left, where we are. Great for leadership and month-end.')}
${opt('C · Faces on a timeline', '<span class="tag">View as option</span>', optC, '<b>Why it works:</b> people, not numbers — real profile photos above the line for joiners and below for leavers. Hover a face for name, role and date.')}
${opt('D · Story tiles with sparklines', '<span class="tag ok">Recommended header</span>', optD, '<b>Why it works:</b> the five numbers HR asks about first, each with a tiny trend. Sits above chart A in the same card.')}
</div></div>`;
  return dcPage('Joiners and leavers designs', baseCss(extra), html, 1360);
}

// ───────────────────────── 2 · Atmosphere (like the sky)
function atmosphereBoard() {
  const scene = (title, when, cls, inner, why) => `<section class="sc"><div class="stage ${cls}">${inner}</div><div class="tx"><div class="hd"><h2>${title}</h2><span class="tag">${when}</span></div><p>${why}</p></div></section>`;
  const balloons = Array.from({ length: 7 }, (_, i) => `<i style="left:${8 + i * 13}%;background:${['#E9416A', '#F2B65A', '#5FD39B', '#5EB8B0', '#B07CF0', '#FF8A5C', '#E9416A'][i]};animation-delay:${(i * 0.7).toFixed(1)}s;animation-duration:${6 + (i % 3)}s"></i>`).join('');
  const fireworks = [0, 1, 2].map((k) => `<span class="fw" style="left:${20 + k * 30}%;top:${25 + (k % 2) * 15}%;animation-delay:${k * 0.8}s">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg;background:${['#F2B65A', '#FFE3A8', '#FF8A5C'][i % 3]}"></i>`).join('')}</span>`).join('');
  const diyas = Array.from({ length: 6 }, (_, i) => `<span class="diya" style="left:${8 + i * 16}%;animation-delay:${i * 0.3}s"><b></b></span>`).join('');
  const bulbs = Array.from({ length: 16 }, (_, i) => `<i style="left:${i * 6.4}%;top:${12 + Math.sin(i / 2.5) * 8}%;animation-delay:${(i % 4) * 0.25}s;background:${['#FFD27A', '#FF8A5C', '#E9416A', '#5FD39B'][i % 4]}"></i>`).join('');
  const holi = Array.from({ length: 5 }, (_, i) => `<i style="left:${10 + i * 18}%;top:${30 + (i % 2) * 25}%;background:${['#E9416A', '#F2B65A', '#5FD39B', '#2F9BEA', '#B07CF0'][i]};animation-delay:${i * 0.5}s"></i>`).join('');
  const snow = Array.from({ length: 30 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${((i * 0.41) % 6).toFixed(2)}s;animation-duration:${5 + (i % 5)}s;width:${2 + (i % 3)}px;height:${2 + (i % 3)}px"></i>`).join('');
  const rain = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 29) % 100}%;animation-delay:${((i * 0.13) % 1.2).toFixed(2)}s"></i>`).join('');
  const windows = Array.from({ length: 24 }, (_, i) => `<i style="animation-delay:${(i * 0.23).toFixed(2)}s"></i>`).join('');
  const extra = `
body{background:#0B0A08}
.w{background:#0B0A08;color:#EDEDEF}.w>p.lead{color:#A9A59C}
.sc{border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#12100C;display:flex;flex-direction:column}
.stage{height:210px;position:relative;overflow:hidden}
.tx{padding:14px 16px 16px}.tx h2{color:#FFF7E8}.tx p{margin:6px 0 0;font-size:13px;color:#A9A59C;line-height:1.5}
.tag{background:#2E2414;color:#E8BD6E}
/* birthday */
.bday{background:linear-gradient(160deg,#2f5e8c,#6fa7d4 55%,#f3c784)}
.bday i{position:absolute;bottom:-60px;width:34px;height:42px;border-radius:50% 50% 48% 48%;animation:balloon 7s ease-in infinite}
.bday i::after{content:"";position:absolute;left:50%;top:100%;width:1px;height:40px;background:rgba(255,255,255,.6)}
@keyframes balloon{0%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-150px) rotate(4deg)}100%{transform:translateY(-300px) rotate(-3deg)}}
.label{position:absolute;left:16px;bottom:14px;color:#fff;font-weight:800;font-size:20px;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.label small{display:block;font-size:12px;font-weight:600;opacity:.85}
/* anniversary fireworks */
.anniv{background:linear-gradient(160deg,#070b1f,#141c3f 60%,#2a2f5e)}
.fw{position:absolute;width:2px;height:2px}
.fw i{position:absolute;width:5px;height:5px;border-radius:50%;opacity:0;animation:boom 2.4s ease-out infinite;animation-delay:inherit}
@keyframes boom{0%{opacity:1;transform:rotate(var(--a)) translateX(0)}70%{opacity:1}100%{opacity:0;transform:rotate(var(--a)) translateX(60px)}}
/* diwali */
.diwali{background:linear-gradient(160deg,#1a0f2e,#3b1b3f 60%,#5c2a20)}
.diwali .bulb i{position:absolute;width:8px;height:8px;border-radius:50%;box-shadow:0 0 12px currentColor;animation:twinkle 1s ease-in-out infinite alternate}
@keyframes twinkle{to{opacity:.3}}
.diya{position:absolute;bottom:22px;width:34px;height:14px;border-radius:0 0 20px 20px;background:#B7791F}
.diya b{position:absolute;left:50%;top:-16px;width:10px;height:16px;margin-left:-5px;border-radius:50% 50% 30% 30%;background:radial-gradient(circle at 50% 70%,#FFF4C2,#FFB347 60%,transparent 70%);animation:flame .6s ease-in-out infinite alternate;transform-origin:bottom}
@keyframes flame{to{transform:scaleY(1.2) rotate(3deg)}}
/* holi */
.holi{background:linear-gradient(160deg,#fff7ec,#ffe6f1)}
.holi i{position:absolute;width:30px;height:30px;border-radius:50%;filter:blur(2px);opacity:0;animation:puff 3s ease-out infinite}
@keyframes puff{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(4)}}
/* christmas snow */
.snow{background:linear-gradient(160deg,#0f2233,#1c3d5a 60%,#3d6b8c)}
.snow i{position:absolute;top:-10px;border-radius:50%;background:#fff;opacity:.9;animation:fall 7s linear infinite}
@keyframes fall{to{transform:translateY(240px) translateX(20px)}}
/* monsoon */
.rain{background:linear-gradient(160deg,#2b3440,#46566a 60%,#6a7d90)}
.rain i{position:absolute;top:-20px;width:1.5px;height:16px;background:rgba(220,235,255,.55);transform:rotate(12deg);animation:drop .9s linear infinite}
@keyframes drop{to{transform:translate(-40px,240px) rotate(12deg)}}
/* office lights */
.office{background:linear-gradient(160deg,#0d1226,#1b2246)}
.bld{position:absolute;left:50%;bottom:0;width:180px;height:170px;margin-left:-90px;background:#151a33;border:1px solid rgba(255,255,255,.08);display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:14px;box-sizing:border-box}
.bld i{background:#232a4d;border-radius:2px;animation:lit 6s ease infinite}
@keyframes lit{0%,20%{background:#232a4d}30%,100%{background:#FFD27A;box-shadow:0 0 8px #FFD27A88}}
.cnt{position:absolute;right:16px;top:14px;color:#FFE3A8;font-weight:800;font-size:13px}
/* plant */
.plant{background:linear-gradient(160deg,#f3faf3,#e3f1e4)}
.pot{position:absolute;left:50%;bottom:16px;width:60px;height:40px;margin-left:-30px;background:#B7791F;border-radius:4px 4px 14px 14px}
.stem{position:absolute;left:50%;bottom:56px;width:4px;margin-left:-2px;background:#2F8A4F;height:0;animation:grow 6s ease-in-out infinite;transform-origin:bottom}
@keyframes grow{0%{height:0}60%,100%{height:110px}}
.leaf{position:absolute;width:30px;height:16px;background:#3FA86A;border-radius:0 100% 0 100%;opacity:0;animation:leaf 6s ease infinite}
@keyframes leaf{0%,30%{opacity:0;transform:scale(.2)}50%,100%{opacity:1;transform:none}}
.streak{position:absolute;left:16px;top:14px;color:#157A4B;font-weight:800;font-size:13px}
/* friday */
.friday{background:linear-gradient(160deg,#2a2148,#8d3e5c 50%,#e3793f)}
.friday .sun{position:absolute;left:70%;top:70%;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff0c9,#ffb062);box-shadow:0 0 50px #ffb062;animation:set 8s ease-in-out infinite}
@keyframes set{0%{transform:translateY(-40px)}100%{transform:translateY(40px)}}
/* month tide */
.tide{background:#0f2233}
.water{position:absolute;left:0;right:0;bottom:0;height:13%;background:linear-gradient(#2F9BEA,#175a8f);animation:fillup 4s ease both}
.water::before{content:"";position:absolute;left:-50%;top:-12px;width:200%;height:24px;background:radial-gradient(circle at 25% 100%,transparent 11px,#2F9BEA 12px) 0 0/48px 24px repeat-x;animation:wave 3s linear infinite}
@keyframes wave{to{transform:translateX(48px)}}
@keyframes fillup{from{height:0}}
.rules{margin-top:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.rules .card{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border-color:rgba(255,255,255,.08);color:#EDEDEF;box-shadow:none}
.rules ul{margin:0;padding-left:18px;font-size:13px;line-height:1.75;color:#C9C5BC}.rules b{color:#F0C985}`;
  const html = `<div class="w"><h1>Atmosphere — moments like the sky</h1><p class="lead">All live. Each one is triggered by something true (your birthday, a company holiday, the season, today’s attendance) and plays in the hero. One rule keeps it calm: <b>the biggest moment of the day wins, plays fully once, then settles into a quiet loop.</b> Reduce motion turns them all off.</p>
<div class="g3">
${scene('Your birthday', 'personal · that day', 'bday', `${balloons}<div class="label">Happy birthday, Priya!<small>From everyone at aakash-portal</small></div>`, 'Balloons rise in your own hero only. Colleagues see you in Celebrations today.')}
${scene('Work anniversary', 'personal · that day', 'anniv', `${fireworks}<div class="label">3 years with us<small>Thank you, Rohan</small></div>`, 'Gentle fireworks for your anniversary, with the year count.')}
${scene('Diwali', 'company holiday', 'diwali', `<div class="bulb">${bulbs}</div>${diyas}<div class="label" style="bottom:auto;top:40%">Happy Diwali</div>`, 'String lights and flickering diyas around Diwali. Comes from the company’s holiday list, so each company gets its own festivals.')}
${scene('Holi', 'company holiday', 'holi', `${holi}<div class="label" style="color:#7A2B5A;text-shadow:none">Happy Holi</div>`, 'Soft colour clouds that bloom and fade.')}
${scene('Christmas &amp; New Year', 'company holiday', 'snow', `${snow}<div class="label">Season’s greetings</div>`, 'Light snowfall; fireworks at midnight on New Year’s Day.')}
${scene('Monsoon', 'season · Jun – Sep', 'rain', `${rain}<div class="label">Monsoon mode<small>Drive safe — 2 people are WFH today</small></div>`, 'Rain by season (and later by office location). No weather service needed.')}
${scene('Office lights', 'live · admins', 'office', `<div class="bld">${windows}</div><span class="cnt">9 of 13 in</span>`, 'A building whose windows light up as people check in. A friendly “who’s in” for HR.')}
${scene('On-time streak', 'personal · daily', 'plant', `<div class="streak">12-day on-time streak</div><div class="pot"></div><div class="stem"></div><span class="leaf" style="left:calc(50% + 2px);bottom:110px;animation-delay:.6s"></span><span class="leaf" style="left:calc(50% - 32px);bottom:130px;transform:scaleX(-1);animation-delay:1s"></span><span class="leaf" style="left:calc(50% + 2px);bottom:150px;animation-delay:1.4s"></span>`, 'A plant that grows with punctuality and wilts gently if the streak breaks. Optional per company.')}
${scene('Friday wind-down', 'weekly', 'friday', `<div class="sun"></div><div class="label">Weekend in 4h 20m<small>Your timesheet is ready to submit</small></div>`, 'A setting sun on Friday afternoon with a helpful nudge.')}
${scene('Month tide', 'monthly', 'tide', `<div class="water" style="height:13%"></div><div class="label">Day 4 of 31<small>Payroll cut-off on 25 Oct</small></div>`, 'Water rises as the month goes on — useful near payroll and timesheet deadlines.')}
</div>
<div class="rules">
<div class="card"><h2>Which one shows</h2><ul><li><b>1.</b> Your birthday / anniversary</li><li><b>2.</b> Company holiday or festival</li><li><b>3.</b> Season (monsoon, winter)</li><li><b>4.</b> Weekly (Friday) / monthly</li><li><b>5.</b> Default: sky by time of day</li></ul></div>
<div class="card"><h2>Calm by design</h2><ul><li>Full animation once a day, then a quiet loop</li><li>Pauses when the tab is hidden</li><li>Off with Reduce motion; off on low-power phones</li><li>Text always stays readable on top</li></ul></div>
<div class="card"><h2>Company control</h2><ul><li>Admins choose which moments are on</li><li>Festivals come from the holiday list</li><li>Streak plant optional (some teams dislike gamification)</li><li>All CSS — no extra download</li></ul></div>
</div></div>`;
  return dcPage('Atmosphere ideas', baseCss(extra), html, 1500);
}

// ───────────────────────── 3 · Component ideas
function ideasBoard() {
  const C = (title, seen, where, body) => `<section class="card"><div class="mock">${body}</div><h2>${title}</h2><span class="xs" style="color:${L.goldText};font-weight:700">${seen}</span><div class="why"><b>For us:</b> ${where}</div></section>`;
  const extra = `
.mock{height:150px;border-radius:10px;background:${L.bg};border:1px solid ${L.line};padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:7px;overflow:hidden;font-size:12px}
.row{display:flex;align-items:center;gap:8px}
.ln{height:7px;border-radius:4px;background:${L.track}}
.pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700}
.kbd{border:1px solid ${L.borderStrong};border-bottom-width:2px;border-radius:5px;padding:0 5px;font-size:11px;font-weight:700;background:${L.surface}}
.bar{height:12px;border-radius:4px}
.hoverc{position:relative;border:1px solid ${L.border};background:${L.surface};border-radius:10px;padding:10px;box-shadow:0 12px 24px -12px rgba(0,0,0,.25)}
.dot{width:8px;height:8px;border-radius:50%}`;
  const ideas = [
    C('Command palette (Ctrl K)', 'Seen in: Linear, Vercel, many SaaS tools', 'jump to any person, page or action (“apply leave”, “Priya”) from anywhere. Already in our plan.', `<div class="row" style="border:1px solid ${L.borderStrong};border-radius:8px;padding:6px 8px;background:${L.surface}">${icon('scan', 14)}<span class="mut">Search people, pages, actions…</span><span style="margin-left:auto" class="kbd">Ctrl K</span></div><div class="row">${face('priya', 22)}<b>Priya Sharma</b><span class="mut">· HR</span></div><div class="row">${icon('plane', 14)}<b>Apply leave</b><span class="mut">action</span></div><div class="row">${icon('calcheck', 14)}<b>My attendance</b><span class="mut">page</span></div>`),
    C('Person hover card', 'Seen in: HiBob, Slack, GitHub', 'hover any avatar to see role, team, status (in / WFH / on leave) and local time, with a “Give kudos” button.', `<div class="row">${face('rohan', 30)}<span class="mut">hover →</span></div><div class="hoverc"><div class="row">${face('rohan', 30)}<div><b>Rohan Das</b><div class="mut">Engineering Lead · Bengaluru</div></div></div><div class="row" style="margin-top:6px"><span class="pill" style="background:${L.okSoft};color:${L.ok}"><span class="dot" style="background:${L.ok}"></span>In since 09:12</span><span class="pill" style="background:${L.goldSoft};color:${L.goldText}">Kudos</span></div></div>`),
    C('One inbox for approvals', 'Seen in: Personio (prioritised HR inbox), Rippling', 'every approval (leave, expenses, timesheets, assets) in one list, oldest first, with approve / reject inline and swipe-away.', ['Leave · Priya · 2 days', 'Expense · Neha · ₹2,400', 'Timesheet · Amit · 40h'].map((t, i) => `<div class="row" style="background:${L.surface};border:1px solid ${L.line};border-radius:8px;padding:6px 8px"><span class="dot" style="background:${[L.gold, L.warn, L.ok][i]}"></span><b style="flex:1">${t}</b><span class="pill" style="background:${L.okSoft};color:${L.ok}">Approve</span></div>`).join('')),
    C('Team leave planner', 'Seen in: Keka, Factorial, BambooHR', 'a Gantt-style strip of the team’s leave for the next weeks — spot clashes before approving.', ['Priya', 'Kiran', 'Neha', 'Amit'].map((n, i) => `<div class="row"><span style="width:44px">${n}</span><div style="flex:1;position:relative;height:12px"><span class="bar" style="position:absolute;left:${[10, 40, 25, 62][i]}%;width:${[18, 12, 26, 10][i]}%;background:${[L.gold, '#2C7A7B', L.bad, L.gold][i]}"></span></div></div>`).join('')),
    C('Day timeline (sessions)', 'Seen in: Keka, Darwinbox attendance', 'today as a bar from 12 AM to 12 AM with each check-in session, breaks and the shift window. Part of the check-in work.', `<div class="row" style="justify-content:space-between" class="mut"><span class="mut">12 AM</span><span class="mut">9:30</span><span class="mut">18:30</span><span class="mut">12 AM</span></div><div style="position:relative;height:18px;border-radius:6px;background:${L.track}"><span style="position:absolute;left:39.6%;width:37.5%;top:0;bottom:0;border:1.5px dashed ${L.borderStrong};border-radius:6px"></span><span class="bar" style="position:absolute;left:38%;width:16%;top:3px;background:${L.ok}"></span><span class="bar" style="position:absolute;left:56%;width:12%;top:3px;background:${L.ok}"></span></div><div class="row"><span class="pill" style="background:${L.okSoft};color:${L.ok}">2 sessions · 6h 40m</span><span class="pill" style="background:${L.neuSoft};color:${L.neu}">Break 32m</span></div>`),
    C('Onboarding checklist', 'Seen in: HiBob, Personio, Rippling', 'new joiners see their first-week tasks with milestone progress; HR sees who’s stuck.', `<div class="row"><b style="flex:1">Your first week</b><span class="mut">3 of 5</span></div><div class="ln" style="background:linear-gradient(90deg,${L.gold} 60%,${L.track} 60%)"></div>${['Sign offer letter', 'Upload ID proof', 'Meet your buddy'].map((t, i) => `<div class="row"><span class="dot" style="background:${i < 2 ? L.ok : L.borderStrong}"></span><span style="${i < 2 ? 'text-decoration:line-through;color:' + L.muted : ''}">${t}</span></div>`).join('')}`),
    C('One-question pulse', 'Seen in: HiBob, Culture Amp, Officevibe', 'a weekly one-tap mood check on the home page; HR sees the trend by team (anonymous).', `<b>How was your week?</b><div class="row" style="justify-content:space-between;font-size:22px">${['1', '2', '3', '4', '5'].map((n, i) => `<span style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;background:${i === 3 ? L.gold : L.surface};color:${i === 3 ? '#18181B' : L.fg};border:1px solid ${L.border}">${n}</span>`).join('')}</div><span class="mut">Anonymous · 2 seconds</span>`),
    C('Number with change', 'Seen in: Stripe, Vercel dashboards', 'every KPI shows the change since last period and a sparkline; click to open the report.', `<span class="mut">Present today</span><div class="row"><b style="font-size:26px">9</b><span class="pill" style="background:${L.okSoft};color:${L.ok}">▲ 2 vs last Mon</span></div><svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none"><polyline points="0,30 30,26 60,28 90,18 120,22 150,12 200,8" fill="none" stroke="${L.gold}" stroke-width="2.5"/></svg>`),
    C('Notifications by day', 'Seen in: GitHub, Linear inbox', 'the bell panel grouped Today / Yesterday / Earlier with filters (approvals, mentions, system).', `<div class="row"><span class="pill" style="background:${L.goldSoft};color:${L.goldText}">All</span><span class="pill" style="background:${L.neuSoft};color:${L.neu}">Approvals</span><span class="pill" style="background:${L.neuSoft};color:${L.neu}">Kudos</span></div><span class="mut" style="font-weight:700">TODAY</span><div class="row">${face('neha', 20)}<span>Neha approved your leave</span></div><span class="mut" style="font-weight:700">YESTERDAY</span><div class="row">${face('hema', 20)}<span>Hema gave you kudos</span></div>`),
    C('Smart tables', 'Seen in: Notion, Airtable, Linear', 'pick columns, sticky header, saved views (“My team · this month”) — remembered on your account.', `<div class="row"><span class="pill" style="background:${L.surface};border:1px solid ${L.border}">View: My team</span><span class="pill" style="background:${L.surface};border:1px solid ${L.border}">Columns ▾</span></div>${['Name · Dept · Status', 'Priya · People · In', 'Kiran · Eng · WFH', 'Amit · Eng · Leave'].map((t, i) => `<div class="row" style="padding:4px 6px;${i === 0 ? `font-weight:800;border-bottom:1px solid ${L.border}` : ''}">${t}</div>`).join('')}`),
    C('Status chip in the top bar', 'Seen in: Slack, Teams', 'set “In a meeting”, “On break”, “WFH today” — shows on your hover card and in Who’s in.', `<div class="row" style="justify-content:flex-end"><span class="pill" style="background:${L.okSoft};color:${L.ok};font-size:12px"><span class="dot" style="background:${L.ok}"></span>In office ▾</span></div><div class="hoverc" style="align-self:flex-end;width:170px">${['In office', 'Working from home', 'In a meeting', 'On a break'].map((t, i) => `<div class="row" style="padding:3px 0"><span class="dot" style="background:${[L.ok, '#2C7A7B', L.warn, L.muted][i]}"></span>${t}</div>`).join('')}</div>`),
    C('Customise my home', 'Seen in: HiBob home, Jira dashboards', 'drag cards to reorder, hide the ones you don’t need; saved on your account (part of “remember everything”).', `<div class="row" style="gap:6px">${['Today', 'My week', 'Leave'].map((t) => `<span style="flex:1;border:1px dashed ${L.borderStrong};border-radius:8px;padding:12px 6px;text-align:center;background:${L.surface}">${t}</span>`).join('')}</div><div class="row" style="gap:6px"><span style="flex:1;border:2px solid ${L.gold};border-radius:8px;padding:12px 6px;text-align:center;background:${L.goldSoft};transform:rotate(-2deg);box-shadow:0 10px 20px -10px #000">Kudos ↕</span><span style="flex:2;border:1px dashed ${L.borderStrong};border-radius:8px;padding:12px 6px;text-align:center;background:${L.surface}">Celebrations</span></div>`),
  ];
  const html = `<div class="w"><h1>Component ideas from other products</h1><p class="lead">Patterns that work well in leading HR suites and SaaS dashboards, redrawn in our style (ideas only, nothing copied). Each says where it would fit our portal. Sources: product pages and reviews of HiBob, Personio, Keka, Darwinbox, plus common dashboard practice.</p>
<div class="g4">${ideas.join('\n')}</div></div>`;
  return dcPage('Component ideas', baseCss(extra), html, 1260);
}

// ───────────────────────── 4 · Who's off calendar + company icon
function whosOffBoard() {
  // October 2026 starts on Thursday
  const off = { 5: [['amit', 'Sick leave']], 6: [['kiran', 'WFH']], 7: [['kiran', 'WFH'], ['sneha', 'Earned leave']], 8: [['sneha', 'Earned leave']], 9: [['sneha', 'Earned leave'], ['rohan', 'Casual leave'], ['neha', 'WFH']], 12: [['priya', 'Casual leave']], 13: [['priya', 'Casual leave']], 19: [], 20: [['arjun', 'Earned leave']] };
  const holidays = { 2: 'Gandhi Jayanti', 19: 'Dussehra' };
  const cells = [];
  for (let i = 0; i < 3; i++) cells.push('<span class="cd empty"></span>');
  for (let d = 1; d <= 31; d++) {
    const list = off[d] ?? [];
    const dow = (d + 2) % 7; // Mon=0
    const weekend = dow === 5 || dow === 6;
    const id = `d${d}`;
    cells.push(`<input type="radio" name="day" id="${id}"${d === 7 ? ' checked' : ''}><label for="${id}" class="cd${weekend ? ' we' : ''}${d === 4 ? ' today' : ''}${holidays[d] ? ' hol' : ''}" title="${holidays[d] ?? (list.length ? list.map(([p, t]) => `${p} – ${t}`).join(', ') : 'Nobody off')}"><b>${d}</b><span class="dots">${list.slice(0, 3).map(([, t]) => `<i class="${t === 'WFH' ? 'wfh' : 'lv'}"></i>`).join('')}</span><span class="tip">${holidays[d] ? holidays[d] : list.length ? list.map(([p, t]) => `${p.charAt(0).toUpperCase() + p.slice(1)} · ${t}`).join('<br>') : 'Nobody off'}</span></label><div class="day-detail" data-d="${d}"><div class="hd"><h2>${['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'][(d - 1) % 7]}, ${d} October</h2><span class="tag">${holidays[d] ? 'Holiday' : `${list.length} off`}</span></div>${holidays[d] ? `<p class="sm mut" style="margin:0">${holidays[d]} — company holiday</p>` : list.length ? list.map(([p, t]) => `<div class="pr">${face(p, 32)}<div><b>${p.charAt(0).toUpperCase() + p.slice(1)} ${{ amit: 'Verma', kiran: 'Rao', sneha: 'Menon', rohan: 'Das', neha: 'Gupta', priya: 'Sharma', arjun: 'Nair' }[p]}</b><div class="xs mut">${t}</div></div><span class="tag ${t === 'WFH' ? 'neu' : ''}">${t === 'WFH' ? 'WFH' : 'Leave'}</span></div>`).join('') : '<p class="sm mut" style="margin:0">Nobody is off.</p>'}</div>`);
  }
  const extra = `
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;position:relative}
.cal>input{position:absolute;opacity:0;pointer-events:none}
.wd{font-size:11px;font-weight:700;color:${L.muted};text-align:center}
.cd{position:relative;height:52px;border-radius:10px;border:1px solid ${L.line};background:${L.surface};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s}
.cd:hover{transform:translateY(-2px);box-shadow:0 10px 20px -12px rgba(0,0,0,.3);z-index:3}
.cd.empty{border:0;background:none;cursor:default}
.cd.we{background:${L.neuSoft}}
.cd.hol{background:#E2F1EF;border-color:#BFE0DB}
.cd.today{border-color:${L.gold};box-shadow:inset 0 0 0 1px ${L.gold}}
.cd b{font-size:13px}
.dots{display:flex;gap:3px;height:6px}.dots i{width:6px;height:6px;border-radius:50%}.dots .lv{background:${L.bad}}.dots .wfh{background:#2C7A7B}
.tip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%) translateY(4px);background:#18181B;color:#fff;font-size:11.5px;line-height:1.5;padding:6px 9px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s}
.cd:hover .tip{opacity:1;transform:translateX(-50%)}
.cal>input:checked+label{border-color:${L.gold};background:${L.goldSoft}}
.day-detail{display:none;grid-column:1/-1;order:99;border:1px solid ${L.border};border-radius:12px;padding:12px 14px;background:${L.surface};flex-direction:column;gap:10px;animation:rise .35s both}
.cal>input:checked+label+.day-detail{display:flex}
.pr{display:flex;align-items:center;gap:10px}.pr>div{flex:1}
.vs{display:inline-flex;background:${L.neuSoft};border-radius:8px;padding:3px;gap:2px}
.vs span{font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;color:${L.muted}}
.vs span.on{background:${L.surface};color:${L.fg};box-shadow:${L.shadow}}
.legend{display:flex;gap:14px;font-size:12px;color:${L.muted}}.legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
/* company icon */
.sbh{display:flex;align-items:center;gap:10px;background:#0F0F12;border-radius:12px;padding:12px 14px;color:#F4F4F5}
.sbh b{display:block;font-size:14px}.sbh span{font-size:11px;color:#8B8B93}
.ic{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex:none;position:relative;overflow:hidden}
.i1{background:#fff;color:#7A2BD9}
.i2{background:${L.gold};color:#18181B}
.i3{background:linear-gradient(135deg,#D69E3A,#7A4E0E);color:#fff}
.i3::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);background-size:250% 100%;animation:shine 3.5s ease-in-out infinite}
@keyframes shine{0%,60%{background-position:120% 0}100%{background-position:-120% 0}}
.i4{background:conic-gradient(from var(--a),#D69E3A,#E9416A,#7A2BD9,#2C7A7B,#D69E3A);color:#fff;animation:spin 6s linear infinite}
@property --a{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes spin{to{--a:360deg}}
.i4 em{position:absolute;inset:2px;border-radius:8px;background:#0F0F12;display:flex;align-items:center;justify-content:center;font-style:normal}
.i5{perspective:300px;background:none}
.i5 em{width:100%;height:100%;border-radius:10px;background:radial-gradient(circle at 30% 25%,#FFE3A8,#D69E3A 50%,#7A4E0E);color:#3A2608;display:flex;align-items:center;justify-content:center;font-style:normal;box-shadow:inset -3px -4px 8px rgba(0,0,0,.35),0 6px 14px -6px #7A4E0E;animation:coin 5s ease-in-out infinite}
@keyframes coin{0%,70%{transform:rotateY(0)}85%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}`;
  const html = `<div class="w"><h1>Who’s off — calendar view, and the company icon</h1><p class="lead">Try it: <b>hover</b> a day for a quick preview, <b>click</b> a day to pin the list underneath (works on phones too). The switch at the top flips between Calendar and the current List, and is remembered.</p>
<div class="g2" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)">
<section class="card"><div class="hd"><h2>Who’s off</h2><span class="vs"><span class="on">Calendar</span><span>List</span></span><a href="#" class="sm" style="color:${L.link};font-weight:700;text-decoration:none">Full calendar</a></div>
<div class="hd"><b class="sm" style="flex:1">October 2026</b><span class="legend"><span><i style="background:${L.bad}"></i>Leave</span><span><i style="background:#2C7A7B"></i>WFH</span><span><i style="background:#BFE0DB;border-radius:2px"></i>Holiday</span></span></div>
<div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span class="wd">${d}</span>`).join('')}${cells.join('')}</div></section>
<div style="display:flex;flex-direction:column;gap:20px">
<section class="card"><div class="hd"><h2>List view (today’s style)</h2><span class="vs"><span>Calendar</span><span class="on">List</span></span></div>
${[['amit', 'Amit Verma', 'Sick leave · Mon 5 Oct', 'Leave'], ['kiran', 'Kiran Rao', 'WFH · Tue 6 – Wed 7', 'WFH'], ['sneha', 'Sneha Menon', 'Earned leave · Wed 7 – Fri 9', 'Leave'], ['rohan', 'Rohan Das', 'Casual leave · Fri 9', 'Leave']].map(([k, n, s, t]) => `<div class="pr">${face(k, 32)}<div><b>${n}</b><div class="xs mut">${s}</div></div><span class="tag ${t === 'WFH' ? 'neu' : ''}">${t}</span></div>`).join('')}</section>
<section class="card"><h2>Company icon — options</h2><p class="sm mut" style="margin:0">Your uploaded logo always wins. Without one, the company picks a style in Branding. The sidebar itself doesn’t change.</p>
${[['i1', 'AP', 'Uploaded logo', 'what you have today'], ['i2', 'AP', 'Simple monogram', 'theme colour, no motion'], ['i3', 'AP', 'Monogram with shine', 'a light sweep every few seconds — my pick'], ['i4', '<em>AP</em>', 'Animated ring', 'colours circle the edge'], ['i5', '<em>AP</em>', '3D coin', 'flips now and then']].map(([c, t, n, s]) => `<div class="sbh"><span class="ic ${c}">${t}</span><div style="flex:1"><b>${n}</b><span>${s}</span></div><span style="font-size:11px;color:#8B8B93">aakash-portal</span></div>`).join('')}
</section></div></div></div>`;
  return dcPage('Whos off calendar and company icon', baseCss(extra), html, 1180);
}

// ───────────────────────── 5 · Check-in sessions
function sessionsBoard() {
  const extra = `
.today{gap:14px}
.ring{position:relative;width:110px;height:110px;flex:none}
.tline{position:relative;height:26px;border-radius:8px;background:${L.track}}
.tline .shift{position:absolute;top:-4px;bottom:-4px;left:39.6%;width:37.5%;border:1.5px dashed ${L.borderStrong};border-radius:8px}
.tline .s{position:absolute;top:5px;bottom:5px;border-radius:5px;background:${L.ok};animation:fillw .9s cubic-bezier(.2,.8,.2,1) both;transform-origin:left}
.tline .s.open{background:repeating-linear-gradient(45deg,${L.ok},${L.ok} 6px,#2fa36b 6px,#2fa36b 12px);animation:fillw .9s both,stripe 1s linear infinite}
@keyframes stripe{to{background-position:24px 0}}
.tline .now{position:absolute;top:-6px;bottom:-6px;width:2px;background:${L.gold}}
.ticks{display:flex;justify-content:space-between;font-size:11px;color:${L.muted}}
.ses{display:flex;flex-direction:column;gap:6px}
.ses div{display:flex;align-items:center;gap:10px;font-size:13px;padding:7px 10px;border-radius:8px;background:${L.bg};border:1px solid ${L.line}}
.ses div b{font-variant-numeric:tabular-nums}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:10px;font:inherit;font-weight:800;font-size:14px;border:1px solid ${L.borderStrong};background:${L.surface};color:${L.fg};padding:0 16px}
.btn.pri{background:${L.gold};border-color:${L.gold};color:#18181B}
.modal{border-radius:16px;background:${L.surface};border:1px solid ${L.border};box-shadow:0 30px 60px -20px rgba(0,0,0,.35);padding:22px;display:flex;flex-direction:column;gap:14px}
.modal h2{font-size:18px}
textarea{font:inherit;border:1px solid ${L.borderStrong};border-radius:10px;padding:10px;min-height:70px;resize:none;background:${L.bg}}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{font-size:12px;font-weight:700;padding:5px 10px;border-radius:99px;border:1px solid ${L.border};background:${L.bg}}
.gate{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:13px;padding:8px 10px;border-radius:8px;border:1px solid ${L.line}}
.src{font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px}`;
  const html = `<div class="w"><h1>Check in &amp; out — many times a day</h1><p class="lead">Each check-in and check-out is saved. The day runs <b>12 AM – 12 AM</b> and resets at midnight. Time worked = the sessions added up (breaks don’t count). Night shifts: people on a project that needs night work can stay checked in past midnight.</p>
<div class="g3">
<section class="card today"><div class="hd"><h2>Today</h2><span class="tag ok">Checked in · session 2</span></div>
<div style="display:flex;align-items:center;gap:16px"><div class="ring"><svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="47" fill="none" stroke="${L.track}" stroke-width="11"/><circle cx="55" cy="55" r="47" fill="none" stroke="${L.gold}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 47 * 0.71} 400" transform="rotate(-90 55 55)"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:20px">5h 40m</b><span class="xs mut">of 8h</span></div></div>
<div class="sm" style="display:flex;flex-direction:column;gap:5px"><span class="mut xs">First in</span><b>09:12</b><span class="mut xs">Break so far</span><b>32m</b></div></div>
<div><div class="tline"><span class="shift"></span><span class="s" style="left:38.3%;width:15.6%"></span><span class="s open" style="left:56.2%;width:6.4%;animation-delay:.3s"></span><span class="now" style="left:62.6%"></span></div><div class="ticks" style="margin-top:6px"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div></div>
<div class="ses"><div><span class="src" style="background:${L.okSoft};color:${L.ok}">1</span><span style="flex:1">09:12 – 12:58</span><b>3h 46m</b></div><div><span class="src" style="background:${L.okSoft};color:${L.ok}">2</span><span style="flex:1">13:30 – now</span><b>1h 54m</b></div></div>
<span class="btn">${icon('login', 16)}Check out</span></section>

<section class="modal"><div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:12px;background:${L.warnSoft};color:${L.warn};display:flex;align-items:center;justify-content:center">${icon('clock', 20)}</span><h2 style="margin:0">Checking out early?</h2></div>
<p class="sm" style="margin:0">You’ve worked <b>5h 40m</b> today — <b>2h 20m</b> short of your 8-hour day. You can add a reason for your manager, or just check out.</p>
<div class="chips"><span>Doctor’s appointment</span><span>Personal work</span><span>Working remotely later</span><span>Feeling unwell</span></div>
<textarea placeholder="Reason (optional)"></textarea>
<div style="display:flex;gap:10px;justify-content:flex-end"><span class="btn">Just check out</span><span class="btn pri">Add note &amp; check out</span></div>
<p class="xs mut" style="margin:0">You can still check in again later today.</p></section>

<section class="card"><h2>Every tap is kept (ready for gate cards)</h2>
${[['09:12', 'In', 'Web · office Wi-Fi', L.ok], ['12:58', 'Out', 'Web', L.bad], ['13:30', 'In', 'Mobile', L.ok], ['—', 'Gate', 'Card reader · not connected yet', L.muted]].map(([t, k, s, c]) => `<div class="gate"><b style="font-variant-numeric:tabular-nums">${t}</b><span>${s}</span><span class="src" style="background:${L.neuSoft};color:${c}">${k}</span></div>`).join('')}
<div class="why"><b>Later, with card readers:</b> taps at the gate arrive as more entries. Then we can flag <b>checked in but never tapped in</b> (possible tailgating), <b>entered twice without leaving</b>, and <b>late against the shift start</b> (09:30 today).</div></section>
</div></div>`;
  return dcPage('Check-in sessions', baseCss(extra), html, 820);
}

const boards = [
  ['JoinersLeavers.dc.html', 'Joiners & leavers — four engaging designs', joinersBoard, 1360],
  ['Atmosphere.dc.html', 'Atmosphere — moments like the sky (live)', atmosphereBoard, 1500],
  ['ComponentIdeas.dc.html', 'Component ideas from other products', ideasBoard, 1260],
  ['WhosOffCalendar.dc.html', 'Who’s off calendar (try it) + company icon options', whosOffBoard, 1180, true],
  ['CheckInSessions.dc.html', 'Check in & out many times a day + early check-out', sessionsBoard, 820],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
module.exports = { boards };
console.log('built', boards.map((b) => b[0]).join(', '));
