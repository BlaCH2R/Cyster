// verify_round30.js - holdbar follows the hold's own rotation (center = hold
// body, the bar is NOT a rotation reference) and the scanline/boundaries are
// treated as infinitely long.
//
// The holdbar behavior is verified geometrically: we intercept every
// fillRect() call while the preview renders (via a proxy around the 2D
// context) and measure where the real dash rectangles land after the real
// transform chain. The dash centers must form a line that (a) tilts with the
// hold's own rot_z and (b) passes exactly through the hold body's screen
// center (the rotation center).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r30_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

function pcaLine(pts) {
  const n = pts.length;
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const mx = sx / n, my = sy / n;
  let xx = 0, xy = 0, yy = 0;
  for (const p of pts) {
    const dx = p.x - mx, dy = p.y - my;
    xx += dx * dx; xy += dx * dy; yy += dy * dy;
  }
  const tr = xx + yy;
  const det = Math.sqrt(Math.max(0, (xx - yy) * (xx - yy) + 4 * xy * xy));
  const l1 = (tr + det) / 2;
  let vx = 1, vy = 0;
  if (det > 1e-6) {
    vx = l1 - yy;
    vy = xy;
    const vl = Math.hypot(vx, vy);
    if (vl > 1e-6) { vx /= vl; vy /= vl; }
  }
  let ang = Math.atan2(vy, vx) * 180 / Math.PI;
  if (ang < 0) ang += 180;
  return { angle: ang, vx, vy, mx, my };
}

