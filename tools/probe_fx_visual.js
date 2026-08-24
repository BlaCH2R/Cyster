// Lightweight visual probe: renders the three GLSL effects (arcade / focus /
// shockwave) on the player's real background image and saves PNGs for
// comparison against real cytoidplayer screenshots.
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
    fs.appendFileSync(path.join(__dirname, 'probe_fx_visual_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'fx_visual_test.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
