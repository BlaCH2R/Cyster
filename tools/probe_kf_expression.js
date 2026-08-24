// Probe: verifies that adding a keyframe at the playhead does NOT overwrite an
// unresolvable K0 expression (stage objects) with an absolute time, while the
// normal "earliest becomes K0" promotion still works for numeric K0s.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_ke_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_kf_expression_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\nNOTE 1 1 3\n";

function buildInfo() {
  const storyboard = JSON.stringify({
    sprites: [
      { id: "s1", time: "start:$note", note: [0], x: 1, opacity: 1 },
      { id: "s2", time: 3, x: 1, opacity: 1 }
    ],
    texts: [], videos: [], lines: [], controllers: [],
    note_controllers: [{ id: "nc1", note: 0, time: "$note" }],
    templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.ke", title: "Kf Expression Probe",
      music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }]
    },
    levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
    files: [],
    charts: [{
      type: "easy", path: "chart.easy.txt", content: CHART,
      storyboardPath: "storyboard.json", storyboardContent: storyboard
    }]
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
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await sleep(2500);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const R = {};
      const obj = (id) => {
        const sb = __.state.storyboard;
        return (sb.sprites || []).find(o => o.id === id) ||
          (sb.note_controllers || []).find(o => o.id === id);
      };
      // 1) stage 对象 K0 为表达式：添加关键帧后表达式必须保留
      __.setTime(0, false);
      const s1 = obj('s1');
      __.addKeyframeAtPlayhead(s1);
      R.s1timeAfter = s1.time;
      R.s1states = (s1.states || []).map((st) => st.time);

      // 2) stage 对象 K0 为数字：更早的关键帧应正常提升为新 K0
      __.setTime(1, false);
      const s2 = obj('s2');
      __.addKeyframeAtPlayhead(s2);
      R.s2timeAfter = s2.time;
      R.s2states = (s2.states || []).map((st) => st.time);

      // 3) note_controller K0 为 $note：同样保留
      __.setTime(0, false);
      const nc = obj('nc1');
      __.addKeyframeAtPlayhead(nc);
      R.ncTimeAfter = nc.time;
      R.ncStates = (nc.states || []).map((st) => st.time);
      return R;
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
