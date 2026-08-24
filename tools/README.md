# tools/

本目录只跟踪**常用/文档引用**的开发脚本，其余数百个探针、回归与分析脚本
仅保存在本地开发机，不入库（见根目录 .gitignore 的 `tools/*` 白名单）。

## 常用脚本

- `update_winunpacked.js`：把 app/ 源码重打进 `app/dist/win-unpacked/resources/app.asar`
- `run_cmd.js`：命令看门狗（超时杀进程 + fallback）
- `kill_cytoid.ps1`：清理残留的 Electron/Cytoid 进程
- `smoke_test.js` / `verify_v2.js`：冒烟与主回归
- `run_probe.js` / `run_probe.ps1`：探针运行器
- `check_asar.js`：校验 asar 内容
- `probe_fx_shaders.js` + `fx_shader_test.html`：GL 滤镜冒烟模板
- `probe_orientation.js` + `fx_orientation_test.html`：GL 帧方向校验模板
- `test_camera_rot.js` + `test_camera_rot.html`：相机 3D 投影方向测试模板

## 近期功能回归探针

- `manual_probe.js` / `manual_probe.html`：docx-preview 手册渲染（文本框/⭐）
- `manual_app_probe.js`：手册窗口 + 目录跳转 + 适应宽度
- `tips_probe.js`：欢迎页 Tips 浮窗
- `undo_desc_probe.js`：撤销/重做行为描述
- `dblclick_ns_probe.js`：时间块双击全选（含 note 选择器）
- `unsaved_dialog_probe.js`：未保存确认与打开项目提示去重
- `update_entry_probe.js`：检查更新入口与 GitHub 链接
- `i18n_probe.js`：语言切换（简体/繁体/英文）与词典/schema 本地化验证

其余 `tools/` 脚本属于本地开发资产，恢复完整工具集请从旧提交或本地备份取回。
