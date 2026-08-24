const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const zipPath = 'D:/sd/Cytoid flies/player/示例关卡.cytoidlevel';
const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctd_unzip2_'));
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctd_stage_'));
const tmpZip = path.join(tmpDir, 'level.zip');
fs.copyFileSync(zipPath, tmpZip);
const cmd = `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${destDir}' -Force`;
const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true });
child.on('close', code => {
  const ok = fs.existsSync(path.join(destDir, 'level.json'));
  console.log('exit:', code, 'unzip ok:', ok, 'files:', ok ? fs.readdirSync(destDir).length : 0);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
