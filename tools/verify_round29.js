// verify_round29.js — non-controller rot_x/rot_y/rot_z rotate around the
// object's own center; the holdbar follows the hold body's rotation around
// the hold body center (the bar is not a rotation-center reference).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r29_ud_')));
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
      const pv = window.__sb.preview;
      const info = pv.ctxInfo();
      const res = {};

      // 1. Stage object own rot around its center: rot_x squashes Y, rot_y
      // squashes X, rot_z rotates — all around the object's own origin.
      const mat = (fields) => pv.stageMatrix(
        { id: 'x', type: 'sprite', states: [] },
        { from: fields, to: null, easeFn: (v) => v, t: 1 },
        info
      );
      const rx = mat({ x: { value: 0, unit: 'stagex' }, y: { value: 0, unit: 'stagey' }, rot_x: 30 });
      const ry = mat({ x: { value: 0, unit: 'stagex' }, y: { value: 0, unit: 'stagey' }, rot_y: 30 });
      const rz = mat({ x: { value: 0, unit: 'stagex' }, y: { value: 0, unit: 'stagey' }, rot_z: 45 });
      res.stageRot = {
        rxD: +rx.d.toFixed(3),
        ryA: +ry.a.toFixed(3),
        rzA: +rz.a.toFixed(3),
        rzB: +rz.b.toFixed(3)
      };
      res.stageOk = Math.abs(res.stageRot.rxD - Math.cos(30 * Math.PI / 180)) < 0.03 &&
        Math.abs(res.stageRot.ryA - Math.cos(30 * Math.PI / 180)) < 0.03 &&
        Math.abs(res.stageRot.rzA - Math.cos(45 * Math.PI / 180)) < 0.03 &&
        Math.abs(res.stageRot.rzB - Math.sin(45 * Math.PI / 180)) < 0.03;

      // 2. Note own rot_x foreshortens the note shape around its center
      const ch = pv.chart;
      let note = null, best = 1e9;
      for (const n of ch.notes) {
        if (n.type !== 4) continue;
        const near = ch.notes.filter(o => o.id !== n.id && Math.abs(o.start_time - n.start_time) < 1).length;
        if (near < best) { best = near; note = n; }
      }
      if (!note) return { err: 'no drag child' };
      const sb = window.__sb.state.storyboard;
      sb.note_controllers = sb.note_controllers || [];
      sb.note_controllers.push({ id: 'rot_note', note: note.id, time: 0, override_rot_x: true, rot_x: 60 });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      pv.ui.showNoteIds = false;
      // Measure slightly before the trigger so the scanline doesn't cross the
      // note's center row.
      const tM = note.start_time - 0.5;
      pv.setTime(tM, false);
      pv.render();
      const infoM = pv.ctxInfo();
      const pos = pv.noteScreenPos(note, infoM);
      const W = pv.canvas.width, H = pv.canvas.height;
      const ctx = pv.canvas.getContext('2d');
      const cx = Math.round(pos.x), cy = Math.round(pos.y);
      const measureHeight = (render) => {
        if (render) pv.render();
        const data = ctx.getImageData(0, 0, W, H).data;
        let hB = 0, hT = 0;
        for (let y = cy; brightAt(data, cx, y); y++) hB++;
        for (let y = cy - 1; brightAt(data, cx, y); y--) hT++;
        return hB + hT;
      };
      const brightAt = (data, x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        const i = (y * W + x) * 4;
        return data[i] + data[i + 1] + data[i + 2] > 120;
      };
      const hSquashed = measureHeight(true);
      // remove the override (rot_x = 0)
      sb.note_controllers[sb.note_controllers.length - 1].rot_x = 0;
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 100));
      pv.setTime(tM, false);
      const hFull = measureHeight(true);
      res.noteSquash = { hSquashed, hFull, ratio: +(hFull / Math.max(1, hSquashed)).toFixed(2) };
      res.noteOk = hSquashed > 5 && res.noteSquash.ratio > 1.5 && res.noteSquash.ratio < 3;
      res.ovr = pv.noteOverrides[note.id];

      // 3. Hold own rot_z rotates the holdbar TOGETHER with the body; the bar
      // follows the body's rotation around the hold body center (it is not
      // itself a rotation-center reference). The detailed geometry is covered
      // by verify_round30.js.
      const bar = pv.drawHoldBar.toString();
      res.holdbarUsesOwnRot = bar.indexOf('info.rotZ') >= 0 &&
        bar.indexOf('ownRotZ') >= 0 &&
        bar.indexOf('noteOverrides') >= 0 &&
        bar.indexOf('translate(ux, uy)') >= 0;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('R29:', JSON.stringify(out));

  check('stage objects rotate around own center (rot_x/rot_y squash, rot_z spins)',
    !out.err && out.stageOk,
    JSON.stringify(out.stageRot));
  check('note own rot_x foreshortens around its center (ellipse)',
    !out.err && out.noteOk,
    JSON.stringify(out.noteSquash));
  check('holdbar follows the hold body rotation around the body center',
    !out.err && out.holdbarUsesOwnRot,
    JSON.stringify({ holdbarUsesOwnRot: out.holdbarUsesOwnRot }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
