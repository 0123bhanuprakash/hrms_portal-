// Company app → People directory: photo cards, team view, person quick-view.
const fs = require('fs');
const path = require('path');
const { icon, dcPage, P } = require('./build-balanced.js');
const { css: baseCss, sidebar: reportsSidebar, C } = require('./build-reports.js');
const OUT = path.join(__dirname, '..', 'canvas');

Object.assign(P, {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  pin: '<path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  layers2: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
});

const sidebar = () => reportsSidebar().replace('class="sb-i on"', 'class="sb-i"').replace(`<div class="sb-i">${icon('contact')}People</div>`, `<div class="sb-i on">${icon('contact')}People</div>`);
const header = () => `<header class="hdr"><div class="crumb">People &nbsp;›&nbsp; <b>Directory</b></div><div class="row mut xs">${icon('bell', 17)}<span style="width:34px;height:20px;border-radius:99px;background:#E5E7EF;display:inline-block"></span></div></header>`;

const css = baseCss.replace('</style>', `
.ph{position:relative;overflow:hidden;border-radius:14px;flex:none}
.ph svg{display:block}
.st{position:absolute;display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,.92);box-shadow:0 2px 6px rgba(0,0,0,.12)}
.st i{width:7px;height:7px;border-radius:50%;display:inline-block}
.pc{display:flex;flex-direction:column;overflow:hidden;transition:transform .25s,box-shadow .25s}
.pc:hover{transform:translateY(-4px);box-shadow:0 18px 36px -18px rgba(17,24,39,.35)}
.pc .body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px}
.pc b.n{font-size:15px}.pc .role{font-size:12.5px;color:${C.muted}}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:${C.raised};border:1px solid ${C.line};color:#374151}
.acts{display:flex;gap:6px;padding:0 14px 14px}
.acts span{flex:1;height:30px;border-radius:8px;border:1px solid ${C.border};display:flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:700;color:#374151}
.rail{display:flex;flex-direction:column;gap:2px;position:sticky;top:0;font-size:10.5px;font-weight:800;color:#9CA3AF;text-align:center}
.rail span{padding:1px 0}.rail span.on{color:${C.pri}}
.hlstrip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.hlc{padding:14px 16px;display:flex;align-items:center;gap:12px}
.stack{display:flex}.stack .ph{border:2.5px solid #fff;margin-left:-10px;border-radius:50%}.stack .ph:first-child{margin-left:0}
.search{display:flex;align-items:center;gap:8px;height:42px;padding:0 14px;border:1px solid ${C.border};border-radius:12px;background:#fff;flex:1;color:${C.muted};font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.wall{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}
.grp{display:flex;flex-direction:column;gap:10px}
.grp h3{margin:0;font-size:15px;display:flex;align-items:center;gap:10px}
.mini{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid ${C.line};border-radius:12px;background:#fff}
</style>`);

