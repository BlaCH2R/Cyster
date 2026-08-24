// Verify the properties panel: on a keyframe it shows the raw editable state;
// between keyframes it shows interpolated values (read-only), and the panel
// follows the playhead while scrubbing.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_interp_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_interp_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_interp_proj_'));
const CTR_PATH = path.join(TMP, 'Interp.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Interp',
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
      { time: 4, text: 'C', opacity: 0 }
    ] };
    const ctl = { id: 'ctl_c', time: 0, states: [
      { time: 0, bloom: true },
      { time: 4, bloom: false }
    ] };
    S.storyboard.texts.push(t1);
    S.storyboard.controllers.push(ctl);

    const opacityInput = () => {
      const rows = document.querySelectorAll('#stateForm .field');
      for (const r of rows) {
        const lb = r.querySelector('label');
        if (lb && lb.textContent.indexOf('不透明度') >= 0) return r.querySelector('input');
      }
      return null;
    };
    const formState = () => {
      const inputs = document.querySelectorAll('#stateForm input, #stateForm select, #stateForm textarea');
      const disabled = inputs.length > 0 && [...inputs].every((el) => el.disabled);
      return { count: inputs.length, disabled, hint: !!document.querySelector('.interp-hint') };
    };

    // Select the text object, playhead on initial keyframe (t=0): editable.
    S.selectedObjId = 't1';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    window.__sb.setTime(0, false);
    await new Promise((r) => setTimeout(r, 120));
    const onKf0 = { ...formState(), opacity: opacityInput() ? opacityInput().value : null };

    // Playhead between keyframes (t=1): interpolated opacity 0.75, read-only.
    window.__sb.setTime(1, false);
    await new Promise((r) => setTimeout(r, 120));
    const interp1 = { ...formState(), opacity: opacityInput() ? opacityInput().value : null };

    // Playhead back on a keyframe (t=2): editable again, raw value 0.5.
    window.__sb.setTime(2, false);
    await new Promise((r) => setTimeout(r, 120));
    const onKf2 = { ...formState(), opacity: opacityInput() ? opacityInput().value : null };

    // Controller cards + easing select are read-only between keyframes.
    S.selectedObjId = 'ctl_c';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    window.__sb.setTime(2, false);
    await new Promise((r) => setTimeout(r, 120));
    const cardInputs = document.querySelectorAll('#stateForm .ctrl-card input, #stateForm .ctrl-card select, #stateForm .ctrl-card textarea');
    const ctrlReadOnly = cardInputs.length > 0 && [...cardInputs].every((el) => el.disabled);
    const easingDisabled = document.querySelector('#kfEasing') ? document.querySelector('#kfEasing').disabled : null;
    const ctrlHint = !!document.querySelector('.interp-hint');

    // Directly click K1 (t=2) while the playhead is at t=1 (between keyframes):
    // the panel must show that keyframe and stay editable.
    S.selectedObjId = 't1';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();
    window.__sb.setTime(1, false);
    await new Promise((r) => setTimeout(r, 120));
    const kf1 = document.querySelector('.kf[data-id="t1"][data-kf="1"]');
    const kr = kf1.getBoundingClientRect();
    kf1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: kr.left + 2, clientY: kr.top + 2 }));
    await new Promise((r) => setTimeout(r, 120));
    const clickedKf = { ...formState(), opacity: opacityInput() ? opacityInput().value : null, explicit: S.propsExplicitKf };
    // Moving the playhead elsewhere must NOT flip the clicked keyframe back to
    // interpolation.
    window.__sb.setTime(3, false);
    await new Promise((r) => setTimeout(r, 120));
    const clickedKfMoved = { ...formState(), opacity: opacityInput() ? opacityInput().value : null, explicit: S.propsExplicitKf };
    // Selecting the object itself clears the explicit keyframe: back to the
    // playhead rule (t=3 between keyframes -> read-only interpolation).
    const clickLabel = (id) => {
      const el = [...document.querySelectorAll('.lane-label')].find((x) => (x.title || '').indexOf(id) >= 0);
      if (!el) return null;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    };
    clickLabel('ctl_c');
    await new Promise((r) => setTimeout(r, 120));
    const objectSelCtl = { ...formState(), explicit: S.propsExplicitKf };
    clickLabel('t1');
    await new Promise((r) => setTimeout(r, 120));
    const objectSelT1 = { ...formState(), opacity: opacityInput() ? opacityInput().value : null, explicit: S.propsExplicitKf };

    return { onKf0, interp1, onKf2, ctrlReadOnly, easingDisabled, ctrlHint, clickedKf, clickedKfMoved, objectSelCtl, objectSelT1, cardCount: cardInputs.length };
  })()`);

  const result = {
    onKf0: out.onKf0,
    interp1: out.interp1,
    onKf2: out.onKf2,
    ctrlReadOnly: out.ctrlReadOnly,
    easingDisabled: out.easingDisabled,
    ctrlHint: out.ctrlHint,
    clickedKf: out.clickedKf,
    clickedKfMoved: out.clickedKfMoved,
    objectSelCtl: out.objectSelCtl,
    objectSelT1: out.objectSelT1,
    ok: out.onKf0 && out.onKf0.disabled === false && out.onKf0.opacity === '1' &&
      out.interp1 && out.interp1.disabled === true && out.interp1.hint === true &&
      Math.abs(parseFloat(out.interp1.opacity) - 0.75) < 0.01 &&
      out.onKf2 && out.onKf2.disabled === false && out.onKf2.hint === false &&
      out.ctrlReadOnly === true && out.easingDisabled === true && out.ctrlHint === true &&
      out.clickedKf && out.clickedKf.disabled === false && out.clickedKf.explicit === true &&
      Math.abs(parseFloat(out.clickedKf.opacity) - 0) < 0.01 &&
      out.clickedKfMoved && out.clickedKfMoved.disabled === false && out.clickedKfMoved.explicit === true &&
      Math.abs(parseFloat(out.clickedKfMoved.opacity) - 0) < 0.01 &&
      out.objectSelCtl && out.objectSelCtl.disabled === true && out.objectSelCtl.explicit === false &&
      out.objectSelT1 && out.objectSelT1.disabled === true && out.objectSelT1.explicit === false &&
      Math.abs(parseFloat(out.objectSelT1.opacity) - 0.25) < 0.01
  };
  fs.writeFileSync(path.join(__dirname, 'probe_interp_props_out.json'), JSON.stringify(result, null, 2));
  console.log('INTERP_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_interp_props_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
