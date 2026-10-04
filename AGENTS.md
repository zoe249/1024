---
description: Cocos Creator 3.8.8 下落式数字合成项目
---

## 项目概况

- Cocos Creator 3.8.8 + TypeScript；微信小游戏为主，Web 用于预览。
- 默认棋盘为 5 列 × 7 行，也支持 `BoardConfig` 配置的其他合法尺寸。
- 场景流程：`home.scene` → `loading.scene` → `game.scene`。
- 场景目录固定为 `assets/scence/`（历史拼写，不要改名）。
- 无自动化测试和 CLI 构建；`postbuild:wechat` 仅处理已有微信构建产物。

## 核心架构

- `PlayController` 负责玩法流程与单局状态；`BoardModel` 提供基础棋盘操作，`BoardGeometry` 统一坐标计算，`BoardConfig` 统一尺寸校验。
- `PlayController.buildUiState()` 生成纯数据 `PlayUIState`，`PlayUIController.renderState()` 负责渲染；UI 只能通过回调发出操作，不能直接修改游戏状态。
- `board[row][column]` 保存 `PieceController | null`：`row` 自下向上，`column` 自左向右。
- 棋子由 `assets/prefab/piece.prefab` 实例化；格子位置、触摸命中和出生点统一通过 `BoardGeometry` 计算，禁止新增写死偏移。
- 结算流程：落子局部合并 → 重力 → 全盘四向同值连通块扫描 → 重复至稳定 → 生成下一颗棋子。
- 炸弹、锤子和交换技能期间冻结普通下落，动画结束后统一进入全盘结算。
- `OngoingGameSession` 只保存纯数据快照，不能跨场景持有节点或组件。

## 修改规则

- 优先做最小且完整的改动，保持玩法、数据与渲染职责边界，不覆盖用户已有修改。
- 静态 UI 优先在 Creator 层级中维护；运行时布局、安全区和动态表现放在脚本中。
- 棋盘装饰只由 `PlayUIController.ensureBoardDecorations()` 绘制，不在场景中重复摆放。
- 技能栏需兼容 `SkliisController` 与 `SkillsController` 两个节点名。
- 不破坏场景层级、Prefab、序列化属性、资源 UUID 和动态加载路径；非资源重映射任务不要修改 `.meta` 文件。
- 新增监听、Tween、定时器和动态节点时，必须处理解绑、停止或销毁。
- 注释使用简体中文，只解释设计原因和复杂时序；复杂方法使用中文 JSDoc。
- 不做无关重构、全文件格式化或破坏性 Git 操作。
- 生成或替换素材时，必须确认文件位于实际引用或动态加载的正确目录，并注意素材大小；微信小游戏主包上限为 4 MB。

## 项目 Skills

- 仓库内技能位于 `Skills/<技能名>/SKILL.md`；任务涉及相应领域时，先完整读取对应技能文件，再按其流程执行。新增技能也遵循此规则。
- 生成、替换或优化任何界面位图素材时，必须使用 `Skills/cocos-cream-ui-assets/SKILL.md`，包括按钮、图标、弹窗、排行榜等 UI PNG；按技能要求检查像素、Alpha 有效尺寸、运行时视觉大小、文件体积和预览效果。
- `cocos-cream-ui-assets` 不用于场景插画、音频或玩法代码。技能说明与本文件冲突时以本文件为准，尤其构建后处理命令仍由用户执行。

## 验证与交付

- 玩法改动检查：生成、选列/快速下落、合并连锁、重力、暂停/恢复、三种技能、续局和游戏结束。
- UI 或资源改动在 Cocos Creator 3.8.8 中检查引用，并预览相关场景、常规屏幕与长屏安全区。
- 用户会在每次微信构建完成后人工运行 `npm run postbuild:wechat`，Codex 不执行或提醒执行该命令；新增、生成或移动素材时必须注意素材位置，避免用户运行后处理命令时出现素材缺失报错。
- 无法运行 Creator 或微信开发者工具时，明确说明未执行的人工验证，不得声称已通过。
- 交付说明保持简洁：概括设计意图、修改文件、验证结果和待人工检查项。

## 部署服务器

- 腾讯云 Ubuntu 服务器：`ubuntu@43.142.81.188`，SSH 端口为 `22`。
- 当前电脑已验证可用的身份文件为 `C:\Users\zoe\.ssh\tencent_1024_codex`；连接命令为 `ssh -i C:\Users\zoe\.ssh\tencent_1024_codex ubuntu@43.142.81.188`。
- 服务器操作默认由本机 Codex 通过普通 SSH 执行，不依赖服务器端运行 Codex。
- 不在项目中保存密码、私钥内容、令牌或其他密钥；更换电脑时应生成新密钥并将新公钥加入服务器。

## 后端开发环境

- 日常后端修改、依赖安装、构建、测试和数据库迁移默认在 `/home/ubuntu/projects/1024_service_dev` 执行，服务名为 `1024-service-dev.service`，接口为 `https://leyian.online/dev/v1`。
- 开发后端监听 `127.0.0.1:3001`，使用独立账号 `1024_dev` 和数据库 `game_1024_dev`；与正式库共用 MySQL 的 3306 端口。使用 `npm run migrate:dev` 执行开发库迁移。
- `/home/ubuntu/projects/1024_service` 是正式目录，不在其中开发、安装依赖或构建；正式数据库 `game_1024` 不用于测试，不复制真实用户数据到开发库。
- 用户明确要求上线后，才更新正式发布版本或执行正式库迁移；开发环境搭建或验收不包含功能上线。
- 客户端按微信运行版本自动分流：开发版、体验版和 Web 预览连接开发接口，正式版连接正式接口；凭证、同步队列和经济存档按接口地址隔离。
- 当前环境位置、启动方式和验证范围见 `开发环境使用说明.md`。

## GitHub 自动发布

- 后端仓库为 `https://github.com/zoe249/1024_service`；本机工作目录为 `/Users/maolixiaowulang/Project/Games/1024_service`，与 Cocos 客户端仓库分开。
- 后端 `dev` 推送自动部署开发环境，`main` 推送自动部署正式环境；默认只提交和推送 `dev`。用户明确要求上线或推送／合并 `main` 才允许更新 `main`。
- 提交信息包含 `[skip deploy]` 时只验证发布准备；初次流水线配置使用该标记，不上线头像新功能。
- GitHub Actions 负责检查与触发，服务器按指定提交在独立版本目录构建、迁移和切换服务；不覆盖运行中版本或复制开发数据库到正式环境。
