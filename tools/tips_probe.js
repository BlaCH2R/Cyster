// 完整应用探针：验证欢迎页内置 Tips 小浮窗。
// 随机展示一条 → 点「换一条」随机切换到另一条（连续不重复）→ 截图。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_tips_pw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'tips_probe_out.json');
const SHOT = path.join(__dirname, 'tips_probe_shot.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const hardTimer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: 'timeout' }));
    app.exit(1);
  }, 150000);
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
        'document.body.classList.contains("welcome-mode") && !!document.getElementById("welcomeTip")');
      if (ready) break;
      await sleep(100);
    }

    const snap = () => mainWin.webContents.executeJavaScript(`(() => {
      const box = document.getElementById('welcomeTip');
      const title = document.getElementById('welcomeTipTitle');
      const body = document.getElementById('welcomeTipBody');
      const tips = window.CYSTER_TIPS || [];
      return {
        tips: tips.length,
        visible: !!box && getComputedStyle(box).display !== 'none',
        title: title ? title.textContent : null,
        body: body ? body.textContent : null,
        btnText: document.getElementById('btnTipNext') ? document.getElementById('btnTipNext').textContent.trim() : null,
        matches: tips.some((t) => t.title === (title ? title.textContent : '') &&
          t.body === (body ? body.textContent : ''))
      };
    })()`);

    const first = await snap();
    res.tipsTotal = first.tips;
    res.firstVisible = first.visible;
    res.firstTitle = first.title;
    res.firstBtn = first.btnText;
    res.firstMatches = first.matches;
    if (first.tips !== 93 || !first.visible || !first.matches || first.btnText !== '换一条') {
      throw new Error('初始 Tips 状态异常: ' + JSON.stringify(first));
    }

    // 连续点「换一条」，验证每次内容随机且与上一条不同。
    const seen = [first.title + '|' + first.body];
    for (let k = 0; k < 8; k++) {
      await mainWin.webContents.executeJavaScript('document.getElementById("btnTipNext").click()');
      await sleep(80);
      const s = await snap();
      const cur = s.title + '|' + s.body;
      if (!s.visible || !s.matches) throw new Error('换一条后状态异常: ' + JSON.stringify(s));
      if (cur === seen[seen.length - 1]) throw new Error('连续两次展示同一条: ' + cur);
      seen.push(cur);
    }
    res.switchDistinct = seen.length;
    res.switchSamples = seen.slice(0, 4);

    // 回到编辑器再回欢迎页：应重新随机展示一条。
    await mainWin.webContents.executeJavaScript('document.querySelector(".brand").click()');
    await sleep(150);
    const afterHide = await mainWin.webContents.executeJavaScript(
      '!document.body.classList.contains("welcome-mode")');
    await mainWin.webContents.executeJavaScript('document.querySelector(".brand").click()');
    await sleep(150);
    const back = await snap();
    res.backVisible = back.visible;
    res.backMatches = back.matches;

    const img = await mainWin.webContents.capturePage();
    fs.writeFileSync(SHOT, img.toPNG());
    res.shot = path.basename(SHOT);
    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
