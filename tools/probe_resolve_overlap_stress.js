// 压力验证：合并时间块与普通/合并时间块在拖动换轨、上/下移一层后，
// 所有轨道（stage / note_controller）最终都不应残留时间重叠。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ros_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ros_proj_'));
const OUT = path.join(__dirname, 'probe_resolve_overlap_stress_out.json');
const PROG = path.join(__dirname, '_ros_progress.log');
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

  const checkNoOverlap = () => js(`(() => {
    const S = window.__sb.state;
    const g = window.__sb.readCysterTrackGroups() || {};
    const span = (o) => {
      const kfs = window.__sb.objectKeyframesAllNotes(o);
      if (!kfs.length) return null;
      const t0 = kfs[0].time;
      return { start: t0, end: Math.max(t0 + 0.25, kfs[kfs.length - 1].time) };
    };
    const findObj = (group, id) => S.storyboard[group].find((x) => x.id === id);
    const bad = [];
    for (const [group, key] of [['note_controllers', 'note_controller'], ['sprites', 'stage']]) {
      const lanes = g[key] || [];
      for (let li = 0; li < lanes.length; li++) {
        const sps = lanes[li].map((id) => span(findObj(group, id))).filter(Boolean);
        for (let i = 0; i < sps.length; i++) {
          for (let j = i + 1; j < sps.length; j++) {
            if (sps[i].start < sps[j].end - 0.001 && sps[j].start < sps[i].end - 0.001) {
              bad.push(key + ' lane' + li + ': ' + lanes[li].join(','));
            }
          }
        }
      }
    }
    return { ok: bad.length === 0, bad };
  })()`);

  // note_controller：3 个合并/普通块互相重叠 + 1 个可被挤入的块，组织后拖拽挤压
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'nA', note: { type: [0], start: 0, end: 1 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.5 }]
    });
    S.noteSelectorMerge['nA'] = true;
    S.storyboard.note_controllers.push({ id: 'nB', note: 0, time: 'start:$note' });
    S.storyboard.note_controllers.push({
      id: 'nC', note: { type: [0], start: 0, end: 2 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.4 }]
    });
    S.noteSelectorMerge['nC'] = true;
    S.storyboard.note_controllers.push({ id: 'nD', note: 4, time: 'start:$note' });
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);

  // 把 nA 拖到 nB 所在轨道（重叠）再拖回，反复挤压；再上/下移一层
  await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    const lanes = g.note_controller || [];
    const nBAt = lanes.findIndex((l) => l.includes('nB'));
    const nAAt = lanes.findIndex((l) => l.includes('nA'));
    if (nAAt >= 0 && nBAt >= 0 && nAAt !== nBAt) {
      window.__sb.reorderObjectLane('nA', 'note_controller', nBAt, false);
    }
    return true;
  })()`);
  await sleep(500);
  R.ncAfterDrag = await checkNoOverlap();
  await js(`(() => {
    window.__sb.selectObject('nA', null);
    window.__sb.shiftObjectOrder('nA', 1);
    window.__sb.shiftObjectOrder('nA', -1);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.ncAfterShift = await checkNoOverlap();
  R.ncLanes = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.note_controller || []));
  })()`);

  // stage：3 个重叠合并/普通块 + 1 个可挤入块
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites = [];
    const mk = (id, note, time) => ({ id, path: 'octa.png', time, layer: 1, order: 0, opacity: 1, note, states: [{ time: 2, opacity: 0.8 }] });
    S.storyboard.sprites.push({ ...mk('sA', { type: [0], start: 0, end: 1 }, 'intro:$note'), noteSelectorMerge: true });
    S.noteSelectorMerge['sA'] = true;
    S.storyboard.sprites.push(mk('sB', 0, 'intro:$note'));
    S.storyboard.sprites.push({ ...mk('sC', { type: [0], start: 0, end: 2 }, 'intro:$note') });
    S.noteSelectorMerge['sC'] = true;
    S.storyboard.sprites.push(mk('sD', 4, 2.2));
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    const lanes = g.stage || [];
    const sBAt = lanes.findIndex((l) => l.includes('sB'));
    const sAAt = lanes.findIndex((l) => l.includes('sA'));
    if (sAAt >= 0 && sBAt >= 0 && sAAt !== sBAt) {
      window.__sb.captureLanePushState(['sA']); // 模拟真实拖拽：先捕获挤开快照
      window.__sb.reorderObjectLane('sA', 'stage', sBAt, false);
      window.__sb.finalizeLanePushes(); // 拖动结束：恢复“未被真正占用原位”的对象
    }
    return true;
  })()`);
  await sleep(500);
  R.stageAfterDrag = await checkNoOverlap();
  await js(`(() => {
    window.__sb.selectObject('sA', null);
    window.__sb.shiftObjectOrder('sA', 1);
    window.__sb.shiftObjectOrder('sA', -1);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.stageAfterShift = await checkNoOverlap();
  R.stageLanes = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.stage || []));
  })()`);

  // 定向场景：数字时间块 sE 被拖入含合并块 sA 的轨道后被挤开，再触发
  // restorePushedLanes 放回——若合并块区间解析为空会错误放回造成重叠。
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites = [];
    S.storyboard.sprites.push({
      id: 'sA', path: 'octa.png', time: 'intro:$note', layer: 1, order: 0, opacity: 1,
      note: { type: [0], start: 0, end: 1 }, states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.noteSelectorMerge['sA'] = true;
    S.storyboard.sprites.push({ id: 'sD', path: 'octa.png', time: 2, layer: 1, order: 0, opacity: 1, states: [{ time: 2.5 }] });
    S.storyboard.sprites.push({ id: 'sE', path: 'octa.png', time: 0.5, layer: 1, order: 0, opacity: 1, states: [{ time: 1 }] });
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    const lanes = g.stage || [];
    const sAAt = lanes.findIndex((l) => l.includes('sA'));
    const sEAt = lanes.findIndex((l) => l.includes('sE'));
    if (sEAt >= 0 && sAAt >= 0 && sEAt !== sAAt) {
      window.__sb.captureLanePushState(['sE']);
      window.__sb.reorderObjectLane('sE', 'stage', sAAt, false);
      window.__sb.finalizeLanePushes();
    }
    return true;
  })()`);
  await sleep(500);
  R.restoreCase = await checkNoOverlap();
  R.restoreLanes = await js(`(() => {
    const g = window.__sb.readCysterTrackGroups() || {};
    return JSON.parse(JSON.stringify(g.stage || []));
  })()`);

  const out = { R };
  out.ok = !!(
    R.ncAfterDrag && R.ncAfterDrag.ok && R.ncAfterShift && R.ncAfterShift.ok &&
    R.stageAfterDrag && R.stageAfterDrag.ok && R.stageAfterShift && R.stageAfterShift.ok &&
    R.restoreCase && R.restoreCase.ok
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('RESOLVE_OVERLAP_STRESS:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
