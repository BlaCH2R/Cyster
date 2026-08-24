// Verify dragging/double-clicking a VIDEO asset from the library creates a
// Video object (not a sprite), while images still create sprites.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_avd_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_avd_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_avd_proj_'));
const CTR_PATH = path.join(TMP, 'AssetVideoDrop.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'AssetVideoDrop',
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
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.manualImages = ['clip.mp4', 'pic.png'];
    window.__sb.refreshAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(150);

    const dropAsset = (name) => {
      const dt = new DataTransfer();
      const tmp = document.createElement('div');
      tmp.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/asset-name', name));
      tmp.dispatchEvent(new DragEvent('dragstart', { bubbles: false, cancelable: true, dataTransfer: dt }));
      const wrap = document.querySelector('#previewWrap');
      const cr = wrap.getBoundingClientRect();
      wrap.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt,
        clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2 }));
    };

    dropAsset('clip.mp4');
    await sleep(150);
    const videoFromDrop = (S.storyboard.videos || []).filter((v) => v.path === 'clip.mp4').length;
    const spriteFromVideoDrop = (S.storyboard.sprites || []).filter((s) => s.path === 'clip.mp4').length;

    dropAsset('pic.png');
    await sleep(150);
    const spriteFromImage = (S.storyboard.sprites || []).filter((s) => s.path === 'pic.png').length;
    const videoFromImageDrop = (S.storyboard.videos || []).filter((v) => v.path === 'pic.png').length;

    // 双击视频素材也应创建 Video 对象。
    const items = Array.from(document.querySelectorAll('#assetList .asset-item'));
    const videoItem = items.find((el) => el.textContent.indexOf('clip.mp4') >= 0);
    videoItem.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await sleep(150);
    const videoFromDbl = (S.storyboard.videos || []).filter((v) => v.path === 'clip.mp4').length;

    return { videoFromDrop, spriteFromVideoDrop, spriteFromImage, videoFromImageDrop, videoFromDbl };
  })()`);

  out.ok = !!(
    out.videoFromDrop === 1 && out.spriteFromVideoDrop === 0 &&
    out.spriteFromImage === 1 && out.videoFromImageDrop === 0 &&
    out.videoFromDbl === 2
  );
  fs.writeFileSync(path.join(__dirname, 'probe_asset_video_drop_out.json'), JSON.stringify(out, null, 2));
  console.log('AVD_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_asset_video_drop_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
