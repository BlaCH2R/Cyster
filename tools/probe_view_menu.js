// Probe for the new "视图" menu + preview zoom/pan/fullscreen features.
// Loads the real app (like smoke_test.js) but only runs quick DOM checks.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_view_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_view_');

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
  setTimeout(() => app.exit(1), 45000);
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

  const hasHook = await win.webContents.executeJavaScript(`!!window.__sb`);
  if (!hasHook) {
    check('app hook', false, 'no window.__sb');
    fs.writeFileSync(path.join(__dirname, 'probe_view_menu_out.json'), JSON.stringify(out, null, 2));
    app.exit(1);
    return;
  }

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const wrap = document.getElementById('previewWrap');
    const scrollEl = document.getElementById('previewScroll');
    const canvas = document.getElementById('previewCanvas');
    const slider = document.getElementById('zoomSlider');
    const label = document.getElementById('zoomLabel');
    const btnReset = document.getElementById('btnZoomReset');
    const btnFull = document.getElementById('btnZoomFull');
    const btnToggle = document.getElementById('btnZoomToggle');
    const zoomControls = document.getElementById('zoomControls');
    const nav = document.getElementById('previewNav');
    const navView = document.getElementById('previewNavView');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // 1) 视图 menu present between 编辑 and 设置
    const menus = Array.from(document.querySelectorAll('.menu-item')).map((m) => m.dataset.menu);
    out.menus = menus;
    out.viewIndex = menus.indexOf('view');
    out.viewToggles = Array.from(document.querySelectorAll('.menu-entry[data-view-toggle]')).map((e) => e.dataset.viewToggle);
    out.hasResetLayout = !!document.querySelector('.menu-entry[data-action="reset-layout"]');
    out.hintRemoved = !document.querySelector('#transport .hint');
    out.zoomControlsHidden = zoomControls.classList.contains('hidden');
    out.hasCheckedClass = !!document.querySelector('.menu-entry.menu-toggle.checked');

    // 2) Toggling via the menu flips the hidden checkbox + preview flag and
    // the entry label describes the current state (no checkmark)
    const uiBefore = window.__sb.preview.ui.showNoteIds;
    const entryIds = document.querySelector('.menu-entry[data-view-toggle="chkShowIds"]');
    out.idLabelOn = entryIds.textContent;
    entryIds.click();
    await sleep(80);
    out.idsToggled = window.__sb.preview.ui.showNoteIds === !uiBefore;
    out.idLabelOff = entryIds.textContent;
    entryIds.click();
    await sleep(80);
    out.idsRestored = window.__sb.preview.ui.showNoteIds === uiBefore;

    // 3) Zoom 150%: canvas CSS size grows, wrap gets 'zoomed'. The wrap's
    // clientWidth shrinks by the scrollbar once zoomed, so compare ratios.
    slider.value = 150;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(180);
    const vw150 = wrap.clientWidth;
    const cw150 = Math.round(parseFloat(canvas.style.width));
    out.zoom150 = {
      cssW: cw150,
      ratio: +(cw150 / vw150).toFixed(3),
      zoomed: wrap.classList.contains('zoomed'),
      label: label.textContent
    };

    // 4) Drag panning moves the scroll offset (no click jump after a drag)
    const startScrollLeft = scrollEl.scrollLeft;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 130, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await sleep(60);
    out.panned = {
      startScrollLeft,
      scrollLeft: scrollEl.scrollLeft,
      moved: Math.abs(scrollEl.scrollLeft - startScrollLeft) > 20
    };
    out.navVisible = nav.classList.contains('visible');
    out.navViewSize = { w: Math.round(parseFloat(navView.style.width)), h: Math.round(parseFloat(navView.style.height)) };
    // Navigator must stay fixed (bottom-right) while the canvas scrolls.
    const navRectBefore = nav.getBoundingClientRect();
    scrollEl.scrollLeft = 100;
    scrollEl.scrollTop = 50;
    await sleep(60);
    const navRectAfter = nav.getBoundingClientRect();
    out.navFixed = {
      dx: Math.round(navRectAfter.left - navRectBefore.left),
      dy: Math.round(navRectAfter.top - navRectBefore.top)
    };
    // Dragging inside the mini-map pans the viewport
    const navRect = nav.getBoundingClientRect();
    const beforeNav = scrollEl.scrollLeft;
    nav.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: navRect.left + 20, clientY: navRect.top + 20, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: navRect.left + 140, clientY: navRect.top + 80, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await sleep(60);
    out.navPanned = { before: beforeNav, after: scrollEl.scrollLeft, moved: Math.abs(scrollEl.scrollLeft - beforeNav) > 20 };
    // A plain click after panning is suppressed (not treated as note click)
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200, bubbles: true }));

    // 5) Reset button -> 100%, scroll back to 0, nav hidden
    scrollEl.scrollLeft = 50;
    btnReset.click();
    await sleep(180);
    const vw1 = wrap.clientWidth;
    const cw1 = Math.round(parseFloat(canvas.style.width));
    out.reset = {
      cssW: cw1,
      ratio: +(cw1 / vw1).toFixed(3),
      zoomed: wrap.classList.contains('zoomed'),
      label: label.textContent,
      scrollLeft: scrollEl.scrollLeft,
      navVisible: nav.classList.contains('visible')
    };

    // 6) Zoom-out (50%): SINGLE scale — the canvas keeps filling the wrap,
    // the playfield shrinks toward the center and notes shrink exactly once
    // (50%), while content beyond the playfield becomes visible around it.
    const pv = window.__sb.preview;
    const note0 = pv.chart.notes.find((n) => n.type === 0);
    const info100 = pv.ctxInfo();
    const n100 = note0 ? pv.noteScreenPos(note0, info100) : null;
    const stageW100 = Math.round(pv.stageUnitPx({ value: 800, unit: 'stagex' }, info100, true));
    slider.value = 50;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(180);
    out.zoom50 = {
      cssW: Math.round(parseFloat(canvas.style.width)),
      expect: wrap.clientWidth,
      sceneScale: window.__sb.preview.sceneScale
    };
    const info50 = pv.ctxInfo();
    const n50 = note0 ? pv.noteScreenPos(note0, info50) : null;
    out.noteScale = n100 && n50 ? {
      d100: Math.round(Math.hypot(n100.x - canvas.width / 2, n100.y - canvas.height / 2)),
      d50: Math.round(Math.hypot(n50.x - canvas.width / 2, n50.y - canvas.height / 2))
    } : null;
    // Canvas-space stage sizes must scale once too (stagex:800 = full canvas
    // at 100%, half at 50%).
    out.stageSize = {
      w100: stageW100,
      w50: Math.round(pv.stageUnitPx({ value: 800, unit: 'stagex' }, info50, true))
    };
    // A fill_width (fullscreen) sprite must render at 50% width at zoom 50%.
    const pv2 = new window.SBPreview.PreviewRenderer(document.createElement('canvas'));
    pv2.chart = pv.chart;
    pv2.canvas.width = 800; pv2.canvas.height = 450;
    pv2.compiled = new window.SBEngine.storyboard.StoryboardCompiler({
      sprites: [{
        id: 'fs', fill_width: true,
        x: { value: 0, unit: 'stagex' }, y: { value: 0, unit: 'stagey' },
        width: { value: 800, unit: 'stagex' }, height: { value: 600, unit: 'stagey' },
        states: [{ time: 0, opacity: 1 }]
      }],
    }, pv2.chart).compile();
    const tc = document.createElement('canvas');
    tc.width = 16; tc.height = 16;
    const tctx = tc.getContext('2d');
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, 16, 16);
    const wimg = new Image();
    wimg.src = tc.toDataURL();
    await new Promise((r) => { wimg.onload = () => r(); wimg.onerror = () => r(); });
    pv2.imageCache['w.png'] = wimg;
    pv2.evaluate(0.5);
    const rfs = pv2.evalResult.sprites.find((s) => s.obj.id === 'fs');
    rfs.from.path = 'w.png';
    const measureWhiteW = (ctx2, ww, hh) => {
      const d = ctx2.getImageData(0, 0, ww, hh).data;
      let minX = 1e9, maxX = -1;
      for (let y = 0; y < hh; y += 3) {
        for (let x = 0; x < ww; x += 3) {
          const i = (y * ww + x) * 4;
          if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }
      return maxX >= minX ? maxX - minX + 1 : 0;
    };
    pv2.sceneScale = 1;
    const c100 = document.createElement('canvas'); c100.width = 800; c100.height = 450;
    const x100 = c100.getContext('2d');
    x100.fillStyle = '#000'; x100.fillRect(0, 0, 800, 450);
    pv2.drawStageObject(x100, pv2.ctxInfo(), rfs, 'sprite', 1);
    const fsW100 = measureWhiteW(x100, 800, 450);
    pv2.sceneScale = 0.5;
    const c50 = document.createElement('canvas'); c50.width = 800; c50.height = 450;
    const x50 = c50.getContext('2d');
    x50.fillStyle = '#000'; x50.fillRect(0, 0, 800, 450);
    pv2.drawStageObject(x50, pv2.ctxInfo(), rfs, 'sprite', 1);
    const fsW50 = measureWhiteW(x50, 800, 450);
    out.fullScreen = { w100: fsW100, w50: fsW50 };
    // An off-screen sprite (stagex:1200 -> beyond the playfield at 100%)
    // must land inside the canvas at 50%.
    const off = pv.unitWorld({ value: 1200, unit: 'stagex' }, info50);
    const offPx = pv.worldToPx(off, 0, info50);
    out.offScreen = { px: Math.round(offPx.x), canvasW: canvas.width, inside: offPx.x > 0 && offPx.x < canvas.width };
    slider.value = 100;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(180);

    // 7) Fullscreen toggle + ESC exit
    btnFull.click();
    await sleep(120);
    out.fullOn = document.body.classList.contains('preview-fullscreen');
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    await sleep(120);
    out.fullOff = !document.body.classList.contains('preview-fullscreen');

    // 8) Zoom controls toggle: hidden by default, toggle shows them
    btnToggle.click();
    await sleep(60);
    out.zoomControlsShown = !zoomControls.classList.contains('hidden');
    // New structure: fullscreen button is always visible (outside the fold)
    // and the zoom controls are a viewport-fixed popup anchored to the toggle.
    out.popupStructure = {
      fullOutsideFold: !btnFull.closest('#zoomControls'),
      fullSameBar: btnFull.parentElement === btnToggle.parentElement,
      popupPosition: getComputedStyle(zoomControls).position
    };
    const zr = zoomControls.getBoundingClientRect();
    const br = btnToggle.getBoundingClientRect();
    out.popupAnchor = {
      top: Math.round(zr.top),
      btnBottom: Math.round(br.bottom),
      left: Math.round(zr.left),
      btnLeft: Math.round(br.left)
    };
    btnToggle.click();
    await sleep(60);
    out.zoomControlsHiddenAgain = zoomControls.classList.contains('hidden');

    // 9) Clicking a note at zoom=100% still works
    const p = window.__sb.preview;
    const note = p.chart.notes.find((n) => n.type === 0);
    let clickOk = false;
    if (note) {
      const info = p.ctxInfo();
      const pos = p.noteScreenPos(note, info);
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + pos.x / canvas.width * rect.width,
        clientY: rect.top + pos.y / canvas.height * rect.height,
        bubbles: true
      }));
      await sleep(120);
      clickOk = true;
    }
    out.noteClickNoThrow = clickOk;
    return out;
  })()`);

  check('menus contain view between edit and settings',
    res.menus && res.menus.indexOf('view') === res.menus.indexOf('edit') + 1 &&
    res.menus.indexOf('settings') === res.menus.indexOf('view') + 1,
    JSON.stringify(res.menus));
  check('view menu has 4 toggles + reset-layout',
    res.viewToggles && res.viewToggles.length === 4 && res.hasResetLayout,
    JSON.stringify(res.viewToggles) + ' reset=' + res.hasResetLayout);
  check('transport hint line removed',
    res.hintRemoved === true,
    String(res.hintRemoved));
  check('menu toggle flips checkbox, label describes state (no checkmark)',
    res.idsToggled && res.idsRestored &&
    // Label shows the ACTION the click performs: 隐藏 while shown, 显示 while hidden.
    res.idLabelOn === '隐藏 Note ID' && res.idLabelOff === '显示 Note ID' &&
    res.hasCheckedClass === false,
    JSON.stringify({ on: res.idLabelOn, off: res.idLabelOff }));
  check('zoom 150% scales canvas CSS size',
    res.zoom150 && res.zoom150.zoomed && Math.abs(res.zoom150.ratio - 1.5) < 0.02 && res.zoom150.label === '150%',
    JSON.stringify(res.zoom150));
  check('drag pans the zoomed canvas',
    res.panned && res.panned.moved,
    JSON.stringify(res.panned));
  check('mini-map visible at zoom-in with a draggable view rect',
    res.navVisible === true &&
    res.navViewSize.w > 0 && res.navViewSize.h > 0 &&
    res.navPanned && res.navPanned.moved,
    JSON.stringify({ navVisible: res.navVisible, view: res.navViewSize, navPanned: res.navPanned }));
  check('navigator stays fixed while canvas scrolls',
    res.navFixed && res.navFixed.dx === 0 && res.navFixed.dy === 0,
    JSON.stringify(res.navFixed));
  check('reset button returns to 100% and scroll 0',
    res.reset && !res.reset.zoomed && res.reset.label === '100%' && res.reset.scrollLeft === 0 &&
    res.reset.navVisible === false &&
    Math.abs(res.reset.ratio - 1) < 0.02,
    JSON.stringify(res.reset));
  check('zoom-out 50%: single scale (notes shrink once), off-screen content visible',
    res.zoom50 && Math.abs(res.zoom50.cssW - res.zoom50.expect) <= 2 &&
    Math.abs(res.zoom50.sceneScale - 0.5) < 1e-6 &&
    res.noteScale && Math.abs(res.noteScale.d50 / res.noteScale.d100 - 0.5) < 0.05 &&
    res.stageSize && Math.abs(res.stageSize.w50 / res.stageSize.w100 - 0.5) < 0.02 &&
    res.fullScreen && Math.abs(res.fullScreen.w50 / res.fullScreen.w100 - 0.5) < 0.05 &&
    res.offScreen && res.offScreen.inside,
    JSON.stringify({ zoom50: res.zoom50, noteScale: res.noteScale, stageSize: res.stageSize, fullScreen: res.fullScreen, offScreen: res.offScreen }));
  check('zoom controls hidden by default, toggle shows/hides',
    res.zoomControlsHidden === true && res.zoomControlsShown === true && res.zoomControlsHiddenAgain === true,
    JSON.stringify({ hidden: res.zoomControlsHidden, shown: res.zoomControlsShown, hiddenAgain: res.zoomControlsHiddenAgain }));
  check('fullscreen button always visible at far right (outside zoom fold)',
    res.popupStructure && res.popupStructure.fullOutsideFold === true && res.popupStructure.fullSameBar === true,
    JSON.stringify(res.popupStructure));
  check('zoom popup is a fixed floating window anchored below the magnifier',
    res.popupStructure && res.popupStructure.popupPosition === 'fixed' &&
    res.popupAnchor && res.popupAnchor.top >= res.popupAnchor.btnBottom - 2 &&
    Math.abs(res.popupAnchor.left - res.popupAnchor.btnLeft) < 200,
    JSON.stringify({ popupStructure: res.popupStructure, popupAnchor: res.popupAnchor }));
  check('fullscreen toggles on and Esc exits',
    res.fullOn === true && res.fullOff === true,
    JSON.stringify({ fullOn: res.fullOn, fullOff: res.fullOff }));
  check('note click works after changes', res.noteClickNoThrow === true, String(res.noteClickNoThrow));

  out.result = res;
  fs.writeFileSync(path.join(__dirname, 'probe_view_menu_out.json'), JSON.stringify(out, null, 2));
  app.exit(0);
});
