// Playwright probe: keyframe hover label must not enlarge the hit area or
// interfere with clicking an adjacent keyframe.
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

    // Pick two adjacent keyframes that are close together in the SAME lane
    // and bring them into view.
    const pair = await win.evaluate(() => {
      const kfs = [...document.querySelectorAll("#tlScroll .kf")];
      const byTrack = new Map();
      for (const el of kfs) {
        const track = el.closest(".lane-track");
        if (!track) continue;
        const key = track;
        if (!byTrack.has(key)) byTrack.set(key, []);
        byTrack.get(key).push(el);
      }
      for (const [track, els] of byTrack) {
        const list = els
          .map((el) => ({ el, left: parseInt(el.style.left, 10), id: el.dataset.id, kf: el.dataset.kf }))
          .sort((a, b) => a.left - b.left);
        for (let i = 0; i < list.length - 1; i++) {
          const diff = list[i + 1].left - list[i].left;
          if (diff >= 1 && diff <= 25) {
            const a = list[i], b = list[i + 1];
            a.el.scrollIntoView({ block: "center", inline: "nearest" });
            b.el.scrollIntoView({ block: "center", inline: "nearest" });
            const ra = a.el.getBoundingClientRect();
            const rb = b.el.getBoundingClientRect();
            return {
              a: { left: a.left, id: a.id, kf: a.kf, cx: ra.left + ra.width / 2, cy: ra.top + ra.height / 2 },
              b: { left: b.left, id: b.id, kf: b.kf, cx: rb.left + rb.width / 2, cy: rb.top + rb.height / 2 },
            };
          }
        }
      }
      return null;
    });
    if (!pair) throw new Error("No close keyframe pair found");

    // Hover the FIRST of the pair.
    await win.mouse.move(pair.a.cx, pair.a.cy);
    await win.waitForTimeout(300);
    const hoverState = await win.evaluate((a) => {
      const under = document.elementFromPoint(a.cx, a.cy);
      const k = under && under.closest ? under.closest(".kf") : null;
      const ease = k ? k.querySelector(".kf-ease") : null;
      const cs = k ? getComputedStyle(k) : null;
      return {
        found: !!k,
        id: k ? k.dataset.id : null,
        width: cs ? cs.width : null,
        height: cs ? cs.height : null,
        easeDisplay: ease ? getComputedStyle(ease).display : null,
        easePointer: ease ? getComputedStyle(ease).pointerEvents : null,
        easeText: ease ? ease.textContent : null,
      };
    }, pair.a);

    // Real-click the SECOND of the pair while the first is hovered.
    await win.mouse.click(pair.b.cx, pair.b.cy);
    await win.waitForTimeout(250);
    const selected = await win.evaluate((b) => {
      const st = window.__sb.state;
      return {
        selectedObjId: st.selectedObjId,
        selectedKfs: st.selectedKfs || [],
        expectedObj: b.id,
        expectedKf: b.kf,
        matches: st.selectedObjId === b.id,
      };
    }, pair.b);

    console.log("RESULT:", JSON.stringify({ pair: { a: pair.a, b: pair.b }, hoverState, selected }));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
