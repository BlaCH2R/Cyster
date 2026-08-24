// verify_volume.js — volume must survive project switching (applied to the
// newly created audio player without needing to re-drag the slider).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_sb_vol_');
function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8') : null
  }));
  return { level, levelDir: dir, files: [], charts };
}

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));
  const info = buildInfo(PLAYER);
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(info)})`);
  await new Promise((r) => setTimeout(r, 2500));

  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_vol_dir_'));
  const projPath = path.join(projDir, 'VolSwitch.ctdsber');
  const musicAbs = path.join(PLAYER, info.level.music && info.level.music.path || '');
  const chartAbs = path.join(PLAYER, info.charts[0].path);

  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const slider = document.getElementById('volSlider');
      slider.value = 40;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
      const before = window.__sb.preview.audio ? window.__sb.preview.audio.volume : null;
      const stateVol = window.__sb.state.volume;
      // Switch project: create a fresh project, which rebuilds the audio player
      const res = await window.sbAPI.projectCreate({
        projectPath: ${JSON.stringify(projPath)},
        name: 'VolSwitch',
        music: ${JSON.stringify(musicAbs)},
        chart: ${JSON.stringify(chartAbs)},
        storyboard: null
      });
      if (!res) return { err: 'project create failed' };
      await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
      await new Promise(r => setTimeout(r, 1800)); // async setupAudio
      const after = window.__sb.preview.audio ? window.__sb.preview.audio.volume : null;
      const sliderStill = document.getElementById('volSlider').value;
      return { before, stateVol, after, sliderStill };
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);

  check('volume applied after slider input', out.before === 0.4 && out.stateVol === 0.4, JSON.stringify(out));
  check('volume survives project switch', !out.err && out.after === 0.4 && out.sliderStill === '40', JSON.stringify(out));

  const fails = results.filter((r) => !r.ok);
  console.log('SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed');
  app.exit(fails.length ? 1 : 0);
});
