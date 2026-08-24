const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL_ZIP = 'C:/Users/Bc/Downloads/10234.penguin.cytoidlevel';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'penguin_verify_'));

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, name: c.name, path: c.path, difficulty: c.difficulty, musicOverride: c.music_override ? c.music_override.path : null, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER:', e.message); } catch (err) {}
  });
  const tmpZip = TMP + '.zip';
  fs.copyFileSync(LEVEL_ZIP, tmpZip);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${TMP}' -Force`]);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(TMP))})`);
  await new Promise((r) => setTimeout(r, 4000));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const r = {};
    const p = window.__sb.preview;
    r.audioReady = window.__sb.state.audioReady;
    r.audioDuration = p.audio ? (p.audio.duration || null) : null;
    r.hasPlayerClass = !!(p.audio && typeof p.audio.play === 'function' && typeof p.audio.getTime === 'function');
    // noteID toggle
    const chk = document.getElementById('chkShowIds');
    r.idChkExists = !!chk;
    r.showIdsBefore = p.ui.showNoteIds;
    chk.click();
    r.showIdsAfterOff = p.ui.showNoteIds;
    r.dirtyAfterToggle = p._dirty === true;
    chk.click();
    r.showIdsAfterOn = p.ui.showNoteIds;
    // playback clock via Web Audio
    window.__sb.setTime(10, false);
    window.__sb.togglePlay();
    await new Promise((res) => setTimeout(res, 500));
    r.playing = !!(p.audio && p.audio.playing);
    r.timeAfterPlay = p.time;
    r.currentTime = p.audio ? p.audio.currentTime : null;
    window.__sb.togglePlay();
    await new Promise((res) => setTimeout(res, 200));
    r.paused = !(p.audio && p.audio.playing);
    return r;
  })()`);
  console.log('VERIFY:', JSON.stringify(out, null, 1));
  app.exit(0);
});
