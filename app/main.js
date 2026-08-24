const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');

const PROJECT_EXT_RE = /\.(ctr|ctdsber)$/i;
const PROJECTS_ROOT = path.join(app.getPath('documents'), 'Cyster', 'projects');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let mainWindow = null;
let closeAllowed = false;
let pendingOpenProject = null;
let rendererReady = false;
let noteSelectorWindow = null;
let manualWindow = null;

// ---- 在线更新（electron-updater / GitHub Releases）----
// 只在打包后的应用里工作；开发/探针（electron . / tools 探针）一律跳过。
let updaterReady = false;

// 窗口标题按用户语言显示（标题在创建窗口时确定，从 settings.json 读取语言）。
function uiLanguage() {
  try {
    const s = readJsonSafe(SETTINGS_FILE);
    return (s && s.language) || 'zh-CN';
  } catch (e) {
    return 'zh-CN';
  }
}
function localizedTitle(zh, tw, en) {
  const l = uiLanguage();
  return l === 'zh-TW' ? tw : l === 'en' ? en : zh;
}

function initAutoUpdater() {
  if (!app.isPackaged || updaterReady) return;
  updaterReady = true;
  autoUpdater.autoDownload = true;          // 后台下载，下载完再提示安装
  autoUpdater.autoInstallOnAppQuit = true;  // 用户退出时自动安装已下载的更新
  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', { version: info && info.version });
    }
  });
  autoUpdater.on('download-progress', (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', {
        percent: Math.round((p && p.percent) || 0),
        transferred: p && p.transferred,
        total: p && p.total,
        bytesPerSecond: p && p.bytesPerSecond
      });
    }
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:downloaded', { version: info && info.version });
    }
  });
  autoUpdater.on('error', () => {
    // 静默：私有仓库 / 尚未发布 / 无网络时均不打扰用户
  });
}

