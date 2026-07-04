/**
 * 微信小游戏原生启动页。
 *
 * 该文件保持 Cocos Creator 3.8.8 生成的 first-screen.js 接口不变，
 * 在引擎初始化前直接使用 WebGL 绘制，避免先申请 2D Context 后导致 Cocos 无法创建 WebGL Context。
 */

const TEXTURE_VERTEX_SHADER = `
attribute vec2 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;

void main() {
    gl_Position = vec4(a_Position, 0.0, 1.0);
    v_TexCoord = a_TexCoord;
}
`;

const TEXTURE_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_Texture;
varying vec2 v_TexCoord;

void main() {
    gl_FragColor = texture2D(u_Texture, v_TexCoord);
}
`;

const BAR_VERTEX_SHADER = `
attribute vec2 a_Position;
attribute vec2 a_LocalCoord;
varying vec2 v_LocalCoord;

void main() {
    gl_Position = vec4(a_Position, 0.0, 1.0);
    v_LocalCoord = a_LocalCoord;
}
`;

const BAR_FRAGMENT_SHADER = `
precision mediump float;
uniform float u_Progress;
uniform float u_Aspect;
uniform vec4 u_TrackColor;
uniform vec4 u_FillColor;
varying vec2 v_LocalCoord;

float roundedBoxDistance(vec2 point, vec2 halfSize, float radius) {
    vec2 distanceToEdge = abs(point) - halfSize + radius;
    return length(max(distanceToEdge, 0.0))
        + min(max(distanceToEdge.x, distanceToEdge.y), 0.0)
        - radius;
}

