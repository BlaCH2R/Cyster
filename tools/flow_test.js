// Editing-flow smoke test on a temp copy of the sample level.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_flow_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_test_'));

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER:', e.message); } catch (err) {}
  });

  const levelDir = PLAYER;
  console.log('temp level at', levelDir);
  const info = buildInfo(levelDir);

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3000));

  // 1) Select first sprite via tree DOM click
  const sel = await win.webContents.executeJavaScript(`(() => {
    const items = Array.from(document.querySelectorAll('.obj-item'));
    const sprite = items.find(i => i.querySelector('.nm').textContent.startsWith('sprite_') || true);
    if (!sprite) return 'no-sprite';
    sprite.click();
    return sprite.querySelector('.nm').textContent;
  })()`);
  console.log('selected:', sel);
  await new Promise((r) => setTimeout(r, 600));

  // 2) Verify properties panel shows fields
  const propCheck = await win.webContents.executeJavaScript(`(() => {
    const form = document.getElementById('stateForm');
    const fields = form ? form.querySelectorAll('.field').length : 0;
    const keyItems = document.querySelectorAll('#propBody .key-item').length;
    return { fields, keyItems, hasAddKf: !!document.getElementById('btnAddKf') };
  })()`);
  console.log('propCheck:', JSON.stringify(propCheck));

  // 3) Add keyframe at playhead via button
  await win.webContents.executeJavaScript(`window.__sb.setTime(10, false)`);
  await new Promise((r) => setTimeout(r, 400));
  const addKf = await win.webContents.executeJavaScript(`(() => {
    const btn = document.getElementById('btnAddKf');
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  })()`);
  console.log('addKf:', addKf);
  await new Promise((r) => setTimeout(r, 600));
  const kfAfter = await win.webContents.executeJavaScript(`window.__sb.state.storyboard.sprites.reduce((n,o)=>n+(o.states?o.states.length:0),0)`);
  console.log('total keyframes after add:', kfAfter);

  // 4) Save storyboard to the temp level dir
  const saveRes = await win.webContents.executeJavaScript(`window.__sbSave ? true : false`);
  if (!saveRes) {
    // saveStoryboard is async internal; call via hook added in app.js
    const saved = await win.webContents.executeJavaScript(`(async () => {
      const app = window.__sb;
      // replicate save: write via API
      const content = JSON.stringify(app.state.storyboard, null, 2);
      const fileName = app.state.storyboardFileName || 'storyboard_base.json';
      const r = await window.sbAPI.saveStoryboard({ levelDir: app.state.levelDir, fileName, content });
      return r.ok ? fileName : 'fail';
    })()`);
    console.log('saved:', saved);
    const exists = fs.existsSync(path.join(levelDir, 'storyboard_base.json'));
    console.log('file exists:', exists);
  }

  // 5) Export zip
  const zipPath = path.join(TMP, 'export.cytoidlevel');
  const packed = await win.webContents.executeJavaScript(`window.sbAPI.packLevel({ levelDir: ${JSON.stringify(levelDir)}, outZip: ${JSON.stringify(zipPath)} })`);
  console.log('packed:', packed.ok, fs.existsSync(zipPath) ? fs.statSync(zipPath).size + ' bytes' : 'missing');

  app.exit(0);
});