// 启动后延迟检查：只在打包版执行，失败静默。
function scheduleAutoUpdateCheck() {
  if (!app.isPackaged) return;
  setTimeout(() => {
    initAutoUpdater();
    autoUpdater.checkForUpdates().catch(() => {});
  }, 8000);
}

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { ok: true, dev: true };
  initAutoUpdater();
  try {
    const r = await autoUpdater.checkForUpdates();
    const info = r && r.updateInfo;
    return {
      ok: true,
      current: app.getVersion(),
      available: (info && info.version) || null,
      upToDate: !info
    };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('update:install', async () => {
  if (!app.isPackaged) return { ok: false };
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// 主窗口语言切换后，通知独立工具窗口（手册 / Note 选择器）同步刷新。
ipcMain.on('app:language-changed', (e, lang) => {
  for (const w of [manualWindow, noteSelectorWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send('app:language-changed', lang);
  }
});

function createWindow() {
  // Remove the default Electron application menu entirely: its accelerators
  // (Ctrl+W close, Ctrl+R reload, Ctrl+Shift+I devtools, ...) are web/browser
  // built-in behaviors that must not interfere with the editor. The editor's
  // own shortcuts (Ctrl+Z/Y/S, space, arrows) live in the renderer.
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 920,
    minWidth: 1200,
    minHeight: 720,
    title: 'Cyster v0.1beta',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#14171c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  // 关闭前询问渲染层：有未保存修改时先确认（保存 / 不保存 / 取消）。
  mainWindow.on('close', (e) => {
    if (closeAllowed || !mainWindow || mainWindow.isDestroyed()) return;
    e.preventDefault();
    mainWindow.webContents.send('app:confirm-close');
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---- 独立进程工具窗口：Note 选择器编辑器（可跨屏拖动/缩放）----
function openNoteSelectorWindow() {
  if (noteSelectorWindow && !noteSelectorWindow.isDestroyed()) {
    noteSelectorWindow.focus();
    return true;
  }
  noteSelectorWindow = new BrowserWindow({
    width: 360,
    height: 460,
    minWidth: 360,
    minHeight: 460,
    title: localizedTitle('Note 选择器编辑器', 'Note 選擇器編輯器', 'Note Selector Editor'),
    backgroundColor: '#14171c',
    alwaysOnTop: true, // R1：常驻置顶，方便与主窗口同时操作
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  noteSelectorWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'note_selector.html'));
  noteSelectorWindow.on('closed', () => {
    noteSelectorWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tool:ns-window-state', { open: false });
    }
  });
  // 通知主窗口：选择器外部窗口已打开（属性页据此为无选择器的 stage 对象
  // 显示空白 Note 输入框，便于直接创建并注入选择器）。
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tool:ns-window-state', { open: true });
  }
  return true;
}

ipcMain.handle('tool:ns-open', () => openNoteSelectorWindow());
ipcMain.handle('tool:ns-close', () => {
  if (noteSelectorWindow && !noteSelectorWindow.isDestroyed()) noteSelectorWindow.close();
  return true;
});
// 工具窗口 → 主渲染进程的通用调用桥（get-context / apply / highlight / pick ...）。
ipcMain.handle('tool:ns-call', (e, method, args) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  return mainWindow.webContents.executeJavaScript(
    `window.__sb.nsBridge(${JSON.stringify(method)}, ${JSON.stringify(args || [])})`);
});
// 主渲染进程（预览拾取到 note）→ 工具窗口推送。
ipcMain.on('app:renderer-ns-picked', (e, payload) => {
  if (noteSelectorWindow && !noteSelectorWindow.isDestroyed()) {
    noteSelectorWindow.webContents.send('tool:ns-picked', payload);
  }
});
ipcMain.on('app:renderer-ns-message', (e, msg) => {
  if (noteSelectorWindow && !noteSelectorWindow.isDestroyed()) {
    noteSelectorWindow.webContents.send('tool:ns-message', msg);
  }
});

// ---- 独立进程工具窗口：Cyster 使用手册（docx-preview 渲染，不置顶）----
function openManualWindow() {
  if (manualWindow && !manualWindow.isDestroyed()) {
    manualWindow.focus();
    return true;
  }
  manualWindow = new BrowserWindow({
    width: 1000,
    height: 780,
    minWidth: 640,
    minHeight: 520,
    title: localizedTitle('Cyster 使用手册', 'Cyster 使用手冊', 'Cyster User Manual'),
    backgroundColor: '#14171c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  manualWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'manual.html'));
  manualWindow.on('closed', () => {
    manualWindow = null;
  });
  return true;
}

// 随应用打包的手册文档：assets/docs 下第一个 .docx（找不到时回退到固定文件名）。
ipcMain.handle('tool:manual-open', () => openManualWindow());
ipcMain.handle('docs:read-manual', async () => {
  const docsDir = path.join(__dirname, 'assets', 'docs');
  let file = path.join(docsDir, 'Cyster使用手册(ver.0.1beta).docx');
  try {
    if (fs.existsSync(docsDir)) {
      const found = fs.readdirSync(docsDir).find((n) => /\.docx$/i.test(n));
      if (found) file = path.join(docsDir, found);
    }
    if (!fs.existsSync(file)) throw new Error('手册文档不存在：' + file);
    const buf = fs.readFileSync(file);
    return { name: path.basename(file), data: buf.toString('base64') };
  } catch (e) {
    throw new Error('读取手册失败: ' + e.message);
  }
});

// ---------------------------------------------------------------------------
// Project-file launch support (.ctr / legacy .ctdsber)
// ---------------------------------------------------------------------------
function findProjectArg(argv) {
  for (const a of argv || []) {
    if (typeof a !== 'string' || !a) continue;
    if (!PROJECT_EXT_RE.test(a)) continue;
    try {
      if (fs.existsSync(a)) return path.resolve(a);
    } catch (e) {}
  }
  return null;
}

function deliverOpenProject(file) {
  if (!file || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('app:open-project-file', file);
}

function queueOpenProject(file) {
  if (!file) return;
  pendingOpenProject = file;
  if (rendererReady) {
    deliverOpenProject(file);
    pendingOpenProject = null;
  }
}

// ---------------------------------------------------------------------------
// File association (portable build)
// ---------------------------------------------------------------------------
// On first launch (or when the registered command no longer points at this
// executable), register .ctr / legacy .ctdsber under HKCU so double-clicking
// a project file opens this app. Packaged builds only: the NSIS installer
// registers the same association via electron-builder fileAssociations, and
// dev/test runs must not touch the registry.
function regQueryValue(key) {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/ve'], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const m = /REG_SZ\s+(.+)$/m.exec(stdout);
      resolve(m ? m[1].trim() : null);
    });
  });
}

function regAddValue(key, value) {
  return new Promise((resolve, reject) => {
    execFile('reg', ['add', key, '/ve', '/d', value, '/f'], { windowsHide: true }, (err) => {
      if (err) reject(new Error('reg add failed: ' + key + ': ' + err.message));
      else resolve();
    });
  });
}

async function ensureFileAssociation() {
  if (!app.isPackaged) return;
  const exe = process.execPath;
  const commandKey = 'HKCU\\Software\\Classes\\Cyster.Project\\shell\\open\\command';
  const expected = `"${exe}" "%1"`;
  try {
    const cur = await regQueryValue(commandKey);
    if (cur && cur === expected) return;
  } catch (e) {}
  await regAddValue('HKCU\\Software\\Classes\\.ctr', 'Cyster.Project');
  await regAddValue('HKCU\\Software\\Classes\\.ctdsber', 'Cyster.Project');
  await regAddValue('HKCU\\Software\\Classes\\Cyster.Project\\DefaultIcon', `"${exe}",0`);
  await regAddValue(commandKey, expected);
}

// After the rename the userData folder moves (Cystber -> Cyster); carry over
// the saved settings (recent projects, remembered dialog folders) once.
function migrateLegacySettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return;
    for (const oldName of ['Cystber', 'Cytoid Storyboarder']) {
      const oldFile = path.join(app.getPath('appData'), oldName, 'settings.json');
      if (fs.existsSync(oldFile)) {
        fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
        fs.copyFileSync(oldFile, SETTINGS_FILE);
        return;
      }
    }
  } catch (e) {}
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const file = findProjectArg(argv);
    if (file) queueOpenProject(file);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    migrateLegacySettings();
    ensureFileAssociation().catch(() => {});
    try {
      fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
    } catch (e) {
      // Non-fatal: the imported-level default folder may be unavailable
      // (read-only Documents / sandbox); the app still opens fine.
    }
    try {
      createWindow();
    } catch (e) {
      throw e;
    }
    scheduleAutoUpdateCheck();
    const startupFile = findProjectArg(process.argv);
    if (startupFile) queueOpenProject(startupFile);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function normalizePath(p) {
  return path.resolve(p);
}

// ---------------------------------------------------------------------------
// File-dialog path memory: each dialog kind remembers its last used directory.
// If the remembered path no longer exists, walk up to the nearest valid parent.
// ---------------------------------------------------------------------------
function readSettingsSync() {
  return readJsonSafe(SETTINGS_FILE) || {};
}

function validDir(p) {
  if (!p) return null;
  let cur = normalizePath(p);
  for (let i = 0; i < 24; i++) {
    try {
      if (fs.statSync(cur).isDirectory()) return cur;
    } catch (e) {}
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  return null;
}

function rememberDir(kind, p) {
  try {
    if (!p) return;
    const st = fs.statSync(p);
    const dir = st.isDirectory() ? p : path.dirname(p);
    const s = readSettingsSync();
    s.lastDirs = s.lastDirs || {};
    s.lastDirs[kind] = dir;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {}
}

// 当前打开项目的文件夹：项目内所有文件选择/保存对话框都默认从这里开始，
// 未打开项目时才回退到各对话框上次使用的目录。
let currentProjectDir = null;
function setCurrentProjectDir(p) {
  currentProjectDir = p ? validDir(p) : null;
}

function lastDirFor(kind) {
  const s = readSettingsSync();
  return validDir(s.lastDirs && s.lastDirs[kind]);
}

function withLastDir(kind, opts) {
  if (currentProjectDir) return Object.assign({}, opts, { defaultPath: currentProjectDir });
  const d = lastDirFor(kind);
  return d ? Object.assign({}, opts, { defaultPath: d }) : opts;
}

function saveDefaultPath(kind, defaultName) {
  if (currentProjectDir) return path.join(currentProjectDir, defaultName);
  const d = lastDirFor(kind);
  return d ? path.join(d, defaultName) : defaultName;
}

// ---------------------------------------------------------------------------
// Zip helpers (PowerShell)
// ---------------------------------------------------------------------------
function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ...args], {
      windowsHide: true
    });
    let out = '';
    let err = '';
    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));
    child.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error('PowerShell failed (' + code + '): ' + err));
    });
  });
}

