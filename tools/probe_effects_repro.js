// 复现用户真实项目：打开 EffectsTest（含 sprite 选择器 + $note 载体）后保存
// StoryBoard，抓取保存失败的具体错误。只读源文件，写临时副本。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_effrepro_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const SRC = 'V:/cytoid storyboarder/项目/测试：效果/EffectsTest';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_effrepro_proj_'));
const OUT = path.join(__dirname, 'probe_effects_repro_out.json');

// 复制项目所需的最小文件集
for (const f of ['level.json', 'chart.base.txt', 'storyboard.json', 'music.ogg', 'bg.jpg', 'octa.png', 'parent_note_to_sprite.ctr']) {
  fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));
  const consoleLogs = [];
  win.webContents.on('console-message', (e, level, message) => {
    consoleLogs.push({ level, message: String(message).slice(0, 800) });
  });

  const out = {};

  // 打开项目
  out.open = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(path.join(TMP, 'parent_note_to_sprite.ctr'))} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    await new Promise((r) => setTimeout(r, 2500));
    const s = window.__sb.state;
    return {
      ok: true,
      projectPath: s.projectPath,
      storyboardFileName: s.storyboardFileName,
      cfgStoryboard: s.projectConfig && s.projectConfig.files && s.projectConfig.files.storyboard,
      sprites: (s.storyboard && s.storyboard.sprites || []).length,
      texts: (s.storyboard && s.storyboard.texts || []).length,
      videos: (s.storyboard && s.storyboard.videos || []).length,
      lines: (s.storyboard && s.storyboard.lines || []).length,
      controllers: (s.storyboard && s.storyboard.controllers || []).length,
      noteControllers: (s.storyboard && s.storyboard.note_controllers || []).length,
      spriteIds: (s.storyboard && s.storyboard.sprites || []).slice(0, 3).map((o) => o.id),
      ncIds: (s.storyboard && s.storyboard.note_controllers || []).slice(0, 3).map((o) => o.id),
      parentCarriers: s.parentCarriers,
      spriteParentId: (s.storyboard && s.storyboard.sprites || []).find((o) => o.id === 'sprite_1') &&
        (s.storyboard.sprites.find((o) => o.id === 'sprite_1').parent_id)
    };
  })()`);

  // 保存
  out.save = await win.webContents.executeJavaScript(`(async () => {
    const toasts = [];
    const wrap = document.getElementById('toastWrap');
    if (wrap) {
      const obs = new MutationObserver(() => toasts.push(wrap.textContent.trim()));
      obs.observe(wrap, { childList: true, subtree: true, characterData: true });
    }
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    await new Promise((r) => setTimeout(r, 600));
    return { ok, err, toasts };
  })()`);

  // 强制构造“载体与 sprite 选择器反同步”状态（真实用户遇到的失败态）：
  // sprite 覆盖 0..100（101 个 note），载体只覆盖 0..20、22..100（缺 21），
  // sprite.parent_id 恢复为 $note 模板 —— 保存应报 parent_id 不存在。
  out.desyncSave = await win.webContents.executeJavaScript(`(async () => {
    const s = window.__sb.state;
    const spr = (s.storyboard.sprites || []).find((o) => o.id === 'sprite_1');
    const carrier = (s.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    if (!spr || !carrier) return { skipped: true };
    spr.parent_id = 'parent_$note';
    spr.note = { start: 0, end: 100 };
    carrier.note = [];
    for (let n = 0; n <= 100; n++) if (n !== 21) carrier.note.push(n);
    // 移除孤儿 parent_21，复刻首次保存失败时的真实状态
    s.storyboard.note_controllers = s.storyboard.note_controllers.filter((o) => o.id !== 'parent_21');
    s.dirty = true;
    const toasts = [];
    const wrap = document.getElementById('toastWrap');
    const obs = new MutationObserver(() => toasts.push(wrap.textContent.trim()));
    obs.observe(wrap, { childList: true, subtree: true, characterData: true });
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    await new Promise((r) => setTimeout(r, 600));
    return { ok, err, toasts, carrierNoteCount: carrier.note.length };
  })()`);

  // 反同步保存后磁盘上 compiled 文件的结构核对
  try {
    const sbDisk = JSON.parse(fs.readFileSync(path.join(TMP, 'storyboard.json'), 'utf8'));
    const sprites = sbDisk.sprites || [];
    const ncs = sbDisk.note_controllers || [];
    out.diskAfterDesyncSave = {
      sprites: sprites.length,
      noteControllers: ncs.length,
      badParents: sprites.filter((s) => {
        const n = /^sprite_1::(\d+)$/.exec(s.Id);
        if (!n) return false;
        return s.ParentId !== 'parent_' + n[1];
      }).map((s) => ({ Id: s.Id, ParentId: s.ParentId })),
      missingCarriers: sprites
        .map((s) => s.ParentId)
        .filter((p, i, a) => p && a.indexOf(p) === i && !ncs.some((c) => c.Id === p))
    };
  } catch (e) {
    out.diskAfterDesyncSave = { error: String(e && e.message || e) };
  }

  // 自包含场景（不依赖用户项目）：全新 storyboard 直接构造反同步状态再保存。
  out.freshDesync = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.controllerCards = {};
    S.parentCarriers = {};
    S.noteSelectorMeta = {};
    S.noteSelectorMerge = {};
    const spr = {
      id: 'sprite_1', path: 'octa.png', time: 0,
      parent_id: 'parent_$note', note: { start: 0, end: 100 },
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 3, opacity: 1 }]
    };
    const carrier = { id: 'parent_$note', time: 0, note: [] };
    for (let n = 0; n <= 100; n++) if (n !== 21) carrier.note.push(n);
    S.storyboard.sprites.push(spr);
    S.storyboard.note_controllers.push(carrier);
    S.parentCarriers['parent_$note'] = true;
    S.dirty = true;
    let ok = false, err = null;
    try { ok = await window.__sb.saveStoryboard(); } catch (e) { err = String(e && e.stack || e); }
    return { ok, err };
  })()`);

  try {
    const sbDisk = JSON.parse(fs.readFileSync(path.join(TMP, 'storyboard.json'), 'utf8'));
    const ncs = sbDisk.note_controllers || [];
    const sprites = sbDisk.sprites || [];
    out.freshDesync.diskCheck = {
      hasParent21: ncs.some((c) => c.Id === 'parent_21'),
      spriteParent21: (sprites.find((s) => s.Id === 'sprite_1::21') || {}).ParentId,
      spriteCount: sprites.length
    };
  } catch (e2) {
    out.freshDesync.diskCheck = { error: String(e2 && e2.message || e2) };
  }

  out.consoleLogs = consoleLogs;
  out.ok = !!(out.open && out.open.spriteParentId === 'parent_$note') &&
    !!(out.save && out.save.ok) &&
    !!(out.desyncSave && out.desyncSave.ok) &&
    out.diskAfterDesyncSave && out.diskAfterDesyncSave.badParents &&
    out.diskAfterDesyncSave.badParents.length === 0 &&
    out.diskAfterDesyncSave.missingCarriers && out.diskAfterDesyncSave.missingCarriers.length === 0 &&
    !!(out.freshDesync && out.freshDesync.ok) &&
    out.freshDesync.diskCheck && out.freshDesync.diskCheck.hasParent21 === true &&
    out.freshDesync.diskCheck.spriteParent21 === 'parent_21';
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('EFFECTS_REPRO:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
