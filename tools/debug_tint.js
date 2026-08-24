// Minimal experiment: does source-atop tinting turn circles into squares
// under this Electron (software GL) environment?
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise(r => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  for (let i = 0; i < 20; i++) {
    try {
      const ready = await win.webContents.executeJavaScript(`!!window.sbAPI && !!document.querySelector('#previewCanvas')`);
      if (ready) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  const part1 = await win.webContents.executeJavaScript(`(() => {
    const out = {};
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.beginPath(); ctx.arc(100, 100, 70, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
    let img = ctx.getImageData(0, 0, 200, 200);
    const g = (x, y) => [img.data[(y * 200 + x) * 4], img.data[(y * 200 + x) * 4 + 1], img.data[(y * 200 + x) * 4 + 2]];
    out.plainCircle = { corner: g(5, 5), topEdge: g(100, 30), center: g(100, 100), side: g(160, 100) };
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgb(106,106,106)';
    ctx.fillRect(0, 0, 200, 200);
    ctx.globalCompositeOperation = 'source-over';
    img = ctx.getImageData(0, 0, 200, 200);
    const g2 = (x, y) => [img.data[(y * 200 + x) * 4], img.data[(y * 200 + x) * 4 + 1], img.data[(y * 200 + x) * 4 + 2]];
    out.afterSourceAtop = { corner: g2(5, 5), topEdge: g2(100, 30), center: g2(100, 100), side: g2(160, 100), cornerInside: g2(30, 30) };
    return out;
  })()`);
  console.log('PART1:', JSON.stringify(part1));
  const part2 = await win.webContents.executeJavaScript(`(async () => {
    const res2 = await window.sbAPI.getAsset('player/note_fill.png');
    const buf = Uint8Array.from(atob(res2.data), c => c.charCodeAt(0));
    const blob = new Blob([buf], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const im = new Image();
    await new Promise((res3, rej) => { im.onload = res3; im.onerror = rej; im.src = url; });
    const out = { width: im.naturalWidth, height: im.naturalHeight };
    const c2 = document.createElement('canvas');
    c2.width = 200; c2.height = 200;
    const x2 = c2.getContext('2d');
    x2.drawImage(im, 20, 20, 160, 160);
    x2.globalCompositeOperation = 'source-atop';
    x2.fillStyle = 'rgb(106,106,106)';
    x2.fillRect(20, 20, 160, 160);
    x2.globalCompositeOperation = 'source-over';
    const img2 = x2.getImageData(0, 0, 200, 200);
    const g = (x, y) => [img2.data[(y * 200 + x) * 4], img2.data[(y * 200 + x) * 4 + 1], img2.data[(y * 200 + x) * 4 + 2]];
    out.tintResult = {
      corner: g(5, 5),
      rectCorner: g(25, 25),
      topEdge: g(100, 25),
      center: g(100, 100),
      side: g(175, 100)
    };
    return out;
  })()`);
  console.log('PART2:', JSON.stringify(part2));
  app.exit(0);
});
