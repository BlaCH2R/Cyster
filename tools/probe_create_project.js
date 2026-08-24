// Probe: loads app/main.js with a mocked electron module and exercises the
// real 'project:create' IPC handler. Verifies the new-project defaults:
//   - an explicit levelId lands in level.json (sanitized);
//   - the chart type defaults to "easy" when omitted;
//   - music / chart / background / storyboard files are copied into the
//     project folder (never referenced from the external source path).
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const handlers = {};
function mockElectron() {
  const mkWin = () => ({
    loadFile: () => Promise.resolve(),
    on: () => {},
    isDestroyed: () => false,
    close: () => {},
    focus: () => {},
    webContents: { send: () => {}, setWindowOpenHandler: () => {} }
  });
  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      on: () => {},
      whenReady: () => Promise.resolve(),
      getPath: () => os.tmpdir(),
      quit: () => {}
    },
    BrowserWindow: Object.assign(
      function BrowserWindow() { return mkWin(); },
      { getAllWindows: () => [], fromId: () => null }
    ),
    ipcMain: { handle: (name, fn) => { handlers[name] = fn; }, on: () => {} },
    dialog: {
      showOpenDialog: async () => ({ canceled: true }),
      showSaveDialog: async () => ({ canceled: true })
    },
    shell: { openPath: async () => '', openExternal: async () => {} },
    desktopCapturer: { getSources: async () => [] },
    screen: { getPrimaryDisplay: () => ({ size: { width: 1920, height: 1080 } }) },
    Menu: { setApplicationMenu: () => {}, buildFromTemplate: () => ({ popup: () => {} }) }
  };
  require.cache[require.resolve('electron')] = {
    id: 'electron', filename: 'electron', loaded: true, exports: electron
  };
}

mockElectron();
require(path.join(__dirname, '..', 'app', 'main.js'));

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

async function main() {
  const out = { results: {} };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cp_'));
  try {
    const src = path.join(root, 'src');
    writeFile(path.join(src, 'music.ogg'), 'MUSIC');
    writeFile(path.join(src, 'chart.base.txt'), 'CHART');
    writeFile(path.join(src, 'bg.png'), 'BG');
    writeFile(path.join(src, 'sb.json'), '{"sprites":[]}');

    const handler = handlers['project:create'];
    if (!handler) throw new Error('project:create handler not registered');

    const dir1 = path.join(root, 'p1');
    const proj1 = path.join(dir1, 'My Level.ctr');
    const r1 = await handler({}, {
      projectPath: proj1, name: 'My Level',
      levelId: 'my.level.id',
      music: path.join(src, 'music.ogg'),
      chart: path.join(src, 'chart.base.txt'),
      background: path.join(src, 'bg.png'),
      storyboard: path.join(src, 'sb.json'),
      chartType: 'easy'
    });
    const lv1 = JSON.parse(fs.readFileSync(path.join(dir1, 'level.json'), 'utf8'));
    out.results.explicitId = lv1.id === 'my.level.id';
    out.results.easyType = lv1.charts && lv1.charts[0].type === 'easy';
    out.results.filesCopied =
      fs.readFileSync(path.join(dir1, 'music.ogg'), 'utf8') === 'MUSIC' &&
      fs.readFileSync(path.join(dir1, 'chart.base.txt'), 'utf8') === 'CHART' &&
      fs.readFileSync(path.join(dir1, 'bg.png'), 'utf8') === 'BG' &&
      fs.readFileSync(path.join(dir1, 'sb.json'), 'utf8') === '{"sprites":[]}';

    // 无 levelId / 无 chartType：id 由项目名生成，难度默认 easy。
    const dir2 = path.join(root, 'p2');
    const proj2 = path.join(dir2, 'My:Level!.ctr');
    const r2 = await handler({}, {
      projectPath: proj2, name: 'My:Level!',
      music: path.join(src, 'music.ogg'),
      chart: path.join(src, 'chart.base.txt')
    });
    const lv2 = JSON.parse(fs.readFileSync(path.join(dir2, 'level.json'), 'utf8'));
    out.results.defaultId = lv2.id === 'My_Level_' || /^My_Level/.test(lv2.id);
    out.results.defaultType = lv2.charts && lv2.charts[0].type === 'easy';
    out.results.blankStoryboardCreated = fs.existsSync(path.join(dir2, 'storyboard.json'));
    out.results.returnedInfo = !!(r2 && r2.info && r2.info.level);

    out.ok = out.results.explicitId && out.results.easyType &&
      out.results.filesCopied && out.results.defaultId &&
      out.results.defaultType && out.results.blankStoryboardCreated &&
      out.results.returnedInfo;
  } catch (err) {
    out.ok = false;
    out.error = String(err && err.stack || err);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'probe_create_project_out.json'),
      JSON.stringify(out, null, 2));
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.exit(0);
}

app.whenReady().then(main);
