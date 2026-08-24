// Probe: loads app/main.js with a mocked electron module, then exercises the
// real 'level:add-asset' IPC handler. Verifies that external files are copied
// into the project folder (with a (1)/(2) suffix on name collisions) and that
// the returned path is the project-local relative path; in-project files are
// referenced as-is without copying.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_asset_'));
  try {
    const levelDir = path.join(root, 'level');
    writeFile(path.join(levelDir, 'a.png'), 'ORIGINAL A');
    writeFile(path.join(levelDir, 'b.png'), 'IN PROJECT');
    const external = path.join(root, 'outside', 'pic.png');
    writeFile(external, 'EXTERNAL PIC');
    const externalA = path.join(root, 'outside2', 'a.png');
    writeFile(externalA, 'EXTERNAL A');

    const handler = handlers['level:add-asset'];
    if (!handler) throw new Error('level:add-asset handler not registered');

    const r1 = await handler({}, { levelDir, filePath: external });
    out.results.externalCopied =
      r1 === 'pic.png' &&
      fs.readFileSync(path.join(levelDir, 'pic.png'), 'utf8') === 'EXTERNAL PIC';

    const r2 = await handler({}, { levelDir, filePath: externalA });
    out.results.collisionSuffixed =
      r2 === 'a (1).png' &&
      fs.readFileSync(path.join(levelDir, 'a (1).png'), 'utf8') === 'EXTERNAL A' &&
      fs.readFileSync(path.join(levelDir, 'a.png'), 'utf8') === 'ORIGINAL A';

    const before = fs.readdirSync(levelDir).sort().join(',');
    const r3 = await handler({}, { levelDir, filePath: path.join(levelDir, 'b.png') });
    const after = fs.readdirSync(levelDir).sort().join(',');
    out.results.inProjectNoCopy =
      r3 === 'b.png' &&
      before === after &&
      fs.readFileSync(path.join(levelDir, 'b.png'), 'utf8') === 'IN PROJECT';

    let threw = false;
    try {
      await handler({}, { levelDir, filePath: path.join(root, 'missing.png') });
    } catch (e) {
      threw = true;
    }
    out.results.missingThrows = threw;

    out.ok = out.results.externalCopied && out.results.collisionSuffixed &&
      out.results.inProjectNoCopy && out.results.missingThrows;
  } catch (err) {
    out.ok = false;
    out.error = String(err && err.stack || err);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'probe_add_asset_out.json'),
      JSON.stringify(out, null, 2));
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.exit(0);
}

app.whenReady().then(main);
