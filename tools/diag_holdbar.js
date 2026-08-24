// Diagnose holdbar length: compare scanner start/end positions vs current bar.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const DIR = 'D:/sd/Cytoid flies';
function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const chartPath = 'chart.re.txt';
  const sbPath = 'chart.re_storyboard.json';
  const charts = [{
    type: 're', path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), 'utf8'),
    storyboardPath: sbPath,
    storyboardContent: fs.readFileSync(path.join(DIR, sbPath), 'utf8')
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) { const st = fs.statSync(path.join(DIR, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: DIR, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const info = buildInfo();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const ch = p.chart;
    const S = p.ctxInfo().S;
    const out = [];
    for (const note of ch.notes) {
      if (note.type !== 1 && note.type !== 2) continue;
      const ss = ch.getScannerPositionY(note.start_time);
      const se = ch.getScannerPositionY(note.end_time);
      const scanDist = Math.abs(se - ss) * S;
      // theoretical: hold_tick ratio * page height
      const page = ch.model.page_list[note.page_index];
      const ratio = (note.hold_tick || 0) / (page.end_tick - page.start_tick);
      const pageH = ch.verticalRatio * 2 * ch.baseSize;
      const theoDist = ratio * pageH * S;
      // note position delta
      const noteDist = Math.abs(se - note.worldY) * S;
      out.push({
        id: note.id, type: note.type, dir: note.direction,
        startTick: note.tick, holdTick: note.hold_tick,
        scanStart: +ss.toFixed(3), scanEnd: +se.toFixed(3),
        scanDistPx: Math.round(scanDist),
        theoDistPx: Math.round(theoDist),
        noteDistPx: Math.round(noteDist),
        noteWorldY: +note.worldY.toFixed(3)
      });
      if (out.length >= 10) break;
    }
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  const render = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ch = p.chart;
    const hold = ch.noteById(0);
    const t = (hold.start_time + hold.end_time) / 2;
    p.setTime(t, false); p.render();
    const info2 = p.ctxInfo();
    const pos = p.notePos(hold, info2);
    const d = 2.234 * info2.S;
    const scanStartY = ch.getScannerPositionY(hold.start_time);
    const scanEndY = ch.getScannerPositionY(hold.end_time);
    const scanStartPx = p.worldToPx(0, scanStartY, info2).y;
    const scanEndPx = p.worldToPx(0, scanEndY, info2).y;
    // list all bright rows above the note
    const bright = [];
    for (let y = Math.max(0, Math.round(pos.y - 220)); y < Math.round(pos.y - d / 2); y++) {
      const c = ctx.getImageData(Math.round(pos.x), y, 1, 1).data;
      if (c[0] + c[1] + c[2] > 80) bright.push({ y, rgb: [c[0], c[1], c[2]] });
    }
    const top = bright.length ? bright[0].y : null;
    return {
      noteY: Math.round(pos.y),
      noteTop: Math.round(pos.y - d / 2),
      scanStartPx: Math.round(scanStartPx),
      scanEndPx: Math.round(scanEndPx),
      scanDistPx: Math.round(Math.abs(scanEndPx - scanStartPx)),
      barTop: top,
      brightRows: bright.slice(0, 20),
      barMeasuredLen: top != null ? Math.round(pos.y - top) : null
    };
  })()`);
  console.log('RENDER:', JSON.stringify(render));
  app.exit(0);
});
