// Verify editor-only state (material library, hidden/locked objects, collapsed
// tags) is persisted into the .ctr project file and restored on reopen, and
// survives config rewrites (project:set-editable).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_pstate_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_pstate_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_pstate_proj_'));
const CTR_PATH = path.join(TMP, 'PState.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const first = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'PState',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.manualImages = ['my_art.png', 'clip.mp4'];
    S.objHidden = { spr_1: true };
    S.groupHidden = { sprites: true };
    S.lockedIds = new Set(['ctl_9']);
    S.tagCollapsed = { sprites: true, texts: false };
    S.dirty = true;
    await window.__sb.saveStoryboard();
    return { projectPath: res.projectPath };
  })()`);

  const ctrAfterSave = JSON.parse(fs.readFileSync(CTR_PATH, 'utf8'));

  // A config rewrite (e.g. switching difficulty) must keep the editor state.
  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectSetEditable({ projectPath: ${JSON.stringify(CTR_PATH)}, chart: 'chart.base.txt' });
    return !!res;
  })()`);
  const ctrAfterRewrite = JSON.parse(fs.readFileSync(CTR_PATH, 'utf8'));

  // Reopen the project and check the editor state is restored.
  const second = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR_PATH)} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    return {
      manualImages: S.manualImages,
      hiddenObjects: S.objHidden,
      groupHidden: S.groupHidden,
      lockedIds: [...S.lockedIds],
      collapsedTags: S.tagCollapsed
    };
  })()`);

  const result = {
    ctrEditorAfterSave: ctrAfterSave.editor,
    ctrEditorAfterRewrite: ctrAfterRewrite.editor,
    restored: second,
    ok: ctrAfterSave.editor &&
      JSON.stringify(ctrAfterSave.editor.manualImages) === JSON.stringify(['my_art.png', 'clip.mp4']) &&
      ctrAfterSave.editor.hiddenObjects.spr_1 === true &&
      JSON.stringify(ctrAfterSave.editor.lockedIds) === JSON.stringify(['ctl_9']) &&
      ctrAfterSave.editor.collapsedTags.sprites === true &&
      ctrAfterRewrite.editor &&
      JSON.stringify(ctrAfterRewrite.editor) === JSON.stringify(ctrAfterSave.editor) &&
      second.manualImages &&
      JSON.stringify(second.manualImages) === JSON.stringify(['my_art.png', 'clip.mp4']) &&
      second.hiddenObjects.spr_1 === true &&
      JSON.stringify(second.lockedIds) === JSON.stringify(['ctl_9']) &&
      second.collapsedTags.sprites === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_project_state_out.json'), JSON.stringify(result, null, 2));
  console.log('PSTATE_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_project_state_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
