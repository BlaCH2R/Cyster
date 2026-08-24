const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 420,
    height: 240,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_filter_interp.html'));
});

app.on('window-all-closed', () => app.quit());
