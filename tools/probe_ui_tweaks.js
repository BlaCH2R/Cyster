// Probe: verifies (1) no eyedropper button next to color fields, (2) sprite
// color tints at 50% alpha, (3) controller filter card titles carry the
// English key.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_ut_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_ui_tweaks_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\n";

function buildInfo() {
  const storyboard = JSON.stringify({
    sprites: [
      { id: "s1", time: 0, x: 0.5, y: 0.5, opacity: 1, color: "#ff0000", path: "dad.png" },
      { id: "s2", time: 0, x: 0.5, y: 0.5, opacity: 1, path: "dad.png" }
    ],
    texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.ut", title: "UI Tweaks Probe",
      music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }]
    },
    levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
    files: [],
    charts: [{
      type: "easy", path: "chart.easy.txt", content: CHART,
      storyboardPath: "storyboard.json", storyboardContent: storyboard
    }]
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await sleep(2500);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(async () => {
      const __ = window.__sb;
      const R = {};
      // 1) 颜色字段旁边不再有取色按钮
      __.selectObject('s1', -1);
      const colorField = [...document.querySelectorAll('#stateForm .field')]
        .find((f) => f.querySelector('input[type=color]'));
      R.eyedropperGone = !!(colorField && !colorField.querySelector('.eyedropper-btn') &&
        colorField.textContent.indexOf('取色') < 0);

      // 2) 真实渲染路径：拦截 spriteTintDraw，检查传入颜色的 alpha 是否减半
      const pv = __.preview;
      const captures = [];
      const origTint = pv.spriteTintDraw;
      pv.spriteTintDraw = function (...args) {
        captures.push(args[6] ? { ...args[6] } : null);
        return origTint.apply(this, args);
      };
      pv.render();
      pv.render();
      pv.spriteTintDraw = origTint;
      const colored = captures.find((c) => c && !(c.r === 1 && c.g === 1 && c.b === 1 && c.a === 1));
      R.tintCaptured = colored ? { r: colored.r, g: colored.g, b: colored.b, a: colored.a } : null;
      R.spriteTintHalf = !!colored && Math.abs(colored.a - 0.5) < 1e-9;

      // 3) 滤镜卡片标题带英文原文
      const cards = window.SBSchema.CONTROLLER_CARDS;
      R.bloomLabel = cards.find((c) => c.key === 'bloom').label;
      R.chromaticalLabel = cards.find((c) => c.key === 'chromatical').label;
      R.tapeLabel = cards.find((c) => c.key === 'tape').label;
      R.filterEnglishOk = R.bloomLabel === '泛光(bloom)' &&
        R.chromaticalLabel === '色散滤镜(chromatical)' && R.tapeLabel === '磁带翻转(tape)';
      return R;
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
