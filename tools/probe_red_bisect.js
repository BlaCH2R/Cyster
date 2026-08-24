const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rb_ud_')));
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
    const px = (x, y) => {
      const d = ctx.getImageData(Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y))), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const snap = (label) => {
      pv.setTime(140.15, false);
      pv.render();
      return { label, y200: px(487, 200), y273: px(487, 273), y350: px(487, 350), y400: px(487, 400) };
    };
    const results = [];
    results.push(snap('baseline'));
    pv.backgroundImage = null; pv.markDirty();
    results.push(snap('bg-null'));
    pv.effectsEnabled = false;
    results.push(snap('effects-off'));
    pv.ui.show = false; pv.ui.showNoteIds = false; pv.drawClearEffects = () => {};
    results.push(snap('ui-off'));
    window.__sb.refreshAll();
    results.push(snap('refreshAll'));
    pv.setTime(0.5, false);
    results.push(snap('time-0.5'));
    pv.setTime(140.15, false); pv.render();
    results.push(snap('time-back'));
    return results;
  })()`);
  console.log('BISECT:', JSON.stringify(out));
  app.exit(0);
});
