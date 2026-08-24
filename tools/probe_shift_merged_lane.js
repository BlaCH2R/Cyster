// Verify 上/下移一层 only moves the SELECTED time block: with merged lanes
// (several time-disjoint objects sharing one order), shifting one object swaps
// it with the adjacent lane's object but leaves the lane-mates untouched.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_msh_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_msh_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_msh_proj_'));
const CTR_PATH = path.join(TMP, 'ShiftMerged.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'ShiftMerged',
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
    const mk = (id, t0, t1, order) => ({ id, path: 'bg.jpg', time: t0, opacity: 1, layer: 0, order,
      states: [{ time: t1, opacity: 0.8 }] });
    // X/X2 同层（order 0，时间不重叠共轨）；Y/Y2 同层（order 1）。
    const X = mk('X', 0, 3, 0);
    const X2 = mk('X2', 4, 7, 0);
    const Y = mk('Y', 0, 3, 1);
    const Y2 = mk('Y2', 4, 7, 1);
    S.storyboard.sprites = [X, X2, Y, Y2];
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 150));
    const lanesBefore = (window.__sb.readCysterTrackGroups() || {}).stage || [];
    S.selectedIds = ['X'];
    S.selectedObjId = 'X';
    S.selectedKfs = [];
    window.__sb.shiftObjectOrder('X', -1); // X 上移一层
    await new Promise((r) => setTimeout(r, 150));
    const lanesAfter = (window.__sb.readCysterTrackGroups() || {}).stage || [];
    return {
      lanesBefore: JSON.parse(JSON.stringify(lanesBefore)),
      lanesAfter: JSON.parse(JSON.stringify(lanesAfter)),
      orders: { X: X.order, X2: X2.order, Y: Y.order, Y2: Y2.order }
    };
  })()`);

  // X 与 Y 互换 order 并互换轨道；同轨成员 X2 / Y2 保持原 order / 原轨道。
  out.ok = !!(
    out.orders && out.orders.X === 1 && out.orders.Y === 0 &&
    out.orders.X2 === 0 && out.orders.Y2 === 1 &&
    out.lanesAfter && out.lanesAfter.length === 2 &&
    out.lanesAfter.some((l) => l.includes('X') && l.includes('Y2')) &&
    out.lanesAfter.some((l) => l.includes('Y') && l.includes('X2'))
  );
  fs.writeFileSync(path.join(__dirname, 'probe_shift_merged_lane_out.json'), JSON.stringify(out, null, 2));
  console.log('MSH_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_shift_merged_lane_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
