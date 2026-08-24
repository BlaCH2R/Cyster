// Playwright UI probe: zoom slider right-alignment + keyframe hover badge.
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

    const footer = await win.evaluate(() => {
      const right = document.querySelector("#tlFooter .tl-right");
      const zoom = document.getElementById("zoomSlider");
      const footerRect = document.getElementById("tlFooter").getBoundingClientRect();
      const rightRect = right ? right.getBoundingClientRect() : null;
      return {
        hasRight: !!right,
        zoomInRight: right && zoom ? right.contains(zoom) : false,
        rightMarginAuto: right ? getComputedStyle(right).marginLeft : null,
        rightGapPx: rightRect && footerRect ? Math.round(footerRect.right - rightRect.right) : null,
      };
    });

    const kfBefore = await win.evaluate(() => {
      const k = document.querySelector("#tlScroll .kf");
      if (!k) return { found: false };
      const ease = k.querySelector(".kf-ease");
      const cs = getComputedStyle(k);
      return {
        found: true,
        kfWidth: cs.width,
        easeDisplay: ease ? getComputedStyle(ease).display : null,
        easeText: ease ? ease.textContent : null,
      };
    });

    // Hover a keyframe away from the playhead (t=0) to avoid interception.
    const pt = await win.evaluate(() => {
      const k = [...document.querySelectorAll("#tlScroll .kf")]
        .find((el) => parseInt(el.style.left, 10) > 300);
      if (!k) return null;
      const r = k.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top };
    });
    if (pt) {
      await win.mouse.move(pt.x, pt.y);
    }
    await win.waitForTimeout(400);
    const kfAfter = await win.evaluate(() => {
      const hovered = document.querySelector("#tlScroll .kf:hover");
      const ease = hovered ? hovered.querySelector(".kf-ease") : null;
      const cs = hovered ? getComputedStyle(hovered) : null;
      const tt = document.getElementById("kfTooltip");
      return {
        hovered: !!hovered,
        kfWidth: cs ? cs.width : null,
        easeDisplay: ease ? getComputedStyle(ease).display : null,
        easeText: ease ? ease.textContent : null,
        tooltipVisible: tt ? tt.style.display !== "none" : null,
        tooltipHead: tt && tt.textContent ? tt.textContent.split("\n").slice(0, 2).join(" | ") : null,
      };
    });

    console.log("RESULT:", JSON.stringify({ footer, kfBefore, kfAfter }));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
