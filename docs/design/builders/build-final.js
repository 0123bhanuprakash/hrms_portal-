// FINAL screens (new canvas): mixed homes with the approved animations, hero art instead of the orb,
// switchable chart styles, theme-adaptive motion, final motion set + performance notes.
const fs = require('fs');
const path = require('path');
const { icon, shellPage, dcPage, helmetFonts, donut } = require('./build-balanced.js');
const { face, mixCss, mixEmployee, mixAdmin, mixSuper } = require('./build-mix.js');
const { light, dark } = require('./build-gold.js');
const OUT = path.join(__dirname, '..', 'canvas');
fs.mkdirSync(OUT, { recursive: true });

// ───────────────────────── extra CSS for the approved animations
const finalCss = (t, isDark) => `<style>
.col{position:relative}
/* hero: text left, living art right */
.heroX{display:grid!important;grid-template-columns:minmax(0,1fr) 230px;column-gap:20px;row-gap:14px;align-content:start}
.heroX>*:not(.heroArt){grid-column:1}
.heroX .hstats{max-width:none!important}
.heroArt{grid-column:2;grid-row:1 / span 3;align-self:center;justify-self:center;position:relative;z-index:1}
/* pointer spotlight (here it drifts; in the app it follows the pointer) */
@property --sx{syntax:'<percentage>';inherits:false;initial-value:20%}
.heroX::before{content:"";position:absolute;inset:0;background:radial-gradient(280px 200px at var(--sx) 30%,rgba(255,236,190,.16),transparent 70%);animation:spot 7s ease-in-out infinite alternate;pointer-events:none}
@keyframes spot{to{--sx:80%}}
/* greeting reveal (first visit of the day) */
.gr span{display:inline-block;animation:wr .7s cubic-bezier(.2,.8,.2,1) both}
.gr span:nth-child(2){animation-delay:.12s}.gr span:nth-child(3){animation-delay:.24s;color:#E8BD6E}
@keyframes wr{from{opacity:0;transform:translateY(12px)}}
/* day arc */
.arc .trk{stroke:rgba(255,255,255,.14)}
.arc .done{stroke-dasharray:0 400;animation:arcd 1.6s cubic-bezier(.2,.8,.2,1) .3s forwards}
@keyframes arcd{to{stroke-dasharray:var(--len) 400}}
.arc .sun{animation:sunin .5s ease 1.7s both,glow 2.4s ease-in-out 2.2s infinite}
@keyframes sunin{from{opacity:0}}
@keyframes glow{50%{filter:drop-shadow(0 0 10px #FFD98A)}}
/* team presence */
.pres{display:grid;grid-template-columns:repeat(4,40px);gap:8px}
.pres .p{position:relative;animation:bob 4s ease-in-out infinite}
.pres .p:nth-child(2n){animation-delay:.6s}.pres .p:nth-child(3n){animation-delay:1.2s}
.pres .p::after{content:"";position:absolute;right:0;bottom:2px;width:10px;height:10px;border-radius:50%;background:#5FD39B;border:2px solid #15110B}
.pres .p.off{opacity:.38}.pres .p.off::after{background:#8E8E96}
.pres .p.wfh::after{background:#5EB8B0}
@keyframes bob{50%{transform:translateY(-4px)}}
/* platform pulse */
.pulse{width:220px;height:110px;overflow:hidden;position:relative}
.pulse svg{position:absolute;left:0;top:0;animation:ecg 3s linear infinite}
@keyframes ecg{to{transform:translateX(-110px)}}
.pulse::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#15110B,transparent 25%,transparent 75%,#15110B)}
/* bell ring + badge pop */
.bellR svg{animation:bring 6s ease infinite;transform-origin:50% 10%}
.bellR .d{animation:bpop 6s cubic-bezier(.3,1.8,.5,1) infinite}
@keyframes bring{0%,80%,100%{transform:none}83%{transform:rotate(14deg)}86%{transform:rotate(-12deg)}89%{transform:rotate(8deg)}92%{transform:rotate(-4deg)}}
@keyframes bpop{0%,80%{transform:scale(1)}84%{transform:scale(1.45)}90%,100%{transform:scale(1)}}
/* light/dark toggle (two states only) */
.tgl{position:relative;width:58px;height:30px;border-radius:99px;border:1px solid ${t.border};background:${isDark ? '#1E1B16' : '#F3EEE4'};cursor:pointer;padding:0;margin-left:6px;animation:tglbg 8s ease-in-out infinite}
.tgl .knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#F2B65A;box-shadow:0 0 10px #F2B65A88;animation:tglk 8s ease-in-out infinite}
.tgl .knob::after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:${isDark ? '#1E1B16' : '#F3EEE4'};top:-4px;right:-16px;animation:tglm 8s ease-in-out infinite}
.tgl{overflow:hidden}
@keyframes tglk{0%,40%{transform:none;background:#F2B65A}50%,90%{transform:translateX(28px);background:#E9E3D6;box-shadow:0 0 8px #E9E3D655}100%{transform:none}}
@keyframes tglm{0%,40%{top:-4px;right:-16px}50%,90%{top:-3px;right:-5px}100%{top:-4px;right:-16px}}
@keyframes tglbg{0%,40%{background:${isDark ? '#1E1B16' : '#F3EEE4'}}50%,90%{background:#17150F}}
/* toast — top right */
.toastX{font-family:Manrope,system-ui,sans-serif;color:${t.fg};position:absolute;top:68px;right:24px;z-index:30;width:300px;border-radius:12px;background:${isDark ? '#1C1A16' : '#FFFFFF'};border:1px solid ${t.border};box-shadow:0 18px 40px -16px rgba(0,0,0,.35);padding:12px 14px 14px;display:flex;gap:12px;align-items:flex-start;overflow:hidden;animation:tin 8s cubic-bezier(.2,.8,.2,1) infinite}
.toastX::after{content:"";position:absolute;left:0;bottom:0;height:3px;background:${t.ok};animation:tbar 8s linear infinite}
.toastX b{display:block;font-size:13.5px}.toastX span{font-size:12px;color:${t.muted}}
.toastX .x{margin-left:auto;color:${t.muted};background:none;border:0;padding:2px;cursor:pointer}
.tkd circle{stroke-dasharray:80;stroke-dashoffset:80;animation:tkc 8s ease infinite}
.tkd path{stroke-dasharray:24;stroke-dashoffset:24;animation:tkp 8s ease infinite}
@keyframes tin{0%{transform:translateX(120%);opacity:0}6%,70%{transform:none;opacity:1}78%,100%{transform:translateX(120%);opacity:0}}
@keyframes tbar{0%,6%{width:100%}70%,100%{width:0}}
@keyframes tkc{0%,5%{stroke-dashoffset:80}14%,100%{stroke-dashoffset:0}}
@keyframes tkp{0%,12%{stroke-dashoffset:24}20%,100%{stroke-dashoffset:0}}
/* milestone progress */
.ms{position:relative;height:6px;border-radius:99px;background:${t.track};margin:6px 4px 6px 0}
.ms i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,${t.gold}88,${t.gold});animation:fillw 1.4s cubic-bezier(.2,.8,.2,1) .5s both}
.ms b{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:2px solid ${t.borderStrong};background:${t.surface};animation:msb .3s ease both}
.ms b.on{border-color:${t.gold};background:${t.gold}}
.ms b:nth-of-type(1){animation-delay:.7s}.ms b:nth-of-type(2){animation-delay:1.1s}.ms b:nth-of-type(3){animation-delay:1.5s}
@keyframes msb{from{transform:scale(0)}}
/* approve → swipe away */
.ul li.swipe{background:${t.okSoft};color:${t.ok};border-radius:10px;padding:8px 10px;border:0;margin-bottom:2px;font-size:13px;font-weight:700;animation:swipe 5s cubic-bezier(.6,0,.2,1) infinite;overflow:hidden}
@keyframes swipe{0%,35%{transform:none;opacity:1;max-height:48px}55%{transform:translateX(110%);opacity:0;max-height:48px;padding-top:8px;padding-bottom:8px}70%,100%{transform:translateX(110%);opacity:0;max-height:0;padding-top:0;padding-bottom:0;margin:0}}
/* kudos heart burst */
.hb{position:relative;display:inline-flex}
.hb svg{animation:hbeat 3s ease infinite}
.hb i{position:absolute;left:5px;top:5px;width:4px;height:4px;border-radius:50%;background:${t.bad};opacity:0;animation:hp 3s ease-out infinite}
@keyframes hbeat{0%,50%,100%{transform:scale(1)}55%{transform:scale(1.4)}62%{transform:scale(.95)}}
@keyframes hp{0%,54%{opacity:0;transform:none}58%{opacity:1}80%,100%{opacity:0;transform:translate(var(--x),var(--y))}}
/* hover lift (replaces tilt on tiles) */
.tiltX:hover,.lift:hover{transform:translateY(-4px)!important;box-shadow:0 14px 28px -16px ${isDark ? '#000' : 'rgba(122,78,14,.45)'}}
.lift{transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}
/* "View as" chart switcher — works with real radio buttons */
.vsw{position:relative;display:flex;flex-direction:column;gap:12px}
.vsw>input{position:absolute;opacity:0;pointer-events:none}
.vseg{display:flex;flex-wrap:wrap;gap:4px;background:${t.neuSoft};border-radius:9px;padding:3px;align-self:flex-start}
.vseg label{font-size:12px;font-weight:700;padding:5px 10px;border-radius:7px;color:${t.muted};cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.vviews>div{display:none;animation:rise .4s cubic-bezier(.2,.8,.2,1) both}
${[1, 2, 3, 4, 5].map((i) => `.vsw>input:nth-of-type(${i}):checked~.vviews>div:nth-child(${i}){display:block}.vsw>input:nth-of-type(${i}):checked~.vseg label:nth-child(${i}){background:${t.surface};color:${t.fg};box-shadow:${t.shadow}}.vsw>input:nth-of-type(${i}):focus-visible~.vseg label:nth-child(${i}){outline:2px solid ${t.gold}}`).join('\n')}
.ln path.l{stroke-dasharray:900;stroke-dashoffset:900;animation:ldraw 1.6s ease .1s forwards}
@keyframes ldraw{to{stroke-dashoffset:0}}
.ln .ar{animation:fadein .8s ease .8s both}
@keyframes fadein{from{opacity:0}}
.hm{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.hm i{aspect-ratio:2.6;border-radius:5px;animation:pop .35s ease both}
.hm span{font-size:10.5px;color:${t.muted};text-align:center}
.rbar{display:flex;flex-direction:column;gap:10px}
.rbar div{display:grid;grid-template-columns:90px 1fr 34px;gap:10px;align-items:center;font-size:12.5px}
.lol{display:flex;flex-direction:column;gap:12px}
.lol div{display:grid;grid-template-columns:90px 1fr 26px;gap:10px;align-items:center;font-size:12.5px}
.lol em{position:relative;height:2px;background:${t.borderStrong};display:block}
.lol em i{position:absolute;right:0;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:${t.gold};box-shadow:0 0 0 4px ${t.goldSoft}}
.lol em{animation:fillw 1s cubic-bezier(.2,.8,.2,1) both}
.tmap{display:flex;gap:4px;height:150px}
.tmap>div{display:flex;flex-direction:column;gap:4px}
.tmap span{border-radius:8px;padding:8px;font-size:11.5px;font-weight:700;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;flex:1;animation:pop .45s ease both}
@keyframes pop{from{opacity:0;transform:scale(.85)}}
</style>`;

