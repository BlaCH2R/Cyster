// 验证：仅当 note 选择器外部窗口打开时，无选择器状态的 stage 对象属性页才显示
// 空白 Note 输入框（原位置），点击可绑定选择器编辑器并直接创建/注入选择器。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_sni_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_sni_proj_'));
const OUT = path.join(__dirname, 'probe_ns_stage_note_input_out.json');
const PROG = path.join(__dirname, '_sni_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: id % 2, id, tick: 480 + id * 480, x: 0.1 + id * 0.2,
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
const selectSprite = (id) => js(`(() => {
  window.__sb.selectObject(${JSON.stringify(id)}, null);
  window.__sb.renderProperties();
  return true;
})()`);

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
    S.storyboard.sprites.push({ id: 'sprA', path: 'octa.png', time: 0, x: 0, y: 0, opacity: 1 });
    S.storyboard.sprites.push({ id: 'sprB', path: 'octa.png', time: 0, x: 0, y: 0, opacity: 1 });
    return true;
  })()`);

  // 1) 窗口未打开：无选择器的 stage 对象不显示 Note 输入框
  await selectSprite('sprA');
  R.beforeOpen = await js(`(() => ({ fNote: !!document.getElementById('fNote'), winOpen: window.__sb.state.nsWindowOpen }))()`);

  // 2) 打开外部窗口：属性页出现空白 Note 输入框（原位置）
  await js(`window.sbAPI.nsOpen()`);
  await sleep(800);
  const toolWin = BrowserWindow.getAllWindows().find((w) => w !== win);
  R.toolOpened = !!toolWin;
  await selectSprite('sprA');
  R.afterOpen = await js(`(() => {
    const el = document.getElementById('fNote');
    return { fNote: !!el, value: el ? el.value : null, placeholder: el ? el.placeholder : null, winOpen: window.__sb.state.nsWindowOpen };
  })()`);

  // 3) 点击空白输入框 → 绑定选择器编辑器 → 应用注入
  await js(`(() => { document.getElementById('fNote').click(); return true; })()`);
  await sleep(700);
  R.toolBound = await toolWin.webContents.executeJavaScript(`(() => ({
    status: document.getElementById('nsStatus').textContent
  }))()`);
  await toolWin.webContents.executeJavaScript(`(() => {
    const cb0 = document.querySelector('#nsTypes input[data-t="0"]');
    const cb1 = document.querySelector('#nsTypes input[data-t="1"]');
    if (cb0) cb0.checked = true;
    if (cb1) cb1.checked = true;
    document.getElementById('nsApply').click();
    return true;
  })()`);
  await sleep(700);
  R.afterApply = await js(`(() => {
    const obj = window.__sb.state.storyboard.sprites.find((o) => o.id === 'sprA');
    const el = document.getElementById('fNote');
    return { note: JSON.parse(JSON.stringify(obj.note)), fNoteValue: el ? el.value : null };
  })()`);

  // 4) 关闭外部窗口：已注入选择器的对象仍显示 Note 输入框；未注入的 sprB 不显示
  await js(`window.sbAPI.nsClose()`);
  await sleep(600);
  R.afterCloseA = await js(`(() => ({
    fNote: !!document.getElementById('fNote'),
    winOpen: window.__sb.state.nsWindowOpen
  }))()`);
  await selectSprite('sprB');
  R.afterCloseB = await js(`(() => ({
    fNote: !!document.getElementById('fNote'),
    winOpen: window.__sb.state.nsWindowOpen
  }))()`);

  const out = { R };
  out.ok = !!(
    R.beforeOpen && R.beforeOpen.fNote === false && R.beforeOpen.winOpen === false &&
    R.toolOpened === true &&
    R.afterOpen && R.afterOpen.fNote === true && R.afterOpen.value === '' &&
    R.afterOpen.placeholder === '未设置' && R.afterOpen.winOpen === true &&
    R.toolBound && R.toolBound.status.indexOf('sprA') >= 0 &&
    R.afterApply && JSON.stringify(R.afterApply.note) === JSON.stringify({ type: [0, 1] }) &&
    R.afterApply.fNoteValue.indexOf('type') >= 0 &&
    R.afterCloseA && R.afterCloseA.fNote === true && R.afterCloseA.winOpen === false &&
    R.afterCloseB && R.afterCloseB.fNote === false && R.afterCloseB.winOpen === false
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NS_STAGE_NOTE_INPUT:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
