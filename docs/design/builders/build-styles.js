// Menu-style options (Classic = today) + personal theme screens, Obsidian Gold dark.
const fs = require('fs');
const { css, recolor, dark } = require('./build-gold.js');
const { P, icon, NAV, shellCss, sidebar, header, content } = require('./build-shell.js');
const dir = __dirname;
const t = dark;
P.chevdown = '<path d="m6 9 6 6 6-6"/>';
P.search = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';
P.grid = '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>';
P.cog = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>';

const GROUP_ICON = { Overview: 'dashboard', Organization: 'users', Engagement: 'megaphone', Work: 'folder', Expenses: 'receipt', Assets: 'box', Helpdesk: 'buoy', Time: 'calcheck', Administration: 'shield', Settings: 'cog' };
const esc = (s) => s.replace('&', '&amp;');
const sum = (items) => items.reduce((n, i) => n + (i[2] || 0), 0);
const who = '<div class="sb-foot"><button class="sb-user"><span class="sb-av">TA</span><span class="who"><b>test admin</b><span>admin@aakash-portal.example</span></span>' + icon('updown', 14) + '</button></div>';
const head = '<div class="sb-head"><span class="sb-logo">AP</span><span class="sb-name"><b>aakash-portal</b><span>HR workspace</span></span></div>';

