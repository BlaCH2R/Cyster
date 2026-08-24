// Isolated flick render: one flick note, no storyboard. Check its shape.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_flick_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [{ id: 1, type: 5, x: 0, tick: 2400, hold_tick: 0, page_index: 0 }],
    event_order_list: [],
    music_offset: 0
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  const level = { schema_version: 2, version: 't', id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json' }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: null, storyboardContent: null }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1500));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    p.chart.getScannerPositionY = () => -9999;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const flick = p.chart.noteById(1);
    p.setTime(flick.start_time, false);
    p.render();
    const info2 = p.ctxInfo();
    const pos = p.noteScreenPos(flick, info2);
    const out = { x: Math.round(pos.x), y: Math.round(pos.y), W, H };
    // histogram around the note
    const hist = {};
    const px = (x, y) => {
      const xc = Math.max(0, Math.min(W-1, Math.round(x)));
      const yc = Math.max(0, Math.min(H-1, Math.round(y)));
      const d = ctx.getImageData(xc, yc, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    for (let dy = -90; dy <= 90; dy += 6) {
      for (let dx = -90; dx <= 90; dx += 6) {
        const c = px(pos.x + dx, pos.y + dy);
        const key = '#' + c.map(v => Math.round(v / 32) * 32).map(v => v.toString(16).padStart(2, '0')).join('');
        hist[key] = (hist[key] || 0) + 1;
      }
    }
    out.hist = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6);
    out.center = px(pos.x, pos.y);
    out.diag45 = px(pos.x + 60, pos.y + 60);
    out.side = px(pos.x + 60, pos.y);
    window.__flickSynth = canvas.toDataURL('image/png');
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  const dataUrl = await win.webContents.executeJavaScript(`window.__flickSynth || ''`);
  if (dataUrl) {
    fs.writeFileSync(path.join(__dirname, 'shots', 'flick_synth.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('synth saved');
  }
  app.exit(0);
});
