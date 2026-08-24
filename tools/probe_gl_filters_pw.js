// Playwright probe: verify the WebGL shader pipeline produces the expected
// per-filter results and that it is actually used (SBGlUsed === 1).
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
      const mk = (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        return { c, ctx };
      };
      const px = (ctx, w, x, y) => {
        const d = ctx.getImageData(x, y, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const fill = (ctx, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
      };
      const out = { glUsed: [] };
      const run = (eff, setup) => {
        const { c, ctx } = mk(64, 64);
        if (setup) setup(ctx);
        window.SBEffects.applyEffects(ctx, c, 64, 64, eff, 0);
        out.glUsed.push(window.SBGlUsed);
        return { c, ctx };
      };

      // Color adjustment: brightness 1.5 on gray 100.
      {
        const { ctx } = run({ color_adjustment: true, brightness: 1.5 }, (ctx) => fill(ctx, 64, 64, "rgb(100,100,100)"));
        out.brightness = px(ctx, 64, 32, 32);
      }
      // Saturation 0 -> grayscale.
      {
        const { ctx } = run({ color_adjustment: true, saturation: 0 }, (ctx) => fill(ctx, 64, 64, "rgb(120,80,40)"));
        out.desat = px(ctx, 64, 32, 32);
      }
      // Gray scale intensity 1.
      {
        const { ctx } = run({ gray_scale: true, gray_scale_intensity: 1 }, (ctx) => fill(ctx, 64, 64, "rgb(120,80,40)"));
        out.gray = px(ctx, 64, 32, 32);
      }
      // Color filter multiply: red -> G/B zero.
      {
        const { ctx } = run({ color_filter: true, color_filter_color: { r: 1, g: 0, b: 0, a: 1 } }, (ctx) => fill(ctx, 64, 64, "rgb(120,80,40)"));
        out.redFilter = px(ctx, 64, 32, 32);
      }
      // Sepia.
      {
        const { ctx } = run({ sepia: true, sepia_intensity: 1 }, (ctx) => fill(ctx, 64, 64, "rgb(120,80,40)"));
        out.sepia = px(ctx, 64, 32, 32);
      }
      // Radial blur: dots - center sharp, right edge horizontal streak, top vertical streak.
      {
        const { c, ctx } = mk(400, 300);
        ctx.fillStyle = "#fff";
        ctx.fillRect(200, 150, 1, 1);
        ctx.fillRect(395, 150, 1, 1);
        ctx.fillRect(200, 2, 1, 1);
        window.SBEffects.applyEffects(ctx, c, 400, 300, { radial_blur: true, radial_blur_intensity: 0.5 }, 0);
        out.glUsed.push(window.SBGlUsed);
        const d = ctx.getImageData(0, 0, 400, 300).data;
        const region = (x0, x1, y0, y1) => {
          let n = 0; const xs = [], ys = [];
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (d[(y * 400 + x) * 4] > 15) { n++; xs.push(x); ys.push(y); }
            }
          }
          return {
            n,
            spanX: xs.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0,
            spanY: ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0,
          };
        };
        out.radial = {
          center: region(190, 210, 140, 160),
          right: region(380, 399, 140, 160),
          top: region(190, 210, 0, 15),
        };
      }
      // Smoke: each remaining GL filter produces a different image (no crash).
      const smoke = {};
      for (const [name, eff, setup] of [
        ["fisheye", { fisheye: true, fisheye_intensity: 0.5 }, (ctx) => {
          ctx.fillStyle = "#fff"; ctx.fillRect(10, 10, 20, 20); ctx.fillRect(40, 40, 20, 20);
        }],
        ["chromatical", { chromatical: true, chromatical_intensity: 1 }, (ctx) => {
          ctx.fillStyle = "#fff"; ctx.fillRect(20, 20, 24, 24);
        }],
        ["glitch", { glitch: true, glitch_intensity: 1 }, (ctx) => {
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 20, 64, 12);
        }],
        ["bloom", { bloom: true, bloom_intensity: 2 }, (ctx) => {
          ctx.fillStyle = "#fff"; ctx.fillRect(28, 28, 8, 8);
        }],
        ["dream", { dream: true, dream_intensity: 1 }, (ctx) => {
          ctx.fillStyle = "#fff"; ctx.fillRect(28, 28, 8, 8);
        }],
        ["noise", { noise: true, noise_intensity: 0.5 }, null],
        ["shockwave", { shockwave: true, shockwave_speed: 1 }, (ctx) => {
          ctx.fillStyle = "#aaa"; ctx.fillRect(0, 0, 64, 64);
        }],
        ["focus", { focus: true, focus_intensity: 0.25, focus_size: 1, focus_speed: 5 }, (ctx) => {
          ctx.fillStyle = "#aaa"; ctx.fillRect(0, 0, 64, 64);
        }],
        ["arcade", { arcade: true, arcade_intensity: 1, arcade_interference_size: 1, arcade_interference_speed: 0.5, arcade_contrast: 1 }, (ctx) => {
          ctx.fillStyle = "#aaa"; ctx.fillRect(0, 0, 64, 64);
        }],
      ]) {
        const { c, ctx } = mk(64, 64);
        if (setup) setup(ctx);
        const before = c.toDataURL();
        window.SBEffects.applyEffects(ctx, c, 64, 64, eff, 1.23);
        smoke[name] = { glUsed: window.SBGlUsed, changed: before !== c.toDataURL() };
      }
      out.smoke = smoke;
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
