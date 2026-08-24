// Real-project reproduction: load 雪女's storyboard + .ctr timeline config,
// run 整理轨道, and inspect where the locked order-99 lane (sprite_12) ends up.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_yok_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_yok_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_yok_proj_'));
const CTR_PATH = path.join(TMP, 'YukionnaOrganize.ctr');
const SRC = 'V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女';

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'YukionnaOrganize',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const parsed = window.SBEngine.json.parse(${JSON.stringify(fs.readFileSync(path.join(SRC, 'storyboard.json'), 'utf8'))});
    const editable = window.SBEngine.storyboard.fromCompiled(parsed);
    for (const k of Object.keys(editable)) S.storyboard[k] = editable[k];
    const ctr = ${JSON.stringify(fs.readFileSync(path.join(SRC, '雪女.ctr'), 'utf8'))};
    const cfg = JSON.parse(ctr);
    S.projectConfig.editor = cfg.editor || {};
    window.__sb.refreshAll();

    const laneInfo = () => {
      const tg = (window.__sb.readCysterTrackGroups() || {}).stage || [];
      return tg.map((lane) => {
        const e = lane.map((id) => (S.storyboard.sprites || []).find((o) => o.id === id) ||
          (S.storyboard.texts || []).find((o) => o.id === id) ||
          (S.storyboard.videos || []).find((o) => o.id === id) ||
          (S.storyboard.lines || []).find((o) => o.id === id)).find(Boolean);
        return { first: lane[0], layer: e ? (e.layer != null ? e.layer : 0) : null, order: e ? (e.order != null ? e.order : 0) : null };
      });
    };
    const pre = laneInfo();
    const pre12 = pre.findIndex((l) => l.first === 'sprite_12');
    const pre2 = pre.findIndex((l) => l.first === 'sprite_2');
    const preDisplay = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());

    window.__sb.timeline.organizeTracks();
    const post = laneInfo();
    const post12 = post.findIndex((l) => l.first === 'sprite_12');
    const post2 = post.findIndex((l) => l.first === 'sprite_2');
    const postDisplay = Array.from(document.querySelectorAll('.tlh-lane .nm')).map((el) => el.textContent.trim());
    const orders = post.map((l) => l.order);
    const layers = post.map((l) => l.layer);

    return { pre, pre12, pre2, preDisplay, post, post12, post2, postDisplay, orders, layers,
      lockedOrders: S.projectConfig.editor.timeline ? S.projectConfig.editor.timeline.lockedOrders : null };
  })()`);

  const result = {
    pre: out.pre,
    pre12: out.pre12, pre2: out.pre2,
    post: out.post,
    post12: out.post12, post2: out.post2,
    orders: out.orders, layers: out.layers,
    lockedOrders: out.lockedOrders
  };
  fs.writeFileSync(path.join(__dirname, 'probe_yukionna_organize_out.json'), JSON.stringify(result, null, 2));
  console.log('YOK_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_yukionna_organize_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
