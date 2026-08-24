// verify_round41.js - File menu "切换难度": enabled only with multiple
// difficulties; switching loads that difficulty's chart + own storyboard
// (empty UI when it has none); importing a non-compiled storyboard asks for
// confirmation.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r41_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

function sbWith(id) {
  return JSON.stringify({ sprites: [{ id, path: 'x.png', time: 0 }], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] });
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const consoleErrors = [];
  win.webContents.on('console-message', (e, level, message) => {
    if (level >= 3) consoleErrors.push(message);
  });
  win.webContents.on('render-process-gone', (e, details) => consoleErrors.push('RENDER GONE: ' + JSON.stringify(details)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r41_'));
  const mkChart = (x) => ({ time_base: 480, tempo_list: [{ tick: 0, value: 500000 }], page_list: [{ start_tick: 0, end_tick: 2400, scan_line_direction: 1 }], note_list: [{ id: 1, type: 0, x, tick: 1000, hold_tick: 0, page_index: 0 }], event_order_list: [], music_offset: 0 });
  fs.writeFileSync(path.join(dir, 'chart.easy.txt'), JSON.stringify(mkChart(0.3)));
  fs.writeFileSync(path.join(dir, 'chart.hard.txt'), JSON.stringify(mkChart(0.5)));
  fs.writeFileSync(path.join(dir, 'chart.extreme.txt'), JSON.stringify(mkChart(0.7)));
  fs.writeFileSync(path.join(dir, 'storyboard_easy.json'), sbWith('easy_sb'));
  fs.writeFileSync(path.join(dir, 'storyboard_hard.json'), sbWith('hard_sb'));
  const level = {
    schema_version: 2, version: 1, id: 'r41', title: 'r41', artist: '', charter: '',
    music: { path: 'music.ogg' },
    charts: [
      { type: 'easy', path: 'chart.easy.txt', difficulty: 4, storyboard: { path: 'storyboard_easy.json' } },
      { type: 'hard', path: 'chart.hard.txt', difficulty: 11, storyboard: { path: 'storyboard_hard.json' } },
      { type: 'extreme', path: 'chart.extreme.txt', difficulty: 14 }
    ]
  };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const projPath = path.join(dir, 'r41.ctdsber');
  fs.writeFileSync(projPath, JSON.stringify({
    format: 'cytoid-storyboarder-project', version: 2, name: 'r41',
    files: { music: 'music.ogg', chart: 'chart.hard.txt', storyboard: 'storyboard_hard.json' }
  }));

  const p = await win.webContents.executeJavaScript(`window.sbAPI.projectOpen({ path: ${JSON.stringify(projPath)} })`);
  let promise = win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(p.info)}, { projectPath: ${JSON.stringify(p.projectPath)}, config: ${JSON.stringify(p.config)}, mode: 'import-level' })`);
  await new Promise(r => setTimeout(r, 300));
  await win.webContents.executeJavaScript(`(() => { const it = Array.from(document.querySelectorAll('#modalBody .pick-item')).find(el => el.textContent.indexOf('hard') >= 0); if (it) it.click(); })()`);
  await promise;
  await new Promise(r => setTimeout(r, 500));
  console.log('STEP: initial load done');

  const switchTo = async (label) => {
    await win.webContents.executeJavaScript(`(() => { window._switchPr = window.__sb.switchDifficultyFlow().then(() => 'resolved').catch(e => 'ERR:' + e.message); })()`);
    await new Promise(r => setTimeout(r, 200));
    const found = await win.webContents.executeJavaScript(`(() => {
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const labels = items.map(el => el.textContent);
      const mask = document.getElementById('modalMask');
      const title = document.getElementById('modalTitle');
      const it = items.find(el => el.textContent.indexOf(${JSON.stringify(label)}) >= 0);
      if (it) it.click();
      return {
        found: !!it, count: items.length, labels: labels.slice(0, 5),
        maskHidden: mask ? mask.classList.contains('hidden') : null,
        title: title ? title.textContent : null
      };
    })()`);
    console.log('SW-DIAG:', JSON.stringify(found));
    await new Promise(r => setTimeout(r, 400));
    found.direct = await win.webContents.executeJavaScript(`Promise.race([window._switchPr, new Promise(r => setTimeout(() => r('TIMEOUT'), 3000))])`);
    return found;
  };
  const stateOf = () => win.webContents.executeJavaScript(`(() => {
    const cfg = window.__sb.state.projectConfig || {};
    const st = window.__sb.state;
    return {
      chart: cfg.files && cfg.files.chart,
      fileName: st.storyboardFileName,
      chartPath: st.chartPath,
      levelCharts: (st.levelCharts || []).length,
      spriteCount: (st.storyboard && st.storyboard.sprites || []).length,
      markers: (st.storyboard && st.storyboard.sprites || []).map(s => s.id)
    };
  })()`);

  // 1. Menu enabled with 3 difficulties.
  const enabled = await win.webContents.executeJavaScript(`!document.querySelector('.menu-entry[data-action="switch-difficulty"]').classList.contains('disabled')`);
  console.log('STEP: enabled check done');
  // 2. Switch to easy -> easy's own storyboard + config updated.
  const swEasy = await switchTo('easy');
  console.log('SW-EASY:', JSON.stringify(swEasy));
  console.log('CONSOLE-ERR:', JSON.stringify(consoleErrors.slice(0, 5)));
  const rEasy = await stateOf();
  // 3. Switch to extreme (no storyboard) -> empty storyboard UI.
  await switchTo('extreme');
  const rExt = await stateOf();
  // 4. Non-compiled import confirm (structural): the flow uses the dialog.
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'src', 'renderer', 'app.js'), 'utf8');
  const confirmOk = src.includes('导入的storyboard文件未经过规范化（compiled）可能导致读取效果异常，继续吗') &&
    src.includes('confirmDialog(') && src.includes('opts && opts.silent');

  console.log('R41:', JSON.stringify({ enabled, rEasy, rExt, confirmOk }));
  check('切换难度 menu enabled with multiple difficulties',
    enabled, JSON.stringify({ enabled }));
  check('switching to easy loads easy\'s own storyboard and updates the config',
    !rEasy.err && rEasy.chart === 'chart.easy.txt' && rEasy.fileName === 'storyboard_easy.json' &&
      rEasy.chartPath === 'chart.easy.txt' && rEasy.markers.includes('easy_sb') && !rEasy.markers.includes('hard_sb'),
    JSON.stringify(rEasy));
  check('switching to a difficulty without storyboard shows the empty storyboard UI',
    !rExt.err && rExt.chart === 'chart.extreme.txt' && rExt.chartPath === 'chart.extreme.txt' &&
      rExt.spriteCount === 0 && !!rExt.fileName,
    JSON.stringify(rExt));
  check('importing a non-compiled storyboard asks for confirmation',
    confirmOk, JSON.stringify({ confirmOk }));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
