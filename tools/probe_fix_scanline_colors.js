// Verify the 工具 → 修复扫描线变速事件颜色 feature:
//  - a persistent user scanline_color controller covers the speed-event colors
//  - after the fix, a trailing controller pins the original event colors
//    (red/cyan) during each speed-change window and returns to the user's
//    base color in between
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fsc_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_fsc_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fsc_proj_'));
const CTR_PATH = path.join(TMP, 'FixScanline.ctr');
const CHART = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\chart.base.txt', 'utf8');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'FixScanline',
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
    // 用户写的一直生效的 scanline_color controller（红色）。
    const userCtl = { id: 'ctl_user', time: 0, scanline_color: '#ff0000' };
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [userCtl], note_controllers: [], templates: {} };
    window.__sb.preview.setStoryboard(S.storyboard);
    window.__sb.refreshAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(180);

    const evs = (S.chart.events || []).filter((ev) => ev.type === 0 || ev.type === 1);
    const down = evs.find((ev) => ev.type === 1);   // 首个 SpeedDown（青）
    const up = evs.find((ev) => ev.type === 0);     // 首个 SpeedUp（红）
    const mergedAt = (t) => {
      window.__sb.preview.evaluate(t);
      return window.__sb.preview.mergedCtrl && window.__sb.preview.mergedCtrl.scanline_color;
    };
    const close = (a, b) => !!a && Math.abs(a.r - b.r) < 0.03 &&
      Math.abs(a.g - b.g) < 0.03 && Math.abs(a.b - b.b) < 0.03;
    const CYAN = { r: 0.6289, g: 0.78125, b: 0.75 };
    const RED = { r: 0.82352, g: 0.33725, b: 0.41176 };
    const USER = { r: 1, g: 0, b: 0 };

    const before = mergedAt(down.time + 2); // 事件窗口内：被用户红色覆盖
    const beforeCovered = close(before, USER);

    // 通过“工具”菜单触发修复。
    const menuEntry = document.querySelector('.menu-entry[data-action="fix-scanline-event-colors"]');
    const menuExists = !!menuEntry;
    const toolsMenu = !!document.querySelector('.menu-item[data-menu="tools"]');
    const engineEntryInTools = !!document.querySelector('.menu-item[data-menu="tools"] .menu-entry[data-action="toggle-engine"]');
    const engineEntryInFile = !document.querySelector('.menu-item[data-menu="file"] .menu-entry[data-action="toggle-engine"]');
    menuEntry.click();
    await sleep(250);

    const ctls = S.storyboard.controllers || [];
    const fixCtl = ctls.find((c) => String(c.id).startsWith('ctl_scanline_fix'));
    const after = {
      fixExists: !!fixCtl,
      isLast: !!fixCtl && ctls[ctls.length - 1] === fixCtl,
      stateCount: fixCtl ? (fixCtl.states || []).length : 0,
      downWindow: mergedAt(down.time + 2),   // 变速窗口内应为事件色（青）
      upWindow: mergedAt(up.time + 2),       // 变速窗口内应为事件色（红）
      baseRestored: mergedAt(down.time + 6), // 事件结束后回到用户基准色（红）
      betweenEvents: mergedAt(up.time - 0.5) // 事件之间保持用户基准色
    };
    return { beforeCovered, menuExists, toolsMenu, engineEntryInTools, engineEntryInFile,
      eventCount: evs.length, after };
  })()`);

  out.ok = !!(
    out.beforeCovered &&
    out.menuExists && out.toolsMenu && out.engineEntryInTools && out.engineEntryInFile &&
    out.eventCount >= 2 &&
    out.after && out.after.fixExists && out.after.isLast && out.after.stateCount >= 8 &&
    (() => {
      const a = out.after;
      const CYAN = { r: 0.6289, g: 0.78125, b: 0.75 };
      const RED = { r: 0.82352, g: 0.33725, b: 0.41176 };
      const USER = { r: 1, g: 0, b: 0 };
      const close = (c, e) => c && Math.abs(c.r - e.r) < 0.03 && Math.abs(c.g - e.g) < 0.03 && Math.abs(c.b - e.b) < 0.03;
      return close(a.downWindow, CYAN) && close(a.upWindow, RED) &&
        close(a.baseRestored, USER) && close(a.betweenEvents, USER);
    })()
  );
  fs.writeFileSync(path.join(__dirname, 'probe_fix_scanline_colors_out.json'), JSON.stringify(out, null, 2));
  console.log('FSC_SUMMARY:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_fix_scanline_colors_out.json'), JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
