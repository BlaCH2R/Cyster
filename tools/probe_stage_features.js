// Verify the batch of editor features:
//  1. preview drag auto-snap (grid alignment) for stage objects;
//  2. multi-select same-type property details with "多个数值" for differing
//     fields and batch editing of shared fields;
//  3. timeline left-drag marquee box-selection of clips / keyframes;
//  4. stage supergroup (sprite/text/line/video), order-sorted lanes, vertical
//     reorder updating storyboard order, manual 整理轨道, and _cyster merge
//     persistence through the .str round trip.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_stage_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_stage_');
const DROP_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_drop_')), 'drop.png');
fs.writeFileSync(DROP_FILE, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
));
// Cyster 可视化数据（合并轨道 / order 锁定）应写入 .ctr 项目文件，而非 storyboard。
const TMP_CTR = path.join(os.tmpdir(), 'probe_stage_' + Date.now() + '.ctr');
fs.writeFileSync(TMP_CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project',
  version: 2,
  name: 'probe',
  files: { chart: 'chart.txt', music: 'music.ogg' },
  editor: {}
}));

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try {
      const level = typeof e === 'object' ? e.level : e;
      const message = typeof e === 'object' ? e.message : '';
      if (level >= 2 || /error/i.test(message)) console.log('RENDERER:', message);
    } catch (err) {}
  });
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));

  const out = { checks: [], ok: true };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const preview = window.__sb.preview;
    const SB = window.SBEngine;
    const TMP_CTR = ${JSON.stringify(TMP_CTR)};
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const canvas = document.getElementById('previewCanvas');
    const toClient = (px, py) => {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + px / canvas.width * rect.width, y: rect.top + py / canvas.height * rect.height };
    };
    const unit = (v, def) => {
      if (v == null) return { value: 0, unit: def };
      if (typeof v === 'number') return { value: v, unit: def };
      const s = String(v);
      const i = s.indexOf(':');
      return i < 0 ? { value: parseFloat(s) || 0, unit: def } : { value: parseFloat(s.slice(i + 1)) || 0, unit: s.slice(0, i).toLowerCase() };
    };
    const drag = (pFrom, pTo) => {
      const a = toClient(pFrom.x, pFrom.y);
      const b = toClient(pTo.x, pTo.y);
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: a.x, clientY: a.y }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: b.x, clientY: b.y }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: b.x, clientY: b.y }));
    };
    const setSb = (storyboard) => {
      S.storyboard = storyboard;
      window.__sb.refreshAll();
      window.__sb.setTime(0);
    };
    // Cyster 可视化数据写入 .ctr 项目文件（而非 storyboard._cyster）。
    S.projectPath = TMP_CTR;
    S.projectConfig = { format: 'cytoid-storyboarder-project', version: 2, name: 'probe', files: { chart: 'chart.txt', music: 'music.ogg' }, editor: {} };

    // ------------------------------------------------------------
    // 1) 图片/文字拖拽自动对齐吸附
    // ------------------------------------------------------------
    let spSnap = { id: 'spSnap', time: 0, path: 'title.png', x: 'stagex:100', y: 'stagey:100', width: 60, height: 60, opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spSnap], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(150);
    const W = canvas.width, H = canvas.height;
    const cellX = Math.max(8, Math.round(W / 16));
    const cellY = Math.max(8, Math.round(H / 12));
    const cellX2 = Math.max(20, Math.round(W / 16));
    const cellY2 = Math.max(20, Math.round(H / 12));
    const centerPx = preview.stageOriginPx(spSnap, spSnap, preview.ctxInfo(), unit('stagex:100', 'stagex'), unit('stagey:100', 'stagey'));
    // 目标取“距网格线 3px”的位置 -> 应吸附到网格（cell=20，阈值 5）
    const nearGrid = (v, cell) => {
      const g = Math.round(v / cell) * cell;
      return Math.abs(v - g) > 5 ? g + 3 : g + cell + 3;
    };
    const targetSnap = { x: nearGrid(centerPx.x, cellX2), y: nearGrid(centerPx.y, cellY2) };
    S.pickMode = 'sprite';
    drag(centerPx, targetSnap);
    await sleep(120);
    const afterSnap = preview.stageOriginPx(spSnap, spSnap, preview.ctxInfo(), unit(spSnap.x, 'stagex'), unit(spSnap.y, 'stagey'));
    out.snap = {
      raw: { x: spSnap.x, y: spSnap.y },
      center: afterSnap,
      onGridX: Math.abs(afterSnap.x - Math.round(afterSnap.x / cellX2) * cellX2) < 0.5,
      onGridY: Math.abs(afterSnap.y - Math.round(afterSnap.y / cellY2) * cellY2) < 0.5,
      target: targetSnap
    };
    // 从吸附点再拖 7px（> 阈值 5，且离两侧网格线均 >5px）-> 不吸附
    const far = { x: afterSnap.x + 7, y: afterSnap.y + 7 };
    drag(afterSnap, far);
    await sleep(120);
    const afterFar = preview.stageOriginPx(spSnap, spSnap, preview.ctxInfo(), unit(spSnap.x, 'stagex'), unit(spSnap.y, 'stagey'));
    out.noSnap = {
      moved: Math.hypot(afterFar.x - afterSnap.x, afterFar.y - afterSnap.y),
      distX: Math.abs(afterFar.x - Math.round(afterFar.x / cellX2) * cellX2),
      distY: Math.abs(afterFar.y - Math.round(afterFar.y / cellY2) * cellY2)
    };

    // ------------------------------------------------------------
    // 2) 多选同类型对象属性详情（多个数值）
    // ------------------------------------------------------------
    let spA = { id: 'spA', time: 0, path: 'title.png', x: 'stagex:100', y: 'stagey:100', opacity: 1, layer: 1, order: 0, easing: 'linear' };
    let spB = { id: 'spB', time: 0, path: 'title.png', x: 'stagex:200', y: 'stagey:200', opacity: 1, layer: 1, order: 1, easing: 'easeinquad' };
    setSb({ sprites: [spA, spB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spA', 'spB'];
    S.selectedObjId = 'spA';
    const multiDiag = { ids: S.selectedIds.slice(), kfs: (S.selectedKfs || []).length };
    window.__sb.refreshAll();
    await sleep(150);
    out.multi = {
      diag: multiDiag,
      summary: document.querySelector('#propBody') ? document.querySelector('#propBody').textContent.includes('已选择 2 个') : false,
      form: !!document.querySelector('#propBody #stateForm'),
      multiValues: (() => {
        const els = Array.from(document.querySelectorAll('#propBody #stateForm input, #propBody #stateForm select, #propBody #stateForm textarea'));
        return els.filter((el) => {
          if (el.value === '多个数值' || el.placeholder === '多个数值') return true;
          if (el.tagName === 'SELECT' && el.options[el.selectedIndex] && el.options[el.selectedIndex].textContent === '（多个数值）') return true;
          return false;
        }).length;
      })(),
      dupLabels: Array.from(document.querySelectorAll('#propBody #stateForm .field'))
        .filter((f) => f.querySelectorAll('label').length > 1).length,
      opacityValue: (() => {
        const inps = Array.from(document.querySelectorAll('#propBody #stateForm input[type=number]'));
        const op = inps.find((i) => i.value === '1');
        return op ? op.value : null;
      })()
    };
    // 编辑一致字段（preserve_aspect 复选框）批量应用
    const cbs = Array.from(document.querySelectorAll('#propBody #stateForm input[type=checkbox]'));
    const cb = cbs.length ? cbs[cbs.length - 1] : null; // 最后一个复选框 = preserve_aspect
    if (cb) {
      cb.click();
      await sleep(120);
    }
    out.multi.applyAll = { a: spA.preserve_aspect === true, b: spB.preserve_aspect === true, checkboxCount: cbs.length };
    // 多个数值字段仍可输入：X 输入 123 → 统一
    const xRow = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('X'); });
    const unitInp = xRow ? xRow.querySelector('input') : null;
    if (unitInp) {
      unitInp.value = '123';
      unitInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.multi.unify = { a: spA.x, b: spB.x };
    // 缓动类型选项也允许统一输入
    const easingRow = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('缓动'); });
    const easingSel = easingRow ? easingRow.querySelector('select') : null;
    if (easingSel) {
      easingSel.value = 'linear';
      easingSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.multi.unifyEasing = { a: spA.easing, b: spB.easing };
    // 缓动批量修改（相同值场景）：两个对象均未设置缓动时选择也统一
    let spE1 = { id: 'spE1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let spE2 = { id: 'spE2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    setSb({ sprites: [spE1, spE2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spE1', 'spE2'];
    S.selectedObjId = 'spE1';
    window.__sb.refreshAll();
    await sleep(150);
    const easingRowE = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('缓动'); });
    const easingSelE = easingRowE ? easingRowE.querySelector('select') : null;
    if (easingSelE) {
      easingSelE.value = 'linear';
      easingSelE.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.multi.unifyEasingSame = { a: spE1.easing, b: spE2.easing };

    // ------------------------------------------------------------
    // 3) 时间轴左键框选时间块 / 关键帧
    // ------------------------------------------------------------
    let spC1 = { id: 'spC1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2 }] };
    let spC2 = { id: 'spC2', time: 5, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 7 }] };
    let txM = { id: 'txM', time: 10, text: 'Hi', opacity: 1, layer: 1, order: 2 };
    setSb({ sprites: [spC1, spC2], texts: [txM], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(150);
    window.__sb.timeline.setZoom(200);
    await sleep(150);
    const lanes = document.getElementById('lanes');
    const clip1 = document.querySelector('.clip[data-id="spC1"]');
    const clip2 = document.querySelector('.clip[data-id="spC2"]');
    const r1 = clip1.getBoundingClientRect();
    const r2 = clip2.getBoundingClientRect();
    const lr = lanes.getBoundingClientRect();
    const rows = Array.from(document.querySelectorAll('#lanes .lane-row'));
    const lastRowR = rows[rows.length - 1].getBoundingClientRect();
    const firstRowR = rows[0].getBoundingClientRect();
    const mStart = { x: lr.left + 191, y: lastRowR.top + 8 };
    const mEnd = { x: Math.max(r1.right, r2.right) + 4, y: firstRowR.top + 2 };
    out.marquee = {};
    out.marquee.debug = {
      r1: { l: r1.left, r: r1.right, t: r1.top, b: r1.bottom },
      r2: { l: r2.left, r: r2.right, t: r2.top, b: r2.bottom },
      lanes: { l: lr.left, r: lr.right, t: lr.top, b: lr.bottom },
      start: mStart, end: mEnd,
      elemAtStart: document.elementFromPoint(mStart.x, mStart.y) ? document.elementFromPoint(mStart.x, mStart.y).className : ''
    };
    // 从轨道空白处开始，拖一个覆盖两个 clip 的框
    lanes.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: mStart.x, clientY: mStart.y }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: mStart.x + 30, clientY: mStart.y + 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: mEnd.x, clientY: mEnd.y }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: mEnd.x, clientY: mEnd.y }));
    await sleep(150);
    out.marquee.ids = S.selectedIds.slice();
    out.marquee.marqueeEl = !!document.querySelector('.tl-marquee');
    // 右键（contextmenu 前置 mousedown）不应清除框选出的多选结果。
    const lanesR2 = document.getElementById('lanes').getBoundingClientRect();
    document.getElementById('lanes').dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, button: 2, clientX: lanesR2.left + 300, clientY: lanesR2.top + 5
    }));
    await sleep(80);
    out.marquee.afterRightClick = S.selectedIds.slice();

    // ------------------------------------------------------------
    // 4) Stage 大类 / order 排序 / 垂直换轨 / 整理轨道 / _cyster 持久化
    // ------------------------------------------------------------
    S.selectedIds = [];
    let spO1 = { id: 'spO1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2 };
    let spO2 = { id: 'spO2', time: 3, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let txO = { id: 'txO', time: 6, text: 'A', opacity: 1, layer: 1, order: 1 };
    let lnO = { id: 'lnO', time: 9, opacity: 1, layer: 1, order: 3, pos: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };
    setSb({ sprites: [spO1, spO2], texts: [txO], videos: [], lines: [lnO], controllers: [], note_controllers: [], templates: {} });
    await sleep(150);
    const stageHeader = Array.from(document.querySelectorAll('.group-header')).find((h) => h.textContent.includes('Stage'));
    out.stage = {
      hasStageHeader: !!stageHeader,
      laneNames: Array.from(document.querySelectorAll('#tlHeader .lane-label .nm')).map((n) => n.textContent),
      laneCount: document.querySelectorAll('#lanes .lane-row').length
    };
    // 垂直拖动 spO1（order 2）到第一条轨道 -> order 变为 0
    const clipO1 = document.querySelector('.clip[data-id="spO1"]');
    const cr = clipO1.getBoundingClientRect();
    const firstRow = document.querySelectorAll('#lanes .lane-row')[0].getBoundingClientRect();
    clipO1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: cr.left + 8, clientY: cr.top + 8 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: cr.left + 8, clientY: cr.top + 8 + 20 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: cr.left + 8, clientY: firstRow.top + 5 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: cr.left + 8, clientY: firstRow.top + 5 }));
    await sleep(200);
    out.reorder = {
      orders: { spO1: spO1.order, spO2: spO2.order, txO: txO.order, lnO: lnO.order },
      laneNames: Array.from(document.querySelectorAll('#tlHeader .lane-label .nm')).map((n) => n.textContent)
    };
    // 点击“整理轨道”
    const btn = document.getElementById('btnOrganizeTracks');
    btn.click();
    await sleep(300);
    const tlEd = S.projectConfig.editor && S.projectConfig.editor.timeline;
    const exported = JSON.parse(window.__sb.storyboardCompiledJson());
    out.organize = {
      trackGroups: tlEd && tlEd.trackGroups ? tlEd.trackGroups.stage : null,
      exportedHasCyster: !!exported._cyster,
      laneCount: document.querySelectorAll('#lanes .lane-row').length
    };
    // 从 .ctr 项目文件恢复：重新套用 editor.timeline 后刷新时间轴。
    const savedTl = JSON.parse(JSON.stringify(tlEd || {}));
    S.projectConfig.editor = { timeline: savedTl };
    window.__sb.refreshAll();
    await sleep(220);
    out.organize.reloadedLaneCount = document.querySelectorAll('#lanes .lane-row').length;
    // 同一合并轨道内的对象 order 必须相同。
    const rawById = (id) => {
      for (const g of ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers']) {
        const o = (S.storyboard[g] || []).find((x) => x.id === id);
        if (o) return o;
      }
      return null;
    };
    const sameLaneOrders = (out.organize.trackGroups || []).map((lane) => {
      const orders = lane
        .map((id) => { const o = rawById(id); return o ? o.order : null; })
        .filter((v) => v != null);
      return orders.length ? orders.every((v) => v === orders[0]) : true;
    });
    out.organize.sameLaneOrders = sameLaneOrders;
    // 整理轨道后再新建对象：新对象必须作为独立轨道出现在时间轴里。
    const spNew = { id: 'spNew', time: 12, path: 'title.png', opacity: 1, layer: 1, order: -1 };
    S.storyboard.sprites.push(spNew);
    window.__sb.refreshAll();
    await sleep(150);
    out.organize.newObjectVisible = {
      hasClip: !!document.querySelector('.clip[data-id="spNew"]'),
      hasKf: !!document.querySelector('.kf[data-id="spNew"]'),
      laneCount: document.querySelectorAll('#lanes .lane-row').length
    };

    // ------------------------------------------------------------
    // 5) 时间轴空白处右键 → 添加关键帧（全部选中时间块）+ 撤销整理轨道
    // ------------------------------------------------------------
    S.selectedIds = ['spO2', 'txO'];
    S.selectedObjId = 'spO2';
    window.__sb.setTime(8);
    window.__sb.refreshAll();
    await sleep(150);
    const lanesRect2 = document.getElementById('lanes').getBoundingClientRect();
    document.getElementById('lanes').dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: lanesRect2.left + 400, clientY: lanesRect2.bottom - 2
    }));
    await sleep(120);
    const menuItem = Array.from(document.querySelectorAll('#contextMenu .cm-item'))
      .find((b) => b.textContent.includes('添加关键帧'));
    out.addKfMenu = { found: !!menuItem };
    if (menuItem) menuItem.click();
    await sleep(200);
    out.addKfMenu.spO2 = (spO2.states || []).map((s) => s.time);
    out.addKfMenu.txO = (txO.states || []).map((s) => s.time);

    // 撤销“添加关键帧”，再撤销“整理轨道”：恢复整理前的 order 与 _cyster 布局。
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true }));
    await sleep(200);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true }));
    await sleep(200);
    const undoSpO1 = S.storyboard.sprites.find((x) => x.id === 'spO1');
    const undoSpO2 = S.storyboard.sprites.find((x) => x.id === 'spO2');
    const undoTxO = S.storyboard.texts.find((x) => x.id === 'txO');
    const undoLnO = S.storyboard.lines.find((x) => x.id === 'lnO');
    out.organize.undo = {
      hasTimeline: !!(S.projectConfig.editor && S.projectConfig.editor.timeline),
      orders: { spO1: undoSpO1.order, spO2: undoSpO2.order, txO: undoTxO.order, lnO: undoLnO.order }
    };

    // ------------------------------------------------------------
    // 6) (layer, order) 复合层级：跨层分段、轨道 order 数字显示、跨层换轨
    // ------------------------------------------------------------
    S.storyboard.sprites.find((x) => x.id === 'spO2').layer = 2;
    S.storyboard.sprites.find((x) => x.id === 'spO1').layer = 0;
    window.__sb.refreshAll();
    await sleep(150);
    out.layerSegments = {
      names: Array.from(document.querySelectorAll('#tlHeader .lane-label .nm')).map((n) => n.textContent),
      orders: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).map((n) => n.textContent),
      seps: Array.from(document.querySelectorAll('#tlHeader .lane-layer-sep')).map((s) => s.textContent)
    };
    // 跨层换轨：把 layer 0 的 spO1 拖到最顶轨道（layer 2 段）→ 采用该轨道的 layer/order。
    const clipO1b = document.querySelector('.clip[data-id="spO1"]');
    const crb = clipO1b.getBoundingClientRect();
    const topRowR = document.querySelectorAll('#lanes .lane-row')[0].getBoundingClientRect();
    clipO1b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: crb.left + 8, clientY: crb.top + 8 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: crb.left + 8, clientY: crb.top + 8 + 20 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: crb.left + 8, clientY: topRowR.top + 5 }));
    // 实时换轨：mouseup 之前 order 数字与层级布局已经即时更新。
    const liveSpO1 = S.storyboard.sprites.find((x) => x.id === 'spO1');
    const liveSpO2 = S.storyboard.sprites.find((x) => x.id === 'spO2');
    out.crossLayerReorderLive = {
      spO1: { layer: liveSpO1.layer, order: liveSpO1.order },
      spO2: { layer: liveSpO2.layer, order: liveSpO2.order },
      orders: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).map((n) => n.textContent)
    };
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: crb.left + 8, clientY: topRowR.top + 5 }));
    await sleep(200);
    const spO1X = S.storyboard.sprites.find((x) => x.id === 'spO1');
    const spO2X = S.storyboard.sprites.find((x) => x.id === 'spO2');
    out.crossLayerReorder = {
      spO1: { layer: spO1X.layer, order: spO1X.order },
      spO2: { layer: spO2X.layer, order: spO2X.order },
      names: Array.from(document.querySelectorAll('#tlHeader .lane-label .nm')).map((n) => n.textContent)
    };

    // ------------------------------------------------------------
    // 7) order 缺省/重复：输入框只读并追加灰色“（数组顺序）”
    // ------------------------------------------------------------
    let spOrd = { id: 'spOrd', time: 0, path: 'title.png', opacity: 1, layer: 1, states: [{ time: 2 }, { time: 4 }] };
    let spOrd2 = { id: 'spOrd2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let spOrd3 = { id: 'spOrd3', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 5 };
    setSb({ sprites: [spOrd, spOrd2, spOrd3], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const orderRowState = (id) => {
      S.selectedIds = [id];
      S.selectedObjId = id;
      S.selectedKeyIdx = -1;
      const obj = S.storyboard.sprites.find((x) => x.id === id);
      if (obj) window.__sb.setTime(obj.time);
      window.__sb.refreshAll();
      const row = Array.from(document.querySelectorAll('#propBody #syncForm .field'))
        .find((f) => f.querySelector('label') && f.querySelector('label').textContent.includes('顺序'));
      if (!row) return null;
      const input = row.querySelector('input');
      const auto = row.querySelector('.order-auto');
      return { disabled: input ? input.disabled : null, autoText: auto ? auto.textContent : null };
    };
    out.orderAuto = {
      missing: orderRowState('spOrd'),
      dup: orderRowState('spOrd2'),
      unique: orderRowState('spOrd3')
    };

    // ------------------------------------------------------------
    // 8) order 唯一值：引擎读取按首个为准；面板任一关键帧修改全帧同步；
    //    右键时间块 上移一层/下移一层；Layer 分隔条冻结
    // ------------------------------------------------------------
    const compSb = {
      sprites: [{ id: 'spN', time: 0, order: 3, opacity: 1, states: [{ time: 2, order: 9 }, { time: 4, order: 1 }] }],
      texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {}
    };
    out.orderNorm = new SB.storyboard.StoryboardCompiler(compSb, S.chart).compile().sprites[0].states.map((s) => s.order);

    // 在关键帧上改 order -> 全部关键帧同步
    S.selectedIds = ['spOrd'];
    S.selectedObjId = 'spOrd';
    S.selectedKeyIdx = 0;
    window.__sb.setTime(2);
    window.__sb.refreshAll();
    await sleep(150);
    const orderRow = Array.from(document.querySelectorAll('#propBody #syncForm .field'))
      .find((f) => f.querySelector('label') && f.querySelector('label').textContent.includes('顺序'));
    const orderInp = orderRow ? orderRow.querySelector('input') : null;
    if (orderInp) {
      orderInp.value = '7';
      orderInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    const spOrdSync = S.storyboard.sprites.find((x) => x.id === 'spOrd');
    out.orderSync = {
      obj: spOrdSync.order,
      kf0: spOrdSync.states[0].order,
      kf1: spOrdSync.states[1].order
    };

    // 右键时间块菜单：上移一层 / 下移一层
    let spA2 = { id: 'spA2', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2 };
    let spB2 = { id: 'spB2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spC2b = { id: 'spC2b', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spA2, spB2, spC2b], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const menuClick = (label) => {
      const it = Array.from(document.querySelectorAll('#contextMenu .cm-item')).find((el) => el.textContent.includes(label));
      if (it) it.click();
    };
    const ctxOnClip = (el) => {
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 8, clientY: r.top + 8 }));
    };
    const clipB = document.querySelector('.clip[data-id="spB2"]');
    ctxOnClip(clipB);
    await sleep(100);
    menuClick('上移一层');
    await sleep(150);
    out.shiftUp = {
      a: S.storyboard.sprites.find((x) => x.id === 'spA2').order,
      b: S.storyboard.sprites.find((x) => x.id === 'spB2').order,
      c: S.storyboard.sprites.find((x) => x.id === 'spC2b').order
    };
    ctxOnClip(document.querySelector('.clip[data-id="spB2"]'));
    await sleep(100);
    menuClick('下移一层');
    await sleep(150);
    out.shiftDown = {
      a: S.storyboard.sprites.find((x) => x.id === 'spA2').order,
      b: S.storyboard.sprites.find((x) => x.id === 'spB2').order,
      c: S.storyboard.sprites.find((x) => x.id === 'spC2b').order
    };

    // Layer 分隔条标签属于独立表头模块（不在时间轴体滚动容器内）
    S.storyboard.sprites.find((x) => x.id === 'spA2').layer = 2;
    window.__sb.refreshAll();
    await sleep(150);
    const sepLabel = document.querySelector('#tlHeader .lane-layer-sep-label');
    out.layerSepFrozen = {
      frozen: sepLabel ? !!sepLabel.closest('#tlHeader') && !sepLabel.closest('#tlScroll') : false,
      text: sepLabel ? sepLabel.textContent : null
    };

    // ------------------------------------------------------------
    // 9) 合并轨道内重叠：右拖关键帧拉长后，被挤对象不再向后推时间，
    //    而是移到上/下相邻空闲轨道（层级），时间保持不变。
    // ------------------------------------------------------------
    let spM1 = { id: 'spM1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 2 }] };
    let spM2 = { id: 'spM2', time: 0.5, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2.5 }] };
    let spM3 = { id: 'spM3', time: 3, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 5 }] };
    let spM4 = { id: 'spM4', time: 6.5, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 8.5 }] };
    let spM5 = { id: 'spM5', time: 5.5, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 7 }] };
    setSb({ sprites: [spM1, spM2, spM3, spM4, spM5], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    window.__sb.timeline.setZoom(200);
    window.__sb.timeline.snapStrength = 0;
    await sleep(150);
    const kf1 = document.querySelector('.kf[data-id="spM1"][data-kf="0"]');
    const kr = kf1.getBoundingClientRect();
    const startX = kr.left + kr.width / 2;
    const startY = kr.top + kr.height / 2;
    kf1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: startX, clientY: startY }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: startX + 400, clientY: startY }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: startX + 400, clientY: startY }));
    await sleep(250);
    out.lanePush = {
      m1: spM1.states[0].time,
      m2: { time: spM2.time, kf: spM2.states[0].time },
      m3: { time: spM3.time, kf: spM3.states[0].time },
      m4: { time: spM4.time, kf: spM4.states[0].time },
      m5: { time: spM5.time, kf: spM5.states[0].time },
      order3: spM3.order,
      groups: (S.projectConfig.editor.timeline.trackGroups.stage || []).map((l) => l.slice())
    };

    // ------------------------------------------------------------
    // 10) K0 无特殊性：关键帧可以越过 K0 / 被 K0 越过，重排后以最早帧为新 K0
    // ------------------------------------------------------------
    let spKF = { id: 'spKF', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 4 }, { time: 8 }] };
    setSb({ sprites: [spKF], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    window.__sb.timeline.setZoom(200);
    window.__sb.timeline.snapStrength = 0;
    await sleep(120);
    const kf2 = document.querySelector('.kf[data-id="spKF"][data-kf="1"]');
    const kr2 = kf2.getBoundingClientRect();
    const kx = kr2.left + kr2.width / 2;
    const ky = kr2.top + kr2.height / 2;
    kf2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: kx, clientY: ky }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: kx - 400, clientY: ky }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: kx - 1600, clientY: ky }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: kx - 1600, clientY: ky }));
    await sleep(250);
    out.kfClamp = {
      afterCross: { time: spKF.time, times: spKF.states.map((s) => s.time) },
      sorted: spKF.states.map((s) => s.time).slice().sort((a, b) => a - b)
    };
    // 再把 K0 向右拖过其它关键帧：K0 同样只是普通关键帧，自动重定基。
    const kf0 = document.querySelector('.kf[data-id="spKF"][data-kf="-1"]');
    const kr0 = kf0.getBoundingClientRect();
    const kx0 = kr0.left + kr0.width / 2;
    const ky0 = kr0.top + kr0.height / 2;
    kf0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: kx0, clientY: ky0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: kx0 + 800, clientY: ky0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: kx0 + 1600, clientY: ky0 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: kx0 + 1600, clientY: ky0 }));
    await sleep(250);
    out.kfClamp.afterK0Cross = {
      time: spKF.time,
      times: spKF.states.map((s) => s.time),
      sorted: spKF.states.map((s) => s.time).slice().sort((a, b) => a - b)
    };

    // ------------------------------------------------------------
    // 11) 外部图片直接拖入素材库（addAssetByPath 原地引用、重复跳过）
    // ------------------------------------------------------------
    const DROP = ${JSON.stringify(DROP_FILE.replace(/\\/g, '/'))};
    await window.__sb.addAssetByPath(DROP);
    await sleep(200);
    const inLib = S.manualImages.includes(DROP);
    await window.__sb.addAssetByPath(DROP);
    await sleep(200);
    out.assetDrop = {
      inLib,
      dupCount: S.manualImages.filter((x) => x === DROP).length,
      visible: Array.from(document.querySelectorAll('#assetList .asset-item .nm')).some((n) => n.textContent === 'drop.png')
    };

    // ------------------------------------------------------------
    // 12) 关键帧时间不能重复：播放头加帧跳过、面板 time 校验拒绝
    // ------------------------------------------------------------
    let spDup = { id: 'spDup', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 4 }, { time: 8 }] };
    setSb({ sprites: [spDup], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    window.__sb.setTime(4);
    window.__sb.addKeyframeAtPlayhead(spDup);
    await sleep(120);
    out.kfDup = { count: spDup.states.length, selIdx: S.selectedKeyIdx };
    S.selectedIds = ['spDup'];
    S.selectedObjId = 'spDup';
    S.selectedKeyIdx = 1;
    window.__sb.setTime(8);
    window.__sb.refreshAll();
    await sleep(120);
    const timeRow = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => f.querySelector('label') && f.querySelector('label').textContent === '时间 (秒)');
    const timeInp = timeRow ? timeRow.querySelector('input') : null;
    if (timeInp) {
      timeInp.value = '4';
      timeInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.kfDup.panelTime = spDup.states[1].time;

    // ------------------------------------------------------------
    // 13) controller / note_controller 无层级：不显示 order 徽标；
    //     note_controller 合并轨道（整理轨道生效，_cyster 读写）
    // ------------------------------------------------------------
    let ncA = { id: 'ncA', note: 1, time: 0, override_x: true, x: 0.5, states: [{ time: 2 }] };
    let ncB = { id: 'ncB', note: 2, time: 3, override_x: true, x: 0.5, states: [{ time: 5 }] };
    let ctl1 = { id: 'ctl1', time: 0, perspective: true };
    setSb({ sprites: [], texts: [], videos: [], lines: [], controllers: [ctl1], note_controllers: [ncA, ncB], templates: {} });
    await sleep(150);
    out.ncNoOrder = {
      badges: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).length,
      ncHasOrder: ncA.order !== undefined || ncB.order !== undefined,
      ctlHasOrder: ctl1.order !== undefined
    };
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    const tlEd2 = S.projectConfig.editor && S.projectConfig.editor.timeline;
    out.ncMerge = {
      ncLanes: tlEd2 && tlEd2.trackGroups ? tlEd2.trackGroups.note_controller : null,
      laneCount: document.querySelectorAll('#lanes .lane-row').length,
      badgesAfter: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).length
    };
    const exported2 = JSON.parse(window.__sb.storyboardCompiledJson());
    out.ncMerge.exportedHasCyster = !!exported2._cyster;
    const savedNcTl = JSON.parse(JSON.stringify(tlEd2 || {}));
    S.projectConfig.editor = { timeline: savedNcTl };
    window.__sb.refreshAll();
    await sleep(220);
    out.ncMerge.reloadedLaneCount = document.querySelectorAll('#lanes .lane-row').length;

    // ------------------------------------------------------------
    // 14) R 键切换选择层级（Note <-> Stage）
    // ------------------------------------------------------------
    S.pickMode = 'note';
    document.getElementById('pickMode').value = 'note';
    out.rKey = { before: S.pickMode };
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true, cancelable: true }));
    await sleep(80);
    out.rKey.after1 = { mode: S.pickMode, sel: document.getElementById('pickMode').value };
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true, cancelable: true }));
    await sleep(80);
    out.rKey.after2 = { mode: S.pickMode, sel: document.getElementById('pickMode').value };

    // ------------------------------------------------------------
    // 15) 合并轨道锁定：整条轨道统一切换（图标状态同步）
    // ------------------------------------------------------------
    let spL1 = { id: 'spL1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spL2 = { id: 'spL2', time: 3, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    setSb({ sprites: [spL1, spL2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    const laneRow = Array.from(document.querySelectorAll('#tlHeader .tlh-lane'))
      .find((r) => { const nm = r.querySelector('.lane-label .nm'); return nm && nm.textContent.includes('×'); });
    const lockBtn = laneRow ? laneRow.querySelector('.lane-lock') : null;
    if (lockBtn) lockBtn.click();
    await sleep(150);
    out.mergedLock = {
      found: !!lockBtn,
      l1: S.lockedIds.has('spL1'),
      l2: S.lockedIds.has('spL2'),
      iconLocked: (() => {
        const row = Array.from(document.querySelectorAll('#tlHeader .tlh-lane'))
          .find((r) => { const nm = r.querySelector('.lane-label .nm'); return nm && nm.textContent.includes('×'); });
        return row ? row.querySelector('.lane-lock').classList.contains('locked') : null;
      })()
    };
    if (lockBtn) {
      const row2 = Array.from(document.querySelectorAll('#tlHeader .tlh-lane'))
        .find((r) => { const nm = r.querySelector('.lane-label .nm'); return nm && nm.textContent.includes('×'); });
      if (row2) row2.querySelector('.lane-lock').click();
    }
    await sleep(150);
    out.mergedLock.afterUnlock = { l1: S.lockedIds.has('spL1'), l2: S.lockedIds.has('spL2') };

    // ------------------------------------------------------------
    // 16) parent_id / target_id 全帧同步 + 黄色标注
    // ------------------------------------------------------------
    let spP1 = { id: 'spP1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spP2 = { id: 'spP2', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2 }] };
    setSb({ sprites: [spP1, spP2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spP2'];
    S.selectedObjId = 'spP2';
    S.selectedKeyIdx = -1;
    window.__sb.setTime(0);
    window.__sb.refreshAll();
    await sleep(120);
    const parentInp = document.getElementById('fParentId');
    if (parentInp) {
      parentInp.value = 'spP1';
      parentInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.syncParent = {
      obj: spP2.parent_id,
      kf: spP2.states[0].parent_id,
      yellowParent: !!document.querySelector('#propBody .sync-label'),
      yellowFields: document.querySelectorAll('#propBody label.sync-label').length
    };

    // ------------------------------------------------------------
    // 17) 锁定的内容在时间轴上不可选取
    // ------------------------------------------------------------
    let spLk = { id: 'spLk', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2 }] };
    setSb({ sprites: [spLk], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.lockedIds = new Set(['spLk']);
    window.__sb.refreshAll();
    await sleep(120);
    const clipLk = document.querySelector('.clip[data-id="spLk"]');
    const crLk = clipLk.getBoundingClientRect();
    clipLk.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: crLk.left + 8, clientY: crLk.top + 8 }));
    clipLk.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: crLk.left + 8, clientY: crLk.top + 8 }));
    await sleep(150);
    out.lockedSelect = {
      selected: S.selectedIds.includes('spLk'),
      timelineSelected: window.__sb.timeline.selectedIds.has('spLk')
    };
    S.lockedIds = new Set();

    // ------------------------------------------------------------
    // 18) 选中一个时间块的全部关键帧 → 删除动作变为删除整个时间块
    // ------------------------------------------------------------
    let spDel = { id: 'spDel', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2 }, { time: 4 }] };
    setSb({ sprites: [spDel], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedKfs = [
      { objId: 'spDel', index: -1 },
      { objId: 'spDel', index: 0 },
      { objId: 'spDel', index: 1 }
    ];
    window.__sb.deleteSelection();
    await sleep(150);
    out.delAll = {
      exists: !!S.storyboard.sprites.find((x) => x.id === 'spDel'),
      spriteCount: S.storyboard.sprites.length
    };

    // ------------------------------------------------------------
    // 19) order 层级标识锁定：变亮 + 禁用该 order 层级整理合并与切换轨道
    // ------------------------------------------------------------
    let spK1 = { id: 'spK1', time: 0, path: 'title.png', opacity: 1, layer: 2, order: 1 };
    let spK2 = { id: 'spK2', time: 3, path: 'title.png', opacity: 1, layer: 2, order: 1 };
    let spK3 = { id: 'spK3', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let spK4 = { id: 'spK4', time: 3, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spK1, spK2, spK3, spK4], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const orderBadge = document.querySelector('.lane-order');
    if (orderBadge) orderBadge.click();
    await sleep(150);
    out.layerLock = { lockedClass: !!document.querySelector('.lane-order.locked') };
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    const tlLock = S.projectConfig.editor && S.projectConfig.editor.timeline;
    const tg = tlLock && tlLock.trackGroups ? tlLock.trackGroups.stage : [];
    const l2Lanes = tg.filter((lane) => lane.some((id) => id === 'spK1' || id === 'spK2'));
    out.layerLock.groups = tg.map((l) => l.slice());
    out.layerLock.l2Separate = l2Lanes.every((lane) => lane.length === 1);
    out.layerLock.orders = { k1: spK1.order, k2: spK2.order };
    // 切换轨道：垂直拖动 order=1 的 spK1 到别的轨道 → 被锁定层级禁止
    const clipK1 = document.querySelector('.clip[data-id="spK1"]');
    const ck = clipK1.getBoundingClientRect();
    const targetRow = document.querySelectorAll('#lanes .lane-row')[2].getBoundingClientRect();
    clipK1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: ck.left + 8, clientY: ck.top + 8 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: ck.left + 8, clientY: ck.top + 8 + 20 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: ck.left + 8, clientY: targetRow.top + 5 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: ck.left + 8, clientY: targetRow.top + 5 }));
    await sleep(200);
    out.layerLock.afterReorder = { k1: spK1.order, k2: spK2.order, layer1: spK1.layer };
    // order 锁定配置写入 .ctr 项目文件（editor.timeline），读取时恢复。
    const exportedLocked = JSON.parse(window.__sb.storyboardCompiledJson());
    const savedLockTl = JSON.parse(JSON.stringify(tlLock || {}));
    S.projectConfig.editor = { timeline: savedLockTl };
    window.__sb.refreshAll();
    window.__sb.setTime(0);
    await sleep(250);
    out.layerLock.persisted = {
      written: (tlLock && tlLock.lockedOrders) || null,
      exportedCyster: !!exportedLocked._cyster,
      restored: window.__sb.timeline.lockedOrders ? [...window.__sb.timeline.lockedOrders] : [],
      restoredClass: !!document.querySelector('.lane-order.locked')
    };

    // ------------------------------------------------------------
    // 20) 全帧同步字段全部置顶 + 删除 K0 不丢同步字段（path 等）
    // ------------------------------------------------------------
    let spK0del = { id: 'spK0del', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 2, states: [{ time: 3, opacity: 0.5 }, { time: 5 }] };
    setSb({ sprites: [spK0del], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(150);
    S.selectedIds = ['spK0del'];
    S.selectedObjId = 'spK0del';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(150);
    out.syncTop = {
      syncFieldCount: document.querySelectorAll('#propBody #syncForm .field').length,
      stateHasSyncTag: !!document.querySelector('#propBody #stateForm .sync-tag')
    };
    const k0Item = Array.from(document.querySelectorAll('#propBody .key-item')).find((el) => el.dataset.kf === '-1');
    const k0Del = k0Item ? k0Item.querySelector('.del') : null;
    if (k0Del) k0Del.click();
    await sleep(200);
    out.k0Delete = {
      path: spK0del.path,
      time: spK0del.time,
      times: (spK0del.states || []).map((s) => s.time),
      k0Label: Array.from(document.querySelectorAll('#propBody .key-item .klabel')).map((n) => n.textContent)
    };

    // ------------------------------------------------------------
    // 21) stage 对象新建：自动落在最上层的一条新轨道（并重排合并轨道）
    // ------------------------------------------------------------
    let spN1 = { id: 'spN1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spN2 = { id: 'spN2', time: 5, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let spN3 = { id: 'spN3', time: 9, path: 'title.png', opacity: 1, layer: 2, order: 0 };
    setSb({ sprites: [spN1, spN2, spN3], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    const spriteRow = Array.from(document.querySelectorAll('#objectAddList .oa-row'))
      .find((r) => r.querySelector('.oa-name') && r.querySelector('.oa-name').textContent.includes('Sprites'));
    const spriteAddBtn = spriteRow ? spriteRow.querySelector('.oa-add') : null;
    if (spriteAddBtn) spriteAddBtn.click();
    await sleep(250);
    const newSpr = (S.storyboard.sprites || []).find((o) => o.id !== 'spN1' && o.id !== 'spN2' && o.id !== 'spN3');
    const tgNew = (S.projectConfig.editor.timeline && S.projectConfig.editor.timeline.trackGroups &&
      S.projectConfig.editor.timeline.trackGroups.stage) || [];
    out.newObjectTop = {
      created: !!newSpr,
      layer: newSpr ? newSpr.layer : null,
      order: newSpr ? newSpr.order : null,
      topLane: tgNew.length ? tgNew[0].slice() : null,
      firstRow: (document.querySelectorAll('#tlHeader .lane-label .nm')[0] || {}).textContent || null
    };

    // ------------------------------------------------------------
    // 22) 无空闲轨道时：被挤对象移入单独新轨道并重排（时间不变），
    //     且“在播放头添加关键帧”造成的重叠也会被自动解决
    // ------------------------------------------------------------
    let spF1 = { id: 'spF1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 2 }] };
    let spF2 = { id: 'spF2', time: 3, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 5 }] };
    setSb({ sprites: [spF1, spF2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    window.__sb.timeline.setZoom(200);
    window.__sb.timeline.snapStrength = 0;
    window.__sb.setTime(7);
    window.__sb.addKeyframeAtPlayhead(spF1);
    await sleep(250);
    const tgNewLane = (S.projectConfig.editor.timeline && S.projectConfig.editor.timeline.trackGroups &&
      S.projectConfig.editor.timeline.trackGroups.stage) || [];
    out.newLaneFallback = {
      f1Time: spF1.time,
      f1States: (spF1.states || []).map((s) => s.time),
      f2Time: spF2.time,
      f2States: (spF2.states || []).map((s) => s.time),
      groups: tgNewLane.map((l) => l.slice()),
      laneCount: document.querySelectorAll('#lanes .lane-row').length
    };

    // ------------------------------------------------------------
    // 23) 导出父先于子（CytoidPlayer 按数组顺序生成）；删除父清理悬空引用；
    //     不存在的父对象被拒绝
    // ------------------------------------------------------------
    let spX1 = { id: 'spChild1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let spX2 = { id: 'spChild2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spXP = { id: 'spParent', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 2 };
    setSb({ sprites: [spX1, spX2, spXP], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spChild1'];
    S.selectedObjId = 'spChild1';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(150);
    const pInp = document.getElementById('fParentId');
    if (pInp) {
      pInp.value = 'spParent';
      pInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
    const exportedP = JSON.parse(window.__sb.storyboardCompiledJson());
    const spawned = new Set();
    let playerOk = true;
    for (const g of ['note_controllers', 'texts', 'sprites', 'lines', 'videos', 'controllers']) {
      for (const o of exportedP[g] || []) {
        if (o.ParentId != null && !spawned.has(o.ParentId)) playerOk = false;
        spawned.add(o.Id);
      }
    }
    out.parentOrder = {
      array: S.storyboard.sprites.map((o) => o.id),
      exported: exportedP.sprites.map((o) => o.Id),
      playerOk,
      childParent: spX1.parent_id
    };
    // 删除父对象后子对象的 parent_id 被自动清空。
    S.selectedIds = ['spParent'];
    S.selectedObjId = 'spParent';
    window.__sb.refreshAll();
    await sleep(120);
    window.__sb.deleteSelection();
    await sleep(200);
    out.parentOrder.afterDelete = { childParent: spX1.parent_id };
    // 不存在的父对象被拒绝。
    S.selectedIds = ['spChild2'];
    S.selectedObjId = 'spChild2';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(150);
    const pInp2 = document.getElementById('fParentId');
    if (pInp2) {
      pInp2.value = 'nope';
      pInp2.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.parentOrder.rejectMissing = spX2.parent_id == null;

    // ------------------------------------------------------------
    // 24) 同一时间块内多关键帧（不同时间）多选：属性修改同步到全部选中关键帧
    // ------------------------------------------------------------
    let spMK = { id: 'spMK', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2, opacity: 1 }, { time: 4, opacity: 0.5 }] };
    setSb({ sprites: [spMK], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    window.__sb.timeline.setZoom(200);
    window.__sb.timeline.snapStrength = 0;
    window.__sb.timeline.toggleKey('spMK', 0);
    window.__sb.timeline.toggleKey('spMK', 1);
    await sleep(200);
    const kfSummary = document.querySelector('#propBody .empty-panel');
    const kfOpacityRow = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('不透明度'); });
    const kfOpacityInp = kfOpacityRow ? kfOpacityRow.querySelector('input') : null;
    out.multiKf = {
      summary: kfSummary ? kfSummary.textContent : null,
      form: !!document.querySelector('#propBody #stateForm'),
      opacityBefore: kfOpacityInp ? (kfOpacityInp.value || kfOpacityInp.placeholder) : null,
      syncTop: document.querySelectorAll('#propBody #syncForm .field').length
    };
    if (kfOpacityInp) {
      kfOpacityInp.value = '0.8';
      kfOpacityInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
    out.multiKf.after = {
      k0: spMK.states[0].opacity,
      k1: spMK.states[1].opacity
    };

    // ------------------------------------------------------------
    // 25) order 属性框直接修改：自动移至对应 order 轨道（新值新建轨道）；
    //     时间重叠时拒绝，时间不重叠允许共轨
    // ------------------------------------------------------------
    let spOA = { id: 'spOA', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 1 }] };
    let spOB = { id: 'spOB', time: 0.5, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spOA, spOB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    S.selectedIds = ['spOA'];
    S.selectedObjId = 'spOA';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(150);
    const orderInpOf = () => {
      const row = Array.from(document.querySelectorAll('#propBody #syncForm .field'))
        .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('顺序'); });
      return row ? row.querySelector('input') : null;
    };
    out.orderEdit = {
      editable: orderInpOf() ? orderInpOf().disabled === false : false,
      before: spOA.order,
      badgesBefore: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).map((n) => n.textContent)
    };
    // 时间重叠（spOA 0~1 vs spOB 0.5~0.75）→ 拒绝。
    const inpOrder = orderInpOf();
    if (inpOrder) {
      inpOrder.value = '0';
      inpOrder.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
    out.orderEdit.overlap = {
      order: spOA.order,
      badges: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).map((n) => n.textContent)
    };
    // 新 order 值（3）→ 新建轨道并移入。
    const inpOrder2 = orderInpOf();
    if (inpOrder2) {
      inpOrder2.value = '3';
      inpOrder2.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(250);
    }
    out.orderEdit.newOrder = {
      order: spOA.order,
      groups: (S.projectConfig.editor.timeline.trackGroups.stage || []).map((l) => l.slice()),
      badges: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).map((n) => n.textContent)
    };
    // 时间不重叠 → 允许与其它对象共用一个 order 轨道。
    let spOX = { id: 'spOX', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spOY = { id: 'spOY', time: 5, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spOX, spOY], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    S.selectedIds = ['spOX'];
    S.selectedObjId = 'spOX';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(150);
    const inpOrder3 = orderInpOf();
    if (inpOrder3) {
      inpOrder3.value = '0';
      inpOrder3.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(250);
    }
    out.orderEdit.shared = {
      order: spOX.order,
      groups: (S.projectConfig.editor.timeline.trackGroups.stage || []).map((l) => l.slice()),
      badges: Array.from(document.querySelectorAll('#tlHeader .lane-label .lane-order')).map((n) => n.textContent)
    };

    // ------------------------------------------------------------
    // 26) 多选移动层级：每个选中的时间块只与相邻块单独交换（不整层移动）
    // ------------------------------------------------------------
    let spU1 = { id: 'spU1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2 };
    let spU2 = { id: 'spU2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spU3 = { id: 'spU3', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spU1, spU2, spU3], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spU2', 'spU3'];
    S.selectedObjId = 'spU2';
    window.__sb.refreshAll();
    await sleep(120);
    ctxOnClip(document.querySelector('.clip[data-id="spU2"]'));
    await sleep(80);
    menuClick('上移一层');
    await sleep(200);
    const batchUpAdj = { u1: spU1.order, u2: spU2.order, u3: spU3.order };
    // 非相邻选择：各自与相邻块单独交换
    let spG1 = { id: 'spG1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2 };
    let spG2 = { id: 'spG2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spG3 = { id: 'spG3', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spG1, spG2, spG3], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spG1', 'spG3'];
    S.selectedObjId = 'spG1';
    window.__sb.refreshAll();
    await sleep(120);
    ctxOnClip(document.querySelector('.clip[data-id="spG1"]'));
    await sleep(80);
    menuClick('上移一层');
    await sleep(200);
    const batchUpGap = { g1: spG1.order, g2: spG2.order, g3: spG3.order };
    let spD1 = { id: 'spD1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2 };
    let spD2 = { id: 'spD2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    let spD3 = { id: 'spD3', time: 2, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    setSb({ sprites: [spD1, spD2, spD3], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spD1', 'spD2'];
    S.selectedObjId = 'spD1';
    window.__sb.refreshAll();
    await sleep(120);
    ctxOnClip(document.querySelector('.clip[data-id="spD1"]'));
    await sleep(80);
    menuClick('下移一层');
    await sleep(200);
    out.batchShift = {
      upAdj: batchUpAdj,
      upGap: batchUpGap,
      down: { d1: spD1.order, d2: spD2.order, d3: spD3.order }
    };

    // ------------------------------------------------------------
    // 27) 合并轨道：上/下移只移动选中的时间块，轨道其它成员不跟着交换
    // ------------------------------------------------------------
    const prevLockedOrders = (S.projectConfig.editor.timeline && S.projectConfig.editor.timeline.lockedOrders) || [];
    let spMx = { id: 'spMx', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2, states: [{ time: 1 }] };
    let spMA = { id: 'spMA', time: 1.5, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 3 }] };
    let spMy = { id: 'spMy', time: 0.5, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 1 }] };
    let spMB = { id: 'spMB', time: 4, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 5 }] };
    setSb({ sprites: [spMx, spMA, spMy, spMB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    S.projectConfig.editor.timeline = {
      version: 5,
      trackGroups: { stage: [['spMx'], ['spMA', 'spMy'], ['spMB']], note_controller: [] },
      lockedOrders: prevLockedOrders.slice()
    };
    window.__sb.refreshAll();
    await sleep(150);
    S.selectedIds = ['spMA'];
    S.selectedObjId = 'spMA';
    window.__sb.refreshAll();
    await sleep(120);
    ctxOnClip(document.querySelector('.clip[data-id="spMA"]'));
    await sleep(80);
    menuClick('上移一层');
    await sleep(250);
    const mergedMove = {
      mx: spMx.order, ma: spMA.order, my: spMy.order, mb: spMB.order,
      groups: (S.projectConfig.editor.timeline.trackGroups.stage || []).map((l) => l.slice())
    };
    // 时间冲突场景：spCA [1.5,3] 与上方 spCX [0,4] 重叠 → 拒绝
    let spCX = { id: 'spCX', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 2, states: [{ time: 4 }] };
    let spCA = { id: 'spCA', time: 1.5, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 3 }] };
    let spCB = { id: 'spCB', time: 5, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 6 }] };
    setSb({ sprites: [spCX, spCA, spCB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    S.projectConfig.editor.timeline = {
      version: 5,
      trackGroups: { stage: [['spCX'], ['spCA'], ['spCB']], note_controller: [] },
      lockedOrders: prevLockedOrders.slice()
    };
    window.__sb.refreshAll();
    await sleep(150);
    S.selectedIds = ['spCA'];
    S.selectedObjId = 'spCA';
    window.__sb.refreshAll();
    await sleep(120);
    ctxOnClip(document.querySelector('.clip[data-id="spCA"]'));
    await sleep(80);
    menuClick('上移一层');
    await sleep(200);
    mergedMove.overlap = { ca: spCA.order, cx: spCX.order };
    out.mergedMove = mergedMove;

    // ------------------------------------------------------------
    // 28) 坐标系下拉切换（stageXY <-> noteXY）：数值自动换算，位置不变；
    //     多选同样生效
    // ------------------------------------------------------------
    const pxOf = (o) => {
      const info = window.__sb.preview.ctxInfo();
      return window.__sb.preview.stageOriginPx(o, o, info, unit(o.x, 'stagex'), unit(o.y, 'stagey'));
    };
    const unitSelOf = (rowLabel) => {
      const row = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
        .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes(rowLabel); });
      return row ? row.querySelector('select.unit') : null;
    };
    let spCV = { id: 'spCV', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, x: 'stagex:100', y: 'stagey:50' };
    setSb({ sprites: [spCV], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spCV'];
    S.selectedObjId = 'spCV';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(150);
    const posCVBefore = pxOf(spCV);
    const xSel = unitSelOf('X');
    if (xSel) {
      xSel.value = 'notex';
      xSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
    const posCVAfter = pxOf(spCV);
    out.unitConv = {
      x: spCV.x,
      valueChanged: spCV.x !== 'stagex:100',
      posBefore: posCVBefore,
      posAfter: posCVAfter
    };
    // 多选：两个对象不同 X 值，统一切换单位
    let spMVA = { id: 'spMVA', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1, x: 'stagex:100', y: 'stagey:50' };
    let spMVB = { id: 'spMVB', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 0, x: 'stagex:-60', y: 'stagey:120' };
    setSb({ sprites: [spMVA, spMVB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spMVA', 'spMVB'];
    S.selectedObjId = 'spMVA';
    window.__sb.refreshAll();
    await sleep(150);
    const posMA = pxOf(spMVA);
    const posMB = pxOf(spMVB);
    const xSelM = unitSelOf('X');
    if (xSelM) {
      xSelM.value = 'notex';
      xSelM.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(250);
    }
    out.unitConv.multi = {
      xa: spMVA.x,
      xb: spMVB.x,
      posA: { before: posMA, after: pxOf(spMVA) },
      posB: { before: posMB, after: pxOf(spMVB) }
    };

    // ------------------------------------------------------------
    // 29) 多选关键帧：预览拖动同步修改全部选中关键帧（line 节点 / stage x/y）
    // ------------------------------------------------------------
    let spDragKf = { id: 'spDragKf', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, x: 'stagex:100', y: 'stagey:50', states: [{ time: 2, x: 'stagex:120', y: 'stagey:60' }, { time: 4, x: 'stagex:130', y: 'stagey:70' }] };
    setSb({ sprites: [spDragKf], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(150);
    window.__sb.timeline.toggleKey('spDragKf', 0);
    window.__sb.timeline.toggleKey('spDragKf', 1);
    await sleep(150);
    window.__sb.setTime(0);
    window.__sb.refreshAll();
    await sleep(150);
    const infoKf = preview.ctxInfo();
    const cKf = preview.stageOriginPx(spDragKf, spDragKf, infoKf, unit(spDragKf.x, 'stagex'), unit(spDragKf.y, 'stagey'));
    const kfsBefore = (S.selectedKfs || []).map((k) => k.objId + '::' + k.index);
    const idsBefore = (S.selectedIds || []).slice();
    S.pickMode = 'sprite';
    drag(cKf, { x: cKf.x + 60, y: cKf.y });
    await sleep(250);
    const multiKfDrag = {
      k0: { x: spDragKf.states[0].x, y: spDragKf.states[0].y },
      k1: { x: spDragKf.states[1].x, y: spDragKf.states[1].y },
      base: { x: spDragKf.x, y: spDragKf.y },
      k0xv: unit(spDragKf.states[0].x, 'stagex').value,
      k1xv: unit(spDragKf.states[1].x, 'stagex').value,
      equal: unit(spDragKf.states[0].x, 'stagex').value - 120 === unit(spDragKf.states[1].x, 'stagex').value - 130
    };
    multiKfDrag.before = { kfs: kfsBefore, ids: idsBefore };
    // line 多关键帧：整条线拖动，两个关键帧的节点同步位移
    let spLineKf = {
      id: 'spLineKf', time: 0, opacity: 1, layer: 1, order: 0,
      pos: [{ x: 'notex:0.2', y: 'notey:0.3' }, { x: 'notex:0.8', y: 'notey:0.3' }],
      states: [
        { time: 2, pos: [{ x: 'notex:0.2', y: 'notey:0.3' }, { x: 'notex:0.8', y: 'notey:0.3' }] },
        { time: 4, pos: [{ x: 'notex:0.2', y: 'notey:0.3' }, { x: 'notex:0.8', y: 'notey:0.3' }] }
      ]
    };
    setSb({ sprites: [], texts: [], videos: [], lines: [spLineKf], controllers: [], note_controllers: [], templates: {} });
    await sleep(150);
    window.__sb.timeline.toggleKey('spLineKf', 0);
    window.__sb.timeline.toggleKey('spLineKf', 1);
    await sleep(150);
    window.__sb.setTime(0);
    window.__sb.refreshAll();
    await sleep(150);
    const infoLf = preview.ctxInfo();
    const lp0 = preview.worldUnitPx(unit(spLineKf.pos[0].x, 'notex'), unit(spLineKf.pos[0].y, 'notey'), unit(spLineKf.pos[0].z, 'world'), infoLf);
    const lp1 = preview.worldUnitPx(unit(spLineKf.pos[1].x, 'notex'), unit(spLineKf.pos[1].y, 'notey'), unit(spLineKf.pos[1].z, 'world'), infoLf);
    const lmid = { x: (lp0.x + lp1.x) / 2, y: (lp0.y + lp1.y) / 2 };
    S.pickMode = 'line';
    drag(lmid, { x: lmid.x + 60, y: lmid.y });
    await sleep(250);
    const lk0 = spLineKf.states[0].pos[0];
    const lk1 = spLineKf.states[1].pos[0];
    multiKfDrag.line = {
      k0: lk0.x, k1: lk1.x,
      k0x: unit(lk0.x, 'notex').value,
      k1x: unit(lk1.x, 'notex').value,
      equal: unit(lk0.x, 'notex').value === unit(lk1.x, 'notex').value &&
        unit(lk0.y, 'notey').value === unit(lk1.y, 'notey').value
    };
    out.multiKfDrag = multiKfDrag;

    // ------------------------------------------------------------
    // 30) 复制对象时间块：重新分配最上层新 order，不产生同 order 双轨
    // ------------------------------------------------------------
    let spCpyA = { id: 'spCpyA', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 2 }] };
    let spCpyB = { id: 'spCpyB', time: 0.5, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2.5 }] };
    setSb({ sprites: [spCpyA, spCpyB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    document.getElementById('btnOrganizeTracks').click();
    await sleep(250);
    S.selectedIds = ['spCpyA'];
    S.selectedObjId = 'spCpyA';
    window.__sb.refreshAll();
    await sleep(120);
    window.__sb.copySelection(false);
    await sleep(250);
    const cpyClone = (S.storyboard.sprites || []).find((o) => o.id !== 'spCpyA' && o.id !== 'spCpyB');
    const cpyPairs = (S.storyboard.sprites || []).map((o) => (o.layer != null ? o.layer : 0) + ':' + (o.order != null ? o.order : 0));
    out.copyOrder = {
      clone: cpyClone ? { id: cpyClone.id, layer: cpyClone.layer, order: cpyClone.order, kfOrder: cpyClone.states && cpyClone.states[0] && cpyClone.states[0].order } : null,
      pairs: cpyPairs,
      unique: new Set(cpyPairs).size === cpyPairs.length,
      topLane: (S.projectConfig.editor.timeline.trackGroups.stage || [])[0]
    };

    // ------------------------------------------------------------
    // 31) 时间轴表头批量锁定（stage 大类 / layer 层级 / controller / nc）
    // ------------------------------------------------------------
    let spLa = { id: 'spLa', time: 0, path: 'title.png', opacity: 1, layer: 0, order: 0 };
    let spLb = { id: 'spLb', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let ctlZ = { id: 'ctlZ', time: 0, perspective: true };
    let ncZ = { id: 'ncZ', note: 1, time: 0 };
    setSb({ sprites: [spLa, spLb], texts: [], videos: [], lines: [], controllers: [ctlZ], note_controllers: [ncZ], templates: {} });
    await sleep(150);
    const clickLockByTitle = (sub) => {
      const el = Array.from(document.querySelectorAll('.gh-lock, .sep-lock')).find((e) => (e.title || '').includes(sub));
      if (el) el.click();
    };
    const locked = (id) => S.lockedIds.has(id);
    clickLockByTitle('锁定 Stage');
    await sleep(200);
    const stageAll = locked('spLa') && locked('spLb') && !locked('ctlZ') && !locked('ncZ');
    clickLockByTitle('解锁 Stage');
    await sleep(200);
    const stageUnlockAll = locked('spLa') || locked('spLb');
    clickLockByTitle('锁定 Layer 1');
    await sleep(200);
    const layer1Only = locked('spLb') && !locked('spLa');
    const layer0Free = !locked('spLa');
    clickLockByTitle('解锁 Layer 1');
    await sleep(200);
    clickLockByTitle('锁定 Controller');
    await sleep(200);
    const ctrlOnly = locked('ctlZ') && !locked('ncZ') && !locked('spLa') && !locked('spLb');
    clickLockByTitle('锁定 Note Ctrl');
    await sleep(200);
    const ncOnly = locked('ncZ') && locked('ctlZ');
    out.catLock = { stageAll, stageUnlockAll, layer1Only, layer0Free, ctrlOnly, ncOnly };
    return out;
  })()`);

  // 读取 .ctr 项目文件里持久化的 Cyster 时间轴数据（主进程侧）。
  let ctrEditor = null;
  try {
    ctrEditor = JSON.parse(fs.readFileSync(TMP_CTR, 'utf8')).editor || null;
  } catch (e) {}
  if (res && ctrEditor) res.ctr = ctrEditor;

  check('drag snaps near the grid (center on grid line)',
    res.snap.onGridX && res.snap.onGridY,
    JSON.stringify(res.snap));
  check('drag far from grid does not snap',
    res.noSnap.moved > 5 && res.noSnap.distX > 5 && res.noSnap.distY > 5,
    JSON.stringify(res.noSnap));
  check('multi-select shows summary + detail form',
    res.multi.summary && res.multi.form && res.multi.multiValues >= 1 && res.multi.dupLabels === 0,
    JSON.stringify(res.multi));
  check('shared field edits apply to all selected objects',
    res.multi.applyAll.a === true && res.multi.applyAll.b === true,
    JSON.stringify(res.multi.applyAll));
  check('differing multi-select values are editable and unify (incl. easing)',
    res.multi.unify.a === 123 && res.multi.unify.b === 123 &&
    res.multi.unifyEasing.a === 'linear' && res.multi.unifyEasing.b === 'linear',
    JSON.stringify({ unify: res.multi.unify, easing: res.multi.unifyEasing }));
  check('easing batch edit applies when values were equal (unset)',
    res.multi.unifyEasingSame.a === 'linear' && res.multi.unifyEasingSame.b === 'linear',
    JSON.stringify(res.multi.unifyEasingSame));
  check('timeline marquee selects both clips',
    res.marquee.ids.includes('spC1') && res.marquee.ids.includes('spC2') &&
    !res.marquee.marqueeEl &&
    res.marquee.afterRightClick && JSON.stringify(res.marquee.afterRightClick.slice().sort()) === JSON.stringify(res.marquee.ids.slice().sort()),
    JSON.stringify(res.marquee));
  check('stage supergroup with order-sorted lanes',
    res.stage.hasStageHeader && JSON.stringify(res.stage.laneNames) === JSON.stringify(['lnO', 'spO1', 'txO', 'spO2']),
    JSON.stringify(res.stage));
  check('vertical reorder updates storyboard order',
    res.reorder.orders.spO1 === 3 && res.reorder.orders.spO2 === 0 && res.reorder.orders.txO === 1 && res.reorder.orders.lnO === 2,
    JSON.stringify(res.reorder));
  check('organize persists merged tracks into the .ctr project file (no _cyster in storyboard)',
    Array.isArray(res.organize.trackGroups) && res.organize.trackGroups.length > 0 &&
    res.organize.exportedHasCyster === false &&
    res.organize.laneCount < 4 && res.organize.reloadedLaneCount === res.organize.laneCount,
    JSON.stringify(res.organize));
  check('objects in the same merged lane share the same order',
    Array.isArray(res.organize.sameLaneOrders) && res.organize.sameLaneOrders.every(Boolean),
    JSON.stringify(res.organize.sameLaneOrders));
  check('new object appears after tracks were organized',
    res.organize.newObjectVisible.hasClip && res.organize.newObjectVisible.hasKf &&
    res.organize.newObjectVisible.laneCount === res.organize.laneCount + 1,
    JSON.stringify(res.organize.newObjectVisible));
  check('timeline empty-area menu adds keyframes to all selected clips',
    res.addKfMenu.found && JSON.stringify(res.addKfMenu.spO2) === JSON.stringify([8]) &&
    JSON.stringify(res.addKfMenu.txO) === JSON.stringify([8]),
    JSON.stringify(res.addKfMenu));
  check('organize is undoable',
    res.organize.undo.hasTimeline === false &&
    res.organize.undo.orders.spO1 === 3 && res.organize.undo.orders.spO2 === 0 &&
    res.organize.undo.orders.txO === 1 && res.organize.undo.orders.lnO === 2,
    JSON.stringify(res.organize.undo));
  check('(layer, order) composite segments with order labels',
    JSON.stringify(res.layerSegments.names) === JSON.stringify(['spO2', 'lnO', 'txO', 'spO1']) &&
    JSON.stringify(res.layerSegments.orders) === JSON.stringify(['0', '2', '1', '3']) &&
    JSON.stringify(res.layerSegments.seps) === JSON.stringify(['Layer 2', 'Layer 1', 'Layer 0']),
    JSON.stringify(res.layerSegments));
  check('cross-layer reorder adopts the target layer and order',
    res.crossLayerReorder.spO1.layer === 2 && res.crossLayerReorder.spO1.order === 1 &&
    res.crossLayerReorder.spO2.layer === 2 && res.crossLayerReorder.spO2.order === 0,
    JSON.stringify(res.crossLayerReorder));
  check('order badges update live during the vertical reorder drag',
    res.crossLayerReorderLive.spO1.layer === 2 && res.crossLayerReorderLive.spO1.order === 1 &&
    res.crossLayerReorderLive.spO2.layer === 2 && res.crossLayerReorderLive.spO2.order === 0 &&
    JSON.stringify(res.crossLayerReorderLive.orders.slice(0, 2)) === JSON.stringify(['1', '0']),
    JSON.stringify(res.crossLayerReorderLive));
  check('order missing/duplicate stays editable with array-order hint',
    res.orderAuto.missing && res.orderAuto.missing.disabled === false && res.orderAuto.missing.autoText === '（1）' &&
    res.orderAuto.dup && res.orderAuto.dup.disabled === false && res.orderAuto.dup.autoText === '（2）' &&
    res.orderAuto.unique && res.orderAuto.unique.disabled === false && res.orderAuto.unique.autoText === null,
    JSON.stringify(res.orderAuto));
  check('engine normalizes order to the first occurrence',
    JSON.stringify(res.orderNorm) === JSON.stringify([3, 3, 3]),
    JSON.stringify(res.orderNorm));
  check('order edit on a keyframe syncs to all frames',
    res.orderSync.obj === 7 && res.orderSync.kf0 === 7 && res.orderSync.kf1 === 7,
    JSON.stringify(res.orderSync));
  check('context menu moves a time block up/down one layer',
    res.shiftUp.a === 1 && res.shiftUp.b === 2 && res.shiftUp.c === 0 &&
    res.shiftDown.a === 2 && res.shiftDown.b === 1 && res.shiftDown.c === 0,
    JSON.stringify({ up: res.shiftUp, down: res.shiftDown }));
  check('layer separator label lives in the independent header module',
    res.layerSepFrozen.frozen === true && res.layerSepFrozen.text === 'Layer 2',
    JSON.stringify(res.layerSepFrozen));
  check('merged-lane overlap moves the squeezed block to an adjacent lane (time unchanged)',
    res.lanePush.m1 === 4 &&
    res.lanePush.m2.time === 0.5 && res.lanePush.m2.kf === 2.5 &&
    res.lanePush.m3.time === 3 && res.lanePush.m3.kf === 5 &&
    res.lanePush.m4.time === 6.5 && res.lanePush.m4.kf === 8.5 &&
    res.lanePush.m5.time === 5.5 && res.lanePush.m5.kf === 7 &&
    res.lanePush.order3 === 0 &&
    res.lanePush.groups.some((lane) => lane.includes('spM3') && !lane.includes('spM1')),
    JSON.stringify(res.lanePush));
  check('K0 is a normal keyframe: crossing re-baselines to the earliest keyframe',
    res.kfClamp.afterCross.time === 0 &&
    JSON.stringify(res.kfClamp.afterCross.times) === JSON.stringify([2, 4]) &&
    res.kfClamp.afterK0Cross.time !== 0 &&
    res.kfClamp.afterK0Cross.time === Math.min(res.kfClamp.afterK0Cross.time, ...res.kfClamp.afterK0Cross.times) &&
    JSON.stringify(res.kfClamp.afterK0Cross.sorted) === JSON.stringify(res.kfClamp.afterK0Cross.times),
    JSON.stringify(res.kfClamp));
  check('duplicate keyframe times are prevented (add-at-playhead + panel edit)',
    res.kfDup.count === 2 && res.kfDup.selIdx === 0 && res.kfDup.panelTime === 8,
    JSON.stringify(res.kfDup));
  check('external image drops into the asset library in place (no duplicate)',
    res.assetDrop.inLib === true && res.assetDrop.dupCount === 1 && res.assetDrop.visible === true,
    JSON.stringify(res.assetDrop));
  check('controller/note_controller lanes carry no order badge or order field',
    res.ncNoOrder.badges === 0 && res.ncNoOrder.ncHasOrder === false && res.ncNoOrder.ctlHasOrder === false,
    JSON.stringify(res.ncNoOrder));
  check('note_controller merged lanes via organize, persisted in .ctr (no _cyster)',
    Array.isArray(res.ncMerge.ncLanes) && res.ncMerge.ncLanes.length === 1 &&
    JSON.stringify(res.ncMerge.ncLanes[0].slice().sort()) === JSON.stringify(['ncA', 'ncB']) &&
    res.ncMerge.laneCount === 2 && res.ncMerge.badgesAfter === 0 &&
    res.ncMerge.exportedHasCyster === false && res.ncMerge.reloadedLaneCount === 2,
    JSON.stringify(res.ncMerge));
  check('R key toggles the pick layer (Note <-> Stage)',
    res.rKey.after1.mode !== res.rKey.before && res.rKey.after1.sel === res.rKey.after1.mode &&
    res.rKey.after2.mode === res.rKey.before,
    JSON.stringify(res.rKey));
  check('merged lane lock toggles the whole track with icon state',
    res.mergedLock.found && res.mergedLock.l1 === true && res.mergedLock.l2 === true &&
    res.mergedLock.iconLocked === true &&
    res.mergedLock.afterUnlock.l1 === false && res.mergedLock.afterUnlock.l2 === false,
    JSON.stringify(res.mergedLock));
  check('parent_id is full-frame synced and marked yellow',
    res.syncParent.obj === 'spP1' && res.syncParent.kf === 'spP1' &&
    res.syncParent.yellowParent === true && res.syncParent.yellowFields >= 3,
    JSON.stringify(res.syncParent));
  check('locked content is not selectable in the timeline',
    res.lockedSelect.selected === false && res.lockedSelect.timelineSelected === false,
    JSON.stringify(res.lockedSelect));
  check('deleting all keyframes of a block deletes the whole block',
    res.delAll.exists === false && res.delAll.spriteCount === 0,
    JSON.stringify(res.delAll));
  check('order badge lock highlights and blocks organize merge for that order',
    res.layerLock.lockedClass === true && res.layerLock.l2Separate === true &&
    res.layerLock.orders.k1 === 1 && res.layerLock.orders.k2 === 1,
    JSON.stringify(res.layerLock));
  check('locked order forbids track switching (reorder)',
    res.layerLock.afterReorder.k1 === 1 && res.layerLock.afterReorder.k2 === 1 &&
    res.layerLock.afterReorder.layer1 === 2,
    JSON.stringify(res.layerLock.afterReorder));
  check('order lock config persists in the .ctr project file round trip',
    JSON.stringify(res.layerLock.persisted.written) === '[1]' &&
    res.layerLock.persisted.exportedCyster === false &&
    JSON.stringify(res.layerLock.persisted.restored) === '[1]' &&
    res.layerLock.persisted.restoredClass === true &&
    res.ctr && JSON.stringify(res.ctr.timeline.lockedOrders) === '[1]',
    JSON.stringify(res.layerLock.persisted));
  check('full-frame sync fields are rendered at the top of the properties panel',
    res.syncTop.syncFieldCount >= 3 && res.syncTop.stateHasSyncTag === false,
    JSON.stringify(res.syncTop));
  check('deleting K0 keeps full-frame sync fields (path) and re-bases to the next keyframe',
    res.k0Delete.path === 'title.png' && res.k0Delete.time === 3 &&
    JSON.stringify(res.k0Delete.times) === JSON.stringify([5]),
    JSON.stringify(res.k0Delete));
  check('stage object creation lands in a new top-layer track (merged lanes re-sorted)',
    res.newObjectTop.created && res.newObjectTop.layer === 2 && res.newObjectTop.order === 1 &&
    Array.isArray(res.newObjectTop.topLane) && res.newObjectTop.topLane.length === 1 &&
    res.newObjectTop.firstRow === res.newObjectTop.topLane[0],
    JSON.stringify(res.newObjectTop));
  check('no free lane: squeezed block moves to a new lane and tracks re-sort (time unchanged)',
    res.newLaneFallback.f1Time === 0 &&
    JSON.stringify(res.newLaneFallback.f1States) === JSON.stringify([2, 7]) &&
    res.newLaneFallback.f2Time === 3 &&
    JSON.stringify(res.newLaneFallback.f2States) === JSON.stringify([5]) &&
    JSON.stringify(res.newLaneFallback.groups) === JSON.stringify([['spF1'], ['spF2']]) &&
    res.newLaneFallback.laneCount === 2,
    JSON.stringify(res.newLaneFallback));
  check('export orders stage objects parent-before-child for the player',
    JSON.stringify(res.parentOrder.exported) === JSON.stringify(['spParent', 'spChild1', 'spChild2']) &&
    res.parentOrder.playerOk === true && res.parentOrder.childParent === 'spParent',
    JSON.stringify(res.parentOrder));
  check('deleting a parent clears dangling refs; missing parents are rejected',
    res.parentOrder.afterDelete.childParent == null && res.parentOrder.rejectMissing === true,
    JSON.stringify(res.parentOrder));
  check('same-block multi-keyframe edit syncs to all selected keyframes',
    res.multiKf.summary === '已选择 2 个关键帧' &&
    res.multiKf.form === true &&
    res.multiKf.syncTop >= 3 &&
    res.multiKf.opacityBefore === '多个数值' &&
    res.multiKf.after.k0 === 0.8 && res.multiKf.after.k1 === 0.8,
    JSON.stringify(res.multiKf));
  check('order input edits directly: overlap rejected, new order track created, non-overlap shares track',
    res.orderEdit.editable === true &&
    res.orderEdit.overlap.order === 1 &&
    res.orderEdit.overlap.badges[0] === '1' &&
    res.orderEdit.newOrder.order === 3 &&
    res.orderEdit.newOrder.groups.some((l) => l.includes('spOA')) &&
    res.orderEdit.newOrder.badges[0] === '3' &&
    res.orderEdit.shared.order === 0 &&
    JSON.stringify(res.orderEdit.shared.groups) === JSON.stringify([['spOY', 'spOX']]) &&
    JSON.stringify(res.orderEdit.shared.badges) === JSON.stringify(['0']),
    JSON.stringify(res.orderEdit));
  check('multi-select up/down moves each selected time block individually (no whole-layer move)',
    res.batchShift.upAdj.u1 === 1 && res.batchShift.upAdj.u2 === 2 && res.batchShift.upAdj.u3 === 0 &&
    res.batchShift.upGap.g1 === 2 && res.batchShift.upGap.g2 === 0 && res.batchShift.upGap.g3 === 1 &&
    res.batchShift.down.d1 === 2 && res.batchShift.down.d2 === 0 && res.batchShift.down.d3 === 1,
    JSON.stringify(res.batchShift));
  check('merged-track up/down moves only the selected block (lane-mates stay)',
    res.mergedMove.ma === 2 && res.mergedMove.mx === 2 && res.mergedMove.my === 1 && res.mergedMove.mb === 0 &&
    JSON.stringify(res.mergedMove.groups) === JSON.stringify([['spMx', 'spMA'], ['spMy'], ['spMB']]) &&
    res.mergedMove.overlap.ca === 1 && res.mergedMove.overlap.cx === 2,
    JSON.stringify(res.mergedMove));
  check('unit dropdown switch converts values while keeping positions (single + multi)',
    typeof res.unitConv.x === 'string' && res.unitConv.x.startsWith('notex:') &&
    res.unitConv.valueChanged === true &&
    Math.abs(res.unitConv.posAfter.x - res.unitConv.posBefore.x) < 0.5 &&
    Math.abs(res.unitConv.posAfter.y - res.unitConv.posBefore.y) < 0.5 &&
    String(res.unitConv.multi.xa).startsWith('notex:') &&
    String(res.unitConv.multi.xb).startsWith('notex:') &&
    Math.abs(res.unitConv.multi.posA.after.x - res.unitConv.multi.posA.before.x) < 0.5 &&
    Math.abs(res.unitConv.multi.posB.after.x - res.unitConv.multi.posB.before.x) < 0.5,
    JSON.stringify(res.unitConv));
  check('multi-keyframe preview drag syncs to all selected keyframes (line + stage xy)',
    res.multiKfDrag.equal === true &&
    res.multiKfDrag.k0xv > 120 &&
    res.multiKfDrag.k1xv > 130 &&
    res.multiKfDrag.base.x === 'stagex:100' &&
    res.multiKfDrag.line.equal === true &&
    res.multiKfDrag.line.k0x > 0.2 &&
    res.multiKfDrag.line.k1x > 0.2,
    JSON.stringify(res.multiKfDrag));
  check('copying a stage object re-assigns a fresh top order (no duplicate order track)',
    res.copyOrder.clone != null &&
    res.copyOrder.clone.layer === 2 &&
    res.copyOrder.clone.order === 0 &&
    res.copyOrder.clone.kfOrder === 0 &&
    res.copyOrder.unique === true &&
    Array.isArray(res.copyOrder.topLane) && res.copyOrder.topLane.length === 1 &&
    res.copyOrder.topLane[0] === res.copyOrder.clone.id,
    JSON.stringify(res.copyOrder));
  check('timeline header batch lock (stage / layer / controller / note_controller)',
    res.catLock.stageAll === true &&
    res.catLock.stageUnlockAll === false &&
    res.catLock.layer1Only === true &&
    res.catLock.layer0Free === true &&
    res.catLock.ctrlOnly === true &&
    res.catLock.ncOnly === true,
    JSON.stringify(res.catLock));

  fs.writeFileSync(path.join(__dirname, 'probe_stage_features_out.json'), JSON.stringify({ checks: out.checks, ok: out.ok, debug: res }, null, 2));
  console.log('STAGE_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_stage_features_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
