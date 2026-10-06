// Background packs — Terra (nature) and Prism (geometry).
// Picking a pack in Preferences swaps EVERY section's mood for a new one. Same rules as the
// Signature pack (build-backgrounds.js): behind content only, slow, soft, theme colours,
// transform/opacity motion, Lively / Calm / Off, reduce-motion = still image.
const fs = require('fs');
const path = require('path');
const { dcPage } = require('./build-balanced.js');
const SIG = require('./build-backgrounds.js');
const { css: baseCss, rnd, particles, stage, FAM: SIG_FAM } = SIG;
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

const W = 792; // page area inside the board's app frame (960 − 168 sidebar)
const H = 516; // 560 − 44 top bar

// ─── Pack styles ───────────────────────────────────────────
const css = `${baseCss}<style>
.fx svg{position:absolute;overflow:visible}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes spinr{to{transform:rotate(-360deg)}}

/* ════════ TERRA ════════ */
/* sky wheel — home: real time of day (board runs a whole day in 48 s) */
.t-ph{position:absolute;inset:0;opacity:0;animation:t-phase 48s linear infinite}
.t-ph.dawn{background:linear-gradient(180deg,color-mix(in srgb,#F472B6 30%,transparent),color-mix(in srgb,#FBBF24 18%,transparent) 42%,transparent 78%)}
.t-ph.day{background:linear-gradient(180deg,color-mix(in srgb,#38BDF8 32%,transparent),color-mix(in srgb,#A5F3FC 12%,transparent) 45%,transparent 78%);animation-delay:-36s}
.t-ph.dusk{background:linear-gradient(180deg,color-mix(in srgb,#7C3AED 28%,transparent),color-mix(in srgb,#F97316 20%,transparent) 42%,transparent 78%);animation-delay:-24s}
.t-ph.night{background:linear-gradient(180deg,color-mix(in srgb,#1E3A8A 45%,transparent),color-mix(in srgb,#312E81 18%,transparent) 50%,transparent 80%);animation-delay:-12s}
.light .t-ph.night{background:linear-gradient(180deg,color-mix(in srgb,#6366F1 18%,transparent),transparent 70%)}
@keyframes t-phase{0%{opacity:0}8%,25%{opacity:1}33%,100%{opacity:0}}
.t-wheel{position:absolute;left:50%;top:540px;width:0;height:0;animation:spin 48s linear infinite}
.t-orb{position:absolute;width:56px;height:56px;margin:-28px;border-radius:50%}
.t-orb.sun{left:-470px;top:0;background:radial-gradient(circle,#FDE68A 0 30%,color-mix(in srgb,#FBBF24 55%,transparent) 36%,transparent 70%);box-shadow:0 0 80px 30px color-mix(in srgb,#FBBF24 22%,transparent)}
.t-orb.moon{left:470px;top:0;width:34px;height:34px;margin:-17px;background:radial-gradient(circle at 35% 35%,#F1F5F9,#CBD5E1 60%);box-shadow:0 0 40px 12px color-mix(in srgb,#E2E8F0 18%,transparent);opacity:.8}
.t-cloud{position:absolute;height:34px;border-radius:40px;background:color-mix(in srgb,#fff 10%,transparent);filter:blur(6px);animation:t-drift linear infinite}
.t-cloud::before,.t-cloud::after{content:"";position:absolute;border-radius:50%;background:inherit}
.t-cloud::before{width:46%;height:150%;left:16%;top:-60%}.t-cloud::after{width:34%;height:120%;left:48%;top:-40%}
.light .t-cloud{background:color-mix(in srgb,#fff 70%,transparent);filter:blur(4px)}
@keyframes t-drift{from{transform:translateX(-260px)}to{transform:translateX(1060px)}}
.t-strip{display:flex;gap:6px}.t-strip span{flex:1;height:34px;border-radius:8px;position:relative;font-size:10px;font-weight:800;color:#fff;display:flex;align-items:flex-end;padding:4px 7px}

/* fireflies — people */
.t-dusk{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,#312E81 14%,transparent),transparent 40%,color-mix(in srgb,#065F46 22%,transparent))}
.light .t-dusk{background:linear-gradient(180deg,transparent 40%,color-mix(in srgb,#10B981 10%,transparent))}
.t-grass path{fill:color-mix(in srgb,#064E3B 55%,transparent)}.light .t-grass path{fill:color-mix(in srgb,#10B981 14%,transparent)}
.t-ff{position:absolute;width:5px;height:5px;border-radius:50%;background:#FDE68A;box-shadow:0 0 10px 3px color-mix(in srgb,#FACC15 50%,transparent);animation:t-wander var(--d) ease-in-out infinite alternate,t-blink var(--b) ease-in-out infinite}
.light .t-ff{background:#CA8A04;box-shadow:0 0 8px 2px color-mix(in srgb,#FACC15 45%,transparent)}
@keyframes t-wander{33%{transform:translate(var(--x1),var(--y1))}66%{transform:translate(var(--x2),var(--y2))}100%{transform:translate(var(--x3),var(--y3))}}
@keyframes t-blink{0%,100%{opacity:.08}50%{opacity:calc(var(--glow) * 1.7)}}

/* sun path — attendance & timesheets */
.t-band{position:absolute;inset:0 0 auto 0;height:300px;background:linear-gradient(180deg,color-mix(in srgb,#FBBF24 12%,transparent),transparent)}
.t-arc path{fill:none;stroke-width:1.5}
.t-arc .done{stroke-dasharray:1312;stroke-dashoffset:1312;animation:t-fill 40s ease-in-out infinite alternate}
@keyframes t-fill{to{stroke-dashoffset:0}}
.t-dialw{position:absolute;left:396px;top:560px;width:0;height:0;animation:t-day 40s ease-in-out infinite alternate}
@keyframes t-day{from{transform:rotate(-78deg)}to{transform:rotate(78deg)}}
.t-dialw .t-orb.sun{left:0;top:-470px;width:44px;height:44px;margin:-22px}
.t-hr{position:absolute;font-size:9px;font-weight:800;color:var(--mu);letter-spacing:.06em}

/* clouds & hills — leave */
.t-sky2{position:absolute;inset:0 0 auto 0;height:280px;background:linear-gradient(180deg,color-mix(in srgb,#7DD3FC 20%,transparent),color-mix(in srgb,#FDBA74 10%,transparent) 55%,transparent)}
.t-hills path:nth-child(1){fill:color-mix(in srgb,var(--a3) 12%,transparent)}.t-hills path:nth-child(2){fill:color-mix(in srgb,#10B981 14%,transparent)}
.t-bird{position:absolute;animation:t-fly linear infinite}.t-bird path{fill:none;stroke:color-mix(in srgb,var(--tx) 40%,transparent);stroke-width:1.4;stroke-linecap:round}
@keyframes t-fly{0%{transform:translate(-60px,0)}50%{transform:translate(420px,-18px)}100%{transform:translate(900px,6px)}}

/* topographic contours — projects */
.t-topo{animation:t-shift 70s ease-in-out infinite alternate}
.t-topo path{fill:none;stroke:color-mix(in srgb,var(--tx) 13%,transparent);stroke-width:1}
.t-topo path.ix{stroke:color-mix(in srgb,var(--pri) 38%,transparent);stroke-width:1.5}
@keyframes t-shift{to{transform:translate(-40px,18px) scale(1.04)}}
.t-route{fill:none;stroke:color-mix(in srgb,var(--pri) 55%,transparent);stroke-width:1.6;stroke-dasharray:5 6}
.t-pin{fill:var(--bg);stroke:var(--pri);stroke-width:2}
.t-walker{position:absolute;left:0;top:0;width:10px;height:10px;border-radius:50%;background:var(--pri);box-shadow:0 0 14px 4px color-mix(in srgb,var(--pri) 45%,transparent);offset-path:var(--route);animation:t-walk 30s ease-in-out infinite alternate}
@keyframes t-walk{from{offset-distance:0%}to{offset-distance:100%}}

/* dappled light (komorebi) — expenses */
.t-canopy{position:absolute;inset:0;background:linear-gradient(170deg,color-mix(in srgb,#065F46 26%,transparent),transparent 55%,color-mix(in srgb,#14532D 16%,transparent))}
.light .t-canopy{background:linear-gradient(170deg,color-mix(in srgb,#10B981 12%,transparent),transparent 60%)}
.t-dap{position:absolute;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,#FDE68A 60%,transparent),color-mix(in srgb,#34D399 20%,transparent) 60%,transparent);filter:blur(5px);opacity:calc(var(--glow) * .9);animation:t-sway var(--d) ease-in-out infinite alternate}
@keyframes t-sway{to{transform:translate(var(--x),var(--y)) scale(1.18);opacity:calc(var(--glow) * .35)}}
.t-leaf{position:absolute;top:-30px;width:14px;height:9px;border-radius:0 100% 0 100%;background:color-mix(in srgb,#22C55E 55%,transparent);animation:t-leaffall linear infinite}
@keyframes t-leaffall{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:.8}50%{transform:translate(60px,280px) rotate(220deg)}100%{transform:translate(-20px,600px) rotate(420deg);opacity:0}}

/* zen garden — assets */
.t-sand{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,#D6B98C 7%,transparent),color-mix(in srgb,#D6B98C 13%,transparent))}
.t-zen path,.t-zen circle.r{fill:none;stroke:color-mix(in srgb,var(--tx) 11%,transparent);stroke-width:1.2}
.t-zen .stone{fill:url(#stoneG)}
.t-ripple{transform-box:fill-box;transform-origin:center;animation:t-breathe 12s ease-in-out infinite alternate}
@keyframes t-breathe{to{transform:scale(1.035)}}
.t-rake{position:absolute;top:0;bottom:0;width:240px;background:linear-gradient(90deg,transparent,color-mix(in srgb,#FDE68A 9%,transparent),transparent);animation:t-rakemove 26s ease-in-out infinite alternate}
@keyframes t-rakemove{from{transform:translateX(-260px)}to{transform:translateX(820px)}}

/* lighthouse — helpdesk */
.t-sea{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(180deg,transparent,color-mix(in srgb,#0E7490 22%,transparent))}
.t-dusk2{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,#1E1B4B 22%,transparent),transparent 60%)}
.light .t-dusk2{background:linear-gradient(180deg,color-mix(in srgb,#06B6D4 8%,transparent),transparent 60%)}
.t-beam{position:absolute;left:676px;top:330px;width:900px;height:200px;margin-top:-100px;transform-origin:0 50%;background:linear-gradient(90deg,color-mix(in srgb,#FEF3C7 32%,transparent),transparent 85%);clip-path:polygon(0 47%,100% 0,100% 100%,0 53%);filter:blur(3px);opacity:calc(var(--glow) * 1.5);animation:t-scan 16s ease-in-out infinite alternate}
.light .t-beam{background:linear-gradient(90deg,color-mix(in srgb,var(--a3) 30%,transparent),transparent 85%)}
@keyframes t-scan{from{transform:rotate(-200deg)}to{transform:rotate(-150deg)}}
.t-lamp{position:absolute;left:666px;top:320px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle,#FEF3C7,color-mix(in srgb,#FBBF24 40%,transparent) 50%,transparent 72%);animation:breathe 4s ease-in-out infinite}
.t-house path{fill:color-mix(in srgb,var(--tx) 18%,transparent)}
.t-wv{position:absolute;left:0;width:200%;animation:wave 30s linear infinite}.t-wv path{fill:none;stroke:color-mix(in srgb,var(--a3) 30%,transparent);stroke-width:1.2}

/* petal breeze — announcements & kudos */
.t-pw{position:absolute;top:-30px;animation:t-fall linear infinite}
.t-pet{width:16px;height:12px;border-radius:100% 0 100% 0;background:linear-gradient(135deg,#FBCFE8,#F472B6);opacity:.9;box-shadow:0 0 8px color-mix(in srgb,#F472B6 40%,transparent);animation:t-flut ease-in-out infinite alternate}
.light .t-pet{background:linear-gradient(135deg,#F9A8D4,#EC4899);opacity:.55}
@keyframes t-fall{0%{transform:translate(0,0);opacity:0}8%{opacity:1}100%{transform:translate(var(--dx),600px);opacity:0}}
@keyframes t-flut{to{transform:rotate3d(1,.4,0,170deg) rotate(60deg)}}

/* mountain ridges — reports */
.t-mist{position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,color-mix(in srgb,var(--pri) 7%,transparent) 70%,transparent)}
.t-ridge{position:absolute;left:0;bottom:0;width:200%;animation:wave linear infinite}
.t-ridge path.f{stroke:none}.t-ridge path.l{fill:none;stroke-width:1.6}

/* linen — settings (still) */
.t-linen{position:absolute;inset:0;background:linear-gradient(160deg,color-mix(in srgb,#D6B98C 8%,transparent),transparent 45%,color-mix(in srgb,#10B981 4%,transparent))}
.t-vein path{fill:none;stroke:color-mix(in srgb,var(--tx) 7%,transparent);stroke-width:1.2}

/* northern lights — super admin */
.t-polar{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,#0B1E3F 45%,transparent),transparent 75%)}
.light .t-polar{background:linear-gradient(180deg,color-mix(in srgb,#38BDF8 10%,transparent),transparent 75%)}
.t-cur{position:absolute;top:-40px;height:330px;filter:blur(18px);opacity:calc(var(--glow) * 1.1);transform-origin:50% 0;-webkit-mask:repeating-linear-gradient(90deg,#000 0 14px,rgba(0,0,0,.45) 14px 22px);mask:repeating-linear-gradient(90deg,#000 0 14px,rgba(0,0,0,.45) 14px 22px);animation:t-curtain var(--d) ease-in-out infinite alternate}
@keyframes t-curtain{0%{transform:translateX(0) skewX(-14deg) scaleY(1)}50%{transform:translateX(50px) skewX(6deg) scaleY(1.12)}100%{transform:translateX(-30px) skewX(-6deg) scaleY(.92)}}
.t-peaks path{fill:color-mix(in srgb,#020617 50%,transparent)}.light .t-peaks path{fill:color-mix(in srgb,#0EA5E9 10%,transparent)}

/* ════════ PRISM ════════ */
/* light beams — home */
.p-gridf{position:absolute;inset:0;background-image:linear-gradient(color-mix(in srgb,var(--tx) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--tx) 7%,transparent) 1px,transparent 1px);background-size:44px 44px;-webkit-mask:radial-gradient(70% 60% at 50% 0%,#000,transparent);mask:radial-gradient(70% 60% at 50% 0%,#000,transparent)}
.p-hline{position:absolute;left:8%;right:8%;top:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--pri2) 90%,transparent),transparent);box-shadow:0 0 24px 4px color-mix(in srgb,var(--pri) 35%,transparent)}
.p-beam{position:absolute;top:-30px;width:120px;height:720px;margin-left:-60px;transform-origin:50% 0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 42%,transparent),transparent 78%);filter:blur(16px);opacity:calc(var(--glow) * 1.2);animation:p-sway var(--d) ease-in-out infinite alternate}
@keyframes p-sway{from{transform:rotate(var(--a))}to{transform:rotate(calc(var(--a) + 9deg))}}

/* bauhaus shapes — people */
.p-sh{position:absolute;opacity:calc(var(--glow) * .75)}
.p-circ{border-radius:50%}.p-ring{border-radius:50%;border:2px solid}
.p-semi{border-radius:999px 999px 0 0}
.p-quar{border-radius:100% 0 0 0}
.p-rot{animation:spin 60s linear infinite}.p-rotr{animation:spinr 80s linear infinite}
.p-flip{animation:p-flip 30s ease-in-out infinite alternate}@keyframes p-flip{to{transform:rotate(180deg)}}
.p-glide{animation:p-glide 26s ease-in-out infinite alternate}@keyframes p-glide{to{transform:translate(-60px,30px)}}

/* chronograph rings — attendance & timesheets */
.p-chrono{position:absolute;right:-150px;top:-170px;width:520px;height:520px}
.p-chrono circle{fill:none;transform-box:fill-box;transform-origin:center}
.p-chrono .r1{animation:spin 90s linear infinite}.p-chrono .r2{animation:spinr 60s linear infinite}.p-chrono .r3{animation:spin 40s linear infinite}
.p-hand{transform-origin:260px 260px;animation:spin 60s linear infinite}

/* striped sun — leave */
.p-stripes{position:absolute;right:40px;top:30px;width:300px;height:300px;animation:p-rise 24s ease-in-out infinite alternate}
@keyframes p-rise{from{transform:translateY(40px)}to{transform:translateY(-10px)}}
.p-hz{position:absolute;left:0;right:0;height:1px;background:color-mix(in srgb,var(--tx) 10%,transparent)}

/* isometric blocks — projects */
.p-iso{position:absolute;inset:0;background-image:repeating-linear-gradient(30deg,color-mix(in srgb,var(--tx) 8%,transparent) 0 1px,transparent 1px 30px),repeating-linear-gradient(150deg,color-mix(in srgb,var(--tx) 8%,transparent) 0 1px,transparent 1px 30px);-webkit-mask:radial-gradient(75% 85% at 70% 30%,#000,transparent);mask:radial-gradient(75% 85% at 70% 30%,#000,transparent)}
.p-blk{position:absolute;animation:p-build var(--d) ease-in-out infinite alternate;opacity:calc(var(--glow) * 1.4)}
@keyframes p-build{from{transform:translateY(16px)}to{transform:translateY(-14px)}}

/* faceted gem — expenses */
.p-facets polygon{animation:p-glint var(--d) ease-in-out infinite alternate}
@keyframes p-glint{from{opacity:.25}to{opacity:1}}
.p-shine{position:absolute;top:-60%;left:0;width:26%;height:220%;background:linear-gradient(90deg,transparent,color-mix(in srgb,#fff 8%,transparent),transparent);transform:rotate(24deg) translateX(-200%);animation:p-shine 16s ease-in-out infinite}
@keyframes p-shine{0%,40%{transform:rotate(24deg) translateX(-200%)}80%,100%{transform:rotate(24deg) translateX(520%)}}

/* wireframe cubes — assets */
.p-3d{position:absolute;inset:0;perspective:900px}
.p-cube{position:absolute;width:var(--s);height:var(--s);transform-style:preserve-3d;animation:p-tumble var(--d) linear infinite}
.p-cube i{position:absolute;inset:0;border:1.5px solid color-mix(in srgb,var(--pri) 55%,transparent);background:color-mix(in srgb,var(--pri) 4%,transparent)}
.p-cube i:nth-child(1){transform:translateZ(calc(var(--s) / 2))}.p-cube i:nth-child(2){transform:rotateY(180deg) translateZ(calc(var(--s) / 2))}
.p-cube i:nth-child(3){transform:rotateY(90deg) translateZ(calc(var(--s) / 2))}.p-cube i:nth-child(4){transform:rotateY(-90deg) translateZ(calc(var(--s) / 2))}
.p-cube i:nth-child(5){transform:rotateX(90deg) translateZ(calc(var(--s) / 2))}.p-cube i:nth-child(6){transform:rotateX(-90deg) translateZ(calc(var(--s) / 2))}
@keyframes p-tumble{from{transform:rotateX(-22deg) rotateY(0)}to{transform:rotateX(-22deg) rotateY(360deg)}}
.p-floor{position:absolute;left:-30%;right:-30%;bottom:-40px;height:260px;transform:perspective(500px) rotateX(64deg);transform-origin:50% 100%;background-image:linear-gradient(color-mix(in srgb,var(--pri) 22%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--pri) 22%,transparent) 1px,transparent 1px);background-size:40px 40px;-webkit-mask:linear-gradient(0deg,#000,transparent);mask:linear-gradient(0deg,#000,transparent)}

/* radar — helpdesk */
.p-radar{position:absolute;right:-90px;top:-110px;width:420px;height:420px;border-radius:50%;overflow:hidden;
 background:repeating-radial-gradient(circle,transparent 0 51px,color-mix(in srgb,var(--a3) 26%,transparent) 51px 52.5px),linear-gradient(color-mix(in srgb,var(--a3) 18%,transparent),color-mix(in srgb,var(--a3) 18%,transparent)) center/1px 100% no-repeat,linear-gradient(90deg,color-mix(in srgb,var(--a3) 18%,transparent),color-mix(in srgb,var(--a3) 18%,transparent)) center/100% 1px no-repeat}
.p-sweep{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 78%,color-mix(in srgb,var(--a3) 45%,transparent) 100%);opacity:var(--glow);animation:spin 8s linear infinite}
.p-blip{position:absolute;width:7px;height:7px;margin:-3.5px;border-radius:50%;background:var(--a3);box-shadow:0 0 10px 3px color-mix(in srgb,var(--a3) 50%,transparent);opacity:0;animation:p-blip 8s linear infinite}
@keyframes p-blip{0%{opacity:0}2%{opacity:1}40%{opacity:0}100%{opacity:0}}

/* memphis shapes — announcements & kudos */
.p-mf{position:absolute;bottom:-40px;opacity:0;animation:p-mfloat linear infinite}
@keyframes p-mfloat{0%{transform:translateY(0) rotate(0) scale(1.5);opacity:0}12%{opacity:calc(var(--glow) * 1.6)}88%{opacity:calc(var(--glow) * 1.4)}100%{transform:translateY(-620px) rotate(200deg) scale(1.5);opacity:0}}
.p-tri{width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid}
.p-plus{font-size:20px;font-weight:900;line-height:20px}
.p-dotg{position:absolute;width:120px;height:80px;background-image:radial-gradient(color-mix(in srgb,var(--tx) 22%,transparent) 1.5px,transparent 2px);background-size:12px 12px}

/* equaliser — reports */
.p-eq{position:absolute;left:0;right:0;bottom:0;height:190px;display:flex;align-items:flex-end;gap:8px;padding:0 10px}
.p-eq i{flex:1;height:100%;border-radius:3px 3px 0 0;transform-origin:50% 100%;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 55%,transparent),transparent);opacity:calc(var(--glow) * 1.3);animation:p-eqm var(--d) ease-in-out infinite alternate}
@keyframes p-eqm{from{transform:scaleY(var(--lo))}to{transform:scaleY(var(--hi))}}
.p-guides{position:absolute;inset:0;background-image:linear-gradient(color-mix(in srgb,var(--tx) 6%,transparent) 1px,transparent 1px);background-size:100% 38px}

/* swiss grid — settings (still) */
.p-cols{position:absolute;inset:0;background-image:linear-gradient(90deg,color-mix(in srgb,var(--pri) 7%,transparent) 1px,transparent 1px);background-size:calc(100% / 12) 100%}
.p-base{position:absolute;inset:0;background-image:linear-gradient(color-mix(in srgb,var(--tx) 4%,transparent) 1px,transparent 1px);background-size:100% 8px}

/* grid horizon — super admin */
.p-sky{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,#1E3A8A 26%,transparent),transparent 60%)}
.light .p-sky{background:linear-gradient(180deg,color-mix(in srgb,#3B82F6 9%,transparent),transparent 60%)}
.p-plane{position:absolute;left:-40%;right:-40%;bottom:0;height:250px;overflow:hidden;transform:perspective(320px) rotateX(58deg);transform-origin:50% 100%;-webkit-mask:linear-gradient(0deg,#000 20%,transparent);mask:linear-gradient(0deg,#000 20%,transparent)}
.p-plane i{position:absolute;left:0;right:0;top:-48px;bottom:0;background-image:linear-gradient(color-mix(in srgb,var(--a3) 40%,transparent) 1.5px,transparent 1.5px),linear-gradient(90deg,color-mix(in srgb,var(--a3) 40%,transparent) 1.5px,transparent 1.5px);background-size:48px 48px;animation:p-roll 9s linear infinite}
@keyframes p-roll{to{transform:translateY(48px)}}
.p-horizon{position:absolute;left:0;right:0;bottom:250px;height:1px;background:linear-gradient(90deg,transparent,var(--a3),transparent);box-shadow:0 0 22px 5px color-mix(in srgb,var(--a3) 35%,transparent)}
.p-run{position:absolute;bottom:246px;left:0;width:90px;height:9px;border-radius:9px;background:radial-gradient(closest-side,var(--a3),transparent);animation:p-runx 7s linear infinite}
@keyframes p-runx{from{transform:translateX(-100px)}to{transform:translateX(820px)}}

/* prism — sign-in */
.p-ray{position:absolute;left:0;top:250px;width:250px;height:2px;background:linear-gradient(90deg,transparent,#fff);box-shadow:0 0 12px 2px rgba(255,255,255,.45);transform-origin:100% 50%;transform:rotate(-8deg);animation:breathe 7s ease-in-out infinite}
.light .p-ray{background:linear-gradient(90deg,transparent,var(--pri));box-shadow:none}
.p-gem{position:absolute;left:240px;top:170px;width:120px;height:110px;clip-path:polygon(50% 0,100% 100%,0 100%);background:linear-gradient(160deg,color-mix(in srgb,#fff 30%,transparent),color-mix(in srgb,#fff 6%,transparent));border:0}
.light .p-gem{background:linear-gradient(160deg,color-mix(in srgb,var(--pri) 30%,transparent),color-mix(in srgb,var(--pri) 8%,transparent))}
.p-fan{position:absolute;left:330px;top:120px;width:720px;height:360px;clip-path:polygon(0 36%,100% 0,100% 100%,0 46%);background:linear-gradient(180deg,#F43F5E,#F59E0B 18%,#FDE047 34%,#22C55E 52%,#38BDF8 70%,#8B5CF6 88%);filter:blur(3px);opacity:calc(var(--glow) * .9);animation:p-shimmer 9s ease-in-out infinite alternate}
@keyframes p-shimmer{from{opacity:calc(var(--glow) * .55)}to{opacity:calc(var(--glow) * 1)}}

/* ── calm (Lively off) for tiles ── */
.still *{animation-play-state:paused!important}
</style>`;

