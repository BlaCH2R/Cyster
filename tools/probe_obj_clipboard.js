// Verify the object clipboard flow: Ctrl+C copies selected objects, Ctrl+V
// pastes them anchored at the playhead (earliest keyframe lands on the
// playhead, internal spacing kept). Also verifies:
//   - pasted stage clones get a fresh top-layer order (no duplicate orders)
//   - keyframe clipboard and object clipboard are mutually exclusive
//   - typing in an input field does NOT trigger the editor shortcuts
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_objc_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_objc_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_objc_proj_'));
const CTR_PATH = path.join(TMP, 'ObjClipboard.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'ObjClipboard',
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

    // Sprite: initial at t=10, state at t=15 (2 keyframes). Text: t=12 only.
    const sp = { id: 'sp1', path: 'bg.jpg', time: 10, x: 0, y: 0, opacity: 1, layer: 0, order: 3,
      states: [{ time: 15, opacity: 0.5 }] };
    const tx = { id: 'tx1', time: 12, text: 'Hi', opacity: 1, layer: 1, order: 1 };
    S.storyboard.sprites.push(sp);
    S.storyboard.texts.push(tx);
    window.__sb.refreshAll();

    // --- 1) Direct API: copy both objects, paste at playhead t=30 ---
    S.selectedIds = ['sp1', 'tx1'];
    S.selectedObjId = 'sp1';
    S.selectedKeyIdx = -1;
    window.__sb.copyObjectsToClipboard();
    const objClipCount = S.objClipboard.length;
    const kfClipCleared = S.kfClipboard.length === 0;
    window.__sb.preview.setTime(30, false);
    window.__sb.pasteObjectsAtPlayhead();

    const spClone = S.storyboard.sprites.find((o) => o.id !== 'sp1');
    const txClone = S.storyboard.texts.find((o) => o.id !== 'tx1');
    const spCloneKfTimes = spClone ? window.__sb.timeline ? [spClone.time, (spClone.states[0] || {}).time] : null : null;
    const txCloneTime = txClone ? txClone.time : null;
    const stageIds = [...S.storyboard.sprites, ...S.storyboard.texts, ...S.storyboard.videos, ...S.storyboard.lines];
    const orders = stageIds.map((o) => (o.layer != null ? o.layer : 0) + '/' + (o.order != null ? o.order : 0));
    const dupOrders = orders.filter((x, i) => orders.indexOf(x) !== i);
    const pastedSelected = S.selectedIds.length === 2 && S.selectedIds.includes(spClone.id) && S.selectedIds.includes(txClone.id);

    // --- 2) Shortcut: select the pasted sprite only, Ctrl+C then move playhead and Ctrl+V ---
    S.selectedIds = [spClone.id];
    S.selectedObjId = spClone.id;
    S.objClipboard = [];
    window.__sb.refreshAll();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, bubbles: true, cancelable: true }));
    const viaKeyCopy = S.objClipboard.length;
    window.__sb.preview.setTime(50, false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', ctrlKey: true, bubbles: true, cancelable: true }));
    const viaKeyPaste = S.storyboard.sprites.filter((o) => o.id !== 'sp1').length;
    const pastedAt50 = S.storyboard.sprites.some((o) => Math.abs((o.time != null ? o.time : -1) - 50) < 1e-6);

    // --- 3) Typing guard: focus an input, dispatch Ctrl+C / Ctrl+V ---
    const beforeObjClip = S.objClipboard.length;
    const inp = document.createElement('input');
    document.body.appendChild(inp);
    inp.focus();
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, bubbles: true, cancelable: true }));
    const afterObjClip = S.objClipboard.length;
    const typedGuard = beforeObjClip === afterObjClip;
    inp.remove();

    // --- 4) Keyframe clipboard + mutual exclusion: select two kfs, Ctrl+C ---
    const kfSrc = S.storyboard.sprites.find((o) => o.id === spClone.id);
    const kfIndexes = [];
    const kfs = window.__sb.timeline ? null : null;
    S.selectedObjId = kfSrc.id;
    S.selectedKeyIdx = 1;
    S.selectedKfs = [{ objId: kfSrc.id, index: -1 }, { objId: kfSrc.id, index: 0 }];
    window.__sb.copyKeyframesToClipboard();
    const kfClipCount = S.kfClipboard.length;
    const objClipCleared = S.objClipboard.length === 0;
    window.__sb.preview.setTime(80, false);
    window.__sb.pasteKeyframesAtPlayhead();
    const kfTimes = (kfSrc.states || []).map((s) => s.time).sort((a, b) => a - b);
    const has80 = kfTimes.some((t) => Math.abs(t - 80) < 1e-6);
    const has85 = kfTimes.some((t) => Math.abs(t - 85) < 1e-6);

    return {
      objClipCount, kfClipCleared,
      spCloneKfTimes, txCloneTime, orders, dupOrders, pastedSelected,
      viaKeyCopy, viaKeyPaste, pastedAt50, typedGuard,
      kfClipCount, objClipCleared, kfTimes, has80, has85
    };
  })()`);

  const result = {
    objClipCount: out.objClipCount,
    kfClipCleared: out.kfClipCleared,
    spCloneKfTimes: out.spCloneKfTimes,
    txCloneTime: out.txCloneTime,
    orders: out.orders,
    dupOrders: out.dupOrders,
    pastedSelected: out.pastedSelected,
    viaKeyCopy: out.viaKeyCopy,
    viaKeyPaste: out.viaKeyPaste,
    pastedAt50: out.pastedAt50,
    typedGuard: out.typedGuard,
    kfClipCount: out.kfClipCount,
    objClipCleared: out.objClipCleared,
    kfTimes: out.kfTimes,
    has80: out.has80,
    has85: out.has85,
    ok:
      out.objClipCount === 2 && out.kfClipCleared === true &&
      out.spCloneKfTimes && Math.abs(out.spCloneKfTimes[0] - 30) < 1e-6 && Math.abs(out.spCloneKfTimes[1] - 35) < 1e-6 &&
      out.txCloneTime != null && Math.abs(out.txCloneTime - 32) < 1e-6 &&
      out.dupOrders.length === 0 && out.pastedSelected === true &&
      out.viaKeyCopy === 1 && out.viaKeyPaste === 2 && out.pastedAt50 === true &&
      out.typedGuard === true &&
      out.kfClipCount === 2 && out.objClipCleared === true && out.has80 === true && out.has85 === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_obj_clipboard_out.json'), JSON.stringify(result, null, 2));
  console.log('OBJC_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_obj_clipboard_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
