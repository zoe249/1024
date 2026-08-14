# 首页 V14 树枝秋千运行素材

## 素材清单

| 文件 | 尺寸 | 体积 | 用途 |
| --- | ---: | ---: | --- |
| `background-tree-branch.jpg` | 852 × 1846 | 230 KB | 静态环境背景，包含树、承重树枝与两个固定挂点 |
| `swing-bird-seated.png` | 256 × 256 | 77.4 KB | 坐姿小鸟，可做呼吸、惯性旋转 |
| `swing-seat.png` | 320 × 112 | 46.1 KB | 秋千座板，沿钟摆轨迹移动 |
| `swing-rope.png` | 24 × 512 | 14.7 KB | 左右共用的可缩放绳子 |
| `swing-seat-knot.png` | 48 × 64 | 3.3 KB | 座板两端共用的绳结覆盖层 |
| `swing-leaf.png` | 64 × 64 | 5.8 KB | 可复用飘叶粒子 |

运行素材目录：`assets/resources/Homepage/SwingV14/`

## 推荐层级

```text
HomepageBackground
└─ SwingAnimation
   ├─ LeftRope
   ├─ RightRope
   ├─ SwingSeat
   │  ├─ Seat
   │  ├─ LeftKnot
   │  ├─ RightKnot
   │  └─ Bird
   └─ FloatingLeaves
```

- 背景中的两个绳结是固定挂点，运行时绳子的顶端与其对齐。
- 两根绳子共用 `swing-rope.png`，只改变长度、角度和位置。
- 座板保持接近水平，沿圆弧运动；小鸟作为座板子节点，再叠加极轻微呼吸。
- 飘叶复用同一张素材，通过大小、透明度、角度和速度差异避免重复感。
- UI、Logo、资源条和功能按钮继续使用现有独立资源，位于背景与动画层之上。

## 资源处理

- 视觉源通过 Codex 内置 `imagegen` 基于 V14 设计稿生成。
- 透明素材先使用纯洋红色底生成，再通过 ImageGen 技能自带的色键工具转换为 Alpha。
- Alpha 素材自动裁边后缩放到运行尺寸，并使用 PNG 高压缩保存。
- 背景保持设计尺寸，使用质量 84 的渐进式 JPEG 保存。
- 未创建或修改 `.meta` 文件，由 Cocos Creator 3.8.8 导入时生成。

## 最终提示词

### 背景

```text
Use case: precise-object-edit
Asset type: Cocos Creator portrait homepage environment background, 852 × 1846
Input images: Image 1 is the exact edit target and style/composition reference.

Primary request: create a clean environment-only background from Image 1 for layered runtime animation.

Keep exactly:
- the bright blue hand-painted sky and cloud layout;
- the left-side living tree rooted in the hill;
- the main tree branch naturally growing from the trunk and extending rightward;
- the complete grassy hill, distant shrubs, foreground flowers, small stones and foliage;
- the same colored-pencil/oil-pastel casual mobile game style, palette, lighting and portrait framing;
- the two short brown rope fastening wraps tied around the branch at the original suspension points. These wraps stay static on the branch as visible attachment anchors.

Remove completely:
- settings button, coin counter, stamina counter;
- “1024 数字花园” logo;
- all four feature cards and their labels;
- the “开始游戏” button;
- every UI panel, icon, number, Chinese character and text;
- blue bird, wooden swing seat, both hanging vertical ropes below the two branch wraps;
- blue swing motion marks and all detached/falling leaves associated with the animation.

Fill every removed area seamlessly using matching sky, tree foliage, grass, flowers or ground texture. There must be no empty patches, ghosted UI silhouettes, blurry rectangles, leftover letters, partial ropes, bird fragments or seat fragments.

Branch requirement: the branch must remain structurally continuous from the left tree trunk, with the two static attachment wraps clearly visible beneath the branch and enough clear sky below for runtime ropes and swing sprites.

Composition/framing: preserve the original 852 × 1846 full-screen portrait composition and environmental element positions. Do not crop or zoom.

Constraints: environment background only; no UI; no text; no character; no seat; no hanging ropes; no motion marks; no watermark; no extra animals; no new buildings or props.
```

### 坐姿小鸟

```text
Use case: background-extraction
Asset type: Cocos Creator transparent animation sprite — seated blue bird
Input images: Image 1 is the exact character and style reference.

Primary request: recreate and isolate only the blue bird seated on the swing in Image 1. Preserve the exact round body proportions, happy closed eyes, tiny orange open beak, pink cheeks, pale blue belly, short side wings, blue head feather tuft, tail, dark hand-drawn outline, both orange feet and the same seated pose.

Remove completely: wooden seat, ropes, branch, tree, leaves, motion marks, sky, grass, UI, logo, text and all other objects. Reconstruct any tiny portion of the feet or lower body previously touching the seat so the bird is a complete clean sprite, but keep the pose visibly seated.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal. The background must be one uniform color with no gradient, texture, lighting variation, floor plane, shadow, reflection or contact shadow.

Composition/framing: one centered full-body seated bird; generous padding on all sides; no cropping; same front three-quarter orientation as Image 1.

Style/medium: polished casual mobile game character sprite, handmade colored-pencil and oil-pastel texture exactly matching Image 1.

Constraints: crisp closed silhouette; clean separation; do not use #ff00ff anywhere in the bird; no shadow; no seat; no ropes; no branch; no text; no watermark; no extra character; do not redesign or make the bird fly.
```

