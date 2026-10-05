// "Mix" homes: balanced layout + Bento-style hero + meaningful motion,
// with the Celebrations (birthdays + anniversaries) and Kudos moving cards.
// Plus "Motion library v2" — more animation ideas (no globe).
const fs = require('fs');
const { icon, balCss, helmetFonts, shellPage, dcPage, donut } = require('./build-balanced.js');
const { light, dark } = require('./build-gold.js');
const dir = __dirname;

// ── Profile pictures (illustrated portraits so the boards need no external images)
const PEOPLE = {
  priya: { name: 'Priya Sharma', bg: '#F6D9C8', skin: '#E8B48F', hair: '#2B1B14', shirt: '#B7791F', long: true },
  kiran: { name: 'Kiran Rao', bg: '#CFE6E3', skin: '#C98F67', hair: '#1C1410', shirt: '#2C7A7B' },
  hema: { name: 'Hema Iyer', bg: '#E8DDF5', skin: '#B97B55', hair: '#16100C', shirt: '#7A4E9E', long: true },
  rohan: { name: 'Rohan Das', bg: '#DCE6F7', skin: '#D9A07A', hair: '#3A2618', shirt: '#2F5BAA' },
  neha: { name: 'Neha Gupta', bg: '#F7E3C9', skin: '#E3AD86', hair: '#4A2A18', shirt: '#B42318', long: true },
  amit: { name: 'Amit Verma', bg: '#E2EAD9', skin: '#C68B62', hair: '#18120E', shirt: '#157A4B' },
  sneha: { name: 'Sneha Menon', bg: '#F3D6DE', skin: '#B5774F', hair: '#120C09', shirt: '#9E3B5C', long: true },
  arjun: { name: 'Arjun Nair', bg: '#D9E2EC', skin: '#A86E48', hair: '#0F0B08', shirt: '#4A4A52' },
};
let uid = 0;
function face(key, size = 40, ring = '') {
  const p = PEOPLE[key];
  const id = `cp${uid++}`;
  return `<svg class="pf" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${p.name}" style="border-radius:50%;flex:none;${ring ? `box-shadow:0 0 0 3px ${ring}` : ''}"><defs><clipPath id="${id}"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#${id})"><rect width="64" height="64" fill="${p.bg}"/>${p.long ? `<path d="M15 34c0-14 7-22 17-22s17 8 17 22v16H15z" fill="${p.hair}"/>` : ''}<path d="M8 64c2-12 11-18 24-18s22 6 24 18z" fill="${p.shirt}"/><rect x="27" y="38" width="10" height="10" rx="4" fill="${p.skin}"/><ellipse cx="32" cy="29" rx="11" ry="12.5" fill="${p.skin}"/><path d="M20 27c0-9 5-14 12-14s12 5 12 14c-3-5-7-7-12-7s-9 2-12 7z" fill="${p.hair}"/><circle cx="28" cy="30" r="1.3" fill="#2A1A12"/><circle cx="36" cy="30" r="1.3" fill="#2A1A12"/><path d="M28.5 35.5q3.5 2.6 7 0" stroke="#7A3E2A" stroke-width="1.4" fill="none" stroke-linecap="round"/></g></svg>`;
}

