// Verify: (1) manually added keyframes are kept sorted by time (not creation
// order), and (2) Ctrl+S saves the storyboard to the project file.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kf_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_kf_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kf_proj_'));
const CTR_PATH = path.join(TMP, 'KfTest.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'KfTest',
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
    // Deterministic minimal storyboard (the fixture's own file may lack a
    // texts array; this keeps the test independent of its content).
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const t1 = { id: 't1', states: [
      { time: 5, text: 'A', size: 40, color: '#ffffff', opacity: 1 },
      { time: 9, text: 'B', size: 40, color: '#ffffff', opacity: 1 }
    ] };
    S.storyboard.texts.push(t1);
    S.selectedObjId = 't1';
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();

    // 1) Add a keyframe EARLIER than existing ones (playhead at t=1).
    window.__sb.preview.setTime(1, false);
    window.__sb.addKeyframeAtPlayhead(t1);
    const after1 = t1.states.map((s) => s.time);

    // 2) Add one in the middle (playhead at t=7).
    window.__sb.preview.setTime(7, false);
    window.__sb.addKeyframeAtPlayhead(t1);
    const after2 = t1.states.map((s) => s.time);

    // 3) Copy the keyframe to the clipboard and paste it at playhead t=6.
    window.__sb.preview.setTime(6, false);
    window.__sb.copyKeyframe(t1);
    window.__sb.pasteKeyframesAtPlayhead();
    const after3 = t1.states.map((s) => s.time);

    // 4) Force an out-of-order array, then run the drag-end sort helper.
    const six = t1.states.find((s) => s.time === 6);
    const seven = t1.states.find((s) => s.time === 7);
    t1.states[2] = seven; t1.states[3] = six;
    S.selectedKeyIdx = t1.states.indexOf(six);
    window.__sb.sortAllObjectStates();
    const afterSort = t1.states.map((s) => s.time);
    const selectedPointsToSix = S.selectedKeyIdx === t1.states.indexOf(six);

    // 5) Ctrl+S: change a field, dispatch the shortcut, wait for the write.
    t1.states[0].opacity = 0.42;
    window.__sb.state.dirty = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 1500));
    return {
      after1, after2, after3, afterSort,
      selectedIdx: S.selectedKeyIdx,
      selectedPointsToSix,
      dirtyAfterSave: S.dirty,
      sbFile: S.storyboardFileName,
      levelDir: S.levelDir
    };
  })()`);

  const sbPath = path.join(TMP, out.sbFile || 'storyboard_base.json');
  const dirListing = fs.readdirSync(TMP).sort();
  const savedText = fs.existsSync(sbPath) ? fs.readFileSync(sbPath, 'utf8') : null;
  const saved = savedText ? JSON.parse(savedText) : null;
  const savedTimes = saved && saved.texts && saved.texts[0] && saved.texts[0].States
    ? saved.texts[0].States.map((s) => s.Time)
    : null;
  const sortedTimes = savedTimes && savedTimes.every((t, i) => i === 0 || savedTimes[i - 1] <= t);
  const includesKfs = savedTimes && [1, 5, 6, 7, 9].every((t) => savedTimes.indexOf(t) >= 0);
  const savedState1 = saved && saved.texts && saved.texts[0] && saved.texts[0].States
    ? saved.texts[0].States.find((s) => s.Time === 1)
    : null;
  const result = {
    after1: out.after1,
    after2: out.after2,
    after3: out.after3,
    afterSort: out.afterSort,
    selectedIdx: out.selectedIdx,
    dirtyAfterSave: out.dirtyAfterSave,
    savedTimes,
    levelDir: out.levelDir,
    dirListing,
    savedOpacity: savedState1 && savedState1.Opacity,
    okSort: JSON.stringify(out.after2) === JSON.stringify([1, 5, 7, 9]) &&
      JSON.stringify(out.afterSort) === JSON.stringify([1, 5, 6, 7, 9]) &&
      out.selectedPointsToSix === true,
    okSave: out.dirtyAfterSave === false && sortedTimes === true && includesKfs === true && savedState1 && savedState1.Opacity === 0.42
  };
  fs.writeFileSync(path.join(__dirname, 'probe_keyframe_sort_out.json'), JSON.stringify(result, null, 2));
  console.log('KEYFRAME_SORT_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_keyframe_sort_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
