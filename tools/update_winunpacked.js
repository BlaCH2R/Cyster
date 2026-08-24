// Update the win-unpacked software body (app.asar) from the current source
// WITHOUT rebuilding the installer.
//
// Usage (PowerShell, from the workspace root):
//   & "C:\Users\Bc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\update_winunpacked.js
//
// The previous app.asar is kept as app.asar.bak for rollback.
const fs = require('fs');
const path = require('path');
const os = require('os');

const asar = require(path.join(__dirname, '..', 'app', 'node_modules', '@electron', 'asar'));

const APP = path.join(__dirname, '..', 'app');
const DEST = path.join(APP, 'dist', 'win-unpacked', 'resources', 'app.asar');

// Files/folders that go into the asar (node_modules and dev artifacts excluded).
const ENTRIES = ['main.js', 'preload.js', 'package.json', 'assets', 'src'];

// 主进程运行时依赖（electron-updater 及其闭包）也要进 asar：
// main.js require('electron-updater') 在打包版里从这里解析。
const RUNTIME_MODULES = ['electron-updater'];

// 递归收集 RUNTIME_MODULES 的 production 依赖闭包。
function resolveRuntimeModules() {
  const seen = new Set();
  const queue = [...RUNTIME_MODULES];
  const out = [];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const pkgDir = path.join(APP, 'node_modules', ...name.split('/'));
    const pkgPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      console.warn('missing runtime module: ' + name);
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    out.push(name);
    for (const dep of Object.keys(pkg.dependencies || {})) queue.push(dep);
  }
  return out;
}

// 从 package.json 的 build.publish 生成 electron-updater 需要的 app-update.yml。
function writeAppUpdateYml(staging) {
  const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
  const pub = (cfg.build && cfg.build.publish) || [];
  const gh = pub.find((p) => p && p.provider === 'github');
  if (!gh) return;
  let yaml;
  try {
    const jsYaml = require(path.join(APP, 'node_modules', 'js-yaml'));
    yaml = jsYaml.dump({
      provider: 'github',
      owner: gh.owner,
      repo: gh.repo,
      private: !!gh.private,
      releaseType: gh.releaseType || 'draft'
    }, { lineWidth: 120 });
  } catch (e) {
    yaml = 'provider: github\n' +
      'owner: ' + gh.owner + '\n' +
      'repo: ' + gh.repo + '\n' +
      'private: ' + !!gh.private + '\n' +
      'releaseType: ' + (gh.releaseType || 'draft') + '\n';
  }
  fs.writeFileSync(path.join(staging, 'app-update.yml'), yaml, 'utf8');
}

function copy(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dest, name));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  if (!fs.existsSync(path.join(APP, 'dist', 'win-unpacked', 'resources'))) {
    console.error('win-unpacked not found; run electron-builder once first.');
    process.exit(1);
  }
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_pack_'));
  try {
    for (const e of ENTRIES) {
      const src = path.join(APP, e);
      if (fs.existsSync(src)) copy(src, path.join(staging, e));
    }
    for (const name of resolveRuntimeModules()) {
      copy(path.join(APP, 'node_modules', ...name.split('/')), path.join(staging, 'node_modules', ...name.split('/')));
    }
    writeAppUpdateYml(staging);
    if (fs.existsSync(DEST)) fs.copyFileSync(DEST, DEST + '.bak');
    await asar.createPackage(staging, DEST);
    console.log('Updated ' + DEST);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e && e.message || e);
  process.exit(1);
});
