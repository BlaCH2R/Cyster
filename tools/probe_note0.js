// Verifies note id=0 selection: clicking the note in Note pick mode selects
// it (highlight + properties panel) AND jumps to its start time.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_n0_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_n0_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

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

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 3000));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const canvas = document.getElementById('previewCanvas');
    const pv = window.__sb.preview;
    pv.setTime(4.5, false);
    await sleep(150);
    const note0 = pv.chart.notes.find((n) => n.id === 0);
    out.note0Exists = !!note0;
    if (!note0) return out;
    const info = pv.ctxInfo();
    const pos = pv.noteScreenPos(note0, info);
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + pos.x / canvas.width * rect.width;
    const clientY = rect.top + pos.y / canvas.height * rect.height;
    const sel = document.getElementById('pickMode');
    sel.value = 'note';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY }));
    await sleep(150);
    out.selected = window.__sb.state.selectedIds.slice();
    out.time = window.__sb.preview.time;
    out.noteStart = note0.start_time;
    out.props = document.getElementById('propBody').textContent.slice(0, 60);
    out.highlightNotes = pv.highlightNotes ? Array.from(pv.highlightNotes) : null;
    return out;
  })()`);

  check('sample chart contains note id 0', res.note0Exists === true, String(res.note0Exists));
  check('clicking note 0 selects it ("note::0")',
    res.selected && res.selected.includes('note::0'), JSON.stringify(res.selected));
  check('properties panel shows the note 0 info',
    /Note 音符/.test(String(res.props)) && /ID0/.test(String(res.props)), JSON.stringify(res.props));
  check('click also jumps to the note start time',
    Math.abs(res.time - res.noteStart) < 0.01, JSON.stringify({ time: res.time, noteStart: res.noteStart }));
  check('note 0 is highlighted',
    res.highlightNotes && res.highlightNotes.includes(0), JSON.stringify(res.highlightNotes));

  out.result = res;
  fs.writeFileSync(path.join(__dirname, 'probe_note0_out.json'), JSON.stringify(out, null, 2));
  app.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
