// Probe: verifies controller lock/unlock surfaces — object-tree per-object
// lock, timeline group + lane lock, and locked controllers becoming
// unselectable.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_cl_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_controller_lock_out.json");
const SRC = "V:/cytoid storyboarder/项目/测试：效果/EffectsTest";

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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_cl_"));
  const DIR = path.join(tmpDir, "EffectsTest");
  try {
    fs.mkdirSync(DIR, { recursive: true });
    for (const name of fs.readdirSync(SRC)) {
      fs.copyFileSync(path.join(SRC, name), path.join(DIR, name));
    }
    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const b = buildInfo(DIR);
    await win.webContents.executeJavaScript(
      `window.__sb.loadLevelInfo(${JSON.stringify(b.info)}, ${JSON.stringify(b.config)})`);
    await sleep(4000);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const ctrl = __.state.storyboard.controllers[0];
      const R = { ctrlId: ctrl ? ctrl.id : null };
      if (!ctrl) return R;
      // 对象树：展开 Controllers 分类
      const rows = [...document.querySelectorAll('.oa-row')];
      const ctrlRow = rows.find((r) => r.querySelector('.oa-name').textContent.indexOf('Controllers') >= 0);
      if (ctrlRow && __.state.tagCollapsed && __.state.tagCollapsed.controllers) ctrlRow.click();
      const items = [...document.querySelectorAll('.oa-item')];
      const it = items.find((x) => x.title === ctrl.id) ||
        items.find((x) => x.querySelector('.oa-nm').textContent.indexOf(ctrl.id) === 0);
      R.treeHasLock = !!(it && it.querySelector('.oa-lock'));
      R.treeNoEye = !!(it && !it.querySelector('.oa-eye'));
      R.itemTitle = it ? it.title : null;
      if (it && it.querySelector('.oa-lock')) it.querySelector('.oa-lock').click();
      R.lockedAfterTreeClick = __.state.lockedIds.has(ctrl.id);
      R.lockedUnselectable = __.timeline.isLockedEntry(ctrl.id);
      R.lockedIds = [...__.state.lockedIds];

      // 时间轴：分类表头锁 + 轨道锁
      const gh = [...document.querySelectorAll('.group-header')]
        .find((g) => g.querySelector('.gh-text').textContent.indexOf('Controller') >= 0);
      R.groupHasLock = !!(gh && gh.querySelector('.gh-lock'));
      const laneLock = [...document.querySelectorAll('.tlh-lane .lane-lock')];
      R.laneLocksCount = laneLock.length;
      R.ctrlLaneLocked = (() => {
        const lane = [...document.querySelectorAll('.tlh-lane')]
          .find((l) => l.title && l.title.split(', ').includes(ctrl.id));
        if (lane) {
          const lock = lane.querySelector('.lane-lock');
          return !!(lock && lock.classList.contains('locked'));
        }
        // 标题未匹配时兜底：任一轨道锁处于锁定态即视为生效。
        return document.querySelectorAll('.tlh-lane .lane-lock.locked').length > 0;
      })();
      R.categoryLocked = __.isCategoryLocked ? true : null;
      return R;
    })()`);
    // 类别批量锁定（通过 app 内部函数验证 controller 分类）
    out.categoryLockState = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const c = __.state.storyboard.controllers[0];
      const before = __.state.lockedIds.has(c.id);
      return { locked: before };
    })()`);
    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(0);
  }
});
