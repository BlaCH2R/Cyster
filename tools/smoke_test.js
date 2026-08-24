// GUI smoke test: loads the app, opens the sample level folder, scrubs to a few
// timestamps, captures screenshots for visual QA.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

// Isolate userData so concurrent/leftover processes can't lock settings.json.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_smoke_ud_')));

// Reuse the real main process (window + IPC handlers)
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_smoke_');

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
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => {
    console.log('FATAL TIMEOUT');
    app.exit(1);
  }, 60000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try {
      const level = e.level;
      const message = e.message;
      if (level >= 2 || /error/i.test(message)) console.log('RENDERER:', message);
    } catch (err) {}
  });
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  const info = buildInfo(PLAYER);

  const hasHook = await win.webContents.executeJavaScript(`!!window.__sb`);
  console.log('hasHook:', hasHook);
  if (hasHook) {
    const probe = await win.webContents.executeJavaScript(`({
      engineKeys: Object.keys(window.SBEngine || {}),
      hasCompiler: !!(window.SBEngine && window.SBEngine.storyboard && window.SBEngine.storyboard.StoryboardCompiler),
      compilerType: typeof (window.SBEngine && window.SBEngine.storyboard && window.SBEngine.storyboard.StoryboardCompiler),
      hasPreview: !!window.SBPreview,
      hasSchema: !!window.SBSchema,
      hasTimeline: !!window.SBTimeline
    })`);
    console.log('probe:', JSON.stringify(probe));
    const constructTest = await win.webContents.executeJavaScript(`
      (() => {
        try {
          const c = new window.SBEngine.storyboard.StoryboardCompiler({}, null);
          return 'ok ' + (typeof c.compile);
        } catch (e) {
          return 'err ' + e.message;
        }
      })()
    `);
    console.log('constructTest:', constructTest);
    try {
      await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
    } catch (e) {
      console.log('loadLevelInfo error:', e && e.message);
    }
    await new Promise((r) => setTimeout(r, 4000));
    console.log('level loaded');

    // Performance measured BEFORE capturePage calls (avoid GPU readback pollution)
    const perf = await win.webContents.executeJavaScript(`(() => {
      const p = window.__sb.preview;
      const measure = (t) => {
        const t0 = performance.now();
        for (let i = 0; i < 60; i++) {
          p.setTime(t + i * 0.016, false);
          p.render();
        }
        const dt = performance.now() - t0;
        return { avgMs: +(dt / 60).toFixed(2), fps: Math.round(60000 / dt) };
      };
      return { t77: measure(77.25), t120: measure(120.1875), t150: measure(150) };
    })()`);
    console.log('PERF:', JSON.stringify(perf));

    const times = [0, 4.5, 52.13, 77.25, 120.1875, 160];
    for (const t of times) {
      await win.webContents.executeJavaScript(`window.__sb.setTime(${t}, false)`);
      await new Promise((r) => setTimeout(r, 900));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'shots', `shot_${String(t).replace('.', '_')}.png`), img.toPNG());
      console.log('captured', t);
    }

    // DOM layout assertions
    const dom = await win.webContents.executeJavaScript(`(() => {
const ids = ['previewCanvas','timeline','rightPanel','leftPanel','assetList','propBody','splitL','splitR','splitT','objectAddList','chkShowIds'];
      const missing = ids.filter(id => !document.getElementById(id));
      const menus = Array.from(document.querySelectorAll('.menu-item')).map(b => b.dataset.menu);
      const entries = Array.from(document.querySelectorAll('.menu-entry')).map(b => b.dataset.action);
      const removed = ['btnNewProject','btnOpenProject','btnImportLevel','btnImportSB','btnSaveSB','btnExportJson','btnProjectSettings','btnShowFolder','btnSettings','btnAddObject','objectTree'].filter(id => document.getElementById(id));
      const laneCount = document.querySelectorAll('.lane-row').length;
      const kfCount = document.querySelectorAll('.kf').length;
      const timelineW = document.getElementById('timeline').clientWidth;
      const previewW = document.getElementById('previewCanvas').width;
      const previewH = document.getElementById('previewCanvas').height;
      const timelineDur = window.__sb.timeline.duration;
      const audioDur = window.__sb.preview.audio ? (isFinite(window.__sb.preview.audio.duration) ? window.__sb.preview.audio.duration : null) : null;
      const audioReady = window.__sb.state.audioReady;
      return { missing, menus, entries, removed, laneCount, kfCount, timelineW, previewW, previewH, timelineDur, audioDur, audioReady, hasIdChk: !!document.getElementById('chkShowIds') };
    })()`);
    console.log('DOM:', JSON.stringify(dom));

    // Welcome-page toggle via the brand title + note click test
    const ui = await win.webContents.executeJavaScript(`(async () => {
      const out = {};
      document.querySelector('.brand').click();
      await new Promise(r => setTimeout(r, 150));
      out.welcomeShown = document.body.classList.contains('welcome-mode');
      document.querySelector('.brand').click();
      await new Promise(r => setTimeout(r, 150));
      out.welcomeHidden = !document.body.classList.contains('welcome-mode');
      // Click a note in the preview canvas
      const p = window.__sb.preview;
      const canvas = document.getElementById('previewCanvas');
      const note = p.chart.notes.find(n => n.type === 0 && p.time <= n.start_time + 1 && p.time >= n.intro_time) ||
        p.chart.notes.find(n => n.type === 0);
      if (note) {
        const info = p.ctxInfo();
        const pos = p.noteScreenPos(note, info);
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + pos.x / canvas.width * rect.width,
          clientY: rect.top + pos.y / canvas.height * rect.height,
          bubbles: true
        }));
        await new Promise(r => setTimeout(r, 200));
        out.clickedNote = note.id;
        out.timeAfterClick = window.__sb.preview.time;
        out.selectedObjId = window.__sb.state.selectedObjId;
        out.pendingNote = window.__sb.state.pendingNote;
        out.noteControllers = (window.__sb.state.storyboard.note_controllers || []).map(o => o.note);
        out.propsText = document.getElementById('propBody').textContent.slice(0, 80);
        // edit a checkbox to trigger deferred creation
        const form = document.querySelector('#stateForm');
        if (form) {
          const cb = form.querySelector('input[type=checkbox]');
          if (cb) { cb.click(); await new Promise(r => setTimeout(r, 200)); }
        }
        out.afterEditControllers = (window.__sb.state.storyboard.note_controllers || []).map(o => o.note);
        out.afterEditPending = window.__sb.state.pendingNote;
      } else {
        out.clickedNote = null;
      }
      return out;
    })()`);
    console.log('UI:', JSON.stringify(ui));

    // Pixel checks at t=4.5: note 0 position + scanline
    await win.webContents.executeJavaScript(`window.__sb.setTime(4.5, false)`);
    await new Promise((r) => setTimeout(r, 900));
    const px = await win.webContents.executeJavaScript(`(() => {
      const p = window.__sb.preview;
      const canvas = document.getElementById('previewCanvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const info = p.ctxInfo();
      const debug = {
        S: info.S, ortho: info.ortho, sxF: info.sxF, syF: info.syF, rotZ: info.rotZ,
        camXpx: info.camXpx, camYpx: info.camYpx,
        ctrl: {
          perspective: info.ctrl.perspective, fov: info.ctrl.fov, size: info.ctrl.size,
          zPx: info.ctrl.zPx, xPx: info.ctrl.xPx, yPx: info.ctrl.yPx,
          rot_x: info.ctrl.rot_x, rot_y: info.ctrl.rot_y, rot_z: info.ctrl.rot_z
        },
        chartScreenRatio: p.chart.screenRatio,
        note0: { wx: p.chart.noteById(0).worldX, wy: p.chart.noteById(0).worldY }
      };
      const note = p.chart.noteById(0);
      const np = p.noteScreenPos(note, info);
      const scanY = p.chart.getScannerPositionY(4.5);
      const sp = p.worldToPx(0, scanY, info);
      const img = ctx.getImageData(0, 0, W, H).data;
      const at = (x, y) => {
        x = Math.max(0, Math.min(W-1, Math.round(x)));
        y = Math.max(0, Math.min(H-1, Math.round(y)));
        const i = (y*W + x) * 4;
        return [img[i], img[i+1], img[i+2], img[i+3]];
      };
      // neighborhood stats around note
      let noteBright = 0, noteHits = 0;
      for (let dy = -30; dy <= 30; dy += 4) {
        for (let dx = -30; dx <= 30; dx += 4) {
          const c = at(np.x + dx, np.y + dy);
          const lum = (c[0]+c[1]+c[2])/3;
          if (lum > 90) { noteBright += lum; noteHits++; }
        }
      }
      return {
        debug,
        noteScreen: { x: Math.round(np.x), y: Math.round(np.y) },
        noteCenter: at(np.x, np.y),
        noteBrightHits: noteHits,
        noteAvgLum: noteHits ? Math.round(noteBright/noteHits) : 0,
        scanline: { x: Math.round(sp.x), y: Math.round(sp.y) },
        scanlinePx: at(sp.x, sp.y),
        W, H
      };
    })()`);
    console.log('PIXEL:', JSON.stringify(px));

    // Flick texture check: find a flick note, sample its face while visible,
    // then verify it disappears and the clear ripple shows after clear.
    const flick = await win.webContents.executeJavaScript(`(() => {
      const p = window.__sb.preview;
      const flick = p.chart.notes.find(n => n.type === 5);
      if (!flick) return { err: 'no flick' };
      const info = p.ctxInfo();
      const canvas = document.getElementById('previewCanvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const sample = (t) => {
        p.setTime(t, false); p.render();
        const img = ctx.getImageData(0, 0, W, H).data;
        const pos = p.noteScreenPos(flick, info);
        let blue = 0, red = 0, white = 0, cyan = 0;
        const r = Math.round((flick.type === 5 ? 2.6 : 1.3) * info.S);
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const x = Math.max(0, Math.min(W-1, Math.round(pos.x + dx)));
            const y = Math.max(0, Math.min(H-1, Math.round(pos.y + dy)));
            const i = (y*W + x) * 4;
            const rr = img[i], g = img[i+1], b = img[i+2];
            if (b > 150 && rr < 130) blue++;
            if (rr > 160 && g < 110 && b < 130) red++;
            if (rr > 210 && g > 210 && b > 210) white++;
            if (b > 130 && b > rr + 25 && g > 100) cyan++;
          }
        }
        return { blue, red, white, cyan, pos: { x: Math.round(pos.x), y: Math.round(pos.y) } };
      };
      const mid = (flick.intro_time + flick.start_time) / 2;
      const after = flick.start_time + 0.15;
      return { mid, after, visible: sample(mid), cleared: sample(after) };
    })()`);
    console.log('FLICK:', JSON.stringify(flick));

  }

  // Select an object & keyframe to exercise the properties panel
  if (hasHook) {
    await win.webContents.executeJavaScript(`
      (() => {
        const objs = window.__sb.state.storyboard.sprites || [];
        const first = objs[0];
        if (first) window.__sb.state.selectedObjId = first.id;
        window.__sb.refreshAll();
        return objs.length;
      })()
    `);
    await new Promise((r) => setTimeout(r, 900));
    const img2 = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'shots', 'shot_props.png'), img2.toPNG());
    console.log('props shot captured');
  }
  app.exit(0);
});
