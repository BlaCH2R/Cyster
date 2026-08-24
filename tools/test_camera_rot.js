// Lightweight code-level test for the camera 3D projection (rot_x / rot_y /
// rot_z direction semantics). Loads only preview.js in a hidden renderer and
// asserts the projection directions directly from the real code - no
// screenshots, no vision model. Run directly:
//   electron.exe --no-sandbox --disable-gpu tools\test_camera_rot.js
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
    fs.appendFileSync(path.join(__dirname, 'test_camera_rot_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'test_camera_rot.html'));
});

app.on('window-all-closed', () => app.quit());
