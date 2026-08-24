// Playwright probe: check WebGL context availability in the renderer.
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
      const out = {};
      for (const type of ["webgl2", "webgl", "experimental-webgl"]) {
        try {
          const c = document.createElement("canvas");
          const gl = c.getContext(type);
          out[type] = gl ? {
            ok: true,
            version: gl.getParameter(gl.VERSION),
            renderer: gl.getParameter(gl.RENDERER),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          } : { ok: false };
        } catch (e) {
          out[type] = { ok: false, err: String(e && e.message || e) };
        }
      }
      return out;
    });
    console.log("RESULT:", JSON.stringify(res));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
