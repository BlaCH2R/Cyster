// 验证：合并时间块（note_controller 合并块）的上/下移一层——
//  - 无 order/layer，按 .ctr 隐性轨道顺序整轨上/下移动
//  - 边界处提示“该方向没有可移动的层级”
//  - 移动后合并标记保持
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mbs_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mbs_proj_'));
const OUT = path.join(__dirname, 'probe_merged_block_shift_out.json');
const PROG = path.join(__dirname, '_mbs_progress.log');
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
    S.storyboard.note_controllers.push({
      id: 'nc_merged', note: { type: [0], start: 1, end: 3 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.5 }]
    });
    S.noteSelectorMerge['nc_merged'] = true;
    S.storyboard.note_controllers.push({ id: 'nc_other', note: 2, time: 'start:$note' });
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);

  const ncLanes = () => js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.note_controller || []));
  })()`);
  R.before = await ncLanes();

  // 在顶部上移 → 提示且不变
  await js(`(() => { window.__sb.selectObject('nc_merged', null); window.__sb.shiftObjectOrder('nc_merged', -1); return true; })()`);
  await sleep(400);
  R.atTop = {
    lanes: await ncLanes(),
    toast: await js(`(() => {
      const t = [...document.querySelectorAll('#toastWrap .toast.error')].pop();
      return t ? t.textContent : null;
    })()`)
  };

  // 下移一层 → 轨道顺序交换
  await js(`(() => { window.__sb.shiftObjectOrder('nc_merged', 1); return true; })()`);
  await sleep(400);
  R.afterDown = await ncLanes();
  R.mergedStill = await js(`(() => !!window.__sb.state.noteSelectorMerge['nc_merged'])()`);

  // 上移一层 → 回到原位
  await js(`(() => { window.__sb.shiftObjectOrder('nc_merged', -1); return true; })()`);
  await sleep(400);
  R.afterUp = await ncLanes();

  const out = { R };
  out.ok = !!(
    R.before && R.before.some((l) => l.includes('nc_merged')) &&
    R.before.indexOf(R.before.find((l) => l.includes('nc_merged'))) === R.before.indexOf(R.before.find((l) => l.includes('nc_other'))) - 1 &&
    R.atTop && R.atTop.toast && R.atTop.toast.indexOf('该方向没有可移动的层级') >= 0 &&
    JSON.stringify(R.atTop.lanes) === JSON.stringify(R.before) &&
    R.afterDown && R.afterDown.some((l) => l.includes('nc_merged')) &&
    R.afterDown.indexOf(R.afterDown.find((l) => l.includes('nc_merged'))) === R.before.indexOf(R.before.find((l) => l.includes('nc_merged'))) + 1 &&
    R.mergedStill === true &&
    R.afterUp && JSON.stringify(R.afterUp) === JSON.stringify(R.before)
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('MERGED_BLOCK_SHIFT:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
