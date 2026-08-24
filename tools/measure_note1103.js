// Measure note 1103's rendered body box in the app render and in the user's
// CytoidPlayer screenshot (image #4), to compare the rot_x squash.
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8; let w = 0, h = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(pos + 8); h = buf.readUInt32BE(pos + 12); }
    if (type === 'IDAT') idat.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4); let prev = Buffer.alloc(w * 4);
  const bpp = 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (w * bpp + 1)]; const row = Buffer.alloc(w * bpp);
    for (let x = 0; x < w * bpp; x++) {
      const v = raw[y * (w * bpp + 1) + 1 + x];
      const a = x >= bpp ? row[x - bpp] : 0; const b = prev[x]; const c = x >= bpp ? prev[x - bpp] : 0;
      let pv;
      if (f === 0) pv = v; else if (f === 1) pv = (v + a) & 255; else if (f === 2) pv = (v + b) & 255;
      else if (f === 3) pv = (v + ((a + b) >> 1)) & 255; else pv = (v + ((a + b + c) >> 1)) & 255;
      row[x] = pv;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 4] = row[x * 4]; out[(y * w + x) * 4 + 1] = row[x * 4 + 1];
      out[(y * w + x) * 4 + 2] = row[x * 4 + 2]; out[(y * w + x) * 4 + 3] = row[x * 4 + 3];
    }
    prev = row;
  }
  return { w, h, data: out };
}

function measure(file, label) {
  const img = decodePNG(file);
  const { w, h, data } = img;
  // Cyan/blue note body: B dominant, R low
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, count = 0;
  const hits = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (b > 120 && b > r + 40 && b >= g && a > 40) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        count++;
        if (hits.length < 8) hits.push(`${x},${y}`);
      }
    }
  }
  console.log(`[${label}] ${w}x${h} blue box: ${maxX - minX}x${maxY - minY} at (${minX},${minY}) count=${count}`);
  console.log('  sample hits:', hits.join(' '));
  return { bw: maxX - minX, bh: maxY - minY, minX, minY, maxX, maxY };
}

function measureWindow(file, label, cx, cy, half) {
  const img = decodePNG(file);
  const { w, h, data } = img;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, count = 0;
  const x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
  const y0 = Math.max(0, cy - half), y1 = Math.min(h, cy + half);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      // cyan fill #35A7FF-ish or white ring / text
      const cyan = b > 150 && g > 90 && g < 230 && r < 120 && a > 50;
      const bright = r > 180 && g > 180 && b > 180 && a > 60;
      if (cyan || bright) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        count++;
      }
    }
  }
  const bw = maxX - minX, bh = maxY - minY;
  console.log(`[${label}] window(${cx},${cy},${half}) box: ${bw}x${bh} at (${minX},${minY}) count=${count}`);
}

// Measure the note BODY (fill+ring) around a center. The fill is #35A7FF
// scaled by opacity; the ring is white; both sit on a dark background.
function measureBody(file, label, cx, cy, half) {
  const img = decodePNG(file);
  const { w, h, data } = img;
  const x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
  const y0 = Math.max(0, cy - half), y1 = Math.min(h, cy + half);
  // collect non-background pixels (dark bg ~ r,g,b all < 60)
  const pts = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const lum = (r + g + b) / 3;
      if (a > 30 && lum > 70) pts.push({ x, y, r, g, b });
    }
  }
  if (!pts.length) { console.log(`[${label}] no body pixels`); return; }
  // filter to the largest connected-ish blob near the center
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (const p of pts) {
    if (Math.abs(p.x - cx) > half * 0.85 || Math.abs(p.y - cy) > half * 0.85) continue;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  console.log(`[${label}] body box: ${bw}x${bh} (ratio ${(bw / bh).toFixed(3)}) at (${minX},${minY}) px=${pts.length}`);
}

// Radial edge profile: from the note center, find the furthest bright pixel
// along each ray. Uniform radius => circle; angle-dependent => ellipse.
function radialProfile(file, label, cx, cy, maxR) {
  const img = decodePNG(file);
  const { w, h, data } = img;
  const radii = [];
  for (let deg = 0; deg < 360; deg += 4) {
    const rad = deg * Math.PI / 180;
    const dx = Math.cos(rad), dy = Math.sin(rad);
    let far = 0;
    for (let r = 1; r <= maxR; r++) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const i = (y * w + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const a = data[i + 3];
      if (a > 40 && lum > 60) far = r;
    }
    radii.push({ deg, r: far });
  }
  const horiz = radii.filter((p) => p.deg <= 8 || p.deg >= 352).map((p) => p.r);
  const vert = radii.filter((p) => p.deg >= 82 && p.deg <= 98).map((p) => p.r);
  const all = radii.map((p) => p.r).filter((r) => r > 0);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  console.log(`[${label}] radial: H=${avg(horiz).toFixed(1)} V=${avg(vert).toFixed(1)} H/V=${(avg(horiz) / Math.max(1, avg(vert))).toFixed(3)} max=${Math.max(...all)}`);
}

if (process.argv[2] === '--window') {
  measureWindow(process.argv[3], process.argv[4], Number(process.argv[5]), Number(process.argv[6]), Number(process.argv[7]));
} else if (process.argv[2] === '--body') {
  measureBody(process.argv[3], process.argv[4], Number(process.argv[5]), Number(process.argv[6]), Number(process.argv[7]));
} else if (process.argv[2] === '--radial') {
  radialProfile(process.argv[3], process.argv[4], Number(process.argv[5]), Number(process.argv[6]), Number(process.argv[7]));
} else {
  measure(process.argv[2], 'APP');
  measure(process.argv[3], 'PLAYER');
}
