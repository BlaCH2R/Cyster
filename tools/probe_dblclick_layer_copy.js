// Verify this batch:
//  1. Double-clicking a timeline clip selects ALL keyframes of that object.
//  2. The clip right-click menu no longer contains "选择对象".
//  3. Copied / pasted stage objects keep their source layer; only order is
//     reassigned (top of that layer, no duplicate orders).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlc_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_dlc_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlc_proj_'));
const CTR_PATH = path.join(TMP, 'DblClickLayerCopy.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'DblClickLayerCopy',
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
    const sp = { id: 'sp1', path: 'bg.jpg', time: 0, x: 0, y: 0, opacity: 1, layer: 1, order: 0,
      states: [{ time: 3, opacity: 0.7 }, { time: 7, opacity: 0.4 }] };
    S.storyboard.sprites.push(sp);
    window.__sb.refreshAll();

    // --- 1) Double-click clip -> select all keyframes ---
    const clip = Array.from(document.querySelectorAll('.clip')).find((c) => c.dataset.id === 'sp1');
    clip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 100, clientY: 60, button: 0 }));
    const allKfSelected = S.selectedKfs.length === 3 &&
      S.selectedKfs.every((k) => k.objId === 'sp1') &&
      JSON.stringify(S.selectedKfs.map((k) => k.index).sort((a, b) => a - b)) === JSON.stringify([-1, 0, 1]) &&
      S.selectedIds.length === 1 && S.selectedIds[0] === 'sp1';

    // --- 2) Clip context menu has no 选择对象 ---
    clip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200, button: 2 }));
    const menuText = document.querySelector('#contextMenu').textContent;
    const noSelectItem = menuText.indexOf('选择对象') < 0;
    document.body.click();

    // --- 3a) copySelection keeps layer, reassigns order only ---
    S.selectedIds = ['sp1'];
    S.selectedObjId = 'sp1';
    window.__sb.copySelection(false);
    const clone1 = S.storyboard.sprites.find((o) => o.id !== 'sp1' && o.id.indexOf('sprite_') === 0);
    const clone1LayerOrder = clone1 ? [clone1.layer, clone1.order] : null;

    // --- 3b) clipboard paste keeps layer too ---
    window.__sb.copyObjectsToClipboard();
    window.__sb.preview.setTime(20, false);
    window.__sb.pasteObjectsAtPlayhead();
    const clones = S.storyboard.sprites.filter((o) => o.id !== 'sp1');
    const layers = clones.map((o) => o.layer);
    const orders = clones.map((o) => o.order);
    const dupOrders = orders.filter((x, i) => orders.indexOf(x) !== i);

    return {
      allKfSelected, noSelectItem,
      clone1LayerOrder,
      layers, orders, dupOrders,
      kfCount: S.selectedKfs.length
    };
  })()`);

  const result = {
    allKfSelected: out.allKfSelected,
    noSelectItem: out.noSelectItem,
    clone1LayerOrder: out.clone1LayerOrder,
    layers: out.layers,
    orders: out.orders,
    dupOrders: out.dupOrders,
    ok:
      out.allKfSelected === true && out.noSelectItem === true &&
      out.clone1LayerOrder && out.clone1LayerOrder[0] === 1 && out.clone1LayerOrder[1] === 1 &&
      out.layers.every((l) => l === 1) && out.dupOrders.length === 0
  };
  fs.writeFileSync(path.join(__dirname, 'probe_dblclick_layer_copy_out.json'), JSON.stringify(result, null, 2));
  console.log('DLC_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_dblclick_layer_copy_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
