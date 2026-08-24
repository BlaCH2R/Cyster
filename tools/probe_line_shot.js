// Capture the real app window at t=140.15 with the Delusion project loaded,
// matching the user's screenshot conditions (background, effects, UI on).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_shot_ud_')));
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
  await win.webContents.executeJavaScript(`(() => {
    const pv = window.__sb.preview;
    pv.setTime(140.15, false);
    pv.render();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const shot = await win.capturePage();
  fs.writeFileSync('C:/Users/Bc/.codex/visualizations/2026/08/09/019fe53f-ed46-7620-bd54-f9af9c86ee77/delusion_window_t140.png', shot.toPNG());
  console.log('SHOT SAVED', shot.getSize());
  app.exit(0);
});
