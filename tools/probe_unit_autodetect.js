// 验证：多坐标系数值输入框的自动检测——
//  输入 notex:0.8 → 单位下拉自动切到 NoteX、数值取 0.8 并直接写入（不换算）；
//  纯数字沿用当前单位；非法输入还原为当前值。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_uad_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_uad_proj_'));
const OUT = path.join(__dirname, 'probe_unit_autodetect_out.json');
const PROG = path.join(__dirname, '_uad_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: 0, id, tick: 480 + id * 480, x: 0.5,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});
fs.writeFileSync(path.join(TMP, 'chart.txt'), MINI_CHART);
fs.writeFileSync(path.join(TMP, 'm.ogg'), 'x');
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 't', title: 'T',
  music: { path: 'm.ogg' },
  charts: [{ type: 'easy', path: 'chart.txt' }]
}));
const CTR = path.join(TMP, 'Proj.ctr');
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'Proj',
  files: { music: 'm.ogg', chart: 'chart.txt', storyboard: 'sb.json' }
}));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null;
const js = (code) => win.webContents.executeJavaScript(code);
const fieldOf = (axis) => js(`(() => {
  const rows = [...document.querySelectorAll('#stateForm .field')];
  const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === ${JSON.stringify(axis)});
  return {
    input: row.querySelector('input'),
    sel: row.querySelector('select.unit')
  };
})()`);

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2000));
  prog('ready');
  win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};
  const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  await js(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
    return true;
  })()`);
  await sleep(700);

  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr_u', path: 'octa.png', time: 0, x: 'stagex:1', y: 'stagey:2',
      opacity: 1, states: [{ time: 2, x: 'stagex:0.5' }]
    });
    window.__sb.selectObject('spr_u', null);
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(400);

  // 1) X 输入 notex:0.8 → 单位下拉切到 notex，数值 0.8 直接写入
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const input = row.querySelector('input');
    const sel = row.querySelector('select.unit');
    input.value = 'notex:0.8';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { selBefore: sel.value };
  })()`);
  await sleep(400);
  R.afterPrefixed = await js(`(() => {
    const S = window.__sb.state;
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const sel = row.querySelector('select.unit');
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_u');
    return { x: obj.x, sel: sel.value };
  })()`);

  // 2) 纯数字沿用当前单位（notex）
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const input = row.querySelector('input');
    input.value = '0.5';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterPlain = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_u');
    return { x: obj.x };
  })()`);

  // 3) 非法输入 → 还原为当前值
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const input = row.querySelector('input');
    input.value = 'abc';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterInvalid = await js(`(() => {
    const S = window.__sb.state;
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const input = row.querySelector('input');
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_u');
    return { x: obj.x, inputValue: input.value };
  })()`);

  // 4) Y 输入 notey:0.6 → 直接写入
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const row = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'Y');
    const input = row.querySelector('input');
    input.value = 'notey:0.6';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterY = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_u');
    return { y: obj.y };
  })()`);

  const out = { R };
  out.ok = !!(
    R.afterPrefixed && R.afterPrefixed.x === 'notex:0.8' && R.afterPrefixed.sel === 'notex' &&
    R.afterPlain && R.afterPlain.x === 'notex:0.5' &&
    R.afterInvalid && R.afterInvalid.x === 'notex:0.5' && R.afterInvalid.inputValue === '0.5' &&
    R.afterY && R.afterY.y === 'notey:0.6'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('UNIT_AUTODETECT:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
