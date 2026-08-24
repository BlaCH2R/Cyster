// Verify controller multi-selected keyframes use the NEW card interface only
// when the keyframes belong to the SAME controller track:
//  - same track: card panel renders (edits apply to all selected keyframes)
//  - cross-track: count-only browse panel, no card form
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mkf_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_mkf_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mkf_proj_'));
const CTR_PATH = path.join(TMP, 'MultiKf.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'MultiKf',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const ctlA = { id: 'ctl_a', time: 0, states: [{ time: 0 }, { time: 3 }] };
    const ctlB = { id: 'ctl_b', time: 0, states: [{ time: 0 }, { time: 3 }] };
    S.storyboard.controllers.push(ctlA, ctlB);
    S.controllerCards = { ctl_a: ['camera_x'], ctl_b: ['opacity_storyboard'] };
    window.__sb.refreshAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(150);
    const setSel = (ids, kfs) => {
      S.selectedIds = ids;
      S.selectedObjId = ids.length ? ids[ids.length - 1] : null;
      S.selectedKfs = kfs;
      S.selectedLane = null;
      S.previewEmptyFocus = false;
      window.__sb.renderProperties();
    };

    // 1) 同一条轨道的两个关键帧 → 卡片界面。
    setSel(['ctl_a'], [{ objId: 'ctl_a', index: 0 }, { objId: 'ctl_a', index: 1 }]);
    await sleep(120);
    const sameTrack = {
      cardCount: document.querySelectorAll('#stateForm .ctrl-card').length,
      header: (document.querySelector('#propBody .prop-section h4') || {}).textContent || '',
      hasCardHeader: (document.querySelector('#propBody .empty-panel') || {}).textContent || ''
    };
    // 编辑卡片字段：应应用到同轨道的全部选中关键帧。
    const camXInput = document.querySelector('#stateForm .ctrl-card[data-card="camera_x"] input[type=number]');
    camXInput.value = '2';
    camXInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120);
    const editApplied = ctlA.states[0].x === 2 && ctlA.states[1].x === 2;

    // 2) 跨两条轨道的关键帧 → 只浏览数量。
    setSel(['ctl_a', 'ctl_b'], [{ objId: 'ctl_a', index: 0 }, { objId: 'ctl_b', index: 0 }]);
    await sleep(120);
    const crossTrack = {
      cardCount: document.querySelectorAll('#stateForm .ctrl-card').length,
      header: (document.querySelector('#propBody .empty-panel') || {}).textContent || '',
      hasBrowseMsg: ((document.querySelector('#propBody .help-text') || {}).textContent || '').indexOf('仅支持浏览数量') >= 0
    };

    return { sameTrack, editApplied, crossTrack };
  })()`);

  out.ok = !!(
    out.sameTrack && out.sameTrack.cardCount >= 1 &&
    out.sameTrack.header.indexOf('关键帧卡片') >= 0 &&
    out.sameTrack.hasCardHeader.indexOf('同一条 controller 轨道') >= 0 &&
    out.editApplied &&
    out.crossTrack && out.crossTrack.cardCount === 0 &&
    out.crossTrack.header.indexOf('来自 2 条 controller 轨道') >= 0 &&
    out.crossTrack.hasBrowseMsg
  );
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_multi_kf_out.json'), JSON.stringify(out, null, 2));
  console.log('MKF_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ctrl_multi_kf_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
