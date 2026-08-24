// 完整应用探针：验证撤销/重做 toast 附带具体操作行为描述。
// 流程：打开测试项目 → 选中一个 Sprite 删除 → undo/redo，
// 断言提示分别为“已撤销：删除Sprite（#id）”和“已重做：删除Sprite（#id）”。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_undo_pw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'undo_desc_probe_out.json');
const DIR = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const chart = level.charts.find((c) => c.storyboard && c.storyboard.path === 'storyboard_base.json');
  return {
    level,
    levelDir: DIR,
    files: fs.readdirSync(DIR).map((n) => ({ name: n, size: fs.statSync(path.join(DIR, n)).size })),
    charts: [{
      type: chart.type,
      name: chart.name || '',
      difficulty: chart.difficulty,
      path: chart.path,
      content: fs.readFileSync(path.join(DIR, chart.path), 'utf8'),
      storyboardPath: chart.storyboard.path,
      storyboardContent: fs.readFileSync(path.join(DIR, chart.storyboard.path), 'utf8')
    }]
  };
}

app.whenReady().then(async () => {
  const hardTimer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: 'timeout' }));
    app.exit(1);
  }, 180000);
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
      const ready = await mainWin.webContents.executeJavaScript('!!window.__sb && !!document.getElementById("modalMask")');
      if (ready) break;
      await sleep(100);
    }

    // 直接加载带内容的 extreme 难度谱面（含 storyboard_base.json，单谱面不弹难度框）
    const info = buildInfo();
    await mainWin.webContents.executeJavaScript('window.__sb.loadLevelInfo(' + JSON.stringify(info) + ')');
    let objCount = 0;
    for (let i = 0; i < 200; i++) {
      objCount = await mainWin.webContents.executeJavaScript(`(() => {
        const sb = window.__sb.state.storyboard || {};
        const groups = ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers'];
        return groups.reduce((n, g) => n + (sb[g] || []).length, 0);
      })()`);
      if (objCount > 0) break;
      await sleep(100);
    }
    res.objCount = objCount;
    if (!objCount) throw new Error('谱面加载后没有对象');

    const lastToast = () => mainWin.webContents.executeJavaScript(`(() => {
      const ts = document.querySelectorAll('#toastWrap .toast');
      return ts.length ? ts[ts.length - 1].textContent : null;
    })()`);

    // 统一包装：渲染进程抛错时把错误文本带回来，而不是只给“Script failed”。
    const js = async (code) => {
      const r = await mainWin.webContents.executeJavaScript(
        `(async () => { try { return { ok: true, v: await (${code}) }; } catch (e) { return { ok: false, e: String((e && e.stack) || e) }; } })()`);
      if (!r.ok) throw new Error('renderer error: ' + r.e + ' code=' + code.slice(0, 140));
      return r.v;
    };

    // 空栈时撤销
    await mainWin.webContents.executeJavaScript('window.__sb.undo()');
    res.emptyUndoToast = await lastToast();

    // 选中第一个 Sprite 并删除
    const sel = await js(`(() => {
      const sb = window.__sb.state.storyboard || {};
      const groups = ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers'];
      let o = null;
      let chosen = null;
      for (const grp of groups) {
        if ((sb[grp] || []).length) { o = sb[grp][0]; chosen = grp; break; }
      }
      if (!o) return { error: '没有可操作的对象' };
      window.__sb.selectObject(String(o.id));
      return { id: String(o.id), group: chosen, groupCount: (window.__sb.state.storyboard[chosen] || []).length };
    })()`);
    if (sel.error) throw new Error(sel.error);
    res.spriteId = sel.id;
    res.spriteGroup = sel.group;
    await js('window.__sb.deleteSelection()');
    await sleep(150);
    const afterDelete = await js(
      'window.__sb.state.storyboard[' + JSON.stringify(sel.group) + '].length');
    res.afterDelete = afterDelete;
    if (afterDelete !== sel.groupCount - 1) {
      throw new Error('删除未生效: ' + afterDelete + ' vs ' + (sel.groupCount - 1));
    }
    const GROUP_LABEL = { sprites: 'Sprite', texts: 'Text', videos: 'Video', lines: 'Line', controllers: 'Controller', note_controllers: 'NoteCtrl' };
    const label = GROUP_LABEL[sel.group] || '对象';

    // 撤销：应提示“已撤销：删除Sprite（#id）”
    await js('window.__sb.undo()');
    await sleep(120);
    const undoToast = await lastToast();
    res.undoToast = undoToast;
    const expectUndo = '已撤销：删除' + label + '（' + sel.id + '）';
    if (undoToast !== expectUndo) {
      throw new Error('撤销提示异常: ' + undoToast + ' 期望 ' + expectUndo);
    }

    // 重做：应提示“已重做：删除Sprite（#id）”
    await js('window.__sb.redo()');
    await sleep(120);
    const redoToast = await lastToast();
    res.redoToast = redoToast;
    const expectRedo = '已重做：删除' + label + '（' + sel.id + '）';
    if (redoToast !== expectRedo) {
      throw new Error('重做提示异常: ' + redoToast + ' 期望 ' + expectRedo);
    }

    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
