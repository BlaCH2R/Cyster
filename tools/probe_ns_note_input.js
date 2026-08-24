// 验证：点击属性面板 Note 输入框 → note 选择器独立窗口自动切换显示该对象
// 已使用的选择器信息；窗口内改动（拾取/筛选）只进草稿，点击“应用”才写回对象。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ni_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_ni_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ni_proj_'));
const CTR_PATH = path.join(TMP, 'NoteInput.ctr');
const OUT = path.join(__dirname, 'probe_ns_note_input_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NoteInput',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const mainOut = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = {};
    S.storyboard.note_controllers = S.storyboard.note_controllers || [];
    const nc = { id: 'nc_note_input', note: [78, 5], time: 0, states: [] };
    S.storyboard.note_controllers.push(nc);
    window.__sb.refreshAll();
    await window.sbAPI.nsOpen();
    await sleep(800);
    window.__sb.selectObject('nc_note_input', -1);
    await sleep(150);
    const fNote = document.querySelector('#propBody #fNote');
    R.fNoteFound = !!fNote;
    if (fNote) {
      fNote.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      await sleep(200);
      const items = Array.from(document.querySelectorAll('#contextMenu .cm-item'));
      const edit = items.find((i) => i.textContent.indexOf('编辑note选择器') >= 0);
      R.menuFound = !!edit;
      if (edit) edit.click();
    }
    await sleep(500);
    const ctx = window.__sb.nsBridge('getContext', []);
    R.boundTarget = ctx && ctx.target ? { id: ctx.target.id, note: JSON.stringify(ctx.target.note) } : null;
    // 拾取一个新 note：只改草稿，对象保持原样（点击“应用”才写回）。
    window.__sb.pickNoteToSelector(1157);
    await sleep(200);
    R.noteAfterPick = JSON.stringify(nc.note);
    const ctxAfter = window.__sb.nsBridge('getContext', []);
    R.draftAfterPick = ctxAfter && ctxAfter.target ? JSON.stringify(ctxAfter.target.note) : null;
    return R;
  })()`);

  const out = { main: mainOut };
  const nsWin = BrowserWindow.getAllWindows().find((w) => w.getTitle().indexOf('Note 选择器') >= 0);
  out.windowFound = !!nsWin;
  if (nsWin) {
    await new Promise((r) => setTimeout(r, 800));
    out.winList = await nsWin.webContents.executeJavaScript(`(() => {
      const list = document.getElementById('nsList');
      return {
        listText: list ? list.innerText : null,
        status: (document.getElementById('nsStatus') || {}).textContent || ''
      };
    })()`);
  }
  // 筛选对象：点击 Note 输入框 → 窗口显示筛选表单；窗口内取消类型勾选
  // → 只改草稿；点击“应用”后才写回绑定对象的 note 字段。
  const filterBound = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ncF = { id: 'nc_filter', note: { type: [3, 4] }, time: 0, states: [] };
    S.storyboard.note_controllers.push(ncF);
    window.__sb.refreshAll();
    window.__sb.selectObject('nc_filter', -1);
    await sleep(150);
    const fNote2 = document.querySelector('#propBody #fNote');
    fNote2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await sleep(200);
    const items2 = Array.from(document.querySelectorAll('#contextMenu .cm-item'));
    const edit2 = items2.find((i) => i.textContent.indexOf('编辑note选择器') >= 0);
    if (edit2) edit2.click();
    await sleep(500);
    const c = window.__sb.nsBridge('getContext', []);
    return c && c.target ? c.target.id : null;
  })()`);
  out.filterBound = filterBound;
  if (nsWin) {
    await nsWin.webContents.executeJavaScript(`(() => {
      const cb = document.querySelector('#nsTypes input[data-t="3"]');
      if (!cb) return 'no-cb';
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      return 'changed';
    })()`);
    await new Promise((r) => setTimeout(r, 700));
    out.filterNoteBeforeApply = await win.webContents.executeJavaScript(`(() => {
      const nc = window.__sb.state.storyboard.note_controllers.find((n) => n.id === 'nc_filter');
      return nc ? JSON.stringify(nc.note) : null;
    })()`);
    await nsWin.webContents.executeJavaScript(`document.querySelector('#nsApply').click()`);
    await new Promise((r) => setTimeout(r, 400));
    out.filterNote = await win.webContents.executeJavaScript(`(() => {
      const nc = window.__sb.state.storyboard.note_controllers.find((n) => n.id === 'nc_filter');
      return nc ? JSON.stringify(nc.note) : null;
    })()`);
  }
  out.ok = !!(
    out.windowFound && out.main &&
    out.main.fNoteFound &&
    out.main.menuFound &&
    out.main.boundTarget && out.main.boundTarget.id === 'nc_note_input' &&
    out.main.boundTarget.note === '[78,5]' &&
    out.main.noteAfterPick === '[78,5]' &&
    out.main.draftAfterPick === '[78,5,1157]' &&
    out.winList && out.winList.listText && out.winList.listText.indexOf('#78') >= 0 &&
    out.winList.listText.indexOf('#5') >= 0 &&
    out.winList.listText.indexOf('#1157') >= 0 &&
    out.winList.status.indexOf('手动列表模式') >= 0 &&
    out.filterBound === 'nc_filter' &&
    out.filterNoteBeforeApply === '{"type":[3,4]}' &&
    out.filterNote === '{"type":[4]}'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NS_NOTE_INPUT:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
