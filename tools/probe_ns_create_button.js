// 验证：
//  A. 单选尚无 note_controller 的 note：属性页按钮为“创建note_controller”，
//     点击进入待创建控制器编辑页（功能对应）。
//  B. 已有控制器的 note：按钮仍为“编辑note选择器”。
//  C. 从单个 note 进入新选择器编辑（未绑定）时，外部窗口“合并时间块”自动勾选，
//     即使此前窗口已打开且复选框被手动取消过。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ncb_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ncb_proj_'));
const OUT = path.join(__dirname, 'probe_ns_create_button_out.json');
const PROG = path.join(__dirname, '_ncb_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
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

  const selectNote = (nid) => js(`(() => {
    window.__sb.selectObjects(['note::' + ${nid}], {});
    window.__sb.renderProperties();
    return true;
  })()`);

  // A. 单选无控制器的 note 0：按钮为“创建note_controller”，点击进入待创建页
  await selectNote(0);
  R.noCtrlBtn = await js(`(() => {
    const b = document.getElementById('btnEditNoteSelector');
    return b ? b.textContent : null;
  })()`);
  await js(`(() => { document.getElementById('btnEditNoteSelector').click(); return true; })()`);
  await sleep(300);
  R.pendingPage = await js(`(() => ({
    text: document.getElementById('propBody') ? document.getElementById('propBody').textContent : '',
    hasPending: !!document.querySelector('#propBody .prop-section')
  }))()`);

  // B. 给 note 1 建一个 note_controller 后再单选：按钮应为“编辑note选择器”
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({ id: 'nc_1', note: 1, time: 0 });
    window.__sb.selectObjects(['note::1'], {});
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.withCtrlBtn = await js(`(() => {
    const b = document.getElementById('btnEditNoteSelector');
    return b ? b.textContent : null;
  })()`);
  await js(`(() => { document.getElementById('btnEditNoteSelector').click(); return true; })()`);
  await sleep(300);
  R.afterWithCtrlClick = await js(`(() => ({
    selected: window.__sb.state.selectedObjId,
    inMerged: !!window.__sb.state.noteInMergedBlock
  }))()`);

  // B2. 合并时间块控制器：按钮“编辑note_controller”，点击进入单独编辑页
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'nc_m', note: { type: [0], start: 2, end: 2 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.5 }]
    });
    S.noteSelectorMerge['nc_m'] = true;
    window.__sb.selectObjects(['note::2'], {});
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.mergedBtn = await js(`(() => {
    const b = document.getElementById('btnEditNoteSelector');
    return b ? b.textContent : null;
  })()`);
  await js(`(() => { document.getElementById('btnEditNoteSelector').click(); return true; })()`);
  await sleep(300);
  R.afterMergedClick = await js(`(() => {
    const S = window.__sb.state;
    return {
      inMerged: !!S.noteInMergedBlock,
      blockId: S.noteInMergedBlock ? S.noteInMergedBlock.blockId : null,
      noteId: S.noteInMergedBlock ? S.noteInMergedBlock.noteId : null,
      bodyText: document.getElementById('propBody') ? document.getElementById('propBody').textContent : ''
    };
  })()`);

  // C. 新选择器（未绑定）默认合并时间块勾选：窗口先打开并手动取消，再进入新选择器编辑
  await js(`window.sbAPI.nsOpen()`);
  await sleep(800);
  const toolWin = BrowserWindow.getAllWindows().find((w) => w !== win);
  R.toolOpened = !!toolWin;
  const jst = (code) => toolWin.webContents.executeJavaScript(code);
  R.freshMerge = await jst(`(() => document.getElementById('nsMerge').checked)()`);
  await jst(`(() => { document.getElementById('nsMerge').checked = false; return true; })()`);
  // 模拟“从单个 note 进入新选择器编辑”（openNoteSelectorEditor 未绑定）
  await js(`window.__sb.openNoteSelectorEditor(null)`);
  await sleep(700);
  R.rebindMerge = await jst(`(() => ({
    merge: document.getElementById('nsMerge').checked,
    status: document.getElementById('nsStatus').textContent
  }))()`);

  await js(`window.sbAPI.nsClose()`);

  const out = { R };
  out.ok = !!(
    R.noCtrlBtn === '创建note_controller' &&
    R.pendingPage && R.pendingPage.text.indexOf('待创建') >= 0 &&
    R.withCtrlBtn === '编辑note_controller' &&
    R.afterWithCtrlClick && R.afterWithCtrlClick.selected === 'nc_1' && R.afterWithCtrlClick.inMerged === false &&
    R.mergedBtn === '编辑note_controller' &&
    R.afterMergedClick && R.afterMergedClick.inMerged === true &&
    R.afterMergedClick.blockId === 'nc_m' && R.afterMergedClick.noteId === 2 &&
    R.afterMergedClick.bodyText.indexOf('单独编辑') >= 0 &&
    R.toolOpened === true && R.freshMerge === true &&
    R.rebindMerge && R.rebindMerge.merge === true &&
    R.rebindMerge.status.indexOf('未绑定') >= 0
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NS_CREATE_BUTTON:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
