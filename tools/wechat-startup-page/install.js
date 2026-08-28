#!/usr/bin/env node

/**
 * Cocos Creator 3.8.8 微信小游戏构建后处理脚本。
 *
 * 每次 Creator 构建后执行一次，用项目首屏覆盖构建目录里的默认 Cocos first-screen。
 * 脚本只改微信构建产物，不改 game.js、分包配置或玩法资源。
 *
 * 常用命令：
 *   node tools/wechat-startup-page/install.js
 *   node tools/wechat-startup-page/install.js --style b
 *   node tools/wechat-startup-page/install.js --style c --build-dir build/wechatgame
 *   node tools/wechat-startup-page/install.js D:/path/to/wechatgame --style a
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const DEFAULT_BUILD_DIRECTORY = path.join(projectRoot, 'build/wechatgame');
const MAIN_PACKAGE_LIMIT_BYTES = 4 * 1024 * 1024;
const MAIN_PACKAGE_WARNING_BYTES = Math.floor(3.8 * 1024 * 1024);
const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 18;
const DAY_BACKGROUND_FILE = 'startup-background-day.jpg';
const NIGHT_BACKGROUND_FILE = 'startup-background-night.jpg';
const FIXED_BACKGROUND_FILE = 'startup-background.jpg';
const BACKGROUND_CONFIG_FILE = 'startup-background-config.js';
// 微信构建已经由 first-screen.js 全程接管首屏，Cocos 的后续插屏只保留 2×2 占位图。
const TINY_COCOS_SPLASH_JPEG_BASE64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAsICAoIBwsKCQoNDAsNERwSEQ8PESIZGhQcKSQrKigkJyctMkA3LTA9MCcnOEw5PUNFSElIKzZPVU5GVEBHSEX/2wBDAQwNDREPESESEiFFLicuRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUX/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwChAJpL/9k=';

const BACKGROUND_STYLES = {
    current: {
        label: '当前默认 · 数字花园晨光',
        file: path.join(__dirname, 'startup-background.jpg')
    },
    a: {
        label: 'A · 彩铅晨光',
        file: path.join(
            projectRoot,
            'design/startup/background-variants-v1/a-colored-pencil-morning-background.jpg'
        )
    },
    b: {
        label: 'B · 手工剪纸',
        file: path.join(__dirname, 'startup-background-day.jpg')
    },
    c: {
        label: 'C · 夜光水彩',
        file: path.join(__dirname, 'startup-background-night.jpg')
    }
};

const STYLE_ALIASES = {
    default: 'current',
    current: 'current',
    a: 'a',
    pencil: 'a',
    b: 'b',
    paper: 'b',
    papercut: 'b',
    c: 'c',
    night: 'c',
    watercolor: 'c'
};

const DEFAULT_DYNAMIC_STYLES = {
    day: 'b',
    night: 'c'
};

// 清理 Creator 默认品牌图与旧版调试资源，避免无用文件继续占用微信主包。
const OBSOLETE_BUILD_FILES = [
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

function printHelp() {
    console.log(`
微信小游戏启动页构建后处理

用法：
  node tools/wechat-startup-page/install.js [构建目录] [选项]

选项：
  --style <current|a|b|c>  强制固定使用某套内置背景
  --background <图片路径>   强制固定使用任意自定义 JPEG 背景
  --build-dir <目录>         指定微信小游戏构建目录
  --list-styles              查看内置背景
  -h, --help                 查看帮助

默认规则：
  06:00–17:59 使用 B · 手工剪纸
  18:00–05:59 使用 C · 夜光水彩
  时间取自玩家设备本地时间

示例：
  npm run postbuild:wechat
  npm run postbuild:wechat -- --style b
  node tools/wechat-startup-page/install.js --style c
  node tools/wechat-startup-page/install.js D:/release/wechatgame --style a
`);
}

function printStyles() {
    console.log('默认动态方案：白天 B · 手工剪纸；夜间 C · 夜光水彩');
    console.log('可用启动背景：');
    for (const [key, style] of Object.entries(BACKGROUND_STYLES)) {
        console.log(`  ${key.padEnd(7)} ${style.label}`);
    }
}

function resolveProjectPath(value) {
    return path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
}

function requireOptionValue(args, index, optionName) {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        fail(`${optionName} 缺少参数。`);
    }
    return value;
}

/**
 * 解析命令行参数，同时兼容旧版“第一个位置参数就是构建目录”的用法。
 */
