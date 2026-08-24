// Verify multi-selected keyframes drag as one batch: dragging any selected
// keyframe moves ALL selected keyframes by the same delta (across objects),
// while unselected keyframes stay put.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_bm_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_bm_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_bm_proj_'));
const CTR_PATH = path.join(TMP, 'KfBatchMove.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'KfBatchMove',
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
    const t1 = { id: 't1', time: 0, text: 'A', opacity: 1, states: [
      { time: 1, text: 'B', opacity: 1 },
      { time: 5, text: 'C', opacity: 1 },
      { time: 9, text: 'D', opacity: 1 }
    ] };
    const t2 = { id: 't2', time: 0, text: 'X', opacity: 1, states: [
      { time: 3, text: 'Y', opacity: 1 }
    ] };
    S.storyboard.texts.push(t1, t2);
    S.selectedIds = ['t1', 't2'];
    S.selectedKfs = [
      { objId: 't1', index: 0 },
      { objId: 't1', index: 2 },
      { objId: 't2', index: 0 }
    ];
    window.__sb.refreshAll();
    window.__sb.timeline.setMultiSelection({
      ids: ['t1', 't2'],
      kfs: S.selectedKfs
    });
    await new Promise((r) => setTimeout(r, 120));

    const dragKf = (objId, kfIdx, deltaSec) => {
      const el = document.querySelector('.kf[data-id="' + objId + '"][data-kf="' + kfIdx + '"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: startX, clientY: startY }));
      const px = window.__sb.timeline.pxPerSec || 60;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: startX + deltaSec * px, clientY: startY }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: startX + deltaSec * px, clientY: startY }));
      return true;
    };

    // Drag the first selected keyframe of t1 by +3s: the whole batch moves.
    const okDrag = dragKf('t1', 0, 3);
    await new Promise((r) => setTimeout(r, 150));
    const t1Times = (t1.states || []).map((s) => s.time).slice().sort((a, b) => a - b);
    const t2Times = (t2.states || []).map((s) => s.time);

    // Fresh single-select drag must move only that keyframe.
    const t3 = { id: 't3', time: 0, text: 'P', opacity: 1, states: [
      { time: 2, text: 'Q', opacity: 1 },
      { time: 7, text: 'R', opacity: 1 }
    ] };
    S.storyboard.texts.push(t3);
    S.selectedIds = ['t3'];
    S.selectedKfs = [{ objId: 't3', index: 0 }];
    window.__sb.refreshAll();
    window.__sb.timeline.setMultiSelection({ ids: ['t3'], kfs: S.selectedKfs });
    await new Promise((r) => setTimeout(r, 120));
    const okSingle = dragKf('t3', 0, 1);
    await new Promise((r) => setTimeout(r, 150));
    const t3Times = (t3.states || []).map((s) => s.time).slice().sort((a, b) => a - b);

    return { okDrag, t1Times, t2Times, okSingle, t3Times };
  })()`);

  const result = {
    okDrag: out.okDrag,
    t1Times: out.t1Times,
    t2Times: out.t2Times,
    okSingle: out.okSingle,
    t3Times: out.t3Times,
    ok: out.okDrag === true &&
      JSON.stringify(out.t1Times) === JSON.stringify([4, 5, 12]) &&
      JSON.stringify(out.t2Times) === JSON.stringify([6]) &&
      out.okSingle === true &&
      JSON.stringify(out.t3Times) === JSON.stringify([3, 7])
  };
  fs.writeFileSync(path.join(__dirname, 'probe_kf_batchmove_out.json'), JSON.stringify(result, null, 2));
  console.log('BATCHMOVE_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_kf_batchmove_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
