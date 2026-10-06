// Seasonal theme preview: "New Year" — full Home in light and dark, sign-in page and phone.
// One concrete look so the season can be judged at real size.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { css: peopleCss, photo, PEOPLE } = require('./build-people.js');
const OUT = path.join(__dirname, '..', 'canvas');
const REMOTE = path.join(__dirname, '..', 'remote', 'canvas.json');

Object.assign(P, {
  check2: '<path d="M20 6 9 17l-5-5"/>',
  sparkles: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
  x2: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
});
const av = (i, s = 28) => photo(i, s, s, { round: true, long: PEOPLE[i % PEOPLE.length][5] });
const nm = (i) => PEOPLE[i % PEOPLE.length][0];

// New Year palette: midnight indigo, festive pink, champagne gold
const NY = { main: '#5B3DF5', pink: '#E8458B', gold: '#F5B53D', night1: '#0B0726', night2: '#2A1065', night3: '#5B1A6E' };
const THEMES = {
  light: { bg: '#F7F5FF', side: '#FFFFFF', card: '#FFFFFF', line: '#ECE8FA', border: '#E2DCF7', fg: '#1A1433', mut: '#6E6890', soft: '#EFEBFF', onSoft: '#4327D8', main: NY.main },
  dark: { bg: '#0E0B1E', side: '#141029', card: '#1A1533', line: '#2A2448', border: '#2F2852', fg: '#EEEAFF', mut: '#9C95C2', soft: '#2A2257', onSoft: '#C9BEFF', main: '#8B74FF' },
};

const css = peopleCss.replace('</style>', `
.ny{display:flex;min-height:100vh;font-family:Manrope,system-ui,sans-serif;background:var(--bg);color:var(--fg);position:relative;overflow:hidden}
.ny .sb2{flex:0 0 240px;background:var(--side);border-right:1px solid var(--border);display:flex;flex-direction:column;padding-bottom:12px}
.ny .grp{padding:12px 16px 3px;font-size:10.5px;font-weight:800;letter-spacing:.07em;color:var(--mut)}
.ny .it{display:flex;align-items:center;gap:10px;height:34px;margin:0 10px;padding:0 10px;border-radius:9px;font-size:13.5px;color:var(--mut)}
.ny .it.on{background:linear-gradient(90deg,var(--soft),transparent);color:var(--onSoft);font-weight:800;box-shadow:inset 3px 0 0 ${NY.gold}}
.ny .hdr2{height:58px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;padding:0 28px;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.ny .crd{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 2px #0000000a}
.ny .lbl2{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut)}
.ny .mut2{color:var(--mut)}
.ny .btn2{height:34px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:800;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--card);color:var(--fg)}
.ny .btn2.pri{background:linear-gradient(135deg,${NY.main},${NY.pink});border:none;color:#fff;box-shadow:0 6px 16px ${NY.main}44}
.hero{position:relative;border-radius:22px;overflow:hidden;color:#fff;padding:26px 30px;background:radial-gradient(circle at 80% 0%,${NY.night3},transparent 55%),radial-gradient(circle at 10% 100%,#3B0F5C,transparent 50%),linear-gradient(135deg,${NY.night1},${NY.night2})}
.gold{background:linear-gradient(90deg,#FFE7A8,${NY.gold},#FFD27A);-webkit-background-clip:text;background-clip:text;color:transparent}
.star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;animation:tw 2.4s ease-in-out infinite}
@keyframes tw{50%{opacity:.15;transform:scale(.6)}}
.burst{position:absolute;width:0;height:0}
.burst i{position:absolute;left:0;top:0;width:5px;height:5px;border-radius:50%;opacity:0;animation:spark 2.8s cubic-bezier(.15,.7,.3,1) infinite}
@keyframes spark{0%{transform:rotate(var(--r)) translateX(0);opacity:0}8%{opacity:1}60%{opacity:.9}100%{transform:rotate(var(--r)) translateX(var(--d)) translateY(14px);opacity:0}}
.trail{position:absolute;bottom:0;width:2px;height:60px;background:linear-gradient(transparent,#FFE7A8);opacity:0;animation:rise 2.8s ease-out infinite}
@keyframes rise{0%{transform:translateY(80px);opacity:0}10%{opacity:1}35%{transform:translateY(-60px);opacity:0}100%{opacity:0}}
.flip{display:inline-flex;flex-direction:column;align-items:center;gap:4px}
.flip b{width:52px;height:60px;border-radius:12px;background:#ffffff14;border:1px solid #ffffff26;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;font-variant-numeric:tabular-nums;position:relative;backdrop-filter:blur(4px)}
.flip b:after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:#ffffff22}
.flip span{font-size:9.5px;letter-spacing:.1em;opacity:.7}
.cf{position:absolute;top:-12px;width:7px;height:12px;border-radius:2px;animation:fall 5s linear infinite;opacity:.9}
@keyframes fall{to{transform:translateY(1100px) rotate(720deg)}}
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:99px;font-size:12px;font-weight:800}
.pop{position:absolute;right:26px;bottom:26px;width:330px;border-radius:18px;background:var(--card);border:1px solid var(--border);box-shadow:0 24px 60px #0000003a;padding:16px;display:flex;flex-direction:column;gap:10px;animation:slide .6s cubic-bezier(.2,.8,.2,1) both .6s}
@keyframes slide{from{transform:translateX(30px);opacity:0}}
.tile{border-radius:14px;padding:14px;background:var(--card);border:1px solid var(--border);position:relative;overflow:hidden}
.tile:before{content:'';position:absolute;inset:0 0 auto 0;height:3px;background:var(--c)}
.num2{font-size:28px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.row2{display:flex;align-items:center;gap:10px}
.pill2{font-size:11px;font-weight:800;padding:3px 9px;border-radius:99px}
</style>`);

