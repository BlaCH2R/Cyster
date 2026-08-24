// verify_round20.js — file-dialog path memory (walk-up on invalid paths) and
// X/Y vs Z unit options in the properties panel.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Isolate userData so the path-memory tests never touch real settings.
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_userdata_'));
app.setPath('userData', tmpUserData);
process.env.CYTOID_SB_TEST = '1';

const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
const mainMod = require(path.join(__dirname, '..', 'app', 'main.js'));
const { validDir, rememberDir, lastDirFor } = mainMod;

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

// ---------- Part A: path memory helpers (main process) ----------
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mem_'));
const dirA = path.join(root, 'A');
const dirB = path.join(dirA, 'B');
const dirC = path.join(dirB, 'C');
fs.mkdirSync(dirC, { recursive: true });
const sampleFile = path.join(root, 'sample.txt');
fs.writeFileSync(sampleFile, 'x');

rememberDir('test1', dirC);
const got1 = lastDirFor('test1');
check('rememberDir stores the directory', got1 === dirC, JSON.stringify({ got1, dirC }));

// Remembered path points to a non-existent file: must walk up to nearest parent
const s = JSON.parse(fs.readFileSync(path.join(tmpUserData, 'settings.json'), 'utf8'));
s.lastDirs.test2 = path.join(dirC, 'missing');
fs.writeFileSync(path.join(tmpUserData, 'settings.json'), JSON.stringify(s, null, 2), 'utf8');
const got2 = lastDirFor('test2');
check('invalid remembered path walks up to nearest valid parent', got2 === dirC, JSON.stringify({ got2, dirC }));

// Remembering a FILE path stores its parent directory
rememberDir('test3', sampleFile);
const got3 = lastDirFor('test3');
check('rememberDir on a file stores its dirname', got3 === root, JSON.stringify({ got3, root }));

// After the remembered directory is deleted, walk up to the next valid parent
fs.rmSync(dirB, { recursive: true, force: true });
const got4 = lastDirFor('test1');
check('deleted remembered dir walks up to the next valid parent', got4 === dirA, JSON.stringify({ got4, dirA }));

// Non-existent drive/path with no valid ancestor returns null
const got5 = lastDirFor('nonexistent-kind');
check('unknown kind / no memory returns null', got5 == null, JSON.stringify({ got5 }));

// ---------- Part B: X/Y vs Z unit options (renderer) ----------
app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = require('electron').BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const player = extract(SAMPLE_ZIP, 'cytoid_sb_r20_');
  const info = (() => {
    const level = JSON.parse(fs.readFileSync(path.join(player, 'level.json'), 'utf8'));
    const charts = (level.charts || []).map((c) => ({
      type: c.type, path: c.path,
      content: fs.readFileSync(path.join(player, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(player, c.storyboard.path), 'utf8') : null
    }));
    return { level, levelDir: player, files: [], charts };
  })();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));

  const ui = await win.webContents.executeJavaScript(`(() => {
    const sb = window.__sb.state.storyboard;
    const first = (sb.sprites || [])[0] || (sb.texts || [])[0];
    if (!first) return { err: 'no stage object' };
    window.__sb.state.selectedObjId = first.id;
    window.__sb.state.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    const selects = Array.from(document.querySelectorAll('#stateForm select.unit'));
    if (selects.length < 3) return { err: 'not enough unit selects: ' + selects.length };
    const opts = (el) => Array.from(el.options).map(o => o.value);
    return {
      x: opts(selects[0]),
      y: opts(selects[1]),
      z: opts(selects[2])
    };
  })()`);

  const XY = ['stagex', 'stagey', 'notex', 'notey', 'camerax', 'cameray', 'world'];
  check('X/Y unit options = stageXY/noteXY/cameraXY/world',
    !ui.err && JSON.stringify(ui.x) === JSON.stringify(XY) && JSON.stringify(ui.y) === JSON.stringify(XY),
    JSON.stringify(ui));
  check('Z unit options = world only (no conversion units)',
    !ui.err && JSON.stringify(ui.z) === JSON.stringify(['world']),
    JSON.stringify(ui));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
