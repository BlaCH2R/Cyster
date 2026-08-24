// 临时诊断：EN 模式下手册里仍含中文的段落样本。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const UD = fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_i18ndbg_'));
app.setPath('userData', UD);
fs.writeFileSync(path.join(UD, 'settings.json'), JSON.stringify({ language: 'en' }), 'utf8');
require(path.join(__dirname, '..', 'app', 'main.js'));
const OUT = path.join(__dirname, 'i18n_manual_debug_out.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const res = { ok: false, zhParagraphs: [] };
  try {
    let mainWin = null;
    for (let i = 0; i < 100 && !mainWin; i++) {
      const c = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (c) mainWin = c; else await sleep(100);
    }
    const js = async (code) => {
      const r = await mainWin.webContents.executeJavaScript(
        `(async () => { try { const v = await (async () => { ${code} })(); return { ok: true, v }; } catch (e) { return { ok: false, e: String(e) }; } })()`);
      if (!r.ok) throw new Error('renderer: ' + r.e);
      return r.v;
    };
    await js('window.sbAPI.manualOpen(); return true;');
    let mw = null;
    for (let i = 0; i < 100 && !mw; i++) {
      const c = BrowserWindow.getAllWindows().find((w) => w !== mainWin && !w.isDestroyed());
      if (c) mw = c; else await sleep(100);
    }
    await sleep(3000);
    res.zhParagraphs = await mw.webContents.executeJavaScript(`(() => {
      const out = [];
      document.querySelectorAll('#docxContainer p').forEach((p) => {
        const t = (p.textContent || '').trim();
        if (t && /[\u4e00-\u9fff]/.test(t)) out.push(t.replace(/\\s+/g, ' '));
      });
      return out.slice(0, 40);
    })()`);
    res.count = await mw.webContents.executeJavaScript(
      'Array.from(document.querySelectorAll("#docxContainer p")).filter((p) => /[\\u4e00-\\u9fff]/.test(p.textContent || "")).length');
    res.ok = true;
  } catch (e) { res.error = String(e); }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
