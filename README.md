# Cyster

一款面向 Windows 的 **Cytoid 关卡 StoryBoard 可视化编辑软件**，采用类似剪辑软件的“时间轴 + 素材 + 实时预览”工作方式，让用户无需手写 JSON 即可完成 StoryBoard 演出编排，并导出**符合官方格式规范**的 StoryBoard 文件。

> StoryBoard 的全部功能严格以官方文档《StoryBoard 格式详解》（Cytoid Wiki，版本 2.0.2）中明确提及且有效的部分为准。渲染与求值语义以 [Cytoid 官方仓库](https://github.com/Cytoid/cytoid) v2.0.2 标签的 Unity 引擎源码为参考逐项对照实现。

## 运行环境

- Windows 10 / 11（64 位）
- 无需安装 Node.js 或任何运行时（安装包已内置 Electron）

## 安装

运行安装包即可。

## 项目文件（.ctr）

- 项目由 `.ctr`（JSON 配置）+ 同目录下的音乐/谱面/背景/StoryBoard/level.json 组成，自包含、可整体拷贝分享。
- 新建项目时，所选文件会被复制进项目文件夹（`.ctr` 所在目录），并自动生成 `level.json`。
- 顶部“项目设置”可随时更换音乐/谱面/背景/StoryBoard 并立即重新加载。
- 最近项目（最多 100 项）的快捷入口显示在欢迎页，超出显示范围时可在列表内滚动查看，支持在文件夹中显示、复制路径、移除记录。
- 顶部 🏠 可随时返回欢迎页；📁 打开当前项目所在文件夹。


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
  
```

## 已知限制

- 预览为“按官方语义与官方贴图实现的 2D 渲染”，与 Unity 原生画面存在少量观感差异（如部分滤镜为近似实现、透视相机为简化投影）。
- `videos` 对象按官方标记为实验性，预览中播放与暂停行为为近似实现。
- 关键帧拖拽仅支持绝对数字时间；`start:$note` 等相对时间表达式需在属性面板中编辑。
- 音频与谱面时间轴自动应用谱面 `music_offset` 偏移。
- 打包安装程序未做代码签名，Windows 可能显示 SmartScreen 提示，选择“仍要运行”即可。

## 致谢

- [Cytoid / Cytoid](https://github.com/Cytoid/cytoid)（TigerHix、Neo 及社区）—— 游戏与 StoryBoard 引擎的开源实现
- [Cylheim](https://github.com/Horiztar/Cylheim-Desktop)（Horiztar）—— 欢迎页与项目创建/打开的设计参考
- Cytoid Wiki 社区 —— 《StoryBoard 格式详解》文档
- Robert Penner / C.J. Kimberlin —— 缓动函数实现

本项目与官方 Cytoid 无隶属关系，为社区二次开发工具。
