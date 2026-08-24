// Probe: verify Unity target_id semantics - controllers merge into the
// terminal entity (no duplicate entities), parent_id children follow the
// resolved terminal transform.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_tgt_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_target_out.json");

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
  }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
  await new Promise((r) => setTimeout(r, 3000));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const dump = () => {
      const ev = pv.evalResult || {};
      return (ev.sprites || []).map((r) => {
        const f = r.from;
        const M = pv.stageMatrix(r.obj, r, info);
        return {
          id: r.obj.id,
          parentId: r.obj.parentId,
          targetId: r.obj.targetId,
          path: f.path,
          opacity: Math.round((f.opacity != null ? f.opacity : 1) * 100) / 100,
          sx: f.scale_x, sy: f.scale_y,
          fillWidth: !!f.fill_width,
          w: f.width, h: f.height,
          matrix: [M.a, M.b, M.c, M.d, M.e, M.f].map((v) => Math.round(v * 100) / 100),
        };
      });
    };
    const res = { byTime: {} };
    for (const t of [112.125, 124.5, 140.125]) {
      pv.setTime(t, false);
      pv.evaluate(t);
      const ev = pv.evalResult || {};
      res.byTime[t] = { sprites: dump() };
    }
    // Debug: resolve parent lookup for the title chain at 140.125.
    pv.evaluate(140.125);
    const dbg = {};
    for (const id of ['title_rot', 'title_y', 'title_scale', 'zoom_1', 'scale_dad', 'rotdad', 'wave_677']) {
      const item = pv.findEvalItem(id);
      dbg[id] = item ? { kind: item.kind, foundId: item.r.obj.id, fromOpacity: item.r.from.opacity } : null;
    }
    res.debug = dbg;
    return res;
  })()`);
  clearTimeout(timer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log("PROBE_TARGET_OK");
  app.exit(0);
});