// ── Motion + mixed-layout CSS
const mixCss = (t, isDark) => `<style>
.stack>.pair:last-child{flex:1}
.hrow{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);gap:20px;align-items:stretch}
.heroX{position:relative;overflow:hidden;border-radius:16px;padding:24px 26px 22px;color:#FFF7E8;background:radial-gradient(520px 300px at 88% 20%,rgba(214,158,58,.42),transparent 62%),linear-gradient(135deg,#221A0E 0%,#120F0A 62%,#0D0B08 100%);border:1px solid rgba(214,158,58,.28);box-shadow:0 24px 48px -28px rgba(24,16,4,.65);display:flex;flex-direction:column;gap:14px;animation:rise .6s cubic-bezier(.2,.8,.2,1) both}
.heroX .eb{font-size:12px;font-weight:700;color:#E8BD6E;letter-spacing:.02em}
.heroX h1{margin:0;font-size:32px;font-weight:800;letter-spacing:-.03em;color:#FFF7E8}
.heroX .sub{font-size:14px;color:#CFC6B4;max-width:440px}
.heroX .chip{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:99px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:13px;font-weight:700;color:#FFF7E8;text-decoration:none;transition:transform .2s,background .2s}
.heroX .chip:hover{transform:translateY(-2px);background:rgba(255,255,255,.12)}
.heroX .chip.gold{background:#D69E3A;border-color:#D69E3A;color:#18181B}
.hstats{display:grid;grid-template-columns:repeat(var(--c,3),minmax(0,1fr));gap:10px;position:relative;z-index:1;max-width:var(--mw,560px)}
.hs{border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.hs span{display:block;font-size:11.5px;color:#BDB4A2}
.hs b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em;color:#FFF7E8;font-variant-numeric:tabular-nums}
.hs b small{font-size:13px;color:#BDB4A2;font-weight:700}
.orbX{position:absolute;right:40px;top:26px;width:150px;height:150px;perspective:700px;pointer-events:none}
.orbX .ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(214,158,58,.55);transform:rotateX(68deg);animation:spin 9s linear infinite}
.orbX .ring.r2{inset:16px;border-color:rgba(255,247,232,.22);animation-duration:13s;animation-direction:reverse}
.orbX .core{position:absolute;inset:40px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFE3A8,#D69E3A 45%,#6E470C 100%);box-shadow:0 0 50px rgba(214,158,58,.55),inset -8px -12px 26px rgba(0,0,0,.45);animation:float 5s ease-in-out infinite}
.orbX .core::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.55),transparent 35%)}
/* count-up: registered integer animated to --to */
@property --n{syntax:'<integer>';inherits:false;initial-value:0}
.hs .cu,.lt .n .cu,.cu{display:inline!important;font-size:inherit!important;color:inherit!important;font-weight:inherit}
.cu{counter-reset:n var(--n);animation:cu 1.6s cubic-bezier(.2,.8,.2,1) .2s both}
.cu::before{content:counter(n)}
@keyframes cu{from{--n:0}to{--n:var(--to)}}
/* Today tile */
.today{display:flex;flex-direction:column;gap:14px;padding:18px 20px;animation:rise .6s cubic-bezier(.2,.8,.2,1) .08s both}
.today .ringw{position:relative;width:104px;height:104px;flex:none}
.ringfill{animation:ringfill 1.4s cubic-bezier(.2,.8,.2,1) .3s both}
@keyframes ringfill{from{stroke-dasharray:0 400}}
.shift{position:relative;height:8px;border-radius:99px;background:${t.track}}
.shift i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,${t.gold}66,${t.gold});animation:fillw 1.4s cubic-bezier(.2,.8,.2,1) .3s both}
.shift b{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:${t.surface};border:3px solid ${t.gold};box-shadow:0 0 0 4px ${t.gold}33;animation:nowdot 2s ease-in-out infinite}
@keyframes nowdot{50%{box-shadow:0 0 0 8px ${t.gold}11}}
.ciX{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;height:48px;border-radius:12px;background:${t.gold};color:#18181B;font-weight:800;font-size:15px;text-decoration:none;box-shadow:0 10px 26px -10px ${t.gold}}
.ciX::before,.ciX::after{content:"";position:absolute;inset:-5px;border-radius:16px;border:2px solid ${t.gold};opacity:0;animation:pl 2.6s ease-out infinite}
.ciX::after{animation-delay:1.3s}
@keyframes pl{0%{opacity:.7;transform:scale(.97)}100%{opacity:0;transform:scale(1.12)}}
/* entrance */
.cols .card,.pair .card{animation:rise .55s cubic-bezier(.2,.8,.2,1) both}
.stack>.card:nth-child(1),.stack>.pair{animation-delay:.12s}
.stack>.card:nth-child(2){animation-delay:.2s}
.stack>.card:nth-child(3){animation-delay:.28s}
.stack>.card:nth-child(4){animation-delay:.36s}
.day{animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
${[1, 2, 3, 4, 5, 6, 7].map((i) => `.day:nth-child(${i}){animation-delay:${0.2 + i * 0.05}s}`).join('')}
.meter i,.lt .meter i{animation:fillw 1.2s cubic-bezier(.2,.8,.2,1) .4s both}
.bars i,.vb{animation:growy .9s cubic-bezier(.2,.8,.2,1) .4s both;transform-origin:bottom}
.donutX circle+circle{animation:ringfill 1.4s cubic-bezier(.2,.8,.2,1) .3s both}
.tiltX{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.tiltX:hover{transform:perspective(900px) rotateX(3deg) rotateY(-4deg) translateY(-3px)}
/* Celebrations carousel */
.cel{position:relative;overflow:hidden}
.cel::before{content:"";position:absolute;inset:0;background:radial-gradient(260px 160px at 85% 0%,${t.gold}22,transparent 70%);pointer-events:none}
.slides{position:relative;height:230px}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;opacity:0;animation:slide 12s infinite}
.slide:nth-child(2){animation-delay:4s}.slide:nth-child(3){animation-delay:8s}
@keyframes slide{0%{opacity:0;transform:translateX(30px)}4%,30%{opacity:1;transform:none}34%,100%{opacity:0;transform:translateX(-30px)}}
.cel:hover .slide,.cel:hover .dots i{animation-play-state:paused}
.dots{display:flex;gap:6px;justify-content:center}
.dots i{width:6px;height:6px;border-radius:99px;background:${t.track};animation:dot 12s infinite}
.dots i:nth-child(2){animation-delay:4s}.dots i:nth-child(3){animation-delay:8s}
@keyframes dot{0%,30%{width:18px;background:${t.gold}}34%,100%{width:6px;background:${t.track}}}
.faces{display:flex;justify-content:center}
.faces .pf{margin-left:-14px;animation:pop .5s cubic-bezier(.3,1.6,.5,1) both}
.faces .pf:first-child{margin-left:0}
.slide .nm{font-size:16px;font-weight:800}
.slide .ds{font-size:12.5px;color:${t.muted}}
.kind{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:99px}
.k-b{background:${t.badSoft};color:${t.bad}}.k-a{background:${t.goldSoft};color:${t.goldText}}
.conf{position:absolute;inset:0;pointer-events:none}
.conf i{position:absolute;top:-12px;width:7px;height:11px;border-radius:2px;opacity:.85;animation:fall 6s linear infinite}
@keyframes fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(300px) rotate(600deg)}}
.medal{position:relative;width:64px;height:64px;perspective:400px}
.medal div{width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFE3A8,#D69E3A 50%,#8A5A12);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#3A2608;box-shadow:0 8px 20px -8px #8A5A12;animation:flip 4s ease-in-out infinite}
@keyframes flip{0%,60%{transform:rotateY(0)}80%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
.wish{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:99px;border:1px solid ${t.borderStrong};font-size:12.5px;font-weight:700;color:${t.fg};text-decoration:none;background:${t.surface}}
.wish.g{background:${t.gold};border-color:${t.gold};color:#18181B}
/* Kudos ticker */
.kud .bd{padding:6px 20px 16px}
.tick{position:relative;overflow:hidden;flex:1 1 0;min-height:230px;-webkit-mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent)}
.tick ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;animation:tick 26s linear infinite}
.kud:hover .tick ul{animation-play-state:paused}
@keyframes tick{to{transform:translateY(-50%)}}
.ku{border:1px solid ${t.border};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;background:${isDark ? 'rgba(255,255,255,.02)' : t.surface}}
.ku .who{display:flex;align-items:center;gap:8px;font-size:12.5px}
.ku .who .arr{color:${t.muted}}
.ku p{margin:0;font-size:13px;line-height:1.45}
.ku .ft{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:${t.muted}}
.heart{display:inline-flex;align-items:center;gap:4px;color:${t.bad};font-weight:700}
.livedot{width:8px;height:8px;border-radius:50%;background:${t.ok};box-shadow:0 0 0 0 ${t.ok};animation:live 2s infinite}
@keyframes live{0%{box-shadow:0 0 0 0 ${t.ok}88}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.feed li:first-child{animation:drop .6s cubic-bezier(.2,.8,.2,1) .6s both}
@keyframes drop{from{opacity:0;transform:translateY(-12px)}}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes fillw{from{width:0}}
@keyframes growy{from{transform:scaleY(0)}}
@keyframes pop{from{opacity:0;transform:scale(.6)}}
@keyframes spin{to{transform:rotateX(68deg) rotateZ(360deg)}}
@keyframes float{50%{transform:translateY(-7px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.slide:first-child{opacity:1}}
</style>`;

