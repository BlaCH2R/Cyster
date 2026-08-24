// 只测关键帧组删除（表达式组 + 数值组），不涉及独立窗口，便于定位。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nslk_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_nslk_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nslk_proj_'));
const CTR_PATH = path.join(TMP, 'NsListKf.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NsListKf',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = {};
    S.storyboard.note_controllers = S.storyboard.note_controllers || [];
    const ncDel = { id: 'nc_del', note: { type: [3, 4] }, time: 'start:$note',
      states: [
        { time: 'start:$note', opacity_multiplier: 0.5 },
        { time: 57.5, opacity_multiplier: 0.6 },
        { time: 'start:$note', opacity_multiplier: 0.7 }
      ] };
    S.storyboard.note_controllers.push(ncDel);
    window.__sb.refreshAll();
    window.__sb.selectObject('nc_del', -1);
    await sleep(150);
    const exprItems = Array.from(document.querySelectorAll('#keyList .key-item[data-kf-exp]'));
    const exprToken = exprItems.find((el) => el.dataset.kfExp === 'start:$note');
    R.exprItemFound = !!exprToken;
    R.exprDelShown = !!(exprToken && exprToken.querySelector('.del svg'));
    if (exprToken) exprToken.querySelector('.del').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(150);
    const nc1 = S.storyboard.note_controllers.find((n) => n.id === 'nc_del');
    R.afterExprDel = { states: (nc1.states || []).length, time: nc1.time, op: nc1.opacity_multiplier };

    const ncDel2 = { id: 'nc_del2', note: { type: [3, 4] }, time: 'start:$note',
      states: [{ time: 100, opacity_multiplier: 0.2 }, { time: 200, opacity_multiplier: 0.3 }] };
    S.storyboard.note_controllers.push(ncDel2);
    window.__sb.refreshAll();
    window.__sb.selectObject('nc_del2', -1);
    await sleep(150);
    R.keyListHtml = document.querySelector('#keyList').innerHTML.slice(0, 800);
    const numItem = Array.from(document.querySelectorAll('#keyList .key-item[data-kf-exp]'))
      .find((el) => (el.querySelector('.kt') || {}).textContent === '100.000');
    R.numItemFound = !!numItem;
    if (numItem) numItem.querySelector('.del').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(150);
    const nc2 = S.storyboard.note_controllers.find((n) => n.id === 'nc_del2');
    R.afterNumDel = {
      states: (nc2.states || []).length,
      time: nc2.time,
      op: (nc2.states || [])[0] && (nc2.states || [])[0].opacity_multiplier,
      leftTime: (nc2.states || [])[0] && (nc2.states || [])[0].time
    };
    return R;
  })()`);

  out.ok = !!(
    out.exprItemFound && out.exprDelShown &&
    out.afterExprDel && out.afterExprDel.states === 0 && out.afterExprDel.time === 57.5 &&
    out.afterExprDel.op === 0.6 &&
    out.numItemFound &&
    out.afterNumDel && out.afterNumDel.states === 1 && out.afterNumDel.time === 'start:$note' &&
    out.afterNumDel.leftTime === 200 && out.afterNumDel.op === 0.3
  );
  fs.writeFileSync(path.join(__dirname, 'probe_ns_list_kf_out.json'), JSON.stringify(out, null, 2));
  console.log('NS_LIST_KF:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ns_list_kf_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