function angleDiff(a, b) {
  let d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const pcaLine = (pts) => {
        const n = pts.length;
        let sx = 0, sy = 0;
        for (const p of pts) { sx += p.x; sy += p.y; }
        const mx = sx / n, my = sy / n;
        let xx = 0, xy = 0, yy = 0;
        for (const p of pts) {
          const dx = p.x - mx, dy = p.y - my;
          xx += dx * dx; xy += dx * dy; yy += dy * dy;
        }
        const tr = xx + yy;
        const det = Math.sqrt(Math.max(0, (xx - yy) * (xx - yy) + 4 * xy * xy));
        const l1 = (tr + det) / 2;
        let vx = 1, vy = 0;
        if (det > 1e-6) {
          vx = l1 - yy;
          vy = xy;
          const vl = Math.hypot(vx, vy);
          if (vl > 1e-6) { vx /= vl; vy /= vl; }
        }
        let ang = Math.atan2(vy, vx) * 180 / Math.PI;
        if (ang < 0) ang += 180;
        return { angle: ang, vx, vy, mx, my };
      };
      const angleDiff = (a, b) => {
        let d = Math.abs(a - b) % 180;
        return Math.min(d, 180 - d);
      };
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      items.find(el => el.textContent.indexOf('extreme') >= 0).click();
      await promise;
      await new Promise(r => setTimeout(r, 1800));
      const pv = window.__sb.preview;
      const res = {};

      // 1. Structural: holdbar rotates around the UNROTATED hold-body center
      //    (camera rotation applied as the outer transform).
      const barSrc = pv.drawHoldBar.toString();
      res.holdbarOwnRot = barSrc.indexOf('rotate(ownRotZ)') >= 0 &&
        barSrc.indexOf('translate(ux, uy)') >= 0 &&
        barSrc.indexOf('noteOverrides') >= 0;
      // The note body must also rotate counterclockwise for positive rot_z
      // (canvas rotate is clockwise, so the storyboard value is negated).
      const noteSrc = pv.drawNote.toString();
      res.noteRotNeg = noteSrc.indexOf('-ovr.rot_z * Math.PI / 180') >= 0;

      const ch = pv.chart;
      const hold = ch.notes.find(n => n.type === 2 && n.hold_tick > 2000) ||
        ch.notes.find(n => n.type === 1 && n.hold_tick > 500);
      if (!hold) return { err: 'no long hold note' };
      const sb = window.__sb.state.storyboard;
      sb.note_controllers = sb.note_controllers || [];
      sb.note_controllers.push({ id: 'rot_hold', note: hold.id, time: 0,
        override_rot_z: true, rot_z: 45 });
      sb.controllers = sb.controllers || [];
      sb.controllers.push({ id: 'cam_rot', time: 0, rot_z: 0 });
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 200));

      pv.ui.showNoteIds = false;
      // Isolate the target hold's holdbar and remove frame noise.
      const origHoldBars = pv.drawHoldBars.bind(pv);
      pv.drawHoldBars = (ctx, info, note, ...rest) => {
        if (note.id !== hold.id) return;
        return origHoldBars(ctx, info, note, ...rest);
      };
      pv.drawStageLayer = () => {};
      pv.drawUI = () => {};
      pv.drawClearEffects = () => {};

      const realCtx = pv.canvas.getContext('2d');
      const dashLog = [];
      const proxy = new Proxy(realCtx, {
        get(t, prop) {
          if (prop === 'fillRect') {
            return (x, y, w, h) => {
              const tf = t.getTransform();
              dashLog.push({ x, y, w, h, tf, style: t.fillStyle });
              return t.fillRect(x, y, w, h);
            };
          }
          const v = t[prop];
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set(t, prop, v) { t[prop] = v; return true; }
      });
      pv.ctx = proxy;

      const measure = () => {
        dashLog.length = 0;
        pv.render();
        const info = pv.ctxInfo();
        const pos = pv.noteScreenPos(hold, info);
        const pts = [];
        const rawYs = [];
        for (const r of dashLog) {
          if (r.w < 10 || r.w > 500 || r.h < 1 || r.h > 20) continue; // holdbar dashes only
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
          const tf = r.tf;
          pts.push({ x: tf.a * cx + tf.c * cy + tf.e, y: tf.b * cx + tf.d * cy + tf.f });
          rawYs.push(r.y);
        }
        if (pts.length < 8) return { n: pts.length };
        const line = pcaLine(pts);
        // Perpendicular distance of the hold body center from the fitted line.
        const dx = pos.x - line.mx, dy = pos.y - line.my;
        const dist = Math.abs(dx * line.vy - dy * line.vx);
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        return {
          n: pts.length,
          angle: +line.angle.toFixed(1),
          centerDist: +dist.toFixed(1),
          xSpread: +(Math.max(...xs) - Math.min(...xs)).toFixed(1),
          yRange: +(Math.max(...ys) - Math.min(...ys)).toFixed(1),
          rawYMin: +Math.min(...rawYs).toFixed(1),
          rawYMax: +Math.max(...rawYs).toFixed(1)
        };
      };

      // 2. Behavioral: own rot_z only. Positive rot_z must rotate the bar
      //    COUNTERCLOCKWISE (like the native game), so the dash band slopes
      //    up-right -> down-left (canvas PCA angle 45 deg; was 135 before the
      //    direction fix).
      sb.note_controllers[sb.note_controllers.length - 1].rot_z = 45;
      sb.controllers[sb.controllers.length - 1].rot_z = 0;
      window.__sb.refreshAll();
      const tM = hold.start_time + (hold.end_time - hold.start_time) * 0.5;
      pv.setTime(tM, false);
      res.own45 = measure();

      // Control: own rot_z = 0 -> vertical band through the body center
      sb.note_controllers[sb.note_controllers.length - 1].rot_z = 0;
      window.__sb.refreshAll();
      pv.setTime(tM, false);
      res.own0 = measure();

      // Composition: own rot_z = 45 + camera rot_z = 15 -> absolute 150 deg
      sb.note_controllers[sb.note_controllers.length - 1].rot_z = 45;
      sb.controllers[sb.controllers.length - 1].rot_z = 15;
      window.__sb.refreshAll();
      pv.setTime(tM, false);
      res.cam15 = measure();

      // Progress fill restored: at 50% progress with a distinctive fill color,
      // the bar must show BOTH covered (fill color) and uncovered (white)
      // dashes, and the beyond-screen extension must be fill-colored.
      sb.note_controllers[sb.note_controllers.length - 1].rot_z = 0;
      sb.note_controllers[sb.note_controllers.length - 1].override_fill_color = true;
      sb.note_controllers[sb.note_controllers.length - 1].fill_color = '#FF00FF';
      sb.controllers[sb.controllers.length - 1].rot_z = 0;
      window.__sb.refreshAll();
      pv.setTime(hold.start_time + (hold.end_time - hold.start_time) * 0.5, false);
      dashLog.length = 0;
      pv.render();
      {
        let covered = 0, uncovered = 0, beyond = 0, beyondMagenta = 0;
        const info = pv.ctxInfo();
        const H = pv.canvas.height;
        for (const r of dashLog) {
          if (r.w < 10 || r.w > 500 || r.h < 1 || r.h > 20) continue;
          const isMagenta = /255,\\s*0,\\s*255/.test(r.style);
          if (isMagenta) covered++;
          else uncovered++;
          if (r.y < -H / 2 - info.camYpx || r.y > H / 2 - info.camYpx) {
            beyond++;
            if (isMagenta) beyondMagenta++;
          }
        }
        res.fill = { covered, uncovered, beyond, beyondMagenta, H };
        // Progressive fill: covered AND uncovered dashes both exist at 50%.
        // The extension beyond the visible pre-rotation range stays BLANK.
        res.fillOk = covered > 3 && uncovered > 3 && beyond > 0 && beyondMagenta === 0;
      }

      res.holdOvr = pv.noteOverrides[hold.id];
      res.holdbarTiltOk =
        res.own45.n >= 8 && angleDiff(res.own45.angle, 45) <= 15 && res.own45.centerDist < 8 &&
        res.own0.n >= 8 && res.own0.xSpread < 6 && res.own0.yRange > 100 &&
        res.cam15.n >= 8 && angleDiff(res.cam15.angle, 60) <= 15 && res.cam15.centerDist < 10;
      // Long-hold bars are infinitely long: dashes are painted far beyond the
      // screen bounds (pre-rotation), so rotation never exposes the ends.
      const H = pv.canvas.height;
      res.longholdInfinite = res.own0.rawYMin < -1.2 * H && res.own0.rawYMax > 1.2 * H;

      // 3. Structural: scanline + boundaries drawn with an infinite margin
      const worldSrc = pv.drawWorld.toString();
      const scanIdx = worldSrc.indexOf('// Scanline');
      const scanSrc = worldSrc.slice(scanIdx, scanIdx + 2600);
      res.scanlineInfinite = scanSrc.indexOf('INF') >= 0 && scanSrc.indexOf('W + INF') >= 0;
      return res;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('R30:', JSON.stringify(out));

  check('holdbar applies the hold own rotation around the body center',
    !out.err && out.holdbarOwnRot,
    JSON.stringify({ holdbarOwnRot: out.holdbarOwnRot }));
  check('note body rot_z uses the native counterclockwise direction',
    !out.err && out.noteRotNeg,
    JSON.stringify({ noteRotNeg: out.noteRotNeg }));
  check('holdbar dashes tilt with the hold rot_z and rotate around the body center',
    !out.err && out.holdbarTiltOk,
    JSON.stringify({ own45: out.own45, own0: out.own0, cam15: out.cam15 }));
  check('long-hold bars extend infinitely so rotation never shows the ends',
    !out.err && out.longholdInfinite,
    JSON.stringify({ rawYMin: out.own0 && out.own0.rawYMin, rawYMax: out.own0 && out.own0.rawYMax, H: out.own0 && 546 }));
  check('long-hold progress fill is progressive; beyond-screen extension stays blank',
    !out.err && out.fillOk,
    JSON.stringify(out.fill));
  check('scanline/boundaries drawn as infinitely long lines',
    !out.err && out.scanlineInfinite,
    JSON.stringify({ scanlineInfinite: out.scanlineInfinite }));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
