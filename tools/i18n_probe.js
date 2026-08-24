// 国际化探针：验证语言切换（简体/繁体/英文）对静态菜单、toast、schema 标签生效。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_i18n_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'i18n_probe_out.json');
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
        '!!window.SBi18n && document.body.classList.contains("welcome-mode")');
      if (ready) break;
      await sleep(100);
    }

    const js = async (code) => {
      const r = await mainWin.webContents.executeJavaScript(
        `(async () => { try { const v = await (async () => { ${code} })(); return { ok: true, v }; } catch (e) { return { ok: false, e: String(e) }; } })()`);
      if (!r.ok) throw new Error('renderer: ' + r.e);
      return r.v;
    };

    const menuText = (zh) => js(`const el = document.querySelector('[data-i18n="${zh}"]'); return el ? el.textContent.trim() : null;`);

    // 默认简体
    res.defaultLang = await js('return window.SBi18n.getLanguage();');
    res.zhFile = await menuText('文件');

    // 英文：静态菜单 + schema 标签 + toast
    await js('window.SBi18n.setLanguage("en", false); window.SBi18n.applyStatic(document); window.SBi18n.localizeSchema(); return true;');
    res.enFile = await menuText('文件');
    res.enNewProject = await js('return document.getElementById("btnWelcomeNew").textContent.trim();');
    res.enOpacity = await js('const f = (window.SBSchema.SCHEMAS.sprite.fields || []).find((x) => x.key === "opacity"); return f ? f.label : null;');
    await js('window.__sb.undo(); return true;');
    await sleep(100);
    res.enUndoToast = await js('const ts = document.querySelectorAll("#toastWrap .toast"); return ts.length ? ts[ts.length - 1].textContent : null;');

    // 繁体：OpenCC 运行时转换
    await js('window.SBi18n.setLanguage("zh-TW", false); window.SBi18n.applyStatic(document); window.SBi18n.localizeSchema(); return true;');
    res.twFile = await menuText('文件');
    res.twNewProject = await js('return document.getElementById("btnWelcomeNew").textContent.trim();');
    res.twOpacity = await js('const f = (window.SBSchema.SCHEMAS.sprite.fields || []).find((x) => x.key === "opacity"); return f ? f.label : null;');

    // 持久化：写回 settings
    await js('window.SBi18n.setLanguage("en", true); return true;');
    await sleep(200);
    res.savedLang = await js('return window.sbAPI.getSettings().then((s) => (s || {}).language);');

    // 断言
    if (res.defaultLang !== 'zh-CN') throw new Error('默认语言异常: ' + res.defaultLang);
    if (res.enFile !== 'File' || res.enNewProject !== 'New project') throw new Error('英文静态文本未生效: ' + JSON.stringify({ f: res.enFile, n: res.enNewProject }));
    if (res.enOpacity !== 'Opacity') throw new Error('英文 schema 未生效: ' + res.enOpacity);
    if (res.enUndoToast !== 'Nothing to undo') throw new Error('英文 toast 未生效: ' + res.enUndoToast);
    if (res.twFile !== '檔案' || res.twNewProject !== '新建專案') throw new Error('繁体转换未生效: ' + JSON.stringify({ f: res.twFile, n: res.twNewProject }));
    if (res.twOpacity !== '不透明度') throw new Error('繁体 schema 未生效: ' + res.twOpacity);
    if (res.savedLang !== 'en') throw new Error('语言未持久化: ' + res.savedLang);
    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
