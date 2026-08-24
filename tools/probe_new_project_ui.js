// Probe: launches the real app and opens the "新建项目" modal from the welcome
// page. Verifies the page now has a 关卡ID input and no difficulty select.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_np_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_new_project_ui_out.json");

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 120000);
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await new Promise((r) => setTimeout(r, 600));
    const out = await win.webContents.executeJavaScript(`(() => {
      try {
        const btn = document.getElementById('btnWelcomeNew');
        if (!btn) return { error: 'welcome button missing' };
        btn.click();
        const body = document.getElementById('modalBody');
        const html = body ? body.innerHTML : '';
        return {
          modalOpen: !!body && !document.getElementById('modalMask').classList.contains('hidden'),
          hasLevelId: html.indexOf('id="pjLevelId"') >= 0 && html.indexOf('关卡ID') >= 0,
          hasDifficultySelect: html.indexOf('id="pjDifficulty"') >= 0,
          hasLevelIdHint: html.indexOf('只包含小写字母、数字、下划线、短横杠和点') >= 0
        };
      } catch (e) {
        return { error: String(e && e.stack || e) };
      }
    })()`);
    if (out.error) throw new Error(out.error);
    out.ok = out.modalOpen && out.hasLevelId && !out.hasDifficultySelect && out.hasLevelIdHint;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(out && out.ok ? 0 : 1);
  }
});
