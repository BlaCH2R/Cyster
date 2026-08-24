// verify_round33.js - imported StoryBoard files are remembered by the project
// (reopening uses the imported file), and the "read existing storyboard"
// toggle appears ONLY in the .cytoidlevel import flow, never when opening an
// existing project.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r33_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PENGUIN = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';
const SRC_MUSIC = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/preview.ogg';

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));

  // Build a throwaway single-difficulty project.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r33_proj_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [{ id: 1, type: 0, x: 0.5, tick: 2000, hold_tick: 0, page_index: 0 }],
    event_order_list: [],
    music_offset: 0
  };
  const sbV1 = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] };
  const sbV2 = {
    sprites: [{ id: 'imp_marker', path: 'x.png', time: 0, layer: 0, order: 0 }],
    texts: [], videos: [], lines: [], controllers: [], note_controllers: []
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sbV1));
  fs.copyFileSync(SRC_MUSIC, path.join(dir, 'music.ogg'));
  const level = {
    schema_version: 2, version: 1, id: 'r33', title: 'r33', artist: '', charter: '',
    music: { path: 'music.ogg' },
    charts: [{ type: 'base', path: 'chart.json', difficulty: 1, storyboard: { path: 'storyboard.json' } }]
  };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const projPath = path.join(dir, 'r33.ctdsber');
  fs.writeFileSync(projPath, JSON.stringify({
    format: 'cytoid-storyboarder-project', version: 2, name: 'r33',
    files: { music: 'music.ogg', chart: 'chart.json', storyboard: 'storyboard.json' }
  }));
  // The imported v2 file lives OUTSIDE the project folder (like a user pick).
  const importedPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r33_src_')), 'my_storyboard.json');
  fs.writeFileSync(importedPath, JSON.stringify(sbV2));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const res = {};
    const openProject = async () => {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(projPath)} });
      await window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 500));
      return p;
    };

    // 1. First open: the project loads its configured storyboard (v1).
    await openProject();
    res.firstSbFile = window.__sb.state.storyboardFileName;
    res.firstHasMarker = !!window.__sb.state.storyboard.sprites.find(s => s.id === 'imp_marker');

    // 2. Simulate "导入storyboard": persist the imported file into the project.
    const upd = await window.sbAPI.projectUpdateFile({
      projectPath: ${JSON.stringify(projPath)},
      kind: 'storyboard',
      filePath: ${JSON.stringify(importedPath)}
    });
    res.updatedConfigSb = upd && upd.config && upd.config.files && upd.config.files.storyboard;

    // 3. Reopen: the project must use the imported storyboard file directly.
    await openProject();
    res.reopenSbFile = window.__sb.state.storyboardFileName;
    res.reopenHasMarker = !!window.__sb.state.storyboard.sprites.find(s => s.id === 'imp_marker');

    // 4. Toggle visibility: import-level mode shows it, open mode hides it.
    const peng = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PENGUIN)} });
    const charts = peng.info.charts;
    const countToggles = () => document.querySelectorAll('#modalBody .pick-sb').length;
    window.__sb.chooseChart(charts, true);      // .cytoidlevel import -> toggle shown
    await new Promise(r => setTimeout(r, 150));
    res.togglesImport = countToggles();
    document.querySelectorAll('#modalBody .pick-item')[0].click();
    await new Promise(r => setTimeout(r, 150));
    window.__sb.chooseChart(charts, false);     // open project -> toggle hidden
    await new Promise(r => setTimeout(r, 150));
    res.togglesOpen = countToggles();
    document.querySelectorAll('#modalBody .pick-item')[0].click();
    await new Promise(r => setTimeout(r, 100));

    res.ok = res.firstSbFile === 'storyboard.json' && !res.firstHasMarker &&
      res.updatedConfigSb === 'my_storyboard.json' &&
      res.reopenSbFile === 'my_storyboard.json' && res.reopenHasMarker &&
      res.togglesImport === 2 && res.togglesOpen === 0;
    return res;
  })()`);
  console.log('R33:', JSON.stringify(out));

  check('imported storyboard is remembered and used on reopen',
    !out.err && out.firstSbFile === 'storyboard.json' && !out.firstHasMarker &&
      out.updatedConfigSb === 'my_storyboard.json' &&
      out.reopenSbFile === 'my_storyboard.json' && out.reopenHasMarker,
    JSON.stringify({ firstSbFile: out.firstSbFile, updatedConfigSb: out.updatedConfigSb, reopenSbFile: out.reopenSbFile, reopenHasMarker: out.reopenHasMarker }));
  check('"read existing storyboard" toggle only in the .cytoidlevel import flow',
    !out.err && out.togglesImport === 2 && out.togglesOpen === 0,
    JSON.stringify({ togglesImport: out.togglesImport, togglesOpen: out.togglesOpen }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
