// Lightweight code-level test for note_controller hold_direction / style:
// verifies drawHoldBar honors the hold_dir override (bar above/below the
// note) and style=2 (bar shrinks toward the note, gone at hold end, no
// colored fill). Run directly:
//   electron.exe --no-sandbox --disable-gpu tools\test_hold_style.js
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
    fs.appendFileSync(path.join(__dirname, 'test_hold_style_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'test_hold_style.html'));
});

app.on('window-all-closed', () => app.quit());
