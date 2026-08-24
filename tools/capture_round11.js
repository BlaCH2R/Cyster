// capture_round11.js — screenshot the new left-panel layout + storyboard sprites.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_cap11_');
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
  for (const t of [52.13, 120.1875]) {
    await win.webContents.executeJavaScript(`window.__sb.setTime(${t}, false)`);
    await new Promise((r) => setTimeout(r, 900));
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'shots', `shot_r11_${String(t).replace('.', '_')}.png`), img.toPNG());
  }
  console.log('captured');
  app.exit(0);
});
