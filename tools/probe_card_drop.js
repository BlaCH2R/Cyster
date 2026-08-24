// Probe: verifies (1) dropping an un-enabled controller card onto the timeline
// creates a new controller track at the playhead (same as the preview drop),
// and (2) dropping an asset onto the preview creates stage objects with
// stagex/stagey coordinates instead of notex/notey.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_cd_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_card_drop_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\nNOTE 1 1 3\n";

function buildInfo() {
  const storyboard = JSON.stringify({
    sprites: [], texts: [], videos: [], lines: [], controllers: [],
    note_controllers: [], templates: {}
  });
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.cd", title: "Card Drop Probe",
      music: { path: "music.ogg" }, charts: [{ type: "easy", path: "chart.easy.txt" }]
    },
    levelDir: "V:/cytoid storyboarder/项目/测试：delusion/Delusion",
    files: [],
    charts: [{
      type: "easy", path: "chart.easy.txt", content: CHART,
      storyboardPath: "storyboard.json", storyboardContent: storyboard
    }]
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
    await sleep(2500);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const R = {};
      // 1) 未选中控制器时，把未启用卡片拖到时间轴 -> 自动创建控制器轨道
      const before = __.state.storyboard.controllers.length;
      __.selectObjects([], {});
      const t0 = __.preview.time;
      const tl = document.getElementById('tlContent');
      const r = tl.getBoundingClientRect();
      const dt = new DataTransfer();
      dt.setData('application/x-cytoid-ctrl-card',
        JSON.stringify({ groupKey: 'camera_perspective', values: { perspective: true } }));
      tl.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      const after = __.state.storyboard.controllers;
      R.cardTimelineCreated = after.length === before + 1;
      const nc = after[after.length - 1];
      R.cardTrack = nc ? {
        id: nc.id, time: nc.time, playhead: t0,
        cards: (__.state.controllerCards[nc.id] || []),
        perspective: nc.perspective === true
      } : null;

      // 2) 素材库拖入预览 -> stagex/stagey 默认坐标系
      const spritesBefore = (__.state.storyboard.sprites || []).length;
      const wrap = document.getElementById('previewWrap');
      const wr = wrap.getBoundingClientRect();
      const dt2 = new DataTransfer();
      dt2.setData('text/asset-name', 'octa.png');
      wrap.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt2,
        clientX: wr.left + wr.width / 2, clientY: wr.top + wr.height / 2 }));
      const sprites = __.state.storyboard.sprites || [];
      const spr = sprites[sprites.length - 1];
      R.spriteCreated = sprites.length === spritesBefore + 1;
      R.spriteUnits = spr ? { x: spr.x && spr.x.unit, y: spr.y && spr.y.unit,
        xv: spr.x && spr.x.value, yv: spr.y && spr.y.value } : null;
      return R;
    })()`);
    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(0);
  }
});
