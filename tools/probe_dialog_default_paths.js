// 项目内对话框默认路径探针：打开项目后，所有文件选择/保存对话框的默认路径
// 应为项目所在文件夹（添加素材、项目设置、导入 storyboard/cytoidlevel 等）；
// 未打开项目时保持原有“上次目录”回退（此处为无默认路径）。
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlg_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
// 预先种一个“上次使用目录”，验证打开项目后项目文件夹会覆盖它。
const SETTINGS = path.join(app.getPath('userData'), 'settings.json');
const TMP3 = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlg_mem_'));
fs.writeFileSync(SETTINGS, JSON.stringify({ lastDirs: { 'pick-file': TMP3 } }));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlg_proj_'));
const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlg_proj2_'));
const OUT = path.join(__dirname, 'probe_dialog_default_paths_out.json');
const PROG = path.join(__dirname, '_dlg_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const CTR = path.join(TMP, 'Proj.ctr');
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 't', title: 'T',
  music: { path: 'm.ogg' },
  charts: [{ type: 'easy', path: 'c.txt' }]
}));
fs.writeFileSync(path.join(TMP, 'm.ogg'), 'x');
fs.writeFileSync(path.join(TMP, 'c.txt'), 'x');
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'Proj',
  files: { music: 'm.ogg', chart: 'c.txt', storyboard: 'sb.json' }
}));
const MUSIC = path.join(TMP, 'm.ogg');
const CHART = path.join(TMP, 'c.txt');

let capturedOpen = null;
let capturedSave = null;
dialog.showOpenDialog = async (win, opts) => { capturedOpen = opts; return { canceled: true, filePaths: [] }; };
dialog.showSaveDialog = async (win, opts) => { capturedSave = opts; return { canceled: true, filePath: null }; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null;
const js = (code) => win.webContents.executeJavaScript(code);

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2000));
  prog('ready');
  win = BrowserWindow.getAllWindows()[0];
  win.setSize(1200, 800);
  await new Promise((r) => setTimeout(r, 400));

  const R = {};

  // 1) 未打开项目：pick-file 沿用“上次使用目录”
  capturedOpen = null;
  await js(`window.sbAPI.pickFile({ title: 't' })`);
  R.beforeProject = capturedOpen && capturedOpen.defaultPath;

  // 2) 打开项目后：pick-file / save-project / import-json / open-level / import-level 均默认项目文件夹
  await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  capturedOpen = null;
  await js(`window.sbAPI.pickFile({ title: 't' })`);
  R.pickFile = capturedOpen && capturedOpen.defaultPath;
  capturedSave = null;
  await js(`window.sbAPI.saveProjectAs('x.ctr')`);
  R.saveProject = capturedSave && capturedSave.defaultPath;
  capturedOpen = null;
  await js(`window.sbAPI.importJsonFile()`);
  R.importJson = capturedOpen && capturedOpen.defaultPath;
  capturedOpen = null;
  await js(`window.sbAPI.openLevel()`);
  R.openLevel = capturedOpen && capturedOpen.defaultPath;
  capturedOpen = null;
  await js(`window.sbAPI.projectImportLevel()`);
  R.importLevel = capturedOpen && capturedOpen.defaultPath;
  capturedOpen = null;
  await js(`window.sbAPI.openLevelFolder()`);
  R.openLevelFolder = capturedOpen && capturedOpen.defaultPath;

  // 3) 新建项目到其它目录后：默认路径跟随新项目文件夹
  const newCtr = path.join(TMP2, 'New.ctr');
  await js(`window.sbAPI.projectCreate({
    projectPath: ${JSON.stringify(newCtr)},
    name: 'New',
    music: ${JSON.stringify(MUSIC)},
    chart: ${JSON.stringify(CHART)},
    chartType: 'hard'
  })`);
  capturedOpen = null;
  await js(`window.sbAPI.pickFile({ title: 't' })`);
  R.afterCreate = capturedOpen && capturedOpen.defaultPath;

  const norm = (p) => p ? path.normalize(p).toLowerCase() : p;
  const out = { R };
  out.ok = !!(
    norm(R.beforeProject) === norm(TMP3) &&
    norm(R.pickFile) === norm(TMP) &&
    norm(R.saveProject) === norm(path.join(TMP, 'x.ctr')) &&
    norm(R.importJson) === norm(TMP) &&
    norm(R.openLevel) === norm(TMP) &&
    norm(R.importLevel) === norm(TMP) &&
    norm(R.openLevelFolder) === norm(TMP) &&
    norm(R.afterCreate) === norm(TMP2)
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('DLG_PATHS:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
