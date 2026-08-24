// Verify multi-keyframe batch delete: selecting keyframes (across objects)
// deletes only those keyframes, the initial keyframe can participate (first
// remaining state is promoted), and deleting the initial with no keyframes
// left removes the object. The right-click menu offers the batch delete item.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kbd_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_kbd_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kbd_proj_'));
const CTR_PATH = path.join(TMP, 'BatchDelete.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'BatchDelete',
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
    const t1 = { id: 't1', time: 0, text: 'A', opacity: 1, states: [
      { time: 2, text: 'B', opacity: 1 },
      { time: 4, text: 'C', opacity: 1 }
    ] };
    const t2 = { id: 't2', time: 0, text: 'X', opacity: 1, states: [
      { time: 3, text: 'Y', opacity: 1 }
    ] };
    const t3 = { id: 't3', time: 0, text: 'Z', opacity: 1, states: [] };
    S.storyboard.texts.push(t1, t2, t3);

    const selectKfs = async (kfs) => {
      S.selectedIds = [...new Set(kfs.map((k) => k.objId))];
      S.selectedKfs = kfs;
      S.selectedObjId = kfs[0].objId;
      S.selectedKeyIdx = kfs[0].index;
      window.__sb.refreshAll();
      window.__sb.timeline.setMultiSelection({ ids: S.selectedIds, kfs });
      await new Promise((r) => setTimeout(r, 120));
    };
    const menuDelete = async (objId, kfIdx) => {
      const kf = document.querySelector('.kf[data-id="' + objId + '"][data-kf="' + kfIdx + '"]');
      if (!kf) return null;
      const r = kf.getBoundingClientRect();
      kf.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 2, clientY: r.top + 2 }));
      await new Promise((r2) => setTimeout(r2, 80));
      const labels = [...document.querySelectorAll('#contextMenu .cm-item')].map((x) => x.textContent || '');
      const item = [...document.querySelectorAll('#contextMenu .cm-item')].find((x) => {
        const t = x.textContent || '';
        return t.indexOf('删除选中的') >= 0 || t.indexOf('删除初始关键帧') >= 0 || t.indexOf('删除关键帧') >= 0;
      });
      if (!item) return labels;
      item.click();
      await new Promise((r2) => setTimeout(r2, 150));
      return 'deleted';
    };

    // A) Batch delete keyframes across two objects (no initial).
    await selectKfs([
      { objId: 't1', index: 0 },
      { objId: 't1', index: 1 },
      { objId: 't2', index: 0 }
    ]);
    const menuA = await menuDelete('t1', 0);
    const a = {
      t1: { text: t1.text, states: (t1.states || []).map((s) => s.time) },
      t2: { text: t2.text, states: (t2.states || []).map((s) => s.time) },
      t1exists: S.storyboard.texts.some((o) => o.id === 't1'),
      t2exists: S.storyboard.texts.some((o) => o.id === 't2')
    };

    // B) Batch delete initial + first state: the remaining state is promoted.
    t1.states = [{ time: 2, text: 'B', opacity: 1 }, { time: 4, text: 'C', opacity: 1 }];
    await selectKfs([
      { objId: 't1', index: -1 },
      { objId: 't1', index: 0 }
    ]);
    const menuB = await menuDelete('t1', -1);
    const b = { time: t1.time, text: t1.text, states: (t1.states || []).map((s) => s.time) };

    // C) Deleting the initial with no keyframes left removes the object.
    await selectKfs([{ objId: 't3', index: -1 }]);
    const menuC = await menuDelete('t3', -1);
    const c = { gone: !S.storyboard.texts.some((o) => o.id === 't3') };

    return { a, b, c, menuA, menuB, menuC };
  })()`);

  const result = {
    batchA: out.a,
    promoteB: out.b,
    deleteObjC: out.c,
    menuA: out.menuA,
    menuB: out.menuB,
    menuC: out.menuC,
    ok: out.a && out.a.t1exists === true && out.a.t2exists === true &&
      out.a.t1.states.length === 0 && out.a.t2.states.length === 0 &&
      out.a.t1.text === 'A' && out.a.t2.text === 'X' &&
      out.b && out.b.time === 4 && out.b.text === 'C' && out.b.states.length === 0 &&
      out.c && out.c.gone === true &&
      Array.isArray(out.menuA) ? (out.menuA.indexOf('删除选中的 3 个关键帧') >= 0) : (out.menuA === 'deleted') &&
      Array.isArray(out.menuB) ? (out.menuB.indexOf('删除选中的 2 个关键帧') >= 0) : (out.menuB === 'deleted')
  };
  fs.writeFileSync(path.join(__dirname, 'probe_kf_batchdelete_out.json'), JSON.stringify(result, null, 2));
  console.log('KBD_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_kf_batchdelete_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
