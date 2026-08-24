// Verify flick chevron tightening at different targetOff values.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  await new Promise(r => setTimeout(r, 800));
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_fchev_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [{ id: 1, type: 5, x: 0.45, tick: 2000, hold_tick: 0, page_index: 0 }],
    event_order_list: [],
    music_offset: 0
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  const level = { schema_version: 2, version: 't', id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json' }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: null, storyboardContent: null }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1200));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const flick = p.chart.noteById(1);
    const t = flick.start_time - 0.05;
    p.setTime(t, false); p.render();
    const info2 = p.ctxInfo();
    const pos = p.notePos(flick, info2);
    const fd = 2.218 * 1.133333 * info2.S;
    const chev = [];
    for (let x = Math.round(pos.x - fd); x < Math.round(pos.x + fd); x += 2) {
      const c = ctx.getImageData(x, Math.round(pos.y), 1, 1).data;
      if (c[0] > 200 && c[1] > 200 && c[2] > 200) chev.push(x);
    }
    return {
      pos: Math.round(pos.x),
      dPx: Math.round(fd),
      chevronXs: chev.length ? [chev[0], chev[chev.length - 1]] : null,
      diamondEdgeX: Math.round(pos.x - fd * 0.354),
      distancePx: chev.length ? Math.round(pos.x - fd * 0.354 - chev[0]) : null
    };
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
