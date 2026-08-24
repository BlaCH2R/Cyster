// Verify chart-file reading of speed-change events (变速事件) and page-length
// changes (页长变更):
//  - event_order_list parsed into typed events (SpeedUp/SpeedDown/Message)
//  - speedEvents auto-generated from explicit events + tempo changes
//  - presentation timeline (scanner color + SPEED UP/DOWN text)
//  - per-page length ticks and page-aware boundary/scan positions
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cep_ud_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_cep_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cep_proj_'));
const CTR_PATH = path.join(TMP, 'ChartEventsPages.ctr');
const CHART = fs.readFileSync('V:\\cytoid storyboarder\\项目\\实测：雪女\\雪女\\chart.base.txt', 'utf8');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'ChartEventsPages',
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
    const ch = new window.SBEngine.chart.Chart(${JSON.stringify(CHART)}, {});
    const events = ch.events || [];
    const kinds = {};
    for (const ev of events) kinds[ev.kind] = (kinds[ev.kind] || 0) + 1;
    const speedEvents = ch.speedEvents || [];
    const explicitSpeed = speedEvents.filter((s) => s.explicit).length;
    const tempoSpeed = speedEvents.filter((s) => !s.explicit).length;
    const tempoCount = (ch.model.tempo_list || []).length;
    const pageLens = ch.model.page_list.map((p) => p.length_tick);
    const lenDist = {};
    for (const l of pageLens) lenDist[l] = (lenDist[l] || 0) + 1;
    const firstSpeed = speedEvents[0];
    // 演示时间轴：在第一条显式变速事件前后 0.2s 取状态
    const pre = ch.eventPresentationAt(firstSpeed ? firstSpeed.time - 0.2 : 0);
    const at = ch.eventPresentationAt(firstSpeed ? firstSpeed.time + 0.2 : 0);
    const pageId = ch.pageIndexAtTime(firstSpeed ? firstSpeed.time : 0);
    const boundary = {
      id: pageId,
      top: ch.getPageBoundaryScreenY(pageId, false),
      bottom: ch.getPageBoundaryScreenY(pageId, true)
    };
    const scanYAt = ch.getScannerPositionY(firstSpeed ? firstSpeed.time : 0);
    const scanColorAt = ch.scannerColorAt(firstSpeed ? firstSpeed.time + 0.2 : 0);
    const noEventColor = ch.scannerColorAt(0.01);

    return {
      eventCount: events.length, kinds,
      speedEventCount: speedEvents.length, explicitSpeed, tempoSpeed, tempoCount,
      firstSpeed: firstSpeed ? { kind: firstSpeed.kind, time: firstSpeed.time } : null,
      preAt: pre ? pre.kind : null,
      atKind: at ? at.kind : null,
      atTextAlpha: at ? at.textAlpha : null,
      pageCount: ch.model.page_list.length,
      lenDist,
      boundary, scanYAt,
      scanColorAtR: scanColorAt.r,
      noEventColorR: noEventColor.r
    };
  })()`);

  // 预览渲染检查：把雪女谱面挂到预览，在变速事件时刻检查扫描线变色与文字。
  const preview = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    // 迷你谱面（无 note）：tick0 处 SpeedUp 事件，便于精确检查扫描线/文字像素。
    const mini = {
      time_base: 480,
      tempo_list: [{ tick: 0, value: 1000000 }],
      page_list: [{ start_tick: 0, end_tick: 960, scan_line_direction: 1 }],
      note_list: [],
      event_order_list: [{ tick: 0, event_list: [{ type: 0, args: '' }] }]
    };
    const ch = new window.SBEngine.chart.Chart(JSON.stringify(mini), {});
    window.__sb.preview.chart = ch;
    S.chart = ch;
    S.chartText = '';
    // 模拟 controller 把 scanline_color 固定为白色（覆盖事件的场景）：
    // 事件色不应生效，扫描线保持白色；文字仍用事件色。
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const ctrlWhite = { id: 'c_white', time: 0, scanline_color: '#ffffff', ui_opacity: 1 };
    S.storyboard.controllers.push(ctrlWhite);
    window.__sb.refreshAll();
    window.__sb.setTime(1.2, false); // 淡入完成后事件色全量
    await new Promise((r) => setTimeout(r, 350));
    const cv = document.querySelector('#previewCanvas');
    const ctx = cv.getContext('2d');
    const info = window.__sb.preview.ctxInfo();
    const scanY = ch.getScannerPositionY(1.2);
    const scanRow = Math.round(cv.height / 2 - window.__sb.preview.projectedY(scanY, info));
    const curPage = ch.pageIndexAtTime(1.2);
    const topWorldY = ch.getPageBoundaryScreenY(curPage, false);
    const topPx = cv.height / 2 - window.__sb.preview.projectedY(topWorldY, info);
    const size = Math.max(9, Math.min(20, 1.7 * info.S * 0.24));
    const textY = Math.max(4, Math.min(cv.height - size - 4, topPx - size * 0.55));
    const redPx = (data, y0, y1) => {
      let n = 0;
      for (let y = Math.max(0, y0); y < Math.min(cv.height, y1); y++) {
        for (let x = 50; x < cv.width - 50; x++) {
          const i = (y * cv.width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a > 50 && r > 150 && g < 130 && b < 140) n++;
        }
      }
      return n;
    };
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const scanRedWithCtrl = redPx(data, scanRow - 2, scanRow + 3);
    const textRedWithCtrl = redPx(data, textY - size, textY + size);
    // 诊断：事件状态 + 扫描线行任意强色像素
    const evState = ch.eventPresentationAt(1.2);
    let rowAny = 0;
    for (let x = 50; x < cv.width - 50; x++) {
      const i = (scanRow * cv.width + x) * 4;
      if (data[i + 3] > 120) rowAny++;
    }
    // 移除 controller 覆盖（scanline_color 置空）→ 事件色应作用于扫描线
    delete ctrlWhite.scanline_color;
    window.__sb.refreshAll();
    window.__sb.setTime(1.2, false);
    await new Promise((r) => setTimeout(r, 350));
    const data3 = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const scanRedNoCtrl = redPx(data3, scanRow - 2, scanRow + 3);
    const scanColorNow = ch.scannerColorAt(1.2);
    const px = [];
    for (let x = 200; x <= 600; x += 200) {
      const i = (scanRow * cv.width + x) * 4;
      px.push([data3[i], data3[i + 1], data3[i + 2], data3[i + 3]]);
    }
    // UI 透明度归零 → 文字消失
    ctrlWhite.ui_opacity = 0;
    window.__sb.refreshAll();
    window.__sb.setTime(1.2, false);
    await new Promise((r) => setTimeout(r, 350));
    const data4 = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const textRedUi0 = redPx(data4, textY - size, textY + size);
    return { scanRedWithCtrl, scanRedNoCtrl, textRedWithCtrl, textRedUi0, scanRow, textY, size,
      evState: evState ? { kind: evState.kind, r: Math.round(evState.color.r * 255), g: Math.round(evState.color.g * 255), b: Math.round(evState.color.b * 255), alpha: evState.textAlpha } : null,
      rowAny, canvas: cv.width + 'x' + cv.height,
      scanColorNow: scanColorNow ? { r: Math.round(scanColorNow.r * 255), g: Math.round(scanColorNow.g * 255), b: Math.round(scanColorNow.b * 255) } : null,
      px };
  })()`);

  const result = {
    eventCount: out.eventCount,
    kinds: out.kinds,
    speedEventCount: out.speedEventCount,
    explicitSpeed: out.explicitSpeed,
    tempoSpeed: out.tempoSpeed,
    tempoCount: out.tempoCount,
    firstSpeed: out.firstSpeed,
    preAt: out.preAt,
    atKind: out.atKind,
    atTextAlpha: out.atTextAlpha,
    pageCount: out.pageCount,
    lenDist: out.lenDist,
    boundary: out.boundary,
    scanYAt: out.scanYAt,
    scanColorAtR: out.scanColorAtR,
    noEventColorR: out.noEventColorR
  };
  result.preview = preview;

  // controller 属性清空检查：清空颜色/数值输入框后字段被删除且不再输出。
  const clearDel = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const C = { id: 'cc', time: 0, scanline_color: '#ff0000', scanline_opacity: 0.5 };
    S.storyboard.controllers.push(C);
    window.__sb.refreshAll();
    window.__sb.preview.setTime(0, false);
    window.__sb.selectObject('cc', null);
    const colorText = Array.from(document.querySelectorAll('#stateForm input[type=text]'))
      .find((el) => el.closest('.field') && el.closest('.field').querySelector('label') &&
        el.closest('.field').querySelector('label').textContent.trim().indexOf('扫描线颜色') === 0);
    const numInput = Array.from(document.querySelectorAll('#stateForm input[type=number]'))
      .find((el) => el.closest('.field') && el.closest('.field').querySelector('label') &&
        el.closest('.field').querySelector('label').textContent.trim().indexOf('扫描线不透明度') === 0);
    if (colorText) { colorText.value = ''; colorText.dispatchEvent(new Event('change', { bubbles: true })); }
    if (numInput) { numInput.value = ''; numInput.dispatchEvent(new Event('change', { bubbles: true })); }
    const colorDeleted = C.scanline_color === undefined;
    const numDeleted = C.scanline_opacity === undefined;
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const ccCompiled = (compiled.controllers || []).find((o) => o.Id === 'cc');
    const emitted = ccCompiled ? ccCompiled.States.some((s) =>
      s.ScanlineColor !== undefined || s.ScanlineOpacity !== undefined) : false;
    return { colorDeleted, numDeleted, emitted, found: !!colorText && !!numInput };
  })()`);
  result.clearDeletes = clearDel;
  fs.writeFileSync(path.join(__dirname, 'probe_chart_events_pages_out.json'), JSON.stringify(result, null, 2));
  console.log('CEP_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_chart_events_pages_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
