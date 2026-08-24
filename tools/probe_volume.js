// Volume persistence probe. Usage: probe_volume.js set|check
//  - set:   change the volume slider to 35% and verify it is saved.
//  - check: launch again with the same userData; verify the remembered
//           volume is restored onto state and the slider.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const phase = process.argv[process.argv.length - 1];
const UD = path.join(__dirname, ".probe_volume_ud");
if (phase === "set") fs.rmSync(UD, { recursive: true, force: true });
app.setPath("userData", UD);
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_volume_out.json");

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout", phase }));
    app.exit(1);
  }, 60000);
  await new Promise((r) => setTimeout(r, 2800));
  const win = BrowserWindow.getAllWindows()[0];
  const out = await win.webContents.executeJavaScript(`(async () => {
    const st = window.__sb.state;
    const tl = window.__sb.timeline;
    if (${phase === "set"}) {
      const initial = { stateVolume: st.volume, sliderValue: tl.volSlider.value };
      tl.volSlider.value = '35';
      tl.volSlider.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
      const s = await window.sbAPI.getSettings();
      return { phase: 'set', initial, stateVolume: st.volume, settingsVolume: s && s.volume };
    } else {
      return {
        phase: 'check',
        stateVolume: st.volume,
        sliderValue: tl.volSlider.value,
        settingsVolume: (await window.sbAPI.getSettings() || {}).volume
      };
    }
  })()`);
  clearTimeout(timer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log("PROBE_VOLUME_" + phase.toUpperCase() + "_OK");
  app.exit(0);
});
