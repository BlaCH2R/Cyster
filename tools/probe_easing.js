// Verify easing handling end-to-end: 'none' output, the no-op alias options
// in the dropdown, and reading numeric Easing values back from a compiled file.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ease_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ease_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ease_proj_'));
const CTR_PATH = path.join(TMP, 'EaseTest.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'EaseTest',
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
    const t1 = { id: 't1', states: [
      { time: 0, text: 'A', easing: 'none' },
      { time: 2, text: 'B', easing: 'easeoutquad' },
      { time: 4, text: 'C', easing: 'spring' }
    ] };
    S.storyboard.texts.push(t1);
    S.selectedObjId = 't1';
    S.selectedKeyIdx = -1;
    window.__sb.refreshAll();

    // Easing option list (from schema.js EASING_OPTIONS).
    const options = window.SBSchema.EASING_OPTIONS.map((o) => o.value);
    const aliases = ['easein', 'easeout', 'easeinout'];
    const aliasResolvable = aliases.every((a) =>
      typeof window.SBEngine.easing.resolve(a) === 'function'
    );
    window.__sb.refreshAll();
    const badgeEasings = (window.__sb.timeline.objects.find((o) => o.id === 't1') || {}).keyframes
      ? window.__sb.timeline.objects.find((o) => o.id === 't1').keyframes.map((k) => k.easing)
      : [];

    // Save compiled output to the project file.
    const ok = await window.__sb.saveStoryboard();
    const fileName = S.storyboardFileName;
    return { ok, fileName, options, aliases, aliasResolvable, badgeEasings };
  })()`);

  const sbPath = path.join(TMP, out.fileName || 'storyboard_base.json');
  const compiled = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
  const compiledEasings = (compiled.texts && compiled.texts[0] && compiled.texts[0].States || [])
    .map((s) => s.Easing);

  // Reload the compiled file through the app's reader and simulate the
  // properties dropdown: does each state's easing value exist as an option?
  const readBack = await win.webContents.executeJavaScript(`(async () => {
    const back = window.SBEngine.storyboard.fromCompiled(${JSON.stringify(compiled)});
    const t = back && back.texts && back.texts[0];
    if (!t) return { error: 'no texts[0]' };
    const opts = window.SBSchema.EASING_OPTIONS.map((o) => o.value);
    const evals = [
      { where: 'base', easing: t.easing },
      ...(t.states || []).map((st, i) => ({ where: 'K' + (i + 1), easing: st.easing }))
    ].map((e) => ({ ...e, blank: !e.easing || !opts.includes(String(e.easing)) }));
    return evals;
  })()`);

  const result = {
    saveOk: out.ok,
    compiledEasings,
    aliasOptionsPresent: out.aliases.filter((a) => out.options.includes(a)),
    aliasResolvable: out.aliasResolvable,
    badgeEasings: out.badgeEasings,
    readBack
  };
  fs.writeFileSync(path.join(__dirname, 'probe_easing_out.json'), JSON.stringify(result, null, 2));
  console.log('EASING_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_easing_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
