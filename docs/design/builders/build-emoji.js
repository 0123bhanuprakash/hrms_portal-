// Whole app → Emoji animations: every emoji the app uses gets its own small move (catalogue),
// and how they look in place (reactions, ribbons, toasts, chips, empty states) in light + dark.
const fs = require('fs');
const path = require('path');
const { icon, dcPage } = require('./build-balanced.js');
const { sidebar, C } = require('./build-reports.js');
const { css: peopleCss } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

const header = (crumb) => `<header class="hdr"><div class="crumb">${crumb}</div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;
const top = (eyebrow, title, sub) => `<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div></div>`;
const NEW = `<span class="new">NEW</span>`;

// emoji → [move class, name, where it is used, trigger]
const E = [
  ['🎉', 'pop', 'Party pop', 'Reactions, toasts, holidays, “all caught up”', 'click · appear'],
  ['👋', 'wave', 'Wave', 'Announcements “Wave”, greetings', 'click · hover'],
  ['❤️', 'beat', 'Heartbeat', 'Kudos & announcement reactions', 'click'],
  ['👏', 'clap', 'Clap', 'Kudos & announcement reactions', 'click'],
  ['👍', 'bump', 'Thumbs bump', 'Announcement reactions, stories', 'click'],
  ['🔥', 'flick', 'Flicker', 'Kudos reactions', 'click'],
  ['🙌', 'raise', 'Hands up', 'Kudos reactions', 'click'],
  ['🙏', 'bow', 'Thank-you bow', 'Announcement reactions', 'click'],
  ['🎂', 'hop', 'Birthday hop', 'Birthday ribbon, People, quick look', 'appear · hover'],
  ['🏆', 'shine', 'Trophy shine', 'Work anniversary, kudos insights', 'appear · hover'],
  ['⭐', 'twinkle', 'Twinkle', 'Ratings (helpdesk, stars)', 'appear'],
  ['🌴', 'sway', 'Palm sway', 'Leave days in timesheets & calendar', 'hover'],
  ['🪔', 'glow', 'Diya glow', 'Festival covers (Diwali)', 'appear · hover'],
  ['💡', 'glow', 'Idea glow', 'Announcement covers, tips', 'hover'],
  ['📣', 'shout', 'Megaphone', 'Announcement covers', 'hover'],
  ['📅', 'flip', 'Page flip', 'Event covers, dates', 'hover'],
  ['🛠️', 'turn', 'Tool turn', 'Maintenance, repairs', 'hover'],
  ['⏳', 'hour', 'Hourglass', 'Loans, waiting states', 'appear (slow)'],
  ['🎧', 'waves', 'Sound waves', 'Headset (assets)', 'hover'],
  ['🌿', 'sway', 'Leaf sway', 'Wellness covers', 'hover'],
  ['📘', 'tilt', 'Book tilt', 'Policy covers', 'hover'],
  ['⚠️', 'pulse', 'Soft pulse', 'Warnings, covers', 'appear (once)'],
  ['🚀', 'launch', 'Launch', 'DevOps team (new), releases', 'hover'],
  ['🤩', 'pop', 'Faces', 'Helpdesk rating faces', 'hover · click'],
];

const css = peopleCss.replace('</style>', `
.new{display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:.06em;padding:2px 6px;border-radius:5px;background:${C.pri};color:#fff;vertical-align:middle;margin-left:4px}
.emo{display:inline-block;line-height:1;position:relative}
/* Demo: every move plays, rests, plays again. In the app each plays ONCE on its trigger. */
.pop{animation:pop 3.2s cubic-bezier(.3,1.6,.5,1) infinite}@keyframes pop{0%,55%,100%{transform:none}10%{transform:scale(.7) rotate(-14deg)}22%{transform:scale(1.3) rotate(10deg)}34%{transform:scale(1) rotate(0)}}
.wave{animation:wave 3s ease-in-out infinite;transform-origin:70% 75%}@keyframes wave{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(16deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(14deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}}
.beat{animation:beat 2.6s ease-in-out infinite}@keyframes beat{0%,50%,100%{transform:scale(1)}10%{transform:scale(1.28)}20%{transform:scale(1)}30%{transform:scale(1.18)}40%{transform:scale(1)}}
.clap{animation:clap 2.6s ease-in-out infinite}@keyframes clap{0%,46%,100%{transform:scale(1)}8%,24%{transform:scale(.8,1.08)}16%,32%{transform:scale(1.1)}}
.bump{animation:bump 2.8s cubic-bezier(.3,1.6,.5,1) infinite;transform-origin:50% 90%}@keyframes bump{0%,45%,100%{transform:none}15%{transform:translateY(-7px) rotate(-14deg)}30%{transform:none}}
.flick{animation:flick 1.6s ease-in-out infinite;transform-origin:50% 100%}@keyframes flick{0%,100%{transform:scale(1,1) skewX(0)}25%{transform:scale(.95,1.1) skewX(-3deg)}50%{transform:scale(1.04,.96) skewX(2deg)}75%{transform:scale(.97,1.08) skewX(-1deg)}}
.raise{animation:raise 2.8s ease-in-out infinite}@keyframes raise{0%,50%,100%{transform:none}12%,32%{transform:translateY(-8px)}22%{transform:translateY(-2px)}}
.bow{animation:bow 3.2s ease-in-out infinite;transform-origin:50% 100%}@keyframes bow{0%,55%,100%{transform:none}20%,35%{transform:rotate(12deg) translateY(2px)}}
.hop{animation:hop 3s ease-in-out infinite}@keyframes hop{0%,50%,100%{transform:none}12%{transform:translateY(-10px) rotate(-6deg)}24%{transform:none}32%{transform:translateY(-4px) rotate(4deg)}40%{transform:none}}
.shine{animation:shtilt 3.6s ease-in-out infinite;overflow:hidden}.shine:after{content:'';position:absolute;inset:-20%;background:linear-gradient(110deg,transparent 40%,rgba(255,255,255,.9) 50%,transparent 60%);transform:translateX(-120%);animation:glint 3.6s ease-in-out infinite;mix-blend-mode:soft-light}
@keyframes glint{0%,30%{transform:translateX(-120%)}55%,100%{transform:translateX(120%)}}@keyframes shtilt{0%,60%,100%{transform:none}30%{transform:rotate(-6deg) scale(1.08)}}
.twinkle{animation:tw 3s ease-in-out infinite}@keyframes tw{0%,55%,100%{transform:none;opacity:1}15%{transform:rotate(72deg) scale(1.25)}30%{transform:rotate(144deg) scale(1);opacity:.8}}
.sway{animation:sway 5s ease-in-out infinite;transform-origin:50% 100%}@keyframes sway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.glow{position:relative}.glow:before{content:'';position:absolute;left:50%;top:50%;width:150%;height:150%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.55),transparent 65%);animation:halo 3.4s ease-in-out infinite;z-index:-1}
@keyframes halo{0%,100%{opacity:.25;transform:translate(-50%,-50%) scale(.8)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}}
.shout{animation:shout 2.8s ease-in-out infinite}@keyframes shout{0%,50%,100%{transform:none}10%{transform:rotate(-12deg) scale(1.1)}20%{transform:rotate(6deg) scale(1.15)}30%{transform:rotate(-4deg)}}
.flip{animation:flipx 3.4s ease-in-out infinite}@keyframes flipx{0%,50%,100%{transform:perspective(200px) rotateX(0)}25%{transform:perspective(200px) rotateX(-180deg)}}
.turn{animation:turn 2.8s ease-in-out infinite;transform-origin:60% 60%}@keyframes turn{0%,55%,100%{transform:none}12%{transform:rotate(-28deg)}26%{transform:rotate(22deg)}40%{transform:rotate(-8deg)}}
.hour{animation:hour 4.5s ease-in-out infinite}@keyframes hour{0%,40%{transform:rotate(0)}55%,100%{transform:rotate(180deg)}}
.waves{animation:none}.waves:before,.waves:after{content:'';position:absolute;top:50%;width:.5em;height:.5em;margin-top:-.25em;border:2px solid ${C.info};border-radius:50%;opacity:0;animation:wv 2.2s ease-out infinite}.waves:before{left:-.3em}.waves:after{right:-.3em;animation-delay:.6s}
@keyframes wv{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.2);opacity:0}}
.tilt{animation:tilt 3.4s ease-in-out infinite}@keyframes tilt{0%,55%,100%{transform:perspective(200px) rotateY(0)}25%{transform:perspective(200px) rotateY(-35deg) scale(1.08)}}
.pulse{animation:pls 3s ease-in-out infinite}@keyframes pls{0%,60%,100%{transform:scale(1)}20%{transform:scale(1.14)}40%{transform:scale(1)}}
.launch{animation:launch 3.4s ease-in-out infinite}@keyframes launch{0%,60%,100%{transform:none;opacity:1}25%{transform:translate(14px,-14px);opacity:0}26%{transform:translate(-10px,10px);opacity:0}45%{transform:none;opacity:1}}
/* float-up burst copies (click on a reaction) */
.burst{position:absolute;left:50%;top:0;font-size:.6em;opacity:0;animation:fup 3.2s ease-out infinite}
.burst.b2{animation-delay:.15s;margin-left:-.6em}.burst.b3{animation-delay:.3s;margin-left:.4em}
@keyframes fup{0%,8%{opacity:0;transform:translateY(0) scale(.6)}14%{opacity:1}45%,100%{opacity:0;transform:translateY(-34px) scale(1)}}
.tile{border:1px solid ${C.border};border-radius:14px;background:#fff;padding:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.tile .est{height:66px;width:100%;border-radius:10px;background:radial-gradient(circle at 50% 40%,#fff,#F1F2F8);display:flex;align-items:center;justify-content:center;font-size:36px;isolation:isolate}
.trig{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:${C.pri}}
.rx{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:99px;border:1px solid ${C.border};background:#fff;font-size:12.5px;font-weight:700;position:relative}
.rx.on{border-color:${C.pri};background:${C.priSoft};color:${C.priText}}
.dk{background:#0E1220;color:#E6E8F2}.dk .card{background:#171C2E;border-color:#262D45}.dk .mut{color:#8C93AD}
.dk .rx{background:#1E2438;border-color:#2F3754;color:#E6E8F2}.dk .rx.on{background:#2B2A5E;border-color:#6366F1;color:#C7D2FE}
.pane{border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;border:1px solid ${C.border}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`);

const em = (e, cls, extra = '') => `<span class="emo ${cls}">${e}${extra}</span>`;
const moveOf = (e) => (E.find((x) => x[0] === e) || [e, 'pop'])[1];

// ─── Board 1: catalogue ─────────────────────────────────────
function catalogue() {
  const html = `<div class="app">${sidebar()}<div class="col">${header('Whole app &nbsp;›&nbsp; <b>Emoji animations</b>')}<main class="main">
${top('Whole app', 'Emoji animations ' + NEW, 'Every emoji the app shows gets its own small move. Here they loop so you can see them; in the app each plays <b>once</b> — when you click, hover, or when it first appears.')}
<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:10px">
${E.map(([e, cls, name, where, trig]) => `<div class="tile"><div class="est">${em(e, cls)}</div><b style="font-size:12.5px">${name}</b><span class="trig">${trig}</span><span class="xs mut" style="line-height:1.3">${where}</span></div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
<div class="card sec" style="gap:8px"><h3>${icon('sparkle', 15)}When they play</h3>
<div class="xs"><b>Click</b> — reactions: the emoji pops and 3 small copies float up (like the 👋 Wave today, now for all).</div>
<div class="xs"><b>Hover</b> — covers, chips, cards: the emoji does its move once.</div>
<div class="xs"><b>Appear</b> — birthday ribbon, toasts, “all caught up”: once when shown. Never loops forever.</div></div>
<div class="card sec" style="gap:8px"><h3>${icon('sliders', 15)}Follows your motion setting</h3>
<table class="tbl" style="font-size:12px"><tr><td><b>Lively</b></td><td>click + hover + appear</td></tr><tr><td><b>Calm</b></td><td>only when you click</td></tr><tr><td><b>Off / Reduce motion</b></td><td>still emoji</td></tr></table></div>
<div class="card sec" style="gap:8px"><h3>${icon('check', 15)}Stay still on purpose</h3>
<div class="xs mut">Status dots <b>🔴 🟠 🟢 🔵</b>, arrows and symbols <b>↔ ▶ ⏸ ⚑</b>, and plain icons like <b>💼 🏢</b> do not move — they carry meaning, and moving them would distract.</div>
<div class="xs mut">Built once as a shared <b>&lt;Emoji&gt;</b> piece + one CSS file, so a new emoji added later gets a move too (default: pop).</div></div>
</div>
</main></div></div>`;
  return dcPage('Emoji animations', css, html, 1180);
}

// ─── Board 2: in place (light + dark) ───────────────────────
function inPlace() {
  const KUDOS = ['👏', '🎉', '❤️', '🔥', '🙌'];
  const ANN = ['👍', '❤️', '🎉', '🙏', '👏', '👋'];
  const pane = (dark) => `<div class="pane ${dark ? 'dk' : ''}" style="${dark ? 'border-color:#262D45' : 'background:#fff'}">
<b class="xs mut">${dark ? 'DARK' : 'LIGHT'}</b>
<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="xs mut">Kudos card · reactions</div><b style="font-size:13.5px">Neha → Amit: “Thanks for fixing the release build at 11 pm!”</b>
<div class="row" style="gap:6px;flex-wrap:wrap">${KUDOS.map((e, i) => `<span class="rx ${i === 1 ? 'on' : ''}">${em(e, moveOf(e), i === 1 ? `<span class="burst">${e}</span><span class="burst b2">${e}</span><span class="burst b3">${e}</span>` : '')}<span>${[4, 9, 6, 2, 3][i]}</span></span>`).join('')}</div></div>
<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="xs mut">Announcement · reactions + Wave</div><b style="font-size:13.5px">Diwali holiday on Fri 6 Nov ${em('🪔', 'glow')}</b>
<div class="row" style="gap:6px;flex-wrap:wrap">${ANN.map((e, i) => `<span class="rx ${i === 5 ? 'on' : ''}">${em(e, moveOf(e))}<span>${[12, 8, 15, 3, 5, 21][i]}</span></span>`).join('')}</div></div>
<div class="row" style="gap:10px;flex-wrap:wrap">
<span class="rx" style="height:34px">${em('🎂', 'hop')} Birthday today</span>
<span class="rx" style="height:34px">${em('🏆', 'shine')} 5 years today</span>
<span class="rx" style="height:34px">${em('🌴', 'sway')} Casual leave</span>
<span class="rx" style="height:34px">${em('🎉', 'pop')} Gandhi Jayanti</span></div>
<div class="row" style="gap:10px;align-items:stretch">
<div class="card" style="flex:1;padding:12px;display:flex;gap:10px;align-items:center"><span style="font-size:26px">${em('🎉', 'pop')}</span><div class="xs"><b>Kudos sent to Amit</b><div class="mut">toast</div></div></div>
<div class="card" style="flex:1;padding:12px;display:flex;gap:10px;align-items:center"><span style="font-size:26px">${em('🎉', 'pop')}</span><div class="xs"><b>You’re all caught up</b><div class="mut">empty state</div></div></div></div>
<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:8px;align-items:center"><div class="xs mut">Helpdesk · rate with faces</div><div class="row" style="gap:12px;font-size:26px">${['😞', '🙁', '😐', '🙂', '🤩'].map((e, i) => i === 4 ? em(e, 'pop') : `<span style="opacity:.5">${e}</span>`).join('')}</div></div>
</div>`;
  const html = `<div class="app">${sidebar()}<div class="col">${header('Whole app &nbsp;›&nbsp; <b>Emoji animations in place</b>')}<main class="main">
${top('Whole app', 'Emoji animations — in place', 'The same moves inside real screens: Kudos, Announcements, People ribbons, Timesheets chips, toasts, empty states and Helpdesk. Light and dark.')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">${pane(false)}${pane(true)}</div>
<div class="row xs mut" style="gap:16px">${['Clicking a reaction: pop + 3 copies float up, then the count ticks', 'Live (WebSocket): when someone else reacts, their emoji does a small pop on your screen too', 'Under 1 s each, transform + opacity only'].map((t) => `<span class="row" style="gap:6px">${icon('check', 13)}${t}</span>`).join('')}</div>
</main></div></div>`;
  return dcPage('Emoji animations in place', css, html, 1180);
}

const boards = [
  ['EmojiMotion.dc.html', 'Whole app · Emoji animations — every emoji the app uses with its own move; click / hover / appear; Lively, Calm, Off', catalogue, 1180],
  ['EmojiInPlace.dc.html', 'Whole app · Emoji animations in place — kudos & announcement reactions, ribbons, chips, toasts, empty states, helpdesk faces (light + dark)', inPlace, 1180],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
const ROW_Y = 57500;
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: ROW_Y };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n22 = { kind: 'title1', maxW: 6000, text: 'Whole app · Emoji animations — every emoji gets its own move (click, hover, appear), in place, light + dark', w: 240, x: 0, y: ROW_Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
