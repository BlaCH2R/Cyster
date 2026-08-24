// verify_round42.js - video playback progress is relative to the video's
// CREATION time in the storyboard (first state), not the currently evaluated
// state's time (which would reset the progress at every property change).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r42_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r42_'));
  fs.copyFileSync('V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/video.mp4', path.join(dir, 'video.mp4'));
  const chart = { time_base: 480, tempo_list: [{ tick: 0, value: 500000 }], page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }], note_list: [{ id: 1, type: 0, x: 0.5, tick: 2000, hold_tick: 0, page_index: 0 }], event_order_list: [], music_offset: 0 };
  // Created at t=2, another property changes at t=6.
  const sb = { sprites: [], texts: [], videos: [
    { id: 'v1', path: 'video.mp4', time: 2, opacity: 1, width: 400, height: 300, layer: 0, order: 0, states: [{ time: 6, opacity: 0.5 }] }
  ], lines: [], controllers: [], note_controllers: [] };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1200));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    // Wait for the video to be decodable.
    let ready = false;
    for (let i = 0; i < 80 && !ready; i++) {
      await new Promise(r => setTimeout(r, 100));
      const v = pv.videoCache && pv.videoCache['video.mp4'];
      ready = !!(v && v.readyState >= 2);
    }
    const v = pv.videoCache && pv.videoCache['video.mp4'];
    if (!v) return { err: 'no video cache' };
    // Scrub to t=8 (AFTER the t=6 state change): progress must be 8 - 2 = 6
    // (creation time), not 8 - 6 = 2 (current state time).
    const seek = (t) => {
      pv.setTime(t, false);
      pv.render();
      return v.currentTime;
    };
    let t8 = 0, t9 = 0;
    // Keep readyState up by playing between scrubs (paused videos may drop it).
    if (!v.paused) v.pause();
    for (let i = 0; i < 40 && v.readyState < 2; i++) { try { v.play().catch(() => {}); } catch (e) {} await new Promise(r => setTimeout(r, 50)); }
    try { v.pause(); } catch (e) {}
    t8 = seek(8);
    if (v.readyState >= 2) t9 = seek(9);
    return { readyState: v.readyState, t8: +t8.toFixed(3), t9: +t9.toFixed(3) };
  })()`);
  console.log('R42:', JSON.stringify(out));
  check('video progress is relative to its creation time (not reset by state changes)',
    !out.err && Math.abs(out.t8 - 6) < 0.2 &&
      (out.t9 === 0 || Math.abs(out.t9 - 7) < 0.2),
    JSON.stringify(out));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
