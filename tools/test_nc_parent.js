// Lightweight code-level test for parent_id -> note_controller resolution in
// the preview. Constructs a compiled storyboard with a note_controller
// targeting note 5 and a sprite whose parent_id points at it, then checks
// stageMatrix anchors the sprite at the note's screen position.
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
    fs.appendFileSync(path.join(__dirname, 'test_nc_parent_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'test_nc_parent.html'));
});

app.on('window-all-closed', () => app.quit());
