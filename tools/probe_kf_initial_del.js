// Verify: deleting K0 (the formerly special "initial" keyframe) promotes the
// first remaining keyframe to become the new K0; with no keyframes left the object itself is
// deleted. Also verify long-hold bars ignore note_controller opacity, and note
// IDs draw upright in screen space.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ikd_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ikd_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ikd_proj_'));
const CTR_PATH = path.join(TMP, 'InitialDel.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'InitialDel',
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
      { time: 2, text: 'B', opacity: 0.5 },
      { time: 4, text: 'C', opacity: 0.25 }
    ] };
    S.storyboard.texts.push(t1);
    S.selectedObjId = 't1';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 150));

    const deleteInitial = async () => {
      const kf = document.querySelector('.kf[data-id="t1"][data-kf="-1"]');
      if (!kf) return false;
      const r = kf.getBoundingClientRect();
      kf.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 2, clientY: r.top + 2 }));
      await new Promise((r2) => setTimeout(r2, 80));
      const item = [...document.querySelectorAll('#contextMenu .cm-item')].find((x) => (x.textContent || '').indexOf('删除关键帧 K0') >= 0);
      if (!item) return false;
      item.click();
      await new Promise((r2) => setTimeout(r2, 150));
      return true;
    };

    const after1 = await deleteInitial();
    const state1 = { time: t1.time, text: t1.text, opacity: t1.opacity, states: (t1.states || []).map((s) => s.time) };

    const after2 = await deleteInitial();
    const state2 = { time: t1.time, text: t1.text, opacity: t1.opacity, states: (t1.states || []).map((s) => s.time) };

    const after3 = await deleteInitial();
    const gone = !(S.storyboard.texts || []).some((o) => o.id === 't1');

    // Long-hold bar opacity: note_controller opacity_multiplier ignored.
    const P = window.__sb.preview;
    P.noteVisualParams = () => ({ p: { x: 0, y: 0 }, d: 10, diameter: 10, opacity: 0.2, fill: {} });
    P.noteOverrides = { 99: { opacity: 0.2 } };
    const caps = [];
    P.drawHoldBar = (ctx, info, note, p, d, fill, opacity, t, isLong, diameter) => caps.push({ opacity, isLong, id: note.id });
    P.drawHoldBars({}, {}, { id: 99, type: 2 }, 1, null, null, 10);
    P.drawHoldBars({}, {}, { id: 99, type: 1 }, 1, null, null, 10);
    P.noteOverrides = {};
    P.noteVisualParams = () => ({ p: { x: 0, y: 0 }, d: 10, diameter: 10, opacity: 0.8, fill: {} });
    P.drawHoldBars({}, {}, { id: 98, type: 2 }, 0.8, null, null, 10);

    // Note ID draws with an identity (unrotated) screen transform.
    const transforms = [];
    const fakeCtx = {
      save() {}, restore() {},
      setTransform() { transforms.push([...arguments]); },
      font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
      shadowColor: '', shadowBlur: 0, fillStyle: '',
      fillText() {}
    };
    P.ui.showNoteIds = true;
    P.drawNoteId(fakeCtx, { id: 42 }, 10, { x: 5, y: 6 }, { r: 0, g: 0, b: 0 });

    return { after1, state1, after2, state2, after3, gone, caps, transforms };
  })()`);

  const result = {
    del1: out.state1,
    del2: out.state2,
    after3: out.after3,
    gone: out.gone,
    holdbarCaps: out.caps,
    noteIdTransform: out.transforms,
    ok: out.state1.time === 2 && out.state1.text === 'B' && out.state1.opacity === 0.5 &&
      JSON.stringify(out.state1.states) === JSON.stringify([4]) &&
      out.state2.time === 4 && out.state2.text === 'C' && out.state2.opacity === 0.25 &&
      JSON.stringify(out.state2.states) === JSON.stringify([]) &&
      out.after3 === true && out.gone === true &&
      out.caps && out.caps.length === 3 &&
      Math.abs(out.caps[0].opacity - 1) < 0.001 && out.caps[0].isLong === true &&
      Math.abs(out.caps[1].opacity - 0.2) < 0.001 && out.caps[1].isLong === false &&
      Math.abs(out.caps[2].opacity - 0.8) < 0.001 && out.caps[2].isLong === true &&
      out.transforms && out.transforms.length === 1 &&
      out.transforms[0][0] === 1 && out.transforms[0][1] === 0 && out.transforms[0][2] === 0 && out.transforms[0][3] === 1
  };
  fs.writeFileSync(path.join(__dirname, 'probe_kf_initial_del_out.json'), JSON.stringify(result, null, 2));
  console.log('IKD_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_kf_initial_del_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
