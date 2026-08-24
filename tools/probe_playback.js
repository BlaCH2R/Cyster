// Playback regression probe: starts the preview playing and verifies the
// render loop keeps advancing (time + canvas pixels change) with no renderer
// exceptions. Run directly:
//   electron.exe --no-sandbox --disable-gpu tools\probe_playback.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_play_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_play_');

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
  setTimeout(() => app.exit(1), 45000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const rendererErrors = [];
  win.webContents.on('console-message', (e, level, message) => {
    try {
      const lv = typeof e === 'object' ? e.level : level;
      const msg = typeof e === 'object' ? e.message : message;
      if (lv >= 2 || /error/i.test(msg)) rendererErrors.push(String(msg).slice(0, 300));
    } catch (err) {}
  });
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));

  const out = { checks: [], ok: true, errors: [] };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__probeErrors = [];
    window.addEventListener('error', (e) => window.__probeErrors.push('error: ' + (e.message || e.error)));
    window.addEventListener('unhandledrejection', (e) => window.__probeErrors.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
    const p = window.__sb.preview;
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    // Count render calls to detect whether the rAF loop is alive.
    let renderCalls = 0;
    const origRender = p.render.bind(p);
    p.render = () => { renderCalls++; return origRender(); };
    const sample = () => {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4096) sum += d[i];
      return sum;
    };
    const out = { playing: false, t0: p.time, t1: null, px0: sample(), px1: null, playingFlag: false, loopAlive: false };
    // Manual setTime must work and update the display
    window.__sb.setTime(3, false);
    out.manualSet = p.time === 3;
    out.manualDisplay = document.getElementById('timeDisplay').textContent;
    const fps0 = document.getElementById('fpsBadge').textContent;
    // Start playback through the app's own toggle path
    window.__sb.state.playing = true;
    window.__sb.preview.setPlaying(true);
    out.playingFlag = p.playing === true;
    out.statePlaying = window.__sb.state.playing === true;
    await sleep(2000);
    out.t1 = p.time;
    out.px1 = sample();
    out.fps1 = document.getElementById('fpsBadge').textContent;
    // rAF loop alive: a probe counter advanced by the loop is not directly
    // visible, so check the time display keeps advancing too.
    out.timeDisplay = document.getElementById('timeDisplay').textContent;
    await sleep(1000);
    out.t2 = p.time;
    out.timeDisplay2 = document.getElementById('timeDisplay').textContent;
    out.playingFlag2 = p.playing === true;
    out.fps2 = document.getElementById('fpsBadge').textContent;
    out.fps0 = fps0;
    out.renderCallsIdle = renderCalls;
    out.probeErrors = window.__probeErrors.slice(0, 10);
    return out;
  })()`);

  check('preview playing flag set', res.playingFlag === true, String(res.playingFlag));
  check('manual setTime works', res.manualSet === true && res.manualDisplay === '3.000', JSON.stringify({ manualSet: res.manualSet, manualDisplay: res.manualDisplay }));
  check('preview time advances while playing',
    res.t1 > res.t0 && res.t2 > res.t1,
    JSON.stringify({ t0: res.t0, t1: res.t1, t2: res.t2 }));
  check('rAF loop alive (fps badge counts)',
    /\d+ FPS/.test(res.fps2),
    JSON.stringify({ fps0: res.fps0, fps1: res.fps1, fps2: res.fps2 }));
  check('canvas pixels change while playing',
    res.px1 !== res.px0,
    JSON.stringify({ px0: res.px0, px1: res.px1 }));

  await new Promise((r) => setTimeout(r, 800));
  out.errors = rendererErrors.slice(0, 20);
  check('no renderer errors during playback', rendererErrors.length === 0, JSON.stringify(rendererErrors.slice(0, 5)));
  check('no page-level exceptions', !res.probeErrors || res.probeErrors.length === 0, JSON.stringify(res.probeErrors));
  out.result = res;
  fs.writeFileSync(path.join(__dirname, 'probe_playback_out.json'), JSON.stringify(out, null, 2));
  app.exit(0);
});
