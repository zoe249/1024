// 比较实际重构前后代码；节点模拟不能替代 Creator 和微信的画面、声音验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const ts = require(process.argv[2] || 'typescript')
const root = path.resolve(__dirname, '..')
const baseline = process.argv[3] || 'b005a5ff247d7a6a8ad8ee03a7e0bcfee6aee826'
const source = (file, before) => before
  ? execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 })
  : fs.readFileSync(path.join(root, file), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const equal = (actual, expected, message) => assert.deepEqual(plain(actual), plain(expected), message)

function environment(before) {
  const trace = []
  let randomState = 1024, randomCalls = 0, wx
  const math = Object.create(Math)
  math.random = () => { randomCalls++; randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 0x100000000 }
  class Color {
    constructor(r = 0, g = 0, b = 0, a = 255) { Object.assign(this, { r, g, b, a }) }
    clone() { return new Color(this.r, this.g, this.b, this.a) }
    static fromHEX(out, hex) { const n = parseInt(hex.replace('#', ''), 16); Object.assign(out, { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 255 }); return out }
  }
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) }
    clone() { return new Vec3(this.x, this.y, this.z) }
    add3f(x, y, z) { this.x += x; this.y += y; this.z += z; return this }
    subtract(v) { return this.add3f(-v.x, -v.y, -v.z) }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this }
    normalize() { const n = Math.hypot(this.x, this.y, this.z); this.x /= n; this.y /= n; this.z /= n; return this }
    static ZERO = new Vec3()
    static ONE = new Vec3(1, 1, 1)
  }
  class Component { isValid = true }
  class UITransform extends Component {
    contentSize = { width: 120, height: 120 }
    setContentSize(width, height) { this.contentSize = { width, height } }
    setAnchorPoint(x, y) { this.anchorPoint = { x, y } }
    get width() { return this.contentSize.width }
    get height() { return this.contentSize.height }
    convertToNodeSpaceAR(v) { return v.clone() }
  }
  class Sprite extends Component { static SizeMode = { CUSTOM: 1 }; static Type = { SIMPLE: 1 } }
  class Label extends Component { static HorizontalAlign = { CENTER: 1 }; static VerticalAlign = { CENTER: 1 }; static Overflow = { SHRINK: 1 } }
  class LabelOutline extends Component {}
  class UIOpacity extends Component { opacity = 255 }
  class ParticleSystem2D extends Component { stopSystem() {} resetSystem() {} }
  class Graphics extends Component {
    ops = []
    clear() { this.ops = [] }
    roundRect(...args) { this.ops.push(['roundRect', ...args]) }
    fill() { this.ops.push(['fill', plain(this.fillColor)]) }
    rect(...args) { this.ops.push(['rect', ...args]) }
    moveTo(...args) { this.ops.push(['moveTo', ...args]) }
    lineTo(...args) { this.ops.push(['lineTo', ...args]) }
    bezierCurveTo(...args) { this.ops.push(['bezierCurveTo', ...args]) }
    stroke() { this.ops.push(['stroke', plain(this.strokeColor), this.lineWidth]) }
  }
  class Node {
    static EventType = {}
    constructor(name = '') { Object.assign(this, { name, children: [], components: [], position: new Vec3(), scale: new Vec3(1, 1, 1), angle: 0, active: true, isValid: true, parent: null }) }
    getChildByName(name) { return this.children.find(n => n.name === name) || null }
    addChild(node) { node.setParent(this) }
    setParent(parent) { this.parent = parent; parent.children.push(this) }
    getComponent(Type) { return this.components.find(c => c instanceof Type) || null }
    addComponent(Type) { const c = new Type(); c.node = this; this.components.push(c); return c }
    setPosition(x, y = 0, z = 0) { this.position = typeof x === 'object' ? x.clone() : new Vec3(x, y, z) }
    setScale(x, y, z) { this.scale = typeof x === 'object' ? x.clone() : new Vec3(x, y, z) }
    setSiblingIndex(index) { const list = this.parent.children; list.splice(list.indexOf(this), 1); list.splice(index, 0, this) }
    getSiblingIndex() { return this.parent?.children.indexOf(this) ?? 0 }
    destroy() { this.isValid = false }
  }
  function tween(target) {
    const ops = []
    const chain = { ops }
    for (const name of ['to', 'by', 'delay', 'sequence', 'parallel', 'repeatForever', 'call']) {
      chain[name] = (...args) => { ops.push([name, ...args.map(a => typeof a === 'function' ? 'callback' : a?.ops ?? plain(a))]); return chain }
    }
    chain.start = () => { trace.push(['start', target?.name ?? target?.node?.name ?? '', plain(ops)]); return chain }
    return chain
  }
  const cc = { _decorator: { ccclass: () => c => c, property: () => () => {} }, Color, Vec3, Vec2: Vec3, Component,
    Node, Sprite, Label, LabelOutline, UIOpacity, ParticleSystem2D, UITransform, Graphics, SpriteFrame: class {}, Prefab: class {}, tween,
    Tween: { stopAllByTarget: target => trace.push(['stop', target?.name ?? target?.node?.name ?? '']) },
    screen: { windowSize: { height: 1625 } }, sys: { getSafeAreaRect: () => ({ y: 0, height: 1580 }) }, view: { getVisibleSize: () => ({ height: 1625 }) } }
  const cache = new Map()
  const enabled = /(?:BaseAppearance|Appearance(?:Types|Catalog|Resolver|AssetLoader|Runtime)|(?:Game|Home|Loading)Appearance|Piece(?:Style|Controller|AppearanceView)|Play(?:Controller|UIController|HudView|Effects)|SkillBarView|HomeLayout|Loading(?:SceneController|LeavesEffect)|Board(?:Model|Geometry|Config)|ScoreManager|TransientFxRegistry)\.ts$/
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }; cache.set(file, module.exports)
    const output = ts.transpileModule(source(file, before), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText
    const globals = { module, exports: module.exports, console, Math: math, require: name => {
      if (name === 'cc') return cc
      const dependency = path.posix.normalize(`${path.posix.dirname(file)}/${name}.ts`)
      return enabled.test(dependency) ? load(dependency) : {}
    } }
    Object.defineProperty(globals, 'wx', { get: () => wx })
    vm.runInNewContext(output, globals, { filename: file })
    cache.set(file, module.exports); return module.exports
  }
  const child = (parent, name) => { const n = new Node(name); n.setParent(parent); n.addComponent(UITransform); return n }
  const snapshot = node => ({ name: node.name, position: node.position, scale: node.scale, angle: node.angle, active: node.active,
    components: node.components.map(c => Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'node'))), children: node.children.map(snapshot) })
  return { cc, load, child, snapshot, trace, randomCalls: () => randomCalls, setWx: value => { wx = value } }
}

