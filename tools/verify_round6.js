// Verify round-6 changes:
//  - flick chevrons tighten to just outside the diamond
//  - holdbar starts at note center and ends at the scanner clear position
//  - connector hides the part the scanner already passed
//  - scanline boundary dashes render
//  - timeline ruler starts after the label column
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_r6_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [
      { id: 1, type: 5, x: 0, tick: 2000, hold_tick: 0, page_index: 0 },
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
  await new Promise(r => setTimeout(r, 1500));
  const res = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = true;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
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

    // 1) flick chevron position at approach=1 (near trigger)
    const flick = ch.noteById(1);
    const tApproach = flick.start_time - 0.05;
    let info2 = infoAt(tApproach);
    const fp = p.notePos(flick, info2);
    const fd = 2.218 * 1.133333 * info2.S;
    // scan left of the diamond for the white chevron
    const chev = [];
    for (let x = Math.round(fp.x - fd * 0.7); x < Math.round(fp.x - fd * 0.2); x += 2) {
      const c = px(x, fp.y);
      if (c[0] > 200 && c[1] > 200 && c[2] > 200) chev.push(x);
    }
    out.flickChevron = {
      dPx: Math.round(fd),
      chevronXs: chev.length ? [chev[0], chev[chev.length - 1]] : null,
      diamondEdgeX: Math.round(fp.x - fd * 0.354)
    };

    // 2) holdbar ends at scanner clear position
    const hold = ch.noteById(3);
    info2 = infoAt((hold.start_time + hold.end_time) / 2);
    const hp = p.notePos(hold, info2);
    const scanEndPx = p.worldToPx(0, ch.getScannerPositionY(hold.end_time), info2).y;
    const scanStartPx = p.worldToPx(0, ch.getScannerPositionY(hold.start_time), info2).y;
    // farthest bright dash above note center
    let top = null;
    for (let y = Math.max(0, Math.round(hp.y - 160)); y < Math.round(hp.y - 1); y++) {
      const c = px(hp.x, y);
      if (c[0] + c[1] + c[2] > 80) { top = y; break; }
    }
    out.holdbar = {
      scanStartPx: Math.round(scanStartPx),
      scanEndPx: Math.round(scanEndPx),
      noteY: Math.round(hp.y),
      barTop: top,
      barTopShouldBe: Math.round(scanEndPx)
    };

    // 3) connector hides passed part: at mid chain, part below scanner hidden
    const drag = ch.noteById(10);
    const child = ch.noteById(11);
    info2 = infoAt((drag.start_time + child.start_time) / 2);
    const a = p.notePos(drag, info2);
    const b = p.notePos(child, info2);
    const scanY = ch.getScannerPositionY(p.time);
    const scanPy = p.worldToPx(0, scanY, info2).y;
    // sample along the line: below scanner should be dark, above scanner bright
    const samples = [];
    for (let s = -0.5; s <= 1.5; s += 0.25) {
      const x = a.x + (b.x - a.x) * s;
      const y = a.y + (b.y - a.y) * s;
      const c = px(x, y);
      samples.push({ s: +s.toFixed(2), y: Math.round(y), scanY: Math.round(scanPy), lum: c[0] + c[1] + c[2] });
    }
    out.connectorClip = { samples, scanPy: Math.round(scanPy) };

    // 4) scanline boundary dashes
    info2 = infoAt(2.5);
    const scanPy2 = p.worldToPx(0, ch.getScannerPositionY(p.time), info2).y;
    const boundY = Math.max(3, 0.16 * info2.S);
    const above = px(Math.round(W / 2), Math.round(scanPy2 - boundY));
    const below = px(Math.round(W / 2), Math.round(scanPy2 + boundY));
    const mid = px(Math.round(W / 2), Math.round(scanPy2));
    out.scanBoundary = { above, below, mid, scanPy: Math.round(scanPy2), boundY: Math.round(boundY) };

    // 5) timeline ruler starts after label column
    const tl = window.__sb.timeline;
    out.timeline = {
      labelW: 190,
      contentW: Math.round(tl.contentWidth()),
      rulerW: document.querySelector('#ruler').width,
      firstTickX: null
    };
    const rctx = document.querySelector('#ruler').getContext('2d');
    // find first tick pixel: row y=18, scan x
    const rimg = rctx.getImageData(0, 18, out.timeline.rulerW, 1).data;
    for (let x = 0; x < out.timeline.rulerW; x++) {
      if (rimg[x * 4 + 3] > 0 && rimg[x * 4] > 120 && rimg[x * 4 + 1] > 120 && rimg[x * 4 + 2] > 120) {
        out.timeline.firstTickX = x;
        break;
      }
    }
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  // DOM checks for drop + frozen labels
  const dom = await win.webContents.executeJavaScript(`(() => {
    // add a storyboard object so the timeline has lanes
    const s = window.__sb.state.storyboard;
    s.sprites.push({ id: 'spr_test', path: 'bg.png', time: 0, opacity: 1, preserve_aspect: true, layer: 0, order: 0 });
    window.__sb.refreshAll();
    const label = document.querySelector('.lane-label');
    const gh = document.querySelector('.gh-label');
    const style = label ? getComputedStyle(label) : null;
    const ghStyle = gh ? getComputedStyle(gh) : null;
    const playheadLeft = document.getElementById('playhead').style.left;
    const rulerX = document.querySelector('#ruler').getBoundingClientRect().left;
    const contentX = document.getElementById('tlContent').getBoundingClientRect().left;
    const hasDrop = typeof window.sbAPI.getPathForFile === 'function' && typeof window.sbAPI.projectImportLevelPath === 'function';
    return {
      labelSticky: style ? style.position : null,
      ghSticky: ghStyle ? ghStyle.position : null,
      labelLeft: style ? style.left : null,
      playheadLeft,
      rulerVsContentOffset: Math.round(rulerX - contentX),
      hasDropAPI: hasDrop
    };
  })()`);
  console.log('DOM:', JSON.stringify(dom));
  app.exit(0);
});
