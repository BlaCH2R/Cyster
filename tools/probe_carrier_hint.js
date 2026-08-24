// Probe: loads EffectsTest, selects the parent_$note carrier and a normal
// note_controller, and checks the property panel hint placement.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_ch_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_carrier_hint_out.json");
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
      const check = (id) => {
        __.selectObject(id, null);
        const body = document.getElementById('propBody');
        const btn = body && body.querySelector('#btnEditThisSelector');
        const hint = body && body.querySelector('.carrier-note-hint');
        return {
          id,
          hasButton: !!btn,
          hintBelowButton: !!(btn && hint && (btn.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING)),
          hintText: hint ? hint.textContent : null
        };
      };
      const carrier = __.state.storyboard.note_controllers.find(nc => nc.id === 'parent_$note');
      const normal = __.state.storyboard.note_controllers.find(nc => nc.id === 'parent_21') ||
        __.state.storyboard.note_controllers.find(nc => nc && nc.id !== 'parent_$note');
      return {
        carrierFound: !!carrier,
        carrier: check(carrier ? carrier.id : 'parent_$note'),
        normal: normal ? check(normal.id) : { id: null }
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
