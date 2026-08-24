// 验证“清空关键帧时间输入框 = 删除该关键帧”（而不是留下 time 为空的关键帧）：
//  - K1 清空：该 state 被删除
//  - K0 清空：最早关键帧提升为新的 K0
//  - 仅剩 K0 时清空：删除对象（与既有“删除关键帧 K0”语义一致）
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ckf_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ckf_proj_'));
const OUT = path.join(__dirname, 'probe_clear_kf_time_out.json');
const PROG = path.join(__dirname, '_ckf_progress.log');
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

  // 工具：清空当前选中的关键帧时间输入框
  const clearTime = () => js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const tRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.indexOf('时间') >= 0);
    const input = tRow && tRow.querySelector('input[type=text]');
    if (!input) return { err: 'no time input' };
    input.value = '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { hadInput: true, valBefore: input.value };
  })()`);
  const objState = () => js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_clear');
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
  })()`);

  // 场景 A：K1 清空 → 该 state 被删除，不留下空时间
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr_clear', path: 'octa.png', time: 0, x: 0, y: 0, opacity: 1,
      states: [{ time: 3, opacity: 0.5 }, { time: 5, opacity: 0.8 }]
    });
    window.__sb.selectObject('spr_clear', 0);
    S.propsExplicitKf = true;
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.clearK1 = await clearTime();
  await sleep(400);
  R.afterClearK1 = await objState();

  // 场景 B：K0 清空 → 最早关键帧提升为新的 K0
  await js(`(() => {
    window.__sb.selectObject('spr_clear', -1);
    window.__sb.state.propsExplicitKf = true;
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.clearK0 = await clearTime();
  await sleep(400);
  R.afterClearK0 = await objState();

  // 场景 C：仅剩 K0 时清空 → 删除对象
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr_solo', path: 'octa.png', time: 1, x: 0, y: 0, opacity: 1
    });
    window.__sb.selectObject('spr_solo', -1);
    S.propsExplicitKf = true;
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.clearK0Solo = await clearTime();
  await sleep(400);
  R.soloStillThere = await js(`(() => !!(window.__sb.state.storyboard.sprites.find((o) => o.id === 'spr_solo')))()`);

  const out = { R };
  out.ok = !!(
    R.afterClearK1 && R.afterClearK1.states && R.afterClearK1.states.length === 1 &&
    R.afterClearK1.states[0].time === 5 && R.afterClearK1.time === 0 &&
    !R.afterClearK1.states.some((s) => s.time === '' || s.time === undefined || s.time === null) &&
    R.afterClearK0 && R.afterClearK0.time === 5 &&
    (!R.afterClearK0.states || R.afterClearK0.states.length === 0) &&
    R.soloStillThere === false
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('CLEAR_KF:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
