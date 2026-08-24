// 完整应用探针：require 真实 main.js，验证欢迎页「使用手册」按钮能打开
// 独立手册窗口，且 docx-preview 在窗口内完成渲染（不置顶）。结果写
// tools/manual_app_probe_out.json，截图 tools/manual_app_probe_shot.png。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_manual_pw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'manual_app_probe_out.json');
const SHOT = path.join(__dirname, 'manual_app_probe_shot.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const hardTimer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: 'timeout' }));
    app.exit(1);
  }, 150000);
  const res = { ok: false, error: null };
  try {
    // 等待主窗口出现并完成欢迎页初始化（body.welcome-mode 出现 = init 完成）。
    let mainWin = null;
    for (let i = 0; i < 100 && !mainWin; i++) {
      const cand = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (cand) mainWin = cand;
      else await sleep(100);
    }
    if (!mainWin) throw new Error('主窗口未创建');
    for (let i = 0; i < 100; i++) {
      const ready = await mainWin.webContents.executeJavaScript(
        'document.body.classList.contains("welcome-mode") && !!document.getElementById("btnWelcomeManual")');
      if (ready) break;
      await sleep(100);
    }
    res.welcomeVisible = await mainWin.webContents.executeJavaScript(
      'getComputedStyle(document.getElementById("welcome")).display');
    res.manualBtnText = await mainWin.webContents.executeJavaScript(
      'document.getElementById("btnWelcomeManual").textContent.trim()');

    await mainWin.webContents.executeJavaScript('document.getElementById("btnWelcomeManual").click()');

    // 等待第二个窗口（手册窗口）出现。
    let manualWin = null;
    for (let i = 0; i < 150 && !manualWin; i++) {
      const cand = BrowserWindow.getAllWindows().find((w) => w !== mainWin && !w.isDestroyed());
      if (cand) manualWin = cand;
      else await sleep(200);
    }
    if (!manualWin) throw new Error('手册窗口未打开');
    res.title = manualWin.getTitle();
    res.alwaysOnTop = manualWin.isAlwaysOnTop();

    // 等待 docx-preview 渲染完成：状态提示清空（renderAsync 结束）且段落数 > 100。
    let paras = 0, sections = 0, images = 0, tables = 0, hasTextboxText = false, hasEmojiStar = false;
    for (let i = 0; i < 150; i++) {
      const stats = await manualWin.webContents.executeJavaScript(`({
        paras: document.querySelectorAll('#docxContainer p').length,
        sections: document.querySelectorAll('#docxContainer section.docx').length,
        images: document.querySelectorAll('#docxContainer img').length,
        tables: document.querySelectorAll('#docxContainer table').length,
        hasTextboxText: (document.getElementById('docxContainer').innerText || '')
          .includes('开始前的说明（重要）') && (document.getElementById('docxContainer').innerText || '')
          .includes('本软件内没有可以直接创作/编辑谱面文件的功能。'),
        hasEmojiStar: (document.getElementById('docxContainer').innerText || '')
          .includes('星标的独特条目（⭐）'),
        status: (document.getElementById('manualStatus') || {}).textContent || ''
      })`);
      paras = stats.paras; sections = stats.sections; images = stats.images;
      tables = stats.tables; hasTextboxText = stats.hasTextboxText;
      hasEmojiStar = stats.hasEmojiStar;
      if (paras > 100 && sections > 0 && stats.status === '' && hasTextboxText && hasEmojiStar) break;
      await sleep(200);
    }
    res.paras = paras;
    res.sections = sections;
    res.images = images;
    res.tables = tables;
    res.hasTextboxText = hasTextboxText;
    res.hasEmojiStar = hasEmojiStar;
    if (paras <= 100 || sections <= 0 || !hasTextboxText || !hasEmojiStar) {
      throw new Error('手册渲染不完整: paras=' + paras + ' sections=' + sections + ' tables=' + tables +
        ' hasTextboxText=' + hasTextboxText + ' hasEmojiStar=' + hasEmojiStar);
    }

    // 点击「适应宽度」，验证页面水平居中（左右边距对称、无右溢出）。
    await manualWin.webContents.executeJavaScript('document.getElementById("btnZoomFit").click()');
    await sleep(300);
    const fit = await manualWin.webContents.executeJavaScript(`(() => {
      const body = document.getElementById('manualBody');
      const box = document.getElementById('docxContainer');
      const br = body.getBoundingClientRect();
      const xr = box.getBoundingClientRect();
      const cs = getComputedStyle(body);
      const contentLeft = br.left + parseFloat(cs.paddingLeft);
      // clientWidth 不含滚动条，用它算可视内容区宽度才与 fit 逻辑一致。
      const contentWidth = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const contentRight = contentLeft + contentWidth;
      const page = document.querySelector('#docxContainer .docx-wrapper > .docx') ||
        document.querySelector('#docxContainer .docx-wrapper');
      return {
        left: Math.round((xr.left - contentLeft) * 100) / 100,
        right: Math.round((contentRight - xr.right) * 100) / 100,
        pct: (document.getElementById('manualZoomPct') || {}).textContent || '',
        clientWidth: body.clientWidth,
        boxOffsetWidth: box.offsetWidth,
        boxRectW: Math.round(xr.width * 100) / 100,
        pageRectW: page ? Math.round(page.getBoundingClientRect().width * 100) / 100 : null,
        pageOffsetWidth: page ? page.offsetWidth : null
      };
    })()`);
    res.fitLeft = fit.left;
    res.fitRight = fit.right;
    res.fitPct = fit.pct;
    res.fitDiag = {
      clientWidth: fit.clientWidth,
      boxOffsetWidth: fit.boxOffsetWidth,
      boxRectW: fit.boxRectW,
      pageRectW: fit.pageRectW,
      pageOffsetWidth: fit.pageOffsetWidth
    };
    if (Math.abs(fit.left) > 2 || Math.abs(fit.right) > 2) {
      throw new Error('适应宽度后未居中: left=' + fit.left + ' right=' + fit.right + ' pct=' + fit.pct);
    }

    // 章节目录跳转：7 个条目已接线；点击“07：高级功能介绍”应滚动到对应章节。
    res.tocWired = await manualWin.webContents.executeJavaScript(
      'document.getElementById("docxContainer").dataset.tocWired || "0"');
    res.tocEntries = await manualWin.webContents.executeJavaScript(
      'document.getElementById("docxContainer").dataset.tocEntries || "0"');
    res.tocTargets = await manualWin.webContents.executeJavaScript(
      'document.getElementById("docxContainer").dataset.tocTargets || "0"');
    res.tocJumpCount = await manualWin.webContents.executeJavaScript(
      'document.querySelectorAll("#docxContainer .toc-jump").length');
    if (Number(res.tocWired) !== 7 || Number(res.tocEntries) !== 7 || Number(res.tocTargets) !== 7 || res.tocJumpCount !== 7) {
      throw new Error('目录条目接线异常: wired=' + res.tocWired + ' entries=' + res.tocEntries +
        ' targets=' + res.tocTargets + ' count=' + res.tocJumpCount);
    }
    await manualWin.webContents.executeJavaScript(
      'document.querySelectorAll("#docxContainer .toc-jump")[6].click()');
    await sleep(1100);
    const toc = await manualWin.webContents.executeJavaScript(`(() => {
      const body = document.getElementById('manualBody');
      const flash = document.querySelector('#docxContainer .toc-target-flash');
      return {
        scrollTop: Math.round(body.scrollTop),
        flashText: flash ? (flash.textContent || '').trim().slice(0, 30) : null
      };
    })()`);
    res.tocScrollTop = toc.scrollTop;
    res.tocFlashText = toc.flashText;
    if (toc.scrollTop < 500) throw new Error('目录跳转未生效: scrollTop=' + toc.scrollTop);
    if (!toc.flashText || !/^07/.test(toc.flashText)) {
      throw new Error('目录跳转目标异常: ' + toc.flashText);
    }

    // 回到顶部后截图（展示章节目录区域）。
    await manualWin.webContents.executeJavaScript(
      'document.getElementById("manualBody").scrollTo({ top: 0 })');
    await sleep(400);
    const tocHeaderPos = await manualWin.webContents.executeJavaScript(`(() => {
      const body = document.getElementById('manualBody');
      const toc = Array.from(document.querySelectorAll('#docxContainer .docx-wrapper p'))
        .find((p) => (p.textContent || '').trim().startsWith('章节目录'));
      if (!toc) return null;
      const br = body.getBoundingClientRect();
      const er = toc.getBoundingClientRect();
      const top = body.scrollTop + er.top - br.top - 18;
      body.scrollTo({ top: Math.max(0, top) });
      return { y: Math.round(top) };
    })()`);
    res.tocHeaderY = tocHeaderPos ? tocHeaderPos.y : null;
    await sleep(500);

    // 等一帧绘制完成后截图（供人工确认）。
    await sleep(800);
    const img = await manualWin.webContents.capturePage();
    fs.writeFileSync(SHOT, img.toPNG());
    res.shot = path.basename(SHOT);
    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
