// Compare GL vs CPU sprite alpha rendering across texture-alpha bands and
// object opacities (RGB and alpha channels separately).
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_sprite_alpha_test.html'));
});

app.on('window-all-closed', () => app.quit());