async function unzipLevel(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  // Expand-Archive only supports .zip files, so stage a .zip copy first.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_unzip_'));
  const tmpZip = path.join(tmpDir, path.basename(zipPath) + '.zip');
  fs.copyFileSync(zipPath, tmpZip);
  const cmd = `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${destDir}' -Force`;
  await runPowerShell([cmd]);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function zipLevel(srcDir, outZip) {
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
  const tmpZip = outZip + '.zip';
  if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
  // Only pack the level contents; skip chart backups and editor-only files.
  const items = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => !/^chart_backup/i.test(e.name) && !/^chartbackup/i.test(e.name) && !PROJECT_EXT_RE.test(e.name))
    .map((e) => path.join(srcDir, e.name));
  const paths = items.map((p) => `'${p.replace(/'/g, "''")}'`).join(',');
  const cmd = `Compress-Archive -Path ${paths} -DestinationPath '${tmpZip}' -CompressionLevel Optimal`;
  await runPowerShell([cmd]);
  fs.renameSync(tmpZip, outZip);
}

// ---------------------------------------------------------------------------
// Level reading
// ---------------------------------------------------------------------------
function readLevelFolder(levelDir) {
  const levelPath = path.join(levelDir, 'level.json');
  if (!fs.existsSync(levelPath)) throw new Error('该文件夹中没有 level.json，不是有效的 Cytoid 关卡目录');
  const level = readJsonSafe(levelPath);
  if (!level) throw new Error('level.json 解析失败');

  const files = [];
  (function walk(dir, rel) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const relPath = rel ? rel + '/' + name : name;
      if (fs.statSync(full).isDirectory()) walk(full, relPath);
      else {
        const st = fs.statSync(full);
        files.push({ name: relPath, size: st.size, mtimeMs: st.mtimeMs });
      }
    }
  })(levelDir, '');

  const charts = [];
  for (const chart of level.charts || []) {
    const chartPath = path.join(levelDir, chart.path || '');
    const item = {
      type: chart.type || 'base',
      name: chart.name,
      path: chart.path || '',
      difficulty: chart.difficulty,
      musicOverride: chart.music_override ? chart.music_override.path : null,
      content: fs.existsSync(chartPath) ? fs.readFileSync(chartPath, 'utf8') : '',
      storyboardPath: null,
      storyboardContent: null
    };
    if (chart.storyboard && chart.storyboard.path) {
      const sbPath = path.join(levelDir, chart.storyboard.path);
      if (fs.existsSync(sbPath)) {
        item.storyboardPath = chart.storyboard.path;
        item.storyboardContent = fs.readFileSync(sbPath, 'utf8');
      }
    }
    charts.push(item);
  }

  return {
    level,
    levelDir,
    files,
    charts
  };
}

// ---------------------------------------------------------------------------
// Project (.ctr / legacy .ctdsber) support
// ---------------------------------------------------------------------------
const EMPTY_STORYBOARD = JSON.stringify({
  sprites: [], texts: [], videos: [], lines: [],
  controllers: [], note_controllers: [], templates: {}
}, null, 2);

function readProjectConfig(cfgPath) {
  const cfg = readJsonSafe(cfgPath);
  if (!cfg || cfg.format !== 'cytoid-storyboarder-project') {
    throw new Error('不是有效的 Cyster 项目文件 (.ctr / .ctdsber)');
  }
  if (!cfg.files || !cfg.files.chart || !cfg.files.music) {
    throw new Error('项目文件缺少音乐/谱面配置');
  }
  return cfg;
}

