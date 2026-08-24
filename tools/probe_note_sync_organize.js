// Verify this batch:
//  1. note_controller's Note is a full-block sync field (SYNC tag in the header,
//     no per-frame Note in the state form, editing syncs obj + all states).
//  2. Multi-selected time blocks support batch order editing (order field in
//     the multi-edit panel applies to all).
//  3. 整理轨道 preserves the vertical order of coexisting objects and leaves
//     the name column layer-major (no duplicated layer separators).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nso_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_nso_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nso_proj_'));
const CTR_PATH = path.join(TMP, 'NoteSyncOrganize.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NoteSyncOrganize',
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
    const nc = { id: 'nc1', note: 5, time: 2, opacity_multiplier: 1,
      states: [{ time: 4, opacity_multiplier: 0.8, note: 5 }] };
    S.storyboard.note_controllers.push(nc);
    window.__sb.refreshAll();

    // --- 1) Note is a sync field in the single note_controller panel ---
    window.__sb.selectObject('nc1', null);
    const body = document.querySelector('#propBody');
    const syncTag = Array.from(body.querySelectorAll('.sync-tag')).map((t) => t.textContent.trim());
    const noteField = Array.from(body.querySelectorAll('#propBody .field'))
      .find((r) => r.querySelector('label') && r.querySelector('label').textContent.indexOf('Note') === 0);
    const noteSyncOk = !!noteField &&
      noteField.querySelector('.sync-tag') && noteField.querySelector('.sync-tag').textContent.trim() === 'SYNC';
    const stateNoteField = Array.from(body.querySelectorAll('#stateForm .field'))
      .find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'Note ID');
    const noStateNote = !stateNoteField;
    const noteInput = noteField.querySelector('input');
    noteInput.value = '7';
    noteInput.dispatchEvent(new Event('change', { bubbles: true }));
    const noteSynced = nc.note === 7 && nc.states[0].note === 7;

    // --- 2) Batch order editing for multi-selected time blocks ---
    const s1 = { id: 's1', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 0,
      states: [{ time: 3, opacity: 0.8 }] };
    const s2 = { id: 's2', path: 'bg.jpg', time: 5, opacity: 1, layer: 0, order: 1,
      states: [{ time: 8, opacity: 0.8 }] };
    S.storyboard.sprites.push(s1, s2);
    S.selectedIds = ['s1', 's2'];
    S.selectedObjId = 's2';
    S.selectedKfs = [];
    window.__sb.refreshAll();
    const orderRow = Array.from(document.querySelectorAll('#syncForm .field'))
      .find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim().indexOf('顺序') === 0);
    const orderInput = orderRow ? orderRow.querySelector('input') : null;
    const orderFieldShown = !!orderInput;
    let batchOrderOk = false;
    if (orderInput) {
      orderInput.value = '3';
      orderInput.dispatchEvent(new Event('change', { bubbles: true }));
      batchOrderOk = s1.order === 3 && s2.order === 3;
    }

    // --- 3) 整理轨道 keeps coexisting order; name column layer-major ---
    const A = { id: 'A', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 5, states: [{ time: 3, opacity: 0.8 }] };
    const X = { id: 'X', path: 'bg.jpg', time: 8, opacity: 1, layer: 0, order: 1, states: [{ time: 10, opacity: 0.8 }] };
    const B = { id: 'B', path: 'bg.jpg', time: 9, opacity: 1, layer: 0, order: 4, states: [{ time: 12, opacity: 0.8 }] };
    const Z = { id: 'Z', path: 'bg.jpg', time: 0.2, opacity: 1, layer: 1, order: 0, states: [{ time: 2.5, opacity: 0.8 }] };
    // 让这些对象与 s1/s2 区分开：清掉 s1/s2 再建
    S.storyboard.sprites = [A, X, B, Z];
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    // 预期：A 与 X 时间不重叠打包同轨；B 与 X 重叠(9-12 vs 8-10) → B 在 X 之上；
    // A(0-3) 与 B(9-12) 不共存 → 无约束；Z(layer1) 在最顶。
    const laneOrder = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    const zIdx = laneOrder.indexOf('Z');
    const bIdx = laneOrder.indexOf('B');
    const axIdx = laneOrder.indexOf('Sprite × 2');
    const zTop = zIdx >= 0 && bIdx >= 0 && axIdx >= 0 && zIdx < bIdx && zIdx < axIdx;
    const bAboveX = bIdx >= 0 && axIdx >= 0 && bIdx < axIdx;
    // B 与 X 共存且 B 原 order 4 > X 的 1 → 整理后 B 的 order 应大于 X
    const bOrder = B.order, xOrder = X.order;
    const coexOrderOk = bOrder != null && xOrder != null && bOrder > xOrder;
    // 层分隔不重复：Layer 标签按 1 → 0 顺序出现且不循环
    const sepLabels = Array.from(document.querySelectorAll('.lane-layer-sep-label')).map((el) => el.textContent.trim());
    const sepOk = sepLabels.every((l, i) => i === 0 || parseInt(l.replace(/[^0-9]/g, ''), 10) <= parseInt(sepLabels[i - 1].replace(/[^0-9]/g, ''), 10));
    // 同一 layer 内 order 不重复
    const laneOrders = [A.order, B.order]; // A/X 同轨共享 order；B 是另一轨道
    const dupOrder = laneOrders.filter((v, i) => laneOrders.indexOf(v) !== i);

    return {
      noteSyncOk, noStateNote, noteSynced, syncTag,
      orderFieldShown, batchOrderOk,
      laneOrder, zTop, bAboveX, coexOrderOk, bOrder, xOrder, sepLabels, sepOk,
      dupOrder, orders: [A.order, X.order, B.order, Z.order]
    };
  })()`);

  const result = {
    noteSyncOk: out.noteSyncOk,
    noStateNote: out.noStateNote,
    noteSynced: out.noteSynced,
    syncTag: out.syncTag,
    orderFieldShown: out.orderFieldShown,
    batchOrderOk: out.batchOrderOk,
    laneOrder: out.laneOrder,
    zTop: out.zTop,
    bAboveX: out.bAboveX,
    coexOrderOk: out.coexOrderOk,
    bOrder: out.bOrder,
    xOrder: out.xOrder,
    sepLabels: out.sepLabels,
    sepOk: out.sepOk,
    dupOrder: out.dupOrder,
    orders: out.orders,
    ok:
      out.noteSyncOk === true && out.noStateNote === true && out.noteSynced === true &&
      out.orderFieldShown === true && out.batchOrderOk === true &&
      out.zTop === true && out.bAboveX === true && out.coexOrderOk === true &&
      out.sepOk === true && out.dupOrder.length === 0
  };
  fs.writeFileSync(path.join(__dirname, 'probe_note_sync_organize_out.json'), JSON.stringify(result, null, 2));
  console.log('NSO_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_note_sync_organize_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
