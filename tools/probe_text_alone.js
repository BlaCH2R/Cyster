// probe_text_alone.js — does a tag-created text object paint at all?
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_ta_');
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
    try {
      const p = window.__sb.preview;
      const canvas = document.getElementById('previewCanvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const countAll = () => {
        const img = ctx.getImageData(0, 0, W, H).data;
        let n = 0;
        for (let i = 0; i < img.length; i += 4) {
          if (img[i] > 190 && img[i + 1] > 190 && img[i + 2] > 190) n++;
        }
        return n;
      };
      const results = {};
      for (const layer of [0, 1, 2]) {
        window.__sb.state.storyboard.texts = window.__sb.state.storyboard.texts || [];
        const before = window.__sb.state.storyboard.texts.length;
        window.__sb.setTime(1, false);
        p.render();
        const b = countAll();
        document.querySelector('#objectAddList .oa-row:nth-child(2) .oa-add').click();
        await new Promise(r => setTimeout(r, 150));
        const obj = window.__sb.state.storyboard.texts.slice(-1)[0];
        obj.layer = layer;
        window.__sb.refreshAll();
        await new Promise(r => setTimeout(r, 100));
        p.setTime(1, false);
        p.render();
        const a = countAll();
        const tr = p.evalResult.texts.find(r => r.obj.id === obj.id);
        results['layer' + layer] = {
          b, a, delta: a - b,
          evaled: !!tr,
          from: tr && tr.from && { text: tr.from.text, layer: tr.from.layer, opacity: tr.from.opacity, time: tr.from.time },
          created: window.__sb.state.storyboard.texts.length - before
        };
        window.__sb.state.storyboard.texts.pop();
        window.__sb.refreshAll();
        await new Promise(r => setTimeout(r, 80));
      }
      // Direct call to drawStageObject for the text
      window.__sb.state.storyboard.texts = window.__sb.state.storyboard.texts || [];
      document.querySelector('#objectAddList .oa-row:nth-child(2) .oa-add').click();
      await new Promise(r => setTimeout(r, 150));
      const obj = window.__sb.state.storyboard.texts.slice(-1)[0];
      window.__sb.setTime(1, false);
      p.render();
      const r = p.evalResult.texts.find(x => x.obj.id === obj.id);
      const info = p.ctxInfo();
      const before = countAll();
      let directErr = null;
      try {
        p.drawStageObject(ctx, info, r, 'text', 1);
      } catch (e) {
        directErr = String(e && e.message || e);
      }
      const after = countAll();
      return { results, direct: { delta: after - before, err: directErr, from: r && r.from } };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('TEXTALONE:', JSON.stringify(out));
  app.exit(0);
});
