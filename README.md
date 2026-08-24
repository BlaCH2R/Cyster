# Cyster v0.1beta

一款面向 Windows 的 **Cytoid 关卡 StoryBoard 可视化编辑软件**，采用类似剪映/剪辑软件的“时间轴 + 素材 + 实时预览”工作方式，让制谱者无需手写 JSON 即可完成 StoryBoard 演出编排，并导出**符合官方格式规范**的 StoryBoard 文件。

> StoryBoard 的全部功能严格以官方文档《StoryBoard 格式详解》（Cytoid Wiki，版本 2.0.2）中明确提及且有效的部分为准，未捏造任何非官方字段。渲染与求值语义以 [Cytoid 官方仓库](https://github.com/Cytoid/cytoid) v2.0.2 标签的 Unity 引擎源码为参考逐项对照实现。

---

## 功能特性

- **软件专用项目文件（.ctr，兼容旧版 .ctdsber）**：启动即进入欢迎页（交互逻辑参考 [Cylheim](https://github.com/Horiztar/Cylheim-Desktop)），包含“开始编辑”与“管理当前项目”两个区域，可新建/打开项目、从最近项目继续、在文件夹中显示/复制路径/移除记录。
- **新建项目**：分别选择音乐（.mp3/.ogg）、谱面（.txt/.json）、背景、StoryBoard 文件后统一加载；目标文件已存在时提供“打开已有项目 / 覆盖为新项目 / 取消”，已打开项目时提示“关闭当前项目并在本窗口创建”。
- **.cytoidlevel 导入**：可将现有关卡压缩包导入并转换为 `.ctr` 项目；已打开项目时可直接“导入到当前项目”（解压并替换当前项目关卡文件）。
- **可视化时间轴**：按对象类型分轨展示（Sprite / Text / Video / Line / Controller / Note Controller），支持：
  - 关键帧菱形拖拽（修改时间）
  - 整段片段平移（批量偏移对象内所有绝对时间）
  - 播放头拖拽、标尺点击跳转、缩放
  - 上一/下一关键帧跳转
- **素材库**：关卡内图片/音频/视频素材一览，双击图片直接创建 Sprite。
- **属性面板**：以表单方式编辑文档支持的全部字段（单位换算、颜色、缓动、图层、相机、全套滤镜、Note 覆盖项等），支持在播放头处一键添加关键帧、复制关键帧。
- **实时游戏预览（1:1 原版风格）**：内置按官方引擎语义实现的 Canvas 游戏视图渲染器，并直接使用从 CytoidPlayer 提取的**原版美术贴图**（NoteRing / NoteFill / FlickRing / FlickFill / Flick 左右箭头 / HoldLine / HoldTriangle / CDragFill / DragLine），配合原版渐入缩放/淡入动画、白色细环 + 内圈彩色填充（按接近程度生长）、Hold 色带 + 指向扫描线的三角、Drag 链白色虚线连线、白色柔和边缘扫描线、全部 StoryBoard 场景对象、相机与全套后处理滤镜。
- **原生样式重构**：Note 与扫描线已按原生规范重构——扫描线为 0.05 世界单位细实线（事件变色、无泛光）；Drag 连线使用 DragLine 贴图每 0.16 世界单位平铺的虚线样式、颜色跟随音符填充色并带渐入渐出；Hold/LongHold 带原版色带 + 扫描线端三角 + 随按住进度填充的进度环；C-Drag 头部绘制小菱形填充。
- **Note 清除动画**：Note 被触发后仅播放与原版一致的**青色涟漪环扩散**（0.4s、扩展至 5 世界单位、线宽 1.333→0.333、Perfect 色 #5BC0EB 渐隐；Flick 为对应外框的菱形），并立即隐藏该 Note。
- **60fps 流畅播放与自动同步**：播放进度由音频时钟逐帧驱动，播放前等待音乐可播放、并在音乐真正开始的瞬间自动校准（自动应用谱面 `music_offset`，无需手动偏移）；播放到谱面末尾自动停止；渲染器对未变化帧直接跳过、滤镜采用半分辨率缓冲，实测渲染耗时约 1ms/帧；播放控制条实时显示 FPS。
- **采样级音频同步**：音乐播放改用 Web Audio（`AudioContext`）解码与调度，替代浏览器音频元素——无缓冲启动延迟、无 `currentTime` 漂移，Note 清除动画与音乐节拍精确同步。
- **多难度关卡支持**：导入含多张谱面的关卡时自动选择带 StoryBoard 的主谱面（extreme > base > hard > easy，其次难度值），并自动应用该谱面的 `music_override` 音乐；StoryBoard 视频对象（`.mp4`）可正常加载与按时间轴步进。
- **谱面读取按原版机制**：与 Cytoid v2.0.2 一致 —— JSON 谱面优先解析（含 tempo 变化换算），非 JSON 的 legacy 文本谱面（`PAGE_SIZE/PAGE_SHIFT/NOTE/LINK`）自动回退解析；扫描线位置与速度完全按原版公式计算（随页面与 tempo 精确同步），Note 渐入时间按原版 `1.367/speed`（Drag 为 `1.175/speed`）计算。
- **代码级对齐 CytoidPlayer**：反编译本机 CytoidPlayer（Assembly-CSharp.dll）后逐项对齐——NoteType 枚举（0 Click / 1 Hold / 2 LongHold / 3 DragHead / 4 DragChild / 5 Flick / 6 CDragHead / 7 CDragChild）、NoteSizes 与 `GlobalNoteSizeMultiplier = size × 1.133333`、填充色索引（AlternativeColor → [0]）、游戏时间公式 `Time = PlaybackTime + MusicOffset`、默认 Note 颜色与 ID 常显；预览直接读取 `.ctr` 项目目录中的 level.json / 谱面 / StoryBoard / 音乐，仅保留播放画面（无 LunarConsole 报错侧边栏）。
- **Note ID 显示**：每个 Note 上显示其 ID（保持竖直、可读），默认开启，播放控制条“显示 Note ID”开关即时生效（勾选/取消后画面立即刷新）。
- **清除动画零延迟**：Note 在清除时刻立即隐藏，青色涟漪环在同一帧同时出现，与 Note 被清除的时间完全一致。
- **时间轴自动对齐音乐长度**：时间轴总长 = max(谱面长度, 实际音乐时长) + 1s，音乐加载完成后自动延伸，确保完整谱面始终可见。
- **欢迎页**：重写为卡片式布局（Hero + 新建/打开项目卡片 + .cytoidlevel 导入入口 + 最近项目 + 当前项目管理），交互逻辑参考 Cylheim。
- **规范导出**：
  - 导出标准 JSON 的 StoryBoard 文件（自动写入关卡目录并登记到 `level.json`）；
  - 一键打包为标准 `.cytoidlevel` 关卡包。

## 运行环境

- Windows 10 / 11（64 位）
- 无需安装 Node.js 或任何运行时（安装包已内置 Electron）

## 安装与启动

1. 运行安装包：`Cyster Setup 0.1.0-beta.exe`（或直接使用 `dist/win-unpacked/Cyster.exe` 免安装版）。
2. 软件启动后进入**欢迎页**：
   - **＋ 新建项目**：依次选择音乐、谱面、背景、StoryBoard 文件，指定 `.ctr` 保存位置后创建；
   - **打开项目 (.ctr / .ctdsber)**：选择已有的项目配置文件；
   - **导入 .cytoidlevel**：把现有关卡包转换为项目。

## 项目文件（.ctr）

- 项目由 `.ctr`（JSON 配置；旧版 `.ctdsber` 仍可直接打开）+ 同目录下的音乐/谱面/背景/StoryBoard/level.json 组成，自包含、可整体拷贝分享。
- 新建项目时，所选文件会被复制进项目文件夹（`.ctr` 所在目录），并自动生成 `level.json`。
- 顶部“项目设置”可随时更换音乐/谱面/背景/StoryBoard 并立即重新加载。
- 最近 6 个项目的快捷入口显示在欢迎页，支持在文件夹中显示、复制路径、移除记录。
- 顶部 🏠 可随时返回欢迎页；📁 打开当前项目所在文件夹。

## 界面速览

| 区域 | 说明 |
| --- | --- |
| 顶部工具栏 | 新建/打开项目、导入 .cytoidlevel、保存/导出、使用 Cytoidplayer 加载当前关卡、项目设置/设置 |
| 左侧素材库 | 关卡内素材；双击图片创建 Sprite |
| 左侧对象树 | 全部 StoryBoard 对象，按类型分组，可选中/删除 |
| 中央预览 | 实时游戏画面（含 Note、扫描线、StoryBoard 对象与滤镜） |
| 底部时间轴 | 对象轨道、关键帧、播放头、缩放 |
| 右侧属性 | 选中对象/关键帧的字段编辑与关键帧管理 |

常用快捷键：`空格` 播放/暂停；`←/→` 步进 0.05s；`Shift+←/→` 步进 0.5s。

## StoryBoard 功能支持范围（严格对应文档 v2.0.2）

### 顶层对象组
- `note_controllers`（Note 控制器）
- `controllers`（场景控制器）
- `sprites`、`texts`、`videos`（实验性）、`lines`
- `templates`（模板，引擎完整支持；界面暂以 JSON 方式编辑）

### 通用状态
- `id`（含 `$note` 占位）、`target_id`（同类型控制）、`parent_id`（Sprite/Text，含 Note 控制器父级）、`time`（秒或 `start/end/intro/at:<NoteID>[:偏移]`）、`time` 数组自动展开、`relative_time`、`add_time`、`easing`（官方 33 种缓动完整移植）、`states` 嵌套拍平、`destroy`、`reset`、`template`、`note` 选择器（type/start/end/direction/min_x/max_x）与数组/单值展开、`$note` 占位符。

### 场景对象状态
`x/y/z`、`rot_x/rot_y/rot_z`、`scale/scale_x/scale_y`、`opacity`、`width/height`、`layer`（0/1/2）、`order`、`fill_width`，支持 `stageX/stageY/noteX/noteY/cameraX/cameraY/world` 坐标系换算。

### Sprite / Text / Video / Line
- Sprite：`path`、`preserve_aspect`、`color`
- Text：`text`（富文本 b/i/size/color）、`size`、`color`、`align`、`letter_spacing`、`font_weight`
- Video：`path`、`color`
- Line：`pos` 端点数组（x/y/z 与每点 width/color）、全局 `width/color/opacity/layer/order`

### 场景控制器
- 不透明度：`storyboard_opacity`、`ui_opacity`、`scanline_opacity`、`background_dim`、`note_opacity_multiplier`
- 颜色：`scanline_color`、`note_ring_color`、`note_fill_colors`（12 项）
- 扫描线：`override_scanline_pos`、`scanline_pos`
- 相机：`perspective`、`fov`、`x/y/z`、`rot_x/rot_y/rot_z`
- 滤镜：`chromatical`(+fade/intensity/speed)、`bloom`(+intensity)、`radial_blur`(+intensity)、`color_adjustment`(brightness/saturation/contrast)、`color_filter`(+color)、`gray_scale`(+intensity)、`noise`(+intensity)、`sepia`(+intensity)、`dream`(+intensity)、`fisheye`(+intensity)、`shockwave`(+speed)、`focus`(+size/color/speed/intensity)、`glitch`(+intensity)、`arcade`(+intensity/interference_size/interference_speed/contrast)、`tape`
- 文档标记“在 Cytoid 2.0.0 中被移除”的 `vignette`、`chromatic`（旧）**不提供**；文档未提及的 `artifact`、`scanline_smoothing`、`font` 等**不提供**。

### Note 控制器
`note`、`override_x/y/z`、`x/y/z`、`x_multiplier/y_multiplier`、`dx/dy`、`override_rot_x/y/z`、`rot_x/y/z`、`override_ring_color`、`ring_color`、`override_fill_color`、`fill_color`、`opacity_multiplier`、`size_multiplier`、`hold_direction`、`style`。

## 导出说明

- “导出 StoryBoard JSON”会把当前编辑内容写为**标准 JSON**（无注释、无尾逗号，字段规范）到关卡目录，并自动登记到 `level.json` 的 `charts[].storyboard.path`。
- “导出 .cytoidlevel”会先把 StoryBoard 保存，再将整个关卡目录打包为标准 `.cytoidlevel`（zip）。
- 导出的 `.cytoidlevel` 可直接被 Cytoid / CytoidPlayer 加载验证。

## 技术实现

- **Electron**（主进程：文件/对话框/关卡解压打包；渲染进程：编辑器 UI）
- 自研 **StoryBoard 引擎**（`app/src/engine/`）：容错 JSON 解析、谱面解析、时间/占位符/选择器展开、状态插值与 33 种缓动，语义逐项对照官方 v2.0.2 C# 源码
- 自研 **游戏预览渲染器**（`app/src/renderer/`）：Canvas 合成背景 → StoryBoard 层0 → Note/扫描线 → 层1 → 层2 → UI → 后处理滤镜
- 关卡解压/打包使用 Windows 自带 PowerShell（`Expand-Archive`/`Compress-Archive`），无额外运行时依赖

## 目录结构

```
app/
  main.js / preload.js      Electron 主进程与桥接
  src/engine/               StoryBoard 引擎（解析/编译/求值/缓动/谱面）
  src/renderer/             编辑器 UI 与游戏预览渲染器
  assets/icon.ico           应用图标
  dist/                     打包产物（安装包 / win-unpacked）
reference/                  官方 v2.0.2 引擎源码参考（下载自 GitHub）
docs/storyboard_doc.txt     官方文档提取文本
tools/                      开发期测试脚本
```

## 已知限制（v0.1beta）

- 预览为“按官方语义与官方贴图实现的 2D 渲染”，与 Unity 原生画面存在少量观感差异（如部分滤镜为近似实现、透视相机为简化投影）。
- `videos` 对象按官方标记为实验性，预览中播放与暂停行为为近似实现。
- 关键帧拖拽仅支持绝对数字时间；`start:$note` 等相对时间字符串需在属性面板中编辑。
- `templates` 与 Note 选择器的编辑暂以 JSON 文本框方式提供。
- 音频与谱面时间轴自动应用谱面 `music_offset` 偏移。
- 打包安装程序未做代码签名，Windows 可能显示 SmartScreen 提示，选择“仍要运行”即可。

## 致谢

- [Cytoid / Cytoid](https://github.com/Cytoid/cytoid)（TigerHix、Neo 及社区）—— 游戏与 StoryBoard 引擎的开源实现
- [Cylheim](https://github.com/Horiztar/Cylheim-Desktop)（Horiztar）—— 欢迎页与项目创建/打开/冲突处理交互逻辑的设计参考
- Cytoid Wiki 社区 —— 《StoryBoard 格式详解》文档
- Robert Penner / C.J. Kimberlin —— 缓动函数实现

本项目与官方 Cytoid 无隶属关系，为社区二次开发工具。
