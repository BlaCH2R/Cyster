// 复现用户场景：默认简体启动 → 欢迎页下拉切英文 → 打开 controller 实时统计面板，
// 断言渲染出来的 DOM 无中文。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_livestats_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const OUT = path.join(__dirname, 'i18n_livestats_probe_out.json');
const DIR = 'V:/cytoid storyboarder/项目/实测：雪女/雪女';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = { ok: false };
app.whenReady().then(async () => {
  const timer = setTimeout(() => { fs.writeFileSync(OUT, JSON.stringify({ fatal: 'timeout' })); app.exit(1); }, 150000);
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
    // 加载雪女项目（含 controller）
    const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
    const chart = level.charts[0];
    const info = {
      level, levelDir: DIR,
      files: fs.readdirSync(DIR).map((n) => ({ name: n, size: fs.statSync(path.join(DIR, n)).size })),
      charts: [{
        type: chart.type, name: chart.name || '', difficulty: chart.difficulty, path: chart.path,
        content: fs.readFileSync(path.join(DIR, chart.path), 'utf8'),
        storyboardPath: chart.storyboard.path,
        storyboardContent: fs.readFileSync(path.join(DIR, chart.storyboard.path), 'utf8')
      }]
    };
    await js('await window.__sb.loadLevelInfo(' + JSON.stringify(info) + '); return true;');
    await sleep(2000);

    // 通过欢迎页下拉切到英文（用户路径）
    await js('const sel = document.getElementById("welcomeLang"); sel.value = "en"; sel.dispatchEvent(new Event("change", { bubbles: true })); return true;');
    await sleep(400);

    // 打开 controller 实时统计面板（预览空白处点击的等效路径）
    await js('window.__sb.state.previewEmptyFocus = true; window.__sb.refreshAll(); return true;');
    await sleep(500);

    res.lang = await js('return window.SBi18n.getLanguage();');
    res.panelText = await js('return document.getElementById("propBody") ? document.getElementById("propBody").innerText.slice(0, 2000) : null;');
    res.panelHasZh = /[\u4e00-\u9fff]/.test(res.panelText || '');
    // 逐个卡片标题检查
    res.cardTitles = await js(`return Array.from(document.querySelectorAll('#propBody .ctrl-card')).map((c) => {
      const t = c.querySelector('.ctrl-card-title');
      return t ? t.textContent.trim() : (c.textContent || '').slice(0, 20);
    }).slice(0, 12);`);
    res.zhCardTitles = await js(`return Array.from(document.querySelectorAll('#propBody .ctrl-card')).map((c) => {
      const t = c.querySelector('.ctrl-card-title');
      const s = t ? t.textContent.trim() : (c.textContent || '').slice(0, 20);
      return /[\\u4e00-\\u9fff]/.test(s) ? s : null;
    }).filter(Boolean);`);

    if (res.lang !== 'en') throw new Error('语言未切换: ' + res.lang);
    if (!res.panelText) throw new Error('controller 实时统计面板未渲染');
    if (res.panelHasZh) throw new Error('面板仍有中文: ' + res.panelText.slice(0, 300));
    res.ok = true;
  } catch (e) { res.error = String(e && (e.stack || e.message) || e); }
  clearTimeout(timer);
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