function writeProjectConfig(cfgPath, name, files, editor) {
  const existing = readJsonSafe(cfgPath) || {};
  const cfg = {
    format: 'cytoid-storyboarder-project',
    version: 2,
    name,
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_version: '0.1.0-beta',
    files,
    // Editor-only state (material library, hidden/locked objects, collapsed
    // tags) is owned by the project file, not the storyboard; keep it across
    // config rewrites.
    editor: editor !== undefined ? editor : (existing.editor || undefined)
  };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

// Cytoid 关卡难度分类只有三种固定形式：easy / hard / extreme。新建项目默认
// 创建 easy（渲染层显式传入）；其它调用路径仍把非法值（base/re/空）规范到
// extreme，避免写进 "base" 这类非标准难度。
function normalizeDifficultyType(t) {
  const v = String(t || '').toLowerCase().trim();
  return ['easy', 'hard', 'extreme'].includes(v) ? v : 'extreme';
}

function writeLevelJson(levelDir, name, files, chartType, levelId) {
  // 重建时优先保留已有 level.json 的难度分类（仍规范到 easy/hard/extreme），
  // 避免更换文件等重建路径把既有难度冲成默认值。
  const existingLevel = readJsonSafe(path.join(levelDir, 'level.json')) || {};
  const existingChartType = existingLevel.charts && existingLevel.charts[0] && existingLevel.charts[0].type;
  const level = {
    schema_version: 2,
    version: 1,
    id: String(levelId || name).replace(/[^a-zA-Z0-9._-]/g, '_') || 'project',
    title: name,
    artist: '',
    illustrator: '',
    charter: '',
    storyboarder: '',
    music: { path: files.music }
  };
  if (files.background) level.background = { path: files.background };
  const chart = {
    type: normalizeDifficultyType(chartType || existingChartType),
    path: files.chart,
    difficulty: 1
  };
  if (files.storyboard) chart.storyboard = { path: files.storyboard };
  level.charts = [chart];
  fs.writeFileSync(path.join(levelDir, 'level.json'), JSON.stringify(level, null, 2), 'utf8');
}

function projectInfoFrom(projectPath) {
  const config = readProjectConfig(projectPath);
  const dir = path.dirname(projectPath);
  if (!fs.existsSync(path.join(dir, 'level.json'))) writeLevelJson(dir, config.name, config.files);
  return { info: readLevelFolder(dir), config, projectPath };
}

// Update the referenced file paths in an existing level.json in place, so the
// multi-difficulty chart list, music_override entries and any other metadata
// survive file switching (the old logic rebuilt level.json as a single-chart
// level, which flattened imported multi-difficulty levels).
function updateLevelFilePaths(levelDir, kind, oldName, newName) {
  const levelPath = path.join(levelDir, 'level.json');
  const level = readJsonSafe(levelPath);
  if (!level || typeof level !== 'object') return false;
  let changed = false;
  if (kind === 'music') {
    if (level.music && level.music.path === oldName) {
      level.music.path = newName;
      changed = true;
    }
  } else if (kind === 'background') {
    if (level.background && level.background.path === oldName) {
      level.background.path = newName;
      changed = true;
    }
  } else if (kind === 'chart') {
    for (const c of level.charts || []) {
      if (c.path === oldName) {
        c.path = newName;
        changed = true;
        break;
      }
    }
  } else if (kind === 'storyboard') {
    for (const c of level.charts || []) {
      if (c.storyboard && c.storyboard.path === oldName) {
        c.storyboard.path = newName;
        changed = true;
        break;
      }
    }
  }
  if (changed) fs.writeFileSync(levelPath, JSON.stringify(level, null, 2), 'utf8');
  return changed;
}

async function openLevelFromZip(zipPath) {
  const basename = path.basename(zipPath, path.extname(zipPath));
  const safeName = basename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  const destDir = path.join(PROJECTS_ROOT, safeName + '_' + Date.now());
  await unzipLevel(zipPath, destDir);
  return readLevelFolder(destDir);
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('dialog:open-level', async () => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('open-level', {
    title: '选择 Cytoid 关卡 (.cytoidlevel)',
    filters: [
      { name: 'Cytoid 关卡', extensions: ['cytoidlevel'] },
      { name: '压缩包', extensions: ['zip'] }
    ],
    properties: ['openFile']
  }));
  if (res.canceled || !res.filePaths.length) return null;
  rememberDir('open-level', res.filePaths[0]);
  try {
    const info = await openLevelFromZip(res.filePaths[0]);
    setCurrentProjectDir(info && info.levelDir);
    return info;
  } catch (e) {
    throw new Error('打开关卡失败: ' + e.message);
  }
});

ipcMain.handle('dialog:open-level-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('open-level-folder', {
    title: '选择 Cytoid 关卡目录（包含 level.json）',
    properties: ['openDirectory']
  }));
  if (res.canceled || !res.filePaths.length) return null;
  rememberDir('open-level-folder', res.filePaths[0]);
  const info = readLevelFolder(res.filePaths[0]);
  setCurrentProjectDir(info.levelDir);
  return info;
});

