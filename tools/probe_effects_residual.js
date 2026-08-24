// EffectsTest 合并 sprite 时间块的行为核对（按游戏原版逻辑）：
// sprite 没有结束销毁状态（无 destroy）时，note 清除后 sprite 仍按最后状态
// 保持显示（父级占位回落屏幕中央）——这是游戏侧的正确行为，不应隐藏。
// 打开项目后逐时刻检查预览求值结果，确认该行为保持不变。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_resid_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const SRC = 'V:/cytoid storyboarder/项目/测试：效果/EffectsTest';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_resid_proj_'));
const OUT = path.join(__dirname, 'probe_effects_residual_out.json');

for (const f of ['level.json', 'chart.base.txt', 'storyboard.json', 'music.ogg', 'bg.jpg', 'octa.png', 'parent_note_to_sprite.ctr']) {
  fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const out = {};
  out.open = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(path.join(TMP, 'parent_note_to_sprite.ctr'))} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    await new Promise((r) => setTimeout(r, 2500));
    const S = window.__sb.state;
    const spr = (S.storyboard.sprites || []).find((o) => o.id === 'sprite_1');
    return {
      sprites: (S.storyboard.sprites || []).length,
      sprite: spr ? {
        id: spr.id,
        parent_id: spr.parent_id,
        note: spr.note,
        time: spr.time,
        x: spr.x, y: spr.y, opacity: spr.opacity,
        states: (spr.states || []).map((s) => ({ time: s.time, opacity: s.opacity }))
      } : null,
      carriers: (S.storyboard.note_controllers || []).filter((o) => String(o.id).indexOf('parent') === 0).map((o) => ({ id: o.id, noteCount: Array.isArray(o.note) ? o.note.length : null }))
    };
  })()`);

  out.eval = await win.webContents.executeJavaScript(`(async () => {
    const pv = window.__sb.preview;
    const compiled = pv.compiled;
    const compiledSprites = (compiled && compiled.sprites || []).map((s) => ({
      id: s.id, parentId: s.parentId, note: s.note,
      times: (s.states || []).map((st) => ({ t: st.time, op: st.opacity }))
    }));
    const at = [];
    const times = [0, 2.5, 10, 50, 300];
    for (const t of times) {
      pv.setTime(t, false);
      pv.render();
      const ev = pv.evalResult;
      const sprites = (ev && ev.sprites || []).map((s) => ({
        id: s.obj && s.obj.id,
        parentId: s.obj && s.obj.parentId,
        fromOpacity: s.from && s.from.opacity
      }));
      at.push({ t, spriteCount: sprites.length, sprites: sprites.slice(0, 4) });
    }
    return { compiledSpriteCount: compiledSprites.length, compiledSprites: compiledSprites.slice(0, 3), at };
  })()`);

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('EFFECTS_RESIDUAL:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
