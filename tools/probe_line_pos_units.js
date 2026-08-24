// 验证 line 端点坐标系的规范版支持：
//  - 每轴有单位下拉（x/y/z 默认 notex/notey/world）
//  - 输入带前缀（stagex:1）自动切换下拉并写入
//  - 输入默认单位（notex:0.8）收敛为数字
//  - 切换单位下拉按世界位置保持换算
//  - 多选 line 时 pos 显示“多个数值”占位
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lpu_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lpu_proj_'));
const OUT = path.join(__dirname, 'probe_line_pos_units_out.json');
const PROG = path.join(__dirname, '_lpu_progress.log');
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
const axisField = (axis, idx) => js(`(() => {
  const row = document.querySelectorAll('.pos-item')[${idx}];
  const labels = [...row.querySelectorAll('input')];
  const selects = [...row.querySelectorAll('select.unit')];
  const i = ['x', 'y', 'z'].indexOf(${JSON.stringify(axis)});
  return { input: labels[i], sel: selects[i] };
})()`);

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
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
    S.storyboard.lines.push({
      id: 'ln1', time: 0, opacity: 1,
      pos: [{ x: 0.5, y: 0.5, z: 0 }, { x: 0.8, y: 0.2, z: 0 }],
      states: [{ time: 2, pos: [{ x: 0.1, y: 0.1, z: 0 }, { x: 0.9, y: 0.9, z: 0 }] }]
    });
    window.__sb.selectObject('ln1', null);
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(400);
  R.widths = await js(`(() => {
    const list = document.querySelector('.pos-list');
    const field = list && list.closest('.field');
    const panel = document.getElementById('propBody');
    const item = document.querySelector('.pos-item');
    const axis = document.querySelector('.pos-axis');
    const inp = axis && axis.querySelector('input');
    const cs = inp ? getComputedStyle(inp) : null;
    const childRects = axis ? [...axis.children].map((c) => ({
      cls: c.className,
      w: c.getBoundingClientRect().width,
      maxW: c.tagName === 'INPUT' ? getComputedStyle(c).maxWidth : null
    })) : [];
    return {
      list: list ? list.getBoundingClientRect().width : 0,
      field: field ? field.getBoundingClientRect().width : 0,
      panel: panel ? panel.getBoundingClientRect().width : 0,
      item: item ? item.getBoundingClientRect().width : 0,
      axis: axis ? axis.getBoundingClientRect().width : 0,
      inputFlex: cs ? cs.flex : null,
      inputMinWidth: cs ? cs.minWidth : null,
      inputMaxWidth: cs ? cs.maxWidth : null,
      axisDisplay: axis ? getComputedStyle(axis).display : null,
      axisJustify: axis ? getComputedStyle(axis).justifyContent : null,
      itemDisplay: item ? getComputedStyle(item).display : null,
      childRects
    };
  })()`);

  // 1) 每轴单位下拉默认值
  R.defaults = await js(`(() => {
    const row = document.querySelector('.pos-item');
    const sels = [...row.querySelectorAll('select.unit')];
    const axes = [...row.querySelectorAll('.pos-axis')];
    return {
      x: sels[0].value, y: sels[1].value, z: sels[2].value,
      axisRows: axes.length,
      everyRowHasInputAndUnit: axes.every((a) => a.querySelector('input') && a.querySelector('select.unit')),
      inputWidth: axes[0] ? axes[0].querySelector('input').getBoundingClientRect().width : 0,
      selectWidth: axes[0] ? axes[0].querySelector('select.unit').getBoundingClientRect().width : 0
    };
  })()`);

  // 2) X 输入 stagex:1 → 下拉自动切到 stagex，写入 'stagex:1'
  await js(`(() => {
    const row = document.querySelector('.pos-item');
    const inp = row.querySelectorAll('input')[0];
    inp.value = 'stagex:1';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterStagex = await js(`(() => {
    const S = window.__sb.state;
    const p0 = S.storyboard.lines.find((o) => o.id === 'ln1').pos[0];
    const row = document.querySelector('.pos-item');
    const sel = row.querySelectorAll('select.unit')[0];
    return { x: p0.x, sel: sel.value };
  })()`);

  // 3) X 输入 notex:0.8 → 自动切回 notex，默认单位存为数字
  await js(`(() => {
    const row = document.querySelector('.pos-item');
    const inp = row.querySelectorAll('input')[0];
    inp.value = 'notex:0.8';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterNotex = await js(`(() => {
    const S = window.__sb.state;
    const p0 = S.storyboard.lines.find((o) => o.id === 'ln1').pos[0];
    const row = document.querySelector('.pos-item');
    const sel = row.querySelectorAll('select.unit')[0];
    return { x: p0.x, xType: typeof p0.x, sel: sel.value };
  })()`);

  // 4) Y 单位下拉切到 stagey（当前 0.5 notey）→ 世界位置保持换算
  const beforeY = await js(`(() => {
    const S = window.__sb.state;
    const p0 = S.storyboard.lines.find((o) => o.id === 'ln1').pos[0];
    const info = window.__sb.preview.ctxInfo();
    return { y: p0.y, worldY: window.__sb.preview.unitWorld({ value: p0.y, unit: 'notey' }, info) };
  })()`);
  await js(`(() => {
    const row = document.querySelector('.pos-item');
    const sel = row.querySelectorAll('select.unit')[1];
    sel.value = 'stagey';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterUnitSwitch = await js(`(() => {
    const S = window.__sb.state;
    const p0 = S.storyboard.lines.find((o) => o.id === 'ln1').pos[0];
    const row = document.querySelector('.pos-item');
    const sel = row.querySelectorAll('select.unit')[1];
    const v = typeof p0.y === 'string' ? Number(p0.y.split(':')[1]) : p0.y;
    const unit = typeof p0.y === 'string' ? p0.y.split(':')[0] : 'notey';
    const info = window.__sb.preview.ctxInfo();
    return { y: p0.y, unit, sel: sel.value, worldY: window.__sb.preview.unitWorld({ value: v, unit }, info) };
  })()`);

  // 5) 多选两条 pos 不同的 line → “多个数值”占位
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.lines.push({
      id: 'ln2', time: 0, opacity: 1,
      pos: [{ x: 0.2, y: 0.2, z: 0 }]
    });
    window.__sb.selectObjects(['ln1', 'ln2'], {});
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(400);
  R.multi = await js(`(() => {
    const ph = document.querySelector('.pos-field .help-text');
    return { placeholder: ph ? ph.textContent : null };
  })()`);

  const out = { R };
  out.ok = !!(
    R.defaults && R.defaults.x === 'notex' && R.defaults.y === 'notey' && R.defaults.z === 'world' &&
    R.defaults.axisRows === 3 && R.defaults.everyRowHasInputAndUnit === true &&
    R.defaults.inputWidth > 60 && R.defaults.selectWidth > 50 &&
    R.afterStagex && R.afterStagex.x === 'stagex:1' && R.afterStagex.sel === 'stagex' &&
    R.afterNotex && R.afterNotex.x === 0.8 && R.afterNotex.xType === 'number' && R.afterNotex.sel === 'notex' &&
    R.afterUnitSwitch && R.afterUnitSwitch.unit === 'stagey' && R.afterUnitSwitch.sel === 'stagey' &&
    Math.abs(R.afterUnitSwitch.worldY - beforeY.worldY) < 1e-6 &&
    R.multi && R.multi.placeholder === '多个数值'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('LINE_POS_UNITS:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
