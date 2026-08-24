// Probe: launches the real app, loads a storyboard with sprites that have
// only a K0 (no extra states) or K0 + one state, then simulates Delete-key
// deletion with different keyframe selections:
//   1) K0-only block, K0 selected  -> whole object is deleted
//   2) K0 + state, only K0 selected -> K0 removed, state promoted, object kept
//   3) K0 + state, both selected   -> whole object is deleted
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_dk_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_delete_k0_out.json");

function buildInfo() {
  const chart = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\n";
  const storyboard = JSON.stringify({
    sprites: [
      { id: "s1", time: 3, x: 1 },
      { id: "s2", time: 2, x: 1, states: [{ time: 4, x: 2 }] },
      { id: "s3", time: 1, x: 1, states: [{ time: 5, x: 2 }] }
    ],
    texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.dk", title: "Delete K0 Probe",
      music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }]
    },
    levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
    files: [],
    charts: [{
      type: "easy", path: "chart.easy.txt", content: chart,
      storyboardPath: "storyboard.json", storyboardContent: storyboard
    }]
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 120000);
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await new Promise((r) => setTimeout(r, 600));
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await new Promise((r) => setTimeout(r, 2500));
    // 非 compiled 内容会弹警告弹窗，而全局 Delete 快捷键在弹窗打开时被禁用；
    // 关闭弹窗后再模拟按键。
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const run = (sel) => win.webContents.executeJavaScript(`(async () => {
      const st = window.__sb.state;
      st.selectedIds = ${JSON.stringify(sel.ids)};
      st.selectedKfs = ${JSON.stringify(sel.kfs)};
      st.selectedKeyIdx = ${sel.kfIdx != null ? sel.kfIdx : '-1'};
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      const sb = st.storyboard || {};
      return {
        s1: (sb.sprites || []).some((o) => o.id === 's1'),
        s2: (sb.sprites || []).find((o) => o.id === 's2'),
        s3: (sb.sprites || []).some((o) => o.id === 's3')
      };
    })()`);

    const out = { results: {} };
    const r1 = await run({ ids: ["s1"], kfs: [{ objId: "s1", index: -1 }], kfIdx: -1 });
    out.results.k0OnlyDeleted = r1.s1 === false;

    const r2 = await run({ ids: ["s2"], kfs: [{ objId: "s2", index: -1 }], kfIdx: -1 });
    out.results.k0PromotesState = !!r2.s2 &&
      Array.isArray(r2.s2.states) && r2.s2.states.length === 0 &&
      r2.s2.time === 4 && r2.s2.x === 2;

    const r3 = await run({ ids: ["s3"], kfs: [{ objId: "s3", index: -1 }, { objId: "s3", index: 0 }], kfIdx: 0 });
    out.results.allSelectedDeleted = r3.s3 === false;

    out.ok = out.results.k0OnlyDeleted && out.results.k0PromotesState &&
      out.results.allSelectedDeleted;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(out && out.ok ? 0 : 1);
  }
});
