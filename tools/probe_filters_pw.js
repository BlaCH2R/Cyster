// Playwright probe: color_filter RGB multiply semantics.
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
      const test = (color, label) => {
        const c = document.createElement("canvas");
        c.width = 20;
        c.height = 20;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "rgb(120, 80, 40)";
        ctx.fillRect(0, 0, 20, 20);
        window.SBEffects.applyEffects(
          ctx, c, 20, 20,
          { color_filter: true, color_filter_color: color },
          0
        );
        const d = ctx.getImageData(10, 10, 1, 1).data;
        return { label, px: [d[0], d[1], d[2]] };
      };
      return {
        white: test({ r: 1, g: 1, b: 1, a: 1 }, "white"),
        red: test({ r: 1, g: 0, b: 0, a: 1 }, "red"),
        halfBlue: test({ r: 0.5, g: 0.5, b: 1, a: 1 }, "halfBlue"),
      };
    });
    console.log("RESULT:", JSON.stringify(res));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