// ───────────────────────── hero art (instead of the orb)
function dayArc(pct = 0.3) {
  const len = Math.PI * 95 * pct;
  const a = Math.PI - Math.PI * pct;
  const sx = 115 + 95 * Math.cos(a);
  const sy = 112 - 95 * Math.sin(a);
  return `<div class="heroArt" aria-label="Shift progress: 30% of your 09:30 – 18:30 shift">
<svg class="arc" width="230" height="140" viewBox="0 0 230 140" aria-hidden="true"><path class="trk" d="M20 112 A95 95 0 0 1 210 112" fill="none" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"/><path class="done" style="--len:${len.toFixed(1)}" d="M20 112 A95 95 0 0 1 210 112" fill="none" stroke="#D69E3A" stroke-width="4" stroke-linecap="round"/><g class="sun"><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="13" fill="#FFD98A" opacity=".25"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="8" fill="#FFE3A8"/></g><text x="20" y="132" fill="#BDB4A2" font-size="11" font-family="Manrope" text-anchor="middle">09:30</text><text x="210" y="132" fill="#BDB4A2" font-size="11" font-family="Manrope" text-anchor="middle">18:30</text><text x="115" y="92" fill="#FFF7E8" font-size="20" font-weight="800" font-family="Manrope" text-anchor="middle">6h 12m</text><text x="115" y="110" fill="#BDB4A2" font-size="11" font-family="Manrope" text-anchor="middle">left in your shift</text></svg></div>`;
}
function presence() {
  const ppl = [['priya', ''], ['kiran', 'wfh'], ['hema', ''], ['rohan', ''], ['neha', ''], ['amit', 'off'], ['sneha', 'off'], ['arjun', '']];
  return `<div class="heroArt" style="text-align:center"><div class="pres" aria-label="Who is in: 6 in, 2 away">${ppl.map(([k, c]) => `<span class="p ${c}">${face(k, 40)}</span>`).join('')}</div><div style="margin-top:10px;font-size:12px;color:#BDB4A2">6 in · 1 WFH · 2 away</div></div>`;
}
function pulseArt() {
  const seg = 'L10 60 L25 60 L32 40 L40 82 L48 22 L56 70 L62 60 L110 60';
  const one = (x) => `M${x} 60 ${seg.replace(/L(\d+) /g, (m, n) => `L${+n + x} `)}`;
  return `<div class="heroArt" style="text-align:center"><div class="pulse" aria-hidden="true"><svg width="440" height="110" viewBox="0 0 440 110"><path d="${one(0)} ${one(110).replace('M', 'L')} ${one(220).replace('M', 'L')} ${one(330).replace('M', 'L')}" fill="none" stroke="#5FD39B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg></div><div style="font-size:12px;color:#BDB4A2;display:flex;align-items:center;gap:6px;justify-content:center"><span class="livedot"></span>62 people active right now</div></div>`;
}

