// verify_round40.js - importing a storyboard assigns it to the CHOSEN
// difficulty only; opening another difficulty loads that difficulty's own
// storyboard instead of reusing the previous one.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r40_ud_')));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r40_'));
  const chartEasy = { time_base: 480, tempo_list: [{ tick: 0, value: 500000 }], page_list: [{ start_tick: 0, end_tick: 2400, scan_line_direction: 1 }], note_list: [{ id: 1, type: 0, x: 0.5, tick: 1000, hold_tick: 0, page_index: 0 }], event_order_list: [], music_offset: 0 };
  const chartHard = JSON.parse(JSON.stringify(chartEasy));
  chartHard.note_list[0].x = 0.3;
  fs.writeFileSync(path.join(dir, 'chart.easy.txt'), JSON.stringify(chartEasy));
  fs.writeFileSync(path.join(dir, 'chart.hard.txt'), JSON.stringify(chartHard));
  fs.writeFileSync(path.join(dir, 'storyboard_easy.json'), sbWith('easy_sb'));
  fs.writeFileSync(path.join(dir, 'storyboard_hard.json'), sbWith('hard_sb'));
  const level = {
    schema_version: 2, version: 1, id: 'r40', title: 'r40', artist: '', charter: '',
    music: { path: 'music.ogg' },
    charts: [
      { type: 'easy', path: 'chart.easy.txt', difficulty: 4, storyboard: { path: 'storyboard_easy.json' } },
      { type: 'hard', path: 'chart.hard.txt', difficulty: 11, storyboard: { path: 'storyboard_hard.json' } }
    ]
  };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const projPath = path.join(dir, 'r40.ctdsber');
  fs.writeFileSync(projPath, JSON.stringify({
    format: 'cytoid-storyboarder-project', version: 2, name: 'r40',
    files: { music: 'music.ogg', chart: 'chart.hard.txt', storyboard: 'storyboard_hard.json' }
  }));
  const open = () => win.webContents.executeJavaScript(`window.sbAPI.projectOpen({ path: ${JSON.stringify(projPath)} })`);
  const clickPick = (text) => win.webContents.executeJavaScript(`(() => {
    const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
    const it = items.find(el => el.textContent.indexOf(${JSON.stringify(text)}) >= 0);
    if (it) it.click();
    return !!it;
  })()`);

  // 1. Import-level flow: pick "hard" (toggle on) -> assigned to hard only.
  let p = await open();
  let promise = win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(p.info)}, { projectPath: ${JSON.stringify(p.projectPath)}, config: ${JSON.stringify(p.config)}, mode: 'import-level' })`);
  await new Promise(r => setTimeout(r, 300));
  await clickPick('hard');
  await promise;
  await new Promise(r => setTimeout(r, 500));
  const r1 = await win.webContents.executeJavaScript(`(() => {
    const cfg = window.__sb.state.projectConfig || {};
    return {
      chart: cfg.files && cfg.files.chart,
      sb: cfg.files && cfg.files.storyboard,
      fileName: window.__sb.state.storyboardFileName,
      marker: !!(window.__sb.state.storyboard.sprites || []).find(s => s.id === 'hard_sb'),
      hasEasy: !!(window.__sb.state.storyboard.sprites || []).find(s => s.id === 'easy_sb')
    };
  })()`);

  // 2. Reopen (open mode): pick "easy" -> easy's own storyboard, not hard's.
  p = await open();
  promise = win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(p.info)}, { projectPath: ${JSON.stringify(p.projectPath)}, config: ${JSON.stringify(p.config)} })`);
  await new Promise(r => setTimeout(r, 300));
  await clickPick('easy');
  await promise;
  await new Promise(r => setTimeout(r, 500));
  const r2 = await win.webContents.executeJavaScript(`(() => {
    const cfg = window.__sb.state.projectConfig || {};
    return {
      chart: cfg.files && cfg.files.chart,
      fileName: window.__sb.state.storyboardFileName,
      hasEasy: !!(window.__sb.state.storyboard.sprites || []).find(s => s.id === 'easy_sb'),
      hasHard: !!(window.__sb.state.storyboard.sprites || []).find(s => s.id === 'hard_sb')
    };
  })()`);

  console.log('R40:', JSON.stringify({ r1, r2 }));
  check('import assigns the chosen difficulty storyboard (hard) and not the other',
    !r1.err && r1.chart === 'chart.hard.txt' && r1.sb === 'storyboard_hard.json' &&
      r1.fileName === 'storyboard_hard.json' && r1.marker && !r1.hasEasy,
    JSON.stringify(r1));
  check('opening another difficulty (easy) loads its OWN storyboard',
    !r2.err && r2.chart === 'chart.easy.txt' && r2.fileName === 'storyboard_easy.json' &&
      r2.hasEasy && !r2.hasHard,
    JSON.stringify(r2));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
