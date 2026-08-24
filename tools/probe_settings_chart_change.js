// 验证：在关卡设置里更换谱面对应文件（applyLevel 重载路径）也会触发
// “谱面变更检测”（toast + 失效内容标红）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_scc_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_scc_proj_'));
const OUT = path.join(__dirname, 'probe_settings_chart_change_out.json');
const PROG = path.join(__dirname, '_scc_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const chartJson = (idOffset) => JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((i) => ({
    page_index: 0, type: 0, id: i + idOffset, tick: 480 + i * 480, x: 0.5,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});

fs.writeFileSync(path.join(TMP, 'chart.txt'), chartJson(0));
fs.writeFileSync(path.join(TMP, 'chart.new.txt'), chartJson(10));
fs.writeFileSync(path.join(TMP, 'm.ogg'), 'x');
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 't', title: 'T',
  music: { path: 'm.ogg' },
  charts: [{ type: 'easy', path: 'chart.txt' }]
}));
const CTR = path.join(TMP, 'Proj.ctr');
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'Proj',
  files: { music: 'm.ogg', chart: 'chart.txt', storyboard: 'sb.json' }
}));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null;
const js = (code) => win.webContents.executeJavaScript(code);

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  prog('ready');
  win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};
  const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  await js(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
    return true;
  })()`);
  await sleep(700);

  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({ id: 'nc1', note: [0, 2], time: 'start:$note' });
    S.noteSelectorMerge['nc1'] = true;
    window.__sb.saveStoryboard();
    return true;
  })()`);
  await sleep(600);

  // 关卡设置：把谱面文件换成 chart.new.txt（绝对路径，走 applyLevel）
  const lvl = await js(`(() => {
    const S = window.__sb.state;
    return {
      level: JSON.parse(JSON.stringify(S.level)),
      chartPath: S.chartPath,
      sbFile: S.projectConfig && S.projectConfig.files && S.projectConfig.files.storyboard
    };
  })()`);
  const charts = [{
    type: 'easy', name: '', difficulty: 1, path: path.join(TMP, 'chart.new.txt'),
    music_override: { path: '' }, storyboard: { path: lvl.sbFile || 'storyboard.json' }
  }];
  R.apply = await js(`window.sbAPI.applyLevel({
    projectPath: ${JSON.stringify(CTR)},
    levelDir: ${JSON.stringify(TMP)},
    level: ${JSON.stringify(lvl.level)},
    charts: ${JSON.stringify(charts)},
    currentChartPath: ${JSON.stringify(lvl.chartPath)}
  })`);
  await js(`(() => {
    const r = ${JSON.stringify(R.apply)};
    window.__sb.loadLevelInfo(r.info, { projectPath: r.projectPath, config: r.config, mode: 'reload-level', reloadIndex: 0 });
    return true;
  })()`);
  await sleep(900);

  R.after = await js(`(() => {
    const S = window.__sb.state;
    return {
      dialogTitle: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : null,
      dialogBody: document.getElementById('modalBody') ? document.getElementById('modalBody').textContent : null,
      chartPath: S.chartPath,
      lost: window.__sb.scanLostNoteMappings(),
      redClips: document.querySelectorAll('.clip.invalid-note').length,
      nc1: (() => {
        const o = S.storyboard.note_controllers.find((x) => x.id === 'nc1');
        return o ? JSON.parse(JSON.stringify(o.note)) : null;
      })()
    };
  })()`);
  await js(`(() => {
    const btns = [...document.querySelectorAll('#modalFoot .dlg-btn')];
    const ok = btns.find((b) => b.textContent === '知道了');
    if (ok) ok.click();
    return true;
  })()`);

  const out = { R };
  out.ok = !!(
    R.apply && R.after &&
    R.after.chartPath === 'chart.new.txt' &&
    R.after.lost === 1 &&
    R.after.redClips >= 1 &&
    R.after.dialogTitle === '检测到谱面变更' &&
    R.after.dialogBody && R.after.dialogBody.indexOf('失效或受影响') >= 0 &&
    JSON.stringify(R.after.nc1) === JSON.stringify([0, 2])
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SETTINGS_CHART_CHANGE:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
