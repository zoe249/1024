# 重绘素材说明

本次素材不是从设计稿矩形裁切，而是参照三套设计稿逐件重新生成，再经过色键去除、柔边、去色溢和透明通道紧边裁切。

- `homepage/materials-generated/`：首页背景、Logo、角色、功能入口、资源条、设置和开始按钮；`animations/` 下包含小熊吹气 16 帧、小鸟扇翅 16 帧和蒲公英漂流 32 帧三套平滑循环动画。
- `settings/materials-generated/`：设置面板、标题、关闭按钮、音效/音乐、滑块、分享、反馈、返回首页和重新开始。
- `settlement/materials-generated/`：结算标题、实心/空心星、统计条、金币、双倍领取和继续按钮。

每个目录中的 `materials-preview.jpg` 是透明棋盘格总览。旧版 `materials/` 切图目录及其专用脚本、说明已移除，开发时统一使用 `materials-generated/`。

静态透明素材已按 750×1335 设计分辨率缩放为实际使用尺寸并保存为 256 色索引 PNG；无透明需求的首页背景使用高质量 JPEG。32 个静态素材由 25.69MB 降至 1.13MB。`process_generated_materials.py` 用于紧边裁切，随后运行 `optimize_generated_materials.py` 完成尺寸、压缩和总览图处理。提示词记录见 `generated-materials-prompts.md`。
