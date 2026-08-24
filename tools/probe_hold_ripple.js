// Probe: verifies the hold/long-hold looping ripple follows the note's 3D
// rotation. It calls PreviewRenderer.drawHoldRipples under (a) an identity
// transform (ripple stays a circle) and (b) the noteGlyph2x2 projection of
// rot_x = 60° (ripple must squash into an ellipse ~0.5x tall), then measures
// the drawn bounding box on an offscreen canvas.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_hr_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_hold_ripple_out.json");

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const charts = [{
    type: "extreme",
    path: "chart.base.txt",
    content: fs.readFileSync(path.join(DIR, "chart.base.txt"), "utf8"),
    storyboardPath: "storyboard_compiled.json",
    storyboardContent: fs.readFileSync(path.join(DIR, "storyboard_compiled.json"), "utf8"),
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
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await new Promise((r) => setTimeout(r, 600));
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await new Promise((r) => setTimeout(r, 2500));
    const out = await win.webContents.executeJavaScript(`(() => {
      const pv = window.__sb.preview;
      const cv = document.createElement('canvas');
      cv.width = 400; cv.height = 400;
      const ctx = cv.getContext('2d');
      const p = { x: 200, y: 200 };
      const d = 100;
      const fill = { r: 0.6, g: 0.8, b: 1, a: 1 };
      const t = 0.45;
      const measure = () => {
        const idata = ctx.getImageData(0, 0, 400, 400).data;
        let minX = 400, minY = 400, maxX = -1, maxY = -1, n = 0, sx = 0, sy = 0;
        for (let y = 0; y < 400; y++) {
          for (let x = 0; x < 400; x++) {
            if (idata[(y * 400 + x) * 4 + 3] > 8) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              n++; sx += x; sy += y;
            }
          }
        }
        return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n,
          cx: n ? sx / n : -1, cy: n ? sy / n : -1 };
      };

      // Case A: no rotation -> circle.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 400, 400);
      ctx.translate(p.x, p.y);
      pv.drawHoldRipples(ctx, {}, p, d, fill, t);
      const a = measure();

      // Case B: rot_x = 60° -> ellipse with vertical squash factor cos60 = 0.5.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 400, 400);
      ctx.translate(p.x, p.y);
      const gm = pv.noteGlyph2x2({ rotX: 0, rotY: 0, rotZ: 0 }, 60, 0, 0);
      ctx.transform(gm.a, gm.b, gm.c, gm.d, 0, 0);
      pv.drawHoldRipples(ctx, {}, p, d, fill, t);
      const b = measure();

      const res = {
        circle: { w: a.w, h: a.h, aspect: a.w / a.h, cx: a.cx, cy: a.cy },
        rotX60: { w: b.w, h: b.h, aspect: b.w / b.h, cx: b.cx, cy: b.cy }
      };
      res.circleOk = a.n > 200 && Math.abs(a.w / a.h - 1) < 0.2 &&
        Math.abs(a.cx - p.x) < 6 && Math.abs(a.cy - p.y) < 6;
      res.rotX60Ok = b.n > 100 && b.h / b.w < 0.75 && b.h / b.w > 0.3 &&
        Math.abs(b.w - a.w) < a.w * 0.3 && b.h < a.h * 0.8 &&
        Math.abs(b.cx - p.x) < 6 && Math.abs(b.cy - p.y) < 6;
      res.ok = res.circleOk && res.rotX60Ok;
      return res;
    })()`);
    out.ok = out.circleOk && out.rotX60Ok;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(out && out.ok ? 0 : 1);
  }
});
