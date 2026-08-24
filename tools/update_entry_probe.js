// 验证：检查更新入口已从欢迎页移到「设置」选项卡；欢迎页 GitHub 链接指向 Cyster 仓库。
const { app, BrowserWindow } = require('electron');
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_updentry_')));
global.__ghUrl = null;
shell.openExternal = (url) => { global.__ghUrl = url; return Promise.resolve(); };
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'update_entry_probe_out.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const hardTimer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: 'timeout' }));
    app.exit(1);
  }, 120000);
  const res = { ok: false, error: null };
  try {
    let mainWin = null;
    for (let i = 0; i < 100 && !mainWin; i++) {
      const cand = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (cand) mainWin = cand;
      else await sleep(100);
    }
    if (!mainWin) throw new Error('主窗口未创建');
    for (let i = 0; i < 100; i++) {
      const ready = await mainWin.webContents.executeJavaScript(
        'document.body.classList.contains("welcome-mode") && !!window.__sb');
      if (ready) break;
      await sleep(100);
    }

    res.welcomeUpdateButton = await mainWin.webContents.executeJavaScript(
      '!!document.getElementById("btnWelcomeUpdate")');
    res.settingsEntry = await mainWin.webContents.executeJavaScript(
      '(() => { const el = document.querySelector(".menu-entry[data-action=\\"check-update\\"]"); return el ? el.textContent.trim() : null; })()');

    // 点击设置里的「检查更新」：开发模式应提示不检查。
    await mainWin.webContents.executeJavaScript(
      'document.querySelector(".menu-entry[data-action=\\"check-update\\"]").click()');
    await sleep(300);
    res.updateToast = await mainWin.webContents.executeJavaScript(`(() => {
      const ts = document.querySelectorAll('#toastWrap .toast');
      return ts.length ? ts[ts.length - 1].textContent : null;
    })()`);

    // 欢迎页 GitHub 链接：主进程拦截 shell.openExternal 后点击，验证 URL。
    await mainWin.webContents.executeJavaScript('document.getElementById("welcomeGh").click()');
    await sleep(200);
    res.ghUrl = global.__ghUrl;

    if (res.welcomeUpdateButton) throw new Error('欢迎页仍存在检查更新按钮');
    if (res.settingsEntry !== '检查更新') throw new Error('设置菜单缺少检查更新入口');
    if (!res.updateToast || !/开发模式/.test(res.updateToast)) {
      throw new Error('检查更新点击无响应: ' + res.updateToast);
    }
    if (res.ghUrl !== 'https://github.com/BlaCH2R/Cyster') {
      throw new Error('GitHub 链接错误: ' + res.ghUrl);
    }
    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
