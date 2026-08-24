const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_la_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const DIR = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion';

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const charts = [{
    type: 'extreme', path: 'chart.base.txt',
    content: fs.readFileSync(path.join(DIR, 'chart.base.txt'), 'utf8'),
    storyboardPath: 'storyboard_compiled.json',
    storyboardContent: fs.readFileSync(path.join(DIR, 'storyboard_compiled.json'), 'utf8')
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
    const img = pv.imageCache['line.png'];
    if (!img || !img.complete) return { err: 'no img' };
    const res = {};
    // Test 1: plain draw at the REAL box size (dw=243.5, dh=43.94) through the
    // stage matrix, sampling the line alpha.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.setTransform(20, 0, 0, 4, 487, 273);
    ctx.drawImage(img, -121.75, -21.97, 243.5, 43.94);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const row = [];
    for (let y = 268; y <= 278; y++) {
      const d = ctx.getImageData(487, y, 1, 1).data;
      row.push([y, d[0], d[1], d[2], d[3]]);
    }
    res.plain = row;
    // Test 2: full-resolution tint (natural-size tint canvas), single
    // downscale to the destination box.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const t2 = document.createElement('canvas');
    t2.width = img.naturalWidth;
    t2.height = img.naturalHeight;
    const t2ctx = t2.getContext('2d');
    t2ctx.drawImage(img, 0, 0);
    t2ctx.globalCompositeOperation = 'source-in';
    t2ctx.fillStyle = 'rgb(178,34,34)';
    t2ctx.fillRect(0, 0, t2.width, t2.height);
    t2ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(20, 0, 0, 4, 487, 273);
    ctx.drawImage(t2, -121.75, -21.97, 243.5, 43.94);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const row2 = [];
    for (let y = 268; y <= 278; y++) {
      const d = ctx.getImageData(487, y, 1, 1).data;
      row2.push([y, d[0], d[1], d[2], d[3]]);
    }
    res.tinted = row2;
    // Test 3: existing tintDraw (16px-quantized pool) for comparison.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.setTransform(20, 0, 0, 4, 487, 273);
    pv.tintDraw(ctx, img, -121.75, -21.97, 243.5, 43.94, { r: 0.698, g: 0.133, b: 0.133, a: 1 }, 1);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const row3 = [];
    for (let y = 268; y <= 278; y++) {
      const d = ctx.getImageData(487, y, 1, 1).data;
      row3.push([y, d[0], d[1], d[2], d[3]]);
    }
    res.poolTint = row3;
    // Test 3: source pixels of line.png (at source rows 181-187, x=1022)
    const off = document.createElement('canvas');
    off.width = img.naturalWidth; off.height = img.naturalHeight;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);
    const src = [];
    for (let y = 179; y <= 189; y++) {
      const d = octx.getImageData(1022, y, 1, 1).data;
      src.push([y, d[0], d[1], d[2], d[3]]);
    }
    res.source = src;
    return res;
  })()`);
  console.log('ALPHA:', JSON.stringify(out));
  app.exit(0);
});
