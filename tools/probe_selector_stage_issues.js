// 复现三项报告：
//  1) 新建项目 level.json 的难度类型（应只允许 easy/hard/extreme）
//  2) stage 对象带 note 选择器时，属性面板关键帧列表应显示表达式形式
//  3) $note 自动载体（parent_$note）二次编辑 / 重开后与 sprite 绑定关系
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_selstage_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_selstage_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_selstage_proj_'));
const CTR_PATH = path.join(TMP, 'SelStage.ctr');
const CTR_EASY = path.join(TMP, 'SelEasy.ctr');
const OUT = path.join(__dirname, 'probe_selector_stage_issues_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));
  const consoleLogs = [];
  win.webContents.on('console-message', (e, level, message) => {
    consoleLogs.push({ level, message: String(message).slice(0, 1200) });
  });

  const R = {};
  const step = async (name, fn) => {
    try { R[name] = await fn(); }
    catch (e) { R[name] = { stepError: String(e && e.stack || e) }; }
  };

  // --- 1) 新建项目：level.json 难度类型 ---
  await step('created', () => win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'SelStage',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    await new Promise((r) => setTimeout(r, 1200));
    return { projectPath: res.projectPath };
  })()`));
  const lv = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  R.levelJson = {
    chartType: lv.charts && lv.charts[0] && lv.charts[0].type,
    stdType: ['easy', 'hard', 'extreme'].includes(lv.charts && lv.charts[0] && lv.charts[0].type)
  };

  // 选择 easy 时也要落成 easy（三种固定形式都可用）
  await step('easyCreated', () => win.webContents.executeJavaScript(`(async () => {
    await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_EASY)},
      name: 'SelEasy',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null,
      chartType: 'easy'
    });
    return true;
  })()`));
  const lvEasy = JSON.parse(fs.readFileSync(path.join(TMP, 'level.json'), 'utf8'));
  R.levelEasy = {
    chartType: lvEasy.charts && lvEasy.charts[0] && lvEasy.charts[0].type,
    stdType: ['easy', 'hard', 'extreme'].includes(lvEasy.charts && lvEasy.charts[0] && lvEasy.charts[0].type)
  };

  // --- 构造 sprite + $note 载体（与 EffectsTest 同款） ---
  await step('setup', () => win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.controllerCards = {};
    S.parentCarriers = {};
    S.noteSelectorMeta = {};
    S.noteSelectorMerge = {};
    const spr = {
      id: 'sprite_1', path: 'octa.png', time: 'intro:$note',
      parent_id: 'parent_$note',
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    };
    S.storyboard.sprites.push(spr);
    S.dirty = true;
    return true;
  })()`));

  // 走真实应用路径应用 note 选择器（nsApply → ensureNoteSelectorParent 自动
  // 创建 parent_$note 载体，应默认合并时间块）。
  await step('applyPath', () => win.webContents.executeJavaScript(`(async () => {
    const r = window.__sb.nsBridge('apply', [{ id: 'sprite_1', note: { start: 0, end: 10 }, merge: true }]);
    await new Promise((res) => setTimeout(res, 400));
    const S = window.__sb.state;
    const carrier = (S.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    return {
      applied: r && r.ok,
      carrierCreated: !!carrier,
      carrierNotes: carrier ? carrier.note.length : null,
      carrierMerged: !!carrier && S.noteSelectorMerge['parent_$note'] === true,
      parentCarrierFlag: S.parentCarriers['parent_$note'] === true
    };
  })()`));

  // --- 2) sprite 关键帧列表（应显示表达式形式） ---
  await step('spriteKfList', () => win.webContents.executeJavaScript(`(async () => {
    window.__sb.selectObject('sprite_1', null);
    await new Promise((r) => setTimeout(r, 400));
    const kf = document.getElementById('keyList');
    return {
      html: kf ? kf.textContent : null,
      hasExprLabel: !!(kf && kf.textContent.indexOf('表达式') >= 0),
      hasIntroToken: !!(kf && kf.textContent.indexOf('intro:$note') >= 0),
      hasStartToken: !!(kf && kf.textContent.indexOf('start:$note') >= 0)
    };
  })()`));

  // --- 3a) 载体（合并时间块）添加关键帧后时间轴是否反应 ---
  await step('carrierEdit', () => win.webContents.executeJavaScript(`(async () => {
    const before = window.__sb.timeline.objects
      .filter((o) => String(o.id).indexOf('parent') === 0 || String(o.id) === 'parent_$note')
      .map((o) => ({ id: o.id, kfs: (o.keyframes || []).map((k) => k.time) }));
    window.__sb.selectObject('parent_$note', null);
    await new Promise((r) => setTimeout(r, 300));
    const sel = {
      selectedObjId: window.__sb.state.selectedObjId,
      merged: window.__sb.state.noteSelectorMerge['parent_$note'] === true,
      keyList: document.getElementById('keyList') ? document.getElementById('keyList').textContent : null
    };
    window.__sb.setTime(50, false);
    await new Promise((r) => setTimeout(r, 200));
    const btn = document.getElementById('btnAddKf');
    btn.click();
    await new Promise((r) => setTimeout(r, 400));
    const carrier = window.__sb.state.storyboard.note_controllers.find((o) => o.id === 'parent_$note');
    const after = window.__sb.timeline.objects
      .filter((o) => String(o.id).indexOf('parent') === 0 || String(o.id) === 'parent_$note')
      .map((o) => ({ id: o.id, kfs: (o.keyframes || []).map((k) => k.time) }));
    return {
      before,
      sel,
      carrierStates: (carrier.states || []).map((s) => s.time),
      after,
      has50: after.some((o) => (o.kfs || []).some((t) => Math.abs(t - 50) < 1e-6))
    };
  })()`));

  // --- 3a2) 载体默认合并时间块 ---
  await step('carrierMerged', () => win.webContents.executeJavaScript(`(() => {
    const entries = window.__sb.timeline.objects.filter((o) => String(o.id).indexOf('parent') === 0);
    return {
      entryIds: entries.map((o) => o.id),
      mergedFlag: window.__sb.state.noteSelectorMerge['parent_$note'] === true,
      singleMergedEntry: entries.length === 1 && entries[0].mergedSelector === true
    };
  })()`));

  // --- 3c) 真实 note_controller 接管载体 note 的二次编辑 ---
  await step('handoff', () => win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    // 通过应用真实入口创建 note 5 的控制器：应得到载体的具体展开 id（parent_5）
    // 并把 note 5 从合并时间块中分离（载体不再覆盖 5），不产生同 id 双对象。
    const real = window.__sb.createNoteControllerWithIdHandoff([5], 10);
    await new Promise((r) => setTimeout(r, 300));
    const carrier = S.storyboard.note_controllers.find((o) => o.id === 'parent_$note');
    const ids = S.storyboard.note_controllers.map((o) => o.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    const realEntry = window.__sb.timeline.objects.find((o) => o.id === real.id);
    // 选中真实控制器并添加关键帧
    window.__sb.selectObject(real.id, null);
    await new Promise((r) => setTimeout(r, 300));
    window.__sb.setTime(60, false);
    await new Promise((r) => setTimeout(r, 200));
    const btn = document.getElementById('btnAddKf');
    btn.click();
    await new Promise((r) => setTimeout(r, 400));
    const realAfter = window.__sb.state.storyboard.note_controllers.find((o) => o.id === real.id);
    const realTimelineAfter = window.__sb.timeline.objects.find((o) => o.id === real.id);
    return {
      realId: real.id,
      concreteId: real.id === 'parent_5',
      notTemplateId: real.id !== 'parent_$note',
      carrierNoteCount: (carrier.note || []).length,
      carrierHas5: (carrier.note || []).includes(5),
      duplicateIds: dup,
      realNote: realAfter && realAfter.note,
      realStates: (realAfter && realAfter.states || []).map((s) => s.time),
      realTimelineKfs: realTimelineAfter ? (realTimelineAfter.keyframes || []).map((k) => k.time) : null,
      has60OnReal: !!(realTimelineAfter && (realTimelineAfter.keyframes || []).some((k) => Math.abs(k.time - 60) < 1e-6)),
      carrierMergedAfter: window.__sb.state.noteSelectorMerge['parent_$note'] === true
    };
  })()`));

  // --- 3b) 保存后重开项目：parent_$note 与 sprite 的绑定 ---
  await step('saveBeforeReopen', () => win.webContents.executeJavaScript(`(async () => {
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    await new Promise((r) => setTimeout(r, 500));
    return { ok, err };
  })()`));

  await step('reopen', () => win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR_PATH)} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    await new Promise((r) => setTimeout(r, 1500));
    const S = window.__sb.state;
    const spr = (S.storyboard.sprites || []).find((o) => o.id === 'sprite_1');
    const carriers = (S.storyboard.note_controllers || []).filter((o) => String(o.id).indexOf('parent') === 0);
    const real = (S.storyboard.note_controllers || []).find((o) => o.id !== 'parent_$note' && o.note === 5);
    const allIds = (S.storyboard.note_controllers || []).map((o) => o.id);
    const tlIds = window.__sb.timeline.objects.map((o) => o.id);
    return {
      spriteExists: !!spr,
      spriteParentId: spr && spr.parent_id,
      spriteNote: spr && spr.note,
      carriers: carriers.map((c) => ({ id: c.id, noteCount: Array.isArray(c.note) ? c.note.length : null, note: c.note, states: (c.states || []).length })),
      realNote5: real ? { id: real.id, note: real.note, states: (real.states || []).map((s) => s.time) } : null,
      realTime: real ? real.time : null,
      realTimelineKfs: real ? (window.__sb.timeline.objects.find((o) => o.id === real.id) || {}).keyframes : null,
      duplicateIds: allIds.filter((x, i) => allIds.indexOf(x) !== i),
      tlParentEntries: tlIds.filter((i) => String(i).indexOf('parent') === 0).slice(0, 8),
      tlSpriteEntries: tlIds.filter((i) => String(i).indexOf('sprite') === 0).slice(0, 3)
    };
  })()`));

  const out = { R, consoleLogs };
  out.ok = !!(
    R.levelJson && R.levelJson.stdType &&
    R.levelEasy && R.levelEasy.stdType &&
    R.spriteKfList && R.spriteKfList.hasExprLabel &&
    R.applyPath && R.applyPath.carrierCreated && R.applyPath.carrierMerged && R.applyPath.parentCarrierFlag &&
    R.carrierMerged && R.carrierMerged.singleMergedEntry &&
    R.handoff && R.handoff.concreteId && R.handoff.duplicateIds.length === 0 &&
    R.handoff.has60OnReal && R.handoff.carrierMergedAfter &&
    R.reopen && R.reopen.spriteParentId === 'parent_$note' && R.reopen.realTime === 60 &&
    R.reopen.duplicateIds.length === 0
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SEL_STAGE:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