const extraCss = `<style>
/* Compact rail */
.rail{flex:0 0 84px;background:#0E0D0B;border-right:1px solid #1F1C17;display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:4px;position:relative;font-family:Manrope,system-ui,sans-serif}
.rail .sb-logo{margin-bottom:10px}
.r-it{position:relative;width:68px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-radius:10px;color:#A9A9B1;font-size:10.5px;font-weight:600;text-decoration:none;text-align:center;line-height:1.15}
.r-it svg{color:#9A9AA2}
.r-it.on{background:#2E2414;color:#F0C985}.r-it.on svg{color:#D69E3A}
.r-it.open{background:#1E1B16;color:#F4F4F5}
.r-it .c{position:absolute;top:4px;right:10px;border-radius:99px;background:#D69E3A;color:#18181B;font-size:10px;font-weight:800;line-height:15px;padding:0 5px}
.r-sep{width:40px;height:1px;background:#26221B;margin:4px 0}
.flyout{position:absolute;left:92px;top:470px;width:236px;background:#1A1712;border:1px solid #3A3429;border-radius:12px;box-shadow:0 18px 40px -12px rgba(0,0,0,.7);padding:10px;z-index:5;display:flex;flex-direction:column;gap:2px}
.flyout p{margin:2px 8px 6px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8B8B93}
/* Floating panel */
.fl-wrap{flex:0 0 264px;padding:12px 0 12px 12px;box-sizing:border-box;background:${t.bg}}
.fl{height:100%;background:#17140F;border:1px solid #2E2921;border-radius:16px;display:flex;flex-direction:column;font-family:Manrope,system-ui,sans-serif;color:#C9C9CF;overflow:hidden}
.fl .sb-head{padding:0 14px}
.fl-search{margin:4px 12px 6px;display:flex;align-items:center;gap:8px;height:36px;border-radius:10px;background:#0F0D0A;border:1px solid #2A261F;padding:0 10px;color:#8B8B93;font-size:13px}
.fl .sb-nav{padding:8px 12px}
.fl .sb-it{border-radius:10px;height:34px}
.fl .sb-it.on{background:#2E2414;color:#F0C985}
.fl .sb-it.on::before{display:none}
.fl .sb-foot{border-top:0;padding:10px}
.fl .sb-user{background:#0F0D0A;border:1px solid #2A261F;border-radius:12px;padding:8px}
/* Collapsible groups */
.cg-h{display:flex;align-items:center;gap:10px;height:34px;padding:0 8px;border-radius:6px;font-size:13px;font-weight:600;color:#D4D4D8;background:transparent;border:0;width:100%;font-family:inherit;cursor:pointer;text-align:left}
.cg-h svg{color:#8B8B93;flex:none}
.cg-h .n{flex:1}
.cg-h .c{border-radius:99px;background:#D69E3A;color:#18181B;font-size:11px;font-weight:700;line-height:16px;padding:0 6px}
.cg-h.open{color:#F4F4F5}
.cg-items{margin:2px 0 6px 18px;padding-left:8px;border-left:1px solid #2A261F;list-style:none;display:flex;flex-direction:column;gap:2px}
.cg-items .sb-it.on::before{left:-9px}
/* Preferences */
.seg{display:inline-flex;gap:4px;padding:4px;border-radius:10px;background:${t.neuSoft};border:1px solid ${t.border};flex-wrap:wrap}
.seg button{height:36px;padding:0 14px;border-radius:7px;border:0;background:transparent;color:${t.muted};font:inherit;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.seg button.on{background:${t.surface};color:${t.fg};box-shadow:0 1px 2px rgba(0,0,0,.4)}
.themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.th{display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:10px;border:1px solid ${t.border};background:${t.surface};font:inherit;color:${t.fg};text-align:left;cursor:pointer}
.th.on{border-color:${t.gold};box-shadow:0 0 0 2px ${t.gold}55}
.th .pv{display:flex;height:54px;border-radius:7px;overflow:hidden;border:1px solid ${t.border}}
.th .pv i{display:block}
.th b{font-size:13px}
.th span{font-size:11px;color:${t.muted}}
.styles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.st{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:10px;border:1px solid ${t.border};background:${t.surface};font:inherit;color:${t.fg};text-align:left;cursor:pointer}
.st.on{border-color:${t.gold};box-shadow:0 0 0 2px ${t.gold}55}
.st .pv{height:90px;border-radius:7px;background:${t.bg};border:1px solid ${t.border};display:flex;gap:6px;padding:6px;box-sizing:border-box}
.st b{font-size:13px}.st span{font-size:11px;color:${t.muted}}
.tg{display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid ${t.line}}
.tg:first-of-type{border-top:0}
.sw{width:42px;height:24px;border-radius:99px;background:${t.gold};position:relative;flex:none;border:0}
.sw::after{content:"";position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:#18181B}
.sw.off{background:#3A3429}.sw.off::after{right:auto;left:3px;background:#8B8B93}
.chk{display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:6px 10px;border:1px solid ${t.border};border-radius:8px}
.chk i{width:14px;height:14px;border-radius:4px;background:${t.gold};display:inline-block}
.chk.off i{background:transparent;border:1px solid #5A5246}
select.inp{height:40px;border-radius:8px;border:1px solid ${t.border};background:${t.surface};color:${t.fg};font:inherit;padding:0 10px;min-width:220px}
</style>`;

function railSidebar() {
  const groups = NAV.admin;
  const items = groups.map(([g, list]) => {
    const on = g === 'Overview';
    const open = g === 'Time';
    const label = g === 'Overview' ? 'Home' : g === 'Organization' ? 'People' : g === 'Administration' ? 'Admin' : g;
    const c = sum(list) && g !== 'Overview' ? `<span class="c">${sum(list)}</span>` : g === 'Engagement' ? '' : '';
    return `<a class="r-it${on ? ' on' : ''}${open ? ' open' : ''}" href="#"${on ? ' aria-current="page"' : ''}>${icon(GROUP_ICON[g], 20)}${label}${c}</a>${g === 'Engagement' || g === 'Time' ? '<span class="r-sep"></span>' : ''}`;
  });
  const time = groups.find((g) => g[0] === 'Time')[1];
  const flyout = `<div class="flyout" role="menu" aria-label="Time"><p>Time</p>${time.map(([n, ic, b]) => `<a class="sb-it" href="#" role="menuitem">${icon(ic)}<span class="n">${esc(n)}</span>${b ? `<span class="c">${b}</span>` : ''}</a>`).join('')}</div>`;
  return `<aside class="rail" aria-label="Main"><span class="sb-logo">AP</span>${items.join('')}<span style="flex:1"></span><span class="sb-av" style="width:36px;height:36px">TA</span>${flyout}</aside>`;
}

