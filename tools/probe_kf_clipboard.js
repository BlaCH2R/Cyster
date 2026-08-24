// Verify the clipboard keyframe flow: copy keyframe(s) to the clipboard,
// paste them at the playhead (relative spacing kept), and the timeline
// right-click context menu offers "粘贴关键帧至播放头位置".
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kfc_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_kfc_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kfc_proj_'));
const CTR_PATH = path.join(TMP, 'KfClipboard.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'KfClipboard',
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
      { time: 5, text: 'B', opacity: 0.7 },
      { time: 9, text: 'C', opacity: 0.3 }
    ] };
    S.storyboard.texts.push(t1);

    // 1) Single copy via the legacy helper, then paste at playhead t=3.
    S.selectedObjId = 't1';
    S.selectedKeyIdx = 1;
    S.selectedKfs = [{ objId: 't1', index: 1 }];
    window.__sb.refreshAll();
    window.__sb.copyKeyframe(t1);
    const clip1 = S.kfClipboard.length;
    window.__sb.preview.setTime(3, false);
    window.__sb.pasteKeyframesAtPlayhead();
    const pasted3 = (t1.states || []).find((s) => Math.abs(s.time - 3) < 1e-6);
    const single = pasted3 ? { text: pasted3.text, opacity: pasted3.opacity } : null;

    // 2) Multi-select two keyframes of a fresh object, copy, paste at t=20.
    const t2 = { id: 't2', time: 0, text: 'X', opacity: 1, states: [
      { time: 5, text: 'X', opacity: 1 },
      { time: 9, text: 'X', opacity: 1 }
    ] };
    S.storyboard.texts.push(t2);
    S.selectedObjId = 't2';
    S.selectedKeyIdx = 0;
    S.selectedKfs = [{ objId: 't2', index: 0 }, { objId: 't2', index: 1 }];
    window.__sb.refreshAll();
    window.__sb.copyKeyframesToClipboard();
    const clip2 = S.kfClipboard.length;
    const srcTimes = S.kfClipboard.map((c) => c.time);
    window.__sb.preview.setTime(20, false);
    window.__sb.pasteKeyframesAtPlayhead();
    const times = (t2.states || []).map((s) => s.time).slice().sort((a, b) => a - b);
    const has20 = times.indexOf(20) >= 0;
    const has24 = times.indexOf(24) >= 0;

    // 3) Right-click the timeline background opens the paste menu.
    document.querySelector('#tlContent').dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: 400, clientY: 200
    }));
    await new Promise((r) => setTimeout(r, 80));
    const menuText = document.querySelector('#contextMenu') ? document.querySelector('#contextMenu').textContent : '';
    const menuHasPaste = menuText.indexOf('粘贴关键帧至播放头位置') >= 0;
    document.body.click();

    return { clip1, clip2, srcTimes, single, times, has20, has24, menuHasPaste };
  })()`);

  const result = {
    clip1: out.clip1,
    clip2: out.clip2,
    srcTimes: out.srcTimes,
    single: out.single,
    times: out.times,
    has20: out.has20,
    has24: out.has24,
    menuHasPaste: out.menuHasPaste,
    ok: out.clip1 === 1 && out.clip2 === 2 &&
      out.single && out.single.text === 'C' && out.single.opacity === 0.3 &&
      JSON.stringify(out.srcTimes) === JSON.stringify([5, 9]) &&
      out.has20 === true && out.has24 === true && out.menuHasPaste === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_kf_clipboard_out.json'), JSON.stringify(result, null, 2));
  console.log('KFC_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_kf_clipboard_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
