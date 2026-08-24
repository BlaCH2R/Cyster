// Lightweight probe: line endpoints are world-space in the real engine
// (scaleToCanvas=false), so stageX/stageY endpoints convert via the camera
// size and project through worldToPx (rotation / perspective / camera x/y),
// and line width scales with the CURRENT camera ortho. Run directly:
//   electron.exe --no-sandbox --disable-gpu tools\probe_line_world.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 420,
    height: 240,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_line_world.html'));
});

app.on('window-all-closed', () => app.quit());
