// Verify round-4 changes against the user's project (bc.re_hachimitsu_adventure):
// holdbar before/after trigger, drag head colored inner circle, clear effect pos.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const DIR = 'D:/sd/Cytoid flies';
function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const chartPath = 'chart.re.txt';
  const sbPath = 'chart.re_storyboard.json';
  const charts = [{
    type: 're', path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), 'utf8'),
    storyboardPath: sbPath,
    storyboardContent: fs.readFileSync(path.join(DIR, sbPath), 'utf8')
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) { const st = fs.statSync(path.join(DIR, name)); if (st.isFile()) files.push({ name, size: st.size }); }
  return { level, levelDir: DIR, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const info = buildInfo();
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 3000));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    p.setStoryboard({ sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] });
    p.markDirty();
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ch = p.chart;
    const px = (x, y) => {
      const xc = Math.max(0, Math.min(W - 1, Math.round(x)));
      const yc = Math.max(0, Math.min(H - 1, Math.round(y)));
      const d = ctx.getImageData(xc, yc, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const out = {};

    // hold bar before trigger
    const hold = ch.notes.find(n => n.type === 1 && n.start_time - n.intro_time > 0.5);
    if (hold) {
      const barLen = Math.abs(ch.getScannerPositionY(hold.end_time) - hold.worldY) * p.ctxInfo().S;
      const scanBar = (t) => {
        p.setTime(t, false); p.render();
        const info2 = p.ctxInfo();
        const pos = p.notePos(hold, info2);
        const hits = [];
        for (let y = Math.max(0, Math.round(pos.y - barLen - 30)); y < Math.round(pos.y); y += 2) {
          const c = px(pos.x, y);
          if (c[0] + c[1] + c[2] > 80) hits.push({ y, rgb: c });
        }
        return hits.slice(0, 5);
      };
      const tPre = hold.intro_time + (hold.start_time - hold.intro_time) * 0.6;
      const tMid = (hold.start_time + hold.end_time) / 2;
      out.hold = {
        id: hold.id,
        preTrigger: scanBar(tPre),
        mid: scanBar(tMid),
        fill: p.noteColors(hold, null, null).fill
      };
    }

    // drag head inner color (user project has no fill override -> new default green)
    const drag = ch.notes.find(n => n.type === 3);
    if (drag) {
      p.setTime(drag.start_time, false);
      p.render();
      const info2 = p.ctxInfo();
      const pos = p.notePos(drag, info2);
      out.drag = {
        id: drag.id,
        fill: p.noteColors(drag, null, null).fill,
        center: px(pos.x, pos.y),
        up10: px(pos.x, pos.y - 10),
        down10: px(pos.x, pos.y + 10),
        mid: px(pos.x + 30, pos.y)
      };
    }
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
