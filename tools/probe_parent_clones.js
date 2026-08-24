// Probe: loads EffectsTest and dumps the note_controllers state to see why
// parent_0 / parent_4..49 clones stay separate and whether they are editable.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_pc_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_parent_clones_out.json");
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

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const sb = window.SBEngine.storyboard;
      // 从 compiled 直接 fromCompiled 的克隆集合（加载前形态）
      const compiled = JSON.parse(${JSON.stringify(
        fs.readFileSync(path.join(DIR, 'storyboard.json'), 'utf8')
      )});
      const fc = sb.fromCompiled(compiled);
      const fcParents = (fc.note_controllers || [])
        .filter(nc => String(nc.id).indexOf('parent') === 0)
        .map(nc => nc.id);
      // 手动执行 reconstruct（与加载路径相同的函数）
      const meta = __.state.noteSelectorMeta || {};
      const manual = sb.fromCompiled(compiled);
      __.reconstructNoteSelectors(manual, meta);
      const manualParents = (manual.note_controllers || [])
        .filter(nc => String(nc.id).indexOf('parent') === 0)
        .map(nc => nc.id);
      const ncs = __.state.storyboard.note_controllers || [];
      const carriers = Object.keys(__.state.parentCarriers || {}).filter(k => __.state.parentCarriers[k]);
      const parentItems = ncs
        .filter(nc => String(nc.id).indexOf('parent') === 0)
        .map(nc => ({ id: nc.id, note: nc.note, states: (nc.states || []).length,
          carrier: carriers.includes(nc.id), merge: !!__.state.noteSelectorMerge[nc.id] }))
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
      return {
        fromCompiledParentCount: fcParents.length,
        fromCompiledHas0: fcParents.includes('parent_0'),
        fromCompiledHas21: fcParents.includes('parent_21'),
        manualReconstructParents: manualParents,
        manualReconstructHas0: manualParents.includes('parent_0'),
        totalNc: ncs.length,
        parentItems,
        parentCarrierFlags: carriers,
        noteSelectorMetaKeys: Object.keys(__.state.noteSelectorMeta || {}),
        metaParent: __.state.noteSelectorMeta && __.state.noteSelectorMeta['note_controllers::parent_$note'],
        sprite1ParentId: (__.state.storyboard.sprites || []).find(o => o.id === 'sprite_1').parent_id,
        sprite1NoteLen: (__.state.storyboard.sprites || []).find(o => o.id === 'sprite_1').note.length
      };
    })()`);
    // 时间轴实际渲染的块 + 选中 parent_21 的可编辑性
    out.timelineClips = await win.webContents.executeJavaScript(`(() => {
      const clips = [...document.querySelectorAll('#tlScroll .clip')].map(c => ({
        id: c.dataset.id, count: (c.querySelector('.clip-count') || {}).textContent || null,
        cls: c.className
      }));
      return clips.filter(c => String(c.id).indexOf('parent') === 0 || c.id === 'sprite_1' || c.id === 'sprite_7');
    })()`);
    out.parent21Editable = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const nc = __.state.storyboard.note_controllers.find(x => x.id === 'parent_21');
      if (!nc) return { exists: false };
      __.selectObject('parent_21', null);
      const body = document.getElementById('propBody');
      return {
        exists: true,
        selectedObjId: __.state.selectedObjId,
        propHasForm: !!(body && body.querySelector('#stateForm')),
        propText: body ? body.textContent.slice(0, 120) : null
      };
    })()`);
    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(0);
  }
});
