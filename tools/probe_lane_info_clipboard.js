// Verify this batch:
//  1. Object-level selection (tree / context menu path, keyIdx null) makes
//     Ctrl+C copy OBJECTS (not the K0 keyframe) and Ctrl+V paste at playhead.
//  2. Explicit K0 keyframe selection still copies the keyframe.
//  3. Object clip right-click menu gains "在播放头添加关键帧".
//  4. Clicking blank space of a merged lane shows lane stats (no auto-select
//     of the first object), with jump entries and stage preview thumbnails.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lic_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_lic_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lic_proj_'));
const CTR_PATH = path.join(TMP, 'LaneInfoClipboard.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'LaneInfoClipboard',
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
    const sp1 = { id: 'sp1', path: 'bg.jpg', time: 0, x: 0, y: 0, opacity: 1, layer: 0, order: 1,
      states: [{ time: 3, opacity: 0.7 }] };
    const sp2 = { id: 'sp2', path: 'bg.jpg', time: 5, x: 0, y: 0, opacity: 1, layer: 0, order: 0,
      states: [{ time: 8, opacity: 0.7 }] };
    const tx1 = { id: 'tx1', time: 2, text: 'Hi', opacity: 1, layer: 0, order: 2 };
    S.storyboard.sprites.push(sp1, sp2);
    S.storyboard.texts.push(tx1);
    window.__sb.refreshAll();

    const ctrl = (code) => new KeyboardEvent('keydown', { key: code === 'KeyC' ? 'c' : 'v', code, ctrlKey: true, bubbles: true, cancelable: true });
    const menuLabels = () => Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent.trim());

    // --- 1) Object-level selection -> Ctrl+C copies objects, Ctrl+V pastes ---
    window.__sb.selectObject('tx1', null);
    document.dispatchEvent(ctrl('KeyC'));
    const objClipAfter = S.objClipboard.length;
    const kfClipAfter = S.kfClipboard.length;
    window.__sb.preview.setTime(50, false);
    document.dispatchEvent(ctrl('KeyV'));
    const txClone = S.storyboard.texts.find((o) => o.id !== 'tx1');
    const pastedTime = txClone ? txClone.time : null;
    const objPasteSelected = S.selectedIds.length === 1 && S.selectedIds[0] === (txClone && txClone.id);

    // --- 2) Explicit K0 keyframe selection still copies the keyframe ---
    S.selectedIds = ['sp1'];
    S.selectedObjId = 'sp1';
    S.selectedKfs = [{ objId: 'sp1', index: -1 }];
    S.selectedKeyIdx = -1;
    document.dispatchEvent(ctrl('KeyC'));
    const kfCopied = S.kfClipboard.length;
    const objCleared = S.objClipboard.length === 0;

    // --- 3) Object clip context menu offers 在播放头添加关键帧 ---
    window.__sb.selectObject('tx1', null);
    const clip = Array.from(document.querySelectorAll('.clip')).find((c) => c.dataset.id === 'tx1');
    clip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200, button: 2 }));
    const menuHasAddKf = menuLabels().includes('在播放头添加关键帧');
    window.__sb.preview.setTime(7, false);
    const addKfItem = Array.from(document.querySelectorAll('#contextMenu .cm-item'))
      .find((el) => el.textContent.trim() === '在播放头添加关键帧');
    addKfItem.click();
    const tx1HasKfAt7 = (tx1.states || []).some((s) => Math.abs(s.time - 7) < 1e-6);
    document.body.click();

    // --- 4) Merged lane blank click -> lane stats panel ---
    window.__sb.timeline.organizeTracks();
    const rows = Array.from(document.querySelectorAll('.lane-row'));
    const mergedRow = rows.find((r) => {
      const ids = Array.from(r.querySelectorAll('.clip')).map((c) => c.dataset.id);
      return ids.includes('sp1') && ids.includes('sp2');
    });
    const mergedRowFound = !!mergedRow;
    const rowIdsAll = rows.map((r) => Array.from(r.querySelectorAll('.clip')).map((c) => c.dataset.id));
    let laneInfoShown = false;
    let laneInfoIds = [];
    if (mergedRow) {
      const track = mergedRow.querySelector('.lane-track');
      track.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 80, clientY: 60, button: 0 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 80, clientY: 60, button: 0 }));
      laneInfoShown = !!(S.selectedLane && S.selectedLane.objs && S.selectedLane.objs.length === 2);
      laneInfoIds = S.selectedLane ? S.selectedLane.objs.map((o) => o.id) : [];
    }
    const noAutoSelect = S.selectedIds.length === 0 && S.selectedObjId === null;
    const bodyText = document.querySelector('#propBody').textContent;
    const hasStats = bodyText.indexOf('轨道对象统计') >= 0 && bodyText.indexOf('sp1') >= 0 && bodyText.indexOf('sp2') >= 0;
    const thumb = document.querySelector('#propBody .lane-info-thumb');
    const thumbPath = thumb ? thumb.dataset.path : null;
    await new Promise((r) => setTimeout(r, 700));
    const thumbSrc = thumb && thumb.isConnected ? (thumb.src || '') : '';

    // Jump entry: click the first lane-info item -> selects that object.
    let jumpWorks = false;
    const firstItem = document.querySelector('#propBody .lane-info-item');
    if (firstItem) {
      firstItem.click();
      jumpWorks = S.selectedLane === null && S.selectedObjId === 'sp1' && S.selectedIds.length === 1;
    }

    return {
      mergedRowFound, rowIdsAll,
      objClipAfter, kfClipAfter, pastedTime, objPasteSelected,
      kfCopied, objCleared,
      menuHasAddKf, tx1HasKfAt7,
      laneInfoShown, laneInfoIds, noAutoSelect, hasStats, thumbPath,
      thumbHasSrc: thumbSrc.length > 10,
      jumpWorks
    };
  })()`);

  const result = {
    mergedRowFound: out.mergedRowFound,
    rowIdsAll: out.rowIdsAll,
    objClipAfter: out.objClipAfter,
    kfClipAfter: out.kfClipAfter,
    pastedTime: out.pastedTime,
    objPasteSelected: out.objPasteSelected,
    kfCopied: out.kfCopied,
    objCleared: out.objCleared,
    menuHasAddKf: out.menuHasAddKf,
    tx1HasKfAt7: out.tx1HasKfAt7,
    laneInfoShown: out.laneInfoShown,
    laneInfoIds: out.laneInfoIds,
    noAutoSelect: out.noAutoSelect,
    hasStats: out.hasStats,
    thumbPath: out.thumbPath,
    thumbHasSrc: out.thumbHasSrc,
    jumpWorks: out.jumpWorks,
    ok:
      out.objClipAfter === 1 && out.kfClipAfter === 0 &&
      out.pastedTime != null && Math.abs(out.pastedTime - 50) < 1e-6 && out.objPasteSelected === true &&
      out.kfCopied === 1 && out.objCleared === true &&
      out.menuHasAddKf === true && out.tx1HasKfAt7 === true &&
      out.laneInfoShown === true && JSON.stringify(out.laneInfoIds) === JSON.stringify(['sp1', 'sp2']) &&
      out.noAutoSelect === true && out.hasStats === true &&
      out.thumbPath === 'bg.jpg' && out.thumbHasSrc === true && out.jumpWorks === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_lane_info_clipboard_out.json'), JSON.stringify(result, null, 2));
  console.log('LIC_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_lane_info_clipboard_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
