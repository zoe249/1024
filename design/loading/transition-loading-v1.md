# 风吹叶片过渡页 V1

## 设计方向

- 使用游戏页的春日草地和彩铅纸面作为整屏背景，避免纯色过渡。
- 叶片沿两条弧形风带从右上吹向左下，后续可拆成多片 Sprite 循环播放。
- 中间不放卡片、面板或边框，加载文字直接融入场景。
- 进度条使用平涂、深棕描边和彩铅排线，不使用玻璃高光。
- 保留随机玩法提示，但文字直接显示在草地上，不再承载复杂教程插图。

## 画布与层级

- 画布：`750 × 1334`。
- 背景：春日草地整屏铺满。
- 动效层：叶片与风痕，覆盖全屏但避开核心文字。
- 状态层：`游戏准备中`、加载副标题、进度百分比。
- 底部层：进度条和单行随机提示。

## 文件

- 完整设计稿：`transition-loading-v1.jpg`
- 叶片背景：`transition-loading-v1-background.jpg`
- 可重复排版脚本：`render_transition_loading_v1.py`
- 动画预览：`transition-loading-v1-preview.webp`
- 动画分镜检查图：`transition-loading-v1-preview-sheet.jpg`
- 动画预览脚本：`render_transition_loading_animation_preview.py`

## 运行时实现

- 背景复用 `assets/images/World/spring-meadow-game-v1.jpg`，不使用已经烘焙叶片的设计稿背景。
- 24 片叶子共享 `assets/resources/Homepage/SwingV14/swing-leaf.png`，不增加运行包图片。
- 两条三次贝塞尔曲线控制主风向，每片叶子叠加独立摆幅、相位、缩放、旋转和首尾淡入淡出。
- 叶片动画统一在 `LoadingSceneController.update()` 中计算，不创建 24 组循环 Tween。
- 加载进度继续读取 `preloadScene` 的真实回调，并从进度条左端向右填充。
