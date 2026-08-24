// Probe: reproduces "shrink note-selector range" behavior in one live session
// using the app's real functions: write-back, toCompiled, fromCompiled +
// reconstructNoteSelectors (reopen simulation), and deleteSelection. Reports
// whether excluded notes leave stale data / orphan blocks and whether the
// merged note_controller stays editable/deletable.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_ss_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_selector_shrink_out.json");
const LOG = path.join(__dirname, "probe_selector_shrink_log.txt");
const log = (m) => fs.appendFileSync(LOG, new Date().toISOString() + " " + m + "\n");
const CHART = [
  "PAGE_SIZE 10", "PAGE_SHIFT 1",
  "NOTE 0 1 2", "NOTE 1 1 3", "NOTE 2 1 4", "NOTE 3 1 5"
].join("\n");

function buildInfo(storyboard) {
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.ss", title: "Selector Shrink Probe",
      music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }]
    },
    levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
    files: [],
    charts: [{
      type: "easy", path: "chart.easy.txt", content: CHART,
      storyboardPath: "storyboard.json", storyboardContent: storyboard
    }]
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    log("start");
    await sleep(2000);
    log("window wait done");
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const authorSb = JSON.stringify({
      sprites: [], texts: [], videos: [], lines: [], controllers: [],
      note_controllers: [{ id: "nc1", note: [0, 1, 2], time: 1, states: [{ time: 2, x: 0.7 }] }],
      templates: {}
    });
    log("loading level");
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(authorSb))})`);
    await sleep(2500);
    log("level loaded");
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);
    log("modal closed");

    const out = await win.webContents.executeJavaScript(`(async () => {
      const sb = window.SBEngine.storyboard;
      const __ = window.__sb;
      const R = {};
      const list = () => __.state.storyboard.note_controllers.map(nc => ({
        id: nc.id, note: nc.note, states: (nc.states || []).length
      }));

      // --- 场景 A：健康作者格式 [0,1,2] 缩小为 [0] ---
      R.A_before = list();
      __.nsBridge('apply', [{ id: 'nc1', note: [0], merge: true }]);
      window.__probeStep = 'A_after';
      R.A_after = list();
      const readClip = () => {
        const clip = document.querySelector('.clip[data-id="nc1"]');
        const cnt = clip && clip.querySelector('.clip-count');
        return clip ? {
          left: clip.style.left, width: clip.style.width,
          count: cnt ? cnt.textContent : null,
          cls: clip.className
        } : null;
      };
      R.A_clipAfterApply = readClip();
      // 关闭合并：应立即切换为逐 note 拆分块
      __.nsBridge('apply', [{ id: 'nc1', note: [0, 1], merge: false }]);
      R.A_clipsUnmerged = [...document.querySelectorAll('.clip[data-id^="nc1::"]')]
        .map(c => ({ id: c.dataset.id, left: c.style.left, width: c.style.width }))
        .slice(0, 4);
      // 恢复合并并重新缩小（供后续场景使用）
      __.nsBridge('apply', [{ id: 'nc1', note: [0], merge: true }]);
      const Acomp = sb.toCompiled(__.state.storyboard, __.state.chart);
      window.__probeStep = 'A_compiled';
      R.A_compiled = Acomp.note_controllers.map(c => ({ id: c.Id, note: (c.States[0] || {}).Note }));
      const Ameta = __.collectNoteSelectorMeta();
      window.__probeStep = 'A_meta';
      let Are = sb.fromCompiled(Acomp);
      window.__probeStep = 'A_fromCompiled';
      __.reconstructNoteSelectors(Are, Ameta);
      window.__probeStep = 'A_reconstruct';
      R.A_reopened = Are.note_controllers.map(nc => ({ id: nc.id, note: nc.note }));

      // --- 场景 B：先单独拆出 note 4，再缩小选择器到 [3] ---
      const split = __.createNoteControllerWithIdHandoff([1]);
      window.__probeStep = 'B_split';
      R.B_split = { id: split.id, note: split.note };
      __.nsBridge('apply', [{ id: 'nc1', note: [0], merge: true }]);
      window.__probeStep = 'B_after';
      R.B_after = list();
      const Bcomp = sb.toCompiled(__.state.storyboard, __.state.chart);
      window.__probeStep = 'B_compiled';
      R.B_compiled = Bcomp.note_controllers.map(c => ({ id: c.Id, note: (c.States[0] || {}).Note }));
      const Bmeta = __.collectNoteSelectorMeta();
      let Bre = sb.fromCompiled(Bcomp);
      window.__probeStep = 'B_fromCompiled';
      __.reconstructNoteSelectors(Bre, Bmeta);
      window.__probeStep = 'B_reconstruct';
      R.B_reopened = Bre.note_controllers.map(nc => ({ id: nc.id, note: nc.note }));

      // --- 场景 C：缩小后 deleteSelection（K0）应整块删除合并块 ---
      __.state.selectedIds = ['nc1'];
      __.state.selectedKfs = [{ objId: 'nc1', index: -1 }];
      __.state.selectedKeyIdx = -1;
      window.__probeStep = 'C_beforeDelete';
      __.deleteSelection();
      window.__probeStep = 'C_deleted';
      R.C_afterDelete = list();
      R.C_mergedGone = !__.state.storyboard.note_controllers.some(x => x.id === 'nc1');

      // --- 场景 G：缩小到 2 个 note 后保存，.ctr meta 仍是旧 [0,1,2] ---
      // 修复前 reconstruct 会把 note 2 复活；修复后应以克隆为准得到 [0,1]。
      let ncG = __.state.storyboard.note_controllers.find(x => x.id === 'nc1');
      if (!ncG) {
        ncG = { id: 'nc1', note: [0, 1, 2], time: 1, states: [{ time: 2, x: 0.7 }] };
        __.state.storyboard.note_controllers.push(ncG);
      }
      __.nsBridge('apply', [{ id: 'nc1', note: [0, 1], merge: true }]);
      const Gcomp = sb.toCompiled(__.state.storyboard, __.state.chart);
      R.G_compiled = Gcomp.note_controllers.map(c => ({ id: c.Id, note: (c.States[0] || {}).Note }));
      const GstaleMeta = {
        "note_controllers::nc1": {
          group: "note_controllers", id: "nc1",
          note: [0, 1, 2], notes: [0, 1, 2],
          parent_id: null, time: "start:$note", states: []
        }
      };
      let Gre = sb.fromCompiled(Gcomp);
      __.reconstructNoteSelectors(Gre, GstaleMeta);
      R.G_reopened = Gre.note_controllers.map(nc => ({ id: nc.id, note: nc.note }));

      // --- 场景 H：克隆形状不一致（state 数不同）+ 无 meta：自愈应合并 ---
      const Hinfo = {
        level: { schema_version: 2, version: 1, id: "probe.h", title: "H",
          music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }] },
        levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
        files: [],
        charts: [{
          type: "easy", path: "chart.easy.txt",
          content: "PAGE_SIZE 10\\nPAGE_SHIFT 1\\nNOTE 0 1 2\\nNOTE 1 1 3\\n",
          storyboardPath: "storyboard.json",
          storyboardContent: JSON.stringify({
            compiled: true,
            sprites: [], texts: [], videos: [], lines: [], controllers: [],
            note_controllers: [
              { Id: "hc::0", States: [{ Time: 1, Easing: 0, X: 0.5 }] },
              { Id: "hc::1", States: [{ Time: 1, Easing: 0, X: 0.5 }, { Time: 2, Easing: 0, X: 0.8 }] }
            ]
          })
        }]
      };
      document.getElementById('modalMask').classList.add('hidden');
      await __.loadLevelInfo(Hinfo);
      R.H_beforeHeal = (() => {
        const pre = sb.fromCompiled(JSON.parse(Hinfo.charts[0].storyboardContent));
        return pre.note_controllers.map(nc => ({
          id: nc.id, note: nc.note, states: (nc.states || []).map(s => ({ time: s.time, x: s.x }))
        }));
      })();
      R.H_afterLoad = __.state.storyboard.note_controllers.map(nc => ({
        id: nc.id, note: nc.note, states: (nc.states || []).map(s => ({ time: s.time, x: s.x }))
      }));

      // --- 场景 I：$note 时间表达式的合并块缩小筛选 ---
      const Iinfo = {
        level: { schema_version: 2, version: 1, id: "probe.i", title: "I",
          music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }] },
        levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
        files: [],
        charts: [{
          type: "easy", path: "chart.easy.txt",
          content: "PAGE_SIZE 10\\nPAGE_SHIFT 1\\nNOTE 0 1 2\\nNOTE 1 1 3\\nNOTE 2 1 4\\n",
          storyboardPath: "storyboard.json",
          storyboardContent: JSON.stringify({
            sprites: [], texts: [], videos: [], lines: [], controllers: [],
            note_controllers: [{
              id: "ic1", note: [0, 1, 2], time: "start:$note",
              states: [{ time: "start:$note:0.5", x: 0.7 }]
            }],
            templates: {}
          })
        }]
      };
      document.getElementById('modalMask').classList.add('hidden');
      await __.loadLevelInfo(Iinfo);
      const IclipBefore = (() => {
        const clip = document.querySelector('.clip[data-id="ic1"]');
        const cnt = clip && clip.querySelector('.clip-count');
        return clip ? { left: clip.style.left, width: clip.style.width, count: cnt ? cnt.textContent : null } : null;
      })();
      let Ierr = null;
      try {
        __.nsBridge('apply', [{ id: 'ic1', note: [0], merge: true }]);
      } catch (e) {
        Ierr = String(e && e.stack || e);
      }
      const IclipAfter = (() => {
        const clip = document.querySelector('.clip[data-id="ic1"]');
        const cnt = clip && clip.querySelector('.clip-count');
        return clip ? { left: clip.style.left, width: clip.style.width, count: cnt ? cnt.textContent : null } : null;
      })();
      R.I = { before: IclipBefore, after: IclipAfter, err: Ierr,
        note: __.state.storyboard.note_controllers.find(x => x.id === 'ic1').note };
      window.__probeStep = 'done';
      return R;
    })()`);
    log("page script done");
    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    log("error: " + String(err && err.stack || err));
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    log("finally");
    clearTimeout(timer);
    app.exit(0);
  }
});