// ───────────────────────── charts
const LBL = ['W1', 'W2', 'W3', 'W4'];
function barsChart(vals, labels, col, h = 140) {
  const max = Math.max(...vals);
  return `<div class="bars" style="height:${h}px">${vals.map((v, i) => `<div><i class="vb" style="height:${Math.round((v / max) * (h - 26))}px;background:${col};animation-delay:${0.05 * i}s"></i>${labels[i]}</div>`).join('')}</div>`;
}
function lineChart(vals, labels, col, t, area = false, w = 520, h = 150) {
  const max = Math.max(...vals) * 1.1, min = Math.min(...vals) * 0.85;
  const pts = vals.map((v, i) => [20 + (i * (w - 40)) / (vals.length - 1), 10 + (1 - (v - min) / (max - min)) * (h - 40)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const id = `g${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="ln" width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>${[0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${(h - 30) * f + 10}" y2="${(h - 30) * f + 10}" stroke="${t.line}"/>`).join('')}${area ? `<path class="ar" d="${d} L${pts.at(-1)[0]} ${h - 30} L${pts[0][0]} ${h - 30} Z" fill="url(#${id})"/>` : ''}<path class="l" d="${d}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${pts.map((p) => `<circle class="ar" cx="${p[0]}" cy="${p[1]}" r="4" fill="${t.surface}" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`).join('')}${labels.map((l, i) => `<text x="${pts[i][0]}" y="${h - 8}" font-size="11" fill="${t.muted}" text-anchor="middle" font-family="Manrope">${l}</text>`).join('')}</svg>`;
}
function heatmap(t) {
  // October, starting Thursday; values = % present
  const vals = [null, null, null, 96, 92, 0, 0, 88, 94, 97, 91, 85, 0, 0, 90, 98, 93, 96, 89, 0, 0, 92, 95, 97, 99, 90, 0, 0, 94, 96, 91];
  const cell = (v, i) => v === null ? '<i style="background:transparent"></i>' : v === 0 ? `<i title="Weekend" style="background:${t.neuSoft};animation-delay:${i * 0.015}s"></i>` : `<i title="${v}% present" style="background:${t.gold};opacity:${(0.25 + ((v - 84) / 16) * 0.75).toFixed(2)};animation-delay:${i * 0.015}s"></i>`;
  return `<div class="hm">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}${vals.map(cell).join('')}</div><div class="legend" style="margin-top:8px"><span>Less</span>${[0.3, 0.5, 0.75, 1].map((o) => `<i style="background:${t.gold};opacity:${o};width:14px;height:10px"></i>`).join('')}<span>More present</span></div>`;
}
function switcher(name, views) {
  return `<div class="vsw">${views.map((v, i) => `<input type="radio" name="${name}" id="${name}-${i}"${i ? '' : ' checked'}>`).join('')}<div class="vseg" role="radiogroup" aria-label="View as">${views.map(([l, ic], i) => `<label for="${name}-${i}">${icon(ic, 13)}${l}</label>`).join('')}</div><div class="vviews">${views.map((v) => `<div>${v[2]}</div>`).join('')}</div></div>`;
}
Object.assign(require('./build-shell.js').P, {
  bar: '<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="12" y="6" width="3" height="12"/><rect x="17" y="13" width="3" height="5"/>',
  line: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  area: '<path d="M3 3v18h18"/><path d="M7 16l4-5 3 3 5-6v10H7z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  dot: '<circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/>',
  tree: '<rect x="3" y="3" width="10" height="18" rx="1"/><rect x="15" y="3" width="6" height="10" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
});

function attendanceSwitcher(t, name) {
  const v = [91, 94, 89, 96];
  return switcher(name, [
    ['Bars', 'bar', barsChart(v, LBL.map((l, i) => `${l} · ${v[i]}%`), t.gold)],
    ['Line', 'line', lineChart(v, LBL, t.gold, t)],
    ['Area', 'area', lineChart(v, LBL, t.gold, t, true)],
    ['Calendar', 'grid', heatmap(t)],
  ]);
}

// ───────────────────────── page assembly helpers
function upgradeShell(html, t, isDark) {
  return html
    .replace('<button class="hbtn" aria-label="Notifications, 3 unread">', '<button class="hbtn bellR" aria-label="Notifications, 3 unread">')
    .replace(/<button class="hbtn" aria-label="Change appearance">[\s\S]*?<\/button>/, `<button class="tgl" role="switch" aria-checked="${isDark}" aria-label="Dark mode"><span class="knob"></span></button>`)
    .replace('</header>', `</header>\n<div class="toastX" role="status"><svg class="tkd" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style="flex:none"><circle cx="14" cy="14" r="12" fill="none" stroke="${t.ok}" stroke-width="2.5"/><path d="M9 14.5l3.5 3.5L19 11" fill="none" stroke="${t.ok}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b>Leave applied</b><span>Casual leave, 12–13 Oct · sent to Rohan</span></div><button class="x" aria-label="Dismiss">${icon('plus', 14).replace('<path', '<path transform="rotate(45 12 12)"')}</button></div>`);
}
const ORB = '<div class="orbX" aria-hidden="true"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>';
const heartBurst = (t) => `<span class="heart hb">${icon('heart', 12)}${Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return `<i style="--x:${Math.round(Math.cos(a) * 14)}px;--y:${Math.round(Math.sin(a) * 14)}px"></i>`; }).join('')}`;
function greet(html, words) {
  return html.replace(/<h1>[^<]*<\/h1>/, `<h1 class="gr">${words.map((w) => `<span>${w}</span>`).join(' ')}</h1>`);
}

function finalEmployee(t, isDark) {
  let m = mixEmployee(t, isDark);
  m = m.replace(ORB, dayArc(0.3)).replace(' and two colleagues are celebrating today 🎉', ' and two colleagues are celebrating today.');
  m = greet(m, ['Good', 'morning,', 'Amit']);
  m = m.replace('<b>Complete your profile · 86%</b><span>Add emergency contact</span>', `<b>Complete your profile · 86%</b><div class="ms" aria-hidden="true"><i style="width:86%"></i><b class="on" style="left:33%"></b><b class="on" style="left:66%"></b><b style="left:100%"></b></div><span>Next: add an emergency contact</span>`);
  let n = 0;
  m = m.replace(/<span class="heart">[\s\S]*?<\/svg>/g, (s) => (n++ < 2 ? heartBurst(t) : s));
  return m;
}
function finalAdmin(t, isDark) {
  let m = mixAdmin(t, isDark);
  m = m.replace(ORB, presence());
  m = greet(m, ['Company', 'pulse,', 'today']);
  m = m.replace('<h2>Waiting for your approval</h2><span class="cnt">7</span></div><div class="bd"><ul class="ul">', `<h2>Waiting for your approval</h2><span class="cnt">7</span></div><div class="bd"><ul class="ul"><li class="swipe">${icon('check', 14)}Approved · Kiran Rao · WFH Mon – Tue</li>`);
  const a = m.indexOf('<section class="card"><div class="hd"><h2>Joiners &amp; leavers</h2>');
  const b = m.indexOf('</section>', a) + 10;
  m = m.slice(0, a) + `<section class="card"><div class="hd"><h2>Attendance this month</h2><span class="sm mut">Average 93% present</span><a href="#" style="margin-left:12px">Team attendance</a></div><div class="bd">${attendanceSwitcher(t, 'adm')}</div></section>` + m.slice(b);
  let n = 0;
  m = m.replace(/<span class="heart">[\s\S]*?<\/svg>/g, (s) => (n++ < 2 ? heartBurst(t) : s));
  return m;
}
function finalSuper(t) {
  let m = mixSuper(t);
  m = m.replace(ORB, pulseArt());
  m = greet(m, ['Good', 'morning,', 'Bhanu']);
  const signup = [3, 5, 2, 6, 4, 8];
  const mon = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  m = m.replace(/<section class="card"><div class="hd"><h2>New companies<\/h2>[\s\S]*?<\/section>/, `<section class="card"><div class="hd"><h2>New companies</h2><span class="sm mut">Last 6 months</span></div><div class="bd">${switcher('sup', [['Bars', 'bar', barsChart(signup, mon, t.gold, 120)], ['Line', 'line', lineChart(signup, mon, t.gold, t, false, 360, 120)], ['Area', 'area', lineChart(signup, mon, t.gold, t, true, 360, 120)]])}</div></section>`);
  return m;
}

