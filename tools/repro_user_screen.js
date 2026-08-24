// Reproduce the user's on-screen state: load bc.re_hachimitsu_adventure
// (chart.re.txt + chart.re_storyboard.json) at t=25.162 and capture.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
// Load the PACKAGED main.js (exactly what the user's win-unpacked exe runs)
require(path.join(__dirname, '..', 'app', 'dist', 'win-unpacked', 'resources', 'app.asar'));

const DIR = 'D:/sd/Cytoid flies';

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const chartPath = 'chart.re.txt';
  const sbPath = 'chart.re_storyboard.json';
  const charts = [{
    type: 're',
    path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), 'utf8'),
    storyboardPath: sbPath,
    storyboardContent: fs.readFileSync(path.join(DIR, sbPath), 'utf8')
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: DIR, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 800));
  const info = buildInfo();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 4000));
  await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.drawClearEffects = () => {};
    p.chart.getScannerPositionY = () => -9999;
    // Keep note IDs on so we can see the ID color
    p.ui.showNoteIds = true;
    // Strip storyboard so nothing covers the notes
    p.setStoryboard({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] });
    p.markDirty();
  })()`);
  await win.webContents.executeJavaScript(`window.__sb.setTime(25.162, false)`);
  await new Promise(r => setTimeout(r, 800));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'shots', 'repro_user_25_162.png'), img.toPNG());
  console.log('captured');
  const probe = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const notes = [];
    for (const id of [187, 193, 194]) {
      const note = p.chart.noteById(id);
      if (!note) continue;
      const info = p.ctxInfo();
      const pos = p.noteScreenPos(note, info);
      notes.push({ id, type: note.type, typeName: note.typeName, x: Math.round(pos.x), y: Math.round(pos.y) });
    }
    // For each note, render it alone onto a black offscreen canvas
    window.__noteCrops = {};
    const t = p.time;
    const info2 = p.ctxInfo();
    for (const n of notes) {
      const note = p.chart.noteById(n.id);
      const pos = p.noteScreenPos(note, info2);
      const off = document.createElement('canvas');
      off.width = 160; off.height = 160;
      const ox = off.getContext('2d');
      ox.fillStyle = '#000'; ox.fillRect(0, 0, 160, 160);
      // Temporarily translate so the note center is at (80,80)
      const prevInfo = info2;
      const shifted = { ...prevInfo, W: 160, H: 160 };
      const prevPos = p.noteScreenPos(note, shifted);
      // drawNote translates to p.x/p.y via noteScreenPos; emulate by drawing with
      // the real preview context? Simpler: draw onto preview canvas region then read.
      // Instead, snapshot a region of the preview canvas around the note.
      const out = document.createElement('canvas');
      out.width = 160; out.height = 160;
      const x0 = Math.max(0, n.x - 80), y0 = Math.max(0, n.y - 80);
      out.getContext('2d').putImageData(ctx.getImageData(x0, y0, 160, 160), 0, 0);
      window.__noteCrops[n.id] = out.toDataURL('image/png');
    }
    return {
      assets: p.playerAssets ? {
        noteRing: !!(p.playerAssets.noteRing && p.playerAssets.noteRing.complete),
        noteRingW: p.playerAssets && p.playerAssets.noteRing ? p.playerAssets.noteRing.naturalWidth : 0,
        noteFillW: p.playerAssets && p.playerAssets.noteFill ? p.playerAssets.noteFill.naturalWidth : 0,
        noteFill: !!(p.playerAssets.noteFill && p.playerAssets.noteFill.complete),
        holdRing: !!(p.playerAssets.holdRing && p.playerAssets.holdRing.complete),
        flickRing: !!(p.playerAssets.flickRing && p.playerAssets.flickRing.complete)
      } : null,
      notesVisible: p.chart ? p.chart.notes.filter(n => p.time >= n.intro_time && p.time <= p.noteClearTime(n)).length : 0,
      time: p.time,
      notes,
      hasCrops: Object.keys(window.__noteCrops).length
    };
  })()`);
  console.log('probe:', JSON.stringify(probe));
  const crops = await win.webContents.executeJavaScript(`window.__noteCrops || {}`);
  for (const [id, dataUrl] of Object.entries(crops)) {
    const b64 = dataUrl.split(',')[1];
    fs.writeFileSync(path.join(__dirname, 'shots', `note_${id}_crop.png`), Buffer.from(b64, 'base64'));
  }
  console.log('crops saved:', Object.keys(crops).join(','));
  app.exit(0);
});
