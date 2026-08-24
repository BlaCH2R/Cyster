// Verify R6 core: sprite $note parent_id carrier auto-create + ID handoff,
// merged time block for ALL object types (count badge), and time-input $note
// write (writeTime) for other object types.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r6_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_r6_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_r6_proj_'));
const CTR_PATH = path.join(TMP, 'R6.ctr');
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
      name: 'R6',
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
    const sprite = { id: 'wave_$note', note: { type: [3, 4] }, path: 'wave.png',
      time: 'start:$note', parent_id: 'wave_$note', layer: 0, order: 2, opacity: 1 };
    const text = { id: 'txt_sel', note: { type: [3, 4] }, text: 'x', time: 'end:$note', opacity: 1 };
    S.storyboard.sprites.push(sprite);
    S.storyboard.texts.push(text);
    window.__sb.preview.setStoryboard(S.storyboard);
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 250));

    // 1) sprite 应用选择器 → $note parent_id 载体自动创建。
    const sel = { type: [3, 4] };
    const carrier = window.__sb.ensureNoteSelectorParent(sprite, sel);
    const carrierCreated = !!carrier && carrier.id === 'wave_$note' &&
      carrier.time === 0 && window.__sb.state.parentCarriers['wave_$note'] === true &&
      (Array.isArray(carrier.note) ? carrier.note.length : window.__sb.noteSelectorIds(carrier.note).length) > 300;

    // 2) 用户为 note 78 创建独立控制器 → ID 交接（采用载体模板，载体收缩）。
    const ncNew = window.__sb.createNoteControllerWithIdHandoff([78], 1);
    const carrierAfter = (S.storyboard.note_controllers || []).find((nc) => nc.id === 'wave_$note');
    const idHandoff = ncNew.id === 'wave_$note' &&
      Array.isArray(carrierAfter.note) && !carrierAfter.note.includes(78) &&
      carrierAfter.note.length === 387;

    // 3) 全对象类型合并时间块：text 也支持（合并标记 + 计数徽标）。
    window.__sb.setNoteSelectorMerge('txt_sel', true);
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 200));
    const txtMerged = !!document.querySelector('.clip.selector-merged[data-id="txt_sel"]');
    const txtBadge = (document.querySelector('.clip.selector-merged[data-id="txt_sel"] .clip-count') || {}).textContent || '';

    // 4) 时间输入写入：writeTime 把 $note 表达式写入目标帧。
    window.__sb.state.nsTimeTarget = { objId: 'txt_sel', isK0: true, frame: -1 };
    const wt = window.__sb.nsWriteTime({ expr: 'intro:$note' });
    const timeWritten = wt && wt.ok && text.time === 'intro:$note';

    // 5) compiled 往返：sprite（$note id 模板）+ 载体重建。
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const clones = window.SBEngine.storyboard.fromCompiled(compiled);
    const meta = window.__sb.collectNoteSelectorMeta();
    window.__sb.reconstructNoteSelectors(clones, meta);
    const spriteBack = (clones.sprites || []).filter((x) => x.id === 'wave_$note');
    const textBack = (clones.texts || []).filter((x) => x.id === 'txt_sel');
    const roundTrip = spriteBack.length === 1 && textBack.length === 1 &&
      typeof spriteBack[0].note === 'object' && typeof textBack[0].note === 'object';

    return { carrierCreated, idHandoff, txtMerged, txtBadge, timeWritten, roundTrip };
  })()`);

  out.ok = !!(
    out.carrierCreated && out.idHandoff && out.txtMerged && out.txtBadge === '388×' &&
    out.timeWritten && out.roundTrip
  );
  fs.writeFileSync(path.join(__dirname, 'probe_ns_r6_out.json'), JSON.stringify(out, null, 2));
  console.log('R6_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_ns_r6_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
