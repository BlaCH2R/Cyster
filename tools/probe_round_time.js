// Probe: verifies float time noise (40.079800000000006) is rounded away at
// the write/parse points: add-keyframe-at-playhead, shift, and the compiler's
// note-expression resolver.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_rt_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_round_time_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\nNOTE 1 1 3\n";

function buildInfo() {
  const storyboard = JSON.stringify({
    sprites: [], texts: [], videos: [], lines: [], controllers: [],
    note_controllers: [
      { id: "nc1", note: 0, time: 1 },
      { id: "nc2", note: 0, time: "start:0:0.0006" }
    ],
    templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.rt", title: "Round Time Probe",
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
      // 1) 播放头为脏浮点值：添加关键帧后存储值应收敛
      const nc = __.state.storyboard.note_controllers.find((o) => o.id === 'nc1');
      __.preview.time = 40.079800000000006;
      __.addKeyframeAtPlayhead(nc);
      const st = nc.states[nc.states.length - 1];
      R.added = { value: st.time, str: String(st.time) };

      // 2) 整体平移：脏增量相加后仍收敛
      __.shiftClips(['nc1'], 0.0006);
      R.shifted = { value: nc.states[nc.states.length - 1].time, str: String(nc.states[nc.states.length - 1].time) };

      // 3) 编译器解析 note 表达式：结果同样收敛
      const compiled = window.SBEngine.storyboard.toCompiled(__.state.storyboard, __.state.chart);
      const nc2c = compiled.note_controllers.find((c) => c.Id === 'nc2');
      R.compiledTime = nc2c ? { value: nc2c.States[0].Time, str: String(nc2c.States[0].Time) } : null;
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
