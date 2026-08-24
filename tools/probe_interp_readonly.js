// 验证：播放头不在关键帧上时属性面板标注“只读”，但输入框并未真正禁用，
// 编辑会写到插值克隆上并在重渲染后丢失（“修改执行失败”的一类来源）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_iro_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_iro_proj_'));
const OUT = path.join(__dirname, 'probe_interp_readonly_out.json');
const PROG = path.join(__dirname, '_iro_progress.log');
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

  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr_i', path: 'octa.png', time: 0, x: 0, y: 0, opacity: 1,
      states: [{ time: 3, opacity: 0.5 }]
    });
    window.__sb.setTime(1.5, false); // 播放头位于两个关键帧之间
    window.__sb.selectObject('spr_i', null);
    S.propsExplicitKf = false;
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(400);
  R.panel = await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const opRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === '不透明度');
    const input = opRow && opRow.querySelector('input[type=number]');
    return {
      hint: !!document.querySelector('.interp-hint'),
      inputDisabled: input ? input.disabled : null,
      shownValue: input ? input.value : null
    };
  })()`);
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const opRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === '不透明度');
    const input = opRow.querySelector('input[type=number]');
    input.value = '0.9';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterEdit = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_i');
    return { k0Opacity: obj.opacity, stateOpacity: obj.states && obj.states[0] && obj.states[0].opacity };
  })()`);

  const out = { R };
  out.ok = true;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('INTERP_RO:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
