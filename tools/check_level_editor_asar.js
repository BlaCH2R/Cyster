// Verify the win-unpacked asar carries the level-editor changes.
const fs = require('fs');
const path = require('path');
const asarPath = path.join(__dirname, '..', 'app', 'dist', 'win-unpacked', 'resources', 'app.asar');
const asar = require(path.join(__dirname, '..', 'app', 'node_modules', '@electron', 'asar'));
const list = asar.listPackage(asarPath);
const get = (suffix) => {
  const hit = list.find((p) => p.replace(/\\/g, '/').endsWith(suffix));
  if (!hit) { console.error(suffix + ' not found in asar'); process.exit(1); }
  return asar.extractFile(asarPath, hit.replace(/^\\/, '')).toString('utf8');
};
const main = get('main.js');
const pre = get('preload.js');
const appjs = get('renderer/app.js');
const schema = get('renderer/schema.js');
const tool = get('renderer/note_selector_tool.js');
const timeline = get('renderer/timeline.js');
const css = get('renderer/styles.css');
const out = {
  mainIpc: main.includes('project:apply-level'),
  difficultyClamp: main.includes('Math.min(16'),
  projectDirDefault: main.includes('currentProjectDir') && main.includes('setCurrentProjectDir'),
  nsWindowMinSize: main.includes('width: 360,') && main.includes('height: 460,'),
  preloadApi: pre.includes('applyLevel'),
  rendererUi: appjs.includes('leSave') && appjs.includes('le-tab') && appjs.includes('reload-level') && appjs.includes('difficultyDisplayLabel'),
  clearKfTime: appjs.includes('清空时间输入框 = 删除该关键帧'),
  unitFromJsonObject: schema.includes('typeof jsonVal === \'object\'') && schema.includes('jsonVal.unit || defaultUnit'),
  switchCancelStays: appjs.includes('取消：只关闭选择框'),
  mojibakeFixed: appjs.includes('记录 StoryBoard 文件失败'),
  thumbFastPath: appjs.includes('Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0))'),
  unitConvertToast: appjs.includes('单位换算失败：无法保持当前位置'),
  inlineConfirm: appjs.includes('leConfirmSave'),
  multiCtrlKfMerge: appjs.includes('多选关键帧：各字段值不一致时合并为“多个数值”'),
  multiCtrlCardState: schema.includes('cb.indeterminate = multiToggle') && schema.includes('head.draggable = !multi'),
  noteInputBind: appjs.includes('选择器浮窗打开时点击即绑定该对象'),
  nsMergeDefault: tool.includes('ctx.target ? !!(ctx.target.merge) : true'),
  nsNoInitialTypes: tool.includes('初始不做任何类型勾选'),
  nsListHighlight: tool.includes('Array.isArray(ctx.target.note)') && tool.includes("ids = (ctx.target.note || []).map"),
  nsStageNoteInput: main.includes('tool:ns-window-state') && pre.includes('nsOnWindowState') &&
    appjs.includes('state.nsWindowOpen && isStageObj'),
  laneRowSelected: timeline.includes("row.className = 'tlh-lane' + (selected ? ' selected' : '')") &&
    timeline.includes("row.className = 'lane-row' + (selected ? ' selected' : '')"),
  shiftBlockRotation: appjs.includes('连续 order 合并为块') && appjs.includes('触发互换——把该对象顶到块的另一端'),
  laneRowOutlineOnly: css.includes('.lane-row.selected {') && css.includes('outline: 1px solid var(--accent);') &&
    css.includes('.tlh-lane.selected .lane-label'),
  timePrecision: appjs.includes('function normalizeTimeInput') && appjs.includes('Math.round(value * 1000) / 1000') &&
    appjs.includes('纯数字字符串直接解析') && appjs.includes('note.start_time.toFixed(3)'),
  nsCreateButton: appjs.includes('noCtrl = selNoteIds.length === 1 && !sharedNc') &&
    appjs.includes('创建note_controller') && appjs.includes('openPendingNoteController(selNoteIds[0])'),
  nsNewSelectorMerge: appjs.includes('新选择器（未绑定对象）默认合并时间块开启') &&
    tool.includes('m.merge !== undefined') && tool.includes('lastBoundId = undefined;'),
  cloneMergedFlag: appjs.includes('克隆合并时间块：合并标记跟随克隆体') &&
    appjs.includes('粘贴合并时间块：合并标记跟随克隆体'),
  unitAutodetect: schema.includes('input.inputMode = \'decimal\'') &&
    schema.includes('unitOptions.some((o) => o.value === unit)') &&
    appjs.includes('显式带坐标系前缀（如 notex:0.8）：按指定坐标系直接写入，不换算'),
  linePosUnits: schema.includes('__posUnitChange') && schema.includes("units: { x: 'notex', y: 'notey', z: 'world' }") &&
    schema.includes('function parseUnitInput') && appjs.includes('function convertUnitScalar') &&
    appjs.includes('line 端点轴单位切换'),
  linePosAxisRows: schema.includes("axisRow.className = 'pos-axis'") && schema.includes('pos-point-head') &&
    css.includes('.pos-item .pos-axis'),
  lostNoteMarking: appjs.includes('function noteMappingLost') && appjs.includes('function scanLostNoteMappings') &&
    appjs.includes('检测到谱面变更') && timeline.includes("clip.classList.add('invalid-note')") &&
    css.includes('.clip.invalid-note') && css.includes('.field input.invalid-note'),
  chartChangeInSettings: main.includes('config.editor.difficulties[chart.path] = config.editor.difficulties[oldChart]') &&
    main.includes('function writeProjectConfig(cfgPath, name, files, editor)') &&
    appjs.includes('cfg.files.storyboard) || \'\'') &&
    timeline.includes("clip.classList.add('invalid-note')"),
  shiftedNoteDetect: appjs.includes('function noteSigFromChart') && appjs.includes('function computeChartShiftedNotes') &&
    appjs.includes('function noteShifted') && appjs.includes('失效或受影响') &&
    appjs.includes('noteShifted(nid)'),
  shiftOverlapOnly: appjs.includes('function spansOverlap') &&
    appjs.includes('占用位置”判定') && appjs.includes('无时间重叠 = 位置空缺 → 自由移动，不触发互换'),
  mergedBlockShift: appjs.includes('tl.trackGroups.note_controller = lanes.filter((l) => l.length).map((l) => l.slice())') &&
    appjs.includes('重叠对象被顶回原轨'),
  noteLaneOverlap: appjs.includes('const kfs = objectKeyframesAllNotes(obj);') &&
    appjs.includes('选择器/合并状态变化后，note_controller 轨道的占用区间可能改变') &&
    appjs.includes('resolveAllLaneOverlaps([draft.id]);'),
  stageMergedOverlap: appjs.includes('带对象级 note 选择器/$note 时间的对象（含合并时间块）') &&
    appjs.includes('const sp = objectTimeSpan(entry.obj);'),
  audioFormats: appjs.includes("'mp3', 'ogg', 'wav', 'wma', 'aac', 'acc'"),
  schemaFixed2: appjs.includes('格式版本（schema_version）固定为 2') && appjs.includes('schema_version: 2'),
  omitEmptyLocalized: main.includes("for (const k of ['title_localized', 'artist_localized', 'artist_source', 'illustrator_localized', 'illustrator_source'])") &&
    main.includes("if (String(v).trim() !== '')"),
  ncBlockShiftDrag: appjs.includes('function moveNoteBlockLane') && appjs.includes('重叠对象被顶回原轨'),
  noDifficultyHelpText: !appjs.includes('难度类型固定为 easy'),
  restorePushMergedSpan: appjs.includes('return objectTimeSpan(e.obj);') &&
    appjs.includes('避免被顶回的'),
  switchNoFalsePositive: appjs.includes('const prevSig = bucketSig || null;') &&
    appjs.includes('避免跨项目/跨难度切换'),
  nsEditControllerBtn: appjs.includes("singleWithNc ? '编辑note_controller'") &&
    appjs.includes('openNoteInMergedBlock(nid, sharedNc)'),
  styles: css.includes('modal-wide') && css.includes('le-issues')
};
out.ok = out.mainIpc && out.difficultyClamp && out.projectDirDefault && out.preloadApi && out.rendererUi &&
  out.nsWindowMinSize &&
  out.clearKfTime && out.unitFromJsonObject && out.switchCancelStays && out.mojibakeFixed &&
  out.thumbFastPath && out.unitConvertToast && out.inlineConfirm && out.multiCtrlKfMerge &&
  out.multiCtrlCardState && out.noteInputBind && out.nsMergeDefault && out.nsNoInitialTypes &&
  out.nsListHighlight && out.nsStageNoteInput && out.laneRowSelected && out.shiftBlockRotation &&
  out.laneRowOutlineOnly && out.timePrecision && out.nsCreateButton && out.nsNewSelectorMerge &&
  out.cloneMergedFlag && out.unitAutodetect && out.linePosUnits && out.linePosAxisRows &&
  out.lostNoteMarking && out.chartChangeInSettings && out.shiftedNoteDetect &&
  out.shiftOverlapOnly && out.mergedBlockShift && out.noteLaneOverlap &&
  out.stageMergedOverlap && out.audioFormats && out.schemaFixed2 &&
  out.omitEmptyLocalized && out.ncBlockShiftDrag && out.noDifficultyHelpText &&
  out.restorePushMergedSpan && out.switchNoFalsePositive && out.nsEditControllerBtn && out.styles;
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
