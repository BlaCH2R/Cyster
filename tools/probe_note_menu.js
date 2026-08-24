// Probe: launches the real app, loads a test level, then opens the note
// right-click context menu (with a stubbed hitTestNote) for click / hold /
// drag notes. Verifies the grouped layout (cm-sep separators), the new
// labels, and that copying the intro time writes the concrete value to the
// clipboard and shows it in the toast.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_nm_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_note_menu_out.json");

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const chartPath = "chart.base.txt";
  const sbPath = "storyboard_compiled.json";
  const charts = [{
    type: "extreme",
    path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
    storyboardPath: sbPath,
    storyboardContent: fs.readFileSync(path.join(DIR, sbPath), "utf8"),
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: DIR, files, charts };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 120000);
  try {
    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await sleep(3500);

    const openMenuFor = (type) => win.webContents.executeJavaScript(`(async () => {
      const preview = window.__sb.preview;
      preview.hitTestNote = () => ({
        id: 999999, type: ${type},
        start_time: 1.5, intro_time: 0.8, end_time: 2.5,
        x: 0.25, chartY: 0.75
      });
      const canvas = document.getElementById('previewCanvas');
      const r = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
      }));
      await new Promise((res) => setTimeout(res, 80));
      return [...document.querySelectorAll('#contextMenu > *')].map((el) => ({
        cls: el.className,
        text: el.textContent
      }));
    })()`);

    const out = { results: {} };
    const seqOf = (menu) => menu.map((m) => (m.cls === 'cm-sep' ? '|' : m.text));

    const m0 = await openMenuFor(0);
    out.results.clickSeq = seqOf(m0);
    out.results.clickOk =
      JSON.stringify(out.results.clickSeq) === JSON.stringify([
        '跳转至note的渐入时间', '|',
        '复制note时间', '复制note的渐入（intro）时间', '|',
        '复制noteX', '复制noteY', '|',
        '对此note（999999）创建note_controller'
      ]);
    out.results.clickNoIntroIdLabel = !m0.some((m) => /复制intro:/.test(m.text));
    out.results.clickNoOldJumpLabel = !m0.some((m) => /跳转至note的intro时间/.test(m.text));
    out.results.clickSepCount = m0.filter((m) => m.cls === 'cm-sep').length;

    const m1 = await openMenuFor(1);
    out.results.holdSeq = seqOf(m1);
    out.results.holdOk =
      JSON.stringify(out.results.holdSeq) === JSON.stringify([
        '跳转至note的渐入时间', '跳转至end:999999', '|',
        '复制note时间', '复制note的渐入（intro）时间', '|',
        '复制noteX', '复制noteY', '|',
        '对此note（999999）创建note_controller'
      ]);

    const m3 = await openMenuFor(3);
    out.results.dragSeq = seqOf(m3);
    out.results.dragOk =
      JSON.stringify(out.results.dragSeq) === JSON.stringify([
        '跳转至note的渐入时间', '|',
        '复制note时间', '复制note的渐入（intro）时间', '|',
        '复制noteX', '复制noteY', '|',
        '对此note（999999）创建note_controller', '|',
        '选择整条锁链'
      ]);

    // 点击“复制note的渐入（intro）时间”：写入剪贴板的值与提示都要带具体数值。
    const clipValue = await win.webContents.executeJavaScript(`(async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t) => { window.__clipLog = t; } },
        configurable: true
      });
      window.__clipLog = null;
      const el = [...document.querySelectorAll('#contextMenu .cm-item')]
        .find((x) => x.textContent === '复制note的渐入（intro）时间');
      el.click();
      await new Promise((res) => setTimeout(res, 300));
      return window.__clipLog;
    })()`);
    await sleep(400);
    out.results.clipboardValue = clipValue;
    out.results.toast = await win.webContents.executeJavaScript(
      `[...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ')`);
    out.results.copyClipHasValue = clipValue === '0.800';
    out.results.copyToastHasValue = /0\.800/.test(out.results.toast);

    out.ok = out.results.clickOk && out.results.clickNoIntroIdLabel &&
      out.results.clickNoOldJumpLabel && out.results.clickSepCount === 3 &&
      out.results.holdOk && out.results.dragOk &&
      out.results.copyClipHasValue && out.results.copyToastHasValue;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(out && out.ok ? 0 : 1);
  }
});
