// Ambient page backgrounds — one consistent system, a different "mood" per page family.
// Layout, components and content of every page stay as they are; only the canvas behind
// the content changes. Every board shows a live dark preview, a light preview and the spec.
const fs = require('fs');
const path = require('path');
const { dcPage } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

// ─── Shared styles ─────────────────────────────────────────
const css = `<style>
*{box-sizing:border-box}
.bd{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:#F6F6F9;color:#16161D;padding:34px 40px;min-height:100%}
.bd h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0}
.bd .sub{color:#6B6B76;font-size:13.5px;margin-top:4px;max-width:900px;line-height:1.5}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#4F46E5}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.tag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;background:#EEF0FF;color:#4338CA}
.tag.g{background:#E8F7EF;color:#047857}.tag.a{background:#FEF3E2;color:#B45309}.tag.n{background:#ECECF1;color:#4B4B55}
.cols{display:flex;gap:22px;margin-top:20px;align-items:flex-start}
.side{width:378px;flex:none;display:flex;flex-direction:column;gap:14px}
.cap{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A8A95;margin-bottom:6px}
.spec{background:#fff;border:1px solid #E5E5EC;border-radius:14px;padding:14px 16px;font-size:12.5px;line-height:1.55}
.spec dl{display:grid;grid-template-columns:96px 1fr;gap:6px 10px;margin:0}.spec dt{color:#8A8A95;font-weight:700}.spec dd{margin:0}
.spec ul{margin:0;padding-left:17px}.spec li{margin:2px 0}
.mini{width:378px;height:221px;border-radius:12px;overflow:hidden;border:1px solid #E5E5EC;position:relative}
.mini > .stage{transform:scale(.39375);transform-origin:0 0;position:absolute;left:0;top:0}

/* ── App frame (sidebar + top bar stay exactly as today) ── */
.stage{--bg:#0E0E11;--surf:#16161B;--raise:#1C1C22;--line:#26262E;--tx:#EDEDF2;--mu:#8C8C99;--pri:#E3A63B;--pri2:#F2C46D;--a2:#8B5CF6;--a3:#14B8A6;--glow:.5;
 width:960px;height:560px;border-radius:16px;overflow:hidden;position:relative;display:flex;background:var(--bg);color:var(--tx);border:1px solid #2A2A33;box-shadow:0 30px 60px -30px rgba(10,10,20,.5);flex:none}
.stage.light{--bg:#F7F7FA;--surf:#FFFFFF;--raise:#FFFFFF;--line:#E7E7EE;--tx:#16161D;--mu:#71717C;--pri:#4F46E5;--pri2:#818CF8;--a2:#A855F7;--a3:#0EA5E9;--glow:.32;border-color:#E5E5EC;box-shadow:none}
.sb{width:168px;flex:none;background:var(--surf);border-right:1px solid var(--line);padding:14px 12px;display:flex;flex-direction:column;gap:7px;position:relative;z-index:2}
.sb .lg{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;margin-bottom:8px}.sb .lg i{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,var(--pri),var(--a2))}
.sb .it{height:9px;border-radius:5px;background:var(--line);width:78%}.sb .it.on{background:var(--pri);opacity:.85;width:66%}.sb .g{height:6px;width:40%;border-radius:4px;background:var(--line);opacity:.6;margin-top:8px}
.mn{flex:1;position:relative;display:flex;flex-direction:column;min-width:0}
.tb{height:44px;flex:none;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;padding:0 18px;position:relative;z-index:2;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(10px)}
.tb .cr{height:8px;width:120px;border-radius:5px;background:var(--line)}.tb .sp{flex:1}.tb .bl{width:18px;height:18px;border-radius:50%;background:var(--line)}.tb .tg{width:34px;height:18px;border-radius:99px;background:var(--line)}
.pg{flex:1;position:relative;overflow:hidden}
.fx{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.ct{position:relative;z-index:1;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.ey{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pri)}
.h{font-size:19px;font-weight:800;letter-spacing:-.02em}
.p{font-size:11px;color:var(--mu)}
.card{background:var(--surf);border:1px solid var(--line);border-radius:12px;padding:12px;position:relative}
.ln{height:7px;border-radius:5px;background:var(--line)}.ln.s{width:40%}.ln.m{width:65%}.ln.l{width:88%}
.num{font-size:20px;font-weight:800;letter-spacing:-.02em}
.row{display:flex;gap:10px}.f1{flex:1;min-width:0}
.k4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.av{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--pri2),var(--a2));flex:none}
.btn{height:26px;padding:0 12px;border-radius:8px;background:var(--pri);color:#fff;font-size:10.5px;font-weight:800;display:inline-flex;align-items:center}
.pill{height:16px;width:54px;border-radius:99px;background:color-mix(in srgb,var(--pri) 22%,transparent)}
.trow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}.trow:last-child{border:0}

/* ── Layer 1 · ambient base: every page ── */
.base{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% -10%,color-mix(in srgb,var(--pri) 9%,transparent),transparent 60%)}
.vig{position:absolute;inset:0;background:radial-gradient(130% 100% at 50% 40%,transparent 60%,color-mix(in srgb,var(--bg) 70%,#000 30%) 100%);opacity:.35}
.light .vig{opacity:.08}

/* ── Effects (transform/opacity only, slow, pause when tab hidden) ── */
/* aurora — home */
.blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:calc(var(--glow) * .7);will-change:transform}
.b1{width:420px;height:320px;left:-80px;top:-120px;background:var(--pri);animation:drift1 38s ease-in-out infinite alternate}
.b2{width:380px;height:300px;right:-90px;top:40px;background:var(--a2);animation:drift2 46s ease-in-out infinite alternate}
.b3{width:360px;height:260px;left:30%;bottom:-160px;background:var(--a3);animation:drift3 52s ease-in-out infinite alternate;opacity:calc(var(--glow) * .5)}
@keyframes drift1{to{transform:translate(160px,90px) scale(1.15)}}
@keyframes drift2{to{transform:translate(-140px,80px) scale(.9)}}
@keyframes drift3{to{transform:translate(120px,-70px) scale(1.1)}}

/* particles — people */
.pt{position:absolute;bottom:-10px;width:4px;height:4px;border-radius:50%;background:var(--pri2);opacity:0;animation:rise linear infinite}
@keyframes rise{0%{transform:translateY(0);opacity:0}15%{opacity:calc(var(--glow) * 1)}85%{opacity:calc(var(--glow) * .8)}100%{transform:translateY(-560px);opacity:0}}
.halo{position:absolute;left:12%;top:-80px;width:520px;height:240px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--pri) 40%,transparent),transparent);opacity:var(--glow);filter:blur(10px);animation:breathe 9s ease-in-out infinite}
@keyframes breathe{50%{opacity:calc(var(--glow) * .55);transform:scale(1.06)}}

/* light sweep + dial — attendance & timesheets */
.sweep{position:absolute;top:-60%;left:0;width:34%;height:220%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.09),transparent);transform:rotate(18deg) translateX(-160%);animation:sweep 14s cubic-bezier(.45,0,.2,1) infinite}
.light .sweep{background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--pri) 10%,transparent),transparent)}
@keyframes sweep{0%,30%{transform:rotate(18deg) translateX(-160%)}75%,100%{transform:rotate(18deg) translateX(420%)}}
.dial{position:absolute;right:-140px;top:-140px;width:420px;height:420px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 70%,color-mix(in srgb,var(--pri) 60%,transparent) 88%,transparent 100%);-webkit-mask:radial-gradient(closest-side,transparent 86%,#000 87%,#000 100%);mask:radial-gradient(closest-side,transparent 86%,#000 87%,#000 100%);opacity:var(--glow);animation:spin 60s linear infinite}
.dial2{position:absolute;right:-90px;top:-90px;width:320px;height:320px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--tx) 14%,transparent)}
@keyframes spin{to{transform:rotate(360deg)}}

/* horizon — leave, who's off, holidays */
.hz1,.hz2{position:absolute;left:0;right:0;top:0;height:260px}
.hz1{background:linear-gradient(180deg,color-mix(in srgb,#F59E0B 22%,transparent),color-mix(in srgb,#EC4899 10%,transparent) 45%,transparent)}
.hz2{background:linear-gradient(180deg,color-mix(in srgb,#38BDF8 22%,transparent),color-mix(in srgb,var(--a2) 10%,transparent) 45%,transparent);animation:dawn 24s ease-in-out infinite alternate}
@keyframes dawn{0%{opacity:0}100%{opacity:1}}
.sun{position:absolute;left:62%;top:150px;width:220px;height:220px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,#FBBF24 45%,transparent),transparent);filter:blur(6px);opacity:var(--glow);animation:sunrise 24s ease-in-out infinite alternate}
@keyframes sunrise{to{transform:translateY(-70px)}}

/* blueprint grid + spotlight — projects, planner */
.grid{position:absolute;inset:-20px;background-image:radial-gradient(color-mix(in srgb,var(--tx) 22%,transparent) 1px,transparent 1.2px);background-size:22px 22px;-webkit-mask:radial-gradient(70% 80% at 50% 30%,#000,transparent);mask:radial-gradient(70% 80% at 50% 30%,#000,transparent);opacity:.55}
.spot{position:absolute;width:360px;height:360px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--pri) 38%,transparent),transparent);opacity:var(--glow);left:-60px;top:-60px;animation:roam 48s ease-in-out infinite alternate}
@keyframes roam{33%{transform:translate(420px,60px)}66%{transform:translate(200px,240px)}100%{transform:translate(560px,180px)}}

/* mesh — expenses & payments */
.mesh{position:absolute;inset:-50%;background:
 radial-gradient(25% 30% at 30% 35%,color-mix(in srgb,#10B981 60%,transparent),transparent 70%),
 radial-gradient(22% 28% at 68% 42%,color-mix(in srgb,var(--a3) 50%,transparent),transparent 70%),
 radial-gradient(26% 26% at 52% 70%,color-mix(in srgb,var(--pri) 36%,transparent),transparent 70%);
 opacity:var(--glow);filter:blur(24px);animation:meshspin 90s linear infinite}
@keyframes meshspin{to{transform:rotate(360deg)}}
.coin{position:absolute;width:10px;height:10px;border-radius:50%;border:1.5px solid color-mix(in srgb,#10B981 60%,transparent);opacity:0;animation:rise linear infinite}

/* studio light — assets */
.cone{position:absolute;left:50%;top:-40px;width:760px;height:520px;margin-left:-380px;background:radial-gradient(50% 60% at 50% 0%,color-mix(in srgb,var(--tx) 10%,transparent),transparent 70%);-webkit-mask:linear-gradient(180deg,#000,transparent);opacity:.9;animation:flicker 7s ease-in-out infinite}
@keyframes flicker{50%{opacity:.7}}
.floor{position:absolute;left:10%;right:10%;bottom:-120px;height:220px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--pri) 26%,transparent),transparent);opacity:var(--glow)}
.bok{position:absolute;border-radius:50%;background:color-mix(in srgb,var(--pri2) 40%,transparent);filter:blur(2px);opacity:calc(var(--glow) * .6);animation:bob ease-in-out infinite alternate}
@keyframes bob{to{transform:translate(30px,-40px)}}

/* signal rings — helpdesk */
.rings{position:absolute;right:60px;top:40px;width:10px;height:10px}
.rings i{position:absolute;left:-150px;top:-150px;width:310px;height:310px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--a3) 55%,transparent);opacity:0;animation:ring 9s ease-out infinite}
.rings i:nth-child(2){animation-delay:3s}.rings i:nth-child(3){animation-delay:6s}
@keyframes ring{0%{transform:scale(.25);opacity:calc(var(--glow) * 1.2)}100%{transform:scale(1.8);opacity:0}}
.core{position:absolute;right:20px;top:0;width:90px;height:90px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--a3) 45%,transparent),transparent);opacity:var(--glow)}

/* floaters — announcements & kudos */
.fl{position:absolute;bottom:-40px;opacity:0;animation:float linear infinite}
.fl.c{width:18px;height:18px;border-radius:50%;border:2px solid color-mix(in srgb,var(--pri) 55%,transparent)}
.fl.q{width:16px;height:16px;border-radius:5px;background:color-mix(in srgb,var(--a2) 30%,transparent)}
.fl.h{width:16px;height:16px;color:color-mix(in srgb,#EC4899 60%,transparent);font-size:16px;line-height:16px}
@keyframes float{0%{transform:translateY(0) rotate(0);opacity:0}12%{opacity:calc(var(--glow) * 1.1)}88%{opacity:calc(var(--glow) * .9)}100%{transform:translateY(-620px) rotate(200deg);opacity:0}}
.warm{position:absolute;left:-10%;right:-10%;top:-200px;height:420px;background:radial-gradient(50% 50% at 30% 50%,color-mix(in srgb,#F59E0B 22%,transparent),transparent),radial-gradient(40% 50% at 75% 40%,color-mix(in srgb,#EC4899 18%,transparent),transparent);opacity:var(--glow);animation:breathe 12s ease-in-out infinite}

/* data waves — reports */
.waves{position:absolute;left:0;bottom:0;width:200%;height:220px;animation:wave 34s linear infinite}
.waves.w2{animation-duration:52s;opacity:.6;bottom:-20px}
@keyframes wave{to{transform:translateX(-50%)}}
.waves path{fill:none;stroke-width:1.5}

/* quiet — settings, roles, admin forms */
.noise{position:absolute;inset:0;opacity:.05;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.qgrad{position:absolute;inset:0;background:linear-gradient(160deg,color-mix(in srgb,var(--pri) 7%,transparent),transparent 40%,color-mix(in srgb,var(--a2) 5%,transparent))}

/* pulse line — super admin */
.night{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,#1E3A8A 30%,transparent),transparent 70%)}
.light .night{background:linear-gradient(180deg,color-mix(in srgb,#3B82F6 10%,transparent),transparent 70%)}
.star{position:absolute;width:2px;height:2px;border-radius:50%;background:var(--tx);opacity:.25;animation:twinkle ease-in-out infinite alternate}
@keyframes twinkle{to{opacity:.05}}
.pulse{position:absolute;left:0;right:0;bottom:70px;height:120px}
.pulse path{fill:none;stroke-width:1.6}
.pulse .run{stroke-dasharray:90 1400;animation:run 7s linear infinite}
@keyframes run{from{stroke-dashoffset:1490}to{stroke-dashoffset:0}}

/* sign-in hero */
.big .blob{filter:blur(80px);opacity:calc(var(--glow) * 1)}

/* reduced motion: everything settles to its first frame */
.rm *{animation:none!important}
</style>`;

