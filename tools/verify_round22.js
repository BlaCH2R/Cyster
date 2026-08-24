// verify_round22.js — note-selector read/display (per-note nodes + resolved
// property times) and same-type non-overlapping lane packing.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r22_ud_')));
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

  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1500));
      const res = {};
      const tl = window.__sb.timeline;

      // 1. Per-note expansion + property panel resolved time (not 0.000)
      const nc = tl.objects.find(o => o.type === 'note_controller');
      res.ncId = nc ? nc.id : null;
      res.ncKf = nc && nc.keyframes[0] ? +nc.keyframes[0].time.toFixed(2) : null;
      if (nc) {
        tl.selectObject(nc.id, -1);
        await new Promise(r => setTimeout(r, 150));
        const props = document.getElementById('propBody').textContent;
        res.propsSnippet = props.slice(0, 180);
        res.propsHasResolved = props.indexOf('195.87') >= 0 || props.indexOf('195.9') >= 0;
        res.propsHasZero = props.indexOf('0.000') >= 0;
        res.selectedRaw = window.__sb.state.selectedObjId;
        res.selectedNote = window.__sb.state.selectedNoteId;
      }

      // 2. Lane packing: non-overlapping same-type clips share a lane
      tl.setData([
        { id: 'a', type: 'sprite', label: 'a', clipStart: 0, clipEnd: 10, keyframes: [] },
        { id: 'b', type: 'sprite', label: 'b', clipStart: 20, clipEnd: 30, keyframes: [] },
        { id: 'c', type: 'sprite', label: 'c', clipStart: 25, clipEnd: 35, keyframes: [] },
        { id: 'd', type: 'sprite', label: 'd', clipStart: 40, clipEnd: 50, keyframes: [] }
      ], 60);
      res.spriteRows = document.querySelectorAll('.lane-row').length;

      // 3. Auto-read packing: non-overlapping same-type objects from the
      // storyboard land in ONE shared lane
      window.__sb.state.storyboard = {
        sprites: [
          { id: 's1', time: 0, path: '', opacity: 1, layer: 1, order: 0 },
          { id: 's2', time: 20, path: '', opacity: 1, layer: 1, order: 0 },
          { id: 's3', time: 40, path: '', opacity: 1, layer: 1, order: 0 }
        ],
        texts: [], videos: [], lines: [], controllers: [], note_controllers: []
      };
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      res.autoReadRows = Array.from(document.querySelectorAll('.lane-row')).length;
      res.autoReadObjects = 3;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('per-note nodes + property panel shows resolved time',
    !out.err && out.ncId && out.ncId.indexOf('::') >= 0 && out.ncKf != null && out.propsHasResolved && !out.propsHasZero && out.selectedNote != null,
    JSON.stringify(out));
  check('same-type non-overlapping clips share a lane (4 objects -> 2 lanes)',
    !out.err && out.spriteRows === 2,
    JSON.stringify({ spriteRows: out.spriteRows }));
  check('auto-read packs lanes (video rows < video objects)',
    !out.err && out.autoReadRows === 1 && out.autoReadObjects === 3,
    JSON.stringify({ autoReadRows: out.autoReadRows, autoReadObjects: out.autoReadObjects }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
