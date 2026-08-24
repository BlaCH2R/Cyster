// Reproduce: toggling a controller boolean (filter) OFF should write an
// explicit false into the keyframe and into the compiled export.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_bool_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_bool_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_bool_proj_'));
const CTR_PATH = path.join(TMP, 'BoolTest.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'BoolTest',
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
    const ctl = { id: 'ctl_bool', time: 0, states: [{ time: 2, bloom: true }] };
    S.storyboard.controllers.push(ctl);

    const clickCheckbox = (labelPart) => {
      const rows = document.querySelectorAll('#stateForm .field');
      for (const r of rows) {
        const lb = r.querySelector('label');
        if (lb && lb.textContent.indexOf(labelPart) >= 0) {
          const cb = r.querySelector('input[type=checkbox]');
          if (cb) { cb.click(); return true; }
        }
      }
      return false;
    };

    const clicks = async (n) => {
      const seq = [];
      for (let i = 0; i < n; i++) {
        clickCheckbox('泛光');
        await new Promise((r) => setTimeout(r, 80));
        seq.push({ bloom: ctl.states[0].bloom, hasKey: 'bloom' in ctl.states[0] });
      }
      return seq;
    };

    // Keyframe K0 starts WITH bloom:true (checkbox checked). One click must
    // turn it OFF and keep an explicit false.
    S.selectedObjId = 'ctl_bool';
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();
    if (!clickCheckbox('泛光')) return { error: 'bloom checkbox not found (K0)' };
    await new Promise((r) => setTimeout(r, 80));
    const afterOneClick = { bloom: ctl.states[0].bloom, hasKey: 'bloom' in ctl.states[0] };

    // A state that starts with NO bloom field: ON then OFF must end false.
    const ctl2 = { id: 'ctl_bool2', time: 0, states: [{ time: 3 }] };
    S.storyboard.controllers.push(ctl2);
    S.selectedObjId = 'ctl_bool2';
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();
    clickCheckbox('泛光'); await new Promise((r) => setTimeout(r, 80));
    const onVal = { bloom: ctl2.states[0].bloom, hasKey: 'bloom' in ctl2.states[0] };
    clickCheckbox('泛光'); await new Promise((r) => setTimeout(r, 80));
    const offVal = { bloom: ctl2.states[0].bloom, hasKey: 'bloom' in ctl2.states[0] };

    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const ctlOut = compiled.controllers.find((c) => c.Id === 'ctl_bool2');
    const statesOut = (ctlOut && ctlOut.States || []).map((s) => ({ Time: s.Time, Bloom: s.Bloom, hasBloom: 'Bloom' in s }));
    return { afterOneClick, onVal, offVal, statesOut };
  })()`);

  const result = {
    k0Off: out.afterOneClick,
    freshOn: out.onVal,
    freshOff: out.offVal,
    compiledStates: out.statesOut,
    ok: out.afterOneClick && out.afterOneClick.hasKey === true && out.afterOneClick.bloom === false &&
      out.freshOn && out.freshOn.bloom === true &&
      out.freshOff && out.freshOff.hasKey === true && out.freshOff.bloom === false &&
      Array.isArray(out.statesOut) && out.statesOut.some((s) => s.hasBloom && s.Bloom === false)
  };
  fs.writeFileSync(path.join(__dirname, 'probe_bool_off_out.json'), JSON.stringify(result, null, 2));
  console.log('BOOL_OFF_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_bool_off_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
