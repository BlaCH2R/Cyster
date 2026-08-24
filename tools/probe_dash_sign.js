// Deterministic check of canvas lineDashOffset sign -> dash flow direction.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dash_')));
app.whenReady().then(async () => {
  const { BrowserWindow } = require('electron');
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('about:blank');
  const out = await win.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 20;
    const ctx = c.getContext('2d');
    const run = (offset) => {
      ctx.clearRect(0, 0, 400, 20);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.lineDashOffset = offset;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(400, 10);
      ctx.stroke();
      const img = ctx.getImageData(0, 0, 400, 20).data;
      // first run start + second run start
      const starts = [];
      let inDash = false;
      for (let x = 0; x < 400; x++) {
        const bright = img[(10 * 400 + x) * 4] > 200;
        if (!inDash && bright) starts.push(x);
        inDash = bright;
      }
      return starts.slice(0, 2);
    };
    return { zero: run(0), plus5: run(5), minus5: run(-5) };
  })()`);
  console.log('DASH:', JSON.stringify(out));
  // With offset +f, the dash pattern starts f px EARLIER on the path => runs
  // shift toward smaller x (left) if the path goes left->right.
  const leftward = out.plus5[0] < out.zero[0] && out.minus5[0] > out.zero[0];
  console.log(leftward ? 'PASS: +offset slides LEFT' : 'FAIL sign semantics',
    ':: zero=', out.zero, 'plus=', out.plus5, 'minus=', out.minus5);
  win.destroy();
  app.exit(0);
});
