// Verify round-8 changes.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  await new Promise(r => setTimeout(r, 800));
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_r8_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [
      { id: 3, type: 1, x: 0, tick: 2400, hold_tick: 960, page_index: 0 },
      { id: 10, type: 3, x: 0.1, tick: 2600, hold_tick: 0, page_index: 0, next_id: 11 },
      { id: 11, type: 4, x: 0.4, tick: 3000, hold_tick: 0, page_index: 0, next_id: 0 }
    ],
    event_order_list: [],
    music_offset: 0
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  const level = { schema_version: 2, version: 't', id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json' }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: null, storyboardContent: null }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1200));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
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
    const drag = ch.noteById(10);
    const child = ch.noteById(11);

    // 1) connector not clipped before trigger: sample along line below scanner
    let tPre = drag.start_time - 0.3;
    p.setTime(tPre, false); p.render();
    let info2 = p.ctxInfo();
    let a = p.notePos(drag, info2);
    let b = p.notePos(child, info2);
    // scanY is below drag head before trigger
    let scanPy = p.worldToPx(0, ch.getScannerPositionY(p.time), info2).y;
    // sample just above drag head (part that would be clipped after trigger)
    let sPre = [];
    for (let s = 0.05; s < 0.4; s += 0.1) {
      const x = a.x + (b.x - a.x) * s;
      const y = a.y + (b.y - a.y) * s;
      sPre.push(px(x, y)[0] + px(x, y)[1] + px(x, y)[2]);
    }
    // 2) after trigger: sample same points
    let tPost = drag.start_time + 0.35;
    p.setTime(tPost, false); p.render();
    info2 = p.ctxInfo();
    a = p.notePos(drag, info2);
    b = p.notePos(child, info2);
    let sPost = [];
    for (let s = 0.05; s < 0.4; s += 0.1) {
      const x = a.x + (b.x - a.x) * s;
      const y = a.y + (b.y - a.y) * s;
      sPost.push(px(x, y)[0] + px(x, y)[1] + px(x, y)[2]);
    }
    out.connectorClip = {
      preBright: sPre, postBright: sPost,
      dragStart: drag.start_time, tPre, tPost
    };

    // 3) drag head clear effect plays at trigger time
    p.drawClearEffects = p.drawClearEffects;
    // clear effect duration 0.4s; at start+0.1 the ripple should be near drag head
    p.setTime(drag.start_time + 0.1, false); p.render();
    info2 = p.ctxInfo();
    const dp = p.notePos(drag, info2);
    out.dragClearAtTrigger = {
      nearHead: px(dp.x + 60, dp.y),
      far: px(dp.x + 140, dp.y)
    };

    // 4) ripple geometry constants
    out.ripple = {
      maxRFactor: +(0.62 * 1.05).toFixed(4),
      alphaPeak: 0.7
    };

    // 5) background dim default
    p.backgroundImage = null;
    p.setTime(1, false); p.render();
    const bgPx = px(10, 10);
    out.bgDim = { bgPx };
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  const dom = await win.webContents.executeJavaScript(`(() => {
    const tl = window.__sb.timeline;
    const out = { zoomMax: tl.zoomSlider.max, zoomMin: tl.zoomSlider.min };
    // ruler label with ms: force small step by large px/s
    const saved = tl.pxPerSec;
    tl.pxPerSec = 60000;
    tl.render();
    const rctx = document.querySelector('#ruler').getContext('2d');
    // can't easily read text; just verify chooseStep includes 0.001
    tl.pxPerSec = 60000;
    out.stepAtMax = tl.chooseStep();
    tl.pxPerSec = saved;
    tl.render();
    return out;
  })()`);
  console.log('DOM:', JSON.stringify(dom));
  app.exit(0);
});