// ─── Skeleton content (stands in for the real page — unchanged) ─────────
const L = (c = 'm') => `<div class="ln ${c}"></div>`;
const kpis = (vals) => `<div class="k4">${vals.map(([n, t]) => `<div class="card"><div class="p">${t}</div><div class="num">${n}</div></div>`).join('')}</div>`;
const rows = (n, extra = '') => Array.from({ length: n }, (_, i) => `<div class="trow"><div class="av" style="width:20px;height:20px;opacity:${0.5 + (i % 3) * 0.2}"></div><div class="f1">${L(i % 2 ? 'm' : 'l')}</div>${extra}<div class="pill"></div></div>`).join('');
const head = (ey, h, p, btn) => `<div class="row" style="align-items:flex-end"><div class="f1"><div class="ey">${ey}</div><div class="h">${h}</div><div class="p">${p}</div></div>${btn ? `<span class="btn">${btn}</span>` : ''}</div>`;

const CONTENT = {
  dash: () => `${head('Good morning', 'Hema Iyer', 'Thursday · 3 things need you today')}
    <div class="card" style="height:92px;display:flex;gap:16px;align-items:center"><div class="av" style="width:54px;height:54px"></div><div class="f1" style="display:flex;flex-direction:column;gap:7px">${L('m')}${L('s')}</div><span class="btn">Check in</span></div>
    ${kpis([['94%', 'On time'], ['3', 'Approvals'], ['12', 'Leave left'], ['2', 'Birthdays']])}
    <div class="row f1"><div class="card f1" style="display:flex;flex-direction:column;gap:8px">${L('s')}${rows(3)}</div><div class="card" style="width:230px;display:flex;flex-direction:column;gap:8px">${L('s')}${L('l')}${L('m')}${L('l')}</div></div>`,
  people: () => `${head('People', 'Directory', '62 people · 5 departments', 'Add employee')}
    <div class="card" style="height:84px;display:flex;align-items:center;gap:14px"><div class="av" style="width:56px;height:56px;box-shadow:0 0 0 4px color-mix(in srgb,var(--pri) 25%,transparent)"></div><div class="f1" style="display:flex;flex-direction:column;gap:7px">${L('m')}${L('s')}</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${Array.from({ length: 8 }, () => `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:7px"><div class="av" style="width:34px;height:34px"></div>${L('m')}${L('s')}</div>`).join('')}</div>`,
  time: () => `${head('Attendance', 'My week', 'Checked in 09:28 · 6h 12m so far', 'Check out')}
    ${kpis([['6h 12m', 'Today'], ['38h', 'This week'], ['96%', 'On time'], ['0', 'Missed']])}
    <div class="card" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<div style="display:flex;flex-direction:column;gap:6px"><div class="p">${d}</div><div style="height:${60 + i * 14}px;border-radius:8px;background:color-mix(in srgb,var(--pri) ${18 + i * 4}%,transparent)"></div><div style="height:${40 - i * 4}px;border-radius:8px;background:color-mix(in srgb,var(--a2) 16%,transparent)"></div></div>`).join('')}</div>`,
  cal: () => `${head('Leave', 'Who’s off', 'October 2026 · 4 people away this week', 'Apply leave')}
    <div class="card" style="height:330px;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:6px">${Array.from({ length: 35 }, (_, i) => `<div style="border-radius:8px;border:1px solid var(--line);padding:5px;display:flex;flex-direction:column;gap:4px"><span class="p" style="font-size:9px">${(i % 31) + 1}</span>${[3, 9, 10, 17, 22, 23].includes(i) ? '<div style="height:6px;border-radius:4px;background:color-mix(in srgb,var(--pri) 45%,transparent)"></div>' : ''}${[10, 24].includes(i) ? '<div style="height:6px;border-radius:4px;background:color-mix(in srgb,var(--a3) 45%,transparent)"></div>' : ''}</div>`).join('')}</div>`,
  proj: () => `${head('Projects', 'Resource planner', '6 live projects · 28 people allocated', 'New project')}
    <div class="card f1" style="display:flex;flex-direction:column;gap:9px">${['Apollo', 'Zeus', 'Hermes', 'Atlas', 'Orion'].map((p, i) => `<div class="row" style="align-items:center"><div style="width:90px;font-size:11px;font-weight:700">${p}</div><div class="f1" style="position:relative;height:18px"><div style="position:absolute;left:${i * 9}%;width:${38 + (i % 3) * 14}%;height:18px;border-radius:6px;background:color-mix(in srgb,${['var(--pri)', 'var(--a2)', 'var(--a3)'][i % 3]} 40%,transparent)"></div></div></div>`).join('')}${rows(2)}</div>`,
  money: () => `${head('Expenses', 'My expenses', '₹18,420 waiting · 2 claims in review', 'New claim')}
    ${kpis([['₹18,420', 'In review'], ['₹6,200', 'Approved'], ['₹42,900', 'Paid this year'], ['1', 'Needs info']])}
    <div class="card f1">${rows(5, '<div style="width:70px;font-size:11px;font-weight:800;text-align:right">₹2,340</div>')}</div>`,
  assets: () => `${head('Assets', 'My assets', '3 things with you · 1 to confirm', 'Request an asset')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" class="f1">${['💻', '🖥️', '🪪'].map((e) => `<div class="card" style="display:flex;flex-direction:column;gap:8px;padding:0;overflow:hidden"><div style="height:110px;display:flex;align-items:center;justify-content:center;font-size:46px;background:color-mix(in srgb,var(--tx) 4%,transparent)">${e}</div><div style="padding:0 12px 12px;display:flex;flex-direction:column;gap:7px">${L('m')}${L('s')}</div></div>`).join('')}</div>`,
  help: () => `${head('Helpdesk', 'My tickets', '2 open · IT usually replies in 2 hours', 'New ticket')}
    <div class="row f1"><div class="card f1">${rows(6)}</div><div class="card" style="width:230px;display:flex;flex-direction:column;gap:8px">${L('s')}${L('l')}${L('m')}${L('l')}${L('m')}</div></div>`,
  feed: () => `${head('Engagement', 'Announcements & kudos', 'Company news, shout-outs and celebrations', 'Give kudos')}
    <div class="row f1"><div class="f1" style="display:flex;flex-direction:column;gap:10px">${[0, 1].map(() => `<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="row" style="align-items:center"><div class="av"></div><div class="f1">${L('s')}</div></div><div style="height:70px;border-radius:9px;background:linear-gradient(120deg,color-mix(in srgb,var(--pri) 30%,transparent),color-mix(in srgb,var(--a2) 25%,transparent))"></div>${L('l')}</div>`).join('')}</div><div class="card" style="width:220px;display:flex;flex-direction:column;gap:8px">${L('s')}${rows(4)}</div></div>`,
  report: () => `${head('Reports & analytics', 'People', 'Headcount, joiners & leavers, attendance trends')}
    ${kpis([['62', 'Headcount'], ['+4', 'Joined'], ['1', 'Left'], ['93%', 'Attendance']])}
    <div class="card" style="height:200px;display:flex;align-items:flex-end;gap:10px;padding:16px">${[40, 62, 55, 78, 70, 88, 64, 92, 80, 96, 85, 100].map((v, i) => `<div class="f1" style="height:${v}%;border-radius:6px 6px 2px 2px;background:color-mix(in srgb,var(--pri) ${30 + (i % 4) * 10}%,transparent)"></div>`).join('')}</div>`,
  quiet: () => `${head('Settings', 'Company settings', 'Profile, working hours, theme, notifications')}
    <div class="row f1"><div class="card" style="width:200px;display:flex;flex-direction:column;gap:10px">${L('m')}${L('l')}${L('m')}${L('s')}${L('m')}</div><div class="card f1" style="display:flex;flex-direction:column;gap:12px">${[0, 1, 2, 3].map(() => `<div style="display:flex;flex-direction:column;gap:6px">${L('s')}<div style="height:28px;border-radius:8px;border:1px solid var(--line)"></div></div>`).join('')}</div></div>`,
  sa: () => `${head('Platform', 'Super Admin', '14 companies · 1,284 people · all systems normal')}
    ${kpis([['14', 'Companies'], ['1,284', 'Seats used'], ['99.98%', 'Uptime'], ['2', 'Need attention']])}
    <div class="card f1">${rows(5)}</div>`,
};

