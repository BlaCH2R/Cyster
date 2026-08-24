// Verify the WebGL sprite warp matches the full-resolution CPU reference
// (projection, tint, alpha, near-plane clipping) and that the parented-child
// opposite-depth behavior survives on the GPU path.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_sprite_gl_test.html'));
});

app.on('window-all-closed', () => app.quit());
