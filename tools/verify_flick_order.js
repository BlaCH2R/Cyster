// Verify flick fill-before-ring order: the inner diamond outline (white) must
// stay visible over the fill, forming the central white region.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_flick_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({ type: c.type, path: c.path, content: fs.readFileSync(path.join(dir, c.path), 'utf8'), storyboardPath: c.storyboard ? c.storyboard.path : null, storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null }));
  const files = [];
  for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    p.chart.getScannerPositionY = () => -9999;
    p.setStoryboard({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] });
    p.markDirty();
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const flick = p.chart.notes.find(n => n.type === 5);
    if (!flick) return { err: 'no flick' };
    p.setTime(flick.start_time, false);
    p.render();
    const info2 = p.ctxInfo();
    const pos = p.noteScreenPos(flick, info2);
    const nc = p.noteColors(flick, null, null);
    const baseSize = (p.NOTE_SIZE_FACTOR ? p.NOTE_SIZE_FACTOR[flick.typeName] : 2.218) * ((p.chart.model.size || 1)) * 1.133333;
    const dPx = Math.round(baseSize * info2.S);
    const out = {
      id: flick.id, x: Math.round(pos.x), y: Math.round(pos.y),
      canvasW: W, canvasH: H,
      dPx: dPx, chartSize: p.chart.model.size,
      fill: nc.fill, ring: nc.ring,
      mergedCtrlKeys: Object.keys(p.mergedCtrl || {}).slice(0, 20),
      hasEval: !!p.evalResult
    };
    // Sample a horizontal line through the center and a diagonal
    const px = (x, y) => {
      const xc = Math.max(0, Math.min(W-1, Math.round(x)));
      const yc = Math.max(0, Math.min(H-1, Math.round(y)));
      const d = ctx.getImageData(xc, yc, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    out.center = px(pos.x, pos.y);
    // color histogram in the note area
    const hist = {};
    for (let dy = -dPx; dy <= dPx; dy += 8) {
      for (let dx = -dPx; dx <= dPx; dx += 8) {
        const c = px(pos.x + dx, pos.y + dy);
        const key = '#' + c.map(v => Math.round(v / 32) * 32).map(v => v.toString(16).padStart(2, '0')).join('');
        hist[key] = (hist[key] || 0) + 1;
      }
    }
    out.hist = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8);
    out.corners = {
      tl: px(10, 10), tr: px(W - 10, 10), bl: px(10, H - 10), br: px(W - 10, H - 10),
      mid: px(W / 2, H / 2), midLeft: px(200, H / 2), midRight: px(W - 200, H / 2)
    };
    out.horiz = [];
    for (let dx = -60; dx <= 60; dx += 6) out.horiz.push({ dx, rgb: px(pos.x + dx, pos.y) });
    out.diag = [];
    for (let r = -50; r <= 50; r += 6) out.diag.push({ r, rgb: px(pos.x + r, pos.y + r) });
    // --- controlled experiment on the SAME canvas context ---
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 200; testCanvas.height = 200;
    const tctx = testCanvas.getContext('2d');
    tctx.fillStyle = '#111318'; tctx.fillRect(0, 0, 200, 200);
    const fillTex = p.playerAssets.flickFill;
    tctx.save();
    tctx.translate(100, 100);
    tctx.drawImage(fillTex, -70, -70, 140, 140);
    tctx.globalCompositeOperation = 'source-atop';
    tctx.fillStyle = 'rgb(106,106,106)';
    tctx.fillRect(-70, -70, 140, 140);
    tctx.globalCompositeOperation = 'source-over';
    tctx.restore();
    const tpx = (x, y) => {
      const d = tctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    out.tintTest = {
      corner: tpx(10, 10), nearCenter: tpx(100, 100), edgeIn: tpx(145, 100), edgeOut: tpx(175, 100)
    };
    // --- same experiment but on the preview canvas context ---
    const pctx = ctx;
    pctx.save();
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.fillStyle = '#111318';
    pctx.fillRect(150, 40, 200, 200);
    pctx.translate(250, 140);
    pctx.drawImage(fillTex, -70, -70, 140, 140);
    pctx.globalCompositeOperation = 'source-atop';
    pctx.fillStyle = 'rgb(106,106,106)';
    pctx.fillRect(-70, -70, 140, 140);
    pctx.globalCompositeOperation = 'source-over';
    pctx.restore();
    const pp = (x, y) => {
      const d = pctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    out.previewCtxTint = {
      corner: pp(155, 45), nearCenter: pp(250, 140), edgeIn: pp(295, 140), edgeOut: pp(340, 140)
    };
    // --- transform variants on the preview ctx ---
    const variants = {};
    const runVariant = (name, setup) => {
      pctx.save();
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.fillStyle = '#111318';
      pctx.fillRect(150, 260, 220, 220);
      setup();
      pctx.drawImage(fillTex, -70, -70, 140, 140);
      pctx.globalCompositeOperation = 'source-atop';
      pctx.fillStyle = 'rgb(106,106,106)';
      pctx.fillRect(-70, -70, 140, 140);
      pctx.globalCompositeOperation = 'source-over';
      pctx.restore();
      const g = (x, y) => {
        const d = pctx.getImageData(x, y, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      variants[name] = { near: g(250, 360), edgeIn: g(295, 360), corner: g(160, 270) };
    };
    runVariant('rotate0', () => pctx.translate(250, 360));
    runVariant('rotate45', () => { pctx.translate(250, 360); pctx.rotate(Math.PI / 4); });
    runVariant('scaleFlip', () => { pctx.translate(250, 360); pctx.scale(1, -1); });
    runVariant('rotatePlusScale', () => { pctx.translate(250, 360); pctx.rotate(0); pctx.scale(1, -1); });
    out.transformVariants = variants;
    // --- test the ARROW texture (1024x512) with source-atop ---
    const arrowTest = document.createElement('canvas');
    arrowTest.width = 200; arrowTest.height = 200;
    const actx = arrowTest.getContext('2d');
    actx.fillStyle = '#111318'; actx.fillRect(0, 0, 200, 200);
    const arrowTex = p.playerAssets.flickLeft;
    actx.drawImage(arrowTex, 20, 60, 160, 80);
    actx.globalCompositeOperation = 'source-atop';
    actx.fillStyle = 'rgba(255,255,255,0.9)';
    actx.fillRect(20, 60, 160, 80);
    actx.globalCompositeOperation = 'source-over';
    const ag = (x, y) => {
      const d = actx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    out.arrowTint = {
      outside: ag(10, 10),
      inRectCorner: ag(25, 65),
      center: ag(100, 100),
      inRectMid: ag(100, 95)
    };
    // --- raw drawImage of the arrow texture, no tinting ---
    const rawTest = document.createElement('canvas');
    rawTest.width = 200; rawTest.height = 200;
    const rctx = rawTest.getContext('2d');
    rctx.fillStyle = '#111318'; rctx.fillRect(0, 0, 200, 200);
    rctx.drawImage(arrowTex, 20, 60, 160, 80);
    const rg = (x, y) => {
      const d = rctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    out.arrowRaw = {
      corner: rg(25, 65),
      center: rg(100, 100),
      mid: rg(100, 95)
    };
    // texture info
    out.arrowTexInfo = {
      complete: arrowTex.complete,
      naturalWidth: arrowTex.naturalWidth,
      naturalHeight: arrowTex.naturalHeight,
      width: arrowTex.width,
      height: arrowTex.height
    };
    window.__flickShot = canvas.toDataURL('image/png');
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  const dataUrl = await win.webContents.executeJavaScript(`window.__flickShot || ''`);
  if (dataUrl) {
    fs.writeFileSync(path.join(__dirname, 'shots', 'flick_order.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('flick shot saved');
  }
  app.exit(0);
});