// ── Shared cards
function confetti(n = 16) {
  const cols = ['#D69E3A', '#5FD39B', '#2C7A7B', '#E9416A', '#7A4E9E', '#F2B65A'];
  return `<div class="conf" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${cols[i % cols.length]};animation-delay:${((i * 0.73) % 6).toFixed(2)}s;animation-duration:${5 + (i % 4)}s"></i>`).join('')}</div>`;
}

function celebrationsCard(t) {
  return `<section class="card cel" aria-label="Celebrations today">${confetti()}
  <div class="hd"><h2>Celebrations today</h2><span class="pill p-bad">${icon('cake', 12)}2</span><span class="pill p-gold">${icon('award', 12)}2</span></div>
  <div class="bd" style="gap:6px">
    <div class="slides">
      <div class="slide">
        <span class="kind k-b">${icon('cake', 12)}2 birthdays today</span>
        <div class="faces">${face('priya', 72, t.surface)}${face('kiran', 72, t.surface)}</div>
        <div><div class="nm">Priya Sharma &amp; Kiran Rao</div><div class="ds">People team · Engineering</div></div>
        <div style="display:flex;gap:8px"><a class="wish g" href="#">${icon('cake', 13)}Send wishes</a><a class="wish" href="#">See both</a></div>
      </div>
      <div class="slide">
        <span class="kind k-a">${icon('award', 12)}Work anniversary</span>
        <div style="display:flex;align-items:center;gap:14px">${face('hema', 72, t.surface)}<div class="medal"><div>2</div></div></div>
        <div><div class="nm">Hema Iyer · 2 years</div><div class="ds">HR Manager · joined 4 Oct 2024</div></div>
        <div style="display:flex;gap:8px"><a class="wish g" href="#">${icon('heart', 13)}Give kudos</a><a class="wish" href="#">Congratulate</a></div>
      </div>
      <div class="slide">
        <span class="kind k-a">${icon('award', 12)}Work anniversary</span>
        <div style="display:flex;align-items:center;gap:14px">${face('rohan', 72, t.surface)}<div class="medal"><div>5</div></div></div>
        <div><div class="nm">Rohan Das · 5 years</div><div class="ds">Engineering Lead · joined 4 Oct 2021</div></div>
        <div style="display:flex;gap:8px"><a class="wish g" href="#">${icon('heart', 13)}Give kudos</a><a class="wish" href="#">Congratulate</a></div>
      </div>
    </div>
    <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
  </div></section>`;
}

const KUDOS = [
  ['neha', 'rohan', 'Thanks for unblocking Friday’s release — you stayed late so we didn’t have to.', 'Teamwork', 12, '2h ago'],
  ['priya', 'amit', 'Brilliant job on the payroll dry-run. Zero mismatches!', 'Excellence', 9, '5h ago'],
  ['hema', 'sneha', 'Onboarded 4 new joiners in a single week, smoothly.', 'Ownership', 7, 'Yesterday'],
  ['rohan', 'arjun', 'Your code reviews make the whole team better.', 'Helping hand', 15, 'Yesterday'],
  ['kiran', 'neha', 'Great demo to the client — they signed on the spot.', 'Customer first', 21, '2 days ago'],
];
function kudosCard(t) {
  const item = ([a, b, msg, tag, likes, when]) => `<li class="ku"><div class="who">${face(a, 26)}<b>${PEOPLE[a].name.split(' ')[0]}</b><span class="arr">${icon('arrow', 12)}</span>${face(b, 26)}<b>${PEOPLE[b].name.split(' ')[0]}</b></div><p>${msg}</p><div class="ft"><span class="pill p-gold">${tag}</span><span class="heart">${icon('heart', 12)}${likes}</span><span>${when}</span></div></li>`;
  const list = KUDOS.map(item).join('');
  return `<section class="card kud"><div class="hd"><h2>Kudos</h2><span class="livedot" aria-hidden="true"></span><span class="xs mut">236 this year</span><a href="#" style="margin-left:auto">Give kudos</a></div>
  <div class="bd"><div class="tick"><ul>${list}${list.replace(/aria-label="[^"]*"/g, 'aria-hidden="true"')}</ul></div></div></section>`;
}

function ringSvg(t, pct, size = 104, stroke = 11) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${t.track}" stroke-width="${stroke}"/><circle class="ringfill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${t.gold}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

// ── Employee
function mixEmployee(t, isDark) {
  const teal = isDark ? '#5EB8B0' : '#2C7A7B';
  const days = [['Mon', 28, 'Present', 'p-ok', '09:41', '18:52', ''], ['Tue', 29, 'Present', 'p-ok', '09:28', '18:40', ''], ['Wed', 30, 'Sick leave', 'p-bad', '', '', 'Approved'], ['Thu', 1, 'Late', 'p-warn', '10:12', '19:05', ''], ['Fri', 2, 'Holiday', 'p-teal', '', '', 'Gandhi Jayanti'], ['Sat', 3, 'Weekly off', 'p-neu', '', '', ''], ['Sun', 4, 'Today', 'p-gold', '09:12', '—', 'In progress']];
  const week = days.map(([d, n, label, cls, i, o, note]) => `<div class="day${label === 'Today' ? ' today' : ''}${['Weekly off', 'Holiday'].includes(label) ? ' off' : ''}"><div class="dn">${d}<b>${n}</b></div><span class="pill ${cls}">${label}</span>${i ? `<div class="tm"><span>In</span><b>${i}</b></div><div class="tm"><span>Out</span><b>${o}</b></div>` : ''}${note ? `<span class="xs mut">${note}</span>` : ''}</div>`).join('');
  const leave = [['Casual', 9, 12, t.gold, 't-gold'], ['Sick', 12, 12, t.bad, 't-bad'], ['Earned', 15, 15, t.ok, 't-ok'], ['Work from home', null, null, teal, 't-teal']]
    .map(([n, a, tot, col, tc]) => `<div class="lt tiltX"><div style="display:flex;align-items:center;gap:8px"><span class="tile ${tc}" style="width:28px;height:28px;border-radius:8px">${icon(n === 'Work from home' ? 'home' : 'plane', 14)}</span><span class="sm" style="font-weight:700">${n}</span></div><div class="n"><b>${a === null ? '∞' : `<span class="cu" style="--to:${a}"></span>`}</b><span>${tot ? `of ${tot} left` : 'No limit'}</span></div><div class="meter"><i style="width:${tot ? (a / tot) * 100 : 100}%;background:${col};opacity:${tot ? 1 : .35}"></i></div></div>`).join('');
  return `
<div class="hrow">
  <section class="heroX" aria-label="Today">
    <div class="orbX" aria-hidden="true"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
    <div><div class="eb">Sunday, 4 October</div><h1>Good morning, Amit</h1><div class="sub">You’re checked in. One thing needs you, and two colleagues are celebrating today 🎉</div></div>
    <div class="hstats"><div class="hs"><span>Present this month</span><b><span class="cu" style="--to:18"></span><small> days</small></b></div><div class="hs"><span>Avg hours / day</span><b>8h 11m</b></div><div class="hs"><span>Logged this week</span><b><span class="cu" style="--to:32"></span><small> / 40h</small></b></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="chip gold" href="#">${icon('plane', 14)}Apply leave</a><a class="chip" href="#">${icon('home', 14)}Work from home</a><a class="chip" href="#">${icon('timer', 14)}Timesheet</a><a class="chip" href="#">${icon('heart', 14)}Give kudos</a></div>
  </section>
  <section class="card today" aria-label="My day">
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0;font-size:15px;font-weight:800">Today</h2><span class="pill p-ok"><span class="livedot" style="width:6px;height:6px"></span>Checked in</span></div>
    <div style="display:flex;align-items:center;gap:16px"><div class="ringw">${ringSvg(t, 0.35)}<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:20px">2h 48m</b><span class="xs mut">of 8h</span></div></div>
      <div class="sm" style="display:flex;flex-direction:column;gap:6px"><span class="mut xs">Checked in</span><b>09:12 · office</b><span class="mut xs">Shift 09:30 – 18:30</span></div></div>
    <div><div class="shift"><i style="width:35%"></i><b style="left:35%"></b></div><div style="display:flex;justify-content:space-between" class="xs mut"><span>09:30</span><span>Lunch 13:30</span><span>18:30</span></div></div>
    <a class="ciX" href="#" style="margin-top:auto">${icon('login', 18)}Check out</a>
  </section>
</div>

<div class="cols">
  <div class="stack">
    <section class="card"><div class="hd"><h2>My week</h2><div class="seg"><span class="on">Week</span><span>Month</span></div><span class="sm mut" style="margin-left:8px">Sep 28 – Oct 4</span></div>
      <div class="bd"><div class="week">${week}</div><div class="legend"><span><i style="background:${t.ok}"></i>Present</span><span><i style="background:${t.warn}"></i>Late</span><span><i style="background:${t.bad}"></i>Leave</span><span><i style="background:${teal}"></i>Holiday</span><span><i style="background:${t.gold}"></i>Today</span></div></div></section>
    <section class="card"><div class="hd"><h2>Leave balance</h2><span class="sm mut">36 days available</span><a href="#" style="margin-left:12px">My leave</a></div><div class="bd"><div class="leave">${leave}</div></div></section>
    <div class="pair">
      <section class="card"><div class="hd"><h2>Needs your action</h2><span class="cnt">2</span></div><div class="bd"><ul class="ul">
        <li><span class="tile t-gold">${icon('user')}</span><div class="tx"><b>Complete your profile · 86%</b><span>Add emergency contact</span></div><a class="btn mini" href="#">Open</a></li>
        <li><span class="tile t-warn">${icon('box')}</span><div class="tx"><b>Acknowledge your laptop</b><span>Dell Latitude 5440 · assigned Oct 1</span></div><a class="btn mini" href="#">Confirm</a></li>
        <li><span class="tile t-ok">${icon('check')}</span><div class="tx"><b>Timesheet for last week</b><span>Submitted · waiting for Rohan</span></div><span class="pill p-ok">Done</span></li></ul></div></section>
      <section class="card"><div class="hd"><h2>My projects</h2><span class="pill p-gold">100% allocated</span></div><div class="bd"><ul class="ul">
        <li><span class="tile t-gold">${icon('folder')}</span><div class="tx"><b>EXP-TRX Reimagined</b><span>Since Sep 2026 · lead Rohan</span></div><b class="sm">70%</b></li>
        <li><span class="tile t-teal">${icon('folder')}</span><div class="tx"><b>Mobile onboarding</b><span>Since Aug 2026 · lead Neha</span></div><b class="sm">30%</b></li></ul>
        <div class="meter" style="height:8px;display:flex;margin-top:auto"><i style="width:70%;background:${t.gold};border-radius:99px 0 0 99px"></i><i style="width:30%;background:${teal};border-radius:0 99px 99px 0"></i></div><span class="xs mut">Hours this week: 32h logged of 40h</span></div></section>
    </div>
  </div>
  <div class="stack">
    ${celebrationsCard(t)}
    <section class="card"><div class="hd"><h2>Coming up</h2><a href="#">Holidays</a></div><div class="bd"><ul class="ul">
      <li>${face('sneha', 32)}<div class="tx"><b>Sneha Menon</b><span>Birthday · Wednesday</span></div></li>
      <li><span class="tile t-teal">${icon('flag')}</span><div class="tx"><b>Dussehra</b><span>Holiday · Mon, 19 Oct</span></div></li></ul></div></section>
    ${kudosCard(t)}
  </div>
</div>

<section class="card" style="animation:rise .55s cubic-bezier(.2,.8,.2,1) .45s both"><div class="hd"><h2>Announcements</h2><a href="#">View all</a></div><div class="bd"><div class="ann">
  <div class="an tiltX"><span class="pill p-gold" style="align-self:flex-start">Policy · needs acknowledgement</span><b>Updated leave policy for 2027</b><span class="sm mut">Carry-forward rules change from January…</span></div>
  <div class="an tiltX"><span class="pill p-teal" style="align-self:flex-start">Event</span><b>Diwali celebration · 30 Oct</b><span class="sm mut">Lunch at 1 pm in the cafeteria, all welcome.</span></div>
  <div class="an tiltX"><span class="pill p-neu" style="align-self:flex-start">IT</span><b>VPN maintenance on Saturday</b><span class="sm mut">Remote access unavailable 10 pm – 2 am.</span></div>
</div></div></section>`;
}

