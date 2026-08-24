const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_proj_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_proj_'));
const PROJ_PATH = path.join(TMP, '测试项目.ctdsber');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER:', e.message); } catch (err) {}
  });

  // Welcome visible on startup?
  const welcome = await win.webContents.executeJavaScript(`document.body.classList.contains('welcome-mode')`);
  console.log('welcome visible:', welcome);

  // Create project via IPC (no dialog)
  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(PROJ_PATH)},
      name: '测试项目',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    return { info: !!res.info, config: res.config.name, projectPath: res.projectPath };
  })()`);
  console.log('created:', JSON.stringify(created));

  const cfgText = fs.readFileSync(PROJ_PATH, 'utf8');
  const cfg = JSON.parse(cfgText);
  console.log('ctdsber files:', JSON.stringify(cfg.files));
  const levelJson = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  console.log('level.json music:', levelJson.music.path, 'chart:', levelJson.charts[0].path, 'sb:', levelJson.charts[0].storyboard.path);
  const copied = fs.readdirSync(TMP).sort();
  console.log('project dir files:', copied.join(', '));

  // Load into the editor
  const loaded = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJ_PATH)} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return {
      welcomeHidden: !document.body.classList.contains('welcome-mode'),
      status: document.getElementById('statusBar').textContent,
      lanes: document.querySelectorAll('.lane-row').length,
      sbName: window.__sb.state.projectConfig.files.storyboard
    };
  })()`);
  console.log('loaded:', JSON.stringify(loaded));

  // Update background file
  const upd = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectUpdateFile({
      projectPath: ${JSON.stringify(PROJ_PATH)},
      kind: 'background',
      filePath: ${JSON.stringify(path.join(PLAYER, 'blur.jpg'))}
    });
    return { bg: res.config.files.background, infoOk: !!res.info };
  })()`);
  console.log('updated bg:', JSON.stringify(upd));
  console.log('blur.jpg in dir:', fs.existsSync(path.join(TMP, 'blur.jpg')));

  // Save storyboard to project
  const saved = await win.webContents.executeJavaScript(`(async () => {
    const content = JSON.stringify(window.__sb.state.storyboard, null, 2);
    const fileName = window.__sb.state.projectConfig.files.storyboard;
    return await window.sbAPI.saveStoryboard({ levelDir: window.__sb.state.levelDir, fileName, content });
  })()`);
  console.log('save storyboard ok:', saved.ok);

  // Welcome manage section visible when project open; project:exists works
  const welcomeCheck = await win.webContents.executeJavaScript(`(async () => {
    window.__sb && (window.__sb.showWelcome ? window.__sb.showWelcome() : null);
    await new Promise(r => setTimeout(r, 200));
    const manageVisible = !document.getElementById('welcomeManage').classList.contains('hidden');
    const exists = await window.sbAPI.projectExists({ path: ${JSON.stringify(PROJ_PATH)} });
    const notExists = await window.sbAPI.projectExists({ path: ${JSON.stringify(path.join(TMP, 'nope.ctdsber'))} });
    return { manageVisible, exists, notExists };
  })()`);
  console.log('welcomeCheck:', JSON.stringify(welcomeCheck));

  app.exit(0);
});
