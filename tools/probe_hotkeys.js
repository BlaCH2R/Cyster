// 验证快捷键：
//  Shift（预览聚焦）开启/关闭 Note ID 显示；预览外/输入框激活时不生效
//  Z（无 Ctrl）呼出/隐藏缩放滑条；输入框激活时不生效
//  CapsLock（预览聚焦）隐藏/显示全部 note；预览外不生效
//  Tab（预览聚焦）隐藏/显示 UI（含扫描线/边界/事件文字）；预览外/输入框避让
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_hk_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_hk_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_hk_proj_'));
const CTR_PATH = path.join(TMP, 'Hotkeys.ctr');
const OUT = path.join(__dirname, 'probe_hotkeys_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));
  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Hotkeys',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const PV = window.__sb.preview;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = {};
    const scroll = document.querySelector('#previewScroll');
    const key = (code, target) => {
      const t = target || document;
      t.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    };
    const zoomVisible = () => !document.querySelector('#zoomControls').classList.contains('hidden');
    const noteHidden = () => !!(S.groupHidden && S.groupHidden.note_controllers);

    // 预览外：Shift/CapsLock 不生效
    S.previewFocused = false;
    PV.ui.showNoteIds = true;
    PV.ui.show = true;
    key('ShiftLeft');
    await sleep(30);
    R.shiftOutside = PV.ui.showNoteIds;
    S.groupHidden = {};
    key('CapsLock');
    await sleep(30);
    R.capsOutside = noteHidden();
    key('Tab');
    await sleep(30);
    R.tabOutside = PV.ui.show;

    // 预览聚焦：Shift 切换 ID 显示、CapsLock 切换全部 note
    scroll.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(30);
    R.focused = S.previewFocused;
    PV.ui.showNoteIds = true;
    key('ShiftLeft');
    await sleep(30);
    R.shiftAfter1 = PV.ui.showNoteIds;
    R.chkSynced = !!document.querySelector('#chkShowIds').checked;
    key('ShiftLeft');
    await sleep(30);
    R.shiftAfter2 = PV.ui.showNoteIds;
    S.groupHidden = {};
    key('CapsLock');
    await sleep(30);
    R.capsFocused = noteHidden();
    scroll.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    // Tab：预览聚焦时隐藏/显示 UI 并同步视图选项卡复选框
    scroll.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(30);
    PV.ui.show = true;
    document.querySelector('#chkShowUI').checked = true;
    key('Tab');
    await sleep(30);
    R.tabAfter1 = { show: PV.ui.show, chk: !!document.querySelector('#chkShowUI').checked };
    key('Tab');
    await sleep(30);
    R.tabAfter2 = { show: PV.ui.show, chk: !!document.querySelector('#chkShowUI').checked };
    scroll.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    // 输入框激活：Shift/CapsLock/Z 都不生效
    const inp = document.createElement('input');
    document.body.appendChild(inp);
    inp.focus();
    S.previewFocused = true;
    const beforeIds = PV.ui.showNoteIds;
    key('ShiftLeft', inp);
    await sleep(30);
    R.shiftTyping = PV.ui.showNoteIds === beforeIds;
    const beforeCaps = noteHidden();
    key('CapsLock', inp);
    await sleep(30);
    R.capsTyping = noteHidden() === beforeCaps;
    const zBefore = zoomVisible();
    key('KeyZ', inp);
    await sleep(30);
    R.zTyping = zoomVisible() === zBefore;
    PV.ui.show = true;
    key('Tab', inp);
    await sleep(30);
    R.tabTyping = PV.ui.show === true;
    inp.blur();

    // Z：呼出/隐藏缩放滑条
    const z0 = zoomVisible();
    key('KeyZ');
    await sleep(30);
    const z1 = zoomVisible();
    key('KeyZ');
    await sleep(30);
    const z2 = zoomVisible();
    R.zoomToggle = { z0, z1, z2 };
    R.zoomOk = z0 === false && z1 === true && z2 === false;
    return R;
  })()`);

  out.ok = !!(
    out.shiftOutside === true && out.capsOutside === false &&
    out.focused === true &&
    out.shiftAfter1 === false && out.chkSynced === false && out.shiftAfter2 === true &&
    out.capsFocused === true &&
    out.tabOutside === true &&
    out.tabAfter1 && out.tabAfter1.show === false && out.tabAfter1.chk === false &&
    out.tabAfter2 && out.tabAfter2.show === true && out.tabAfter2.chk === true &&
    out.shiftTyping && out.capsTyping && out.zTyping &&
    out.tabTyping &&
    out.zoomOk
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('HOTKEYS:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
