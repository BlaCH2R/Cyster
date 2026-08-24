// 验证“上/下移一层”的 4123 语义：
//  - 1/2/3/4 中选中 1/2/3 上移 → 4 被顶到最底（4,1,2,3），选中块整体上移
//  - 镜像：选中 2/3/4 下移 → 1 被顶到最顶（2,3,4,1）
//  - 合并轨道：同轨未选中成员保持原 order/原轨道，只顶开边界轨道的第一个成员
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_so_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_so_proj_'));
const OUT = path.join(__dirname, 'probe_shift_order_1234_out.json');
const PROG = path.join(__dirname, '_so_progress.log');
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
    // order 1..4，时间全部重叠（相邻对象占用同一时间位置 → 触发互换）
    const objs = [
      { id: 'spr_1', order: 1, time: 0 },
      { id: 'spr_2', order: 2, time: 0 },
      { id: 'spr_3', order: 3, time: 0 },
      { id: 'spr_4', order: 4, time: 0 }
    ];
    for (const o of objs) {
      S.storyboard.sprites.push({
        id: o.id, path: 'octa.png', time: o.time, x: 0, y: 0, opacity: 1,
        order: o.order, layer: 2, states: [{ time: o.time + 1 }]
      });
    }
    return true;
  })()`);
  await sleep(300);

  const readOrders = () => js(`(() => {
    const S = window.__sb.state;
    const byId = {};
    for (const o of S.storyboard.sprites) byId[o.id] = o.order;
    const tl = [...document.querySelectorAll('.lane-label .nm')].map((el) => el.textContent.trim());
    return { orders: byId, timelineTopToBottom: tl };
  })()`);
  R.before = await readOrders();

  // 场景 A：多选 order 1/2/3，上移一层 → 4 被顶到最底（4123）
  await js(`(() => {
    window.__sb.selectObjects(['spr_1', 'spr_2', 'spr_3'], {});
    window.__sb.shiftObjectOrder('spr_3', -1);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(600);
  R.afterUp = await readOrders();

  // 场景 B：新建一组对象，选中 order 2/3/4，下移一层 → 1 被顶到最顶（2341）
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites = [];
    const objs = [
      { id: 'dwn_a', order: 1, time: 10 },
      { id: 'dwn_b', order: 2, time: 10 },
      { id: 'dwn_c', order: 3, time: 10 },
      { id: 'dwn_d', order: 4, time: 10 }
    ];
    for (const o of objs) {
      S.storyboard.sprites.push({
        id: o.id, path: 'octa.png', time: o.time, x: 0, y: 0, opacity: 1,
        order: o.order, layer: 1, states: [{ time: o.time + 1 }]
      });
    }
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks(); // 并入轨道列表（并重编号）
    window.__sb.refreshAll();
    window.__sb.selectObjects(['dwn_b', 'dwn_c', 'dwn_d'], {});
    window.__sb.shiftObjectOrder('dwn_b', 1);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(600);
  R.afterDown = await js(`(() => {
    const S = window.__sb.state;
    const byId = {};
    for (const o of S.storyboard.sprites) byId[o.id] = o.order;
    return byId;
  })()`);

  // 场景 C：合并轨道——同轨未选中成员保持原 order，只顶开边界轨道第一个成员
  await js(`(() => {
    const S = window.__sb.state;
    // 独立数据：清掉前面场景的对象，只保留 m1/m2/n
    S.storyboard.sprites = [];
    // m1/m2 共轨（order 5，时间不重叠）；n 在 order 6
    const m1 = { id: 'm1', path: 'octa.png', time: 20, opacity: 1, layer: 2, order: 5, states: [{ time: 21 }] };
    const m2 = { id: 'm2', path: 'octa.png', time: 22, opacity: 1, layer: 2, order: 5, states: [{ time: 23 }] };
    const n = { id: 'n', path: 'octa.png', time: 24, opacity: 1, layer: 2, order: 6, states: [{ time: 25 }] };
    S.storyboard.sprites = [m1, m2, n];
    window.__sb.refreshAll();
    window.__sb.timeline.organizeTracks(); // 把 m1/m2 合并成一条轨道
    window.__sb.refreshAll();
    S.selectedIds = ['m1'];
    S.selectedObjId = 'm1';
    S.selectedKfs = [];
    window.__sb.shiftObjectOrder('m1', -1);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(600);
  R.merged = await js(`(() => {
    const S = window.__sb.state;
    const byId = {};
    for (const o of S.storyboard.sprites) byId[o.id] = o.order;
    const lanes = (window.__sb.readCysterTrackGroups() || {}).stage || [];
    return { orders: byId, lanes: JSON.parse(JSON.stringify(lanes)) };
  })()`);

  // 场景 D：相邻对象时间不重叠（位置空缺）→ 自由移动，不触发互换
  await js(`(() => {
    const S = window.__sb.state;
    S.storyboard.sprites = [];
    // 清掉 stage 合并轨道，回到默认“一对象一轨”（避免 organizeTracks 打包）
    const b = S.projectConfig.editor.difficulties[S.chartPath];
    b.timeline = b.timeline || { version: 5, trackGroups: { stage: [], note_controller: [], controller: [] }, lockedOrders: [] };
    b.timeline.trackGroups.stage = [];
    const objs = [
      { id: 'fr_1', order: 1, time: 0 },
      { id: 'fr_2', order: 2, time: 2 },
      { id: 'fr_3', order: 3, time: 4 },
      { id: 'fr_4', order: 4, time: 6 }
    ];
    for (const o of objs) {
      S.storyboard.sprites.push({
        id: o.id, path: 'octa.png', time: o.time, x: 0, y: 0, opacity: 1,
        order: o.order, layer: 3, states: [{ time: o.time + 1 }]
      });
    }
    window.__sb.refreshAll();
    window.__sb.selectObjects(['fr_1', 'fr_2', 'fr_3'], {});
    window.__sb.shiftObjectOrder('fr_1', -1);
    window.__sb.refreshAll();
    return true;
  })()`);
  await sleep(600);
  R.freeMove = await js(`(() => {
    const S = window.__sb.state;
    const byId = {};
    for (const o of S.storyboard.sprites) byId[o.id] = o.order;
    const lanes = (window.__sb.readCysterTrackGroups() || {}).stage || [];
    return { orders: byId, lanes: JSON.parse(JSON.stringify(lanes)) };
  })()`);

  const out = { R };
  out.ok = !!(
    // 4123：spr_3(3)→4、spr_4(4)→1，spr_1→2、spr_2→3
    R.afterUp && R.afterUp.orders.spr_1 === 2 && R.afterUp.orders.spr_2 === 3 &&
    R.afterUp.orders.spr_3 === 4 && R.afterUp.orders.spr_4 === 1 &&
    JSON.stringify(R.afterUp.timelineTopToBottom) === JSON.stringify(['spr_3', 'spr_2', 'spr_1', 'spr_4']) &&
    // 2341：organizeTracks 重编号后 b/c/d 在顶（order 1/2/3）、a 在底（0），
    // 下移 → b→0、c→1、d→2、a→3（底到顶 b,c,d,a = “2341”）
    R.afterDown && R.afterDown.dwn_a === 3 && R.afterDown.dwn_b === 0 &&
    R.afterDown.dwn_c === 1 && R.afterDown.dwn_d === 2 &&
    // 合并轨道：organizeTracks 重编号后 m1/m2 在 order 0、n 在 order 1；
    // m1 上移 → m1=1、n=0、m2（同轨未选中）保持 0
    R.merged && R.merged.orders.m1 === 1 && R.merged.orders.n === 0 && R.merged.orders.m2 === 0 &&
    R.merged.lanes.some((l) => l.includes('m2') && l.includes('n')) &&
    R.merged.lanes.some((l) => l.includes('m1')) &&
    // 自由移动：无时间重叠 → fr_3 移到 order 4 与 fr_4 同轨（不顶开 fr_4）
    R.freeMove && R.freeMove.orders.fr_1 === 2 && R.freeMove.orders.fr_2 === 3 &&
    R.freeMove.orders.fr_3 === 4 && R.freeMove.orders.fr_4 === 4 &&
    R.freeMove.lanes.some((l) => l.includes('fr_3') && l.includes('fr_4'))
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SHIFT_1234:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
