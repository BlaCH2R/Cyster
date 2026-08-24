// Probe: load the real Delusion project, dump evaluated line.png sprite
// geometry and measure the rendered red line thickness on canvas.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_del_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const DIR = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion';

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const chartPath = 'chart.base.txt';
  const sbPath = 'storyboard_compiled.json';
  const charts = [{
    type: 'extreme', path: chartPath,
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
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const info = buildInfo();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3000));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    // Isolate: hide background, UI and clear effects.
    pv.backgroundImage = null;
    pv.effectsEnabled = false;
    pv.ui.show = false;
    pv.ui.showNoteIds = false;
    pv.drawClearEffects = () => {};
    pv.markDirty();

    // Wait for line.png to load into the image cache.
    let img = null;
    for (let i = 0; i < 50 && !img; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['line.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }
    const imgInfo = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;

    const dump = () => {
      const info2 = pv.ctxInfo();
      const ev = pv.evalResult || {};
      const lines = (ev.sprites || []).filter((r) => {
        const p = r.from && r.from.path;
        return p && String(p).toLowerCase().includes('line');
      }).map((r) => {
        const f = r.from;
        const iw = imgInfo ? imgInfo.w : 0, ih = imgInfo ? imgInfo.h : 0;
        const w = f.width !== undefined ? pv.stageUnitPx(f.width, info2, true) : null;
        const h = f.height !== undefined ? pv.stageUnitPx(f.height, info2, true) : null;
        let dw = w != null ? w : (200 / 800) * info2.W;
        let dh = h != null ? h : (200 / 600) * info2.H;
        const preserveAspect = f.preserve_aspect !== false;
        if (preserveAspect && w == null && h == null) {
          if (iw > ih) dh = dw * ih / iw;
          else dw = dh * iw / ih;
        } else if (preserveAspect && (w != null || h != null)) {
          const sc = Math.min(dw / iw, dh / ih);
          dw = iw * sc; dh = ih * sc;
        }
        const us = f.scale !== undefined ? f.scale : 1;
        const sx = (f.scale_x !== undefined ? f.scale_x : 1) * us;
        const sy = (f.scale_y !== undefined ? f.scale_y : 1) * us;
        const M = pv.stageMatrix(r.obj, r, info2);
        return {
          id: r.obj.id,
          time: f.time,
          x: f.x, y: f.y, sx, sy,
          width: f.width, height: f.height,
          preserveAspect,
          opacity: f.opacity,
          dw, dh,
          matrix: [M.a, M.b, M.c, M.d, M.e, M.f].map((v) => Math.round(v * 100) / 100),
          lineThicknessPx: dh * (7 / 369) * Math.abs(M.d)
        };
      });
      return lines;
    };

    const measureRed = () => {
      pv.render();
      const idata = ctx.getImageData(0, 0, W, H).data;
      // The line.png is white; tint red via sprite color. Find saturated red pixels.
      let minY = H, maxY = -1, n = 0;
      const rows = new Array(H).fill(0);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          const r = idata[i], g = idata[i + 1], b = idata[i + 2], a = idata[i + 3];
          if (r > 150 && g < 80 && b < 80 && a > 150 && r - g > 80) {
            n++; rows[y]++;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const bands = [];
      let inb = false, start = 0;
      for (let y = 0; y < H; y++) {
        if (rows[y] > 2 && !inb) { start = y; inb = true; }
        else if (rows[y] <= 2 && inb) {
          if (y - start >= 1) bands.push({ y0: start, y1: y - 1, h: y - start, maxW: Math.max(...rows.slice(start, y)) });
          inb = false;
        }
      }
      if (inb) bands.push({ y0: start, y1: H - 1, h: H - start, maxW: Math.max(...rows.slice(start)) });
      return { n, minY, maxY, bands };
    };

    const times = [136, 137, 140, 140.15, 143, 145, 147, 150, 155, 160, 170, 180, 190, 200];
    const res = { imgInfo, byTime: {} };
    for (const t of times) {
      pv.setTime(t, false);
      const m = measureRed();
      const all = dump();
      const spr = all.filter((s) => s.opacity > 0.004);
      res.byTime[t] = {
        measure: m,
        sprites: spr.slice(0, 12),
        spriteCount: spr.length,
        allCount: all.length,
        allScales: all.map((s) => ({ id: s.id, t: s.time, sy: s.sy, o: s.opacity })).slice(0, 40)
      };
      if (t === 140.15) {
        res.screenshot = canvas.toDataURL('image/png');
      }
    }
    return res;
  })()`);
  console.log('DELUSION-LINE:', JSON.stringify(out));
  app.exit(0);
});