// ─── helpers ───────────────────────────────────────────────
const svg = (w, h, inner, style = '', cls = '') => `<svg class="${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="${style}">${inner}</svg>`;
const f1 = (n) => n.toFixed(1);
// periodic profile over one tile, so a 2-tile strip loops seamlessly
const ridge = (tile, base, amps, seed) => {
  const r = rnd(seed);
  const ph = amps.map(() => r() * Math.PI * 2);
  const y = (x) => base - amps.reduce((s, [a, k], i) => s + a * Math.sin((x / tile) * Math.PI * 2 * k + ph[i]), 0);
  let d = `M0 ${f1(y(0))}`;
  for (let x = 10; x <= tile * 2; x += 10) d += ` L${x} ${f1(y(x))}`;
  return d;
};
const blob = (cx, cy, R, wob, seed, n = 72) => {
  const r = rnd(seed);
  const p = [r() * 6, r() * 6, r() * 6];
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = R * (1 + wob * (0.55 * Math.sin(3 * t + p[0]) + 0.3 * Math.sin(5 * t + p[1]) + 0.15 * Math.sin(2 * t + p[2])));
    d += `${i ? 'L' : 'M'}${f1(cx + Math.cos(t) * rr)} ${f1(cy + Math.sin(t) * rr * 0.78)}`;
  }
  return `${d}Z`;
};

