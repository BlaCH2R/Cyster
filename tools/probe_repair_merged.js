// 验证“尝试修复合并时间块”：EffectsTest 的 parent_0..133 克隆
// （.ctr 元数据缺失导致 parent_$note 无法还原）经修复后重建为单个
// 合并时间块，保存后重开仍保持合并形态，且编译输出与修复前一致。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rmb_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const SRC = path.join(__dirname, '..', '项目', '测试：效果', 'EffectsTest');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rmb_proj_'));
fs.cpSync(SRC, TMP, { recursive: true });
const CTR = path.join(TMP, 'parent_note_to_sprite.ctr');
const SB_FILE = path.join(TMP, 'storyboard.json');
const OUT = path.join(__dirname, 'probe_repair_merged_out.json');
const PROG = path.join(__dirname, '_rmb_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null;
const js = (code) => win.webContents.executeJavaScript(code);

const R = { ok: false };

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); writeOut(); app.exit(1); }, 120000);
  try {
    await new Promise((r) => setTimeout(r, 2000));
    prog('ready');
    win = BrowserWindow.getAllWindows()[0];
    win.setSize(1400, 950);
    await new Promise((r) => setTimeout(r, 500));

    // ---- 打开项目（修复前） ----
    const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
    await js(`(() => {
      window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
      return true;
    })()`);
    await sleep(1500);

    const pre = await js(`(() => {
      const S = window.__sb.state;
      const ncs = S.storyboard.note_controllers || [];
      return {
        ncCount: ncs.length,
        hasCarrier: ncs.some((n) => n.id === 'parent_$note'),
        parentClones: ncs.filter((n) => /^parent_\\d+$/.test(n.id)).length,
        parent21: !!ncs.find((n) => n.id === 'parent_21'),
        nc3: !!ncs.find((n) => n.id === 'note_controller_3'),
        nc4: !!ncs.find((n) => n.id === 'note_controller_4'),
        sprite1Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_1') || {}).parent_id,
        sprite7Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_7') || {}).parent_id,
        mergeCarrier: !!S.noteSelectorMerge['parent_$note'],
        carrierParent: !!S.parentCarriers['parent_$note']
      };
    })()`);
    R.pre = pre;

    // ---- 执行修复 ----
    await js(`window.__sb.repairMergedBlocks(); true`);
    R.undoImmediate = await js(`(() => {
      const S = window.__sb.state;
      return {
        len: S.undoStack.length,
        redoLen: S.redoStack.length,
        head: S.undoStack[0] ? S.undoStack[0].slice(0, 80) : null
      };
    })()`);
    await sleep(2500);

    const post = await js(`(() => {
      const S = window.__sb.state;
      const ncs = S.storyboard.note_controllers || [];
      const carrier = ncs.find((n) => n.id === 'parent_$note');
      let compiled = null;
      try { compiled = JSON.parse(window.__sb.storyboardCompiledJson()); } catch (e) { compiled = { err: String(e) }; }
      const compiledNcs = (compiled && compiled.note_controllers) || [];
      const sprite = (c) => (compiled && compiled.sprites || []).find((s) => s.Id === c);
      return {
        ncCount: ncs.length,
        hasCarrier: !!carrier,
        carrierNoteCount: carrier ? (Array.isArray(carrier.note) ? carrier.note.length : -1) : -1,
        carrierNoteFirst: carrier && Array.isArray(carrier.note) ? carrier.note[0] : null,
        carrierNoteLast: carrier && Array.isArray(carrier.note) ? carrier.note[carrier.note.length - 1] : null,
        carrierTime: carrier ? carrier.time : null,
        carrierStates: carrier ? (carrier.states || []).map((s) => ({ t: s.time, sm: s.size_multiplier })) : null,
        parentClones: ncs.filter((n) => /^parent_\\d+$/.test(n.id)).length,
        parent21: !!ncs.find((n) => n.id === 'parent_21'),
        nc3: !!ncs.find((n) => n.id === 'note_controller_3'),
        nc4: !!ncs.find((n) => n.id === 'note_controller_4'),
        carrierHas21: carrier && Array.isArray(carrier.note) ? carrier.note.includes(21) : null,
        carrierHas103: carrier && Array.isArray(carrier.note) ? carrier.note.includes(103) : null,
        carrierHas123: carrier && Array.isArray(carrier.note) ? carrier.note.includes(123) : null,
        mergeCarrier: !!S.noteSelectorMerge['parent_$note'],
        carrierParent: !!S.parentCarriers['parent_$note'],
        staleParent16: !!S.noteSelectorMerge['parent_16'],
        sprite1Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_1') || {}).parent_id,
        sprite7Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_7') || {}).parent_id,
        compiledErr: compiled.err || null,
        compiledNcCount: compiledNcs.length,
        compiledHasParent21: compiledNcs.some((n) => n.Id === 'parent_21'),
        compiledHasNc3: compiledNcs.some((n) => n.Id === 'note_controller_3'),
        compiledHasNc4: compiledNcs.some((n) => n.Id === 'note_controller_4'),
        compiledParent0: compiledNcs.some((n) => n.Id === 'parent_0'),
        compiledParent133: compiledNcs.some((n) => n.Id === 'parent_133'),
        sprite121Parent: sprite('sprite_1::21') ? sprite('sprite_1::21').ParentId : null,
        sprite7103Parent: sprite('sprite_7::103') ? sprite('sprite_7::103').ParentId : null,
        sprite7123Parent: sprite('sprite_7::123') ? sprite('sprite_7::123').ParentId : null
      };
    })()`);
    R.post = post;

    // ---- 磁盘上的 storyboard（修复后已保存） ----
    R.saved = fs.existsSync(SB_FILE) ? (() => {
      try {
        const d = JSON.parse(fs.readFileSync(SB_FILE, 'utf8'));
        return {
          ncCount: (d.note_controllers || []).length,
          parent0: (d.note_controllers || []).some((n) => n.Id === 'parent_0'),
          parent133: (d.note_controllers || []).some((n) => n.Id === 'parent_133'),
          parent21: (d.note_controllers || []).some((n) => n.Id === 'parent_21')
        };
      } catch (e) { return { err: String(e) }; }
    })() : null;

    // ---- 撤销修复：应恢复为 132 个 parent 克隆 + 无载体，并写回文件 ----
    R.undoInfo = await js(`(() => {
      const S = window.__sb.state;
      return { undoLen: S.undoStack.length };
    })()`);
    await js(`window.__sb.undo(); true`);
    await sleep(1500);
    R.afterUndo = await js(`(() => {
      const S = window.__sb.state;
      const ncs = S.storyboard.note_controllers || [];
      return {
        ncCount: ncs.length,
        hasCarrier: ncs.some((n) => n.id === 'parent_$note'),
        parentClones: ncs.filter((n) => /^parent_\\d+$/.test(n.id)).length,
        parent21: !!ncs.find((n) => n.id === 'parent_21'),
        nc3: !!ncs.find((n) => n.id === 'note_controller_3'),
        nc4: !!ncs.find((n) => n.id === 'note_controller_4'),
        sprite1Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_1') || {}).parent_id,
        sprite7Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_7') || {}).parent_id
      };
    })()`);
    R.savedAfterUndo = fs.existsSync(SB_FILE) ? (() => {
      try {
        const d = JSON.parse(fs.readFileSync(SB_FILE, 'utf8'));
        return {
          ncCount: (d.note_controllers || []).length,
          parent0: (d.note_controllers || []).some((n) => n.Id === 'parent_0'),
          parent133: (d.note_controllers || []).some((n) => n.Id === 'parent_133')
        };
      } catch (e) { return { err: String(e) }; }
    })() : null;

    // 再次修复（验证可重复执行），为下面的重开验证准备好已修复的落盘状态。
    await js(`window.__sb.repairMergedBlocks(); true`);
    await sleep(2500);

    // ---- 重开项目：应直接还原为合并形态 ----
    const res2 = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
    await js(`(() => {
      window.__sb.loadLevelInfo(${JSON.stringify(res2.info)}, { projectPath: ${JSON.stringify(res2.projectPath)}, config: ${JSON.stringify(res2.config)} });
      return true;
    })()`);
    await sleep(1500);

    R.reopen = await js(`(() => {
      const S = window.__sb.state;
      const ncs = S.storyboard.note_controllers || [];
      const carrier = ncs.find((n) => n.id === 'parent_$note');
      return {
        ncCount: ncs.length,
        hasCarrier: !!carrier,
        carrierNoteCount: carrier && Array.isArray(carrier.note) ? carrier.note.length : -1,
        carrierTime: carrier ? carrier.time : null,
        carrierStates: carrier ? (carrier.states || []).map((s) => ({ t: s.time, sm: s.size_multiplier })) : null,
        parentClones: ncs.filter((n) => /^parent_\\d+$/.test(n.id)).length,
        parent21: !!ncs.find((n) => n.id === 'parent_21'),
        mergeCarrier: !!S.noteSelectorMerge['parent_$note'],
        carrierParent: !!S.parentCarriers['parent_$note'],
        sprite1Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_1') || {}).parent_id,
        sprite7Parent: (S.storyboard.sprites.find((s) => s.id === 'sprite_7') || {}).parent_id,
        sprite1NoteCount: (() => { const sp = S.storyboard.sprites.find((s) => s.id === 'sprite_1'); return sp && Array.isArray(sp.note) ? sp.note.length : -1; })(),
        sprite7NoteCount: (() => { const sp = S.storyboard.sprites.find((s) => s.id === 'sprite_7'); return sp && Array.isArray(sp.note) ? sp.note.length : -1; })()
      };
    })()`);

    // ---- 负例：普通编号控制器（无 $note 模板引用）不应被误并 ----
    const negative = await js(`(async () => {
      const S = window.__sb.state;
      S.storyboard.note_controllers.push(
        { id: 'note_controller_500', note: 500, time: 1, states: [{ time: 2, size_multiplier: 1 }] },
        { id: 'note_controller_501', note: 501, time: 1, states: [{ time: 2, size_multiplier: 1 }] }
      );
      window.__sb.repairMergedBlocks();
      await new Promise((r) => setTimeout(r, 800));
      const ncs = S.storyboard.note_controllers || [];
      return {
        ncCount: ncs.length,
        hasFakeCarrier: ncs.some((n) => n.id === 'note_controller_$note'),
        c500: !!ncs.find((n) => n.id === 'note_controller_500'),
        c501: !!ncs.find((n) => n.id === 'note_controller_501')
      };
    })()`);
    R.negative = negative;

    // ---- 断言 ----
    const checks = [];
    const chk = (name, cond) => checks.push({ name, ok: !!cond });
    chk('pre: 132 parent clones (bug reproduced)', pre.parentClones === 132 && !pre.hasCarrier);
    chk('pre: real controllers kept', pre.parent21 && pre.nc3 && pre.nc4);
    chk('post: carrier exists with 131 notes (excludes taken 21/103/123)', post.hasCarrier && post.carrierNoteCount === 131 && post.carrierNoteFirst === 0 && post.carrierNoteLast === 133 &&
      post.carrierHas21 === false && post.carrierHas103 === false && post.carrierHas123 === false);
    chk('post: clones removed (only parent_21 real controller remains)', post.parentClones === 1 && post.parent21);
    chk('post: merged/parentCarrier marks', post.mergeCarrier && post.carrierParent && !post.staleParent16);
    chk('post: carrier time/states', typeof post.carrierTime === 'number' && Math.abs(post.carrierTime - 1.5798) < 1e-4 &&
      post.carrierStates && post.carrierStates[0].t === 'intro:$note' && post.carrierStates[1].t === 'start:$note' &&
      post.carrierStates[0].sm === 1 && post.carrierStates[1].sm === 2);
    chk('post: sprites re-linked to template', post.sprite1Parent === 'parent_$note' && post.sprite7Parent === 'parent_$note');
    chk('post: compiled output valid', !post.compiledErr && post.compiledNcCount === 134 &&
      post.compiledParent0 && post.compiledParent133 && post.compiledHasParent21 && post.compiledHasNc3 && post.compiledHasNc4);
    chk('post: compiled parent resolution', post.sprite121Parent === 'parent_21' && post.sprite7103Parent === 'note_controller_3' && post.sprite7123Parent === 'note_controller_4');
    chk('saved file written', R.saved && R.saved.ncCount === 134 && R.saved.parent0 && R.saved.parent133);
    chk('undo: storyboard reverts to clone state', R.undoInfo.undoLen >= 1 && R.afterUndo.ncCount === 134 &&
      !R.afterUndo.hasCarrier && R.afterUndo.parentClones === 132 && R.afterUndo.parent21 &&
      R.afterUndo.nc3 && R.afterUndo.nc4 &&
      R.afterUndo.sprite1Parent === 'parent_0' && R.afterUndo.sprite7Parent === 'parent_50');
    chk('undo: file reverted on disk', R.savedAfterUndo && R.savedAfterUndo.ncCount === 134 &&
      R.savedAfterUndo.parent0 && R.savedAfterUndo.parent133);
    chk('reopen: merged form preserved', R.reopen.hasCarrier && R.reopen.carrierNoteCount === 131 && R.reopen.parentClones === 1 && R.reopen.parent21 &&
      R.reopen.mergeCarrier && R.reopen.carrierParent &&
      R.reopen.sprite1Parent === 'parent_$note' && R.reopen.sprite7Parent === 'parent_$note' &&
      R.reopen.sprite1NoteCount === 101 && R.reopen.sprite7NoteCount === 84);
    chk('reopen: carrier expression times preserved', R.reopen.carrierStates &&
      R.reopen.carrierStates[0].t === 'intro:$note' && R.reopen.carrierStates[1].t === 'start:$note');
    chk('negative: ordinary numbered controllers not merged', negative.ncCount === 6 &&
      !negative.hasFakeCarrier && negative.c500 && negative.c501);
    R.checks = checks;
    R.ok = checks.every((c) => c.ok);
  } catch (e) {
    R.error = String(e && e.stack || e);
    prog('ERROR ' + R.error);
  }
  writeOut();
  app.exit(0);
});

function writeOut() {
  try {
    fs.writeFileSync(OUT, JSON.stringify(R, null, 2));
  } catch (e) {
    prog('writeOut error ' + e);
  }
}
