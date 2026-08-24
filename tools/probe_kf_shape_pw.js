// Playwright probe: keyframe is a diamond again; hover label still works and
// is not rotated.
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

    const shape = await win.evaluate(() => {
      const k = [...document.querySelectorAll("#tlScroll .kf")]
        .find((el) => parseInt(el.style.left, 10) > 300);
      if (!k) return { found: false };
      k.scrollIntoView({ block: "center", inline: "nearest" });
      const cs = getComputedStyle(k);
      const before = getComputedStyle(k, "::before");
      const r = k.getBoundingClientRect();
      return {
        found: true,
        width: cs.width,
        height: cs.height,
        bg: cs.backgroundColor,
        beforeTransform: before.transform,
        beforeBg: before.backgroundColor,
        rect: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      };
    });

    let hover = null;
    if (shape.found) {
      await win.mouse.move(shape.rect.x, shape.rect.y);
      await win.waitForTimeout(300);
      hover = await win.evaluate(() => {
        const k = document.querySelector("#tlScroll .kf:hover");
        if (!k) return { hovered: false };
        const ease = k.querySelector(".kf-ease");
        const easeCs = ease ? getComputedStyle(ease) : null;
        return {
          hovered: true,
          easeDisplay: easeCs ? easeCs.display : null,
          easeTransform: easeCs ? easeCs.transform : null,
        };
      });
    }
    console.log("RESULT:", JSON.stringify({ shape, hover }));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
