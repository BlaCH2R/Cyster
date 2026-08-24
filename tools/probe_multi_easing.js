// Focused check for the multi-select easing batch edit:
// dumps the rendered 缓动 row and verifies picking an option applies to all
// selected objects (object-level selection and keyframe-selection variants).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_me_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_me_');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => {
    const item = {
      type: c.type,
      path: c.path,
      content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
      storyboardPath: c.storyboard ? c.storyboard.path : null,
      storyboardContent: c.storyboard && c.storyboard.path
        ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
        : null
    };
    return item;
  });
  return { level, levelDir: dir, files: [], charts };
}

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.webContents.on('console-message', (e) => {
    try {
      const level = typeof e === 'object' ? e.level : e;
      const message = typeof e === 'object' ? e.message : '';
      if (level >= 2 || /error/i.test(message)) console.log('RENDERER:', message);
    } catch (err) {}
  });
  win.setSize(1400, 860);
  await new Promise((r) => setTimeout(r, 600));

  const out = { checks: [], ok: true };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail: String(detail) });
    if (!cond) out.ok = false;
  };

  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(PLAYER))})`);
  await new Promise((r) => setTimeout(r, 2500));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setSb = (storyboard) => {
      S.storyboard = storyboard;
      S.files = [{ name: 'bg.jpg', size: 0 }];
      window.__sb.refreshAll();
      window.__sb.setTime(0);
    };
    const easingRowInfo = () => {
      const row = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
        .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('缓动'); });
      if (!row) return null;
      const sel = row.querySelector('select');
      return {
        found: !!sel,
        disabled: sel ? sel.disabled : null,
        value: sel ? sel.value : null,
        options: sel ? Array.from(sel.options).map((o) => o.textContent + '=' + o.value).slice(0, 4) : [],
        selectedText: sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : null
      };
    };
    const pickEasing = (v) => {
      const row = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
        .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('缓动'); });
      const sel = row ? row.querySelector('select') : null;
      if (!sel) return false;
      sel.value = v;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    // A) 对象多选：缓动有差异
    let a1 = { id: 'a1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, easing: 'linear' };
    let a2 = { id: 'a2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1, easing: 'easeinquad' };
    setSb({ sprites: [a1, a2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['a1', 'a2'];
    S.selectedObjId = 'a1';
    window.__sb.refreshAll();
    await sleep(150);
    out.diffBefore = easingRowInfo();
    out.pickDiff = pickEasing('linear');
    await sleep(150);
    out.diffAfter = { a: a1.easing, b: a2.easing };

    // B) 对象多选：均未设置缓动
    let b1 = { id: 'b1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0 };
    let b2 = { id: 'b2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1 };
    setSb({ sprites: [b1, b2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['b1', 'b2'];
    window.__sb.refreshAll();
    await sleep(150);
    out.unsetBefore = easingRowInfo();
    out.pickUnset = pickEasing('easeoutquad');
    await sleep(150);
    out.unsetAfter = { a: b1.easing, b: b2.easing };

    // C) 对象多选但关键帧自带缓动：对象级批量修改只改对象本体，不扩散到关键帧
    let c1 = { id: 'c1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, easing: 'linear', states: [{ time: 2, easing: 'blink' }] };
    let c2 = { id: 'c2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1, easing: 'linear', states: [{ time: 3, easing: 'blink' }] };
    setSb({ sprites: [c1, c2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['c1', 'c2'];
    window.__sb.refreshAll();
    await sleep(150);
    out.pickOverride = pickEasing('easeoutquad');
    await sleep(150);
    out.overrideAfter = {
      aObj: c1.easing, aKf: c1.states[0].easing,
      bObj: c2.easing, bKf: c2.states[0].easing
    };

    // D) 多选布尔值有差异：复选框不应显示为已勾选
    let d1 = { id: 'd1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, preserve_aspect: true };
    let d2 = { id: 'd2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1, preserve_aspect: false };
    setSb({ sprites: [d1, d2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['d1', 'd2'];
    window.__sb.refreshAll();
    await sleep(150);
    const paRow = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('保持比例'); });
    const paBox = paRow ? paRow.querySelector('input[type=checkbox]') : null;
    out.boolDiff = { found: !!paBox, checked: paBox ? paBox.checked : null };

    // E) 相同值的字段在多数下修改仍应应用到全部选中对象（非“多个数值”）
    let e1 = { id: 'e1', time: 0, path: 'title.png', opacity: 0.5, layer: 1, order: 0, x: 'stagex:100', y: 'stagey:100' };
    let e2 = { id: 'e2', time: 1, path: 'title.png', opacity: 0.5, layer: 1, order: 1, x: 'stagex:100', y: 'stagey:200' };
    setSb({ sprites: [e1, e2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['e1', 'e2'];
    window.__sb.refreshAll();
    await sleep(150);
    // 相同值的 X 输入框：改 250
    const xRow2 = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('X'); });
    const xInp = xRow2 ? xRow2.querySelector('input') : null;
    out.sameBefore = { xRow: !!xRow2, value: xInp ? xInp.value : null, multiHint: xRow2 ? !!xRow2.querySelector('.multi-value') : null };
    if (xInp) {
      xInp.value = '250';
      xInp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.sameAfterX = { a: e1.x, b: e2.x };
    // 相同值的图层下拉：改 2
    const layerRow = Array.from(document.querySelectorAll('#propBody #syncForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('图层'); });
    const layerSel = layerRow ? layerRow.querySelector('select') : null;
    if (layerSel) {
      layerSel.value = '2';
      layerSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.sameAfterLayer = { a: e1.layer, b: e2.layer };

    // F) 相同显式缓动（非“多个数值”）→ 修改仍应应用
    let f1 = { id: 'f1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, easing: 'linear' };
    let f2 = { id: 'f2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1, easing: 'linear' };
    setSb({ sprites: [f1, f2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['f1', 'f2'];
    window.__sb.refreshAll();
    await sleep(150);
    out.sameEasingBefore = (() => {
      const row = Array.from(document.querySelectorAll('#propBody #stateForm .field'))
        .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('缓动'); });
      const sel = row ? row.querySelector('select') : null;
      return { value: sel ? sel.value : null, multi: row ? !!row.querySelector('.multi-value') : null };
    })();
    out.sameEasingPick = pickEasing('easeinquad');
    await sleep(150);
    out.sameEasingAfter = { a: f1.easing, b: f2.easing };

    // G) 相同值字段但对象关键帧自带旧值（图层在 states 中）→ 修改应覆盖生效
    let g1 = { id: 'g1', time: 0, path: 'title.png', opacity: 1, order: 0, states: [{ time: 2, layer: 1 }] };
    let g2 = { id: 'g2', time: 1, path: 'title.png', opacity: 1, order: 1, states: [{ time: 3, layer: 1 }] };
    setSb({ sprites: [g1, g2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['g1', 'g2'];
    window.__sb.refreshAll();
    await sleep(150);
    const layerRowG = Array.from(document.querySelectorAll('#propBody #syncForm .field'))
      .find((f) => { const lab = f.querySelector('label'); return lab && lab.textContent.includes('图层'); });
    const layerSelG = layerRowG ? layerRowG.querySelector('select') : null;
    if (layerSelG) {
      layerSelG.value = '2';
      layerSelG.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(150);
    }
    out.layerStateAfter = { aObj: g1.layer, aKf: g1.states[0].layer, bObj: g2.layer, bKf: g2.states[0].layer };

    // H) 选中关键帧时：多选修改只对选中的关键帧生效，不扩散到其他关键帧
    let h1 = { id: 'h1', time: 0, path: 'title.png', opacity: 1, layer: 1, order: 0, states: [{ time: 2, easing: 'blink' }, { time: 4, easing: 'blink' }] };
    let h2 = { id: 'h2', time: 1, path: 'title.png', opacity: 1, layer: 1, order: 1, states: [{ time: 3, easing: 'blink' }, { time: 5, easing: 'blink' }] };
    setSb({ sprites: [h1, h2], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} });
    await sleep(120);
    S.selectedIds = ['h1', 'h2'];
    S.selectedKfs = [{ objId: 'h1', index: 0 }, { objId: 'h2', index: 0 }];
    window.__sb.refreshAll();
    await sleep(150);
    out.pickKf = pickEasing('easeoutquad');
    await sleep(150);
    out.kfOnlyAfter = {
      a0: h1.states[0].easing, a1: h1.states[1].easing,
      b0: h2.states[0].easing, b1: h2.states[1].easing
    };
    return out;
  })()`);

  check('differing easing renders editable select with multi placeholder',
    res.diffBefore.found && res.diffBefore.disabled === false &&
    res.diffBefore.selectedText === '（多个数值）',
    JSON.stringify(res.diffBefore));
  check('picking easing unifies differing values',
    res.pickDiff === true && res.diffAfter.a === 'linear' && res.diffAfter.b === 'linear',
    JSON.stringify(res.diffAfter));
  check('unset easing select is editable and applies to all',
    res.unsetBefore.found && res.unsetBefore.disabled === false &&
    res.pickUnset === true && res.unsetAfter.a === 'easeoutquad' && res.unsetAfter.b === 'easeoutquad',
    JSON.stringify({ before: res.unsetBefore, after: res.unsetAfter }));
  check('object-level easing edit does not spread to keyframes',
    res.pickOverride === true &&
    res.overrideAfter.aObj === 'easeoutquad' && res.overrideAfter.aKf === 'blink' &&
    res.overrideAfter.bObj === 'easeoutquad' && res.overrideAfter.bKf === 'blink',
    JSON.stringify(res.overrideAfter));
  check('differing bool in multi-select is not pre-checked',
    res.boolDiff.found === true && res.boolDiff.checked === false,
    JSON.stringify(res.boolDiff));
  check('same-value X edit applies to all selected objects',
    res.sameBefore.xRow === true && res.sameBefore.multiHint === false &&
    res.sameAfterX.a === 250 && res.sameAfterX.b === 250,
    JSON.stringify({ before: res.sameBefore, after: res.sameAfterX }));
  check('same-value layer select edit applies to all selected objects',
    res.sameAfterLayer.a === 2 && res.sameAfterLayer.b === 2,
    JSON.stringify(res.sameAfterLayer));
  check('same explicit easing edit applies to all selected objects',
    res.sameEasingBefore.value === 'linear' && res.sameEasingBefore.multi === false &&
    res.sameEasingPick === true &&
    res.sameEasingAfter.a === 'easeinquad' && res.sameEasingAfter.b === 'easeinquad',
    JSON.stringify({ before: res.sameEasingBefore, after: res.sameEasingAfter }));
  check('sync layer edit applies to the object and all keyframes',
    res.layerStateAfter.aObj === 2 && res.layerStateAfter.aKf === 2 &&
    res.layerStateAfter.bObj === 2 && res.layerStateAfter.bKf === 2,
    JSON.stringify(res.layerStateAfter));
  check('keyframe-selection edit applies only to the selected keyframes',
    res.pickKf === true &&
    res.kfOnlyAfter.a0 === 'easeoutquad' && res.kfOnlyAfter.a1 === 'blink' &&
    res.kfOnlyAfter.b0 === 'easeoutquad' && res.kfOnlyAfter.b1 === 'blink',
    JSON.stringify(res.kfOnlyAfter));

  fs.writeFileSync(path.join(__dirname, 'probe_multi_easing_out.json'), JSON.stringify(out, null, 2));
  console.log('ME_SUMMARY:', JSON.stringify(out));
  app.exit(out.ok ? 0 : 2);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_multi_easing_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
