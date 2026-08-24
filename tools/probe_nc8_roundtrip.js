// 验证：选择器合并时间块删除具体时间关键帧后重开不再复现。
// 根因：reconstructNoteSelectors 复制克隆字段时未跳过 states，导致
// 绝对时间展开产物与表达式令牌恢复的 states 各一份（翻倍）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rt_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const SRC = 'V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_rt_proj_'));
const CTR_PATH = path.join(TMP, '雪女.ctr');
const OUT = path.join(__dirname, 'probe_nc8_roundtrip_out.json');

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
    const cfg = Object.assign({}, ctr, { files: res.config.files });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: cfg });
    const S = window.__sb.state;
    await sleep(400);
    const R = {};
    const nc8 = () => (S.storyboard.note_controllers || []).find((n) => n.id === 'note_controller_8');

    // 1) 修复后加载：states 不应翻倍，不应含绝对时间 57.49999999999999
    const nc8a = nc8();
    R.loadedStates = (nc8a.states || []).map((s) => s.time);
    R.loadedStateCount = (nc8a.states || []).length;
    R.noNumericStates = (nc8a.states || []).every((s) => typeof s.time === 'string');
    R.loadedTime = nc8a.time;
    // key-list 无 57.499 数值组
    window.__sb.selectObject('note_controller_8', -1);
    await sleep(150);
    R.keyList = Array.from(document.querySelectorAll('#keyList .key-item')).map((el) => ({
      kfExp: el.dataset.kfExp, label: (el.querySelector('.klabel') || {}).textContent,
      t: (el.querySelector('.kt') || {}).textContent
    }));
    R.hasNumeric575 = R.keyList.some((x) => x.kfExp === '#57.49999999999999');

    // 2) compiled → fromCompiled → reconstruct 往返不翻倍
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const clones = window.SBEngine.storyboard.fromCompiled(compiled);
    const meta = window.__sb.collectNoteSelectorMeta();
    window.__sb.reconstructNoteSelectors(clones, meta);
    const rebuilt = (clones.note_controllers || []).find((n) => n.id === 'note_controller_8');
    R.rebuiltStates = (rebuilt.states || []).map((s) => s.time);
    R.rebuiltCount = (rebuilt.states || []).length;
    R.rebuiltNoNumeric = (rebuilt.states || []).every((s) => typeof s.time === 'string');

    // 3) 删除表达式组 start:$note:-0.1（6 个 state）→ 保存 → 重开 → 不再出现
    const exprItem = Array.from(document.querySelectorAll('#keyList .key-item[data-kf-exp]'))
      .find((el) => el.dataset.kfExp === 'start:$note:-0.1');
    R.exprItemFound = !!exprItem;
    if (exprItem) exprItem.querySelector('.del').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(150);
    R.afterDelStates = (nc8().states || []).length;
    await window.__sb.saveStoryboard();
    await sleep(300);
    // 重开项目（同一临时目录）
    const res2 = await window.sbAPI.projectOpen({ path: res.projectPath });
    const ctr2 = JSON.parse(await window.sbAPI.readFileText(${JSON.stringify(path.join(TMP, '雪女.ctr'))}));
    const cfg2 = Object.assign({}, ctr2, { files: res2.config.files });
    await window.__sb.loadLevelInfo(res2.info, { projectPath: res2.projectPath, config: cfg2 });
    await sleep(400);
    const nc8b = nc8();
    R.reopenedStates = (nc8b.states || []).map((s) => s.time);
    R.reopenedCount = (nc8b.states || []).length;
    R.reopenedTime = nc8b.time;
    return R;
  })()`);

  out.ok = !!(
    out.loadedStateCount === 6 && out.noNumericStates && out.loadedTime === 'intro:$note:-0.1' &&
    !out.hasNumeric575 &&
    out.rebuiltCount === 6 && out.rebuiltNoNumeric &&
    out.exprItemFound && out.afterDelStates === 0 &&
    out.reopenedCount === 0
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('NC8_RT:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