const burst = (x, y, color, d = 70, delay = 0, n = 14) =>
  `<span class="burst" style="left:${x}px;top:${y}px">${Array.from({ length: n }, (_, i) => `<i style="--r:${(i / n) * 360}deg;--d:${d}px;background:${color};box-shadow:0 0 6px ${color};animation-delay:${delay}s"></i>`).join('')}</span><span class="trail" style="left:${x}px;top:${y}px;bottom:auto;animation-delay:${delay - 0.35}s"></span>`;
const stars = (n, w, h, seed = 1) =>
  Array.from({ length: n }, (_, i) => `<span class="star" style="left:${(i * 97 * seed) % w}px;top:${(i * 53 * seed) % h}px;animation-delay:${(i % 7) * 0.35}s;opacity:${0.4 + (i % 5) / 8}"></span>`).join('');
const confetti = (n, w) =>
  Array.from({ length: n }, (_, i) => `<span class="cf" style="left:${(i * 131) % w}px;background:${[NY.gold, NY.pink, NY.main, '#7DD3FC'][i % 4]};animation-delay:${(i * 0.37) % 5}s;animation-duration:${4 + (i % 4)}s"></span>`).join('');

function home(mode) {
  const t = THEMES[mode];
  const vars = Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
  const logo = `<span style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#E9416A,#7A2BD9);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;flex:none">AP</span>`;
  const sidebar = `<aside class="sb2">
    <div class="row2" style="padding:14px"><span style="position:relative">${logo}<span style="position:absolute;right:-6px;top:-8px;font-size:14px">✨</span></span><span><b style="display:block;font-size:14px">aakash-portal</b><span class="mut2" style="font-size:11px">HR workspace</span></span></div>
    <div class="grp">OVERVIEW</div>
    ${[['dashboard', 'Home', true], ['idcard', 'My profile'], ['chart', 'Reports & analytics'], ['contact', 'People']].map(([ic, l, on]) => `<div class="it${on ? ' on' : ''}">${icon(ic)}${l}</div>`).join('')}
    ${['ORGANIZATION', 'ENGAGEMENT', 'WORK', 'EXPENSES', 'ASSETS', 'HELPDESK', 'TIME', 'ADMINISTRATION', 'SETTINGS'].map((g) => `<div class="grp">${g} ›</div>`).join('')}
    <div style="margin:auto 12px 0;padding:12px;border-radius:14px;background:linear-gradient(135deg,${NY.night1},${NY.night2});color:#fff;position:relative;overflow:hidden">${stars(10, 200, 70, 3)}<b style="font-size:12px;position:relative">🎆 New Year season</b><div style="font-size:10.5px;opacity:.75;position:relative">31 Dec – 1 Jan · back to normal on 2 Jan</div></div>
  </aside>`;
  const header = `<header class="hdr2"><span class="mut2" style="font-size:13.5px">Home</span><span style="flex:1"></span>
    <span class="chip" style="background:linear-gradient(90deg,${NY.gold}26,${NY.pink}22);color:${mode === 'dark' ? '#FFD27A' : '#9A5B00'}">🎆 Happy New Year</span>
    <span class="mut2">${icon('search', 17)}</span><span class="mut2" style="position:relative">${icon('bell', 18)}<i style="position:absolute;right:-2px;top:-2px;width:8px;height:8px;border-radius:50%;background:${NY.pink}"></i></span>
    <span style="width:38px;height:22px;border-radius:99px;background:${mode === 'dark' ? NY.main : '#E2DCF7'};position:relative"><i style="position:absolute;top:3px;${mode === 'dark' ? 'right' : 'left'}:3px;width:16px;height:16px;border-radius:50%;background:#fff"></i></span>
    ${av(2, 32)}</header>`;

  const hero = `<div class="hero">
    ${stars(46, 1100, 260)}
    ${burst(640, 60, NY.gold, 70, 0.2)}${burst(740, 150, NY.pink, 55, 1.1)}${burst(590, 170, '#7DD3FC', 45, 1.9, 12)}${burst(720, 40, '#FFFFFF', 40, 2.4, 10)}
    <div style="position:relative;display:flex;gap:30px;align-items:center">
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">
        <span class="chip" style="background:#ffffff1a;color:#FFE7A8;align-self:flex-start">${icon('sparkles', 13)} Thursday, 31 December</span>
        <div style="font-size:40px;font-weight:900;letter-spacing:-.03em;line-height:1.05">Happy New Year <span class="gold">2027</span> ✨</div>
        <div style="font-size:14.5px;opacity:.85;max-width:520px">From all of us at Aakash — thank you for a wonderful 2026, Hema. Here’s to an even better year together.</div>
        <div class="row2" style="gap:8px;margin-top:6px;flex-wrap:wrap">
          ${[['🎉', '38 new joiners'], ['💜', '1,240 kudos'], ['⏰', '96% on time'], ['🏖️', '3,410 leave days enjoyed']].map(([e, l]) => `<span class="chip" style="background:#ffffff14;border:1px solid #ffffff22;color:#fff">${e} ${l}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 18px;border-radius:18px;background:#ffffff0d;border:1px solid #ffffff1f">
        <span style="font-size:11px;letter-spacing:.12em;opacity:.75">COUNTDOWN TO 2027</span>
        <div class="row2" style="gap:8px">${[['13', 'HRS'], ['42', 'MIN'], ['08', 'SEC']].map(([v, l], i) => `${i ? '<b style="font-size:24px;opacity:.5">:</b>' : ''}<span class="flip"><b>${v}</b><span>${l}</span></span>`).join('')}</div>
        <span class="btn2 pri" style="height:30px;font-size:12px;margin-top:4px">${icon('gift', 13)} Send a New Year wish</span>
      </div>
    </div>
  </div>`;

  const tiles = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
    ${[['Present today', '182', '/ 495', NY.main], ['On leave', '64', 'holiday week', NY.pink], ['Waiting for you', '7', 'approvals', NY.gold], ['Kudos this week', '86', '+24 for New Year', '#22C55E']].map(([l, v, s, c]) => `<div class="tile" style="--c:linear-gradient(90deg,${c},${c}66)"><div class="lbl2">${l}</div><div class="row2" style="align-items:baseline;gap:6px"><span class="num2" style="color:${c}">${v}</span><span class="mut2" style="font-size:12px">${s}</span></div></div>`).join('')}
  </div>`;

  const waiting = `<div class="crd" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    <div class="row2"><b style="font-size:15px;flex:1">Waiting for your approval</b><span class="pill2" style="background:${NY.gold}26;color:${mode === 'dark' ? '#FFD27A' : '#9A5B00'}">7</span></div>
    ${[[0, 'Priya Sharma', 'Casual leave · 1 – 2 Jan', 'Leave'], [5, 'Vikram Rao', 'Cab to office party · ₹640', 'Expense'], [3, 'Rahul Das', 'Missed check-out · 30 Dec', 'Attendance']].map(([i, n, d, k]) => `<div class="row2" style="padding:10px;border-radius:12px;border:1px solid var(--line)">${av(i, 34)}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="mut2" style="font-size:12px">${d}</div></div><span class="pill2" style="background:var(--soft);color:var(--onSoft)">${k}</span><span class="btn2" style="height:30px">Review</span></div>`).join('')}
  </div>`;

  const week = `<div class="crd" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    <div class="row2"><b style="font-size:15px;flex:1">My week</b><span class="mut2" style="font-size:12px">28 Dec – 3 Jan</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">
      ${[['MON', 28, 'Present'], ['TUE', 29, 'Present'], ['WED', 30, 'WFH'], ['THU', 31, 'Today'], ['FRI', 1, '🎆 Holiday'], ['SAT', 2, 'Off'], ['SUN', 3, 'Off']].map(([d, n, s]) => {
        const today = s === 'Today', hol = s.includes('Holiday');
        return `<div style="border-radius:12px;padding:8px 4px;text-align:center;border:1px solid ${today ? NY.main : 'var(--line)'};background:${hol ? `linear-gradient(160deg,${NY.night1},${NY.night2})` : today ? 'var(--soft)' : 'transparent'};color:${hol ? '#FFE7A8' : 'inherit'}"><div style="font-size:9.5px;font-weight:800;opacity:.7">${d}</div><b style="font-size:17px">${n}</b><div style="font-size:9.5px;font-weight:700;opacity:.85">${s}</div></div>`;
      }).join('')}
    </div>
  </div>`;

  const celebrations = `<div class="crd" style="padding:16px;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden">
    <div class="row2"><b style="font-size:15px;flex:1">🎉 Starting the year with us</b></div>
    ${[[6, 'Ananya Bose', 'Joins 1 Jan · Design'], [9, 'Ravi Kumar', 'Joins 4 Jan · Engineering'], [7, 'Arjun Nair', '5 years at Aakash · 2 Jan']].map(([i, n, d]) => `<div class="row2">${av(i, 32)}<div style="flex:1"><b style="font-size:13px">${n}</b><div class="mut2" style="font-size:12px">${d}</div></div><span class="btn2" style="height:28px;font-size:12px">👋 Welcome</span></div>`).join('')}
  </div>`;

  const whosoff = `<div class="crd" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    <div class="row2"><b style="font-size:15px;flex:1">Who’s off for the holidays</b><span class="mut2" style="font-size:12px">64 people</span></div>
    <div class="row2" style="gap:0">${[0, 1, 2, 3, 4, 5, 6, 8].map((i, k) => `<span style="margin-left:${k ? -8 : 0}px;border:2px solid var(--card);border-radius:50%;display:inline-flex">${av(i, 32)}</span>`).join('')}<span class="mut2" style="margin-left:8px;font-size:12px">+56</span></div>
    <div style="height:8px;border-radius:99px;background:var(--line);overflow:hidden"><i style="display:block;height:100%;width:13%;background:linear-gradient(90deg,${NY.pink},${NY.gold})"></i></div>
    <div class="mut2" style="font-size:12px">13% of the company is away · Engineering most</div>
  </div>`;

  const popup = `<div class="pop">
    <div class="row2"><span style="font-size:28px">🎆</span><div style="flex:1"><b style="font-size:13.5px">New Year is on for everyone</b><div class="mut2" style="font-size:12px">31 Dec – 1 Jan · then back to normal</div></div><span class="mut2">${icon('x2', 14)}</span></div>
    <div class="row2" style="gap:8px"><span class="btn2 pri" style="flex:1;justify-content:center">Keep it ✨</span><span class="btn2" style="flex:1;justify-content:center;font-size:12px">Switch back to my theme</span></div>
  </div>`;

  return `<div class="ny" style="${vars}">${sidebar}
    <div style="flex:1;display:flex;flex-direction:column;min-width:0;position:relative">
      ${confetti(26, 1180)}
      ${header}
      <main style="padding:24px 28px 40px;display:flex;flex-direction:column;gap:16px;position:relative">
        ${hero}
        ${tiles}
        <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:16px">
          <div style="display:flex;flex-direction:column;gap:16px">${waiting}${week}</div>
          <div style="display:flex;flex-direction:column;gap:16px">${celebrations}${whosoff}</div>
        </div>
      </main>
      ${popup}
    </div>
  </div>`;
}

