// Real-project reproduction: loads the robotic girl project's compiled
// storyboard + chart, runs fromCompiled -> StoryboardCompiler -> evaluate,
// and checks that sprite "big_dad" (parent_id -> note_controller "mega_dad")
// anchors at note 1456's screen position.
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
    fs.appendFileSync(path.join(__dirname, 'test_nc_parent_real_log.txt'),
      `[console] ${message} (${sourceId}:${line})\n`);
  });
  win.loadFile(path.join(__dirname, 'test_nc_parent_real.html'));
});

app.on('window-all-closed', () => app.quit());
