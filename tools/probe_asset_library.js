// Verify the asset library uses original files in place:
//   - level:add-asset no longer copies files or creates _1-style duplicates;
//   - external files are referenced by their absolute path, in-level files by
//     their relative path;
//   - same-basename entries are disambiguated with display labels (1)(2) only;
//   - the storyboard's path fields keep the real file identity and the
//     preview can render assets referenced from anywhere.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_asset_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_asset_');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// Two different source folders with the SAME basename, plus an in-level file.
const SRC1 = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_src1_'));
const SRC2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_src2_'));
const F1 = path.join(SRC1, 'dupe.png');
const F2 = path.join(SRC2, 'dupe.png');
fs.writeFileSync(F1, PNG);
fs.writeFileSync(F2, PNG);

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try {
      const level = typeof e === 'object' ? e.level : e;
      const message = typeof e === 'object' ? e.message : '';
      if (level >= 2 || /error/i.test(message)) console.log('RENDERER:', message);
    } catch (err) {}
  });
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));

  const out = { checks: [], ok: true };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const preview = window.__sb.preview;
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const F1 = ${JSON.stringify(F1)};
    const F2 = ${JSON.stringify(F2)};

    // 1) External file -> absolute path reference, no copy into the level.
    const r1 = await window.sbAPI.levelAddAsset({ levelDir: S.levelDir, filePath: F1 });
    const r2 = await window.sbAPI.levelAddAsset({ levelDir: S.levelDir, filePath: F2 });
    // 2) In-level file -> relative path reference.
    const r3 = await window.sbAPI.levelAddAsset({ levelDir: S.levelDir, filePath: S.levelDir.replace(/\\\\/g, '/') + '/bg.jpg' });
    out.refs = { r1, r2, r3 };

    // 3) Library rendering: manual entries first, same basename gets (1).
    S.manualImages = [r1, r2, r3];
    S.manualSizes = S.manualSizes || {};
    S.manualSizes[r1] = 100;
    window.__sb.refreshAll();
    await sleep(200);
    out.labels = Array.from(document.querySelectorAll('.asset-item .nm')).map((n) => n.textContent);

    // 4) Props path dropdown carries real paths with display labels.
    out.options = window.SBApp.assetOptions(['png', 'jpg', 'jpeg']);
    const optFor = (p) => (out.options.find((o) => o.value === p) || {});
    out.optR1 = optFor(r1);
    out.optR2 = optFor(r2);

    // 5) Sprite referencing an external file renders (original file in place).
    S.storyboard.sprites.push({ id: 'probeSp', time: 0, path: r1, opacity: 1, preserve_aspect: true });
    window.__sb.refreshAll();
    await sleep(250);
    const img = await preview.loadImage(r1).catch((e) => null);
    out.spriteLoaded = !!(img && img.complete && img.naturalWidth > 0);
    out.spritePath = S.storyboard.sprites.find((s) => s.id === 'probeSp').path;
    return out;
  })()`);

  // No copies / _1 duplicates may exist inside the level.
  const levelDupes = fs.readdirSync(PLAYER).filter((n) => /^dupe/i.test(n));

  check('external file referenced in place (absolute path)',
    res.refs.r1 === F1.replace(/\\/g, '/') && res.refs.r2 === F2.replace(/\\/g, '/'),
    JSON.stringify(res.refs));
  check('in-level file keeps relative path', res.refs.r3 === 'bg.jpg', res.refs.r3);
  check('no copies or _1 duplicates created in the level', levelDupes.length === 0, JSON.stringify(levelDupes));
  check('library shows same-basename entries with (1) label only',
    res.labels.includes('dupe.png') && res.labels.includes('dupe (1).png') && !res.labels.some((l) => /dupe_/.test(l)),
    JSON.stringify(res.labels));
  check('props dropdown values are real paths with distinct labels',
    res.optR1.label === 'dupe.png' && res.optR2.label === 'dupe (1).png',
    JSON.stringify({ r1: res.optR1, r2: res.optR2 }));
  check('sprite keeps the original path in the storyboard', res.spritePath === res.refs.r1, res.spritePath);
  check('preview renders the externally referenced file', res.spriteLoaded === true, res.spriteLoaded);

  fs.writeFileSync(path.join(__dirname, 'probe_asset_library_out.json'), JSON.stringify(out, null, 2));
  console.log('ASSET_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_asset_library_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
