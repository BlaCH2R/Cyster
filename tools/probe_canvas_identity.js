const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cid_ud_')));
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
    const dom = document.getElementById('previewCanvas');
    const canvas = pv.canvas;
    const res = {
      sameObject: canvas === dom,
      canvasTag: canvas ? canvas.tagName : null,
      canvasClass: canvas ? canvas.className : null,
      canvasParent: canvas && canvas.parentElement ? canvas.parentElement.className : null,
      canvasW: canvas ? canvas.width : null,
      canvasH: canvas ? canvas.height : null,
      domW: dom ? dom.width : null,
      domH: dom ? dom.height : null,
      domId: dom ? dom.id : null,
      allCanvasIds: Array.from(document.querySelectorAll('canvas')).map((c) => c.id + ':' + c.width + 'x' + c.height)
    };
    return res;
  })()`);
  console.log('CANVAS-ID:', JSON.stringify(out));
  app.exit(0);
});
