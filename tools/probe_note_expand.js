// probe_note_expand.js — does the timeline expand note-selector objects into
// per-note nodes, and do their times resolve?
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1500));
      const tl = window.__sb.timeline;
      const vid = tl.objects.filter(o => o.type === 'video');
      const nc = tl.objects.filter(o => o.type === 'note_controller');
      const sum = (arr) => arr.slice(0, 8).map(o => ({
        id: o.id, kfs: o.keyframes.slice(0, 4).map(k => ({ i: k.index, t: +k.time.toFixed(2), d: k.draggable })),
        start: +o.clipStart.toFixed(2), end: +o.clipEnd.toFixed(2)
      }));
      return {
        totalObjects: tl.objects.length,
        videoCount: vid.length,
        ncCount: nc.length,
        videos: sum(vid),
        noteControllers: sum(nc),
        chartNoteIdsSample: window.__sb.preview.chart.notes.slice(0, 5).map(n => n.id),
        chartHasNote0: !!window.__sb.preview.chart.noteById(0),
        chartHasNote13: !!window.__sb.preview.chart.noteById(13)
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('EXPAND:', JSON.stringify(out));
  app.exit(0);
});
