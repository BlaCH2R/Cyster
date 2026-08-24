// Per-color analysis of the parent-child 3D rotation comparison frames.
// The test level uses one solid color per sprite (red/green/blue/yellow/
// magenta/cyan/white/orange), so each region maps 1:1 to a sprite and its
// trapezoid direction can be measured unambiguously.
// Run: node analyze_parent_rot.js [self.png] [engine.png]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SELF = process.argv[2] || path.join(__dirname, 'parent_rot_self.png');
const ENGINE = process.argv[3] || path.join(__dirname, 'parent_rot_engine.png');

const TARGETS = {
  red: [255, 0, 0],
  green: [0, 204, 0],
  lime: [0, 255, 0],
  blue: [0, 96, 255],
  yellow: [255, 216, 0],
  magenta: [255, 0, 255],
  cyan: [0, 229, 255],
  orange: [255, 136, 0],
  pink: [255, 105, 180],
  white: [255, 255, 255],
};

function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png: ' + file);
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || data[12] !== 0) {
        throw new Error('unsupported png bitDepth=' + bitDepth + ' colorType=' + colorType);
      }
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 6 ? 4 : 3;
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
  };
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      line[i] = v & 0xff;
    }
    prev = line;
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      if (ch === 4) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3]; }
      else { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255; }
    }
  }
  return { w, h, data: out };
}

function nearestTarget(r, g, b) {
  let best = null, bestD = Infinity;
  for (const [name, c] of Object.entries(TARGETS)) {
    const d = Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]);
    if (d < bestD) { bestD = d; best = name; }
  }
  return bestD < 240 ? best : null;
}

function analyze(img) {
  const colorOf = new Int16Array(img.w * img.h).fill(-1);
  const names = Object.keys(TARGETS);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      const a = img.data[i + 3];
      if (a < 40) continue;
      const t = nearestTarget(img.data[i], img.data[i + 1], img.data[i + 2]);
      colorOf[y * img.w + x] = t ? names.indexOf(t) : -1;
    }
  }
  const regions = [];
  const seen = new Uint8Array(img.w * img.h);
  const stack = [];
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const k = y * img.w + x;
      const ci = colorOf[k];
      if (ci < 0 || seen[k]) continue;
      seen[k] = 1;
      stack.push([x, y]);
      let minX = x, maxX = x, minY = y, maxY = y, cnt = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cnt++;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
          const nk = ny * img.w + nx;
          if (seen[nk] || colorOf[nk] !== ci) continue;
          seen[nk] = 1;
          stack.push([nx, ny]);
        }
      }
      // Drop full-width/tall UI bands (field boundaries / scanline) — the
      // sprites are compact boxes.
      if (cnt > 800 && (maxX - minX + 1) < img.w * 0.5 && (maxY - minY + 1) < img.h * 0.5) {
        regions.push({ name: names[ci], minX, maxX, minY, maxY, cnt });
      }
    }
  }
  return regions;
}

function spansOf(img, reg) {
  const inC = (x, y) => {
    const i = (y * img.w + x) * 4;
    return nearestTarget(img.data[i], img.data[i + 1], img.data[i + 2]) === reg.name;
  };
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
  const topRows = [], botRows = [];
  const topY = reg.minY, botY = reg.maxY;
  const rowSpan = (y) => {
    let lo = -1, hi = -1;
    for (let x = reg.minX; x <= reg.maxX; x++) {
      if (inC(x, y)) { if (lo < 0) lo = x; hi = x; }
    }
    return lo >= 0 ? { w: hi - lo + 1, cx: (lo + hi) / 2 } : null;
  };
  for (let y = topY; y <= Math.min(img.h - 1, topY + Math.max(1, Math.round((reg.maxY - reg.minY) * 0.12))); y++) {
    const r = rowSpan(y);
    if (r) topRows.push(r.w);
  }
  for (let y = botY; y >= Math.max(0, botY - Math.max(1, Math.round((reg.maxY - reg.minY) * 0.12))); y--) {
    const r = rowSpan(y);
    if (r) botRows.push(r.w);
  }
  const edgeLen = (side) => {
    let rows = 0, n = 0;
    const x0 = side === 'left' ? reg.minX : reg.maxX;
    const x1 = side === 'left' ? reg.minX + Math.max(0, Math.round((reg.maxX - reg.minX) * 0.12)) : reg.maxX - Math.max(0, Math.round((reg.maxX - reg.minX) * 0.12));
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      let lo = -1, hi = -1;
      for (let y = reg.minY; y <= reg.maxY; y++) {
        if (inC(x, y)) { if (lo < 0) lo = y; hi = y; }
      }
      if (lo >= 0) { rows += hi - lo + 1; n++; }
    }
    return n ? Math.round(rows / n) : 0;
  };
  const topCX = rowSpan(topY + Math.max(0, Math.round((reg.maxY - reg.minY) * 0.1))).cx;
  const botCX = rowSpan(botY - Math.max(0, Math.round((reg.maxY - reg.minY) * 0.1))).cx;
  return {
    top: Math.round(avg(topRows)),
    bottom: Math.round(avg(botRows)),
    left: edgeLen('left'),
    right: edgeLen('right'),
    axisDx: Math.round(botCX - topCX),
    box: [reg.minX, reg.minY, reg.maxX, reg.maxY],
  };
}

for (const [label, file] of [['SELF(preview)', SELF], ['ENGINE(real)', ENGINE]]) {
  try {
    const img = decodePng(file);
    const regions = analyze(img);
    console.log('=== ' + label + ' (' + img.w + 'x' + img.h + ')');
    for (const r of regions) {
      const s = spansOf(img, r);
      const cx = Math.round((r.minX + r.maxX) / 2);
      const cy = Math.round((r.minY + r.maxY) / 2);
      console.log(`  ${r.name.padEnd(8)} center=(${String(cx).padStart(4)},${String(cy).padStart(3)}) top=${s.top} bottom=${s.bottom} left=${s.left} right=${s.right} axisDx=${s.axisDx} dir=${s.top > s.bottom ? 'TOP-WIDER' : (s.top < s.bottom ? 'BOTTOM-WIDER' : 'FLAT')}`);
    }
  } catch (e) {
    console.log('=== ' + label + ' ERROR: ' + e.message);
  }
}
