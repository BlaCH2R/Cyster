// probe_snap.js — debug the clip-resize snap behavior regression.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_snap_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const tl = window.__sb.timeline;
    const objs = tl.objects.filter(o => o.type === 'sprite' && typeof o.clipStart === 'number');
    const obj = objs[0];
    const before = obj.clipStart;
    // Replicate verify_v2: right-edge test zoomed to 200 earlier
    tl.setZoom(200);
    const raw = before + 2;
    const snapped = tl.snapTime(raw);
    const near = tl.snapTargets.filter(t => Math.abs(t - raw) < 2).sort((a, b) => a - b).slice(0, 10);
    tl.startResizeClip({ preventDefault() {}, clientX: 100 }, obj, 'start');
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100 + 2 * tl.pxPerSec }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const after = window.__sb.timeline.objects.find(o => o.id === obj.id).clipStart;
    return { before, raw, snapped, near, after, time: tl.time, pxPerSec: tl.pxPerSec };
  })()`);
  console.log('SNAP:', JSON.stringify(out));
  app.exit(0);
});
