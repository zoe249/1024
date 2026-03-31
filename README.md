# 1024

基于 **Cocos Creator 3.8.8** 开发的休闲小游戏。  
玩法结合了「俄罗斯方块的下落操作」和「2048 的数字合成」。

## 项目简介

游戏场景内包含一个 **5 列 x 7 行** 的棋盘。

- 屏幕上同一时间只会有 **1 个正在下落的棋子**
- 棋子会从棋盘上方生成，并默认沿当前目标列下落
- 玩家触摸棋盘区域时，可以选择落子列，并触发快速下落
- 当棋子落入格子后，如果与相邻可合并棋子的数字相同，会触发合并
- 合并后会生成更大的数字棋子，并继续进行连锁结算
- 当所有列都无法再放入新棋子时，游戏结束

## 核心规则

- 棋盘固定为 `5` 列、`7` 行
- 初始随机数字池为：`2 / 4 / 8 / 16 / 32 / 64 / 128`
- 大于 `128` 的数字只能通过合成获得
- 当前下落棋子落地前，不会生成下一颗棋子
- 合并、重力结算完成后，才会生成新的棋子

## 操作说明

- 触摸棋盘区域：选择目标列
- 触摸棋盘区域时：触发快速下落
- 暂停按钮：切换暂停 / 恢复
- 游戏结束后：再次点击可重新开始

## 开发环境

- **Cocos Creator**：`3.8.8`
- **Node.js**：仅用于 Creator 配套环境，本项目当前没有自定义 npm 脚本

项目根目录中的版本信息见 [package.json](D:\*\cocos\1024\package.json)。

## 运行方式

### 在 Cocos Creator 中打开

1. 启动 `Cocos Creator 3.8.8`
2. 选择“打开项目”
3. 打开项目目录：`D:\*\cocos\1024`
4. 打开主场景 [game.scene](D:\*\cocos\1024\assets\scence\game.scene)
5. 点击 Creator 顶部预览按钮运行

### 构建发布

可通过 Cocos Creator 自带的构建面板构建到目标平台，例如：

- Web
- 微信小游戏
- 其他 Creator 支持的平台

## 目录结构

```text
assets/
├─ fonts/                  字体资源
├─ images/                 UI 图片、按钮图片、背景图
├─ prefab/                 预制体
│  └─ piece.prefab         棋子预制体
├─ scence/                 场景文件
│  ├─ game.scene           主游戏场景
│  └─ particle.scene       粒子/测试场景
├─ script/                 主要脚本
│  ├─ PlayController.ts    游戏逻辑控制
│  ├─ PlayUIController.ts  UI 渲染与界面布局
│  └─ PieceController.ts   单个棋子的显示与数值表现
└─ texture/                其他纹理资源
```

说明：

- 目录名 `scence` 为当前项目现有命名，虽然不是标准拼写，但已被项目引用，修改前需要整体评估

## 脚本职责

### [PlayController.ts](D:\*\cocos\1024\assets\script\PlayController.ts)

负责游戏核心逻辑：

- 棋盘二维数据维护
- 新棋子生成
- 下落更新
- 落地判定
- 连锁合并
- 重力结算
- 游戏结束与重开
- 输入判定
- 向 UI 层同步展示状态

### [PlayUIController.ts](D:\*\cocos\1024\assets\script\PlayUIController.ts)

负责界面渲染与布局：

- 棋盘边框、底色、分隔虚线绘制
- 状态文字显示
- 控制栏与暂停按钮
- 暂停遮罩
- 底部安全区适配

### [PieceController.ts](D:\*\cocos\1024\assets\script\PieceController.ts)

负责棋子本身的显示表现：

- 棋子圆角底板绘制
- 数字显示
- 根据数值切换颜色
- 棋子尺寸和文本排版适配

## 关键资源

- 主场景：[game.scene](D:\*\cocos\1024\assets\scence\game.scene)
- 棋子预制体：[piece.prefab](D:\*\cocos\1024\assets\prefab\piece.prefab)
- 棋盘相关脚本：[PlayController.ts](D:\*\cocos\1024\assets\script\PlayController.ts)
- UI 相关脚本：[PlayUIController.ts](D:\*\cocos\1024\assets\script\PlayUIController.ts)
- 棋子表现脚本：[PieceController.ts](D:\*\cocos\1024\assets\script\PieceController.ts)

## 当前实现说明

- 棋盘主体视觉已改为 **代码绘制为主**
- `Controller` 底部控制栏当前尽量通过 **scene + Widget** 管理布局
- 游戏逻辑和 UI 渲染已做职责拆分：
  - `PlayController` 负责逻辑
  - `PlayUIController` 负责渲染

## 修改约定

根据项目约定，**每次修改代码后都需要补充注释**。

建议遵循：

- 注释优先使用中文
- 优先在层级管理器中调整纯 UI 布局
- 只有在运行时确实需要动态处理时，再使用脚本介入
- 修改 scene 或脚本时，尽量避免同时改动无关内容

## 已知注意点

- 本项目当前没有配置自动化测试
- 部分 UI 布局在不同平台下会受到安全区影响，预览时需要同时检查：
  - 浏览器
  - 微信小游戏
- [PieceController.ts](D:\*\cocos\1024\assets\script\PieceController.ts) 中存在部分历史注释编码问题，后续可以单独整理

## 后续可继续完善的方向

- 排行榜、分享、技能按钮的实际交互逻辑
- 音效与背景音乐控制
- 小程序平台适配细化
- 资源命名和目录结构整理
- 补充更完整的设计文档和发布流程说明
