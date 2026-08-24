// Verify clicking the brand shows the welcome page with content.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise(r => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  await new Promise(r => setTimeout(r, 800));
  const res = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    out.beforeClick = {
      bodyClass: document.body.className,
      welcomeDisplay: getComputedStyle(document.getElementById('welcome')).display
    };
    document.querySelector('.brand').click();
    out.syncAfterClick = {
      bodyClass: document.body.className,
      contains: document.body.classList.contains('welcome-mode')
    };
    window.__sb.showWelcome();
    out.afterManualShow = {
      bodyClass: document.body.className,
      contains: document.body.classList.contains('welcome-mode'),
      greeting: document.getElementById('welcomeGreeting').textContent
    };
    await new Promise(r => setTimeout(r, 200));
    const w = document.getElementById('welcome');
    const cs = getComputedStyle(w);
    out.bodyClass = document.body.className;
    out.containsWelcome = document.body.classList.contains('welcome-mode');
    out.welcomeDisplay = getComputedStyle(w).display;
    out.greeting = document.getElementById('welcomeGreeting') ? document.getElementById('welcomeGreeting').textContent : null;
    out.actions = Array.from(document.querySelectorAll('#welcome .w-btn')).map(b => b.textContent.trim());
    out.recentVisible = !!document.getElementById('recentProjects');
    out.mainDisplay = getComputedStyle(document.getElementById('main')).display;
    out.timelineDisplay = getComputedStyle(document.getElementById('timeline')).display;
    const g = document.getElementById('welcomeGreeting');
    const gr = g ? g.getBoundingClientRect() : null;
    out.greetingRect = gr ? { x: Math.round(gr.x), y: Math.round(gr.y), w: Math.round(gr.width), h: Math.round(gr.height) } : null;
    const gc = gr ? getComputedStyle(g) : null;
    out.greetingStyle = gc ? { color: gc.color, display: gc.display, visibility: gc.visibility } : null;
    const nb = document.getElementById('btnWelcomeNew');
    const nbr = nb ? nb.getBoundingClientRect() : null;
    out.newBtnRect = nbr ? { x: Math.round(nbr.x), y: Math.round(nbr.y), w: Math.round(nbr.width), h: Math.round(nbr.height) } : null;
    const ws = document.querySelector('.welcome-scroll');
    const wsr = ws ? ws.getBoundingClientRect() : null;
    out.scrollRect = wsr ? { x: Math.round(wsr.x), y: Math.round(wsr.y), w: Math.round(wsr.width), h: Math.round(wsr.height) } : null;
    return out;
  })()`);
  console.log(JSON.stringify(res, null, 1));
  // Keep the welcome page open for external screenshot
  win.webContents.executeJavaScript(`window.__sb.showWelcome()`).then(async () => {
    await new Promise(r => setTimeout(r, 400));
    try {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'shots', 'welcome.png'), img.toPNG());
      console.log('welcome screenshot saved');
    } catch (e) {
      console.log('shot err', String(e));
    }
    app.exit(0);
  });
});
