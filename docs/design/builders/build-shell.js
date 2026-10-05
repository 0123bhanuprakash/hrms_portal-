// New page content inside the EXISTING sidebar and top bar (copied from
// apps/web/src/app/(app)/layout.tsx and (super-admin)/layout.tsx), Obsidian Gold.
const fs = require('fs');
const { css, recolor, light, dark } = require('./build-gold.js');
const dir = __dirname;

// Lucide-style icons (24 grid, stroke 2), as in the app
const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2"/><circle cx="9" cy="11" r="2"/><path d="M6 16.5a3.5 3.5 0 0 1 6 0"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  contact: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v2M8 2v2"/><circle cx="12" cy="11" r="3"/><path d="M7 20a5 5 0 0 1 10 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4M12 10v2M16 10v6"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  check: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  bars: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  tags: '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.6 5.6A2 2 0 0 0 8.2 5H4a1 1 0 0 0-1 1v4.2a2 2 0 0 0 .6 1.4l5.8 5.8a2.4 2.4 0 0 0 3.4 0l3.6-3.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="6.5" cy="9.5" r=".5"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  drive: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01M10 16h.01"/>',
  buoy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>',
  headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  calcheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  usersr: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  calclock: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5M16 2v4M8 2v4M3 10h5"/><circle cx="16" cy="16" r="6"/><path d="M16 14v2.2l1.6 1"/>',
  calrange: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M3 10h18M8 2v4M17 14h-6M13 18H7M7 14h.01M17 18h.01"/>',
  caldays: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  usercog: '<circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2M21.7 16.4l-.9-.3M15.2 13.9l-.9-.3M16.6 18.7l.3-.9M19.1 12.2l.3-.9M19.6 18.7l-.4-1M16.8 12.3l-.4-1M14.3 16.6l1-.4M20.7 13.8l1-.4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  updown: '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
};
const icon = (k, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;

// [group, [name, icon, badge?, active?]]
const NAV = {
  admin: [
    ['Overview', [['Home', 'dashboard', null, true], ['My profile', 'idcard'], ['Reports & analytics', 'chart'], ['People', 'contact']]],
    ['Organization', [['Employees', 'users'], ['Organisation', 'network']]],
    ['Engagement', [['Announcements', 'megaphone', 2], ['Kudos', 'heart']]],
    ['Work', [['Projects', 'folder'], ['My timesheet', 'timer'], ['Timesheet approvals', 'check', 1], ['Hours by project', 'bars']]],
    ['Expenses', [['My expenses', 'receipt'], ['Expense approvals', 'check', 3], ['Payments & reports', 'wallet'], ['Expense categories', 'tags']]],
    ['Assets', [['My assets', 'check'], ['Asset requests', 'box', 1], ['Asset register', 'drive'], ['Asset types', 'tags']]],
    ['Helpdesk', [['My tickets', 'buoy'], ['Ticket queue', 'headset', 3], ['Ticket topics', 'tags']]],
    ['Time', [['My attendance', 'calcheck'], ['Team attendance', 'usersr'], ['Attendance approvals', 'check', 1], ['My leave', 'plane'], ['Leave approvals', 'calclock', 5], ['Who’s off', 'calrange'], ['Holidays', 'caldays'], ['Attendance settings', 'clock'], ['Leave types', 'tags']]],
    ['Administration', [['Users', 'usercog'], ['Roles & permissions', 'shield'], ['Access explorer', 'scan']]],
    ['Settings', [['Branding', 'image'], ['Theme', 'palette'], ['Delegation', 'swap'], ['Preferences', 'sliders']]],
  ],
  employee: [
    ['Overview', [['Home', 'dashboard', null, true], ['My profile', 'idcard'], ['People', 'contact']]],
    ['Engagement', [['Announcements', 'megaphone', 2], ['Kudos', 'heart']]],
    ['Work', [['Projects', 'folder'], ['My timesheet', 'timer']]],
    ['Expenses', [['My expenses', 'receipt']]],
    ['Assets', [['My assets', 'check', 1]]],
    ['Helpdesk', [['My tickets', 'buoy', 1]]],
    ['Time', [['My attendance', 'calcheck'], ['My leave', 'plane'], ['Holidays', 'caldays']]],
    ['Settings', [['Preferences', 'sliders']]],
  ],
  super: [
    ['Overview', [['Dashboard', 'dashboard', null, true]]],
    ['Tenants', [['Companies', 'building'], ['Onboard company', 'plus']]],
    ['Governance', [['Audit logs', 'file']]],
    ['Platform', [['Plans', 'layers'], ['Themes', 'palette'], ['System', 'server']]],
  ],
};

const shellCss = (t, isDark) => `<style>
.app{display:flex;flex-wrap:wrap;min-height:100vh}
.sb{flex:0 0 240px;background:${isDark ? '#0E0D0B' : '#0F0F12'};border-right:1px solid ${isDark ? '#1F1C17' : '#1E1E24'};display:flex;flex-direction:column;color:#C9C9CF;font-family:Manrope,system-ui,sans-serif}
.sb-head{height:56px;display:flex;align-items:center;gap:10px;padding:0 12px;flex:none}
.sb-logo{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#E9416A,#7A2BD9);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}
.sb-logo.plat{background:${t.gold};color:#18181B}
.sb-name{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.sb-name b{font-size:14px;font-weight:700;color:#F4F4F5}
.sb-name span{font-size:11px;color:#8B8B93}
.sb-nav{flex:1;padding:8px 12px;display:flex;flex-direction:column;gap:16px}
.sb-grp p{margin:0 0 4px;padding:0 8px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7C7C85}
.sb-grp ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:2px}
.sb-it{position:relative;display:flex;align-items:center;gap:10px;height:32px;padding:0 8px;border-radius:6px;font-size:13px;font-weight:500;color:#C9C9CF;text-decoration:none}
.sb-it svg{color:#8B8B93;flex:none}
.sb-it.on{background:${isDark ? '#1E1B16' : '#22222A'};color:#F4F4F5}
.sb-it.on svg{color:${t.gold}}
.sb-it.on::before{content:"";position:absolute;left:-12px;top:6px;bottom:6px;width:3px;border-radius:0 3px 3px 0;background:${t.gold}}
.sb-it .n{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-it .c{border-radius:99px;background:${t.gold};color:#18181B;font-size:11px;font-weight:700;line-height:16px;padding:0 6px}
.sb-foot{border-top:1px solid ${isDark ? '#1F1C17' : '#1E1E24'};padding:8px}
.sb-user{display:flex;align-items:center;gap:10px;padding:6px;border-radius:6px;width:100%;background:transparent;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
.sb-av{width:32px;height:32px;border-radius:6px;background:#F6EBD6;color:#7A4E0E;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}
.sb-user .who{flex:1;min-width:0;line-height:1.25}
.sb-user .who b{display:block;font-size:13px;font-weight:600;color:#F4F4F5}
.sb-user .who span{display:block;font-size:11px;color:#8B8B93}
.col{flex:999 1 560px;min-width:0;display:flex;flex-direction:column;background:${t.bg}}
.hdr{height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 24px;border-bottom:1px solid ${t.border};background:${t.bg};flex:none}
.crumbs{display:flex;align-items:center;gap:4px;font-size:13px;color:${t.muted}}
.crumbs b{color:${t.fg};font-weight:600}
.hbtns{display:flex;align-items:center;gap:4px}
.hbtn{width:36px;height:36px;border-radius:6px;border:0;background:transparent;color:${t.fg};display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer}
.hbtn .d{position:absolute;top:6px;right:6px;min-width:16px;height:16px;border-radius:99px;background:${t.gold};color:#18181B;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px}
.col .main{flex:1;max-width:none}
</style>`;

function sidebar(kind) {
  const plat = kind === 'super';
  const groups = NAV[kind]
    .map(([g, items]) => `<div class="sb-grp"><p>${g}</p><ul>${items
      .map(([name, ic, badge, on]) => `<li><a class="sb-it${on ? ' on' : ''}" href="#"${on ? ' aria-current="page"' : ''}>${icon(ic)}<span class="n">${name.replace('&', '&amp;')}</span>${badge ? `<span class="c" aria-label="${badge} waiting">${badge}</span>` : ''}</a></li>`)
      .join('')}</ul></div>`)
    .join('\n');
  const who = kind === 'super' ? ['SA', 'Platform owner', 'Super Admin'] : kind === 'admin' ? ['TA', 'test admin', 'admin@aakash-portal.example'] : ['NG', 'Neha Gupta', 'neha@aakash-portal.example'];
  return `<aside class="sb">
  <div class="sb-head"><span class="sb-logo${plat ? ' plat' : ''}">${plat ? 'H' : 'AP'}</span><span class="sb-name"><b>${plat ? 'HRMS Platform' : 'aakash-portal'}</b><span>${plat ? 'Super Admin console' : 'HR workspace'}</span></span></div>
  <nav class="sb-nav" aria-label="Main">${groups}</nav>
  <div class="sb-foot"><button class="sb-user"><span class="sb-av">${who[0]}</span><span class="who"><b>${who[1]}</b><span>${who[2]}</span></span>${icon('updown', 14)}</button></div>
</aside>`;
}

function header(crumb, isDark) {
  return `<header class="hdr"><nav class="crumbs" aria-label="Breadcrumb"><b>${crumb}</b></nav><div class="hbtns"><button class="hbtn" aria-label="Notifications, 3 unread">${icon('bell', 18)}<span class="d">3</span></button><button class="hbtn" aria-label="Change appearance">${icon(isDark ? 'moon' : 'sun', 18)}</button></div></header>`;
}

function content(bodyName) {
  const body = fs.readFileSync(`${dir}/${bodyName}.body.html`, 'utf8');
  const main = body.slice(body.indexOf('<main class="main">'), body.indexOf('</main>') + 7);
  return main.replace(/<div class="top">[\s\S]*?<\/div>\n/, '');
}

function page(title, kind, bodyName, crumb, t, isDark, h) {
  const html = `<div class="app">\n${sidebar(kind)}\n<div class="col">\n${header(crumb, isDark)}\n${recolor(content(bodyName), t, isDark)}\n</div>\n</div>\n`;
  const head = css(t).replace('</helmet>', `${shellCss(t, isDark)}\n</helmet>`);
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n${head}\n${html}</x-dc>\n<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":${h}}}'>\nclass Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}\n</script>\n</body>\n</html>\n`;
}

module.exports = { P, icon, NAV, shellCss, sidebar, header, content, page };
if (require.main !== module) return;
const boards = [
  ['ShellEmployeeDark', 'Employee home · current menu · dark', 'employee', 'BasicEmployee', 'Home', dark, true, 1480],
  ['ShellAdminDark', 'Company Admin home · current menu · dark', 'admin', 'BasicAdmin', 'Home', dark, true, 1900],
  ['ShellSuperDark', 'Super Admin dashboard · current menu · dark', 'super', 'BasicSuperAdmin', 'Platform', dark, true, 1240],
  ['ShellEmployeeLight', 'Employee home · current menu · light', 'employee', 'BasicEmployee', 'Home', light, false, 1480],
  ['ShellAdminLight', 'Company Admin home · current menu · light', 'admin', 'BasicAdmin', 'Home', light, false, 1900],
  ['ShellSuperLight', 'Super Admin dashboard · current menu · light', 'super', 'BasicSuperAdmin', 'Platform', light, false, 1240],
];
for (const [file, title, kind, body, crumb, t, isDark, h] of boards) fs.writeFileSync(`${dir}/project/${file}.dc.html`, page(title, kind, body, crumb, t, isDark, h));
console.log('built', boards.length);
