// Probe: verifies the unsaved-changes prompt when switching via the welcome
// page's "recent projects" entry (previously it bypassed the prompt).
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_rs_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_recent_switch_out.json");
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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_rs_"));
  try {
    const dirA = path.join(tmpRoot, "A");
    const dirB = path.join(tmpRoot, "B");
    copyProject(dirA);
    copyProject(dirB);
    const pB = path.join(dirB, "parent_note_to_sprite.ctr");

    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const b = buildInfo(dirA);
    await win.webContents.executeJavaScript(
      `window.__sb.loadLevelInfo(${JSON.stringify(b.info)}, ${JSON.stringify(b.config)})`);
    await sleep(3500);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const clickBtn = (label) => `(() => {
      const btn = [...document.querySelectorAll('#modalFoot .dlg-btn')]
        .find((x) => x.textContent === ${JSON.stringify(label)});
      if (btn) { btn.click(); return true; }
      return false;
    })()`;
    const modalInfo = `(() => {
      const mask = document.getElementById('modalMask');
      return { open: !!mask && !mask.classList.contains('hidden'),
        title: document.getElementById('modalTitle').textContent };
    })()`;

    const out = {};
    // 欢迎页 + 最近项目列表（写入 B 路径）
    await win.webContents.executeJavaScript(
      `window.__sb.state.settings = window.__sb.state.settings || {};
       window.__sb.state.settings.recentProjects = [${JSON.stringify(pB)}];
       window.__sb.state.dirty = true;
       window.__sb.showWelcome();`);
    await sleep(400);
    // 点击最近项目条目（不等待：后续对话框由后续调用操作）
    await win.webContents.executeJavaScript(
      `document.querySelector('#recentProjects .recent-item').click(); 0`);
    await sleep(400);
    out.prompt1 = await win.webContents.executeJavaScript(modalInfo);
    await win.webContents.executeJavaScript(clickBtn('取消'));
    await sleep(300);
    out.afterCancel = await win.webContents.executeJavaScript(
      `window.__sb.state.projectPath`);

    // 再次点击 -> 不保存 -> 哪里打开 -> 确认切换
    await win.webContents.executeJavaScript(
      `window.__sb.state.dirty = true;
       document.querySelector('#recentProjects .recent-item').click(); 0`);
    await sleep(400);
    await win.webContents.executeJavaScript(clickBtn('不保存'));
    await sleep(300);
    out.prompt2 = await win.webContents.executeJavaScript(modalInfo);
    await win.webContents.executeJavaScript(clickBtn('关闭当前项目并打开'));
    await sleep(4500);
    out.afterSwitch = await win.webContents.executeJavaScript(
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
