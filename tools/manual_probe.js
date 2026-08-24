// docx-preview 渲染冒烟探针：用随应用打包的手册 docx + 内联 HTML 走一遍
// jszip/docx-preview 的浏览器构建，结果写 tools/manual_probe_out.json 后退出。
// 不走完整应用启动，避免本机 _electron.launch 悬挂。
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const DOCX = path.join(__dirname, '..', 'app', 'assets', 'docs', 'Cyster使用手册(ver.0.1beta).docx');
const OUT = path.join(__dirname, 'manual_probe_out.json');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  const fail = (err) => {
    fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(err && (err.stack || err.message) || err) }, null, 2));
    app.exit(1);
  };
  try {
    await win.loadFile(path.join(__dirname, 'manual_probe.html'));
    const data = fs.readFileSync(DOCX).toString('base64');
    await win.webContents.executeJavaScript('window.__docxData = ' + JSON.stringify(data));
    const out = await win.webContents.executeJavaScript('window.__render()');
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    app.exit(out.ok ? 0 : 1);
  } catch (e) {
    fail(e);
  }
});

app.on('window-all-closed', () => app.quit());
