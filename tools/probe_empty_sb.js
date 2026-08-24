// Probe: launches the real app and loads a project whose storyboard is the
// empty generated file (all groups empty). Verifies no "非 compiled 格式"
// warning modal appears and the empty storyboard loads cleanly.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_es_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_empty_sb_out.json");
const EMPTY_SB = JSON.stringify({
  sprites: [], texts: [], videos: [], lines: [],
  controllers: [], note_controllers: [], templates: {}
}, null, 2);

function buildInfo() {
  const chart = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\n";
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.empty", title: "Empty SB Probe",
      music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }]
    },
    levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
    files: [],
    charts: [{
      type: "easy",
      path: "chart.easy.txt",
      content: chart,
      storyboardPath: "storyboard.json",
      storyboardContent: EMPTY_SB
    }]
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 120000);
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await new Promise((r) => setTimeout(r, 600));
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await new Promise((r) => setTimeout(r, 2500));
    const out = await win.webContents.executeJavaScript(`(() => {
      const mask = document.getElementById('modalMask');
      const title = document.getElementById('modalTitle');
      const sb = window.__sb.state.storyboard;
      return {
        warningModalVisible: !!mask && !mask.classList.contains('hidden') &&
          title && title.textContent === '警告',
        maskHidden: !mask || mask.classList.contains('hidden'),
        storyboardLoaded: !!sb && Array.isArray(sb.sprites) && Array.isArray(sb.note_controllers) &&
          sb.sprites.length === 0
      };
    })()`);
    out.ok = !out.warningModalVisible && out.storyboardLoaded;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(out && out.ok ? 0 : 1);
  }
});
