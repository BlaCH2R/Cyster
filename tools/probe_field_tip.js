// Minimal probe: loads schema.js in a hidden renderer, renders the
// note_controller form, and verifies the "Y 偏移" (dy) field shows a circled
// "i" icon whose hover popup displays the native-bug hint. Writes results to
// probe_field_tip_out.json and exits. Avoids full-app launch (hangs locally).
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 480,
    height: 360,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.webContents.on('console-message', (e, level, message) => {
    fs.appendFileSync(path.join(__dirname, 'probe_field_tip_log.txt'),
      `[console] ${message}\n`);
  });
  win.loadFile(path.join(__dirname, 'probe_field_tip.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
