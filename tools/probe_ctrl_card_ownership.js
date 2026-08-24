// Verify controller card uniqueness + panel modes:
//  - track panel only shows the cards ENABLED for that track
//  - dropping a card owned by A onto B's timeline is rejected
//  - the owning track can re-reference its card at another time
//  - preview-empty live-stats panel shows ALL cards (owned ones marked),
//    right-click 启用 creates a new controller track, 删除 clears the card
//    and auto-deletes the track when no enabled cards remain
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_own_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_own_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_own_proj_'));
const CTR_PATH = path.join(TMP, 'Ownership.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Ownership',
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
    const ctlA = { id: 'ctl_a', time: 0, states: [{ time: 0 }] };
    const ctlB = { id: 'ctl_b', time: 0, states: [{ time: 0 }] };
    S.storyboard.controllers.push(ctlA, ctlB);
    S.controllerCards = { ctl_a: ['camera_x'], ctl_b: ['camera_y'] };
    const pick = (id) => {
      S.selectedObjId = id;
      S.selectedKeyIdx = 0;
      S.previewEmptyFocus = false;
      window.__sb.refreshAll();
    };
    const card = (key) => document.querySelector('#stateForm .ctrl-card[data-card="' + key + '"]');
    const setNum = (key, v) => {
      const num = card(key).querySelector('input[type=number]');
      num.value = String(v);
      num.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const dropCard = (key, values, t) => {
      const dt = new DataTransfer();
      // 合成 DataTransfer 需在 dragstart 事件分发过程中写入数据，跨事件直接
      // setData 读取不到。
      const tmp = document.createElement('div');
      tmp.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-cytoid-ctrl-card', JSON.stringify({ groupKey: key, values }));
      });
      tmp.dispatchEvent(new DragEvent('dragstart', { bubbles: false, cancelable: true, dataTransfer: dt }));
      const content = document.querySelector('#tlContent');
      const rect = content.getBoundingClientRect();
      const pxPerSec = window.__sb.timeline.pxPerSec || 60;
      const clientX = rect.left + t * pxPerSec;
      content.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX }));
      content.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX }));
      return dt.getData('application/x-cytoid-ctrl-card');
    };
    const rightClick = (key) => {
      const el = card(key);
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    };
    const clickMenuItem = (text) => {
      const item = Array.from(document.querySelectorAll('#contextMenu .cm-item')).find((el) => el.textContent.includes(text));
      if (!item) return false;
      item.click();
      return true;
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // A（已启用 camera_x）设置相机 X 值。
    pick('ctl_a');
    await sleep(120);
    setNum('camera_x', 2);
    await sleep(80);
    const aClaims = {
      x: ctlA.states[0].x,
      cardInA: !!card('camera_x'),
      cameraYHidden: !card('camera_y'),
      bloomHidden: !card('bloom')
    };

    // B 面板：只显示 B 启用的 camera_y；camera_x / bloom 都不显示。
    pick('ctl_b');
    await sleep(120);
    const bPanel = {
      cameraXHidden: !card('camera_x'),
      cameraYVisible: !!card('camera_y'),
      bloomHidden: !card('bloom')
    };

    // 把 camera_x 拖到 B 的时间轴：应被拒绝，B 不新增关键帧。
    dropCard('camera_x', { x: 5 }, 5);
    await sleep(120);
    const bAfterReject = {
      stateCount: (ctlB.states || []).length,
      hasKeyframeWithX: (ctlB.states || []).some((s) => s.x !== undefined),
      aStillOwns: ctlA.states[0].x === 2
    };

    // A（归属轨道）仍可见卡片，且可再次引用到另一时间。
    pick('ctl_a');
    await sleep(120);
    const aRevisit = { cameraXVisible: !!card('camera_x') };
    dropCard('camera_x', { x: 9 }, 9);
    await sleep(120);
    // 捕获时快照：后续“删除”步骤会清空该卡片的 storyboard 条目。
    const kfAt9Snap = JSON.parse(JSON.stringify((ctlA.states || []).find((s) => Math.abs(s.time - 9) < 1e-6)));
    const aReuse = {
      kfAt9: kfAt9Snap,
      stateCount: (ctlA.states || []).length
    };

    // 预览空白处：实时统计面板显示全部卡片，已占用卡片带“已占用”标记。
    S.previewEmptyFocus = true;
    S.selectedObjId = null;
    S.selectedKeyIdx = null;
    window.__sb.refreshAll();
    await sleep(150);
    const live = {
      cameraXOwned: !!card('camera_x') && card('camera_x').classList.contains('owned') &&
        !!card('camera_x').querySelector('.ctrl-card-owner'),
      bloomUnowned: !!card('bloom') && !card('bloom').classList.contains('owned'),
      smoothingGone: !card('scanline_smoothing'),
      hasLiveStats: !!document.querySelector('#propBody [data-live-stat]')
    };

    // 右键未启用的 bloom 卡 → 启用：创建新控制器轨道 C。
    rightClick('bloom');
    await sleep(60);
    const enableClicked = clickMenuItem('启用');
    await sleep(150);
    const ctlC = (S.storyboard.controllers || []).find((c) => c.id !== 'ctl_a' && c.id !== 'ctl_b');
    const afterEnable = {
      clicked: enableClicked,
      created: !!ctlC,
      bloomInMeta: !!(ctlC && (S.controllerCards[ctlC.id] || []).includes('bloom')),
      bloomToggle: !!(ctlC && ctlC.bloom === true),
      selectedIsC: S.selectedObjId === (ctlC && ctlC.id)
    };

    // 回到实时统计面板：camera_x 仍被 A 占用，右键删除。
    S.previewEmptyFocus = true;
    S.selectedObjId = null;
    S.selectedKeyIdx = null;
    window.__sb.refreshAll();
    await sleep(150);
    rightClick('camera_x');
    await sleep(60);
    const delClicked = clickMenuItem('删除');
    await sleep(150);
    const afterDelete = {
      clicked: delClicked,
      aGone: !(S.storyboard.controllers || []).some((c) => c.id === 'ctl_a'),
      aFieldsCleared: !(ctlA.states || []).some((s) => s.x !== undefined),
      cStillThere: !!(S.storyboard.controllers || []).some((c) => c.id === (ctlC && ctlC.id)),
      cameraXUnowned: !!card('camera_x') && !card('camera_x').classList.contains('owned')
    };

    // 跳转：B 面板右键 camera_y → 跳转选中 B。
    rightClick('camera_y');
    await sleep(60);
    const jumpClicked = clickMenuItem('跳转至对应轨道');
    await sleep(120);
    const afterJump = { clicked: jumpClicked, selectedIsB: S.selectedObjId === 'ctl_b' };

    return { aClaims, bPanel, bAfterReject, aRevisit, aReuse, live, afterEnable, afterDelete, afterJump };
  })()`);

  out.ok = !!(
    out.aClaims && out.aClaims.x === 2 && out.aClaims.cardInA &&
    out.aClaims.cameraYHidden && out.aClaims.bloomHidden &&
    out.bPanel && out.bPanel.cameraXHidden && out.bPanel.cameraYVisible && out.bPanel.bloomHidden &&
    out.bAfterReject && out.bAfterReject.stateCount === 1 && !out.bAfterReject.hasKeyframeWithX &&
    out.bAfterReject.aStillOwns &&
    out.aRevisit && out.aRevisit.cameraXVisible &&
    out.aReuse && out.aReuse.kfAt9 && out.aReuse.kfAt9.x === 9 && out.aReuse.stateCount === 2 &&
    out.live && out.live.cameraXOwned && out.live.bloomUnowned && out.live.smoothingGone && out.live.hasLiveStats &&
    out.afterEnable && out.afterEnable.clicked && out.afterEnable.created &&
    out.afterEnable.bloomInMeta && out.afterEnable.bloomToggle && out.afterEnable.selectedIsC &&
    out.afterDelete && out.afterDelete.clicked && out.afterDelete.aGone &&
    out.afterDelete.aFieldsCleared && out.afterDelete.cStillThere && out.afterDelete.cameraXUnowned &&
    out.afterJump && out.afterJump.clicked && out.afterJump.selectedIsB
  );
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_card_ownership_out.json'), JSON.stringify(out, null, 2));
  console.log('OWN_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_card_ownership_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
