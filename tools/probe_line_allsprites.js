// Dump ALL evaluated sprites at t=140.15 (paths, colors, sizes, matrices) so
// we can identify exactly which sprite renders the uniform red playfield.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_all_ud_')));
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
  await new Promise((r) => setTimeout(r, 800));
  const info = buildInfo();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3500));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let img = null;
    for (let i = 0; i < 50 && !img; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['line.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }
    pv.setTime(140.15, false);
    pv.render();
    const info2 = pv.ctxInfo();
    const ev = pv.evalResult || {};
    const iw = 2045, ih = 369;
    const all = (ev.sprites || []).map((r) => {
      const f = r.from;
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
      const color = f.color || null;
      return {
        id: r.obj.id,
        path: f.path,
        t: f.time,
        color: color ? { r: color.r, g: color.g, b: color.b, a: color.a } : null,
        opacity: f.opacity,
        dw, dh, sx, sy,
        matrix: [M.a, M.b, M.c, M.d, M.e, M.f].map((v) => Math.round(v * 100) / 100)
      };
    }).filter((s) => s.opacity > 0.004 && s.path);
    const px = (x, y) => {
      const d = ctx.getImageData(Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y))), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const samples = {};
    for (const y of [200, 240, 273, 300, 350, 400, 440, 480]) {
      samples['y' + y] = [px(487, y), px(200, y), px(800, y)];
    }
    return { W, H, info: { S: info2.S, W2: info2.W, H2: info2.H }, sprites: all, samples };
  })()`);
  console.log('ALL-SPRITES:', JSON.stringify(out));
  app.exit(0);
});
