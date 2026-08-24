// Verify the misc fixes:
//  1) marquee-selecting keyframes jumps to the keyframe editor even when the
//     panel was showing merged-lane info or controller live stats
//  2) editing the time input directly keeps the keyframe (plain numeric
//     strings are normalized so resolveTime still finds it)
//  3) hidden objects can no longer be picked in the preview
//  4) note context menu offers 复制noteX / 复制noteY
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fix_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_fix_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fix_proj_'));
const CTR_PATH = path.join(TMP, 'FixMisc.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'FixMisc',
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
    const D = { id: 'D', path: 'bg.jpg', time: 0, opacity: 1, layer: 0, order: 1,
      states: [{ time: 3, opacity: 0.7 }, { time: 7, opacity: 0.5 }] };
    S.storyboard.sprites.push(D);
    window.__sb.refreshAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(150);

    // 1a) 从“合并轨道信息”视图框选关键帧 → 跳到关键帧编辑。
    S.selectedLane = { objs: [{ id: 'D', type: 'sprite' }] };
    S.selectedObjId = null;
    S.selectedIds = [];
    S.previewEmptyFocus = false;
    window.__sb.refreshAll();
    await sleep(120);
    const laneInfoShown = !!document.querySelector('#propBody .lane-info-item');
    window.__sb.timeline.applyMarquee(0, 0, 2000, 2000, false);
    await sleep(80);
    const afterMarqueeLane = {
      laneInfoShown,
      laneCleared: S.selectedLane === null,
      objSelected: S.selectedObjId === 'D',
      kfsSelected: (S.selectedKfs || []).length > 0,
      formShown: !!document.querySelector('#propBody #stateForm')
    };

    // 1b) 从“controller 实时统计”视图框选关键帧 → 跳到关键帧编辑。
    S.previewEmptyFocus = true;
    S.selectedLane = null;
    S.selectedObjId = null;
    S.selectedIds = [];
    window.__sb.refreshAll();
    await sleep(120);
    const liveShown = !!document.querySelector('#propBody [data-live-stat]');
    window.__sb.timeline.applyMarquee(0, 0, 2000, 2000, false);
    await sleep(80);
    const afterMarqueeLive = {
      liveShown,
      emptyFocusCleared: S.previewEmptyFocus === false,
      objSelected: S.selectedObjId === 'D',
      formShown: !!document.querySelector('#propBody #stateForm')
    };

    // 2) 直接修改时间输入框：纯数字字符串归一化，关键帧不丢失。
    window.__sb.setTime(3, false);
    window.__sb.selectObject('D', 0);
    await sleep(120);
    const timeInput = Array.from(document.querySelectorAll('#stateForm .field input[type=text]'))
      .find((el) => {
        const lbl = el.closest('.field') && el.closest('.field').querySelector('label');
        return lbl && lbl.textContent.indexOf('时间') >= 0;
      });
    const kfBefore = document.querySelectorAll('#tlContent .kf').length;
    timeInput.value = '5';
    timeInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120);
    const afterTimeEdit = {
      timeType: typeof D.states[0].time,
      timeValue: D.states[0].time,
      kfBefore,
      kfAfter: document.querySelectorAll('#tlContent .kf').length,
      keyInList: !!document.querySelector('#keyList .key-item[data-kf="0"]')
    };

    // 3) 隐藏对象在预览中不可选中。
    const S2 = { id: 'S2', path: 'bg.jpg', time: 0, opacity: 1,
      x: 'stagex:0', y: 'stagey:0', width: 5, height: 5, layer: 2, order: 0 };
    S.storyboard.sprites = [S2];
    S.pickMode = 'stage';
    S.objHidden = { S2: true };
    window.__sb.refreshAll();
    await sleep(150);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    const clickCenter = async () => {
      cv.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true,
        clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2 }));
      await sleep(100);
    };
    await clickCenter();
    const hiddenNotSelected = S.selectedObjId !== 'S2';
    delete S.objHidden.S2;
    window.__sb.refreshAll();
    await sleep(150);
    await clickCenter();
    const visibleSelected = S.selectedObjId === 'S2';

    // 4) note 右键菜单包含 复制noteX / 复制noteY。
    S.pickMode = 'note';
    S.previewEmptyFocus = false;
    const note = S.chart.notes[Math.floor(S.chart.notes.length / 2)];
    window.__sb.setTime(note.start_time, false);
    await sleep(120);
    const info = window.__sb.preview.ctxInfo();
    const pos = window.__sb.preview.notePos(note, info);
    const cr2 = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: cr2.left + pos.x * (cr2.width / cv.width),
      clientY: cr2.top + pos.y * (cr2.height / cv.height) }));
    await sleep(60);
    const menuItems = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
    const noteMenu = { hasCopyX: menuItems.includes('复制noteX'), hasCopyY: menuItems.includes('复制noteY'), items: menuItems };

    return { afterMarqueeLane, afterMarqueeLive, afterTimeEdit, hiddenNotSelected, visibleSelected, noteMenu };
  })()`);

  out.ok = !!(
    out.afterMarqueeLane && out.afterMarqueeLane.laneInfoShown &&
    out.afterMarqueeLane.laneCleared && out.afterMarqueeLane.objSelected &&
    out.afterMarqueeLane.kfsSelected && out.afterMarqueeLane.formShown &&
    out.afterMarqueeLive && out.afterMarqueeLive.liveShown &&
    out.afterMarqueeLive.emptyFocusCleared && out.afterMarqueeLive.objSelected &&
    out.afterMarqueeLive.formShown &&
    out.afterTimeEdit && out.afterTimeEdit.timeType === 'number' &&
    out.afterTimeEdit.timeValue === 5 &&
    out.afterTimeEdit.kfAfter === out.afterTimeEdit.kfBefore &&
    out.afterTimeEdit.keyInList &&
    out.hiddenNotSelected && out.visibleSelected &&
    out.noteMenu && out.noteMenu.hasCopyX && out.noteMenu.hasCopyY
  );
  fs.writeFileSync(path.join(__dirname, 'probe_fix_misc_out.json'), JSON.stringify(out, null, 2));
  console.log('FIX_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_fix_misc_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
