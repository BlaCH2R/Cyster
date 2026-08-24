// 关卡设置编辑器探针：验证 level.json 编辑界面（关卡信息 + 谱面难度）保存→重载往返。
//  - 元数据字段（id/标题/译文/来源/作者等）写入并保留，扩展字段不被冲掉
//  - 难度滑条 0–16（0=？、16=15+）、难度名称、新增/删除难度
//  - 文件选择（歌曲预览/曲绘/谱面/替换歌曲/故事板）经 dialog:pick-file 桩注入绝对路径
//  - 保存后静默重载当前难度（不弹难度选择框）
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_led_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_led_proj_'));
const CTR = path.join(TMP, 'LevelEditor.ctr');
const OUT = path.join(__dirname, 'probe_level_editor_out.json');
const PROG = path.join(__dirname, '_led_progress.log');
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
const EMPTY_SB = JSON.stringify({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });

fs.writeFileSync(path.join(TMP, 'chart.easy.txt'), MINI_CHART);
fs.writeFileSync(path.join(TMP, 'chart.hard.txt'), MINI_CHART);
fs.writeFileSync(path.join(TMP, 'chart.extreme.txt'), MINI_CHART);
fs.writeFileSync(path.join(TMP, 'sb_easy.json'), EMPTY_SB);
fs.writeFileSync(path.join(TMP, 'sb_hard.json'), EMPTY_SB);
fs.writeFileSync(path.join(TMP, 'sb_extreme.json'), EMPTY_SB);
fs.writeFileSync(path.join(TMP, 'bg.png'), 'fake-png');
fs.writeFileSync(path.join(TMP, 'bg2.png'), 'fake-png-2');
fs.copyFileSync('D:/sd/Cytoid flies/player/music.ogg', path.join(TMP, 'music.ogg'));
fs.copyFileSync('D:/sd/Cytoid flies/player/music.ogg', path.join(TMP, 'music2.ogg'));
fs.copyFileSync('D:/sd/Cytoid flies/player/music.ogg', path.join(TMP, 'preview.ogg'));
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 'bc.editor', title: 'Old Title',
  title_localized: '旧标题', artist: 'Old Artist', artist_source: '',
  illustrator: 'Old Illus', charter: 'Old Charter', storyboarder: 'Old SB',
  music: { path: 'music.ogg' }, background: { path: 'bg.png' },
  custom_extension: { keep: true },
  charts: [
    { type: 'easy', name: 'EASY', difficulty: 4, path: 'chart.easy.txt', storyboard: { path: 'sb_easy.json' } },
    { type: 'hard', name: 'HARD', difficulty: 11, path: 'chart.hard.txt', storyboard: { path: 'sb_hard.json' } }
  ]
}));
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'LevelEditor',
  files: { music: 'music.ogg', chart: 'chart.easy.txt', storyboard: 'sb_easy.json', background: 'bg.png' }
}));

