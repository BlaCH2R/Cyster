// Verify the file-association launch path: when the app starts with a .ctr
// project file on the command line (as Windows does for a double-click), the
// renderer receives it and opens the project automatically.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_argv_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_argv_'));
const PROJECT_DIR = path.join(TMP, 'ArgvTest');
fs.mkdirSync(PROJECT_DIR, { recursive: true });
for (const n of ['music.ogg', 'chart.base.txt', 'bg.jpg', 'storyboard_base.json']) {
  fs.copyFileSync(path.join(PLAYER, n), path.join(PROJECT_DIR, n));
}
fs.writeFileSync(path.join(PROJECT_DIR, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 'argvtest', title: 'ArgvTest',
  artist: '', illustrator: '', charter: '', storyboarder: '',
  music: { path: 'music.ogg' }, background: { path: 'bg.jpg' },
  charts: [{ type: 'base', path: 'chart.base.txt', difficulty: 1, storyboard: { path: 'storyboard_base.json' } }]
}, null, 2), 'utf8');
const CTR = path.join(PROJECT_DIR, 'ArgvTest.ctr');
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'ArgvTest',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  app_version: '0.1.0-beta',
  files: { music: 'music.ogg', chart: 'chart.base.txt', background: 'bg.jpg', storyboard: 'storyboard_base.json' }
}, null, 2), 'utf8');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_argv_ud_')));
process.argv.push(CTR);
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 3000));
  const win = BrowserWindow.getAllWindows()[0];
  const st = await win.webContents.executeJavaScript(`({
    projectPath: window.__sb.state.projectPath,
    projectName: window.__sb.state.projectConfig && window.__sb.state.projectConfig.name,
    welcomeHidden: !document.body.classList.contains('welcome-mode'),
    status: document.getElementById('statusBar').textContent
  })`);
  const result = {
    openedPath: st.projectPath,
    openedName: st.projectName,
    welcomeHidden: st.welcomeHidden,
    ok: st.projectPath === CTR && st.projectName === 'ArgvTest'
  };
  fs.writeFileSync(path.join(__dirname, 'probe_open_argv_out.json'), JSON.stringify(result, null, 2));
  console.log('OPEN_ARGV_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_open_argv_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
