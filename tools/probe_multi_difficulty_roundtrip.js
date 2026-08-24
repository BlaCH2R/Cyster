// 验证多难度 + 独特功能的保存→重开往返：
//  - 独特功能元数据按难度（chart）分桶存于 editor.difficulties[chartPath]
//  - 难度切换时重置为当前难度的数据（不串味）
//  - 保存后各难度数据独立，重开后各自还原
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mdr_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mdr_proj_'));
const CTR = path.join(TMP, 'Multi.ctr');
const OUT = path.join(__dirname, 'probe_multi_difficulty_roundtrip_out.json');

// 极简 chart（5 个 click note），避免大谱面在探针环境卡死
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
fs.writeFileSync(path.join(TMP, 'sb_easy.json'), EMPTY_SB);
fs.writeFileSync(path.join(TMP, 'sb_hard.json'), EMPTY_SB);
fs.copyFileSync('D:/sd/Cytoid flies/player/music.ogg', path.join(TMP, 'music.ogg'));
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 'bc.multi', title: 'Multi',
  music: { path: 'music.ogg' },
  charts: [
    { type: 'easy', difficulty: 4, path: 'chart.easy.txt', storyboard: { path: 'sb_easy.json' } },
    { type: 'hard', difficulty: 11, path: 'chart.hard.txt', storyboard: { path: 'sb_hard.json' } }
  ]
}));
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'Multi',
  files: { music: 'music.ogg', chart: 'chart.easy.txt', storyboard: 'sb_easy.json' }
}));
// 调试：验证写入的 CTR 可被 readProjectConfig 逻辑接受
{
  const cfg = JSON.parse(fs.readFileSync(CTR, 'utf8'));
  const ok = !!(cfg && cfg.format === 'cytoid-storyboarder-project' && cfg.files && cfg.files.chart && cfg.files.music);
  if (!ok) { console.log('CTR INVALID:', JSON.stringify(cfg)); process.exit(1); }
  console.log('CTR OK, files=', JSON.stringify(cfg.files));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROG = path.join(__dirname, '_mdr_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2000));
  prog('ready');
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};

  // 1) 打开多难度项目，选 easy
  prog('step1 open');
  const res1 = await win.webContents.executeJavaScript(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  prog('step1 projectOpen ok: ' + !!res1);
  await win.webContents.executeJavaScript(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res1.info)}, { projectPath: ${JSON.stringify(res1.projectPath)}, config: ${JSON.stringify(res1.config)} });
    return true;
  })()`);
  await sleep(600);
  await win.webContents.executeJavaScript(`(() => {
    const pick = [...document.querySelectorAll('#modalBody .pick-item')].find((el) => el.textContent.indexOf('easy') >= 0);
    if (pick) pick.click();
    return true;
  })()`);
  await sleep(800);
  prog('step1 done');
  R.openEasy = await win.webContents.executeJavaScript(`(() => ({
    chart: window.__sb.state.chartPath,
    sb: window.__sb.state.storyboardFileName
  }))()`);

  // 2) 给 easy 添加独特功能：sprite + note 选择器 + parent_$note 载体 + 卡片归属
  await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites.push({
      id: 'spr_e', path: 'octa.png', time: 'intro:$note', parent_id: 'parent_$note',
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    window.__sb.nsBridge('apply', [{ id: 'spr_e', note: { start: 0, end: 4 }, merge: true }]);
    S.controllerCards['ctl_e'] = ['camera_x'];
    S.objHidden['spr_e'] = true;
    S.lockedIds.add('spr_e');
    return true;
  })()`);
  await sleep(400);
  prog('step2 features added');
  await win.webContents.executeJavaScript(`window.__sb.saveStoryboard()`);
  await sleep(500);
  prog('step2 saved');
  const cfgAfterEasy = JSON.parse(fs.readFileSync(CTR, 'utf8'));
  const diffEasy = cfgAfterEasy.editor && cfgAfterEasy.editor.difficulties &&
    cfgAfterEasy.editor.difficulties['chart.easy.txt'];
  R.easySaved = {
    hasEasyBucket: !!diffEasy,
    easyMeta: !!(diffEasy && diffEasy.noteSelectorMeta && Object.keys(diffEasy.noteSelectorMeta).length),
    easyCarrier: !!(diffEasy && diffEasy.parentCarriers && diffEasy.parentCarriers['parent_$note']),
    easyMerge: !!(diffEasy && diffEasy.noteSelectorMerge && diffEasy.noteSelectorMerge['spr_e']),
    easyCards: !!(diffEasy && diffEasy.controllerCards && diffEasy.controllerCards['ctl_e']),
    easyHidden: !!(diffEasy && diffEasy.hiddenObjects && diffEasy.hiddenObjects['spr_e']),
    easyLocked: !!(diffEasy && diffEasy.lockedIds && diffEasy.lockedIds.includes('spr_e')),
    hardBucketAbsent: !(cfgAfterEasy.editor && cfgAfterEasy.editor.difficulties &&
      cfgAfterEasy.editor.difficulties['chart.hard.txt'])
  };

  // 3) 切到 hard：元数据应重置（easy 的不再泄漏）
  prog('step3 switch');
  await win.webContents.executeJavaScript(`(() => { window.__sb.switchDifficultyFlow(); return true; })()`);
  await sleep(600);
  await win.webContents.executeJavaScript(`(() => {
    const pick = [...document.querySelectorAll('#modalBody .pick-item')].find((el) => el.textContent.indexOf('hard') >= 0);
    if (pick) pick.click();
    return true;
  })()`);
  await sleep(800);
  prog('step3 picked hard');
  R.hardState = await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    return {
      chart: S.chartPath,
      sb: S.storyboardFileName,
      metaLeaked: Object.keys(S.noteSelectorMeta).length > 0,
      mergeLeaked: Object.keys(S.noteSelectorMerge).length > 0,
      carrierLeaked: Object.keys(S.parentCarriers).length > 0,
      cardLeaked: Object.keys(S.controllerCards).length > 0,
      hiddenLeaked: Object.keys(S.objHidden).length > 0,
      lockedLeaked: S.lockedIds.size > 0
    };
  })()`);

  // 4) hard 加自己的独特功能：合并 note_controller
  await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'nc_h', note: { type: [0] }, time: 'intro:$note',
      states: [{ time: 'start:$note', opacity_multiplier: 0.7 }]
    });
    S.noteSelectorMerge['nc_h'] = true;
    S.controllerCards['ctl_h'] = ['camera_y'];
    return true;
  })()`);
  await sleep(300);
  prog('step4 save hard');
  await win.webContents.executeJavaScript(`window.__sb.saveStoryboard()`);
  await sleep(500);
  prog('step4 done');
  const cfgBoth = JSON.parse(fs.readFileSync(CTR, 'utf8'));
  const diffHard = cfgBoth.editor && cfgBoth.editor.difficulties &&
    cfgBoth.editor.difficulties['chart.hard.txt'];
  R.hardSaved = {
    hasHardBucket: !!diffHard,
    hardMerge: !!(diffHard && diffHard.noteSelectorMerge && diffHard.noteSelectorMerge['nc_h']),
    hardCards: !!(diffHard && diffHard.controllerCards && diffHard.controllerCards['ctl_h']),
    hardMeta: !!(diffHard && diffHard.noteSelectorMeta && Object.keys(diffHard.noteSelectorMeta).length),
    easyStillIntact: !!(cfgBoth.editor.difficulties['chart.easy.txt'] &&
      cfgBoth.editor.difficulties['chart.easy.txt'].noteSelectorMeta &&
      Object.keys(cfgBoth.editor.difficulties['chart.easy.txt'].noteSelectorMeta).length &&
      cfgBoth.editor.difficulties['chart.easy.txt'].parentCarriers &&
      cfgBoth.editor.difficulties['chart.easy.txt'].parentCarriers['parent_$note'])
  };

  // 5) 重开项目：分别选 easy / hard，验证各自还原、互不污染
  prog('step5 reopen');
  const res2 = await win.webContents.executeJavaScript(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  prog('step5 projectOpen ok: ' + !!res2);
  await win.webContents.executeJavaScript(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res2.info)}, { projectPath: ${JSON.stringify(res2.projectPath)}, config: ${JSON.stringify(res2.config)} });
    return true;
  })()`);
  await sleep(600);
  await win.webContents.executeJavaScript(`(() => {
    const pick = [...document.querySelectorAll('#modalBody .pick-item')].find((el) => el.textContent.indexOf('easy') >= 0);
    if (pick) pick.click();
    return true;
  })()`);
  await sleep(800);
  prog('step5 done');
  R.reopenEasy = await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    const spr = (S.storyboard.sprites || []).find((o) => o.id === 'spr_e');
    return {
      chart: S.chartPath,
      spriteRestored: !!spr,
      parentTemplate: spr && spr.parent_id,
      carrierRestored: !!(S.parentCarriers && S.parentCarriers['parent_$note']),
      mergeRestored: !!(S.noteSelectorMerge && S.noteSelectorMerge['spr_e']),
      cardsRestored: !!(S.controllerCards && S.controllerCards['ctl_e']),
      hiddenRestored: !!(S.objHidden && S.objHidden['spr_e']),
      lockedRestored: S.lockedIds && S.lockedIds.has('spr_e'),
      hardMetaAbsent: Object.keys(S.noteSelectorMeta).every((k) => k.indexOf('nc_h') < 0)
    };
  })()`);

  prog('step6 switch');
  await win.webContents.executeJavaScript(`(() => { window.__sb.switchDifficultyFlow(); return true; })()`);
  await sleep(600);
  await win.webContents.executeJavaScript(`(() => {
    const pick = [...document.querySelectorAll('#modalBody .pick-item')].find((el) => el.textContent.indexOf('hard') >= 0);
    if (pick) pick.click();
    return true;
  })()`);
  await sleep(800);
  prog('step6 picked hard');
  R.reopenHard = await win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    const nc = (S.storyboard.note_controllers || []).find((o) => o.id === 'nc_h');
    return {
      chart: S.chartPath,
      ncRestored: !!nc,
      mergeRestored: !!(S.noteSelectorMerge && S.noteSelectorMerge['nc_h']),
      cardsRestored: !!(S.controllerCards && S.controllerCards['ctl_h']),
      easyMetaAbsent: Object.keys(S.noteSelectorMeta).every((k) => k.indexOf('spr_e') < 0),
      easyCarrierAbsent: !(S.parentCarriers && S.parentCarriers['parent_$note'])
    };
  })()`);

  const out = { R };
  out.ok = !!(
    R.openEasy && R.openEasy.chart === 'chart.easy.txt' &&
    R.easySaved && R.easySaved.hasEasyBucket && R.easySaved.easyMeta && R.easySaved.easyCarrier &&
    R.easySaved.easyMerge && R.easySaved.easyCards && R.easySaved.easyHidden && R.easySaved.easyLocked &&
    R.easySaved.hardBucketAbsent &&
    R.hardState && R.hardState.chart === 'chart.hard.txt' &&
    !R.hardState.metaLeaked && !R.hardState.mergeLeaked && !R.hardState.carrierLeaked &&
    !R.hardState.cardLeaked && !R.hardState.hiddenLeaked && !R.hardState.lockedLeaked &&
    R.hardSaved && R.hardSaved.hasHardBucket && R.hardSaved.hardMerge && R.hardSaved.hardCards &&
    R.hardSaved.hardMeta && R.hardSaved.easyStillIntact &&
    R.reopenEasy && R.reopenEasy.spriteRestored && R.reopenEasy.parentTemplate === 'parent_$note' &&
    R.reopenEasy.carrierRestored && R.reopenEasy.mergeRestored && R.reopenEasy.cardsRestored &&
    R.reopenEasy.hiddenRestored && R.reopenEasy.lockedRestored && R.reopenEasy.hardMetaAbsent &&
    R.reopenHard && R.reopenHard.ncRestored && R.reopenHard.mergeRestored && R.reopenHard.cardsRestored &&
    R.reopenHard.easyMetaAbsent && R.reopenHard.easyCarrierAbsent
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('MDR:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
