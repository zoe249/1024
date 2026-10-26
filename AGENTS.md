---
description: Cocos Creator 3.8.8 下落式数字合成项目
---

## 工作原则

- 每次遵循 `karpathy-guidelines`：先查现状与 Git 差异，保留用户修改，做最小完整改动；不堆框架、重复实现或无关兼容分支。
- 重构保持玩法、视觉、手感、时序、续局与资源消耗不变；不做无关格式化或破坏性 Git 操作。提交、推送按用户要求执行并如实区分。
- 注释用简体中文，解释原因与复杂时序；复杂方法用中文 JSDoc。

## 项目约束

- Cocos Creator 3.8.8 + TypeScript；微信为主、Web 预览。棋盘默认 5×7，由 `BoardConfig` 校验；`board[row][column]` 存 `PieceController | null`，行自下向上、列自左向右。
- 场景目录固定为 `assets/scence/`；主流程 home → loading → game，兼容续局直达与单场景预览。棋子使用 `assets/prefab/piece.prefab`。
- `PlayController` 管玩法状态，`BoardModel` 管棋盘操作，坐标统一走 `BoardGeometry`。`buildUiState()` 输出纯数据，UI／外观／特效只展示与回调；`OngoingGameSession` 不持有节点或组件，不因外观准备重复扣费。
- 结算：局部合并 → 重力 → 全盘四向同值连通块扫描 → 重复至稳定 → 下一颗。三种技能期间冻结普通下落，动画结束后全盘结算。
- 静态 UI 在 Creator 维护，脚本处理布局、安全区与动态表现。棋盘装饰只走 `PlayUIController.ensureBoardDecorations()`；技能栏兼容 `SkliisController`／`SkillsController`。

## 资源与外观

- 资源按 `assets/resources/<主题名>/<功能>/` 分类，基础主题叫 `base`；原图片位于 `base/images/<功能>/`。源稿放 `design/`，不把大源图放入运行资源目录。
- 保留层级、Prefab、序列化属性和 UUID；资源连同原 `.meta` 移动，同步加载路径与维护工具。非资源重映射任务不改 `.meta`；迁移后检查 Git 状态，不擅自放宽忽略规则。
- 外观只含展示数据，目前仅启用 Base。沿用 `AppearanceAssetLoader` 与租约，不逐落子加载、不由棋子释放共享贴图。带字底图预留遵循[接入说明](文档/方块皮肤-带数字底图接入说明.md)。
- 相关任务先读 `Skills/<技能名>/SKILL.md`；UI 位图必须用 `Skills/cocos-cream-ui-assets/SKILL.md`，核对像素、Alpha 有效尺寸、运行时大小、体积与预览。该技能不用于场景插画、音频或玩法；冲突以本文件为准。微信主包上限 4 MB。

## 生命周期

- Cocos 先销毁子节点，再执行父组件 `onDestroy`，组件对象／函数等字段可能清为 `null`。访问缓存节点、调用子组件清理前检查 `isValid`；可选链不能代替有效性检查。
- 清理使用缓存引用，不遍历已毁层级，不手动调用其他组件生命周期。释放入口先设标记、支持重复调用，兼容父组件单独移除与子组件先毁两种顺序。
- 离场解绑监听、停止 Tween／定时回调、清理自有节点与资源；异步回调先检查宿主及任务代次再访问字段。
- 退出问题检查 HUD、设置、结算及父级整条链；回归模拟「停用 → 子节点及组件销毁 → 字段清空 → 父组件销毁」，覆盖两种返回、动画中离场、头像待加载、晚到回调与重复释放。

## 验证与交付

- 按改动运行 `tools/verify-*.cjs`（参数为 Creator 自带 TypeScript 模块目录）、类型检查及 `git diff --check`；涉及集合遍历时覆盖 Creator loose 编译。脚本模拟不等同引擎／真机验收，项目无 CLI 构建流程。
- 玩法检查生成、选列／快速下落、合并、重力、暂停／恢复、三种技能、续局及结束；UI／资源检查 Creator 引用、相关场景、常规屏与长屏安全区。
- `npm run postbuild:wechat` 仅由用户处理已有构建产物，Codex 不执行、也不提醒执行。
- 交付简述改动、验证及待人工项；未执行 Creator／微信验证必须说明，不声称通过。

## 后端与发布

- 后端仓库为 `https://github.com/zoe249/1024_service`，与客户端分开；服务器 `ubuntu@43.142.81.188:22`，从本机 SSH 操作，密钥按当前电脑核实，禁止入库。
- 服务器开发操作限 `/home/ubuntu/projects/1024_service_dev`，使用开发库 `game_1024_dev`，迁移用 `npm run migrate:dev`；正式目录不开发、不构建，正式库不测试，不跨环境复制用户数据。地址、服务及账号见[开发环境说明](文档/开发环境使用说明.md)。
- 开发版、体验版、Web 连接开发接口，正式版连接正式接口；凭证、同步队列和经济存档按接口地址隔离。
- 后端 `dev` 推送部署开发环境，`main` 推送部署正式环境；默认只操作 `dev`，更新 `main`、正式发布或正式库迁移须用户明确要求。`[skip deploy]` 只验证准备；发布使用独立版本目录，不覆盖运行中版本。
