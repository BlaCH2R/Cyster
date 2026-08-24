// verify_round19.js — difficulty picker: read-storyboard toggles + cancel back
// to the welcome page.
const { app, BrowserWindow } = require('electron');
const path = require('path');
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

  const first = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const toggles = items.map(el => !!el.querySelector('.pick-sb'));
      const checked = items.map(el => {
        const cb = el.querySelector('.pick-sb input');
        return cb ? cb.checked : null;
      });
      const rows = items.map(el => el.querySelector('.pick-label').textContent);
      // Toggle the hard row's checkbox OFF without selecting the row
      const hard = items.find(el => el.textContent.indexOf('hard') >= 0);
      const hardCb = hard.querySelector('.pick-sb input');
      hardCb.click();
      await new Promise(r => setTimeout(r, 80));
      const modalStillOpen = !document.getElementById('modalMask').classList.contains('hidden');
      const hardUnchecked = !hardCb.checked;
      // Now click the hard row -> should NOT read its storyboard
      hard.click();
      await promise;
      await new Promise(r => setTimeout(r, 500));
      return {
        rows, toggles, checked,
        modalStillOpen, hardUnchecked,
        chartPath: window.__sb.state.chartPath,
        sbName: window.__sb.state.storyboardFileName,
        sbVideos: (window.__sb.state.storyboard.videos || []).length,
        sbEmpty: !(window.__sb.state.storyboard.videos || []).length &&
          !(window.__sb.state.storyboard.controllers || []).length
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('toggles shown only for difficulties with storyboards (easy none, hard/extreme yes)',
    !first.err && first.rows.length === 3 && first.toggles[0] === false && first.toggles[1] === true && first.toggles[2] === true && first.checked[1] === true,
    JSON.stringify({ rows: first.rows, toggles: first.toggles, checked: first.checked }));
  check('toggle click does not select the row; unchecking skips storyboard read',
    !first.err && first.modalStillOpen && first.hardUnchecked && first.chartPath === 'chart.hard.txt' && first.sbName !== 'storyboard_hard.json' && first.sbEmpty,
    JSON.stringify(first));

  // Second pass: with the toggle checked, the storyboard IS read
  const second = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const hard = items.find(el => el.textContent.indexOf('hard') >= 0);
      hard.click();
      await promise;
      await new Promise(r => setTimeout(r, 500));
      return {
        sbName: window.__sb.state.storyboardFileName,
        sbVideos: (window.__sb.state.storyboard.videos || []).length,
        chartPath: window.__sb.state.chartPath
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('checked toggle reads the existing storyboard',
    !second.err && second.sbName === 'storyboard_hard.json' && second.sbVideos === 1 && second.chartPath === 'chart.hard.txt',
    JSON.stringify(second));

  // Third: cancel returns to the welcome page and resolves null
  const third = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const cancelBtn = document.querySelector('#modalFoot .dlg-btn');
      cancelBtn.click();
      await promise;
      await new Promise(r => setTimeout(r, 300));
      return {
        welcome: document.body.classList.contains('welcome-mode'),
        chartNull: window.__sb.state.chart == null,
        modalClosed: document.getElementById('modalMask').classList.contains('hidden')
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('cancel returns to welcome page (and aborts loading)',
    !third.err && third.welcome && third.chartNull && third.modalClosed,
    JSON.stringify(third));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