ipcMain.handle('dialog:pick-file', async (e, opts) => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('pick-file', {
    title: (opts && opts.title) || '选择文件',
    filters: (opts && opts.filters) || [],
    properties: ['openFile']
  }));
  if (res.canceled || !res.filePaths.length) return null;
  rememberDir('pick-file', res.filePaths[0]);
  return res.filePaths[0];
});

ipcMain.handle('dialog:pick-folder', async (e, opts) => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('pick-folder', {
    title: (opts && opts.title) || '选择文件夹',
    properties: ['openDirectory']
  }));
  if (res.canceled || !res.filePaths.length) return null;
  rememberDir('pick-folder', res.filePaths[0]);
  return res.filePaths[0];
});

ipcMain.handle('project:create', async (e, p) => {
  const projectPath = normalizePath(p.projectPath);
  const name = String(p.name || '未命名项目').trim() || '未命名项目';
  const levelId = String(p.levelId || '').trim();
  const dir = path.dirname(projectPath);
  setCurrentProjectDir(dir);
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  if (p.music) { files.music = path.basename(p.music); fs.copyFileSync(p.music, path.join(dir, files.music)); }
  if (p.chart) { files.chart = path.basename(p.chart); fs.copyFileSync(p.chart, path.join(dir, files.chart)); }
  if (p.background) { files.background = path.basename(p.background); fs.copyFileSync(p.background, path.join(dir, files.background)); }
  if (p.storyboard) { files.storyboard = path.basename(p.storyboard); fs.copyFileSync(p.storyboard, path.join(dir, files.storyboard)); }
  else { files.storyboard = 'storyboard.json'; fs.writeFileSync(path.join(dir, 'storyboard.json'), EMPTY_STORYBOARD, 'utf8'); }
  if (!files.music || !files.chart) throw new Error('音乐与谱面为必选文件');
  writeLevelJson(dir, name, files, p.chartType || 'easy', levelId);
  writeProjectConfig(projectPath, name, files);
  return projectInfoFrom(projectPath);
});

ipcMain.handle('project:open', async (e, p) => {
  const projectPath = normalizePath(p.path);
  setCurrentProjectDir(path.dirname(projectPath));
  return projectInfoFrom(projectPath);
});

ipcMain.handle('project:exists', async (e, p) => {
  return fs.existsSync(normalizePath(p.path));
});

ipcMain.handle('project:update-file', async (e, p) => {
  const projectPath = normalizePath(p.projectPath);
  const kind = p.kind;
  const filePath = normalizePath(p.filePath);
  if (!['music', 'chart', 'background', 'storyboard'].includes(kind)) throw new Error('未知文件类型: ' + kind);
  const config = readProjectConfig(projectPath);
  const dir = path.dirname(projectPath);
  setCurrentProjectDir(dir);
  const oldName = config.files[kind];
  const name = path.basename(filePath);
  fs.copyFileSync(filePath, path.join(dir, name));
  config.files[kind] = name;
  writeProjectConfig(projectPath, config.name, config.files);
  // Update the referenced paths in place so multi-difficulty level.json
  // structure (charts, music_override, metadata) is preserved.
  if (!updateLevelFilePaths(dir, kind, oldName, name)) {
    writeLevelJson(dir, config.name, config.files);
  }
  return projectInfoFrom(projectPath);
});

