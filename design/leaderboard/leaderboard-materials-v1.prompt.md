# 排行榜素材生成记录 v1

## 图像生成部分：标题角色装饰

```text
Use case: background-extraction
Asset type: production-ready transparent PNG header decoration for a Cocos Creator leaderboard popup.
Isolate and faithfully recreate only the complete decorative leaderboard header group from the approved design on a genuinely transparent background. Include the white rabbit holding “1024”, orange fox holding “512”, blue bird, golden trophy, flowers, leaves, confetti, sparkles, and the full coral ribbon with exact title “排行榜”. Keep a wide centered composition, generous transparent padding, clean antialiased edges, wax-crayon texture, paper grain and thick dark-brown outlines. Exclude the panel, tabs, rows, close button and backdrop. No bear, dandelion, blowing gesture, wrong numbers, garbled Chinese, cropped elements or watermark.
```

内置图像生成结果保存为 `header-art-source.png`。由于源图返回了可见棋盘格，`render_leaderboard_assets_v1.py` 只移除与画布边缘连通的浅灰棋盘格，保护兔子白色区域和标题文字内部区域，再输出真正带 Alpha 的 `header-leaderboard.png`。

## 确定性绘制部分

`render_leaderboard_assets_v1.py` 使用 Pillow 超采样绘制面板、标签、列表行、奖牌、头像框、关闭按钮和邀请按钮。所有动态内容保持无文字底图；脚本同时生成透明棋盘格总览并同步运行时副本。

