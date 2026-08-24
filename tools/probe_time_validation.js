// Probe: verifies the time-input compliance check — unparseable note
// expressions (notes that don't exist / bad syntax) are rejected with a toast
// and the stored time stays unchanged; valid numbers / note expressions pass.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_tv_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_time_validation_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\nNOTE 1 1 3\n";

function buildInfo() {
  const storyboard = JSON.stringify({
    sprites: [], texts: [], videos: [], lines: [], controllers: [],
    note_controllers: [{ id: "nc1", note: 0, time: 1, states: [{ time: 2, x: 0.7 }] }],
    templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.tv", title: "Time Validation Probe",
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

    const out = await win.webContents.executeJavaScript(`(async () => {
      const __ = window.__sb;
      const R = {};
      const type = (v) => {
        const input = [...document.querySelectorAll('#stateForm .field')]
          .find((f) => f.querySelector('label') &&
            f.querySelector('label').textContent.indexOf('时间') === 0);
        const el = input && input.querySelector('input');
        if (!el) return { ok: false };
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        const toast = [...document.querySelectorAll('.toast')].pop();
        return { ok: true, toast: toast ? toast.textContent : null };
      };
      const time = () => __.state.storyboard.note_controllers.find((o) => o.id === 'nc1').time;

      __.selectObject('nc1', -1);
      R.initial = time();
      R.invalidNote = type('start:999999');
      R.afterInvalidNote = time();
      R.validStart = type('start:0');
      R.afterValidStart = time();
      R.noteToken = type('$note');
      R.afterNoteToken = time();
      R.badSyntax = type('foo:3');
      R.afterBadSyntax = time();
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
