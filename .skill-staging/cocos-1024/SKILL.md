---
name: cocos-1024
description: 当修改这个 1024 的 Cocos Creator 3.8.8 项目时使用，尤其适用于玩法逻辑、下落与合成规则、输入处理、场景层级、Prefab 视觉，以及 game.scene、PlayController.ts、PieceController.ts 相关的界面调整。
---

# 何时使用

当需求涉及这个项目的玩法、控制方式、合成规则、下落行为、场景层级、Prefab 表现或资源使用方式时，使用这个 skill。

# 项目事实

- 引擎版本：Cocos Creator 3.8.8
- 主游戏场景：`assets/scence/game.scene`
- 主要玩法逻辑：`assets/script/PlayController.ts`
- 棋子表现逻辑：`assets/script/PieceController.ts`
- 棋子 Prefab：`assets/prefab/piece.prefab`
- 主要美术资源：`assets/images/`
- 棋盘大小为 5 列 7 行
- 任意时刻只允许一个正在下落的活动棋子
- 只有在当前棋子落地并完成合成结算后，才会生成新的棋子
- 基础随机棋子数值范围是 2 到 128

# 工作规则

1. 遇到玩法需求时，先读 `assets/script/PlayController.ts`。
2. 遇到层级、背景或界面需求时，先读 `assets/scence/game.scene`。
3. 优先做最小改动，避免无关重构。
4. 新增视觉前，优先复用 `assets/images/` 中已有素材。
5. 如果改了控制行为，记得同步更新相关状态文案或提示文案。
6. 装饰性节点应放在玩法关键节点下层。

# 约束

- 除非任务明确要求资源重映射，否则不要修改 `.meta` 文件。
- 如果局部修改足够，不要大面积重写 `game.scene`。
- 修改玩法代码时，保持现有的行列语义不变。
- 修改下落或输入行为时，要检查下一个新生成棋子的状态是否正确重置。
- 直接编辑场景 JSON 后，要验证文件仍然可以被正常解析。

# 快速入口

- 下落速度与触摸逻辑：搜索 `isFastDropping`、`handleTouchStart`、`handleTouchEnd`、`update`
- 落地与连锁结算：搜索 `landPiece`、`resolveLandingChain`、`settleBoard`
- 状态与暂停界面：搜索 `refreshStatus`、`ensurePauseButton`、`ensurePauseOverlay`
- 场景视觉：检查 `assets/scence/game.scene` 中的 `play`、`board`、`PauseButton`、`PauseOverlay` 节点
