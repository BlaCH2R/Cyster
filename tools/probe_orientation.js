// Lightweight orientation probe: loads only effects.js in a hidden renderer,
// runs a GL-only filter on a top-white/bottom-black canvas and samples the
// output rows to check the GL pipeline does not flip the frame vertically.
// Run directly: electron.exe --no-sandbox --disable-gpu tools\probe_orientation.js
// (Playwright full-app launches hang on this machine; do NOT use them.)
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
    fs.appendFileSync(path.join(__dirname, 'probe_orientation_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'fx_orientation_test.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
