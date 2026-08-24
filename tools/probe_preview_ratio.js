// Verify the 视图 → 预览比例 menu: switching 21:9 / 16:10 / 4:3 / 3:2 adjusts
// the module LAYOUT (timeline height) so the preview area reaches the ratio,
// the canvas fills it (no black bars), the chart is rebuilt with the new
// screenRatio, and 还原默认窗口布局 resets the ratio back to 16:9.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ratio_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ratio_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ratio_proj_'));
const CTR_PATH = path.join(TMP, 'Ratio.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1200, 900);
  await new Promise((r) => setTimeout(r, 500));

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Ratio',
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
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(300);
    const cv = document.querySelector('#previewCanvas');
    const entry = (r) => document.querySelector('.menu-entry[data-preview-ratio="' + r + '"]');
    const apply = (r) => { entry(r).click(); };
    const note = S.chart.notes[Math.floor(S.chart.notes.length / 2)];
    const noteXBefore = S.chart.noteById(note.id).worldX;
    const wrap = document.querySelector('#previewWrap');
    const tlEl = document.querySelector('#timeline');
    const rpEl = document.querySelector('#rightPanel');
    const lpEl = document.querySelector('#leftPanel');
    const mainEl = document.querySelector('#main');
    const measure = () => {
      const rect = cv.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const mr = mainEl.getBoundingClientRect();
      return {
        canvasRatio: cv.width / cv.height,
        fills: Math.abs(rect.width - wr.width) < 2 && Math.abs(rect.height - wr.height) < 2,
        tlHeight: tlEl.getBoundingClientRect().height,
        rpWidth: rpEl.getBoundingClientRect().width,
        lpWidth: lpEl.getBoundingClientRect().width,
        centered: Math.abs((wr.left - mr.left) - (mr.right - wr.right)) < 4,
        sideBalanced: Math.abs(lpEl.getBoundingClientRect().width - rpEl.getBoundingClientRect().width) < 6
      };
    };
    const tlDefault = tlEl.getBoundingClientRect().height;
    const rpDefault = rpEl.getBoundingClientRect().width;

    apply('4/3');
    await sleep(250);
    const r43 = {
      setting: S.settings.previewRatio,
      canvasRatio: window.__sb.preview.canvasRatio,
      chartRatio: window.__sb.preview.chart.screenRatio,
      stateChartRatio: S.chart.screenRatio,
      ...measure(),
      active: entry('4/3').classList.contains('active'),
      active43: entry('21/9').classList.contains('active') === false,
      noteXChanged: Math.abs(S.chart.noteById(note.id).worldX - noteXBefore) > 1e-6
    };

    apply('21/9');
    await sleep(250);
    const r219 = {
      setting: S.settings.previewRatio,
      ...measure(),
      active: entry('21/9').classList.contains('active')
    };

    apply('16/10');
    await sleep(250);
    const r1610 = { setting: S.settings.previewRatio, ...measure() };
    apply('3/2');
    await sleep(250);
    const r32 = { setting: S.settings.previewRatio, ...measure() };
    const minTl = Math.min(r43.tlHeight, r219.tlHeight, r1610.tlHeight, r32.tlHeight);

    // 还原默认窗口布局：比例恢复 16:9，时间轴恢复默认高度，画布填满。
    document.querySelector('.menu-entry[data-action="reset-layout"]').click();
    await sleep(250);
    const afterReset = {
      setting: S.settings.previewRatio,
      ...measure(),
      noteXRestored: Math.abs(S.chart.noteById(note.id).worldX - noteXBefore) < 1e-6,
      rpRestored: Math.abs(measure().rpWidth - rpDefault) < 3,
      activeNone: !entry('21/9').classList.contains('active') &&
        !entry('4/3').classList.contains('active')
    };

    return { r43, r219, r1610, r32, tlDefault, rpDefault, minTl, afterReset };
  })()`);

  out.ok = !!(
    out.r43 && Math.abs(out.r43.setting - 4 / 3) < 1e-6 &&
    Math.abs(out.r43.chartRatio - 4 / 3) < 1e-6 &&
    Math.abs(out.r43.stateChartRatio - 4 / 3) < 1e-6 &&
    Math.abs(out.r43.canvasRatio - 4 / 3) < 0.08 && out.r43.fills && out.r43.active &&
    out.r43.active43 && out.r43.noteXChanged &&
    Math.abs(out.r43.tlHeight - out.tlDefault) < 3 &&
    Math.abs(out.r43.rpWidth - out.rpDefault) > 5 &&
    out.r43.centered && out.r43.sideBalanced &&
    out.r219 && Math.abs(out.r219.setting - 21 / 9) < 1e-6 &&
    Math.abs(out.r219.canvasRatio - 21 / 9) < 0.08 && out.r219.fills && out.r219.active &&
    out.r219.centered && out.r219.sideBalanced &&
    out.r219.lpWidth >= 200 && out.r219.rpWidth >= 200 &&
    out.r219.tlHeight > out.tlDefault &&
    out.r1610 && Math.abs(out.r1610.setting - 16 / 10) < 1e-6 &&
    Math.abs(out.r1610.canvasRatio - 16 / 10) < 0.08 && out.r1610.fills &&
    out.r1610.centered && out.r1610.sideBalanced &&
    out.r32 && Math.abs(out.r32.setting - 3 / 2) < 1e-6 &&
    Math.abs(out.r32.canvasRatio - 3 / 2) < 0.08 && out.r32.fills &&
    out.r32.centered && out.r32.sideBalanced &&
    out.minTl >= out.tlDefault - 1 &&
    out.afterReset && Math.abs(out.afterReset.setting - 16 / 9) < 1e-6 &&
    out.afterReset.fills &&
    Math.abs(out.afterReset.tlHeight - out.tlDefault) < 3 &&
    out.afterReset.noteXRestored && out.afterReset.rpRestored && out.afterReset.activeNone
  );
  fs.writeFileSync(path.join(__dirname, 'probe_preview_ratio_out.json'), JSON.stringify(out, null, 2));
  console.log('RATIO_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_preview_ratio_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
