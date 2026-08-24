// 验证：切语言 → 未保存确认（取消/不保存）→ 自动重启流程。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
let relaunchCalled = false, exitCalled = false;
const origExit = app.exit.bind(app);
app.relaunch = () => { relaunchCalled = true; };
app.exit = () => { exitCalled = true; };
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_rlang_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const OUT = path.join(__dirname, 'i18n_restart_probe_out.json');
const DIR = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = { ok: false };
app.whenReady().then(async () => {
  const timer = setTimeout(() => { fs.writeFileSync(OUT, JSON.stringify({ fatal: 'timeout' })); origExit(1); }, 120000);
  let win = null;
  const js = async (code) => {
    const r = await win.webContents.executeJavaScript(
      `(async () => { try { const v = await (async () => { ${code} })(); return { ok: true, v }; } catch (e) { return { ok: false, e: String(e) }; } })()`);
    if (!r.ok) throw new Error('renderer: ' + r.e + ' code=' + code.slice(0, 120));
    return r.v;
  };
  const switchLang = (lang) => js(`const sel = document.getElementById("welcomeLang"); sel.value = "${lang}"; sel.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
  const modalState = () => js(`const mask = document.getElementById('modalMask');
    if (!mask || mask.classList.contains('hidden')) return null;
    return {
      title: document.getElementById('modalTitle').textContent,
      buttons: Array.from(document.querySelectorAll('#modalFoot button')).map((b) => b.textContent)
    };`);
  const clickBtn = (label) => js(`const b = Array.from(document.querySelectorAll('#modalFoot button')).find((x) => x.textContent === "${label}");
    if (b) b.click(); return !!b;`);
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
    // 加载项目并制造未保存修改
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
    // 关闭可能的「检测到谱面变更」警告
    await clickBtn('知道了').catch(() => false);
    await sleep(200);
    await js('window.__sb.state.projectPath = "V:/test/test.ctr"; return true;');
    await js('window.__sb.state.dirty = true; return true;');

    // 场景1：有未保存修改，先取消 → 不重启、语言不变
    await switchLang('en');
    await sleep(300);
    res.dialog1 = await modalState();
    if (!res.dialog1 || res.dialog1.title !== '有未保存的修改') throw new Error('未弹出未保存确认: ' + JSON.stringify(res.dialog1));
    await clickBtn('取消');
    await sleep(200);
    res.cancelRel = relaunchCalled;
    res.cancelLang = await js('return window.SBi18n.getLanguage();');
    if (relaunchCalled) throw new Error('取消后不应重启');
    if (res.cancelLang !== 'zh-CN') throw new Error('取消后语言不应变更: ' + res.cancelLang);

    // 场景2：有未保存修改，点「不保存」→ 持久化并重启
    await switchLang('en');
    await sleep(300);
    await clickBtn('不保存');
    await sleep(500);
    res.confirmRel = relaunchCalled;
    res.confirmExit = exitCalled;
    if (!relaunchCalled || !exitCalled) throw new Error('确认后未触发重启: relaunch=' + relaunchCalled + ' exit=' + exitCalled);
    res.persisted = await js('return window.sbAPI.getSettings().then((s) => (s || {}).language);');
    if (res.persisted !== 'en') throw new Error('语言未持久化: ' + res.persisted);

    // 场景3：无未保存修改 → 直接重启（无确认框）
    relaunchCalled = false; exitCalled = false;
    await js('window.__sb.state.dirty = false; return true;');
    await switchLang('zh-TW');
    await sleep(500);
    res.noDirtyDialog = await modalState();
    res.noDirtyRel = relaunchCalled;
    if (relaunchCalled !== true) throw new Error('无未保存修改时未直接重启');
    res.ok = true;
  } catch (e) { res.error = String(e && (e.stack || e.message) || e); }
  clearTimeout(timer);
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  origExit(res.ok ? 0 : 1);
});
