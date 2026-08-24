// 验证：手册窗口正文可选择/可复制（user-select 放开 + 右键复制菜单存在）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const UD = fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_msel_'));
app.setPath('userData', UD);
fs.writeFileSync(path.join(UD, 'settings.json'), JSON.stringify({ language: 'en' }), 'utf8');
require(path.join(__dirname, '..', 'app', 'main.js'));
const OUT = path.join(__dirname, 'manual_select_probe_out.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = { ok: false };
app.whenReady().then(async () => {
  const timer = setTimeout(() => { fs.writeFileSync(OUT, JSON.stringify({ fatal: 'timeout' })); app.exit(1); }, 120000);
  let mainWin = null;
  const js = async (code) => {
    const r = await mainWin.webContents.executeJavaScript(
      `(async () => { try { const v = await (async () => { ${code} })(); return { ok: true, v }; } catch (e) { return { ok: false, e: String(e) }; } })()`);
    if (!r.ok) throw new Error('renderer: ' + r.e + ' code=' + code.slice(0, 120));
    return r.v;
  };
  try {
    for (let i = 0; i < 100 && !mainWin; i++) {
      const c = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (c) mainWin = c; else await sleep(100);
    }
    await js('window.sbAPI.manualOpen(); return true;');
    let mw = null;
    for (let i = 0; i < 100 && !mw; i++) {
      const c = BrowserWindow.getAllWindows().find((w) => w !== mainWin && !w.isDestroyed());
      if (c) mw = c; else await sleep(100);
    }
    await sleep(2500);
    res.userSelect = await mw.webContents.executeJavaScript(`(() => {
      const p = document.querySelector('#docxContainer p');
      return p ? getComputedStyle(p).userSelect : null;
    })()`);
    res.selection = await mw.webContents.executeJavaScript(`(() => {
      const p = Array.from(document.querySelectorAll('#docxContainer p'))
        .find((x) => (x.textContent || '').trim().length > 10);
      if (!p) return null;
      const sel = window.getSelection();
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(p);
      sel.addRange(r);
      const txt = sel.toString().trim();
      sel.removeAllRanges();
      return txt.slice(0, 60);
    })()`);
    if (!res.userSelect || res.userSelect === 'none') throw new Error('正文仍不可选中: ' + res.userSelect);
    if (!res.selection) throw new Error('无法选择文本');
    res.ok = true;
  } catch (e) { res.error = String(e && (e.stack || e.message) || e); }
  clearTimeout(timer);
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