function floatingSidebar() {
  const inner = sidebar('admin').replace('<aside class="sb">', '').replace('</aside>', '').replace('<div class="sb-head">', `<div class="sb-head">`).replace('<nav class="sb-nav"', `<div class="fl-search">${icon('search', 15)}Search menu<span style="margin-left:auto;font-size:11px">Ctrl K</span></div><nav class="sb-nav"`);
  return `<div class="fl-wrap"><aside class="fl">${inner}</aside></div>`;
}

function collapsibleSidebar() {
  const openGroups = new Set(['Overview', 'Time']);
  const groups = NAV.admin
    .map(([g, list]) => {
      const open = openGroups.has(g);
      const total = sum(list);
      const h = `<button class="cg-h${open ? ' open' : ''}" aria-expanded="${open}">${icon(GROUP_ICON[g])}<span class="n">${g}</span>${!open && total ? `<span class="c">${total}</span>` : ''}${icon(open ? 'chevdown' : 'chev', 14)}</button>`;
      const body = open ? `<ul class="cg-items">${list.map(([n, ic, b, on]) => `<li><a class="sb-it${on ? ' on' : ''}" href="#">${icon(ic)}<span class="n">${esc(n)}</span>${b ? `<span class="c">${b}</span>` : ''}</a></li>`).join('')}</ul>` : '';
      return `<div>${h}${body}</div>`;
    })
    .join('');
  return `<aside class="sb">${head}<nav class="sb-nav" aria-label="Main" style="gap:2px">${groups}</nav>${who}</aside>`;
}