// ─── Effects ────────────────────────────────────────────────
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const particles = (n, cls, seed, dur = [16, 30]) => {
  const r = rnd(seed);
  return Array.from({ length: n }, () => `<i class="${cls}" style="left:${(r() * 100).toFixed(1)}%;animation-duration:${(dur[0] + r() * (dur[1] - dur[0])).toFixed(1)}s;animation-delay:-${(r() * dur[1]).toFixed(1)}s;transform:scale(${(0.6 + r() * 0.8).toFixed(2)})"></i>`).join('');
};
const wavePath = (amp, y, k) => { let d = `M0 ${y}`; for (let x = 0; x <= 1600; x += 20) d += ` L${x} ${(y + Math.sin((x / 1600) * Math.PI * 2 * k) * amp).toFixed(1)}`; return d; };

const FX = {
  aurora: () => `<div class="base"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="vig"></div>`,
  particles: () => `<div class="base"></div><div class="halo"></div>${particles(26, 'pt', 7)}<div class="vig"></div>`,
  sweep: () => `<div class="base"></div><div class="dial"></div><div class="dial2"></div><div class="sweep"></div><div class="vig"></div>`,
  horizon: () => `<div class="hz1"></div><div class="hz2"></div><div class="sun"></div><div class="vig"></div>`,
  grid: () => `<div class="base"></div><div class="spot"></div><div class="grid"></div><div class="vig"></div>`,
  mesh: () => `<div class="mesh"></div>${particles(10, 'coin', 31, [22, 36])}<div class="vig"></div>`,
  studio: () => {
    const r = rnd(5);
    const bok = Array.from({ length: 9 }, () => { const s = 8 + r() * 26; return `<i class="bok" style="width:${s}px;height:${s}px;left:${(r() * 95).toFixed(1)}%;top:${(r() * 90).toFixed(1)}%;animation-duration:${(8 + r() * 10).toFixed(1)}s"></i>`; }).join('');
    return `<div class="cone"></div><div class="floor"></div>${bok}<div class="vig"></div>`;
  },
  rings: () => `<div class="base"></div><div class="core"></div><div class="rings"><i></i><i></i><i></i></div><div class="vig"></div>`,
  floaters: () => {
    const r = rnd(11);
    const kinds = ['c', 'q', 'h', 'c', 'q'];
    const f = Array.from({ length: 16 }, (_, i) => `<i class="fl ${kinds[i % 5]}" style="left:${(r() * 96).toFixed(1)}%;animation-duration:${(20 + r() * 16).toFixed(1)}s;animation-delay:-${(r() * 36).toFixed(1)}s">${kinds[i % 5] === 'h' ? '♥' : ''}</i>`).join('');
    return `<div class="warm"></div>${f}<div class="vig"></div>`;
  },
  waves: () => `<div class="base"></div>
    <svg class="waves" viewBox="0 0 1600 220" preserveAspectRatio="none"><path d="${wavePath(26, 120, 4)}" stroke="color-mix(in srgb,var(--pri) 45%,transparent)"/><path d="${wavePath(18, 150, 4)}" stroke="color-mix(in srgb,var(--a2) 35%,transparent)"/></svg>
    <svg class="waves w2" viewBox="0 0 1600 220" preserveAspectRatio="none"><path d="${wavePath(34, 110, 2)}" stroke="color-mix(in srgb,var(--a3) 40%,transparent)"/></svg><div class="vig"></div>`,
  quiet: () => `<div class="qgrad"></div><div class="noise"></div>`,
  pulse: () => {
    const r = rnd(3);
    const stars = Array.from({ length: 40 }, () => `<i class="star" style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 60).toFixed(1)}%;animation-duration:${(3 + r() * 5).toFixed(1)}s"></i>`).join('');
    const d = 'M0 80 L300 80 L330 80 L345 40 L360 110 L375 60 L390 80 L700 80 L720 80 L732 55 L745 100 L758 80 L1000 80';
    return `<div class="night"></div>${stars}<svg class="pulse" viewBox="0 0 1000 120" preserveAspectRatio="none"><path d="${d}" stroke="color-mix(in srgb,var(--a3) 22%,transparent)"/><path class="run" d="${d}" stroke="var(--a3)"/></svg><div class="vig"></div>`;
  },
  hero: () => `<div class="big">${FX.aurora()}</div>${particles(18, 'pt', 19)}`,
};

