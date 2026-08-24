const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lv_ud_')));
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
  const out = await win.webContents.executeJavaScript(`(() => {
    const pv = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    pv.effectsEnabled = false;
    pv.setTime(140.15, false);
    pv.evaluate(140.15);
    const info2 = pv.ctxInfo();
    const ctrl = pv.mergedCtrl || {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    pv.drawBackground(ctx, W, H, ctrl);
    pv.drawStageLayer(ctx, info2, 0, 1);
    // measure red pixels along x=487 column
    const cols = [487, 200, 800];
    const res = { bright: {}, dark: {} };
    for (const x of cols) {
      for (const kind of ['bright', 'dark']) {
        const rows = [];
        let minY = H, maxY = -1;
        for (let y = 0; y < H; y++) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          const isRed = d[0] > 60 && d[1] < 80 && d[2] < 80 && d[0] - d[1] > 40;
          if (!isRed) continue;
          if (kind === 'bright' && !(d[0] > 130 && d[0] - d[1] > 80)) continue;
          if (kind === 'dark' && !(d[0] <= 130)) continue;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          rows.push({ y, rgb: [d[0], d[1], d[2]] });
        }
        const bands = [];
        let inb = false, start = 0;
        for (let y = minY === H ? 0 : minY; y <= (maxY < 0 ? -1 : maxY); y++) {
          const hit = rows.some((r) => r.y === y);
          if (hit && !inb) { start = y; inb = true; }
          else if (!hit && inb) { bands.push({ y0: start, y1: y - 1, h: y - start }); inb = false; }
        }
        if (inb) bands.push({ y0: start, y1: maxY, h: maxY - start + 1 });
        res[kind]['x' + x] = { count: rows.length, minY, maxY, bands };
      }
    }
    return res;
  })()`);
  console.log('VERIFY:', JSON.stringify(out));
  app.exit(0);
});