void main() {
    float edgeSoftness = 0.025;
    vec2 trackPoint = vec2(
        (v_LocalCoord.x - 0.5) * u_Aspect,
        v_LocalCoord.y - 0.5
    );
    float trackDistance = roundedBoxDistance(
        trackPoint,
        vec2(u_Aspect * 0.5, 0.5),
        0.5
    );
    float trackAlpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, trackDistance);

    float fillWidth = max(u_Progress * u_Aspect, 0.0);
    float fillHalfWidth = fillWidth * 0.5;
    float fillCenterX = -u_Aspect * 0.5 + fillHalfWidth;
    float fillRadius = min(0.5, fillHalfWidth);
    vec2 fillPoint = vec2(trackPoint.x - fillCenterX, trackPoint.y);
    float fillDistance = roundedBoxDistance(
        fillPoint,
        vec2(fillHalfWidth, 0.5),
        fillRadius
    );
    float fillAlpha = (1.0 - smoothstep(-edgeSoftness, edgeSoftness, fillDistance))
        * step(0.001, u_Progress);

    vec4 color = mix(u_TrackColor, u_FillColor, fillAlpha);
    color.a *= trackAlpha;
    gl_FragColor = color;
}
`;

const WEBGL_OPTIONS = {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false
};

const BACKGROUND_FILE = 'startup-background.jpg';
const LOGO_FILE = 'startup-logo.png';
// Logo 上移到顶部天空留白区，避免覆盖糖果店屋顶和主体角色。
const LOGO_CENTER_Y = 0.78;
const LOGO_WIDTH_RATIO = 0.54;
const MAX_LOGO_HEIGHT_RATIO = 0.18;
// 进度条使用较纤细的高度，接近参考启动页的轻量胶囊样式。
const BAR_HEIGHT_RATIO = 0.024;
const MIN_BAR_HEIGHT_PIXELS = 24;
const TRACK_COLOR = [25 / 255, 28 / 255, 34 / 255, 0.78];
const FILL_COLOR = [8 / 255, 196 / 255, 105 / 255, 1];

let gl = null;
let textureProgram = null;
let barProgram = null;
let backgroundTexture = null;
let logoTexture = null;
let labelTexture = null;
let healthAdviceTexture = null;
let backgroundBuffer = null;
let logoBuffer = null;
let barBuffer = null;
let labelBuffer = null;
let healthAdviceBuffer = null;
let animationFrameHandle = null;
let running = false;
let progress = 0;
let frameResolvers = [];

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`启动页着色器编译失败：${message}`);
    }

    return shader;
}

function createProgram(vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(shaderProgram);
        gl.deleteProgram(shaderProgram);
        throw new Error(`启动页着色器链接失败：${message}`);
    }

    return shaderProgram;
}

function createTexture(source) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

function loadImage(path) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.premultiplyAlpha = false;
        image.onload = () => resolve(image);
        image.onerror = (error) => reject(error);
        image.src = path.replace('#', '%23');
    });
}

/**
 * 创建可绘制中文的离屏 2D Canvas。
 *
 * 不同微信基础库暴露离屏 Canvas 的方式并不完全一致，因此依次尝试
 * wx.createOffscreenCanvas、标准 OffscreenCanvas 和适配层 document.createElement。
 */
function createTextCanvas(width, height) {
    const factories = [];

    if (typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function') {
        factories.push(
            () => wx.createOffscreenCanvas({ type: '2d', width, height }),
            () => wx.createOffscreenCanvas({ width, height })
        );
    }
    if (typeof OffscreenCanvas !== 'undefined') {
        factories.push(() => new OffscreenCanvas(width, height));
    }
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        factories.push(() => document.createElement('canvas'));
    }

    for (const createCanvas of factories) {
        try {
            const textCanvas = createCanvas();
            textCanvas.width = width;
            textCanvas.height = height;
            const context = textCanvas.getContext('2d');
            if (context) {
                return { textCanvas, context };
            }
        } catch (error) {
            console.warn('当前离屏 Canvas 创建方式不可用，继续尝试兼容方案。', error);
        }
    }

    throw new Error('微信启动页无法创建离屏 2D Canvas，文字将无法绘制。');
}

function createLoadingLabelTexture() {
    const { textCanvas, context } = createTextCanvas(512, 128);

    context.clearRect(0, 0, textCanvas.width, textCanvas.height);
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.45)';
    context.shadowBlur = 4;
    context.font = '600 58px sans-serif';
    context.fillText('初始化中', textCanvas.width * 0.5, textCanvas.height * 0.52);
    return createTexture(textCanvas);
}

/**
 * 绘制标准健康游戏忠告。
 *
 * 文字由微信系统字体实时绘制，不再依赖任何文字图片文件。
 */
function createHealthAdviceTexture() {
    const { textCanvas, context } = createTextCanvas(1024, 256);

    context.clearRect(0, 0, textCanvas.width, textCanvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.7)';
    context.shadowBlur = 6;
    context.shadowOffsetY = 2;

    context.fillStyle = '#ffe39a';
    context.font = '600 48px sans-serif';
    context.fillText('健康游戏忠告', textCanvas.width * 0.5, 44);

    context.fillStyle = '#ffffff';
    context.font = '500 34px sans-serif';
    context.fillText(
        '抵制不良游戏　拒绝盗版游戏　注意自我保护　谨防受骗上当',
        textCanvas.width * 0.5,
        118
    );
    context.fillText(
        '适度游戏益脑　沉迷游戏伤身　合理安排时间　享受健康生活',
        textCanvas.width * 0.5,
        174
    );
    return createTexture(textCanvas);
}

function createBuffer(values) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    return buffer;
}

function updateBuffer(buffer, values) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
}

/**
 * 计算 cover 模式下的背景 UV。
 *
 * 背景始终铺满屏幕；不同长宽比设备只裁切图片边缘，不会拉伸人物和建筑。
 */
function buildBackgroundVertices(image) {
    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = image.width / image.height;
    let minU = 0;
    let maxU = 1;
    let minV = 0;
    let maxV = 1;

    if (imageAspect > canvasAspect) {
        const visibleWidth = canvasAspect / imageAspect;
        minU = (1 - visibleWidth) * 0.5;
        maxU = 1 - minU;
    } else {
        const visibleHeight = imageAspect / canvasAspect;
        minV = (1 - visibleHeight) * 0.5;
        maxV = 1 - minV;
    }

    return [
        -1, -1, minU, minV,
        1, -1, maxU, minV,
        -1, 1, minU, maxV,
        1, 1, maxU, maxV
    ];
}

function buildRectVertices(centerX, centerY, width, height) {
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    return [
        centerX - halfWidth, centerY - halfHeight, 0, 0,
        centerX + halfWidth, centerY - halfHeight, 1, 0,
        centerX - halfWidth, centerY + halfHeight, 0, 1,
        centerX + halfWidth, centerY + halfHeight, 1, 1
    ];
}

/**
 * 依据当前屏幕比例设置 Logo、进度条和文字位置。
 *
 * 所有尺寸都由 Canvas 动态计算，保证全面屏、普通竖屏和平板预览时仍保持相同视觉层次。
 */
function updateLayout(logoImage) {
    const logoAspect = logoImage.width / logoImage.height;
    let logoWidthPixels = canvas.width * LOGO_WIDTH_RATIO;
    let logoHeightPixels = logoWidthPixels / logoAspect;
    const maxLogoHeightPixels = canvas.height * MAX_LOGO_HEIGHT_RATIO;

    if (logoHeightPixels > maxLogoHeightPixels) {
        logoHeightPixels = maxLogoHeightPixels;
        logoWidthPixels = logoHeightPixels * logoAspect;
    }

    const logoWidth = logoWidthPixels * 2 / canvas.width;
    const logoHeight = logoHeightPixels * 2 / canvas.height;
    updateBuffer(
        logoBuffer,
        buildRectVertices(0, LOGO_CENTER_Y, logoWidth, logoHeight)
    );

    const barWidthPixels = canvas.width * 0.68;
    const barHeightPixels = Math.max(
        canvas.height * BAR_HEIGHT_RATIO,
        MIN_BAR_HEIGHT_PIXELS
    );
    const barWidth = barWidthPixels * 2 / canvas.width;
    const barHeight = barHeightPixels * 2 / canvas.height;
    const barCenterY = -0.69;
    updateBuffer(barBuffer, buildRectVertices(0, barCenterY, barWidth, barHeight));

    const labelWidth = barWidth * 0.42;
    const labelHeight = barHeight * 0.72;
    updateBuffer(labelBuffer, buildRectVertices(0, barCenterY, labelWidth, labelHeight));

    // 健康游戏忠告放在进度条下方暗部，保留底部安全距离，避免被全面屏圆角裁切。
    const adviceWidth = 1.84;
    const adviceHeight = 0.18;
    const adviceCenterY = -0.86;
    updateBuffer(
        healthAdviceBuffer,
        buildRectVertices(0, adviceCenterY, adviceWidth, adviceHeight)
    );
}

function drawTexture(texture, buffer) {
    if (!texture || !buffer) {
        return;
    }

    gl.useProgram(textureProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(textureProgram, 'u_Texture'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const positionLocation = gl.getAttribLocation(textureProgram, 'a_Position');
    const texCoordLocation = gl.getAttribLocation(textureProgram, 'a_TexCoord');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(
        texCoordLocation,
        2,
        gl.FLOAT,
        false,
        stride,
        2 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function drawProgressBar() {
    gl.useProgram(barProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, barBuffer);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const positionLocation = gl.getAttribLocation(barProgram, 'a_Position');
    const localCoordLocation = gl.getAttribLocation(barProgram, 'a_LocalCoord');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(localCoordLocation);
    gl.vertexAttribPointer(
        localCoordLocation,
        2,
        gl.FLOAT,
        false,
        stride,
        2 * Float32Array.BYTES_PER_ELEMENT
    );

    const barWidthPixels = canvas.width * 0.68;
    const barHeightPixels = Math.max(
        canvas.height * BAR_HEIGHT_RATIO,
        MIN_BAR_HEIGHT_PIXELS
    );
    gl.uniform1f(gl.getUniformLocation(barProgram, 'u_Progress'), progress);
    gl.uniform1f(gl.getUniformLocation(barProgram, 'u_Aspect'), barWidthPixels / barHeightPixels);
    gl.uniform4fv(gl.getUniformLocation(barProgram, 'u_TrackColor'), TRACK_COLOR);
    gl.uniform4fv(gl.getUniformLocation(barProgram, 'u_FillColor'), FILL_COLOR);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(43 / 255, 163 / 255, 239 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawTexture(backgroundTexture, backgroundBuffer);
    drawTexture(logoTexture, logoBuffer);
    drawProgressBar();
    drawTexture(labelTexture, labelBuffer);
    drawTexture(healthAdviceTexture, healthAdviceBuffer);
}

function resolveFrameWaiters() {
    const resolvers = frameResolvers;
    frameResolvers = [];
    resolvers.forEach((resolve) => resolve());
}

function tick() {
    if (!running) {
        return;
    }

    draw();
    resolveFrameWaiters();
    animationFrameHandle = requestAnimationFrame(tick);
}

function waitForNextFrame() {
    if (!running) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        frameResolvers.push(resolve);
    });
}

function releaseResources() {
    [
        backgroundTexture,
        logoTexture,
        labelTexture,
        healthAdviceTexture
    ].forEach((texture) => texture && gl.deleteTexture(texture));

    [
        backgroundBuffer,
        logoBuffer,
        barBuffer,
        labelBuffer,
        healthAdviceBuffer
    ].forEach((buffer) => buffer && gl.deleteBuffer(buffer));

    textureProgram && gl.deleteProgram(textureProgram);
    barProgram && gl.deleteProgram(barProgram);

    gl.useProgram(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function setProgress(value) {
    progress = Math.max(0, Math.min(1, Number(value) || 0));
    return waitForNextFrame();
}

function end() {
    progress = 1;
    return waitForNextFrame().then(() => {
        running = false;
        if (animationFrameHandle !== null) {
            cancelAnimationFrame(animationFrameHandle);
        }
        releaseResources();
    });
}

/**
 * 初始化启动页。
 *
 * 参数签名与 Cocos 生成代码完全一致，game.js 无需做任何修改。
 */
function start(alpha, antialias, useWebgl2) {
    WEBGL_OPTIONS.alpha = alpha === 'true';
    WEBGL_OPTIONS.antialias = antialias !== 'false';

    if (useWebgl2 === 'true') {
        gl = window.canvas.getContext('webgl2', WEBGL_OPTIONS);
    }
    if (gl) {
        window.WebGL2RenderingContext = true;
    } else {
        window.WebGL2RenderingContext = false;
        gl = window.canvas.getContext('webgl', WEBGL_OPTIONS);
    }

    if (!gl) {
        return Promise.reject(new Error('微信启动页无法创建 WebGL Context。'));
    }

    textureProgram = createProgram(TEXTURE_VERTEX_SHADER, TEXTURE_FRAGMENT_SHADER);
    barProgram = createProgram(BAR_VERTEX_SHADER, BAR_FRAGMENT_SHADER);
    backgroundBuffer = createBuffer(buildRectVertices(0, 0, 2, 2));
    logoBuffer = createBuffer(buildRectVertices(0, LOGO_CENTER_Y, 1, 0.3));
    barBuffer = createBuffer(buildRectVertices(0, -0.69, 1.36, 0.04));
    labelBuffer = createBuffer(buildRectVertices(0, -0.69, 0.5, 0.03));
    healthAdviceBuffer = createBuffer(buildRectVertices(0, -0.86, 1.84, 0.18));

    try {
        labelTexture = createLoadingLabelTexture();
        healthAdviceTexture = createHealthAdviceTexture();
    } catch (error) {
        // 文字绘制失败不应阻断引擎启动，错误会保留在微信开发者工具控制台便于定位。
        console.error('微信启动页文字绘制失败。', error);
    }

    running = true;
    tick();

    return Promise.all([
        loadImage(BACKGROUND_FILE).then((image) => {
            backgroundTexture = createTexture(image);
            updateBuffer(backgroundBuffer, buildBackgroundVertices(image));
        }),
        loadImage(LOGO_FILE).then((image) => {
            logoTexture = createTexture(image);
            updateLayout(image);
        })
    ]).then(() => setProgress(0));
}

module.exports = {
    start,
    end,
    setProgress
};
