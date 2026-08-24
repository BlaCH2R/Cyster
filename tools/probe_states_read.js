// probe_states_read.js — how do initial {} + states[] and time[] arrays appear?
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
      const res = {};
      // Objects with a time array in the raw storyboard
      const raws = [];
      for (const g of ['controllers', 'note_controllers', 'videos', 'texts', 'sprites', 'lines']) {
        for (const o of window.__sb.state.storyboard[g] || []) {
          if (Array.isArray(o.time) || (o.states || []).some(s => Array.isArray(s.time))) {
            raws.push({ group: g, id: o.id, time: o.time, states: (o.states || []).map(s => s.time).slice(0, 4) });
          }
        }
      }
      res.timeArrays = raws.slice(0, 2).map(r => ({ id: r.id, states: r.states }));
      // For the first controller with a time array, how many timeline kfs?
      const arrObj = raws.find(r => Array.isArray(r.time) || (r.states || []).some(s => Array.isArray(s.time)));
      if (arrObj) {
        const entries = tl.objects.filter(o => o.id.indexOf(arrObj.id + '::') === 0 || o.id === arrObj.id);
        res.arrEntry = {
          id: arrObj.id,
          entries: entries.length,
          kfsPerEntry: entries.slice(0, 3).map(e => e.keyframes.map(k => +k.time.toFixed(2)))
        };
      }
      // Controller lane labels
      res.controllerLabels = Array.from(document.querySelectorAll('.lane-row .lane-label'))
        .filter(el => /controller_auto/.test(el.textContent))
        .slice(0, 8)
        .map(el => el.textContent);
      // For controller_auto_4: how many expanded entries, kfs per entry?
      const e4 = tl.objects.filter(o => o.id.indexOf('controller_auto_4') === 0);
      res.c4 = {
        entries: e4.length,
        sampleKfs: e4.slice(0, 2).map(e => ({ id: e.id, n: e.keyframes.length, times: e.keyframes.map(k => +k.time.toFixed(2)).slice(0, 6) }))
      };
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('STATES:', JSON.stringify(out));
  app.exit(0);
});
