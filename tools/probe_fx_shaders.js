// Minimal probe: loads only effects.js in a hidden renderer, runs the
// shockwave / focus / arcade GLSL passes on a test canvas, writes results to
// probe_fx_shaders_out.json and exits. Avoids the full-app Playwright launch
// which tends to hang on this machine.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    fs.appendFileSync(path.join(__dirname, 'probe_fx_shaders_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.webContents.on('did-fail-load', (e, code, desc) => {
    fs.appendFileSync(path.join(__dirname, 'probe_fx_shaders_log.txt'),
      `[did-fail-load] ${code} ${desc}\n`);
  });
  win.webContents.on('render-process-gone', (e, details) => {
    fs.appendFileSync(path.join(__dirname, 'probe_fx_shaders_log.txt'),
      `[render-process-gone] ${details.reason}\n`);
  });
  win.loadFile(path.join(__dirname, 'fx_shader_test.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