// ── Admin
function mixAdmin(t, isDark) {
  const teal = isDark ? '#5EB8B0' : '#2C7A7B';
  const approvals = [['calclock', 'Leave requests', 3, 'Oldest 2 days ago'], ['receipt', 'Expense claims', 2, '₹14,300 in total'], ['check', 'Attendance corrections', 1, 'Amit · missing check-out'], ['box', 'Asset requests', 1, 'Monitor for Neha'], ['timer', 'Timesheets', 0, 'All caught up']]
    .map(([ic, n, c, s]) => `<li><span class="tile ${c ? 't-gold' : 't-neu'}">${icon(ic)}</span><div class="tx"><b>${n}</b><span>${s}</span></div><span class="cnt${c ? '' : ' z'}">${c}</span><a class="btn mini" href="#">Review</a></li>`).join('');
  const depts = [['Engineering', 6], ['People', 2], ['Finance', 2], ['Sales', 2], ['Operations', 1]].map(([n, v]) => `<div><span>${n}</span><div class="meter" style="height:8px"><i style="width:${(v / 6) * 100}%;background:${t.gold}"></i></div><b>${v}</b></div>`).join('');
  const months = [['May', 1, 0], ['Jun', 2, 1], ['Jul', 0, 0], ['Aug', 3, 1], ['Sep', 2, 0], ['Oct', 1, 0]];
  const bars = months.map(([m, j, l]) => `<div><div style="display:flex;gap:3px;align-items:flex-end;height:100px;width:100%;justify-content:center"><i class="vb" style="height:${Math.max(4, j * 30)}px;background:${t.gold};max-width:14px"></i><i class="vb" style="height:${Math.max(4, l * 30)}px;background:${t.bad};opacity:${l ? 1 : .3};max-width:14px"></i></div>${m}</div>`).join('');
  return `
<div class="hrow">
  <section class="heroX" aria-label="Company today">
    <div class="orbX" aria-hidden="true"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
    <div><div class="eb">Sunday, 4 October</div><h1>Company pulse</h1><div class="sub">9 of 13 people are in. 7 approvals are waiting, none overdue.</div></div>
    <div class="hstats" style="--c:4;--mw:640px"><div class="hs"><span>Employees</span><b><span class="cu" style="--to:13"></span></b></div><div class="hs"><span>Present</span><b><span class="cu" style="--to:9"></span><small> / 13</small></b></div><div class="hs"><span>On leave · WFH</span><b><span class="cu" style="--to:2"></span><small> · 1</small></b></div><div class="hs"><span>Waiting for you</span><b style="color:#F2B65A"><span class="cu" style="--to:7"></span></b></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="chip gold" href="#">${icon('plus', 14)}Add employee</a><a class="chip" href="#">${icon('megaphone', 14)}Post announcement</a><a class="chip" href="#">${icon('chart', 14)}Reports</a></div>
  </section>
  <section class="card today" aria-label="Attendance today">
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0;font-size:15px;font-weight:800">Attendance today</h2><a class="sm" href="#" style="font-weight:700;text-decoration:none">Team</a></div>
    <div style="display:flex;align-items:center;gap:16px"><div class="donutX">${donut([[9, t.ok], [1, teal], [2, t.bad], [1, t.warn]], 120, 14, '<b style="font-size:22px">69%</b><span class="xs mut">in</span>', t.track)}</div>
      <div class="sm" style="display:flex;flex-direction:column;gap:7px">${[[t.ok, 'Present', 9], [teal, 'WFH', 1], [t.bad, 'On leave', 2], [t.warn, 'Not in yet', 1]].map(([c, n, v]) => `<span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin-right:8px"></i>${n} <b>${v}</b></span>`).join('')}</div></div>
    <div><span class="xs mut">Check-ins by hour</span><div class="bars" style="height:52px;gap:6px;margin-top:6px">${[2, 5, 8, 3, 1, 0, 1].map((v) => `<div><i style="height:${v * 6 + 3}px;background:${t.gold};max-width:22px"></i></div>`).join('')}</div><div style="display:flex;justify-content:space-between" class="xs mut"><span>08:00</span><span>14:00</span></div></div>
  </section>
</div>

<div class="cols">
  <div class="stack">
    <section class="card"><div class="hd"><h2>Waiting for your approval</h2><span class="cnt">7</span></div><div class="bd"><ul class="ul">${approvals}</ul></div></section>
    <div class="pair">
      <section class="card"><div class="hd"><h2>Who’s off this week</h2><a href="#">Calendar</a></div><div class="bd"><ul class="ul">
        <li>${face('amit', 32)}<div class="tx"><b>Amit Verma</b><span>Sick leave · Wed</span></div><span class="pill p-bad">Leave</span></li>
        <li>${face('kiran', 32)}<div class="tx"><b>Kiran Rao</b><span>Mon – Tue</span></div><span class="pill p-teal">WFH</span></li>
        <li>${face('sneha', 32)}<div class="tx"><b>Sneha Menon</b><span>Earned leave · Thu – Fri</span></div><span class="pill p-bad">Leave</span></li></ul></div></section>
      <section class="card"><div class="hd"><h2>By department</h2><a href="#">People report</a></div><div class="bd"><div class="dept">${depts}</div></div></section>
    </div>
    <section class="card"><div class="hd"><h2>Joiners &amp; leavers</h2><span class="legend"><span><i style="background:${t.gold}"></i>Joined</span><span><i style="background:${t.bad}"></i>Left</span></span></div><div class="bd"><div class="bars">${bars}</div><span class="xs mut">9 joined and 2 left in the last 6 months · 2 probations end this month</span></div></section>
  </div>
  <div class="stack">
    ${celebrationsCard(t)}
    <section class="card"><div class="hd"><h2>My day</h2><span class="pill p-ok"><span class="livedot" style="width:6px;height:6px"></span>In</span></div><div class="bd" style="flex-direction:row;align-items:center;gap:14px"><div class="kv" style="flex:1"><b style="font-size:15px">Checked in 09:05</b><span>3h 07m so far · shift 09:30 – 18:30</span></div><a class="btn" href="#">Check out</a></div></section>
    ${kudosCard(t)}
  </div>
</div>`;
}

// ── Super Admin (no globe)
function mixSuper(t) {
  const rows = [['aakash-portal', 'Enterprise', 13, 200, 15, 'Active'], ['perf-bench', 'Enterprise', 493, 500, 495, 'Active'], ['Nova Retail', 'Growth', 46, 50, 41, 'Active'], ['Blue Fin Labs', 'Starter', 8, 25, 9, 'Suspended']]
    .map(([n, p, e, m, u, s]) => { const near = e / m >= 0.9; return `<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="av" style="border-radius:8px">${n.slice(0, 2).toUpperCase()}</span><b>${n}</b></div></td><td><span class="pill p-gold">${p}</span></td><td style="min-width:170px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${e} of ${m}</span>${near ? `<b style="color:${t.warn}">near limit</b>` : ''}</div><div class="meter"><i style="width:${(e / m) * 100}%;background:${near ? t.warn : t.gold}"></i></div></td><td>${u}</td><td><span class="pill ${s === 'Active' ? 'p-ok' : 'p-bad'}">${s}</span></td></tr>`; }).join('');
  const signup = [3, 5, 2, 6, 4, 8].map((v, i) => `<div><i style="height:${v * 12}px;background:${t.gold}"></i>${['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]}</div>`).join('');
  const svc = [['PostgreSQL', 'Operational', 'p-ok', true], ['Email · Gmail', 'Connected', 'p-ok', true], ['Redis (email queue)', 'Not configured', 'p-neu', false], ['File storage', 'Local disk', 'p-neu', false]];
  return `
<div class="hrow">
  <section class="heroX" aria-label="Platform">
    <div class="orbX" aria-hidden="true"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
    <div><div class="eb">Platform overview</div><h1>Good morning</h1><div class="sub">All services operational. One company is close to its employee limit.</div></div>
    <div class="hstats" style="--c:4;--mw:640px"><div class="hs"><span>Companies</span><b><span class="cu" style="--to:4"></span><small> · 3 active</small></b></div><div class="hs"><span>Employees</span><b><span class="cu" style="--to:560"></span></b></div><div class="hs"><span>Active today</span><b><span class="cu" style="--to:62"></span></b></div><div class="hs"><span>Near limit</span><b style="color:#F2B65A"><span class="cu" style="--to:1"></span></b></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="chip gold" href="#">${icon('plus', 14)}Onboard company</a><a class="chip" href="#">${icon('layers', 14)}Plans</a><a class="chip" href="#">${icon('file', 14)}Audit logs</a></div>
  </section>
  <section class="card today" aria-label="System">
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0;font-size:15px;font-weight:800">System</h2><a class="sm" href="#" style="font-weight:700;text-decoration:none">Details</a></div>
    <ul class="ul">${svc.map(([n, s, c, live]) => `<li>${live ? '<span class="livedot"></span>' : `<span style="width:8px;height:8px;border-radius:50%;background:${t.track}"></span>`}<div class="tx"><b>${n}</b></div><span class="pill ${c}">${s}</span></li>`).join('')}</ul>
    <div><span class="xs mut">API response time · last hour</span><div class="bars" style="height:44px;gap:4px;margin-top:6px">${[5, 6, 4, 7, 5, 6, 4, 5, 8, 5, 4, 6].map((v) => `<div><i style="height:${v * 5}px;background:${t.ok};max-width:14px;opacity:.75"></i></div>`).join('')}</div><span class="xs mut">p95 140 ms · no errors</span></div>
  </section>
</div>
<div class="cols">
  <div class="stack">
    <section class="card"><div class="hd"><h2>Companies</h2><span class="sm mut">Plan and seats used</span><a href="#" style="margin-left:12px">All companies</a></div><div class="bd" style="padding:6px 8px 10px"><table><thead><tr><th>Company</th><th>Plan</th><th>Employees · limit</th><th>Users</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div class="pair">
      <section class="card"><div class="hd"><h2>New companies</h2><span class="sm mut">Last 6 months</span></div><div class="bd"><div class="bars">${signup}</div></div></section>
      <section class="card"><div class="hd"><h2>Company status</h2></div><div class="bd" style="flex-direction:row;align-items:center;gap:18px"><div class="donutX">${donut([[3, t.ok], [0, t.muted], [1, t.bad]], 120, 16, '<b style="font-size:22px">4</b><span class="xs mut">companies</span>', t.track)}</div><div class="sm" style="display:flex;flex-direction:column;gap:8px"><span>Active <b>3</b></span><span>Inactive <b>0</b></span><span>Suspended <b>1</b></span></div></div></section>
    </div>
  </div>
  <div class="stack">
    <section class="card"><div class="hd"><h2>Live activity</h2><span class="livedot"></span><a href="#" style="margin-left:auto">Audit logs</a></div><div class="bd"><ul class="ul feed">
      ${[['plus', 't-gold', 'Nova Retail onboarded', 'just now · you'], ['users', 't-teal', '12 employees imported', '18 min ago · Nova Retail'], ['layers', 't-neu', 'Growth plan limits changed', 'Yesterday · you'], ['alert', 't-bad', 'Blue Fin Labs suspended', 'Oct 1 · billing'], ['palette', 't-neu', 'Theme “Obsidian Gold” published', 'Sep 30 · aakash-portal']].map(([ic, c, n, s]) => `<li><span class="tile ${c}">${icon(ic)}</span><div class="tx"><b>${n}</b><span>${s}</span></div></li>`).join('')}</ul></div></section>
  </div>
</div>`;
}

