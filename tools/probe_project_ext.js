// Verify the .ctr project extension: create/open a .ctr project through the
// real IPC, then confirm a legacy .ctdsber copy still opens.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ext_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ext_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ext_proj_'));
const CTR_PATH = path.join(TMP, 'ExtTest.ctr');
const LEGACY_PATH = path.join(TMP, 'ExtTest.ctdsber');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'ExtTest',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    return { info: !!res.info, name: res.config.name, projectPath: res.projectPath };
  })()`);
  const ctrExists = fs.existsSync(CTR_PATH);
  const cfg = JSON.parse(fs.readFileSync(CTR_PATH, 'utf8'));

  // Legacy: copy the same config to .ctdsber and open it.
  fs.copyFileSync(CTR_PATH, LEGACY_PATH);
  const reopened = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR_PATH)} });
    const legacy = await window.sbAPI.projectOpen({ path: ${JSON.stringify(LEGACY_PATH)} });
    return { ctr: !!res.info, legacy: !!legacy.info, ctrPath: res.projectPath, legacyPath: legacy.projectPath };
  })()`);

  const result = {
    created: created && created.info,
    ctrFileCreated: ctrExists,
    format: cfg.format,
    reopenedCtr: reopened.ctr,
    reopenedLegacy: reopened.legacy,
    projectPathExt: path.extname(reopened.ctrPath)
  };
  fs.writeFileSync(path.join(__dirname, 'probe_project_ext_out.json'), JSON.stringify(result, null, 2));
  console.log('PROJECT_EXT_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_project_ext_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
