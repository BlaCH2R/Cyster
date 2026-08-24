const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  await new Promise(r => setTimeout(r, 800));
  // Step 1: call chooseChart, store promise
  const step1 = await win.webContents.executeJavaScript(`(() => {
    const charts = [
      { type: 'easy', path: 'a', difficulty: 2 },
      { type: 'hard', path: 'b', difficulty: 10, musicOverride: 'm2.ogg' }
    ];
    const p = window.__sb.chooseChart(charts);
    window.__chosenResult = null;
    p.then(c => { window.__chosenResult = c; });
    return {
      hasChoose: typeof window.__sb.chooseChart === 'function',
      modalShown: !document.getElementById('modalMask').classList.contains('hidden'),
      items: Array.from(document.querySelectorAll('#modalBody .pick-item')).map(i => i.textContent)
    };
  })()`);
  console.log('STEP1:', JSON.stringify(step1));
  // Step 2: click the second item
  const step2 = await win.webContents.executeJavaScript(`(() => {
    const items = document.querySelectorAll('#modalBody .pick-item');
    if (items.length >= 2) {
      items[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    return { clicked: items.length, modalHidden: document.getElementById('modalMask').classList.contains('hidden') };
  })()`);
  console.log('STEP2:', JSON.stringify(step2));
  await new Promise(r => setTimeout(r, 300));
  const step3 = await win.webContents.executeJavaScript(`(() => {
    const c = window.__chosenResult;
    return c ? { type: c.type, music: c.musicOverride } : null;
  })()`);
  console.log('STEP3:', JSON.stringify(step3));
  app.exit(0);
});
