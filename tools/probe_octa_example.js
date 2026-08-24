// QA for the pseudo-3D octahedron example added to the 企鹅 test project:
// reads the octahedron sprites from that project's storyboard, renders them in
// a lightweight fixture project, verifies rot_y interpolates, and captures
// preview frames at several times for visual QA.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_octa_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_octa_');
const ASSET_DIR = 'V:\\cytoid storyboarder\\项目\\测试：企鹅\\銀河鉄道のペンギン';
const SB_FILE = 'V:\\cytoid storyboarder\\项目\\测试：企鹅\\銀河鉄道のペンギン\\storyboard_base.json';
const SHOTS = path.join(__dirname, 'shots');
const CTR_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_octa_proj_')), 'Octa.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  fs.mkdirSync(SHOTS, { recursive: true });

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'OctaQA',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');
  // 素材要放在项目目录（levelDir）里，预览才能按相对路径读到。
  const projDir = path.dirname(CTR_PATH);
  for (const a of ['octa.png', 'octa_dark.png', 'shadow.png']) {
    fs.copyFileSync(path.join(ASSET_DIR, a), path.join(projDir, a));
  }

  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
    const S = window.__sb.state;
    const parsed = window.SBEngine.json.parse(${JSON.stringify(fs.readFileSync(SB_FILE, 'utf8'))});
    const editable = window.SBEngine.storyboard.fromCompiled(parsed);
    const sprites = editable.sprites || [];
    S.storyboard.sprites = sprites;
    const ids = sprites.map((o) => o.id);
    const plane0 = sprites.find((o) => o.id === 'octa_plane_0');
    window.__sb.refreshAll();
    const ev = (id, t) => {
      const e = window.__sb.preview.compiled.sprites.find((x) => x.id === id);
      if (!e) return null;
      const r = window.SBEngine.storyboard.evaluateObject(e, t);
      return r && r.from ? r.from.rot_y : null;
    };
    const ry0 = ev('octa_plane_0', 0);
    const ry100 = ev('octa_plane_0', 100);
    const imgLoadRes = await Promise.race([
      window.__sb.preview.loadImage('octa.png').then(() => 'ok').catch(() => 'fail'),
      new Promise((r) => setTimeout(() => r('timeout'), 4000))
    ]);
    const imgLoaded = imgLoadRes === 'ok';
    // 像素检查：统计画布中冰蓝色系（八面体贴图）像素，确认确实渲染出来了。
    window.__sb.setTime(0.5, false);
    await new Promise((r) => setTimeout(r, 300));
    const cv = document.querySelector('#previewCanvas');
    const ctx = cv.getContext('2d');
    const info = window.__sb.preview.ctxInfo();
    const corners = {};
    for (const id of ['octa_plane_0', 'octa_plane_1', 'octa_plane_2', 'octa_shadow']) {
      const e = window.__sb.preview.compiled.sprites.find((x) => x.id === id);
      if (!e) { corners[id] = null; continue; }
      const er = window.SBEngine.storyboard.evaluateObject(e, 0.5);
      corners[id] = er ? window.__sb.preview.stageObjectCorners('sprite', { obj: e, from: er.from }, info) : null;
    }
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let icePx = 0;
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
      if (a > 40 && b > 100 && g > 80 && b >= r + 20) icePx++;
    }
    const shots = [];
    const frames = [];
    for (const t of [0.5, 50, 100, 150]) {
      window.__sb.setTime(t, false);
      await new Promise((r) => setTimeout(r, 350));
      shots.push(t);
      const cv = document.querySelector('#previewCanvas');
      frames.push({ t, data: cv ? cv.toDataURL('image/png') : null });
    }
    return {
      ids, plane0States: plane0 ? plane0.states.length : 0,
      ry0, ry100,
      charDur: S.chart ? S.chart.endTime : null,
      shots, frames, icePx, canvas: cv ? cv.width + 'x' + cv.height : null
      , corners, imgLoaded
    };
    } catch (e) { return { error: String(e && e.message || e), stack: String(e && e.stack || '') }; }
  })()`);

  if (out && out.error) {
    fs.writeFileSync(path.join(__dirname, 'probe_octa_example_out.json'), JSON.stringify({ rendererError: out.error, stack: out.stack }, null, 2));
    console.log('RENDERER ERROR:', out.error);
    app.exit(1);
    return;
  }
  for (const f of out.frames) {
    if (f.data) {
      fs.writeFileSync(path.join(SHOTS, `octa_t${String(f.t).replace('.', '_')}.png`), Buffer.from(f.data.split(',')[1], 'base64'));
    }
  }

  const result = {
    ids: out.ids,
    plane0States: out.plane0States,
    ry0: out.ry0,
    ry100: out.ry100,
    charDur: out.charDur,
    icePx: out.icePx,
    canvas: out.canvas,
    corners: out.corners,
    imgLoaded: out.imgLoaded,
    ok: out.ids.includes('octa_plane_0') && out.ids.includes('octa_plane_1') &&
      out.ids.includes('octa_plane_2') && out.ids.includes('octa_shadow') &&
      out.plane0States >= 1 &&
      out.ry0 != null && Math.abs(out.ry0) < 1 &&
      out.ry100 != null && out.ry100 > 100 &&
      out.icePx > 200
  };
  fs.writeFileSync(path.join(__dirname, 'probe_octa_example_out.json'), JSON.stringify(result, null, 2));
  console.log('OCTA_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_octa_example_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
