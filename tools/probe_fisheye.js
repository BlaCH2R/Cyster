// Verify the fisheye filter: intensity 0.5 = identity, 1.0 = barrel,
// 0.0 = pincushion (opposite). Set SB_PROBE_MODE=2d to force the 2D
// fallback path (separate process so the module's WebGL cache is fresh).
const { app, BrowserWindow } = require('electron');
const path = require('path');
const mode = process.env.SB_PROBE_MODE === '2d' ? '2d' : 'gl';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, 'probe_fisheye_test.html'), { query: { mode } });
});

app.on('window-all-closed', () => app.quit());
