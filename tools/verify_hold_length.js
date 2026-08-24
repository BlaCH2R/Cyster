// Verify holdbar length vs scanner position at clear time for the user's project.
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
    const out = [];
    for (const note of ch.notes) {
      if (note.type !== 1 && note.type !== 2) continue;
      const info2 = p.ctxInfo();
      const S = info2.S;
      const scannerEnd = ch.getScannerPositionY(note.end_time);
      const scannerStart = ch.getScannerPositionY(note.start_time);
      const noteY = note.worldY;
      const holdLen = note.holdlength || 0;
      out.push({
        id: note.id, type: note.type, dir: note.direction,
        noteY: +noteY.toFixed(3),
        scannerStart: +scannerStart.toFixed(3),
        scannerEnd: +scannerEnd.toFixed(3),
        scannerDelta: +((scannerEnd - scannerStart) * (note.direction > 0 ? 1 : -1)).toFixed(3),
        holdLength: +holdLen.toFixed(3),
        endToNote: +((scannerEnd - noteY) * (note.direction > 0 ? 1 : -1)).toFixed(3),
        S: +S.toFixed(2)
      });
      if (out.length >= 12) break;
    }
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
