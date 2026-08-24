// Playwright-driven thumbnail verification (reliable console output).
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
    await win.waitForTimeout(9000);
    const result = await win.evaluate(() => {
      const all = [...document.querySelectorAll("#tlScroll .clip-thumb")];
      const missing = {};
      for (const t of all) if (!t.src) missing[t.dataset.path] = (missing[t.dataset.path] || 0) + 1;
      const lineTotal = all.filter((t) => t.dataset.path === "line.png").length;
      const lineSel = document.querySelectorAll('.clip-thumb[data-path="' + CSS.escape("line.png") + '"]').length;
      return {
        total: all.length,
        withSrc: all.filter((t) => t.src).length,
        missing,
        lineTotal,
        lineSel,
        stats: window.SBThumbStats || null,
        debug: window.SBThumbDebug ? window.SBThumbDebug() : null,
      };
    });
    // Trigger one re-render; cached thumbnails should populate synchronously.
    await win.evaluate(() => {
      window.__sb.timeline.renderLanes();
    });
    await win.waitForTimeout(800);
    const after = await win.evaluate(() => {
      const all = [...document.querySelectorAll("#tlScroll .clip-thumb")];
      return { total: all.length, withSrc: all.filter((t) => t.src).length };
    });
    result.afterRerender = after;
    // Decisive: manually reload every missing path through loadThumbnail.
    const manual = await win.evaluate(() => new Promise((resolve) => {
      const paths = [...new Set(
        [...document.querySelectorAll("#tlScroll .clip-thumb")]
          .filter((t) => !t.src).map((t) => t.dataset.path)
      )];
      let n = 0;
      paths.forEach((p) => window.__sb.loadThumbnail(p, () => {
        n++;
        if (n === paths.length) resolve(paths);
      }));
      if (!paths.length) resolve([]);
    }));
    await win.waitForTimeout(600);
    const afterManual = await win.evaluate(() => {
      const all = [...document.querySelectorAll("#tlScroll .clip-thumb")];
      return { total: all.length, withSrc: all.filter((t) => t.src).length };
    });
    result.manualPaths = manual;
    result.afterManual = afterManual;
    // Direct assignment test on a missing thumbnail.
    const direct = await win.evaluate(() => {
      const mt = [...document.querySelectorAll("#tlScroll .clip-thumb")].find((t) => !t.src);
      if (!mt) return { found: false };
      const clip = mt.closest(".clip");
      const matched = document.querySelectorAll('.clip-thumb[data-path="' + CSS.escape(mt.dataset.path) + '"]').length;
      mt.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      return {
        found: true,
        path: mt.dataset.path,
        clipId: clip ? clip.dataset.id : null,
        matched,
        attached: !!mt.offsetParent || mt.getClientRects().length > 0,
        afterSet: !!mt.src,
      };
    });
    result.directTest = direct;
    console.log("RESULT:", JSON.stringify(result));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
