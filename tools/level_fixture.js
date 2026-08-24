// Test fixture: extract the sample level zip to a temp dir and return its path.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const SAMPLE_ZIP = 'D:/sd/Cytoid flies/player/示例关卡.cytoidlevel';
const PENGUIN_ZIP = 'C:/Users/Bc/Downloads/10234.penguin.cytoidlevel';

function extract(zipPath, prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'cytoid_fx_'));
  const tmpZip = tmp + '.zip';
  fs.copyFileSync(zipPath, tmpZip);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${tmp}' -Force`]);
  return tmp;
}

module.exports = { SAMPLE_ZIP, PENGUIN_ZIP, extract };
