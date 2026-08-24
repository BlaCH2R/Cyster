// 验证情形④（独立即让位）“保存→重开”后，sprite 的 note 选择器表达式是否
// 原样保留：note 字段、$note 时间表达式、parent_id 模板、carrier 覆盖范围
// （真实控制器覆盖的 note 已让位）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_s4r_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_s4r_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_s4r_proj_'));
const CTR_PATH = path.join(TMP, 'S4R.ctr');
const OUT = path.join(__dirname, 'probe_ns_s4_roundtrip_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'S4R',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.storyboard.note_controllers.push({ id: 'note_controller_1', note: 5, time: 0, opacity_multiplier: 0.8 });
    S.storyboard.sprites.push({
      id: 'sprite_1', path: 'octa.png', time: 'intro:$note', parent_id: 'parent_$note',
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.dirty = true;
    return true;
  })()`);
  await win.webContents.executeJavaScript(`window.__sb.nsBridge('apply', [{ id: 'sprite_1', note: { start: 0, end: 10 }, merge: true }])`);
  await new Promise((r) => setTimeout(r, 500));

  const snap = () => win.webContents.executeJavaScript(`(() => {
    const S = window.__sb.state;
    const spr = (S.storyboard.sprites || []).find((o) => o.id === 'sprite_1');
    const carrier = (S.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    const real = (S.storyboard.note_controllers || []).find((o) => o.id === 'note_controller_1');
    return {
      spriteNote: spr && spr.note,
      spriteTime: spr && spr.time,
      spriteStateTimes: (spr && spr.states || []).map((s) => s.time),
      spriteParentId: spr && spr.parent_id,
      carrierNotes: carrier ? carrier.note.slice().sort((a, b) => a - b) : null,
      realNote: real && real.note,
      realOpacity: real && real.opacity_multiplier
    };
  })()`);

  const R = {};
  R.before = await snap();
  R.save = await win.webContents.executeJavaScript(`(async () => {
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    return { ok, err };
  })()`);
  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR_PATH)} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
  R.after = await snap();

  const out = { R };
  out.same = JSON.stringify(R.before) === JSON.stringify(R.after);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('S4R:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
