// probe_select_expanded.js — what happens when you select an expanded per-note
// timeline entry?
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
      const entry = tl.objects.find(o => o.type === 'note_controller');
      if (!entry) return { err: 'no note_controller entry' };
      // Select it via the timeline API (like clicking its clip)
      window.__sb.timeline.selectObject(entry.id, -1);
      await new Promise(r => setTimeout(r, 150));
      const raw = window.__sb.state.storyboard.note_controllers.find(o => o.id === entry.id.split('::')[0]);
      return {
        entryId: entry.id,
        selectedObjId: window.__sb.state.selectedObjId,
        propsText: document.getElementById('propBody').textContent.slice(0, 120),
        rawFound: !!raw,
        rawNote: raw && raw.note,
        rawTime: raw && raw.time
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('SEL:', JSON.stringify(out));
  app.exit(0);
});
