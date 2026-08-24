# Note 选择器操作逻辑链与软件层行为

本文档整理 note 选择器在编辑中的常见操作顺序，以及每种顺序下编辑器（软件层）的
具体行为。文档描述的是当前实现的实际行为，不包含未落地的设想。

## 概念速览

- **note 选择器（selector）**：对象上的 `note` 字段，可以是筛选条件对象
  （`{"type":[3,4],"start":0,"end":10}`）、空对象 `{}`（命中全部）或手动列表
  `[78,5,...]`。导出时按每个命中的 note 展开成逐 note 对象。
- **$note 表达式**：`time` / `states[].time` / `parent_id` 中的 `$note` 占位符，
  展开时替换成对应 note 的 id（如 `intro:$note` → note 5 的 `intro_time`、
  `parent_$note` → `parent_5`）。
- **合并时间块（merged block）**：带 note 选择器的对象在时间轴上折叠为单个时间块
  （`noteSelectorMerge[id]`），显示最早/最晚关键帧与命中数徽标。
- **纯 ID 载体（parent carrier）**：为 stage 对象的 `parent_$note` 自动创建的
  空 note_controller（`parentCarriers[id]`），只为导出提供 `parent_<n>` 占位，
  不参与普通 note_controller 槽位。

## ① 先创建 sprite → 时间用 note 选择器 → 再创建 parent_id

操作顺序：
1. 素材库/预览创建 sprite。
2. 时间输入框右键“使用note选择器写入时间”→ 写入 `start:$note`/`intro:$note` 等
   表达式（写入的是时间字段，此时 sprite 尚未绑定 note 选择器，表达式原样保存）。
3. Parent_id 右键“使用note选择器作为parent_id”→ 填模板 `parent_$note` → 应用
   note 选择器（如 `{"type":[3,4]}` 或 `{start,end}`）。

软件层行为：
- 步骤 2 只写时间表达式，不创建任何对象；表达式在没有 note 前不参与解析显示。
- 步骤 3 应用选择器时：sprite 获得 `note` 字段；`ensureNoteSelectorParent` 按
  “未被真实控制器覆盖的 note”创建 `parent_$note` 纯 ID 载体（**默认合并时间块**，
  时间轴只显示一个块）；sprite 的 `$note` 时间表达式开始按各 note 解析。
- 导出后：每个命中的 note 各有一个 sprite 克隆（`sprite_1::<n>`），`ParentId` 为
  `parent_<n>`（载体），时间按该 note 的 intro/start 展开。
- 若第 3 步之前已给部分 note 建了独立 note_controller，按“④”的规则分配父级。

## ② 先创建 sprite → 直接创建 parent_id → 再对时间用 note 选择器

操作顺序（① 的后两步反转）：
1. 创建 sprite。
2. Parent_id 右键 → 应用 note 选择器（sprite 获得 `note`，`parent_$note` 载体被
   创建）。
3. 时间输入框右键 → 写入 `$note` 时间表达式。

软件层行为：
- 步骤 2 与①的第 3 步相同，载体创建时机提前；设置模板但尚未应用选择器时，预览
  不会立刻重编译（避免 `parent_undefined` 报错），应用选择器后才编译。
- 步骤 3 写入的时间表达式因 sprite 已有 note 选择器而立即参与解析/显示。
- 最终状态与①完全一致（sprite + note 选择器 + `$note` 时间 + 合并的载体块），
  导出结果相同。两种顺序的差异只影响中间态的可编辑性，不改变产物。

## ③ 在上述任意操作步之间，给选择器内的某个 note 创建独立 note_controller

触发方式：右键预览中的 note → 若该 note 尚无独立 note_controller，菜单显示
“对此note创建note_controller”；或从多选 note 面板创建。

软件层行为（按当前实现）：
- note 被 `parent_$note` 载体覆盖时：`noteControllerIdWithHandoff` 给新控制器
  分配**载体的具体展开 id（`parent_<n>`）**，并把该 note 从载体（合并时间块）中
  移除——note 从合并块“分离”，父级引用由真实控制器承接，不产生同 id 双对象。
- note 未被任何载体覆盖时：分配普通唯一 id（`note_controller_N`），独立成块。
- 分离后该 note 的关键帧编辑落在独立控制器上，与合并块互不影响；保存/重开后保持
  独立（`parent_<n>` 或唯一 id 均不与载体还原逻辑冲突）。
