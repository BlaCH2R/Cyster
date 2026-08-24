// 情形④影响分析：先有 note_controller（普通 id），再建 sprite 选择器包含该
// note → 载体仍覆盖该 note，形成“父级占位（parent_<n>）+ 真实控制器”并存。
// 检查（独立即让位后）：载体不再覆盖已有真实控制器的 note；编译产物只保留真实
// 控制器；对合并块的整体修改不再覆盖该 note；编辑入口仍指向真实控制器。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_s4i_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_s4i_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_s4i_proj_'));
const CTR_PATH = path.join(TMP, 'S4I.ctr');
const OUT = path.join(__dirname, 'probe_ns_situation4_impact_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'S4I',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    // 先创建的真实控制器：note 5，不透明度倍率 0.8
    S.storyboard.note_controllers.push({ id: 'note_controller_1', note: 5, time: 0, opacity_multiplier: 0.8 });
    // 再创建 sprite 选择器包含 note 5
    S.storyboard.sprites.push({
      id: 'sprite_1', path: 'octa.png', time: 'intro:$note', parent_id: 'parent_$note',
      x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true,
      states: [{ time: 'start:$note', opacity: 0.5 }]
    });
    S.dirty = true;
    return true;
  })()`);
  await win.webContents.executeJavaScript(`window.__sb.nsBridge('apply', [{ id: 'sprite_1', note: { start: 0, end: 10 }, merge: true }])`);
  await new Promise((r) => setTimeout(r, 500));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const S = window.__sb.state;
    const carrier = (S.storyboard.note_controllers || []).find((o) => o.id === 'parent_$note');
    out.carrierCovers5 = !!(carrier && carrier.note && carrier.note.includes(5));
    out.carrierBlockCount = carrier ? carrier.note.length : null;
    // 编译产物：note5 同时存在 parent_5（载体克隆）与 note_controller_1
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    out.compiledHasParent5 = (compiled.note_controllers || []).some((n) => n.Id === 'parent_5');
    out.compiledHasNc1 = (compiled.note_controllers || []).some((n) => n.Id === 'note_controller_1');
    out.compiledOrder = (compiled.note_controllers || []).filter((n) => n.Id === 'parent_5' || n.Id === 'note_controller_1').map((n) => n.Id);
    // 求值顺序：note 5 的 opacity 覆盖，两个控制器都设置同名字段时谁生效
    const pv = window.__sb.preview;
    pv.setStoryboard(S.storyboard);
    const n5 = S.chart.noteById(5);
    pv.setTime(n5.start_time, false);
    pv.evaluate(pv.time);
    out.overrideOpacityRealOnly = pv.noteOverrides[5] ? pv.noteOverrides[5].opacity : null;
    // 给载体合并块也设置同名字段（模拟对合并块做整体修改）
    carrier.opacity_multiplier = 1.2;
    S.dirty = true;
    pv.setStoryboard(S.storyboard);
    pv.setTime(n5.start_time, false);
    pv.evaluate(pv.time);
    out.overrideOpacityAfterCarrierEdit = pv.noteOverrides[5] ? pv.noteOverrides[5].opacity : null;
    // 右键入口：note5 应命中真实控制器
    out.findNc = (() => {
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
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('S4I:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
