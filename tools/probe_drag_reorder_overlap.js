// 验证：拖动换轨后合并时间块不再与其它时间块重叠——
//  - note_controller：拖动换轨只移动被拖块（块级），重叠块被自动挤到其它轨道
//  - stage 合并时间块：拖动换轨后按时间重叠挤开
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dro_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dro_proj_'));
const OUT = path.join(__dirname, 'probe_drag_reorder_overlap_out.json');
const PROG = path.join(__dirname, '_dro_progress.log');
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

  // ---- note_controller：ncA（合并块，note 0..1）、ncB（note 0 重叠）、ncC（note 2 不重叠）----
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'ncA', note: { type: [0], start: 0, end: 1 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.5 }]
    });
    S.noteSelectorMerge['ncA'] = true;
    S.storyboard.note_controllers.push({ id: 'ncB', note: 0, time: 'start:$note' });
    S.storyboard.note_controllers.push({ id: 'ncC', note: 2, time: 'start:$note' });
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.ncBefore = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.note_controller || []));
  })()`);
  // 拖动 ncA 换轨到 1 号轨道
  await js(`(() => { window.__sb.reorderObjectLane('ncA', 'note_controller', 1, false); return true; })()`);
  await sleep(500);
  R.ncAfter = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.note_controller || []));
  })()`);
  R.ncNoOverlap = await js(`(() => {
    const S = window.__sb.state;
    const g = window.__sb.readCysterTrackGroups() || {};
    const span = (o) => {
      const kfs = window.__sb.objectKeyframesAllNotes(o);
      if (!kfs.length) return null;
      const t0 = kfs[0].time;
      return { start: t0, end: Math.max(t0 + 0.25, kfs[kfs.length - 1].time) };
    };
    const lanes = g.note_controller || [];
    for (const lane of lanes) {
      const sps = lane.map((id) => span(S.storyboard.note_controllers.find((x) => x.id === id))).filter(Boolean);
      for (let i = 0; i < sps.length; i++) {
        for (let j = i + 1; j < sps.length; j++) {
          if (sps[i].start < sps[j].end - 0.001 && sps[j].start < sps[i].end - 0.001) return false;
        }
      }
    }
    return true;
  })()`);

  // ---- stage：sA（合并块，note 0..1）、sB（note 0 重叠）、sC（note 2 不重叠）----
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites = [];
    S.storyboard.sprites.push({
      id: 'sA', path: 'octa.png', time: 'intro:$note', layer: 1, order: 0, opacity: 1,
      note: { type: [0], start: 0, end: 1 }, states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.noteSelectorMerge['sA'] = true;
    S.storyboard.sprites.push({ id: 'sB', path: 'octa.png', time: 'start:$note', layer: 1, order: 0, opacity: 1, note: 0 });
    S.storyboard.sprites.push({ id: 'sC', path: 'octa.png', time: 2, layer: 1, order: 0, opacity: 1, states: [{ time: 2.5 }] });
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.stageBefore = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.stage || []));
  })()`);
  const sALane = R.stageBefore.findIndex((l) => l.includes('sA'));
  const targetLane = R.stageBefore.findIndex((l) => l.includes('sB'));
  await js(`(() => { window.__sb.reorderObjectLane('sA', 'stage', ${targetLane}, false); return true; })()`);
  await sleep(500);
  R.stageAfter = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.stage || []));
  })()`);
  R.stageNoOverlap = await js(`(() => {
    const S = window.__sb.state;
    const g = window.__sb.readCysterTrackGroups() || {};
    const span = (o) => {
      const kfs = window.__sb.objectKeyframesAllNotes(o);
      if (!kfs.length) return null;
      const t0 = kfs[0].time;
      return { start: t0, end: Math.max(t0 + 0.25, kfs[kfs.length - 1].time) };
    };
    const lanes = g.stage || [];
    for (const lane of lanes) {
      const sps = lane.map((id) => span(S.storyboard.sprites.find((x) => x.id === id))).filter(Boolean);
      for (let i = 0; i < sps.length; i++) {
        for (let j = i + 1; j < sps.length; j++) {
          if (sps[i].start < sps[j].end - 0.001 && sps[j].start < sps[i].end - 0.001) return false;
        }
      }
    }
    return true;
  })()`);

  const laneOf = (lanes, id) => lanes.findIndex((l) => l.includes(id));
  const out = { R };
  out.ok = !!(
    R.ncBefore && laneOf(R.ncBefore, 'ncA') === laneOf(R.ncBefore, 'ncC') &&
    laneOf(R.ncBefore, 'ncA') !== laneOf(R.ncBefore, 'ncB') &&
    R.ncNoOverlap === true &&
    R.stageBefore && laneOf(R.stageBefore, 'sA') === laneOf(R.stageBefore, 'sC') &&
    laneOf(R.stageBefore, 'sA') !== laneOf(R.stageBefore, 'sB') &&
    R.stageNoOverlap === true
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('DRAG_REORDER_OVERLAP:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
