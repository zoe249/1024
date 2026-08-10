# 首页动画素材

三套动画均使用固定 384×512 透明画布和统一锚点，避免播放时整体跳动。小熊与小鸟为 16 帧循环，蒲公英为 32 帧闭合轨迹循环。

| 动画 | 建议帧率 | 建议锚点 | 内容 |
| --- | ---: | --- | --- |
| `bear-blowing` | 12 FPS | `(0.5, 0)` | 16 帧；吸气、鼓腮、吹气、围巾滞后和缓和回弹 |
| `bird-flapping` | 15 FPS | `(0.5, 0.5)` | 16 帧；连续翅膀弧线、轻微身体浮动和尾羽跟随 |
| `dandelion-drifting` | 13 FPS | `(0.5, 0.5)` | 32 帧；七颗种子沿闭合 S 曲线连续漂流 |

每套目录包含：

- `atlas.png`：最终透明图集，已清理串帧碎片并保留安全边距。
- `key-atlas-source.png` / `inbetween-atlas-source.png`：小熊和小鸟的生成式关键帧与中间帧源图集。
- `seed-source-frame.png`：蒲公英轨迹动画使用的七颗种子源切片。
- `frames/`：可直接导入 Cocos Creator 的等尺寸帧。
- `preview.gif`：动画效果预览，不用于运行时。
- `preview-sheet.png`：透明棋盘格静态总览。
- `animation.json`：帧率、循环和锚点建议。

在 Cocos Creator 中选中 `frames/` 内的图片创建 SpriteFrame，再按文件名升序加入 AnimationClip，WrapMode 设为 Loop。
