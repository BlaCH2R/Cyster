// 验证：复制合并时间块（note 选择器 note_controller + 合并/载体标记）时，
// 克隆体是否继承合并标记与父级载体标记、选择器条件是否被复制。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cmb_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cmb_proj_'));
const OUT = path.join(__dirname, 'probe_copy_merged_block_out.json');
const PROG = path.join(__dirname, '_cmb_progress.log');
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
    // 合并时间块 + 父级载体标记的 note_controller
    S.storyboard.note_controllers.push({
      id: 'parent_$note', note: { type: [0] }, time: 'intro:$note',
      states: [{ time: 'start:$note', opacity_multiplier: 0.7 }]
    });
    S.noteSelectorMerge['parent_$note'] = true;
    S.parentCarriers['parent_$note'] = true;
    window.__sb.selectObject('parent_$note', null);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(400);

  // 路径 1：右键“复制对象（绝对时间）”→ copySelection(false, id)
  await js(`window.__sb.copySelection(false, 'parent_$note')`);
  await sleep(400);
  R.copySelection = await js(`(() => {
    const S = window.__sb.state;
    const clones = S.storyboard.note_controllers.filter((o) => o.id !== 'parent_$note');
    return clones.map((o) => ({
      id: o.id,
      note: JSON.parse(JSON.stringify(o.note)),
      time: o.time,
      merged: !!S.noteSelectorMerge[o.id],
      carrier: !!S.parentCarriers[o.id],
      state0: o.states && o.states[0] && o.states[0].time
    }));
  })()`);

  // 路径 2：Ctrl+C / Ctrl+V（对象剪贴板）
  await js(`(() => {
    const S = window.__sb.state;
    S.selectedIds = ['parent_$note'];
    window.__sb.copyObjectsToClipboard();
    return true;
  })()`);
  await js(`window.__sb.pasteObjectsAtPlayhead()`);
  await sleep(400);
  R.pasteClipboard = await js(`(() => {
    const S = window.__sb.state;
    const clones = S.storyboard.note_controllers.filter((o) => o.id !== 'parent_$note');
    return clones.map((o) => ({
      id: o.id,
      note: JSON.parse(JSON.stringify(o.note)),
      merged: !!S.noteSelectorMerge[o.id],
      carrier: !!S.parentCarriers[o.id]
    }));
  })()`);

  const out = { R };
  out.ok = !!(
    R.copySelection && R.copySelection.length === 1 &&
    R.copySelection[0].merged === true &&
    R.copySelection[0].carrier === false &&
    JSON.stringify(R.copySelection[0].note) === JSON.stringify({ type: [0] }) &&
    R.copySelection[0].time === 'intro:$note' && R.copySelection[0].state0 === 'start:$note' &&
    R.pasteClipboard && R.pasteClipboard.length === 2 &&
    R.pasteClipboard.every((c) => c.merged === true && c.carrier === false &&
      JSON.stringify(c.note) === JSON.stringify({ type: [0] }))
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('COPY_MERGED_BLOCK:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
