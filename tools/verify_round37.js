// verify_round37.js - sprite images load and render in the preview, and files
// referenced by storyboard sprites/videos are auto-added to the asset library.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r37_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

// Minimal PNG encoder for a solid-color square (for a deterministic sprite).
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function solidPng(w, h, r, g, b) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array(h).fill(row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise(r => setTimeout(r, 600));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r37_'));
  fs.writeFileSync(path.join(dir, 'red.png'), solidPng(8, 8, 255, 0, 0));
  fs.copyFileSync('V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/video.mp4', path.join(dir, 'video.mp4'));
  const chart = {
    time_base: 480,
    tempo_list: [{ tick: 0, value: 500000 }],
    page_list: [{ start_tick: 0, end_tick: 4800, scan_line_direction: 1 }],
    note_list: [{ id: 1, type: 0, x: 0.5, tick: 2000, hold_tick: 0, page_index: 0 }],
    event_order_list: [],
    music_offset: 0
  };
  const sb = {
    sprites: [
      { id: 's_red', path: 'red.png', time: 0, opacity: 1, width: 400, height: 400, layer: 1, order: 0, x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 }, states: [{ time: 60 }] }
    ],
    texts: [], videos: [
      { id: 'v1', path: 'video.mp4', time: 0, opacity: 0.4, width: 800, height: 600, layer: 0, order: 0 }
    ], lines: [], controllers: [], note_controllers: []
  };
  fs.writeFileSync(path.join(dir, 'chart.json'), JSON.stringify(chart));
  fs.writeFileSync(path.join(dir, 'sb.json'), JSON.stringify(sb));
  const level = { schema_version: 2, version: 1, id: 't', title: 't', artist: 't', charter: 't', music: { path: null }, charts: [{ type: 'base', path: 'chart.json', storyboard: { path: 'sb.json' } }] };
  fs.writeFileSync(path.join(dir, 'level.json'), JSON.stringify(level));
  const info = {
    level, levelDir: dir,
    files: [{ name: 'level.json', size: 1 }, { name: 'chart.json', size: 1 }, { name: 'sb.json', size: 1 }, { name: 'red.png', size: 1 }, { name: 'video.mp4', size: 1 }],
    charts: [{ type: 'base', path: 'chart.json', content: JSON.stringify(chart), storyboardPath: 'sb.json', storyboardContent: JSON.stringify(sb) }]
  };
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise(r => setTimeout(r, 1800));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const res = {};
    const pv = window.__sb.preview;
    // 1. Asset library auto-lists referenced files.
    const autoItems = Array.from(document.querySelectorAll('.asset-item.asset-auto'));
    res.autoAssets = autoItems.map(it => it.querySelector('.nm').textContent);
    res.assetOk = res.autoAssets.includes('red.png') && res.autoAssets.includes('video.mp4');

    // 2. Sprite image loads.
    let img = null;
    for (let i = 0; i < 40 && !img; i++) {
      await new Promise(r => setTimeout(r, 100));
      const c = pv.imageCache && pv.imageCache['red.png'];
      if (c && c.complete && c.naturalWidth > 0) img = c;
    }
    res.imgLoaded = !!img && img.naturalWidth === 8;

    // 3. Sprite actually renders: the red square is drawn at the playfield
    //    center (camera identity), so the center pixel should be red.
    pv.setTime(30, false);
    pv.render();
    const W = pv.canvas.width, H = pv.canvas.height;
    const ctx = pv.canvas.getContext('2d');
    const d = ctx.getImageData(Math.round(W / 2), Math.round(H / 2), 1, 1).data;
    res.centerPx = [d[0], d[1], d[2]];
    res.renderOk = d[0] > 180 && d[1] < 90 && d[2] < 90;

    // 4. Video referenced in library and load kicked off.
    res.videoCached = !!pv.videoCache['video.mp4'];
    return res;
  })()`);
  console.log('R37:', JSON.stringify(out));

  check('storyboard-referenced images/videos auto-added to the asset library',
    !out.err && out.assetOk, JSON.stringify({ autoAssets: out.autoAssets }));
  check('sprite image file loads (cache populated, decoded)',
    !out.err && out.imgLoaded, JSON.stringify({ imgLoaded: out.imgLoaded }));
  check('sprite renders its image in the preview (red center pixel)',
    !out.err && out.renderOk, JSON.stringify({ centerPx: out.centerPx }));
  const fails = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
