// Verify R1: the note-selector editor runs in a SEPARATE process window
// (freely draggable/resizable), talking to the main renderer via IPC:
//  - 工具 menu opens the real window
//  - the tool computes hit counts locally and highlights via the main preview
//  - apply creates/updates a note_controller from the main window's selection
//  - manual pick from the tool converts the filter to a [] array (nsPicked push)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nsw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_nsw_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nsw_proj_'));
const CTR_PATH = path.join(TMP, 'NsWindow.ctr');
const CHART = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\chart.base.txt', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NsWindow',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.chart = new window.SBEngine.chart.Chart(${JSON.stringify(CHART)}, {});
    S.chartText = ${JSON.stringify(CHART)};
    window.__sb.preview.chart = S.chart;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    window.__sb.preview.setStoryboard(S.storyboard);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(300);

  // 1) 工具菜单打开独立进程窗口。
  await win.webContents.executeJavaScript(`document.querySelector('.menu-entry[data-action="note-selector-editor"]').click()`);
  await sleep(900);
  const tw = BrowserWindow.getAllWindows().find((w) => w !== win);
  const windowOpened = !!tw && !tw.isDestroyed();
  const windowFree = windowOpened && tw.isResizable() && tw.getParentWindow() == null &&
    tw.getBounds().width >= 300;
  const hitAll = windowOpened ? await tw.webContents.executeJavaScript(`document.querySelector('#nsHit').textContent`) : '';

  // 2) 工具内勾选 Drag 头/子 → 命中 388；主窗口预览高亮同步。
  if (windowOpened) {
    await tw.webContents.executeJavaScript(`(() => {
      document.querySelectorAll('#nsTypes input').forEach((cb) => { cb.checked = [3, 4].includes(Number(cb.dataset.t)); });
      document.querySelectorAll('#nsTypes input').forEach((cb) => cb.dispatchEvent(new Event('change', { bubbles: true })));
    })()`);
    await sleep(200);
  }
  const hitDrag = windowOpened ? await tw.webContents.executeJavaScript(`document.querySelector('#nsHit').textContent`) : '';
  const hlSize = await win.webContents.executeJavaScript(
    `window.__sb.preview.highlightNotes ? window.__sb.preview.highlightNotes.size : -1`);

  // 3) 主窗口选中 note 78/79，工具点“应用”→ 创建选择器控制器。
  await win.webContents.executeJavaScript(`window.__sb.selectObjects(['note::78', 'note::79'], {})`);
  await sleep(120);
  await tw.webContents.executeJavaScript(`document.querySelector('#nsApply').click()`);
  await sleep(250);
  const applied = await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    const nc = (S.storyboard.note_controllers || []).find((x) =>
      x.note && typeof x.note === 'object' && Array.isArray(x.note.type) &&
      x.note.type.join(',') === '3,4');
    return { found: !!nc, id: nc ? nc.id : null };
  })()`);

  // 4) 工具开启手动拾取 → 主窗口点击 click note 0 → 只改草稿（对象保持原样），
  //    工具列表实时显示草稿；点击“应用”后才写回为 [] 数组。
  if (windowOpened) {
    await tw.webContents.executeJavaScript(`document.querySelector('#nsPick').click()`);
    await sleep(200);
  }
  const pickOn = await win.webContents.executeJavaScript(`window.__sb.state.notePickerActive`);
  await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    const n0 = S.chart.noteById(0);
    window.__sb.setTime(n0.start_time, false);
  })()`);
  await sleep(150);
  await win.webContents.executeJavaScript(`(() => {
    const info = window.__sb.preview.ctxInfo();
    const p = window.__sb.preview.notePos(window.__sb.state.chart.noteById(0), info);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true,
      clientX: cr.left + p.x * (cr.width / cv.width), clientY: cr.top + p.y * (cr.height / cv.height) }));
  })()`);
  await sleep(300);
  const pickedPending = await win.webContents.executeJavaScript(`(() => {
    const nc = (window.__sb.state.storyboard.note_controllers || [])
      .find((x) => x.id === ${JSON.stringify(applied.id)});
    return { array: Array.isArray(nc && nc.note), note: nc && nc.note };
  })()`);
  const toolAfterPick = windowOpened
    ? await tw.webContents.executeJavaScript(`document.querySelector('#nsStatus').textContent`)
    : '';
  // 应用草稿：对象才真正转为 [] 数组并写入拾取的 note。
  if (windowOpened) {
    await tw.webContents.executeJavaScript(`document.querySelector('#nsApply').click()`);
    await sleep(300);
  }
  const picked = await win.webContents.executeJavaScript(`(() => {
    const nc = (window.__sb.state.storyboard.note_controllers || [])
      .find((x) => x.id === ${JSON.stringify(applied.id)});
    return { array: Array.isArray(nc && nc.note), includes0: !!(nc && Array.isArray(nc.note) && nc.note.includes(0)), len: nc && nc.note.length };
  })()`);

  // 5) 关闭独立窗口 → 拾取模式退出。
  if (windowOpened) await tw.webContents.executeJavaScript(`window.close()`);
  await sleep(300);
  const pickCleared = await win.webContents.executeJavaScript(`window.__sb.state.notePickerActive === false`);
  const windowClosed = !BrowserWindow.getAllWindows().find((w) => w !== win && !w.isDestroyed());

  const out = { windowOpened, windowFree, hitAll, hitDrag, hlSize, applied, pickOn, pickedPending, picked, toolAfterPick, pickCleared, windowClosed };
  out.ok = !!(
    out.windowOpened && out.windowFree &&
    /1160/.test(out.hitAll) && /388/.test(out.hitDrag) && out.hlSize === 388 &&
    out.applied && out.applied.found &&
    out.pickOn === true &&
    !out.pickedPending.array &&
    out.picked && out.picked.array && out.picked.includes0 && out.picked.len > 300 &&
    /手动列表|列表/.test(out.toolAfterPick) &&
    out.pickCleared && out.windowClosed
  );
  fs.writeFileSync(path.join(__dirname, 'probe_note_selector_window_out.json'), JSON.stringify(out, null, 2));
  console.log('NSW_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_note_selector_window_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
