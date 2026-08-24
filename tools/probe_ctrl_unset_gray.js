// Verify that unset controller card entries turn gray immediately after the
// field is cleared (and back to normal when set), without needing a full
// property-panel re-render:
//  - a fresh keyframe with only `bloom:true` has bloom_intensity .unset
//  - typing 0.8 removes .unset in place
//  - clearing it adds .unset in place and deletes the key from the state
//  - same round-trip for a color field (scanline_color) incl. placeholder
//  - whole unset cards get the card-unset class (45-degree gray stripes),
//    removed when any field is set and restored when cleared
//  - the "扫描线 · 平滑" card has been deleted
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_unsgray_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_unsgray_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_unsgray_proj_'));
const CTR_PATH = path.join(TMP, 'UnsetGray.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'UnsetGray',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const ctl = { id: 'ctl_uns', time: 0, states: [{ time: 0, bloom: true }] };
    S.storyboard.controllers.push(ctl);
    // 轨道面板只显示已启用卡片：启用全部卡片以便逐一验证灰显行为。
    S.controllerCards = { ctl_uns: window.SBSchema.CONTROLLER_CARDS.map((c) => c.key) };
    S.selectedObjId = 'ctl_uns';
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 150));

    const bloomCard = () => document.querySelector('#stateForm .ctrl-card[data-card="bloom"]');
    const numRow = () => bloomCard().querySelector('.field');
    const num = () => numRow().querySelector('input[type=number]');

    const init = {
      unset: numRow().classList.contains('unset'),
      value: num().value,
      placeholder: num().placeholder
    };

    num().value = '0.8';
    num().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const afterSet = {
      unset: numRow().classList.contains('unset'),
      state: ctl.states[0].bloom_intensity
    };

    num().value = '';
    num().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const afterClear = {
      unset: numRow().classList.contains('unset'),
      hasKey: 'bloom_intensity' in ctl.states[0]
    };

    const scanCard = () => document.querySelector('#stateForm .ctrl-card[data-card="scanline_color"]');
    const colorRow = () => scanCard().querySelectorAll('.field')[0];
    const colorText = () => colorRow().querySelector('input[type=text]');
    const cInit = {
      unset: colorRow().classList.contains('unset'),
      placeholder: colorText().placeholder,
      colorBlocks: colorRow().querySelectorAll('input[type=color]').length
    };

    colorText().value = '#ff0000';
    colorText().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const cSet = {
      unset: colorRow().classList.contains('unset'),
      state: ctl.states[0].scanline_color,
      placeholder: colorText().placeholder
    };

    colorText().value = '';
    colorText().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const cClear = {
      unset: colorRow().classList.contains('unset'),
      hasKey: 'scanline_color' in ctl.states[0],
      placeholder: colorText().placeholder
    };

    // 卡片级灰条：相机 X 卡（全新关键帧上未设置任何字段）应整卡 card-unset。
    const camX = () => document.querySelector('#stateForm .ctrl-card[data-card="camera_x"]');
    const camXNum = () => camX().querySelector('input[type=number]');
    const stripeStyle = getComputedStyle(camX(), '::after').backgroundImage;
    const camInit = {
      cardUnset: camX().classList.contains('card-unset'),
      stripe: stripeStyle.includes('repeating-linear-gradient') && stripeStyle.includes('45deg')
    };
    camXNum().value = '2';
    camXNum().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const camSet = { cardUnset: camX().classList.contains('card-unset'), state: ctl.states[0].x };
    camXNum().value = '';
    camXNum().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const camClear = { cardUnset: camX().classList.contains('card-unset'), hasKey: 'x' in ctl.states[0] };

    // 旧分组卡片键已拆散：不应再存在。
    const oldKeysGone = ['camera', 'opacity', 'scanline', 'note_colors']
      .every((k) => !document.querySelector('#stateForm .ctrl-card[data-card="' + k + '"]'));
    const newKeysPresent = ['camera_perspective', 'camera_x', 'opacity_storyboard', 'scanline_color', 'scanline_position', 'note_ring_color', 'note_fill_colors']
      .every((k) => !!document.querySelector('#stateForm .ctrl-card[data-card="' + k + '"]'));
    // 扫描线平滑卡片已按要求删除。
    const smoothingGone = !document.querySelector('#stateForm .ctrl-card[data-card="scanline_smoothing"]');

    return { init, afterSet, afterClear, cInit, cSet, cClear, camInit, camSet, camClear, oldKeysGone, newKeysPresent, smoothingGone };
  })()`);

  out.ok = !!(
    out.init.unset &&
    out.afterSet.unset === false && out.afterSet.state === 0.8 &&
    out.afterClear.unset && !out.afterClear.hasKey &&
    out.cInit.unset && out.cInit.placeholder === '未设置' && out.cInit.colorBlocks >= 1 &&
    out.cSet.unset === false && out.cSet.state === '#ff0000' &&
    out.cClear.unset && !out.cClear.hasKey && out.cClear.placeholder === '未设置' &&
    out.camInit.cardUnset && out.camInit.stripe &&
    out.camSet.cardUnset === false && out.camSet.state === 2 &&
    out.camClear.cardUnset && !out.camClear.hasKey &&
    out.oldKeysGone && out.newKeysPresent && out.smoothingGone
  );
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_unset_gray_out.json'), JSON.stringify(out, null, 2));
  console.log('UNS_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_unset_gray_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
