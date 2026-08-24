// Verify the sprite warp fix: near-plane clipping (no more explosion /
// disappearance on large rot_x/rot_y) and seam-free per-pixel warping.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_sprite_warp_test.html'));
});

app.on('window-all-closed', () => app.quit());
