// 验证：滤镜字段按《StoryBoard格式详解》修正后的范围 + 未设置时的默认强度提示。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fd_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_fd_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fd_proj_'));
const CTR_PATH = path.join(TMP, 'FilterDefaults.ctr');
const OUT = path.join(__dirname, 'probe_filter_defaults_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));
  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'FilterDefaults',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    window.SBSchema.renderControllerCards(container, window.SBSchema.SCHEMAS.controller, {},
      () => {}, false, { owners: {}, enabledOnly: false, showUnset: true });
    const R = { placeholders: {}, ranges: {}, vignetteGone: true };
    for (const card of container.querySelectorAll('.ctrl-card')) {
      for (const input of card.querySelectorAll('.field input[type=number]')) {
        const label = input.closest('.field').querySelector('label');
        const key = label ? label.textContent : '';
        R.placeholders[key] = input.placeholder;
      }
    }
    const ctlFields = window.SBSchema.SCHEMAS.controller.fields;
    const dream = ctlFields.find((f) => f.key === 'dream_intensity');
    R.ranges.dreamIntensity = dream ? { min: dream.min, max: dream.max, step: dream.step } : null;
    const fld = (k) => ctlFields.find((f) => f.key === k);
    R.ranges.bloomIntensity = fld('bloom_intensity') ? { min: fld('bloom_intensity').min, max: fld('bloom_intensity').max } : null;
    R.defs = {
      radial: fld('radial_blur_intensity') && fld('radial_blur_intensity').def,
      noise: fld('noise_intensity') && fld('noise_intensity').def,
      fisheye: fld('fisheye_intensity') && fld('fisheye_intensity').def,
      shockwave: fld('shockwave_speed') && fld('shockwave_speed').def,
      focusSize: fld('focus_size') && fld('focus_size').def,
      focusSpeed: fld('focus_speed') && fld('focus_speed').def,
      focusIntensity: fld('focus_intensity') && fld('focus_intensity').def,
      arcadeIntensity: fld('arcade_intensity') && fld('arcade_intensity').def,
      arcadeSize: fld('arcade_interference_size') && fld('arcade_interference_size').def,
      arcadeSpeed: fld('arcade_interference_speed') && fld('arcade_interference_speed').def,
      arcadeContrast: fld('arcade_contrast') && fld('arcade_contrast').def,
      brightness: fld('brightness') && fld('brightness').def,
      saturation: fld('saturation') && fld('saturation').def,
      contrast: fld('contrast') && fld('contrast').def
    };
    R.noDefStillUnset = R.placeholders['灰度-强度'] || R.placeholders['怀旧-强度'] || R.placeholders['梦境-强度'];
    // 实时统计面板（showUnset:false，readOnly）：占位符同样应显示默认强度提示。
    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    window.SBSchema.renderControllerCards(c2, window.SBSchema.SCHEMAS.controller, {},
      () => {}, true, { owners: {}, enabledOnly: false, showUnset: false });
    const ph = (label) => {
      const input = Array.from(c2.querySelectorAll('.field input[type=number]'))
        .find((el) => el.closest('.field').querySelector('label').textContent === label);
      return input ? input.placeholder : null;
    };
    R.liveRadial = ph('径向模糊-强度');
    R.liveFisheye = ph('鱼眼-强度');
    R.liveNoise = ph('噪点-强度');
    R.liveGray = ph('灰度-强度');
    return R;
  })()`);

  out.ok = !!(
    out.ranges.dreamIntensity && out.ranges.dreamIntensity.min === 0 && out.ranges.dreamIntensity.max === 1 &&
    out.ranges.bloomIntensity && out.ranges.bloomIntensity.max === 5 &&
    out.placeholders['径向模糊-强度'] === '未设置（0.025）' &&
    out.placeholders['噪点-强度'] === '未设置（0.235）' &&
    out.placeholders['鱼眼-强度'] === '未设置（0.5）' &&
    out.placeholders['冲击波-速度'] === '未设置（1）' &&
    out.placeholders['聚焦-尺寸'] === '未设置（1）' &&
    out.placeholders['聚焦-速度'] === '未设置（5）' &&
    out.placeholders['聚焦-强度'] === '未设置（0.25）' &&
    out.placeholders['街机-强度'] === '未设置（1）' &&
    out.placeholders['街机-干扰尺寸'] === '未设置（1）' &&
    out.placeholders['街机-干扰速度'] === '未设置（0.5）' &&
    out.placeholders['街机-对比度'] === '未设置（1）' &&
    out.placeholders['亮度'] === '未设置（1）' &&
    out.placeholders['饱和度'] === '未设置（1）' &&
    out.placeholders['对比度'] === '未设置（1）' &&
    out.noDefStillUnset === '未设置' &&
    out.liveRadial === '未设置（0.025）' && out.liveFisheye === '未设置（0.5）' &&
    out.liveNoise === '未设置（0.235）' && out.liveGray === '未设置' &&
    out.defs.radial === 0.025 && out.defs.noise === 0.235 && out.defs.fisheye === 0.5 &&
    out.defs.shockwave === 1 && out.defs.focusSize === 1 && out.defs.focusSpeed === 5 &&
    out.defs.focusIntensity === 0.25 && out.defs.arcadeIntensity === 1 && out.defs.arcadeSize === 1 &&
    out.defs.arcadeSpeed === 0.5 && out.defs.arcadeContrast === 1
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('FILTER_DEFAULTS:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
