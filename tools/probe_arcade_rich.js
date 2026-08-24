// Compare arcade rendering between normal (fallback) mode and rich mode.
// Rich mode now runs the exact CameraFilterPack_TV_ARCADE_2 GL port (from the
// official 2.1.5 APK shaders), so it uses GL (SBGlUsed=1) and its scanline
// pattern is the sin-driven modulation of the original shader; the fallback
// mode keeps the 2D approximation. The probe reports both patterns.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_arcade_rich_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_arcade_rich_out.json");

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
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    pv.backgroundImage = null;
    pv.drawBackground = (c, w, h) => { c.fillStyle = '#7f7f7f'; c.fillRect(0, 0, w, h); };
    pv.ui.show = false;
    pv.ui.showNoteIds = false;
    pv.drawClearEffects = () => {};
    pv.effectsEnabled = true;
    const origEval = pv.evaluate.bind(pv);
    pv.evaluate = (t) => {
      origEval(t);
      if (pv.mergedCtrl) {
        pv.mergedCtrl.arcade = true;
        pv.mergedCtrl.arcade_intensity = 1;
        pv.mergedCtrl.arcade_interference_size = 1;
        pv.mergedCtrl.arcade_interference_speed = 0.5;
        pv.mergedCtrl.arcade_contrast = 1;
        for (const k of ['gray_scale','color_adjustment','sepia','bloom','dream','glitch','chromatical','fisheye','noise','radial_blur','shockwave','focus']) pv.mergedCtrl[k] = false;
      }
    };
    let img = null;
    for (let i = 0; i < 50 && !img; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['line.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }
    pv.setTime(140.15, false);
    const grab = (rich) => {
      pv.richEffects = rich;
      pv.markDirty();
      pv.render();
      const idata = ctx.getImageData(0, 0, W, H).data;
      const rowBright = [];
      for (let y = 0; y < H; y++) {
        let s = 0, n = 0;
        for (let x = 0; x < W; x += 8) {
          const i = (y * W + x) * 4;
          s += 0.299 * idata[i] + 0.587 * idata[i + 1] + 0.114 * idata[i + 2];
          n++;
        }
        rowBright.push(Math.round(s / n));
      }
      const darkRows = [];
      for (let y = 0; y < H; y++) if (rowBright[y] < 70) darkRows.push(y);
      const pitches = [];
      for (let i = 1; i < darkRows.length; i++) pitches.push(darkRows[i] - darkRows[i - 1]);
      const pitchCount = {};
      for (const p of pitches) pitchCount[p] = (pitchCount[p] || 0) + 1;
      return { darkRowCount: darkRows.length, pitchCount, url: canvas.toDataURL('image/png') };
    };
    const fb = grab(false);
    const rich = grab(true);
    return { fb, rich, fbUrl: fb.url, richUrl: rich.url };
  })()`);
  if (out.fbUrl) {
    fs.writeFileSync(path.join(__dirname, "probe_arcade_rich_fb.png"), Buffer.from(out.fbUrl.split(",")[1], "base64"));
    fs.writeFileSync(path.join(__dirname, "probe_arcade_rich_rich.png"), Buffer.from(out.richUrl.split(",")[1], "base64"));
  }
  const h = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);
  const fbBuf = out.fbUrl ? Buffer.from(out.fbUrl.split(",")[1], "base64") : null;
  const richBuf = out.richUrl ? Buffer.from(out.richUrl.split(",")[1], "base64") : null;
  const result = {
    fb: out.fb, rich: out.rich,
    fbSha: fbBuf && h(fbBuf), richSha: richBuf && h(richBuf),
    identical: fbBuf && richBuf && h(fbBuf) === h(richBuf)
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(result));
  console.log("ARCADE_RICH_SUMMARY:", JSON.stringify(result));
  clearTimeout(timer);
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT_JSON, JSON.stringify({ error: String(e) }));
  console.log("FAIL:", e);
  app.exit(1);
});