if (require.main === module) {
const old = environment(true), current = environment(false)
for (const env of [old, current]) {
  const { Node, Sprite, Label, ParticleSystem2D } = env.cc
  env.piece = () => {
    const { PieceController } = env.load('assets/script/gameplay/PieceController.ts')
    const piece = new PieceController(); piece.node = new Node('Piece'); piece.node.addComponent(env.cc.UITransform)
    for (const name of ['Shadow', 'Body', 'Outline', 'Highlight', 'Decoration']) env.child(piece.node, name).addComponent(Sprite)
    env.child(piece.node, 'Value').addComponent(Label)
    env.child(piece.node, 'TrailEmitter').addComponent(ParticleSystem2D)
    piece.sparkleSpriteFrame = { name: 'sparkle' }; piece.crownSpriteFrame = { name: 'crown' }
    piece.onLoad(); return piece
  }
}
for (const size of [60, 120, 143]) for (const value of [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384]) {
  const snapshots = [old, current].map(env => {
    const p = env.piece(); p.node.getComponent(env.cc.UITransform).setContentSize(size, size * 0.9)
    p.setValue(value); p.syncTrailEffect(true); p.syncLayout(false)
    return { tree: env.snapshot(p.node), value: p.getValue(), body: p.getBackgroundColor(), text: p.getTextColor(), frame: p.getSpriteFrame() }
  })
  equal(snapshots[1], snapshots[0], `棋子 ${value}/${size}`)
}
console.log('棋子：45 组数值/尺寸的图层、字体、装饰、trim、拖尾及公开入口前后相同')

for (const value of [undefined, 2, 4, 8, 16, 32, 64, 128, 256, 512, 8192, 16384]) {
  const snapshots = [old, current].map((env, i) => {
    const label = new env.cc.Label(), tile = new env.cc.Graphics()
    if (i === 0) { const { PlayUIController } = env.load('assets/script/gameplay/PlayUIController.ts'); PlayUIController.prototype.refreshNextPieceDisplay.call({ currentState: { nextValue: value }, nextValueLabel: label, nextValueTile: tile }) }
    else env.load('assets/script/gameplay/PlayHudView.ts').PlayHudView.renderNextPiece(value ?? 2, label, tile)
    return { label, tile }
  })
  equal(snapshots[1], snapshots[0], `预览 ${value}`)
}
console.log('下一颗：基础色阶、高数值回退色、字色字号与圆角绘制前后相同')

for (let columns = 1; columns <= 6; columns++) for (let rows = 1; rows <= 7; rows++) {
  const snapshots = [old, current].map(env => {
    const root = new env.cc.Node('Main'), board = env.child(root, 'board')
    root.addComponent(env.cc.UITransform)
    board.addComponent(env.cc.Sprite); board.addComponent(env.cc.Graphics)
    const fill = env.child(board, 'BoardFill'); fill.getComponent(env.cc.UITransform).setContentSize(columns * 130, rows * 130); fill.addComponent(env.cc.Sprite)
    for (let column = 1; column <= 5; column++) env.child(board, `column${column}`).addComponent(env.cc.Sprite)
    const controller = Object.create(env.load('assets/script/gameplay/PlayUIController.ts').PlayUIController.prototype)
    Object.assign(controller, { node: root, boardwidth: columns, boardheight: rows, pieceSize: 120, spacing: 10 })
    controller.ensureBoardDecorations()
    const result = env.snapshot(root); controller.gameAppearance?.dispose(); return result
  })
  equal(snapshots[1], snapshots[0], `棋盘绘制 ${columns}×${rows}`)
}
console.log('棋盘：42 种尺寸的绘制顺序、透明配色、列占位及唯一绘制入口前后相同')

const loadingSnapshots = [true, false].map(before => {
  const env = environment(before), root = new env.cc.Node('Main')
  root.addComponent(env.cc.UITransform).setContentSize(750, 1334)
  env.child(root, 'Logo')
  const controller = new (env.load('assets/script/loading/LoadingSceneController.ts').LoadingSceneController)()
  Object.assign(controller, { node: root, backgroundSpriteFrame: { name: 'background', originalSize: { width: 750, height: 1625 } }, leafSpriteFrame: { name: 'leaf' }, scheduleOnce: fn => fn() })
  env.cc.director = { preloadScene() {} }
  controller.onLoad(); controller.start()
  return { tree: env.snapshot(root), trace: env.trace }
})
equal(loadingSnapshots[1], loadingSnapshots[0], '默认加载页完整节点及入场动画')
console.log('加载页：默认节点、文案、进度条笔触/配色、背景适配与入场 Tween 参数前后相同')

for (const legacyBox of [false, true]) for (const count of [0, 1, 3]) for (const used of [false, true]) for (const active of [null, 'bomb']) for (const loading of [null, 'bomb']) {
  const snapshots = [true, false].map(before => {
    const env = environment(before), node = new env.cc.Node('BombSkill')
    for (const name of ['SelectionRing', 'UsedLabel']) env.child(node, name)
    const box = legacyBox ? env.child(node, 'Box') : node
    for (const name of ['MoreBtn', 'AmountBG', 'Count']) env.child(box, name)
    const badge = env.child(node, 'CountBadge'); badge.addComponent(env.cc.Graphics)
    env.child(badge, 'Value').addComponent(env.cc.Label)
    env.child(badge, 'AdIcon'); env.child(badge, 'AdLoading')
    const state = { activeSkill: active, skillCounts: { bomb: count }, skillUsed: { bomb: used }, skillAdAvailable: { bomb: !used }, skillAdLoading: loading }
    let key = ''
    if (before) {
      const controller = Object.create(env.load('assets/script/gameplay/PlayUIController.ts').PlayUIController.prototype)
      Object.assign(controller, { currentState: state, skillVisualKeys: { bomb: '' }, counterNumberSpriteFrames: [] })
      for (let i = 0; i < 3; i++) { controller.refreshSingleSkillVisual('bomb', node); controller.refreshSingleSkillCount('bomb', node) }
      key = controller.skillVisualKeys.bomb
    } else {
      const { SkillBarView } = env.load('assets/script/gameplay/SkillBarView.ts')
      for (let i = 0; i < 3; i++) { key = SkillBarView.renderSelection('bomb', node, state, key); SkillBarView.renderCount('bomb', node, state, []) }
    }
    return { tree: env.snapshot(node), trace: env.trace, key }
  })
  equal(snapshots[1], snapshots[0], `技能栏 ${legacyBox}/${count}/${used}/${active}/${loading}`)
}
console.log('技能栏：48 组状态、历史 Box 层级、广告/次数/加载角标及连续三次渲染的 Tween 去重前后相同')

const beforeLeaves = new (old.load('assets/script/loading/LoadingSceneController.ts').LoadingSceneController)()
beforeLeaves.leafLayer = new old.cc.Node('LeafLayer'); beforeLeaves.leafSpriteFrame = { name: 'leaf' }; beforeLeaves.createLeafParticles()
const afterLayer = new current.cc.Node('LeafLayer')
const afterLeaves = new (current.load('assets/script/loading/LoadingLeavesEffect.ts').LoadingLeavesEffect)(afterLayer, { name: 'leaf' })
afterLeaves.initialize()
equal(current.snapshot(afterLayer), old.snapshot(beforeLeaves.leafLayer), '叶片初始状态')
for (let frame = 0; frame < 900; frame++) {
  const dt = frame % 50 === 0 ? 0.4 : 1 / 60
  beforeLeaves.update(dt); afterLeaves.update(dt)
  equal(current.snapshot(afterLayer), old.snapshot(beforeLeaves.leafLayer), `叶片第 ${frame} 帧`)
}
for (const n of afterLayer.children) { n.isValid = false; n.components.forEach(c => { c.isValid = false; c.node = null }) }
afterLeaves.dispose(); afterLeaves.dispose()
console.log('飘叶：24 个粒子的初态及 900 帧位置/旋转/缩放/透明度相同；子节点销毁后重复释放通过')

for (const [width, height] of [[750, 1334], [750, 1625], [750, 2100], [600, 1100], [1200, 2400]]) for (const wechat of [false, true]) {
  const snapshots = [old, current].map((env, i) => {
    const rootNode = new env.cc.Node('HomepageArtwork')
    const bindings = { homepageLayerNode: rootNode }
    for (const key of ['settingsButtonNode', 'coinResourceButtonNode', 'energyBarNode', 'profileButtonNode', 'dailyRewardButtonNode', 'rankButtonNode', 'shopButtonNode', 'shareButtonNode', 'startButtonNode']) bindings[key] = env.child(rootNode, key)
    env.child(rootNode, 'HomepageBackground'); env.child(rootNode, 'HomepageLogo')
    env.setWx(wechat ? { getMenuButtonBoundingClientRect: () => ({ top: 42, bottom: 74, width: 87, height: 32 }), getWindowInfo: () => ({ windowHeight: 812, screenTop: 0 }) } : undefined)
    if (i === 0) {
      const file = 'assets/script/home/StartPageController.ts'
      // 首页只需读取布局方法，模块中的业务依赖不参与本夹具。
      const output = ts.transpileModule(source(file, true), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText
      const module = { exports: {} }
      const globals = { module, exports: module.exports, require: name => name === 'cc' ? env.cc : {}, console }
      if (wechat) globals.wx = { getMenuButtonBoundingClientRect: () => ({ top: 42, bottom: 74, width: 87, height: 32 }), getWindowInfo: () => ({ windowHeight: 812, screenTop: 0 }) }
      vm.runInNewContext(output, globals)
      const controller = Object.create(module.exports.StartPageController.prototype)
      Object.assign(controller, bindings, { renderPlayerResources() {} }); controller.layoutHomepageArtwork(width, height)
    } else new (env.load('assets/script/home/HomeLayout.ts').HomeLayout)().layout(width, height, bindings)
    return env.snapshot(rootNode)
  })
  equal(snapshots[1], snapshots[0], `首页布局 ${width}×${height}/${wechat}`)
}
console.log('首页：10 组普通屏/长屏及微信胶囊/系统安全区布局前后相同')

for (const method of ['spawnSkillShatterParticles', 'spawnBombShockwave', 'spawnUpgradeImpact', 'spawnMergeFlash', 'spawnMergeBurst']) {
  const snapshots = [true, false].map(before => {
    const env = environment(before), parent = new env.cc.Node('FxLayer')
    const registry = new (env.load('assets/script/gameplay/TransientFxRegistry.ts').TransientFxRegistry)(18)
    const piece = { getSpriteFrame: () => ({ name: 'body' }), getBackgroundColor: () => new env.cc.Color(110, 88, 170) }
    const position = new env.cc.Vec3(130, -260, 0)
    let effects
    if (before) { effects = Object.create(env.load('assets/script/gameplay/PlayController.ts').PlayController.prototype); Object.assign(effects, { transientFx: registry, pieceSize: 120, getFxLayer: () => parent }) }
    else effects = new (env.load('assets/script/gameplay/PlayEffects.ts').PlayEffects)(registry, 120, () => parent)
    if (method === 'spawnSkillShatterParticles') effects[method](piece, position, 14, 1.1)
    else if (method === 'spawnBombShockwave') effects[method](position, 9)
    else effects[method](piece, position, 3)
    return { tree: env.snapshot(parent), trace: env.trace, randomCalls: env.randomCalls() }
  })
  equal(snapshots[1], snapshots[0], method)
}
console.log('临时特效：五种表现的节点、主体贴图/颜色、随机调用数、Tween 参数和启动顺序前后相同')

const cleanupEnv = environment(false)
const { BoardModel } = cleanupEnv.load('assets/script/gameplay/BoardModel.ts')
const { PlayEffects } = cleanupEnv.load('assets/script/gameplay/PlayEffects.ts')
const alivePiece = { isValid: true, node: new cleanupEnv.cc.Node('AlivePiece') }
alivePiece.node.addComponent(cleanupEnv.cc.UIOpacity)
const clearedPiece = { isValid: false, node: null }
const cleanupBoard = [[alivePiece, clearedPiece]]
new BoardModel().destroyBoardPieces(cleanupBoard, 1, 2, PlayEffects.destroyPiece)
new BoardModel().destroyBoardPieces(cleanupBoard, 1, 2, PlayEffects.destroyPiece)
equal(cleanupBoard, [[null, null]])
assert.equal(alivePiece.node.isValid, false)
console.log('棋盘清理：表现侧停止动画并销毁；组件字段已清空及重复清空通过')

// 保证此次没有借拆分修改合并、技能、暂停、续局、结算或经济操作。
const playFile = 'assets/script/gameplay/PlayController.ts'
const methods = before => {
  const ast = ts.createSourceFile(playFile, source(playFile, before), ts.ScriptTarget.Latest, true)
  return new Map(ast.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'PlayController').members.filter(ts.isMethodDeclaration).map(n => [n.name.getText(ast), n.getText(ast)]))
}
const changed = new Set(['onLoad', 'onDestroy', 'clearBoardPieces', 'spawnSkillShatterParticles', 'spawnBombShockwave', 'spawnUpgradeImpact', 'spawnMergeFlash', 'spawnMergeBurst', 'createFxPiece', 'instantiateSnapshotPiece', 'spawnPiece', 'restartGame'])
const oldMethods = methods(true), newMethods = methods(false)
for (const [name, text] of oldMethods) if (!changed.has(name)) assert.equal(newMethods.get(name), text, `玩法方法 ${name} 必须保持原实现`)
const changedAssets = execFileSync('git', ['-c', 'core.safecrlf=false', 'diff', '--name-only', baseline, '--', 'assets'], { cwd: root, encoding: 'utf8' }).trim().split('\n')
const existingAssets = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'assets'], { cwd: root, encoding: 'utf8' }).trim().split('\n'))
assert.ok(!changedAssets.some(f => existingAssets.has(f) && /\.(scene|prefab|meta)$/.test(f)), '既有序列化资源不得变化')
for (const file of ['gameplay/PieceController', 'gameplay/PlayController', 'gameplay/PlayUIController', 'home/HomeSceneController', 'home/StartPageController', 'loading/LoadingSceneController', 'settlement/GameOverOverlayController']) {
  const declarations = before => {
    const ast = ts.createSourceFile(file, source(`assets/script/${file}.ts`, before), ts.ScriptTarget.Latest, true)
    return ast.statements.filter(ts.isClassDeclaration).map(c => ({ name: c.name.text,
      decorators: c.modifiers?.filter(ts.isDecorator).map(d => d.getText(ast)) ?? [],
      properties: c.members.filter(m => ts.isPropertyDeclaration(m) && m.modifiers?.some(ts.isDecorator)).map(m => m.getText(ast)) }))
  }
  equal(declarations(false), declarations(true), `${file} 的序列化契约`)
}
for (const name of ['instantiateSnapshotPiece', 'spawnPiece', 'restartGame']) {
  const strip = text => text.replace(/^    if \(this\.gameAppearance\) pieceController\.applyAppearance[^\n]+\n/gm, '').replace(/^    const previousAppearance = this\.gameAppearance\n    this\.gameAppearance = new GameAppearance\(previousAppearance\?\.lease\.retain\(\) \?\? appearanceRuntime\.acquireBase\('game'\)\)\n    previousAppearance\?\.dispose\(\)\n/gm, '')
  assert.equal(strip(newMethods.get(name)), oldMethods.get(name), name + ' 的原玩法必须保留')
}
console.log('玩法方法及既有 Scene/Prefab/meta 保持基线；Creator/微信实际渲染、声音和触摸尚需运行验收')

