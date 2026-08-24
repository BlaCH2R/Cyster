// Compare the rotated note ring between self preview and real engine frames.
// Finds the largest colored note blob near the screen center and fits an
// ellipse via central second moments; the ellipse angle is the orientation
// metric that distinguishes the camera·note glyph composition.
// Usage: node note_rot_analyze.js [self.png] [engine.png]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SELF = process.argv[2] || path.join(__dirname, 'note_rot_self.png');
const ENGINE = process.argv[3] || path.join(__dirname, 'note_rot_engine.png');

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
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || data[12] !== 0) throw new Error('unsupported png');
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

function noteBlob(img) {
  // Click-note pixels: bright/colored (fill or ring) on the dark field,
  // near the screen center. Collect pixels whose luminance is clearly above
  // the black background.
  const pts = [];
  const cx = img.w / 2, cy = img.h / 2;
  const win = Math.min(img.w, img.h) * 0.45;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const d = (y * img.w + x) * 4;
      const r = img.data[d], g = img.data[d + 1], b = img.data[d + 2], a = img.data[d + 3];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (a > 60 && lum > 80 && Math.abs(x - cx) < win && Math.abs(y - cy) < win) {
        pts.push([x, y]);
      }
    }
  }
  if (pts.length < 50) return null;
  // Largest connected component.
  const set = new Set(pts.map((p) => p[1] * img.w + p[0]));
  let best = null;
  const seen = new Set();
  for (const p of pts) {
    const k = p[1] * img.w + p[0];
    if (seen.has(k)) continue;
    seen.add(k);
    const stack = [p];
    let comp = [];
    while (stack.length) {
      const [x, y] = stack.pop();
      comp.push([x, y]);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        const nk = ny * img.w + nx;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen.has(nk) || !set.has(nk)) continue;
        seen.add(nk);
        stack.push([nx, ny]);
      }
    }
    if (comp.length > (best ? best.length : 0)) best = comp;
  }
  return best;
}

function dumpBlobs(img, label, minLum) {
  console.log('=== ' + label + ' (' + img.w + 'x' + img.h + ') bright blobs ===');
  const set = new Set();
  const isBright = (x, y) => {
    const d = (y * img.w + x) * 4;
    const r = img.data[d], g = img.data[d + 1], b = img.data[d + 2], a = img.data[d + 3];
    return a > 40 && (0.299 * r + 0.587 * g + 0.114 * b) > minLum;
  };
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!isBright(x, y)) continue;
      const k = y * img.w + x;
      if (set.has(k)) continue;
      set.add(k);
      const stack = [[x, y]];
      let comp = [], minX = x, maxX = x, minY = y, maxY = y;
      let rS = 0, gS = 0, bS = 0;
      while (stack.length) {
        const [cx2, cy2] = stack.pop();
        const d = (cy2 * img.w + cx2) * 4;
        rS += img.data[d]; gS += img.data[d + 1]; bS += img.data[d + 2];
        comp.push([cx2, cy2]);
        if (cx2 < minX) minX = cx2; if (cx2 > maxX) maxX = cx2;
        if (cy2 < minY) minY = cy2; if (cy2 > maxY) maxY = cy2;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx2 + dx, ny = cy2 + dy;
          const nk = ny * img.w + nx;
          if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || set.has(nk) || !isBright(nx, ny)) continue;
          set.add(nk);
          stack.push([nx, ny]);
        }
      }
      if (comp.length > 120) {
        const n = comp.length;
        console.log(`  center=(${Math.round((minX + maxX) / 2)},${Math.round((minY + maxY) / 2)}) box=${minX},${minY},${maxX},${maxY} n=${n} rgb=(${Math.round(rS / n)},${Math.round(gS / n)},${Math.round(bS / n)})`);
      }
    }
  }
}

function ellipse(pts) {
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const mx = sx / pts.length, my = sy / pts.length;
  let m20 = 0, m02 = 0, m11 = 0;
  for (const [x, y] of pts) {
    const dx = x - mx, dy = y - my;
    m20 += dx * dx; m02 += dy * dy; m11 += dx * dy;
  }
  m20 /= pts.length; m02 /= pts.length; m11 /= pts.length;
  const theta = 0.5 * Math.atan2(2 * m11, m20 - m02) * 180 / Math.PI;
  const trace = m20 + m02;
  const det = m20 * m02 - m11 * m11;
  const disc = Math.sqrt(Math.max(0, (m20 - m02) * (m20 - m02) + 4 * m11 * m11));
  const l1 = (trace + disc) / 2, l2 = Math.max(0.0001, (trace - disc) / 2);
  return {
    center: [Math.round(mx), Math.round(my)],
    angle: +theta.toFixed(1),
    major: +Math.sqrt(l1).toFixed(1),
    minor: +Math.sqrt(l2).toFixed(1),
    count: pts.length,
  };
}

for (const [label, file] of [['SELF(preview)', SELF], ['ENGINE(real)', ENGINE]]) {
  try {
    const img = decodePng(file);
    dumpBlobs(img, label, label.indexOf('ENGINE') >= 0 ? 45 : 90);
    const blob = noteBlob(img);
    if (!blob) { console.log(label + ': no note blob found'); continue; }
    console.log(label + ': ' + JSON.stringify(ellipse(blob)));
  } catch (e) {
    console.log(label + ' ERROR: ' + e.message);
  }
}
