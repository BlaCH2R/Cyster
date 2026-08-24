// 验证属性页 Parent_id / Target_id 选项的按类型可见性：
//  - Parent_id：仅 texts / sprites 显示
//  - Target_id：仅场景对象（sprites / texts / videos / lines）显示
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ptv_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ptv_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ptv_proj_'));
const CTR_PATH = path.join(TMP, 'PTV.ctr');
const OUT = path.join(__dirname, 'probe_parent_target_visibility_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));
  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'PTV', music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))}, background: null, storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.storyboard.sprites.push({ id: 'spr', path: 'octa.png', time: 0, x: 'stagex:0', y: 'stagey:0', opacity: 1, layer: 2, order: 0 });
    S.storyboard.texts.push({ id: 'txt', text: 'hi', time: 0, x: 'stagex:0', y: 'stagey:0', opacity: 1, layer: 2, order: 0 });
    S.storyboard.videos.push({ id: 'vid', path: 'video.mp4', time: 0, x: 'stagex:0', y: 'stagey:0', opacity: 1, layer: 2, order: 0 });
    S.storyboard.lines.push({ id: 'ln', time: 0, pos: [{ x: 0, y: 0 }, { x: 1, y: 1 }], layer: 2, order: 0 });
    S.storyboard.controllers.push({ id: 'ctl', time: 0, camera_x: 0 });
    S.storyboard.note_controllers.push({ id: 'nc', note: 0, time: 0 });
    window.__sb.refreshAll();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    for (const id of ['spr', 'txt', 'vid', 'ln', 'ctl', 'nc']) {
      window.__sb.selectObject(id, -1);
      await new Promise((r) => setTimeout(r, 250));
      out[id] = {
        hasParentId: !!document.querySelector('#fParentId'),
        hasTargetId: !!document.querySelector('#fTargetId')
      };
    }
    return out;
  })()`);

  const out = { R };
  const expect = {
    spr: { hasParentId: true, hasTargetId: true },
    txt: { hasParentId: true, hasTargetId: true },
    vid: { hasParentId: false, hasTargetId: true },
    ln: { hasParentId: false, hasTargetId: true },
    ctl: { hasParentId: false, hasTargetId: false },
    nc: { hasParentId: false, hasTargetId: false }
  };
  out.ok = Object.keys(expect).every((k) =>
    R[k] && R[k].hasParentId === expect[k].hasParentId && R[k].hasTargetId === expect[k].hasTargetId);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('PTV:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
