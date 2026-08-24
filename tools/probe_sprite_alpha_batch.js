// Compare the per-layer GL batch path against the CPU reference with
// texture-alpha sprites at various opacities/tints.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_sprite_alpha_batch_test.html'));
});

app.on('window-all-closed', () => app.quit());
