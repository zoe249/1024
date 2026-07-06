---
description: Cocos Creator 3.8.8 下落式数字合成项目
---

## 项目概况

- 玩法：5 列 × 7 行棋盘；落子后，相邻同值棋子合并并触发重力与连锁结算。
- 平台：微信小游戏为主，Web 用于预览。
- 场景目录固定为 `assets/scence/`（历史拼写，不要改名）；主玩法场景为 `game.scene`。
- 项目无自动化测试和 CLI 构建流程，使用 Cocos Creator 3.8.8 预览、构建与验证。

## 核心架构

- `PlayController` 负责玩法流程和运行状态；通用棋盘查询由 `BoardModel` 提供。
- `PlayController.buildUiState()` 生成纯数据 `PlayUIState`，`PlayUIController.renderState()` 负责渲染。UI 只能通过回调发出操作，不能直接修改游戏状态。
- `board[row][column]` 保存 `PieceController | null`：`row` 自下向上，`column` 自左向右。
- 棋子由 `piece.prefab` 实例化；格子位置根据 `BoardFill` 尺寸动态计算，不写死像素坐标。
- 结算流程：落子 → BFS 查找同值连通块 → 以低位棋子为锚点合并 → 重力下落 → 全盘继续扫描，直到没有可合并组。
- 技能包括炸弹、锤子和交换。技能期间冻结普通下落，动画结束后统一进入全盘结算。

## 修改规则

- 优先做最小改动，保持逻辑、渲染和数据职责边界，不破坏现有场景层级、Prefab 与资源引用。
- UI 布局优先在层级管理器中调整；只有运行时布局才放进脚本。
- 棋盘装饰由 `PlayUIController.ensureBoardDecorations()` 使用 `Graphics` 绘制，不在场景中重复摆放。
- 技能栏节点需兼容历史名称 `SkliisController` 与 `SkillsController`。
- 除非任务明确涉及资源重映射，否则不要修改 `.meta` 文件。
- 代码改动应补充必要的中文注释；复杂方法使用中文 JSDoc，避免无意义注释和乱码。

## 验证与交付

- 修改玩法、输入或技能后，检查：新棋子生成、快速下落、合并连锁、重力、暂停/恢复、技能结算及游戏结束。
- 修改场景或 Prefab 后，在 Cocos Creator 3.8.8 中确认资源引用正常，并分别预览关键界面。
- 完成任务时做简短教学式总结：先说明设计意图与取舍，再给出关键代码片段，帮助读者理解实现思路。