// ── Motion library v2 (more ideas, no globe)
const motionCss = `<helmet>\n${helmetFonts}\n<style>
body{margin:0;background:#0B0A08}
.mb{font-family:Manrope,system-ui,sans-serif;color:#EDEDEF;padding:40px;background:radial-gradient(900px 400px at 80% 0%,#2E2210,transparent 60%),#0B0A08;min-height:100vh;box-sizing:border-box}
.mb h1{margin:0 0 6px;font-size:30px;font-weight:800;letter-spacing:-.02em}
.mb .lead{margin:0 0 26px;color:#A9A59C;max-width:900px}
.sec{margin:26px 0 12px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#E8BD6E}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.demo{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}
.demo h2{margin:0;font-size:14.5px;font-weight:800}
.demo p{margin:0;color:#A9A59C;font-size:12.5px;line-height:1.5}
.where{font-size:11px;font-weight:700;color:#E8BD6E}
.stage{height:150px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(0,0,0,.3);position:relative;overflow:hidden}
.ok{color:#5FD39B}
/* odometer */
.odo{display:flex;gap:2px;font-size:44px;font-weight:800;height:52px;overflow:hidden;font-variant-numeric:tabular-nums}
.odo span{display:flex;flex-direction:column;animation:roll 3s cubic-bezier(.6,0,.2,1) infinite alternate;line-height:52px}
.odo span:nth-child(2){animation-delay:.15s}.odo span:nth-child(3){animation-delay:.3s}
@keyframes roll{0%,15%{transform:translateY(0)}85%,100%{transform:translateY(calc(var(--d) * -52px))}}
/* approve swipe */
.sw{width:230px;display:flex;flex-direction:column;gap:6px}
.sw div{height:34px;border-radius:9px;background:rgba(255,255,255,.07);display:flex;align-items:center;padding:0 10px;font-size:12px;gap:8px}
.sw .gone{animation:swipe 3.2s cubic-bezier(.6,0,.2,1) infinite;background:rgba(95,211,155,.18);color:#5FD39B;overflow:hidden}
@keyframes swipe{0%,30%{transform:none;opacity:1;height:34px}55%{transform:translateX(120%);opacity:0;height:34px}75%,100%{transform:translateX(120%);opacity:0;height:0;margin-top:-6px}}
/* check draw */
.ck path{stroke-dasharray:60;stroke-dashoffset:60;animation:draw 2.6s ease infinite}
.ck circle{stroke-dasharray:240;stroke-dashoffset:240;animation:drawc 2.6s ease infinite}
@keyframes draw{30%{stroke-dashoffset:60}55%,100%{stroke-dashoffset:0}}
@keyframes drawc{0%{stroke-dashoffset:240}35%,100%{stroke-dashoffset:0}}
/* badge pop */
.bell{position:relative;width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;color:#EDEDEF;animation:ring 3s ease infinite;transform-origin:50% 10%}
.bell b{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:99px;background:#D69E3A;color:#18181B;font-size:11px;display:flex;align-items:center;justify-content:center;animation:bpop 3s cubic-bezier(.3,1.8,.5,1) infinite}
@keyframes ring{0%,60%,100%{transform:none}64%{transform:rotate(14deg)}68%{transform:rotate(-12deg)}72%{transform:rotate(8deg)}76%{transform:rotate(-4deg)}}
@keyframes bpop{0%,58%{transform:scale(1)}62%{transform:scale(1.5)}70%,100%{transform:scale(1)}}
/* heart burst */
.hb{position:relative;color:#FF8A7A;animation:hbeat 2.4s ease infinite}
@keyframes hbeat{0%,40%,100%{transform:scale(1)}45%{transform:scale(1.35)}55%{transform:scale(.95)}}
.hb i{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#FF8A7A;opacity:0;animation:hp 2.4s ease-out infinite}
@keyframes hp{0%,44%{opacity:0;transform:translate(-50%,-50%)}50%{opacity:1}80%,100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y)))}}
/* toast */
.toast{width:220px;border-radius:12px;background:#1C1A16;border:1px solid rgba(255,255,255,.1);padding:10px 12px;font-size:12px;animation:tin 4s cubic-bezier(.2,.8,.2,1) infinite;position:relative;overflow:hidden}
.toast::after{content:"";position:absolute;left:0;bottom:0;height:3px;background:#5FD39B;animation:tbar 4s linear infinite}
@keyframes tin{0%{transform:translateX(130%)}10%,80%{transform:none}90%,100%{transform:translateX(130%)}}
@keyframes tbar{0%,10%{width:100%}80%,100%{width:0}}
/* line draw */
.ln path{stroke-dasharray:400;stroke-dashoffset:400;animation:ld 3.5s ease infinite}
@keyframes ld{0%{stroke-dashoffset:400}50%,100%{stroke-dashoffset:0}}
.ln circle{opacity:0;animation:lp 3.5s ease infinite}
@keyframes lp{0%,45%{opacity:0;r:0}55%,100%{opacity:1;r:4}}
/* range sweep */
.cal{display:grid;grid-template-columns:repeat(7,24px);gap:4px}
.cal i{height:24px;border-radius:6px;background:rgba(255,255,255,.06)}
.cal i.s{animation:sel 3.2s ease infinite}
@keyframes sel{0%,10%{background:rgba(255,255,255,.06)}30%,85%{background:#D69E3A}100%{background:rgba(255,255,255,.06)}}
/* glow border */
.glow{width:200px;height:44px;border-radius:12px;position:relative;display:flex;align-items:center;padding:0 14px;font-size:13px;color:#A9A59C;background:#15130F}
.glow::before{content:"";position:absolute;inset:-2px;border-radius:14px;z-index:-1;background:conic-gradient(from var(--a),#D69E3A,transparent 30%,transparent 70%,#D69E3A);animation:gl 3s linear infinite}
@property --a{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes gl{to{--a:360deg}}
/* text reveal */
.tr span{display:inline-block;opacity:0;transform:translateY(10px);animation:wr 3.6s ease infinite;font-size:22px;font-weight:800}
@keyframes wr{0%{opacity:0;transform:translateY(10px)}15%,80%{opacity:1;transform:none}95%,100%{opacity:0}}
/* theme morph */
.morph{width:64px;height:64px;border-radius:50%;background:#F2B65A;box-shadow:0 0 30px #F2B65A88;position:relative;animation:mo 4s ease-in-out infinite}
.morph::after{content:"";position:absolute;width:48px;height:48px;border-radius:50%;background:#0B0A08;top:-6px;right:-30px;animation:mo2 4s ease-in-out infinite}
@keyframes mo{0%,40%{background:#F2B65A;box-shadow:0 0 30px #F2B65A88}50%,90%{background:#E9E3D6;box-shadow:0 0 18px #E9E3D655}100%{background:#F2B65A}}
@keyframes mo2{0%,40%{top:-6px;right:-30px}50%,90%{top:-8px;right:-10px}100%{top:-6px;right:-30px}}
/* drag reorder */
.dr{display:grid;grid-template-columns:repeat(2,70px);gap:8px;position:relative}
.dr i{height:44px;border-radius:10px;background:rgba(255,255,255,.08)}
.dr i.m{position:absolute;width:70px;left:0;top:0;background:rgba(214,158,58,.4);box-shadow:0 14px 24px -10px #000;animation:mv 3.6s cubic-bezier(.6,0,.2,1) infinite}
@keyframes mv{0%,15%{transform:none}45%,70%{transform:translate(78px,52px) rotate(3deg) scale(1.05)}85%,100%{transform:translate(78px,52px)}}
/* empty state float */
.es{width:90px;height:70px;border-radius:12px;background:linear-gradient(135deg,#2A2114,#15130F);border:1px solid rgba(214,158,58,.35);animation:fl 3.5s ease-in-out infinite;position:relative}
.es::after{content:"";position:absolute;left:50%;bottom:-22px;width:60px;height:8px;margin-left:-30px;border-radius:50%;background:rgba(0,0,0,.6);animation:sh 3.5s ease-in-out infinite}
@keyframes fl{50%{transform:translateY(-10px) rotate(-3deg)}}
@keyframes sh{50%{transform:scaleX(.7);opacity:.5}}
/* hover lift */
.hl{display:flex;gap:10px}
.hl i{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.07);animation:lift 2.4s ease infinite}
.hl i:nth-child(2){animation-delay:.3s}.hl i:nth-child(3){animation-delay:.6s}
@keyframes lift{0%,40%,100%{transform:none;box-shadow:none}20%{transform:translateY(-6px);box-shadow:0 12px 20px -10px #D69E3A;background:rgba(214,158,58,.25)}}
/* progress milestones */
.pm{width:220px;height:10px;border-radius:99px;background:rgba(255,255,255,.08);position:relative}
.pm i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#8A5A12,#D69E3A);animation:pmf 3.4s ease infinite}
.pm b{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#15130F;border:2px solid rgba(255,255,255,.2);animation:pmb 3.4s ease infinite}
@keyframes pmf{0%{width:0}70%,100%{width:86%}}
@keyframes pmb{0%,40%{border-color:rgba(255,255,255,.2);background:#15130F}50%,100%{border-color:#D69E3A;background:#D69E3A}}
/* streak flame */
.fl2{font-size:40px;animation:flick 1.2s ease-in-out infinite alternate;transform-origin:bottom}
@keyframes flick{to{transform:scale(1.08) rotate(-3deg);filter:drop-shadow(0 0 12px #F2B65A)}}
.chk{display:flex;gap:6px;margin-top:8px}
.chk i{width:16px;height:16px;border-radius:4px;background:#5FD39B;animation:pop2 .4s cubic-bezier(.3,1.6,.5,1) both}
@keyframes pop2{from{transform:scale(0)}}
/* spotlight shimmer on cards */
.sp{width:200px;height:100px;border-radius:14px;background:#15130F;border:1px solid rgba(255,255,255,.08);position:relative;overflow:hidden}
.sp::after{content:"";position:absolute;inset:0;background:radial-gradient(120px 80px at var(--x) 40%,rgba(214,158,58,.25),transparent 70%);animation:spx 3s ease-in-out infinite alternate}
@property --x{syntax:'<percentage>';inherits:false;initial-value:0%}
@keyframes spx{to{--x:100%}}
/* number delta */
.dl{display:flex;align-items:baseline;gap:8px}
.dl b{font-size:40px;font-weight:800}
.dl span{font-size:13px;font-weight:800;color:#5FD39B;animation:up 2.4s ease infinite}
@keyframes up{0%{opacity:0;transform:translateY(8px)}20%,80%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-8px)}}
/* sticky note / announcement flip */
.af{width:180px;height:100px;perspective:600px}
.af div{width:100%;height:100%;position:relative;transform-style:preserve-3d;animation:afl 5s ease-in-out infinite}
.af span{position:absolute;inset:0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;backface-visibility:hidden;padding:10px;text-align:center}
.af span:first-child{background:#2A2114;color:#F0C985;border:1px solid rgba(214,158,58,.4)}
.af span:last-child{background:#12291D;color:#5FD39B;transform:rotateY(180deg)}
@keyframes afl{0%,40%{transform:none}50%,90%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
.plan{margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.plan ul{margin:0;padding-left:18px;color:#C9C5BC;font-size:13px;line-height:1.75}
.plan b{color:#F0C985}
.no{opacity:.55;text-decoration:line-through}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>\n</helmet>`;

