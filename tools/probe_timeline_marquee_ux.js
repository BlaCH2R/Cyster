// Verify timeline UX fixes:
//  1. Keyframe floating detail window avoids the cursor in real time;
//  2. Marquee auto-scrolls when the mouse reaches the viewport edge;
//  3. Marquee selection stays valid when the timeline scrolls mid-drag.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mq_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_mq_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try {
      const level = typeof e === 'object' ? e.level : e;
      const message = typeof e === 'object' ? e.message : '';
      if (level >= 2 || /error/i.test(message)) console.log('RENDERER:', message);
    } catch (err) {}
  });
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));

  const out = { checks: [], ok: true };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const tl = window.__sb.timeline;
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setSb = (storyboard) => {
      S.storyboard = storyboard;
      window.__sb.refreshAll();
      window.__sb.setTime(0);
    };
    const sprites = [];
    for (let i = 0; i < 6; i++) {
      sprites.push({ id: 'spM' + i, time: i * 3, path: 'title.png', opacity: 1, layer: 1, order: i, states: [{ time: i * 3 + 2 }] });
    }
    setSb({ sprites, texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    tl.setZoom(200);
    await sleep(120);
    const lanes = document.getElementById('lanes');
    const scrollEl = document.getElementById('tlScroll');
    const marqueeDrag = (sx, sy, ex, ey, holdMs) => {
      lanes.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: sx, clientY: sy }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: sx + 12, clientY: sy + 6 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: ex, clientY: ey }));
      return holdMs;
    };

    // ------------------------------------------------------------
    // 1) 关键帧浮窗实时避开鼠标
    // ------------------------------------------------------------
    const kfEl = document.querySelector('.kf[data-id="spM0"][data-kf="0"]');
    const kr = kfEl.getBoundingClientRect();
    kfEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: kr.left + 4, clientY: kr.top + 4 }));
    await sleep(150);
    const tt = document.getElementById('kfTooltip');
    const ttRect = tt.getBoundingClientRect();
    out.tt = {
      visible: tt.style.display !== 'none',
      tw: tt.offsetWidth,
      th: tt.offsetHeight,
      rect: { l: ttRect.left, r: ttRect.right, t: ttRect.top, b: ttRect.bottom }
    };
    // 把鼠标移到浮窗正中（真实 mousemove）→ 浮窗应实时挪开
    const mouseX = ttRect.left + ttRect.width / 2;
    const mouseY = ttRect.top + ttRect.height / 2;
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: mouseX, clientY: mouseY }));
    await sleep(80);
    out.tt.mouseSet = JSON.stringify({ x: mouseX, y: mouseY });
    const ttRect2 = tt.getBoundingClientRect();
    const mouse = { x: mouseX, y: mouseY };
    out.tt.mouseAfter = JSON.stringify(tl._mousePos);
    const kfElNow = document.querySelector('.kf[data-id="spM0"][data-kf="0"]');
    const rNow = kfElNow ? kfElNow.getBoundingClientRect() : null;
    if (rNow) {
      const aboveTop = rNow.top - 44 - 4;
      out.tt.anchor = { top: rNow.top, bottom: rNow.bottom, cx: rNow.left + rNow.width / 2 };
      out.tt.aboveOverlap = mouseY >= aboveTop - 8 && mouseY <= aboveTop + 44 + 8;
      out.tt.aboveTop = aboveTop;
    }
    out.tt.styleTop = tt.style.top;
    out.tt.styleLeft = tt.style.left;
    out.tt.overlapAfter = mouse.x >= ttRect2.left && mouse.x <= ttRect2.right && mouse.y >= ttRect2.top && mouse.y <= ttRect2.bottom;
    out.tt.rect2 = { l: ttRect2.left, r: ttRect2.right, t: ttRect2.top, b: ttRect2.bottom };

    // ------------------------------------------------------------
    // 2) 框选到达右边缘自动滚动
    // ------------------------------------------------------------
    scrollEl.scrollLeft = 0;
    await sleep(80);
    const sr = scrollEl.getBoundingClientRect();
    const sy = sr.top + sr.height / 2;
    lanes.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: sr.left + 120, clientY: sy }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: sr.left + 130, clientY: sy }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: sr.right - 10, clientY: sy }));
    await sleep(350); // 保持在边缘，让 rAF 自动滚动
    out.autoScroll = {
      scrollLeft: scrollEl.scrollLeft,
      edge: tl._marqueeEdge ? JSON.stringify(tl._marqueeEdge) : null
    };
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: sr.right - 10, clientY: sy }));
    await sleep(80);

    // ------------------------------------------------------------
    // 3) 框选过程中滚动视图：选择结果不应失效（按内容坐标）
    // ------------------------------------------------------------
    S.selectedIds = [];
    window.__sb.refreshAll();
    await sleep(120);
    scrollEl.scrollLeft = 0;
    await sleep(80);
    // 无滚动的基准框选
    const r0 = lanes.getBoundingClientRect();
    const a0 = { x: r0.left + 240, y: r0.top + 8 };
    const b0 = { x: r0.left + 700, y: r0.bottom - 4 };
    marqueeDrag(a0.x, a0.y, b0.x, b0.y);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: b0.x, clientY: b0.y }));
    await sleep(150);
    const baseSel = S.selectedIds.slice();
    // 重置后带滚动重复同一内容矩形框选
    S.selectedIds = [];
    window.__sb.refreshAll();
    await sleep(120);
    scrollEl.scrollLeft = 0;
    await sleep(80);
    marqueeDrag(a0.x, a0.y, b0.x, b0.y);
    scrollEl.scrollLeft = 300; // 模拟滚轮/滚动
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: b0.x - 300, clientY: b0.y }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: b0.x - 300, clientY: b0.y }));
    await sleep(150);
    out.scrollSafe = {
      base: baseSel,
      afterScroll: S.selectedIds.slice(),
      same: JSON.stringify(baseSel.slice().sort()) === JSON.stringify(S.selectedIds.slice().sort())
    };
    return out;
  })()`);

  check('keyframe tooltip is visible and avoids the cursor in real time',
    res.tt.visible === true && res.tt.overlapAfter === false,
    JSON.stringify(res.tt));
  check('marquee auto-scrolls at the viewport edge',
    res.autoScroll.scrollLeft > 0 && res.autoScroll.edge != null,
    JSON.stringify(res.autoScroll));
  check('marquee selection stays valid after scrolling mid-drag',
    res.scrollSafe.base.length > 0 && res.scrollSafe.same === true,
    JSON.stringify(res.scrollSafe));

  fs.writeFileSync(path.join(__dirname, 'probe_timeline_marquee_ux_out.json'), JSON.stringify({ checks: out.checks, ok: out.ok, debug: res }, null, 2));
  console.log('MQ_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_timeline_marquee_ux_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
