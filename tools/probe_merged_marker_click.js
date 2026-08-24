// Probe: clicking the merged time block's display-only end markers selects the
// whole merged block and shows its property interface (previously a no-op).
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_mm_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_merged_marker_click_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\nNOTE 1 1 3\n";

function buildInfo() {
  const storyboard = JSON.stringify({
    sprites: [], texts: [], videos: [], lines: [], controllers: [],
    note_controllers: [{ id: "nc1", note: [0, 1], time: 0, states: [{ time: 2, x: 0.7 }] }],
    templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.mm", title: "Merged Marker Click Probe",
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

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      // 切换为合并显示
      __.nsBridge('apply', [{ id: 'nc1', note: [0, 1], merge: true }]);
      const marker = document.querySelector('.kf.selector-merged');
      const clicked = !!marker;
      if (marker) marker.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      const body = document.getElementById('propBody');
      return {
        markerFound: clicked,
        selected: __.state.selectedObjId,
        propShowsNc1: !!(body && body.textContent.indexOf('nc1') >= 0 &&
          body.textContent.indexOf('Note Controller') >= 0)
      };
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
