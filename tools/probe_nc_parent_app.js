// Full-app probe: opens the robotic girl project, then evaluates the preview's
// stageMatrix for sprite "big_dad" (parent_id -> note_controller "mega_dad")
// and compares it against the note's screen position. Writes a JSON result.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：robotic girl/ロボティックガール/ロボティックガール.ctdsber';

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 2200));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));
  const res = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1800));
      const pv = window.__sb.preview;
      const note = pv.chart && pv.chart.noteById(1456);
      const t = note ? note.start_time + 0.01 : 263;
      pv.setTime(t, false);
      await new Promise(r => setTimeout(r, 300));
      const info = pv.ctxInfo();
      const big = (pv.evalResult && pv.evalResult.sprites || []).find(s => s.obj.id === 'big_dad');
      const nc = pv.compiled && pv.compiled.noteControllers.find(n => n.id === 'mega_dad');
      if (!big || !nc || !note) return { err: 'missing', big: !!big, nc: !!nc, note: !!note, t };
      const M = pv.stageMatrix(big.obj, big, info);
      const noteP = pv.noteScreenPos(note, info);
      return {
        t,
        ncNote: nc.note,
        parentId: big.obj.parentId,
        M: [Number(M.e.toFixed(1)), Number(M.f.toFixed(1))],
        notePos: [Number(noteP.x.toFixed(1)), Number(noteP.y.toFixed(1))],
        anchored: Math.abs(M.e - noteP.x) < 1 && Math.abs(M.f - noteP.y) < 1,
        override: pv.noteOverrides && pv.noteOverrides[1456]
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  fs.writeFileSync(path.join(__dirname, 'probe_nc_parent_app_out.json'), JSON.stringify(res, null, 2));
  console.log('NC_PARENT_APP:', JSON.stringify(res));
  app.exit(0);
});
