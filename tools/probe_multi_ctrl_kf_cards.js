// 验证：多选同一条 controller 轨道的多个关键帧时，卡片中数值不一致的字段应
// 显示“多个数值”，而不是套用第一个关键帧的数值；一致字段显示实际值；编辑
// 统一应用到全部选中关键帧。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mck_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_mck_proj_'));
const OUT = path.join(__dirname, 'probe_multi_ctrl_kf_cards_out.json');
const PROG = path.join(__dirname, '_mck_progress.log');
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

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 60000);
  await new Promise((r) => setTimeout(r, 2000));
  prog('ready');
  win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const R = {};
  const res = await js(`window.sbAPI.projectOpen({ path: ${JSON.stringify(CTR)} })`);
  await js(`(() => {
    window.__sb.loadLevelInfo(${JSON.stringify(res.info)}, { projectPath: ${JSON.stringify(res.projectPath)}, config: ${JSON.stringify(res.config)} });
    return true;
  })()`);
  await sleep(700);

  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.controllers.push({
      id: 'ctl_1', time: 0, x: 1, storyboard_opacity: 0.5, scanline_color: '#ff0000',
      states: [
        { time: 1, x: 5, storyboard_opacity: 0.9, scanline_color: '#ff0000', perspective: true },
        { time: 2, x: 9, storyboard_opacity: 0.3, scanline_color: '#ff0000', perspective: true }
      ]
    });
    // 模拟双击时间块的多选：选中该轨道全部关键帧（K0 + 两个 state）。
    S.selectedIds = ['ctl_1'];
    S.selectedKfs = [
      { objId: 'ctl_1', index: -1 },
      { objId: 'ctl_1', index: 0 },
      { objId: 'ctl_1', index: 1 }
    ];
    S.propsExplicitKf = true;
    window.__sb.renderProperties();
    return true;
  })()`);
  await sleep(400);

  R.panel = await js(`(() => {
    const card = (key) => document.querySelector('.ctrl-card[data-card="' + key + '"]');
    const num = (key) => {
      const c = card(key);
      const inp = c && c.querySelector('.ctrl-card-body input[type=number]');
      return inp ? { value: inp.value, placeholder: inp.placeholder } : null;
    };
    const color = (key) => {
      const c = card(key);
      const inp = c && c.querySelector('.ctrl-card-body input[type=text]');
      return inp ? { value: inp.value, placeholder: inp.placeholder } : null;
    };
    const toggle = (key) => {
      const c = card(key);
      const cb = c && c.querySelector('.ctrl-card-head input[type=checkbox]');
      return cb ? { checked: cb.checked, indeterminate: cb.indeterminate } : null;
    };
    return {
      cameraX: num('camera_x'),
      opacity: num('opacity_storyboard'),
      color: color('scanline_color'),
      perspective: toggle('camera_perspective'),
      count: document.querySelectorAll('.ctrl-card').length
    };
  })()`);

  // 编辑不一致字段（相机 X 输入 3）：应统一写入全部关键帧
  await js(`(() => {
    const c = document.querySelector('.ctrl-card[data-card="camera_x"]');
    const inp = c.querySelector('.ctrl-card-body input[type=number]');
    inp.value = '3';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  R.afterEdit = await js(`(() => {
    const obj = window.__sb.state.storyboard.controllers.find((o) => o.id === 'ctl_1');
    return {
      k0x: obj.x,
      s0x: obj.states[0].x,
      s1x: obj.states[1].x
    };
  })()`);

  const out = { R };
  out.ok = !!(
    R.panel && R.panel.cameraX && R.panel.cameraX.value === '' && R.panel.cameraX.placeholder === '多个数值' &&
    R.panel.opacity && R.panel.opacity.value === '' && R.panel.opacity.placeholder === '多个数值' &&
    R.panel.color && R.panel.color.value === '#ff0000' &&
    R.panel.perspective && R.panel.perspective.checked === false && R.panel.perspective.indeterminate === true &&
    R.panel.count > 0 &&
    R.afterEdit && R.afterEdit.k0x === 3 && R.afterEdit.s0x === 3 && R.afterEdit.s1x === 3
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('MULTI_CTRL_KF:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
