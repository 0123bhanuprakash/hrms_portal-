// Builds Obsidian Gold versions (light + one dark) of the "today's features" boards.
const fs = require('fs');
const dir = __dirname;

const css = (t) => `<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:${t.bg}}
a{color:${t.link}}a:hover{color:${t.linkHover}}
.app{font-family:Manrope,system-ui,sans-serif;color:${t.fg};display:flex;flex-wrap:wrap;min-height:100vh;background:${t.bg}}
.side{flex:1 1 232px;max-width:248px;background:${t.side};padding:20px 14px;box-sizing:border-box;display:flex;flex-direction:column;gap:4px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;padding:4px 8px 18px;color:#F5F1E8}
.logo{width:30px;height:30px;border-radius:8px;background:${t.gold};color:#18181B;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
.grp{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8E8E96;padding:14px 10px 6px}
.nav{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;font-size:14px;color:#C4C4CC;text-decoration:none}
.nav.on{background:${t.sideActive};color:#F5F1E8;font-weight:700;box-shadow:inset 3px 0 0 ${t.gold}}
.nav .cnt{margin-left:auto;background:${t.gold};color:#18181B;border-radius:99px;font-size:11px;font-weight:800;padding:1px 7px}
.main{flex:999 1 560px;min-width:0;padding:24px 28px 40px;box-sizing:border-box;display:flex;flex-direction:column;gap:20px}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.search{flex:1 1 280px;max-width:460px;display:flex;align-items:center;gap:8px;background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:0 12px;height:42px;color:${t.muted};font-size:14px}
.search input{border:0;outline:0;font:inherit;flex:1;background:transparent;color:${t.fg}}
.iconbtn{width:44px;height:44px;border-radius:8px;border:1px solid ${t.border};background:${t.surface};display:flex;align-items:center;justify-content:center;color:${t.fg};cursor:pointer;position:relative}
.dot{position:absolute;top:9px;right:10px;width:8px;height:8px;border-radius:50%;background:${t.gold};border:2px solid ${t.surface}}
.avatar{width:40px;height:40px;border-radius:50%;background:${t.goldSoft};color:${t.goldText};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex:none}
.av-s{width:32px;height:32px;font-size:12px}
.hello h1{margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em}
.hello p{margin:4px 0 0;color:${t.muted};font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.card{background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;min-width:0;box-shadow:${t.shadow}}
.card h2{margin:0;font-size:16px;font-weight:800}
.ch{display:flex;align-items:center;justify-content:space-between;gap:8px}
.muted{color:${t.muted}}
.small{font-size:13px}
.pill{display:inline-flex;align-items:center;gap:6px;border-radius:6px;font-size:12px;font-weight:700;padding:3px 9px}
.ok{background:${t.okSoft};color:${t.ok}}.warn{background:${t.warnSoft};color:${t.warn}}.bad{background:${t.badSoft};color:${t.bad}}.info{background:${t.goldSoft};color:${t.goldText}}.neu{background:${t.neuSoft};color:${t.neu}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 18px;border-radius:8px;font:inherit;font-weight:800;font-size:14px;border:1px solid transparent;cursor:pointer;text-decoration:none}
.primary{background:${t.gold};color:#18181B}.ghost{background:${t.surface};border-color:${t.borderStrong};color:${t.fg}}
.big{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1}
.row{display:flex;align-items:center;gap:12px}
.list{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.li{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid ${t.line}}
.li:first-child{border-top:0}
.ico{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.qa{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.qa a{display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid ${t.border};border-radius:8px;background:${t.surface};text-decoration:none;color:${t.fg};font-weight:800;font-size:14px;min-height:44px}
.qa a span{font-weight:500;font-size:12px;color:${t.muted}}
.bars{display:flex;align-items:flex-end;gap:10px;height:96px}
.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:${t.muted}}
.bar i{display:block;width:100%;max-width:34px;border-radius:4px 4px 2px 2px;background:${t.gold}}
.meter{height:8px;border-radius:99px;background:${t.track};overflow:hidden}
.meter b{display:block;height:100%;border-radius:99px}
th{color:${t.muted}!important}
</style>
</helmet>`;