// ─── TERRA effects ─────────────────────────────────────────
const T = {
  sky: () => {
    const r = rnd(41);
    const clouds = Array.from({ length: 5 }, (_, i) => `<i class="t-cloud" style="top:${(20 + r() * 150).toFixed(0)}px;width:${(90 + r() * 90).toFixed(0)}px;animation-duration:${(70 + r() * 50).toFixed(0)}s;animation-delay:-${(r() * 100).toFixed(0)}s;opacity:${(0.6 + i * 0.08).toFixed(2)}"></i>`).join('');
    return `<div class="t-ph dawn"></div><div class="t-ph day"></div><div class="t-ph dusk"></div><div class="t-ph night"></div>
      <div class="t-wheel"><i class="t-orb sun"></i><i class="t-orb moon"></i></div>${clouds}<div class="vig"></div>`;
  },
  fireflies: () => {
    const r = rnd(23);
    const ff = Array.from({ length: 22 }, () => {
      const v = () => `${((r() - 0.5) * 140).toFixed(0)}px`;
      return `<i class="t-ff" style="left:${(r() * 96).toFixed(1)}%;top:${(30 + r() * 64).toFixed(1)}%;--x1:${v()};--y1:${v()};--x2:${v()};--y2:${v()};--x3:${v()};--y3:${v()};--d:${(14 + r() * 14).toFixed(1)}s;--b:${(4 + r() * 5).toFixed(1)}s;animation-delay:-${(r() * 20).toFixed(1)}s,-${(r() * 8).toFixed(1)}s"></i>`;
    }).join('');
    let g = 'M0 90';
    for (let x = 0; x <= 800; x += 8) g += ` L${x} ${f1(62 + Math.sin(x * 0.09) * 6 + Math.sin(x * 0.37) * 10 + ((x / 8) % 3) * 3)}`;
    return `<div class="t-dusk"></div>${svg(800, 90, `<path d="${g} L800 90 Z"/>`, 'left:0;bottom:0', 't-grass')}${ff}<div class="vig"></div>`;
  },
  sunpath: () => {
    const R = 470, cx = 396, cy = 560, a = (78 * Math.PI) / 180;
    const x0 = cx - R * Math.sin(a), y0 = cy - R * Math.cos(a), x1 = cx + R * Math.sin(a);
    const arc = `M${f1(x0)} ${f1(y0)} A${R} ${R} 0 0 1 ${f1(x1)} ${f1(y0)}`;
    const hrs = [['09:30', -78], ['12:00', -30], ['15:00', 22], ['18:30', 78]].map(([t, deg]) => {
      const rad = (deg * Math.PI) / 180;
      return `<span class="t-hr" style="left:${f1(cx + (R + 16) * Math.sin(rad) - 14)}px;top:${f1(cy - (R + 16) * Math.cos(rad) - 6)}px">${t}</span>`;
    }).join('');
    return `<div class="t-band"></div>${svg(W, H, `<path d="${arc}" stroke="color-mix(in srgb,var(--tx) 26%,transparent)" stroke-dasharray="2 7" stroke-width="2"/><path class="done" d="${arc}" stroke="color-mix(in srgb,#FBBF24 75%,transparent)" stroke-width="2.5"/>`, 'left:0;top:0', 't-arc')}${hrs}<div class="t-dialw"><i class="t-orb sun"></i></div><div class="vig"></div>`;
  },
  clouds: () => {
    const r = rnd(57);
    const clouds = Array.from({ length: 6 }, () => `<i class="t-cloud" style="top:${(14 + r() * 170).toFixed(0)}px;width:${(110 + r() * 120).toFixed(0)}px;height:${(30 + r() * 16).toFixed(0)}px;animation-duration:${(90 + r() * 60).toFixed(0)}s;animation-delay:-${(r() * 140).toFixed(0)}s"></i>`).join('');
    const bird = (top, d, del) => `<span class="t-bird" style="top:${top}px;animation-duration:${d}s;animation-delay:-${del}s">${svg(22, 10, '<path d="M1 3 Q6 0 11 6 Q16 0 21 3"/>')}</span>`;
    const hill = (base, k, seed) => ridge(400, base, [[16, k], [8, k + 2]], seed);
    return `<div class="t-sky2"></div>${clouds}${bird(70, 50, 10)}${bird(92, 64, 40)}
      ${svg(800, 140, `<path d="${hill(70, 1, 3)} L800 140 L0 140Z"/><path d="${hill(100, 2, 9)} L800 140 L0 140Z"/>`, 'left:0;bottom:0', 't-hills')}<div class="vig"></div>`;
  },
  topo: () => {
    const lines = [];
    [[560, 150, 9, 3], [170, 420, 7, 8], [720, 470, 5, 13]].forEach(([cx, cy, n, s]) => {
      for (let i = 1; i <= n; i++) lines.push(`<path class="${i % 4 === 0 ? 'ix' : ''}" d="${blob(cx, cy, i * 26, 0.12 + i * 0.006, s + i)}"/>`);
    });
    const route = 'M60 470 C 180 380, 260 420, 330 330 S 470 210, 560 150 S 700 90, 760 60';
    const pins = [[60, 470], [330, 330], [560, 150], [760, 60]].map(([x, y]) => `<circle class="t-pin" cx="${x}" cy="${y}" r="5"/>`).join('');
    return `<div class="base"></div>${svg(W, H, lines.join(''), 'left:0;top:0', 't-topo')}${svg(W, H, `<path class="t-route" d="${route}"/>${pins}`, 'left:0;top:0')}<i class="t-walker" style="--route:path('${route}')"></i><div class="vig"></div>`;
  },
  komorebi: () => {
    const r = rnd(77);
    const d = Array.from({ length: 14 }, () => { const s = 40 + r() * 120; return `<i class="t-dap" style="width:${s.toFixed(0)}px;height:${(s * 0.8).toFixed(0)}px;left:${(r() * 92).toFixed(1)}%;top:${(r() * 88).toFixed(1)}%;--x:${((r() - 0.5) * 60).toFixed(0)}px;--y:${((r() - 0.5) * 40).toFixed(0)}px;--d:${(9 + r() * 8).toFixed(1)}s;animation-delay:-${(r() * 9).toFixed(1)}s"></i>`; }).join('');
    const leaves = Array.from({ length: 4 }, () => `<i class="t-leaf" style="left:${(r() * 90).toFixed(1)}%;animation-duration:${(26 + r() * 10).toFixed(1)}s;animation-delay:-${(r() * 30).toFixed(1)}s"></i>`).join('');
    return `<div class="t-canopy"></div>${d}${leaves}<div class="vig"></div>`;
  },
  zen: () => {
    const stones = [[600, 150, 34], [170, 400, 26], [690, 430, 18]];
    let lines = '';
    for (let y = 8; y < H; y += 13) { let d = `M0 ${y}`; for (let x = 0; x <= W; x += 24) d += ` L${x} ${f1(y + Math.sin(x * 0.012 + y * 0.03) * 3)}`; lines += `<path d="${d}"/>`; }
    const mask = stones.map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s + 62}" fill="#000"/>`).join('');
    const rings = stones.map(([x, y, s]) => `<g class="t-ripple">${[1, 2, 3, 4].map((k) => `<circle class="r" cx="${x}" cy="${y}" r="${s + k * 13}"/>`).join('')}</g><ellipse class="stone" cx="${x}" cy="${y}" rx="${s}" ry="${s * 0.82}"/>`).join('');
    return `<div class="t-sand"></div>${svg(W, H, `<defs><mask id="zm"><rect width="${W}" height="${H}" fill="#fff"/>${mask}</mask><radialGradient id="stoneG" cx="40%" cy="35%"><stop offset="0" stop-color="color-mix(in srgb,var(--tx) 28%,transparent)"/><stop offset="1" stop-color="color-mix(in srgb,var(--tx) 8%,transparent)"/></radialGradient></defs><g mask="url(#zm)">${lines}</g>${rings}`, 'left:0;top:0', 't-zen')}<div class="t-rake"></div><div class="vig"></div>`;
  },
  lighthouse: () => {
    const house = '<path d="M14 0 h12 v6 h-12z"/><path d="M12 8 h16 l4 82 h-24z"/><path d="M4 90 h32 v8 h-32z"/>';
    const wv = (y, k, a) => { let d = `M0 ${y}`; for (let x = 0; x <= 1600; x += 20) d += ` L${x} ${f1(y + Math.sin((x / 1600) * Math.PI * 2 * k) * a)}`; return d; };
    return `<div class="t-dusk2"></div><div class="t-sea"></div>
      ${svg(1600, 60, `<path d="${wv(20, 16, 3)}"/><path d="${wv(40, 12, 4)}"/>`, 'bottom:30px', 't-wv')}
      <div class="t-beam"></div>${svg(40, 100, house, 'left:656px;top:312px', 't-house')}<i class="t-lamp"></i><div class="vig"></div>`;
  },
  petals: () => {
    const r = rnd(91);
    const p = Array.from({ length: 22 }, () => `<span class="t-pw" style="left:${(r() * 90 - 10).toFixed(1)}%;--dx:${(80 + r() * 160).toFixed(0)}px;animation-duration:${(18 + r() * 14).toFixed(1)}s;animation-delay:-${(r() * 30).toFixed(1)}s"><i class="t-pet" style="display:block;animation-duration:${(3 + r() * 3).toFixed(1)}s;transform:scale(${(0.7 + r() * 0.6).toFixed(2)})"></i></span>`).join('');
    return `<div class="warm"></div>${p}<div class="vig"></div>`;
  },
  ridges: () => {
    const layers = [[0.12, 130, [[26, 2], [12, 5]], 120, 'var(--a2)'], [0.16, 150, [[22, 3], [10, 7]], 90, 'var(--a3)'], [0.22, 170, [[18, 2], [9, 6]], 70, 'var(--pri)']];
    return `<div class="base"></div><div class="t-mist"></div>${layers.map(([o, base, amps, dur, c], i) => {
      const d = ridge(800, base, amps, 7 + i * 5);
      return svg(1600, 220, `<path class="f" d="${d} L1600 220 L0 220Z" fill="color-mix(in srgb,${c} ${Math.round(o * 100)}%,transparent)"/><path class="l" d="${d}" stroke="color-mix(in srgb,${c} ${i === 2 ? 60 : 30}%,transparent)"/>`, `bottom:${-i * 18}px;animation-duration:${dur}s`, 't-ridge');
    }).join('')}<div class="vig"></div>`;
  },
  linen: () => `<div class="t-linen"></div><div class="noise"></div>${svg(260, 200, '<path d="M250 190 C 170 150, 90 120, 10 20"/><path d="M200 162 C 190 130, 180 110, 150 80"/><path d="M150 132 C 120 125, 100 120, 70 118"/><path d="M110 98 C 108 80, 100 60, 85 40"/><path d="M70 68 C 55 66, 40 66, 24 70"/>', 'right:20px;bottom:10px', 't-vein')}`,
  aurora: () => {
    const r = rnd(13);
    const stars = Array.from({ length: 40 }, () => `<i class="star" style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 55).toFixed(1)}%;animation-duration:${(3 + r() * 5).toFixed(1)}s"></i>`).join('');
    const cur = [['#34D399', 40, 260, 20], ['#22D3EE', 260, 300, 26], ['#A78BFA', 520, 240, 22]].map(([c, x, w, d]) => `<i class="t-cur" style="left:${x}px;width:${w}px;--d:${d}s;background:linear-gradient(180deg,transparent,color-mix(in srgb,${c} 60%,transparent) 45%,transparent)"></i>`).join('');
    const pk = ridge(400, 70, [[22, 2], [10, 5]], 4);
    return `<div class="t-polar"></div>${stars}${cur}${svg(800, 110, `<path d="${pk} L800 110 L0 110Z"/>`, 'left:0;bottom:0', 't-peaks')}<div class="vig"></div>`;
  },
};

