// Lightweight probe: exercise all 16 exact GL filter ports from the Cytoid
// 2.1.5 APK shaders (rich path) and verify math/neutral points.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'fx_exact_test.html'));
});

app.on('window-all-closed', () => app.quit());
