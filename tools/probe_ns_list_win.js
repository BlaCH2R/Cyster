// 只测独立窗口：列表模式展示、尺寸、切换回筛选样式（逐步写文件定位卡点）。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nslw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_nslw_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_nslw_proj_'));
const CTR_PATH = path.join(TMP, 'NsListWin.ctr');
const OUT = path.join(__dirname, 'probe_ns_list_win_out.json');

const writeOut = (o) => fs.writeFileSync(OUT, JSON.stringify(o, null, 2));

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); writeOut({ fatal: 'timeout' }); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'NsListWin',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard.note_controllers = S.storyboard.note_controllers || [];
    const ncList = { id: 'nc_list', note: [78, 5], time: 0, states: [] };
    S.storyboard.note_controllers.push(ncList);
    window.__sb.refreshAll();
    window.__sb.nsBridge('apply', [{ id: 'nc_list', note: [78, 5], merge: true }]);
    await window.sbAPI.nsOpen();
    return true;
  })()`);
  console.log('STAGE opened');

  const nsWin = BrowserWindow.getAllWindows().find((w) => w.getTitle().indexOf('Note 选择器') >= 0);
  console.log('STAGE found-window', !!nsWin);
  if (!nsWin) { app.exit(0); return; }

  await new Promise((r) => setTimeout(r, 1500));
  const wOut = await nsWin.webContents.executeJavaScript(`(() => {
    const list = document.getElementById('nsList');
    const filter = document.getElementById('nsFilterArea');
    const toFilter = document.getElementById('nsToFilter');
    return {
      listText: list ? list.innerText : null,
      filterDisplay: filter ? filter.style.display : null,
      toFilterDisplay: toFilter ? toFilter.style.display : null,
      status: (document.getElementById('nsStatus') || {}).textContent || ''
    };
  })()`);
  console.log('STAGE read-list', JSON.stringify(wOut).slice(0, 200));

  const clickDone = await nsWin.webContents.executeJavaScript(`(async () => {
    document.getElementById('nsToFilter').click();
    return 'clicked';
  })()`);
  console.log('STAGE clicked', clickDone);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('STAGE slept');
  // 直接在主窗口调用 nsBridge（绕过窗口 IPC），检查 nsApply 是否卡死。
  const direct = await win.webContents.executeJavaScript(`window.__sb.nsBridge('apply', [{ id: 'nc_list', note: {}, merge: true }])`);
  console.log('STAGE direct-apply', JSON.stringify(direct));
  let afterToggle = null;
  for (let i = 0; i < 30; i++) {
    try {
      afterToggle = await win.webContents.executeJavaScript(`(() => {
        const nc = window.__sb.state.storyboard.note_controllers.find((n) => n.id === 'nc_list');
        return { note: JSON.stringify(nc && nc.note), isArray: !!(nc && Array.isArray(nc.note)) };
      })()`);
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  writeOut({ stage: 'toggled', afterToggle });

  const wOut2 = await nsWin.webContents.executeJavaScript(`(() => ({
    listDisplay: document.getElementById('nsListRow').style.display,
    filterDisplay: document.getElementById('nsFilterArea').style.display,
    toFilterDisplay: document.getElementById('nsToFilter').style.display
  }))()`);
  writeOut({ stage: 'done', wOut2 });

  const out = {
    found: true,
    size: nsWin.getSize(),
    wOut, afterToggle, wOut2,
    ok: !!(
      nsWin.getSize()[0] === 520 && nsWin.getSize()[1] === 720 &&
      wOut.listText && wOut.listText.indexOf('#78') >= 0 && wOut.listText.indexOf('#5') >= 0 &&
      wOut.filterDisplay === 'none' && wOut.toFilterDisplay !== 'none' &&
      afterToggle && !afterToggle.isArray &&
      wOut2.listDisplay === 'none' && wOut2.filterDisplay !== 'none'
    )
  };
  writeOut(out);
  console.log('NS_LIST_WIN:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  writeOut({ fatal: String(e && e.stack || e) });
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
