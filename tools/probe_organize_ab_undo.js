// Repro: A(50.999-58.200, order 6) and B(55.799-58.199, order 8) overlap.
// Order 大者在上 → 整理后 B 必须在 A 之上（含锁定低层级时也不能出错）。
// 并验证 undo 真正把 order 与轨道配置写回文件。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_abu_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_abu_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_abu_proj_'));
const CTR_PATH = path.join(TMP, 'OrganizeABUndo.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'OrganizeABUndo',
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
    const A = { id: 'A', path: 'bg.jpg', time: 50.999, opacity: 1, layer: 0, order: 6, states: [{ time: 58.2, opacity: 0.8 }] };
    const B = { id: 'B', path: 'bg.jpg', time: 55.799, opacity: 1, layer: 0, order: 8, states: [{ time: 58.199, opacity: 0.8 }] };
    S.storyboard.sprites.push(A, B);
    window.__sb.refreshAll();
    const pre = { a: [A.order], b: [B.order] };
    const preLanes = (window.__sb.readCysterTrackGroups() || {}).stage || null;

    window.__sb.timeline.organizeTracks();
    const post = { a: A.order, b: B.order };
    const bAboveA = B.order > A.order;

    // 撤销
    window.__sb.undo();
    const undoA = A.order, undoB = B.order;
    const undoLanes = (window.__sb.readCysterTrackGroups() || {}).stage || null;
    // 撤销后再读一次 storyboard 里的实际值（对象引用可能被替换）
    const Anow = S.storyboard.sprites.find((o) => o.id === 'A');
    const Bnow = S.storyboard.sprites.find((o) => o.id === 'B');

    return { pre, preLanes, post, bAboveA,
      undoA, undoB, undoLanes,
      undoAnow: Anow ? Anow.order : null, undoBnow: Bnow ? Bnow.order : null };
  })()`);

  // undo 之后异步写盘：稍等再读 .ctr 与 storyboard 文件，确认层级真正回退。
  await new Promise((r) => setTimeout(r, 900));
  const projDir = path.dirname(CTR_PATH);
  let fileOrders = null;
  let ctrStage = null;
  try {
    const sb = JSON.parse(fs.readFileSync(path.join(projDir, 'storyboard_base.json'), 'utf8'));
    const a = (sb.sprites || []).find((o) => o.Id === 'A');
    const b = (sb.sprites || []).find((o) => o.Id === 'B');
    fileOrders = { a: a ? a.States[0].Order : null, b: b ? b.States[0].Order : null };
  } catch (e) { fileOrders = { error: String(e && e.message || e) }; }
  try {
    const ctr = JSON.parse(fs.readFileSync(CTR_PATH, 'utf8'));
    ctrStage = ctr && ctr.editor && ctr.editor.timeline && ctr.editor.timeline.trackGroups && ctr.editor.timeline.trackGroups.stage;
  } catch (e) { ctrStage = { error: String(e && e.message || e) }; }

  // 锁定低层级（order 0，仅与 A 重叠）：B 也不能被“吸”到 A 下面。
  const locked = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const A = { id: 'A', path: 'bg.jpg', time: 50.999, opacity: 1, layer: 0, order: 6, states: [{ time: 58.2, opacity: 0.8 }] };
    const B = { id: 'B', path: 'bg.jpg', time: 55.799, opacity: 1, layer: 0, order: 8, states: [{ time: 58.199, opacity: 0.8 }] };
    const L = { id: 'L', path: 'bg.jpg', time: 50, opacity: 1, layer: 0, order: 0, states: [{ time: 51, opacity: 0.8 }] };
    S.storyboard.sprites.push(A, B, L);
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.timeline.setLockedOrders([0]);
    window.__sb.timeline.organizeTracks();
    return { bAboveA: B.order > A.order, orders: { a: A.order, b: B.order, l: L.order } };
  })()`);

  const result = {
    pre: out.pre,
    preLanes: out.preLanes,
    post: out.post,
    bAboveA: out.bAboveA,
    lockedBAboveA: locked.bAboveA,
    lockedOrders: locked.orders,
    undoA: out.undoA, undoB: out.undoB,
    undoLanes: out.undoLanes,
    undoAnow: out.undoAnow, undoBnow: out.undoBnow,
    fileOrders, ctrStage
  };
  fs.writeFileSync(path.join(__dirname, 'probe_organize_ab_undo_out.json'), JSON.stringify(result, null, 2));
  console.log('ABU_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_organize_ab_undo_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