function signin() {
  const t = THEMES.light;
  const vars = Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
  const phone = (mode) => {
    const p = THEMES[mode];
    return `<div style="width:300px;height:620px;border-radius:40px;border:10px solid #0B0B12;background:${p.bg};overflow:hidden;position:relative;color:${p.fg};font-family:Manrope,sans-serif">
      <div style="padding:14px 14px 8px;display:flex;align-items:center;gap:8px"><span style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#E9416A,#7A2BD9)"></span><b style="font-size:12px;flex:1">aakash-portal</b><span style="font-size:14px">🎆</span></div>
      <div style="margin:0 12px;border-radius:18px;padding:16px;color:#fff;position:relative;overflow:hidden;background:radial-gradient(circle at 80% 0%,${NY.night3},transparent 60%),linear-gradient(135deg,${NY.night1},${NY.night2})">${stars(18, 260, 150, 2)}${burst(210, 40, NY.gold, 45, 0.3, 12)}<div style="position:relative;font-size:22px;font-weight:900;line-height:1.1">Happy New Year <span class="gold">2027</span> ✨</div><div style="position:relative;font-size:11px;opacity:.85;margin-top:6px">Thank you for a wonderful 2026</div><div class="row2" style="position:relative;gap:5px;margin-top:10px">${['13', '42', '08'].map((v) => `<b style="width:34px;height:38px;border-radius:9px;background:#ffffff18;display:flex;align-items:center;justify-content:center;font-size:17px">${v}</b>`).join('')}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px">${[['Present', '182', NY.main], ['Waiting', '7', NY.gold]].map(([l, v, c]) => `<div style="border-radius:14px;padding:10px;background:${p.card};border:1px solid ${p.border}"><div style="font-size:9.5px;color:${p.mut};font-weight:800">${l.toUpperCase()}</div><b style="font-size:22px;color:${c}">${v}</b></div>`).join('')}</div>
      <div style="margin:0 12px;border-radius:14px;padding:10px;background:${p.card};border:1px solid ${p.border};display:flex;flex-direction:column;gap:8px">${[0, 5].map((i) => `<div class="row2" style="gap:8px">${av(i, 26)}<div style="flex:1;font-size:11px"><b>${nm(i)}</b></div><span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${p.soft};color:${p.onSoft};font-weight:800">Review</span></div>`).join('')}</div>
      <div style="position:absolute;left:10px;right:10px;bottom:14px;border-radius:16px;padding:12px;background:${p.card};border:1px solid ${p.border};box-shadow:0 14px 30px #0000003a"><b style="font-size:12px">🎆 New Year is on for everyone</b><div class="row2" style="gap:6px;margin-top:8px"><span style="flex:1;text-align:center;font-size:11px;font-weight:800;padding:7px;border-radius:9px;color:#fff;background:linear-gradient(135deg,${NY.main},${NY.pink})">Keep it ✨</span><span style="flex:1;text-align:center;font-size:10.5px;font-weight:800;padding:7px;border-radius:9px;border:1px solid ${p.border}">My theme</span></div></div>
      ${confetti(10, 280)}
    </div>`;
  };
  return `<div style="${vars};display:grid;grid-template-columns:1fr auto auto;gap:28px;padding:28px;background:#EEEAF8;min-height:100vh;font-family:Manrope,system-ui,sans-serif;align-items:start">
    <div style="display:flex;flex-direction:column;gap:10px"><b style="font-size:13px;color:#4C4670">SIGN-IN PAGE · NEW YEAR</b>
    <div style="height:620px;border-radius:22px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 75% 15%,${NY.night3},transparent 50%),radial-gradient(circle at 15% 90%,#3B0F5C,transparent 45%),linear-gradient(135deg,${NY.night1},${NY.night2})">
      ${stars(70, 820, 620, 1)}${burst(640, 120, NY.gold, 90, 0.2)}${burst(160, 180, NY.pink, 70, 1.2)}${burst(700, 420, '#7DD3FC', 60, 2, 12)}${burst(120, 470, NY.gold, 55, 2.6, 12)}${confetti(18, 820)}
      <div style="position:absolute;left:40px;top:40px;color:#fff"><div style="font-size:34px;font-weight:900;line-height:1.05">Welcome to <span class="gold">2027</span> ✨</div><div style="opacity:.75;margin-top:6px;font-size:14px">Happy New Year from all of us at Aakash</div></div>
      <div style="position:relative;width:340px;background:#fff;border-radius:20px;padding:26px;display:flex;flex-direction:column;gap:12px;box-shadow:0 30px 80px #0006;margin-top:80px">
        <div class="row2"><span style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#E9416A,#7A2BD9);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px">AP</span><b style="font-size:16px">aakash-portal</b></div>
        <b style="font-size:20px;color:#1A1433">Good to see you 👋</b>
        ${['Email', 'Password'].map((l) => `<div><div style="font-size:12px;font-weight:800;color:#1A1433;margin-bottom:5px">${l}</div><div style="height:40px;border-radius:10px;border:1px solid #E2DCF7;background:#FAF9FF"></div></div>`).join('')}
        <div style="height:42px;border-radius:11px;background:linear-gradient(135deg,${NY.main},${NY.pink});color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px ${NY.main}55">Sign in</div>
      </div>
    </div></div>
    <div style="display:flex;flex-direction:column;gap:10px"><b style="font-size:13px;color:#4C4670">PHONE · LIGHT</b>${phone('light')}</div>
    <div style="display:flex;flex-direction:column;gap:10px"><b style="font-size:13px;color:#4C4670">PHONE · DARK</b>${phone('dark')}</div>
  </div>`;
}

const boards = [
  ['CANewYearLight.dc.html', 'Seasonal preview · New Year — Home, light mode (real size)', () => dcPage('New Year — light', css, home('light'), 1100), 1100],
  ['CANewYearDark.dc.html', 'Seasonal preview · New Year — Home, dark mode (real size)', () => dcPage('New Year — dark', css, home('dark'), 1100), 1100],
  ['CANewYearSignin.dc.html', 'Seasonal preview · New Year — sign-in page + phone (light & dark)', () => dcPage('New Year — sign-in', css, signin(), 700), 700],
];
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvas = JSON.parse(fs.readFileSync(fs.existsSync(REMOTE) ? REMOTE : path.join(OUT, 'canvas.json'), 'utf8'));
// Place right under the seasonal row
const season = Object.entries(canvas.boards).filter(([f]) => f.startsWith('CASeason'));
const baseY = season.length ? Math.max(...season.map(([, b]) => b.y + b.h)) + 500 : 0;
let maxY = 0;
for (const [f, b] of Object.entries(canvas.boards)) if (!boards.some(([x]) => x === f)) maxY = Math.max(maxY, b.y + b.h);
const Y = Math.max(baseY, Math.ceil((maxY + 700) / 100) * 100);
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: Y };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
const id = Object.entries(canvas.notes).find(([, n]) => n.text?.startsWith('Seasonal preview · New Year'))?.[0] ?? `n${Math.max(...Object.keys(canvas.notes).map((k) => +k.slice(1))) + 1}`;
canvas.notes[id] = { kind: 'title1', maxW: 7600, text: 'Seasonal preview · New Year — Home light, Home dark, sign-in page + phone', w: 240, x: 0, y: Y - 300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('built', boards.length, 'boards at y', Y, 'note', id);
