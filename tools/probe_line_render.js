const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lr_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lr_'));
  fs.copyFileSync('V:/cytoid storyboarder/项目/测试：delusion/Delusion/line.png', path.join(dir, 'line.png'));
  const chart = { time_base: 480, tempo_list: [{ tick: 0, value: 500000 }], page_list: [{ start_tick: 0, end_tick: 2400, scan_line_direction: 1 }], note_list: [], event_order_list: [], music_offset: 0 };
  const mkSprite = (sy, y) => ({ id: 'l' + sy, path: 'line.png', scale_x: 20, scale_y: sy, x: 0, y, time: 0, opacity: 1, layer: 2, order: 999 });
  const sb = { sprites: [mkSprite(4, 0), mkSprite(40, 0)], texts: [], videos: [], lines: [], controllers: [{ id: 'c', time: 0, scanline_opacity: 0 }], note_controllers: [] };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1500));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    let img = null;
    for (let i = 0; i < 40 && !img; i++) {
      await new Promise(r => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['line.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }
    const imgInfo = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    const info2 = pv.ctxInfo();
    const W = pv.canvas.width, H = pv.canvas.height;
    const ctx = pv.canvas.getContext('2d');
    const measure = (sy) => {
      // Only one sprite visible at a time to separate the two.
      const sprites = window.__sb.state.storyboard.sprites;
      sprites.forEach(s => { s.opacity = s.scale_y === sy ? 1 : 0; });
      window.__sb.refreshAll();
      pv.setTime(0.5, false);
      pv.render();
      const img = ctx.getImageData(0, 0, W, H).data;
      let minY = H, maxY = -1, minX = W, maxX = -1, n = 0;
      let anyN = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (img[i + 3] > 220) anyN++;
          if (img[i] > 130 && img[i + 1] < 100 && img[i + 2] < 100 && img[i + 3] > 60) {
            n++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      return { n, anyN, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
    };
    const lineSprites = (pv.evalResult && pv.evalResult.sprites || []).filter(r => r.from && r.from.path && String(r.from.path).includes('line'));
    return { imgInfo, sy4: measure(4), sy40: measure(40) };
  })()`);
  console.log('LINE-RENDER:', JSON.stringify(out));
  app.exit(0);
});
