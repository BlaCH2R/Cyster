// Probe: force the arcade (显像管) filter on and verify the exact
// CameraFilterPack_TV_ARCADE_2 GL port: GL pipeline is used (SBGlUsed=1) and
// the vertical brightness profile shows the sin-driven scanline modulation
// (period ~2*PI/1.5 = 4.19px at size=1) over a neutral gray background.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_arcade_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_arcade_out.json");
const OUT_PNG = path.join(__dirname, "probe_arcade_shot.png");

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

    // Neutral gray background so scanlines are visible (first pass).
    const origBg = pv.backgroundImage;
    const origDrawBg = pv.drawBackground.bind(pv);
    pv.backgroundImage = null;
    pv.drawBackground = (c, w, h) => { c.fillStyle = '#7f7f7f'; c.fillRect(0, 0, w, h); };
    pv.ui.show = false;
    pv.ui.showNoteIds = false;
    pv.drawClearEffects = () => {};
    pv.effectsEnabled = true;

    // Force arcade on after every evaluate.
    const origEval = pv.evaluate.bind(pv);
    pv.evaluate = (t) => {
      origEval(t);
      if (pv.mergedCtrl) {
        pv.mergedCtrl.arcade = true;
        pv.mergedCtrl.arcade_intensity = 1;
        pv.mergedCtrl.arcade_interference_size = 1;
        pv.mergedCtrl.arcade_interference_speed = 0.5;
        pv.mergedCtrl.arcade_contrast = 1;
        // Isolate arcade: disable the storyboard's own filters so the
        // scanline pattern can be measured cleanly.
        pv.mergedCtrl.gray_scale = false;
        pv.mergedCtrl.color_adjustment = false;
        pv.mergedCtrl.sepia = false;
        pv.mergedCtrl.bloom = false;
        pv.mergedCtrl.dream = false;
        pv.mergedCtrl.glitch = false;
        pv.mergedCtrl.chromatical = false;
        pv.mergedCtrl.fisheye = false;
        pv.mergedCtrl.noise = false;
        pv.mergedCtrl.radial_blur = false;
        pv.mergedCtrl.shockwave = false;
        pv.mergedCtrl.focus = false;
      }
    };

    // Wait for line.png to be loaded so sprite content renders.
    let img = null;
    for (let i = 0; i < 50 && !img; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['line.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }

    pv.setTime(140.15, false);
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
    // Local minima of the profile -> scanline troughs. Their spacing should
    // be ~2*PI/1.5 = 4.19px (the TV_ARCADE_2 sin scanline period).
    const minima = [];
    for (let y = 2; y < H - 2; y++) {
      if (rowBright[y] <= rowBright[y - 1] && rowBright[y] <= rowBright[y + 1] &&
          rowBright[y] <= rowBright[y - 2] && rowBright[y] <= rowBright[y + 2]) {
        minima.push(y);
      }
    }
    const spacings = [];
    for (let i = 1; i < minima.length; i++) spacings.push(minima[i] - minima[i - 1]);
    const sorted = spacings.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const firstMin = minima.slice(0, 12);
    const res = {
      W, H,
      imgInfo: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
      glUsed: window.SBGlUsed,
      minCount: minima.length,
      firstMin,
      medianMinSpacing: median,
      spacings: spacings.slice(0, 40),
      profile: rowBright.slice(0, 120),
      lineSprites: (pv.evalResult && pv.evalResult.sprites || [])
        .filter((r) => { const p = r.from && r.from.path; return p && String(p).includes('line'); })
        .map((r) => ({ id: r.obj.id, t: r.from.time, o: r.from.opacity, sy: r.from.scale_y }))
        .slice(0, 12),
      sampleRowBright: { y0: rowBright[0], y1: rowBright[1], y2: rowBright[2], y10: rowBright[10] },
      arcadeVsOffDiff: null,
      screenshot: canvas.toDataURL('image/png'),
    };
    // Diff vs. effects-off control (same frame, effects disabled).
    pv.effectsEnabled = false;
    pv.setTime(140.15, false);
    pv.markDirty();
    pv.render();
    {
      const d2 = ctx.getImageData(0, 0, W, H).data;
      let sum = 0, n = 0;
      for (let i = 0; i < idata.length; i += 7) {
        sum += Math.abs(idata[i] - d2[i]);
        n++;
      }
      res.arcadeVsOffDiff = +(n ? sum / n : 0).toFixed(3);
    }
    // Dump raw colors around the expected line rows (effects ON).
    {
      const d3 = ctx.getImageData(0, 0, W, H).data;
      const samples = [];
      for (let y = 265; y <= 282; y++) {
        const i = (y * W + Math.round(W / 2)) * 4;
        samples.push([y, d3[i], d3[i + 1], d3[i + 2], d3[i + 3]].join(':'));
      }
      res.rawColorsCenter = samples;
    }
    // Control: with effects disabled the red line sprites must be visible.
    let ctrlRed = 0;
    {
      const d2 = ctx.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x += 4) {
          const i = (y * W + x) * 4;
          const r = d2[i], g = d2[i + 1], b = d2[i + 2];
          if (r > 100 && g < 90 && b < 90 && r - g > 40) ctrlRed++;
        }
      }
    }
    res.controlRedCount = ctrlRed;
    pv.effectsEnabled = true;
    // Second pass: real Delusion scene (original background) + forced arcade.
    pv.drawBackground = origDrawBg;
    pv.backgroundImage = origBg;
    pv.setTime(140.15, false);
    pv.markDirty();
    pv.render();
    res.sceneScreenshot = canvas.toDataURL('image/png');
    // Third pass: negative intensity -> reversed fisheye direction.
    pv.evaluate = (t) => {
      origEval(t);
      if (pv.mergedCtrl) {
        pv.mergedCtrl.arcade = true;
        pv.mergedCtrl.arcade_intensity = -1;
        pv.mergedCtrl.arcade_interference_size = 1;
        pv.mergedCtrl.arcade_interference_speed = 0.5;
        pv.mergedCtrl.arcade_contrast = 1;
        pv.mergedCtrl.gray_scale = false;
        pv.mergedCtrl.color_adjustment = false;
        pv.mergedCtrl.sepia = false;
        pv.mergedCtrl.bloom = false;
        pv.mergedCtrl.dream = false;
        pv.mergedCtrl.glitch = false;
        pv.mergedCtrl.chromatical = false;
        pv.mergedCtrl.fisheye = false;
        pv.mergedCtrl.noise = false;
        pv.mergedCtrl.radial_blur = false;
        pv.mergedCtrl.shockwave = false;
        pv.mergedCtrl.focus = false;
      }
    };
    pv.setTime(140.15, false);
    pv.markDirty();
    pv.render();
    res.negScreenshot = canvas.toDataURL('image/png');
    return res;
  })()`);
  clearTimeout(timer);
  const png = Buffer.from(out.screenshot.split(",")[1], "base64");
  fs.writeFileSync(OUT_PNG, png);
  const scenePng = Buffer.from(out.sceneScreenshot.split(",")[1], "base64");
  fs.writeFileSync(path.join(__dirname, "probe_arcade_scene_shot.png"), scenePng);
  const negPng = Buffer.from(out.negScreenshot.split(",")[1], "base64");
  fs.writeFileSync(path.join(__dirname, "probe_arcade_neg_shot.png"), negPng);
  delete out.screenshot;
  delete out.sceneScreenshot;
  delete out.negScreenshot;
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log("PROBE_ARCADE_OK");
  app.exit(0);
});
