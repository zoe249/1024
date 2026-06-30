# 微信小游戏原生启动页

这套启动页运行在 Cocos 引擎加载之前，用来覆盖微信小游戏冷启动阶段。

页面内容：

- 项目现有的 `loading_bg_candy_shop.png` 全屏背景
- 项目现有的 `logo.png`
- 深色半透明进度条底槽
- 绿色胶囊进度
- 白色“初始化中”文案
- 进度条下方显示标准健康游戏忠告
- 不显示公司说明或版号信息

“初始化中”和健康游戏忠告已经预渲染为透明 PNG。这样可以避免部分微信基础库或
真机在引擎启动前无法将 `wx.createOffscreenCanvas` 中文内容上传到 WebGL，导致文字消失。

## 构建后安装

先在 Cocos Creator 3.8.8 中构建微信小游戏，然后在项目根目录执行：

```bash
node tools/wechat-startup-page/install.js
```

默认构建目录是：

```text
build/wechatgame/
```

如果构建到了其他目录，可以把目录作为参数：

```bash
node tools/wechat-startup-page/install.js /你的绝对路径/wechatgame
```

安装脚本会：

1. 替换构建产物中的 `first-screen.js`
2. 将 loading 背景复制为 `background.png`
3. 将项目 Logo 复制为 `logo.png`
4. 复制 `loading-label.png` 和 `health-advice.png`
5. 保留 Cocos 生成的 `game.js`、分包配置和游戏代码不变

## 为什么要在每次构建后重新执行

`build/wechatgame/` 是 Cocos 自动生成目录，重新构建时 `first-screen.js` 会被 Creator 覆盖。因此每次重新构建微信小游戏后，需要再次运行安装命令。

## 手工安装

如果不运行脚本，也可以手工复制：

```text
tools/wechat-startup-page/first-screen.js
  → build/wechatgame/first-screen.js

assets/images/Loading/loading_bg_candy_shop.png
  → build/wechatgame/background.png

assets/images/logo.png
  → build/wechatgame/logo.png

tools/wechat-startup-page/loading-label.png
  → build/wechatgame/loading-label.png

tools/wechat-startup-page/health-advice.png
  → build/wechatgame/health-advice.png
```

启动页保持了 Cocos Creator 3.8.8 的三个标准方法：

```js
firstScreen.start(...)
firstScreen.setProgress(...)
firstScreen.end()
```

所以不需要再修改生成的 `game.js`。
