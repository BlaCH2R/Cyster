// Verify the three new controller-card behaviors:
//  1) keyframes with destroy=true render red (timeline marker + property list)
//  2) right-click "拆分「属性」至新轨道" moves the card's values AND its
//     keyframes to a brand-new controller track (source keeps other cards)
//  3) the bottom "添加controller属性" button assigns NEW unclaimed cards to
//     the selected track (multi-select modal, toggle cards write true)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_extra_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_extra_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_extra_proj_'));
const CTR_PATH = path.join(TMP, 'CardExtra.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'CardExtra',
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
    const ctlA = {
      id: 'ctl_a', time: 0,
      states: [
        { time: 0, x: 2, storyboard_opacity: 0.8, destroy: true },
        { time: 3, x: 5, easing: 'easeoutquad' }
      ]
    };
    S.storyboard.controllers.push(ctlA);
    S.controllerCards = { ctl_a: ['camera_x', 'opacity_storyboard'] };
    const pick = (id) => {
      S.selectedObjId = id;
      S.selectedKeyIdx = 0;
      S.previewEmptyFocus = false;
      window.__sb.refreshAll();
    };
    const card = (key) => document.querySelector('#stateForm .ctrl-card[data-card="' + key + '"]');
    const rightClick = (key) => {
      card(key).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    };
    const clickMenuItem = (text) => {
      const item = Array.from(document.querySelectorAll('#contextMenu .cm-item')).find((el) => el.textContent.includes(text));
      if (!item) return false;
      item.click();
      return true;
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // 1) destroy 关键帧红色。
    pick('ctl_a');
    await sleep(150);
    const kfDestroy = document.querySelectorAll('#tlContent .kf.destroy');
    const kfDestroyColor = kfDestroy.length
      ? getComputedStyle(kfDestroy[0], '::before').backgroundColor
      : null;
    const keyItemDestroy = !!document.querySelector('#keyList .key-item.destroy');

    // 2) 拆分 camera_x 至新轨道。
    rightClick('camera_x');
    await sleep(60);
    const splitClicked = clickMenuItem('拆分');
    await sleep(180);
    const ctlB = (S.storyboard.controllers || []).find((c) => c.id !== 'ctl_a');
    const afterSplit = {
      clicked: splitClicked,
      created: !!ctlB,
      bStates: ctlB ? JSON.parse(JSON.stringify(ctlB.states)) : null,
      bMeta: ctlB ? (S.controllerCards[ctlB.id] || []) : [],
      aHasX: (ctlA.states || []).some((s) => s.x !== undefined),
      aKeptOpacity: (ctlA.states || []).some((s) => s.storyboard_opacity !== undefined),
      aMeta: S.controllerCards.ctl_a || [],
      aStillExists: (S.storyboard.controllers || []).some((c) => c.id === 'ctl_a'),
      selectedIsB: S.selectedObjId === (ctlB && ctlB.id)
    };

    // 3) 给 A 分配新卡片（底部“添加controller属性”按钮）。
    pick('ctl_a');
    await sleep(150);
    const addBtn = document.querySelector('#stateForm .ctrl-card-add');
    const addBtnExists = !!addBtn;
    if (addBtn) addBtn.click();
    await sleep(80);
    const cbs = () => Array.from(document.querySelectorAll('#modalBody .cc-add-cb'));
    const modal = {
      opened: !document.querySelector('#modalMask').classList.contains('hidden'),
      cameraXAbsent: !cbs().some((cb) => cb.dataset.card === 'camera_x'),
      opacityAbsent: !cbs().some((cb) => cb.dataset.card === 'opacity_storyboard'),
      bloomPresent: cbs().some((cb) => cb.dataset.card === 'bloom')
    };
    cbs().find((cb) => cb.dataset.card === 'camera_y').checked = true;
    cbs().find((cb) => cb.dataset.card === 'bloom').checked = true;
    const assignBtn = () => Array.from(document.querySelectorAll('#modalFoot .dlg-btn')).find((b) => b.textContent === '分配');
    assignBtn().click();
    await sleep(180);
    const afterAssign = {
      meta: S.controllerCards.ctl_a || [],
      bloomToggle: ctlA.bloom === true,
      panelCameraY: !!card('camera_y'),
      panelBloom: !!card('bloom'),
      controllerCount: (S.storyboard.controllers || []).length
    };

    return { kfDestroy: { count: kfDestroy.length, color: kfDestroyColor }, keyItemDestroy, afterSplit, addBtnExists, modal, afterAssign };
  })()`);

  out.ok = !!(
    out.kfDestroy && out.kfDestroy.count >= 1 && out.kfDestroy.color === 'rgb(255, 59, 59)' &&
    out.keyItemDestroy &&
    out.afterSplit && out.afterSplit.clicked && out.afterSplit.created &&
    out.afterSplit.bStates && out.afterSplit.bStates.length === 2 &&
    out.afterSplit.bStates[0].x === 2 && out.afterSplit.bStates[0].destroy === true &&
    out.afterSplit.bStates[1].x === 5 && out.afterSplit.bStates[1].easing === 'easeoutquad' &&
    out.afterSplit.bMeta.includes('camera_x') &&
    !out.afterSplit.aHasX && out.afterSplit.aKeptOpacity &&
    out.afterSplit.aMeta.includes('opacity_storyboard') && !out.afterSplit.aMeta.includes('camera_x') &&
    out.afterSplit.aStillExists && out.afterSplit.selectedIsB &&
    out.addBtnExists &&
    out.modal && out.modal.opened && out.modal.cameraXAbsent && out.modal.opacityAbsent && out.modal.bloomPresent &&
    out.afterAssign && out.afterAssign.meta.includes('camera_y') && out.afterAssign.meta.includes('bloom') &&
    out.afterAssign.bloomToggle && out.afterAssign.panelCameraY && out.afterAssign.panelBloom &&
    out.afterAssign.controllerCount === 2
  );
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_card_extra_out.json'), JSON.stringify(out, null, 2));
  console.log('EXTRA_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_card_extra_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
