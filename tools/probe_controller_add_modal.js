// Verify the object-library "+" flow for Controllers: it opens a modal listing
// AVAILABLE (unclaimed) controller cards with checkboxes, and creating with
// multiple checked cards enables them all on the one new track. Cards already
// claimed by other tracks are not offered.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_addm_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_addm_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_addm_proj_'));
const CTR_PATH = path.join(TMP, 'AddModal.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'AddModal',
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
    // 已有轨道 A 占用 bloom。
    const ctlA = { id: 'ctl_add_a', time: 0, states: [{ time: 0, bloom: true }] };
    S.storyboard.controllers.push(ctlA);
    S.controllerCards = { ctl_add_a: ['bloom'] };
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 150));

    const oaAdd = () => {
      const row = Array.from(document.querySelectorAll('#objectAddList .oa-row'))
        .find((r) => r.querySelector('.oa-name') && r.querySelector('.oa-name').textContent.includes('Controllers'));
      return row && row.querySelector('.oa-add');
    };
    const cbs = () => Array.from(document.querySelectorAll('#modalBody .cc-add-cb'));
    const createBtn = () => Array.from(document.querySelectorAll('#modalFoot .dlg-btn')).find((b) => b.textContent === '创建');
    const closeBtn = () => Array.from(document.querySelectorAll('#modalFoot .dlg-btn')).find((b) => b.textContent === '取消');

    oaAdd().click();
    await new Promise((r) => setTimeout(r, 80));
    const modalOpened = !document.querySelector('#modalMask').classList.contains('hidden');
    const all = cbs();
    const modalInfo = {
      opened: modalOpened,
      cbCount: all.length,
      bloomAbsent: !all.some((cb) => cb.dataset.card === 'bloom'),
      cameraXPresent: all.some((cb) => cb.dataset.card === 'camera_x')
    };

    // 勾选两张卡片（相机X + 场景不透明度）创建。
    all.find((cb) => cb.dataset.card === 'camera_x').checked = true;
    all.find((cb) => cb.dataset.card === 'opacity_storyboard').checked = true;
    createBtn().click();
    await new Promise((r) => setTimeout(r, 180));
    const ctlB = (S.storyboard.controllers || []).find((c) => c.id !== 'ctl_add_a');
    const afterCreate = {
      created: !!ctlB,
      controllerCount: (S.storyboard.controllers || []).length,
      cards: ctlB ? (S.controllerCards[ctlB.id] || []) : [],
      selectedIsB: S.selectedObjId === (ctlB && ctlB.id),
      panelCameraX: !!document.querySelector('#stateForm .ctrl-card[data-card="camera_x"]'),
      panelOpacity: !!document.querySelector('#stateForm .ctrl-card[data-card="opacity_storyboard"]'),
      panelBloomHidden: !document.querySelector('#stateForm .ctrl-card[data-card="bloom"]'),
      bloomToggleNotWritten: !!(ctlB && ctlB.bloom === undefined)
    };

    // 空选择创建被拒绝（不新增轨道）。
    oaAdd().click();
    await new Promise((r) => setTimeout(r, 80));
    createBtn().click();
    await new Promise((r) => setTimeout(r, 150));
    const afterEmpty = { controllerCount: (S.storyboard.controllers || []).length };

    return { modalInfo, afterCreate, afterEmpty };
  })()`);

  out.ok = !!(
    out.modalInfo && out.modalInfo.opened && out.modalInfo.cbCount === 33 &&
    out.modalInfo.bloomAbsent && out.modalInfo.cameraXPresent &&
    out.afterCreate && out.afterCreate.created && out.afterCreate.controllerCount === 2 &&
    out.afterCreate.cards.length === 2 &&
    out.afterCreate.cards.includes('camera_x') && out.afterCreate.cards.includes('opacity_storyboard') &&
    out.afterCreate.selectedIsB && out.afterCreate.panelCameraX &&
    out.afterCreate.panelOpacity && out.afterCreate.panelBloomHidden &&
    out.afterCreate.bloomToggleNotWritten &&
    out.afterEmpty && out.afterEmpty.controllerCount === 2
  );
  fs.writeFileSync(path.join(__dirname, 'probe_controller_add_modal_out.json'), JSON.stringify(out, null, 2));
  console.log('ADDM_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_controller_add_modal_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
