// 完整应用探针：验证“未保存修改”确认弹窗与“在哪里打开项目”确认弹窗不再重复。
// 场景A（无未保存修改）：切换项目 → 只出现“在哪里打开项目？”。
// 场景B（有未保存修改）：切换项目 → 只出现“有未保存的修改”，不再出现“在哪里打开项目？”。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_unsaved_pw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'unsaved_dialog_probe_out.json');
const SRC = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン';
const B_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_proj_b_'));
fs.cpSync(SRC, B_DIR, { recursive: true });
const A = path.join(SRC, '銀河鉄道のペンギン.ctdsber');
const B = path.join(B_DIR, '銀河鉄道のペンギン.ctdsber');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const hardTimer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: 'timeout' }));
    app.exit(1);
  }, 180000);
  const res = { ok: false, error: null, logs: [] };
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
        '!!document.getElementById("modalMask") && !!window.__sb');
      if (ready) break;
      await sleep(100);
    }

    const clickFoot = (label) => mainWin.webContents.executeJavaScript(`(() => {
      const b = Array.from(document.querySelectorAll('#modalFoot button'))
        .find((x) => (x.textContent || '').trim() === ${JSON.stringify(label)});
      if (b) b.click();
      return !!b;
    })()`);

    // 轮询处理当前弹窗：记录标题并点击对应按钮/选项，直到项目切换到 p。
    const openAndSettle = async (p) => {
      const modalLog = [];
      mainWin.webContents.executeJavaScript('window.__sb.openProjectFilePath(' + JSON.stringify(p) + ')')
        .catch(() => {});
      for (let i = 0; i < 300; i++) {
        const st = await mainWin.webContents.executeJavaScript(`(() => {
          const mask = document.getElementById('modalMask');
          const cur = window.__sb.state.projectPath;
          let title = null;
          if (mask && !mask.classList.contains('hidden')) {
            title = (document.getElementById('modalTitle') || {}).textContent || '';
          }
          return { title, cur };
        })()`);
        if (st.title) {
          modalLog.push(st.title);
          if (st.title === '选择难度谱面') {
            await mainWin.webContents.executeJavaScript(
              'document.querySelectorAll("#modalBody .pick-item")[0].click()');
          } else if (st.title === '有未保存的修改') {
            await clickFoot('不保存');
          } else if (st.title === '在哪里打开项目？') {
            await clickFoot('关闭当前项目并打开');
          } else if (st.title === '在哪里创建项目？') {
            await clickFoot('关闭当前项目并创建');
          } else {
            // 未知弹窗：点第一个按钮兜底，避免卡死
            await mainWin.webContents.executeJavaScript(
              '(() => { const b = document.querySelector("#modalFoot button"); if (b) b.click(); })()');
          }
        }
        if (st.cur === p) return modalLog;
        await sleep(100);
      }
      throw new Error('打开项目超时: ' + p + ' log=' + JSON.stringify(modalLog));
    };

    // 场景A：首次打开 A（无项目 → 无任何确认弹窗）
    const logA1 = await openAndSettle(A);
    res.openFirst = logA1;

    // 场景A：干净状态下 A → B（应出现“在哪里打开项目？”，不应出现未保存）
    await mainWin.webContents.executeJavaScript('window.__sb.state.dirty = false');
    const logA2 = await openAndSettle(B);
    res.cleanSwitch = logA2;
    if (!logA2.includes('在哪里打开项目？')) throw new Error('干净切换未出现“在哪里打开项目？”: ' + JSON.stringify(logA2));
    if (logA2.includes('有未保存的修改')) throw new Error('干净切换不应出现未保存提示: ' + JSON.stringify(logA2));

    // 场景B：切回 A（干净），然后制造未保存修改再切 B
    const logB1 = await openAndSettle(A);
    res.cleanBack = logB1;
    await mainWin.webContents.executeJavaScript('window.__sb.state.dirty = false');
    await mainWin.webContents.executeJavaScript('window.__sb.state.dirty = true');
    const logB2 = await openAndSettle(B);
    res.dirtySwitch = logB2;
    if (!logB2.includes('有未保存的修改')) throw new Error('有修改时未出现未保存提示: ' + JSON.stringify(logB2));
    if (logB2.includes('在哪里打开项目？')) {
      throw new Error('有未保存提示时不应再出现“在哪里打开项目？”: ' + JSON.stringify(logB2));
    }

    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
