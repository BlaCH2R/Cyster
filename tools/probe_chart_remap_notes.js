// 验证：读取更改过（note ID 变更）的谱面后，往返内容（note 选择器等）的表现：
//  - 范围型选择器按新谱面重算命中集合（可能为空）
//  - 显式 ID 列表保留旧 ID → 时间无法解析，出现无关键帧的 per-note 条目
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_crm_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_crm_proj_'));
const OUT = path.join(__dirname, 'probe_chart_remap_notes_out.json');
const PROG = path.join(__dirname, '_crm_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const chartJson = (idOffset, type) => JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((i) => ({
    page_index: 0, type, id: i + idOffset, tick: 480 + i * 480, x: 0.1 + i * 0.2,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});
// 阶段 3 用：同 ID（0..4）但 tempo 变化 → 同一 ID 的 start/end/intro 全部错位
const chartShifted = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 400000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((i) => ({
    page_index: 0, type: 0, id: i, tick: 480 + i * 480, x: 0.5,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});

// 初始谱面：note id 0..4（type 0）
fs.writeFileSync(path.join(TMP, 'chart.txt'), chartJson(0, 0));
fs.writeFileSync(path.join(TMP, 'm.ogg'), 'x');
fs.writeFileSync(path.join(TMP, 'level.json'), JSON.stringify({
  schema_version: 2, version: 1, id: 't', title: 'T',
  music: { path: 'm.ogg' },
  charts: [{ type: 'easy', path: 'chart.txt' }]
}));
const CTR = path.join(TMP, 'Proj.ctr');
fs.writeFileSync(CTR, JSON.stringify({
  format: 'cytoid-storyboarder-project', version: 2, name: 'Proj',
  files: { music: 'm.ogg', chart: 'chart.txt', storyboard: 'sb.json' }
}));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null;
const js = (code) => win.webContents.executeJavaScript(code);

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  prog('ready');
  win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};
  const open = async () => {
    const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
    await js(`(() => {
      window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
      return true;
    })()`);
    await sleep(700);
  };
  await open();

  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({
      id: 'nc_range', note: { type: [0], start: 1, end: 3 }, time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.5 }]
    });
    S.noteSelectorMerge['nc_range'] = true;
    S.storyboard.note_controllers.push({
      id: 'nc_list', note: [2, 4], time: 'start:$note',
      states: [{ time: 'intro:$note', opacity_multiplier: 0.8 }]
    });
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(400);

  // 先用原谱面保存 storyboard（真实往返依赖已保存的展开克隆）
  R.saved = await js(`window.__sb.saveStoryboard()`);

  // 换谱面（模拟读取更改过的谱面）：note id 变为 10..14（type 0）
  const NEW_CHART = chartJson(10, 0);
  R.swap = await js(`(() => {
    try {
      const S = window.__sb.state;
      S.chartText = ${JSON.stringify(NEW_CHART)};
      S.chart = new window.SBEngine.chart.Chart(${JSON.stringify(NEW_CHART)}, { screenRatio: 16 / 9 });
      window.__sb.preview.chart = S.chart;
      window.__sb.preview.setStoryboard(S.storyboard);
      window.__sb.refreshAll();
      return { ok: true, noteIds: S.chart.notes.map((n) => n.id) };
    } catch (err) {
      return { err: String(err && err.stack || err) };
    }
  })()`);
  await sleep(500);

  R.after = await js(`(() => {
    try {
      const S = window.__sb.state;
      const range = S.storyboard.note_controllers.find((o) => o.id === 'nc_range');
      const list = S.storyboard.note_controllers.find((o) => o.id === 'nc_list');
      const timelineEntries = window.__sb.timeline.objects;
      return {
        rangeNote: JSON.parse(JSON.stringify(range.note)),
        rangeHitIds: window.__sb.collectNoteIds(range),
        listNote: JSON.parse(JSON.stringify(list.note)),
        listHitIds: window.__sb.collectNoteIds(list),
        lostCount: window.__sb.scanLostNoteMappings(),
        entries: (timelineEntries || []).filter((e) => e.id.indexOf('nc_') === 0).map((e) => ({
          id: e.id, kfs: (e.keyframes || []).map((k) => k.time), invalid: !!e.invalidNote
        }))
      };
    } catch (err) {
      return { err: String(err && err.stack || err) };
    }
  })()`);

  // 红框展示：时间块 clip 与 Note 输入框
  R.redMarks = await js(`(() => {
    const S = window.__sb.state;
    window.__sb.selectObject('nc_list', null);
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.redMarks = await js(`(() => {
    const redClips = document.querySelectorAll('.clip.invalid-note').length;
    const fNote = document.getElementById('fNote');
    return {
      redClips,
      fNoteInvalid: !!(fNote && fNote.classList.contains('invalid-note'))
    };
  })()`);

  // 对照：新谱面中存在的 note（12）映射有效，无红框
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.note_controllers.push({ id: 'nc_ok', note: 12, time: 'start:$note' });
    window.__sb.selectObject('nc_ok', null);
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(300);
  R.validCase = await js(`(() => {
    const fNote = document.getElementById('fNote');
    const S = window.__sb.state;
    return {
      fNoteInvalid: !!(fNote && fNote.classList.contains('invalid-note')),
      lost: window.__sb.scanLostNoteMappings()
    };
  })()`);

  // 阶段 2：真实往返——换谱面文件后重开（触发加载提示）
  fs.writeFileSync(path.join(TMP, 'chart.txt'), chartJson(10, 0));
  await open();
  R.reload = await js(`(() => {
    return {
      dialogTitle: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : null,
      dialogBody: document.getElementById('modalBody') ? document.getElementById('modalBody').textContent : null,
      redClips: document.querySelectorAll('.clip.invalid-note').length,
      lost: window.__sb.scanLostNoteMappings(),
      ncRange: (() => {
        const o = window.__sb.state.storyboard.note_controllers.find((x) => x.id === 'nc_range');
        return o ? JSON.parse(JSON.stringify(o.note)) : null;
      })(),
      ncList: (() => {
        const o = window.__sb.state.storyboard.note_controllers.find((x) => x.id === 'nc_list');
        return o ? JSON.parse(JSON.stringify(o.note)) : null;
      })()
    };
  })()`);
  // 关闭“检测到谱面变更”确认弹窗
  await js(`(() => {
    const btns = [...document.querySelectorAll('#modalFoot .dlg-btn')];
    const ok = btns.find((b) => b.textContent === '知道了');
    if (ok) ok.click();
    return true;
  })()`);

  // 阶段 3：同 ID 但时间错位（tempo 变更）→ 引用这些 ID 的选择器同样标红
  fs.writeFileSync(path.join(TMP, 'chart.txt'), chartShifted);
  await open();
  R.shift = await js(`(() => {
    const S = window.__sb.state;
    return {
      dialogTitle: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : null,
      dialogBody: document.getElementById('modalBody') ? document.getElementById('modalBody').textContent : null,
      shifted: S.chartShiftedNotes ? [...S.chartShiftedNotes].sort((a, b) => a - b) : [],
      lost: window.__sb.scanLostNoteMappings(),
      redClips: document.querySelectorAll('.clip.invalid-note').length,
      ncRange: (() => {
        const o = S.storyboard.note_controllers.find((x) => x.id === 'nc_range');
        return o ? JSON.parse(JSON.stringify(o.note)) : null;
      })(),
      ncList: (() => {
        const o = S.storyboard.note_controllers.find((x) => x.id === 'nc_list');
        return o ? JSON.parse(JSON.stringify(o.note)) : null;
      })()
    };
  })()`);
  await js(`(() => {
    const btns = [...document.querySelectorAll('#modalFoot .dlg-btn')];
    const ok = btns.find((b) => b.textContent === '知道了');
    if (ok) ok.click();
    return true;
  })()`);

  const out = { R };
  out.ok = !!(
    R.after && R.after.rangeHitIds.length === 0 &&
    R.after.lostCount === 2 &&
    R.after.entries.some((e) => e.id === 'nc_range' && e.invalid) &&
    R.after.entries.some((e) => e.id === 'nc_list::2' && e.invalid && e.kfs.length === 0) &&
    R.redMarks && R.redMarks.redClips >= 2 && R.redMarks.fNoteInvalid === true &&
    R.validCase && R.validCase.fNoteInvalid === false && R.validCase.lost === 2 &&
    R.reload && R.reload.dialogTitle === '检测到谱面变更' &&
    R.reload.dialogBody && R.reload.dialogBody.indexOf('失效或受影响') >= 0 &&
    R.reload.redClips >= 2 && R.reload.lost === 2 &&
    JSON.stringify(R.reload.ncRange) === JSON.stringify({ type: [0], start: 1, end: 3 }) &&
    JSON.stringify(R.reload.ncList) === JSON.stringify([2, 4]) &&
    R.shift && R.shift.dialogTitle === '检测到谱面变更' &&
    R.shift.dialogBody && R.shift.dialogBody.indexOf('失效或受影响') >= 0 &&
    R.shift.shifted.length === 5 && R.shift.lost === 2 && R.shift.redClips >= 2 &&
    JSON.stringify(R.shift.ncList) === JSON.stringify([2, 4])
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('CHART_REMAP:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
