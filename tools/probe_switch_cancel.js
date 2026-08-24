// 验证：编辑中“切换难度”弹窗点取消/点遮罩时应留在编辑器（不再误跳欢迎页）；
// 初始加载关卡时取消仍回欢迎页。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_swc_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_swc_proj_'));
const OUT = path.join(__dirname, 'probe_switch_cancel_out.json');
const PROG = path.join(__dirname, '_swc_progress.log');
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
fs.writeFileSync(path.join(TMP, 'chart.easy.txt'), MINI_CHART);
fs.writeFileSync(path.join(TMP, 'chart.hard.txt'), MINI_CHART);
fs.writeFileSync(path.join(TMP, 'm.ogg'), 'x');
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 't', title: 'T',
  music: { path: 'm.ogg' },
  charts: [
    { type: 'easy', path: 'chart.easy.txt' },
    { type: 'hard', path: 'chart.hard.txt' }
  ]
}));
const CTR = path.join(TMP, 'Proj.ctr');
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'Proj',
  files: { music: 'm.ogg', chart: 'chart.easy.txt', storyboard: 'sb.json' }
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
  await sleep(600);
  await js(`(() => {
    const p = [...document.querySelectorAll('#modalBody .pick-item')].find((el) => el.textContent.indexOf('easy') >= 0);
    if (p) p.click();
    return true;
  })()`);
  await sleep(800);
  R.inEditor = await js(`(() => !document.body.classList.contains('welcome-mode'))()`);
  await js(`(() => { window.__sb.switchDifficultyFlow(); return true; })()`);
  await sleep(600);
  R.modalOpen = await js(`(() => !document.getElementById('modalMask').classList.contains('hidden'))()`);
  await js(`(() => {
    const btns = [...document.querySelectorAll('#modalFoot .dlg-btn')];
    const cancel = btns.find((b) => b.textContent === '取消');
    if (cancel) cancel.click();
    return true;
  })()`);
  await sleep(500);
  R.afterCancel = await js(`(() => ({
    welcome: document.body.classList.contains('welcome-mode'),
    modalClosed: document.getElementById('modalMask').classList.contains('hidden')
  }))()`);

  // 点遮罩取消：同样留在编辑器
  await js(`(() => { window.__sb.switchDifficultyFlow(); return true; })()`);
  await sleep(600);
  await js(`(() => { document.getElementById('modalMask').click(); return true; })()`);
  await sleep(400);
  R.afterMaskCancel = await js(`(() => ({
    welcome: document.body.classList.contains('welcome-mode'),
    modalClosed: document.getElementById('modalMask').classList.contains('hidden')
  }))()`);

  // 初始加载（重开项目）时取消：仍回欢迎页
  const res2 = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  await js(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res2.info)}, { projectPath: ${JSON.stringify(res2.projectPath)}, config: ${JSON.stringify(res2.config)} });
    return true;
  })()`);
  await sleep(600);
  await js(`(() => {
    const btns = [...document.querySelectorAll('#modalFoot .dlg-btn')];
    const cancel = btns.find((b) => b.textContent === '取消');
    if (cancel) cancel.click();
    return true;
  })()`);
  await sleep(400);
  R.initialCancel = await js(`(() => document.body.classList.contains('welcome-mode'))()`);

  const out = { R };
  out.ok = !!(
    R.inEditor === true && R.modalOpen === true &&
    R.afterCancel && R.afterCancel.welcome === false && R.afterCancel.modalClosed === true &&
    R.afterMaskCancel && R.afterMaskCancel.welcome === false && R.afterMaskCancel.modalClosed === true &&
    R.initialCancel === true
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SWITCH_CANCEL:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
