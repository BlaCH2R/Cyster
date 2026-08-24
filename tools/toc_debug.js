const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const DOCX = path.join(__dirname, '..', 'app', 'assets', 'docs', 'Cyster使用手册(ver.0.1beta).docx');
const OUT = path.join(__dirname, 'toc_debug_out.json');
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 800,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    await win.loadFile(path.join(__dirname, 'toc_debug.html'));
    const data = fs.readFileSync(DOCX).toString('base64');
    await win.webContents.executeJavaScript('window.__docxData = ' + JSON.stringify(data));
    const out = await win.webContents.executeJavaScript('window.__render()');
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    app.exit(out.ok ? 0 : 1);
  } catch (e) {
    fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(e) }, null, 2));
    app.exit(1);
  }
});
app.on('window-all-closed', () => app.quit());
