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
assets/resources/Leaderboard/  排行榜素材与 LeaderboardPopup Prefab
assets/resources/Profile/      个人中心素材与 ProfilePopup Prefab
assets/scence/                 游戏场景
assets/script/home/            首页流程与首页 UI
assets/script/gameplay/        棋盘、玩法流程与玩法 UI
assets/script/economy/         金币、体力与技能库存
assets/script/daily-reward/    每日奖励功能及其 UI
assets/script/skill-shop/      技能商店功能及其 UI
assets/script/settings/        设置与暂停功能及其 UI
assets/script/settlement/      单局结算功能及其 UI
assets/script/tutorial/        新手引导功能及其 UI
assets/script/loading/         加载场景
assets/script/platform/        音频、分享与设备反馈适配
assets/script/profile/         个人资料、头像编号映射与个人中心 UI
assets/script/online/          接口、登录、云同步与排行榜
tools/wechat-startup-page/     微信构建后处理
```

## 核心模块

- `PlayController`：玩法流程和单局状态。
- `BoardModel`：棋盘操作。
- `BoardGeometry`：坐标计算。
- `PlayUIController`：界面渲染。
- `PauseOverlayController`：设置弹窗、音量和暂停操作。
- `GameApiClient`：统一 `/v1` baseURL、超时、错误转换和 Bearer token 注入。
- `PlayerSessionStore`：本地业务凭证、过期状态和登录并发去重。
- `PlayerCloudSyncStore`：首次游客导入、增量操作队列和云端修订号同步。
- `PlayerProfileStore`：读取和保存昵称、头像编号与最高分；头像编号统一映射项目内置资源。

设置弹窗使用 `resources/Settings` 中的手绘素材，整体按 86% 等比显示；游戏内提供分享、重玩和返回。

## 注意事项

- 保持玩法、数据和渲染职责分离。
- 不破坏场景层级、资源 UUID 和动态加载路径。
- 微信重新构建后，需要再次运行 `npm run postbuild:wechat`。
- 项目暂无自动化测试，UI 修改需在 Creator 和微信开发者工具中人工预览。
