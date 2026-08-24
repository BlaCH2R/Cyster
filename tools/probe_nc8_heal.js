// 验证本轮修复：
//  1) 雪女 nc8 孤儿克隆自愈为选择器（note:[492..499] + $note 时间拟合）
//  2) 点击 per-note 时间块/关键帧可跳转编辑，删除对象/关键帧有效
//  3) nc14 元数据重建不受自愈影响（保留原筛选条件）
//  4) 独立窗口 alwaysOnTop
//  5) 非 note_controller 类型显示 Note 字段（$note 时间令牌时）
//  6) 手动拾取点击已选 note 取消选择
//  7) 时间 / parent_id 输入框右键菜单（使用/编辑note选择器）
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nc8v_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const SRC = 'V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nc8v_proj_'));
const CTR_PATH = path.join(TMP, '雪女.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: '雪女',
      music: ${JSON.stringify(path.join(SRC, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(SRC, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(SRC, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(SRC, 'storyboard.json'))}
    });
    // 注入真实的 .ctr 编辑器状态（noteSelectorMerge / noteSelectorMeta）。
    const ctr = JSON.parse(await window.sbAPI.readFileText(${JSON.stringify(path.join(SRC, '雪女.ctr'))}));
    await window.__sb.loadLevelInfo(res.info, {
      projectPath: res.projectPath,
      config: Object.assign({}, ctr, { files: res.config.files })
    });
    const S = window.__sb.state;
    await sleep(400);
    const R = {};

    // 1) 自愈：nc8 合并为单个选择器对象
    const nc8 = (S.storyboard.note_controllers || []).find((n) => n.id === 'note_controller_8');
    R.nc8Healed = !!nc8;
    R.nc8Note = nc8 ? JSON.stringify(nc8.note) : null;
    R.nc8Time = nc8 ? nc8.time : null;
    R.nc8StateCount = nc8 ? (nc8.states || []).length : -1;
    R.nc8StateTimes = nc8 ? (nc8.states || []).map((s) => s.time).filter((t) => typeof t === 'string').length : -1;
    R.nc8CloneCount = (S.storyboard.note_controllers || []).filter((n) => (n.id || '').indexOf('note_controller_8::') === 0).length;
    // 2) nc14 保留元数据筛选条件
    const nc14 = (S.storyboard.note_controllers || []).find((n) => n.id === 'note_controller_14');
    R.nc14Note = nc14 ? JSON.stringify(nc14.note) : null;
    R.nc14CloneCount = (S.storyboard.note_controllers || []).filter((n) => (n.id || '').indexOf('note_controller_14::') === 0).length;

    // 3) 拆分模式下点击 per-note 时间块 → 属性面板跳转
    delete S.noteSelectorMerge['note_controller_8'];
    window.__sb.refreshAll();
    await sleep(250);
    R.perNoteBlocks = document.querySelectorAll('.clip[data-id^="note_controller_8::"]').length;
    const clip = document.querySelector('.clip[data-id^="note_controller_8::"]');
    if (clip) {
      const rc = clip.getBoundingClientRect();
      clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rc.left + 5, clientY: rc.top + 5, button: 0 }));
      await sleep(150);
    }
    R.afterClipClick = {
      objId: S.selectedObjId,
      noteId: S.selectedNoteId,
      propsHasState: !!document.querySelector('#propBody #stateForm'),
      hasEditSelector: !!document.querySelector('#propBody #btnEditThisSelector')
    };
    // 点击 K0 关键帧
    const kf = document.querySelector('.kf[data-id^="note_controller_8::"]');
    if (kf) {
      const rk = kf.getBoundingClientRect();
      kf.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rk.left + 3, clientY: rk.top + 3, button: 0 }));
      await sleep(150);
    }
    R.afterKfClick = { keyIdx: S.selectedKeyIdx, propsHasState: !!document.querySelector('#propBody #stateForm') };
    // 4) 删除对象有效（先点击时间块清除关键帧选择，再删除整个对象）
    window.__sb.selectObject('note_controller_8::492', null);
    await sleep(120);
    window.__sb.deleteSelection();
    await sleep(150);
    R.afterDelete = { nc8Exists: !!((S.storyboard.note_controllers || []).find((n) => n.id === 'note_controller_8')) };
    // 恢复合并标记（其余测试不再依赖 nc8）
    S.noteSelectorMerge['note_controller_8'] = true;

    // 5) 非 note_controller 的 Note 字段显示（sprite 带 $note 时间令牌）
    S.storyboard.sprites = S.storyboard.sprites || [];
    S.storyboard.sprites.push({ id: 'spr_note_sel', path: 'author.png', time: 'start:$note', states: [], order: 0, layer: 0 });
    try { window.__sb.refreshAll(); } catch (e) {}
    window.__sb.selectObject('spr_note_sel', null);
    await sleep(150);
    R.noteFieldForSprite = !!document.querySelector('#propBody #fNote');

    // 6) 手动拾取切换（先加后取消）
    const pickNc = { id: 'nc_pick', note: [600], time: 0, states: [] };
    S.storyboard.note_controllers.push(pickNc);
    window.__sb.selectObjects(['note::600'], {});
    await sleep(100);
    window.__sb.pickNoteToSelector(492);
    await sleep(100);
    const afterAdd = JSON.stringify(pickNc.note);
    window.__sb.pickNoteToSelector(492);
    await sleep(100);
    R.pickToggle = { afterAdd, afterRemove: JSON.stringify(pickNc.note) };

    // 7) 时间 / parent_id 右键菜单
    window.__sb.selectObject('spr_note_sel', null);
    await sleep(150);
    const timeInput = Array.from(document.querySelectorAll('#stateForm .field input[type=text]'))
      .find((el) => { const l = el.closest('.field') && el.closest('.field').querySelector('label'); return l && l.textContent.indexOf('时间') >= 0; });
    R.timeInputFound = !!timeInput;
    R.timeInputHtml = timeInput ? timeInput.outerHTML.slice(0, 120) : null;
    R.stateFormExists = !!document.querySelector('#stateForm');
    R.stateFormHtml = (document.querySelector('#stateForm .field') || {}).outerHTML ? document.querySelector('#stateForm .field').outerHTML.slice(0, 160) : null;
    let cmSeen = [];
    const cmLog = (e) => { cmSeen.push((e.target && e.target.className || '') + ' -> ' + (e.currentTarget && e.currentTarget.className || '')); };
    document.addEventListener('contextmenu', cmLog, true);
    let rowBubble = false, rowErr = null;
    const row = timeInput ? timeInput.closest('.field') : null;
    if (row) row.addEventListener('contextmenu', () => { rowBubble = true; });
    try {
      if (timeInput) timeInput.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10, button: 2 }));
    } catch (err) { rowErr = String(err && err.stack || err); }
    await sleep(80);
    R.menuAfterFirst = (() => { const m = document.querySelector('#contextMenu'); return m ? { cls: m.className, html: m.innerHTML.slice(0, 200) } : null; })();
    R.rowBubble = rowBubble;
    R.rowErr = rowErr;
    if (row) row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10, button: 2 }));
    document.removeEventListener('contextmenu', cmLog, true);
    R.cmSeen = cmSeen;
    await sleep(80);
    R.timeCtxItems = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
    document.body.click();
    const parentInput = document.querySelector('#propBody #fParentId');
    if (parentInput) parentInput.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10, button: 2 }));
    await sleep(80);
    R.parentCtxItems = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);

    // 8) 独立窗口置顶
    await window.sbAPI.nsOpen();
    await sleep(600);
    return R;
  })()`);

  // 主进程侧检查 alwaysOnTop
  const nsWin = BrowserWindow.getAllWindows().find((w) => w.getTitle().indexOf('Note 选择器') >= 0);
  out.alwaysOnTop = !!(nsWin && nsWin.isAlwaysOnTop());
  out.nsWindowFound = !!nsWin;
  const nc8NoteParsed = (() => { try { return JSON.parse(out.nc8Note); } catch (e) { return null; } })();
  out.ok = !!(
    out.nc8Healed && Array.isArray(nc8NoteParsed) && nc8NoteParsed.length >= 8 &&
    typeof out.nc8Time === 'string' && out.nc8Time.indexOf('$note') >= 0 &&
    out.nc8StateCount > 0 && out.nc8CloneCount === 0 &&
    out.nc14CloneCount === 0 &&
    out.perNoteBlocks > 0 && out.afterClipClick && out.afterClipClick.objId === 'note_controller_8' &&
    out.afterClipClick.propsHasState && out.afterClipClick.hasEditSelector &&
    out.afterKfClick && out.afterKfClick.propsHasState &&
    out.afterDelete && !out.afterDelete.nc8Exists &&
    out.noteFieldForSprite &&
    out.pickToggle && out.pickToggle.afterAdd === '[600,492]' &&
    out.pickToggle.afterRemove === '[600]' &&
    out.timeCtxItems && out.timeCtxItems.some((t) => t.indexOf('使用note选择器写入时间') >= 0) &&
    out.timeCtxItems.some((t) => t.indexOf('编辑note选择器') >= 0) &&
    out.parentCtxItems && out.parentCtxItems.some((t) => t.indexOf('使用note选择器作为parent_id') >= 0) &&
    out.parentCtxItems.some((t) => t.indexOf('编辑note选择器') >= 0) &&
    out.alwaysOnTop
  );
  fs.writeFileSync(path.join(__dirname, 'probe_nc8_heal_out.json'), JSON.stringify(out, null, 2));
  console.log('NC8_VERIFY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_nc8_heal_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
