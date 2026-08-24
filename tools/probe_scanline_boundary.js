// Verify the scanline boundary fixes:
//  1. Boundary opacity follows scanline_opacity (not ui_opacity).
//  2. The boundary flash is per-edge: hitting the top only flashes the top
//     edge (and vice versa), and the crossing sets only that edge's flash.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_slb_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_scanline_boundary_out.json");

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const charts = [{
    type: "extreme",
    path: "chart.base.txt",
    content: fs.readFileSync(path.join(DIR, "chart.base.txt"), "utf8"),
    storyboardPath: "storyboard_compiled.json",
    storyboardContent: fs.readFileSync(path.join(DIR, "storyboard_compiled.json"), "utf8")
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
    pv.backgroundImage = null;
    pv.drawBackground = (c, w, h) => { c.fillStyle = '#202020'; c.fillRect(0, 0, w, h); };
    pv.ui.show = true;
    pv.ui.showNoteIds = false;
    pv.drawClearEffects = () => {};
    pv.effectsEnabled = false;
    const force = { scanOpacity: 1, uiOpacity: 1, scanPx: null };
    const origEval = pv.evaluate.bind(pv);
    pv.evaluate = (t) => {
      origEval(t);
      if (pv.mergedCtrl) {
        for (const k of ['gray_scale','color_adjustment','sepia','bloom','dream','glitch','chromatical','fisheye','noise','radial_blur','shockwave','focus','arcade','tape']) pv.mergedCtrl[k] = false;
        pv.mergedCtrl.scanline_opacity = force.scanOpacity;
        pv.mergedCtrl.ui_opacity = force.uiOpacity;
        pv.mergedCtrl.override_scanline_pos = true;
        pv.mergedCtrl.scanline_pos = 0.5;
        pv.mergedCtrl.scanline_posPx = force.scanPx != null ? force.scanPx : pv.chart.convertChartYToScreenY(0.5);
      }
    };
    pv.setTime(0, false);
    pv.markDirty();
    pv.render();
    const info = pv.ctxInfo();
    const topW = pv.chart.convertChartYToScreenY(1);
    const botW = pv.chart.convertChartYToScreenY(0);
    const rowTop = Math.round(pv.canvas.height / 2 - pv.projectedY(topW, info));
    const rowBot = Math.round(pv.canvas.height / 2 - pv.projectedY(botW, info));
    const rowMax = (y) => {
      const y0 = Math.max(0, y - 2), h = Math.min(pv.canvas.height - y0, 5);
      const img = ctx.getImageData(0, y0, pv.canvas.width, h).data;
      let mx = 0;
      for (let i = 0; i < img.length; i += 4) mx = Math.max(mx, img[i] + img[i + 1] + img[i + 2]);
      return mx;
    };
    const render = () => { pv.markDirty(); pv.render(); };

    // 1) Opacity source: scanline_opacity drives the boundaries.
    force.scanOpacity = 1; force.uiOpacity = 0; render();
    const topMaxScanOn = rowMax(rowTop), botMaxScanOn = rowMax(rowBot);
    force.scanOpacity = 0; force.uiOpacity = 1; render();
    const topMaxScanOff = rowMax(rowTop), botMaxScanOff = rowMax(rowBot);
    force.scanOpacity = 1; force.uiOpacity = 1; render();

    // 2) Per-edge flash rendering.
    pv._boundaryFlashTop = 1; pv._boundaryFlashBottom = 0; render();
    const topFlash = rowMax(rowTop), botNoFlash = rowMax(rowBot);
    pv._boundaryFlashTop = 0; pv._boundaryFlashBottom = 1; render();
    const topNoFlash = rowMax(rowTop), botFlash = rowMax(rowBot);

    // 3) Crossing the TOP edge sets only the top flash.
    pv._boundaryFlashTop = 0; pv._boundaryFlashBottom = 0;
    pv._lastScanY = topW - 0.1;
    force.scanPx = topW + 0.1;
    render();
    const afterTopHit = { top: Math.round(pv._boundaryFlashTop * 100) / 100, bottom: pv._boundaryFlashBottom };
    // Crossing the BOTTOM edge sets only the bottom flash.
    pv._boundaryFlashTop = 0; pv._boundaryFlashBottom = 0;
    pv._lastScanY = botW + 0.1;
    force.scanPx = botW - 0.1;
    render();
    const afterBotHit = { top: pv._boundaryFlashTop, bottom: Math.round(pv._boundaryFlashBottom * 100) / 100 };
    force.scanPx = null;

    return {
      rowTop, rowBot,
      topMaxScanOn, botMaxScanOn, topMaxScanOff, botMaxScanOff,
      topFlash, botNoFlash, topNoFlash, botFlash,
      afterTopHit, afterBotHit
    };
  })()`);

  const result = {
    ...out,
    opacityUsesScanline:
      out.topMaxScanOn > 120 && out.botMaxScanOn > 120 &&
      out.topMaxScanOff < 120 && out.botMaxScanOff < 120,
    flashPerEdge:
      out.topFlash - out.botNoFlash > 120 &&
      out.botFlash - out.topNoFlash > 120,
    crossingPerEdge:
      out.afterTopHit.top > 0.5 && out.afterTopHit.bottom === 0 &&
      out.afterBotHit.bottom > 0.5 && out.afterBotHit.top === 0
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
  console.log("SCANLINE_BOUNDARY_SUMMARY:", JSON.stringify(result));
  clearTimeout(timer);
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT_JSON, JSON.stringify({ error: String(e && e.message || e) }));
  console.log("FAIL:", e && e.message || e);
  app.exit(1);
});
