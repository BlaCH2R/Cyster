// verify_round23.js — controllers lose the time-block concept: one lane per
// controller object, lane named after the controller, states[] merged with the
// initial state on the same lane, one node per specified time.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r23_ud_')));
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
      const rawCtrls = (window.__sb.state.storyboard.controllers || []);
      const ctrls = tl.objects.filter(o => o.type === 'controller');
      res.rawControllerCount = rawCtrls.length;
      res.controllerCount = ctrls.length;
      res.notPerNote = ctrls.length > 0 && ctrls.every(o => o.id.indexOf('::') < 0 && rawCtrls.some(r => r.id === o.id));
      res.allNoClip = ctrls.length > 0 && ctrls.every(o => o.noClip === true);
      // Each controller row: no .clip, keyframes (time nodes) present
      const rows = Array.from(document.querySelectorAll('.lane-row'));
      const noClipRows = rows.filter(r => !r.querySelector('.clip'));
      const ctrlRows = rows.filter(r => {
        const t = r.querySelector('.lane-label');
        return t && ctrls.some(o => o.id === t.title);
      });
      res.ctrlRows = ctrlRows.length;
      res.ctrlRowsNoClip = ctrlRows.every(r => !r.querySelector('.clip'));
      res.ctrlRowsHaveKf = ctrlRows.every(r => r.querySelectorAll('.kf').length > 0);
      res.oneLanePerCtrl = res.ctrlRows === res.controllerCount;
      res.laneNamedCtrl = ctrlRows.every(r => ctrls.some(o => o.id === r.querySelector('.lane-label').title));
      // Other types keep clips
      const clipRows = rows.filter(r => r.querySelector('.clip'));
      res.otherTypesHaveClips = clipRows.length > 0;
      // A controller with time-array states shows one node per specified time
      const rawWithArr = rawCtrls.find(o => (o.states || []).some(s => Array.isArray(s.time)));
      const sample = rawWithArr ? ctrls.find(o => o.id === rawWithArr.id) : null;
      if (sample) {
        const row = ctrlRows.find(r => r.querySelector('.lane-label').title === sample.id);
        res.sampleNodes = row ? row.querySelectorAll('.kf').length : 0;
        res.sampleKfs = sample.keyframes.length;
        const arrCount = (rawWithArr.states || []).filter(s => Array.isArray(s.time)).reduce((n, s) => n + s.time.length, 0);
        res.nodesMatch = res.sampleNodes === res.sampleKfs && res.sampleKfs >= arrCount;
        res.sampleLaneName = sample.label;
      }
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('controllers stay one lane per object (no per-note split), no time blocks',
    !out.err && out.notPerNote && out.allNoClip,
    JSON.stringify(out));
  check('lane named after controller; states merged; time[] gives one node per time',
    !out.err && out.oneLanePerCtrl && out.laneNamedCtrl && out.ctrlRowsNoClip && out.ctrlRowsHaveKf && out.nodesMatch && out.otherTypesHaveClips,
    JSON.stringify(out));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
