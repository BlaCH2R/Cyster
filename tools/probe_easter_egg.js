// Verify the easter egg: 10 clicks on the Cyster brand do nothing, the 11th
// shows the huge overlay (image + text + confirm), and 确认 closes it.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_egg_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_egg_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_egg_proj_'));
const CTR_PATH = path.join(TMP, 'Egg.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Egg',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');

  const out = await win.webContents.executeJavaScript(`(async () => {
    const brand = document.querySelector('.brand');
    for (let i = 0; i < 10; i++) brand.click();
    await new Promise((r) => setTimeout(r, 120));
    const after10 = !!document.getElementById('eggOverlay');
    brand.click();
    await new Promise((r) => setTimeout(r, 400));
    const overlay = document.getElementById('eggOverlay');
    const after11 = !!overlay;
    const img = overlay && overlay.querySelector('#eggImg');
    const imgOk = img && img.src.indexOf('data:image/png;base64,') === 0;
    const text = overlay ? overlay.textContent : '';
    const textOk = text.indexOf('恭喜你发现了彩蛋：Cyyysters!!') >= 0;
    const btnOk = !!overlay && !!overlay.querySelector('#eggConfirm');
    const canvasOk = !!overlay && !!overlay.querySelector('#eggCanvas');
    if (btnOk) overlay.querySelector('#eggConfirm').click();
    await new Promise((r) => setTimeout(r, 120));
    const closed = !document.getElementById('eggOverlay');
    return { after10, after11, imgOk, textOk, btnOk, canvasOk, closed };
  })()`);

  const result = {
    ...out,
    ok: out.after10 === false && out.after11 === true && out.imgOk === true &&
      out.textOk === true && out.btnOk === true && out.canvasOk === true && out.closed === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_easter_egg_out.json'), JSON.stringify(result, null, 2));
  console.log('EGG_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_easter_egg_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
