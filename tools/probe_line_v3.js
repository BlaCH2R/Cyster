// Fresh line.png render probe: writes results + screenshot to files.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_v3_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_line_v3_out.json");
const OUT_PNG = path.join(__dirname, "probe_line_v3_shot.png");

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
  const info = buildInfo();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3000));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    pv.backgroundImage = null;
    pv.effectsEnabled = false;
    pv.ui.show = false;
    pv.ui.showNoteIds = false;
    pv.drawClearEffects = () => {};
    pv.markDirty();

    let img = null;
    for (let i = 0; i < 50 && !img; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['line.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }
    const imgInfo = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;

    const measureRed = () => {
      pv.render();
      const idata = ctx.getImageData(0, 0, W, H).data;
      let n = 0;
      const rows = new Array(H).fill(0);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          const r = idata[i], g = idata[i + 1], b = idata[i + 2], a = idata[i + 3];
          if (r > 120 && g < 100 && b < 100 && a > 120 && r - g > 50) {
            n++; rows[y]++;
          }
        }
      }
      const bands = [];
      let inb = false, start = 0;
      for (let y = 0; y < H; y++) {
        if (rows[y] > 3 && !inb) { start = y; inb = true; }
        else if (rows[y] <= 3 && inb) {
          if (y - start >= 1) bands.push({ y0: start, y1: y - 1, h: y - start, maxW: Math.max(...rows.slice(start, y)) });
          inb = false;
        }
      }
      if (inb) bands.push({ y0: start, y1: H - 1, h: H - start, maxW: Math.max(...rows.slice(start)) });
      return { n, bands };
    };

    const dump = () => {
      const info2 = pv.ctxInfo();
      const ev = pv.evalResult || {};
      return (ev.sprites || [])
        .filter((r) => { const p = r.from && r.from.path; return p && String(p).toLowerCase().includes('line'); })
        .filter((r) => r.from.opacity > 0.004)
        .map((r) => {
          const f = r.from;
          const M = pv.stageMatrix(r.obj, r, info2);
          return {
            id: r.obj.id, t: f.time, opacity: f.opacity,
            sx: f.scale_x, sy: f.scale_y,
            matrix: [M.a, M.b, M.c, M.d, M.e, M.f].map((v) => Math.round(v * 100) / 100),
          };
        });
    };

    const res = { W, H, imgInfo, byTime: {} };
    for (const t of [137, 140.15, 145]) {
      pv.setTime(t, false);
      const m = measureRed();
      res.byTime[t] = { measure: m, sprites: dump() };
    }
    pv.setTime(140.15, false);
    pv.render();
    res.screenshot = canvas.toDataURL('image/png');
    return res;
  })()`);
  clearTimeout(timer);
  const png = Buffer.from(out.screenshot.split(",")[1], "base64");
  fs.writeFileSync(OUT_PNG, png);
  delete out.screenshot;
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(__dirname, "probe_line_v3_done.txt"),
    "done " + new Date().toISOString()
  );
  console.log("PROBE_LINE_V3_OK");
  app.exit(0);
});
