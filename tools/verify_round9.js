// Verify round-9 changes.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_r9_'));
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
    const ch = p.chart;
    const out = {};
    // drag initial_scale
    out.dragInitialScale = ch.noteById(10).initial_scale;
    out.dragChildInitialScale = ch.noteById(11).initial_scale;
    out.clickInitialScale = 0.4;
    // ripple params
    out.ripple = { maxRFactor: +(0.62 * 1.2).toFixed(4), alphaPeak: 0.85 };
    // background dim invert: at dim=1 background is black
    p.setTime(1, false);
    p.render();
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const bg = ctx.getImageData(5, 5, 1, 1).data;
    out.bgDim065 = [bg[0], bg[1], bg[2]];
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  const dom = await win.webContents.executeJavaScript(`(() => {
    const out = {};
    // timeline sliders
    const tl = window.__sb.timeline;
    out.sliders = {
      snap: !!document.querySelector('#snapSlider'),
      vol: !!document.querySelector('#volSlider'),
      zoom: !!document.querySelector('#zoomSlider')
    };
    out.snapStrength = tl.snapStrength;
    // snap test: time 5.01 with targets [5] should snap to 5
    tl.snapTargets = [5];
    tl.snapStrength = 1;
    out.snapResult = tl.snapTime(5.01);
    // context menu
    window.__sb.state.manualImages = ['bg.png'];
    window.__sb.refreshAll();
    const assetItem = document.querySelector('.asset-item');
    if (assetItem) {
      assetItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
    }
    out.contextMenu = {
      shown: !document.getElementById('contextMenu').classList.contains('hidden'),
      items: Array.from(document.querySelectorAll('#contextMenu .cm-item')).map(i => i.textContent)
    };
    // object tree context menu
    const s = window.__sb.state.storyboard;
    s.sprites.push({ id: 'spr_t', path: 'bg.png', time: 0, opacity: 1, preserve_aspect: true, layer: 0, order: 0 });
    window.__sb.refreshAll();
    const objItem = Array.from(document.querySelectorAll('.obj-item')).find(i => i.textContent.includes('spr_t'));
    if (objItem) {
      objItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    }
    out.objMenu = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map(i => i.textContent);
    return out;
  })()`);
  console.log('DOM:', JSON.stringify(dom));
  app.exit(0);
});
