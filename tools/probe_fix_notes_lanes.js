// Verify:
//  1) locked order lanes cannot be dropped INTO while dragging a time block,
//     and the dragged block stays reorderable afterwards (no more stuck state)
//  2) hold/long-hold note context menu has 跳转至hold/longhold结束时间
//  3) drag/C-drag note context menu has 选择整条锁链 (selects the whole chain)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_notes_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_notes_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_notes_proj_'));
const CTR_PATH = path.join(TMP, 'NotesLanes.ctr');
const CHART = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\chart.base.txt', 'utf8');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NotesLanes',
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
    S.chart = new window.SBEngine.chart.Chart(${JSON.stringify(CHART)}, {});
    S.chartText = ${JSON.stringify(CHART)};
    window.__sb.preview.chart = S.chart;
    const mk = (id, t0, t1, order) => ({ id, path: 'bg.jpg', time: t0, opacity: 1, layer: 0, order,
      states: [{ time: t1, opacity: 0.8 }] });
    const A = mk('A', 0, 3, 1);
    const B = mk('B', 0, 3, 0);
    const C = mk('C', 0, 3, 2);
    S.storyboard = { sprites: [A, B, C], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.pickMode = 'stage';
    // 锁定 order 0（B 所在层级）：与真实 UI 一致写入 .ctr 持久化配置，
    // 否则 renderTimeline 会用持久化配置覆盖运行时加的锁。
    S.projectConfig = S.projectConfig || {};
    S.projectConfig.editor = S.projectConfig.editor || {};
    S.projectConfig.editor.timeline = {
      version: 5,
      trackGroups: { stage: [], note_controller: [], controller: [] },
      lockedOrders: [0]
    };
    window.__sb.timeline.lockedOrders.add(0);
    window.__sb.refreshAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(180);
    const lockedOrdersAfter = [...window.__sb.timeline.lockedOrders];
    const laneOrders = Array.from(document.querySelectorAll('.lane-row')).map((r) => r.dataset.laneOrder);

    // ---- 1) 锁定层级拖入测试 ----
    const rowFor = (id) => Array.from(document.querySelectorAll('.lane-row'))
      .find((r) => r.querySelector('.clip[data-id="' + id + '"]'));
    const dragTo = async (id, targetId) => {
      const clip = document.querySelector('.clip[data-id="' + id + '"]');
      if (!clip) return false;
      const rc = clip.getBoundingClientRect();
      const sx = rc.left + rc.width / 2, sy = rc.top + rc.height / 2;
      clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 0 }));
      await sleep(40);
      const selectedAfterDown = S.selectedObjId;
      // mousedown 会重渲染轨道（selectObject），目标行元素已失效：重新查询。
      const target = rowFor(targetId);
      if (!target) { document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: sx, clientY: sy })); return false; }
      const rr = target.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true,
        clientX: sx, clientY: rr.top + rr.height / 2 }));
      await sleep(60);
      const reorderActive = document.querySelector('#tlContent').classList.contains('reorder-active');
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true,
        clientX: sx, clientY: rr.top + rr.height / 2 }));
      await sleep(150);
      return { ok: true, selectedAfterDown, reorderActive };
    };
    // A(1) 拖到锁定层 B(0)：应被跳过，A 保持 order 1。
    const draggedLocked = await dragTo('A', 'B');
    const afterLockedDrag = {
      ...draggedLocked,
      aOrder: A.order, bOrder: B.order, cOrder: C.order
    };
    await sleep(450); // 避免与上一次 A 的 mousedown 触发双击检测
    // A 再拖到 C(2)：应正常换层（证明没有卡死）。
    const draggedFree = await dragTo('A', 'C');
    const afterFreeDrag = { ...draggedFree, aOrder: A.order, cOrder: C.order, bOrder: B.order };

    // ---- 2/3) note 右键菜单 ----
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    const rightClickNote = async (note) => {
      window.__sb.setTime(note.start_time, false);
      await sleep(120);
      const info = window.__sb.preview.ctxInfo();
      const pos = window.__sb.preview.notePos(note, info);
      cv.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
        clientX: cr.left + pos.x * (cr.width / cv.width),
        clientY: cr.top + pos.y * (cr.height / cv.height) }));
      await sleep(60);
    };
    const menuTexts = () => Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
    const clickMenu = (label) => {
      const item = Array.from(document.querySelectorAll('#contextMenu .cm-item')).find((el) => el.textContent === label);
      if (!item) return false;
      item.click();
      return true;
    };

    const holdNote = S.chart.notes.find((n) => n.type === 1 || n.type === 2);
    let holdMenu = null, holdJumpOk = false;
    if (holdNote) {
      await rightClickNote(holdNote);
      holdMenu = { hasJump: menuTexts().includes('跳转至hold/longhold结束时间'), items: menuTexts() };
      const before = window.__sb.preview.time;
      const clicked = clickMenu('跳转至hold/longhold结束时间');
      await sleep(80);
      holdJumpOk = clicked && Math.abs(window.__sb.preview.time - holdNote.end_time) < 1e-6;
    }

    const dragHead = S.chart.notes.find((n) => n.type === 3);
    let dragMenu = null, chainSelected = false, chainIds = null;
    if (dragHead) {
      const expected = [];
      let cur = dragHead;
      let guard = 0;
      while (cur && guard++ < 1000) {
        expected.push('note::' + cur.id);
        cur = cur.next_id > 0 ? S.chart.noteById(cur.next_id) : null;
      }
      chainIds = expected;
      await rightClickNote(dragHead);
      dragMenu = { hasChain: menuTexts().includes('选择整条锁链'), items: menuTexts() };
      const clicked = clickMenu('选择整条锁链');
      await sleep(100);
      chainSelected = clicked && expected.length > 1 &&
        JSON.stringify(S.selectedIds.slice().sort()) === JSON.stringify(expected.slice().sort());
    }

    return { afterLockedDrag, afterFreeDrag, lockedOrdersAfter, laneOrders, holdMenu, holdJumpOk, dragMenu, chainSelected, chainIds };
  })()`);

  out.ok = !!(
    out.afterLockedDrag && out.afterLockedDrag.ok &&
    out.afterLockedDrag.aOrder === 1 && out.afterLockedDrag.bOrder === 0 &&
    out.afterFreeDrag && out.afterFreeDrag.ok && out.afterFreeDrag.aOrder === 2 &&
    out.afterFreeDrag.cOrder === 1 && out.afterFreeDrag.bOrder === 0 &&
    out.holdMenu && out.holdMenu.hasJump && out.holdJumpOk &&
    out.dragMenu && out.dragMenu.hasChain && out.chainSelected
  );
  fs.writeFileSync(path.join(__dirname, 'probe_fix_notes_lanes_out.json'), JSON.stringify(out, null, 2));
  console.log('NOTES_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_fix_notes_lanes_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