// ─── PRISM effects ─────────────────────────────────────────
const P = {
  beams: () => {
    const b = [[18, -22, 'var(--pri)', 18], [38, -8, 'var(--a2)', 23], [58, 6, 'var(--pri2)', 20], [80, 18, 'var(--a3)', 26]].map(([l, a, c, d]) => `<i class="p-beam" style="left:${l}%;--a:${a}deg;--c:${c};--d:${d}s"></i>`).join('');
    return `<div class="p-gridf"></div>${b}<div class="p-hline"></div><div class="vig"></div>`;
  },
  bauhaus: () => {
    const s = (cls, st) => `<i class="p-sh ${cls}" style="${st}"></i>`;
    return `<div class="base"></div>
      ${s('p-circ p-glide', 'right:60px;top:40px;width:150px;height:150px;background:color-mix(in srgb,var(--pri) 45%,transparent)')}
      ${s('p-semi p-flip', 'right:230px;top:120px;width:120px;height:60px;transform-origin:50% 100%;background:color-mix(in srgb,var(--a2) 50%,transparent)')}
      ${s('p-ring p-rotr', 'right:-40px;top:220px;width:220px;height:220px;border-color:color-mix(in srgb,var(--a3) 55%,transparent);border-right-color:transparent')}
      ${s('p-quar p-rot', 'left:-60px;bottom:-60px;width:180px;height:180px;transform-origin:100% 100%;background:color-mix(in srgb,#F59E0B 38%,transparent)')}
      ${s('p-circ', 'right:180px;bottom:60px;width:26px;height:26px;background:color-mix(in srgb,var(--pri2) 60%,transparent)')}
      ${s('p-glide', 'right:300px;bottom:150px;width:90px;height:12px;border-radius:2px;background:color-mix(in srgb,var(--tx) 22%,transparent)')}
      <div class="vig"></div>`;
  },
  chrono: () => {
    const c = 260;
    const ticks = `<circle cx="${c}" cy="${c}" r="236" stroke="color-mix(in srgb,var(--tx) 22%,transparent)" stroke-width="10" stroke-dasharray="1.5 10.85"/>`;
    return `<div class="base"></div>${svg(520, 520, `${ticks}
      <circle class="r1" cx="${c}" cy="${c}" r="205" stroke="color-mix(in srgb,var(--pri) 55%,transparent)" stroke-width="3" stroke-dasharray="180 60 40 60"/>
      <circle class="r2" cx="${c}" cy="${c}" r="172" stroke="color-mix(in srgb,var(--a2) 45%,transparent)" stroke-width="10" stroke-dasharray="70 30"/>
      <circle class="r3" cx="${c}" cy="${c}" r="140" stroke="color-mix(in srgb,var(--a3) 45%,transparent)" stroke-width="1.5" stroke-dasharray="4 8"/>
      <circle cx="${c}" cy="${c}" r="108" stroke="color-mix(in srgb,var(--tx) 12%,transparent)" stroke-width="1"/>
      <line class="p-hand" x1="${c}" y1="${c}" x2="${c}" y2="30" stroke="var(--pri)" stroke-width="2" stroke-linecap="round"/><circle cx="${c}" cy="${c}" r="5" fill="var(--pri)"/>`, '', 'p-chrono')}<div class="vig"></div>`;
  },
  stripesun: () => {
    let cut = '';
    for (let i = 0; i < 6; i++) { const y = 160 + i * 24 + i * i * 1.5; cut += `<rect x="0" y="${f1(y)}" width="300" height="${f1(3 + i * 2.6)}" fill="#000"/>`; }
    return `<div class="base"></div>${svg(300, 300, `<defs><linearGradient id="sunG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F59E0B"/><stop offset=".55" stop-color="#EC4899"/><stop offset="1" stop-color="var(--a2)"/></linearGradient><mask id="sunM"><circle cx="150" cy="150" r="148" fill="#fff"/>${cut}</mask></defs><circle cx="150" cy="150" r="148" fill="url(#sunG)" mask="url(#sunM)" opacity=".42"/>`, '', 'p-stripes')}
      <i class="p-hz" style="top:300px"></i><i class="p-hz" style="top:318px;left:30%"></i><i class="p-hz" style="top:340px;left:55%"></i><div class="vig"></div>`;
  },
  iso: () => {
    const cube = (h, c) => {
      const w = 52, s = 15;
      return svg(w * 2, h + 2 * s * 2, `<polygon points="${w},0 ${w * 2},${s * 2} ${w},${s * 4} 0,${s * 2}" fill="color-mix(in srgb,${c} 55%,transparent)"/><polygon points="0,${s * 2} ${w},${s * 4} ${w},${s * 4 + h} 0,${s * 2 + h}" fill="color-mix(in srgb,${c} 30%,transparent)"/><polygon points="${w * 2},${s * 2} ${w},${s * 4} ${w},${s * 4 + h} ${w * 2},${s * 2 + h}" fill="color-mix(in srgb,${c} 18%,transparent)"/>`);
    };
    const blocks = [[560, 60, 90, 'var(--pri)', 14], [664, 120, 50, 'var(--a2)', 11], [460, 150, 30, 'var(--a3)', 16], [612, 200, 130, 'var(--pri2)', 13]].map(([x, y, h, c, d]) => `<span class="p-blk" style="left:${x}px;top:${y}px;--d:${d}s">${cube(h, c)}</span>`).join('');
    return `<div class="base"></div><div class="p-iso"></div>${blocks}<div class="vig"></div>`;
  },
  facets: () => {
    const r = rnd(29);
    const cw = 72, ch = 62, cols = ['#10B981', 'var(--a3)', 'var(--pri)', '#34D399'];
    let tris = '';
    for (let row = 0; row * ch < H + ch; row++) {
      for (let col = -1; col * cw < W + cw; col++) {
        const x = col * cw + (row % 2 ? cw / 2 : 0), y = row * ch;
        const fill = (k) => `color-mix(in srgb,${cols[k]} ${Math.round(4 + r() * 16)}%,transparent)`;
        tris += `<polygon points="${x},${y} ${x + cw},${y} ${x + cw / 2},${y + ch}" fill="${fill(Math.floor(r() * 4))}" style="--d:${(8 + r() * 7).toFixed(1)}s;animation-delay:-${(r() * 10).toFixed(1)}s"/>`;
        tris += `<polygon points="${x + cw / 2},${y + ch} ${x + cw},${y} ${x + cw * 1.5},${y + ch}" fill="${fill(Math.floor(r() * 4))}" style="--d:${(8 + r() * 7).toFixed(1)}s;animation-delay:-${(r() * 10).toFixed(1)}s"/>`;
      }
    }
    return `${svg(W, H, tris, 'left:0;top:0;-webkit-mask:radial-gradient(80% 90% at 70% 20%,#000,transparent);mask:radial-gradient(80% 90% at 70% 20%,#000,transparent)', 'p-facets')}<div class="p-shine"></div><div class="vig"></div>`;
  },
  cubes: () => {
    const cube = (x, y, s, d, dir = '') => `<span class="p-cube" style="left:${x}px;top:${y}px;--s:${s}px;--d:${d}s;${dir}">${'<i></i>'.repeat(6)}</span>`;
    return `<div class="base"></div><div class="p-3d"><div class="p-floor"></div>${cube(560, 70, 110, 40)}${cube(700, 230, 60, 30, 'animation-direction:reverse')}${cube(420, 40, 40, 26)}</div><div class="vig"></div>`;
  },
  radar: () => {
    const blips = [[290, 90, 1.9], [120, 260, 4.1], [330, 300, 5.6], [210, 150, 3]].map(([x, y, t]) => `<i class="p-blip" style="left:${x}px;top:${y}px;animation-delay:${t}s"></i>`).join('');
    return `<div class="base"></div><div class="p-radar"><div class="p-sweep"></div>${blips}</div><div class="vig"></div>`;
  },
  memphis: () => {
    const r = rnd(61);
    const cs = ['var(--pri)', 'var(--a2)', '#F59E0B', '#EC4899', 'var(--a3)'];
    const kinds = ['tri', 'ring', 'plus', 'sq', 'zig'];
    const items = Array.from({ length: 16 }, (_, i) => {
      const c = cs[i % 5], k = kinds[(i * 3) % 5];
      const st = `left:${(r() * 96).toFixed(1)}%;animation-duration:${(22 + r() * 16).toFixed(1)}s;animation-delay:-${(r() * 36).toFixed(1)}s;`;
      if (k === 'tri') return `<i class="p-mf" style="${st}"><i class="p-tri" style="display:block;border-bottom-color:color-mix(in srgb,${c} 55%,transparent)"></i></i>`;
      if (k === 'ring') return `<i class="p-mf" style="${st}width:18px;height:18px;border-radius:50%;border:3px solid color-mix(in srgb,${c} 55%,transparent)"></i>`;
      if (k === 'plus') return `<i class="p-mf p-plus" style="${st}color:color-mix(in srgb,${c} 60%,transparent)">+</i>`;
      if (k === 'sq') return `<i class="p-mf" style="${st}width:14px;height:14px;background:color-mix(in srgb,${c} 40%,transparent)"></i>`;
      return `<i class="p-mf" style="${st}">${svg(34, 12, '<path d="M1 6 L6 1 L11 11 L16 1 L21 11 L26 1 L33 8" fill="none" stroke-width="2.4" stroke-linejoin="round" stroke="currentColor"/>', 'position:static')}</i>`.replace('style="', `style="color:color-mix(in srgb,${c} 60%,transparent);`);
    }).join('');
    return `<div class="warm" style="opacity:calc(var(--glow) * .7)"></div><i class="p-dotg" style="right:30px;top:30px"></i><i class="p-dotg" style="left:20px;bottom:40px"></i>${items}<div class="vig"></div>`;
  },
  eq: () => {
    const r = rnd(17);
    const cs = ['var(--pri)', 'var(--a2)', 'var(--a3)'];
    const bars = Array.from({ length: 36 }, (_, i) => `<i style="--c:${cs[Math.floor(i / 12)]};--lo:${(0.12 + r() * 0.25).toFixed(2)};--hi:${(0.45 + r() * 0.55).toFixed(2)};--d:${(7 + r() * 6).toFixed(1)}s;animation-delay:-${(r() * 8).toFixed(1)}s"></i>`).join('');
    return `<div class="base"></div><div class="p-guides"></div><div class="p-eq">${bars}</div><div class="vig"></div>`;
  },
  swiss: () => `<div class="p-cols"></div><div class="p-base"></div><i style="position:absolute;right:28px;top:22px;width:14px;height:14px;background:color-mix(in srgb,var(--pri) 50%,transparent)"></i><i style="position:absolute;right:56px;bottom:30px;width:70px;height:70px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--tx) 12%,transparent)"></i>`,
  horizon: () => {
    const r = rnd(5);
    const stars = Array.from({ length: 30 }, () => `<i class="star" style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 40).toFixed(1)}%;animation-duration:${(3 + r() * 5).toFixed(1)}s"></i>`).join('');
    return `<div class="p-sky"></div>${stars}<div class="p-plane"><i></i></div><div class="p-horizon"></div><i class="p-run"></i><div class="vig"></div>`;
  },
};

