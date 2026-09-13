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
- 在生成素材时，注意素材大小，微信小游戏会有4m的主包限制

## 验证与交付

- 玩法改动检查：生成、选列/快速下落、合并连锁、重力、暂停/恢复、三种技能、续局和游戏结束。
- UI 或资源改动在 Cocos Creator 3.8.8 中检查引用，并预览相关场景、常规屏幕与长屏安全区。
- 微信相关改动需重新构建，并在构建产物存在后再运行 `npm run postbuild:wechat`。
- 无法运行 Creator 或微信开发者工具时，明确说明未执行的人工验证，不得声称已通过。
- 交付说明保持简洁：概括设计意图、修改文件、验证结果和待人工检查项。

## 部署服务器

- 腾讯云 Ubuntu 服务器：`ubuntu@43.142.81.188`，SSH 端口为 `22`。
- 当前电脑已验证可用的身份文件为 `C:\Users\zoe\.ssh\tencent_1024_codex`；连接命令为 `ssh -i C:\Users\zoe\.ssh\tencent_1024_codex ubuntu@43.142.81.188`。
- 服务器操作默认由本机 Codex 通过普通 SSH 执行，不依赖服务器端运行 Codex。
- 不在项目中保存密码、私钥内容、令牌或其他密钥；更换电脑时应生成新密钥并将新公钥加入服务器。
