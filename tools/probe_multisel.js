// Probe: multi-select/batch ops, keyframe easing badges + tooltip, thumbnails.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_ms_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_multisel_out.json");

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const chartPath = "chart.base.txt";
  const sbPath = "storyboard_compiled.json";
  const charts = [{
    type: "extreme",
    path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
    storyboardPath: sbPath,
    storyboardContent: fs.readFileSync(path.join(DIR, sbPath), "utf8"),
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: DIR, files, charts };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));
  await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo())})`);
  await new Promise((r) => setTimeout(r, 3500));
  let out;
  try {
    out = await win.webContents.executeJavaScript(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = {};

    // A. Keyframe badges + tooltip
    const kfs = [...document.querySelectorAll('#tlScroll .kf')];
    const badgeTexts = kfs.slice(0, 14).map((k) => (k.querySelector('.kf-ease') || {}).textContent || '');
    res.badgeCount = kfs.length;
    res.badgeNonEmpty = badgeTexts.filter((t) => t.trim()).length;
    res.badgeSamples = badgeTexts.filter((t) => t.trim()).slice(0, 8);
    const kfWithEase = kfs.find((k) => (k.querySelector('.kf-ease') || {}).textContent);
    if (kfWithEase) {
      kfWithEase.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(60);
      const tt = document.getElementById('kfTooltip');
      res.tooltip = tt ? tt.textContent : null;
      kfWithEase.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    }

    // B. Thumbnails inside sprite/video clips
    res.thumbTotal = document.querySelectorAll('#tlScroll .clip-thumb').length;
    res.levelDir = window.__sb.state.levelDir;
    res.thumbDirect = await new Promise((resolve) => {
      window.__sb.loadThumbnail('dad.png', (url) => resolve({ ok: !!url, head: url ? url.slice(0, 24) : null }));
    });
    res.spriteEntrySample = window.__sb.timeline.objects
      .filter((o) => o.type === 'sprite')
      .slice(0, 4)
      .map((o) => ({ id: o.id, path: o.path, clipStart: o.clipStart, clipEnd: o.clipEnd }));
    await sleep(2500);
    res.thumbWithSrc = [...document.querySelectorAll('#tlScroll .clip-thumb')].filter((t) => t.src).length;
    res.thumbStats = window.__sb._thumbStats || null;
    const liveThumb = document.querySelector('.clip-thumb[data-path="dad.png"]');
    res.liveThumbInfo = liveThumb ? { exists: true, hasSrc: !!liveThumb.src, srcHead: liveThumb.src.slice(0, 24) } : { exists: false };

    // C. Multi-select via Ctrl+click on two sprite clips
    const sprites = window.__sb.state.storyboard.sprites || [];
    const ids = sprites.filter((o) => o && o.id).map((o) => o.id).slice(0, 3);
    res.spriteIds = ids;
    const clips = ids.map((id) => document.querySelector('.clip[data-id="' + id + '"]')).filter(Boolean);
    for (const c of clips) {
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ctrlKey: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      await sleep(80);
    }
    res.selectedAfterCtrl = [...window.__sb.state.selectedIds];

    // D. Batch move via a real drag on one selected clip (same delta for all)
    const before = {};
    for (const id of res.selectedAfterCtrl) {
      const o = window.__sb.state.storyboard.sprites.find((x) => x.id === id) ||
                window.__sb.state.storyboard.lines.find((x) => x.id === id) ||
                window.__sb.state.storyboard.videos.find((x) => x.id === id) ||
                window.__sb.state.storyboard.texts.find((x) => x.id === id);
      before[id] = o && (typeof o.time === 'number' ? o.time : 'n/a');
    }
    const dragClip = document.querySelector('.clip[data-id="' + res.selectedAfterCtrl[0] + '"]');
    const tl = window.__sb.timeline;
    const px = tl.pxPerSec;
    if (dragClip) {
      const r = dragClip.getBoundingClientRect();
      const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
      dragClip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: sx, clientY: sy }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: sx + 5 * px, clientY: sy }));
      await sleep(60);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await sleep(150);
    }
    const after = {};
    for (const id of res.selectedAfterCtrl) {
      const o = window.__sb.state.storyboard.sprites.find((x) => x.id === id) ||
                window.__sb.state.storyboard.lines.find((x) => x.id === id) ||
                window.__sb.state.storyboard.videos.find((x) => x.id === id) ||
                window.__sb.state.storyboard.texts.find((x) => x.id === id);
      after[id] = o && (typeof o.time === 'number' ? o.time : 'n/a');
    }
    res.beforeMove = before;
    res.afterMove = after;

    // E. Copy absolute (times preserved) and relative (anchored at playhead)
    window.__sb.state.selectedIds = res.selectedAfterCtrl;
    window.__sb.copySelection(false);
    const absClones = window.__sb.state.selectedIds;
    res.absClones = absClones;
    res.absCloneTimes = absClones.map((id) => {
      const o = window.__sb.state.storyboard.sprites.find((x) => x.id === id) ||
                window.__sb.state.storyboard.lines.find((x) => x.id === id);
      return o && (typeof o.time === 'number' ? o.time : 'n/a');
    });
    window.__sb.setTime(123.456, false);
    window.__sb.copySelection(true);
    const relClones = window.__sb.state.selectedIds;
    res.relClones = relClones;
    res.relCloneTimes = relClones.map((id) => {
      const o = window.__sb.state.storyboard.sprites.find((x) => x.id === id) ||
                window.__sb.state.storyboard.lines.find((x) => x.id === id);
      return o && (typeof o.time === 'number' ? o.time : 'n/a');
    });

    // F. Batch delete the clones
    window.__sb.state.selectedIds = [...absClones, ...relClones];
    window.__sb.deleteSelection();
    res.afterDeleteCount = window.__sb.state.storyboard.sprites.length;
    const gone = [...absClones, ...relClones].filter((id) =>
      window.__sb.state.storyboard.sprites.some((x) => x.id === id) ||
      window.__sb.state.storyboard.lines.some((x) => x.id === id) ||
      window.__sb.state.storyboard.videos.some((x) => x.id === id) ||
      window.__sb.state.storyboard.texts.some((x) => x.id === id));
    res.clonesRemaining = gone.length;
    return res;
  })()`);
  } catch (e) {
    out = { fatal: String(e && e.message || e) };
  }
  clearTimeout(timer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log("PROBE_MULTISEL_OK");
  app.exit(0);
});
