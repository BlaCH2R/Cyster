// 复现“拖动 sprite 创建对象 → XY 显示未设置 → 修改跳值/失败”：
//  - 拖入创建的 sprite 的 x/y 是对象形式 {unit:'notex', value:n}
//  - 属性面板 Schema.unitFromJson 把对象形式误解析为 NaN → 输入框空 + “未设置”
//  - 修改 x 时单元下拉显示 stagex（误判）→ 触发单位换算路径 → 跳到不相关值
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dsu_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dsu_proj_'));
const OUT = path.join(__dirname, 'probe_drop_sprite_unit_out.json');
const PROG = path.join(__dirname, '_dsu_progress.log');
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

  // 直接注入与 addSpriteFromDrop 相同的对象形式 x/y，并选中刷新属性面板。
  R.injected = await js(`(() => {
    try {
      const S = window.__sb.state;
      const t = window.__sb.preview.time;
      const id = 'sprite_drop';
      S.storyboard.sprites.push({
        id, path: 'octa.png', time: t,
        x: { unit: 'notex', value: 0.42 },
        y: { unit: 'notey', value: 0.38 },
        opacity: 1, layer: 0, order: 0, preserve_aspect: true,
        states: [{ time: t + 3 }]
      });
      window.__sb.selectObject(id, null);
      window.__sb.refreshAll();
      return { t, stored: JSON.parse(JSON.stringify(S.storyboard.sprites.find((o) => o.id === id))) };
    } catch (err) {
      return { err: String(err && err.stack || err) };
    }
  })()`);
  await sleep(400);

  R.panel = await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const xRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const yRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'Y');
    const num = (row) => row ? row.querySelector('input[type=number]') : null;
    const sel = (row) => row ? row.querySelector('select.unit') : null;
    return {
      xValue: num(xRow) ? num(xRow).value : null,
      xPlaceholder: num(xRow) ? num(xRow).placeholder : null,
      xUnit: sel(xRow) ? sel(xRow).value : null,
      yValue: num(yRow) ? num(yRow).value : null,
      yUnit: sel(yRow) ? sel(yRow).value : null,
      interpHint: !!document.querySelector('.interp-hint')
    };
  })()`);

  // 修改 X：输入 0.5 并触发 change（等价于用户输入后回车）
  R.editX = await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const xRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'X');
    const input = xRow.querySelector('input[type=number]');
    input.value = '0.5';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterX = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'sprite_drop');
    return { x: obj && obj.x, y: obj && obj.y, opacity: obj && obj.opacity };
  })()`);

  // 修改其它字段（不透明度 0.6）：验证是否落盘到对象
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const opRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === '不透明度');
    const input = opRow.querySelector('input[type=number]');
    input.value = '0.6';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterOpacity = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'sprite_drop');
    return { opacity: obj && obj.opacity, x: obj && obj.x };
  })()`);

  const out = { R };
  out.ok = !!(
    R.panel && R.panel.xValue === '0.42' && R.panel.xUnit === 'notex' &&
    R.panel.yValue === '0.38' && R.panel.yUnit === 'notey' &&
    R.panel.interpHint === false &&
    R.afterX && R.afterX.x === 'notex:0.5' &&
    R.afterX.y && R.afterX.y.unit === 'notey' &&
    R.afterOpacity && R.afterOpacity.opacity === 0.6 && R.afterOpacity.x === 'notex:0.5'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('DSU:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
