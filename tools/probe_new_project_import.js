// 覆盖两条剩余场景：
//  1) 导入 .cytoidlevel 创建的全新 .ctr 项目（无 storyboard 时）→ 保存
//  2) 模拟重启：新进程重新 projectOpen 该项目 → 保存
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_import_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_import_proj_'));
const OUT = path.join(__dirname, 'probe_new_project_import_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};

  // 1) 导入关卡 → 新 .ctr 项目
  R.importRes = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectImportLevelTo({
      filePath: ${JSON.stringify(SAMPLE_ZIP)},
      destFolder: ${JSON.stringify(TMP)}
    });
    if (!res) return null;
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config, mode: 'import-level' });
    await new Promise((r) => setTimeout(r, 1500));
    const s = window.__sb.state;
    return {
      projectPath: s.projectPath,
      levelDir: s.levelDir,
      hasStoryboard: !!s.storyboard,
      storyboardFileName: s.storyboardFileName,
      cfgFiles: s.projectConfig && s.projectConfig.files
    };
  })()`);

  // 2) 加一个对象并保存
  R.save = await win.webContents.executeJavaScript(`(async () => {
    const s = window.__sb.state;
    s.storyboard.sprites.push({
      id: 'sprite_1', path: 'octa.png', time: 0,
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 0, order: 0, preserve_aspect: true,
      states: [{ time: 3 }]
    });
    s.dirty = true;
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    await new Promise((r) => setTimeout(r, 500));
    return { ok, err, fileName: s.storyboardFileName, dirty: s.dirty, projectPath: s.projectPath };
  })()`);

  // 3) 模拟重启：直接 projectOpen 该项目（新进程里同样代码），再保存一次
  R.reopen = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(R.importRes && R.importRes.projectPath)} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    await new Promise((r) => setTimeout(r, 1200));
    const s = window.__sb.state;
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    return {
      ok, err,
      fileName: s.storyboardFileName,
      spriteCount: (s.storyboard && s.storyboard.sprites || []).length,
      projectPath: s.projectPath
    };
  })()`);

  // 磁盘核对：项目目录里写了哪些 storyboard 文件
  const disk = {};
  if (R.importRes && R.importRes.levelDir) {
    disk.dir = R.importRes.levelDir;
    disk.files = fs.readdirSync(R.importRes.levelDir).filter((n) => /\.(json|ctr)$/i.test(n)).map((n) => ({
      name: n,
      size: fs.statSync(path.join(R.importRes.levelDir, n)).size
    }));
  }

  const out = { R, disk };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NEW_PROJECT_IMPORT:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
