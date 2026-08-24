// probe_video_penguin.js — why doesn't the penguin project's video show?
const { app, BrowserWindow } = require('electron');
const path = require('path');
require(path.join(__dirname, '..', 'app', 'main.js'));

const PROJECT = 'V:/cytoid storyboarder/项目/测试：企鹅/銀河鉄道のペンギン/銀河鉄道のペンギン.ctdsber';

app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 1800));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 600));

  const res = await win.webContents.executeJavaScript(`(async () => {
    try {
      const p = await window.sbAPI.projectOpen({ path: ${JSON.stringify(PROJECT)} });
      // Multi-difficulty: pick the hard chart (the one with storyboard_hard.json)
      const promise = window.__sb.loadLevelInfo(p.info, { projectPath: p.projectPath, config: p.config });
      await new Promise(r => setTimeout(r, 300));
      const items = Array.from(document.querySelectorAll('#modalBody .pick-item'));
      const hard = items.find(el => el.textContent.indexOf('hard') >= 0);
      if (hard) hard.click();
      await promise;
      await new Promise(r => setTimeout(r, 2500));

      const pv = window.__sb.preview;
      const out = {};
      // Direct load attempt
      let loadErr = null;
      let loadRes = null;
      try {
        loadRes = await pv.loadVideo('video.mp4');
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        loadErr = String(e && e.message || e);
      }
      const v = pv.videoCache['video.mp4'];
      out.load = { loadErr, got: !!loadRes, cache: !!v, readyState: v ? v.readyState : -1, videoW: v ? v.videoWidth : 0, videoH: v ? v.videoHeight : 0, currentTime: v ? v.currentTime : -1 };
      for (const t of [2, 5, 30]) {
        pv.setTime(t, false);
        pv.render();
        const ev = pv.evalResult;
        const vid = ev.videos.find(r => r.from.path === 'video.mp4');
        const vv = pv.videoCache['video.mp4'];
        out[t] = {
          inEval: !!vid,
          opacity: vid && vid.from.opacity,
          path: vid && vid.from.path,
          stateTime: vid && vid.from.time,
          cache: !!vv,
          readyState: vv ? vv.readyState : -1,
          currentTime: vv ? +vv.currentTime.toFixed(2) : -1,
          videoW: vv ? vv.videoWidth : 0,
          videoH: vv ? vv.videoHeight : 0
        };
      }
      return out;
    } catch (e) {
      return { err: String(e && e.message || e) };
    }
  })()`);
  console.log('VIDEO:', JSON.stringify(res));
  app.exit(0);
});