function parseArguments(args) {
    let buildDirectory = DEFAULT_BUILD_DIRECTORY;
    let hasPositionalBuildDirectory = false;
    let styleName = null;
    let customBackgroundFile = null;

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];

        if (argument === '-h' || argument === '--help') {
            printHelp();
            process.exit(0);
        }
        if (argument === '--list-styles') {
            printStyles();
            process.exit(0);
        }
        if (argument === '--style') {
            styleName = requireOptionValue(args, index, '--style');
            index += 1;
            continue;
        }
        if (argument.startsWith('--style=')) {
            styleName = argument.slice('--style='.length);
            continue;
        }
        if (argument === '--background') {
            customBackgroundFile = resolveProjectPath(
                requireOptionValue(args, index, '--background')
            );
            index += 1;
            continue;
        }
        if (argument.startsWith('--background=')) {
            customBackgroundFile = resolveProjectPath(
                argument.slice('--background='.length)
            );
            continue;
        }
        if (argument === '--build-dir') {
            buildDirectory = resolveProjectPath(
                requireOptionValue(args, index, '--build-dir')
            );
            index += 1;
            continue;
        }
        if (argument.startsWith('--build-dir=')) {
            buildDirectory = resolveProjectPath(
                argument.slice('--build-dir='.length)
            );
            continue;
        }
        if (argument.startsWith('-')) {
            fail(`无法识别参数：${argument}`);
        }
        if (hasPositionalBuildDirectory) {
            fail(`只能指定一个构建目录，多余参数：${argument}`);
        }

        buildDirectory = resolveProjectPath(argument);
        hasPositionalBuildDirectory = true;
    }

    const normalizedStyleName = styleName === null
        ? null
        : String(styleName).trim().toLowerCase();
    const styleKey = normalizedStyleName === null
        ? null
        : STYLE_ALIASES[normalizedStyleName];
    if (!customBackgroundFile && normalizedStyleName !== null && !styleKey) {
        fail(`未知背景样式：${styleName}。请使用 --list-styles 查看可选项。`);
    }

    if (!customBackgroundFile && styleKey === null) {
        const dayStyle = BACKGROUND_STYLES[DEFAULT_DYNAMIC_STYLES.day];
        const nightStyle = BACKGROUND_STYLES[DEFAULT_DYNAMIC_STYLES.night];
        return {
            buildDirectory,
            mode: 'dynamic',
            backgroundLabel: `动态 · 白天 ${dayStyle.label} / 夜间 ${nightStyle.label}`,
            daySourceBackgroundFile: dayStyle.file,
            nightSourceBackgroundFile: nightStyle.file
        };
    }

    const fixedBackgroundFile = customBackgroundFile || BACKGROUND_STYLES[styleKey].file;
    const fixedBackgroundLabel = customBackgroundFile
        ? `自定义 · ${path.basename(customBackgroundFile)}`
        : BACKGROUND_STYLES[styleKey].label;

    return {
        buildDirectory,
        mode: 'fixed',
        backgroundLabel: `固定 · ${fixedBackgroundLabel}`,
        daySourceBackgroundFile: fixedBackgroundFile,
        nightSourceBackgroundFile: fixedBackgroundFile
    };
}

function assertFile(filePath, description) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(`未找到${description}：${filePath}`);
    }
}

function assertJpegFile(filePath) {
    const fileHandle = fs.openSync(filePath, 'r');
    const signature = Buffer.alloc(2);
    try {
        fs.readSync(fileHandle, signature, 0, signature.length, 0);
    } finally {
        fs.closeSync(fileHandle);
    }

    if (signature[0] !== 0xff || signature[1] !== 0xd8) {
        fail(`启动页背景必须是 JPEG 图片，请先转换后再运行：${filePath}`);
    }
}

function removeFileIfExists(filePath) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}

function calculateSha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * 复制并用 SHA-256 核对，避免构建目录中残留半写入或旧版本文件。
 */
function copyAndVerify(sourceFile, targetFile, description) {
    if (path.resolve(sourceFile) !== path.resolve(targetFile)) {
        fs.copyFileSync(sourceFile, targetFile);
    }
    const sourceHash = calculateSha256(sourceFile);
    const targetHash = calculateSha256(targetFile);
    if (sourceHash !== targetHash) {
        fail(`${description}复制后校验失败：${targetFile}`);
    }
}

/**
 * 写入运行时背景配置并校验内容，防止构建目录仍引用上一次安装的模式。
 */
function writeAndVerify(targetFile, content, description) {
    fs.writeFileSync(targetFile, content, 'utf8');
    const expectedHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    const targetHash = calculateSha256(targetFile);
    if (expectedHash !== targetHash) {
        fail(`${description}写入后校验失败：${targetFile}`);
    }
}

