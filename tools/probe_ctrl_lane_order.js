// Verify the implicit controller / note_controller track-hierarchy config:
// vertical lane reorder persists into the .ctr file (editor.timeline.trackGroups)
// and is restored on reopen; stage reorder keeps working with group-relative
// lane indexing; 整理轨道 preserves the controller lane order.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ctlo_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ctlo_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ctlo_proj_'));
const CTR_PATH = path.join(TMP, 'CtrlLaneOrder.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'CtrlLaneOrder',
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
    const c1 = { id: 'c1', time: 0, opacity: 1, states: [{ time: 4, opacity: 0.8 }] };
    const c2 = { id: 'c2', time: 5, opacity: 1, states: [{ time: 9, opacity: 0.8 }] };
    const c3 = { id: 'c3', time: 10, opacity: 1, states: [{ time: 14, opacity: 0.8 }] };
    const n1 = { id: 'n1', time: 0, x: 0, y: 0, states: [{ time: 3, x: 1, y: 1 }] };
    const n2 = { id: 'n2', time: 5, x: 0, y: 0, states: [{ time: 8, x: 1, y: 1 }] };
    const n3 = { id: 'n3', time: 10, x: 0, y: 0, states: [{ time: 13, x: 1, y: 1 }] };
    const sp1 = { id: 'sp1', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1 };
    const sp2 = { id: 'sp2', path: 'bg.jpg', time: 2, opacity: 1, layer: 0, order: 0 };
    S.storyboard.controllers.push(c1, c2, c3);
    S.storyboard.note_controllers.push(n1, n2, n3);
    S.storyboard.sprites.push(sp1, sp2);
    window.__sb.refreshAll();

    const laneLabels = () => Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    const controllerRowOrder = () => {
      const all = laneLabels();
      return all.filter((x) => ['c1', 'c2', 'c3'].includes(x));
    };
    const ncRowOrder = () => {
      const all = laneLabels();
      return all.filter((x) => ['n1', 'n2', 'n3'].includes(x));
    };

    const defaultCtl = controllerRowOrder();
    const defaultNc = ncRowOrder();

    // --- 1) Reorder controller lane c2 -> index 0 ---
    window.__sb.reorderObjectLane('c2', 'controller', 0, false);
    const ctlAfter = controllerRowOrder();
    const ctlConfig = window.__sb.state.projectConfig.editor.timeline.trackGroups.controller;

    // --- 2) Reorder note_controller lane n3 -> index 0 ---
    window.__sb.reorderObjectLane('n3', 'note_controller', 0, false);
    const ncAfter = ncRowOrder();
    const ncConfig = window.__sb.state.projectConfig.editor.timeline.trackGroups.note_controller;

    // --- 3) Simulate reopen: setMergedLanes from persisted config ---
    window.__sb.timeline.setMergedLanes(window.__sb.readCysterTrackGroups ? window.__sb.readCysterTrackGroups() : null);
    const ctlRestored = controllerRowOrder();
    const ncRestored = ncRowOrder();

    // --- 4) Stage reorder with group-relative indexing (regression) ---
    window.__sb.reorderObjectLane('sp2', 'stage', 0, false);
    const spOrderAfter = [sp2.order, sp1.order];

    return {
      defaultCtl, defaultNc,
      ctlAfter, ctlConfig,
      ncAfter, ncConfig,
      ctlRestored, ncRestored,
      spOrderAfter
    };
  })()`);

  // Wait for the async saveProjectState IPC round trip, then read the .ctr file
  // (captured right after the reorders; 整理轨道 later re-packs note_controller
  // by design, so only controller order must survive it).
  await new Promise((r) => setTimeout(r, 600));
  const readTrack = (key) => {
    try {
      const cfg = JSON.parse(fs.readFileSync(CTR_PATH, 'utf8'));
      const tg = cfg && cfg.editor && cfg.editor.timeline && cfg.editor.timeline.trackGroups;
      return tg ? tg[key] : null;
    } catch (e) { return null; }
  };
  const ctrCtl = readTrack('controller');
  const ctrNc = readTrack('note_controller');

  // --- 5) 整理轨道 keeps controller lane order (note_controller re-packs) ---
  const organized = await win.webContents.executeJavaScript(`(() => {
    window.__sb.timeline.organizeTracks();
    const labels = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    const ctlAfterOrganize = labels.filter((x) => ['c1', 'c2', 'c3'].includes(x));
    const ctlConfigAfter = window.__sb.state.projectConfig.editor.timeline.trackGroups.controller;
    const ncConfigAfter = window.__sb.state.projectConfig.editor.timeline.trackGroups.note_controller;
    return { ctlAfterOrganize, ctlConfigAfter, ncConfigAfter };
  })()`);

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const result = {
    defaultCtl: out.defaultCtl,
    defaultNc: out.defaultNc,
    ctlAfter: out.ctlAfter,
    ctlConfig: out.ctlConfig,
    ncAfter: out.ncAfter,
    ncConfig: out.ncConfig,
    ctlRestored: out.ctlRestored,
    ncRestored: out.ncRestored,
    spOrderAfter: out.spOrderAfter,
    ctlAfterOrganize: organized.ctlAfterOrganize,
    ctlConfigAfter: organized.ctlConfigAfter,
    ncConfigAfterOrganize: organized.ncConfigAfter,
    ctrCtl: ctrCtl,
    ctrNc: ctrNc,
    ok:
      eq(out.defaultCtl, ['c1', 'c2', 'c3']) &&
      eq(out.defaultNc, ['n1', 'n2', 'n3']) &&
      eq(out.ctlAfter, ['c2', 'c1', 'c3']) &&
      eq(out.ctlConfig, [['c2'], ['c1'], ['c3']]) &&
      eq(out.ncAfter, ['n3', 'n1', 'n2']) &&
      eq(out.ncConfig, [['n3'], ['n1'], ['n2']]) &&
      eq(out.ctlRestored, ['c2', 'c1', 'c3']) &&
      eq(out.ncRestored, ['n3', 'n1', 'n2']) &&
      eq(out.spOrderAfter, [1, 0]) &&
      eq(organized.ctlAfterOrganize, ['c2', 'c1', 'c3']) &&
      eq(organized.ctlConfigAfter, [['c2'], ['c1'], ['c3']]) &&
      eq(ctrCtl, [['c2'], ['c1'], ['c3']]) &&
      eq(ctrNc, [['n3'], ['n1'], ['n2']])
  };
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_lane_order_out.json'), JSON.stringify(result, null, 2));
  console.log('CTLO_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_lane_order_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
