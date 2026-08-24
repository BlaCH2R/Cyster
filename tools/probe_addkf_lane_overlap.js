// Repro: in a merged lane [A(0-3), B(5-8)], adding a keyframe to A at the
// playhead INSIDE B's range (t=6) must push B out of the lane instead of
// leaving both overlapping in the same lane.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_akf_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_akf_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_akf_proj_'));
const CTR_PATH = path.join(TMP, 'AddKfOverlap.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'AddKfOverlap',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const A = { id: 'A', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1, states: [{ time: 3, opacity: 0.8 }] };
    const B = { id: 'B', path: 'bg.jpg', time: 5, opacity: 1, layer: 0, order: 0, states: [{ time: 8, opacity: 0.8 }] };
    S.storyboard.sprites.push(A, B);
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    const mergedBefore = window.__sb.readCysterTrackGroups().stage;
    const sameLaneBefore = mergedBefore.some((lane) => lane.includes('A') && lane.includes('B'));

    // 播放头放在 B 的时间范围内，给 A 添加关键帧
    window.__sb.selectObject('A', null);
    window.__sb.preview.setTime(6, false);
    window.__sb.addKeyframeAtPlayhead(A);
    const kfTimes = (A.states || []).map((s) => s.time);
    const mergedAfter = window.__sb.readCysterTrackGroups().stage;
    const sameLaneAfter = mergedAfter.some((lane) => lane.includes('A') && lane.includes('B'));
    const bLane = mergedAfter.findIndex((lane) => lane.includes('B'));
    const aLane = mergedAfter.findIndex((lane) => lane.includes('A'));
    // A 和 B 时间是否仍重叠
    const aSpan = [A.time, ...(A.states || []).map((s) => s.time)].sort((x, y) => x - y);
    const bSpan = [B.time, ...(B.states || []).map((s) => s.time)].sort((x, y) => x - y);
    const a0 = aSpan[0], a1 = Math.max(aSpan[0] + 0.25, aSpan[aSpan.length - 1]);
    const b0 = bSpan[0], b1 = Math.max(bSpan[0] + 0.25, bSpan[bSpan.length - 1]);
    const stillOverlap = a0 < b1 - 0.001 && b0 < a1 - 0.001;

    // --- 锁定 order 的后块：添加关键帧后不应留在同轨重叠 ---
    const E = { id: 'E', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 2, states: [{ time: 3, opacity: 0.8 }] };
    const F = { id: 'F', path: 'bg.jpg', time: 5, opacity: 1, layer: 0, order: 1, states: [{ time: 8, opacity: 0.8 }] };
    S.storyboard.sprites = [E, F];
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.timeline.setLockedOrders([1]);
    window.__sb.selectObject('E', null);
    window.__sb.preview.setTime(6, false);
    window.__sb.addKeyframeAtPlayhead(E);
    const mergedLocked = window.__sb.readCysterTrackGroups().stage;
    const lockedSameLane = mergedLocked.some((lane) => lane.includes('E') && lane.includes('F'));
    const fSpanT = [F.time, ...(F.states || []).map((s) => s.time)].sort((x, y) => x - y);
    const eSpanT = [E.time, ...(E.states || []).map((s) => s.time)].sort((x, y) => x - y);
    const e0 = eSpanT[0], e1 = Math.max(eSpanT[0] + 0.25, eSpanT[eSpanT.length - 1]);
    const f0 = fSpanT[0], f1 = Math.max(fSpanT[0] + 0.25, fSpanT[fSpanT.length - 1]);
    const lockedOverlap = e0 < f1 - 0.001 && f0 < e1 - 0.001;

    // --- note_controller 合并轨道：给前一个块在后面的块范围内添加关键帧 ---
    const N1 = { id: 'N1', note: 0, time: 0, opacity_multiplier: 1, states: [{ time: 3, opacity_multiplier: 0.8 }] };
    const N2 = { id: 'N2', note: 1, time: 5, opacity_multiplier: 1, states: [{ time: 8, opacity_multiplier: 0.8 }] };
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [N1, N2], templates: {} };
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    const ncBefore = window.__sb.readCysterTrackGroups().note_controller;
    window.__sb.selectObject('N1', null);
    window.__sb.preview.setTime(6, false);
    window.__sb.addKeyframeAtPlayhead(N1);
    const ncAfter = window.__sb.readCysterTrackGroups().note_controller;
    const ncSameLane = ncAfter.some((lane) => lane.includes('N1') && lane.includes('N2'));
    const n1Span = [N1.time, ...(N1.states || []).map((s) => s.time)].sort((x, y) => x - y);
    const n2Span = [N2.time, ...(N2.states || []).map((s) => s.time)].sort((x, y) => x - y);
    const nA0 = n1Span[0], nA1 = Math.max(n1Span[0] + 0.25, n1Span[n1Span.length - 1]);
    const nB0 = n2Span[0], nB1 = Math.max(n2Span[0] + 0.25, n2Span[n2Span.length - 1]);
    const ncOverlap = nA0 < nB1 - 0.001 && nB0 < nA1 - 0.001;
    // 修复后：N1 添加关键帧后 N2 应被挤到另一条 note_controller 轨道（不再同轨）
    const ncFixed = !ncSameLane && ncAfter.length === 2;

    return { sameLaneBefore, kfTimes, sameLaneAfter, aLane, bLane, stillOverlap,
      mergedAfter, aSpan, bSpan, lockedSameLane, lockedOverlap, fSpanT, eSpanT, mergedLocked,
      ncBefore, ncAfter, ncSameLane, ncOverlap, ncFixed };
  })()`);

  const result = {
    sameLaneBefore: out.sameLaneBefore,
    kfTimes: out.kfTimes,
    sameLaneAfter: out.sameLaneAfter,
    aLane: out.aLane,
    bLane: out.bLane,
    stillOverlap: out.stillOverlap,
    mergedAfter: out.mergedAfter,
    aSpan: out.aSpan,
    bSpan: out.bSpan,
    lockedSameLane: out.lockedSameLane,
    lockedOverlap: out.lockedOverlap,
    fSpanT: out.fSpanT,
    eSpanT: out.eSpanT,
    mergedLocked: out.mergedLocked,
    ncBefore: out.ncBefore,
    ncAfter: out.ncAfter,
    ncSameLane: out.ncSameLane,
    ncOverlap: out.ncOverlap,
    ncFixed: out.ncFixed
  };
  fs.writeFileSync(path.join(__dirname, 'probe_addkf_lane_overlap_out.json'), JSON.stringify(result, null, 2));
  console.log('AKF_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_addkf_lane_overlap_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
