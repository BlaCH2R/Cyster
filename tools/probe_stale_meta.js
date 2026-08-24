// Probe: copies EffectsTest to a temp dir, patches the .ctr meta so the
// parent_$note carrier list EXCLUDES notes 0 and 4..49 (simulating a stale /
// previously-split meta), then loads the project. Checks whether the excluded
// notes' clones (parent_0, parent_4..49) come back as separate blocks and
// whether they are editable.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_sm_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_stale_meta_out.json");
const SRC = "V:/cytoid storyboarder/项目/测试：效果/EffectsTest";

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_stale_"));
  try {
    // 复制项目到临时目录并改写 meta
    const DIR = path.join(root, "EffectsTest");
    fs.mkdirSync(DIR, { recursive: true });
    for (const name of fs.readdirSync(SRC)) {
      fs.copyFileSync(path.join(SRC, name), path.join(DIR, name));
    }
    const ctrPath = path.join(DIR, "parent_note_to_sprite.ctr");
    const ctr = JSON.parse(fs.readFileSync(ctrPath, "utf8"));
    const meta = ctr.editor.difficulties["chart.base.txt"].noteSelectorMeta;
    const p = meta["note_controllers::parent_$note"];
    const exclude = new Set([0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
      44, 45, 46, 47, 48, 49, 21]);
    p.note = p.note.filter((n) => !exclude.has(n));
    p.notes = p.note.slice();
    fs.writeFileSync(ctrPath, JSON.stringify(ctr, null, 2), "utf8");

    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
    const chartPath = "chart.base.txt";
    const info = {
      level, levelDir: DIR,
      files: fs.readdirSync(DIR).filter((n) => {
        const st = fs.statSync(path.join(DIR, n));
        return st.isFile();
      }).map((name) => ({ name, size: fs.statSync(path.join(DIR, name)).size })),
      charts: [{
        type: "easy", path: chartPath,
        content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
        storyboardPath: "storyboard.json",
        storyboardContent: fs.readFileSync(path.join(DIR, "storyboard.json"), "utf8")
      }]
    };
    const config = { projectPath: ctrPath, config: ctr };
    await win.webContents.executeJavaScript(
      `window.__sb.loadLevelInfo(${JSON.stringify(info)}, ${JSON.stringify(config)})`);
    await sleep(4000);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const sb = window.SBEngine.storyboard;
      const compiled = JSON.parse(${JSON.stringify(
        fs.readFileSync(path.join(DIR, 'storyboard.json'), 'utf8')
      )});
      const meta = __.state.noteSelectorMeta || {};
      // 分步：fromCompiled -> reconstruct -> heal 复刻（heal 为内部函数，这里
      // 只观察 fromCompiled + reconstruct 两个阶段）
      const fc = sb.fromCompiled(compiled);
      const fcParents = (fc.note_controllers || []).filter(nc => /^parent_/.test(nc.id)).map(nc => nc.id);
      __.reconstructNoteSelectors(fc, meta);
      const recParents = (fc.note_controllers || []).filter(nc => /^parent_/.test(nc.id)).map(nc => nc.id);
      const ncs = __.state.storyboard.note_controllers || [];
      const carrier = ncs.find(nc => nc.id === 'parent_$note');
      const separate = ncs.filter(nc => /^parent_\d+$/.test(nc.id))
        .map(nc => ({ id: nc.id, note: nc.note, states: (nc.states || []).length }));
      // 可编辑性：选中 parent_4 并检查属性面板
      const nc4 = ncs.find(nc => nc.id === 'parent_4');
      let edit = null;
      if (nc4) {
        __.selectObject('parent_4', null);
        const body = document.getElementById('propBody');
        edit = {
          selected: __.state.selectedObjId,
          hasForm: !!(body && body.querySelector('#stateForm')),
          text: body ? body.textContent.replace(/\\s+/g, ' ').slice(0, 100) : null
        };
      }
      return {
        allNcIds: ncs.map(nc => nc.id).slice(0, 60),
        ncTotal: ncs.length,
        fcParents: fcParents.slice(0, 20),
        fcParentCount: fcParents.length,
        recParents: recParents.slice(0, 20),
        recParentCount: recParents.length,
        carrierNotes: carrier ? carrier.note.length : null,
        separate,
        separateCount: separate.length,
        edit4: edit
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
