# 1024 数字花园

基于 Cocos Creator 3.8.8 开发的下落式数字合成小游戏，主要发布到微信小游戏。

## 玩法

- 默认棋盘为 5 × 7，可通过 `BoardConfig` 调整。
- 选择列让数字方块下落；同值相邻方块会自动合并并连续结算。
- 提供炸弹、锤子和交换三种技能。

## 运行

场景流程：`home.scene` → `loading.scene` → `game.scene`

1. 使用 Cocos Creator 3.8.8 打开项目。
2. 打开 `assets/scence/home.scene`。
3. 点击预览。

`assets/scence/` 是历史目录名，请勿修改。

## 微信构建

在 Creator 中完成微信小游戏构建后执行：

```bash
npm run postbuild:wechat
```

脚本会安装启动页、检查 4 MB 主包限制，并将 `assets/resources` 逐文件迁移到分包。看到“构建后处理完成”后，再在微信开发者工具中预览。

详细说明见 [微信启动页文档](tools/wechat-startup-page/README.md)。

## 主要目录

```text
assets/prefab/                 棋子预制体
assets/resources/Settings/     设置弹窗素材
assets/scence/                 游戏场景
assets/script/                 玩法与 UI 脚本
tools/wechat-startup-page/     微信构建后处理
```

## 核心模块

- `PlayController`：玩法流程和单局状态。
- `BoardModel`：棋盘操作。
- `BoardGeometry`：坐标计算。
- `PlayUIController`：界面渲染。
- `PauseOverlayController`：设置弹窗、音量和暂停操作。

设置弹窗使用 `resources/Settings` 中的手绘素材，整体按 86% 等比显示；游戏内提供分享、重玩和返回。

## 注意事项

- 保持玩法、数据和渲染职责分离。
- 不破坏场景层级、资源 UUID 和动态加载路径。
- 微信重新构建后，需要再次运行 `npm run postbuild:wechat`。
- 项目暂无自动化测试，UI 修改需在 Creator 和微信开发者工具中人工预览。
