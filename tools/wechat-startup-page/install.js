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
const MAIN_PACKAGE_LIMIT_BYTES = 4 * 1024 * 1024;
const generatedGameFile = path.join(buildDirectory, 'game.js');
const targetFirstScreenFile = path.join(buildDirectory, 'first-screen.js');
const targetBackgroundFile = path.join(buildDirectory, 'startup-background.jpg');
const targetLogoFile = path.join(buildDirectory, 'startup-logo.png');
const sourceFirstScreenFile = path.join(__dirname, 'first-screen.js');
const sourceBackgroundFile = path.join(__dirname, 'startup-background.jpg');
const sourceLogoFile = path.join(__dirname, 'startup-logo.png');
// 清理旧版大图与调试预览，避免无用文件被微信开发者工具计入主包。
const obsoleteBuildFiles = [
    'background.png',
    'logo.png',
    'slogan.png',
    'loading-label.png',
    'health-advice.png',
    'startup-preview.png',
    'startup-preview-top.png'
];

function fail(message) {
    console.error(`\n[微信启动页] ${message}\n`);
    process.exit(1);
}

function assertFile(filePath, description) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(`未找到${description}：${filePath}`);
    }
}

function removeFileIfExists(filePath) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
    }
}

/**
 * 统计微信主包根目录体积。
 *
 * subpackages 目录由微信按分包处理，因此只统计其外部文件；
 * 结果用于安装后立即发现主包超限，而不是等上传时才报错。
 */
function calculateMainPackageSize(directory) {
    let totalBytes = 0;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'subpackages') {
            continue;
        }

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            totalBytes += calculateMainPackageSize(entryPath);
        } else if (entry.isFile()) {
            totalBytes += fs.statSync(entryPath).size;
        }
    }

    return totalBytes;
}

function formatMegabytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

assertFile(generatedGameFile, '微信小游戏构建入口 game.js');
assertFile(sourceFirstScreenFile, '启动页脚本');
assertFile(sourceBackgroundFile, 'loading 背景图');
assertFile(sourceLogoFile, '项目 Logo');

const gameSource = fs.readFileSync(generatedGameFile, 'utf8');
if (!gameSource.includes("require('./first-screen')")) {
    fail('当前 game.js 未使用 Cocos 标准 first-screen 模块，请确认构建版本为 Creator 3.8.8。');
}

obsoleteBuildFiles.forEach((fileName) => {
    removeFileIfExists(path.join(buildDirectory, fileName));
});

fs.copyFileSync(sourceFirstScreenFile, targetFirstScreenFile);
fs.copyFileSync(sourceBackgroundFile, targetBackgroundFile);
fs.copyFileSync(sourceLogoFile, targetLogoFile);

const mainPackageSize = calculateMainPackageSize(buildDirectory);
console.log('[微信启动页] 安装完成。');
console.log(`构建目录：${buildDirectory}`);
console.log('已写入：first-screen.js、轻量背景、轻量 Logo；其余内容使用原生文字和 WebGL 绘制');
console.log(`当前主包文件体积：${formatMegabytes(mainPackageSize)}`);
if (mainPackageSize > MAIN_PACKAGE_LIMIT_BYTES) {
    console.warn(
        `[微信启动页] 主包仍超过 4MB：${formatMegabytes(mainPackageSize)}，请继续检查根目录资源。`
    );
}
console.log('现在可以用微信开发者工具打开该构建目录预览。');
