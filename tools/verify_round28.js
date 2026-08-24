// verify_round28.js — clicking a keyframe (properties list or timeline) jumps
// the playhead to its time and scrolls the right panel to the state properties.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r28_ud_')));
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
      const sb = window.__sb.state.storyboard;
      sb.sprites = sb.sprites || [];
      sb.sprites.push({
        id: 'kf_test', time: 5, path: '', opacity: 1, preserve_aspect: true, layer: 1, order: 0,
        states: [{ time: 10, opacity: 0.5 }, { time: 20, opacity: 0 }]
      });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 150));
      const res = {};
      const scrollCheck = () => {
        const b = document.getElementById('propBody');
        const form = document.getElementById('stateForm');
        const section = form ? form.closest('.prop-section') : null;
        return { top: b.scrollTop, sectionTop: section ? section.offsetTop : null };
      };

      // 1. Properties: click the "K2" (time 10) key-item
      window.__sb.timeline.selectObject('kf_test', -1);
      await new Promise(r => setTimeout(r, 150));
      document.getElementById('propBody').scrollTop = 0;
      const items2 = Array.from(document.querySelectorAll('#keyList .key-item'));
      const k2 = items2.find(el => el.textContent.indexOf('K2') === 0 || (el.querySelector('.klabel') && el.querySelector('.klabel').textContent === 'K2'));
      if (!k2) return { err: 'K2 key-item not found: ' + items2.map(e => e.textContent).join('|') };
      k2.click();
      await new Promise(r => setTimeout(r, 250));
      const sc1 = scrollCheck();
      res.props = {
        time: +window.__sb.preview.time.toFixed(2),
        kfIdx: window.__sb.state.selectedKeyIdx,
        scrollTop: sc1.top,
        sectionTop: sc1.sectionTop
      };
      res.propsOk = Math.abs(res.props.time - 20) < 0.01 && res.props.kfIdx === 1 && res.props.scrollTop >= res.props.sectionTop - 20;

      // 2. Timeline: mousedown a keyframe at time 10 in the kf_test lane
      window.__sb.setTime(3, false);
      await new Promise(r => setTimeout(r, 100));
      const row = Array.from(document.querySelectorAll('.lane-row'))
        .find(r2 => r2.querySelector('.lane-label') && r2.querySelector('.lane-label').title === 'kf_test');
      if (!row) return { err: 'kf_test lane not found' };
      const kfEl = Array.from(row.querySelectorAll('.kf')).find(k => k.title.indexOf('10.000') >= 0);
      if (!kfEl) return { err: 'timeline kf @10 not found' };
      const rect = kfEl.getBoundingClientRect();
      kfEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + 2, clientY: rect.top + 2 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 250));
      const sc2 = scrollCheck();
      res.timeline = {
        time: +window.__sb.preview.time.toFixed(2),
        kfIdx: window.__sb.state.selectedKeyIdx,
        scrollTop: sc2.top,
        sectionTop: sc2.sectionTop
      };
      res.timelineOk = Math.abs(res.timeline.time - 10) < 0.01 && res.timeline.kfIdx === 0 && res.timeline.scrollTop >= res.timeline.sectionTop - 20;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('properties keyframe click jumps playhead + scrolls to state props',
    !out.err && out.propsOk,
    JSON.stringify(out.props));
  check('timeline keyframe click does the same',
    !out.err && out.timelineOk,
    JSON.stringify(out.timeline));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
