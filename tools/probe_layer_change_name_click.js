// Verify this batch:
//  1. Changing an object's layer moves its merged lane INTO the target layer
//     group (no new/duplicate "Layer N" category; lanes re-grouped properly).
//  2. Clicking the name column of a merged lane shows the lane stats panel
//     instead of auto-selecting the first object.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lcn_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_lcn_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lcn_proj_'));
const CTR_PATH = path.join(TMP, 'LayerChangeNameClick.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'LayerChangeNameClick',
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
    const L1a = { id: 'L1a', path: 'bg.jpg', time: 0, opacity: 1, layer: 1, order: 1, states: [{ time: 3, opacity: 0.8 }] };
    const L0a = { id: 'L0a', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1, states: [{ time: 3, opacity: 0.8 }] };
    const L0b = { id: 'L0b', path: 'bg.jpg', time: 5, opacity: 1, layer: 0, order: 0, states: [{ time: 8, opacity: 0.8 }] };
    const M = { id: 'M', path: 'bg.jpg', time: 10, opacity: 1, layer: 0, order: 2, states: [{ time: 13, opacity: 0.8 }] };
    S.storyboard.sprites.push(L1a, L0a, L0b, M);
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();

    // --- 1) Change M's layer 0 -> 1 via the properties panel ---
    window.__sb.selectObject('M', null);
    const layerRow = Array.from(document.querySelectorAll('#syncForm .field'))
      .find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim().indexOf('图层') === 0);
    const layerSel = layerRow ? layerRow.querySelector('select') : null;
    if (layerSel) {
      layerSel.value = '1';
      layerSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const layerOk = M.layer === 1;
    const laneOrder = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    const sepLabels = Array.from(document.querySelectorAll('.lane-layer-sep-label')).map((el) => el.textContent.trim());
    const mergedCfg = S.projectConfig.editor.timeline.trackGroups.stage;
    const mIdx = laneOrder.indexOf('M');
    const l1aIdx = laneOrder.indexOf('L1a');
    const mergedIdx = laneOrder.indexOf('Sprite × 2');
    const groupedOk = mIdx >= 0 && l1aIdx >= 0 && mergedIdx >= 0 &&
      mIdx < mergedIdx && l1aIdx < mergedIdx; // 两个 layer1 轨道都在 layer0 合并轨之上
    const sepOk = sepLabels.length === 2 && sepLabels[0].indexOf('Layer 1') === 0 && sepLabels[1].indexOf('Layer 0') === 0;
    const mInLayer1 = mergedCfg.some((lane) => lane.includes('M') &&
      (S.storyboard.sprites.find((o) => o.id === lane[0]).layer === 1));

    // --- 2) Click the merged lane name column -> lane stats, not first object ---
    const mergedLabel = Array.from(document.querySelectorAll('.tlh-lane .lane-label')).find((el) => el.textContent.indexOf('Sprite × 2') >= 0);
    if (mergedLabel) mergedLabel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    const nameClickOk = !!(S.selectedLane && S.selectedLane.objs && S.selectedLane.objs.length === 2) &&
      S.selectedIds.length === 0 && S.selectedObjId === null;
    const statsShown = document.querySelector('#propBody').textContent.indexOf('轨道对象统计') >= 0;

    return {
      layerOk, laneOrder, sepLabels, groupedOk, sepOk, mInLayer1,
      mergedCfg,
      nameClickOk, statsShown
    };
  })()`);

  const result = {
    layerOk: out.layerOk,
    laneOrder: out.laneOrder,
    sepLabels: out.sepLabels,
    groupedOk: out.groupedOk,
    sepOk: out.sepOk,
    mInLayer1: out.mInLayer1,
    mergedCfg: out.mergedCfg,
    nameClickOk: out.nameClickOk,
    statsShown: out.statsShown,
    ok: out.layerOk === true && out.groupedOk === true && out.sepOk === true &&
      out.mInLayer1 === true && out.nameClickOk === true && out.statsShown === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_layer_change_name_click_out.json'), JSON.stringify(result, null, 2));
  console.log('LCN_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_layer_change_name_click_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
