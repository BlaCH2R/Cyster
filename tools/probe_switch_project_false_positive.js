// 验证：切换项目时不应错误触发“检测到谱面变更”弹窗。
// 项目 B 的谱面与项目 A 不同（同 ID 但时间不同），且 B 未保存过谱面签名——
// 修复前会拿 A 的内存签名对比 B，产生假阳性弹窗。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_spf_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_spf_proj_'));
const OUT = path.join(__dirname, 'probe_switch_project_false_positive_out.json');
const PROG = path.join(__dirname, '_spf_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const chartJson = (tempo) => JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: tempo }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: 0, id, tick: 480 + id * 480, x: 0.5,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});
const SB = JSON.stringify({
  sprites: [], texts: [], videos: [], lines: [], controllers: [],
  note_controllers: [{ id: 'nc0', note: 0, time: 'start:$note' }], templates: {}
});

function mkProject(dir, name, tempo, withSig) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'chart.txt'), chartJson(tempo));
  fs.writeFileSync(path.join(dir, 'storyboard.json'), SB);
  fs.writeFileSync(path.join(dir, 'm.ogg'), 'x');
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify({
    schema_version: 2, version: 1, id: name, title: name,
    music: { path: 'm.ogg' },
    charts: [{ type: 'easy', path: 'chart.txt', storyboard: { path: 'storyboard.json' } }]
  }));
  const ctr = path.join(dir, name + '.ctr');
  const editor = { manualImages: [], manualSizes: {}, groupHidden: {}, collapsedTags: {},
    difficulties: { 'chart.txt': { hiddenObjects: {}, lockedIds: [], controllerCards: {},
      noteSelectorMerge: {}, noteSelectorMeta: {}, parentCarriers: {},
      timeline: { version: 5, trackGroups: { stage: [], note_controller: [], controller: [] }, lockedOrders: [] },
      noteTimeTokens: {} } } };
  if (withSig) {
    // 用当前谱面（tempo=500000）的签名写入分桶
    editor.difficulties['chart.txt'].chartNoteSig = { 0: [0.5, 0.5, -0.36666666666666664, 0], 1: [1, 1, 0.13333333333333336, 0], 2: [1.5, 1.5, 0.6333333333333333, 0], 3: [2, 2, 1.1333333333333333, 0], 4: [2.5, 2.5, 1.6333333333333333, 0] };
  }
  fs.writeFileSync(ctr, JSON.stringify({
    format: 'cytoid-storyboarder-project', version: 2, name,
    files: { music: 'm.ogg', chart: 'chart.txt', storyboard: 'storyboard.json' },
    editor
  }));
  return ctr;
}

const A = mkProject(path.join(TMP, 'A'), 'A', 500000, false);
const B = mkProject(path.join(TMP, 'B'), 'B', 400000, false);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null;
const js = (code) => win.webContents.executeJavaScript(code);
const openProject = async (ctr) => {
  const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(ctr)} })`);
  await js(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
    return true;
  })()`);
  await sleep(700);
};
const dialogVisible = () => js(`(() => ({
  title: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : null,
  open: !document.getElementById('modalMask').classList.contains('hidden')
}))()`);
const dismiss = () => js(`(() => {
  const ok = [...document.querySelectorAll('#modalFoot .dlg-btn')].pop();
  if (ok) ok.click();
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
  await openProject(A);
  R.afterA = await dialogVisible();
  if (R.afterA.open) { await dismiss(); await sleep(300); }
  // 用应用自身保存 A，把真实谱面签名写入分桶
  await js(`window.__sb.saveStoryboard()`);
  await sleep(400);

  await openProject(B);
  R.afterB = await dialogVisible();
  if (R.afterB.open) { await dismiss(); await sleep(300); }
  R.lostB = await js(`window.__sb.scanLostNoteMappings()`);

  const out = { R };
  out.ok = !!(
    R.afterA && R.afterA.title !== '检测到谱面变更' &&
    R.afterB && R.afterB.title !== '检测到谱面变更' &&
    R.lostB === 0
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SWITCH_PROJECT_FP:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
