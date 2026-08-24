// Probe: loads app/main.js with a mocked electron module, then exercises the
// real 'player:launch-level' IPC handler against temp folders. Verifies that
// the current level is copied into <playerDir>/player and that the previous
// player contents are moved into player/Backup file (with collision suffixes).
// The fake CytoidPlayer.exe is intentionally an empty file, so the actual
// spawn fails silently (error swallowed by the handler).
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_probe_'));
  try {
    const playerDir = path.join(root, 'playerDir');
    const playerFolder = path.join(playerDir, 'player');
    writeFile(path.join(playerDir, 'CytoidPlayer.exe'), '');
    writeFile(path.join(playerFolder, 'old1.png'), 'OLD1');
    writeFile(path.join(playerFolder, 'level.json'), 'OLD LEVEL');
    writeFile(path.join(playerFolder, 'OLDSUB', 'keep.txt'), 'KEEP');

    const levelDir = path.join(root, 'level');
    writeFile(path.join(levelDir, 'level.json'), 'NEW LEVEL');
    writeFile(path.join(levelDir, 'chart.base.txt'), 'NEW CHART');
    writeFile(path.join(levelDir, 'music.ogg'), 'NEW MUSIC');

    const handler = handlers['player:launch-level'];
    if (!handler) throw new Error('player:launch-level handler not registered');
    const res = await handler({}, { levelDir, playerPath: playerDir });
    out.results.okReturned = !!res && res.ok === true;

    const list = (p) => fs.readdirSync(p).sort();
    const backupRe = /^Backup file \d{4}-\d{2}-\d{2} \d{2}-\d{2}( \(\d+\))?$/;
    const backups = () => fs.readdirSync(playerFolder).filter((n) => backupRe.test(n)).sort();
    out.results.playerHasNewLevel =
      fs.readFileSync(path.join(playerFolder, 'level.json'), 'utf8') === 'NEW LEVEL' &&
      fs.readFileSync(path.join(playerFolder, 'chart.base.txt'), 'utf8') === 'NEW CHART' &&
      fs.readFileSync(path.join(playerFolder, 'music.ogg'), 'utf8') === 'NEW MUSIC';
    const firstBackups = backups();
    out.results.backupExists = firstBackups.length === 1;
    const backup1 = path.join(playerFolder, firstBackups[0] || '');
    out.results.backupContents =
      firstBackups.length === 1 &&
      fs.existsSync(path.join(backup1, 'old1.png')) &&
      fs.readFileSync(path.join(backup1, 'level.json'), 'utf8') === 'OLD LEVEL' &&
      fs.existsSync(path.join(backup1, 'OLDSUB', 'keep.txt'));
    out.results.oldGoneFromPlayer =
      !fs.existsSync(path.join(playerFolder, 'old1.png')) &&
      !fs.existsSync(path.join(playerFolder, 'OLDSUB'));

    // 第二次部署：应再新建一个带时间戳的备份文件夹，旧备份保持不动。
    writeFile(path.join(playerFolder, 'old1.png'), 'OLD2');
    writeFile(path.join(playerFolder, 'music.ogg'), 'OLD MUSIC');
    await handler({}, { levelDir, playerPath: playerDir });
    const secondBackups = backups();
    out.results.secondRunNewBackup = secondBackups.length === 2;
    const backup2 = path.join(playerFolder, secondBackups[1] || '');
    out.results.backup2Contents =
      secondBackups.length === 2 &&
      fs.readFileSync(path.join(backup2, 'old1.png'), 'utf8') === 'OLD2' &&
      fs.readFileSync(path.join(backup2, 'level.json'), 'utf8') === 'NEW LEVEL' &&
      fs.readFileSync(path.join(backup2, 'chart.base.txt'), 'utf8') === 'NEW CHART' &&
      fs.readFileSync(path.join(backup2, 'music.ogg'), 'utf8') === 'OLD MUSIC';
    out.results.firstBackupUntouched =
      secondBackups.length === 2 &&
      fs.readFileSync(path.join(backup1, 'old1.png'), 'utf8') === 'OLD1' &&
      fs.readFileSync(path.join(backup1, 'level.json'), 'utf8') === 'OLD LEVEL';
    // 备份文件夹不能被移入新备份（禁止嵌套），且新关卡仍在 player 根目录。
    out.results.noNesting =
      secondBackups.every((b) =>
        !fs.readdirSync(path.join(playerFolder, b)).some((n) =>
          String(n).toLowerCase().startsWith('backup file'))) &&
      fs.readFileSync(path.join(playerFolder, 'level.json'), 'utf8') === 'NEW LEVEL';

    // 路径校验：不存在的 exe 应抛错且不修改 player 文件夹。
    const before = list(playerFolder).join(',');
    let threw = false;
    try {
      await handler({}, { levelDir, playerPath: path.join(root, 'missing') });
    } catch (e) {
      threw = true;
    }
    out.results.invalidPathThrows = threw;
    out.results.invalidPathNoChange = list(playerFolder).join(',') === before;

    out.ok = out.results.okReturned && out.results.playerHasNewLevel &&
      out.results.backupExists && out.results.backupContents &&
      out.results.oldGoneFromPlayer && out.results.secondRunNewBackup &&
      out.results.backup2Contents && out.results.firstBackupUntouched &&
      out.results.noNesting &&
      out.results.invalidPathThrows && out.results.invalidPathNoChange;
  } catch (err) {
    out.ok = false;
    out.error = String(err && err.stack || err);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'probe_launch_player_out.json'),
      JSON.stringify(out, null, 2));
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.exit(0);
}

app.whenReady().then(main);
