# 素材生成提示词

## 公共风格

所有 UI 素材统一使用以下约束：温暖的中文手绘蜡笔与纸张质感，米白、珊瑚橙、叶绿色为主色，深棕色略带手绘感的描边，弱高光，无外部投影；画面只放一个完整素材，四周留足边距，背景为完全平坦的 `#ff00ff` 色键，不含场景、样机、水印或多余元素。

生成后使用：`remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`，再运行 `process_generated_materials.py`。

## 首页

- `ui-settings.png`：圆角方形珊瑚黄按钮，白色齿轮。
- `resource-coin.png`：米白资源条，金币图标、`1280`、绿色加号。
- `resource-stamina.png`：米白资源条，红心图标、`8/10`、绿色加号。
- `feature-daily-reward.png`：米白功能卡，礼盒图标，文字仅为“每日奖励”。
- `feature-leaderboard.png`：米白功能卡，奖杯图标，文字仅为“排行榜”。
- `feature-shop.png`：米白功能卡，商店图标，文字仅为“商店”。
- `feature-share.png`：米白功能卡，两个豆芽角色与爱心，文字仅为“分享”。
- `button-start-game.png`：适中宽度的珊瑚橙圆角按钮，文字仅为“开始游戏”。

背景、数字花园 Logo、小熊吹蒲公英、蓝色小鸟和蒲公英种子使用同一风格约束独立生成。

## 设置窗口

- `panel-background.png`：竖向米白纸张面板，珊瑚色内边与深棕描边，内部留空。
- `title-settings.png`：珊瑚色标题牌，文字仅为“设置”。
- `button-close.png`：米白圆形按钮，深棕关闭符号。
- `icon-sound.png`：金黄色圆形按钮，扬声器与声波。
- `icon-music.png`：金黄色圆形按钮，音符。
- `slider-knob.png`：叶绿色圆形旋钮，浅色叶脉纹理。
- `slider-track-empty.png`：米白细长空滑轨。
- `slider-fill.png`：珊瑚橙细长填充条。
- `button-share-friend.png`：米白功能卡，分享节点图标，文字仅为“转发好友”。
- `button-customer-feedback.png`：米白功能卡，客服耳机图标，文字仅为“客服反馈”。
- `button-return-home.png`：米白横向按钮，房屋图标，文字仅为“返回首页”。
- `button-restart.png`：珊瑚橙横向按钮，回转箭头，文字仅为“重新开始”。

## 结算页

- `statistics-strip.png`：米白横向统计条，左侧“本关得分 12480”，中间叶片，右侧“最高合成 1024”，保持单行。
- `reward-coin.png`：正面金色奖励金币，中心五角星，无文字。
- `button-double-reward.png`：暖黄色横向按钮，白色视频播放图标，文字仅为“双倍领取”。
- `button-continue.png`：叶绿色横向按钮，米白前进箭头，文字仅为“继续”。

结算标题、实心星和空心星使用同一风格约束独立生成。
