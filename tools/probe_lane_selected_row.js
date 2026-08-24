// 验证：被选中的轨道行在名称列（tlh-lane）与时间轴体（lane-row）都带上
// selected 高亮类，名称部分（lane-label .nm）一并覆盖；未选中的轨道无此高亮。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lsr_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_lsr_proj_'));
const OUT = path.join(__dirname, 'probe_lane_selected_row_out.json');
const PROG = path.join(__dirname, '_lsr_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: 0, id, tick: 480 + id * 480, x: 0.5,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});
fs.writeFileSync(path.join(TMP, 'chart.txt'), MINI_CHART);
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
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
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
    S.storyboard.sprites.push({ id: 'spr_a', path: 'octa.png', time: 0, x: 0, y: 0, opacity: 1, states: [{ time: 2 }] });
    S.storyboard.sprites.push({ id: 'spr_b', path: 'octa.png', time: 1, x: 0, y: 0, opacity: 1, states: [{ time: 3 }] });
    window.__sb.selectObject('spr_a', null);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);

  const readRows = () => js(`(() => {
    const labelRows = [...document.querySelectorAll('.tlh-lane')];
    const trackRows = [...document.querySelectorAll('.lane-row')];
    const byName = (id) => {
      const lab = labelRows.find((r) => {
        const nm = r.querySelector('.lane-label .nm');
        return nm && nm.textContent.trim() === id;
      });
      const trk = trackRows.find((r) => r.querySelector('.clip[data-id="' + id + '"]'));
      return {
        labelSelected: !!(lab && lab.classList.contains('selected')),
        labelNmSelected: !!(lab && lab.querySelector('.lane-label.selected .nm')),
        trackSelected: !!(trk && trk.classList.contains('selected'))
      };
    };
    return {
      a: byName('spr_a'),
      b: byName('spr_b'),
      labelCount: labelRows.length,
      trackCount: trackRows.length
    };
  })()`);
  R.single = await readRows();

  // 多选两个对象：两条轨道行都应高亮
  await js(`(() => {
    window.__sb.selectObjects(['spr_a', 'spr_b'], {});
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.multi = await readRows();

  const out = { R };
  out.ok = !!(
    R.single && R.single.a && R.single.a.labelSelected === true &&
    R.single.a.labelNmSelected === true && R.single.a.trackSelected === true &&
    R.single.b && R.single.b.labelSelected === false && R.single.b.trackSelected === false &&
    R.single.labelCount > 0 && R.single.trackCount === R.single.labelCount &&
    R.multi && R.multi.a && R.multi.a.labelSelected === true && R.multi.a.trackSelected === true &&
    R.multi.b && R.multi.b.labelSelected === true && R.multi.b.trackSelected === true
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('LANE_SELECTED_ROW:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