// "Photo" — a soft portrait illustration (stands in for real photos)
const SKIN = ['#F2C9A5', '#D9A47A', '#B87A55', '#8D5A3C', '#F5D6BC', '#C68E66'];
const HAIR = ['#2B1D14', '#4A3222', '#1C1C1C', '#6B4423', '#3B2A20', '#151515'];
const BG = [['#C7D2FE', '#EEF2FF'], ['#BBF7D0', '#ECFDF5'], ['#FDE68A', '#FFFBEB'], ['#FBCFE8', '#FDF2F8'], ['#BAE6FD', '#F0F9FF'], ['#DDD6FE', '#F5F3FF'], ['#FECACA', '#FEF2F2'], ['#A7F3D0', '#ECFDF5']];
const SHIRT = ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#0284C7', '#7C3AED', '#374151', '#059669'];
let uid = 0;
function photo(i, w, h, { round = false, long = false } = {}) {
  const id = `g${uid++}`;
  const [b1, b2] = BG[i % BG.length];
  const skin = SKIN[(i * 3) % SKIN.length], hair = HAIR[(i * 5) % HAIR.length], shirt = SHIRT[(i * 7) % SHIRT.length];
  const cx = w / 2, headR = Math.min(w, h) * 0.17, headY = h * 0.42;
  const hairShape = long
    ? `<path d="M${cx - headR * 1.15},${headY} Q${cx - headR * 1.25},${headY - headR * 1.5} ${cx},${headY - headR * 1.25} Q${cx + headR * 1.25},${headY - headR * 1.5} ${cx + headR * 1.15},${headY} L${cx + headR * 1.2},${headY + headR * 1.6} L${cx - headR * 1.2},${headY + headR * 1.6}Z" fill="${hair}"/>`
    : `<path d="M${cx - headR * 1.02},${headY - headR * 0.1} Q${cx - headR},${headY - headR * 1.35} ${cx},${headY - headR * 1.2} Q${cx + headR},${headY - headR * 1.35} ${cx + headR * 1.02},${headY - headR * 0.1} Q${cx},${headY - headR * 0.75} ${cx - headR * 1.02},${headY - headR * 0.1}Z" fill="${hair}"/>`;
  return `<div class="ph" style="width:${w}px;height:${h}px;${round ? 'border-radius:50%' : ''}"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  <circle cx="${w * 0.82}" cy="${h * 0.18}" r="${w * 0.22}" fill="#fff" opacity=".35"/>
  ${long ? hairShape : ''}
  <path d="M${cx - headR * 2.3},${h} Q${cx - headR * 2.2},${headY + headR * 1.55} ${cx},${headY + headR * 1.45} Q${cx + headR * 2.2},${headY + headR * 1.55} ${cx + headR * 2.3},${h}Z" fill="${shirt}"/>
  <rect x="${cx - headR * 0.38}" y="${headY + headR * 0.7}" width="${headR * 0.76}" height="${headR * 0.9}" fill="${skin}"/>
  <circle cx="${cx}" cy="${headY}" r="${headR}" fill="${skin}"/>
  ${long ? '' : hairShape}
  </svg></div>`;
}
const initialsTile = (ini, w, h, col) => `<div class="ph" style="width:${w}px;height:${h}px;background:linear-gradient(135deg,${col},${col}bb);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${Math.round(h * 0.28)}px">${ini}</div>`;

const PEOPLE = [
  ['Priya Sharma', 'Engineering Lead', 'Engineering', 'Bengaluru HQ', 'in', true],
  ['Karan Mehta', 'Engineering Lead', 'Engineering', 'Bengaluru HQ', 'wfh', false],
  ['Hema Iyer', 'HR Manager', 'Human Resources', 'Bengaluru HQ', 'in', true],
  ['Rahul Das', 'Sales Executive', 'Sales', 'Mumbai Office', 'leave', false],
  ['Neha Gupta', 'Software Engineer', 'Engineering', 'Bengaluru HQ', 'in', true],
  ['Vikram Rao', 'Operations Head', 'Operations', 'Bengaluru HQ', 'in', false, 'anniv'],
  ['Ananya Bose', 'Marketing Associate', 'Marketing', 'Remote', 'out', true, 'new'],
  ['Arjun Nair', 'Product Designer', 'Design', 'Bengaluru HQ', 'wfh', false, 'bday'],
  ['Meena Joshi', 'Sales Manager', 'Sales', 'Mumbai Office', 'in', true],
  ['Ravi Kumar', 'Engineering Manager', 'Engineering', 'Bengaluru HQ', 'in', false],
  ['Pooja Reddy', 'Finance Lead', 'Finance', 'Bengaluru HQ', 'leave', true],
  ['Dev Menon', 'DevOps Engineer', 'DevOps', 'Remote', 'wfh', false, 'new'],
];
const STATUS = { in: ['In office', C.ok], wfh: ['Working from home', C.info], leave: ['Away today', C.warn], out: ['Not checked in', '#9CA3AF'] };
const ini = (n) => n.split(' ').map((x) => x[0]).join('');

