// bench_fx_branches.js — times each effect branch in isolation on a 974x546 canvas.
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1200, 800);
  await new Promise((r) => setTimeout(r, 500));
  const out = await win.webContents.executeJavaScript(`(() => {
    const W = 974, H = 546;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = 'hsl(' + (i * 37 % 360) + ',80%,50%)';
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 20 + Math.random() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    const N = 30;
    const bench = (eff) => {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        window.SBEffects.applyEffects(ctx, canvas, W, H, eff, 120.1875 + i * 0.016);
      }
      return +(performance.now() - t0) / N;
    };
    return {
      none: bench({}),
      arcade: bench({ arcade: true, arcade_intensity: 0.75, arcade_interference_size: 0, arcade_contrast: 5 }),
      arcadeNoContrast: bench({ arcade: true, arcade_intensity: 0.75, arcade_interference_size: 0, arcade_contrast: 1 }),
      colorAdj: bench({ color_adjustment: true, saturation: 0.5, contrast: 1 }),
      radialBlur: bench({ radial_blur: true, radial_blur_intensity: 0.025 }),
      bloom: bench({ bloom: true, bloom_intensity: 1 }),
      noise: bench({ noise: true, noise_intensity: 0.25 }),
      glitch: bench({ glitch: true, glitch_intensity: 0.5 }),
      chromatical: bench({ chromatical: true, chromatical_intensity: 0.5, chromatical_fade: 1, chromatical_speed: 1 }),
      fisheye: bench({ fisheye: true, fisheye_intensity: 0.5 }),
      dream: bench({ dream: true, dream_intensity: 1 })
    };
  })()`);
  console.log('BENCH:', JSON.stringify(out));
  app.exit(0);
});
