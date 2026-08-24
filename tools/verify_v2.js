// verify_v2.js — exercises the v0.1beta UI overhaul:
//   menu bar (文件/编辑/设置), panel splitters, timeline playhead clamp,
//   context menu dismissal, undo/redo, tag-based object creation,
//   clip resize, storyboard export purity, file switching, multi-difficulty.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

// Isolate userData so concurrent/leftover processes can't lock settings.json.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_v2_ud_')));

require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_v2_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, name: c.name, path: c.path,
    difficulty: c.difficulty,
    musicOverride: c.music_override ? c.music_override.path : null,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
      : null
  }));
  const files = fs.readdirSync(dir)
    .filter((n) => fs.statSync(path.join(dir, n)).isFile())
    .map((name) => ({ name, size: fs.statSync(path.join(dir, name)).size }));
  return { level, levelDir: dir, files, charts };
}

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e, level, message) => {
    if (level >= 2 || /error|uncaught/i.test(message)) console.log('RENDERER:', message);
  });
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Menu bar present; dropdown opens and closes on outside click
  const menu = await win.webContents.executeJavaScript(`(async () => {
    const items = Array.from(document.querySelectorAll('.menu-item'));
    const first = items.find(m => m.dataset.menu === 'file');
    first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    const opened = first.classList.contains('open');
    const entries = Array.from(document.querySelectorAll('.menu-entry')).map(e => e.dataset.action);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const closed = !first.classList.contains('open');
    return { opened, entries, closed };
  })()`);
  check('menu bar opens/closes', menu.opened && menu.closed && menu.entries.length > 10, JSON.stringify(menu));

  // 2. Timeline tag "+" creates object at playhead; undo removes it; redo re-adds
  const tagAdd = await win.webContents.executeJavaScript(`(async () => {
    window.__sb.setTime(12.345, false);
    // Sprite creation now requires an image in the library (matches the app)
    const bg = window.__sb.state.level.background && window.__sb.state.level.background.path;
    if (bg && !window.__sb.state.manualImages.includes(bg)) window.__sb.state.manualImages.push(bg);
    window.__sb.refreshAll();
    await new Promise(r => setTimeout(r, 100));
    const before = (window.__sb.state.storyboard.sprites || []).length;
    const btn = document.querySelector('#objectAddList .oa-row:nth-child(1) .oa-add');
    btn.click();
    await new Promise(r => setTimeout(r, 150));
    const afterAdd = (window.__sb.state.storyboard.sprites || []).length;
    const added = (window.__sb.state.storyboard.sprites || []).slice(-1)[0];
    const atPlayhead = added && Math.abs(added.time - 12.345) < 0.001;
    const undoBtn = Array.from(document.querySelectorAll('.menu-entry')).find(e => e.dataset.action === 'undo');
    undoBtn.click();
    await new Promise(r => setTimeout(r, 150));
    const afterUndo = (window.__sb.state.storyboard.sprites || []).length;
    const redoBtn = Array.from(document.querySelectorAll('.menu-entry')).find(e => e.dataset.action === 'redo');
    redoBtn.click();
    await new Promise(r => setTimeout(r, 150));
    const afterRedo = (window.__sb.state.storyboard.sprites || []).length;
    return { before, afterAdd, afterUndo, afterRedo, atPlayhead, id: added && added.id };
  })()`);
  check('tag + creates sprite at playhead', tagAdd.afterAdd === tagAdd.before + 1 && tagAdd.atPlayhead, JSON.stringify(tagAdd));
  check('undo restores / redo re-adds', tagAdd.afterUndo === tagAdd.before && tagAdd.afterRedo === tagAdd.before + 1, JSON.stringify(tagAdd));

  // 3. Panel splitters resize left/right/timeline
  const split = await win.webContents.executeJavaScript(`(async () => {
    const left = document.getElementById('leftPanel');
    const right = document.getElementById('rightPanel');
    const tl = document.getElementById('timeline');
    const t0 = tl.getBoundingClientRect().height;
    const main = document.getElementById('main').getBoundingClientRect();
    const splitL = document.getElementById('splitL');
    splitL.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: splitL.getBoundingClientRect().left + 2, clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: main.left + 380, clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const l1 = left.getBoundingClientRect().width;
    const splitR = document.getElementById('splitR');
    splitR.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: splitR.getBoundingClientRect().left + 2, clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: main.right - 420, clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const r1 = right.getBoundingClientRect().width;
    const splitT = document.getElementById('splitT');
    splitT.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 700, clientY: splitT.getBoundingClientRect().top + 2 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 700, clientY: main.bottom - 320 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const t1 = tl.getBoundingClientRect().height;
    return { l1: Math.round(l1), r1: Math.round(r1), t0: Math.round(t0), t1: Math.round(t1) };
  })()`);
  check('splitters resize panels',
    Math.abs(split.l1 - 380) < 12 && Math.abs(split.r1 - 420) < 12 && split.t1 > split.t0,
    JSON.stringify(split));

  // 4. Playhead and snap-line clamp at the label-column edge
  const clamp = await win.webContents.executeJavaScript(`(() => {
    window.__sb.timeline.setTime(0);
    const ph = window.__sb.timeline.playhead.style.left;
    window.__sb.timeline.showSnapLine(0);
    const sl = window.__sb.timeline.snapLine.style.left;
    return { ph, sl };
  })()`);
  check('playhead/snapline clamp at label edge', clamp.ph === '190px' && clamp.sl === '190px', JSON.stringify(clamp));

  // 4b. Dragging the playhead handle cannot enter the label column either
  const dragPh = await win.webContents.executeJavaScript(`(async () => {
    window.__sb.timeline.setTime(3);
    const tl = window.__sb.timeline;
    const ph = tl.playhead;
    ph.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 20, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return { time: window.__sb.timeline.time, left: ph.style.left };
  })()`);
  check('playhead drag clamps to label edge', dragPh.time === 0 && dragPh.left === '190px', JSON.stringify(dragPh));

  // 4c. Timeline right edge limited to the music/chart length
  const rightEdge = await win.webContents.executeJavaScript(`(() => {
    const tl = window.__sb.timeline;
    // At a high zoom the music end extends past the viewport; the content must
    // then end exactly at the music length (plus a small 20px margin) so the
    // user can never scroll past it.
    tl.setZoom(200);
    const viewport = tl.scroll.clientWidth;
    const musicEndPx = 190 + tl.duration * tl.pxPerSec + 20;
    const cw = tl.contentWidth();
    const scrollable = cw - viewport;
    return { cw, musicEndPx: Math.round(musicEndPx), viewport, scrollable: Math.round(scrollable), ok: cw <= Math.ceil(musicEndPx) };
  })()`);
  check('timeline right edge limited to music length', rightEdge.ok, JSON.stringify(rightEdge));

  // 4d. Duplicate / delete selected via Edit menu
  const dupDel = await win.webContents.executeJavaScript(`(async () => {
    const sb = window.__sb.state.storyboard;
    const before = (sb.sprites || []).length;
    const target = sb.sprites[0];
    window.__sb.state.selectedObjId = target.id;
    const dup = Array.from(document.querySelectorAll('.menu-entry')).find(e => e.dataset.action === 'duplicate-selected');
    dup.click();
    await new Promise(r => setTimeout(r, 120));
    const afterDup = (sb.sprites || []).length;
    const dupId = window.__sb.state.selectedObjId;
    const hasDup = (sb.sprites || []).some(o => o.id === dupId);
    const del = Array.from(document.querySelectorAll('.menu-entry')).find(e => e.dataset.action === 'delete-selected');
    del.click();
    await new Promise(r => setTimeout(r, 120));
    const afterDel = (sb.sprites || []).length;
    return { before, afterDup, afterDel, dupId, hasDup };
  })()`);
  check('edit menu duplicate/delete selected',
    dupDel.afterDup === dupDel.before + 1 && dupDel.hasDup && dupDel.afterDel === dupDel.before,
    JSON.stringify(dupDel));

  // 5. Context menu: show on note right-click, dismiss on outside click, execute item
  const ctx = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = window.__sb.preview;
      const canvas = document.getElementById('previewCanvas');
      const note = p.chart.notes.find(n => n.type === 0) || p.chart.notes[0];
      window.__sb.setTime(note.start_time, false);
      await new Promise(r => setTimeout(r, 60));
      const info = p.ctxInfo();
      const pos = p.noteScreenPos(note, info);
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + pos.x / canvas.width * rect.width;
      const cy = rect.top + pos.y / canvas.height * rect.height;
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: cx, clientY: cy }));
      await new Promise(r => setTimeout(r, 100));
      const menu = document.getElementById('contextMenu');
      const shown = !menu.classList.contains('hidden') && menu.children.length >= 4;
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 5, clientY: 5 }));
      await new Promise(r => setTimeout(r, 80));
      const closedOutside = menu.classList.contains('hidden');
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: cx, clientY: cy }));
      await new Promise(r => setTimeout(r, 80));
      const items = Array.from(menu.children).filter(c => c.classList.contains('cm-item'));
      // Click the last item ("跳转至 note 的 intro 时间") — no clipboard involved
      const last = items[items.length - 1];
      last.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy }));
      last.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 80));
      const closedAfterAction = menu.classList.contains('hidden');
      return { shown, closedOutside, closedAfterAction, itemCount: items.length, time: window.__sb.preview.time };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('context menu show/dismiss/execute',
    !ctx.err && ctx.shown && ctx.closedOutside && ctx.closedAfterAction && ctx.itemCount >= 4,
    JSON.stringify(ctx));

  // 6. Clip resize drag adjusts the start edge (snapped)
  const resizeTest = await win.webContents.executeJavaScript(`(async () => {
    try {
      // Use a clean object so the block edges are unambiguous
      window.__sb.state.storyboard.texts = window.__sb.state.storyboard.texts || [];
      window.__sb.state.storyboard.texts.push({
        id: 'resize_test', time: 10, text: 'R', opacity: 1, layer: 1, order: 0,
        states: [{ time: 14, opacity: 1 }]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      const tl = window.__sb.timeline;
      const obj = tl.objects.find(o => o.id === 'resize_test');
      if (!obj) return { err: 'resize_test missing' };
      const before = obj.clipStart;
      tl.startResizeClip({ preventDefault() {}, clientX: 100 }, obj, 'start');
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100 + 2 * tl.pxPerSec }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      const after = window.__sb.timeline.objects.find(o => o.id === 'resize_test').clipStart;
      return { before, after, moved: Math.abs(after - before - 2) < 0.2 };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('clip resize drag adjusts start', !resizeTest.err && resizeTest.moved, JSON.stringify(resizeTest));

  // 6b. Drag a library asset onto the preview -> creates a 3-second sprite
  const dropTest = await win.webContents.executeJavaScript(`(async () => {
    try {
      const bg = window.__sb.state.level.background && window.__sb.state.level.background.path;
      const candidates = (window.__sb.state.files || []).filter(f => /\\.(png|jpg|jpeg)$/i.test(f.name));
      const name = bg || (candidates.length ? candidates[0].name : null);
      if (!name) return { err: 'no image asset' };
      if (!window.__sb.state.manualImages.includes(name)) window.__sb.state.manualImages.push(name);
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 120));
      const item = Array.from(document.querySelectorAll('.asset-item')).find(i => i.querySelector('.nm') && i.querySelector('.nm').textContent === name);
      if (!item) return { err: 'asset item not rendered' };
      window.__sb.setTime(8.888, false);
      const wrap = document.getElementById('previewWrap');
      const rect = wrap.getBoundingClientRect();
      const dt = new DataTransfer();
      dt.setData('text/asset-name', name);
      wrap.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      wrap.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.5,
        dataTransfer: dt
      }));
      await new Promise(r => setTimeout(r, 150));
      const sprites = window.__sb.state.storyboard.sprites || [];
      const added = sprites[sprites.length - 1];
      return {
        ok: !!added && added.path === name && Math.abs(added.time - 8.888) < 0.01 &&
          added.states && added.states.length === 1 && Math.abs(added.states[0].time - (8.888 + 3)) < 0.01,
        time: added && added.time,
        stateTime: added && added.states && added.states[0] && added.states[0].time,
        path: added && added.path
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('asset drag onto preview creates 3s sprite', dropTest.ok, JSON.stringify(dropTest));

  // 7. Export purity: chart_backup / templates never exported
  const exp = await win.webContents.executeJavaScript(`(() => {
    const sb = window.__sb.state.storyboard;
    sb.chart_backup = { evil: 1 };
    sb.templates = { t: 1 };
    const parsed = JSON.parse(window.__sb.storyboardJson());
    return {
      hasBackup: 'chart_backup' in parsed,
      hasTemplates: 'templates' in parsed,
      keys: Object.keys(parsed)
    };
  })()`);
  const allowedKeys = ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers'];
  check('export only storyboard body',
    !exp.hasBackup && !exp.hasTemplates && exp.keys.every((k) => allowedKeys.includes(k)),
    JSON.stringify(exp));

  // 8. File switching via projectUpdateFile (chart + music), then reload
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_switch_dir_'));
  const projPath = path.join(projDir, 'SwitchTest.ctdsber');
  const musicAbs = path.join(PLAYER, info.level.music && info.level.music.path || '');
  const chartAbs = path.join(PLAYER, info.charts[0].path);
  const chart2Abs = path.join(PLAYER, 'chart_switch_test.json');
  fs.writeFileSync(chart2Abs, fs.readFileSync(chartAbs), 'utf8');
  const music2Abs = path.join(PLAYER, 'music_switch' + path.extname(musicAbs));
  fs.copyFileSync(musicAbs, music2Abs);
  const sbAbs = info.charts[0].storyboardPath ? path.join(PLAYER, info.charts[0].storyboardPath) : null;

  const switchTest = await win.webContents.executeJavaScript(`(async () => {
    try {
      const res = await window.sbAPI.projectCreate({
        projectPath: ${JSON.stringify(projPath)},
        name: 'SwitchTest',
        music: ${JSON.stringify(musicAbs)},
        chart: ${JSON.stringify(chartAbs)},
        storyboard: ${JSON.stringify(sbAbs)}
      });
      if (!res) return { err: 'create failed' };
      await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
      const firstChartPath = window.__sb.state.level.charts[0].path;
      const firstEnd = window.__sb.state.chart ? window.__sb.state.chart.endTime : null;
      const firstParsed = !!window.__sb.state.chart;
      const contentLen = res.info.charts[0] ? res.info.charts[0].content.length : -1;
      const chartTextLen = window.__sb.state.chartText ? window.__sb.state.chartText.length : -1;
      const firstAudioReady = window.__sb.state.audioReady;
      const u1 = await window.sbAPI.projectUpdateFile({
        projectPath: res.projectPath, kind: 'chart', filePath: ${JSON.stringify(chart2Abs)}
      });
      if (!u1) return { err: 'chart switch failed' };
      await window.__sb.loadLevelInfo(u1.info, { projectPath: u1.projectPath, config: u1.config });
      const switchedChartPath = window.__sb.state.level.charts[0].path;
      const switchedEnd = window.__sb.state.chart ? window.__sb.state.chart.endTime : null;
      const switchedParsed = !!window.__sb.state.chart;
      const u2 = await window.sbAPI.projectUpdateFile({
        projectPath: res.projectPath, kind: 'music', filePath: ${JSON.stringify(music2Abs)}
      });
      if (!u2) return { err: 'music switch failed' };
      await window.__sb.loadLevelInfo(u2.info, { projectPath: u2.projectPath, config: u2.config });
      await new Promise(r => setTimeout(r, 1600)); // setupAudio is async; wait for it
      return {
        firstChartPath,
        switchedChartPath,
        firstEnd, switchedEnd, firstParsed, switchedParsed,
        contentLen, chartTextLen,
        sameChart: firstEnd != null && switchedEnd != null && Math.abs(firstEnd - switchedEnd) < 0.001,
        musicPath: window.__sb.state.musicPath,
        audioReady: window.__sb.state.audioReady,
        toasts: document.getElementById('toastWrap').textContent
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('file switching reloads chart & music',
    !switchTest.err && switchTest.switchedChartPath === 'chart_switch_test.json' && switchTest.sameChart &&
    switchTest.musicPath === 'music_switch' + path.extname(musicAbs) && switchTest.audioReady,
    JSON.stringify(switchTest));

  // 9. Multi-difficulty chooser (easy/hard/extreme)
  const multi = await win.webContents.executeJavaScript(`(async () => {
    try {
      const charts = [
        { type: 'easy', content: '{}' },
        { type: 'hard', content: '{}' },
        { type: 'extreme', content: '{}' }
      ];
      const p = window.__sb.chooseChart(charts);
      await new Promise(r => setTimeout(r, 120));
      const modalShown = !document.getElementById('modalMask').classList.contains('hidden');
      const items = document.querySelectorAll('#modalBody .pick-item').length;
      const cancelBtn = document.querySelector('#modalFoot .dlg-btn');
      if (cancelBtn) cancelBtn.click();
      const resolved = await Promise.race([p.then(() => 'resolved'), new Promise(r => setTimeout(() => r('pending'), 300))]);
      return { modalShown, items, resolved };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('multi-difficulty prompts choice', !multi.err && multi.modalShown && multi.items === 3 && multi.resolved === 'resolved', JSON.stringify(multi));

  // Screenshot for visual QA
  await win.webContents.executeJavaScript(`window.__sb.setTime(4.5, false)`);
  await new Promise((r) => setTimeout(r, 700));
  const img = await win.webContents.capturePage();
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'shots', 'shot_v2_menu.png'), img.toPNG());

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
