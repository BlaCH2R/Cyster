// probe_drag_penguin.js — reproduce the body-drag window-length change on the
// penguin project's storyboard objects.
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
      // Pick extreme (storyboard_base.json has note_controllers + videos)
      const extreme = items.find(el => el.textContent.indexOf('extreme') >= 0);
      if (!extreme) return { err: 'no extreme item: ' + items.map(i => i.textContent).join('|') };
      extreme.click();
      await promise;
      await new Promise(r => setTimeout(r, 1500));

      const tl = window.__sb.timeline;
      const dump = tl.objects.map(o => ({
        id: o.id, type: o.type, clipStart: +o.clipStart.toFixed(3), clipEnd: +o.clipEnd.toFixed(3),
        len: +(o.clipEnd - o.clipStart).toFixed(3),
        kfs: o.keyframes.slice(0, 4).map(k => ({ i: k.index, t: +k.time.toFixed(3), d: k.draggable }))
      }));
      return { count: tl.objects.length, objects: dump.slice(0, 12) };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('DRAGDUMP:', JSON.stringify(out));
  app.exit(0);
});
