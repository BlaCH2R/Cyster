// 复现：创建全新 .ctr 项目（不指定已有 storyboard，由 project:create 生成空
// storyboard.json）后，立即执行保存 StoryBoard，捕获真实失败点。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_newproj_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_newproj_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_newproj_proj_'));
const CTR_PATH = path.join(TMP, 'NewProject.ctr');
const OUT = path.join(__dirname, 'probe_new_project_save_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const setup = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NewProject',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    await new Promise((r) => setTimeout(r, 1200));
    const s = window.__sb.state;
    return {
      projectPath: s.projectPath,
      levelDir: s.levelDir,
      hasStoryboard: !!s.storyboard,
      storyboardKeys: s.storyboard ? Object.keys(s.storyboard) : null,
      storyboardFileName: s.storyboardFileName,
      chartPath: s.chartPath,
      hasChart: !!s.chart,
      cfgFiles: s.projectConfig && s.projectConfig.files,
      dirty: s.dirty
    };
  })()`);

  // 先按真实编辑流程往 storyboard 里加对象：sprite（拖拽素材）、controller
  // （+ 号弹窗启用的属性卡片）、note_controller（note 选择器）。
  const added = await win.webContents.executeJavaScript(`(() => {
    const s = window.__sb.state;
    const spr = {
      id: 'sprite_1', path: 'octa.png', time: 0,
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 0, order: 0, preserve_aspect: true,
      states: [{ time: 3 }]
    };
    s.storyboard.sprites.push(spr);
    const ctl = { id: 'controller_1', time: 0 };
    s.controllerCards = s.controllerCards || {};
    s.controllerCards[ctl.id] = ['camera_x'];
    s.storyboard.controllers.push(ctl);
    const firstNote = s.chart && s.chart.notes && s.chart.notes[0];
    const nc = firstNote
      ? { id: 'note_controller_1', time: firstNote.start_time, note: { type: [firstNote.type] }, states: [] }
      : null;
    if (nc) s.storyboard.note_controllers.push(nc);
    s.dirty = true;
    return { sprite: s.storyboard.sprites.length, ctl: s.storyboard.controllers.length, nc: s.storyboard.note_controllers.length, firstNote: firstNote ? firstNote.id : null };
  })()`);

  // 捕获 toast 文本，再执行保存。
  const save = await win.webContents.executeJavaScript(`(async () => {
    const toasts = [];
    const wrap = document.getElementById('toastWrap');
    if (wrap) {
      const obs = new MutationObserver(() => {
        toasts.push(wrap.textContent.trim());
      });
      obs.observe(wrap, { childList: true, subtree: true, characterData: true });
      window.__toastObs = obs;
    }
    let err = null;
    let ok = false;
    try {
      ok = await window.__sb.saveStoryboard();
    } catch (e) {
      err = String(e && e.stack || e);
    }
    await new Promise((r) => setTimeout(r, 600));
    const s = window.__sb.state;
    return {
      ok,
      err,
      toasts,
      dirty: s.dirty,
      lastSavedAt: s.lastSavedAt ? s.lastSavedAt.toISOString() : null,
      storyboardFileName: s.storyboardFileName
    };
  })()`);

  // 检查磁盘上是否真的写入了 storyboard.json / level.json。
  const disk = {};
  const dir = path.dirname(CTR_PATH);
  for (const f of ['storyboard.json', 'level.json']) {
    const p = path.join(dir, f);
    disk[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }

  const out = { setup, added, save, disk };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NEW_PROJECT_SAVE:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
