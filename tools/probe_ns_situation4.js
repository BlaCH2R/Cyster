// 验证情形④：先创建部分 note_controller，再创建 sprite 的 note 选择器
// 部分/全部包含这些 note 时，parent_id 的 ID 分配行为：
//  - 已存在的普通 id（note_controller_1）→ 载体让位，sprite 克隆的父级解析到
//    该真实控制器（note_controller_1），不再生成 parent_<n> 占位
//  - 已存在的具体 parent_<n> id（parent_6）→ 载体让位，sprite 克隆直接复用它
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_s4_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_s4_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_s4_proj_'));
const CTR_PATH = path.join(TMP, 'S4.ctr');
const OUT = path.join(__dirname, 'probe_ns_situation4_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'S4',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    // 先创建的部分 note_controller
    S.storyboard.note_controllers.push({ id: 'note_controller_1', note: 5, time: 0 });
    S.storyboard.note_controllers.push({ id: 'parent_6', note: 6, time: 0 });
    // 再创建 sprite：parent_id 模板 + note 选择器
    S.storyboard.sprites.push({
      id: 'sprite_1', path: 'octa.png', time: 'intro:$note', parent_id: 'parent_$note',
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.dirty = true;
    return true;
  })()`);

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    // 应用 note 选择器（真实路径：创建 parent_$note 载体）
    const r = window.__sb.nsBridge('apply', [{ id: 'sprite_1', note: { start: 0, end: 10 }, merge: true }]);
    out.applyOk = !!(r && r.ok);
    const S = window.__sb.state;
    const carrier = (S.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    out.carrierNoteList = carrier ? carrier.note.slice().sort((a, b) => a - b) : null;
    out.carrierCovers5 = !!(carrier && carrier.note.includes(5));
    out.carrierCovers6 = !!(carrier && carrier.note.includes(6));
    // 编译后各 sprite 克隆的 ParentId
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const sprites = compiled.sprites || [];
    out.sprite5Parent = (sprites.find((s) => s.Id === 'sprite_1::5') || {}).ParentId;
    out.sprite6Parent = (sprites.find((s) => s.Id === 'sprite_1::6') || {}).ParentId;
    out.hasParent5 = (compiled.note_controllers || []).some((n) => n.Id === 'parent_5');
    // 继续编辑 note5 的 note_controller：右键等价入口
    const nc5 = window.__sb.nsBridge('getContext', []) && window.__sb.state.storyboard.note_controllers.find((n) => n.id === 'note_controller_1');
    out.nc5StillExists = !!nc5;
    out.findNcForNote5 = (() => {
      // 模拟右键菜单的判定：findNoteControllerForNote 未暴露，用相同逻辑验证
      for (const nc of S.storyboard.note_controllers) {
        if (nc.note == null) continue;
        if (S.parentCarriers[nc.id]) continue;
        if (nc.note === 5) return nc.id;
      }
      return null;
    })();
    return out;
  })()`);

  const out = { R };
  out.ok = !!(
    R.applyOk &&
    R.carrierCovers5 === false && R.carrierCovers6 === false &&
    R.sprite5Parent === 'note_controller_1' && R.sprite6Parent === 'parent_6' &&
    R.hasParent5 === false && R.nc5StillExists === true &&
    R.findNcForNote5 === 'note_controller_1'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('S4:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
