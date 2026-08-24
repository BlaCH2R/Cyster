// probe_clip_drag.js — what does a clip BODY drag currently move?
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_drag_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const results = {};
    try {
      window.__sb.state.storyboard.texts = window.__sb.state.storyboard.texts || [];
      window.__sb.state.storyboard.texts.push({
        id: 'drag_test', time: 10, text: 'DRAG', opacity: 1, layer: 0, order: 0,
        states: [{ time: 12, opacity: 1 }, { time: 14, opacity: 0 }]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      const tl = window.__sb.timeline;
      const obj = tl.objects.find(o => o.id === 'drag_test');
      if (!obj) return { err: 'drag_test not in timeline objects' };
      // Body drag +2s: everything must move together
      tl.startDragClip({ preventDefault() {}, clientX: 400 }, obj);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 400 + 2 * tl.pxPerSec }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      let raw = window.__sb.state.storyboard.texts.find(o => o.id === 'drag_test');
      results.right = { time: raw.time, s0: raw.states[0].time, s1: raw.states[1].time };
      // Body drag far left: the whole block must clamp at 0 with spacing intact
      const obj2 = window.__sb.timeline.objects.find(o => o.id === 'drag_test');
      window.__sb.timeline.startDragClip({ preventDefault() {}, clientX: 500 }, obj2);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 500 - 60 * tl.pxPerSec }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      raw = window.__sb.state.storyboard.texts.find(o => o.id === 'drag_test');
      results.left = { time: raw.time, s0: raw.states[0].time, s1: raw.states[1].time };
      return results;
    } catch (e) {
      return { err: String(e && e.message || e), results };
    }
  })()`);
  console.log('CLIPDRAG:', JSON.stringify(out));
  app.exit(0);
});
