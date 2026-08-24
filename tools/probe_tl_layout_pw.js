// Playwright probe: measure timeline layout (name column / ruler / playhead
// / keyframes) before and after horizontal scroll + zoom, and test playhead
// drag clamping into the name column.
const fs = require("fs");
const path = require("path");
const { _electron } = require(path.join(__dirname, "..", "app", "node_modules", "playwright"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";

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

(async () => {
  const app = await _electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu"],
    cwd: path.join(__dirname, "..", "app"),
  });
  try {
    const win = await app.firstWindow();
    await win.waitForTimeout(2500);
    await win.evaluate((info) => window.__sb.loadLevelInfo(info), buildInfo());
    await win.waitForTimeout(5000);

    const measure = () => win.evaluate(() => {
      const r = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) };
      };
      const scroll = document.getElementById("tlScroll");
      const content = document.getElementById("tlContent");
      const labelRuler = document.getElementById("tlLabelRuler");
      const ruler = document.getElementById("ruler");
      const firstLabel = document.querySelector("#tlScroll .lane-label");
      const firstClip = document.querySelector("#tlScroll .clip");
      const firstKf = document.querySelector("#tlScroll .kf");
      const playhead = document.getElementById("playhead");
      return {
        scrollLeft: scroll.scrollLeft,
        content: r(content),
        labelRuler: r(labelRuler),
        ruler: r(ruler),
        rulerCanvasWidth: ruler ? ruler.width : null,
        firstLabel: r(firstLabel),
        firstClip: r(firstClip),
        firstKf: r(firstKf),
        playhead: r(playhead),
        playheadLeftStyle: playhead ? playhead.style.left : null,
      };
    });

    const res = {};
    res.atStart = await measure();
    // Zoom in a lot (simulates the user's zoom behavior).
    await win.evaluate(() => {
      const tl = window.__sb.timeline;
      tl.setZoom(200);
      tl.setTime(50, false);
    });
    await win.waitForTimeout(400);
    res.afterZoom = await measure();
    // Scroll right by 400px.
    await win.evaluate(() => {
      document.getElementById("tlScroll").scrollLeft = 400;
    });
    await win.waitForTimeout(300);
    res.afterScroll = await measure();

    // Test playhead drag into the name column: mousedown on playhead, then
    // move to x=60 (inside the 190px name column), then mouseup.
    const drag = await win.evaluate(async () => {
      const ph = document.getElementById("playhead");
      const pb = ph.getBoundingClientRect();
      ph.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: pb.left + 1, clientY: pb.top + 50 }));
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 60, clientY: pb.top + 50 }));
      await new Promise((r) => setTimeout(r, 80));
      const mid = ph.style.left;
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return {
        timeAfter: window.__sb.timeline.time,
        playheadLeftAfter: mid,
        playheadRectLeft: ph.getBoundingClientRect().left,
      };
    });
    res.dragIntoNameColumn = drag;
    console.log("RESULT:", JSON.stringify(res));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
