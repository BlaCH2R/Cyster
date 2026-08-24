// Lightweight code-level check for the SPEED UP / SPEED DOWN event-text draw
// order. Loads only preview.js in a hidden renderer, stubs the draw methods
// of a real PreviewRenderer, and asserts render() calls them in the required
// order: background → layer0 → layer1 → event text → notes → layer2 → UI.
// The event text must be BELOW notes and ABOVE layer-0/1 stage objects.
// Run via run_cmd.js: electron.exe --no-sandbox --disable-gpu
//   tools\probe_event_text_layer.js
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
    fs.appendFileSync(path.join(__dirname, 'probe_event_text_layer_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'probe_event_text_layer.html'));
});

app.on('window-all-closed', () => app.quit());
