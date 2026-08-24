// 复现：note 处于合并时间块内时，右键 note 的菜单/属性页现状。
// 场景 A：普通合并 note_controller（type [3,4]，merged）
// 场景 B：sprite 的合并 note 选择器块（sprite_1，merged）
// 场景 C：parent_$note 纯 ID 载体合并块
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mctx_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_mctx_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mctx_proj_'));
const CTR_PATH = path.join(TMP, 'MergedCtx.ctr');
const OUT = path.join(__dirname, 'probe_merged_note_ctx_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'MergedCtx',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    // 场景 A：普通合并 note_controller
    S.storyboard.note_controllers.push({
      id: 'nc_merge', note: { type: [3, 4] }, time: 'intro:$note',
      states: [{ time: 'start:$note', opacity_multiplier: 0.7 }]
    });
    S.noteSelectorMerge['nc_merge'] = true;
    // 场景 B：sprite 合并块
    S.storyboard.sprites.push({
      id: 'sprite_1', path: 'octa.png', time: 'intro:$note', note: { start: 0, end: 10 },
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.noteSelectorMerge['sprite_1'] = true;
    // 场景 C：parent_$note 载体合并块（走真实创建路径）
    S.storyboard.sprites.push({
      id: 'sprite_2', path: 'octa.png', time: 'intro:$note', parent_id: 'parent_$note',
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    // 场景 D：非 parent_$note 的合并块（合并 sprite，覆盖 note 15..25）
    S.storyboard.sprites.push({
      id: 'sprite_3', path: 'octa.png', time: 'intro:$note', note: { start: 15, end: 25 },
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [
        { time: 'start:$note', opacity: 0.5 },
        { time: 'intro:$note:-0.5', opacity: 0.3 } // 乱序：比 K0 更早
      ]
    });
    S.noteSelectorMerge['sprite_3'] = true;
    S.dirty = true;
    return true;
  })()`);

  // 场景 C：应用 note 选择器到 sprite_2 创建载体
  await win.webContents.executeJavaScript(`(() => {
    window.__sb.nsBridge('apply', [{ id: 'sprite_2', note: { start: 0, end: 10 }, merge: true }]);
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};
  // 右键某个 note，读取菜单项
  const ctxMenu = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const note = window.__sb.state.chart.noteById(0);
    pv.setTime(note.start_time, false);
    pv.render();
    const p = pv.notePos(note, info);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    const mk = (nid, label) => new Promise((resolve) => {
      const n = window.__sb.state.chart.noteById(nid);
      pv.setTime(n.start_time, false);
      pv.render();
      const pp = pv.notePos(n, info);
      cv.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true,
        clientX: cr.left + pp.x * (cr.width / cv.width),
        clientY: cr.top + pp.y * (cr.height / cv.height)
      }));
      setTimeout(() => {
        const items = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
        document.querySelector('#contextMenu').classList.add('hidden');
        resolve({ label, items });
      }, 150);
    });
    const dragId = window.__sb.state.chart.notes.find((n) => n.type === 3 || n.type === 4);
    const out = {};
    out.note0 = await mk(0, 'note0-click');
    out.drag = dragId ? await mk(dragId.id, 'drag-note') : null;
    return out;
  })()`);

  // 点击“单独编辑note…的note_controller”后：属性页 = 单独编辑页
  // （提示 + 关联 Note/Note ID + 合并块关键帧预览），首次修改生效后独立。
  R.afterCreateClick = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const note = window.__sb.state.chart.noteById(0);
    pv.setTime(note.start_time, false);
    pv.render();
    const pp = pv.notePos(note, info);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: cr.left + pp.x * (cr.width / cv.width),
      clientY: cr.top + pp.y * (cr.height / cv.height)
    }));
    await new Promise((r) => setTimeout(r, 150));
    const items = Array.from(document.querySelectorAll('#contextMenu .cm-item'));
    const create = items.find((el) => el.textContent.indexOf('创建note_controller') >= 0);
    const edit = items.find((el) => el.textContent.indexOf('编辑note') >= 0);
    const target = create || edit;
    if (!target) return { menu: items.map((el) => el.textContent) };
    target.click();
    await new Promise((r) => setTimeout(r, 400));
    const propText = (document.querySelector('#propBody') || {}).textContent || '';
    // Note ID 输入框（状态表单中的 “Note ID” 行）应为该 note 的 ID（0）
    const noteIdInput = Array.from(document.querySelectorAll('#stateForm .field'))
      .map((row) => ({ label: (row.querySelector('label') || {}).textContent || '', input: row.querySelector('input') }))
      .find((r) => r.label.indexOf('Note ID') >= 0);
    return {
      clicked: target.textContent,
      propText: propText.slice(0, 500),
      hintFound: !!propText.match(/该note位于合并时间块/),
      hintId: (propText.match(/合并时间块\\s*([A-Za-z0-9_$]+)/) || [])[1] || null,
      noteIdInputValue: noteIdInput && noteIdInput.input ? noteIdInput.input.value : null,
      mergedKfShown: propText.indexOf('合并时间块分配给该 note 的关键帧') >= 0
    };
  })()`);

  // 单独编辑页关键帧列表可编辑：有“在播放头添加关键帧”；点击后立即独立
  R.separateAfterEdit = await win.webContents.executeJavaScript(`(async () => {
    // 重新进入单独编辑页
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const note = window.__sb.state.chart.noteById(0);
    pv.setTime(note.start_time, false);
    pv.render();
    const pp = pv.notePos(note, info);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: cr.left + pp.x * (cr.width / cv.width),
      clientY: cr.top + pp.y * (cr.height / cv.height)
    }));
    await new Promise((r) => setTimeout(r, 150));
    const items = Array.from(document.querySelectorAll('#contextMenu .cm-item'));
    const edit = items.find((el) => el.textContent.indexOf('编辑note') >= 0);
    if (!edit) return { menu: items.map((el) => el.textContent) };
    edit.click();
    await new Promise((r) => setTimeout(r, 400));
    const before = window.__sb.state;
    const carrierBefore = (before.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    const carrierHad0 = !!(carrierBefore && carrierBefore.note && carrierBefore.note.includes(0));
    const addBtn = document.querySelector('#btnAddKf');
    if (!addBtn) return { noAddBtn: true };
    // 播放头拨到 note0 start + 1s，然后“在播放头添加关键帧”
    const n0 = window.__sb.state.chart.noteById(0);
    window.__sb.setTime(n0.start_time + 1, false);
    await new Promise((r) => setTimeout(r, 200));
    addBtn.click();
    await new Promise((r) => setTimeout(r, 500));
    const S = window.__sb.state;
    const carrierAfter = (S.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    const sep = (S.storyboard.note_controllers || []).find((o) => o.id === 'parent_0');
    return {
      addBtnShown: true,
      carrierHad0,
      carrierHas0After: !!(carrierAfter && carrierAfter.note && carrierAfter.note.includes(0)),
      independentCreated: !!sep,
      independentNote: sep && sep.note,
      independentKfTime: sep && sep.time,
      independentStates: (sep && sep.states || []).map((s) => s.time),
      propIsNormal: (document.querySelector('#propBody') || {}).textContent.indexOf('单独编辑') < 0,
      selectedObj: S.selectedObjId
    };
  })()`);

  // 场景 D：合并块 id 不是 parent_$note（合并 sprite_3）时，note 右键单独编辑
  R.nonCarrierBlock = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const note = window.__sb.state.chart.noteById(20);
    pv.setTime(note.start_time, false);
    pv.render();
    const pp = pv.notePos(note, info);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: cr.left + pp.x * (cr.width / cv.width),
      clientY: cr.top + pp.y * (cr.height / cv.height)
    }));
    await new Promise((r) => setTimeout(r, 150));
    const items = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
    const edit = items.find((el) => el.indexOf('编辑note') >= 0);
    if (!edit) return { items };
    [...document.querySelectorAll('#contextMenu .cm-item')]
      .find((el) => el.textContent.indexOf('编辑note') >= 0).click();
    await new Promise((r) => setTimeout(r, 400));
    const propText = (document.querySelector('#propBody') || {}).textContent || '';
    return {
      items,
      clicked: edit,
      pageOpened: propText.indexOf('单独编辑') >= 0,
      hintId: (propText.match(/合并时间块\\s*([A-Za-z0-9_$]+)/) || [])[1] || null,
      kfText: (document.querySelector('#keyList') || {}).textContent || null,
      hasAddBtn: !!document.querySelector('#btnAddKf')
    };
  })()`);

  // 场景 E：合并的多 note 选择器 note_controller（id 非 parent_$note，如
  // nc_merge）——右键其中的 note 也进入“单独编辑”页，而不是合并块整体页。
  R.mergedNcBlock = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const dragId = window.__sb.state.chart.notes.find((n) => n.type === 3 || n.type === 4);
    const note = window.__sb.state.chart.noteById(dragId.id);
    pv.setTime(note.start_time, false);
    pv.render();
    const pp = pv.notePos(note, info);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: cr.left + pp.x * (cr.width / cv.width),
      clientY: cr.top + pp.y * (cr.height / cv.height)
    }));
    await new Promise((r) => setTimeout(r, 150));
    const items = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
    const edit = items.find((el) => el.indexOf('编辑note') >= 0);
    if (!edit) return { items };
    [...document.querySelectorAll('#contextMenu .cm-item')]
      .find((el) => el.textContent.indexOf('编辑note') >= 0).click();
    await new Promise((r) => setTimeout(r, 400));
    const propText = (document.querySelector('#propBody') || {}).textContent || '';
    return {
      items,
      clicked: edit,
      isIndividualPage: propText.indexOf('单独编辑') >= 0,
      hintId: (propText.match(/合并时间块\\s*([A-Za-z0-9_$]+)/) || [])[1] || null
    };
  })()`);

  const out = { R, ctxMenu };
  out.ok = !!(
    ctxMenu && ctxMenu.note0 &&
    // note0 处于合并块内：菜单应显示“单独编辑…”，而不是“创建note_controller”
    ctxMenu.note0.items.some((t) => t.indexOf('单独编辑note0的note_controller') >= 0) &&
    !ctxMenu.note0.items.some((t) => t.indexOf('创建note_controller') >= 0) &&
    // 普通合并 note_controller 覆盖的 drag note：也应进入“单独编辑”页
    ctxMenu.drag && ctxMenu.drag.items.some((t) => t.indexOf('单独编辑note') >= 0) &&
    R.afterCreateClick && R.afterCreateClick.hintFound &&
    R.afterCreateClick.hintId === 'parent_$note' &&
    R.afterCreateClick.noteIdInputValue === '0' &&
    R.afterCreateClick.mergedKfShown &&
    R.separateAfterEdit.addBtnShown &&
    R.separateAfterEdit && R.separateAfterEdit.carrierHad0 &&
    R.separateAfterEdit.carrierHas0After === false &&
    R.separateAfterEdit.independentCreated &&
    R.separateAfterEdit.independentNote === 0 &&
    R.separateAfterEdit.independentStates.length >= 1 &&
    R.separateAfterEdit.propIsNormal &&
    R.nonCarrierBlock && R.nonCarrierBlock.pageOpened &&
    R.nonCarrierBlock.hintId === 'sprite_3' &&
    R.nonCarrierBlock.hasAddBtn &&
    R.nonCarrierBlock.kfText && R.nonCarrierBlock.kfText.indexOf('intro:$note') >= 0 &&
    R.nonCarrierBlock.kfText.indexOf('start:$note') >= 0 &&
    // 乱序状态按时间正序：intro:$note:-0.5（更早）应排在 K0（intro:$note）之前
    R.nonCarrierBlock.kfText.indexOf('intro:$note:-0.5') < R.nonCarrierBlock.kfText.indexOf('K0intro:$note') &&
    R.mergedNcBlock && R.mergedNcBlock.isIndividualPage &&
    R.mergedNcBlock.hintId === 'nc_merge' &&
    R.mergedNcBlock.items.some((t) => t.indexOf('单独编辑note') >= 0)
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('MERGED_CTX:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
