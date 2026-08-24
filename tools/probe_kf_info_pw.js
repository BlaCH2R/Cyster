// Playwright probe: keyframe detail info window - pinned on selection, follows
// the keyframe, always on top, and works for controllers too.
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

const kfCenter = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

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

    const readTooltip = () => win.evaluate(() => {
      const tt = document.getElementById("kfTooltip");
      const s = document.getElementById("tlScroll");
      if (!tt) return { exists: false };
      const cs = getComputedStyle(tt);
      const r = tt.getBoundingClientRect();
      return {
        exists: true,
        display: cs.display,
        position: cs.position,
        zIndex: cs.zIndex,
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(r.width),
        right: Math.round(r.right),
        viewportW: window.innerWidth,
        scrollLeft: s ? s.scrollLeft : null,
        scrollTop: s ? s.scrollTop : null,
        head: tt.textContent.split("\n").slice(0, 2).join(" | "),
      };
    });

    const res = {};

    // 1. Click a sprite keyframe away from the playhead.
    const kf1 = await win.evaluate(() => {
      const el = [...document.querySelectorAll("#tlScroll .kf")]
        .find((k) => parseInt(k.style.left, 10) > 300 && k.closest(".lane-track"));
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.id, kf: el.dataset.kf,
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        rect: { top: r.top, bottom: r.bottom },
      };
    });
    if (!kf1) throw new Error("No sprite keyframe found");
    await win.mouse.click(kf1.x, kf1.y);
    await win.waitForTimeout(350);
    res.afterSpriteSelect = await readTooltip();
    res.kf1Rect = kf1.rect;

    // 2. Click a second, different keyframe -> tooltip should move near it.
    const kf2 = await win.evaluate(() => {
      const els = [...document.querySelectorAll("#tlScroll .kf")];
      const el = els.find((k) => parseInt(k.style.left, 10) > 300 && k.dataset.kf !== "0" &&
        !(k.dataset.id === els[0].dataset.id && k.dataset.kf === els[0].dataset.kf));
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.id, kf: el.dataset.kf,
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        rect: { top: r.top, bottom: r.bottom },
      };
    });
    if (!kf2) throw new Error("No second keyframe found");
    await win.mouse.click(kf2.x, kf2.y);
    await win.waitForTimeout(350);
    res.afterSecondSelect = await readTooltip();
    res.kf2Rect = kf2.rect;

    // 3. Controller keyframe.
    const ckf = await win.evaluate(() => {
      const ctl = window.__sb.timeline.objects.find((o) => o.type === "controller");
      if (!ctl) return null;
      const el = document.querySelector('#tlScroll .kf[data-id="' + CSS.escape(ctl.id) + '"]');
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.id, kf: el.dataset.kf, ctlId: ctl.id,
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        rect: { top: r.top, bottom: r.bottom },
      };
    });
    if (ckf) {
      await win.mouse.click(ckf.x, ckf.y);
      await win.waitForTimeout(350);
      res.afterControllerSelect = await readTooltip();
      res.ckfRect = ckf.rect;
    }

    // 4. Scroll the timeline -> tooltip should follow (position changes).
    const before = await readTooltip();
    await win.evaluate(() => {
      const s = document.getElementById("tlScroll");
      s.scrollLeft += 120;
      s.scrollTop = Math.max(0, s.scrollTop + 40);
      s.dispatchEvent(new Event("scroll"));
    });
    await win.waitForTimeout(350);
    const after = await readTooltip();
    res.scrollBefore = before;
    res.scrollAfter = after;

    console.log("RESULT:", JSON.stringify(res));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error("FAIL:", e && e.stack || e);
  process.exit(1);
});