function card(p, i, opts = {}) {
  const [name, role, dept, loc, st, long, flag] = p;
  const [stLabel, stCol] = STATUS[st];
  const noPhoto = i === 6;
  return `<div class="card pc">
    <div style="position:relative">${noPhoto ? initialsTile(ini(name), 236, 168, C.pink) : photo(i, 236, 168, { long })}
      <span class="st" style="left:10px;bottom:10px"><i style="background:${stCol}"></i>${stLabel}</span>
      ${flag === 'bday' ? `<span class="st" style="right:10px;top:10px">🎂 Birthday today</span>` : flag === 'new' ? `<span class="st" style="right:10px;top:10px;color:${C.ok}">✦ New · 2 weeks</span>` : flag === 'anniv' ? `<span class="st" style="right:10px;top:10px;color:${C.pri}">5 years today</span>` : ''}
    </div>
    <div class="body"><b class="n">${name}</b><span class="role">${role}</span>
      <div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap"><span class="tag">${dept}</span><span class="tag">${icon('pin', 11)}${loc}</span></div></div>
    ${opts.actions !== false ? `<div class="acts"><span>${icon('mail', 13)}Email</span><span>${icon('heart', 13)}Kudos</span><span>${icon('network', 13)}Team</span></div>` : ''}
  </div>`;
}

// ─── Board 1: photo grid ────────────────────────────────────
function grid() {
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">People</div><h1>Directory</h1><div class="sub">21 colleagues · find people, see who’s in today, say thanks</div></div>
<span class="seg" style="display:inline-flex"><span class="on">${icon('grid', 13)} Cards</span><span>${icon('layers2', 13)} Teams</span><span>${icon('list', 13)} List</span></span></div>
<div class="hlstrip">
  <div class="card hlc"><div class="stack">${[6, 11].map((i) => `<div class="ph" style="width:40px;height:40px;border-radius:50%">${photo(i, 40, 40, { round: true }).replace(/^<div class="ph"[^>]*>/, '').replace(/<\/div>$/, '')}</div>`).join('')}</div><div><b style="font-size:13.5px">2 new this month</b><div class="xs mut">Ananya and Dev — say hello</div></div></div>
  <div class="card hlc"><span style="font-size:24px">🎂</span><div><b style="font-size:13.5px">Arjun’s birthday today</b><div class="xs mut">Meena’s on Friday</div></div><span class="btn sm" style="margin-left:auto">Wish</span></div>
  <div class="card hlc"><div class="stack">${[3, 10].map((i) => `<div class="ph" style="width:40px;height:40px;border-radius:50%">${photo(i, 40, 40, { round: true }).replace(/^<div class="ph"[^>]*>/, '').replace(/<\/div>$/, '')}</div>`).join('')}</div><div><b style="font-size:13.5px">3 away today</b><div class="xs mut">12 in office · 4 from home</div></div></div>
</div>
<div class="row"><div class="search">${icon('search', 16)} Search by name, role, team, skill or email…<span class="xs" style="margin-left:auto"><span style="border:1px solid ${C.border};border-radius:4px;padding:0 5px">/</span></span></div>
<span class="chip on">${icon('network', 13)}All teams ▾</span><span class="chip">${icon('pin', 13)}All locations ▾</span></div>
<div class="row" style="gap:6px">${[['Everyone', 21, true], ['In office', 12], ['From home', 4], ['Away today', 3], ['New joiners', 2], ['My team', 6]].map(([l, n, on]) => `<span class="chip ${on ? 'on' : ''}" style="height:30px;border-radius:99px">${l} <span class="mut" style="font-weight:800">${n}</span></span>`).join('')}<span class="xs mut" style="margin-left:auto">Sort: A–Z ▾</span></div>
<div style="display:flex;gap:14px">
  <div style="flex:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px">${PEOPLE.slice(0, 8).map((p, i) => card(p, i)).join('')}</div>
  <div class="rail">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `<span class="${'APRV'.includes(l) ? 'on' : ''}">${l}</span>`).join('')}</div>
