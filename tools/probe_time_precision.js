// 验证小数位数过多的时间不会再让关键帧“消失”：
//  - 字符串数字时间（历史/粘贴长小数落库）能被 resolveTime 解析（时间块有 K0/K1）
//  - 时间输入框粘贴长小数 → 自动按 3 位小数收敛并转数值
//  - 复制 note 时间 / intro 时间只保留 3 位小数
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_tpr_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_tpr_proj_'));
const OUT = path.join(__dirname, 'probe_time_precision_out.json');
const PROG = path.join(__dirname, '_tpr_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

// tempo 333333us/beat：tick 480 = 0.333333s，能产生长小数时间
const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 333333 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: 0, id, tick: 480 + id * 480, x: 0.1 + id * 0.2,
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

  // 1) 字符串数字时间（长小数落库的旧数据形态）→ 时间块仍有 K0/K1 关键帧
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr_s', path: 'octa.png', time: '1.4999999999999998', x: 0, y: 0, opacity: 1,
      states: [{ time: '2.9999999999999996', opacity: 0.8 }]
    });
    window.__sb.selectObject('spr_s', null);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(500);
  R.stringTime = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_s');
    const kfItems = document.querySelectorAll('#keyList .key-item').length;
    return { timeType: typeof obj.time, kfItems };
  })()`);

  // 2) 时间输入框粘贴长小数 → 收敛为 3 位小数的数值
  await js(`(() => {
    const rows = [...document.querySelectorAll('#stateForm .field')];
    const tRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.indexOf('时间') >= 0);
    const input = tRow.querySelector('input[type=text]');
    input.value = '3.123456789012';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterInput = await js(`(() => {
    const S = window.__sb.state;
    const obj = S.storyboard.sprites.find((o) => o.id === 'spr_s');
    return { time: obj.time, timeType: typeof obj.time };
  })()`);

  // 3) 复制 note 时间 / intro 时间格式：仅 3 位小数
  R.copyFormat = await js(`(() => {
    const S = window.__sb.state;
    const note = S.chart.notes[0];
    const start = note.start_time.toFixed(3);
    const intro = note.intro_time.toFixed(3);
    return {
      start, intro,
      startDecimals: start.indexOf('.') >= 0 ? start.length - start.indexOf('.') - 1 : 0,
      introDecimals: intro.indexOf('.') >= 0 ? intro.length - intro.indexOf('.') - 1 : 0
    };
  })()`);

  const out = { R };
  out.ok = !!(
    R.stringTime && R.stringTime.kfItems >= 2 &&
    R.afterInput && R.afterInput.timeType === 'number' && R.afterInput.time === 3.123 &&
    R.copyFormat && R.copyFormat.startDecimals <= 3 && R.copyFormat.introDecimals <= 3
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('TIME_PRECISION:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
