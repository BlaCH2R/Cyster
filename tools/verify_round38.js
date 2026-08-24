// verify_round38.js - sprite scale_x/scale_y (and uniform scale) take
// priority over preserve_aspect; preserve_aspect=false is honored.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r38_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function solidPng(w, h, r, g, b) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array(h).fill(row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r38_'));
  fs.writeFileSync(path.join(dir, 'img.png'), solidPng(32, 16, 255, 0, 0));
  const chart = { time_base: 480, tempo_list: [{ tick: 0, value: 500000 }], page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }], note_list: [{ id: 1, type: 0, x: 0.5, tick: 2000, hold_tick: 0, page_index: 0 }], event_order_list: [], music_offset: 0 };
  const sb = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = { level, levelDir: dir, files: [{ name: 'level.json', size: 1 }], charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }] };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1500));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const st = window.__sb.state.storyboard;
    const W = pv.canvas.width, H = pv.canvas.height;
    const pos = { x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 } };
    const measure = async (extra) => {
      st.sprites = [Object.assign({ id: 't', path: 'img.png', time: 0, opacity: 1, width: 200, height: 100, layer: 1, order: 0 }, pos, extra)];
      window.__sb.refreshAll();
      await new Promise(r => setTimeout(r, 250));
      pv.setTime(1, false);
      pv.render();
      const img = pv.canvas.getContext('2d').getImageData(0, 0, W, H).data;
      let minX = W, minY = H, maxX = -1, maxY = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (img[i] > 180 && img[i + 1] < 80 && img[i + 2] < 80) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      return { w: maxX - minX + 1, h: maxY - minY + 1 };
    };
    const res = {};
    res.preserve = await measure({});                                  // 2:1 image -> aspect forced
    res.scaleXY = await measure({ scale_x: 2, scale_y: 1 });           // scale priority -> 2:1 box * (2,1)
    res.noPreserve = await measure({ preserve_aspect: false });        // box 200x100 as-is
    res.uniform = await measure({ scale: 2 });                         // uniform scale
    // Expected pixels: stage 200/100 -> px 243.5 x 91 (image 2:1).
    res.ok = Math.abs(res.preserve.w - 182) < 4 && Math.abs(res.preserve.h - 91) < 3 &&
      Math.abs(res.scaleXY.w - 364) < 5 && Math.abs(res.scaleXY.h - 91) < 3 &&
      Math.abs(res.noPreserve.w - 243.5) < 4 && Math.abs(res.noPreserve.h - 91) < 3 &&
      Math.abs(res.uniform.w - 364) < 5 && Math.abs(res.uniform.h - 182) < 4;
    return res;
  })()`);
  console.log('R38:', JSON.stringify(out));
  check('preserve_aspect keeps priority over scale; scale still scales the fitted size',
    !out.err && out.ok, JSON.stringify(out));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