// Inline <style> overrides per family accent (stays inside the theme tokens)
const stage = (fx, content, { light = false, acc = '', cls = '' } = {}) => `<div class="stage${light ? ' light' : ''}${cls ? ' ' + cls : ''}" style="${acc}">
  <div class="sb"><div class="lg"><i></i>aakash-portal</div><div class="g"></div><div class="it on"></div><div class="it"></div><div class="it"></div><div class="g"></div><div class="it"></div><div class="it"></div><div class="it"></div><div class="g"></div><div class="it"></div><div class="it"></div></div>
  <div class="mn"><div class="tb"><div class="cr"></div><div class="sp"></div><div class="bl"></div><div class="tg"></div></div>
  <div class="pg"><div class="fx">${typeof fx === 'function' ? fx(light) : FX[fx]()}</div><div class="ct">${CONTENT[content]()}</div></div></div></div>`;

const signin = (light) => `<div class="stage${light ? ' light' : ''}" style="justify-content:center;align-items:center">
  <div class="fx">${FX.hero()}</div>
  <div class="card" style="width:330px;z-index:1;display:flex;flex-direction:column;gap:12px;padding:22px;backdrop-filter:blur(8px);background:color-mix(in srgb,var(--surf) 88%,transparent)">
  <div class="ey">aakash-portal</div><div class="h">Sign in</div><div class="p">Attendance, leave and your team — pick up where you left off.</div>
  <div style="height:30px;border-radius:8px;border:1px solid var(--line)"></div><div style="height:30px;border-radius:8px;border:1px solid var(--line)"></div><span class="btn" style="justify-content:center;height:32px">Sign in</span></div></div>`;

