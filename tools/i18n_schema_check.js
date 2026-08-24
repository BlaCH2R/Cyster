// 检查 EN 模式下 schema（含 controller 卡片字段）标签翻译。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const UD = fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_ischema_'));
app.setPath('userData', UD);
fs.writeFileSync(path.join(UD, 'settings.json'), JSON.stringify({ language: 'en' }), 'utf8');
require(path.join(__dirname, '..', 'app', 'main.js'));
const OUT = path.join(__dirname, 'i18n_schema_check_out.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const res = { ok: false };
  try {
    let win = null;
    for (let i = 0; i < 100 && !win; i++) {
      const c = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (c) win = c; else await sleep(100);
    }
    await sleep(500);
    res.controllerFields = await win.webContents.executeJavaScript(
      '(() => { const s = window.SBSchema; return s ? (s.SCHEMAS.controller.fields || []).slice(0, 20).map((f) => f.label) : null; })()');
    res.cardLabels = await win.webContents.executeJavaScript(
      '(() => { const s = window.SBSchema; return s ? (s.CONTROLLER_CARDS || []).slice(0, 10).map((c) => c.label) : null; })()');
    res.renderedCards = await win.webContents.executeJavaScript(`(() => {
      const s = window.SBSchema;
      if (!s) return null;
      const el = document.createElement('div');
      document.body.appendChild(el);
      s.renderControllerCards(el, s.SCHEMAS.controller, {}, () => {}, true, { enabledOnly: false, showUnset: false });
      const out = el.textContent.slice(0, 500);
      el.remove();
      return out;
    })()`);
    res.ok = true;
  } catch (e) { res.error = String(e); }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
