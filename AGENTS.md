# Cytoid Storyboarder — 开发约定

## 更新软件本体（重要）

除非用户**明确要求**重新构建安装包，否则**不要运行 electron-builder / 不要重建
安装包**。完成代码修改后，直接更新 `app/dist/win-unpacked` 下的软件本体：

```powershell
& "C:\Users\Bc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\update_winunpacked.js
```

该脚本会把 `app/` 下的运行文件（main.js / preload.js / package.json / assets /
src，不含 node_modules）重新打包进
`app/dist/win-unpacked/resources/app.asar`，并把旧 asar 备份为 `app.asar.bak`。

仅当用户说“重新打包/构建安装包”时才执行：

```powershell
Push-Location "V:\cytoid storyboarder\app"
$env:NODE_PATH="V:\cytoid storyboarder\app\node_modules"
& $node "node_modules\electron-builder\out\cli\cli.js" --win --x64 --config.electronDist="V:\cytoid storyboarder\app\node_modules\electron\dist"
Pop-Location
Copy-Item -LiteralPath "app\dist\Cytoid Storyboarder Setup 0.1.0-beta.exe" -Destination "Cytoid Storyboarder Setup 0.1.0-beta.exe" -Force
```

## 测试约定

- 50 字以内的修改内容默认视为简单修改，直接跳过测试。
- 语法检查：`node --check`（Node 位于
  `C:\Users\Bc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`）。
- 运行 Electron 测试：`app\node_modules\electron\dist\electron.exe --disable-gpu --no-sandbox tools\<脚本>.js`。
- 测试脚本位于 `tools/`（smoke_test.js、verify_*.js、probe_*.js）。

## 命令超时与回退（用户级约定，所有命令通用）

- 任何命令运行超过 **180 秒**没有返回结果，一律判定为运行失败：立即杀掉整棵进程树，
  并**自动尝试其他方案**（换 GPU 参数重试 → 纯 Node 数学回退 → 报告失败并继续其他路径）。
- 易卡死的命令（Electron 探针、真实引擎 CytoidMain、PowerShell 截图等）**必须**通过
  `tools/run_cmd.js` 运行，禁止直接裸跑：
  ```powershell
  node tools\run_cmd.js --timeout 180 --watch tools\<out>.json `
    --fallback electron.exe --no-sandbox --disable-gpu --disable-software-rasterizer tools\<probe>.js `
    --fallback node tools\<probe_math>.js `
    -- electron.exe --no-sandbox --disable-gpu tools\<probe>.js
  ```
- 普通 shell 命令一律显式给出 `timeout_ms`（默认不超过 180s），避免无上限等待。
- 测试项目：`V:\cytoid storyboarder\项目\测试：企鹅\銀河鉄道のペンギン\銀河鉄道のペンギン.ctdsber`。
  - 残留的 Electron/Cytoid 进程可能锁住文件导致测试卡死；超时先清理（用单管道快速写法，
    避免旧式 `Get-Process | Where-Object` 在全进程表上扫描的额外耗时）：
    `& 'V:\cytoid storyboarder\tools\kill_cytoid.ps1'`
    等价内联：`Get-Process -Name 'electron','Cytoid*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`。

## Electron 探针脚本约定（重要，避免卡死）

- **不要**用 Playwright `_electron.launch` 启动完整应用做探针（例如旧版
  `probe_gl_filters_pw.js`、`probe_orientation.js`）：本机这类启动必挂、不退出、
  还会残留多个 electron 进程。
- **不要**用 `Start-Process -WindowStyle Hidden` 启动 Electron 探针：同样会挂。
- 优先轻量探针：普通 Electron 主进程 + 隐藏 BrowserWindow + 内嵌 HTML，
  渲染脚本用 `fs.writeFileSync` 写结果文件后 `window.close()`，主进程
  `window-all-closed` 退出。直接用
  `& electron.exe --no-sandbox --disable-gpu tools\<探针>.js` 调用，几秒内完成。
- 现成模板：
  - `tools/probe_fx_shaders.js` + `tools/fx_shader_test.html`（GL 滤镜冒烟：结果写
    `tools/probe_fx_shaders_out.json`）。
  - `tools/probe_orientation.js` + `tools/fx_orientation_test.html`（GL 帧方向校验：
    结果写 `tools/probe_orientation_out.json`，`flipped` 必须为 false）。

## 视觉/几何类验证约定（重要，避免低效循环）

- 滤镜、旋转方向、投影、坐标等**优先从代码层面直接验证**：写轻量探针调用真实代码
  （`preview.js` / `effects.js`），用数值断言方向/形状（如 +rot_x 时底部音符深度更大、
  梯形更宽），不要走“实机截图 + 视觉模型”的低效循环。视觉模型的方向判断不可靠，
  只能用于最终人工确认。
- **用户发图时，本会话没有原生图像输入（`view_image` 不可用），必须自动改用 vision
  skill 分析用户发送的图片**（`C:\Users\Bc\.codex\skills\vision\vision.py`，
  提供者如 qwen），不要回复“看不到图片”。图片路径通常在
  `C:\Users\Bc\AppData\Local\Temp\codex-clipboard-*.png`。
- 相机 3D 投影方向测试模板：`tools/test_camera_rot.js` + `tools/test_camera_rot.html`
  （直接实例化 `PreviewRenderer`，断言 rot_x/rot_y 正负方向、零旋转与旧公式一致、
  `projectedY` 与 `worldToPx` 一致、ortho 模式 depth=1）。运行：
  `& electron.exe --no-sandbox --disable-gpu tools\test_camera_rot.js`，
  结果写 `tools/test_camera_rot_out.json`，`ok` 必须为 true。
- 实在需要真实 cytoidplayer 截图时：**先用空格键暂停播放，再配合时间轴滑块 seek 到
  目标时刻**（`tools/_fx_test/capture_player.ps1` 已支持 `-Pause` 与 `-Seek`），
  不要分析播放中的画面（画面每帧都在变，无法对照）。
