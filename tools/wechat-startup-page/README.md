# 微信小游戏原生启动页

这套启动页运行在 Cocos 引擎加载之前，用来覆盖微信小游戏冷启动阶段。

页面内容：

- 06:00–17:59 使用第二套“手工剪纸”轻量 JPG 全屏背景
- 18:00–05:59 使用第三套“夜光水彩”轻量 JPG 全屏背景
- 由首页 Logo 裁边、缩放后生成的轻量透明 PNG
- 深棕色胶囊进度底槽与春芽绿进度
- “正在唤醒数字花园…”状态文案
- 带半透明底板的标准健康游戏忠告
- 不显示公司说明或版号信息

昼夜判断使用玩家设备的本地时间。启动页只有背景和 Logo 使用图片。“正在唤醒数字花园…”和健康游戏忠告由微信离屏 2D Canvas
使用系统字体实时绘制，再交给 WebGL 展示，不再携带任何文字图片文件。

背景和 Logo 使用发布专用轻量资源，避免高清设计源直接进入微信主包。安装脚本会
自动删除旧版启动大图、旧文字图片与 `startup-preview*.png` 调试预览，并输出主包体积。
它还会把微信构建中重复生成的 Cocos 插屏大图替换为 2×2 占位图：真正的启动视觉已经
由 `first-screen.js` 接管，不需要再把同一张插屏同时放进 `background.jpg` 和
`src/settings.json`。处理后若主包仍超过 4MB，命令会直接失败，不再只输出警告。

`settings/v2/packages/builder.json` 同时启用了烘焙项目 Logo 的自定义 Cocos 插屏，
因此 Web/原生发布也不会再显示默认 Cocos Logo。微信发布安装本目录的原生首屏后，
还会获得真实加载进度和健康游戏忠告。

## 重新生成视觉资源

正式晨光设计源位于 `design/startup/first-entry-background-v2-source.png`，昼夜候选源位于
`design/startup/background-variants-v1/`。更新设计源或首页 Logo 后执行：

```bash
python tools/wechat-startup-page/generate-startup-assets.py
```

脚本会同步生成微信轻量背景、透明 Logo、Cocos 自定义插屏图片和静态排版预览。

## 构建后安装

先在 Cocos Creator 3.8.8 中构建微信小游戏，然后在项目根目录执行：

```bash
npm run postbuild:wechat
```

这条命令默认安装昼夜动态方案：白天使用 B，夜间使用 C。两张图片会一起进入微信包，
`first-screen.js` 在每次冷启动时按设备本地时间选择，不需要重新构建。

如果要临时关闭动态切换并强制固定某一套背景：

```bash
npm run postbuild:wechat -- --style a  # 彩铅晨光
npm run postbuild:wechat -- --style b  # 手工剪纸
npm run postbuild:wechat -- --style c  # 夜光水彩
```

也可以不经过 npm，直接执行同一个脚本：

```bash
node tools/wechat-startup-page/install.js --style b
```

默认构建目录是：

```text
build/wechatgame/
```

如果构建到了其他目录，可以把目录作为参数：

```bash
node tools/wechat-startup-page/install.js /你的绝对路径/wechatgame
```

或者使用明确参数：

```bash
node tools/wechat-startup-page/install.js --build-dir /你的绝对路径/wechatgame --style c
```

使用任意自定义背景时，无需覆盖仓库内的正式资源；该命令同样会固定背景：

```bash
node tools/wechat-startup-page/install.js --background /你的图片.jpg
```

安装脚本会：

1. 替换构建产物中的 `first-screen.js`
2. 默认复制经过主包压缩的 `startup-background-day.jpg` 与 `startup-background-night.jpg`
3. 生成 `startup-background-config.js`，记录图片名与 06:00 / 18:00 分界
4. 复制轻量 Logo `startup-logo.png`
5. 清理 Cocos 默认品牌图、重复插屏数据、旧文字图片和与当前模式冲突的背景文件
6. 使用 SHA-256 校验全部复制与写入结果
7. 按 `game.json` 声明的分包目录统计真实主包体积，超过 4MB 时让命令失败
8. 保留 Cocos 生成的 `game.js`、分包配置和游戏代码不变

## 为什么要在每次构建后重新执行

`build/wechatgame/` 是 Cocos 自动生成目录，重新构建时 `first-screen.js` 会被 Creator 覆盖。因此每次重新构建微信小游戏后，都要再次运行 `npm run postbuild:wechat`。

可用背景与参数可随时查看：

```bash
node tools/wechat-startup-page/install.js --list-styles
node tools/wechat-startup-page/install.js --help
```

## 手工安装

如果不运行脚本，也可以手工复制：

```text
tools/wechat-startup-page/first-screen.js
  → build/wechatgame/first-screen.js

tools/wechat-startup-page/startup-background-day.jpg
  → build/wechatgame/startup-background-day.jpg

tools/wechat-startup-page/startup-background-night.jpg
  → build/wechatgame/startup-background-night.jpg

tools/wechat-startup-page/startup-logo.png
  → build/wechatgame/startup-logo.png
```

手工安装还需要在构建根目录创建 `startup-background-config.js`：

```js
module.exports = {
    day: 'startup-background-day.jpg',
    night: 'startup-background-night.jpg',
    dayStartHour: 6,
    nightStartHour: 18
};
```

启动页保持了 Cocos Creator 3.8.8 的三个标准方法：

```js
firstScreen.start(...)
firstScreen.setProgress(...)
firstScreen.end()
```

所以不需要再修改生成的 `game.js`。
