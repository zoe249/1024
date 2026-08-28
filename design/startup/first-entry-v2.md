# 数字花园首次进入页 V2

## 设计意图

- 用“清晨花园小径”承接首页与游戏页的彩铅纸纹，替换旧版糖果店 3D 视觉和默认 Cocos 品牌页。
- Logo 独占上方天空安全区；中段保留安静纵深；加载状态、进度条和健康游戏忠告位于底部可读区域。
- 数字伙伴仅从两侧花丛探出，提供角色记忆点但不争抢信息层级。
- 微信原生首屏绘制真实进度；Cocos 插屏使用烘焙 Logo 的静态背景，二者切换时视觉保持连续。

## 资源分层

- 生成设计源：`first-entry-background-v2-source.png`
- 静态排版预览：`first-entry-v2-preview.jpg`
- Cocos 自定义插屏：`settings/first-entry-splash-v2.jpg`
- 微信轻量背景：`tools/wechat-startup-page/startup-background.jpg`
- 微信透明 Logo：`tools/wechat-startup-page/startup-logo.png`

## ImageGen 提示词

```text
Use case: stylized-concept
Asset type: vertical mobile game first-entry / startup background for a 750 × 1334 portrait screen
Input images: Image 1 is the primary style reference for the established hand-drawn spring garden; Image 2 is a secondary reference for the game's title treatment and playful number-garden identity; Image 3 is a reference for the in-game colored-pencil texture and palette
Primary request: Create a calm, premium first-entry background for the casual number-merging game “1024 数字花园”. Show a bright spring garden at early morning: rich blue hand-colored sky, soft cream clouds, a gently curving garden path leading into a sunny meadow, layered shrubs and flowers. Include only a few small friendly rounded number-block characters peeking from the lower left and lower right edges, partially cropped by the frame, so the scene feels alive but quiet. Add a few drifting leaves and tiny dandelion seeds to imply motion. Keep a generous clean sky area in the upper 32% for the separate game logo, a calm open meadow area around the vertical center, and a darker but uncluttered grass/earth area in the lower 25% for a progress bar and loading copy.
Style/medium: 2D children's colored-pencil and wax-crayon illustration on lightly textured paper, clearly hand drawn, imperfect dark-brown outlines, flat matte color with subtle pencil hatching; match the supplied project references, not glossy 3D
Composition/framing: portrait, full bleed, safe central composition for aggressive mobile cover-cropping; major subjects stay within the central 70% width; clean upper logo zone; bottom characters remain secondary edge accents
Lighting/mood: fresh warm sunrise, welcoming, playful, calm anticipation
Color palette: saturated sky blue, spring greens, warm cream, sunflower yellow, small coral-orange accents, dark warm brown outlines
Text: none
Constraints: no logo, no words, no letters, no UI, no progress bar, no panels, no frames, no watermark; no candy shop; no glossy plastic, no 3D render, no glass effects; avoid busy details behind the future logo and progress bar
Avoid: photorealism, airbrushed gradients, oversized characters, central character blocking the composition, repeated identical leaves, illegible symbols
```

生成方式：Codex 内置 ImageGen；三个输入均作为风格参考，不是编辑目标。
