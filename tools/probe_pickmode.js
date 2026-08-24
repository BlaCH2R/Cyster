// Probe for the preview selection-layer feature: pick mode switcher, click to
// select, Ctrl multi-select, marquee selection, lock buttons, and the
// multi-select properties message. Opens the ParentRotTest level.
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

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_pick_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1500, 920);
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
    const canvas = document.getElementById('previewCanvas');
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const rect = () => canvas.getBoundingClientRect();
    const stageCenter = (id) => {
      const r0 = pv.evalResult.sprites.find((s) => s.obj.id === id);
      if (!r0) return null;
      const m3 = pv.stageMatrix3(r0.obj, r0, info);
      const c = pv.stageProjectPoint(m3, 0, 0, info);
      const r = rect();
      return { clientX: r.left + c.x / canvas.width * r.width, clientY: r.top + c.y / canvas.height * r.height };
    };
    const clickAt = (clientX, clientY, ctrl) => canvas.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX, clientY, ctrlKey: !!ctrl,
    }));

    // 1) pick mode selector
    const sel = document.getElementById('pickMode');
    out.hasSelector = !!sel;
    sel.value = 'stage';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    out.pickMode = window.__sb.state.pickMode;

    // 2) click selects a sprite of the current layer
    const p = stageCenter('p3d');
    clickAt(p.clientX, p.clientY, false);
    await sleep(120);
    out.selectedAfterClick = window.__sb.state.selectedIds.slice();
    out.propsAfterClick = document.getElementById('propBody').textContent.slice(0, 60);

    // 3) ctrl+click selects a second sprite -> multi message
    const q = stageCenter('nx');
    clickAt(q.clientX, q.clientY, true);
    await sleep(120);
    out.multiSelected = window.__sb.state.selectedIds.slice();
    out.multiProps = document.getElementById('propBody').textContent.slice(0, 60);

    // 4) marquee selection
    const r = rect();
    const cssX = (cx, cy) => ({ x: r.left + cx / canvas.width * r.width, y: r.top + cy / canvas.height * r.height });
    const a = cssX(0, 0), b = cssX(canvas.width, canvas.height);
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: a.x, clientY: a.y }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.x, clientY: b.y }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: b.x, clientY: b.y }));
    await sleep(150);
    out.marqueeSelected = window.__sb.state.selectedIds.slice();

    // 5) lock button in the left panel + locked objects skipped by pick
    const lockBtn = document.querySelector('.oa-item .oa-lock');
    out.hasLockBtn = !!lockBtn;
    if (lockBtn) {
      lockBtn.click();
      await sleep(120);
      out.lockedIds = Array.from(window.__sb.state.lockedIds);
      // Clicking the locked object in the preview must NOT select it
      const lp = stageCenter('p3d');
      clickAt(lp.clientX, lp.clientY, false); // consumes the post-marquee click suppression
      clickAt(lp.clientX, lp.clientY, false);
      await sleep(120);
      out.selectedAfterLockedClick = window.__sb.state.selectedIds.slice();
    }

    // 6) timeline lane lock buttons exist
    out.timelineLocks = document.querySelectorAll('.lane-lock').length;
    return out;
  })()`);

  check('pick mode selector present and switches layer',
    res.hasSelector === true && res.pickMode === 'stage', JSON.stringify({ hasSelector: res.hasSelector, pickMode: res.pickMode }));
  check('click selects a sprite and shows its properties',
    res.selectedAfterClick && res.selectedAfterClick.length === 1 && /p3d/.test(String(res.selectedAfterClick[0])),
    JSON.stringify({ selectedAfterClick: res.selectedAfterClick, props: res.propsAfterClick }));
  check('ctrl+click adds a second sprite -> multi message',
    res.multiSelected && res.multiSelected.length === 2 && /已选择 2 个 Sprite/.test(String(res.multiProps)),
    JSON.stringify({ multiSelected: res.multiSelected, multiProps: res.multiProps }));
  check('marquee selects multiple objects of the layer',
    res.marqueeSelected && res.marqueeSelected.length > 1,
    JSON.stringify({ marqueeSelected: res.marqueeSelected }));
  check('lock buttons exist and locked objects are skipped by preview pick',
    res.hasLockBtn === true && res.lockedIds && res.lockedIds.length === 1 &&
    res.selectedAfterLockedClick && !res.selectedAfterLockedClick.includes('p3d'),
    JSON.stringify({ lockedIds: res.lockedIds, selectedAfterLockedClick: res.selectedAfterLockedClick }));
  check('timeline lane lock buttons exist', res.timelineLocks > 0, String(res.timelineLocks));

  out.result = res;
  fs.writeFileSync(path.join(__dirname, 'probe_pickmode_out.json'), JSON.stringify(out, null, 2));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
