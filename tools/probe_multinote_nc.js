// Verify multi-note -> note_controller multi-edit:
//  1. Multi-selecting notes renders the note_controller multi-edit panel with
//     "关联 Note" listing every selected note id and a count.
//  2. The time field accepts "start:$note"-style selectors; the expression is
//     kept in the editor, while the exported compiled storyboard outputs the
//     absolute time; the .ctr noteTimeTokens tag restores the expression on
//     reload.
//  3. Field edits apply to every selected note's controller; differing values
//     across controllers show "多个数值".
//  4. Multi-selecting note_controller objects shows the note ids as a list
//     with a count (like 关联 Note), not "多个数值".
//  5. The keyframe list resolves $note expressions (no 0.000).
//  6. Multi-selected keyframes each on a distinct object can batch-edit time
//     with $note expressions.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mnc_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_mnc_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mnc_proj_'));
const CTR_PATH = path.join(TMP, 'MultiNoteNC.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'MultiNoteNC',
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
    const notes = (S.chart && S.chart.notes || []).slice(0, 2);
    if (notes.length < 2) return { error: 'need >=2 chart notes' };
    const n1 = notes[0].id, n2 = notes[1].id;
    const expT1 = S.chart.noteById(n1).start_time;
    const expT2 = S.chart.noteById(n2).start_time;

    // --- 1) Multi-select notes -> multi-edit panel with 关联 Note list ---
    window.__sb.selectObjects(['note::' + n1, 'note::' + n2], {});
    const bodyText = document.querySelector('#propBody').textContent;
    const headerOk = bodyText.indexOf('已选择 2 个 Note') >= 0 &&
      bodyText.indexOf('（多选编辑）') >= 0;
    const relOk = bodyText.indexOf('关联 Note') >= 0 &&
      bodyText.indexOf(String(n1)) >= 0 && bodyText.indexOf(String(n2)) >= 0 &&
      bodyText.indexOf('（共 2）') >= 0;
    const noNcCreated = (S.storyboard.note_controllers || []).length === 0;
    const placeholderOk = document.querySelector('#ncMultiTime').placeholder === '支持$note表达式';

    // --- 2) Time field: start:$note kept as expression; export keeps it too ---
    const timeInput = document.querySelector('#ncMultiTime');
    timeInput.value = 'start:$note';
    timeInput.dispatchEvent(new Event('change', { bubbles: true }));
    const ncs = S.storyboard.note_controllers || [];
    const nc1 = ncs.find((c) => c.note === n1);
    const nc2 = ncs.find((c) => c.note === n2);
    const timeOk = ncs.length === 2 && !!nc1 && !!nc2 &&
      nc1.time === 'start:$note' && nc2.time === 'start:$note';
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const cnc1 = (compiled.note_controllers || []).find((c) => c.Id === nc1.id);
    const cnc2 = (compiled.note_controllers || []).find((c) => c.Id === nc2.id);
    const exportOk = !!cnc1 && !!cnc2 &&
      typeof cnc1.States[0].Time === 'number' && Math.abs(cnc1.States[0].Time - expT1) < 1e-6 &&
      typeof cnc2.States[0].Time === 'number' && Math.abs(cnc2.States[0].Time - expT2) < 1e-6 &&
      cnc1.States[0].Note === n1 && cnc2.States[0].Note === n2;

    // --- 3) Field edit applies to all selected note controllers ---
    window.__sb.selectObjects(['note::' + n1, 'note::' + n2], {});
    const rows = Array.from(document.querySelectorAll('#ncMultiForm .field'));
    const oxRow = rows.find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === '覆盖 X');
    const oxBox = oxRow ? oxRow.querySelector('input[type=checkbox]') : null;
    if (oxBox) {
      oxBox.checked = true;
      oxBox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const applyOk = !!(nc1.override_x === true && nc2.override_x === true);

    // --- 4) Differing values show 多个数值 ---
    nc1.x = { unit: 'notex', value: 0.5 };
    nc2.x = { unit: 'notex', value: 0.9 };
    window.__sb.selectObjects(['note::' + n1, 'note::' + n2], {});
    const xInput = Array.from(document.querySelectorAll('#ncMultiForm input[type=number]'))
      .find((el) => el.closest('.field') && el.closest('.field').querySelector('label').textContent.trim() === 'X');
    const multiOk = xInput && xInput.placeholder === '多个数值';

    // --- 5) Multi-select note_controller objects -> 关联 Note list ---
    window.__sb.selectObjects([nc1.id, nc2.id], {});
    const ncBody = document.querySelector('#propBody').textContent;
    const relListOk = ncBody.indexOf('关联 Note') >= 0 &&
      ncBody.indexOf(String(n1)) >= 0 && ncBody.indexOf(String(n2)) >= 0 &&
      ncBody.indexOf('（共 2）') >= 0;
    const formHasNoteField = !!Array.from(document.querySelectorAll('#stateForm .field'))
      .find((r) => r.querySelector('label') && r.querySelector('label').textContent.trim() === 'Note ID');

    // --- 6) Keyframe list resolves $note (no 0.000) ---
    window.__sb.selectObject(nc1.id, null);
    const kfListText = document.querySelector('#propBody').textContent;
    const kfList = document.querySelector('#keyList');
    const kfListHtml = kfList ? kfList.textContent : '';
    const kfListOk = kfListText.indexOf('0.000') < 0 && kfListHtml.indexOf('K04.312') >= 0;

    // --- 7) Batch time edit: distinct-object keyframes with $note expression ---
    S.selectedIds = [nc1.id, nc2.id];
    S.selectedKfs = [{ objId: nc1.id, index: -1 }, { objId: nc2.id, index: -1 }];
    S.selectedObjId = nc2.id;
    window.__sb.refreshAll();
    const batchInput = document.querySelector('#multiKfTime');
    const batchShown = !!batchInput;
    if (batchInput) {
      batchInput.value = 'end:$note';
      batchInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const batchOk = batchShown && nc1.time === 'end:$note' && nc2.time === 'end:$note';

    // --- 8) .ctr noteTimeTokens: collect + restore after compiled round-trip ---
    const tokens = window.__sb.collectNoteTimeTokens();
    const tagOk = tokens[nc1.id] && tokens[nc1.id].base === 'end:$note' &&
      tokens[nc2.id] && tokens[nc2.id].base === 'end:$note';
    const compiled2 = JSON.parse(window.__sb.storyboardCompiledJson());
    const reloaded = window.SBEngine.storyboard.fromCompiled(compiled2);
    window.__sb.applyNoteTimeTokens(reloaded, tokens);
    const rnc1 = reloaded.note_controllers.find((c) => c.id === nc1.id);
    const rnc2 = reloaded.note_controllers.find((c) => c.id === nc2.id);
    const restoreOk = !!rnc1 && !!rnc2 &&
      rnc1.time === 'end:$note' && rnc2.time === 'end:$note';
    await window.__sb.saveStoryboard();

    return {
      n1, n2, expT1, expT2,
      headerOk, relOk, noNcCreated, placeholderOk,
      timeOk, ncTimes: [nc1 && nc1.time, nc2 && nc2.time], exportOk,
      applyOk,
      multiOk, xPlaceholder: xInput ? xInput.placeholder : null,
      relListOk, formHasNoteField,
      kfListOk, kfListTextSnippet: kfListText.slice(0, 300), kfListHtml,
      batchShown, batchOk,
      tagOk, restoreOk
    };
  })()`);

  // The .ctr project file should carry the noteTimeTokens tag after save.
  await new Promise((r) => setTimeout(r, 600));
  let ctrTokens = null;
  try {
    const ctr = JSON.parse(fs.readFileSync(CTR_PATH, 'utf8'));
    ctrTokens = ctr && ctr.editor && ctr.editor.noteTimeTokens;
  } catch (e) {}
  const ctrTagOk = !!(ctrTokens && Object.keys(ctrTokens).length >= 2);

  if (out.error) throw new Error(out.error);
  const result = {
    n1: out.n1, n2: out.n2, expT1: out.expT1, expT2: out.expT2,
    headerOk: out.headerOk, relOk: out.relOk, noNcCreated: out.noNcCreated,
    placeholderOk: out.placeholderOk,
    timeOk: out.timeOk, ncTimes: out.ncTimes, exportOk: out.exportOk,
    applyOk: out.applyOk,
    multiOk: out.multiOk, xPlaceholder: out.xPlaceholder,
    relListOk: out.relListOk, formHasNoteField: out.formHasNoteField,
    kfListOk: out.kfListOk,
    kfListTextSnippet: out.kfListTextSnippet,
    kfListHtml: out.kfListHtml,
    batchShown: out.batchShown, batchOk: out.batchOk,
    tagOk: out.tagOk, restoreOk: out.restoreOk,
    ctrTagOk,
    ok: out.headerOk === true && out.relOk === true && out.noNcCreated === true &&
      out.placeholderOk === true && out.timeOk === true && out.exportOk === true &&
      out.applyOk === true && out.multiOk === true &&
      out.relListOk === true && out.formHasNoteField === false &&
      out.kfListOk === true && out.batchShown === true && out.batchOk === true &&
      out.tagOk === true && out.restoreOk === true && ctrTagOk === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_multinote_nc_out.json'), JSON.stringify(result, null, 2));
  console.log('MNC_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_multinote_nc_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
