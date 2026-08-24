// 验证：合并时间块与普通/合并时间块在轨道中的堆叠逻辑与普通时间块一致——
// 时间重叠时自动挤到相邻/新轨道（$note 合并块的占用区间按对象级选择器逐 note
// 解析，不再因解析为空而漏掉）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nlo_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nlo_proj_'));
const OUT = path.join(__dirname, 'probe_note_lane_overlap_out.json');
const PROG = path.join(__dirname, '_nlo_progress.log');
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

  const organize = () => js(`(() => {
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  const ncLanes = () => js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.note_controller || []));
  })()`);

  // ncA（合并块，覆盖 note 0..1）与 ncB（note 0）重叠 → 分轨
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'ncA', note: { type: [0], start: 0, end: 1 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.5 }]
    });
    S.noteSelectorMerge['ncA'] = true;
    S.storyboard.note_controllers.push({ id: 'ncB', note: 0, time: 'start:$note' });
    return true;
  })()`);
  await organize();
  R.afterSetup = await ncLanes();

  // ncC（note 2，1.5s）与 ncA 时间不重叠 → 同轨堆放
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({ id: 'ncC', note: 2, time: 'start:$note' });
    return true;
  })()`);
  await organize();
  R.afterPack = await ncLanes();

  // 扩展 ncA 选择器覆盖 note 2 → 与同轨 ncC 时间重叠 → 自动挤到新轨道
  R.applyRet = await js(`window.__sb.nsBridge('apply', [{ id: 'ncA', note: { type: [0], start: 0, end: 3 }, merge: true }])`);
  await sleep(600);
  R.debug = await js(`(() => {
    const S = window.__sb.state;
    const ncA = S.storyboard.note_controllers.find((x) => x.id === 'ncA');
    const ncC = S.storyboard.note_controllers.find((x) => x.id === 'ncC');
    const span = (o) => {
      const kfs = window.__sb.objectKeyframesAllNotes(o);
      if (!kfs.length) return null;
      const t0 = kfs[0].time;
      return [t0, Math.max(t0 + 0.25, kfs[kfs.length - 1].time)];
    };
    return {
      ncANote: ncA ? JSON.stringify(ncA.note) : null,
      merged: !!S.noteSelectorMerge['ncA'],
      autoMoved: S.autoMovedIds ? [...S.autoMovedIds] : [],
      ncASpan: span(ncA),
      ncCSpan: span(ncC),
      noteLanes: (window.__sb.readCysterTrackGroups() || {}).note_controller || null
    };
  })()`);
  R.afterResolve = await ncLanes();
  R.autoMoved = await js(`(() => ({
    ncC: !!window.__sb.state.autoMovedIds && window.__sb.state.autoMovedIds.has('ncC'),
    ncA: !!window.__sb.state.autoMovedIds && window.__sb.state.autoMovedIds.has('ncA')
  }))()`);

  const laneOf = (lanes, id) => lanes.findIndex((l) => l.includes(id));
  const out = { R };
  out.ok = !!(
    R.afterSetup && laneOf(R.afterSetup, 'ncA') >= 0 && laneOf(R.afterSetup, 'ncB') >= 0 &&
    laneOf(R.afterSetup, 'ncA') !== laneOf(R.afterSetup, 'ncB') &&
    R.afterPack && laneOf(R.afterPack, 'ncA') >= 0 && laneOf(R.afterPack, 'ncC') >= 0 &&
    laneOf(R.afterPack, 'ncA') === laneOf(R.afterPack, 'ncC') &&
    R.afterResolve && laneOf(R.afterResolve, 'ncA') >= 0 && laneOf(R.afterResolve, 'ncC') >= 0 &&
    laneOf(R.afterResolve, 'ncA') !== laneOf(R.afterResolve, 'ncC') &&
    (R.autoMoved.ncC === true || R.autoMoved.ncA === true)
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NOTE_LANE_OVERLAP:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
