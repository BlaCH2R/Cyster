// Probe: verifies Delete-on-marquee behavior. Simulates the marquee selection
// (all keyframes of several blocks selected) and checks whether every fully
// selected block is deleted as a whole.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_md_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_marquee_delete_out.json");
const CHART = "PAGE_SIZE 10\nPAGE_SHIFT 1\nNOTE 0 1 2\nNOTE 1 1 3\n";

function buildInfo(storyboard) {
  return {
    level: {
      schema_version: 2, version: 1, id: "probe.md", title: "Marquee Delete Probe",
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
    const sb = JSON.stringify({
      sprites: [
        { id: "s1", time: 0, x: 1, states: [{ time: 1, x: 2 }, { time: 2, x: 3 }] },
        { id: "s2", time: 3, x: 1, states: [{ time: 4, x: 2 }] },
        { id: "s3", time: 6, x: 1 }
      ],
      texts: [], videos: [], lines: [], controllers: [],
      note_controllers: [{ id: "nc1", note: [0, 1], time: 0, states: [{ time: 2, x: 0.7 }] }],
      templates: {}
    });
    await win.webContents.executeJavaScript(`window.__sb.loadLevelInfo(${JSON.stringify(buildInfo(sb))})`);
    await sleep(2500);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      // 先把 nc1 切换为合并显示（否则它是拆分块，没有合并标记）
      __.nsBridge('apply', [{ id: 'nc1', note: [0, 1], merge: true }]);
      // 合并块两端标记的样式（应为竖置长条：宽3px 高20px 无旋转）
      const mergedKf = document.querySelector('.kf.selector-merged');
      const mergedClip = document.querySelector('.clip[data-id="nc1"]');
      const cs = mergedKf ? getComputedStyle(mergedKf, '::before') : null;
      const kfRect = mergedKf ? mergedKf.getBoundingClientRect() : null;
      const clipRect = mergedClip ? mergedClip.getBoundingClientRect() : null;
      const barStyle = cs ? {
        width: cs.width, height: cs.height,
        transform: cs.transform, borderRadius: cs.borderRadius
      } : null;
      const alignment = (kfRect && clipRect) ? {
        barCenterY: +(kfRect.top + kfRect.height / 2).toFixed(2),
        clipCenterY: +(clipRect.top + clipRect.height / 2).toFixed(2),
        offsetY: +(kfRect.top + kfRect.height / 2 - (clipRect.top + clipRect.height / 2)).toFixed(2)
      } : null;
      // 模拟框选：s1 全部关键帧、s2 全部关键帧、s3 仅 K0、nc1 合并块两端标记
      __.state.selectedIds = ['s1', 's2', 's3', 'nc1'];
      __.state.selectedKfs = [
        { objId: 's1', index: -1 }, { objId: 's1', index: 0 }, { objId: 's1', index: 1 },
        { objId: 's2', index: -1 }, { objId: 's2', index: 0 },
        { objId: 's3', index: -1 },
        { objId: 'nc1', index: -1 }, { objId: 'nc1', index: -2 }
      ];
      __.state.selectedKeyIdx = -1;
      __.deleteSelection();
      const sbAfter = __.state.storyboard;
      return {
        barStyle,
        alignment,
        s1Gone: !(sbAfter.sprites || []).some(o => o.id === 's1'),
        s2Gone: !(sbAfter.sprites || []).some(o => o.id === 's2'),
        s3Gone: !(sbAfter.sprites || []).some(o => o.id === 's3'),
        nc1Gone: !(sbAfter.note_controllers || []).some(o => o.id === 'nc1'),
        remaining: (sbAfter.sprites || []).map(o => o.id).concat((sbAfter.note_controllers || []).map(o => o.id))
      };
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
