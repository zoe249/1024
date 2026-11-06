// 验证闯关规则、静态引用与生命周期；节点模拟不能代替 Creator／微信真机验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.argv[2] || 'typescript')
const root = path.resolve(__dirname, '..')
const plain = value => JSON.parse(JSON.stringify(value))
const equal = (a, b, message) => assert.deepEqual(plain(a), plain(b), message)

function run(loose) {
  const cache = new Map(), memory = new Map(), switches = [], animationTrace = []
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) }
    clone() { return new Vec3(this.x, this.y, this.z) }
    add3f(x, y, z) { this.x += x; this.y += y; this.z += z; return this }
    static ONE = new Vec3(1, 1, 1)
    static ZERO = new Vec3()
    static lerp(out, a, b, t) { Object.assign(out, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 }); return out }
  }
  class Color {
    constructor(r = 0, g = 0, b = 0, a = 255) {
      if (typeof r === 'string') { const value = parseInt(r.slice(1), 16); b = value & 255; g = (value >> 8) & 255; r = value >> 16 }
      Object.assign(this, { r, g, b, a })
    }
    clone() { return new Color(this.r, this.g, this.b, this.a) }
    static WHITE = new Color(255, 255, 255)
  }
  class Component {
    isValid = true; enabledInHierarchy = true; scheduled = []
    getComponent(Type) { return this.node.getComponent(Type) }
    scheduleOnce(callback) { this.scheduled.push(callback) }
    unscheduleAllCallbacks() { this.scheduled = [] }
  }
  class Node {
    static EventType = { TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel' }
    constructor(name = '') { Object.assign(this, { name, isValid: true, active: true, children: [], components: [], position: new Vec3(), scale: new Vec3(1, 1, 1), listeners: [] }) }
    setParent(parent) { this.parent = parent; parent.children.push(this) }
    setPosition(x, y, z = 0) { this.position = typeof x === 'object' ? x.clone() : new Vec3(x, y, z) }
    setScale(x, y, z) { this.scale = typeof x === 'object' ? x.clone() : new Vec3(x, y, z) }
    get worldScale() { const p = this.parent?.worldScale ?? Vec3.ONE; return new Vec3(this.scale.x * p.x, this.scale.y * p.y, 1) }
    get worldPosition() { const p = this.parent?.worldPosition ?? new Vec3(), s = this.parent?.worldScale ?? Vec3.ONE; return new Vec3(p.x + this.position.x * s.x, p.y + this.position.y * s.y, 0) }
    addComponent(Type) { const c = new Type(); c.node = this; this.components.push(c); return c }
    setSiblingIndex(index) { const list = this.parent.children; list.splice(list.indexOf(this), 1); list.splice(index, 0, this) }
    getComponent(Type) { return this.components.find(c => c instanceof Type) || null }
    getChildByName(name) { return this.children.find(node => node.name === name) || null }
    getComponentsInChildren(Type) { return this.components.filter(c => c instanceof Type).concat(...this.children.map(c => c.getComponentsInChildren(Type))) }
    on(...args) { this.listeners.push(args) }
    off(event, callback, target) { this.listeners = this.listeners.filter(args => args[0] !== event || args[1] !== callback || args[2] !== target) }
    destroy() { this.children.forEach(n => n.destroy()); this.components.forEach(c => { c.isValid = false }); this.isValid = false }
    destroyAllChildren() { this.children.forEach(n => n.destroy()); this.children = [] }
  }
  class Label extends Component { static HorizontalAlign = { CENTER: 1 }; static VerticalAlign = { CENTER: 1 }; static Overflow = { SHRINK: 1 }; string = '' }
  class Sprite extends Component { static SizeMode = { CUSTOM: 1 }; static Type = { SIMPLE: 0, FILLED: 3 }; static FillType = { HORIZONTAL: 0 }; color = new Color() }
  class UIOpacity extends Component { opacity = 255 }
  class AudioSource extends Component { playOneShot(clip) { animationTrace.push(['sound', clip]) } }
  class Button extends Component { static EventType = { CLICK: 'click' } }
  class UITransform extends Component {
    contentSize = { width: 112, height: 112 }
    anchorX = .5; anchorY = .5
    get width() { return this.contentSize.width }
    get height() { return this.contentSize.height }
    setContentSize(width, height) { this.contentSize = { width, height } }
    setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y }
    convertToNodeSpaceAR(v) { const p = this.node.worldPosition, s = this.node.worldScale; return new Vec3((v.x - p.x) / s.x, (v.y - p.y) / s.y, 0) }
  }
  class Graphics extends Component {
    static LineCap = { ROUND: 1 }
    rectangles = []
    clear() { this.rectangles = [] }
    rect(x, y, width, height) { this.pendingRect = { x, y, width, height } }
    fill() { if (this.pendingRect) { this.rectangles.push({ ...this.pendingRect, color: this.fillColor.clone() }); this.pendingRect = null } }
  }
  for (const name of ['moveTo', 'lineTo', 'close', 'stroke', 'ellipse', 'circle', 'bezierCurveTo']) Graphics.prototype[name] = function() {}
  function tween(target) {
    const chain = { ops: [] }
    for (const name of ['to', 'delay', 'sequence', 'parallel', 'call']) chain[name] = (...args) => { chain.ops.push([name, ...args]); return chain }
    chain.start = () => { animationTrace.push(['tween', target, chain.ops]); return chain }
    return chain
  }
  const cc = { _decorator: { ccclass: () => c => c, property: () => () => {}, executeInEditMode: c => c },
    Node, Component, Color, Vec3, Label, Sprite, Button, UIOpacity, AudioSource, AudioClip: class {}, SpriteFrame: class {}, UITransform, Graphics, Prefab: class {}, tween,
    resources: { load() { throw Error('静态设置预制件不应再次动态加载美术') } },
    Tween: Object.fromEntries(['stopAllByTarget', 'pauseAllByTarget', 'resumeAllByTarget'].map(name => [name, target => animationTrace.push([name, target])])),
    view: { on() {}, off() {}, getVisibleSize: () => ({ width: 750, height: 1334 }) },
    screen: { windowSize: { width: 750, height: 1334 } }, sys: { localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }, getSafeAreaRect: () => ({ y: 0, height: 1334 }) },
    director: { preloadScene() {}, loadScene: (name, callback) => { switches.push(name); return true } }, instantiate: prefab => deserialize(prefab)[1] }
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }; cache.set(file, module.exports)
    const input = fs.readFileSync(file, 'utf8')
    let output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText
    if (loose) {
      const engineModules = path.resolve(path.dirname(require.resolve(`${process.argv[2] || 'typescript'}/package.json`)), '../../../resources/3d/engine/node_modules')
      output = require(path.join(engineModules, '@babel/core')).transformSync(output, { configFile: false, babelrc: false, plugins: [[require(path.join(engineModules, '@babel/plugin-transform-spread')), { loose: true }]] }).code
    }
    vm.runInNewContext(output, { module, exports: module.exports, console, require: name => name === 'cc' ? cc : load(path.resolve(path.dirname(file), name + '.ts')) }, { filename: file })
    return module.exports
  }
  const base = path.join(root, 'assets/script/level')
  const rules = load(path.join(base, 'LevelRules.ts')), { LEVELS } = load(path.join(base, 'LevelCatalog.ts'))
  const types = { 'cc.Node': Node, 'cc.Label': Label, 'cc.Sprite': Sprite, 'cc.Button': Button, 'cc.UITransform': UITransform, 'cc.Graphics': Graphics, 'cc.UIOpacity': UIOpacity, 'cc.AudioSource': AudioSource }
  const compact = uuid => {
    const h = uuid.replaceAll('-', ''), table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    let s = h.slice(0, 5)
    for (let i = 5; i < 32; i += 3) { const n = parseInt(h.slice(i, i + 3), 16); s += table[n >> 6] + table[n & 63] }
    return s
  }
  const assets = new Map()
  const settingsPath = path.join(root, 'assets/resources/base/Settings')
  for (const file of fs.readdirSync(settingsPath).filter(file => file.endsWith('.png.meta'))) {
    const meta = JSON.parse(fs.readFileSync(path.join(settingsPath, file)))
    assets.set(meta.subMetas.f9941.uuid, Object.assign(new cc.SpriteFrame(), { name: file.slice(0, -9) }))
  }
  const { PauseOverlayController } = load(path.join(root, 'assets/script/settings/PauseOverlayController.ts'))
  types[compact(JSON.parse(fs.readFileSync(path.join(root, 'assets/script/settings/PauseOverlayController.ts.meta'))).uuid)] = PauseOverlayController
  for (const file of ['LevelPieceController', 'LevelIceView', 'LevelSceneController', 'LevelEntryController', 'LevelColumnHighlight']) {
    types[compact(JSON.parse(fs.readFileSync(path.join(base, file + '.ts.meta'))).uuid)] = load(path.join(base, file + '.ts'))[file]
  }
  for (const file of ['LevelPiece', 'LevelIce']) assets.set(JSON.parse(fs.readFileSync(path.join(root, `assets/prefab/level/${file}.prefab.meta`))).uuid, JSON.parse(fs.readFileSync(path.join(root, `assets/prefab/level/${file}.prefab`))))
  function deserialize(data) {
    const objects = data.map(o => types[o.__type__] ? new types[o.__type__](o._name) : {})
    function resolve(v) { return v && typeof v === 'object' ? v.__id__ !== undefined ? objects[v.__id__] : v.__uuid__ ? assets.get(v.__uuid__) || {} : Array.isArray(v) ? v.map(resolve) : v : v }
    data.forEach((o, i) => {
      const obj = objects[i]
      if (obj instanceof Node) { obj.name = o._name; obj.active = o._active; obj.children = o._children.map(v => objects[v.__id__]); obj.components = o._components.map(v => objects[v.__id__]); obj.position = new Vec3(o._lpos.x, o._lpos.y, o._lpos.z); obj.scale = new Vec3(o._lscale.x, o._lscale.y, 1); obj.children.forEach(c => { c.parent = obj }) }
      if (obj instanceof UITransform) obj.setContentSize(o._contentSize.width, o._contentSize.height)
      if (obj instanceof Sprite) { obj.spriteFrame = resolve(o._spriteFrame); const c = o._color; obj.color = new Color(c.r, c.g, c.b, c.a) }
      for (const [key, value] of Object.entries(o)) if (!key.startsWith('_') && key !== 'node') obj[key] = resolve(value)
      if (o.node) obj.node = resolve(o.node)
    })
    return objects
  }
  const native = require('./verify-refactor.cjs').environment(false)
  const { PieceAppearanceView } = native.load('assets/script/gameplay/PieceAppearanceView.ts')
  const referenceNode = new native.cc.Node('Piece')
  referenceNode.addComponent(native.cc.UITransform).setContentSize(112, 112)
  for (const name of ['Shadow', 'Body', 'Outline', 'Highlight', 'Decoration']) native.child(referenceNode, name).addComponent(native.cc.Sprite)
  const referenceLabel = native.child(referenceNode, 'Value').addComponent(native.cc.Label)
  const referenceView = new PieceAppearanceView(referenceNode, null, null); referenceView.initialize()
  const { LevelPieceController } = load(path.join(base, 'LevelPieceController.ts'))
  const prefabData = name => assets.get(JSON.parse(fs.readFileSync(path.join(root, `assets/prefab/level/${name}.prefab.meta`))).uuid)
  const pieceView = deserialize(prefabData('LevelPiece'))[1].getComponent(LevelPieceController)
  const textStyle = label => ({ color: label.color, fontSize: label.fontSize, lineHeight: label.lineHeight, spacingX: label.spacingX,
    outlineColor: label.outlineColor, outlineWidth: label.outlineWidth, isBold: label.isBold, position: label.node.position })
  for (const value of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384]) {
    referenceView.setValue(value); referenceView.syncLayout(true); pieceView.setValue(value)
    equal(pieceView.body.color, referenceView.getBackgroundColor(), '棋子色阶与无尽一致')
    equal(textStyle(pieceView.valueLabel), textStyle(referenceLabel), '数字字色、尺寸、间距、轮廓与偏移均对齐')
    equal(pieceView.outline.color, referenceNode.getChildByName('Outline').getComponent(native.cc.Sprite).color)
  }
  const paths = [[0, 4, 4], [0, 3, 0, 3, 4], [0, 3, 0, 3, 4, 0, 0, 2]]
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i]
    let state = rules.createLevelState(level)
    for (const column of paths[i]) { const result = rules.dropInColumn(level, state, column); assert.ok(result); state = result.state }
    assert.equal(state.status, 'won', `第${i + 1}关必须有可通关样例`)
    assert.equal(state.board[0][0], i === 2 ? -1 : state.board[0][0])
  }
  const special = { ...LEVELS[0], board: rules.emptyMatrix(), goals: [{ value: 4, count: 1 }, { value: 8, count: 1 }], sequence: [2] }
  special.board[0][0] = 2; special.board[0][2] = 2
  const multi = rules.dropInColumn(special, rules.createLevelState(special), 1)
  equal(multi.state.collected, [0, 1], '三颗2直接产出8，不虚构4')
  const full = rules.createLevelState(LEVELS[0])
  for (let row = 0; row < 7; row++) full.board[row][0] = row % 2 ? 4 : 2
  const before = plain(full)
  assert.equal(rules.dropInColumn(LEVELS[0], full, 0), null)
  equal(full, before, '点满列不推进出子或修改盘面')
  assert.equal(rules.dropInColumn(LEVELS[0], full, 5), null)
  const almostFull = rules.createLevelState(LEVELS[0])
  almostFull.board = Array.from({ length: 7 }, (_, row) => Array.from({ length: 5 }, (_, col) => (row + col) % 2 ? 4 : 8))
  almostFull.board[6][4] = 0
  assert.equal(rules.dropInColumn(LEVELS[0], almostFull, 4).state.status, 'lost', '完整结算后满盘且目标未达成才失败')
  const { LevelProgressStore } = load(path.join(base, 'LevelProgressStore.ts'))
  LevelProgressStore.save(multi.state)
  const checkpoint = rules.dropInColumn(LEVELS[0], rules.createLevelState(LEVELS[0]), 0).state
  LevelProgressStore.save(checkpoint)
  equal(LevelProgressStore.restore(1), checkpoint, '稳定检查点完整恢复')
  const scene = JSON.parse(fs.readFileSync(path.join(root, 'assets/scence/level.scene')))
  const { LevelSceneController } = load(path.join(base, 'LevelSceneController.ts'))
  const objects = deserialize(scene), controller = objects.find(o => o instanceof LevelSceneController)
  const emit = (node, type, event = {}) => { for (const [name, callback, target] of [...node.listeners]) if (name === type) callback.call(target, event) }
  const countNodes = node => 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
  const staticSettingsNodes = countNodes(controller.settingsOverlay)
  memory.clear(); controller.onLoad(); controller.start()
  const settings = controller.pauseOverlay
  assert.ok(settings instanceof PauseOverlayController, '闯关复用现有设置组件')
  assert.equal(countNodes(settings.node), staticSettingsNodes, '设置层级完整静态维护，启动不补建节点')
  const settingPrefab = JSON.parse(fs.readFileSync(path.join(settingsPath, 'SettingsPopup.prefab.meta'))).uuid
  equal(scene[scene[objects.indexOf(controller.settingsOverlay)]._prefab.__id__].asset.__uuid__, settingPrefab, '场景设置节点保持预制件引用')
  assert.ok(!objects.some(object => object.name === 'ResumeButton'), '移除原来重复搭建的暂停面板')
  settings.setSoundEffectVolume(.3)
  assert.equal(controller.effectAudio.volume, .3, '设置滑块直接控制闯关音效通道')
  assert.equal(memory.get('play.audio.soundEffectVolume'), '0.3', '沿用现有声音设置存档键')
  emit(controller.pauseButton.node, Button.EventType.CLICK)
  assert.equal(controller.paused, true); assert.equal(settings.node.active, true)
  const closeEvent = {}
  emit(settings.closeButtonNode, Node.EventType.TOUCH_END, closeEvent)
  assert.equal(closeEvent.propagationStopped, true); assert.equal(controller.paused, false, '关闭设置恢复闯关')
  emit(controller.pauseButton.node, Button.EventType.CLICK)
  controller.state.cursor = 2
  emit(settings.replayButtonNode, Node.EventType.TOUCH_END)
  assert.equal(controller.state.cursor, 0, '设置重玩按钮重开当前关卡'); assert.equal(controller.paused, false)
  assert.equal(controller.effectAudio.volume, .3, '重开保留音量设置')
  const { LevelColumnHighlight } = load(path.join(base, 'LevelColumnHighlight.ts'))
  assert.ok(!objects.some(object => object.name === 'LandingMarker'), '只保留列高光，不再出现棋子落点框')
  assert.equal(controller.columnHighlight.children.length, 0, '列光带不包含边线或封口装饰')
  const band = controller.columnHighlight.getComponent(LevelColumnHighlight)
  band.onEnable()
  const gradient = controller.columnHighlight.getComponent(Graphics).rectangles
  const centerAlpha = Math.max(...gradient.map(rect => rect.color.a))
  const edgeAlpha = Math.max(...gradient.filter(rect => Math.abs(rect.x + rect.width / 2) > 55).map(rect => rect.color.a))
  const endAlpha = Math.max(...gradient.filter(rect => Math.abs(rect.y + rect.height / 2) > 410).map(rect => rect.color.a))
  assert.ok(centerAlpha === 112 && edgeAlpha < centerAlpha / 4 && endAlpha < centerAlpha / 4, '光带增强至44%不透明度，四周仍平滑渐隐')
  band.onEnable(); assert.equal(controller.columnHighlight.getComponent(Graphics).rectangles, gradient, '再次显示不重复生成几何')
  const initialBoard = plain(controller.state.board)
  for (let i = 0; i < 120; i++) controller.update(1 / 60)
  equal(controller.state.board, initialBoard, '等待时不自动下落')
  const touch = (column, id = 1, y = 0) => ({ getID: () => id, getUILocation: () => ({ x: controller.boardRoot.worldPosition.x + (column - 2) * 122 * controller.boardRoot.worldScale.x, y: controller.boardRoot.worldPosition.y + y * controller.boardRoot.worldScale.y }) })
  const release = column => { controller.onBoardTouchStart(touch(column)); controller.onBoardTouchEnd(touch(column)) }
  const noDrop = () => { assert.equal(controller.plan, null); equal(controller.state.board, initialBoard) }
  controller.onBoardTouchEnd(touch(0)); noDrop()
  controller.onBoardTouchStart(touch(1, 11)); controller.update(2); noDrop()
  assert.equal(controller.columnHighlight.active, true); assert.equal(controller.columnHighlight.position.x, -122)
  controller.onBoardTouchMove(touch(3, 11)); noDrop()
  assert.equal(controller.selectedColumn, 3); assert.equal(controller.columnHighlight.position.x, 122)
  controller.onBoardTouchStart(touch(0, 22)); controller.onBoardTouchMove(touch(0, 22))
  controller.onBoardTouchEnd(touch(0, 22)); controller.onBoardTouchCancel(touch(0, 22))
  assert.equal(controller.activeTouchId, 11); assert.equal(controller.selectedColumn, 3); noDrop()
  controller.onBoardTouchMove(touch(6, 11)); assert.equal(controller.columnHighlight.active, false)
  controller.onBoardTouchMove(touch(4, 11)); assert.equal(controller.columnHighlight.active, true)
  controller.onBoardTouchEnd(touch(4, 11, 500)); noDrop(); assert.equal(controller.columnHighlight.active, false)
  controller.onBoardTouchStart(touch(0)); controller.onBoardTouchCancel(touch(0)); controller.onBoardTouchEnd(touch(0)); noDrop()
  controller.onBoardTouchStart(touch(0)); controller.setPaused(true)
  assert.equal(controller.columnHighlight.active, false)
  controller.onBoardTouchEnd(touch(0)); controller.setPaused(false); controller.onBoardTouchEnd(touch(0)); noDrop()
  controller.onBoardTouchStart(touch(0)); controller.enabledInHierarchy = false; controller.onDisable()
  controller.onBoardTouchStart(touch(1)); controller.onBoardTouchEnd(touch(1)); noDrop()
  controller.enabledInHierarchy = true
  controller.state.board[6][4] = 16
  const fullColumnState = plain(controller.state)
  controller.onBoardTouchStart(touch(4)); assert.equal(controller.columnHighlight.active, true)
  controller.onBoardTouchEnd(touch(4)); assert.equal(controller.plan, null); equal(controller.state, fullColumnState, '满列松手不消耗棋子')
  controller.startLevel(1, false)
  controller.onBoardTouchStart(touch(0)); controller.onBoardTouchMove(touch(1)); controller.onBoardTouchEnd(touch(4))
  assert.equal(controller.plan.events[0].cell.column, 4, '按松手位置落列，不沿用较早的拖动位置')
  assert.equal(controller.columnHighlight.active, false)
  const committedPlan = controller.plan
  controller.onBoardTouchEnd(touch(4)); assert.equal(controller.plan, committedPlan, '一次松手仅提交一次')
  controller.startLevel(1, false)
  controller.onBoardTouchStart(touch(0)); controller.startLevel(1, false); controller.onBoardTouchEnd(touch(0)); noDrop()
  console.log('选列交互通过：按住预览、拖动换列、松手提交、越界／取消／暂停／停用／重开、多指隔离及满列保护')
  for (let i = 0; i < paths[0].length; i++) {
    release(paths[0][i]); assert.ok(controller.plan)
    if (i === 0) {
      const motion = controller.motions[0], half = controller.duration / 2
      controller.update(half)
      assert.ok(Math.abs(motion.node.position.y - (motion.from.y + motion.to.y) / 2) < .001, '快速落子保持无尽版匀速')
      controller.update(half)
      assert.equal(controller.plan.events[controller.eventIndex].kind, 'merge')
      const consumed = controller.mergeVisuals[0].consumed[0]
      controller.update(.11)
      assert.equal(consumed.piece.node.position.x, consumed.origin.x, '被消除棋子保持原列，不飞向锚点')
      assert.ok(consumed.opacity.opacity < 255 && consumed.opacity.opacity > 0)
      assert.equal(controller.mergeVisuals[0].anchor.getValue(), controller.mergeVisuals[0].event.value, '0.1秒后已升级，不等消除完全结束')
      assert.ok(controller.mergeVisuals[0].anchor.node.scale.x > 1, '升级同步舒展')
    }
    const cursor = controller.state.cursor
    release(2); assert.equal(controller.state.cursor, cursor, '动画中重复点击无效')
    controller.setPaused(true); const elapsed = controller.elapsed; controller.update(1); assert.equal(controller.elapsed, elapsed)
    if (i === 0) assert.ok(animationTrace.some(item => item[0] === 'pauseAllByTarget'), '暂停同步冻结特效')
    controller.setPaused(false)
    for (let frame = 0; frame < 600 && controller.plan; frame++) controller.update(1 / 60)
    assert.equal(controller.plan, null)
    equal(controller.board.map(row => row.map(piece => piece?.getValue() || 0)), controller.state.board, '事件播放后的组件棋盘与规则一致')
  }
  assert.equal(controller.state.status, 'won'); assert.equal(controller.resultPanel.active, true)
  assert.equal(LevelProgressStore.currentLevelId(), 2)
  const { LevelIceView } = load(path.join(base, 'LevelIceView.ts'))
  for (const levelId of [2, 3]) {
    controller.startLevel(levelId, false)
    for (const column of paths[levelId - 1]) {
      release(column)
      for (let frame = 0; frame < 600 && (controller.plan || controller.pendingResult); frame++) {
        controller.update(1 / 60)
        controller.iceLayer.getComponentsInChildren(LevelIceView).filter(ice => ice.isValid).forEach(ice => ice.update(1 / 60))
        if (controller.pendingResult) assert.equal(controller.resultPanel.active, false, '冰片落地收尾前不遮挡结算')
      }
      equal(controller.board.map(row => row.map(piece => piece?.getValue() || 0)), controller.state.board)
    }
    assert.equal(controller.state.status, 'won'); assert.equal(controller.resultPanel.active, true)
  }
  for (const height of [1000, 1334, 1625]) {
    cc.view.getVisibleSize = () => ({ width: 750, height }); cc.screen.windowSize.height = height
    cc.sys.getSafeAreaRect = () => ({ y: 20, height: height - 80 })
    controller.syncLayout()
    assert.ok(controller.designRoot.scale.x <= 1 && controller.designRoot.scale.x > 0)
    assert.ok(controller.designRoot.position.y - 667 * controller.designRoot.scale.y > -height / 2)
    const settingsTransform = settings.node.getComponent(UITransform), maskTransform = settings.pauseOverlayMask.getComponent(UITransform)
    assert.ok(Math.abs(settingsTransform.height * settings.node.scale.y - height) < .001, '设置层覆盖普通屏和长屏')
    assert.equal(maskTransform.height, settingsTransform.height, '设置遮罩同步可见区域')
  }
  controller.startLevel(2, false); release(0); controller.setPaused(true)
  const switchesBeforeHome = switches.length
  emit(settings.homeButtonNode, Node.EventType.TOUCH_END); emit(settings.homeButtonNode, Node.EventType.TOUCH_END)
  assert.equal(switches.length, switchesBeforeHome, '返回首页等待当前触摸派发结束')
  assert.equal(settings.scheduled.length, 1, '连续点击只派发一次返回')
  settings.scheduled.shift()()
  equal(LevelProgressStore.restore(2), rules.createLevelState(LEVELS[1]), '动画中返回只恢复上一稳定状态')
  assert.equal(switches.at(-1), 'home')
  controller.node.children.forEach(n => n.destroy()); controller.boardRoot = null; controller.bindings = null
  controller.onDestroy(); controller.onDestroy()
  assert.equal(settings.node.active, false, '宿主组件单独移除时关闭设置')
  assert.equal(settings.pauseOverlayMask.listeners.length, 0, '宿主释放设置遮罩监听')
  assert.equal(settings.homeButtonNode.listeners.length, 0, '宿主释放设置按钮监听')
  assert.equal(settings.homeHandler, null)
  settings.onDestroy(); settings.onDestroy()
  assert.equal(controller.transientFx.nodes.length, 0, '离场释放临时特效登记')
  const childrenFirstObjects = deserialize(scene), childrenFirst = childrenFirstObjects.find(object => object instanceof LevelSceneController)
  childrenFirst.onLoad()
  const destroyedSettings = childrenFirst.pauseOverlay
  destroyedSettings.node.children.forEach(node => node.destroy())
  destroyedSettings.onDestroy()
  destroyedSettings.isValid = false
  for (const key of Object.keys(destroyedSettings)) if (typeof destroyedSettings[key] === 'object' || typeof destroyedSettings[key] === 'function') destroyedSettings[key] = null
  childrenFirst.onDestroy(); childrenFirst.onDestroy()
  const iceRoot = deserialize(prefabData('LevelIce'))[1]
  const ice = iceRoot.getComponent(LevelIceView); ice.onLoad(); ice.playBreak(-420)
  for (let frame = 0; frame < 600 && ice.node.isValid; frame++) ice.update(1 / 60)
  assert.ok(ice.shards.every(s => s.rest && s.hits <= 2 && s.y - s.radius >= -420 - .001), '冰片回弹后落稳且不穿地')
  assert.ok(!ice.node.isValid, '停留、淡出后清理特效')
  console.log('设置复用通过：静态预制件、音量存档与音效、关闭／重玩／延迟单次返回、全屏遮罩、宿主移除及子组件先毁释放')
  console.log(`闯关验证通过：${loose ? 'Creator loose' : '标准'}编译；3关可通关、精确收集、输入锁、暂停、恢复、组件棋盘、离场与破冰落地`)
}
run(false)
run(true)

// 静态场景及预制件引用必须闭合，且闯关脚本不导入模式外的脚本。
for (const file of ['assets/scence/level.scene', 'assets/prefab/level/LevelPiece.prefab', 'assets/prefab/level/LevelIce.prefab', 'assets/resources/base/Settings/SettingsPopup.prefab', 'assets/scence/home.scene']) {
  const data = JSON.parse(fs.readFileSync(path.join(root, file)))
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.__id__ !== undefined) assert.ok(Number.isInteger(value.__id__) && data[value.__id__], `${file} 包含悬空引用`)
    else Object.values(value).forEach(visit)
  }
  data.forEach(visit)
}
for (const file of fs.readdirSync(path.join(root, 'assets/script/level')).filter(f => f.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join(root, 'assets/script/level', file), 'utf8')
  const outsideImports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]).filter(name => name.startsWith('../'))
  equal(outsideImports, file === 'LevelSceneController.ts' ? ['../settings/PauseOverlayController', '../platform/GameShareAdapter'] : [], `${file} 仅设置展示和平台分享可复用，不得依赖无尽玩法或经济联网`)
}
console.log('静态引用闭合，闯关玩法独立，仅复用设置展示与平台分享')
