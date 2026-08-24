// verify_round12.js — .cytoidlevel import always creates a new project, and
// .ctdsber file updates preserve multi-difficulty level.json structure.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

function makeZip(srcDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const tmpZip = zipPath + '.zip';
  if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
  const items = fs.readdirSync(srcDir).map((n) => path.join(srcDir, n)).join("','");
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    `Compress-Archive -Path '${items}' -DestinationPath '${tmpZip}' -Force`], { timeout: 30000 });
  fs.renameSync(tmpZip, zipPath);
}

// Build a synthetic multi-difficulty level zip
const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r12_src_'));
const chartText = 'PAGE_SIZE 4\nPAGE_SHIFT 0\nNOTE 0 0 0 0\nNOTE 1 1 0 0\n';
fs.writeFileSync(path.join(srcDir, 'chart_easy.txt'), chartText, 'utf8');
fs.writeFileSync(path.join(srcDir, 'chart_hard.txt'), chartText, 'utf8');
fs.writeFileSync(path.join(srcDir, 'chart_extreme.txt'), chartText, 'utf8');
fs.writeFileSync(path.join(srcDir, 'music.ogg'), Buffer.from('fakeogg'), 'utf8');
fs.writeFileSync(path.join(srcDir, 'music_hard.ogg'), Buffer.from('fakeogg2'), 'utf8');
fs.writeFileSync(path.join(srcDir, 'bg.jpg'), Buffer.from('fakejpg'), 'utf8');
fs.writeFileSync(path.join(srcDir, 'storyboard_easy.json'), JSON.stringify({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] }), 'utf8');
const level = {
  schema_version: 2,
  version: 1,
  id: 'multi_test',
  title: 'MultiTest',
  artist: 'T',
  music: { path: 'music.ogg' },
  background: { path: 'bg.jpg' },
  charts: [
    { type: 'easy', path: 'chart_easy.txt', difficulty: 2, storyboard: { path: 'storyboard_easy.json' } },
    { type: 'hard', path: 'chart_hard.txt', difficulty: 8, music_override: { path: 'music_hard.ogg' } },
    { type: 'extreme', path: 'chart_extreme.txt', difficulty: 12 }
  ]
};
fs.writeFileSync(path.join(srcDir, 'level.json'), JSON.stringify(level, null, 2), 'utf8');
const zipPath = path.join(os.tmpdir(), 'cytoid_sb_r12_level_' + Date.now() + '.cytoidlevel');
makeZip(srcDir, zipPath);

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r12_dest_'));

  // 1. Import #1
  const first = await win.webContents.executeJavaScript(`window.sbAPI.projectImportLevelTo({
    filePath: ${JSON.stringify(zipPath)},
    destFolder: ${JSON.stringify(dest)}
  })`);
  const dir1 = path.dirname(first.projectPath);
  const lv1 = JSON.parse(fs.readFileSync(path.join(dir1, 'level.json'), 'utf8'));
  const cfg1 = JSON.parse(fs.readFileSync(first.projectPath, 'utf8'));
  check('import creates new project with preserved charts/config',
    first && fs.existsSync(first.projectPath) && lv1.charts.length === 3 &&
    cfg1.files.chart === 'chart_easy.txt' && cfg1.files.music === 'music.ogg' &&
    cfg1.files.storyboard === 'storyboard_easy.json' && cfg1.version === 2 && !!cfg1.updated_at,
    JSON.stringify({ projectPath: first.projectPath, charts: lv1.charts.length, cfg: cfg1.files, ver: cfg1.version }));

  // 2. Import #2 (same zip) — must create a second project, never overwrite
  const second = await win.webContents.executeJavaScript(`window.sbAPI.projectImportLevelTo({
    filePath: ${JSON.stringify(zipPath)},
    destFolder: ${JSON.stringify(dest)}
  })`);
  const dir2 = path.dirname(second.projectPath);
  const firstJson = JSON.stringify(lv1);
  const lv1After = JSON.parse(fs.readFileSync(path.join(dir1, 'level.json'), 'utf8'));
  check('second import creates another project, first untouched',
    dir1 !== dir2 && firstJson === JSON.stringify(lv1After),
    JSON.stringify({ dir1, dir2 }));

  // 3. Update chart in project #1 — multi-chart structure must survive
  const newChart = path.join(dir1, 'chart_new.json');
  fs.writeFileSync(newChart, 'PAGE_SIZE 4\nPAGE_SHIFT 0\nNOTE 0 0 0 0\nNOTE 2 2 0 0\n', 'utf8');
  const u1 = await win.webContents.executeJavaScript(`window.sbAPI.projectUpdateFile({
    projectPath: ${JSON.stringify(first.projectPath)}, kind: 'chart', filePath: ${JSON.stringify(newChart)}
  })`);
  const lv3 = JSON.parse(fs.readFileSync(path.join(dir1, 'level.json'), 'utf8'));
  check('chart update preserves multi-difficulty level.json',
    !!u1 && lv3.charts.length === 3 &&
    lv3.charts[0].path === 'chart_new.json' && lv3.charts[1].path === 'chart_hard.txt' &&
    lv3.charts[2].path === 'chart_extreme.txt' && lv3.charts[1].music_override.path === 'music_hard.ogg',
    JSON.stringify(lv3.charts.map((c) => c.path)));

  // 4. Update music — music_override of the hard chart must survive
  const newMusic = path.join(dir1, 'music_new.ogg');
  fs.writeFileSync(newMusic, 'fakeogg3', 'utf8');
  const u2 = await win.webContents.executeJavaScript(`window.sbAPI.projectUpdateFile({
    projectPath: ${JSON.stringify(first.projectPath)}, kind: 'music', filePath: ${JSON.stringify(newMusic)}
  })`);
  const lv4 = JSON.parse(fs.readFileSync(path.join(dir1, 'level.json'), 'utf8'));
  check('music update preserves music_override entries',
    !!u2 && lv4.music.path === 'music_new.ogg' &&
    lv4.charts[1].music_override.path === 'music_hard.ogg' && lv4.charts.length === 3,
    JSON.stringify({ main: lv4.music.path, override: lv4.charts[1].music_override.path }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
