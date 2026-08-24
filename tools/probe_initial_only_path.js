// Verify the full-frame-sync path rule:
//   - the compiler forces every keyframe state to the object's path
//     (legacy per-state paths are ignored);
//   - the properties panel edits the path at the top (sync fields section)
//     and every keyframe stays in sync;
//   - keyframes created by the editor carry the object's path.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_iop_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_iop_');

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
  setTimeout(() => app.exit(1), 90000);
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
    const SB = window.SBEngine;
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // ------------------------------------------------------------
    // 1) Compiler: per-state paths are replaced by the initial frame path
    // ------------------------------------------------------------
    const sb = {
      sprites: [
        { id: 'sp1', time: 0, path: 'a.png', opacity: 1,
          states: [{ time: 2, path: 'b.png', opacity: 0.5 }, { time: 4, opacity: 1 }] }
      ],
      videos: [
        { id: 'vd1', time: 0, path: 'v.mp4', opacity: 1,
          states: [{ time: 3, path: 'x.mp4', opacity: 0.5 }] }
      ],
      texts: [], lines: [], controllers: [], note_controllers: [], templates: {}
    };
    const chart = S.chart;
    const compiled = new SB.storyboard.StoryboardCompiler(sb, chart).compile();
    const sp = compiled.sprites.find((x) => x.id === 'sp1');
    const vd = compiled.videos.find((x) => x.id === 'vd1');
    out.compiledPaths = {
      sp: sp.states.map((st) => st.path),
      vd: vd.states.map((st) => st.path)
    };
    out.evalPaths = {
      sp0: SB.storyboard.evaluateObject(sp, 0).from.path,
      sp2: SB.storyboard.evaluateObject(sp, 2).from.path,
      vd3: SB.storyboard.evaluateObject(vd, 3).from.path
    };

    // ------------------------------------------------------------
    // 2) 路径不再“只能初始帧改”：任意关键帧都可编辑，修改后同步到全部关键帧
    // ------------------------------------------------------------
    S.storyboard = sb;
    S.files = (S.files || []).concat([{ name: 'bg.jpg', size: 0 }]);
    window.__sb.refreshAll();
    await sleep(150);
    // 顶部全帧同步区里最后一个 select 就是 path 字段（sprite/video 均如此）。
    const lastSelect = () => Array.from(document.querySelectorAll('#syncForm select')).pop();

    // Sprite initial frame: editable.
    S.selectedObjId = 'sp1';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await sleep(120);
    const selInit = lastSelect();
    out.init = { found: !!selInit, disabled: selInit ? selInit.disabled : null, value: selInit ? selInit.value : null };

    // Sprite keyframe: editable (no initial-only restriction).
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();
    await sleep(120);
    const selKf = lastSelect();
    out.kf = {
      found: !!selKf,
      disabled: selKf ? selKf.disabled : null,
      value: selKf ? selKf.value : null // 全帧同步：显示对象本体的 path
    };
    out.kfDebug = {
      sprites: S.storyboard.sprites.length,
      sp1: JSON.stringify(S.storyboard.sprites.find((x) => x.id === 'sp1')),
      selectCount: document.querySelectorAll('#stateForm select').length,
      selectValues: Array.from(document.querySelectorAll('#stateForm select')).map((s) => s.value)
    };

    // 在关键帧 K1 上改路径 -> 对象本体与全部关键帧同步。
    const sb1 = S.storyboard;
    const spObj = sb1.sprites.find((x) => x.id === 'sp1');
    if (selKf) {
      selKf.value = 'bg.jpg';
      selKf.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.syncDebug = {
      sameRef: S.storyboard === sb1,
      sp1After: JSON.stringify(S.storyboard.sprites.find((x) => x.id === 'sp1'))
    };
    out.sync = {
      obj: spObj.path,
      kf0: spObj.states[0].path,
      kf1: spObj.states[1].path
    };

    // Video keyframe: editable.
    S.selectedObjId = 'vd1';
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();
    await sleep(120);
    const selVd = lastSelect();
    out.vd = { found: !!selVd, disabled: selVd ? selVd.disabled : null, value: selVd ? selVd.value : null };

    // ------------------------------------------------------------
    // 3) Editor-created keyframes never carry a path
    // ------------------------------------------------------------
    const sp2 = { id: 'sp2', time: 0, path: 'c.png', opacity: 1 };
    S.storyboard.sprites.push(sp2);
    window.__sb.setTime(5);
    window.__sb.addKeyframeAtPlayhead(sp2);
    out.createdKf = { hasPath: Object.prototype.hasOwnProperty.call(sp2.states[0], 'path'), time: sp2.states[0].time };

    // ------------------------------------------------------------
    // 4) The actually exported storyboard file must keep the path on every
    //    state (the raw editor keyframes may omit it, the output must not).
    // ------------------------------------------------------------
    const exported = JSON.parse(window.__sb.storyboardCompiledJson());
    const expSp1 = exported.sprites.find((x) => x.Id === 'sp1');
    const expSp2 = exported.sprites.find((x) => x.Id === 'sp2');
    const expVd1 = exported.videos.find((x) => x.Id === 'vd1');
    out.exported = {
      sp1: (expSp1.States || []).map((s) => s.Path),
      sp2: (expSp2.States || []).map((s) => s.Path),
      vd1: (expVd1.States || []).map((s) => s.Path)
    };
    return out;
  })()`);

  check('compiled sprite states all use the initial path',
    JSON.stringify(res.compiledPaths.sp) === JSON.stringify(['a.png', 'a.png', 'a.png']),
    JSON.stringify(res.compiledPaths));
  check('compiled video states all use the initial path',
    JSON.stringify(res.compiledPaths.vd) === JSON.stringify(['v.mp4', 'v.mp4']),
    JSON.stringify(res.compiledPaths));
  check('evaluated path is the initial path at every time',
    res.evalPaths.sp0 === 'a.png' && res.evalPaths.sp2 === 'a.png' && res.evalPaths.vd3 === 'v.mp4',
    JSON.stringify(res.evalPaths));
  check('path editable on the initial frame',
    res.init.found && res.init.disabled === false && res.init.value === 'a.png',
    JSON.stringify(res.init));
  check('path editable on keyframes too (shows the synced block path)',
    res.kf.found && res.kf.disabled === false && res.kf.value === 'a.png',
    JSON.stringify(res.kf));
  check('path edit at a keyframe syncs to all frames',
    res.sync.obj === 'bg.jpg' && res.sync.kf0 === 'bg.jpg' && res.sync.kf1 === 'bg.jpg',
    JSON.stringify(res.sync));
  check('video path editable on keyframes',
    res.vd.found && res.vd.disabled === false && res.vd.value === 'v.mp4',
    JSON.stringify(res.vd));
  check('editor-created keyframes carry the synced block path',
    res.createdKf.hasPath === true && res.createdKf.time === 5,
    JSON.stringify(res.createdKf));
  check('exported file keeps the path on every state (initial + editor keyframes)',
    JSON.stringify(res.exported.sp1) === JSON.stringify(['bg.jpg', 'bg.jpg', 'bg.jpg']) &&
    JSON.stringify(res.exported.sp2) === JSON.stringify(['c.png', 'c.png']) &&
    JSON.stringify(res.exported.vd1) === JSON.stringify(['v.mp4', 'v.mp4']),
    JSON.stringify(res.exported));

  fs.writeFileSync(path.join(__dirname, 'probe_initial_only_path_out.json'), JSON.stringify({ checks: out.checks, ok: out.ok, debug: res }, null, 2));
  console.log('IOP_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_initial_only_path_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