// ─── Boards ─────────────────────────────────────────────────
const board = ({ title, eyebrow, sub, tags, fx, content, acc = '', spec, custom }) => {
  const dark = custom ? custom(false) : stage(fx, content, { acc });
  const light = custom ? custom(true) : stage(fx, content, { light: true, acc });
  return `${css}<div class="bd">
  <div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div>
  <div class="tags">${tags.map(([t, c = '']) => `<span class="tag ${c}">${t}</span>`).join('')}</div>
  <div class="cols"><div><div class="cap">Dark · live</div>${dark}</div>
  <div class="side"><div><div class="cap">Light</div><div class="mini">${light}</div></div>
  <div class="spec"><dl>${spec.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div></div></div></div>`;
};

const FAM = [
  {
    file: 'BgHome.dc.html', title: 'Aurora', eyebrow: 'Home & dashboards', fx: 'aurora', content: 'dash',
    sub: 'Three large, very soft colour clouds drift slowly behind the dashboard — the most “alive” page, because it is the first thing people see each day.',
    tags: [['Home (all roles)'], ['Manager / HR dashboards'], ['Atmosphere moments still play on top', 'a']],
    spec: [['Layers', 'Ambient base · 3 blurred blobs (primary, violet, teal) · vignette'], ['Motion', 'Each blob drifts 38–52 s, ease-in-out, back and forth — never loops visibly'], ['Strength', 'Dark 35% · Light 22% opacity'], ['Colours', 'From the person’s theme (gold here, indigo in light)'], ['Cost', '3 GPU layers, transform only']],
  },
  {
    file: 'BgPeople.dc.html', title: 'Constellation', eyebrow: 'People, profiles & employees', fx: 'particles', content: 'people',
    sub: 'Tiny points of light rise slowly like a quiet crowd, with a soft glow behind the header — about people, not data.',
    tags: [['My profile'], ['People directory'], ['Employees'], ['Organisation chart']],
    spec: [['Layers', 'Ambient base · breathing halo behind the header · 26 rising particles'], ['Motion', 'Particles 16–30 s each, fade in & out; halo breathes every 9 s'], ['Strength', 'Particles 4 px, max 50% opacity'], ['Note', 'Org chart lines stay crisp — particles sit behind cards'], ['Cost', '26 tiny elements, transform + opacity']],
  },
  {
    file: 'BgTime.dc.html', title: 'Light sweep & dial', eyebrow: 'Attendance & timesheets', fx: 'sweep', content: 'time', acc: '--a2:#6366F1',
    sub: 'A clock-like ring turns very slowly in the corner and a gentle beam of light passes across the page every 14 s — a calm sense of time moving.',
    tags: [['Attendance · My week'], ['My timesheet'], ['Timesheet approvals'], ['Check-in pulse unchanged', 'a']],
    spec: [['Layers', 'Ambient base · rotating dial arc (60 s per turn) · dashed ring · diagonal light sweep'], ['Motion', 'Sweep crosses in ~6 s, then rests ~8 s'], ['Strength', 'Sweep 7% white (dark) / 10% accent (light)'], ['Cost', '2 layers, transform only']],
  },
  {
    file: 'BgLeave.dc.html', title: 'Calm horizon', eyebrow: 'Leave, who’s off & holidays', fx: 'horizon', content: 'cal',
    sub: 'A soft sky at the top of the page slowly shifts from sunrise warmth to clear blue — rest and time away, not work.',
    tags: [['Apply leave'], ['Leave approvals'], ['Who’s off calendar'], ['Holidays']],
    spec: [['Layers', 'Sunrise gradient · day gradient cross-fading on top · rising sun glow'], ['Motion', '24 s cross-fade, back and forth; sun rises 70 px'], ['Strength', 'Only the top 260 px — the calendar grid stays on the plain background'], ['Cost', 'Opacity + transform']],
  },
  {
    file: 'BgProjects.dc.html', title: 'Blueprint spotlight', eyebrow: 'Projects & planning', fx: 'grid', content: 'proj',
    sub: 'A faint dot grid — like planning paper — with a soft spotlight that wanders across it. Structured, but not static.',
    tags: [['Projects'], ['Project detail'], ['Resource planner'], ['My projects']],
    spec: [['Layers', 'Ambient base · wandering spotlight (48 s path) · masked dot grid'], ['Motion', 'Spotlight moves along 4 points, ease-in-out'], ['Strength', 'Grid dots 22% of text colour, faded at the edges'], ['Cost', '1 moving layer']],
  },
  {
    file: 'BgMoney.dc.html', title: 'Emerald mesh', eyebrow: 'Expenses & payments', fx: 'mesh', content: 'money',
    sub: 'A soft green-teal mesh turns very slowly, with a few faint rings drifting up like coins — trust and money, kept quiet.',
    tags: [['My expenses'], ['Expense approvals'], ['Payments & reports'], ['Categories']],
    spec: [['Layers', 'Rotating mesh of 3 radial gradients (90 s per turn) · 10 rising rings'], ['Motion', 'Mesh rotation is so slow it reads as colour shifting'], ['Colours', 'Emerald + teal (meaning: money/approved) + a touch of primary'], ['Cost', '1 large blurred layer (pre-blurred, transform only)']],
  },
  {
    file: 'BgAssets.dc.html', title: 'Studio light', eyebrow: 'Assets', fx: 'studio', content: 'assets',
    sub: 'Like a product photo studio: a soft light from above, a warm glow on the “floor”, and out-of-focus bokeh — it frames the device drawings.',
    tags: [['My assets'], ['Request an asset'], ['Register & detail'], ['Product animations unchanged', 'a']],
    spec: [['Layers', 'Top light cone (slow 7 s shimmer) · floor glow · 9 bokeh circles'], ['Motion', 'Bokeh bob 8–18 s, back and forth'], ['Strength', 'Cone 10% of text colour; floor 26% primary'], ['Cost', '11 layers, opacity + transform']],
  },
  {
    file: 'BgHelpdesk.dc.html', title: 'Signal rings', eyebrow: 'Helpdesk', fx: 'rings', content: 'help', acc: '--a3:#06B6D4',
    sub: 'Gentle rings spread out from the top corner every 3 s — “we hear you, help is on the way”.',
    tags: [['My tickets'], ['Queue'], ['Ticket detail']],
    spec: [['Layers', 'Ambient base · soft core glow · 3 staggered rings'], ['Motion', 'Each ring 9 s, scale + fade, ease-out'], ['Strength', 'Thin 1.5 px rings, max 60% → 0'], ['Cost', '3 elements, transform + opacity']],
  },
  {
    file: 'BgEngage.dc.html', title: 'Warm floaters', eyebrow: 'Announcements & kudos', fx: 'floaters', content: 'feed',
    sub: 'Soft circles, rounded squares and the odd small heart float up through a warm amber-pink glow — celebration, without confetti noise.',
    tags: [['Announcements'], ['Kudos'], ['Celebrations'], ['Kudos heart burst unchanged', 'a']],
    spec: [['Layers', 'Breathing warm glow · 16 floating shapes'], ['Motion', '20–36 s per shape, slow rotation'], ['Strength', 'Outline shapes, max 55% opacity, behind cards'], ['Cost', '16 small elements']],
  },
  {
    file: 'BgReports.dc.html', title: 'Data waves', eyebrow: 'Reports & analytics', fx: 'waves', content: 'report',
    sub: 'Thin lines flow like a live chart along the bottom of the page — data in motion, always below the real charts.',
    tags: [['Reports & analytics'], ['People / Time / Leave reports'], ['Insights']],
    spec: [['Layers', 'Ambient base · 2 wave layers at different speeds (34 s, 52 s)'], ['Motion', 'Seamless horizontal loop'], ['Strength', '1.5 px lines, 35–45% colour'], ['Cost', '2 SVG layers, transform only']],
  },
  {
    file: 'BgQuiet.dc.html', title: 'Quiet paper', eyebrow: 'Settings, roles & admin forms', fx: 'quiet', content: 'quiet',
    sub: 'No motion at all: a barely-there tint and a fine paper grain. Forms and permissions need full focus.',
    tags: [['Settings'], ['Users & roles'], ['Access explorer'], ['Imports'], ['Static', 'n']],
    spec: [['Layers', 'Diagonal tint · 5% noise grain'], ['Motion', 'None (on purpose)'], ['Why', 'Long forms, tables of permissions — nothing should move'], ['Cost', 'One static image']],
  },
  {
    file: 'BgSuperAdmin.dc.html', title: 'Night pulse', eyebrow: 'Super Admin console', fx: 'pulse', content: 'sa', acc: '--a3:#38BDF8',
    sub: 'A deep night gradient with faint stars and a heartbeat line along the bottom — “the platform is alive and healthy”. No globe, no orb.',
    tags: [['Platform dashboard'], ['Companies & plans'], ['System'], ['Turns amber/red when a system is unhealthy', 'a']],
    spec: [['Layers', 'Night gradient · 40 twinkling stars · pulse line with a travelling glow'], ['Motion', 'Pulse runs every 7 s; stars twinkle 3–8 s'], ['Live meaning', 'Line colour follows system health (teal → amber → red)'], ['Cost', '1 SVG stroke animation + tiny stars']],
  },
  {
    file: 'BgSignIn.dc.html', title: 'Hero aurora', eyebrow: 'Sign-in & welcome', custom: signin, content: 'dash',
    sub: 'The only place where the effect can be a little bolder: a bigger aurora with rising light, and a frosted sign-in card.',
    tags: [['Sign in'], ['Workspace finder'], ['Set password / welcome']],
    spec: [['Layers', 'Large aurora (stronger blur) · 18 particles · frosted card'], ['Motion', 'Same aurora timings as Home'], ['Strength', 'Dark 50% · Light 32%'], ['Cost', 'Same as Home + particles']],
  },
];

