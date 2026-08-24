// 验证：stage 合并时间块（对象级 note 选择器 + $note 时间）与普通时间块的
// 堆叠/互换逻辑与普通时间块一致：
//  - 拖动/编辑后重叠 → resolveLaneOverlaps 自动挤到其它轨道
//  - 上/下移一层：相邻重叠 → 互换；不再因区间解析为空而漏判
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_smo_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_smo_proj_'));
const OUT = path.join(__dirname, 'probe_stage_merged_overlap_out.json');
const PROG = path.join(__dirname, '_smo_progress.log');
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
    // sA：合并时间块（对象级选择器 + $note 时间）；sB：普通 sprite（时间错开）
    S.storyboard.sprites.push({
      id: 'sA', path: 'octa.png', time: 'intro:$note', layer: 1, order: 0, opacity: 1,
      note: { type: [0], start: 0, end: 1 },
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.noteSelectorMerge['sA'] = true;
    S.storyboard.sprites.push({
      id: 'sB', path: 'octa.png', time: 2, layer: 1, order: 0, opacity: 1,
      states: [{ time: 2.5 }]
    });
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks(); // sA 与 sB 时间不重叠 → 同轨堆放
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);

  const ord = () => js(`(() => {
    const S = window.__sb.state;
    const byId = {};
    for (const o of S.storyboard.sprites) byId[o.id] = o.order;
    return byId;
  })()`);
  R.packedOrders = await ord();
  R.packedLanes = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.stage || []));
  })()`);

  // 扩展 sA 覆盖 note 3/4 → 与 sB（2.0-2.5s）时间重叠 → 拖动式自动挤开
  await js(`window.__sb.nsBridge('apply', [{ id: 'sA', note: { type: [0], start: 0, end: 4 }, merge: true }])`);
  await sleep(600);
  R.afterResolveOrders = await ord();
  R.afterResolveLanes = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.stage || []));
  })()`);
  R.autoMoved = await js(`(() => ({
    sB: !!(window.__sb.state.autoMovedIds && window.__sb.state.autoMovedIds.has('sB')),
    sA: !!(window.__sb.state.autoMovedIds && window.__sb.state.autoMovedIds.has('sA'))
  }))()`);

  // 上/下移一层：sA 与相邻 sB 时间重叠 → 触发互换（而不是自由移动）
  const ordersBefore = await ord();
  const sAOrder = ordersBefore.sA, sBOrder = ordersBefore.sB;
  const dir = sAOrder > sBOrder ? 1 : -1; // 朝 sB 所在方向移一层
  await js(`(() => {
    window.__sb.selectObject('sA', null);
    window.__sb.shiftObjectOrder('sA', ${dir});
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.afterShiftOrders = await ord();
  R.swapped = !!(R.afterShiftOrders && R.afterShiftOrders.sA === sBOrder && R.afterShiftOrders.sB === sAOrder);

  const out = { R };
  out.ok = !!(
    R.packedOrders && R.packedOrders.sA === R.packedOrders.sB &&
    R.packedLanes && R.packedLanes.some((l) => l.includes('sA') && l.includes('sB')) &&
    R.afterResolveOrders && R.afterResolveOrders.sA !== R.afterResolveOrders.sB &&
    R.afterResolveLanes && !R.afterResolveLanes.some((l) => l.includes('sA') && l.includes('sB')) &&
    (R.autoMoved.sB === true || R.autoMoved.sA === true) &&
    R.swapped === true
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('STAGE_MERGED_OVERLAP:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
