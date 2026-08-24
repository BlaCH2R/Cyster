// Minimal thumbnail probe: load Delusion, wait, count clip thumbs with src.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_th_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_thumb_out.json");

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const chartPath = "chart.base.txt";
  const sbPath = "storyboard_compiled.json";
  const charts = [{
    type: "extreme",
    path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
    storyboardPath: sbPath,
    storyboardContent: fs.readFileSync(path.join(DIR, sbPath), "utf8"),
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: DIR, files, charts };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 40000);
  const log = [];
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.on("console-message", (e, level, message) => {
      log.push("[" + level + "] " + message);
    });
    win.setSize(1560, 920);
    await new Promise((r) => setTimeout(r, 500));
    win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`).catch(() => {});
    await new Promise((r) => setTimeout(r, 9000));
    let out;
    try {
      out = await win.webContents.executeJavaScript(`(() => {
        const all = [...document.querySelectorAll('#tlScroll .clip-thumb')];
        const sample = all.slice(0, 6)
          .map((t) => ({ path: t.dataset.path, has: !!t.src }));
        const missing = {};
        for (const t of all) if (!t.src) missing[t.dataset.path] = (missing[t.dataset.path] || 0) + 1;
        const lineTotal = all.filter((t) => t.dataset.path === 'line.png').length;
        const lineSel = document.querySelectorAll('.clip-thumb[data-path="' + CSS.escape('line.png') + '"]').length;
        return {
          total: all.length, withSrc: all.filter((t) => t.src).length, sample, missing,
          lineTotal, lineSel,
          stats: window.SBThumbStats || null
        };
      })()`);
    } catch (e) {
      out = { fatal: String(e && e.message || e) };
    }
    out.console = log.slice(-40);
    clearTimeout(timer);
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
    console.log("PROBE_THUMB_OK");
    app.exit(0);
  } catch (e) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "main: " + String(e && e.message || e), console: log.slice(-40) }));
    app.exit(1);
  }
});
