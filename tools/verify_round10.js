// Verify round-10 changes.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_r10_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [{ id: 1, type: 0, x: 0, tick: 2000, hold_tick: 0, page_index: 0 }],
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
    const out = {};
    // time format ss.mmm
    out.fmtTime = window.SBTimeline.fmtTime(184.25);
    out.fmtTime2 = window.SBTimeline.fmtTime(0.5);
    // radial_blur default + tape removed
    const Effects = window.SBEffects;
    out.effectsKeys = Object.keys(Effects);
    out.hasTape = Effects.applyEffects.toString().includes('tape');
    // object tree removed, add button present
    out.objectTreeGone = !document.getElementById('objectTree');
    out.addBtn = !!document.getElementById('btnAddObject');
    // preview 4:3
    const canvas = document.getElementById('previewCanvas');
    out.preview = { w: canvas.width, h: canvas.height, ratio: +(canvas.width / canvas.height).toFixed(3) };
    // timeline: label ruler, snap line, sliders
    out.tlLabelRuler = !!document.querySelector('#tlLabelRuler');
    out.snapLine = !!document.querySelector('#snapLine');
    // snap line visibility test
    const tl = window.__sb.timeline;
    tl.showSnapLine(5);
    out.snapLineShown = document.querySelector('#snapLine').style.display !== 'none';
    tl.showSnapLine(null);
    // collapse test
    const s = window.__sb.state.storyboard;
    s.sprites.push({ id: 'spr_t', path: 'bg.png', time: 0, opacity: 1, preserve_aspect: true, layer: 0, order: 0 });
    window.__sb.refreshAll();
    const gh = Array.from(document.querySelectorAll('.group-header')).find(h => h.textContent.includes('Sprite'));
    if (gh) {
      gh.click();
      const collapsed = gh.classList.contains('collapsed');
      const lanesHidden = Array.from(document.querySelectorAll('.lane-label')).filter(l => l.textContent.includes('spr_t')).length === 0;
      out.collapse = { collapsed, lanesHidden };
      gh.click();
    }
    // object context menu on timeline label
    const label = Array.from(document.querySelectorAll('.lane-label')).find(l => l.textContent.includes('spr_t'));
    if (label) {
      label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 90, clientY: 90 }));
    }
    out.labelMenu = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map(i => i.textContent);
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  // multi-chart selection test
  const multi = await win.webContents.executeJavaScript(`(async () => {
    const c2 = { type: 'hard', path: 'chart.json', content: '', storyboardPath: null, storyboardContent: null, difficulty: 10 };
    const p = window.__sb.chooseChart([{ type: 'easy', path: 'a', difficulty: 2 }, c2]);
    // choose the second item via DOM
    await new Promise(r => setTimeout(r, 100));
    const items = document.querySelectorAll('#modalBody .pick-item');
    if (items.length) items[1].click();
    const chosen = await p;
    return { items: items.length, chosenType: chosen ? chosen.type : null };
  })()`);
  console.log('MULTI:', JSON.stringify(multi));
  app.exit(0);
});
