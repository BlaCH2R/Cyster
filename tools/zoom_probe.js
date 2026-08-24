const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'zoom_probe_out.json');
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 800,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    await win.loadFile(path.join(__dirname, 'zoom_probe.html'));
    const out = await win.webContents.executeJavaScript('window.__measure()');
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    app.exit(0);
  } catch (e) {
    fs.writeFileSync(OUT, JSON.stringify({ error: String(e) }, null, 2));
    app.exit(1);
  }
});
app.on('window-all-closed', () => app.quit());
