// 验证关键帧详细信息浮窗：
//  1) controller 关键帧包含 note_fill_colors 时，浮窗显示可读的 12 色 hex 信息
//  2) 浮窗层级低于通知（#toastWrap 200）和右键菜单（.context-menu 300）
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kftt_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_kftt_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_kftt_proj_'));
const CTR_PATH = path.join(TMP, 'KfTooltip.ctr');
const OUT = path.join(__dirname, 'probe_kf_tooltip_fill_out.json');
const SB_PATH = path.join(TMP, 'sb_fill.json');
const SB = {
  controllers: [{
    id: 'ctl_fill',
    states: [{
      time: 0,
      note_fill_colors: ['#35a7ff', '#ff5964', '#39e59e', '#ff0000', '#00ff00', '#0000ff',
        '#ffffff', '#000000', '#ff00ff', '#00ffff', '#ffff00', '#ff8a00']
    }]
  }],
  texts: [], sprites: [], videos: [], lines: [], note_controllers: [], templates: {}
};
fs.writeFileSync(SB_PATH, JSON.stringify(SB));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'KfTooltip',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(SB_PATH)}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = {};
    await new Promise((r) => setTimeout(r, 1500));
    const tl = window.__sb.timeline;
    // 找 controller 轨道的首个状态关键帧（data-kf !== '-1'，K0 显示的是对象级字段）。
    const el = [...document.querySelectorAll('#tlScroll .kf')].find((k) => {
      if (k.dataset.kf === '-1') return false;
      const id = k.dataset.id;
      const o = tl.objects.find((x) => x.id === id || x.id.indexOf(id + '::') === 0);
      return o && o.type === 'controller';
    });
    R.kfFound = !!el;
    if (el) {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 500));
      const tt = document.getElementById('kfTooltip');
      R.ttExists = !!tt;
      R.ttDisplay = tt ? getComputedStyle(tt).display : null;
      R.ttZ = tt ? getComputedStyle(tt).zIndex : null;
      R.text = tt ? tt.textContent : null;
      R.hasFillInfo = !!(tt && tt.textContent.indexOf('note_fill_colors=') >= 0);
      R.hasCustomHex = !!(tt && tt.textContent.indexOf('#ff0000') >= 0 && tt.textContent.indexOf('#00ff00') >= 0);
    }
    // 层级：通知 #toastWrap=200、右键菜单 .context-menu=300；浮窗须在其下。
    R.zOk = R.ttZ !== null && parseInt(R.ttZ, 10) < 200;
    return R;
  })()`);

  out.ok = !!(
    out.kfFound && out.ttExists && out.ttDisplay === 'block' &&
    out.hasFillInfo && out.hasCustomHex && out.zOk
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('KF_TOOLTIP_FILL:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
