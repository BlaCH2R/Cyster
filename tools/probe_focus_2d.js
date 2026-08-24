// Force the 2D fallback path for the focus filter and report radial coverage.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_focus_2d_test.html'));
});

app.on('window-all-closed', () => app.quit());
