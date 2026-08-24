// Verify that "挤开" during a lane-changing drag is temporary: when the dragged
// object does not finally occupy the pushed object's original spot, the pushed
// object returns to its original lane (with its original layer/order).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lpr_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_lpr_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lpr_proj_'));
const CTR_PATH = path.join(TMP, 'LanePushRestore.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'LanePushRestore',
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
    const B = { id: 'B', path: 'bg.jpg', time: 8, opacity: 1, layer: 0, order: 0, states: [{ time: 10, opacity: 0.8 }] };
    S.storyboard.sprites.push(A, B);
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks(); // A(0-3) + B(8-10) 打包进同一轨道
    const laneOfB = () => {
      const merged = window.__sb.readCysterTrackGroups();
      return merged && merged.stage ? merged.stage.findIndex((lane) => lane.includes('B')) : -1;
    };
    const startLaneB = laneOfB();
    const bLayer0 = B.layer, bOrder0 = B.order;

    // --- 拖动 A 覆盖 B 的原位：B 被挤开 ---
    window.__sb.captureLanePushState(['A']);
    A.time = 8.5; A.states[0].time = 11.5;
    window.__sb.shiftClips(['A'], 0); // no-op delta; just trigger render path? use resolveLaneOverlaps directly
    // direct overlap resolution (as happens during drag)
    // re-invoke via the real flow: shiftClips with delta already applied above is not used;
    // resolveLaneOverlaps is called by shiftClips on every mousemove. Call it directly:
    // (shiftClips(['A'], 0) would early-return since delta=0)
    // use a tiny delta to exercise the same path:
    window.__sb.shiftClips(['A'], 0.001);
    const pushedOut = laneOfB() !== startLaneB || laneOfB() < 0;
    const mergedAfterPush = window.__sb.readCysterTrackGroups().stage;
    const aInOwnLane = mergedAfterPush.some((lane) => lane.includes('A') && !lane.includes('B'));

    // --- 把 A 拖回原位：B 实时返回（拖动中即恢复，无需等待结束）---
    window.__sb.shiftClips(['A'], -8.501); // 回到 ~0-3，不再与 B 重叠
    const restoredLive = laneOfB() === startLaneB;

    // --- 拖动结束：B 应恢复原轨道与原 layer/order ---
    window.__sb.finalizeLanePushes();
    const restoredLane = laneOfB() === startLaneB;
    const restoredMeta = B.layer === bLayer0 && B.order === bOrder0;
    const restoredSameLane = window.__sb.readCysterTrackGroups().stage.some((lane) => lane.includes('A') && lane.includes('B'));

    // --- 提交场景：A 停在覆盖 B 原位处 → B 不恢复 ---
    const C = { id: 'C', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1, states: [{ time: 3, opacity: 0.8 }] };
    const D = { id: 'D', path: 'bg.jpg', time: 8, opacity: 1, layer: 0, order: 0, states: [{ time: 10, opacity: 0.8 }] };
    S.storyboard.sprites = [C, D];
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    const startLaneD = (() => {
      const merged = window.__sb.readCysterTrackGroups();
      return merged.stage.findIndex((lane) => lane.includes('D'));
    })();
    window.__sb.captureLanePushState(['C']);
    C.time = 8.5; C.states[0].time = 11.5;
    window.__sb.shiftClips(['C'], 0.001);
    const dPushed = (() => {
      const merged = window.__sb.readCysterTrackGroups();
      return merged.stage.findIndex((lane) => lane.includes('D')) !== startLaneD;
    })();
    window.__sb.finalizeLanePushes();
    const dNotRestored = (() => {
      const merged = window.__sb.readCysterTrackGroups();
      return merged.stage.findIndex((lane) => lane.includes('D')) !== startLaneD;
    })();

    return {
      startLaneB, pushedOut, aInOwnLane, restoredLive,
      restoredLane, restoredMeta, restoredSameLane,
      dPushed, dNotRestored
    };
  })()`);

  const result = {
    startLaneB: out.startLaneB,
    pushedOut: out.pushedOut,
    aInOwnLane: out.aInOwnLane,
    restoredLive: out.restoredLive,
    restoredLane: out.restoredLane,
    restoredMeta: out.restoredMeta,
    restoredSameLane: out.restoredSameLane,
    dPushed: out.dPushed,
    dNotRestored: out.dNotRestored,
    ok:
      out.pushedOut === true && out.aInOwnLane === true &&
      out.restoredLive === true &&
      out.restoredLane === true && out.restoredMeta === true && out.restoredSameLane === true &&
      out.dPushed === true && out.dNotRestored === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_lane_push_restore_out.json'), JSON.stringify(result, null, 2));
  console.log('LPR_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_lane_push_restore_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