- 若该 note 同时被一个“普通合并 note_controller”（非载体）覆盖，右键显示
  “编辑note<N>的note_controller”并进入该合并块的整体属性编辑，不会新建。

## ④ 先创建部分 note_controller，再创建 sprite 的选择器包含这些 note

这是最关键的一条，软件层的实际行为如下：

### parent_id 的 ID 分配

- sprite 的 `parent_id` 一律使用模板（`parent_$note`），**不会**把已存在的
  note_controller 的 ID 直接写进 sprite。
- **“独立即让位”**：只要某 note 已由任何真实 note_controller（非纯 ID 载体）
  覆盖，载体就让位（该 note 不计入载体的 note 列表/合并块计数）。
- sprite 克隆的父级在编译时解析到那个真实控制器：
  - 单 note id 控制器（`note_controller_1`，note 5）→ `ParentId = note_controller_1`；
  - 选择器控制器（`note_controller_1`，note `{type:[3,4]}`）→ 指向其逐 note 克隆
    `note_controller_1::5`；
  - 具体 `parent_<n>` id 的控制器（之前交接产生）→ 直接复用 `parent_<n>`。
- 未被任何真实控制器覆盖的 note 仍由载体提供 `parent_<n>` 占位。

验证样例（选择器 `{start:0,end:10}`，已有 `note_controller_1`(note5) 与
`parent_6`(note6)）：载体 note 列表 = `[0..4,7..10]`（5、6 均让位）；
`sprite_1::5.ParentId = note_controller_1`、`sprite_1::6.ParentId = parent_6`；
编译产物不再出现 `parent_5` 克隆；`note_controller_1` 仍存在并可继续编辑。

> 该方案消除了“父级占位 + 真实控制器并存”的覆盖冲突：对合并块的整体修改不会再
> 静默覆盖已独立 note 的控制器字段（实测：合并块被设置同名字段后，该 note 的
> opacity 仍保持真实控制器的 0.8，不再被合并块的 1.2 覆盖）。

### 继续编辑这些 note 的 note_controller 时

- 右键该 note：`findNoteControllerForNote` 返回已存在的真实控制器 → 显示
  “编辑note<N>的note_controller”，进入它的属性页直接编辑，编辑完全独立。
- 编辑不影响 sprite 的父级绑定（父级由载体的 `parent_<n>` 或已复用的具体 id
  提供）；也不会把该 note 从 sprite 的选择器中移除。

## 右键 note 进入 note_controller 属性页（含合并时间块）

右键预览中的 note 时按以下优先级决定菜单与页面：

1. **有独立 note_controller**（含被普通合并 note_controller 覆盖）→
   “编辑note<N>的note_controller”→ 打开该控制器的属性页。
2. **无独立控制器、但被合并时间块覆盖**（合并的 note_controller，含纯 ID 载体；
   或带 note 选择器的合并 stage 对象）→ “单独编辑note<N>的note_controller
   （位于合并时间块 <id>）”→ 打开该 note 的**单独编辑页**（区别于直接编辑
   合并时间块的整体属性）：
   - 属性页**顶部附加提示**：
     “该note位于合并时间块 **<id>** 中，对其进行单独修改会导致其独立；若要
     进行整体修改请从轨道中点击进入该note选择器的整体属性编辑”。
   - **Note 输入框取该 note 的 noteID**；关键帧列表继承合并时间块分配给该
     note 的关键帧，**可编辑**（含“在播放头添加关键帧”/删除）。
   - 页面底部提供“进入合并时间块整体属性编辑”按钮（等价于从轨道进入整体编辑）。
   - **任意关键帧改动或状态属性修改生效时**：为该 note 创建独立 note_controller
     （被纯 ID 载体覆盖时采用具体 `parent_<n>` id 并收缩载体），该 note 立即从
     合并时间块独立出来，属性页切换为该控制器的正常编辑页。
3. **两者都没有** → “对此note（<N>）创建note_controller”→ 显示待创建属性页
   （首次修改字段时才真正创建对象）。

> 说明：情况 2 的右键编辑正是“单独修改”——与直接编辑合并时间块的整体属性
> 不同：单独编辑在第一次修改生效时就把该 note 从合并块独立出来。

## 眼睛隐藏（预览可见性）

合并 note 选择器的 stage 对象（sprite/text/video/line）点眼睛隐藏时，隐藏集合
会同时包含其编译展开的逐 note 克隆 id（`raw::note`），预览绘制与点击拾取都会
跳过这些克隆；四个 stage 类型行为一致（此前只有原始 id 生效，合并块隐藏无效）。
