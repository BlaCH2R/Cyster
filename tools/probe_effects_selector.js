// Probe: reproduces the EffectsTest flow — right-click note input opens the
// selector editor for a SPRITE merged block; applying a shrunk filter must
// update both the object and the timeline merged-block style immediately.
// Also reproduces the list-mode pick -> apply path.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_es_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_effects_selector_out.json");
const DIR = "V:/cytoid storyboarder/项目/测试：效果/EffectsTest";

function buildInfo() {
  const ctr = JSON.parse(fs.readFileSync(path.join(DIR, "parent_note_to_sprite.ctr"), "utf8"));
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const chartPath = "chart.base.txt";
  const charts = [{
    type: "easy", path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
    storyboardPath: "storyboard.json",
    storyboardContent: fs.readFileSync(path.join(DIR, "storyboard.json"), "utf8")
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return {
    info: { level, levelDir: DIR, files, charts },
    config: { projectPath: path.join(DIR, "parent_note_to_sprite.ctr"), config: ctr }
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const b = buildInfo();
    await win.webContents.executeJavaScript(
      `window.__sb.loadLevelInfo(${JSON.stringify(b.info)}, ${JSON.stringify(b.config)})`);
    await sleep(4000);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(async () => {
      const __ = window.__sb;
      const R = {};
      const spr = __.state.storyboard.sprites.find(o => o.id === 'sprite_1');
      R.spriteNoteBefore = spr ? (Array.isArray(spr.note) ? spr.note.length : spr.note) : null;
      R.mergedFlag = !!(__.state.noteSelectorMerge && __.state.noteSelectorMerge['sprite_1']);
      const clipInfo = () => {
        const clip = document.querySelector('.clip[data-id="sprite_1"]');
        const cnt = clip && clip.querySelector('.clip-count');
        return clip ? { left: clip.style.left, width: clip.style.width,
          count: cnt ? cnt.textContent : null, cls: clip.className } : null;
      };
      R.clipBefore = clipInfo();

      // 复刻"右键 note 输入框 -> 编辑note选择器"入口
      __.openNoteSelectorEditor(spr);
      const ctx0 = __.nsBridge('getContext');
      R.editorTarget = ctx0.target ? { id: ctx0.target.id, noteLen: Array.isArray(ctx0.target.note) ? ctx0.target.note.length : ctx0.target.note } : null;

      // 应用缩小后的列表 [0..10]
      const small = Array.from({ length: 11 }, (_, i) => i);
      const r1 = __.nsBridge('apply', [{ id: 'sprite_1', note: small, merge: true }]);
      R.applyResult = r1;
      R.spriteNoteAfter = __.state.storyboard.sprites.find(o => o.id === 'sprite_1').note.length;
      R.clipAfter = clipInfo();

      // 列表模式：拾取后应用（draft -> apply 提交 ctx.target.note）
      const picked = [0, 1, 2, 3];
      const r2 = __.nsBridge('draft', [{ note: picked }]);
      const ctx1 = __.nsBridge('getContext');
      R.draftCtxNote = ctx1.target.note;
      const r3 = __.nsBridge('apply', [{ id: 'sprite_1', note: ctx1.target.note, merge: true }]);
      R.pickApplyResult = r3;
      R.spriteNoteAfterPick = __.state.storyboard.sprites.find(o => o.id === 'sprite_1').note;
      R.clipAfterPick = clipInfo();

      // 重开编辑器：应显示已提交的状态
      __.openNoteSelectorEditor(__.state.storyboard.sprites.find(o => o.id === 'sprite_1'));
      const ctx2 = __.nsBridge('getContext');
      R.reopenedNote = ctx2.target.note;
      return R;
    })()`);

    // ---- 真实窗口流程：右键 note 输入框 → 选择器窗口 → 拾取 → 应用 ----
    const real = {};
    await win.webContents.executeJavaScript(
      `window.__sb.openNoteSelectorEditor(window.__sb.state.storyboard.sprites.find(o => o.id === 'sprite_1'))`);
    await sleep(800);
    const nsWin = BrowserWindow.getAllWindows().find((w) => w !== win);
    real.nsWindowFound = !!nsWin;
    if (nsWin) {
      real.nsInitial = await nsWin.webContents.executeJavaScript(`({
        bound: !!ctx && !!ctx.target ? ctx.target.id : null,
        isList: !!(ctx && ctx.target && Array.isArray(ctx.target.note)),
        listLen: (ctx && ctx.target && Array.isArray(ctx.target.note)) ? ctx.target.note.length : null
      })`);
      // 开启拾取
      await nsWin.webContents.executeJavaScript(`$('#nsPick').click()`);
      await sleep(300);
      // 主窗口：模拟点击一个 note（真实拾取路径 pickNoteToSelector）
      real.pickResult = await win.webContents.executeJavaScript(`(() => {
        const st = window.__sb.state;
        const prev = st.notePickerActive;
        st.notePickerActive = true;
        const pv = window.__sb.preview;
        const orig = pv.hitTestNote;
        pv.hitTestNote = () => ({ id: 999 });
        const canvas = document.getElementById('previewCanvas');
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        pv.hitTestNote = orig;
        st.notePickerActive = prev;
        return { ok: true };
      })()`);
      await sleep(600);
      real.nsAfterPick = await nsWin.webContents.executeJavaScript(`({
        listLen: (ctx && ctx.target && Array.isArray(ctx.target.note)) ? ctx.target.note.length : null,
        lastNote: (ctx && ctx.target && Array.isArray(ctx.target.note)) ? ctx.target.note.slice(-3) : null
      })`);
      // 点击应用
      await nsWin.webContents.executeJavaScript(`$('#nsApply').click()`);
      await sleep(700);
      real.mainNoteAfterRealApply = await win.webContents.executeJavaScript(
        `window.__sb.state.storyboard.sprites.find(o => o.id === 'sprite_1').note`);
      real.clipAfterRealApply = await win.webContents.executeJavaScript(`(() => {
        const clip = document.querySelector('.clip[data-id="sprite_1"]');
        const cnt = clip && clip.querySelector('.clip-count');
        return clip ? { width: clip.style.width, count: cnt ? cnt.textContent : null } : null;
      })()`);
      // 重开选择器：ctx 应显示已提交状态
      await win.webContents.executeJavaScript(
        `window.__sb.openNoteSelectorEditor(window.__sb.state.storyboard.sprites.find(o => o.id === 'sprite_1'))`);
      await sleep(700);
      real.nsReopened = await nsWin.webContents.executeJavaScript(`({
        listLen: (ctx && ctx.target && Array.isArray(ctx.target.note)) ? ctx.target.note.length : null
      })`);
      // 竞态场景：拾取后不等待 load() 完成立即点“应用”——修复前会用旧 ctx 提交
      real.racePick = await win.webContents.executeJavaScript(`(() => {
        const st = window.__sb.state;
        st.notePickerActive = true;
        const pv = window.__sb.preview;
        const orig = pv.hitTestNote;
        pv.hitTestNote = () => ({ id: 888 });
        const canvas = document.getElementById('previewCanvas');
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        pv.hitTestNote = orig;
        st.notePickerActive = false;
        return { ok: true };
      })()`);
      // 不等待：立即点击应用
      await nsWin.webContents.executeJavaScript(`$('#nsApply').click()`);
      await sleep(700);
      real.raceResult = await win.webContents.executeJavaScript(`(() => {
        const n = window.__sb.state.storyboard.sprites.find(o => o.id === 'sprite_1').note;
        return { note: n, has888: n.indexOf(888) >= 0 };
      })()`);
    }
    out.real = real;
    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(0);
  }
});
