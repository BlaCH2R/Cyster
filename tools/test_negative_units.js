// Code-level test: negative unit values (noteX/noteY/stageX/stageY/cameraX/Y
// and z) must take effect, not silently clamp to 0.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    fs.appendFileSync(path.join(__dirname, 'test_negative_units_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'test_negative_units.html'));
});

app.on('window-all-closed', () => app.quit());
