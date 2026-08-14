# 首页荡秋千静态稿 V14：侧边树枝方案

## 设计说明

- 回到 V11 的树枝秋千构图，不使用独立 A 字秋千架。
- 左侧增加一棵扎根草地的树，原有粗枝从主干分叉处连续长出。
- 树干和树冠作为环境层，位于左侧“每日奖励”“排行榜”按钮之后。
- 保留蓝色小鸟、座板、绳索、摆动方向以及全部首页 UI。
- 树木集中在左侧，秋千周围继续保留大面积蓝天，避免中部拥挤。

## ImageGen 提示词

```text
Use case: precise-object-edit
Asset type: portrait casual mobile game homepage static design
Input images: Image 1 is the edit target and exact composition reference.

Primary request: redesign only the origin of the existing swing branch. Keep the first-version branch swing concept, but make the thick left end of the branch grow naturally from a real tree located along the far left side of the meadow.

Required scene change:
- Add one sturdy living tree trunk along the far left edge of the image, mostly outside the canvas, rooted in the grassy hill.
- The existing thick branch must connect seamlessly into a natural fork on this trunk, with continuous bark, wood thickness, lighting, outline and crayon texture. There must be no cut end, floating end, broken end, stump, or unexplained branch.
- The trunk may curve slightly and should extend vertically through the middle meadow area. Keep most of it close to the left edge.
- Add a modest cluster of green leaves around the branch-to-trunk fork and sparse small leaves along the branch, matching the existing garden illustration.
- The tree trunk and foliage remain behind the two left feature cards; “每日奖励” and “排行榜” stay clearly readable in the foreground.
- The branch still extends from left to right across the center and supports the two swing ropes at the same positions.
- Preserve enough open blue sky around the bird and swing so the screen does not feel crowded.
- Integrate the tree base into the hill with grass overlap; no visible planter or platform.

Preserve exactly:
- blue bird character, seated pose, expression, scale and placement;
- wooden swing seat, both ropes, knots, swing angle, motion marks and floating leaves;
- all homepage UI and current positions;
- top-left settings button;
- separate coin counter showing “1280” and stamina counter showing “8/10”;
- logo text exactly “1024 数字花园”;
- feature labels exactly “每日奖励”, “排行榜”, “商店”, “分享”;
- start button text exactly “开始游戏”;
- sky, clouds, meadow, flowers, color palette, hand-painted crayon/oil-pastel style;
- portrait 852 × 1846 framing.

Layering: the new tree and branch are environmental background art; all UI cards and the start button remain above them.

Constraints: edit only the tree/branch environment. No wooden A-frame, no freestanding swing frame, no bear, no capybara, no human, no extra character, no house, no fence, no new UI, no extra text, no watermark, no logo redesign, no button redesign, no cropping.
```

生成方式：Codex 内置 `imagegen`，基于 V11 静态稿进行局部重设计。
