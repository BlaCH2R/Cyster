const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 40000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1565, 220);
  await new Promise((r) => setTimeout(r, 1500));
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER:', e.message); } catch (err) {}
  });
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'toolbar_capture.png'), img.toPNG());
  console.log('captured', img.getSize());
  app.exit(0);
});
