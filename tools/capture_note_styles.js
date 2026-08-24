// Capture one clear frame per note type (background removed) for visual QA.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_style_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1100, 760);
  await new Promise(r => setTimeout(r, 600));
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const times = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    p.markDirty();
    const types = { 0:'click', 1:'hold', 2:'longhold', 3:'drag', 4:'dragchild', 5:'flick', 6:'cdrag', 7:'cdragchild' };
    const out = [];
    for (const [type, name] of Object.entries(types)) {
      const note = p.chart.notes.find(n => n.type === Number(type));
      if (!note) continue;
      const t = note.start_time;
      out.push({ name, t, id: note.id });
    }
    return out;
  })()`);
  for (const item of times) {
    await win.webContents.executeJavaScript(`(() => {
      const p = window.__sb.preview;
      p.effectsEnabled = false;
      p.ui.show = false;
      p.ui.showNoteIds = false;
      p.drawClearEffects = () => {};
      p.chart.getScannerPositionY = () => -9999;
      p.setTime(${item.t}, false);
      p.render();
    })()`);
    await new Promise(r => setTimeout(r, 250));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'shots', `style_${item.name}_id${item.id}.png`), img.toPNG());
    console.log('captured', item.name, item.t);
  }
  app.exit(0);
});
