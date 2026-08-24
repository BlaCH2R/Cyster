// Verify this batch:
//  1. Double-clicking a clip selects all its keyframes (mousedown-based, so it
//     survives the lane re-render that broke the native dblclick event).
//  2. 上/下移一层 skips unavailable layers (no "已有 order" toast, no exception).
//  3. 批量上/下移一层 moves every selected block independently.
//  4. 整理轨道 preserves the vertical order of time-overlapping objects
//     (satisfiable constraints) and never crashes on cyclic packs.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dso_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_dso_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dso_proj_'));
const CTR_PATH = path.join(TMP, 'DblClickShiftOrganize.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'DblClickShiftOrganize',
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
    const mk = (id, t0, t1, layer, order) => ({
      id, path: 'bg.jpg', time: t0, opacity: 1, layer, order,
      states: [{ time: t1, opacity: 0.8 }]
    });

    // --- 1) Double-click selects all keyframes ---
    const D = { id: 'D', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1,
      states: [{ time: 3, opacity: 0.7 }, { time: 7, opacity: 0.5 }] };
    S.storyboard.sprites.push(D);
    window.__sb.refreshAll();
    const clickClip = (id) => {
      const clip = Array.from(document.querySelectorAll('.clip')).find((c) => c.dataset.id === id);
      if (!clip) return false;
      clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 80, clientY: 30, button: 0 }));
      return true;
    };
    clickClip('D');
    await new Promise((r) => setTimeout(r, 60));
    clickClip('D'); // 第二次按下（同一对象，间隔 < 350ms）→ 全选关键帧
    await new Promise((r) => setTimeout(r, 60));
    const dblOk = S.selectedKfs.length === 3 &&
      S.selectedKfs.every((k) => k.objId === 'D') &&
      S.selectedIds.length === 1 && S.selectedIds[0] === 'D';

    // --- 2) 下移一层：相邻层（order1 的 B）有对象 → 与 B 互换顺序 ---
    // 用不同类型避免打包同轨，默认一对象一轨（A 与 B 时间重叠也互换）。
    const A = mk('A', 0, 3, 0, 2);
    const B = { id: 'B', text: 'B', time: 2, opacity: 1, layer: 0, order: 1, states: [{ time: 5, opacity: 0.8 }] };
    const C = { id: 'C', path: 'bg.jpg', time: 6, opacity: 1, layer: 0, order: 0, states: [{ time: 9, opacity: 0.8 }] };
    S.storyboard.sprites = [A];
    S.storyboard.texts = [B];
    S.storyboard.videos = [C];
    window.__sb.refreshAll();
    S.selectedIds = ['A'];
    S.selectedObjId = 'A';
    S.selectedKfs = [];
    let skipErr = null;
    try { window.__sb.shiftObjectOrder ? window.__sb.shiftObjectOrder('A', 1) : null; } catch (e) { skipErr = String(e); }
    // A(0-3) 下移 → 与相邻层 B(order1) 互换：A=1、B=2。
    const skipOk = !skipErr && A.order === 1 && B.order === 2 && C.order === 0;

    // --- 3) 批量上移一层：选中 B2、C2 各自上移（相邻也是选中对象时跳过）---
    const A2 = mk('A2', 0, 3, 0, 3);
    const B2 = { id: 'B2', text: 'B2', time: 4, opacity: 1, layer: 0, order: 2, states: [{ time: 7, opacity: 0.8 }] };
    const C2 = { id: 'C2', path: 'bg.jpg', time: 8, opacity: 1, layer: 0, order: 1, states: [{ time: 11, opacity: 0.8 }] };
    // D2 与 A2 时间重叠，避免整理轨道时被打包进同一条轨道。
    const D2 = { id: 'D2', path: 'bg.jpg', time: 1, opacity: 1, layer: 0, order: 0, states: [{ time: 4, opacity: 0.8 }] };
    S.storyboard.sprites = [A2, D2];
    S.storyboard.texts = [B2];
    S.storyboard.videos = [C2];
    window.__sb.refreshAll();
    S.selectedIds = ['B2', 'C2'];
    S.selectedObjId = 'B2';
    S.selectedKfs = [];
    try { window.__sb.shiftObjectOrder('C2', -1); } catch (e) { skipErr = String(e); }
    // B2 上移与 A2 互换（B2=3、A2=2）；C2 的相邻层是选中对象 B2 → 跳过不动。
    const batchOk = !skipErr && A2.order === 2 && B2.order === 3 && C2.order === 1 && D2.order === 0;

    // --- 4) 整理轨道：重叠对象保持上下顺序（可满足情形） ---
    const P = mk('P', 0, 3, 0, 2);
    const Q = { id: 'Q', text: 'Q', time: 2, opacity: 1, layer: 0, order: 1, states: [{ time: 5, opacity: 0.8 }] };
    const R = { id: 'R', path: 'bg.jpg', time: 6, opacity: 1, layer: 0, order: 0, states: [{ time: 9, opacity: 0.8 }] };
    S.storyboard.sprites = [P];
    S.storyboard.texts = [Q];
    S.storyboard.videos = [R];
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    const orgErr = null;
    // P 与 Q 重叠，整理后 P 的 order 必须仍大于 Q
    const overlapOk = P.order > Q.order;
    // 循环情形（A/C 同轨 + B 与两者重叠）不应崩溃且 order 有效
    const W = mk('W', 0, 3, 0, 2);
    const X = mk('X', 2, 5, 0, 1);
    const Y = mk('Y', 5, 8, 0, 0);
    S.storyboard.sprites = [W, X, Y];
    S.storyboard.texts = [];
    S.storyboard.videos = [];
    window.__sb.refreshAll();
    let cycleErr = null;
    try { window.__sb.timeline.organizeTracks(); } catch (e) { cycleErr = String(e); }
    const cycleOk = !cycleErr && [W, X, Y].every((o) => Number.isInteger(o.order));

    return { dblOk, skipOk, batchOk, overlapOk, cycleOk,
      orders: [A.order, B.order, C.order, A2.order, B2.order, C2.order, D2.order, P.order, Q.order] };
  })()`);

  const result = {
    dblOk: out.dblOk,
    skipOk: out.skipOk,
    batchOk: out.batchOk,
    overlapOk: out.overlapOk,
    cycleOk: out.cycleOk,
    orders: out.orders,
    ok: out.dblOk === true && out.skipOk === true && out.batchOk === true &&
      out.overlapOk === true && out.cycleOk === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_dblclick_shiftorder_organize_out.json'), JSON.stringify(result, null, 2));
  console.log('DSO_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_dblclick_shiftorder_organize_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
