// Repro: lock order levels 99 and -10, run 整理轨道, and inspect the lane
// order / order values / display. 大 order 在上 → locked 99 must stay at the
// top, -10 at the bottom, free objects between them.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_loo_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_loo_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_loo_proj_'));
const CTR_PATH = path.join(TMP, 'LockedOrdersOrganize.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const setup = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'LockedOrdersOrganize',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!setup) throw new Error('project create/load failed');

  // 构造“99 轨道在底部 + 锁定 99/-10”的项目并持久化
  const built = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    // 5 个自由 sprite + 2 个锁定 order 的 sprite（99 / -10）
    const mk = (id, t0, t1, order) => ({ id, path: 'bg.jpg', time: t0, opacity: 1, layer: 0, order, states: [{ time: t1, opacity: 0.8 }] });
    const free = [
      mk('s1', 0, 3, 0), mk('s2', 4, 7, 0), mk('s3', 8, 11, 0),
      mk('s4', 12, 15, 0), mk('s5', 16, 19, 0)
    ];
    const locked99 = mk('sprite_12', 20, 23, 99);
    const lockedNeg = mk('sprite_2', 24, 27, -10);
    S.storyboard.sprites.push(...free, locked99, lockedNeg);
    window.__sb.refreshAll();
    // 预置一个“99 轨道在底部”的合并配置（用户实际状态）
    S.projectConfig.editor = S.projectConfig.editor || {};
    S.projectConfig.editor.timeline = S.projectConfig.editor.timeline || { trackGroups: { stage: [], note_controller: [], controller: [] } };
    S.projectConfig.editor.timeline.trackGroups.stage = [
      ['s1', 's2', 's3'], ['s4', 's5'], ['sprite_12'], ['sprite_2']
    ];
    S.projectConfig.editor.timeline.lockedOrders = [99, -10];
    window.__sb.refreshAll();
    await window.__sb.saveStoryboard();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  })()`);

  // 重开项目（模拟用户下次启动），再整理轨道
  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const r = await window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR_PATH)} });
    await window.__sb.loadLevelInfo(r.info, { projectPath: r.projectPath, config: r.config });
    const loadedLocks = window.__sb.timeline.lockedOrders ? [...window.__sb.timeline.lockedOrders] : [];
    const preDisplay = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    window.__sb.timeline.organizeTracks();
    const laneOrder = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    const orderBatches = Array.from(document.querySelectorAll('.tlh-lane .lane-order')).map((el) => el.textContent.trim());
    const trackGroups = (window.__sb.readCysterTrackGroups() || {}).stage || null;
    const sprites = S.storyboard.sprites || [];
    const freeOrders = sprites.filter((o) => o.id.startsWith('s') && !o.id.startsWith('sprite')).map((o) => o.order);
    const locked99 = sprites.find((o) => o.id === 'sprite_12');
    const lockedNeg = sprites.find((o) => o.id === 'sprite_2');
    return {
      laneOrder, orderBatches, trackGroups, freeOrders,
      locked99Order: locked99 ? locked99.order : null, lockedNegOrder: lockedNeg ? lockedNeg.order : null,
      locked99Idx: laneOrder.indexOf('sprite_12'), lockedNegIdx: laneOrder.indexOf('sprite_2'),
      preDisplay, loadedLocks
    };
  })()`);

  const result = {
    laneOrder: out.laneOrder,
    orderBatches: out.orderBatches,
    trackGroups: out.trackGroups,
    freeOrders: out.freeOrders,
    locked99Order: out.locked99Order,
    lockedNegOrder: out.lockedNegOrder,
    locked99Idx: out.locked99Idx,
    lockedNegIdx: out.lockedNegIdx
  };
  fs.writeFileSync(path.join(__dirname, 'probe_locked_orders_organize_out.json'), JSON.stringify(result, null, 2));
  console.log('LOO_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_locked_orders_organize_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