</div>
</main></div></div>`;
  return dcPage('People cards', css, html, 1360);
}

// ─── Board 2: teams + list ──────────────────────────────────
function teams() {
  const groups = [
    ['Engineering', 6, C.pri, [0, 1, 4, 9, 11], 'Ravi Kumar'],
    ['Sales', 3, C.warn, [3, 8], 'Meena Joshi'],
    ['Human Resources', 2, C.teal, [2], 'Hema Iyer'],
    ['Design & Marketing', 2, C.pink, [7, 6], 'Arjun Nair'],
  ];
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">People</div><h1>Directory</h1><div class="sub">Teams view — everyone grouped by department, leads first</div></div>
<span class="seg" style="display:inline-flex"><span>${icon('grid', 13)} Cards</span><span class="on">${icon('layers2', 13)} Teams</span><span>${icon('list', 13)} List</span></span></div>
<div class="g2" style="gap:16px">
${groups.map(([g, n, col, idx, lead]) => `<div class="card sec"><h3><span style="width:10px;height:10px;border-radius:3px;background:${col}"></span>${g}<span class="pill p-neu">${n}</span><span class="r">led by <b style="color:${C.fg}">${lead}</b></span></h3>
  <div style="display:grid;grid-template-columns:repeat(${Math.max(3, idx.length)},minmax(0,1fr));gap:10px">${idx.map((i) => { const p = PEOPLE[i]; const [stLabel, stCol] = STATUS[p[4]]; return `<div style="display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center"><div style="position:relative">${i === 6 ? initialsTile(ini(p[0]), 84, 84, C.pink) : photo(i, 84, 84, { long: p[5] })}<i style="position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:50%;background:${stCol};border:2.5px solid #fff" title="${stLabel}"></i></div><b style="font-size:12.5px">${p[0].split(' ')[0]}</b><span class="xs mut" style="line-height:1.2">${p[1]}</span></div>`; }).join('')}</div>
</div>`).join('')}
</div>
<div class="card" style="overflow:hidden"><div class="row" style="padding:12px 16px;border-bottom:1px solid ${C.border}"><b style="flex:1">List view</b><span class="xs mut">compact · sortable · easy to scan on small screens</span></div>
<table><thead><tr><th>Name</th><th>Role</th><th>Team</th><th>Location</th><th>Today</th><th>Reports to</th><th></th></tr></thead><tbody>
${PEOPLE.slice(0, 6).map((p, i) => { const [stLabel, stCol] = STATUS[p[4]]; return `<tr><td><span class="row" style="gap:10px">${i === 6 ? initialsTile(ini(p[0]), 32, 32, C.pink) : photo(i, 32, 32, { long: p[5] }).replace('class="ph"', 'class="ph" style="border-radius:9px"')}<b>${p[0]}</b></span></td><td class="mut">${p[1]}</td><td>${p[2]}</td><td class="mut">${p[3]}</td><td><span class="row xs" style="gap:5px"><i style="width:8px;height:8px;border-radius:50%;background:${stCol}"></i>${stLabel}</span></td><td class="mut">${i === 9 ? '—' : 'Ravi Kumar'}</td><td class="mut">${icon('mail', 14)}</td></tr>`; }).join('')}
</tbody></table></div>
</main></div></div>`;
  return dcPage('People teams', css, html, 1300);
}