// 把文件选择对话框替换成可编程的桩：点击“选择”返回预先设置的绝对路径。
let stubPick = null;
ipcMain.removeHandler('dialog:pick-file');
ipcMain.handle('dialog:pick-file', async () => stubPick);

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

  // ---- 打开项目并选 easy ----
  prog('step1 open');
  const res1 = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  await js(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res1.info)}, { projectPath: ${JSON.stringify(res1.projectPath)}, config: ${JSON.stringify(res1.config)} });
    return true;
  })()`);
  await sleep(600);
  await js(`(() => {
    const p = [...document.querySelectorAll('#modalBody .pick-item')].find((el) => el.textContent.indexOf('easy') >= 0);
    if (p) p.click();
    return true;
  })()`);
  await sleep(900);
  R.openEasy = await js(`(() => ({ chart: window.__sb.state.chartPath, sb: window.__sb.state.storyboardFileName }))()`);
  prog('step1 done: ' + JSON.stringify(R.openEasy));

  // ---- 周期 1：编辑元数据 + 难度 + 新增 extreme 难度 + 文件选择 ----
  await js(`(() => { window.__sb.projectSettingsFlow(); return true; })()`);
  await sleep(300);
  R.editorOpened = await js(`(() => ({
    modalOpen: !document.getElementById('modalMask').classList.contains('hidden'),
    hasTabs: document.querySelectorAll('.le-tab').length === 2,
    metaVisible: !document.querySelector('.le-pane[data-pane="meta"]').classList.contains('hidden'),
    idValue: document.getElementById('leId').value
  }))()`);
  await js(`(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('leId', 'bc.editor.test');
    set('leTitle', 'Test Song');
    set('leTitleLocalized', '测试曲');
    set('leArtist', 'Artist X');
    set('leArtistLocalized', '作者X');
    set('leArtistSource', 'https://example.com/song');
    set('leIllustrator', 'Illus Y');
    set('leIllustratorLocalized', '画师Y');
    set('leIllustratorSource', 'https://example.com/illus');
    set('leCharter', 'Charter Z');
    set('leStoryboarder', 'SB W');
    return true;
  })()`);
  await js(`(() => { document.querySelector('.le-tab[data-tab="charts"]').click(); return true; })()`);
  await sleep(200);
  R.slider16 = await js(`(() => {
    const row = document.querySelector('.le-chart[data-chart="0"]');
    const name = row.querySelector('input[data-f="name"]');
    name.value = 'EASY+';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const sl = row.querySelector('input[data-f="difficulty"]');
    sl.value = '16';
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelector('[data-difflabel="0"]').textContent;
  })()`);
  await js(`(() => { document.getElementById('leAddChart').click(); return true; })()`);
  await sleep(200);
  stubPick = path.join(TMP, 'chart.extreme.txt');
  await js(`(() => { document.querySelector('.le-chart[data-chart="2"] [data-pick="path"]').click(); return true; })()`);
  await sleep(400);
  stubPick = path.join(TMP, 'music2.ogg');
  await js(`(() => { document.querySelector('.le-chart[data-chart="2"] [data-pick="music"]').click(); return true; })()`);
  await sleep(400);
  stubPick = path.join(TMP, 'sb_extreme.json');
  await js(`(() => { document.querySelector('.le-chart[data-chart="2"] [data-pick="storyboard"]').click(); return true; })()`);
  await sleep(400);
  R.slider0 = await js(`(() => {
    const row = document.querySelector('.le-chart[data-chart="2"]');
    const name = row.querySelector('input[data-f="name"]');
    name.value = 'EXTRA';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const sl = row.querySelector('input[data-f="difficulty"]');
    sl.value = '0';
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelector('[data-difflabel="2"]').textContent;
  })()`);
  stubPick = path.join(TMP, 'preview.ogg');
  await js(`(() => { document.querySelector('.le-files [data-file="preview"]').click(); return true; })()`);
  await sleep(400);
  stubPick = path.join(TMP, 'bg2.png');
  await js(`(() => { document.querySelector('.le-files [data-file="background"]').click(); return true; })()`);
  await sleep(400);
  await js(`(() => { document.getElementById('leSave').click(); return true; })()`);
  await sleep(1400);
  prog('cycle1 saved');

  const lv1 = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  R.c1 = {
    id: lv1.id,
    title: lv1.title,
    titleLocalized: lv1.title_localized,
    artist: lv1.artist,
    artistLocalized: lv1.artist_localized,
    artistSource: lv1.artist_source,
    illustrator: lv1.illustrator,
    illustratorLocalized: lv1.illustrator_localized,
    illustratorSource: lv1.illustrator_source,
    charter: lv1.charter,
    storyboarder: lv1.storyboarder,
    schema: lv1.schema_version,
    version: lv1.version,
    preview: lv1.music_preview && lv1.music_preview.path,
    bg: lv1.background && lv1.background.path,
    chartCount: lv1.charts.length,
    easy: lv1.charts[0],
    hard: lv1.charts[1],
    extreme: lv1.charts[2],
    extKept: !!(lv1.custom_extension && lv1.custom_extension.keep),
    extremeFileCopied: fs.existsSync(path.join(TMP, 'chart.extreme.txt')),
    music2Copied: fs.existsSync(path.join(TMP, 'music2.ogg'))
  };
  const cfg1 = JSON.parse(fs.readFileSync(CTR, 'utf8'));
  R.c1.ctrChart = cfg1.files.chart;
  R.c1.ctrMusic = cfg1.files.music;
  R.c1.renderer = await js(`(() => ({
    chart: window.__sb.state.chartPath,
    title: window.__sb.state.level && window.__sb.state.level.title,
    sb: window.__sb.state.storyboardFileName,
    modalHidden: document.getElementById('modalMask').classList.contains('hidden'),
    pickModal: !!document.querySelector('#modalBody .pick-item')
  }))()`);
  prog('cycle1 verified');

  // ---- 周期 2：清空曲绘 + 删除 hard 难度 + easy 难度滑条置 0 ----
  await js(`(() => { window.__sb.projectSettingsFlow(); return true; })()`);
  await sleep(300);
  await js(`(() => { document.querySelector('.le-files [data-clear="background"]').click(); return true; })()`);
  await js(`(() => { document.querySelector('.le-tab[data-tab="charts"]').click(); return true; })()`);
  await sleep(200);
  await js(`(() => { document.querySelector('.le-chart[data-chart="1"] [data-del]').click(); return true; })()`);
  await sleep(200);
  await js(`(() => {
    const row = document.querySelector('.le-chart[data-chart="0"]');
    const sl = row.querySelector('input[data-f="difficulty"]');
    sl.value = '0';
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await js(`(() => { document.getElementById('leSave').click(); return true; })()`);
  await sleep(1400);
  prog('cycle2 saved');

  const lv2 = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  R.c2 = {
    chartCount: lv2.charts.length,
    hasHard: lv2.charts.some((c) => c.type === 'hard'),
    easyDifficulty: lv2.charts[0] && lv2.charts[0].difficulty,
    bg: lv2.background,
    id: lv2.id,
    extKept: !!(lv2.custom_extension && lv2.custom_extension.keep)
  };
  R.c2.renderer = await js(`(() => ({
    chart: window.__sb.state.chartPath,
    title: window.__sb.state.level && window.__sb.state.level.title,
    sb: window.__sb.state.storyboardFileName,
    modalHidden: document.getElementById('modalMask').classList.contains('hidden'),
    pickModal: !!document.querySelector('#modalBody .pick-item')
  }))()`);
  prog('cycle2 verified');

  // ---- 周期 3：新增空难度时保存应被拦截（谱面文件不能为空），弹窗保持打开 ----
  await js(`(() => { window.__sb.projectSettingsFlow(); return true; })()`);
  await sleep(300);
  await js(`(() => { document.querySelector('.le-tab[data-tab="charts"]').click(); return true; })()`);
  await sleep(200);
  await js(`(() => { document.getElementById('leAddChart').click(); return true; })()`);
  await sleep(200);
  await js(`(() => { document.getElementById('leSave').click(); return true; })()`);
  await sleep(600);
  R.c3 = await js(`(() => ({
    modalOpen: !document.getElementById('modalMask').classList.contains('hidden'),
    saveText: document.getElementById('leSave').textContent
  }))()`);
  const lv3 = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  R.c3.chartCountUnchanged = lv3.charts.length === 2;
  await js(`(() => { document.getElementById('leClose').click(); return true; })()`);
  prog('cycle3 verified');

  // ---- 周期 4：ID 格式不规范 → 弹窗内确认（仍可保存）/ 返回修改 ----
  await js(`(() => { window.__sb.projectSettingsFlow(); return true; })()`);
  await sleep(300);
  await js(`(() => { document.getElementById('leId').value = 'Bad ID'; return true; })()`);
  await js(`(() => { document.getElementById('leSave').click(); return true; })()`);
  await sleep(400);
  R.c4 = await js(`(() => ({
    issueShown: !!document.querySelector('#modalBody .le-issues'),
    confirmBtn: !!document.getElementById('leConfirmSave'),
    backBtn: !!document.getElementById('leBack'),
    modalOpen: !document.getElementById('modalMask').classList.contains('hidden')
  }))()`);
  await js(`(() => { document.getElementById('leBack').click(); return true; })()`);
  await sleep(300);
  R.c4.backRestored = await js(`(() => ({
    issueGone: !document.querySelector('#modalBody .le-issues'),
    saveBtn: !!document.getElementById('leSave'),
    modalOpen: !document.getElementById('modalMask').classList.contains('hidden')
  }))()`);
  await js(`(() => { document.getElementById('leSave').click(); return true; })()`);
  await sleep(300);
  await js(`(() => { document.getElementById('leConfirmSave').click(); return true; })()`);
  await sleep(1300);
  const lv4 = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  R.c4.savedId = lv4.id;
  R.c4.toast = await js(`(() => {
    const t = document.querySelector('#toastWrap .toast.error');
    return t ? t.textContent : null;
  })()`);
  R.c4.afterConfirm = await js(`(() => ({
    modalClosed: document.getElementById('modalMask').classList.contains('hidden'),
    chart: window.__sb.state.chartPath
  }))()`);
  prog('cycle4 verified');

  const out = { R };
  out.ok = !!(
    R.openEasy && R.openEasy.chart === 'chart.easy.txt' && R.openEasy.sb === 'sb_easy.json' &&
    R.editorOpened && R.editorOpened.modalOpen && R.editorOpened.hasTabs && R.editorOpened.metaVisible &&
    R.editorOpened.idValue === 'bc.editor' &&
    R.slider16 === '15+' && R.slider0 === '?' &&
    R.c1 && R.c1.id === 'bc.editor.test' && R.c1.title === 'Test Song' &&
    R.c1.titleLocalized === '测试曲' && R.c1.artist === 'Artist X' &&
    R.c1.artistLocalized === '作者X' && R.c1.artistSource === 'https://example.com/song' &&
    R.c1.illustrator === 'Illus Y' && R.c1.illustratorLocalized === '画师Y' &&
    R.c1.illustratorSource === 'https://example.com/illus' &&
    R.c1.charter === 'Charter Z' && R.c1.storyboarder === 'SB W' &&
    R.c1.schema === 2 && R.c1.version === 1 &&
    R.c1.preview === 'preview.ogg' && R.c1.bg === 'bg2.png' &&
    R.c1.chartCount === 3 && R.c1.extKept && R.c1.extremeFileCopied && R.c1.music2Copied &&
    R.c1.easy && R.c1.easy.type === 'easy' && R.c1.easy.name === 'EASY+' && R.c1.easy.difficulty === 16 &&
    R.c1.hard && R.c1.hard.type === 'hard' && R.c1.hard.difficulty === 11 &&
    R.c1.extreme && R.c1.extreme.type === 'extreme' && R.c1.extreme.name === 'EXTRA' &&
    R.c1.extreme.difficulty === 0 && R.c1.extreme.path === 'chart.extreme.txt' &&
    R.c1.extreme.music_override && R.c1.extreme.music_override.path === 'music2.ogg' &&
    R.c1.extreme.storyboard && R.c1.extreme.storyboard.path === 'sb_extreme.json' &&
    R.c1.ctrChart === 'chart.easy.txt' && R.c1.ctrMusic === 'music.ogg' &&
    R.c1.renderer && R.c1.renderer.chart === 'chart.easy.txt' &&
    R.c1.renderer.title === 'Test Song' && R.c1.renderer.sb === 'sb_easy.json' &&
    R.c1.renderer.modalHidden === true && R.c1.renderer.pickModal === false &&
    R.c2 && R.c2.chartCount === 2 && R.c2.hasHard === false &&
    R.c2.easyDifficulty === 0 && R.c2.bg === undefined && R.c2.id === 'bc.editor.test' && R.c2.extKept &&
    R.c2.renderer && R.c2.renderer.chart === 'chart.easy.txt' &&
    R.c2.renderer.modalHidden === true && R.c2.renderer.pickModal === false &&
    R.c3 && R.c3.modalOpen === true && R.c3.saveText === '保存' && R.c3.chartCountUnchanged === true
    ,
    R.c4 && R.c4.issueShown === true && R.c4.confirmBtn === true && R.c4.backBtn === true && R.c4.modalOpen === true &&
    R.c4.backRestored && R.c4.backRestored.issueGone === true && R.c4.backRestored.saveBtn === true && R.c4.backRestored.modalOpen === true &&
    R.c4.savedId === 'Bad ID' && R.c4.afterConfirm && R.c4.afterConfirm.modalClosed === true && R.c4.afterConfirm.chart === 'chart.easy.txt'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('LEVEL_EDITOR:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