// sign-in variants (whole board frame, no sidebar)
const signCard = `<div class="card" style="width:330px;z-index:1;display:flex;flex-direction:column;gap:12px;padding:22px;backdrop-filter:blur(10px);background:color-mix(in srgb,var(--surf) 84%,transparent)">
  <div class="ey">aakash-portal</div><div class="h">Sign in</div><div class="p">Attendance, leave and your team — pick up where you left off.</div>
  <div style="height:30px;border-radius:8px;border:1px solid var(--line)"></div><div style="height:30px;border-radius:8px;border:1px solid var(--line)"></div><span class="btn" style="justify-content:center;height:32px">Sign in</span></div>`;
const terraSignin = (light) => {
  const r = rnd(33);
  const ff = Array.from({ length: 16 }, () => { const v = () => `${((r() - 0.5) * 160).toFixed(0)}px`; return `<i class="t-ff" style="left:${(r() * 96).toFixed(1)}%;top:${(50 + r() * 45).toFixed(1)}%;--x1:${v()};--y1:${v()};--x2:${v()};--y2:${v()};--x3:${v()};--y3:${v()};--d:${(14 + r() * 12).toFixed(1)}s;--b:${(4 + r() * 4).toFixed(1)}s;animation-delay:-${(r() * 20).toFixed(1)}s,-${(r() * 8).toFixed(1)}s"></i>`; }).join('');
  const rd = [[0.16, 330, [[34, 2], [14, 5]], 'var(--a2)', 140], [0.22, 380, [[26, 3], [12, 7]], 'var(--pri)', 100]];
  return `<div class="stage${light ? ' light' : ''}" style="justify-content:center;align-items:center">
  <div class="fx"><div class="t-ph dusk" style="opacity:1;animation:none;height:70%"></div>
  <div style="position:absolute;left:62%;top:270px;width:300px;height:300px;margin:-150px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,#FDE68A 80%,transparent) 0 18%,color-mix(in srgb,#FBBF24 30%,transparent) 30%,transparent 68%);animation:breathe 9s ease-in-out infinite"></div>
  ${rd.map(([o, base, amps, c, dur], i) => svg(1920, 460, `<path d="${ridge(960, base, amps, 21 + i)} L1920 460 L0 460Z" fill="color-mix(in srgb,${c} ${Math.round(o * 100)}%,transparent)"/>`, `left:0;bottom:-${i * 30}px;width:200%;animation:wave ${dur}s linear infinite`)).join('')}
  ${ff}<div class="vig"></div></div>${signCard}</div>`;
};
const prismSignin = (light) => `<div class="stage${light ? ' light' : ''}" style="justify-content:center;align-items:center">
  <div class="fx"><div class="p-gridf" style="-webkit-mask:radial-gradient(60% 60% at 40% 45%,#000,transparent);mask:radial-gradient(60% 60% at 40% 45%,#000,transparent)"></div><div class="p-fan"></div><i class="p-ray"></i><i class="p-gem"></i><div class="vig"></div></div>
  <div style="margin-left:300px;z-index:1">${signCard}</div></div>`;

