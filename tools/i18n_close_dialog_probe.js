// 验证：EN 模式下「有未保存的修改」关闭确认弹窗可正常操作（按钮点击生效、能退出）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const UD = fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_closedlg_'));
app.setPath('userData', UD);
fs.writeFileSync(path.join(UD, 'settings.json'), JSON.stringify({ language: 'en' }), 'utf8');
require(path.join(__dirname, '..', 'app', 'main.js'));
const OUT = path.join(__dirname, 'i18n_close_dialog_probe_out.json');
const DIR = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = { ok: false };
app.whenReady().then(async () => {
  const timer = setTimeout(() => { fs.writeFileSync(OUT, JSON.stringify({ fatal: 'timeout' })); app.exit(1); }, 120000);
  let win = null;
  const js = async (code) => {
    const r = await win.webContents.executeJavaScript(
      `(async () => { try { const v = await (async () => { ${code} })(); return { ok: true, v }; } catch (e) { return { ok: false, e: String(e) }; } })()`);
    if (!r.ok) throw new Error('renderer: ' + r.e + ' code=' + code.slice(0, 120));
    return r.v;
  };
  try {
    for (let i = 0; i < 100 && !win; i++) {
      const c = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (c) win = c; else await sleep(100);
    }
    for (let i = 0; i < 100; i++) {
      const ready = await js('return !!window.__sb && !!window.SBi18n && document.body.classList.contains("welcome-mode");');
      if (ready) break;
      await sleep(100);
    }
    // 加载测试项目并制造未保存修改
    const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
    const chart = level.charts[0];
    const info = {
      level, levelDir: DIR,
      files: fs.readdirSync(DIR).map((n) => ({ name: n, size: fs.statSync(path.join(DIR, n)).size })),
      charts: [{
        type: chart.type, name: chart.name || '', difficulty: chart.difficulty, path: chart.path,
        content: fs.readFileSync(path.join(DIR, chart.path), 'utf8'),
        storyboardPath: chart.storyboard ? chart.storyboard.path : 'storyboard_hard.json',
        storyboardContent: fs.readFileSync(path.join(DIR, chart.storyboard ? chart.storyboard.path : 'storyboard_hard.json'), 'utf8')
      }]
    };
    await js('await window.__sb.loadLevelInfo(' + JSON.stringify(info) + '); return true;');
    await sleep(1500);
    await js('window.__sb.state.dirty = true; return true;');

    // 拦截 close，避免真的退出进程
    let closeCalled = false;
    win.close = () => { closeCalled = true; };

    // 触发主窗口关闭确认流程
    win.webContents.send('app:confirm-close');
    await sleep(300);
    res.modal = await js(`const mask = document.getElementById('modalMask');
      if (!mask || mask.classList.contains('hidden')) return null;
      return {
        title: document.getElementById('modalTitle').textContent,
        body: document.getElementById('modalBody').innerText.slice(0, 160),
        buttons: Array.from(document.querySelectorAll('#modalFoot button')).map((b) => b.textContent)
      };`);
    if (!res.modal) throw new Error('关闭确认弹窗未出现');
    if (res.modal.title !== 'Unsaved changes') throw new Error('弹窗标题未翻译: ' + res.modal.title);
    if (/[\u4e00-\u9fff]/.test(res.modal.body)) throw new Error('弹窗正文仍有中文: ' + res.modal.body);

    // 点击「OK」（确认不保存退出）
    await js(`const b = Array.from(document.querySelectorAll('#modalFoot button')).find((x) => x.textContent === 'Confirm');
      if (b) b.click();
      return !!b;`);
    await sleep(300);
    res.closeCalled = closeCalled;
    if (!closeCalled) throw new Error('点击确认后未触发退出流程（按钮无反应/判断断裂）');

    // 再验证「Cancel」也能关闭弹窗且不触发退出
    win.webContents.send('app:confirm-close');
    await sleep(200);
    await js(`const b = Array.from(document.querySelectorAll('#modalFoot button')).find((x) => x.textContent === 'Cancel');
      if (b) b.click();
      return !!b;`);
    await sleep(200);
    res.maskHiddenAfterCancel = await js(
      'return document.getElementById("modalMask").classList.contains("hidden");');
    if (!res.maskHiddenAfterCancel) throw new Error('取消后弹窗未关闭');
    res.ok = true;
  } catch (e) { res.error = String(e && (e.stack || e.message) || e); }
  clearTimeout(timer);
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
