# 技能商城弹窗 V1

## 设计定位

- 商城由首页“商店”按钮独立打开，不再承担开始游戏流程。
- 延续首页、设置页和结算页的蜡笔彩铅质感、奶油色纸张、珊瑚橙边框与暖深棕描边。
- 商品信息按“技能图标 → 名称与用途 → 库存 → 价格与购买”组织，适合竖屏快速浏览。
- 三种技能继续使用游戏内的紫、蓝、黄识别色，并复用正式技能图标。

## 画布与布局

- 画布：`750 × 1334`，竖屏。
- 背景：首页场景加深青色半透明遮罩。
- 面板：约占屏幕宽度 86%、高度 68%，奶油色圆角纸张，珊瑚橙双层手绘边框。
- 标题：顶部叠放珊瑚橙标题牌“技能商店”。
- 顶部信息：金币图标与余额 `1280`，右上角圆形关闭按钮。
- 商品区：炸弹、木槌、交换三张纵向排列的横版商品卡。
- 底部提示：“技能将在下一局中使用”。

## 商品文案

| 技能 | 用途 | 库存 | 价格 |
| --- | --- | --- | ---: |
| 炸弹 | 清除周围棋子 | 持有 7/9 | 500 |
| 木槌 | 敲碎指定棋子 | 持有 5/9 | 300 |
| 交换 | 交换相邻棋子 | 持有 7/9 | 400 |

每张商品卡右侧使用绿色“购买”按钮。商城不展示“开始游戏”按钮、分页标签或其它货币。

## 最终生成提示词

```text
Use case: ui-mockup
Asset type: production-ready static design mockup for a portrait mobile game skill shop popup, 750×1334 composition
Input images: homepage/background style reference; settings popup panel reference; exact bomb, wooden mallet and swap skill icons.
Scene/backdrop: blue-sky spring-meadow homepage behind a dark translucent teal overlay.
Primary request: redesign the homepage skill shop as one centered hand-drawn popup consistent with the existing game UI.
Style/medium: cheerful children's casual-game UI, wax-crayon and colored-pencil texture, cream paper surfaces, coral-orange borders, warm dark-brown irregular outlines, restrained highlights, no glossy 3D plastic.
Composition: raised “技能商店” title tab; coin balance 1280; close button; three stacked product cards; purple/blue/yellow icon thumbnails; item name, description, inventory, coin price and green purchase button; footer “技能将在下一局中使用”.
Exact products: 炸弹 / 清除周围棋子 / 持有 7/9 / 500; 木槌 / 敲碎指定棋子 / 持有 5/9 / 300; 交换 / 交换相邻棋子 / 持有 7/9 / 400.
Constraints: no start-game button, no blue button, no notebook rings, no extra currency, no tabs, no character, no extra product, no English text, no logo, no watermark.
```

生成方式：Codex 内置图像生成模式。当前阶段仅保存静态设计稿，尚未修改商城 Prefab 或脚本。
