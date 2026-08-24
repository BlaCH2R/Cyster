// Lightweight check that the scanner-smoothing branch uses TICK progress (like
// the game's Chart.GetScannerPositionY) on pages with internal tempo changes,
// and that smoothing is enabled by default at the engine level.
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
    fs.appendFileSync(path.join(__dirname, 'probe_scanner_smoothing_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'probe_scanner_smoothing.html'));
});

app.on('window-all-closed', () => app.quit());
