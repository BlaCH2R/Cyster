// Verify regular hold bar direction with a synthetic single-note chart.
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

function makeLevel(dir, direction) {
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: direction }],
    note_list: [{ id: 1, type: 1, x: 0, tick: 2400, hold_tick: 960, page_index: 0 }],
    event_order_list: [],
    music_offset: 0
  };
  const fs = require('fs');
  const chartPath = path.join(dir, 'chart.json');
  fs.writeFileSync(chartPath, JSON.stringify(chart, null, 1));
  const level = {
    schema_version: 2, version: 'test', id: 'test', title: 'Test', artist: 't', charter: 't',
    music: { path: null },
    charts: [{ type: 'base', path: 'chart.json' }]
  };
  const levelPath = path.join(dir, 'level.json');
  fs.writeFileSync(levelPath, JSON.stringify(level, null, 1));
  const files = [{ name: 'level.json', size: 10 }, { name: 'chart.json', size: 10 }];
  return { level, levelDir: dir, files, charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: null, storyboardContent: null }] };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const fs = require('fs');
  const os = require('os');
  const results = [];
  for (const direction of [1, -1]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_holdsyn_'));
    const info = makeLevel(dir, direction);
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
    await new Promise(r => setTimeout(r, 1200));
    const r = await win.webContents.executeJavaScript(`(() => {
      const p = window.__sb.preview;
      p.backgroundImage = null;
      p.effectsEnabled = false;
      p.ui.show = false;
      p.ui.showNoteIds = false;
      p.drawClearEffects = () => {};
      const canvas = document.getElementById('previewCanvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const note = p.chart.noteById(1);
      const t = note.start_time + (note.end_time - note.start_time) * 0.5;
      p.setTime(t, false);
      p.render();
      const info2 = p.ctxInfo();
      const pos = p.noteScreenPos(note, info2);
      const sample = (dy) => {
        const y = Math.max(0, Math.min(H-1, Math.round(pos.y + dy)));
        const x = Math.max(0, Math.min(W-1, Math.round(pos.x)));
        const d = ctx.getImageData(x, y, 1, 1).data;
        return { dy, rgb: [d[0], d[1], d[2]] };
      };
      // measure bar width at a y above the note (dash region, above progress ring)
      const noteR = Math.round(p.noteRadiusAtTime(note, info2, t));
      const noteD = Math.round(noteR * 2);
      const barRegionY = Math.max(0, Math.round(pos.y - noteR - 30));
      let xL = null, xR = null;
      for (let x = Math.round(pos.x) - 80; x < Math.round(pos.x) + 80; x++) {
        const d = ctx.getImageData(x, barRegionY, 1, 1).data;
        if (d[0] + d[1] + d[2] > 30) { if (xL == null) xL = x; xR = x; }
      }
      // measure bar top (highest dash)
      let top = null;
      for (let y = Math.max(0, Math.round(pos.y - noteR - 200)); y < Math.round(pos.y - noteR); y++) {
        const d = ctx.getImageData(Math.round(pos.x), y, 1, 1).data;
        if (d[0] + d[1] + d[2] > 30) { top = y; break; }
      }
      return {
        dir: note.direction, y: Math.round(pos.y), holdPx: Math.round(note.holdlength * info2.S),
        scanLenPx: Math.round(Math.abs(p.chart.getScannerPositionY(note.end_time) - note.worldY) * info2.S),
        barWidthPx: xL != null ? (xR - xL + 1) : null,
        expectedWidthPx: Math.round(noteD * 0.36),
        barTop: top,
        up55: sample(-55), up90: sample(-90), up100: sample(-100),
        down55: sample(55), down90: sample(90), down100: sample(100)
      };
    })()`);
    results.push(r);
  }
  for (const r of results) {
    console.log('direction', r.dir, 'holdPx', r.holdPx, 'scanLenPx', r.scanLenPx,
      'barWidth', r.barWidthPx, 'expectedWidth', r.expectedWidthPx, 'barTop', r.barTop,
      'up55', r.up55.rgb, 'up90', r.up90.rgb, 'up100', r.up100.rgb,
      'down55', r.down55.rgb, 'down90', r.down90.rgb, 'down100', r.down100.rgb);
  }
  app.exit(0);
});