// ─── Families (same 13 sections as Signature) ──────────────
const SECTIONS = [
  ['home', 'Home & dashboards', 'dash', 'Aurora'], ['people', 'People, profiles & employees', 'people', 'Constellation'], ['time', 'Attendance & timesheets', 'time', 'Light sweep & dial'],
  ['leave', 'Leave, who’s off & holidays', 'cal', 'Calm horizon'], ['projects', 'Projects & planning', 'proj', 'Blueprint spotlight'], ['money', 'Expenses & payments', 'money', 'Emerald mesh'],
  ['assets', 'Assets', 'assets', 'Studio light'], ['help', 'Helpdesk', 'help', 'Signal rings'], ['engage', 'Announcements & kudos', 'feed', 'Warm floaters'],
  ['reports', 'Reports & analytics', 'report', 'Data waves'], ['quiet', 'Settings, roles & admin forms', 'quiet', 'Quiet paper'], ['sa', 'Super Admin console', 'sa', 'Night pulse'], ['signin', 'Sign-in & welcome', 'dash', 'Hero aurora'],
];

const PACKS = {
  terra: {
    name: 'Terra', prefix: 'Terra', color: '#047857', soft: '#E8F7EF', tagline: 'Nature — warm, organic, slow. The app breathes like the outdoors.',
    why: 'Follows the 2026 shift away from glossy tech gradients towards warmer, organic, “made by people” surfaces. Every mood is a real place or moment in nature, so sections feel different without being loud.',
    moods: {
      home: { title: 'Time-of-day sky', fx: T.sky, sub: 'The sky behind Home follows the real time: pink dawn when you check in, clear blue at noon, violet dusk, deep night for late shifts. Sun and moon ride the same slow wheel; a few clouds drift past.', tags: [['Home (all roles)'], ['Uses the company’s time zone'], ['Board runs a full day in 48 s', 'a']], spec: [['Layers', '4 sky gradients (dawn · day · dusk · night) · sun & moon wheel · 5 drifting clouds · vignette'], ['In the app', 'Phase and sun height come from the clock and change slowly through the day — no cycling'], ['Night shift', 'People on a night-shift project see the night sky during their shift'], ['Strength', 'Sky only in the top ~60%; cards keep solid surfaces'], ['Cost', 'Opacity + transform; clouds are 5 blurred shapes']], extra: () => `<div class="cap" style="margin-top:4px">The 4 phases</div><div class="t-strip">${[['Dawn', '#F472B6,#FBBF24'], ['Day', '#38BDF8,#A5F3FC'], ['Dusk', '#7C3AED,#F97316'], ['Night', '#1E3A8A,#312E81']].map(([n, g]) => `<span style="background:linear-gradient(180deg,${g})">${n}</span>`).join('')}</div>` },
      people: { title: 'Fireflies', fx: T.fireflies, sub: 'Small warm lights wander slowly over a dusky meadow and glow softly on and off — each one a person, together a team.', tags: [['My profile'], ['People directory'], ['Employees'], ['Organisation chart']], spec: [['Layers', 'Dusk tint · grass silhouette along the bottom · 22 fireflies'], ['Motion', 'Each firefly wanders on its own 14–28 s path and glows every 4–9 s (smooth, never flashing)'], ['Strength', 'Glow max ~85% in dark, a muted amber dot in light'], ['Cost', '22 tiny elements, transform + opacity']] },
      time: { title: 'Sun path', fx: T.sunpath, acc: '--a2:#6366F1', sub: 'A dotted sun path arcs across the page from shift start to shift end. The sun sits where the working day is now; the arc behind it fills in gold — the day you’ve already worked.', tags: [['Attendance · My week'], ['My timesheet'], ['Timesheet approvals'], ['Check-in pulse unchanged', 'a']], spec: [['Layers', 'Warm band · dotted sun path · filled “worked” arc · sun · hour labels from the shift'], ['In the app', 'Arc ends = the person’s shift (e.g. 09:30–18:30); sun moves with the clock'], ['Board', 'Sun walks the whole day in 40 s so you can see it'], ['Cost', '1 SVG stroke + 1 rotating element']] },
      leave: { title: 'Clouds & hills', fx: T.clouds, sub: 'A soft holiday sky with clouds drifting very slowly, two birds passing now and then, and gentle green hills at the bottom of the page — time away from work.', tags: [['Apply leave'], ['Leave approvals'], ['Who’s off calendar'], ['Holidays']], spec: [['Layers', 'Sky gradient (top 280 px) · 6 clouds · 2 birds · 2 hill layers'], ['Motion', 'Clouds cross in 90–150 s; birds every ~60 s'], ['Strength', 'Calendar grid sits on the plain background — sky and hills only at the edges'], ['Cost', 'Transform only']] },
      projects: { title: 'Contour map', fx: T.topo, sub: 'Topographic lines like a hiking map, with a dashed route climbing from start to summit through milestone pins. A small light walks the route — the project’s journey.', tags: [['Projects'], ['Project detail'], ['Resource planner'], ['My projects']], spec: [['Layers', 'Ambient base · 21 contour lines (every 4th is an “index” line in the theme colour) · route + 4 milestone pins · walker'], ['Motion', 'Map drifts 70 s; walker goes start → summit in 30 s and back'], ['Idea', 'On a project page, pins can be the real milestones (later)'], ['Cost', '2 static SVGs + 1 moving dot']] },
      money: { title: 'Dappled light', fx: T.komorebi, sub: 'Sunlight through leaves (komorebi): soft gold-green patches shift gently, and now and then a leaf falls. Calm and growing — money matters, kept quiet.', tags: [['My expenses'], ['Expense approvals'], ['Payments & reports'], ['Categories']], spec: [['Layers', 'Green canopy tint · 14 light patches · 4 falling leaves'], ['Motion', 'Patches sway 9–17 s; a leaf falls every ~8 s'], ['Colours', 'Emerald stays the “money / approved” colour across packs'], ['Cost', 'Pre-blurred shapes, transform + opacity']] },
      assets: { title: 'Zen garden', fx: T.zen, sub: 'Raked sand lines flow around a few stones, with rings around each — every object has its place. A soft band of light passes slowly, like a rake.', tags: [['My assets'], ['Request an asset'], ['Register & detail'], ['Product animations unchanged', 'a']], spec: [['Layers', 'Sand tint · raked lines (masked around stones) · ripples · 3 stones · light pass'], ['Motion', 'Ripples breathe 12 s; light pass 26 s'], ['Strength', 'Lines 11% of text colour'], ['Cost', '1 static SVG + 2 moving layers']] },
      help: { title: 'Lighthouse', fx: T.lighthouse, acc: '--a3:#06B6D4', sub: 'A small lighthouse at dusk sweeps its beam slowly over the page while the sea moves below — “we see you, help is coming”.', tags: [['My tickets'], ['Queue'], ['Ticket detail'], ['Beam turns amber when SLAs are at risk (queue)', 'a']], spec: [['Layers', 'Dusk tint · sea band + 2 wave lines · beam · lighthouse · lamp glow'], ['Motion', 'Beam sweeps 16 s back and forth; lamp glows every 4 s'], ['Strength', 'Beam max ~70% at the lamp, fading to nothing'], ['Cost', '1 rotating layer + 1 SVG loop']] },
      engage: { title: 'Petal breeze', fx: T.petals, sub: 'Blossom petals drift down across the page in a warm glow, turning as they fall — spring-like and celebratory, but quiet.', tags: [['Announcements'], ['Kudos'], ['Celebrations'], ['Kudos heart burst unchanged', 'a']], spec: [['Layers', 'Warm glow · 22 petals'], ['Motion', 'Each petal falls in 18–32 s and flutters (3D turn) every 3–6 s'], ['Seasons (later)', 'Autumn leaves in Oct–Nov, snow in Dec, petals in spring'], ['Cost', '22 small elements']] },
      reports: { title: 'Mountain ridges', fx: T.ridges, sub: 'Layered mountain ridges glide slowly at different speeds with mist between them; the front ridge line looks like a chart line — data as landscape.', tags: [['Reports & analytics'], ['People / Time / Leave reports'], ['Insights']], spec: [['Layers', 'Ambient base · mist · 3 ridge layers (back to front, 120 / 90 / 70 s)'], ['Motion', 'Seamless parallax loop'], ['Strength', 'Fill 12–22%, front line 60% primary'], ['Cost', '3 SVG layers, transform only']] },
      quiet: { title: 'Linen', fx: T.linen, sub: 'No motion: warm linen grain, a faint natural tint and a leaf-vein watermark in the corner. Forms and permissions need focus.', tags: [['Settings'], ['Users & roles'], ['Access explorer'], ['Imports'], ['Static', 'n']], spec: [['Layers', 'Warm tint · paper grain · leaf vein watermark'], ['Motion', 'None (on purpose)'], ['Cost', 'Static']] },
      sa: { title: 'Northern lights', fx: T.aurora, acc: '--a3:#38BDF8', sub: 'Curtains of green, cyan and violet light ripple slowly over a starry sky above dark peaks — the platform watching over everyone.', tags: [['Platform dashboard'], ['Companies & plans'], ['System'], ['Turns amber/red when a system is unhealthy', 'a']], spec: [['Layers', 'Polar night · 40 stars · 3 light curtains · mountain silhouette'], ['Motion', 'Curtains sway and stretch 20–26 s'], ['Live meaning', 'Curtain colour follows system health'], ['Cost', '3 blurred layers, transform only']] },
      signin: { title: 'Golden hour', custom: terraSignin, sub: 'The bolder welcome: a big low sun over layered hills at golden hour, with fireflies — and a frosted sign-in card.', tags: [['Sign in'], ['Workspace finder'], ['Set password / welcome']], spec: [['Layers', 'Dusk sky · sun glow · 2 gliding ridges · 16 fireflies · frosted card'], ['Strength', 'A little stronger than inside the app'], ['Cost', 'Same as People + 2 SVG layers']] },
    },
  },
  prism: {
    name: 'Prism', prefix: 'Prism', color: '#4338CA', soft: '#EEF0FF', tagline: 'Geometry — crisp, precise, modern. Light beams, grids and Bauhaus shapes.',
    why: 'Inspired by Linear / Vercel style light beams and fine grids, and by Bauhaus / Swiss design: circles, half-circles, stripes and strict columns. Clean and “engineered”, for people who like a sharper look.',
    moods: {
      home: { title: 'Light beams', fx: P.beams, sub: 'Four soft beams of light fall from a glowing line at the top of the page over a fine grid, and sway a few degrees — the Linear-style hero, behind your day.', tags: [['Home (all roles)'], ['Manager / HR dashboards'], ['Atmosphere moments still play on top', 'a']], spec: [['Layers', 'Fine grid (fades out) · 4 beams (primary, violet, light primary, teal) · glowing top line'], ['Motion', 'Each beam sways 9° over 18–26 s, back and forth'], ['Strength', 'Beams blurred, max ~50% in dark'], ['Cost', '4 transform layers']] },
      people: { title: 'Bauhaus shapes', fx: P.bauhaus, sub: 'A Bauhaus composition of circles, a half-circle, a quarter-circle and an open ring at the edges of the page; pieces turn and glide slowly — different shapes, one team.', tags: [['My profile'], ['People directory'], ['Employees'], ['Organisation chart']], spec: [['Layers', 'Ambient base · 6 flat shapes in theme colours + amber'], ['Motion', 'Half-circle flips in 30 s; ring 80 s; quarter 60 s; circle glides 26 s'], ['Placement', 'Kept to the right and bottom edges so headers stay clear'], ['Cost', '6 elements, transform only']] },
      time: { title: 'Chronograph', fx: P.chrono, acc: '--a2:#6366F1', sub: 'A Swiss stopwatch face sits in the top corner: tick marks, three segmented rings turning at different speeds and directions, and a slow hand — precise time.', tags: [['Attendance · My week'], ['My timesheet'], ['Timesheet approvals'], ['Check-in pulse unchanged', 'a']], spec: [['Layers', 'Ambient base · tick ring · 3 segmented rings · hand'], ['Motion', 'Rings 40 / 60 / 90 s (alternate directions); hand 60 s per turn'], ['Live idea', 'Hand can show the real time of the shift (later)'], ['Cost', '1 SVG, 4 rotating parts']] },
      leave: { title: 'Striped sun', fx: P.stripesun, sub: 'A retro Bauhaus sun with horizontal cut-outs rises and sets very slowly above thin horizon lines — holidays, in geometry.', tags: [['Apply leave'], ['Leave approvals'], ['Who’s off calendar'], ['Holidays']], spec: [['Layers', 'Ambient base · striped sun (amber → pink → violet) · 3 horizon lines'], ['Motion', 'Sun rises 50 px over 24 s and back'], ['Strength', '42% sun, top-right only; calendar stays clear'], ['Cost', '1 SVG, transform only']] },
      projects: { title: 'Isometric build', fx: P.iso, sub: 'An isometric grid with blocks of different heights that rise and settle slowly — a project being built, piece by piece.', tags: [['Projects'], ['Project detail'], ['Resource planner'], ['My projects']], spec: [['Layers', 'Ambient base · isometric line grid (masked) · 4 blocks'], ['Motion', 'Blocks rise and settle 11–16 s each, out of step'], ['Idea', 'Block heights can follow project progress (later)'], ['Cost', '4 SVG blocks, transform only']] },
      money: { title: 'Facets', fx: P.facets, sub: 'A low-poly gem of triangles in emerald and teal; facets catch the light one by one, and a shine sweeps across now and then — value, precisely cut.', tags: [['My expenses'], ['Expense approvals'], ['Payments & reports'], ['Categories']], spec: [['Layers', '~180 triangles (faded at the edges) · diagonal shine'], ['Motion', 'Each facet glints over 8–15 s; shine every 16 s'], ['Colours', 'Emerald + teal (money / approved) + a touch of primary'], ['Cost', '1 SVG, opacity only']] },
      assets: { title: 'Wireframe cubes', fx: P.cubes, sub: 'Three glass wireframe cubes turn slowly above a perspective floor grid — like objects in a 3D catalogue.', tags: [['My assets'], ['Request an asset'], ['Register & detail'], ['Product animations unchanged', 'a']], spec: [['Layers', 'Ambient base · perspective floor · 3 CSS-3D cubes'], ['Motion', 'Cubes turn 26–40 s per turn (one in reverse)'], ['Strength', 'Thin lines, 4% faces'], ['Cost', '18 faces, GPU 3D transforms']] },
      help: { title: 'Radar', fx: P.radar, acc: '--a3:#06B6D4', sub: 'A radar in the top corner sweeps every 8 s; small blips light up as the beam passes — every ticket is seen.', tags: [['My tickets'], ['Queue'], ['Ticket detail'], ['Blips can be real open tickets (queue)', 'a']], spec: [['Layers', 'Ambient base · range rings + cross-hair · sweep · 4 blips'], ['Motion', 'Sweep 8 s per turn; blips fade after the beam'], ['Strength', 'Rings 26%, sweep max ~50%'], ['Cost', '1 rotating layer + 4 dots']] },
      engage: { title: 'Memphis confetti', fx: P.memphis, sub: 'Memphis-style triangles, rings, zig-zags, plus signs and squares float up slowly with dot grids in the corners — playful but tidy.', tags: [['Announcements'], ['Kudos'], ['Celebrations'], ['Kudos heart burst unchanged', 'a']], spec: [['Layers', 'Soft warm glow · 2 dot grids · 16 floating shapes'], ['Motion', '22–38 s per shape, slow turn'], ['Strength', 'Max ~55%, behind cards'], ['Cost', '16 small elements']] },
      reports: { title: 'Equaliser', fx: P.eq, sub: 'A row of bars along the bottom rises and falls slowly like a music equaliser, over faint guide lines — the company’s numbers in rhythm.', tags: [['Reports & analytics'], ['People / Time / Leave reports'], ['Insights']], spec: [['Layers', 'Ambient base · guide lines · 36 bars in 3 colour groups'], ['Motion', 'Each bar 7–13 s, out of step (never fast)'], ['Strength', 'Bars fade upwards, under the real charts'], ['Cost', '36 elements, scale only']] },
      quiet: { title: 'Swiss grid', fx: P.swiss, sub: 'No motion: faint 12-column guides, an 8 px baseline, one small accent square and a circle — order and focus.', tags: [['Settings'], ['Users & roles'], ['Access explorer'], ['Imports'], ['Static', 'n']], spec: [['Layers', '12 columns · baseline rows · 2 accents'], ['Motion', 'None (on purpose)'], ['Cost', 'Static']] },
      sa: { title: 'Grid horizon', fx: P.horizon, acc: '--a3:#38BDF8', sub: 'A glowing horizon over a perspective grid that rolls slowly towards you, stars above, and a light running along the horizon — the platform at full speed. No globe.', tags: [['Platform dashboard'], ['Companies & plans'], ['System'], ['Turns amber/red when a system is unhealthy', 'a']], spec: [['Layers', 'Night tint · 30 stars · rolling grid plane · horizon line · runner'], ['Motion', 'Grid rolls one cell per 9 s; runner every 7 s'], ['Live meaning', 'Horizon colour follows system health'], ['Cost', '1 3D plane (transform) + 1 runner']] },
      signin: { title: 'Prism', custom: prismSignin, sub: 'The bolder welcome: a white beam hits a glass prism and opens into a soft spectrum that runs behind the frosted sign-in card.', tags: [['Sign in'], ['Workspace finder'], ['Set password / welcome']], spec: [['Layers', 'Fine grid · beam · glass prism · spectrum fan · frosted card'], ['Motion', 'Spectrum shimmers 9 s; beam glows 7 s'], ['Note', 'The spectrum is the only fixed-colour piece (it is the brand of this pack)'], ['Cost', '3 layers']] },
    },
  },
};

