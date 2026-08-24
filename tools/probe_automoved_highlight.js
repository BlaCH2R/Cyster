// Verify the temporary bright-yellow highlight on auto-moved/sorted blocks:
// victims of lane push (add-keyframe overlap), objects re-ordered by 整理轨道,
// and that the highlight clears on the next click.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_amh_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_amh_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_amh_proj_'));
const CTR_PATH = path.join(TMP, 'AutoMovedHighlight.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'AutoMovedHighlight',
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
    const A = { id: 'A', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1, states: [{ time: 3, opacity: 0.8 }] };
    const B = { id: 'B', path: 'bg.jpg', time: 5, opacity: 1, layer: 0, order: 0, states: [{ time: 8, opacity: 0.8 }] };
    S.storyboard.sprites.push(A, B);
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    window.__sb.selectObject('A', null);
    window.__sb.preview.setTime(6, false);
    window.__sb.addKeyframeAtPlayhead(A); // B 被自动挤到新轨道
    const markedAfterPush = S.autoMovedIds.has('B');
    const bClip = Array.from(document.querySelectorAll('.clip')).find((c) => c.dataset.id === 'B');
    const clipHighlight = bClip ? bClip.classList.contains('auto-moved') : false;

    // 下一次点击 → 高亮消失
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    const clearedAfterClick = S.autoMovedIds.size === 0;
    const bClip2 = Array.from(document.querySelectorAll('.clip')).find((c) => c.dataset.id === 'B');
    const clipHighlightGone = bClip2 ? !bClip2.classList.contains('auto-moved') : false;

    // 整理轨道：重叠对象 T1 被抬到上层（order 变化）→ 标记
    const S1 = { id: 'S1', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 0, states: [{ time: 3, opacity: 0.8 }] };
    const T1 = { id: 'T1', path: 'bg.jpg', time: 2, opacity: 1, layer: 0, order: 0, states: [{ time: 5, opacity: 0.8 }] };
    const V1 = { id: 'V1', path: 'bg.jpg', time: 6, opacity: 1, layer: 0, order: 0, states: [{ time: 9, opacity: 0.8 }] };
    S.storyboard.sprites = [S1, V1];
    S.storyboard.texts = [];
    S.storyboard.videos = [];
    S.storyboard.sprites.push(T1);
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks();
    const markedAfterOrganize = S.autoMovedIds.has('T1');
    const t1Clip = Array.from(document.querySelectorAll('.clip')).find((c) => c.dataset.id === 'T1');
    const organizeHighlight = t1Clip ? t1Clip.classList.contains('auto-moved') : false;

    return { markedAfterPush, clipHighlight, clearedAfterClick, clipHighlightGone,
      markedAfterOrganize, organizeHighlight, orders: [S1.order, T1.order, V1.order] };
  })()`);

  const result = {
    markedAfterPush: out.markedAfterPush,
    clipHighlight: out.clipHighlight,
    clearedAfterClick: out.clearedAfterClick,
    clipHighlightGone: out.clipHighlightGone,
    markedAfterOrganize: out.markedAfterOrganize,
    organizeHighlight: out.organizeHighlight,
    orders: out.orders,
    ok: out.markedAfterPush === true && out.clipHighlight === true &&
      out.clearedAfterClick === true && out.clipHighlightGone === true &&
      out.markedAfterOrganize === true && out.organizeHighlight === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_automoved_highlight_out.json'), JSON.stringify(result, null, 2));
  console.log('AMH_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_automoved_highlight_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