function page(title, kind, crumb, t, isDark, h, body) {
  return upgradeShell(shellPage(title, kind, crumb, t, isDark, h, body, mixCss(t, isDark) + finalCss(t, isDark)), t, isDark);
}

// ───────────────────────── Hero art options board
function heroArtBoard() {
  const opt = (name, best, art, rec, why) => `<section class="ho"><div class="hx">${art}</div><div class="hb2"><div style="display:flex;align-items:center;gap:8px"><h2>${name}</h2>${rec ? '<span class="rec">Recommended</span>' : ''}</div><span class="best">${best}</span><p>${why}</p></div></section>`;
  const aurora = `<div class="aur"><i></i><i></i><i></i></div>`;
  const iso = `<div class="iso"><div class="l1"></div><div class="l2"></div><div class="l3">13 people</div></div>`;
  const sky = `<div class="sky"><div class="sunb"></div><div class="hill"></div></div>`;
  const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:#0B0A08}
.wrap{font-family:Manrope,system-ui,sans-serif;color:#EDEDEF;padding:40px;background:#0B0A08}
.wrap h1{margin:0 0 6px;font-size:30px;font-weight:800;letter-spacing:-.02em}
.wrap>p{margin:0 0 24px;color:#A9A59C;max-width:900px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.ho{border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#12100C;display:flex;flex-direction:column}
.hx{height:220px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:radial-gradient(420px 220px at 75% 20%,rgba(214,158,58,.32),transparent 62%),linear-gradient(135deg,#221A0E,#120F0A 62%)}
.hb2{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.hb2 h2{margin:0;font-size:16px;font-weight:800}
.best{font-size:12px;font-weight:700;color:#E8BD6E}
.hb2 p{margin:0;font-size:13px;color:#A9A59C;line-height:1.5}
.rec{font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;background:#12291D;color:#5FD39B}
.livedot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#5FD39B;animation:live 2s infinite}
@keyframes live{0%{box-shadow:0 0 0 0 #5FD39B88}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.aur{position:absolute;inset:0;filter:blur(30px)}
.aur i{position:absolute;width:180px;height:180px;border-radius:50%;opacity:.7;animation:drift 9s ease-in-out infinite alternate}
.aur i:nth-child(1){background:#D69E3A;left:10%;top:10%}.aur i:nth-child(2){background:#2C7A7B;right:10%;top:20%;animation-delay:-3s}.aur i:nth-child(3){background:#7A4E0E;left:35%;bottom:-20%;animation-delay:-6s}
@keyframes drift{to{transform:translate(60px,-30px) scale(1.2)}}
.iso{position:relative;width:170px;height:120px;transform:rotateX(55deg) rotateZ(-45deg);transform-style:preserve-3d}
.iso div{position:absolute;inset:0;border-radius:14px;border:1px solid rgba(255,255,255,.15);animation:lift 3.6s ease-in-out infinite}
.iso .l1{background:rgba(94,184,176,.25);--z:0px}.iso .l2{background:rgba(214,158,58,.3);animation-delay:.2s;--z:24px}.iso .l3{background:rgba(255,247,232,.12);animation-delay:.4s;--z:48px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#FFF7E8}
@keyframes lift{0%,100%{transform:translateZ(0)}50%{transform:translateZ(var(--z))}}
.sky{position:absolute;inset:0;animation:skyc 12s ease-in-out infinite;background:linear-gradient(#F6C27A,#F4E1C1)}
@keyframes skyc{0%{background:linear-gradient(#F6C27A,#F4E1C1)}33%{background:linear-gradient(#7FB7E6,#DDEFFB)}66%{background:linear-gradient(#C9643A,#3A2346)}100%{background:linear-gradient(#0E1330,#2A2A5A)}}
.sunb{position:absolute;width:46px;height:46px;border-radius:50%;background:#FFE3A8;box-shadow:0 0 40px #FFD98A;left:10%;top:60%;animation:sunm 12s ease-in-out infinite}
@keyframes sunm{0%{left:10%;top:60%}33%{left:45%;top:15%}66%{left:80%;top:55%;background:#FF9A5A}100%{left:80%;top:20%;background:#EDEDF5;box-shadow:0 0 30px #EDEDF5}}
.hill{position:absolute;left:-10%;right:-10%;bottom:-60px;height:120px;border-radius:50%;background:#1C160D}
${finalCss(dark, true).replace(/<\/?style>/g, '')}
${mixCss(dark, true).replace(/<\/?style>/g, '').replace(/\.cols[^}]*\}/g, '')}
</style>\n</helmet>`;
  const html = `<div class="wrap"><h1>Hero art — instead of the 3D orb / globe</h1><p>Each option says something true about the moment, so the art earns its place. My pick: a different one per role — the day arc for employees, team presence for admins, platform pulse for Super Admin. All of them pick up the active theme’s colour.</p>
<div class="grid">
${opt('Day arc', 'Employee home', dayArc(0.3).replace('class="heroArt"', 'class="heroArt" style="grid-column:auto"'), true, 'The sun travels along your shift: where you are in the day, how much is left. Fills from check-in to check-out.')}
${opt('Team presence', 'Company Admin / HR, managers', presence().replace('class="heroArt"', 'class="heroArt" style="grid-column:auto"'), true, 'Real profile photos with a live dot: green in, teal WFH, faded away. Hover a face to see their status.')}
${opt('Platform pulse', 'Super Admin', pulseArt().replace('class="heroArt"', 'class="heroArt" style="grid-column:auto"'), true, 'A heartbeat line that speeds up with activity and turns amber if the API slows down — health at a glance.')}
${opt('Sky by time of day', 'Employee home (alternative)', sky, false, 'Morning gold, midday blue, evening dusk, night — the hero matches the time when you open the portal.')}
${opt('Aurora glow', 'Any role · login page', aurora, false, 'Slow drifting light in the theme colours. Pure atmosphere, no meaning — calmest option.')}
${opt('Floating layers', 'Empty states · onboarding', iso, false, 'Your organisation as stacked layers (teams, departments, company). Good for setup and empty screens.')}
</div></div>`;
  return dcPage('Hero art options', css, html, 1000);
}

// ───────────────────────── Chart styles board (interactive)
function chartBoard(t) {
  const leave = [['Casual', 9, 12, t.gold], ['Sick', 12, 12, t.bad], ['Earned', 15, 15, t.ok]];
  const ring = (a, tot, col, lbl) => { const r = 34, c = 2 * Math.PI * r; return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" fill="none" stroke="${t.track}" stroke-width="8"/><circle class="ringfill" cx="42" cy="42" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * a) / tot} ${c}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" font-size="16" font-weight="800" fill="${t.fg}" font-family="Manrope">${a}</text></svg><span class="xs mut">${lbl} · of ${tot}</span></div>`; };
  const leaveViews = [
    ['Rings', 'pie', `<div style="display:flex;justify-content:space-around;padding:8px 0">${leave.map(([n, a, tot, c]) => ring(a, tot, c, n)).join('')}</div>`],
    ['Bars', 'list', `<div class="rbar">${leave.map(([n, a, tot, c]) => `<div><span>${n}</span><div class="meter" style="height:10px"><i style="width:${(a / tot) * 100}%;background:${c}"></i></div><b>${a}/${tot}</b></div>`).join('')}</div>`],
    ['Donut', 'pie', `<div style="display:flex;align-items:center;gap:20px"><div class="donutX">${donut(leave.map(([, a, , c]) => [a, c]), 130, 16, '<b style="font-size:22px">36</b><span class="xs mut">days left</span>', t.track)}</div><div class="sm" style="display:flex;flex-direction:column;gap:8px">${leave.map(([n, a, , c]) => `<span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin-right:8px"></i>${n} <b>${a}</b></span>`).join('')}</div></div>`],
    ['Tiles', 'grid', `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${leave.map(([n, a, tot, c]) => `<div class="lt lift"><span class="sm" style="font-weight:700">${n}</span><div class="n"><b>${a}</b><span>of ${tot}</span></div><div class="meter"><i style="width:${(a / tot) * 100}%;background:${c}"></i></div></div>`).join('')}</div>`],
  ];
  const dept = [['Engineering', 6, t.gold], ['People', 2, '#2C7A7B'], ['Finance', 2, '#7A4E9E'], ['Sales', 2, '#C2560C'], ['Operations', 1, '#4A4A52']];
  const deptViews = [
    ['Bars', 'list', `<div class="rbar">${dept.map(([n, v]) => `<div><span>${n}</span><div class="meter" style="height:10px"><i style="width:${(v / 6) * 100}%;background:${t.gold}"></i></div><b>${v}</b></div>`).join('')}</div>`],
    ['Donut', 'pie', `<div style="display:flex;align-items:center;gap:20px"><div class="donutX">${donut(dept.map(([, v, c]) => [v, c]), 130, 16, '<b style="font-size:22px">13</b><span class="xs mut">people</span>', t.track)}</div><div class="sm" style="display:flex;flex-direction:column;gap:6px">${dept.map(([n, v, c]) => `<span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin-right:8px"></i>${n} <b>${v}</b></span>`).join('')}</div></div>`],
    ['Lollipop', 'dot', `<div class="lol">${dept.map(([n, v], i) => `<div><span>${n}</span><em style="width:${(v / 6) * 100}%;animation-delay:${i * 0.06}s"><i></i></em><b>${v}</b></div>`).join('')}</div>`],
    ['Blocks', 'tree', `<div class="tmap"><div style="flex:6"><span style="background:${t.gold}">Engineering<br>6</span></div><div style="flex:4"><span style="background:#2C7A7B">People · 2</span><span style="background:#7A4E9E;animation-delay:.08s">Finance · 2</span></div><div style="flex:3"><span style="background:#C2560C;animation-delay:.12s">Sales · 2</span><span style="background:#4A4A52;animation-delay:.16s">Ops · 1</span></div></div>`],
  ];
  const hours = [[38, 41, 36, 40, 42, 39], ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']];
  const hoursViews = [
    ['Line', 'line', lineChart(hours[0], hours[1], t.gold, t)],
    ['Area', 'area', lineChart(hours[0], hours[1], t.gold, t, true)],
    ['Bars', 'bar', barsChart(hours[0], hours[1].map((m, i) => `${m} · ${hours[0][i]}h`), t.gold)],
  ];
  const body = `
<section class="card" style="padding:22px 24px;gap:8px"><h1 style="margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em">Choose how you see your data</h1><p class="mut" style="margin:0;max-width:820px">Every chart card gets a <b>View as</b> switch. Try it — these buttons work. Your choice is remembered per chart for you; admins can set the company default. The data, colours and animations stay the same in every style.</p></section>
<div class="pair">
  <section class="card"><div class="hd"><h2>Attendance this month</h2><span class="sm mut">Team average</span></div><div class="bd">${attendanceSwitcher(t, 'att')}</div></section>
  <section class="card"><div class="hd"><h2>Leave balance</h2><span class="sm mut">36 days left</span></div><div class="bd">${switcher('lv', leaveViews)}</div></section>
</div>
<div class="pair">
  <section class="card"><div class="hd"><h2>Headcount by department</h2><span class="sm mut">13 people</span></div><div class="bd">${switcher('dp', deptViews)}</div></section>
  <section class="card"><div class="hd"><h2>Average hours per week</h2><span class="sm mut">Last 6 months</span></div><div class="bd">${switcher('hr', hoursViews)}</div></section>
</div>
<section class="card"><div class="hd"><h2>Which styles each chart offers</h2></div><div class="bd"><table><thead><tr><th>Chart</th><th>Styles</th><th>Default</th></tr></thead><tbody>
<tr><td><b>Attendance (my month, team month)</b></td><td>Bars · Line · Area · Calendar heatmap</td><td>Calendar for me, Bars for teams</td></tr>
<tr><td><b>Leave balance</b></td><td>Rings · Bars · Donut · Tiles</td><td>Tiles</td></tr>
<tr><td><b>Headcount by department / location</b></td><td>Bars · Donut · Lollipop · Blocks</td><td>Bars</td></tr>
<tr><td><b>Trends (hours, joiners &amp; leavers, claims, sign-ups)</b></td><td>Line · Area · Bars</td><td>Line</td></tr>
<tr><td><b>Status splits (attendance today, ticket status)</b></td><td>Donut · Bars · Stacked bar</td><td>Donut</td></tr></tbody></table></div></section>`;
  const css = `<helmet>\n${helmetFonts}\n<style>body{margin:0;background:${t.bg}}a{color:${t.link}}</style>\n${require('./build-balanced.js').balCss(t, false)}\n${mixCss(t, false)}\n${finalCss(t, false)}\n</helmet>`;
  return dcPage('Chart styles', css, `<main class="main" style="max-width:1440px">${body}</main>`, 1500);
}

// ───────────────────────── Theme adaptation board
function themeBoard() {
  const themes = [
    ['Obsidian Gold', '#B7791F', '#F6EBD6', '#7A4E0E', '#18181B', '#0F0F12'],
    ['Indigo Classic', '#4F46E5', '#E0E7FF', '#3730A3', '#FFFFFF', '#1E1B4B'],
    ['Emerald', '#047857', '#D1FAE5', '#065F46', '#FFFFFF', '#022C22'],
    ['Rose', '#E11D48', '#FFE4E6', '#9F1239', '#FFFFFF', '#4C0519'],
  ];
  const col = ([name, acc, soft, txt, onAcc, side]) => `<section class="th" style="--acc:${acc};--soft:${soft};--atx:${txt};--on:${onAcc};--side:${side}">
  <div class="thh"><span class="sw" style="background:${acc}"></span><b>${name}</b></div>
  <div class="mini"><div class="msb"><i></i><i class="on"></i><i></i><i></i></div><div class="mhero"><span class="eb2">Sunday, 4 October</span><b class="gr"><span>Good</span> <span>morning,</span> <span>Amit</span></b><a class="pbtn" href="#">Apply leave</a></div></div>
  <div class="row2"><svg class="rg" width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="none" stroke="#EEE9DF" stroke-width="7"/><circle class="v" cx="35" cy="35" r="28" fill="none" stroke="${acc}" stroke-width="7" stroke-linecap="round" stroke-dasharray="120 176" transform="rotate(-90 35 35)"/></svg>
    <div class="bars2">${[5, 8, 6, 9, 7].map((v, i) => `<i style="height:${v * 6}px;animation-delay:${i * 0.07}s"></i>`).join('')}</div></div>
  <div class="ms2"><i></i><b class="on" style="left:33%"></b><b class="on" style="left:66%"></b><b style="left:100%"></b></div>
  <div class="cel2">${face('hema', 44)}<div class="medal2"><div>2</div></div><div><b>Hema · 2 years</b><span>Work anniversary</span></div></div>
  <div class="toast2"><svg class="tkd" width="24" height="24" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke="#157A4B" stroke-width="2.5"/><path d="M9 14.5l3.5 3.5L19 11" fill="none" stroke="#157A4B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b>Leave applied</b><span>Sent to Rohan</span></div></div>
  <div class="row3"><button class="chip2">Give kudos</button><span class="hb3">${icon('heart', 18)}</span><button class="tg2" role="switch" aria-checked="false" aria-label="Dark mode"><span></span></button></div>
</section>`;
  const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:#F6F4EF}
.wrap{font-family:Manrope,system-ui,sans-serif;color:#18181B;padding:40px}
.wrap h1{margin:0 0 6px;font-size:28px;font-weight:800;letter-spacing:-.02em}
.wrap>p{margin:0 0 24px;color:#5B5B63;max-width:920px;line-height:1.5}
.g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.th{background:#fff;border:1px solid #E7E1D6;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:14px}
.thh{display:flex;align-items:center;gap:8px;font-size:15px}.sw{width:16px;height:16px;border-radius:50%}
.mini{display:flex;border-radius:12px;overflow:hidden;border:1px solid #EEE9DF;height:120px}
.msb{width:44px;background:var(--side);display:flex;flex-direction:column;gap:6px;padding:10px 8px}
.msb i{height:8px;border-radius:4px;background:rgba(255,255,255,.18)}.msb i.on{background:var(--acc)}
.mhero{flex:1;padding:12px;display:flex;flex-direction:column;gap:6px;background:linear-gradient(135deg,var(--soft),#fff);position:relative;overflow:hidden}
.mhero::before{content:"";position:absolute;inset:0;background:radial-gradient(120px 80px at var(--sx) 30%,rgba(255,255,255,.7),transparent 70%);animation:spot 6s ease-in-out infinite alternate}
@property --sx{syntax:'<percentage>';inherits:false;initial-value:10%}
@keyframes spot{to{--sx:90%}}
.eb2{font-size:10px;font-weight:700;color:var(--atx)}
.mhero b{font-size:16px;position:relative}
.gr span{display:inline-block;animation:wr 4s cubic-bezier(.2,.8,.2,1) infinite}.gr span:nth-child(2){animation-delay:.12s}.gr span:nth-child(3){animation-delay:.24s;color:var(--acc)}
@keyframes wr{0%{opacity:0;transform:translateY(8px)}15%,85%{opacity:1;transform:none}100%{opacity:0}}
.pbtn{align-self:flex-start;margin-top:auto;font-size:11px;font-weight:800;padding:6px 10px;border-radius:7px;background:var(--acc);color:var(--on);text-decoration:none;position:relative;transition:transform .25s}
.pbtn:hover{transform:translateY(-3px)}
.row2{display:flex;align-items:center;justify-content:space-between}
.rg .v{animation:ring 3s cubic-bezier(.2,.8,.2,1) infinite alternate}@keyframes ring{from{stroke-dasharray:0 176}}
.bars2{display:flex;align-items:flex-end;gap:6px;height:56px}.bars2 i{width:14px;border-radius:4px 4px 1px 1px;background:var(--acc);animation:gy 3s ease infinite;transform-origin:bottom}
@keyframes gy{0%{transform:scaleY(0)}30%,100%{transform:none}}
.ms2{position:relative;height:6px;border-radius:99px;background:#EEE9DF;margin:4px 6px}
.ms2 i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--acc);animation:mf 3.4s ease infinite}
@keyframes mf{0%{width:0}60%,100%{width:86%}}
.ms2 b{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;border:2px solid #D9D0BF}
.ms2 b.on{background:var(--acc);border-color:var(--acc)}
.cel2{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:var(--soft)}
.cel2 b{display:block;font-size:13px}.cel2 span{font-size:11.5px;color:#5B5B63}
.medal2{width:34px;height:34px;perspective:300px}.medal2 div{width:100%;height:100%;border-radius:50%;background:var(--acc);color:var(--on);display:flex;align-items:center;justify-content:center;font-weight:800;animation:flip 4s ease-in-out infinite}
@keyframes flip{0%,60%{transform:none}80%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
.toast2{display:flex;gap:10px;align-items:center;padding:10px;border-radius:10px;border:1px solid #E7E1D6;position:relative;overflow:hidden;font-size:12px}
.toast2 b{display:block}.toast2 span{color:#5B5B63}
.toast2::after{content:"";position:absolute;left:0;bottom:0;height:3px;background:#157A4B;animation:tb 4s linear infinite}@keyframes tb{from{width:100%}to{width:0}}
.tkd circle{stroke-dasharray:80;stroke-dashoffset:80;animation:tkc 4s ease infinite}.tkd path{stroke-dasharray:24;stroke-dashoffset:24;animation:tkp 4s ease infinite}
@keyframes tkc{0%{stroke-dashoffset:80}25%,100%{stroke-dashoffset:0}}@keyframes tkp{0%,20%{stroke-dashoffset:24}35%,100%{stroke-dashoffset:0}}
.row3{display:flex;align-items:center;gap:10px}
.chip2{height:34px;padding:0 12px;border-radius:99px;border:1px solid var(--acc);background:#fff;color:var(--atx);font:inherit;font-size:12px;font-weight:800;transition:transform .25s,box-shadow .25s}
.chip2:hover{transform:translateY(-3px);box-shadow:0 10px 18px -10px var(--acc)}
.hb3{color:#B42318;animation:hbeat 2.4s ease infinite}@keyframes hbeat{0%,40%,100%{transform:scale(1)}45%{transform:scale(1.35)}55%{transform:scale(.95)}}
.tg2{margin-left:auto;width:52px;height:28px;border-radius:99px;border:1px solid #E7E1D6;background:#F3EEE4;position:relative;padding:0}
.tg2 span{position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:var(--acc);animation:tk 4s ease-in-out infinite}@keyframes tk{0%,40%{transform:none}50%,90%{transform:translateX(24px)}100%{transform:none}}
.notes{margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.notes div{background:#fff;border:1px solid #E7E1D6;border-radius:14px;padding:16px;font-size:13px;line-height:1.6;color:#3A3A42}
.notes b{display:block;font-size:14px;color:#18181B;margin-bottom:4px}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>\n</helmet>`;
  const html = `<div class="wrap"><h1>Animations follow the theme</h1><p>Yes — every animated element reads the active theme’s colours, so when a company or an employee switches theme, the buttons, rings, bars, milestones, celebration medals, toggles and hover glows all change with it. Below: the same pieces in four themes, all live.</p>
<div class="g4">${themes.map(col).join('')}</div>
<div class="notes"><div><b>Changes with the theme</b>Accent colour, soft backgrounds, glows, chart colours, focus rings, the sidebar marker, hero art tint, confetti.</div><div><b>Stays the same on purpose</b>Green = success, red = problem, amber = waiting. They’re tuned per theme for contrast but keep their meaning — a red “approved” would confuse people.</div><div><b>Phase 2 ready</b>Speed and style of motion become theme settings too, so the 2–3 whole-UI themes in phase 2 can each feel different (calm, crisp, playful).</div></div></div>`;
  return dcPage('Theme adaptive motion', css, html, 1180);
}

// ───────────────────────── Final motion set + performance board
function motionFinalBoard() {
  const css = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:#0B0A08}
.mb{font-family:Manrope,system-ui,sans-serif;color:#EDEDEF;padding:40px;background:radial-gradient(900px 400px at 80% 0%,#2E2210,transparent 60%),#0B0A08}
.mb h1{margin:0 0 6px;font-size:30px;font-weight:800;letter-spacing:-.02em}
.mb .lead{margin:0 0 24px;color:#A9A59C;max-width:920px}
.g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.demo{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px}
.demo h2{margin:0;font-size:14.5px;font-weight:800}.where{font-size:11px;font-weight:700;color:#E8BD6E}
.demo p{margin:0;color:#A9A59C;font-size:12.5px;line-height:1.5}
.stage{height:140px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(0,0,0,.3);position:relative;overflow:hidden}
.pm{width:200px;height:10px;border-radius:99px;background:rgba(255,255,255,.08);position:relative}
.pm i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#8A5A12,#D69E3A);animation:pmf 3.4s ease infinite}
.pm b{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#15130F;border:2px solid rgba(255,255,255,.2);animation:pmb 3.4s ease infinite}
@keyframes pmf{0%{width:0}70%,100%{width:86%}}@keyframes pmb{0%,40%{border-color:rgba(255,255,255,.2);background:#15130F}50%,100%{border-color:#D69E3A;background:#D69E3A}}
.sw{width:220px;display:flex;flex-direction:column;gap:6px}.sw div{height:30px;border-radius:9px;background:rgba(255,255,255,.07);display:flex;align-items:center;padding:0 10px;font-size:12px}
.sw .gone{animation:swp 3.2s cubic-bezier(.6,0,.2,1) infinite;background:rgba(95,211,155,.18);color:#5FD39B;overflow:hidden}
@keyframes swp{0%,30%{transform:none;opacity:1;height:30px}55%{transform:translateX(120%);opacity:0;height:30px}75%,100%{transform:translateX(120%);opacity:0;height:0;margin-top:-6px}}
.ck path{stroke-dasharray:60;stroke-dashoffset:60;animation:draw 2.6s ease infinite}.ck circle{stroke-dasharray:240;stroke-dashoffset:240;animation:drawc 2.6s ease infinite}
@keyframes draw{30%{stroke-dashoffset:60}55%,100%{stroke-dashoffset:0}}@keyframes drawc{0%{stroke-dashoffset:240}35%,100%{stroke-dashoffset:0}}
.win{position:absolute;inset:12px;border-radius:8px;border:1px solid rgba(255,255,255,.1)}
.win::before{content:"";position:absolute;left:0;right:0;top:0;height:18px;border-bottom:1px solid rgba(255,255,255,.08)}
.toast{position:absolute;top:26px;right:20px;width:150px;border-radius:8px;background:#1C1A16;border:1px solid rgba(255,255,255,.12);padding:7px 9px;font-size:10.5px;animation:tin 4s cubic-bezier(.2,.8,.2,1) infinite;overflow:hidden}
.toast::after{content:"";position:absolute;left:0;bottom:0;height:2px;background:#5FD39B;animation:tbar 4s linear infinite}
@keyframes tin{0%{transform:translateX(130%)}10%,80%{transform:none}90%,100%{transform:translateX(130%)}}@keyframes tbar{0%,10%{width:100%}80%,100%{width:0}}
.hb{position:relative;color:#FF8A7A;animation:hbeat 2.4s ease infinite}@keyframes hbeat{0%,40%,100%{transform:scale(1)}45%{transform:scale(1.35)}55%{transform:scale(.95)}}
.hb i{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#FF8A7A;opacity:0;animation:hp 2.4s ease-out infinite}
@keyframes hp{0%,44%{opacity:0;transform:translate(-50%,-50%)}50%{opacity:1}80%,100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y)))}}
.bell{position:relative;width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;animation:ring 3s ease infinite;transform-origin:50% 10%}
.bell b{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:99px;background:#D69E3A;color:#18181B;font-size:11px;display:flex;align-items:center;justify-content:center;animation:bpop 3s cubic-bezier(.3,1.8,.5,1) infinite}
@keyframes ring{0%,60%,100%{transform:none}64%{transform:rotate(14deg)}68%{transform:rotate(-12deg)}72%{transform:rotate(8deg)}76%{transform:rotate(-4deg)}}@keyframes bpop{0%,58%{transform:scale(1)}62%{transform:scale(1.5)}70%,100%{transform:scale(1)}}
.cal{display:grid;grid-template-columns:repeat(7,22px);gap:4px}.cal i{height:22px;border-radius:6px;background:rgba(255,255,255,.06)}.cal i.s{animation:sel 3.2s ease infinite}
@keyframes sel{0%,10%{background:rgba(255,255,255,.06)}30%,85%{background:#D69E3A}100%{background:rgba(255,255,255,.06)}}
.tr span{display:inline-block;opacity:0;animation:wr 3.6s ease infinite;font-size:20px;font-weight:800}@keyframes wr{0%{opacity:0;transform:translateY(10px)}15%,80%{opacity:1;transform:none}95%,100%{opacity:0}}
.sp{width:190px;height:96px;border-radius:14px;background:#15130F;border:1px solid rgba(255,255,255,.08);position:relative;overflow:hidden}
.sp::after{content:"";position:absolute;inset:0;background:radial-gradient(110px 80px at var(--x) 40%,rgba(214,158,58,.3),transparent 70%);animation:spx 3s ease-in-out infinite alternate}
@property --x{syntax:'<percentage>';inherits:false;initial-value:0%}@keyframes spx{to{--x:100%}}
.tg{width:76px;height:38px;border-radius:99px;background:#F3EEE4;position:relative;animation:tbg 4s ease-in-out infinite;overflow:hidden}
.tg span{position:absolute;top:4px;left:4px;width:30px;height:30px;border-radius:50%;background:#F2B65A;box-shadow:0 0 12px #F2B65A;animation:tk 4s ease-in-out infinite}
.tg span::after{content:"";position:absolute;width:22px;height:22px;border-radius:50%;top:-5px;right:-20px;animation:tm 4s ease-in-out infinite;background:#F3EEE4}
@keyframes tk{0%,40%{transform:none;background:#F2B65A}50%,90%{transform:translateX(38px);background:#E9E3D6;box-shadow:0 0 8px #E9E3D655}100%{transform:none}}
@keyframes tm{0%,40%{right:-20px;background:#F3EEE4}50%,90%{right:-6px;background:#1E1B16}100%{right:-20px}}
@keyframes tbg{0%,40%{background:#F3EEE4}50%,90%{background:#1E1B16}}
.hl{display:flex;gap:10px}.hl i{width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.07);animation:lift 2.4s ease infinite}.hl i:nth-child(2){animation-delay:.3s}.hl i:nth-child(3){animation-delay:.6s}
@keyframes lift{0%,40%,100%{transform:none;box-shadow:none}20%{transform:translateY(-6px);box-shadow:0 12px 20px -10px #D69E3A;background:rgba(214,158,58,.25)}}
.sec{margin:26px 0 12px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#E8BD6E}
.perf{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.pc{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px}
.pc .big{font-size:30px;font-weight:800;letter-spacing:-.02em;color:#5FD39B}
.pc h3{margin:6px 0 6px;font-size:14px}.pc p{margin:0;font-size:12.5px;color:#A9A59C;line-height:1.55}
.list{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.list ul{margin:0;padding-left:18px;color:#C9C5BC;font-size:13px;line-height:1.75}.list b{color:#F0C985}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>\n</helmet>`;
  const D = (title, where, stage, text) => `<div class="demo"><div class="stage">${stage}</div><h2>${title}</h2><span class="where">${where}</span><p>${text}</p></div>`;
  const heart = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<i style="--x:${Math.round(Math.cos(a) * 34)}px;--y:${Math.round(Math.sin(a) * 34)}px"></i>`; }).join('');
  const html = `<div class="mb"><h1>Final animation set</h1><p class="lead">The eleven you picked, live, plus the first-round ones already built into the screens (count-up numbers, ring and bar fills, check-in pulse, celebration confetti, 3D medal and badge, staggered entrance, shimmer loading). The 3D globe and the gold orb are gone.</p>
<div class="g">
${D('Milestone progress', 'Profile completion, onboarding', '<div class="pm"><i></i><b style="left:30%"></b><b style="left:60%"></b><b style="left:86%"></b></div>', 'The bar fills and each milestone lights up as it’s passed.')}
${D('Approve → swipe away', 'Approvals, Needs your action', '<div class="sw"><div>Leave · Priya · 2 days</div><div class="gone">✓ Approved · Kiran · WFH</div><div>Expense · Neha · ₹2,400</div></div>', 'The row slides out and the list closes up.')}
${D('Success tick draws', 'After every submit', '<svg class="ck" width="84" height="84" viewBox="0 0 90 90"><circle cx="45" cy="45" r="38" fill="none" stroke="#5FD39B" stroke-width="4"/><path d="M28 46 l12 12 l22 -24" fill="none" stroke="#5FD39B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Ring then tick, in dialogs and inside the toast.')}
${D('Toast with timer · top right', 'All save / error messages', '<div class="win"></div><div class="toast"><b style="color:#5FD39B">Leave applied</b><div style="color:#A9A59C">Sent to Rohan</div></div>', 'Slides in at the top-right under the top bar; the bar shows time left; hover keeps it.')}
${D('Kudos heart burst', 'Kudos, Celebrations', `<div class="hb"><svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>${heart}</div>`, 'Liking or sending kudos.')}
${D('Notification bell', 'Top bar', '<div class="bell"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><b>3</b></div>', 'One ring and a count pop when something new arrives.')}
${D('Date range sweep', 'Apply leave, WFH', `<div class="cal">${Array.from({ length: 21 }, (_, i) => `<i class="${i >= 9 && i <= 12 ? 's' : ''}" style="animation-delay:${i >= 9 ? (i - 9) * 0.12 : 0}s"></i>`).join('')}</div>`, 'Chosen days fill one after another.')}
${D('Greeting reveal', 'Hero, first visit of the day', '<div class="tr"><span>Good</span> <span style="animation-delay:.12s">morning,</span> <span style="animation-delay:.24s;color:#E8BD6E">Amit</span></div>', 'Once a day only — not on every page.')}
${D('Pointer spotlight', 'Hero (desktop)', '<div class="sp"></div>', 'A soft light follows the pointer across the hero.')}
${D('Light ↔ dark toggle', 'Top bar — only Light and Dark', '<div class="tg"><span></span></div>', 'One click switches; the sun turns into a moon while the page cross-fades. No “System” option.')}
${D('Hover lift', 'Tiles, quick actions, cards', '<div class="hl"><i></i><i></i><i></i></div>', 'Rises slightly with a theme-coloured glow.')}
${D('Chart styles switch', 'Every chart card', '<div style="display:flex;gap:4px;background:rgba(255,255,255,.06);padding:3px;border-radius:8px;font-size:11px;font-weight:700"><span style="padding:5px 9px;border-radius:6px;background:#2A2114;color:#F0C985">Bars</span><span style="padding:5px 9px;color:#A9A59C">Line</span><span style="padding:5px 9px;color:#A9A59C">Area</span><span style="padding:5px 9px;color:#A9A59C">Calendar</span></div>', 'Switching style redraws the same data with a short draw-in.')}
</div>

<div class="sec">Effect on speed — your question</div>
<div class="perf">
<div class="pc"><div class="big">0 ms</div><h3>API response time</h3><p>Animations run only in the browser. The server does the same work and sends the same data. The only new data is today’s celebrations and the kudos list — both come from endpoints we already have.</p></div>
<div class="pc"><div class="big">≈ 10 KB</div><h3>Extra download</h3><p>All effects are CSS (≈ 5 KB compressed). New chart styles are small SVG widgets (≈ 5 KB). No animation library and no 3D engine needed.</p></div>
<div class="pc"><div class="big">± 0 s</div><h3>Page load time</h3><p>Content shows as soon as data arrives; animations play on top and never block clicks. First-load numbers finish within 0.6 s.</p></div>
<div class="pc"><div class="big">&lt; 2%</div><h3>CPU while open</h3><p>Only transform and opacity are animated (graphics card, no re-layout). Loops (carousel, kudos, check-in pulse) pause when off-screen or the tab is hidden.</p></div>
</div>
<div class="list"><div class="pc"><h3>The real cost to watch: profile photos</h3><ul><li>Celebrations, kudos and presence show many photos at once</li><li>We’ll serve <b>small thumbnails</b> (64 px, ≈ 4 KB) instead of full uploads</li><li>Photos load lazily and are cached; initials show until they arrive</li></ul></div>
<div class="pc"><h3>How we’ll keep it honest</h3><ul><li>Measure home load before and after (Lighthouse + our perf scripts)</li><li>Budget: no more than <b>+50 ms</b> to first content, <b>+15 KB</b> download</li><li>“Reduce motion” in Preferences turns every animation off</li><li>Phones get lighter motion (no pointer effects)</li></ul></div></div>
</div>`;
  return dcPage('Final animation set', css, html, 1500);
}

// ───────────────────────── write
const boards = [
  ['Main.dc.html', 'Final · Employee home', () => page('Employee home', 'employee', 'Home', light, false, 1660, finalEmployee(light, false)), 1660, { interactive: false }],
  ['EmployeeDark.dc.html', 'Final · Employee home (dark)', () => page('Employee home dark', 'employee', 'Home', dark, true, 1660, finalEmployee(dark, true)), 1660],
  ['Admin.dc.html', 'Final · Company Admin / HR home — try the chart “View as” switch', () => page('Admin home', 'admin', 'Home', light, false, 1640, finalAdmin(light, false)), 1640, { interactive: true }],
  ['SuperAdmin.dc.html', 'Final · Super Admin overview', () => page('Super Admin overview', 'super', 'Platform', light, false, 1160, finalSuper(light)), 1160, { interactive: true }],
  ['HeroArt.dc.html', 'Hero art options — instead of the orb / globe', heroArtBoard, 1000],
  ['ChartStyles.dc.html', 'Chart styles — choose how you see your data (works)', () => chartBoard(light), 1500, { interactive: true }],
  ['ThemeAdaptive.dc.html', 'Animations follow the theme', themeBoard, 1180],
  ['MotionFinal.dc.html', 'Final animation set + effect on speed', motionFinalBoard, 1500],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const pos = { 'Main.dc.html': [0, 0], 'EmployeeDark.dc.html': [1520, 0], 'Admin.dc.html': [3040, 0], 'SuperAdmin.dc.html': [4560, 0], 'HeroArt.dc.html': [0, 2100], 'ChartStyles.dc.html': [1520, 2100], 'ThemeAdaptive.dc.html': [3040, 2100], 'MotionFinal.dc.html': [4560, 2100] };
const canvas = {
  v: 3, createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }, title: 'HRMS final dashboards', launch: { view: 'canvas' }, pages: [], designSystems: [],
  boards: Object.fromEntries(boards.map(([f, title, , h, o]) => [f, { x: pos[f][0], y: pos[f][1], w: 1440, h, title, expand: 'fill', ...(o?.interactive ? { is_interactive: true } : {}) }])),
  order: boards.map((b) => b[0]),
  notes: {
    n1: { kind: 'title1', x: 0, y: -300, maxW: 6000, text: 'Final dashboards — balanced layout, living hero, the animations you picked' },
    n2: { kind: 'title1', x: 0, y: 1800, maxW: 6000, text: 'Hero art · chart styles · theme-adaptive motion · speed' },
  },
};
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards in', OUT);
