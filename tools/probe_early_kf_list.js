// 验证：在 K0 之前（播放头早于对象 K0）添加关键帧后，关键帧列表按时间
// 正确排序——controller / note_controller 与 stage 对象一致，新帧成为 K0，
// 列表自上而下按时间递增；多值/不可解析时间不重定基；拖动不过 K0 约束不变。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ekl_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_ekl_proj_'));
const OUT = path.join(__dirname, 'probe_early_kf_list_out.json');
const PROG = path.join(__dirname, '_ekl_progress.log');
const prog = (s) => fs.appendFileSync(PROG, new Date().toISOString() + ' ' + s + '\n');

const MINI_CHART = JSON.stringify({
  format_version: 1, time_base: 480,
  tempo_list: [{ tick: 0, value: 500000 }],
  page_list: [{ start_tick: 0, end_tick: 9600, scan_line_direction: 1 }],
  note_list: [0, 1, 2, 3, 4].map((id) => ({
    page_index: 0, type: 0, id, tick: 480 + id * 480, x: 0.5,
    has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false
  }))
});
fs.writeFileSync(path.join(TMP, 'chart.txt'), MINI_CHART);
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

const R = { ok: false };

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); writeOut(); app.exit(1); }, 90000);
  try {
    await new Promise((r) => setTimeout(r, 2000));
    prog('ready');
    win = BrowserWindow.getAllWindows()[0];
    win.setSize(1400, 950);
    await new Promise((r) => setTimeout(r, 500));

    const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
    await js(`(() => {
      window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
      return true;
    })()`);
    await sleep(1000);

    // 准备三种对象：controller / note_controller / sprite，K0=5，K1=7。
    await js(`(() => {
      const S = window.__sb.state;
      S.storyboard.controllers.push({ id: 'ctl1', time: 5, opacity_multiplier: 1, states: [{ time: 7, opacity_multiplier: 0.5 }] });
      S.storyboard.note_controllers.push({ id: 'nc1', note: 0, time: 5, size_multiplier: 1, states: [{ time: 7, size_multiplier: 2 }] });
      S.storyboard.sprites.push({ id: 'sp1', time: 5, opacity: 1, x: 0, y: 0, path: 'octa.png', states: [{ time: 7, opacity: 0.5 }] });
      window.__sb.refreshAll();
      return true;
    })()`);
    await sleep(400);

    const kfList = () => js(`(() => {
      const els = Array.from(document.querySelectorAll('#keyList .key-item'));
      return els.map((el) => ({
        label: (el.querySelector('.klabel') || {}).textContent,
        time: (el.querySelector('.kt') || {}).textContent,
        kf: el.dataset.kf
      }));
    })()`);

    // ---- controller：播放头 2（早于 K0=5）添加关键帧 ----
    await js(`window.__sb.selectObject('ctl1', null); window.__sb.setTime(2, false); true`);
    await sleep(200);
    R.ctlBefore = await js(`(() => { const o = window.__sb.state.storyboard.controllers[0]; return { time: o.time, states: (o.states||[]).map(s=>s.time) }; })()`);
    R.ctlListBefore = await kfList();
    await js(`window.__sb.addKeyframeAtPlayhead(window.__sb.state.storyboard.controllers[0]); true`);
    await sleep(300);
    R.ctlAfter = await js(`(() => {
      const o = window.__sb.state.storyboard.controllers[0];
      return { time: o.time, states: (o.states||[]).map(s=>s.time), selectedKeyIdx: window.__sb.state.selectedKeyIdx };
    })()`);
    R.ctlListAfter = await kfList();

    // ---- note_controller：播放头 2 添加关键帧 ----
    await js(`window.__sb.selectObject('nc1', null); window.__sb.setTime(2, false); true`);
    await sleep(200);
    await js(`window.__sb.addKeyframeAtPlayhead(window.__sb.state.storyboard.note_controllers[0]); true`);
    await sleep(300);
    R.ncAfter = await js(`(() => {
      const o = window.__sb.state.storyboard.note_controllers[0];
      return { time: o.time, states: (o.states||[]).map(s=>s.time), selectedKeyIdx: window.__sb.state.selectedKeyIdx };
    })()`);
    R.ncListAfter = await kfList();

    // ---- sprite（回归）：同样应重定基 ----
    await js(`window.__sb.selectObject('sp1', null); window.__sb.setTime(2, false); true`);
    await sleep(200);
    await js(`window.__sb.addKeyframeAtPlayhead(window.__sb.state.storyboard.sprites.find(s=>s.id==='sp1')); true`);
    await sleep(300);
    R.spAfter = await js(`(() => {
      const o = window.__sb.state.storyboard.sprites.find(s=>s.id==='sp1');
      return { time: o.time, states: (o.states||[]).map(s=>s.time), selectedKeyIdx: window.__sb.state.selectedKeyIdx };
    })()`);
    R.spListAfter = await kfList();

    // ---- 守卫：note_controller 带 $note 表达式时间（不可解析）不重定基 ----
    await js(`(() => {
      const S = window.__sb.state;
      S.storyboard.note_controllers.push({ id: 'ncExpr', note: 1, time: 'start:$note', size_multiplier: 1, states: [{ time: 'end:$note', size_multiplier: 2 }] });
      window.__sb.refreshAll();
      return true;
    })()`);
    await js(`window.__sb.selectObject('ncExpr', null); window.__sb.setTime(2, false); true`);
    await sleep(200);
    await js(`window.__sb.addKeyframeAtPlayhead(window.__sb.state.storyboard.note_controllers.find(n=>n.id==='ncExpr')); true`);
    await sleep(300);
    R.ncExprAfter = await js(`(() => {
      const o = window.__sb.state.storyboard.note_controllers.find(n=>n.id==='ncExpr');
      return { time: o.time, states: (o.states||[]).map(s=>s.time) };
    })()`);

    // ---- 拖动约束回归：controller 状态帧拖到 K0 之前应被钳制在 K0 ----
    R.dragClamp = await js(`(() => {
      const o = window.__sb.state.storyboard.controllers[0];
      const before = JSON.parse(JSON.stringify(o));
      window.__sb.moveKeyframes([{ objId: 'ctl1', index: 0 }], -4.5);
      return {
        before: { time: before.time, s0: before.states[0].time },
        after: { time: o.time, s0: o.states[0].time }
      };
    })()`);

    // ---- 断言 ----
    const checks = [];
    const chk = (name, cond) => checks.push({ name, ok: !!cond });
    chk('controller: new earlier frame becomes K0 (time=2)', R.ctlAfter.time === 2);
    chk('controller: states sorted by time [5,7]', JSON.stringify(R.ctlAfter.states) === '[5,7]');
    chk('controller: selected as K0', R.ctlAfter.selectedKeyIdx === -1);
    chk('controller: list ordered K0(2) K1(5) K2(7)', R.ctlListAfter.length === 3 &&
      R.ctlListAfter[0].label === 'K0' && R.ctlListAfter[0].time === '2.000' &&
      R.ctlListAfter[1].label === 'K1' && R.ctlListAfter[1].time === '5.000' &&
      R.ctlListAfter[2].label === 'K2' && R.ctlListAfter[2].time === '7.000');
    chk('note_controller: new earlier frame becomes K0', R.ncAfter.time === 2 && JSON.stringify(R.ncAfter.states) === '[5,7]' && R.ncAfter.selectedKeyIdx === -1);
    chk('note_controller: list ordered K0(2) K1(5) K2(7)', R.ncListAfter.length === 3 &&
      R.ncListAfter[0].label === 'K0' && R.ncListAfter[0].time === '2.000' &&
      R.ncListAfter[1].label === 'K1' && R.ncListAfter[1].time === '5.000' &&
      R.ncListAfter[2].label === 'K2' && R.ncListAfter[2].time === '7.000');
    chk('sprite regression: new earlier frame becomes K0', R.spAfter.time === 2 && JSON.stringify(R.spAfter.states) === '[5,7]');
    chk('sprite: list ordered K0(2) K1(5) K2(7)', R.spListAfter.length === 3 &&
      R.spListAfter[0].label === 'K0' && R.spListAfter[0].time === '2.000' &&
      R.spListAfter[1].label === 'K1' && R.spListAfter[1].time === '5.000' &&
      R.spListAfter[2].label === 'K2' && R.spListAfter[2].time === '7.000');
    chk('guard: unresolvable $note times keep K0 (no rebase)', R.ncExprAfter.time === 'start:$note' &&
      R.ncExprAfter.states.some((t) => t === 2) && R.ncExprAfter.states.some((t) => t === 'end:$note'));
    chk('drag clamp: controller state cannot cross K0', R.dragClamp.before.time === 2 &&
      R.dragClamp.after.time === 2 && R.dragClamp.after.s0 > 2 && R.dragClamp.after.s0 < 2.002);
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
