// 验证：空 States 对象（Unity 端 IsManuallySpawned → States[0] 越界崩溃）的
// 导出过滤 + 加载自愈。
//  - fromCompiled 直接丢弃 States:[] 对象（controller_4）
//  - 编辑器加载后导出（toCompiled）不再包含空 States 对象
//  - 其它对象全部保留且 States 非空
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_emp_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const SRC = 'V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_emp_proj_'));
const CTR_PATH = path.join(TMP, '雪女.ctr');
const OUT = path.join(__dirname, 'probe_empty_controller_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: '雪女',
      music: ${JSON.stringify(path.join(SRC, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(SRC, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(SRC, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(SRC, 'storyboard.json'))}
    });
    const ctr = JSON.parse(await window.sbAPI.readFileText(${JSON.stringify(path.join(SRC, '雪女.ctr'))}));
    await window.__sb.loadLevelInfo(res.info, {
      projectPath: res.projectPath,
      config: Object.assign({}, ctr, { files: res.config.files })
    });
    const S = window.__sb.state;
    await sleep(400);
    const R = {};

    // 1) 加载自愈：内存中不应存在空壳 controller_4
    R.loadedHasC4 = !!((S.storyboard.controllers || []).find((c) => c.id === 'controller_4'));
    R.loadedControllerCount = (S.storyboard.controllers || []).length;
    R.loadedControllers = (S.storyboard.controllers || []).map((c) => c.id);

    // 2) fromCompiled 直接丢弃空 States 对象
    const raw = JSON.parse(await window.sbAPI.readFileText(${JSON.stringify(path.join(SRC, 'storyboard.json'))}));
    const parsed = window.SBEngine.storyboard.fromCompiled(raw);
    R.fromCompiledHasC4 = !!((parsed.controllers || []).find((c) => c.id === 'controller_4'));
    R.fromCompiledControllerCount = (parsed.controllers || []).length;

    // 3) 导出过滤：toCompiled 输出不含空 States 对象，且所有对象 States 非空
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const all = ['texts', 'sprites', 'videos', 'lines', 'controllers', 'note_controllers'];
    R.exportEmpty = [];
    for (const g of all) {
      for (const o of compiled[g] || []) {
        if (!o.States || o.States.length === 0) R.exportEmpty.push(g + ':' + o.Id);
      }
    }
    R.exportHasC4 = !!((compiled.controllers || []).find((c) => c.Id === 'controller_4'));
    R.exportControllerCount = (compiled.controllers || []).length;
    R.exportTotal = all.reduce((n, g) => n + (compiled[g] || []).length, 0);

    // 4) 手工构造空 controller 再导出：同样被过滤
    S.storyboard.controllers.push({ id: 'ctl_empty', time: 0, states: [] });
    const compiled2 = JSON.parse(window.__sb.storyboardCompiledJson());
    R.exportEmpty2 = !!((compiled2.controllers || []).find((c) => c.Id === 'ctl_empty'));
    return R;
  })()`);

  out.ok = !!(
    !out.loadedHasC4 && out.loadedControllerCount === 8 &&
    !out.fromCompiledHasC4 && out.fromCompiledControllerCount === 8 &&
    out.exportEmpty.length === 0 && !out.exportHasC4 &&
    out.exportControllerCount === 8 && out.exportTotal > 100 &&
    !out.exportEmpty2
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('EMPTY_CTL:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
