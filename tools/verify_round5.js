// Verify round-5 changes with a synthetic chart:
//  - earlier notes render on top of later ones
//  - hold/longhold fill is full during approach (fades in with the ring)
//  - holdbar paints the white dashes (mask fill) instead of a solid band
//  - holdbar length = scanner distance from start to clear time
//  - hold clear effect X matches the note X
//  - c-drag head is click-style (ring + fill) with a center arrow
//  - drag head slides smoothly along the chain
//  - drag sizes are 70%
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_r5_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [
      { id: 1, type: 0, x: 0, tick: 2000, hold_tick: 0, page_index: 0 },
      { id: 2, type: 0, x: 0, tick: 2100, hold_tick: 0, page_index: 0 },
      { id: 3, type: 1, x: 0, tick: 2400, hold_tick: 960, page_index: 0 },
      { id: 10, type: 3, x: 0.1, tick: 2600, hold_tick: 0, page_index: 0, next_id: 11 },
      { id: 11, type: 4, x: 0.4, tick: 3000, hold_tick: 0, page_index: 0, next_id: 0 },
      { id: 20, type: 6, x: -0.1, tick: 3600, hold_tick: 0, page_index: 0, next_id: 21 },
      { id: 21, type: 7, x: 0.3, tick: 4000, hold_tick: 0, page_index: 0, next_id: 0 }
    ],
    event_order_list: [],
    music_offset: 0
  };
  // note 2 gets a red fill so overlap layering is observable
  const sb = {
    sprites: [], texts: [], videos: [], lines: [], controllers: [],
    note_controllers: [{ id: 'nc2', note: 2, time: 0, override_fill_color: true, fill_color: '#FF5964' }]
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const level = { schema_version: 2, version: 't', id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }, { name: 'sb.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1500));
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
    const infoAt = (t) => { p.setTime(t, false); p.render(); return p.ctxInfo(); };

    // 1) layering: t=2050 (note1 hit, note2 approaching) -> center should be blue (note1 on top)
    let info2 = infoAt(2.05);
    const n1 = ch.noteById(1);
    const pos1 = p.notePos(n1, info2);
    out.layering = { center: px(pos1.x, pos1.y) };

    // 2) hold fill full during approach
    const hold = ch.noteById(3);
    info2 = infoAt(hold.intro_time + (hold.start_time - hold.intro_time) * 0.6);
    const hp = p.notePos(hold, info2);
    out.holdApproach = { center: px(hp.x, hp.y), d: Math.round(2.234 * info2.S) };

    // 3+4) holdbar dashes + length
    const scanStart = ch.getScannerPositionY(hold.start_time);
    const scanEnd = ch.getScannerPositionY(hold.end_time);
    const barLen = Math.abs(scanEnd - scanStart) * info2.S;
    info2 = infoAt((hold.start_time + hold.end_time) / 2);
    const hp2 = p.notePos(hold, info2);
    const scanDash = [];
    for (let y = Math.max(0, Math.round(hp2.y - barLen)); y < Math.round(hp2.y - 2.234 * info2.S * 0.5); y += 6) {
      const c = px(hp2.x, y);
      if (c[0] + c[1] + c[2] > 60) scanDash.push({ y, rgb: c });
    }
    out.holdbar = {
      barLenPx: Math.round(barLen),
      dashes: scanDash.slice(0, 10)
    };

    // 5) clear effect X matches note X
    p.drawClearEffects = p.drawClearEffects;
    info2 = infoAt(hold.end_time + 0.1);
    const scanY = ch.getScannerPositionY(hold.end_time);
    const clearPos = p.worldToPx(hold.worldX, scanY, info2);
    const noteScr = p.notePos(hold, info2);
    out.clearX = {
      effectX: Math.round(clearPos.x),
      noteX: Math.round(noteScr.x)
    };

    // 6) c-drag head: ring + fill + arrow
    const cdrag = ch.noteById(20);
    info2 = infoAt(cdrag.start_time - 0.15);
    const cdPos = p.notePos(cdrag, info2);
    const cdD = 1.9717 * 1.133333 * info2.S;
    out.cdrag = {
      center: px(cdPos.x, cdPos.y),
      ring: px(cdPos.x + cdD * 0.42, cdPos.y),
      outside: px(cdPos.x + cdD * 0.58, cdPos.y)
    };

    // 7) drag head slides between chain nodes
    const drag = ch.noteById(10);
    const child = ch.noteById(11);
    info2 = infoAt((drag.start_time + child.start_time) / 2);
    const dPos = p.notePos(drag, info2);
    const dStart = p.noteScreenPos(drag, info2);
    const dEnd = p.noteScreenPos(child, info2);
    const midX = (dStart.x + dEnd.x) / 2;
    out.dragSlide = {
      headX: Math.round(dPos.x),
      expectedMidX: Math.round(midX),
      delta: Math.round(Math.abs(dPos.x - midX))
    };

    // 8) sizes
    out.sizes = {
      dragHeadD: Math.round(1.5773 * 0.7 * 1.133333 * info2.S),
      dragChildD: Math.round(1.2816 * 0.7 * 1.133333 * info2.S),
      cdragHeadD: Math.round(1.9717 * 1.133333 * info2.S)
    };

    // 9) connector dash density: measure alternating run lengths along the line
    info2 = infoAt((drag.start_time + child.start_time) / 2 - 0.2);
    const a = p.notePos(drag, info2);
    const b = p.notePos(child, info2);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const runs = [];
    let last = null, startX = null;
    for (let s = 0; s <= 60; s += 1) {
      const x = a.x + Math.cos(ang) * s;
      const y = a.y + Math.sin(ang) * s;
      const c = px(x, y);
      const on = c[0] + c[1] + c[2] > 100;
      if (on && last !== true) { startX = s; last = true; }
      else if (!on && last === true) { runs.push(s - startX); last = false; }
    }
    if (last === true) runs.push(60 - startX);
    out.dashRuns = runs.slice(0, 8);
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  app.exit(0);
});
