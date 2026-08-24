// 验证 note 选择器编辑器：
//  A. 新编辑器默认：合并时间块勾选、初始不勾选任何 note 类型
//  B. 列表模式：预览只高亮列表拾取到的 note；再次点击取消拾取后对应失去高亮
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ned_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ned_proj_'));
const OUT = path.join(__dirname, 'probe_ns_editor_defaults_out.json');
const PROG = path.join(__dirname, '_ned_progress.log');
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

  // A. 打开新编辑器（未绑定）：合并时间块默认勾选、无类型勾选
  await js(`window.sbAPI.nsOpen()`);
  await sleep(800);
  const toolWin = BrowserWindow.getAllWindows().find((w) => w !== win);
  R.toolOpened = !!toolWin;
  const jst = (code) => toolWin.webContents.executeJavaScript(code);
  R.freshDefaults = await jst(`(() => ({
    merge: document.getElementById('nsMerge').checked,
    checkedTypes: [...document.querySelectorAll('#nsTypes input:checked')].map((el) => Number(el.dataset.t))
  }))()`);

  // B. 绑定带列表（[]）选择器的 note_controller：进入列表模式
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'nc1', note: [0, 1, 2], time: 0
    });
    window.__sb.selectObject('nc1', null);
    window.__sb.renderProperties();
    const el = document.getElementById('fNote');
    if (el) el.click();
    return true;
  })()`);
  await sleep(800);
  R.listMode = await jst(`(() => ({
    status: document.getElementById('nsStatus').textContent,
    items: document.querySelectorAll('#nsList .ns-list-item').length
  }))()`);
  R.highlightInitial = await js(`(() => {
    const h = window.__sb.preview.highlightNotes;
    return h ? [...h].sort((a, b) => a - b) : [];
  })()`);

  // 拾取模式 + 点击 note 1（取消拾取）→ 预览高亮应去掉 1
  await js(`window.__sb.nsBridge('pick', [true])`);
  await sleep(200);
  R.diag = await js(`(() => {
    const S = window.__sb.state;
    window.__sb.setTime(0.95, false); // note 1 位于 1.0s；click 类 note 在 start 前才可命中
    const note = S.chart.noteById(1);
    const info = window.__sb.preview.ctxInfo();
    const pos = window.__sb.preview.notePos(note, info);
    const hit = window.__sb.preview.hitTestNote(pos.x, pos.y);
    const canvas = document.getElementById('previewCanvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: rect.left + pos.x / canvas.width * rect.width,
      clientY: rect.top + pos.y / canvas.height * rect.height,
      bubbles: true
    }));
    return {
      pickActive: S.notePickerActive,
      noteStart: note.start_time,
      pos,
      rect: { w: rect.width, h: rect.height, cw: canvas.width, ch: canvas.height },
      hitBeforeClick: hit ? hit.id : null
    };
  })()`);
  await sleep(800);
  R.highlightAfterUnpick = await js(`(() => {
    const h = window.__sb.preview.highlightNotes;
    return h ? [...h].sort((a, b) => a - b) : [];
  })()`);
  R.listAfterUnpick = await jst(`(() => ({
    items: document.querySelectorAll('#nsList .ns-list-item').length,
    texts: [...document.querySelectorAll('#nsList .ns-list-item')].map((el) => el.textContent.trim())
  }))()`);
  R.draftAfterUnpick = await js(`(() => JSON.parse(JSON.stringify(
    window.__sb.state.storyboard.note_controllers.find((o) => o.id === 'nc1').note
  )))()`);

  // 点“应用”后对象写入取消拾取后的列表
  await jst(`(() => { document.getElementById('nsApply').click(); return true; })()`);
  await sleep(700);
  R.noteAfterApply = await js(`(() => JSON.parse(JSON.stringify(
    window.__sb.state.storyboard.note_controllers.find((o) => o.id === 'nc1').note
  )))()`);

  await js(`window.sbAPI.nsClose()`);

  const out = { R };
  out.ok = !!(
    R.toolOpened === true &&
    R.freshDefaults && R.freshDefaults.merge === true && R.freshDefaults.checkedTypes.length === 0 &&
    R.listMode && R.listMode.status.indexOf('手动列表模式') >= 0 && R.listMode.items === 3 &&
    JSON.stringify(R.highlightInitial) === JSON.stringify([0, 1, 2]) &&
    JSON.stringify(R.highlightAfterUnpick) === JSON.stringify([0, 2]) &&
    R.listAfterUnpick && R.listAfterUnpick.items === 2 &&
    R.listAfterUnpick.texts.some((t) => t.indexOf('#1') >= 0) === false &&
    // 应用前对象保持原样（草稿语义），应用后才写入取消拾取后的列表。
    JSON.stringify(R.draftAfterUnpick) === JSON.stringify([0, 1, 2]) &&
    JSON.stringify(R.noteAfterApply) === JSON.stringify([0, 2])
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NS_EDITOR_DEFAULTS:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
