// profile_fx_split.js — isolates the post-process effect cost at heavy timestamps.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

require(path.join(__dirname, '..', 'app', 'main.js'));
const fs = require('fs');

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_fx_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const prof = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    const t = 15.5;
    const N = 40;
    const measure = () => {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        p.setTime(t + i * 0.016, false);
        p.render();
      }
      return (performance.now() - t0) / N;
    };
    p.effectsEnabled = true;
    const withFx = measure();
    p.effectsEnabled = false;
    const noFx = measure();
    p.effectsEnabled = true;
    // Direct effect-cost breakdown
    const ctrl = p.mergedCtrl;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    let fxMs = 0, caMs = 0;
    for (let i = 0; i < N; i++) {
      p.setTime(t + i * 0.016, false);
      p.render();
      const tf = performance.now();
      window.SBEffects.applyEffects(ctx, canvas, canvas.width, canvas.height, ctrl, t + i * 0.016);
      fxMs += performance.now() - tf;
    }
    return {
      withFx: +withFx.toFixed(2),
      noFx: +noFx.toFixed(2),
      applyEffectsAvg: +(fxMs / N).toFixed(2),
      fullCtrl: JSON.stringify(ctrl),
      eff: ctrl && {
        bloom: ctrl.bloom, bloom_intensity: ctrl.bloom_intensity,
        radial_blur: ctrl.radial_blur, radial_blur_intensity: ctrl.radial_blur_intensity,
        glitch: ctrl.glitch, glitch_intensity: ctrl.glitch_intensity,
        noise: ctrl.noise, noise_intensity: ctrl.noise_intensity,
        chromatical: ctrl.chromatical, chromatical_intensity: ctrl.chromatical_intensity,
        fisheye: ctrl.fisheye, fisheye_intensity: ctrl.fisheye_intensity,
        color_adjustment: ctrl.color_adjustment,
        brightness: ctrl.brightness, saturation: ctrl.saturation, contrast: ctrl.contrast
      }
    };
  })()`);
  console.log('FXSPLIT:', JSON.stringify(prof));
  app.exit(0);
});