function motionV2() {
  const heart = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<i style="--x:${Math.round(Math.cos(a) * 34)}px;--y:${Math.round(Math.sin(a) * 34)}px"></i>`; }).join('');
  const D = (title, where, stage, text) => `<div class="demo"><div class="stage">${stage}</div><h2>${title}</h2><span class="where">${where}</span><p>${text}</p></div>`;
  return `<div class="mb">
<h1>Motion library — more ideas for review</h1>
<p class="lead">Everything here is live. Each idea says where it would be used. Rule of thumb: motion only when something <b>changes</b> or <b>deserves a moment</b>. All of it switches off with “Reduce motion”. The Super Admin globe has been dropped as you asked.</p>

<div class="sec">Already approved (from the last board)</div>
<p style="margin:0;color:#C9C5BC;font-size:13px">Count-up numbers · ring &amp; bar fills · check-in pulse + celebration burst · tilt-and-shine cards · 3D rotating ID badge · isometric layers · staggered entrance · shimmer skeletons · <span class="no">live globe</span></p>

<div class="sec">Numbers &amp; data</div>
<div class="g">
  ${D('Odometer roll', 'Home KPIs, leave balance', '<div class="odo"><span style="--d:4">0<br>1<br>2<br>3<br>4</span><span style="--d:9">0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</span><span style="--d:3">0<br>1<br>2<br>3</span></div>', 'Digits roll into place like a counter — feels more “live” than a fade for big numbers.')}
  ${D('Change badge', 'Reports, Super Admin', '<div class="dl"><b>560</b><span>▲ 12</span></div>', 'When a number changes while you watch, the difference floats up for a moment.')}
  ${D('Chart lines draw in', 'Reports, Hours by project', '<svg class="ln" width="220" height="110" viewBox="0 0 220 110"><path d="M8 90 L50 70 L90 78 L130 40 L170 52 L212 18" fill="none" stroke="#D69E3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="212" cy="18" r="4" fill="#D69E3A"/></svg>', 'Lines trace left to right and the latest point pops — you read the trend as it appears.')}
  ${D('Milestone progress', 'Profile completion, onboarding checklist', '<div class="pm"><i></i><b style="left:30%"></b><b style="left:60%"></b><b style="left:86%"></b></div>', 'The bar fills and each milestone lights up as it’s passed.')}
</div>

<div class="sec">Actions &amp; feedback</div>
<div class="g">
  ${D('Approve → swipe away', 'Approvals inbox, Needs your action', '<div class="sw"><div>Leave · Priya · 2 days</div><div class="gone">✓ Approved · Amit · WFH</div><div>Expense · Neha · ₹2,400</div><div>Asset · Rohan · Monitor</div></div>', 'The approved row slides out and the list closes the gap — you see it’s done without reading a toast.')}
  ${D('Success tick draws', 'After submit: leave, claim, ticket, timesheet', '<svg class="ck" width="90" height="90" viewBox="0 0 90 90"><circle cx="45" cy="45" r="38" fill="none" stroke="#5FD39B" stroke-width="4"/><path d="M28 46 l12 12 l22 -24" fill="none" stroke="#5FD39B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'A ring and tick draw themselves — a clear “sent” moment in dialogs.')}
  ${D('Toast with timer', 'Every save / error message', '<div class="toast"><b class="ok">Leave applied</b><div style="color:#A9A59C;margin-top:2px">Sent to Rohan for approval</div></div>', 'Slides in, a thin bar shows how long it stays; hovering keeps it open.')}
  ${D('Kudos heart burst', 'Kudos wall, Celebrations card', `<div class="hb"><svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>${heart}</div>`, 'Liking or sending kudos gives a small burst of hearts.')}
  ${D('Notification bell', 'Top bar (no layout change)', '<div class="bell"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><b>3</b></div>', 'When something new arrives the bell gives one small ring and the count pops.')}
  ${D('Date range sweep', 'Apply leave, WFH request', `<div class="cal">${Array.from({ length: 21 }, (_, i) => `<i class="${i >= 9 && i <= 12 ? 's' : ''}" style="animation-delay:${i >= 9 ? (i - 9) * 0.12 : 0}s"></i>`).join('')}</div>`, 'Picking days fills them in one after another, so the length of the leave is obvious.')}
  ${D('Drag to rearrange', 'Customise my home (later)', '<div class="dr"><i></i><i></i><i></i><i></i><i class="m"></i></div>', 'Lift a card and drop it elsewhere; the others slide aside. Fits the “make it yours” idea.')}
  ${D('Card flip', 'Announcement → “Acknowledged”', '<div class="af"><div><span>Updated leave policy<br>Tap to acknowledge</span><span>✓ Acknowledged<br>Thanks, Amit</span></div></div>', 'Acknowledging flips the card to its confirmed side.')}
</div>

<div class="sec">Delight &amp; atmosphere (light touch)</div>
<div class="g">
  ${D('Greeting reveal', 'Hero greeting, once a day', '<div class="tr"><span>Good</span> <span style="animation-delay:.12s">morning,</span> <span style="animation-delay:.24s;color:#E8BD6E">Amit</span></div>', 'Words rise in on the first visit of the day only — not on every page load.')}
  ${D('Attendance streak', 'My attendance, hero', '<div style="text-align:center"><div class="fl2">🔥</div><div style="font-weight:800">12-day on-time streak</div><div class="chk">' + Array.from({ length: 7 }, (_, i) => `<i style="animation-delay:${i * 0.08}s"></i>`).join('') + '</div></div>', 'A gentle nudge for punctuality; celebrates at 5, 10, 20 days. Can be turned off by the company.')}
  ${D('Pointer spotlight', 'Hero and feature cards (desktop)', '<div class="sp"></div>', 'A soft gold light follows the pointer across the hero — depth without heavy 3D.')}
  ${D('Light ↔ dark morph', 'Theme toggle in the top bar', '<div class="morph"></div>', 'The sun turns into a moon while the page cross-fades between themes.')}
  ${D('Focus glow', 'Search, important inputs', '<div class="glow">Search people…</div>', 'A slow gold line runs around the focused field.')}
  ${D('Floating empty state', 'Empty lists everywhere', '<div class="es"></div>', 'Empty screens get a calm floating illustration instead of a blank box.')}
  ${D('Hover lift', 'Quick actions, tiles', '<div class="hl"><i></i><i></i><i></i></div>', 'Tiles rise slightly with a gold glow when pointed at.')}
</div>

<div class="plan">
  <div class="demo"><h2>Speed &amp; comfort rules</h2><ul>
    <li><b>Durations:</b> 150 ms taps, 240 ms panels, 600 ms first-load numbers</li>
    <li><b>Only transform &amp; opacity</b> — smooth on low-end laptops</li>
    <li>Loops only on: check-in invite, celebrations &amp; kudos carousels (pause on hover)</li>
    <li>3D &amp; pointer effects <b>off on phones</b></li></ul></div>
  <div class="demo"><h2>Accessibility</h2><ul>
    <li>“Reduce motion” (Preferences + device) turns all of it off</li>
    <li>Carousels: pause on hover/focus, arrows + dots, readable by screen readers</li>
    <li>Numbers announce the final value, not each step</li>
    <li>No flashing faster than 3× a second</li></ul></div>
  <div class="demo"><h2>Phases (your plan)</h2><ul>
    <li><b>Now:</b> mixed dashboards + these motions</li>
    <li><b>Phase 2:</b> enhance every module’s UI, then 2–3 whole-UI style themes</li>
    <li><b>Phase 3:</b> font styles</li>
    <li>Motion is a theme token, so each future style can have its own feel</li></ul></div>
</div>
</div>`;
}

module.exports = { PEOPLE, face, mixCss, confetti, celebrationsCard, kudosCard, ringSvg, mixEmployee, mixAdmin, mixSuper };
if (require.main !== module) return;
const out = [
  ['MixEmployee', 'Mixed · Employee home — balanced + Bento hero + motion', () => shellPage('Mixed employee home', 'employee', 'Home', light, false, 1640, mixEmployee(light, false), mixCss(light, false))],
  ['MixAdmin', 'Mixed · Company Admin / HR home', () => shellPage('Mixed admin home', 'admin', 'Home', light, false, 1560, mixAdmin(light, false), mixCss(light, false))],
  ['MixSuper', 'Mixed · Super Admin overview (no globe)', () => shellPage('Mixed super admin', 'super', 'Platform', light, false, 1120, mixSuper(light), mixCss(light, false))],
  ['MixEmployeeDark', 'Mixed · Employee home (dark mode)', () => shellPage('Mixed employee home dark', 'employee', 'Home', dark, true, 1640, mixEmployee(dark, true), mixCss(dark, true))],
  ['MotionLibrary', 'Motion library — 19 more animation ideas (live)', () => dcPage('Motion library', motionCss, motionV2(), 2020)],
];
for (const [file, , fn] of out) fs.writeFileSync(`${dir}/project/${file}.dc.html`, fn());
console.log('built', out.map((o) => o[0]).join(', '));
