#!/usr/bin/env node

/**
 * 将微信原生启动页安装到 Cocos Creator 3.8.8 的微信小游戏构建目录。
 *
 * 用法：
 *   node tools/wechat-startup-page/install.js
 *   node tools/wechat-startup-page/install.js /absolute/path/to/wechatgame
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const buildDirectory = path.resolve(
    process.argv[2] || path.join(projectRoot, 'build/wechatgame')
);
const generatedGameFile = path.join(buildDirectory, 'game.js');
const targetFirstScreenFile = path.join(buildDirectory, 'first-screen.js');
const targetBackgroundFile = path.join(buildDirectory, 'background.png');
const targetLogoFile = path.join(buildDirectory, 'logo.png');
const targetLoadingLabelFile = path.join(buildDirectory, 'loading-label.png');
const targetHealthAdviceFile = path.join(buildDirectory, 'health-advice.png');
const sourceFirstScreenFile = path.join(__dirname, 'first-screen.js');
const sourceLoadingLabelFile = path.join(__dirname, 'loading-label.png');
const sourceHealthAdviceFile = path.join(__dirname, 'health-advice.png');
const sourceBackgroundFile = path.join(
    projectRoot,
    'assets/images/Loading/loading_bg_candy_shop.png'
);
const sourceLogoFile = path.join(projectRoot, 'assets/images/logo.png');

function fail(message) {
    console.error(`\n[微信启动页] ${message}\n`);
    process.exit(1);
}

function assertFile(filePath, description) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(`未找到${description}：${filePath}`);
    }
}

assertFile(generatedGameFile, '微信小游戏构建入口 game.js');
assertFile(sourceFirstScreenFile, '启动页脚本');
assertFile(sourceBackgroundFile, 'loading 背景图');
assertFile(sourceLogoFile, '项目 Logo');
assertFile(sourceLoadingLabelFile, '初始化中文字图片');
assertFile(sourceHealthAdviceFile, '健康游戏忠告图片');

const gameSource = fs.readFileSync(generatedGameFile, 'utf8');
if (!gameSource.includes("require('./first-screen')")) {
    fail('当前 game.js 未使用 Cocos 标准 first-screen 模块，请确认构建版本为 Creator 3.8.8。');
}

fs.copyFileSync(sourceFirstScreenFile, targetFirstScreenFile);
fs.copyFileSync(sourceBackgroundFile, targetBackgroundFile);
fs.copyFileSync(sourceLogoFile, targetLogoFile);
fs.copyFileSync(sourceLoadingLabelFile, targetLoadingLabelFile);
fs.copyFileSync(sourceHealthAdviceFile, targetHealthAdviceFile);

console.log('[微信启动页] 安装完成。');
console.log(`构建目录：${buildDirectory}`);
console.log('已写入：first-screen.js、background.png、logo.png、两张文字图片');
console.log('现在可以用微信开发者工具打开该构建目录预览。');
