// Probe: does clicking timeline nodes reset the vertical scroll to the top?
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_scr_")));
require(path.join(__dirname, "..", "app", "main.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const OUT_JSON = path.join(__dirname, "probe_timeline_scroll_out.json");

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
  const out = await win.webContents.executeJavaScript(`(async () => {
    const tlScroll = document.getElementById('tlScroll');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const maxTop = () => Math.max(0, tlScroll.scrollHeight - tlScroll.clientHeight);
    const res = {};

    // Ensure the timeline has vertical scroll room.
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    res.initialTop = tlScroll.scrollTop;
    res.maxTop = maxTop();

    // Click a keyframe.
    const kf = document.querySelector('#tlScroll .kf');
    if (kf) {
      kf.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: kf.getBoundingClientRect().left + 2, clientY: kf.getBoundingClientRect().top + 2 }));
      await sleep(150);
      res.afterKeyframe = tlScroll.scrollTop;
    } else {
      res.afterKeyframe = 'NO_KF';
    }

    // Click a clip.
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    const clip = document.querySelector('#tlScroll .clip');
    if (clip) {
      clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: clip.getBoundingClientRect().left + 4, clientY: clip.getBoundingClientRect().top + 4 }));
      await sleep(150);
      res.afterClip = tlScroll.scrollTop;
    } else {
      res.afterClip = 'NO_CLIP';
    }

    // Click a lane label (track name).
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    const lbl = document.querySelector('#tlScroll .lane-label');
    if (lbl) {
      lbl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(150);
      res.afterLabel = tlScroll.scrollTop;
    } else {
      res.afterLabel = 'NO_LABEL';
    }

    // Isolate which sub-call resets the vertical scroll.
    const tl = window.__sb.timeline;
    const steps = {};
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    steps.start = tlScroll.scrollTop;
    tl.renderLanes();
    steps.afterRenderLanes = tlScroll.scrollTop;
    const lanesEl = document.getElementById('lanes');
    const contentEl = document.getElementById('tlContent');
    steps.heightsAfter = {
      scrollHeight: tlScroll.scrollHeight,
      clientHeight: tlScroll.clientHeight,
      lanesOffsetHeight: lanesEl ? lanesEl.offsetHeight : -1,
      contentOffsetHeight: contentEl ? contentEl.offsetHeight : -1
    };
    tlScroll.scrollTop = 400;
    steps.manual400 = tlScroll.scrollTop;
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    steps.restoredMax = tlScroll.scrollTop;
    tl.renderPlayhead();
    steps.afterPlayhead2 = tlScroll.scrollTop;
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    tl.renderPlayhead();
    steps.afterRenderPlayhead = tlScroll.scrollTop;
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    tl.setSelection(null, null);
    steps.afterSetSelection = tlScroll.scrollTop;
    tlScroll.scrollTop = maxTop();
    await sleep(120);
    document.getElementById('tlScroll .lane-label') && null;
    steps.afterManual = tlScroll.scrollTop;
    res.steps = steps;
    return res;
  })()`);
  clearTimeout(timer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log("PROBE_TL_SCROLL_OK");
  app.exit(0);
});