// 关卡信息 / 谱面难度编辑整体保存：把新选择的文件复制进关卡目录，并按编辑结果
// 重写 level.json（保留未编辑的扩展字段），同时同步 .ctr 当前难度的文件映射。
ipcMain.handle('project:apply-level', async (e, p) => {
  if (!p || !p.projectPath) throw new Error('参数缺失');
  const projectPath = normalizePath(p.projectPath);
  const dir = p.levelDir ? normalizePath(p.levelDir) : path.dirname(projectPath);
  setCurrentProjectDir(dir);
  const config = readProjectConfig(projectPath);
  const existingLevel = readJsonSafe(path.join(dir, 'level.json')) || {};
  // 绝对路径 = 新选择的文件：复制进关卡目录并返回文件名；相对路径原样保留。
  const resolveFile = (v) => {
    if (v == null || v === '') return null;
    const s = String(v);
    if (path.isAbsolute(s)) {
      const name = path.basename(s);
      fs.copyFileSync(s, path.join(dir, name));
      return name;
    }
    return s;
  };
  const level = p.level || {};
  const newLevel = {
    ...existingLevel,
    schema_version: level.schema_version != null ? Number(level.schema_version) : existingLevel.schema_version,
    version: level.version != null ? Number(level.version) : existingLevel.version,
    id: level.id != null ? String(level.id) : existingLevel.id,
    title: level.title != null ? String(level.title) : existingLevel.title,
    artist: level.artist != null ? String(level.artist) : existingLevel.artist,
    illustrator: level.illustrator != null ? String(level.illustrator) : existingLevel.illustrator,
    charter: level.charter != null ? String(level.charter) : existingLevel.charter,
    storyboarder: level.storyboarder != null ? String(level.storyboarder) : existingLevel.storyboarder
  };
  // 英文译名与来源 URL 共 5 个可选字段：未填写时不在 level.json 中输出空串。
  for (const k of ['title_localized', 'artist_localized', 'artist_source', 'illustrator_localized', 'illustrator_source']) {
    const v = level[k] != null ? String(level[k]) : (existingLevel[k] != null ? String(existingLevel[k]) : '');
    if (String(v).trim() !== '') newLevel[k] = String(v);
    else delete newLevel[k];
  }
  if (level.music && level.music.path != null) {
    const mp = resolveFile(level.music.path);
    newLevel.music = mp ? { path: mp } : (existingLevel.music || {});
  }
  if (level.music_preview && level.music_preview.path != null) {
    const mpp = resolveFile(level.music_preview.path);
    if (mpp) newLevel.music_preview = { path: mpp };
    else delete newLevel.music_preview;
  }
  if (level.background && level.background.path != null) {
    const bp = resolveFile(level.background.path);
    if (bp) newLevel.background = { path: bp };
    else delete newLevel.background;
  }
  newLevel.charts = (p.charts || []).map((c) => {
    const out = {
      type: normalizeDifficultyType(c.type),
      path: resolveFile(c.path) || '',
      difficulty: c.difficulty != null
        ? Math.max(0, Math.min(16, Math.round(Number(c.difficulty) || 0)))
        : 1
    };
    if (c.name != null && c.name !== '') out.name = String(c.name);
    if (c.music_override && c.music_override.path != null) {
      const mop = resolveFile(c.music_override.path);
      if (mop) out.music_override = { path: mop };
    }
    if (c.storyboard && c.storyboard.path != null) {
      const sbp = resolveFile(c.storyboard.path);
      if (sbp) out.storyboard = { path: sbp };
    }
    return out;
  });
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(newLevel, null, 2), 'utf8');
  // 同步 .ctr 当前难度文件映射（当前难度可能更换了谱面/故事板）。
  const cur = p.currentChartPath;
  const chart = newLevel.charts.find((c) => c.path === cur) || newLevel.charts[0] || {};
  const oldChart = config.files.chart;
  if (chart.path) config.files.chart = chart.path;
  if (chart.storyboard && chart.storyboard.path) config.files.storyboard = chart.storyboard.path;
  if (newLevel.music && newLevel.music.path) config.files.music = newLevel.music.path;
  if (newLevel.background && newLevel.background.path) config.files.background = newLevel.background.path;
  // 中途更换谱面文件（同一难度）：把该难度的编辑器分桶（note 选择器元数据、
  // 合并标记、载体、时间轴等，keyed by chart path）迁移到新谱面路径，避免
  // 重开/重载时选择器元数据丢失、展开克隆无法还原。
  if (oldChart && chart.path && oldChart !== chart.path && config.editor && config.editor.difficulties &&
      config.editor.difficulties[oldChart]) {
    config.editor.difficulties[chart.path] = config.editor.difficulties[oldChart];
    delete config.editor.difficulties[oldChart];
  }
  writeProjectConfig(projectPath, config.name, config.files, config.editor);
  return projectInfoFrom(projectPath);
});

// Point the project's editable files at a chosen difficulty's chart/storyboard
// (the files already exist in the project folder from the import). This keeps
// the per-difficulty storyboard assignment: each difficulty keeps its own file.
ipcMain.handle('project:set-editable', async (e, p) => {
  const projectPath = normalizePath(p.projectPath);
  const config = readProjectConfig(projectPath);
  const dir = path.dirname(projectPath);
  setCurrentProjectDir(dir);
  if (p.chart) config.files.chart = p.chart;
  if (p.storyboard !== undefined) {
    config.files.storyboard = p.storyboard || 'storyboard.json';
    if (!fs.existsSync(path.join(dir, config.files.storyboard))) {
      fs.writeFileSync(path.join(dir, config.files.storyboard), EMPTY_STORYBOARD, 'utf8');
    }
  }
  writeProjectConfig(projectPath, config.name, config.files);
  return projectInfoFrom(projectPath);
});

