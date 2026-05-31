# 1024 小清新 UI 设计稿

## 设计定位

- 风格关键词：清晨薄荷、轻玻璃、圆润糖果、轻快消除。
- 核心目标：在不破坏现有 5x7 棋盘玩法识别的前提下，把开始页、游戏页、排行榜、暂停设置和结算页统一成一套清爽、柔和、容易还原的视觉系统。
- 推荐逻辑尺寸：`720 x 1280` 竖屏设计，Cocos 中继续以当前 `Canvas` 适配策略为准。
- 概念视觉稿：[fresh-ui-mockups.svg](./fresh-ui-mockups.svg)
- 真素材合成稿：[fresh-ui-assets-composite.png](./fresh-ui-assets-composite.png)
- 素材引用 SVG：[fresh-ui-assets-mockups.svg](./fresh-ui-assets-mockups.svg)

## 两版设计稿怎么用

- `fresh-ui-mockups.svg` 更偏概念稿，用来确定整体气质、页面结构、颜色和布局节奏。
- `fresh-ui-assets-composite.png` 已把 `assets/images` 里的现有素材真正合成到图片里，建议作为第一版 Cocos 还原主参考。
- `fresh-ui-assets-mockups.svg` 是素材路径引用版，有些预览器不会渲染 SVG 内部相对图片，因此只作为可编辑结构参考。
- 开发时建议优先按真素材合成稿落地，遇到现有素材颜色或形状不够贴合时，再参考概念稿做局部重绘或调色。

## 视觉原则

- 背景使用浅薄荷到浅水蓝再到奶油黄的纵向渐变，配少量圆点和柔和山丘/叶片装饰。
- 主 UI 采用半透明白色卡片，圆角建议 `48-72` 逻辑像素，阴影低透明度，不做厚重暗投影。
- 棋盘保留当前代码绘制的玻璃感方向，继续使用浅青色蒙版、虚线列分隔和圆角边框。
- 数字块保留现有高饱和颜色，让玩家仍能快速分辨数值等级；外围 UI 则降低饱和度，避免画面太闹。
- 文案语气轻松，比如“数字花园”“本周合成之星”“比 86% 好友更会种数字”，强化休闲感。

## 色彩 Token

| 用途 | 色值 | 说明 |
| --- | --- | --- |
| 背景薄荷 | `#EFFFF8` | 页面顶部主背景 |
| 浅水蓝 | `#DFF7FF` | 页面中段和排行榜辅助色 |
| 奶油黄 | `#FFF3A6` | 太阳、奖励、强调装饰 |
| 主按钮绿 | `#48D7A4` | 开始、继续、再来一局 |
| 副按钮蓝 | `#4AA8FF` | 排行榜、邀请好友 |
| 强调黄橙 | `#FFBC58` | 分享、最高数字、奖励按钮 |
| 主文字 | `#2E6C79` | 标题、重要数字 |
| 次级文字 | `#6E9AA1` | 提示和说明 |
| 卡片白 | `rgba(255,255,255,0.86-0.94)` | 弹窗、排行榜、状态栏 |

## 字体建议

- 标题和按钮：优先使用项目内 `assets/fonts/Eazy Chat.ttf`，备用为圆体或粗体无衬线。
- 数字：继续使用 `Courier New` 或项目内数字字体 `assets/fonts/LCdd.TTF`，保持棋子数字稳定、硬朗。
- 标题字号参考：设计稿 `720 x 1280` 下主标题 `72-88`，页面标题 `40-48`，按钮文字 `34-40`。
- 棋子数字字号沿用当前 `PieceController.ts` 的动态字号逻辑即可。

## 页面设计

### 游戏开始页

- 背景：全屏浅薄荷渐变，顶部右侧放柔和太阳圆，底部放双层薄荷山丘。
- Logo：居中卡片，主字 `1024`，副标题 `数字花园`。
- 中部展示 4 个漂浮数字块，数值建议 `2 / 16 / 64 / 1024`，轻微上下错落。
- 主按钮：`开始游戏`，绿色渐变，大圆角，位于屏幕中下部。
- 次按钮：`排行榜`，蓝色渐变，宽度略小。
- 底部快捷入口：音效、设置、分享三个圆形图标按钮，可复用现有 Modal/Buttons 资源。

### 游戏页

- 顶部状态栏：半透明圆角卡片，左侧显示当前下落数字，中间显示分数，右侧设置按钮。
- 棋盘：居中靠上，继续使用当前 5 列 7 行结构；外层浅阴影，内层玻璃底，列分隔虚线保持轻盈。
- 当前下落棋子：在棋盘上方到目标列之间增加小箭头或轻微光标，帮助玩家理解落点。
- 底部技能栏：白色半透明胶囊底板，三个技能按钮分别为炸弹、锤子、交换/火箭，保留数量角标。
- 安全区：底部技能栏距离屏幕底部至少 `40` 逻辑像素，小程序底部机型需要额外加安全区补偿。

### 排行榜页

- 以弹窗覆盖当前背景，不需要单独切换复杂场景。
- 卡片顶部标题为 `好友排行榜`，下方小胶囊文案 `本周合成之星`。
- 前三名用奖台式布局：第一名居中更高，第二、三名左右较低。
- 第 4 名以后使用白色列表项，圆头像、昵称、分数右对齐。
- 底部主操作为 `邀请好友`，按钮用蓝色渐变，和开始页副按钮保持一致。
- 微信好友榜接入时，可将开放数据域内容嵌入排行榜列表区域，外层仍使用本稿卡片和标题。

### 暂停设置页

