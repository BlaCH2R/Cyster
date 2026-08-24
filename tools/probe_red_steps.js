const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rs_ud_')));
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
    const info = pv.ctxInfo();
    const ctrl = pv.mergedCtrl || {};
    const steps = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const snap = (label) => {
      const d = ctx.getImageData(487, 200, 1, 1).data;
      const d2 = ctx.getImageData(487, 273, 1, 1).data;
      const d3 = ctx.getImageData(300, 400, 1, 1).data;
      steps.push({ label, p200: [d[0], d[1], d[2]], p273: [d2[0], d2[1], d2[2]], p400: [d3[0], d3[1], d3[2]] });
    };
    pv.drawBackground(ctx, W, H, ctrl);
    snap('background');
    pv.drawStageLayer(ctx, info, 0, 1);
    snap('layer0');
    pv.drawWorld(ctx, info, ctrl);
    snap('world');
    pv.drawStageLayer(ctx, info, 1, 1);
    snap('layer1');
    pv.drawStageLayer(ctx, info, 2, 1);
    snap('layer2');
    pv.drawUI(ctx, W, H, ctrl);
    snap('ui');
    return steps;
  })()`);
  console.log('STEPS:', JSON.stringify(out));
  app.exit(0);
});