// ─── Boards ────────────────────────────────────────────────
const fam = (packKey) => SECTIONS.map(([key, eyebrow, content, sigTitle]) => {
  const m = PACKS[packKey].moods[key];
  return { key, eyebrow, content, sigTitle, file: `${PACKS[packKey].prefix}${key[0].toUpperCase()}${key.slice(1)}.dc.html`, ...m };
});
const render = (f, light = false, cls = '') => (f.custom ? f.custom(light).replace('class="stage', `class="stage${cls ? ' ' + cls : ''}`) : stage(f.fx, f.content, { light, acc: f.acc || '', cls }));

const board = (pk, f) => `${css}<div class="bd">
  <div class="eyebrow" style="color:${PACKS[pk].color}">${PACKS[pk].name} pack · ${f.eyebrow}</div><h1>${f.title}</h1><div class="sub">${f.sub}</div>
  <div class="tags">${f.tags.map(([t, c = '']) => `<span class="tag ${c}">${t}</span>`).join('')}<span class="tag n">Replaces Signature · ${f.sigTitle}</span></div>
  <div class="cols"><div><div class="cap">Dark · live</div>${render(f)}</div>
  <div class="side"><div><div class="cap">Light</div><div class="mini">${render(f, true)}</div></div>
  <div class="spec"><dl>${f.spec.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>${f.extra ? f.extra() : ''}</div></div></div>`;