const light = {
  bg: '#FAF8F4', surface: '#FFFFFF', border: '#E7E1D6', borderStrong: '#D9D0BF', line: '#EFEAE0', track: '#F0EBE1',
  fg: '#18181B', muted: '#6B6B73', link: '#8A5A12', linkHover: '#6E470C',
  side: '#0F0F12', sideActive: '#22222A', gold: '#B7791F', goldSoft: '#F6EBD6', goldText: '#7A4E0E',
  ok: '#157A4B', okSoft: '#E4F3EA', warn: '#8A5200', warnSoft: '#FBEFD9', bad: '#B42318', badSoft: '#FCE7E4', neu: '#4A4A52', neuSoft: '#F0EDE7',
  shadow: '0 1px 2px rgba(24,24,27,.04), 0 6px 18px -8px rgba(24,24,27,.12)',
};
const dark = {
  bg: '#0B0A08', surface: '#15130F', border: '#2A261F', borderStrong: '#3A3429', line: '#221F19', track: '#26221B',
  fg: '#EDEDEF', muted: '#A9A59C', link: '#E2B66B', linkHover: '#F0C985',
  side: '#100E0B', sideActive: '#1E1B16', gold: '#D69E3A', goldSoft: '#2E2414', goldText: '#E8BD6E',
  ok: '#5FD39B', okSoft: '#12291D', warn: '#F2B65A', warnSoft: '#2E2210', bad: '#FF8A7A', badSoft: '#341714', neu: '#C9C5BC', neuSoft: '#221F19',
  shadow: '0 1px 2px rgba(0,0,0,.5), 0 8px 24px -10px rgba(0,0,0,.6)',
};

// Inline colours in the board bodies → the theme's
function recolor(body, t, isDark) {
  const map = [
    ['#2F5BEA', t.gold], ['#1E44C4', t.goldText], ['#C9D5FB', isDark ? '#5A4521' : '#E8D3A8'], ['#8FA8F5', isDark ? '#7A5C29' : '#D9B472'],
    ['#7A5AF8', isDark ? '#5EB8B0' : '#2C7A7B'], ['#E7A030', isDark ? '#FF8A5C' : '#D9622B'], ['#C9CED6', isDark ? '#4A453C' : '#CFC8BA'],
    ['#157A4B', t.ok], ['#C2560C', isDark ? '#FF8A5C' : '#C2560C'], ['#8A5200', t.warn], ['#B42318', t.bad],
    ['#EEF0F3', t.line], ['#141821', isDark ? t.fg : '#18181B'], ['#26304A', t.sideActive], ['#C9CED6', '#C4C4CC'],
    ['font-family="Figtree"', 'font-family="Manrope"'],
  ];
  let s = body;
  for (const [a, b] of map) s = s.split(a).join(b);
  // Super Admin sidebar inline styles: keep near-black, let the theme CSS colour the links
  s = s.replace(/<nav class="side" aria-label="Main" style="[^"]*">/, '<nav class="side" aria-label="Main">')
    .replace(/<div class="brand" style="color:#fff">/, '<div class="brand">')
    .replace(/<a class="nav on" href="#" style="[^"]*">/g, '<a class="nav on" href="#">')
    .replace(/<a class="nav" href="#" style="color:[^"]*">/g, '<a class="nav" href="#">')
    .replace(/<span class="cnt" style="[^"]*">/g, '<span class="cnt">');
  return s;
}

function page(title, theme, body, h, isDark) {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n${css(theme)}\n${recolor(body, theme, isDark)}</x-dc>\n<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":${h}}}'>\nclass Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}\n</script>\n</body>\n</html>\n`;
}

module.exports = { css, recolor, light, dark };
if (require.main !== module) return;
const read = (n) => fs.readFileSync(`${dir}/${n}.body.html`, 'utf8');
const out = [
  ['GoldEmployee', 'Employee home · Obsidian Gold', light, read('BasicEmployee'), 1480, false],
  ['GoldAdmin', 'Company Admin home · Obsidian Gold', light, read('BasicAdmin'), 1520, false],
  ['GoldSuperAdmin', 'Super Admin overview · Obsidian Gold', light, read('BasicSuperAdmin'), 1240, false],
  ['GoldEmployeeDark', 'Employee home · Obsidian Gold dark', dark, read('BasicEmployee'), 1480, true],
];
for (const [n, title, t, body, h, isDark] of out) fs.writeFileSync(`${dir}/project/${n}.dc.html`, page(title, t, body, h, isDark));
console.log('built', out.map((o) => o[0]).join(', '));
