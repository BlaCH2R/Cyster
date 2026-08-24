// 验证：按 v2.0.2 属性语义校正后的滤镜管线。
//  1) tape / artifact 在预览中真实生效（像素变化）；vignette 已按 Cytoid
//     2.0.0 移除，不再产生任何效果且不再出现在卡片/字段中
//  2) arcade_intensity 作为 Fade 混合度：intensity=0 无效果、intensity=1 完全生效
//  3) 已实现滤镜在 GL 管线中被应用（抽查 bloom / fisheye / chromatical）
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fx2_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_fx2_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fx2_proj_'));
const CTR_PATH = path.join(TMP, 'FxV202.ctr');
const OUT = path.join(__dirname, 'probe_effects_v202_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'FxV202',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pv = window.__sb.preview;
    // Non-integer time: the exact TV_Videoflip shader is fract(vUv.y + TimeX),
    // which is an identity at integer seconds.
    pv.setTime(30.37, false);
    await sleep(150);
    const canvas = document.querySelector('#previewCanvas');
    const ctx2d = canvas.getContext('2d');
    const snap = () => ctx2d.getImageData(0, 0, canvas.width, canvas.height).data.slice();
    const diff = (a, b) => {
      let sum = 0, n = 0;
      for (let i = 0; i < a.length; i += 7) {
        sum += Math.abs(a[i] - b[i]);
        n++;
      }
      return +(n ? sum / n : 0).toFixed(3);
    };
    const renderWith = (eff) => {
      pv.mergedCtrl = {};
      pv.render();
      window.SBEffects.applyEffects(ctx2d, canvas, canvas.width, canvas.height, eff, pv.time, true);
      return snap();
    };
    const R = {};
    const empty = () => renderWith({});
    R.tapeDiff = diff(empty(), renderWith({ tape: true }));
    R.artifactDiff = diff(empty(), renderWith({ artifact: true, artifact_intensity: 1, artifact_colorisation: 0.5, artifact_parasite: 0.5, artifact_noise: 0.2 }));
    R.vignetteDiff = diff(empty(), renderWith({ vignette: true, vignette_intensity: 1, vignette_start: 0.3, vignette_end: 0.9, vignette_color: { r: 0, g: 0, b: 0 } }));
    R.arcade0Diff = diff(empty(), renderWith({ arcade: true, arcade_intensity: 0 }));
    R.arcade1Diff = diff(empty(), renderWith({ arcade: true, arcade_intensity: 1, arcade_interference_size: 1, arcade_interference_speed: 0.5, arcade_contrast: 1 }));
    R.fisheyeDiff = diff(empty(), renderWith({ fisheye: true, fisheye_intensity: 0.8 }));
    R.chromaticalDiff = diff(empty(), renderWith({ chromatical: true, chromatical_intensity: 0.5, chromatical_fade: 1, chromatical_speed: 1 }));
    // bloom 依赖亮部：画面中心画一个白色方块（GL 亮部提取 + 模糊光晕）
    const bright = () => {
      pv.mergedCtrl = {};
      pv.render();
      ctx2d.fillStyle = '#fff';
      ctx2d.fillRect(canvas.width * 0.35, canvas.height * 0.35, canvas.width * 0.3, canvas.height * 0.3);
    };
    bright();
    const baseB = snap();
    bright();
    window.SBEffects.applyEffects(ctx2d, canvas, canvas.width, canvas.height, { bloom: true, bloom_intensity: 0.8 }, pv.time, true);
    R.bloomDiff = diff(baseB, snap());
    R.glUsed = window.SBGlUsed;
    R.cardHasVignette = !!window.SBSchema.CONTROLLER_CARDS.find((c) => c.key === 'vignette');
    R.schemaHasVignette = !!window.SBSchema.SCHEMAS.controller.fields.find((f) => (f.key || '').indexOf('vignette') === 0);
    pv.mergedCtrl = {};
    return R;
  })()`);

  out.ok = !!(
    out.tapeDiff > 2 && out.artifactDiff > 2 && out.vignetteDiff < 0.01 &&
    !out.cardHasVignette && !out.schemaHasVignette &&
    out.arcade0Diff < 1 && out.arcade1Diff > 2 &&
    out.bloomDiff > 0.01 && out.fisheyeDiff > 2 && out.chromaticalDiff > 0.5
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('FX_V202:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