const tile = (f, w = 176, cls = '') => `<div style="display:flex;flex-direction:column;gap:6px"><div style="width:${w}px;height:${Math.round(w * 0.5833)}px;border-radius:10px;overflow:hidden;position:relative;border:1px solid #2A2A33"><div style="transform:scale(${(w / 960).toFixed(5)});transform-origin:0 0;position:absolute">${render(f, false, cls)}</div></div><b style="font-size:12.5px">${f.title}</b><span style="font-size:11px;color:#6B6B76">${f.eyebrow}</span></div>`;

const overview = (pk) => {
  const P0 = PACKS[pk], F = fam(pk);
  return `${css}<div class="bd">
  <div class="eyebrow" style="color:${P0.color}">Background pack · ${P0.name}</div><h1>${P0.name} — ${P0.tagline.split(' — ')[0].toLowerCase()} backgrounds for every section</h1>
  <div class="sub">${P0.tagline} ${P0.why}</div>
  <div class="cap" style="margin-top:20px">All 13 moods (live)</div>
  <div style="display:grid;grid-template-columns:repeat(7,176px);gap:16px 18px">${F.map((f) => tile(f)).join('')}</div>
  <div class="row" style="gap:14px;margin-top:22px">
    <div class="spec" style="flex:1"><b>Same rules as Signature</b><ul><li>Behind content only; cards, tables and charts stay solid.</li><li>Slow (nothing faster than 7 s), soft (≤ 35% dark / 22% light).</li><li>Theme colours recolour every mood; status colours stay semantic.</li><li>Lively / Calm / Off and “Reduce motion” work the same.</li></ul></div>
    <div class="spec" style="flex:1"><b>What changes with ${P0.name}</b><ul>${F.slice(0, 6).map((f) => `<li>${f.eyebrow.split(',')[0].split(' & ')[0]}: ${f.sigTitle} → <b>${f.title}</b></li>`).join('')}<li>…and 7 more (see the rows below)</li></ul></div>
    <div class="spec" style="flex:1"><b>Build notes</b><ul><li>Same <code>&lt;PageBackdrop/&gt;</code>; mood = pack + section, e.g. <code>data-pack="${pk}" data-mood="home"</code>.</li><li>New CSS only (${pk === 'terra' ? '<code>.t-*</code>' : '<code>.p-*</code>'} classes); no libraries, no canvas/WebGL.</li><li>Phones: half the particles; low-power devices get the still frame.</li>${pk === 'terra' ? '<li>Home sky reads the company time zone once a minute.</li>' : '<li>3D cubes and grid plane use CSS 3D transforms only.</li>'}</ul></div>
  </div></div>`;
};

const picker = () => {
  const home = { sig: { fx: 'aurora', content: 'dash', title: 'Signature' }, terra: fam('terra')[0], prism: fam('prism')[0] };
  const card = (name, desc, f, on, badge = '') => `<div style="border:1.5px solid ${on ? '#4F46E5' : '#E5E5EC'};background:${on ? '#EEF0FF66' : '#fff'};border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:7px;flex:1"><div style="height:120px;border-radius:9px;overflow:hidden;position:relative"><div style="transform:scale(.21875);transform-origin:0 0;position:absolute">${f.fx && typeof f.fx === 'string' ? stage(f.fx, f.content) : render(f)}</div></div><div style="display:flex;align-items:center;gap:6px"><b style="font-size:13.5px">${name}</b>${badge}</div><span style="font-size:11.5px;color:#6B6B76;line-height:1.4">${desc}</span></div>`;
  const keys = ['home', 'people', 'time', 'projects', 'money', 'help', 'reports'];
  const T0 = fam('terra'), P1 = fam('prism');
  const cell = (f) => `<div style="width:150px;height:88px;border-radius:8px;overflow:hidden;position:relative;border:1px solid #2A2A33"><div style="transform:scale(.15625);transform-origin:0 0;position:absolute">${f}</div></div>`;
  return `${css}<div class="bd">
  <div class="eyebrow">Backgrounds · packs</div><h1>Pick a background pack — every section changes at once</h1>
  <div class="sub">Signature stays the default. Choosing <b>Terra</b> or <b>Prism</b> swaps all 13 section moods for a new set; pages, sidebar and top bar don’t change. Liveliness (Lively / Calm / Off) stays a separate choice.</div>
  <div class="row" style="gap:22px;margin-top:20px;align-items:flex-start">
    <div class="spec" style="width:640px"><div class="cap">My profile → Preferences → Appearance</div>
      <b style="font-size:14px">Page backgrounds</b><div style="color:#6B6B76;margin:2px 0 12px">Style of the space behind each page.</div>
      <div class="row" style="gap:10px">${card('Signature', 'A different mood per section — aurora, constellation, waves…', home.sig, false, '<span class="tag n" style="font-size:10px">Default</span>')}${card('Terra', 'Nature — sky, fireflies, contour maps, lighthouse, northern lights', home.terra, true)}${card('Prism', 'Geometry — light beams, Bauhaus shapes, radar, equaliser', home.prism, false)}</div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:10px"><b style="font-size:12.5px;width:84px">Liveliness</b>${['Lively', 'Calm', 'Off'].map((t, i) => `<span style="padding:5px 12px;border-radius:99px;font-size:11.5px;font-weight:700;border:1.5px solid ${i === 0 ? '#4F46E5' : '#E5E5EC'};color:${i === 0 ? '#4338CA' : '#4B4B55'}">${t}</span>`).join('')}</div>
      <div style="margin-top:10px;font-size:12px;color:#6B6B76">Picking a card previews it on the page right away (600 ms cross-fade); “Reset to company default” below. Company Admin sets the default pack + liveliness in Settings → Theme, as today.</div></div>
    <div class="spec" style="flex:1"><div class="cap">Same section, three packs (still frames)</div>
      <div style="display:grid;grid-template-columns:110px repeat(3,150px);gap:8px 10px;align-items:center">
        <span></span><b style="font-size:11.5px">Signature</b><b style="font-size:11.5px;color:#047857">Terra</b><b style="font-size:11.5px;color:#4338CA">Prism</b>
        ${keys.map((k) => { const i = SECTIONS.findIndex((s) => s[0] === k); const sg = SIG_FAM[i]; return `<span style="font-size:11.5px;font-weight:700;color:#4B4B55">${SECTIONS[i][1].split(',')[0].split(' & ')[0]}</span>${cell(stage(sg.fx, sg.content, { acc: sg.acc || '', cls: 'still' }))}${cell(render(T0[i], false, 'still'))}${cell(render(P1[i], false, 'still'))}`; }).join('')}
      </div></div>
  </div></div>`;
};

// ─── write ─────────────────────────────────────────────────
const boards = [['BgPacks.dc.html', 'Backgrounds · Packs — Signature (default), Terra, Prism; Preferences picker + same section in three packs', picker, 1060]];
for (const pk of ['terra', 'prism']) {
  boards.push([`${PACKS[pk].prefix}Overview.dc.html`, `${PACKS[pk].name} pack · Overview — all 13 moods`, () => overview(pk), 860]);
  for (const f of fam(pk)) boards.push([f.file, `${PACKS[pk].name} · ${f.title} — ${f.eyebrow}`, () => board(pk, f), 760]);
}
for (const [file, title, fn, h] of boards) fs.writeFileSync(path.join(OUT, file), dcPage(title, '', fn(), h));

const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
const Y = 40300;
const place = (f, title, h, x, y) => { canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x, y }; if (!canvas.order.includes(f)) canvas.order.push(f); };
place('BgPacks.dc.html', boards[0][1], 1060, 0, Y);
canvas.notes.n18 = { kind: 'title1', maxW: 6000, text: 'Background packs — pick one in Preferences: Signature (default) · Terra (nature) · Prism (geometry). Every section changes at once.', w: 240, x: 0, y: Y - 300 };
let y = Y + 1360;
['terra', 'prism'].forEach((pk, pi) => {
  const list = boards.filter(([f]) => f.startsWith(PACKS[pk].prefix));
  canvas.notes[`n${19 + pi}`] = { kind: 'title1', maxW: 6000, text: pk === 'terra' ? 'Terra pack — nature: time-of-day sky, fireflies, sun path, clouds, contour map, dappled light, zen garden, lighthouse, petals, ridges, linen, northern lights, golden hour' : 'Prism pack — geometry: light beams, Bauhaus shapes, chronograph, striped sun, isometric build, facets, wire cubes, radar, Memphis, equaliser, Swiss grid, grid horizon, prism', w: 240, x: 0, y: y - 300 };
  place(list[0][0], list[0][1], 860, 0, y);
  list.slice(1).forEach(([f, title, , h], i) => place(f, title, h, (i % 4) * 1520, y + 1160 + Math.floor(i / 4) * 860));
  y += 1160 + Math.ceil((list.length - 1) / 4) * 860 + 500;
});
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards');
