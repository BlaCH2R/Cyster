// verify_round32.js - drag/c-drag connector lines are eliminated by the
// portion the chain's drag/c-drag HEAD has swept (not the scanner):
//   before the head triggers -> whole connector visible;
//   while the head sweeps a link -> visible part starts at the head position;
//   once the head passed the link target -> connector gone.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r32_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r32_'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [
      { id: 10, type: 3, x: 0.05, tick: 2600, hold_tick: 0, page_index: 0, next_id: 11 },
      { id: 11, type: 4, x: 0.95, tick: 3000, hold_tick: 0, page_index: 0, next_id: 0 }
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
  const out = await win.webContents.executeJavaScript(`(() => {
    const p = window.__sb.preview;
    p.backgroundImage = null;
    p.effectsEnabled = false;
    p.ui.show = false;
    p.ui.showNoteIds = false;
    p.drawClearEffects = () => {};
    p.drawHoldBars = () => {};
    p.drawStageLayer = () => {};
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ch = p.chart;
    const head = ch.noteById(10);
    const child = ch.noteById(11);
    const px = (x, y) => {
      const xc = Math.max(0, Math.min(W - 1, Math.round(x)));
      const yc = Math.max(0, Math.min(H - 1, Math.round(y)));
      const d = ctx.getImageData(xc, yc, 1, 1).data;
      return d[0] + d[1] + d[2];
    };
    const res = {};
    const link = (() => {
      const info0 = p.ctxInfo();
      const a = p.noteScreenPos(head, info0);
      const b = p.noteScreenPos(child, info0);
      return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
    })();
    res.link = { len: +link.len.toFixed(1), ax: +link.a.x.toFixed(1), ay: +link.a.y.toFixed(1), bx: +link.b.x.toFixed(1), by: +link.b.y.toFixed(1) };
    const sampleAt = (s) => {
      // The connector is dashed, so probe a small neighborhood and take the
      // brightest sample (dash coverage is dense, gaps are tiny).
      let best = 0;
      for (const ds of [-0.03, -0.01, 0, 0.01, 0.03]) {
        const x = link.a.x + (link.b.x - link.a.x) * (s + ds);
        const y = link.a.y + (link.b.y - link.a.y) * (s + ds);
        best = Math.max(best, px(x, y));
      }
      return best;
    };
    const span = child.start_time - head.start_time;
    const run = (t, fracs) => {
      p.setTime(t, false);
      p.render();
      return fracs.map(s => ({ s, lum: sampleAt(s) }));
    };

    // 1) before the head triggers: whole connector visible (fade-in intact)
    res.pre = run(head.start_time - 0.2, [0.15, 0.5, 0.85]);
    // 2) mid-sweep of the head->child link: behind the head dark, ahead bright
    res.mid = run(head.start_time + 0.3 * span, [0.1, 0.18, 0.6, 0.9]);
    // 3) head passed the child: connector gone
    res.post = run(child.start_time + 0.05, [0.25, 0.5, 0.75]);

    const bright = (v) => v.lum > 120;
    res.ok = res.pre.every(bright) &&
      !bright(res.mid[0]) && !bright(res.mid[1]) && bright(res.mid[2]) && bright(res.mid[3]) &&
      res.post.every(v => !bright(v));
    return res;
  })()`);
  console.log('R32:', JSON.stringify(out));
  check('connector eliminated by the head-swept portion (before/mid/after)',
    !out.err && out.ok,
    JSON.stringify({ pre: out.pre, mid: out.mid, post: out.post, link: out.link }));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