- 当前游戏页上方覆盖 `rgba(20,62,75,0.18)` 暗化层，避免背景完全变黑。
- 中央弹窗采用白色半透明大圆角，标题 `游戏设置`。
- 音乐和音效使用两条圆角 Slider，音乐为绿色填充，音效为蓝色填充。
- 中部三个快捷按钮：重开、排行榜、分享。可复用现有 `RepeatBtn`、`RankBtn`、`ShareBtn`。
- 底部主按钮：`继续游戏`，绿色渐变。

### 结算页

- 游戏结束时使用与暂停页相同的轻遮罩。
- 中央结算卡片顶部显示 `本局结算`。
- 中间突出最高合成数字块，例如 `1024`，下面显示本局分数。
- 增加轻松反馈文案，例如 `比 86% 好友更会种数字`。
- 主按钮：`再来一局`；副按钮：`分享成绩`。
- 若后续接广告或复活，可在两个按钮中间增加 `看视频续一局`，但不建议第一版塞太多入口。

## 现有资源复用建议

| 资源 | 建议用途 |
| --- | --- |
| `assets/images/World/World_3_s.png` | 可作为旧背景参考；若色调太重，建议仅保留构图灵感，实际用渐变和图形重绘 |
| `assets/images/Status/TopPanel.png` | 顶部状态栏可继续复用或按设计稿改为半透明卡片 |
| `assets/images/Skills/BottomPanel.png` | 底部技能栏可继续复用，建议降低不透明度或叠加白色半透明底 |
| `assets/images/Skills/BombBtn.png` | 炸弹技能按钮 |
| `assets/images/Skills/HammerBtn.png` | 锤子技能按钮 |
| `assets/images/Skills/V_RocketBtn.png` | 交换/火箭技能按钮 |
| `assets/images/Modal/Popup.png` | 暂停设置、排行榜、结算弹窗底板可复用 |
| `assets/images/Buttons/LG_Green_Btn.png` | 开始、继续、再来一局主按钮 |
| `assets/images/Buttons/LG_Blue_Btn.png` | 排行榜、邀请好友副按钮 |
| `assets/images/Modal/RankBtn.png` | 排行榜快捷入口 |
| `assets/images/Modal/ShareBtn.png` | 分享快捷入口 |
| `assets/images/Modal/RepeatBtn.png` | 重开快捷入口 |

### 素材复用版页面对应关系

| 页面 | 主要复用素材 | 还原重点 |
| --- | --- | --- |
| 开始页 | `World_3_s.png`、`LG_Green_Btn.png`、`LG_Blue_Btn.png`、`RankBtn.png`、`SettingsBtn.png`、`ShareBtn.png` | 用现有世界背景托底，再叠一层浅薄荷遮罩，让旧素材融入小清新风格 |
| 游戏页 | `TopPanel.png`、`BottomPanel.png`、`BombBtn.png`、`HammerBtn.png`、`V_RocketBtn.png`、`AmountBG.png` | 保留现有 UI 资产，只调整透明度、位置和文本层级 |
| 排行榜页 | `Popup.png`、`CloseBtn.png`、`RankBtn.png`、`LG_Blue_Btn.png` | 弹窗底板直接复用，列表和前三名奖台用 Cocos 节点绘制 |
| 暂停设置页 | `Popup.png`、`MusicIcon.png`、`SoundIcon.png`、`SliderBase.png`、`Fill.png`、`Handler.png`、`RepeatBtn.png`、`RankBtn.png`、`ShareBtn.png` | Slider 资源可以直接拼接，按钮图标保持当前项目风格 |
| 结算页 | `Popup.png`、`LG_Green_Btn.png`、`ShareBtn.png`、`RankBtn.png`、`RepeatBtn.png` | 结算数字块继续用代码绘制，外层弹窗和操作入口复用现有素材 |

## Cocos 还原节点建议

```text
Canvas
└─ Main
   ├─ StartPage
   │  ├─ BgGradient
   │  ├─ DecoLayer
   │  ├─ LogoCard
   │  ├─ FloatingPieces
   │  ├─ StartButton
   │  ├─ RankButton
   │  └─ QuickActions
   ├─ GamePage
   │  ├─ Status
   │  ├─ board
   │  └─ SkliisController
   ├─ RankOverlay
   ├─ PauseOverlay
   └─ ResultOverlay
```

- `GamePage` 可以直接承接当前 `Main` 下已有的 `Status`、`board`、`SkliisController`、`PauseOverlay`。
- `StartPage`、`RankOverlay`、`ResultOverlay` 建议先做纯 UI 节点，不参与玩法状态计算。
- 纯装饰节点放在交互节点下层，避免挡住棋盘触摸和按钮事件。
- 弹窗类页面统一用遮罩层 + 面板，后续可以抽一个基础 Overlay 组件复用打开、关闭和缩放动画。

## 动效建议

- 开始页数字块：上下漂浮 `1.6s-2.2s`，不同数字错开 `0.15s`。
- 页面入场：卡片从 `scale 0.94` 到 `1`，透明度从 `0` 到 `255`，时长 `0.18s-0.24s`。
- 主按钮：点击时缩放到 `0.96` 后回弹，避免只换贴图显得僵硬。
- 棋子合成：保留当前数字块弹跳感，合成成功可加一圈浅色扩散波纹。
- 排行榜前三名：打开时从中间第一名开始轻微 stagger 展开。

## 第一版落地优先级

1. 先做开始页和结算页，补齐游戏闭环入口和出口。
2. 再统一暂停设置弹窗与排行榜弹窗，复用同一套 Overlay 面板样式。
3. 最后微调游戏页顶部状态栏、技能栏和棋盘装饰，让它们与新页面风格一致。