function prefsContent() {
  const presets = [
    ['Company default', '#B7791F', '#0F0F12', 'Obsidian Gold', true], ['Indigo Classic', '#4F46E5', '#F4F4F5'], ['Ocean', '#0369A1', '#F4F4F5'], ['Emerald', '#047857', '#F4F4F5'],
    ['Sunset', '#C2410C', '#F4F4F5'], ['Rose', '#BE123C', '#F4F4F5'], ['Violet Studio', '#6D28D9', '#3B1A78'], ['Slate Corporate', '#334155', '#0F0F12'],
    ['High Contrast', '#1D4ED8', '#F4F4F5'], ['Aurora', '#0F766E', '#0B4440'], ['Nordic Frost', '#3B6E8F', '#F4F7FA'], ['Forest', '#166534', '#0F0F12'],
    ['Lavender Mist', '#7C3AED', '#F4F4F5'], ['Sandstone', '#9A3412', '#F4F4F5'], ['Carbon Mono', '#18181B', '#0F0F12'], ['Cobalt Pro', '#1E40AF', '#14275F'],
  ];
  const tiles = presets.map(([n, acc, side, sub, on]) => `<button class="th${on ? ' on' : ''}" aria-pressed="${Boolean(on)}"><span class="pv"><i style="width:22%;background:${side}"></i><i style="flex:1;background:#FAF8F4;display:flex;flex-direction:column;gap:5px;padding:7px"><i style="height:6px;width:60%;border-radius:3px;background:${acc}"></i><i style="height:5px;width:80%;border-radius:3px;background:#E3DED4"></i><i style="height:5px;width:50%;border-radius:3px;background:#E3DED4"></i></i></span><b>${n}</b>${sub ? `<span>${sub}</span>` : ''}</button>`).join('');
  const styleCard = (name, desc, pv, on) => `<button class="st${on ? ' on' : ''}" aria-pressed="${on}"><span class="pv">${pv}</span><b>${name}</b><span>${desc}</span></button>`;
  const line = (w) => `<i style="display:block;height:5px;width:${w};border-radius:3px;background:#3A3429"></i>`;
  const page = '<i style="flex:1;border-radius:4px;background:#15130F;border:1px solid #2A261F"></i>';
  const classic = `<i style="width:28%;border-radius:4px;background:#0E0D0B;display:flex;flex-direction:column;gap:5px;padding:6px">${line('80%')}${line('60%')}${line('70%')}${line('55%')}</i>${page}`;
  const rail = `<i style="width:12%;border-radius:4px;background:#0E0D0B;display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0">${'<i style="width:9px;height:9px;border-radius:3px;background:#5A5246;display:block"></i>'.repeat(5)}</i>${page}`;
  const floating = `<i style="width:28%;border-radius:8px;background:#1A1712;border:1px solid #3A3429;display:flex;flex-direction:column;gap:5px;padding:6px;margin:3px 0">${line('80%')}${line('60%')}${line('70%')}</i>${page}`;
  const collapsible = `<i style="width:28%;border-radius:4px;background:#0E0D0B;display:flex;flex-direction:column;gap:5px;padding:6px">${line('80%')}<i style="display:block;margin-left:6px">${line('60%')}</i>${line('70%')}${line('75%')}${line('65%')}</i>${page}`;
  return `<main class="main">
  <div class="hello row" style="justify-content:space-between;flex-wrap:wrap"><div><h1>Preferences</h1><p>How the portal looks and behaves for you. Only you see these.</p></div><div class="row" style="flex-wrap:wrap"><button class="btn ghost">Reset to company defaults</button><button class="btn primary">Save</button></div></div>

  <section class="card"><div class="ch"><h2>Appearance</h2></div>
    <div class="seg" role="group" aria-label="Appearance"><button>${icon('sun', 15)} Light</button><button class="on" aria-pressed="true">${icon('moon', 15)} Dark</button><button>System</button></div>
  </section>

  <section class="card"><div class="ch"><h2>Colour theme</h2><span class="pill ok">Your company lets you choose</span></div>
    <p class="small muted" style="margin:0">Changes colours and the menu’s look for you only. Your company’s logo and name stay the same.</p>
    <div class="themes">${tiles}</div>
  </section>

  <section class="card"><div class="ch"><h2>Menu style</h2></div>
    <div class="styles">
      ${styleCard('Classic', 'Full menu with groups — today’s menu', classic, true)}
      ${styleCard('Compact rail', 'Icons with short labels; groups open on click', rail, false)}
      ${styleCard('Floating panel', 'Rounded card beside the page, menu search', floating, false)}
      ${styleCard('Collapsible groups', 'Only the group you’re in stays open', collapsible, false)}
    </div>
  </section>

  <div class="grid">
    <section class="card"><h2>Text size</h2><div class="seg"><button>Small</button><button class="on">Medium</button><button>Large</button><button>Extra large</button></div></section>
    <section class="card"><h2>Density</h2><div class="seg"><button>Compact</button><button class="on">Normal</button><button>Spacious</button></div></section>
    <section class="card"><h2>Region</h2><div class="row" style="flex-wrap:wrap"><label class="small muted" style="display:flex;flex-direction:column;gap:6px">Time zone<select class="inp"><option>Asia/Kolkata</option></select></label><label class="small muted" style="display:flex;flex-direction:column;gap:6px">Date format<select class="inp"><option>DD/MM/YYYY · 31/12/2026</option></select></label></div></section>
  </div>
</main>`;
}