// ─── Overview + settings boards ─────────────────────────────
const tile = (f) => `<div style="display:flex;flex-direction:column;gap:6px"><div style="width:176px;height:103px;border-radius:10px;overflow:hidden;position:relative;border:1px solid #2A2A33"><div style="transform:scale(.18333);transform-origin:0 0;position:absolute">${f.custom ? f.custom(false) : stage(f.fx, f.content, { acc: f.acc || '' })}</div></div><b style="font-size:12.5px">${f.title}</b><span style="font-size:11px;color:#6B6B76">${f.eyebrow}</span></div>`;

const overview = () => `${css}<div class="bd">
  <div class="eyebrow">Backgrounds · system</div><h1>Ambient backgrounds — one system, a different mood per page</h1>
  <div class="sub">Every page keeps its layout, components, content and behaviour exactly as today. Only the canvas behind the content changes. All pages share the same 3 layers, so the app feels like one product; the middle layer changes with the page’s purpose so pages don’t look identical.</div>
  <div class="row" style="gap:14px;margin-top:20px">
    ${[['1 · Ambient base', 'A very soft glow of the theme colour at the top of every page + a light vignette. Same everywhere.'], ['2 · Page mood', 'One effect per page family (aurora, particles, sweep…). Never more than one.'], ['3 · Content', 'Cards stay solid. Sidebar and top bar unchanged (top bar gets a light frosted blur). Text contrast is never reduced.']].map(([t, d]) => `<div class="spec" style="flex:1"><b style="font-size:13.5px">${t}</b><div style="color:#6B6B76;margin-top:4px">${d}</div></div>`).join('')}
  </div>
  <div class="cap" style="margin-top:22px">The 13 moods</div>
  <div style="display:grid;grid-template-columns:repeat(7,176px);gap:16px 18px">${FAM.map(tile).join('')}</div>
  <div class="row" style="gap:14px;margin-top:22px">
    <div class="spec" style="flex:1"><b>Rules</b><ul>
      <li>Behind content only (z-index 0, no clicks). Cards, tables and charts keep solid surfaces.</li>
      <li>Slow: nothing faster than 7 s; drifts 30–90 s; ease-in-out; no flashing.</li>
      <li>Soft: max 35% opacity in dark, 22% in light (sign-in a bit more).</li>
      <li>Colours come from theme tokens — personal themes recolour every mood automatically; status colours stay semantic.</li>
      <li>Never two effects on one page; dialogs and the sidebar have none.</li></ul></div>
    <div class="spec" style="flex:1"><b>Light & fast</b><ul>
      <li>Pure CSS (+ a few SVGs) — no canvas/WebGL, no libraries.</li>
      <li>Only <code>transform</code> and <code>opacity</code> animate (GPU), blur is static.</li>
      <li>Paused when the tab is hidden; paused while scrolling long tables.</li>
      <li>Phones: particles halved, blur smaller; low-power devices get the static version.</li>
      <li>Reduced motion (system or app setting) → every effect becomes a still image.</li></ul></div>
    <div class="spec" style="flex:1"><b>Works with what exists</b><ul>
      <li>Atmosphere moments (birthday balloons, Diwali…) play on top of Home’s aurora — the aurora dims while a moment runs.</li>
      <li>Product animations, check-in pulse, kudos hearts unchanged.</li>
      <li>Light & dark: every mood has both (see each board).</li>
      <li>Phase 2 whole-UI themes can swap the mood set.</li></ul></div>
  </div></div>`;

