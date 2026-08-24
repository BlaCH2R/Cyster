// Eyedropper probe: opens the app with the ParentRotTest level, selects a
// sprite, clicks the 取色 button on the color field, verifies the screen
// capture overlay appears, simulates a pick, and checks the color is applied.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：parent\\ParentRotTest';

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_eye_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 900);
  await new Promise((r) => setTimeout(r, 800));

  const out = { checks: [], ok: true };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(LEVEL))})`);
  await new Promise((r) => setTimeout(r, 3000));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    // Select a sprite so the properties panel shows the color field.
    const objs = window.__sb.state.storyboard.sprites || [];
    if (objs.length) {
      window.__sb.state.selectedObjId = objs[0].id;
      window.__sb.state.selectedKeyIdx = -1;
      window.__sb.refreshAll();
    }
    await sleep(300);
    out.spriteSelected = !!window.__sb.state.selectedObjId;
    const pb = document.getElementById('propBody');
    out.propHtml = pb ? pb.innerHTML.slice(0, 160) : null;
    const btns = Array.from(document.querySelectorAll('.eyedropper-btn'));
    out.eyedropperButtons = btns.length;
    // Screen capture API present and returns displays
    try {
      const caps = await window.sbAPI.captureScreen();
      out.captureDisplays = Array.isArray(caps) ? caps.length : -1;
      out.captureFirst = caps && caps[0] ? { size: [caps[0].sizeW, caps[0].sizeH], dip: [caps[0].dipW, caps[0].dipH] } : null;
    } catch (e) {
      out.captureError = String(e && e.message || e);
    }
    if (btns.length) {
      btns[0].click();
      await sleep(6000);
      out.overlayShown = !!document.getElementById('eyedropperOverlay');
      out.eyeDebug = window.__eyedropperDebug;
      if (out.overlayShown) {
        const ov = document.getElementById('eyedropperOverlay');
        const rect = ov.getBoundingClientRect();
        // Simulate a pick at a fixed screen offset
        ov.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true, clientX: rect.left + 120, clientY: rect.top + 120,
          screenX: window.screenX + 120, screenY: window.screenY + 120,
        }));
        ov.dispatchEvent(new MouseEvent('click', {
          bubbles: true, clientX: rect.left + 120, clientY: rect.top + 120,
          screenX: window.screenX + 120, screenY: window.screenY + 120,
        }));
        await sleep(300);
        out.overlayClosed = !document.getElementById('eyedropperOverlay');
        const colorCell = document.querySelector('#propBody .field input[type=color]');
        const textInput = colorCell ? colorCell.parentElement.querySelector('input[type=text]') : null;
        out.colorApplied = !!(textInput && /^#[0-9a-fA-F]{6}$/.test(textInput.value.trim()));
        out.colorValue = textInput ? textInput.value : null;
      }
    }
    return out;
  })()`);

  check('color field eyedropper buttons exist',
    res.eyedropperButtons > 0, `buttons=${res.eyedropperButtons}`);
  check('screen capture returns displays',
    res.captureDisplays > 0, JSON.stringify({ captureDisplays: res.captureDisplays, first: res.captureFirst }));
  check('eyedropper overlay shows after click',
    res.overlayShown === true, String(res.overlayShown));
  check('pick applies a #hex color and closes overlay',
    res.overlayClosed === true && res.colorApplied === true,
    JSON.stringify({ overlayClosed: res.overlayClosed, colorValue: res.colorValue }));

  out.result = res;
  fs.writeFileSync(path.join(__dirname, 'probe_eyedropper_out.json'), JSON.stringify(out, null, 2));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
