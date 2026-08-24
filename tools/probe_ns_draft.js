// 验证 note 选择器编辑器“点击应用才生效”的草稿语义：
//  - 筛选/拾取改动只进草稿，对象保持原样
//  - discard（关闭窗口未应用）后对象仍为原值
//  - 点击 apply 后草稿写回对象
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nsd_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_nsd_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nsd_proj_'));
const CTR_PATH = path.join(TMP, 'NsDraft.ctr');
const OUT = path.join(__dirname, 'probe_ns_draft_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NsDraft',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.storyboard.note_controllers.push({ id: 'nc_1', note: { type: [3, 4] }, time: 0 });
    S.dirty = true;
    window.__sb.refreshAll();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const obj = () => window.__sb.state.storyboard.note_controllers.find((x) => x.id === 'nc_1');
    const snap = (v) => JSON.parse(JSON.stringify(v));
    // 1) 绑定（apply 会初始化草稿并提交一次筛选值）
    let r = window.__sb.nsBridge('apply', [{ id: 'nc_1', note: { type: [3, 4] }, merge: false }]);
    out.bindOk = !!(r && r.ok);
    // 2) 筛选草稿：draft 更新但对象不变
    window.__sb.nsBridge('draft', [{ note: { type: [0], start: 0, end: 5 } }]);
    out.filterObjectUnchanged = JSON.stringify(obj().note) === JSON.stringify({ type: [3, 4] });
    const ctxDraft = window.__sb.nsBridge('getContext');
    out.draftShown = JSON.stringify(ctxDraft.target.note) === JSON.stringify({ type: [0], start: 0, end: 5 });
    // 3) 拾取草稿：pick 只改草稿
    window.__sb.pickNoteToSelector(7);
    out.pickObjectUnchanged = JSON.stringify(obj().note) === JSON.stringify({ type: [3, 4] });
    const ctxAfterPick = window.__sb.nsBridge('getContext');
    out.pickDraftIsArray = Array.isArray(ctxAfterPick.target.note);
    out.pickDraftHas7 = Array.isArray(ctxAfterPick.target.note) && ctxAfterPick.target.note.includes(7);
    // 4) discard（模拟关闭窗口未应用）：对象保持原样
    window.__sb.nsBridge('discard');
    out.afterDiscardUnchanged = JSON.stringify(obj().note) === JSON.stringify({ type: [3, 4] });
    // 丢弃后上下文回到对象原值（不再是草稿数组）。
    out.afterDiscardShowsOriginal = JSON.stringify(window.__sb.nsBridge('getContext').target.note) === JSON.stringify({ type: [3, 4] });
    // 5) 重新绑定 + 草稿后 apply：写回对象
    window.__sb.nsBridge('apply', [{ id: 'nc_1', note: { type: [3, 4] }, merge: false }]);
    window.__sb.pickNoteToSelector(7);
    const finalDraft = window.__sb.nsBridge('getContext').target.note;
    r = window.__sb.nsBridge('apply', [{ id: 'nc_1', note: finalDraft, merge: false }]);
    out.applyOk = !!(r && r.ok);
    out.afterApplyArray = Array.isArray(obj().note);
    out.afterApplyHas7 = Array.isArray(obj().note) && obj().note.includes(7);
    out.afterApplyLen = Array.isArray(obj().note) ? obj().note.length : -1;
    return out;
  })()`);

  const out = { R };
  out.ok = !!(
    R.bindOk && R.filterObjectUnchanged && R.draftShown &&
    R.pickObjectUnchanged && R.pickDraftIsArray && R.pickDraftHas7 &&
    R.afterDiscardUnchanged && R.afterDiscardShowsOriginal &&
    R.applyOk && R.afterApplyArray && R.afterApplyHas7 && R.afterApplyLen > 0
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NS_DRAFT:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
