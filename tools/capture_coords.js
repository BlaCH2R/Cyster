// capture_coords.js — screenshot after the coordinate fixes for visual QA.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  const out = await win.webContents.executeJavaScript(`(async () => {
    const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
    const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
    await new Promise(r => setTimeout(r, 300));
    const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
    items.find(el => el.textContent.indexOf('extreme') >= 0).click();
    await promise;
    await new Promise(r => setTimeout(r, 1500));
    return true;
  })()`);
  if (!out) process.exit(1);
  for (const t of [5, 60, 120]) {
    await win.webContents.executeJavaScript(`window.__sb.setTime(${t}, false)`);
    await new Promise((r) => setTimeout(r, 700));
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'shots', `shot_coords_${t}.png`), img.toPNG());
  }
  console.log('captured');
  app.exit(0);
});
