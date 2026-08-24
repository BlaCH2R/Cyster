// Verify main-window note-selector behaviors:
//  - top 编辑note选择器 button when notes share one selector
//  - merged time block (2 bright-blue circle keyframes + center count badge)
//  - split back to per-note blocks; split state shows 编辑此note选择器 + 合并按钮
//  - $note expressions shown raw; expression keyframes deduped, click no-jump,
//    group edits apply to all same-expression frames
//  - identical concrete times (57.499) deduped + group-edited
//  - manual pick converts a filter selector to [] array (+ nsPicked push)
//  - compiled output ↔ reading round-trip (unique ids, reconstruct selector)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nsel_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_nsel_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nsel_proj_'));
const CTR_PATH = path.join(TMP, 'NoteSelector.ctr');
const CHART = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\chart.base.txt', 'utf8');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NoteSelector',
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
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const selNc = { id: 'nc_sel', note: { type: [3, 4] }, time: 'start:$note',
      states: [{ time: 'start:$note', opacity_multiplier: 0.5 }] };
    S.storyboard.note_controllers = [selNc];
    window.__sb.preview.setStoryboard(S.storyboard);
    window.__sb.refreshAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(250);

    // 1) 选中两个隶属于同一选择器的 drag note → 顶部按钮出现且位于顶部。
    window.__sb.selectObjects(['note::78', 'note::79'], {});
    await sleep(150);
    const topBtn = document.querySelector('#btnEditNoteSelector');
    const topBtnShown = !!topBtn;
    const topBtnFirst = !!topBtn && document.querySelector('#propBody').firstElementChild.contains(topBtn);

    // 2) 合并时间块：直接置位标记 → 2 枚亮蓝圆形关键帧 + 中央 388× 徽标。
    S.noteSelectorMerge['nc_sel'] = true;
    window.__sb.refreshAll();
    await sleep(200);
    const mergedKfs = document.querySelectorAll('.kf.selector-merged').length;
    const mergedClip = !!document.querySelector('.clip.selector-merged');
    const countBadge = (document.querySelector('.clip.selector-merged .clip-count') || {}).textContent || '';

    // 3) 拆分：清标记 → 逐 note 时间块；属性面板显示 编辑此note选择器 + 合并按钮。
    delete S.noteSelectorMerge['nc_sel'];
    window.__sb.refreshAll();
    await sleep(200);
    const perNoteBlocks = document.querySelectorAll('.clip[data-id^="nc_sel::"]').length;
    window.__sb.selectObject('nc_sel::78', null);
    await sleep(150);
    const splitProps = {
      editBtn: !!document.querySelector('#btnEditThisSelector'),
      mergeBtn: !!document.querySelector('#btnMergeSelectorBlock'),
      kfRaw: Array.from(document.querySelectorAll('#keyList .kt'))
        .some((el) => el.textContent.indexOf('start:$note') >= 0)
    };

    // 4) 表达式关键帧去重 + 点击不跳转 + 分组编辑。
    window.__sb.selectObject('nc_sel', null);
    await sleep(150);
    const exprItems = Array.from(document.querySelectorAll('#keyList .key-item[data-kf-exp]'));
    const exprDedup = exprItems.length === 1 && exprItems[0].textContent.indexOf('start:$note') >= 0;
    const timeBefore = window.__sb.preview.time;
    exprItems[0].click();
    await sleep(120);
    const noJump = Math.abs(window.__sb.preview.time - timeBefore) < 1e-6;
    const exprSelected = S.selectedKfExpression === 'start:$note';
    const opInput = Array.from(document.querySelectorAll('#stateForm .field input[type=number]'))
      .find((el) => {
        const l = el.closest('.field') && el.closest('.field').querySelector('label');
        return l && l.textContent.indexOf('不透明度倍率') >= 0;
      });
    opInput.value = '0.8';
    opInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
    const nc0 = S.storyboard.note_controllers.find((nc) => nc.id === 'nc_sel');
    const groupEdit = nc0.opacity_multiplier === 0.8 && nc0.states[0].opacity_multiplier === 0.8;

    // 5) 相同具体时间点（57.499）去重 + 分组编辑。
    const ctlDup = { id: 'nc_dup', note: 78, time: 'start:$note',
      states: [{ time: 57.499, opacity_multiplier: 0.3 }, { time: 57.499, opacity_multiplier: 0.6 }] };
    S.storyboard.note_controllers.push(ctlDup);
    window.__sb.refreshAll();
    window.__sb.selectObject('nc_dup', null);
    await sleep(150);
    const dedupTimeItems = Array.from(document.querySelectorAll('#keyList .key-item[data-kf-exp]'))
      .filter((el) => el.dataset.kfExp === '#57.499');
    const dedupTime = dedupTimeItems.length === 1;
    dedupTimeItems[0].click();
    await sleep(100);
    const dupInput = Array.from(document.querySelectorAll('#stateForm .field input[type=number]'))
      .find((el) => {
        const l = el.closest('.field') && el.closest('.field').querySelector('label');
        return l && l.textContent.indexOf('不透明度倍率') >= 0;
      });
    dupInput.value = '0.9';
    dupInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120);
    const dedupEdit = ctlDup.states[0].opacity_multiplier === 0.9 && ctlDup.states[1].opacity_multiplier === 0.9;

    // 6) 手动拾取：置位拾取模式后点击被选择器覆盖的 drag note（78）→
    //    过滤器控制器转为 [] 数组（原命中集合逐个列出）；再点一次同一 note
    //    即从列表中取消（R：点击已选取的 note 取消其选择）。
    S.notePickerActive = true;
    const pickNote = S.chart.noteById(78);
    window.__sb.selectObjects(['note::78'], {});
    window.__sb.setTime(pickNote.start_time, false);
    await sleep(120);
    const info0 = window.__sb.preview.ctxInfo();
    const pos0 = window.__sb.preview.notePos(pickNote, info0);
    const cv = document.querySelector('#previewCanvas');
    const cr = cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true,
      clientX: cr.left + pos0.x * (cr.width / cv.width),
      clientY: cr.top + pos0.y * (cr.height / cv.height) }));
    await sleep(200);
    const ncPicked = S.storyboard.note_controllers.find((nc) => nc.id === 'nc_sel');
    const pickRemoved = Array.isArray(ncPicked.note) &&
      !ncPicked.note.includes(78) && ncPicked.note.length === 387;
    // 再次点击同一 note：从列表中恢复（切换）。
    cv.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true,
      clientX: cr.left + pos0.x * (cr.width / cv.width),
      clientY: cr.top + pos0.y * (cr.height / cv.height) }));
    await sleep(200);
    const pickConverted = Array.isArray(ncPicked.note) &&
      ncPicked.note.includes(78) && ncPicked.note.length === 388;
    const pickDbg = {
      pickActiveAfter: S.notePickerActive,
      hitAgain: (() => {
        const info = window.__sb.preview.ctxInfo();
        const p = window.__sb.preview.notePos(pickNote, info);
        const cvs = document.querySelector('#previewCanvas');
        const r = cvs.getBoundingClientRect();
        const x = (r.left + p.x * (r.width / cvs.width) - r.left) / r.width * cvs.width;
        const y = (r.top + p.y * (r.height / cvs.height) - r.top) / r.height * cvs.height;
        const hit = window.__sb.preview.hitTestNote(x, y);
        return hit ? hit.id : null;
      })()
    };
    S.notePickerActive = false;

    // 7) compiled ↔ 读取往返：展开成逐 note 克隆（id 唯一），重建回选择器。
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const clones = window.SBEngine.storyboard.fromCompiled(compiled);
    const meta = window.__sb.collectNoteSelectorMeta();
    window.__sb.reconstructNoteSelectors(clones, meta);
    const rebuilt = (clones.note_controllers || []).filter((nc) => nc.id === 'nc_sel');
    const roundTrip = {
      compiledClones: compiled.note_controllers.length,
      uniqueIds: new Set(compiled.note_controllers.map((nc) => nc.Id)).size === compiled.note_controllers.length,
      rebuiltCount: rebuilt.length,
      noteIsObject: rebuilt.length === 1 && typeof rebuilt[0].note === 'object',
      timeToken: rebuilt.length === 1 ? rebuilt[0].time : null
    };

    return { topBtnShown, topBtnFirst, mergedKfs, mergedClip, countBadge, perNoteBlocks, splitProps,
      exprDedup, noJump, exprSelected, groupEdit, dedupTime, dedupEdit, pickRemoved, pickConverted, pickDbg, roundTrip };
  })()`);

  out.ok = !!(
    out.topBtnShown && out.topBtnFirst &&
    out.mergedKfs === 2 && out.mergedClip && out.countBadge === '388×' &&
    out.perNoteBlocks > 100 &&
    out.splitProps && out.splitProps.editBtn && out.splitProps.mergeBtn && out.splitProps.kfRaw &&
    out.exprDedup && out.noJump && out.exprSelected && out.groupEdit &&
    out.dedupTime && out.dedupEdit &&
    out.pickRemoved && out.pickConverted &&
    out.roundTrip && out.roundTrip.compiledClones > 10 && out.roundTrip.uniqueIds &&
    out.roundTrip.rebuiltCount === 1 && out.roundTrip.noteIsObject &&
    out.roundTrip.timeToken === 'start:$note'
  );
  fs.writeFileSync(path.join(__dirname, 'probe_note_selector_out.json'), JSON.stringify(out, null, 2));
  console.log('NSEL_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_note_selector_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