// Persist editor-only project state (material library, hidden/locked objects,
// collapsed tags) into the .ctr file. The storyboard never carries these.
ipcMain.handle('project:save-state', async (e, p) => {
  const projectPath = normalizePath(p && p.projectPath);
  if (!projectPath || !fs.existsSync(projectPath)) return { ok: false };
  const cfg = readJsonSafe(projectPath) || {};
  if (cfg.format !== 'cytoid-storyboarder-project') return { ok: false };
  cfg.editor = p.state || {};
  cfg.updated_at = new Date().toISOString();
  fs.writeFileSync(projectPath, JSON.stringify(cfg, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.on('app:close-confirmed', () => {
  closeAllowed = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

// Import a .cytoidlevel as a BRAND-NEW project. It never overwrites the
// currently open project: the user picks the parent folder, and a new project
// subfolder (named after the level) is created inside it.
async function importLevelAsNewProject(zipPath, destFolder) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_import_'));
  try {
    await unzipLevel(zipPath, tmpDir);
    const basename = path.basename(zipPath, path.extname(zipPath));
    const tmpLevel = readJsonSafe(path.join(tmpDir, 'level.json')) || {};
    const safe = (s) => String(s || 'level').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'level';
    const projectName = tmpLevel.title || basename;
    // Choose the parent folder (unless a destination was provided explicitly)
    let parentFolder = destFolder;
    if (!parentFolder) {
      const res = await dialog.showOpenDialog(mainWindow, withLastDir('open-folder', {
        title: '选择新建项目所在的文件夹',
        defaultPath: PROJECTS_ROOT,
        properties: ['openDirectory', 'createDirectory']
      }));
      if (res.canceled || !res.filePaths.length) return null;
      parentFolder = res.filePaths[0];
      rememberDir('open-folder', parentFolder);
    }
    let projectDir = path.join(parentFolder, safe(projectName));
    let suffix = 2;
    while (fs.existsSync(projectDir)) {
      projectDir = path.join(parentFolder, `${safe(projectName)}_${suffix++}`);
    }
    fs.mkdirSync(projectDir, { recursive: true });
    // Copy level files (keep everything except chart backups)
    for (const entry of fs.readdirSync(tmpDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (/^chart_backup/i.test(entry.name) || /^chartbackup/i.test(entry.name)) continue;
      fs.copyFileSync(path.join(tmpDir, entry.name), path.join(projectDir, entry.name));
    }
    // Derive the project's file map from level.json (multi-difficulty is kept
    // intact; config points at the editable chart with a storyboard if any)
    const level = readJsonSafe(path.join(projectDir, 'level.json')) || {};
    const charts = level.charts || [];
    const chart = charts.find((c) => c.storyboard && c.storyboard.path) || charts[0] || {};
    const files = {
      music: level.music && level.music.path,
      background: level.background && level.background.path,
      chart: chart.path,
      storyboard: chart.storyboard && chart.storyboard.path
    };
    if (!files.storyboard) {
      files.storyboard = 'storyboard.json';
      if (!fs.existsSync(path.join(projectDir, 'storyboard.json'))) {
        fs.writeFileSync(path.join(projectDir, 'storyboard.json'), EMPTY_STORYBOARD, 'utf8');
      }
    }
    const projectPath = path.join(projectDir, `${safe(projectName)}.ctr`);
    writeProjectConfig(projectPath, projectName, files);
    const info = projectInfoFrom(projectPath);
    setCurrentProjectDir(projectDir);
    return info;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

ipcMain.handle('project:import-level', async () => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('open-level', {
    title: '导入 Cytoid 关卡 (.cytoidlevel)',
    filters: [
      { name: 'Cytoid 关卡', extensions: ['cytoidlevel'] },
      { name: '压缩包', extensions: ['zip'] }
    ],
    properties: ['openFile']
  }));
  if (res.canceled || !res.filePaths.length) return null;
  rememberDir('open-level', res.filePaths[0]);
  return importLevelAsNewProject(res.filePaths[0], null);
});

ipcMain.handle('project:import-level-path', async (e, payload) => {
  if (!payload || !payload.filePath) return null;
  return importLevelAsNewProject(payload.filePath, null);
});

// Explicit-destination variant (used by automated tests; identical logic).
ipcMain.handle('project:import-level-to', async (e, payload) => {
  if (!payload || !payload.filePath || !payload.destFolder) return null;
  return importLevelAsNewProject(payload.filePath, payload.destFolder);
});

ipcMain.handle('dialog:import-json', async () => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('import-json', {
    title: '导入 StoryBoard JSON',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  }));
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  rememberDir('import-json', res.filePaths[0]);
  return {
    canceled: false,
    filePath: res.filePaths[0],
    content: fs.readFileSync(res.filePaths[0], 'utf8')
  };
});

ipcMain.handle('dialog:save-json', async (e, payload) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出 StoryBoard JSON',
    defaultPath: saveDefaultPath('save-json', (payload && payload.defaultName) || 'storyboard.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return null;
  rememberDir('save-json', res.filePath);
  fs.writeFileSync(res.filePath, payload && payload.content != null ? payload.content : '', 'utf8');
  return res.filePath;
});

ipcMain.handle('dialog:open-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, withLastDir('open-folder', {
    title: '选择目录',
    properties: ['openDirectory']
  }));
  if (res.canceled || !res.filePaths.length) return null;
  rememberDir('open-folder', res.filePaths[0]);
  return { path: res.filePaths[0] };
});

ipcMain.handle('level:read-file-buffer', async (e, p) => {
  const full = normalizePath(p);
  const buf = fs.readFileSync(full);
  return { name: path.basename(full), data: buf.toString('base64') };
});

ipcMain.handle('level:read-file-text', async (e, p) => {
  return fs.readFileSync(normalizePath(p), 'utf8');
});

ipcMain.handle('level:add-asset', async (e, payload) => {
  if (!payload || !payload.levelDir || !payload.filePath) throw new Error('参数缺失');
  const dir = normalizePath(payload.levelDir);
  const filePath = normalizePath(payload.filePath);
  if (!fs.existsSync(filePath)) throw new Error('文件不存在: ' + filePath);
  // 关卡内的文件直接用相对路径引用；关卡外的文件拷贝进项目文件夹（重名自动
  // 加 (1)(2) 序号），素材库始终使用项目文件夹内的副本，不依赖外部源路径。
  const rel = path.relative(dir, filePath).replace(/\\/g, '/');
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let dest = path.join(dir, path.basename(filePath));
  let n = 1;
  while (fs.existsSync(dest)) {
    dest = path.join(dir, `${base} (${n++})${ext}`);
  }
  fs.copyFileSync(filePath, dest);
  return path.basename(dest).replace(/\\/g, '/');
});

ipcMain.handle('storyboard:save', async (e, payload) => {
  const { levelDir, fileName, content } = payload;
  const full = path.join(normalizePath(levelDir), fileName);
  fs.writeFileSync(full, content, 'utf8');
  return { ok: true, path: full };
});

ipcMain.handle('project:export-storyboard', async (e, payload) => {
  const { levelDir, fileName, content } = payload;
  const full = path.join(normalizePath(levelDir), fileName);
  fs.writeFileSync(full, content, 'utf8');
  return { ok: true, path: full };
});

