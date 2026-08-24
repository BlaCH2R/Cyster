// 验证：打开 note 选择器编辑器后，点击属性页的 Note 输入框会重新绑定该对象，
// 在编辑器里点“应用”能把选择器数据写回该对象的 note 字段。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nib_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nib_proj_'));
const OUT = path.join(__dirname, 'probe_ns_note_input_bind_out.json');
const PROG = path.join(__dirname, '_nib_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: id % 2, id, tick: 480 + id * 480, x: 0.5,
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

  // 带 note 选择器的 sprite + 选中，渲染出 Note 输入框
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr1', path: 'octa.png', time: 0, x: 0, y: 0, opacity: 1,
      note: { type: [0] }
    });
    window.__sb.selectObject('spr1', null);
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.hasNoteInput = await js(`(() => !!document.getElementById('fNote'))()`);

  // 打开 note 选择器编辑器（独立窗口）
  await js(`window.sbAPI.nsOpen()`);
  await sleep(700);
  const toolWin = BrowserWindow.getAllWindows().find((w) => w !== win);
  R.toolWindowOpened = !!toolWin;
  const jst = (code) => toolWin.webContents.executeJavaScript(code);

  // 点击主窗口属性页的 Note 输入框 → 编辑器应重新绑定 spr1
  await js(`(() => { const el = document.getElementById('fNote'); if (el) el.click(); return true; })()`);
  await sleep(600);
  R.toolAfterClick = await jst(`(() => ({
    status: document.getElementById('nsStatus').textContent,
    checkedTypes: [...document.querySelectorAll('#nsTypes input:checked')].map((el) => Number(el.dataset.t))
  }))()`);

  // 编辑器里勾选类型 1，点击“应用”
  await jst(`(() => {
    const cb1 = document.querySelector('#nsTypes input[data-t="1"]');
    if (cb1) cb1.checked = true;
    document.getElementById('nsApply').click();
    return true;
  })()`);
  await sleep(700);
  R.spr1Note = await js(`(() => JSON.parse(JSON.stringify(
    window.__sb.state.storyboard.sprites.find((o) => o.id === 'spr1').note
  )))()`);
  R.fNoteValue = await js(`(() => {
    const el = document.getElementById('fNote');
    return el ? el.value : null;
  })()`);

  // 收尾：关闭工具窗口
  await js(`window.sbAPI.nsClose()`);

  const out = { R };
  out.ok = !!(
    R.hasNoteInput === true && R.toolWindowOpened === true &&
    R.toolAfterClick && R.toolAfterClick.status.indexOf('spr1') >= 0 &&
    R.toolAfterClick.checkedTypes.join(',') === '0' &&
    R.spr1Note && JSON.stringify(R.spr1Note) === JSON.stringify({ type: [0, 1] })
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NS_NOTE_INPUT_BIND:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
