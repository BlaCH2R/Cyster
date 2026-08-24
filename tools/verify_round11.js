// verify_round11.js — left-panel object tags, text/line/sprite visibility,
// ruler offset at the label-column boundary, playhead right clamp.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_r11_');
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

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Tag rows live in the left panel; old timeline add bar is gone
  const panel = await win.webContents.executeJavaScript(`(() => {
    const rows = Array.from(document.querySelectorAll('#objectAddList .oa-row')).map(r => r.dataset.key || r.querySelector('.oa-name').textContent);
    const plus = document.querySelectorAll('#objectAddList .oa-add').length;
    return { rows: document.querySelectorAll('#objectAddList .oa-row').length, plus, oldBar: !!document.getElementById('tlAddBar') };
  })()`);
  check('object tags moved to left panel', panel.rows === 6 && panel.plus === 6 && !panel.oldBar, JSON.stringify(panel));

  // 2. text / line / sprite objects actually draw in the preview
  const draw = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = window.__sb.preview;
      const canvas = document.getElementById('previewCanvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      window.__sb.setTime(20, false);
      p.render();
      const countBrightAll = () => {
        const img = ctx.getImageData(0, 0, W, H).data;
        let n = 0;
        for (let i = 0; i < img.length; i += 4) {
          if (img[i] > 190 && img[i + 1] > 190 && img[i + 2] > 190) n++;
        }
        return n;
      };
      const before = countBrightAll();

      // text
      document.querySelector('#objectAddList .oa-row:nth-child(2) .oa-add').click();
      await new Promise(r => setTimeout(r, 150));
      const textObj = (window.__sb.state.storyboard.texts || []).slice(-1)[0];
      p.render();
      const afterText = countBrightAll();

      // line
      document.querySelector('#objectAddList .oa-row:nth-child(3) .oa-add').click();
      await new Promise(r => setTimeout(r, 150));
      const lineObj = (window.__sb.state.storyboard.lines || []).slice(-1)[0];
      p.render();
      const afterLine = countBrightAll();

      // sprite: add bg to library then create
      const bg = window.__sb.state.level.background && window.__sb.state.level.background.path;
      if (bg) window.__sb.state.manualImages.push(bg);
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 120));
      document.querySelector('#objectAddList .oa-row:nth-child(1) .oa-add').click();
      await new Promise(r => setTimeout(r, 200));
      const spriteObj = (window.__sb.state.storyboard.sprites || []).slice(-1)[0];
      p.render();
      const afterSprite = countBrightAll();

      return {
        before, afterText, afterLine, afterSprite,
        textEval: !!p.evalResult.texts.find(r => r.obj.id === textObj.id),
        lineEval: !!p.evalResult.lines.find(r => r.obj.id === lineObj.id),
        spriteEval: !!p.evalResult.sprites.find(r => r.obj.id === spriteObj.id),
        textPath: textObj && textObj.text,
        lineWidth: lineObj && JSON.stringify(lineObj.width),
        spritePath: spriteObj && spriteObj.path
      };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  check('text object draws in preview', !draw.err && draw.textEval && draw.afterText > draw.before, JSON.stringify(draw));
  check('line object draws in preview', !draw.err && draw.lineEval && draw.afterLine > 5, JSON.stringify(draw));
  check('sprite object draws in preview', !draw.err && draw.spriteEval && draw.spritePath && draw.afterSprite > draw.before, JSON.stringify(draw));

  // 3. Ruler canvas starts at the label-column boundary
  const ruler = await win.webContents.executeJavaScript(`(() => {
    const r = document.getElementById('ruler');
    return { marginLeft: r.style.marginLeft, width: r.width, contentW: window.__sb.timeline.contentWidth() };
  })()`);
  check('ruler clamped at label boundary', ruler.marginLeft === '190px' && ruler.width === Math.max(10, ruler.contentW - 190), JSON.stringify(ruler));

  // 4. Playhead cannot be dragged past the music length
  const rightClamp = await win.webContents.executeJavaScript(`(async () => {
    const tl = window.__sb.timeline;
    const dur = tl.duration;
    tl.setTime(dur + 99);
    const afterSet = tl.time;
    tl.setTime(dur / 2);
    const ph = tl.playhead;
    const rect = tl.content.getBoundingClientRect();
    ph.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 3000, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    return { dur, afterSet, afterDrag: tl.time, left: ph.style.left, maxLeft: (190 + dur * tl.pxPerSec).toFixed(1) };
  })()`);
  check('playhead right clamp at music length',
    rightClamp.afterSet === rightClamp.dur && rightClamp.afterDrag <= rightClamp.dur + 0.001 && parseFloat(rightClamp.left) <= parseFloat(rightClamp.maxLeft) + 0.5,
    JSON.stringify(rightClamp));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
