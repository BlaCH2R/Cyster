// Probe: verifies the unsaved-changes prompt when switching projects inside
// the app (open another project with unsaved edits -> 取消 / 不保存 / 保存并
// 继续), using temp copies so the user's project files are never touched.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_us_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_unsaved_switch_out.json");
const LOG = path.join(__dirname, "probe_unsaved_switch_log.txt");
const log = (m) => fs.appendFileSync(LOG, new Date().toISOString() + " " + m + "\n");
const SRC = "V:/cytoid storyboarder/项目/测试：效果/EffectsTest";

function copyProject(dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(SRC)) {
    fs.copyFileSync(path.join(SRC, name), path.join(dst, name));
  }
}

function buildInfo(DIR) {
  const ctr = JSON.parse(fs.readFileSync(path.join(DIR, "parent_note_to_sprite.ctr"), "utf8"));
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const chartPath = "chart.base.txt";
  const charts = [{
    type: "easy", path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
    storyboardPath: "storyboard.json",
    storyboardContent: fs.readFileSync(path.join(DIR, "storyboard.json"), "utf8")
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return {
    info: { level, levelDir: DIR, files, charts },
    config: { projectPath: path.join(DIR, "parent_note_to_sprite.ctr"), config: ctr }
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_us_"));
  try {
    log("copy projects");
    const dirA = path.join(tmpRoot, "A");
    const dirB = path.join(tmpRoot, "B");
    copyProject(dirA);
    copyProject(dirB);

    await sleep(2000);
    log("win ready");
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const b = buildInfo(dirA);
    log("load A");
    await win.webContents.executeJavaScript(
      `window.__sb.loadLevelInfo(${JSON.stringify(b.info)}, ${JSON.stringify(b.config)})`);
    await sleep(3500);
    log("A loaded");
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const clickBtn = (label) => `(() => {
      const btns = [...document.querySelectorAll('#modalFoot .dlg-btn')];
      const btn = btns.find((x) => x.textContent === ${JSON.stringify(label)});
      if (btn) { btn.click(); return true; }
      return false;
    })()`;
    const modalInfo = `(() => {
      const mask = document.getElementById('modalMask');
      const title = document.getElementById('modalTitle');
      const text = document.getElementById('modalBody') ? document.getElementById('modalBody').textContent : '';
      return { open: !!mask && !mask.classList.contains('hidden'),
        title: title ? title.textContent : null, text: text.slice(0, 60) };
    })()`;

    const out = {};
    // 1) 有未保存修改 -> 打开另一项目 -> 出现提示
    await win.webContents.executeJavaScript(`window.__sb.state.dirty = true;`);
    log("call openProjectFilePath (unsaved)");
    await win.webContents.executeJavaScript(
      `window.__sb.openProjectFilePath(${JSON.stringify(path.join(dirB, 'parent_note_to_sprite.ctr'))}); 0`);
    await sleep(300);
    log("after call 1");
    out.prompt1 = await win.webContents.executeJavaScript(modalInfo);
    // 点取消 -> 项目不变
    await win.webContents.executeJavaScript(clickBtn('取消'));
    await sleep(300);
    log("clicked cancel");
    out.afterCancel = await win.webContents.executeJavaScript(
      `window.__sb.state.projectPath`);

    // 2) 再次切换 -> 点“不保存” -> 进入“在哪里打开项目” -> 确认切换
    await win.webContents.executeJavaScript(`window.__sb.state.dirty = true;`);
    log("call openProjectFilePath (discard)");
    await win.webContents.executeJavaScript(
      `window.__sb.openProjectFilePath(${JSON.stringify(path.join(dirB, 'parent_note_to_sprite.ctr'))}); 0`);
    await sleep(300);
    log("after call 2");
    await win.webContents.executeJavaScript(clickBtn('不保存'));
    await sleep(300);
    log("clicked discard");
    out.prompt2 = await win.webContents.executeJavaScript(modalInfo);
    await win.webContents.executeJavaScript(clickBtn('关闭当前项目并打开'));
    await sleep(4500);
    log("clicked confirm switch 1");
    out.afterDiscard = await win.webContents.executeJavaScript(
      `window.__sb.state.projectPath`);

    // 3) 无未保存修改 -> 直接进入切换确认（无未保存提示）
    await win.webContents.executeJavaScript(`window.__sb.state.dirty = false;`);
    log("call openProjectFilePath (clean)");
    await win.webContents.executeJavaScript(
      `window.__sb.openProjectFilePath(${JSON.stringify(path.join(dirA, 'parent_note_to_sprite.ctr'))}); 0`);
    await sleep(300);
    log("after call 3");
    out.prompt3 = await win.webContents.executeJavaScript(modalInfo);
    await win.webContents.executeJavaScript(clickBtn('关闭当前项目并打开'));
    await sleep(4500);
    log("clicked confirm switch 2");
    out.afterClean = await win.webContents.executeJavaScript(
      `window.__sb.state.projectPath`);

    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(0);
  }
});
