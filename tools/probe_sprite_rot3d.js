// Probe for the unified sprite 3D-rotation pipeline: continuity across 0°,
// per-axis direction (aligned with the native Unity conventions) and parent
// inheritance, in both ortho and perspective camera modes. Run directly:
//   electron.exe --no-sandbox --disable-gpu tools\probe_sprite_rot3d.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 420,
    height: 240,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_sprite_rot3d.html'));
});

app.on('window-all-closed', () => app.quit());