function writeBufferAndVerify(targetFile, content, description) {
    fs.writeFileSync(targetFile, content);
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
    const targetHash = calculateSha256(targetFile);
    if (expectedHash !== targetHash) {
        fail(`${description}写入后校验失败：${targetFile}`);
    }
}

function createBackgroundConfigSource(dayFile, nightFile) {
    return `/** 构建后自动生成：微信启动页昼夜背景配置。 */
module.exports = {
    day: ${JSON.stringify(dayFile)},
    night: ${JSON.stringify(nightFile)},
    dayStartHour: ${DAY_START_HOUR},
    nightStartHour: ${NIGHT_START_HOUR}
};
`;
}

/**
 * 移除微信构建中重复烘焙的 Cocos 插屏大图。
 *
 * 原生 first-screen 会一直显示到 Cocos 初始化完成，因此后续引擎插屏时间固定为 0，
 * 仅保留一个暖色 2×2 JPEG 占位，兼容可能按固定文件名读取 background.jpg 的适配层。
 */
function minimizeGeneratedCocosSplash(buildDirectory) {
    const settingsFile = path.join(buildDirectory, 'src/settings.json');
    const backgroundFile = path.join(buildDirectory, 'background.jpg');
    assertFile(settingsFile, 'Cocos 构建设置 src/settings.json');

    const originalSettingsBytes = fs.statSync(settingsFile).size;
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    const splashScreen = Object.assign({}, settings.splashScreen || {});
    splashScreen.totalTime = 0;
    splashScreen.logo = { type: 'none' };
    splashScreen.background = {
        type: 'custom',
        base64: `data:image/jpeg;base64,${TINY_COCOS_SPLASH_JPEG_BASE64}`
    };
    settings.splashScreen = splashScreen;

    writeAndVerify(
        settingsFile,
        JSON.stringify(settings),
        '瘦身后的 Cocos 构建设置'
    );

    let savedBytes = originalSettingsBytes - fs.statSync(settingsFile).size;
    if (fs.existsSync(backgroundFile) && fs.statSync(backgroundFile).isFile()) {
        const originalBackgroundBytes = fs.statSync(backgroundFile).size;
        const tinyBackground = Buffer.from(TINY_COCOS_SPLASH_JPEG_BASE64, 'base64');
        writeBufferAndVerify(backgroundFile, tinyBackground, 'Cocos 插屏占位图');
        savedBytes += originalBackgroundBytes - tinyBackground.length;
    }

    return Math.max(0, savedBytes);
}

function calculateDirectorySize(directory, excludedDirectories = new Set()) {
    const resolvedDirectory = path.resolve(directory);
    if (excludedDirectories.has(resolvedDirectory)) {
        return 0;
    }

    let totalBytes = 0;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            totalBytes += calculateDirectorySize(entryPath, excludedDirectories);
        } else if (entry.isFile()) {
            totalBytes += fs.statSync(entryPath).size;
        }
    }

    return totalBytes;
}

/**
 * 按 game.json 中实际声明的 root 排除分包，避免用固定目录名造成漏算或误算。
 */
function calculateMainPackageSize(directory) {
    const gameConfigFile = path.join(directory, 'game.json');
    assertFile(gameConfigFile, '微信小游戏配置 game.json');
    const gameConfig = JSON.parse(fs.readFileSync(gameConfigFile, 'utf8'));
    const excludedDirectories = new Set(
        (Array.isArray(gameConfig.subpackages) ? gameConfig.subpackages : [])
            .map((subpackage) => path.resolve(directory, String(subpackage.root || '')))
            .filter((subpackageDirectory) => subpackageDirectory !== path.resolve(directory))
    );
    return calculateDirectorySize(directory, excludedDirectories);
}

function formatMegabytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    const generatedGameFile = path.join(options.buildDirectory, 'game.js');
    const targetFirstScreenFile = path.join(options.buildDirectory, 'first-screen.js');
    const targetBackgroundConfigFile = path.join(
        options.buildDirectory,
        BACKGROUND_CONFIG_FILE
    );
    const targetFixedBackgroundFile = path.join(
        options.buildDirectory,
        FIXED_BACKGROUND_FILE
    );
    const targetDayBackgroundFile = path.join(
        options.buildDirectory,
        DAY_BACKGROUND_FILE
    );
    const targetNightBackgroundFile = path.join(
        options.buildDirectory,
        NIGHT_BACKGROUND_FILE
    );
    const targetLogoFile = path.join(options.buildDirectory, 'startup-logo.png');
    const sourceFirstScreenFile = path.join(__dirname, 'first-screen.js');
    const sourceLogoFile = path.join(__dirname, 'startup-logo.png');

    assertFile(generatedGameFile, '微信小游戏构建入口 game.js');
    assertFile(sourceFirstScreenFile, '启动页脚本');
    assertFile(sourceLogoFile, '项目 Logo');
    const sourceBackgroundFiles = [
        options.daySourceBackgroundFile,
        options.nightSourceBackgroundFile
    ].filter((file, index, files) => files.indexOf(file) === index);
    sourceBackgroundFiles.forEach((file) => {
        assertFile(file, '启动页背景');
        assertJpegFile(file);
    });

    const gameSource = fs.readFileSync(generatedGameFile, 'utf8');
    const firstScreenRequirePattern = /require\((['"])\.\/first-screen\1\)/;
    if (!firstScreenRequirePattern.test(gameSource)) {
        fail('当前 game.js 未使用 Cocos 标准 first-screen 模块，请确认构建版本为 Creator 3.8.8。');
    }

    const removedFiles = OBSOLETE_BUILD_FILES.filter((fileName) => (
        removeFileIfExists(path.join(options.buildDirectory, fileName))
    ));

    copyAndVerify(sourceFirstScreenFile, targetFirstScreenFile, '启动页脚本');
    copyAndVerify(sourceLogoFile, targetLogoFile, '启动页 Logo');

    let installedBackgroundFiles;
    let configDayFile;
    let configNightFile;
    if (options.mode === 'dynamic') {
        if (removeFileIfExists(targetFixedBackgroundFile)) {
            removedFiles.push(FIXED_BACKGROUND_FILE);
        }
        copyAndVerify(
            options.daySourceBackgroundFile,
            targetDayBackgroundFile,
            '白天启动页背景'
        );
        copyAndVerify(
            options.nightSourceBackgroundFile,
            targetNightBackgroundFile,
            '夜间启动页背景'
        );
        installedBackgroundFiles = [DAY_BACKGROUND_FILE, NIGHT_BACKGROUND_FILE];
        configDayFile = DAY_BACKGROUND_FILE;
        configNightFile = NIGHT_BACKGROUND_FILE;
    } else {
        [
            [targetDayBackgroundFile, DAY_BACKGROUND_FILE],
            [targetNightBackgroundFile, NIGHT_BACKGROUND_FILE]
        ].forEach(([filePath, fileName]) => {
            if (removeFileIfExists(filePath)) {
                removedFiles.push(fileName);
            }
        });
        copyAndVerify(
            options.daySourceBackgroundFile,
            targetFixedBackgroundFile,
            '固定启动页背景'
        );
        installedBackgroundFiles = [FIXED_BACKGROUND_FILE];
        configDayFile = FIXED_BACKGROUND_FILE;
        configNightFile = FIXED_BACKGROUND_FILE;
    }

    writeAndVerify(
        targetBackgroundConfigFile,
        createBackgroundConfigSource(configDayFile, configNightFile),
        '启动页背景配置'
    );

    const savedCocosSplashBytes = minimizeGeneratedCocosSplash(options.buildDirectory);
    const mainPackageSize = calculateMainPackageSize(options.buildDirectory);
    console.log('[微信启动页] 构建后处理完成。');
    console.log(`构建目录：${options.buildDirectory}`);
    console.log(`背景方案：${options.backgroundLabel}`);
    if (options.mode === 'dynamic') {
        console.log('时间规则：06:00–17:59 白天；18:00–05:59 夜间（设备本地时间）');
    } else {
        console.log('时间规则：已由命令行参数强制固定背景');
    }
    console.log(
        `已覆盖：first-screen.js、${BACKGROUND_CONFIG_FILE}、${installedBackgroundFiles.join('、')}、startup-logo.png`
    );
    console.log(`已移除重复 Cocos 插屏数据：${formatMegabytes(savedCocosSplashBytes)}`);
    console.log(`已清理默认/旧版文件：${removedFiles.length > 0 ? removedFiles.join('、') : '无'}`);
    console.log('文件校验：SHA-256 一致');
    console.log(`当前主包文件体积：${formatMegabytes(mainPackageSize)}`);
    if (mainPackageSize > MAIN_PACKAGE_LIMIT_BYTES) {
        fail(
            `主包仍超过 4MB：${formatMegabytes(mainPackageSize)}。构建后处理已停止，请继续拆分主包资源。`
        );
    } else if (mainPackageSize > MAIN_PACKAGE_WARNING_BYTES) {
        console.warn(
            `[微信启动页] 主包已低于 4MB，但安全余量较小：${formatMegabytes(mainPackageSize)}。`
        );
    }
    console.log('现在可以直接用微信开发者工具打开该构建目录。');
}

try {
    main();
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
