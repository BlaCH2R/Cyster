// probe_tag_objects.js — why don't tag-created text/line/sprite objects show in preview?
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_tagobj_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await win.webContents.executeJavaScript(`(async () => {
    window.__sb.setTime(20, false);
    document.querySelector('.tl-add-tag[data-key="texts"] .tl-add').click();
    document.querySelector('.tl-add-tag[data-key="lines"] .tl-add').click();
    document.querySelector('.tl-add-tag[data-key="sprites"] .tl-add').click();
    await new Promise(r => setTimeout(r, 200));
    const p = window.__sb.preview;
    const sb = window.__sb.state.storyboard;
    const compiled = p.compiled;
    const ev = window.SBEngine.storyboard.evaluateStoryboard(compiled, 20);
    const dump = (arr) => arr.map(o => ({
      id: o.id, type: o.type,
      states: (o.states || []).map(s => ({ t: s.time, text: s.text, path: s.path, pos: s.pos && s.pos.length, opacity: s.opacity }))
    }));
    return {
      texts: dump(compiled.texts.filter(o => o.id.startsWith('text_'))),
      lines: dump(compiled.lines.filter(o => o.id.startsWith('line_'))),
      sprites: dump(compiled.sprites.filter(o => o.id.startsWith('sprite_') && o.id !== 'sprite_auto_1')),
      evalTexts: ev.texts.map(r => r.obj.id),
      evalLines: ev.lines.map(r => r.obj.id),
      evalSprites: ev.sprites.map(r => r.obj.id),
      time: window.__sb.preview.time,
      rawTexts: (sb.texts || []).slice(-2),
      rawLines: (sb.lines || []).slice(-2),
      rawSprites: (sb.sprites || []).slice(-2)
    };
  })()`);
  console.log('TAGOBJ:', JSON.stringify(out));
  app.exit(0);
});
