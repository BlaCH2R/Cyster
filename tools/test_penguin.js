const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL_ZIP = 'C:/Users/Bc/Downloads/10234.penguin.cytoidlevel';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'penguin_test_'));

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      name: c.name,
      path: c.path,
      difficulty: c.difficulty,
      musicOverride: c.music_override ? c.music_override.path : null,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try { if (e.level >= 2) console.log('RENDERER[' + e.level + ']:', e.message); } catch (err) {}
  });
  // unzip level
  const { execFileSync } = require('child_process');
  const tmpZip = TMP + '.zip';
  fs.copyFileSync(LEVEL_ZIP, tmpZip);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${TMP}' -Force`]);
  const info = buildInfo(TMP);
  console.log('charts:', info.charts.map((c) => c.type + '/' + (c.storyboardPath || 'no-sb')));
  try {
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
    console.log('load ok');
  } catch (e) {
    console.log('load error:', e.message);
  }
  await new Promise((r) => setTimeout(r, 3000));
  const res = await win.webContents.executeJavaScript(`(() => {
    const st = window.__sb.state;
    const p = window.__sb.preview;
    const out = {
      storyboardFileName: st.storyboardFileName,
      sbKeys: st.storyboard ? Object.keys(st.storyboard) : null,
      chartNotes: p.chart ? p.chart.notes.length : null,
      chartEnd: p.chart ? p.chart.endTime : null,
      musicOffset: p.chart ? p.chart.musicOffset : null,
      audioPath: st.level && st.level.music ? st.level.music.path : null,
      status: document.getElementById('statusBar').textContent,
      lanes: document.querySelectorAll('.lane-row').length
    };
    // render a few frames, catch errors, check canvas non-empty
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const renders = [];
    for (const t of [0, 1.785, 10, 30, 60, 90, 120, 150, 180]) {
      try {
        p.setTime(t, false); p.render();
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonDark = 0;
        for (let i = 0; i < img.length; i += 64) if (img[i] + img[i+1] + img[i+2] > 120) nonDark++;
        renders.push({ t, nonDark, sprites: p.evalResult ? p.evalResult.sprites.length : -1, videos: p.evalResult ? p.evalResult.videos.length : -1 });
      } catch (e) {
        renders.push({ t, ERROR: e.message });
      }
    }
    out.renders = renders;
    return out;
  })()`);
  console.log('RESULT:', JSON.stringify(res, null, 1));
  app.exit(0);
});
