const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const file = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion/line.png';
const b = fs.readFileSync(file);
const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
const bitDepth = b[24], colorType = b[25];
const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
console.log('size:', w, 'x', h, 'bitDepth', bitDepth, 'colorType', colorType, 'channels', channels);
// Find IDAT
let pos = 8, idat = [];
while (pos < b.length) {
  const len = b.readUInt32BE(pos);
  const type = b.toString('ascii', pos + 4, pos + 8);
  if (type === 'IDAT') idat.push(b.slice(pos + 8, pos + 8 + len));
  pos += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(idat));
const bpp = channels;
const stride = w * bpp;
// Unfilter scanlines (filters 0-4)
const pixels = Buffer.alloc(h * stride);
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
};
for (let y = 0; y < h; y++) {
  const f = raw[y * (stride + 1)];
  const row = pixels.slice(y * stride, (y + 1) * stride);
  const prev = y > 0 ? pixels.slice((y - 1) * stride, y * stride) : null;
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? row[x - bpp] : 0;
    const b = prev ? prev[x] : 0;
    const c = x >= bpp && prev ? prev[x - bpp] : 0;
    let v = raw[y * (stride + 1) + 1 + x];
    if (f === 1) v = (v + a) & 0xff;
    else if (f === 2) v = (v + b) & 0xff;
    else if (f === 3) v = (v + Math.floor((a + b) / 2)) & 0xff;
    else if (f === 4) v = (v + paeth(a, b, c)) & 0xff;
    row[x] = v;
  }
}
let minY = h, maxY = -1, minX = w, maxX = -1, alphaRows = [];
for (let y = 0; y < h; y++) {
  let rowAlpha = 0;
  for (let x = 0; x < w; x++) {
    const o = y * stride + x * bpp;
    const a = pixels[o + 3];
    if (a > 10) { rowAlpha++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  alphaRows.push(rowAlpha);
}
console.log('alpha bbox: x', minX, '..', maxX, ' y', minY, '..', maxY);
const rowsWithAlpha = alphaRows.filter(a => a > 0).length;
console.log('rows with alpha:', rowsWithAlpha, 'sum alpha px:', alphaRows.reduce((s, a) => s + a, 0));
for (const y of [123, 126, 150, 180, 187]) console.log('row', y, 'alpha px:', alphaRows[y]);
console.log('rows 120..190 alpha:', JSON.stringify(alphaRows.slice(120, 191).map((a, i) => a > 0 ? 120 + i + ':' + a : null).filter(Boolean)));
// Row alpha density around the visible area
const dense = [];
for (let y = 0; y < h; y += 9) dense.push({ y, a: alphaRows[y] });
console.log('row density (every 9):', JSON.stringify(dense));
