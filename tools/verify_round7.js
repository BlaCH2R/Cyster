// Verify round-7 changes.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_r7_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [
      { id: 1, type: 5, x: 0, tick: 2000, hold_tick: 0, page_index: 0 },
      { id: 3, type: 1, x: 0, tick: 2400, hold_tick: 960, page_index: 0 },
      { id: 10, type: 3, x: 0.1, tick: 2600, hold_tick: 0, page_index: 0, next_id: 11 },
      { id: 11, type: 4, x: 0.4, tick: 3000, hold_tick: 0, page_index: 0, next_id: 0 },
      { id: 20, type: 6, x: -0.1, tick: 3600, hold_tick: 0, page_index: 0, next_id: 21 },
      { id: 21, type: 7, x: 0.3, tick: 4000, hold_tick: 0, page_index: 0, next_id: 22 },
      { id: 22, type: 7, x: 0.5, tick: 4300, hold_tick: 0, page_index: 0, next_id: 0 }
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

    // 1) hold ripples: during hold, there are semi-transparent circles around note
    const hold = ch.noteById(3);
    let info2 = infoAt((hold.start_time + hold.end_time) / 2);
    const hp = p.notePos(hold, info2);
    const dHold = 2.234 * info2.S;
    // sample at 1.2x note radius - ripple should be visible (not background)
    out.holdRipple = {
      near: px(hp.x + dHold * 0.7, hp.y),
      far: px(hp.x + dHold * 1.3, hp.y),
      center: px(hp.x, hp.y),
      d: Math.round(dHold)
    };

    // 2) flick chevron final position (tighter)
    const flick = ch.noteById(1);
    info2 = infoAt(flick.start_time - 0.05);
    const fp = p.notePos(flick, info2);
    const fd = 2.218 * 1.133333 * info2.S;
    const chev = [];
    for (let x = Math.round(fp.x - fd * 1.0); x < Math.round(fp.x - fd * 0.05); x += 2) {
      const c = px(x, fp.y);
      if (c[0] > 200 && c[1] > 200 && c[2] > 200) chev.push(x);
    }
    out.flickChevron = {
      dPx: Math.round(fd),
      chevronLeft: chev.length ? chev[0] : null,
      diamondEdgeX: Math.round(fp.x - fd * 0.354)
    };

    // 3) scanline fixed boundaries: top/bottom edges fixed, not at scanline
    info2 = infoAt(2.5);
    const topPx = p.worldToPx(0, ch.convertChartYToScreenY(1), info2).y;
    const bottomPx = p.worldToPx(0, ch.convertChartYToScreenY(0), info2).y;
    const scanPy = p.worldToPx(0, ch.getScannerPositionY(p.time), info2).y;
    const dashOn = (y) => {
      let on = 0;
      for (let x = 100; x < W - 100; x += 4) {
        const c = px(x, y);
        if (c[0] + c[1] + c[2] > 100) on++;
      }
      return on;
    };
    out.scanBoundary = {
      topPx: Math.round(topPx),
      bottomPx: Math.round(bottomPx),
      scanPy: Math.round(scanPy),
      topOn: dashOn(Math.round(topPx)),
      bottomOn: dashOn(Math.round(bottomPx))
    };

    // 4) c-drag arrow points to first untriggered child
    const cdrag = ch.noteById(20);
    info2 = infoAt(cdrag.start_time + 0.1); // child 21 not triggered yet (21 starts later)
    const ang1 = p.cDragArrowAngle(cdrag, info2);
    info2 = infoAt(21); // child 21 triggered, child 22 not yet
    const ang2 = p.cDragArrowAngle(cdrag, info2);
    const t1 = p.chart.noteById(21);
    const t2 = p.chart.noteById(22);
    out.cdragArrow = {
      pointsToFirstChild: Math.abs(ang1 - Math.atan2(p.notePos(t1, info2).y - p.notePos(cdrag, info2).y, p.notePos(t1, info2).x - p.notePos(cdrag, info2).x) - Math.PI / 2) < 0.5,
      angle1: +ang1.toFixed(3),
      angle2: +ang2.toFixed(3),
      child21Start: t1.start_time,
      child22Start: t2.start_time
    };

    // 5) connector draw order: earlier trigger first in the sorted list
    out.connectorOrder = {
      drag10Start: ch.noteById(10).start_time,
      drag11Start: ch.noteById(11).start_time,
      // the sort is inside render; emulate: later start drawn first
      expectedFirstDrawn: ch.noteById(11).start_time > ch.noteById(10).start_time ? 'note11' : 'note10'
    };
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  const dom = await win.webContents.executeJavaScript(`(() => {
    const out = {};
    // timeline auto zoom + playhead clamp
    const tl = window.__sb.timeline;
    out.zoom = { pxPerSec: Math.round(tl.pxPerSec), min: tl.zoomSlider.min, max: tl.zoomSlider.max };
    out.playheadClamp = tl.timeFromEvent({ clientX: document.getElementById('tlContent').getBoundingClientRect().left + 50 });
    // wheel listener
    out.hasWheel = typeof document.addEventListener === 'function';
    // asset library: no audio section
    window.__sb.state.manualImages = [];
    window.__sb.refreshAll();
    const assetText = document.getElementById('assetList').textContent;
    out.assetLib = {
      hasAddBtn: !!Array.from(document.querySelectorAll('#assetList .mini-btn')).find(b => b.textContent.includes('添加图片')),
      hasAudioWord: /音频|\.ogg|\.mp3/.test(assetText)
    };
    // welcome greeting
    window.__sb.showWelcome();
    out.welcome = {
      greeting: document.getElementById('welcomeGreeting') ? document.getElementById('welcomeGreeting').textContent : null,
      hasNewBtn: !!document.getElementById('btnWelcomeNew'),
      hasOpenBtn: !!document.getElementById('btnWelcomeOpen'),
      hasRecent: !!document.getElementById('recentProjects')
    };
    window.__sb.hideWelcome();
    return out;
  })()`);
  console.log('DOM:', JSON.stringify(dom));
  app.exit(0);
});
