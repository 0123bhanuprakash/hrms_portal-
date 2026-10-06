// Chart motion demo: how every graph, bar and ring in the app should animate.
// Board 1 is a catalogue (one card per chart kind, each replaying every 6 s);
// board 2 is the Reports page at real size in dark mode with the choreography.
const fs = require('fs');
const path = require('path');
const { dcPage } = require('./build-balanced.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

const C = { pri: '#4F46E5', ok: '#16A34A', warn: '#F59E0B', bad: '#E11D48', info: '#0EA5E9', vio: '#8B5CF6', pink: '#EC4899' };

const css = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<style>
@property --n { syntax: '<integer>'; inherits: false; initial-value: 0; }
*{box-sizing:border-box;margin:0}
.wrap{--bg:#F6F6FB;--card:#fff;--border:#E6E6F0;--fg:#17172B;--mut:#6B6B85;--track:#EEEEF5;--cy:6s;font-family:Manrope,system-ui,sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;padding:36px 40px}
.wrap.dark{--bg:#0F0F1A;--card:#181826;--border:#2A2A3D;--fg:#ECECF6;--mut:#9A9AB5;--track:#26263A}
h1{font-size:28px;font-weight:800;letter-spacing:-.02em}
.sub{color:var(--mut);font-size:14px;margin-top:6px;max-width:900px;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:28px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px;min-width:0}
.card h3{font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}
.card h3 i{font-style:normal;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin-left:auto}
.stage{min-height:170px;display:flex;align-items:flex-end;justify-content:center;position:relative}
.how{font-size:12.5px;color:var(--mut);line-height:1.5;border-top:1px dashed var(--border);padding-top:10px}
.how b{color:var(--fg)}
.where{display:flex;flex-wrap:wrap;gap:6px}
.where span{font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:var(--track);color:var(--mut)}
.lbl{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.count{counter-reset:n var(--n);animation:count var(--cy) cubic-bezier(.2,.8,.2,1) infinite;animation-delay:var(--d,0s)}
.count::after{content:counter(n)}
@keyframes count{0%{--n:0}22%{--n:var(--to)}100%{--n:var(--to)}}
/* bars rise, a little spring at the top */
.bars{display:flex;align-items:flex-end;gap:12px;height:150px}
.bars .b{width:30px;display:flex;flex-direction:column;align-items:center;gap:6px}
.bars .b em{font-style:normal;font-size:11px;font-weight:800;opacity:0;animation:fadeup var(--cy) ease infinite;animation-delay:calc(var(--i)*70ms + .35s)}
.bars .b span{width:100%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,var(--c,${C.pri}),color-mix(in srgb,var(--c,${C.pri}) 70%,#fff));transform-origin:bottom;animation:rise var(--cy) cubic-bezier(.3,1.45,.5,1) infinite;animation-delay:calc(var(--i)*70ms)}
.bars .b small{font-size:10.5px;color:var(--mut);font-weight:700}
@keyframes rise{0%{transform:scaleY(0)}14%{transform:scaleY(1)}88%{transform:scaleY(1);opacity:1}97%{transform:scaleY(1);opacity:0}100%{transform:scaleY(0);opacity:0}}
@keyframes fadeup{0%,4%{opacity:0;transform:translateY(6px)}16%{opacity:1;transform:none}88%{opacity:1}97%,100%{opacity:0}}
/* lines draw, a dot rides the tip */
.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:draw var(--cy) cubic-bezier(.45,0,.2,1) infinite;animation-delay:var(--d,0s)}
@keyframes draw{0%{stroke-dashoffset:1;opacity:1}24%{stroke-dashoffset:0}88%{stroke-dashoffset:0;opacity:1}97%,100%{stroke-dashoffset:0;opacity:0}}
.area{animation:area var(--cy) ease infinite}
@keyframes area{0%,14%{opacity:0;transform:translateY(10px)}30%{opacity:1;transform:none}88%{opacity:1}97%,100%{opacity:0}}
.rider{offset-rotate:0deg;animation:ride var(--cy) cubic-bezier(.45,0,.2,1) infinite}
@keyframes ride{0%{offset-distance:0%;opacity:1}24%{offset-distance:100%}88%{offset-distance:100%;opacity:1}97%,100%{offset-distance:100%;opacity:0}}
.halo{transform-box:fill-box;transform-origin:center;animation:halo var(--cy) ease-out infinite}
@keyframes halo{0%,24%{transform:scale(1);opacity:0}26%{opacity:.5}40%{transform:scale(3);opacity:0}100%{opacity:0}}
.pill{position:absolute;font-size:11px;font-weight:800;color:#fff;padding:3px 8px;border-radius:99px;opacity:0;animation:pop var(--cy) cubic-bezier(.3,1.6,.5,1) infinite;animation-delay:var(--d,0s)}
@keyframes pop{0%,22%{opacity:0;transform:scale(.4)}30%{opacity:1;transform:scale(1)}88%{opacity:1}97%,100%{opacity:0}}
/* donut segments sweep one after another */
.seg{stroke-dasharray:0 100;animation:seg var(--cy) cubic-bezier(.5,0,.2,1) infinite;animation-delay:var(--d)}
@keyframes seg{0%{stroke-dasharray:0 100}14%{stroke-dasharray:var(--len) 100}88%{stroke-dasharray:var(--len) 100;opacity:1}97%,100%{stroke-dasharray:var(--len) 100;opacity:0}}
.legend{display:flex;flex-direction:column;gap:7px;font-size:12px}
.legend div{display:flex;align-items:center;gap:8px;opacity:0;animation:fadeup var(--cy) ease infinite;animation-delay:var(--d)}
.legend i{width:9px;height:9px;border-radius:3px;background:var(--c)}
.legend b{margin-left:auto;font-variant-numeric:tabular-nums}
.dotpop{transform-box:fill-box;transform-origin:center;opacity:0;animation:pop var(--cy) cubic-bezier(.3,1.6,.5,1) infinite;animation-delay:var(--d,0s)}
/* rings fill with spring */
.ring{stroke-dasharray:0 100;animation:ring var(--cy) cubic-bezier(.3,1.25,.5,1) infinite;animation-delay:var(--d,0s)}
@keyframes ring{0%{stroke-dasharray:0 100}22%{stroke-dasharray:var(--len) 100}88%{stroke-dasharray:var(--len) 100;opacity:1}97%,100%{stroke-dasharray:var(--len) 100;opacity:0}}
/* horizontal bars */
.hb{display:flex;flex-direction:column;gap:10px;width:100%}
.hb .r{display:grid;grid-template-columns:86px 1fr 34px;align-items:center;gap:10px;font-size:12px}
.hb .t{height:10px;border-radius:99px;background:var(--track);overflow:hidden}
.hb .t span{display:block;height:100%;border-radius:99px;background:var(--c);transform-origin:left;animation:grow var(--cy) cubic-bezier(.3,1.2,.5,1) infinite;animation-delay:calc(var(--i)*90ms)}
.hb .v{font-weight:800;text-align:right;font-variant-numeric:tabular-nums}
@keyframes grow{0%{transform:scaleX(0)}16%{transform:scaleX(1)}88%{transform:scaleX(1);opacity:1}97%{opacity:0}100%{transform:scaleX(0);opacity:0}}
/* stacked bar: segments fill in order */
.stack{display:flex;height:22px;border-radius:99px;overflow:hidden;background:var(--track);width:100%}
.stack span{height:100%;background:var(--c);transform-origin:left;transform:scaleX(0);animation:grow var(--cy) cubic-bezier(.5,0,.2,1) infinite;animation-delay:var(--d)}
/* meter with a shine */
.meter{height:12px;border-radius:99px;background:var(--track);overflow:hidden;width:100%;position:relative}
.meter span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,${C.pri},${C.vio});transform-origin:left;animation:grow var(--cy) cubic-bezier(.3,1.1,.5,1) infinite;position:relative;overflow:hidden}
.meter span::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,#ffffff99 50%,transparent 70%);transform:translateX(-100%);animation:shine var(--cy) ease infinite}
@keyframes shine{0%,18%{transform:translateX(-100%)}32%,100%{transform:translateX(100%)}}
/* heat cells pop in a diagonal wave */
.heat{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;width:100%}
.heat i{aspect-ratio:1;border-radius:4px;background:var(--c);animation:cell var(--cy) cubic-bezier(.3,1.6,.5,1) infinite;animation-delay:calc((var(--x) + var(--y))*35ms)}
@keyframes cell{0%{transform:scale(0);opacity:0}10%{transform:scale(1);opacity:1}88%{transform:scale(1);opacity:1}97%,100%{transform:scale(.6);opacity:0}}
/* countdown ring drains and warms up */
.drain{stroke-dasharray:100 100;animation:drain var(--cy) linear infinite}
@keyframes drain{0%{stroke-dasharray:100 100;stroke:${C.ok}}45%{stroke:${C.ok}}65%{stroke:${C.warn}}85%{stroke-dasharray:12 100;stroke:${C.bad}}100%{stroke-dasharray:12 100;stroke:${C.bad}}}
.tick{animation:tick var(--cy) steps(1) infinite}
@keyframes tick{0%{color:${C.ok}}65%{color:${C.warn}}85%,100%{color:${C.bad}}}
/* data change: bars morph from old to new values */
.morph .b span{animation:morph var(--cy) cubic-bezier(.5,0,.2,1) infinite;transform:none;height:var(--h1)}
@keyframes morph{0%,40%{height:var(--h1)}52%,90%{height:var(--h2)}100%{height:var(--h1)}}
.seg2{display:inline-flex;border:1px solid var(--border);border-radius:9px;padding:2px;font-size:11px;font-weight:800}
.seg2 span{padding:4px 9px;border-radius:7px}
.seg2 span:first-child{animation:segA var(--cy) steps(1) infinite}
.seg2 span:last-child{animation:segB var(--cy) steps(1) infinite}
@keyframes segA{0%{background:${C.pri};color:#fff}40%,100%{background:transparent;color:var(--mut)}}
@keyframes segB{0%{background:transparent;color:var(--mut)}40%,90%{background:${C.pri};color:#fff}91%,100%{background:transparent;color:var(--mut)}}
/* KPI tile */
.kpi{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:14px;border:1px solid var(--border);background:var(--card);position:relative;overflow:hidden}
.kpi .big{font-size:30px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;width:max-content;opacity:0;animation:slidein var(--cy) cubic-bezier(.3,1.5,.5,1) infinite;animation-delay:var(--d,.5s)}
@keyframes slidein{0%,8%{opacity:0;transform:translateX(-10px)}20%{opacity:1;transform:none}88%{opacity:1}97%,100%{opacity:0}}
/* hover state sample */
.hover{position:absolute;left:50%;top:6px;transform:translateX(-50%);background:var(--fg);color:var(--bg);font-size:11px;font-weight:700;padding:6px 9px;border-radius:9px;white-space:nowrap;box-shadow:0 8px 20px #0003}
/* reports page */
.app{display:flex;min-height:100vh}
.side{flex:0 0 232px;background:#13131F;border-right:1px solid var(--border);padding:18px 12px;display:flex;flex-direction:column;gap:4px}
.side .it{height:34px;border-radius:9px;display:flex;align-items:center;padding:0 12px;font-size:13px;color:#9A9AB5}
.side .it.on{background:#24244A;color:#C7C6FF;font-weight:800}
.main{flex:1;padding:28px 34px;display:flex;flex-direction:column;gap:20px;min-width:0;animation:pagein var(--cy) ease infinite}
@keyframes pagein{0%{opacity:.4}3%{opacity:1}}
.row{display:flex;gap:16px}
.fb{display:flex;gap:8px}
.fb span{height:34px;border-radius:10px;border:1px solid var(--border);background:var(--card);padding:0 12px;display:flex;align-items:center;font-size:12.5px;font-weight:700;color:var(--mut)}
.tl{display:grid;grid-template-columns:150px 1fr;gap:8px 14px;align-items:center;font-size:12px}
.tl .track{position:relative;height:14px;border-radius:99px;background:var(--track)}
.tl .track span{position:absolute;top:0;bottom:0;border-radius:99px;background:var(--c)}
.axis{display:flex;justify-content:space-between;font-size:10.5px;color:var(--mut);margin-left:164px}
</style>`;

// ── helpers
const count = (to, d = 0) => `<span class="count" style="--to:${to};--d:${d}s"></span>`;
const bars = (vals, labels, opts = {}) =>
  `<div class="bars${opts.morph ? ' morph' : ''}">${vals
    .map((v, i) => {
      const h = Array.isArray(v) ? v : [v];
      const c = opts.colors?.[i] ? `--c:${opts.colors[i]};` : '';
      const style = opts.morph ? `--h1:${h[0]}px;--h2:${h[1]}px` : `height:${h[0]}px`;
      return `<div class="b" style="--i:${i};${c}">${opts.values ? `<em>${opts.values[i]}</em>` : ''}<span style="${style}"></span><small>${labels[i]}</small></div>`;
    })
    .join('')}</div>`;

function line(pts, w, h, color, { area = true, rider = true, d = 0 } = {}) {
  const max = Math.max(...pts) * 1.15;
  const xy = pts.map((p, i) => [Math.round((i / (pts.length - 1)) * (w - 16)) + 8, Math.round(h - 8 - (p / max) * (h - 24))]);
  // smooth curve
  let dPath = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1];
    const [x1, y1] = xy[i];
    const cx = (x0 + x1) / 2;
    dPath += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const last = xy[xy.length - 1];
  const id = `g${Math.random().toString(36).slice(2, 7)}`;
  return `<svg width="${w}" height="${h}" style="overflow:visible">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${h * f}" y2="${h * f}" stroke="currentColor" stroke-opacity=".08"/>`).join('')}
    ${area ? `<path class="area" d="${dPath} L${last[0]},${h} L${xy[0][0]},${h} Z" fill="url(#${id})"/>` : ''}
    <path class="draw" pathLength="1" d="${dPath}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" style="--d:${d}s"/>
    ${rider ? `<circle class="halo" cx="${last[0]}" cy="${last[1]}" r="5" fill="${color}"/><circle class="rider" r="5" fill="#fff" stroke="${color}" stroke-width="3" style="offset-path:path('${dPath}')"/>` : ''}
  </svg>`;
}

function donut(slices, size = 140, stroke = 18, center = '') {
  const r = (size - stroke) / 2;
  let off = 0;
  let delay = 0;
  const sum = slices.reduce((n, s) => n + s[1], 0);
  const arcs = slices
    .map(([, v, c]) => {
      const len = (v / sum) * 100 - 0.8;
      const el = `<circle class="seg" pathLength="100" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${c}" stroke-width="${stroke}" stroke-linecap="butt" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})" style="--len:${len};--d:${delay}s"/>`;
      off += (v / sum) * 100;
      delay += (v / sum) * 0.8;
      return el;
    })
    .join('');
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>${arcs}</svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">${center}</div></div>`;
}

function ring(pct, color, size = 96, stroke = 10, center = '', d = 0, cls = 'ring') {
  const r = (size - stroke) / 2;
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/><circle class="${cls}" pathLength="100" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})" style="--len:${pct};--d:${d}s"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">${center}</div></div>`;
}

const card = (title, tag, stage, how, where) => `<div class="card"><h3>${title}<i>${tag}</i></h3><div class="stage">${stage}</div><p class="how">${how}</p><div class="where">${where.map((w) => `<span>${w}</span>`).join('')}</div></div>`;

// ── board 1: catalogue
function catalogue() {
  const week = bars([92, 118, 104, 64, 132, 40, 18], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { values: [182, 231, 207, 128, 262, 80, 36] });
  const cards = [
    card('Column bars', 'Rise', week, '<b>Each bar springs up from the floor</b>, left to right (70 ms apart), with a small bounce at the top. The number above fades in once its bar lands.', ['Home · this week', 'Timesheet week', 'Attendance team', 'Reports daily']),
    card('Trend line', 'Draw', `<div style="position:relative">${line([12, 18, 15, 24, 22, 31, 29, 38], 330, 150, C.pri)}<span class="pill" style="right:-6px;top:4px;background:${C.pri};--d:0s">+38</span></div>`, '<b>The line draws itself left → right</b> while a dot rides the tip. The soft area fills in under it after, and the last value pops in a pill.', ['Reports trend', 'Headcount', 'Super Admin insights']),
    card('Donut', 'Sweep', `<div style="display:flex;align-items:center;gap:22px;width:100%">${donut([['Casual', 42, C.pri], ['Sick', 23, C.info], ['Earned', 18, C.vio], ['WFH', 17, C.warn]], 140, 18, `<b style="font-size:24px">${count(100)}</b><span class="lbl">days</span>`)}<div class="legend" style="flex:1">${[['Casual', 42, C.pri], ['Sick', 23, C.info], ['Earned', 18, C.vio], ['WFH', 17, C.warn]].map(([l, v, c], i) => `<div style="--c:${c};--d:${0.15 + i * 0.12}s"><i></i>${l}<b>${v}</b></div>`).join('')}</div></div>`, '<b>Slices sweep round one after another</b>, clockwise from 12 o’clock. The middle number counts up and each legend row appears with its slice.', ['Leave mix', 'People by team', 'Asset status', 'Expense types']),
    card('Rings', 'Fill', `<div style="display:flex;gap:18px">${[[72, C.pri, 'Casual', '8.5'], [45, C.info, 'Sick', '4'], [90, C.ok, 'Profile', '90%']].map(([p, c, l, v], i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${ring(p, c, 92, 10, `<b style="font-size:17px">${v}</b>`, i * 0.12)}<span class="lbl">${l}</span></div>`).join('')}</div>`, '<b>Rings fill with a spring</b> and settle at their value; neighbours start 120 ms apart so they feel like one group, not three.', ['Leave balance', 'Profile complete', 'Plan usage', 'Project budget']),
    card('Horizontal bars', 'Grow', `<div class="hb">${[['Engineering', 92, C.pri, 184], ['Sales', 64, C.info, 128], ['Support', 48, C.vio, 96], ['Finance', 30, C.warn, 60], ['HR', 18, C.pink, 36]].map(([l, w, c, v], i) => `<div class="r" style="--i:${i}"><span>${l}</span><div class="t"><span style="width:${w}%;--c:${c}"></span></div><span class="v">${count(v, i * 0.09)}</span></div>`).join('')}</div>`, '<b>Bars grow from the left</b>, top to bottom, and the number at the end counts up with them — so the biggest value lands last.', ['Report breakdowns', 'Top teams', 'Helpdesk by topic']),
    card('Stacked bar', 'Fill in order', `<div style="width:100%;display:flex;flex-direction:column;gap:14px"><div class="stack">${[[58, C.pri, 0], [27, C.info, 0.45], [15, '#C9C9DA', 0.8]].map(([w, c, d]) => `<span style="width:${w}%;--c:${c};--d:${d}s"></span>`).join('')}</div><div class="legend" style="flex-direction:row;gap:16px">${[['Billable', 58, C.pri, 0.2], ['Investment', 27, C.info, 0.6], ['Bench', 15, '#C9C9DA', 0.95]].map(([l, v, c, d]) => `<div style="--c:${c};--d:${d}s"><i></i>${l}<b>&nbsp;${v}%</b></div>`).join('')}</div></div>`, '<b>Each part fills after the one before</b>, like pouring — the legend item lights up as its part arrives.', ['Project billing', 'Daily present/leave/absent', 'Plan seats']),
    card('Progress meter', 'Fill + shine', `<div style="width:100%;display:flex;flex-direction:column;gap:16px">${[['Profile complete', 78], ['Milestones · 6 of 9', 66], ['Onboarding', 40]].map(([l, p]) => `<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;font-size:12px;font-weight:700"><span>${l}</span><span style="margin-left:auto">${count(p)}%</span></div><div class="meter"><span style="width:${p}%"></span></div></div>`).join('')}</div>`, '<b>Fills once, then one soft shine passes over</b> to say “done”. No looping shine — it would pull the eye forever.', ['Profile meter', 'Milestones', 'Onboarding tasks']),
    card('Sparkline', 'Quick draw', `<div style="display:flex;flex-direction:column;gap:14px;width:100%">${[['Acme Ltd', [4, 6, 5, 8, 9, 12, 14], C.ok, '+18%'], ['Globex', [9, 8, 9, 7, 6, 6, 5], C.bad, '−9%'], ['Initech', [3, 4, 4, 5, 5, 6, 6], C.pri, '+6%']].map(([n, p, c, t], i) => `<div style="display:flex;align-items:center;gap:12px;font-size:12.5px;font-weight:700"><span style="width:80px">${n}</span>${line(p, 150, 32, c, { area: false, rider: false, d: i * 0.1 })}<span style="margin-left:auto;color:${c}">${t}</span></div>`).join('')}</div>`, '<b>Tiny lines draw fast</b> (half the time of a big chart), staggered by row, so a table of them “ripples” in.', ['Super Admin companies', 'KPI tiles']),
    card('Heat strip', 'Wave', `<div class="heat">${Array.from({ length: 48 }, (_, k) => {
      const x = k % 12;
      const y = Math.floor(k / 12);
      const v = [0.15, 0.35, 0.6, 0.9][(x * 7 + y * 3) % 4];
      return `<i style="--x:${x};--y:${y};--c:color-mix(in srgb,${C.pri} ${Math.round(v * 100)}%,var(--track))"></i>`;
    }).join('')}</div>`, '<b>Cells pop in a diagonal wave</b> from the top-left corner — reads like the data is being “painted”.', ['Role access map', 'Attendance month', 'Timesheet grid']),
    card('Countdown ring', 'Drain', `<div style="display:flex;gap:26px;align-items:center">${ring(100, C.ok, 104, 10, '<b class="tick" style="font-size:18px">4h 20m</b><span class="lbl">to reply</span>', 0, 'drain')}<div style="font-size:12.5px;line-height:1.7;color:var(--mut)"><b style="color:${C.ok}">Green</b> plenty of time<br><b style="color:${C.warn}">Amber</b> under 1 hour<br><b style="color:${C.bad}">Red</b> overdue</div></div>`, '<b>The ring empties as the deadline nears</b> and warms from green to amber to red. (Sped up here — in the app it moves in real time.)', ['Helpdesk reply target', 'Asset loan due back']),
    card('Big numbers', 'Count up', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%">${[['Headcount', 248, '+12', C.ok], ['Present today', 231, '93%', C.pri], ['On leave', 12, '−3', C.ok], ['Waiting', 5, 'new', C.warn]].map(([l, v, ch, c], i) => `<div class="kpi"><span class="lbl">${l}</span><span class="big">${count(v, i * 0.08)}</span><span class="chip" style="background:color-mix(in srgb,${c} 15%,transparent);color:${c};--d:${0.45 + i * 0.08}s">${ch}</span></div>`).join('')}</div>`, '<b>Numbers roll up from 0</b> in about a second (they ease out, so they slow down before landing). The small change chip slides in after.', ['Home tiles', 'Reports KPIs', 'Super Admin overview']),
    card('Filter change', 'Morph', `<div style="display:flex;flex-direction:column;align-items:center;gap:10px"><div class="seg2"><span>This month</span><span>Last month</span></div>${bars([[110, 70], [70, 120], [130, 90], [50, 100], [96, 60]], ['Eng', 'Sales', 'Ops', 'HR', 'Fin'], { morph: true, colors: [C.pri, C.pri, C.pri, C.pri, C.pri] })}</div>`, '<b>When the data changes, bars move to the new value</b> — they don’t drop to zero and grow again. Your eye can follow what went up and what went down.', ['Every chart with a filter', 'Period switch']),
  ];
  return `<div class="wrap"><h1>Chart motion — how graphs and bars come alive</h1><p class="sub">Every chart plays its entrance <b>once</b>, when it first scrolls into view (here they replay every 6 seconds so you can watch). Charts on the same card start together; cards further down start a little later. With “Reduce motion” on, everything simply appears.</p><div class="grid">${cards.join('')}</div></div>`;
}

// ── board 2: Reports page, dark, with choreography
function reports() {
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const join = [12, 18, 9, 22, 15, 26];
  const leave = [4, 6, 3, 5, 8, 4];
  const head = [210, 222, 228, 245, 252, 274];
  const W = 560;
  const H = 210;
  const step = W / months.length;
  const hMax = 300;
  const hp = head.map((v, i) => [Math.round(step * i + step / 2), Math.round(H - 20 - (v / hMax) * (H - 30))]);
  let hPath = `M${hp[0][0]},${hp[0][1]}`;
  for (let i = 1; i < hp.length; i++) {
    const cx = (hp[i - 1][0] + hp[i][0]) / 2;
    hPath += ` C${cx},${hp[i - 1][1]} ${cx},${hp[i][1]} ${hp[i][0]},${hp[i][1]}`;
  }
  const trend = `<div style="position:relative;width:${W}px;height:${H + 20}px">
    <div style="position:absolute;left:0;right:0;bottom:20px;height:${H}px;display:flex">${months.map((m, i) => `<div style="flex:1;display:flex;align-items:flex-end;justify-content:center;gap:5px"><div class="bars" style="height:auto;gap:5px"><div class="b" style="--i:${i};--c:${C.ok};width:16px"><span style="height:${join[i] * 4}px"></span></div><div class="b" style="--i:${i};--c:${C.bad};width:16px"><span style="height:${leave[i] * 4}px"></span></div></div></div>`).join('')}</div>
    <svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible"><path class="draw" pathLength="1" d="${hPath}" fill="none" stroke="${C.vio}" stroke-width="3" stroke-linecap="round" style="--d:.35s"/>${hp.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="#181826" stroke="${C.vio}" stroke-width="2.5" class="dotpop" style="--d:${0.35 + i * 0.12}s"/>`).join('')}</svg>
    <div style="position:absolute;left:0;right:0;bottom:0;display:flex;font-size:11px;color:var(--mut)">${months.map((m) => `<span style="flex:1;text-align:center">${m}</span>`).join('')}</div>
    <div class="hover" style="left:${hp[4][0]}px;top:${hp[4][1] + 16}px"><b>Sep</b> · 15 joined · 8 left · 252 people</div>
  </div>`;
  const daily = `<div class="bars" style="gap:7px;height:180px">${Array.from({ length: 14 }, (_, i) => {
    const p = 120 - ((i * 13) % 30);
    const l = 14 + ((i * 7) % 12);
    const a = 6 + ((i * 5) % 9);
    return `<div class="b" style="--i:${i};width:22px"><div style="display:flex;flex-direction:column;width:100%;gap:2px">${[[a, C.bad], [l, C.warn], [p, C.ok]].map(([h, c]) => `<span style="height:${h}px;--c:${c};border-radius:4px"></span>`).join('')}</div><small>${i + 1}</small></div>`;
  }).join('')}</div>`;
  const kpis = [['Headcount', 274, '+26 this quarter', C.ok], ['Joined', 102, 'May – Oct', C.pri], ['Left', 30, '2.4% a month', C.bad], ['Avg. present', 91, '% of working days', C.info]];
  const tl = [
    ['Page fades in', 0, 150, '#6B6B85'],
    ['Numbers count up', 100, 1000, C.pri],
    ['Change chips slide in', 450, 300, C.pri],
    ['Bars rise (staggered)', 250, 900, C.ok],
    ['Lines draw', 350, 1300, C.vio],
    ['Donut sweeps', 300, 900, C.info],
    ['Legends + labels', 600, 400, C.warn],
  ];
  const total = 1800;
  return `<div class="wrap dark" style="padding:0"><div class="app">
    <div class="side"><div style="display:flex;align-items:center;gap:10px;padding:4px 8px 16px"><span style="width:32px;height:32px;border-radius:9px;background:${C.pri};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px">AP</span><b style="color:#fff;font-size:14px">aakash-portal</b></div>${['Home', 'My profile', 'Reports & analytics', 'People', 'Employees', 'Leave', 'Attendance', 'Projects'].map((t, i) => `<div class="it${i === 2 ? ' on' : ''}">${t}</div>`).join('')}</div>
    <div class="main">
      <div style="display:flex;align-items:flex-end;gap:16px"><div><span class="lbl">Reports</span><h1 style="margin-top:4px">People overview</h1></div><div class="fb" style="margin-left:auto"><span>Last 6 months ▾</span><span>All teams ▾</span><span>All locations ▾</span></div></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${kpis.map(([l, v, s, c], i) => `<div class="kpi"><span class="lbl">${l}</span><span class="big">${count(v, 0.1 + i * 0.08)}</span><span class="chip" style="background:color-mix(in srgb,${c} 18%,transparent);color:${c};--d:${0.45 + i * 0.08}s">${s}</span></div>`).join('')}</div>
      <div class="row">
        <div class="card" style="flex:1.4"><h3>Joiners, leavers and headcount<i>Rise + draw</i></h3>${trend}<div class="legend" style="flex-direction:row;gap:18px">${[['Joined', C.ok], ['Left', C.bad], ['Headcount', C.vio]].map(([l, c], i) => `<div style="--c:${c};--d:${0.6 + i * 0.1}s"><i></i>${l}</div>`).join('')}</div></div>
        <div class="card" style="flex:1"><h3>Who works where<i>Sweep</i></h3><div style="display:flex;align-items:center;gap:22px;padding:14px 0">${donut([['Engineering', 112, C.pri], ['Sales', 58, C.info], ['Support', 44, C.vio], ['Finance', 32, C.warn], ['HR', 28, C.pink]], 170, 22, `<b style="font-size:28px">${count(274, 0.3)}</b><span class="lbl">people</span>`)}<div class="legend" style="flex:1">${[['Engineering', 112, C.pri], ['Sales', 58, C.info], ['Support', 44, C.vio], ['Finance', 32, C.warn], ['HR', 28, C.pink]].map(([l, v, c], i) => `<div style="--c:${c};--d:${0.35 + i * 0.12}s"><i></i>${l}<b>${v}</b></div>`).join('')}</div></div></div>
      </div>
      <div class="row">
        <div class="card" style="flex:1.4"><h3>Daily attendance · October<i>Stacked bars rise</i></h3><div class="stage" style="height:210px;justify-content:flex-start">${daily}</div><div class="legend" style="flex-direction:row;gap:18px">${[['Present', C.ok], ['On leave', C.warn], ['Absent', C.bad]].map(([l, c], i) => `<div style="--c:${c};--d:${0.7 + i * 0.1}s"><i></i>${l}</div>`).join('')}</div></div>
        <div class="card" style="flex:1"><h3>Leave taken by type<i>Grow</i></h3><div class="hb" style="padding-top:10px">${[['Casual', 88, C.pri, 412], ['Sick', 54, C.info, 251], ['Earned', 40, C.vio, 186], ['WFH', 33, C.warn, 154], ['Unpaid', 9, C.bad, 41]].map(([l, w, c, v], i) => `<div class="r" style="--i:${i}"><span>${l}</span><div class="t"><span style="width:${w}%;--c:${c}"></span></div><span class="v">${count(v, i * 0.09)}</span></div>`).join('')}</div></div>
      </div>
      <div class="card"><h3>The order things move in · first 1.8 seconds<i>Choreography</i></h3><div class="tl">${tl.map(([l, s, d, c]) => `<span>${l}</span><div class="track"><span style="left:${(s / total) * 100}%;width:${(d / total) * 100}%;--c:${c}"></span></div>`).join('')}</div><div class="axis">${[0, 300, 600, 900, 1200, 1500, 1800].map((t) => `<span>${t} ms</span>`).join('')}</div></div>
    </div>
  </div></div>`;
}

const boards = [
  ['CAChartMotion.dc.html', 'Chart motion · catalogue — every chart kind and how it animates (replays every 6 s)', () => dcPage('Chart motion — catalogue', css, catalogue(), 1560), 1560],
  ['CAChartReports.dc.html', 'Chart motion · Reports page in dark mode — all charts together + the order they move in', () => dcPage('Chart motion — reports', css, reports(), 1240), 1240],
];
if (require.main === module) {
  for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
  const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
  let maxY = 0;
  for (const [f, b] of Object.entries(canvas.boards)) if (!boards.some(([x]) => x === f)) maxY = Math.max(maxY, b.y + b.h);
  const Y = Math.ceil((maxY + 700) / 100) * 100;
  boards.forEach(([f, title, , h], i) => {
    canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: Y };
    if (!canvas.order.includes(f)) canvas.order.push(f);
  });
  const id = Object.entries(canvas.notes).find(([, n]) => n.text?.startsWith('Chart motion'))?.[0] ?? `n${Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1}`;
  canvas.notes[id] = { kind: 'title1', maxW: 7600, text: 'Chart motion — catalogue of every chart kind, and the Reports page with the full choreography', w: 240, x: 0, y: Y - 300 };
  fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
  console.log('built', boards.length, 'boards at y', Y, 'note', id);
}
module.exports = { css };
