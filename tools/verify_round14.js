// verify_round14.js — children fade-only (no size growth) + holdbar visibility.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));

  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('hard') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1500));

      const pv = window.__sb.preview;
      const ch = pv.chart;
      const canvas = pv.canvas;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;

      const measureRadius = (t, note) => {
        pv.setTime(t, false);
        pv.render();
        const info = pv.ctxInfo();
        const pos = pv.noteScreenPos(note, info);
        const img = ctx.getImageData(0, 0, W, H).data;
        const cx = Math.round(pos.x), cy = Math.round(pos.y);
        let top = null, bottom = null;
        for (let y = Math.max(0, cy - 150); y < Math.min(H, cy + 150); y++) {
          const i = (y * W + cx) * 4;
          const lum = (img[i] + img[i + 1] + img[i + 2]) / 3;
          if (lum > 90) { if (top == null) top = y; bottom = y; }
        }
        return (bottom != null && top != null) ? (bottom - top) / 2 : null;
      };

      // 1. Drag child: size at intro-mid must equal size at trigger (fade only)
      const child = ch.notes.find(n => n.type === 4);
      const childRes = {};
      if (child) {
        const mid = (child.intro_time + child.start_time) / 2;
        childRes.mid = measureRadius(mid, child);
        childRes.atStart = measureRadius(child.start_time, child);
        childRes.same = childRes.mid != null && childRes.atStart != null &&
          Math.abs(childRes.mid - childRes.atStart) / childRes.atStart < 0.18;
        childRes.initialScale = child.initial_scale;
      } else {
        childRes.err = 'no drag child';
      }

      // 2. Holdbar visibility: find a longhold, sample a point on its trail
      // away from the body where a dash should be visible
      const hold = ch.notes.find(n => n.type === 2 && n.end_time - n.start_time > 2);
      const holdRes = {};
      if (hold) {
        const t = (hold.start_time + hold.end_time) / 2;
        pv.setTime(t, false);
        pv.render();
        const info = pv.ctxInfo();
        const pos = pv.noteScreenPos(hold, info);
        // Sample a vertical strip along the holdbar column away from the body
        const img = ctx.getImageData(0, 0, W, H).data;
        const cx = Math.round(pos.x);
        let colored = 0, white = 0, body = 0;
        const yStart = Math.max(0, Math.round(pos.y) + 80);
        const yEnd = Math.min(H - 1, Math.round(pos.y) + 300);
        for (let y = yStart; y < yEnd; y++) {
          const i = (y * W + cx) * 4;
          const r = img[i], g = img[i + 1], b = img[i + 2];
          if (r > 200 && g > 200 && b > 200) white++;
          else if ((r + g + b) > 150) colored++;
          if (r > 120 || g > 120 || b > 120) body++;
        }
        holdRes.white = white;
        holdRes.colored = colored;
        holdRes.bright = body;
        holdRes.ok = (white + colored) > 8;
        holdRes.t = t;
        holdRes.holdId = hold.id;
      } else {
        holdRes.err = 'no long hold';
      }
      return { childRes, holdRes };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('drag child keeps final size during intro (fade only)',
    !out.err && out.childRes && !out.childRes.err && out.childRes.same && out.childRes.initialScale === 1,
    JSON.stringify(out.childRes));
  check('holdbar trail visible during hold',
    !out.err && out.holdRes && !out.holdRes.err && out.holdRes.ok,
    JSON.stringify(out.holdRes));

  // Screenshot at a hold moment for visual QA
  const shot = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const ch = pv.chart;
    const hold = ch.notes.find(n => n.type === 2 && n.end_time - n.start_time > 2);
    if (hold) {
      pv.setTime((hold.start_time + hold.end_time) / 2, false);
      await new Promise(r => setTimeout(r, 300));
    }
    return true;
  })()`);
  if (shot) {
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'shots', 'shot_holdbar.png'), img.toPNG());
  }

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
