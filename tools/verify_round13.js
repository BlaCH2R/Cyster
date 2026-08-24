// verify_round13.js — video playback visibility, rigid whole-block drag,
// child drag/c-drag size (80%) and fade-only intro.
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));

  // ---- Video visibility during continuous playback (hard chart) ----
  const video = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const hard = items.find(el => el.textContent.indexOf('hard') >= 0);
      hard.click();
      await promise;
      await new Promise(r => setTimeout(r, 3500)); // eager video preload
      const pv = window.__sb.preview;
      const v = pv.videoCache['video.mp4'];
      const ready = v ? v.readyState : -1;
      // Simulate continuous playback: playing=true at t=5
      pv.setPlaying(true, 5);
      pv.setTime(5, false);
      pv.render();
      await new Promise(r => setTimeout(r, 600));
      pv.render();
      const playing = v ? (!v.paused) : false;
      const canvas = pv.canvas;
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlack = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i] + img[i + 1] + img[i + 2] > 90) nonBlack++;
      }
      pv.setPlaying(false, 0);
      return { ready, playing, nonBlack, videoW: v ? v.videoWidth : 0, videoH: v ? v.videoHeight : 0, cur: v ? +v.currentTime.toFixed(2) : -1 };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('video visible during playback',
    !video.err && video.ready >= 2 && video.playing && video.nonBlack > 20000,
    JSON.stringify(video));

  // ---- Rigid body drag on the extreme chart's note-synced video ----
  const drag = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const extreme = items.find(el => el.textContent.indexOf('extreme') >= 0);
      extreme.click();
      await promise;
      await new Promise(r => setTimeout(r, 1200));
      const tl = window.__sb.timeline;
      const videoObj = tl.objects.find(o => o.type === 'video');
      if (!videoObj) return { err: 'no video object' };
      const before = { start: videoObj.clipStart, end: videoObj.clipEnd, len: videoObj.clipEnd - videoObj.clipStart };
      tl.startDragClip({ preventDefault() {}, clientX: 400 }, videoObj);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 400 + 2 * tl.pxPerSec }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const afterObj = window.__sb.timeline.objects.find(o => o.id === videoObj.id);
      const after = { start: afterObj.clipStart, end: afterObj.clipEnd, len: afterObj.clipEnd - afterObj.clipStart };
      const raw = window.__sb.state.storyboard.videos.find(o => o.id === videoObj.id);
      const numericStates = (raw.states || []).filter(s => typeof s.time === 'number').length;
      return { before, after, moved: Math.abs(after.start - before.start - 2) < 0.2, lenSame: Math.abs(after.len - before.len) < 0.01, rawTime: raw.time, numericStates };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('body drag moves whole block, length unchanged (note-synced states)',
    !drag.err && drag.moved && drag.lenSame && typeof drag.rawTime === 'number' && drag.numericStates >= 1,
    JSON.stringify(drag));

  // ---- Narrow block (hard video, 0.5s) drags as a whole, not resize ----
  const narrow = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const hard = items.find(el => el.textContent.indexOf('hard') >= 0);
      hard.click();
      await promise;
      await new Promise(r => setTimeout(r, 1200));
      const tl = window.__sb.timeline;
      const vid = tl.objects.find(o => o.type === 'video');
      if (!vid) return { err: 'no video' };
      const before = { start: vid.clipStart, end: vid.clipEnd, len: vid.clipEnd - vid.clipStart };
      // Use the REAL clip element: mousedown near its left edge on a narrow
      // block must trigger body MOVE (not resize).
      const lane = Array.from(document.querySelectorAll('.lane-row'))
        .find(r => r.querySelector('.lane-label') && r.querySelector('.lane-label').textContent.indexOf(vid.id) >= 0);
      if (!lane) return { err: 'lane not found for ' + vid.id };
      const clip = lane.querySelector('.clip');
      if (!clip) return { err: 'clip not found' };
      const cr = clip.getBoundingClientRect();
      clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cr.left + 2, clientY: cr.top + 10 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cr.left + 2 + 1.5 * tl.pxPerSec, clientY: cr.top + 10 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const afterObj = window.__sb.timeline.objects.find(o => o.id === vid.id);
      const after = { start: afterObj.clipStart, end: afterObj.clipEnd, len: afterObj.clipEnd - afterObj.clipStart };
      return { before, after, moved: Math.abs(after.start - before.start - 1.5) < 0.2, lenSame: Math.abs(after.len - before.len) < 0.01 };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('narrow block body drag moves whole block, no stretch',
    !narrow.err && narrow.moved && narrow.lenSame,
    JSON.stringify(narrow));

  // ---- Child intro scale = 1 (fade only) + 80% size ----
  const child = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const extreme = items.find(el => el.textContent.indexOf('extreme') >= 0);
      extreme.click();
      await promise;
      await new Promise(r => setTimeout(r, 1200));
      const ch = window.__sb.preview.chart;
      const c4 = ch.notes.find(n => n.type === 4);
      const c7 = ch.notes.find(n => n.type === 7);
      const d3 = ch.notes.find(n => n.type === 3);
      return {
        child4: c4 ? c4.initial_scale : null,
        child7: c7 ? c7.initial_scale : null,
        head3: d3 ? d3.initial_scale : null
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('drag/c-drag children keep final size during intro (fade only)',
    !child.err && child.child4 === 1 && child.child7 === 1 && child.head3 === 0.5,
    JSON.stringify(child));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
