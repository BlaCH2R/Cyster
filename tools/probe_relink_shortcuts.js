// Verify two editor fixes:
//  1. The default Electron application menu is removed, so browser built-in
//     shortcuts (Ctrl+W close, Ctrl+R reload, Ctrl+Shift+I devtools, ...) no
//     longer fire inside the editor.
//  2. "重新连接文件" replaces the old file reference across the whole
//     storyboard data layer in real time: sprite/video objects AND their
//     keyframe states, so timeline clips and the preview pick up the new file
//     immediately.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_relink_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_relink_');
const NEW_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_newasset_')), 'new.png');
fs.writeFileSync(NEW_FILE, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
));

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try {
      const level = typeof e === 'object' ? e.level : e;
      const message = typeof e === 'object' ? e.message : '';
      if (level >= 2 || /error/i.test(message)) console.log('RENDERER:', message);
    } catch (err) {}
  });
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));

  const out = { checks: [], ok: true };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  // 1) The default Electron menu (source of Ctrl+W / Ctrl+R / Ctrl+Shift+I)
  // must be gone.
  check('Electron application menu removed', Menu.getApplicationMenu() === null, String(Menu.getApplicationMenu()));

  // Feed the relink file-picker with the temp file instead of opening a real
  // native dialog (the relink flow itself stays fully real).
  ipcMain.removeHandler('dialog:pick-file');
  ipcMain.handle('dialog:pick-file', async () => NEW_FILE);

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  // Ctrl+W in the renderer must not close the window.
  const aliveAfter = await win.webContents.executeJavaScript(`(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', ctrlKey: true, bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', ctrlKey: true, bubbles: true, cancelable: true }));
    return { ok: true };
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  check('Ctrl+W does not close the window', !win.isDestroyed() && aliveAfter.ok === true, aliveAfter.ok);

  const res = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const preview = window.__sb.preview;
    const out = {};
    const NEW = ${JSON.stringify(NEW_FILE.replace(/\\/g, '/'))};

    S.storyboard = {
      sprites: [
        { id: 'spOld', time: 0, path: 'old.png', opacity: 1, states: [{ time: 2, path: 'old.png' }] },
        { id: 'spOther', time: 0, path: 'other.png', opacity: 1 }
      ],
      videos: [
        { id: 'vdOld', time: 0, path: 'old.png', opacity: 1, states: [{ time: 3, path: 'old.png' }] }
      ],
      texts: [], lines: [], controllers: [], note_controllers: [], templates: {}
    };
    S.manualImages = ['old.png', 'other.png'];
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 150));

    await window.__sb.relinkAsset('old.png');
    await new Promise((r) => setTimeout(r, 250));

    const spOld = S.storyboard.sprites.find((s) => s.id === 'spOld');
    const spOther = S.storyboard.sprites.find((s) => s.id === 'spOther');
    const vdOld = S.storyboard.videos.find((v) => v.id === 'vdOld');
    out.data = {
      spOld: spOld.path,
      spOldKf: spOld.states[0].path,
      spOther: spOther.path,
      vdOld: vdOld.path,
      vdOldKf: vdOld.states[0].path,
      manual: S.manualImages.slice()
    };

    // The preview must be able to render the newly referenced file right away.
    const img = await preview.loadImage(NEW).catch((e) => null);
    out.loaded = !!(img && img.complete && img.naturalWidth > 0);
    return out;
  })()`);

  check('relink replaces sprite path and its keyframe states',
    res.data.spOld === res.data.spOldKf && res.data.spOld === NEW_FILE.replace(/\\/g, '/'),
    JSON.stringify(res.data));
  check('relink replaces video path and its keyframe states',
    res.data.vdOld === res.data.vdOldKf && res.data.vdOld === NEW_FILE.replace(/\\/g, '/'),
    JSON.stringify(res.data));
  check('relink leaves unrelated assets untouched', res.data.spOther === 'other.png', res.data.spOther);
  check('relink updates the library entry without duplicates',
    JSON.stringify(res.data.manual) === JSON.stringify(['other.png', NEW_FILE.replace(/\\/g, '/')]),
    JSON.stringify(res.data.manual));
  check('newly relinked file renders in the preview', res.loaded === true, res.loaded);

  fs.writeFileSync(path.join(__dirname, 'probe_relink_shortcuts_out.json'), JSON.stringify(out, null, 2));
  console.log('RELINK_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_relink_shortcuts_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
