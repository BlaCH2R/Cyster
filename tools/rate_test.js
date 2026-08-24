const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
require(path.join(__dirname, '..', 'app', 'main.js'));
const LEVEL_ZIP = 'C:/Users/Bc/Downloads/10234.penguin.cytoidlevel';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rate_test_'));
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, musicOverride: c.music_override ? c.music_override.path : null, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}
app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 40000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const tmpZip = TMP + '.zip';
  fs.copyFileSync(LEVEL_ZIP, tmpZip);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${TMP}' -Force`]);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(TMP))})`);
  await new Promise(r => setTimeout(r, 4000));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const p = window.__sb.preview;
    window.__sb.setTime(5, false);
    window.__sb.togglePlay();
    await new Promise(res => setTimeout(res, 300));
    const t1 = p.audio.currentTime;
    const w1 = performance.now();
    await new Promise(res => setTimeout(res, 1000));
    const t2 = p.audio.currentTime;
    const w2 = performance.now();
    const rate = (t2 - t1) / ((w2 - w1) / 1000);
    window.__sb.togglePlay();
    return { t1: +t1.toFixed(3), t2: +t2.toFixed(3), wall: +((w2-w1)/1000).toFixed(3), rate: +rate.toFixed(3) };
  })()`);
  console.log('RATE:', JSON.stringify(out));
  app.exit(0);
});