function adminThemeContent() {
  const allowed = ['Obsidian Gold', 'Indigo Classic', 'Ocean', 'Emerald', 'Slate Corporate', 'High Contrast', 'Nordic Frost', 'Forest', 'Carbon Mono', 'Cobalt Pro'];
  const notAllowed = ['Sunset', 'Rose', 'Violet Studio', 'Aurora', 'Lavender Mist', 'Sandstone'];
  return `<main class="main">
  <div class="hello row" style="justify-content:space-between;flex-wrap:wrap"><div><h1>Theme</h1><p>Your company’s look, and what employees may change for themselves.</p></div><div class="row"><button class="btn primary">Save</button></div></div>
  <section class="card"><div class="ch"><h2>Company theme</h2><a class="small" href="#">Change</a></div>
    <div class="row" style="gap:16px;flex-wrap:wrap"><span style="width:120px;height:72px;border-radius:8px;display:flex;overflow:hidden;border:1px solid ${t.border}"><i style="width:26%;background:#0F0F12"></i><i style="flex:1;background:#FAF8F4;display:flex;align-items:flex-start;padding:8px"><i style="height:8px;width:50px;border-radius:4px;background:#B7791F"></i></i></span><div><b>Obsidian Gold</b><div class="small muted">Everyone sees this unless they pick their own</div></div></div>
  </section>
  <section class="card"><div class="ch"><h2>What employees can change</h2><span class="pill neu">New</span></div>
    <div class="tg"><button class="sw" aria-label="Let employees choose their own colour theme" aria-pressed="true"></button><div style="flex:1"><b>Let employees choose their own colour theme</b><div class="small muted">From the themes ticked below. Logo and company name never change.</div></div></div>
    <div class="tg"><button class="sw" aria-label="Let employees choose their menu style" aria-pressed="true"></button><div style="flex:1"><b>Let employees choose their menu style</b><div class="small muted">Classic, Compact rail, Floating panel or Collapsible groups</div></div></div>
    <div class="tg"><span style="width:42px"></span><div style="flex:1"><b>Default menu style for everyone</b><div class="small muted">Used until someone picks their own</div></div><select class="inp"><option>Classic</option></select></div>
    <div class="tg"><button class="sw off" aria-label="Let employees switch light and dark mode" aria-pressed="false"></button><div style="flex:1"><b>Lock light / dark mode</b><div class="small muted">Off: everyone picks light, dark or system (as today)</div></div></div>
  </section>
  <section class="card"><div class="ch"><h2>Themes employees can pick</h2><span class="small muted">${allowed.length} of 16</span></div>
    <div class="row" style="flex-wrap:wrap;gap:8px">${allowed.map((n) => `<span class="chk"><i></i>${n}</span>`).join('')}${notAllowed.map((n) => `<span class="chk off"><i></i>${n}</span>`).join('')}</div>
  </section>
</main>`;
}

function page(file, title, side, crumb, main, h) {
  const headHtml = css(t).replace('</helmet>', `${shellCss(t, true)}\n${extraCss}\n</helmet>`);
  const body = `<div class="app" style="position:relative">\n${side}\n<div class="col">\n${header(crumb, true)}\n${main}\n</div>\n</div>\n`;
  fs.writeFileSync(`${dir}/project/${file}.dc.html`, `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n${headHtml}\n${body}</x-dc>\n<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":${h}}}'>\nclass Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}\n</script>\n</body>\n</html>\n`);
}

const adminHome = recolor(content('BasicAdmin'), t, true);
page('MenuClassic', 'Menu style · Classic (default)', sidebar('admin'), 'Home', adminHome, 1900);
page('MenuRail', 'Menu style · Compact rail', railSidebar(), 'Home', adminHome, 1560);
page('MenuFloating', 'Menu style · Floating panel', floatingSidebar(), 'Home', adminHome, 1940);
page('MenuCollapsible', 'Menu style · Collapsible groups', collapsibleSidebar(), 'Home', adminHome, 1560);
page('PrefsEmployee', 'Employee · Preferences with theme and menu style', sidebar('employee').replace('<a class="sb-it on" href="#" aria-current="page">', '<a class="sb-it" href="#">').replace(`<a class="sb-it" href="#">${icon('sliders')}`, `<a class="sb-it on" href="#" aria-current="page">${icon('sliders')}`), 'Settings › Preferences', prefsContent(), 1500);
page('AdminThemeChoices', 'Company Admin · Theme settings with employee choices', sidebar('admin').replace('<a class="sb-it on" href="#" aria-current="page">', '<a class="sb-it" href="#">').replace(`<a class="sb-it" href="#">${icon('palette')}`, `<a class="sb-it on" href="#" aria-current="page">${icon('palette')}`), 'Settings › Theme', adminThemeContent(), 1900);
console.log('built 6');