const settings = () => `${css}<div class="bd">
  <div class="eyebrow">Backgrounds · control</div><h1>Who controls it</h1>
  <div class="sub">Each person can tone it down; the company sets the default. Sits next to the existing theme and motion settings — no new menu items.</div>
  <div class="row" style="gap:22px;margin-top:20px;align-items:flex-start">
    <div class="spec" style="width:560px"><div class="cap">My profile → Preferences → Appearance</div>
      <b style="font-size:14px">Page backgrounds</b><div style="color:#6B6B76;margin:2px 0 12px">How lively the space behind each page is.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${[['Lively', 'Moving effects (default)', true], ['Calm', 'Same look, no movement', false], ['Off', 'Plain background', false]].map(([t, d, on]) => `<div style="border:1.5px solid ${on ? '#4F46E5' : '#E5E5EC'};background:${on ? '#EEF0FF66' : '#fff'};border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px"><div style="height:62px;border-radius:8px;overflow:hidden;position:relative;background:#0E0E11">${t === 'Off' ? '' : `<div style="position:absolute;inset:0;background:radial-gradient(60% 80% at 20% 0%,#E3A63B66,transparent),radial-gradient(50% 70% at 90% 30%,#8B5CF655,transparent)"></div>`}</div><b style="font-size:12.5px">${t}</b><span style="font-size:11px;color:#6B6B76">${d}</span></div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:12px;color:#6B6B76">“Reduce motion” (already in Preferences) also switches backgrounds to Calm.</div></div>
    <div class="spec" style="flex:1"><div class="cap">Settings → Theme (Company Admin)</div>
      <dl><dt>Default</dt><dd>Lively · Calm · Off for everyone who hasn’t chosen</dd><dt>Per page</dt><dd>Optional: turn a mood off for a page family (e.g. Reports)</dd><dt>Preview</dt><dd>Every mood shown as a small live tile, like the overview board</dd></dl>
      <div class="cap" style="margin-top:14px">How it’s built</div>
      <ul><li>One <code>&lt;PageBackdrop mood="…"/&gt;</code> placed once in the app layout, behind <code>&lt;main&gt;</code>.</li><li>Mood picked from the route (e.g. <code>/app/assets/*</code> → studio); pages don’t change.</li><li>Styles in <code>backdrops.css</code>, using the existing theme tokens; respects <code>data-motion="reduce"</code> and the new <code>data-backdrop</code> setting.</li><li>Cross-fades (600 ms) when moving between page families.</li></ul></div>
  </div></div>`;

const boards = [
  ['BgOverview.dc.html', 'Backgrounds · Overview — one 3-layer system, 13 moods, rules for subtlety, speed and readability', overview, 860],
  ...FAM.map((f) => [f.file, `Backgrounds · ${f.title} — ${f.eyebrow}`, () => board(f), 760]),
  ['BgSettings.dc.html', 'Backgrounds · Control — Lively / Calm / Off per person, company default, how it’s built', settings, 460],
];

module.exports = { css, CONTENT, rnd, particles, wavePath, FX, stage, FAM };
if (require.main !== module) return;
const Y = 35000;
for (const [file, title, fn, h] of boards) fs.writeFileSync(path.join(OUT, file), dcPage(title, '', fn(), h));
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
boards.forEach(([f, title, , h], i) => {
  const pos = i === 0 ? { x: 0, y: Y } : { x: ((i - 1) % 4) * 1520, y: Y + 1360 + Math.floor((i - 1) / 4) * 860 };
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, ...pos };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n17 = { kind: 'title1', maxW: 6000, text: 'Ambient backgrounds — same pages, a different living backdrop per page family (aurora, constellation, light sweep, horizon, blueprint, mesh, studio, rings, floaters, waves, quiet, night pulse, hero)', w: 240, x: 0, y: Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards');
