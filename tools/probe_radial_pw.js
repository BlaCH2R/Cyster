// Playwright probe: verify radial blur smears along the radial direction
// (center stays sharp, edge dots become radial streaks).
const path = require("path");
const { _electron } = require(path.join(__dirname, "..", "app", "node_modules", "playwright"));

(async () => {
  const app = await _electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    cwd: path.join(__dirname, "..", "app"),
  });
  try {
    const win = await app.firstWindow();
    await win.waitForTimeout(2500);
    const res = await win.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 300;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 400, 300);
      // Three 1px white dots: center, right edge, top edge.
      ctx.fillStyle = "#fff";
      ctx.fillRect(200, 150, 1, 1);
      ctx.fillRect(395, 150, 1, 1);
      ctx.fillRect(200, 2, 1, 1);

      const measure = () => {
        const d = ctx.getImageData(0, 0, 400, 300).data;
        const region = (x0, x1, y0, y1) => {
          let n = 0;
          const xs = [], ys = [];
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              const i = (y * 400 + x) * 4;
              if (d[i] > 15) { n++; xs.push(x); ys.push(y); }
            }
          }
          const spanX = xs.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0;
          const spanY = ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0;
          return { n, spanX, spanY };
        };
        return {
          centerDot: region(190, 210, 140, 160),
          rightEdgeDot: region(380, 399, 140, 160),
          topDot: region(190, 210, 0, 15),
        };
      };

      const before = measure();
      window.SBEffects.applyEffects(
        ctx, c, 400, 300,
        { radial_blur: true, radial_blur_intensity: 0.5 },
        0
      );
      const after = measure();
      return { before, after };
    });
    console.log("RESULT:", JSON.stringify(res));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
