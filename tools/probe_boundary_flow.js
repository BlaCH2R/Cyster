// Verify the scan-boundary dash flow: top edge slides LEFT, bottom edge
// slides RIGHT, between two nearby times.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_bflow_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：文字\\TextTest';

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));
  const info = buildInfo(LEVEL);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 3000));

  const out = await win.webContents.executeJavaScript(`(() => {
    const pv = window.__sb.preview;
    const W = pv.canvas.width, H = pv.canvas.height;
    const ch = pv.chart;
    const topY = ch.convertChartYToScreenY(1);
    const botY = ch.convertChartYToScreenY(0);
    const info2 = pv.ctxInfo();
    const topPx = Math.round(H / 2 - pv.projectedY(topY, info2));
    const botPx = Math.round(H / 2 - pv.projectedY(botY, info2));
    const sample = (t) => {
      pv.setTime(t, false);
      pv.render();
      const ctx = pv.ctx;
      const img = ctx.getImageData(0, 0, W, H).data;
      // Phase of the dash pattern: the second dash-run start (fully in view).
      const secondRun = (row) => {
        let count = 0;
        let inDash = false;
        for (let x = 0; x < W; x++) {
          const i = (row * W + x) * 4;
          const bright = img[i] > 90 && img[i + 1] > 90 && img[i + 2] > 90;
          if (!inDash && bright) {
            count++;
            if (count === 2) return x;
          }
          inDash = bright;
        }
        return null;
      };
      return { top: secondRun(topPx), bot: secondRun(botPx) };
    };
    const a = sample(1);
    const b = sample(1.02);
    return { topPx, botPx, a, b, dTop: b.top - a.top, dBot: b.bot - a.bot };
  })()`);
  console.log('BOUNDARY:', JSON.stringify(out));
  const ok = out && out.a.top != null && out.b.top != null &&
    out.dTop < -0.5 && out.dBot > 0.5;
  console.log(ok ? 'PASS top-left / bottom-right' : 'FAIL flow direction', ':: top=', out.dTop, 'bot=', out.dBot);
  app.exit(ok ? 0 : 1);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