async function verifyPopupOwnership() {
  const env = environment(false), { Node, Component } = env.cc
  const pending = []
  class Popup extends Component { setup(options) { this.options = options } syncLayout() {} hide() {} onDestroy() { this.releases = (this.releases ?? 0) + 1 } }
  const dependencies = {
    '../skill-shop/SkillShopPopupController': { SkillShopPopupController: Popup },
    '../daily-reward/DailyRewardPopupController': { DailyRewardPopupController: Popup },
    '../settings/PauseOverlayController': { PauseOverlayController: Popup },
    '../online/auth/LoginStatusController': { LoginStatusController: Popup },
    '../profile/ProfilePopupController': { ProfilePopupController: Popup }
  }
  const cc = { ...env.cc, resources: { load: (...args) => pending.push(args[2]) }, instantiate: () => new Node('Popup') }
  const module = { exports: {} }
  const output = ts.transpileModule(source('assets/script/home/HomePopupHost.ts', false), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(output, { module, exports: module.exports, require: name => name === 'cc' ? cc : dependencies[name], console })
  const { HomePopupHost } = module.exports
  // 销毁后清空数组、对象和函数字段，确保宿主不再访问已经被清空的组件。
  function destroyTree(node) {
    for (const child of node.children) destroyTree(child)
    for (const c of node.components) {
      c.onDestroy?.(); c.isValid = false
      for (const key of Object.keys(c)) if (typeof c[key] === 'object' || typeof c[key] === 'function') c[key] = null
    }
    node.isValid = false
    node.children = null; node.components = null
  }
  for (const childrenFirst of [false, true]) {
    const root = new Node('Home'); root.addComponent(env.cc.UITransform)
    let valid = true
    const host = new HomePopupHost(root, () => { assert.ok(valid, '释放后不可再访问宿主字段'); return true })
    const shop = host.ensureSkillShop({}, {}), daily = host.ensureDailyReward({}, {}), settings = host.ensureSettings({}), login = host.ensureLoginStatus()
    const popupNodes = [...root.children]
    assert.equal(host.ensureSkillShop({}, {}), shop)
    const promise = host.ensureProfile({})
    assert.equal(host.ensureProfile({}), promise, '合并并发资料加载')
    const rejected = assert.rejects(promise, /个人中心预制件加载失败/)
    if (childrenFirst) destroyTree(root)
    valid = false
    host.dispose(); host.dispose()
    if (!childrenFirst) for (const node of popupNodes) destroyTree(node)
    await rejected
    pending.shift()(null, {})
    for (const name of ['skillShop', 'dailyReward', 'homeSettings', 'loginStatus', 'profile']) assert.equal(host[name], null)
    assert.throws(() => host.ensureSettings({}), /宿主已释放/)
    for (const popup of [shop, daily, settings, login]) assert.equal(popup.releases, 1)
  }
  const root = new Node('Home'), host = new HomePopupHost(root, () => true)
  const failed = host.ensureProfile({}), failedResult = assert.rejects(failed, /个人中心预制件加载失败/)
  pending.shift()(new Error('fixture')); await failedResult
  const retry = host.ensureProfile({}); pending.shift()(null, {}); await retry
  assert.ok(host.profile); host.dispose(); host.dispose()
  console.log('首页弹窗：实例复用、并发加载合并、失败重试、父组件单独移除、子组件字段清空、晚到资源及重复释放通过')
}
verifyPopupOwnership().catch(error => { console.error(error); process.exitCode = 1 })

}
module.exports = { environment }
