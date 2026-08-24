// verify_round26.js — collapsible keyframe list with max-height scroll, and
// auto-scroll to the state properties when a keyframe is clicked.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r26_ud_')));
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
      // Select a controller with many keyframes
      const ctrl = tl.objects.find(o => o.type === 'controller' && o.keyframes.length > 5);
      if (!ctrl) return { err: 'no controller with many kfs' };
      tl.selectObject(ctrl.id, -1);
      await new Promise(r => setTimeout(r, 150));
      const body = document.getElementById('propBody');
      const keyList = document.getElementById('keyList');
      const toggle = document.getElementById('kfToggle');
      const cs = keyList ? getComputedStyle(keyList) : null;
      res.hasToggle = !!toggle;
      res.maxHeight = cs ? cs.maxHeight : null;
      res.overflowY = cs ? cs.overflowY : null;
      res.keyItems = keyList ? keyList.querySelectorAll('.key-item').length : 0;

      // Collapse / expand
      toggle.click();
      await new Promise(r => setTimeout(r, 100));
      const collapsed = document.getElementById('keyList') ? document.getElementById('keyList').style.display === 'none' : false;
      document.getElementById('kfToggle').click();
      await new Promise(r => setTimeout(r, 100));
      const expanded = document.getElementById('keyList') ? document.getElementById('keyList').style.display !== 'none' : false;
      res.collapsible = collapsed && expanded;

      // Click the LAST keyframe -> the right panel scrolls to the state form
      const body2 = document.getElementById('propBody');
      body2.scrollTop = 0;
      const lastKey = document.querySelectorAll('#keyList .key-item');
      lastKey[lastKey.length - 1].click();
      await new Promise(r => setTimeout(r, 250));
      const b3 = document.getElementById('propBody');
      const form = document.getElementById('stateForm');
      const section = form ? form.closest('.prop-section') : null;
      res.scrollTop = b3.scrollTop;
      res.sectionTop = section ? Math.round(section.offsetTop) : null;
      res.scrollOk = b3.scrollTop > 0 && section && b3.scrollTop >= section.offsetTop - 20;
      res.selectedKf = window.__sb.state.selectedKeyIdx;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('keyframe section collapsible with max-height scroll',
    !out.err && out.hasToggle && out.maxHeight && out.maxHeight !== 'none' && out.overflowY === 'auto' && out.collapsible && out.keyItems >= 2,
    JSON.stringify(out));
  check('clicking a keyframe scrolls right panel to the state properties',
    !out.err && out.scrollOk,
    JSON.stringify({ scrollTop: out.scrollTop, sectionTop: out.sectionTop, selectedKf: out.selectedKf }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