### 座板

```text
Use case: background-extraction
Asset type: Cocos Creator transparent animation sprite — wooden swing seat
Input images: Image 1 is the exact prop and style reference.

Primary request: recreate and isolate only the complete wooden swing seat board beneath the bird in Image 1. Preserve the same warm honey-brown color, wide shallow rectangular proportions, softly rounded corners, visible front thickness, slight front three-quarter perspective, dark brown hand-drawn outline, carved wood grain and colored-pencil/oil-pastel texture.

Remove completely: blue bird and feet, both ropes and knots, tree, branch, leaves, motion marks, sky, grass, UI, logo, text and all other objects. Reconstruct the areas hidden by the bird and rope knots so the plank is a complete uninterrupted board.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal. The background must be one uniform color with no gradient, texture, lighting variation, floor plane, shadow, reflection or contact shadow.

Composition/framing: one centered complete horizontal seat; generous padding on all sides; no cropping; same viewing angle as Image 1.

Style/medium: polished casual mobile game prop sprite, handmade colored-pencil and oil-pastel texture exactly matching Image 1.

Constraints: crisp closed silhouette; clean separation; do not use #ff00ff inside the seat; no shadow; no holes; no rope; no bird; no text; no watermark; no extra decoration; no redesign.
```

### 绳子

```text
Use case: background-extraction
Asset type: Cocos Creator reusable vertical rope sprite for a swing
Input images: Image 1 is the exact rope texture and illustration-style reference.

Primary request: create one isolated, perfectly straight vertical length of the same warm dark-brown twisted rope used by the swing in Image 1. It should be a narrow consistent-width rope with visible hand-painted twisted-fiber rhythm, dark brown outline and colored-pencil/oil-pastel texture. No knots, loops, hooks or attachments at either end. Both ends should finish flat and clean so the sprite can be stretched vertically and rotated in runtime.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal. One uniform color only; no gradient, texture, lighting variation, floor plane, shadow, reflection or contact shadow.

Composition/framing: one long thin vertical rope centered on the canvas; rope occupies roughly 8–12% of canvas width and 82–90% of canvas height; generous empty padding; no cropping.

Constraints: constant thickness from top to bottom; crisp silhouette; do not use #ff00ff inside the rope; no shadow; no branch; no seat; no bird; no leaves; no text; no watermark; no extra object.
```

### 座板绳结

```text
Use case: background-extraction
Asset type: Cocos Creator reusable swing-seat rope knot overlay sprite
Input images: Image 1 is the exact bottom rope-knot style reference.

Primary request: create one isolated compact brown rope knot matching either of the two knots where the vertical swing ropes attach to the wooden seat in Image 1. Include a short straight vertical rope entry at the top, a small tied loop/knot body, and a short curved tail below. Preserve the same dark brown outline, twisted-fiber rhythm and colored-pencil/oil-pastel texture. The sprite will be reused at both left and right seat attachment points.

Remove completely: wooden seat, bird, long rope, tree, branch, leaves, motion marks, sky, grass, UI, logo, text and all other objects.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal. One uniform color only; no gradient, texture, lighting variation, floor plane, shadow, reflection or contact shadow.

Composition/framing: one small upright knot centered on the canvas; complete silhouette; generous padding; no cropping.

Constraints: crisp closed silhouette; do not use #ff00ff inside the knot; no shadow; no seat fragment; no branch; no text; no watermark; no extra object.
```

### 飘叶

```text
Use case: background-extraction
Asset type: Cocos Creator reusable floating leaf animation sprite
Input images: Image 1 is the exact leaf design and illustration-style reference.

Primary request: create one isolated small oval green leaf matching the detached floating leaves around the swing in Image 1. Preserve the same fresh yellow-green palette, darker green outline, center vein, simple faceted colored-pencil shading and oil-pastel texture. The leaf should be slightly asymmetrical and angled about 25 degrees, suitable for rotating and drifting.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal. One uniform color only; no gradient, texture, lighting variation, floor plane, shadow, reflection or contact shadow.

Composition/framing: one centered complete leaf; generous padding on all sides; no cropping.

Constraints: crisp closed silhouette; do not use #ff00ff inside the leaf; no branch; no stem cluster; no extra leaves; no bird; no seat; no rope; no text; no watermark; no shadow.
```