// ─── Board 3: quick view ────────────────────────────────────
function quick() {
  const p = PEOPLE[0];
  const html = `<div class="app">${sidebar()}<div class="col">${header()}<main class="main">
<div class="row" style="align-items:flex-end"><div style="flex:1"><div class="eyebrow">People</div><h1>Directory</h1><div class="sub">Click anyone for a quick look — no page change</div></div></div>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px">${PEOPLE.slice(0, 8).map((x, i) => card(x, i, { actions: false })).join('')}</div>
</main></div>
<div class="dim"></div>
<aside class="drawer" style="width:470px">
  <div style="position:relative;height:150px;background:linear-gradient(135deg,${C.pri},#8B5CF6)"><span class="btn sm" style="position:absolute;right:12px;top:12px;background:rgba(255,255,255,.9);border:0">${icon('x', 14)}</span>
    <div style="position:absolute;left:22px;bottom:-56px;border:5px solid #fff;border-radius:22px;box-shadow:0 12px 24px -10px rgba(0,0,0,.35)">${photo(0, 120, 120, { long: true })}</div></div>
  <div style="padding:66px 22px 14px"><div class="row"><b style="font-size:21px;flex:1">${p[0]}</b><span class="pill p-ok">● In office since 9:06</span></div>
    <div class="mut" style="font-size:13.5px">${p[1]} · ${p[2]}</div>
    <div class="row xs mut" style="gap:14px;margin-top:8px"><span class="row" style="gap:4px">${icon('pin', 12)}Bengaluru HQ</span><span class="row" style="gap:4px">${icon('clock', 12)}11:42 AM local</span><span>Joined Jan 2024 · 2 yrs 9 mo</span></div>
    <div class="row" style="gap:8px;margin-top:14px"><span class="btn sm pri">${icon('mail', 13)}Email</span><span class="btn sm">${icon('heart', 13)}Send kudos</span><span class="btn sm">${icon('copy', 13)}Copy email</span><span class="btn sm">Full profile ${icon('chev', 12)}</span></div></div>
  <div style="padding:6px 22px 18px;display:flex;flex-direction:column;gap:14px;overflow:hidden">
    <div><div class="xs mut" style="font-weight:800;letter-spacing:.06em;margin-bottom:8px">REPORTING LINE</div>
      <div class="mini">${photo(9, 34, 34)}<div style="flex:1"><b style="font-size:13px">Ravi Kumar</b><div class="xs mut">Engineering Manager · manager</div></div></div>
      <div style="width:2px;height:12px;background:${C.border};margin-left:26px"></div>
      <div class="mini" style="border-color:#C7C9F7;background:${C.priSoft}">${photo(0, 34, 34, { long: true })}<div style="flex:1"><b style="font-size:13px">Priya Sharma</b><div class="xs mut">you’re looking at</div></div></div>
      <div class="row" style="gap:6px;margin:8px 0 0 30px"><span class="xs mut">Leads</span><div class="stack">${[4, 1, 11].map((i) => photo(i, 30, 30, { round: true })).join('')}</div><span class="xs mut">Neha, Karan, Dev</span></div></div>
    <div><div class="xs mut" style="font-weight:800;letter-spacing:.06em;margin-bottom:8px">TEAMMATES · ENGINEERING</div><div class="row" style="gap:8px">${[1, 4, 9, 11].map((i) => `<div style="text-align:center">${photo(i, 52, 52)}<div class="xs" style="margin-top:4px">${PEOPLE[i][0].split(' ')[0]}</div></div>`).join('')}<span class="xs mut">+2</span></div></div>
    <div class="g2" style="gap:10px">${[['🎂 Birthday', '21 March'], ['🏆 Work anniversary', '15 Jan · 3 years soon'], ['💛 Kudos received', '14 · 3 this month'], ['🗓 This week', 'In Mon–Thu · leave Fri']].map(([l, v]) => `<div style="border:1px solid ${C.line};border-radius:12px;padding:10px 12px;background:${C.raised}"><div class="xs mut">${l}</div><b style="font-size:13px">${v}</b></div>`).join('')}</div>
    <div class="xs mut">Phone and personal details stay on the full profile, for people allowed to see them.</div>
  </div>
</aside></div>`;
  return dcPage('People quick view', css, html, 1300);
}

const boards = [
  ['CAPeople.dc.html', 'Company · People — photo cards, who’s in today, new / birthday / away highlights, A–Z', grid, 1360],
  ['CAPeopleTeams.dc.html', 'Company · People — teams view (photo walls by department) + compact list', teams, 1300],
  ['CAPeopleQuick.dc.html', 'Company · People — quick look: reporting line, teammates, birthday, kudos', quick, 1300],
];
if (require.main === module) {
for (const [file, , fn] of boards) fs.writeFileSync(path.join(OUT, file), fn());
const canvasPath = path.join(OUT, 'canvas.json');
const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
boards.forEach(([f, title, , h], i) => {
  canvas.boards[f] = { expand: 'fill', h, title, w: 1440, x: i * 1520, y: 15400 };
  if (!canvas.order.includes(f)) canvas.order.push(f);
});
canvas.notes.n9 = { kind: 'title1', maxW: 4480, text: 'Company · People directory — photo cards, teams, quick look', w: 240, x: 0, y: 15100 };
fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));
console.log('built', boards.map((b) => b[0]).join(', '));
}
module.exports = { css, photo, initialsTile, PEOPLE, STATUS, ini };
