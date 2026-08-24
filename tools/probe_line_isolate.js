const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_li_ud_')));
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
    // Draw ONLY the three line.png layer-0 sprites (isolate them).
    const ev = pv.evalResult || {};
    const lineSprites = (ev.sprites || []).filter((r) => r.from.path === 'line.png' && (r.from.layer || 0) === 0 && r.from.opacity > 0.004);
    for (const r of lineSprites) {
      pv.drawStageObject(ctx, info2, r, 'sprite', 1);
    }
    const rows = {};
    for (const x of [487, 200, 800]) {
      const arr = [];
      for (let y = 250; y < 430; y++) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        arr.push([y, d[0], d[1], d[2], d[3]]);
      }
      rows['x' + x] = arr;
    }
    return { lineSpriteCount: lineSprites.length, rows };
  })()`);
  console.log('ISOLATE:', JSON.stringify(out));
  app.exit(0);
});
