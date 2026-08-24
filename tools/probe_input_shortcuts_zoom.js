// Verify two editor interaction fixes:
//  1. Global shortcuts (Space / ArrowLeft / ArrowRight) are disabled while
//     typing in an input / textarea / select / contentEditable.
//  2. Resizing the preview canvas (zoom slider drag) forces a repaint even
//     when the playhead did not move, so the stopped preview does not turn
//     black after a zoom.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_keys_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_keys_');

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
    const preview = window.__sb.preview;
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const key = (target, code) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    };

    // ------------------------------------------------------------
    // 1) Global shortcuts disabled while typing
    // ------------------------------------------------------------
    window.__sb.setTime(10);
    S.playing = false;
    out.t0 = preview.time;
    out.playing0 = S.playing;

    const inp = document.createElement('input');
    inp.id = '__probeInput';
    document.body.appendChild(inp);
    inp.focus();
    key(inp, 'ArrowRight');
    key(inp, 'ArrowLeft');
    key(inp, 'Space');
    out.afterTyping = { time: preview.time, playing: S.playing };

    const sel = document.createElement('select');
    sel.id = '__probeSelect';
    sel.innerHTML = '<option>a</option><option>b</option>';
    document.body.appendChild(sel);
    sel.focus();
    key(sel, 'ArrowRight');
    out.afterSelectArrow = preview.time;

    document.body.focus();
    key(document.body, 'ArrowRight');
    out.afterBlurRight = preview.time;
    key(document.body, 'Space');
    out.afterBlurSpace = S.playing;
    S.playing = false;

    // contentEditable field
    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    document.body.appendChild(ce);
    ce.focus();
    key(ce, 'ArrowLeft');
    out.afterContentEditable = preview.time;

    inp.remove();
    sel.remove();
    ce.remove();

    // ------------------------------------------------------------
    // 2) Zoom slider while stopped: the preview must repaint, not go black
    // ------------------------------------------------------------
    const canvas = document.getElementById('previewCanvas');
    const slider = document.getElementById('zoomSlider');
    const alphaAt = () => {
      const ctx = canvas.getContext('2d');
      return ctx.getImageData(0, 0, 1, 1).data[3];
    };
    window.__sb.setTime(12.34);
    window.__sb.refreshAll();
    await sleep(150);
    // Force a clean "stopped, nothing changed" state: render once, then make
    // sure _dirty is false with an unchanged playhead (the old black-screen
    // condition).
    preview.render();
    out.before = {
      dirty: preview._dirty,
      time: preview.time,
      lastRendered: preview.lastRenderedTime,
      alpha: alphaAt(),
      cssW: canvas.style.width
    };

    slider.value = 120;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    out.zoomIn = {
      dirty: preview._dirty,
      time: preview.time,
      lastRendered: preview.lastRenderedTime,
      alpha: alphaAt(),
      cssW: canvas.style.width
    };

    slider.value = 80;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    out.zoomOut = {
      dirty: preview._dirty,
      sceneScale: preview.sceneScale,
      alpha: alphaAt(),
      cssW: canvas.style.width
    };

    slider.value = 100;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
    return out;
  })()`);

  check('arrow/space ignored while typing in input',
    res.afterTyping.time === res.t0 && res.afterTyping.playing === false,
    JSON.stringify(res.afterTyping));
  check('arrow ignored while a select is focused', res.afterSelectArrow === res.t0, res.afterSelectArrow);
  check('arrow ignored in contentEditable', res.afterContentEditable === res.afterBlurRight, res.afterContentEditable);
  check('shortcuts still work when not typing',
    Math.abs(res.afterBlurRight - (res.t0 + 0.05)) < 1e-9 && res.afterBlurSpace === true,
    JSON.stringify({ right: res.afterBlurRight, space: res.afterBlurSpace }));
  check('stopped preview was clean before zoom (old black-screen precondition)',
    res.before.dirty === false && res.before.time === res.before.lastRendered && res.before.alpha > 0,
    JSON.stringify(res.before));
  check('zoom in repaints immediately (not black)',
    res.zoomIn.dirty === false && res.zoomIn.alpha > 0 && res.zoomIn.cssW !== res.before.cssW,
    JSON.stringify(res.zoomIn));
  check('zoom out repaints immediately (not black)',
    res.zoomOut.dirty === false && res.zoomOut.alpha > 0 && res.zoomOut.sceneScale === 0.8,
    JSON.stringify(res.zoomOut));

  fs.writeFileSync(path.join(__dirname, 'probe_input_shortcuts_zoom_out.json'), JSON.stringify(out, null, 2));
  console.log('KEYS_ZOOM_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_input_shortcuts_zoom_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
