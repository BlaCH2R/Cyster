// 验收探针：欢迎页正常加载、预览播放（含变速事件时刻）、controller 属性卡片。
// 与正式应用共用 main.js，捕获渲染器异常/进程崩溃。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_wp_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_wp_');
const PROJ_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_wp_proj_'));
const CTR_PATH = path.join(PROJ_DIR, 'WelcomePreview.ctr');
// 用真实谱面（含变速事件与多页）作为预览播放输入。
const CHART = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\chart.base.txt', 'utf8');
const SB = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\storyboard.json', 'utf8');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  const errors = [];
  win.webContents.on('console-message', (e) => {
    const msg = (e && (e.message || (e.params && e.params[0]))) || '';
    if ((e.level || 0) >= 2 || /error|exception|uncaught|is not a function|undefined/i.test(String(msg))) {
      errors.push(String(msg).slice(0, 500));
    }
  });
  win.webContents.on('render-process-gone', (e, d) => errors.push('render-process-gone: ' + JSON.stringify(d)));
  win.webContents.on('unresponsive', () => errors.push('unresponsive'));
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const out = { steps: [], errors: [] };
    const fail = (label, e) => out.errors.push(label + ': ' + (e && (e.stack || e.message) || e));
    try {
      // 1) 欢迎页正常加载：welcome 元素可见、无渲染异常。
      await new Promise((r) => setTimeout(r, 500));
      const welcomeEl = document.querySelector('#welcome');
      out.welcomeVisible = !!(welcomeEl && welcomeEl.offsetParent !== null);
      out.bodyClass = document.body.className;
      out.steps.push('welcome');
    } catch (e) { fail('welcome', e); }
    try {
      // 2) 创建并打开项目（真实谱面 + 真实 storyboard）。
      const res = await window.sbAPI.projectCreate({
        projectPath: ${JSON.stringify(CTR_PATH)},
        name: 'WelcomePreview',
        music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
        chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
        background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
        storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
      });
      const cfg = { projectPath: res.resPath || res.config && res.config.projectPath || ${JSON.stringify(CTR_PATH)}, config: res.config };
      await window.__sb.loadLevelInfo(res.info, cfg);
      // 用雪女真实内容替换，尽量贴近用户环境。
      window.__sb.state.chart = new window.SBEngine.chart.Chart(${JSON.stringify(CHART)}, {});
      window.__sb.state.chartText = ${JSON.stringify(CHART)};
      // 雪女 storyboard 是编译格式（PascalCase），先转成可编辑格式。
      window.__sb.state.storyboard = window.SBEngine.storyboard.fromCompiled(JSON.parse(${JSON.stringify(SB)}));
      window.__sb.preview.chart = window.__sb.state.chart;
      window.__sb.preview.setStoryboard(window.__sb.state.storyboard);
      window.__sb.refreshAll();
      out.steps.push('project');
    } catch (e) { fail('project', e); }
    try {
      // 3) 预览播放：多个时刻（含变速事件时刻与普通时刻）渲染，画布有像素变化。
      const cv = document.querySelector('#previewCanvas');
      const ctx = cv.getContext('2d');
      const hashes = [];
      const ch = window.__sb.state.chart;
      const evTimes = (ch.speedEvents || []).slice(0, 3).map((s) => s.time);
      const times = [0.05, 1.0, 40.8, 41.2, 60.0].concat(evTimes).filter((t, i, a) => a.indexOf(t) === i);
      const hashData = (data) => {
        let h = 0;
        for (let i = 0; i < data.length; i += 997) h = (h * 31 + data[i]) >>> 0;
        return h;
      };
      for (const t of times) {
        window.__sb.setTime(t, false);
        await new Promise((r) => setTimeout(r, 120));
        hashes.push(hashData(ctx.getImageData(0, 0, cv.width, cv.height).data));
      }
      out.frameCount = hashes.length;
      out.framesDiffer = hashes.filter((h, i) => i > 0 && h !== hashes[0]).length;
      out.hashes = hashes;
      out.steps.push('preview');
    } catch (e) { fail('preview', e); }
    try {
      // 4) controller 属性卡片：真实 controller + 空 controller。
      const S = window.__sb.state;
      const realCtrl = (S.storyboard.controllers || [])[0];
      if (realCtrl) { window.__sb.selectObject(realCtrl.id, null); await new Promise((r) => setTimeout(r, 150)); }
      const cards1 = document.querySelectorAll('#stateForm .ctrl-card').length;
      const ctrlEmpty = { id: 'c_empty_test', time: 0 };
      S.storyboard.controllers.push(ctrlEmpty);
      window.__sb.refreshAll();
      window.__sb.selectObject('c_empty_test', null);
      await new Promise((r) => setTimeout(r, 150));
      const cards2 = document.querySelectorAll('#stateForm .ctrl-card').length;
      // 空控制器未启用任何卡片 → 轨道面板 0 张卡；启用 bloom 后显示 1 张。
      S.controllerCards = S.controllerCards || {};
      S.controllerCards.c_empty_test = ['bloom'];
      ctrlEmpty.bloom = true;
      window.__sb.refreshAll();
      await new Promise((r) => setTimeout(r, 150));
      const cards3 = document.querySelectorAll('#stateForm .ctrl-card').length;
      // 预览空白处：实时统计面板显示全部卡片。
      S.previewEmptyFocus = true;
      S.selectedObjId = null;
      S.selectedKeyIdx = null;
      window.__sb.refreshAll();
      await new Promise((r) => setTimeout(r, 150));
      const cardsAll = document.querySelectorAll('#stateForm .ctrl-card').length;
      const hasLiveStats = !!document.querySelector('#propBody [data-live-stat]');
      out.controllerCards = { real: cards1, empty: cards2 };
      out.controllerCards.enabledOne = cards3;
      out.controllerCards.allCards = cardsAll;
      out.controllerCards.hasLiveStats = hasLiveStats;
      // 灰色样式：空 controller 的未设置条目应带 .unset（标签/输入框变灰）。
      const unsetCount = document.querySelectorAll('#stateForm .ctrl-card .field.unset').length;
      const emptyColorText = Array.from(document.querySelectorAll('#stateForm .ctrl-card .field.unset input[type=text]'))
        .find((el) => !el.value && el.placeholder === '未设置');
      out.gray = { unsetCount, hasEmptyColorPlaceholder: !!emptyColorText };
      out.steps.push('controller-cards');
      // 5) 变速事件文字：跳到一个 SpeedUp/SpeedDown 时刻，检查画布中存在
      //    事件目标色（红/青）的像素（文字层）。
      const ev = window.__sb.state.chart.speedEvents && window.__sb.state.chart.speedEvents.find((s) => s.explicit);
      if (ev) {
        const cv2 = document.querySelector('#previewCanvas');
        const ctx2 = cv2.getContext('2d');
        window.__sb.setTime(ev.time + 0.2, false);
        await new Promise((r) => setTimeout(r, 200));
        const data = ctx2.getImageData(0, 0, cv2.width, cv2.height).data;
        let red = 0, cyan = 0;
        for (let y = 0; y < cv2.height; y += 2) {
          for (let x = 0; x < cv2.width; x += 2) {
            const i = (y * cv2.width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a > 60 && r > 150 && g < 130 && b < 150) red++;
            if (a > 60 && g > 150 && r < 130 && b < 190) cyan++;
          }
        }
        out.eventText = { kind: ev.kind, red, cyan };
      }
      out.steps.push('event-text');
    } catch (e) { fail('controller-cards', e); }
    return out;
  })()`);
  result.rendererErrors = errors;
  fs.writeFileSync(path.join(__dirname, 'probe_welcome_preview_out.json'), JSON.stringify(result, null, 2));
  console.log('WP_SUMMARY:', JSON.stringify({ steps: result.steps, welcomeVisible: result.welcomeVisible, framesDiffer: result.framesDiffer, controllerCards: result.controllerCards, gray: result.gray, eventText: result.eventText, errors }));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_welcome_preview_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
