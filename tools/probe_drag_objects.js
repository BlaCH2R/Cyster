// Verify preview object dragging: sprites / line bodies & endpoints / texts /
// note_controller-overridden notes move with the mouse, converted into the
// coordinate system each object currently uses (stagex/stagey, world, ...),
// and keyframes are created at the playhead when it is not on one.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_drag_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_drag_');

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
    const canvas = document.getElementById('previewCanvas');
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const unit = (v, def) => {
      if (v == null) return { value: 0, unit: def };
      if (typeof v === 'number') return { value: v, unit: def };
      if (typeof v === 'object') return { value: Number(v.value) || 0, unit: v.unit || def };
      const s = String(v);
      const i = s.indexOf(':');
      return i < 0
        ? { value: parseFloat(s) || 0, unit: def }
        : { value: parseFloat(s.slice(i + 1)) || 0, unit: s.slice(0, i).toLowerCase() };
    };
    // 复制 app 的网格吸附规则，用于推导期望值（stage 对象拖拽会吸附）。
    const snapPx = (px, py, W, H) => {
      const cellX = Math.max(20, Math.round(W / 16));
      const cellY = Math.max(20, Math.round(H / 12));
      let x = px, y = py;
      const gx = Math.round(px / cellX) * cellX;
      if (Math.abs(px - gx) <= 5) x = gx;
      const gy = Math.round(py / cellY) * cellY;
      if (Math.abs(py - gy) <= 5) y = gy;
      return { x, y };
    };
    const stageValueAt = (cx, cy, W, H) => ({
      x: (cx - W / 2) / (W / 800),
      y: (H / 2 - cy) / (H / 600)
    });

    // Canvas point -> client coordinates (canvas uses dpr scaling).
    const toClient = (px, py) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + px / canvas.width * rect.width,
        y: rect.top + py / canvas.height * rect.height
      };
    };

    const drag = (pFrom, pTo) => {
      const a = toClient(pFrom.x, pFrom.y);
      const b = toClient(pTo.x, pTo.y);
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: a.x, clientY: a.y }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: b.x, clientY: b.y }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: b.x, clientY: b.y }));
    };

    const stageCenter = (obj, st) => {
      const info = preview.ctxInfo();
      return preview.stageOriginPx(obj, st, info, unit(st.x, 'stagex'), unit(st.y, 'stagey'));
    };
    const worldPx = (xu, yu, zu) => preview.worldUnitPx(xu, yu, zu, preview.ctxInfo());
    const setSb = (storyboard, time) => {
      S.storyboard = storyboard;
      window.__sb.refreshAll();
      window.__sb.setTime(time != null ? time : 0);
    };

    // ------------------------------------------------------------------
    // 1) Sprite drag in stagex/stagey at a keyframe
    // ------------------------------------------------------------------
    let sp1 = { id: 'sp1', time: 0, path: 'title.png', x: 'stagex:400', y: 'stagey:300', width: 100, height: 100, opacity: 1 };
    setSb({ sprites: [sp1], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const W = canvas.width, H = canvas.height;
    const c1 = stageCenter(sp1, sp1);
    S.pickMode = 'sprite';
    drag(c1, { x: c1.x + 100 * W / 800, y: c1.y + 50 * H / 600 });
    await sleep(120);
    out.sp1x = sp1.x; out.sp1y = sp1.y;
    const c1b = stageCenter(sp1, sp1);
    const snap1 = snapPx(c1.x + 100 * W / 800, c1.y + 50 * H / 600, W, H);
    out.sp1AtMouse = Math.hypot(c1b.x - snap1.x, c1b.y - snap1.y);
    out.sp1states = (sp1.states || []).length;

    // ------------------------------------------------------------------
    // 2) Sprite drag between keyframes creates a keyframe at the playhead
    // ------------------------------------------------------------------
    let sp2 = { id: 'sp2', time: 0, path: 'title.png', x: 'stagex:200', y: 'stagey:100', width: 80, height: 80, opacity: 1 };
    setSb({ sprites: [sp2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    window.__sb.setTime(2.5);
    await sleep(120);
    const c2 = stageCenter(sp2, sp2);
    S.pickMode = 'sprite';
    drag(c2, { x: c2.x + 50 * W / 800, y: c2.y });
    await sleep(120);
    out.sp2Initial = { x: sp2.x, y: sp2.y };
    out.sp2kf = sp2.states && sp2.states.length ? { time: sp2.states[0].time, x: sp2.states[0].x, y: sp2.states[0].y } : null;

    // ------------------------------------------------------------------
    // 3) Text drag
    // ------------------------------------------------------------------
    let tx1 = { id: 'tx1', time: 0, text: 'Hi', x: 'stagex:-200', y: 'stagey:-100', size: 32, opacity: 1 };
    setSb({ sprites: [], texts: [tx1], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const c3 = stageCenter(tx1, tx1);
    S.pickMode = 'text';
    drag(c3, { x: c3.x + 300 * W / 800, y: c3.y - 200 * H / 600 });
    await sleep(120);
    out.tx1x = tx1.x; out.tx1y = tx1.y;

    // ------------------------------------------------------------------
    // 4) Line body drag moves every endpoint (per-endpoint unit conversion)
    // ------------------------------------------------------------------
    let ln1 = {
      id: 'ln1', time: 0, opacity: 1,
      pos: [{ x: 'stagex:-400', y: 'stagey:100' }, { x: 'stagex:400', y: 'stagey:100' }],
      states: [{ time: 10, pos: [{ x: 'stagex:-400', y: 'stagey:100' }, { x: 'stagex:400', y: 'stagey:100' }] }]
    };
    setSb({ sprites: [], texts: [], videos: [], lines: [ln1], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const e0 = worldPx(unit(ln1.pos[0].x, 'notex'), unit(ln1.pos[0].y, 'notey'), unit(ln1.pos[0].z, 'world'));
    const e1 = worldPx(unit(ln1.pos[1].x, 'notex'), unit(ln1.pos[1].y, 'notey'), unit(ln1.pos[1].z, 'world'));
    const mid = { x: (e0.x + e1.x) / 2, y: (e0.y + e1.y) / 2 };
    S.pickMode = 'line';
    drag(mid, { x: mid.x + 80 * W / 800, y: mid.y });
    await sleep(120);
    out.ln1pos = JSON.parse(JSON.stringify(ln1.pos));
    out.ln1screenAfter = [
      worldPx(unit(ln1.pos[0].x, 'notex'), unit(ln1.pos[0].y, 'notey'), unit(ln1.pos[0].z, 'world')),
      worldPx(unit(ln1.pos[1].x, 'notex'), unit(ln1.pos[1].y, 'notey'), unit(ln1.pos[1].z, 'world'))
    ];
    out.ln1expectScreen = [e0, e1].map((p) => ({ x: p.x + 80 * W / 800, y: p.y }));

    // ------------------------------------------------------------------
    // 5) Line endpoint drag moves only the grabbed endpoint
    // ------------------------------------------------------------------
    let ln2 = {
      id: 'ln2', time: 0, opacity: 1,
      pos: [{ x: 'stagex:-400', y: 'stagey:100' }, { x: 'stagex:400', y: 'stagey:100' }],
      states: [{ time: 10, pos: [{ x: 'stagex:-400', y: 'stagey:100' }, { x: 'stagex:400', y: 'stagey:100' }] }]
    };
    setSb({ sprites: [], texts: [], videos: [], lines: [ln2], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const f0 = worldPx(unit(ln2.pos[0].x, 'notex'), unit(ln2.pos[0].y, 'notey'), unit(ln2.pos[0].z, 'world'));
    S.pickMode = 'line';
    drag(f0, { x: f0.x + 100 * W / 800, y: f0.y });
    await sleep(120);
    out.ln2pos = JSON.parse(JSON.stringify(ln2.pos));

    // ------------------------------------------------------------------
    // 6) Note with note_controller override X+Y (world units) drags the NC
    // ------------------------------------------------------------------
    const note = S.chart.notes.find((n) => n.type === 0 && n.start_time > n.intro_time + 0.05) || S.chart.notes[0];
    const nt = Math.max(note.intro_time, note.start_time - 0.01);
    let nc1 = { id: 'nc1', note: note.id, time: 0, override_x: true, override_y: true, x: 'world:2', y: 'world:2' };
    setSb({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [nc1], templates: {} }, nt);
    await sleep(150);
    const npos = preview.notePos(note, preview.ctxInfo());
    const S0 = preview.ctxInfo().S;
    S.pickMode = 'note';
    const ndx = 100, ndy = 50;
    drag(npos, { x: npos.x + ndx, y: npos.y + ndy });
    await sleep(150);
    out.nc1 = {
      x: unit(nc1.states && nc1.states[0] ? nc1.states[0].x : nc1.x, 'world').value,
      y: unit(nc1.states && nc1.states[0] ? nc1.states[0].y : nc1.y, 'world').value,
      expX: 2 + ndx / S0,
      expY: 2 - ndy / S0
    };
    const nposB = preview.notePos(note, preview.ctxInfo());
    out.noteAtMouse = Math.hypot(nposB.x - (npos.x + ndx), nposB.y - (npos.y + ndy));

    // ------------------------------------------------------------------
    // 7) Note with only override_x: vertical drag leaves y untouched
    // ------------------------------------------------------------------
    let nc2 = { id: 'nc2', note: note.id, time: 0, override_x: true, override_y: false, x: 'world:2', y: 'world:2' };
    setSb({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [nc2], templates: {} }, nt);
    await sleep(150);
    const npos2 = preview.notePos(note, preview.ctxInfo());
    S.pickMode = 'note';
    drag(npos2, { x: npos2.x + 60, y: npos2.y + 120 });
    await sleep(150);
    out.nc2 = JSON.parse(JSON.stringify({
      S0: S0,
      x: unit(nc2.states && nc2.states[0] ? nc2.states[0].x : nc2.x, 'world').value,
      y: unit(nc2.states && nc2.states[0] ? nc2.states[0].y : nc2.y, 'world').value
    }));

    // ------------------------------------------------------------------
    // 8) Multi-select: dragging one selected sprite moves the whole batch
    // ------------------------------------------------------------------
    let spA = { id: 'spA', time: 0, path: 'title.png', x: 'stagex:100', y: 'stagey:100', width: 60, height: 60, opacity: 1 };
    let spB = { id: 'spB', time: 0, path: 'title.png', x: 'stagex:500', y: 'stagey:400', width: 60, height: 60, opacity: 1 };
    setSb({ sprites: [spA, spB], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['spA', 'spB'];
    S.selectedObjId = 'spA';
    S.selectedKfs = [];
    const cA = stageCenter(spA, spA);
    S.pickMode = 'sprite';
    out.batchSelBefore = S.selectedIds.slice();
    out.batchHit = preview.hitTestPick(cA.x, cA.y, 'sprite', null);
    drag(cA, { x: cA.x + 100 * W / 800, y: cA.y });
    await sleep(120);
    out.batch = { a: { x: spA.x, y: spA.y }, b: { x: spB.x, y: spB.y } };
    out.batchSelAfter = S.selectedIds.slice();
    out.W = W; out.H = H;

    // ------------------------------------------------------------------
    // 9) Parented sprite (parent rot_z 45): the child follows the mouse
    // ------------------------------------------------------------------
    let spP = { id: 'spP', time: 0, path: 'title.png', x: 'stagex:0', y: 'stagey:0', width: 200, height: 200, rot_z: 45, opacity: 1 };
    let spC = { id: 'spC', time: 0, parent_id: 'spP', path: 'title.png', x: 'stagex:100', y: 'stagey:100', width: 60, height: 60, opacity: 1 };
    setSb({ sprites: [spP, spC], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const cC = stageCenter(spC, spC);
    S.pickMode = 'sprite';
    drag(cC, { x: cC.x + 120 * W / 800, y: cC.y + 60 * H / 600 });
    await sleep(120);
    const cCb = stageCenter(spC, spC);
    const snap9 = snapPx(cC.x + 120 * W / 800, cC.y + 60 * H / 600, W, H);
    out.parentedAtMouse = Math.hypot(cCb.x - snap9.x, cCb.y - snap9.y);
    out.parentedSnap = { target: { x: cC.x + 120 * W / 800, y: cC.y + 60 * H / 600 }, snap: snap9, final: cCb };
    out.parentedHit = preview.hitTestPick(cC.x, cC.y, 'sprite', null);
    out.parentedEvalIds = preview.evalResult.sprites.map((s) => s.obj.id);
    out.parentedRaw = { p: { x: spP.x, y: spP.y }, c: { x: spC.x, y: spC.y } };
    const basisC = preview.stageOriginDragBasis(spC, spC, preview.ctxInfo(), unit(spC.x, 'stagex'), unit(spC.y, 'stagey'));
    const solve2 = (dx, dy, bx, by) => {
      const det = bx.x * by.y - bx.y * by.x;
      if (Math.abs(det) < 1e-9) {
        const lx = bx.x * bx.x + bx.y * bx.y;
        const ly = by.x * by.x + by.y * by.y;
        return { x: lx > 1e-12 ? (dx * bx.x + dy * bx.y) / lx : 0, y: ly > 1e-12 ? (dx * by.x + dy * by.y) / ly : 0 };
      }
      return { x: (dx * by.y - dy * by.x) / det, y: (bx.x * dy - bx.y * dx) / det };
    };
    const dC = solve2(120 * W / 800, 60 * H / 600, basisC.bx, basisC.by);
    out.parentedExpected = { x: 100 + dC.x, y: 100 + dC.y, d: dC, basis: basisC };
    out.parentedActual = { x: spC.x, y: spC.y };
    out.parentedWH = { W, H };

    // ------------------------------------------------------------------
    // 10) Rotated camera (rot_z 30): a line endpoint follows the mouse
    // ------------------------------------------------------------------
    let cam1 = { id: 'cam1', time: 0, rot_z: 30 };
    let ln3 = {
      id: 'ln3', time: 0, opacity: 1,
      pos: [{ x: 'world:1', y: 'world:1' }, { x: 'world:3', y: 'world:1' }],
      states: [{ time: 10, pos: [{ x: 'world:1', y: 'world:1' }, { x: 'world:3', y: 'world:1' }] }]
    };
    setSb({ sprites: [], texts: [], videos: [], lines: [ln3], controllers: [cam1], note_controllers: [], templates: {} });
    await sleep(120);
    const g0 = worldPx(unit(ln3.pos[0].x, 'notex'), unit(ln3.pos[0].y, 'notey'), unit(ln3.pos[0].z, 'world'));
    S.pickMode = 'line';
    const target10 = { x: g0.x + 150, y: g0.y + 90 };
    drag(g0, target10);
    await sleep(120);
    const g0b = worldPx(unit(ln3.pos[0].x, 'notex'), unit(ln3.pos[0].y, 'notey'), unit(ln3.pos[0].z, 'world'));
    out.rotCamAtMouse = Math.hypot(g0b.x - target10.x, g0b.y - target10.y);

    // ------------------------------------------------------------------
    // 11) Plain click (no movement) on a draggable object mutates nothing
    // ------------------------------------------------------------------
    let sp3 = { id: 'sp3', time: 0, path: 'title.png', x: 'stagex:0', y: 'stagey:0', width: 60, height: 60, opacity: 1 };
    setSb({ sprites: [sp3], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    const c3b = stageCenter(sp3, sp3);
    S.pickMode = 'sprite';
    const cl = toClient(c3b.x, c3b.y);
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: cl.x, clientY: cl.y }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: cl.x, clientY: cl.y }));
    await sleep(120);
    out.clickNoDrag = { x: sp3.x, y: sp3.y, states: (sp3.states || []).length };

    // ------------------------------------------------------------------
    // 12) Note WITHOUT override is not draggable (NC untouched by a drag)
    // ------------------------------------------------------------------
    let nc3 = { id: 'nc3', note: note.id, time: 0, override_x: false, override_y: false, x: 'world:2', y: 'world:2' };
    setSb({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [nc3], templates: {} }, nt);
    await sleep(150);
    const npos3 = preview.notePos(note, preview.ctxInfo());
    S.pickMode = 'note';
    drag(npos3, { x: npos3.x + 60, y: npos3.y + 60 });
    await sleep(150);
    out.nc3 = JSON.parse(JSON.stringify({ x: nc3.x, y: nc3.y, states: (nc3.states || []).length }));

    return out;
  })()`);

  const r = res;
  check('sprite drag stagex/stagey (grid-snapped)', r.sp1x === 500 && r.sp1y === 'stagey:300' && r.sp1states === 0,
    JSON.stringify({ x: r.sp1x, y: r.sp1y, states: r.sp1states }));
  check('sprite center lands on the snapped grid point', r.sp1AtMouse < 1.2, r.sp1AtMouse);
  check('sprite drag between keyframes creates keyframe',
    r.sp2Initial.x === 'stagex:200' && r.sp2Initial.y === 'stagey:100' &&
    r.sp2kf && r.sp2kf.time === 2.5 && r.sp2kf.x === 200 && r.sp2kf.y === 100,
    JSON.stringify(r.sp2Initial) + ' -> ' + JSON.stringify(r.sp2kf));
  check('text drag (grid-snapped)', r.tx1x === 100 && r.tx1y === 100, JSON.stringify({ x: r.tx1x, y: r.tx1y }));
  check('line body drag moves both endpoints',
    r.ln1pos.length === 2 && r.ln1pos[0].x === 'stagex:-240' && r.ln1pos[0].y === 'stagey:100' && r.ln1pos[1].x === 'stagex:560' && r.ln1pos[1].y === 'stagey:100',
    JSON.stringify(r.ln1pos));
  check('line endpoint drag moves only grabbed endpoint',
    r.ln2pos[0].x === 'stagex:-200' && r.ln2pos[0].y === 'stagey:100' && r.ln2pos[1].x === 'stagex:400' && r.ln2pos[1].y === 'stagey:100',
    JSON.stringify(r.ln2pos));
  check('note controller X+Y drag (world units)',
    r.nc1 && Math.abs(r.nc1.x - r.nc1.expX) < 0.01 && Math.abs(r.nc1.y - r.nc1.expY) < 0.01,
    JSON.stringify(r.nc1));
  check('note lands on mouse', r.noteAtMouse < 1.5, r.noteAtMouse);
  check('note with only override_x ignores vertical drag',
    r.nc2 && Math.abs(r.nc2.x - 2 - 60 / r.nc2.S0) < 0.05 && Math.abs(r.nc2.y - 2) < 1e-6,
    JSON.stringify(r.nc2));
  check('multi-select batch drag moves both sprites',
    r.batch.a.x === 200 && r.batch.a.y === 'stagey:100' && r.batch.b.x === 600 && r.batch.b.y === 'stagey:400',
    JSON.stringify(r.batch));
  check('parented sprite follows mouse', r.parentedAtMouse < 1.5, r.parentedAtMouse);
  check('line endpoint follows mouse under camera rot_z', r.rotCamAtMouse < 1.5, r.rotCamAtMouse);
  check('click without drag mutates nothing', r.clickNoDrag.x === 'stagex:0' && r.clickNoDrag.y === 'stagey:0' && r.clickNoDrag.states === 0,
    JSON.stringify(r.clickNoDrag));
  check('note without override is not draggable', r.nc3.x === 'world:2' && r.nc3.y === 'world:2' && r.nc3.states === 0, JSON.stringify(r.nc3));

  fs.writeFileSync(path.join(__dirname, 'probe_drag_objects_out.json'), JSON.stringify({ checks: out.checks, ok: out.ok, debug: res }, null, 2));
  console.log('DRAG_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_drag_objects_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