ipcMain.handle('project:pack-level', async (e, payload) => {
  const { levelDir, outZip } = payload;
  await zipLevel(normalizePath(levelDir), normalizePath(outZip));
  return { ok: true, path: outZip };
});

ipcMain.handle('dialog:save-level-as', async (e, defaultName) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出关卡 (.cytoidlevel)',
    defaultPath: saveDefaultPath('save-level-as', defaultName || 'level.cytoidlevel'),
    filters: [{ name: 'Cytoid 关卡', extensions: ['cytoidlevel'] }]
  });
  if (res.canceled || !res.filePath) return null;
  rememberDir('save-level-as', res.filePath);
  return res.filePath;
});

ipcMain.handle('dialog:save-project', async (e, defaultName) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Cyster 项目',
    defaultPath: saveDefaultPath('save-project', defaultName || 'project.ctr'),
    filters: [{ name: 'Cyster 项目', extensions: ['ctr', 'ctdsber'] }]
  });
  if (res.canceled || !res.filePath) return null;
  rememberDir('save-project', res.filePath);
  return res.filePath;
});

// ---------------------------------------------------------------------------
// Cytoidplayer launch: copy the current level into <playerDir>/player (moving
// the previous contents to player/Backup file), then start Cytoidplayer.exe.
// The external player is intentionally not tracked after launch.
// ---------------------------------------------------------------------------

function resolvePlayerExe(playerPath) {
  if (!playerPath) return null;
  const p = String(playerPath).trim();
  if (!p) return null;
  if (fs.existsSync(p)) {
    if (path.extname(p).toLowerCase() === '.exe') return p;
    for (const name of ['Cytoidplayer.exe', 'CytoidPlayer.exe']) {
      const exe = path.join(p, name);
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

// Each Cytoidplayer launch creates a brand-new backup folder named
// "Backup file <YYYY-MM-DD HH-mm>" inside the player folder, then moves
// everything currently there (except backup folders) into it. Existing
// backups are never touched or nested into the new one.
function backupPlayerFolder(playerFolder) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  let backupDir = path.join(playerFolder, `Backup file ${ts}`);
  let n = 2;
  while (fs.existsSync(backupDir)) {
    backupDir = path.join(playerFolder, `Backup file ${ts} (${n++})`);
  }
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of fs.readdirSync(playerFolder)) {
    // 备份文件夹（Backup file 开头的所有文件夹）不参与移动，避免嵌套。
    if (String(name).toLowerCase().startsWith('backup file')) continue;
    fs.renameSync(path.join(playerFolder, name), path.join(backupDir, name));
  }
  return backupDir;
}

// Copy the current level's top-level files into the player folder.
function copyLevelToPlayerFolder(levelDir, playerFolder) {
  fs.mkdirSync(playerFolder, { recursive: true });
  for (const name of fs.readdirSync(levelDir)) {
    const src = path.join(levelDir, name);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(playerFolder, name));
  }
}

ipcMain.handle('player:launch-level', async (e, payload) => {
  const { levelDir, playerPath } = payload || {};
  const exe = resolvePlayerExe(playerPath);
  if (!exe) {
    throw new Error('未找到 Cytoidplayer 程序，请在设置中配置 Cytoidplayer 路径');
  }
  if (!levelDir || !fs.existsSync(levelDir)) {
    throw new Error('未找到关卡目录');
  }
  const playerFolder = path.join(path.dirname(exe), 'player');
  backupPlayerFolder(playerFolder);
  copyLevelToPlayerFolder(normalizePath(levelDir), playerFolder);
  try {
    const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
    // 启动失败（exe 被占用/被删除等）不影响本软件；外部 player 不做后续跟踪。
    child.on('error', () => {});
    child.unref();
  } catch (e) { /* spawn 同步抛错同样吞掉 */ }
  return { ok: true };
});

ipcMain.on('app:renderer-ready', () => {
  rendererReady = true;
  if (pendingOpenProject) {
    deliverOpenProject(pendingOpenProject);
    pendingOpenProject = null;
  }
});

ipcMain.handle('settings:get', async () => readJsonSafe(SETTINGS_FILE) || {});
ipcMain.handle('settings:set', async (e, s) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
  return true;
});

ipcMain.handle('app:open-path', async (e, p) => {
  shell.openPath(p);
});

ipcMain.handle('app:open-external', async (e, url) => {
  shell.openExternal(url);
});

// Test-only hooks (active when CYTOID_SB_TEST is set) so automated tests can
// verify the file-dialog path-memory helpers without opening real dialogs.
if (process.env.CYTOID_SB_TEST) {
  module.exports = { validDir, rememberDir, lastDirFor };
}

ipcMain.handle('app:get-asset', async (e, name) => {
    const rel = String(name || '').replace(/\\/g, '/');
    const parts = rel.split('/').filter(Boolean);
    if (parts.length !== 2 || !['flick', 'player', 'fonts', 'easter'].includes(parts[0])) {
      throw new Error('非法资源路径: ' + rel);
    }
  const safe = path.basename(parts[1]);
  const full = path.join(__dirname, 'assets', parts[0], safe);
  if (!fs.existsSync(full)) throw new Error('资源不存在: ' + parts[0] + '/' + safe);
  return { name: safe, data: fs.readFileSync(full).toString('base64') };
});
