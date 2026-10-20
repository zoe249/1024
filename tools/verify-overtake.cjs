// 在 Node 中校验纯数据时序，不替代 Creator 的渲染及真机验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.argv[2] || 'typescript')
const root = path.resolve(__dirname, '..')
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, `未提供依赖 ${name}`)
    return dependencies[name]
  }, console, setTimeout, clearTimeout, setInterval, clearInterval, ...globals }, { filename: file })
  return module.exports
}
class ApiError extends Error { constructor(statusCode) { super('api'); this.statusCode = statusCode } }
const entry = (value, name = '目标', self = false) => ({ value, displayName: name, rank: 3, isSelf: self, avatarIndex: 0, avatarType: 'builtin', wechatAvatarUrl: '' })
const response = (values, best = 100) => ({ self: entry(best, '自己', true), entries: values.map(value => entry(value)), isTop: values.length === 0 })
function rivalHarness(best = 100, authenticated = true) {
  let now = 10000, serial = 0
  const timers = new Map(), requests = []
  const state = { playerId: authenticated ? 'p1' : null, status: authenticated ? 'authenticated' : 'guest' }
  const api = { getLeaderboardTarget: (...args) => { const d = deferred(); requests.push({ args, ...d }); return d.promise } }
  const session = { getSnapshot: () => ({ ...state }), getApiClient: () => api }
  const profile = { getSnapshot: () => null, load: async () => ({ playerId: state.playerId, highestScore: best, displayName: '自己', avatarIndex: 0 }) }
  class Clock extends Date { static now() { return now } }
  const { OvertakeRivalStore } = load('assets/script/online/leaderboard/OvertakeRivalStore.ts', {
    '../api/GameApiClient': { ApiError }, '../auth/PlayerSessionStore': { PlayerSessionStore: { getInstance: () => session } },
    '../../profile/PlayerProfileStore': { PlayerProfileStore: { getInstance: () => profile } }
  }, { Date: Clock, setTimeout: (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id }, clearTimeout: id => timers.delete(id) })
  const store = new OvertakeRivalStore()
  return { store, requests, state, timers, profile, async begin(score = 0) { store.begin(score, () => {}); await flush() }, async advance(ms) {
    now += ms
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn() }
    await flush()
  } }
}

async function verifyRivals() {
  for (const [best, auth] of [[0, true], [100, false]]) {
    const h = rivalHarness(best, auth); await h.begin(); h.store.updateScore(10000)
    assert.equal(h.requests.length, 0); assert.equal(h.store.resolveOvertake(10000), null); h.store.end()
  }
  const h = rivalHarness(); await h.begin()
  h.requests[0].resolve(response([200, 300])); await flush()
  assert.equal(h.store.resolveOvertake(0).kind, 'self')
  h.store.updateScore(100); assert.equal(h.store.resolveOvertake(100).kind, 'self')
  h.store.updateScore(101); assert.equal(h.store.resolveOvertake(101).value, 200); assert.equal(h.store.resolveOvertake(101).animate, true)
  const revision = h.store.resolveOvertake(101).revision
  h.store.updateScore(200); assert.equal(h.store.resolveOvertake(200).revision, revision)
  h.store.updateScore(300); assert.equal(h.store.resolveOvertake(300).value, 300)
  h.store.updateScore(400); h.store.updateScore(400)
  assert.equal(h.requests.length, 1); assert.equal(h.timers.size, 1)
  await h.advance(1500); assert.deepEqual(h.requests[1].args, ['score', 399])
  h.requests[1].resolve(response([])); await flush()
  assert.equal(h.store.resolveOvertake(400).kind, 'top'); h.store.end()

  const exact = rivalHarness(); await exact.begin(0); exact.requests[0].resolve(response([200])); await flush()
  exact.store.updateScore(300); await exact.advance(1500)
  assert.equal(exact.requests[1].args[1], 299)
  exact.requests[1].resolve(response([300, 400])); await flush()
  assert.equal(exact.store.resolveOvertake(300).value, 300)
  exact.store.end()

  const late = rivalHarness(); await late.begin(500)
  late.requests[0].resolve(response([600])); await flush()
  assert.equal(late.store.resolveOvertake(500).value, 600); assert.equal(late.store.resolveOvertake(500).animate, false)
  await late.begin(0); assert.equal(late.requests.length, 1)
  assert.equal(late.store.resolveOvertake(0).kind, 'self'); assert.equal(late.store.resolveOvertake(0).animate, false)
  late.profile.getSnapshot = () => ({ playerId: 'p1', highestScore: 100, displayName: '自己', avatarIndex: 0 })
  late.profile.load = async () => { throw new Error('offline') }
  await late.begin(300); assert.equal(late.store.resolveOvertake(300).value, 600); assert.equal(late.requests.length, 1)
  late.store.end()

  const stale = rivalHarness(); await stale.begin(); stale.store.end()
  stale.requests[0].resolve(response([200])); await flush(); assert.equal(stale.store.resolveOvertake(0), null)
  const failures = rivalHarness(); await failures.begin()
  for (let i = 0; i < 3; i++) { failures.requests[i].reject(new Error('offline')); await flush(); await failures.advance(6000) }
  assert.equal(failures.requests.length, 3); assert.equal(failures.timers.size, 0); failures.store.end()
  const missing = rivalHarness(); await missing.begin(); missing.requests[0].reject(new ApiError(404)); await flush(); await missing.advance(20000)
  assert.equal(missing.requests.length, 1); assert.equal(missing.store.resolveOvertake(0), null); missing.store.end()
  const unauthorized = rivalHarness(); await unauthorized.begin(); unauthorized.requests[0].resolve(response([200])); await flush()
  unauthorized.store.updateScore(300); await unauthorized.advance(1500); unauthorized.state.status = 'reauth-required'
  unauthorized.requests[1].reject(new ApiError(401)); await flush(); assert.equal(unauthorized.store.resolveOvertake(300), null); unauthorized.store.end()
  const cap = rivalHarness(); await cap.begin()
  for (let i = 0; i < 6; i++) { cap.requests[i].resolve(response([200 + i * 100])); await flush(); cap.store.updateScore(201 + i * 100); await cap.advance(1500) }
  assert.equal(cap.requests.length, 6); cap.store.end()
  const high = rivalHarness(); await high.begin()
  high.requests[0].resolve(response([1000000000, 10000000, 580000, 2000000])); await flush()
  for (const [score, expected] of [[101, 580000], [580000, 580000], [580001, 2000000], [10000000, 10000000], [10000001, 1000000000], [1000000000, 1000000000]]) {
    high.store.updateScore(score)
    assert.equal(high.store.resolveOvertake(score).value, expected)
  }
  assert.equal(high.requests.length, 1); high.store.end()
  console.log('目标数据：同分、连超、同分补页、续局、缓存、过期响应、重试、404 和单局限额通过')
}

async function verifySettlementSync() {
  const first = deferred(), sent = [], pending = []
  const rank = { previous: 12, current: 4 }
  const snapshot = { economy: { lastEnergyRecoveryAt: new Date().toISOString() }, checkIn: {}, progress: { highestScore: 100, highestNumber: 128, completedGames: 1 } }
  const makeResult = (ids, rank) => ({ snapshot, rank, cloudRevision: 1, serverTime: new Date().toISOString(), acceptedOperationIds: ids, duplicateOperationIds: [], rejectedOperations: [] })
  const session = { getToken: () => 'token', getSnapshot: () => ({ playerId: 'p1' }), getApiClient: () => ({ sync: body => {
    sent.push(body)
    return sent.length === 1 ? first.promise : Promise.resolve(makeResult(body.operations.map(op => op.operationId), rank))
  } }) }
  const outbox = { hasImportedGuest: () => true, getOperations: () => pending.slice(), getInstallationId: () => 'install', getCloudRevision: () => 0,
    getProgress: () => ({}), setStartReceipt() {}, applySyncResult(revision, ids) { for (let i = pending.length - 1; i >= 0; i--) if (ids.includes(pending[i].operationId)) pending.splice(i, 1) } }
  const economy = { getCloudSnapshot: () => snapshot, getEnergyBarState: () => ({ energy: 10, remainingSeconds: null }), hasConfirmedEnergy: () => true, applyCloudSnapshot: () => true }
  const { PlayerCloudSyncStore } = load('assets/script/online/sync/PlayerCloudSyncStore.ts', {
    cc: { game: {}, Game: {} }, '../api/GameApiClient': { ApiError }, '../../economy/PlayerEconomyStore': { PlayerEconomyStore: { getInstance: () => economy }, monotonicNow: () => 0 },
    '../auth/PlayerSessionStore': { PlayerSessionStore: { getInstance: () => session } }, './PlayerSyncOutbox': { PlayerSyncOutbox: { getInstance: () => outbox } }
  })
  const store = new PlayerCloudSyncStore()
  const calibration = store.sync()
  pending.push({ operationId: 'finish', type: 'game_finished', payload: {} })
  const receipt = store.syncGameFinished('finish')
  first.resolve(makeResult([], { previous: 30, current: 29 }))
  await calibration
  assert.deepEqual(await receipt, rank)
  assert.equal(sent.length, 2); assert.equal(sent[1].operations[0].operationId, 'finish')
  assert.equal(store.gameRanks.size, 0)
  console.log('结算同步：加入在途校准请求后等待本局回执，不读取前一批名次，一次性消费通过')
}

async function verifyWidget() {
  let now = 0, serial = 0
  const tasks = [], stopped = new Map(), avatarLoads = []
  let delayAvatar = false
  const advance = async ms => {
    const end = now + ms
    while (true) {
      tasks.sort((a, b) => a.at - b.at || a.id - b.id)
      if (!tasks.length || tasks[0].at > end) break
      const task = tasks.shift(); now = task.at
      if ((stopped.get(task.target) || 0) === task.version) task.fn()
      await flush()
    }
    now = end; await flush()
  }
  class Vec3 { constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) } static ZERO = new Vec3(); static ONE = new Vec3(1, 1, 1) }
  class Component { constructor() { this.isValid = true; this.enabledInHierarchy = true } }
  class Node {
    constructor() { this.isValid = true; this.active = true; this.children = []; this.components = []; this.position = new Vec3(); this.scale = Vec3.ONE }
    getChildByName(name) { return this.children.find(child => child.name === name) }
    getComponent(type) { return this.components.find(component => component instanceof type) || null }
    addComponent(type) { const c = new type(); c.node = this; this.components.push(c); return c }
    setPosition(x, y, z) { this.position = x instanceof Vec3 ? x : new Vec3(x, y, z) }
    setScale(value) { this.scale = value }
  }
  class UITransform { setContentSize(width, height) { Object.assign(this, { width, height }) } }
  class Label { static Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2 }; constructor() { this.isValid = true; this.string = '' } updateRenderData() { if (!this.overflow) this.node.getComponent(UITransform).width = Array.from(this.string).length * this.fontSize * .6 } }
  class Sprite {}
  class Graphics { constructor() { this.isValid = true } clear() {} circle() {} stroke() {} }
  class UIOpacity { constructor() { this.opacity = 255 } }
  const Tween = { stopAllByTarget(target) { stopped.set(target, (stopped.get(target) || 0) + 1) } }
  function tween(target) {
    const actions = []; let offset = 0
    const builder = { delay(seconds) { offset += seconds * 1000; return builder }, to(seconds, values, options) {
      offset += seconds * 1000; actions.push({ offset, fn: () => { Object.assign(target, values); options?.onUpdate?.(target) } }); return builder
    }, call(fn) { actions.push({ offset, fn }); return builder }, start() { const version = stopped.get(target) || 0; for (const action of actions) tasks.push({ id: ++serial, target, version, at: now + action.offset, fn: action.fn }); return builder } }
    return builder
  }
  class PlayerAvatarRenderer {
    constructor() { this.clears = 0 }
    render(avatar) { const d = deferred(); avatarLoads.push({ ...d, avatar }); if (!delayAvatar) d.resolve(true); return d.promise }
    clear() { this.clears++ }
    dispose() { this.clear() }
  }
  const cc = { _decorator: { ccclass: () => type => type, property: () => () => {} }, Color: class {}, Component, Node, UITransform, Label, Sprite, Graphics, UIOpacity, Vec3, tween, Tween, game: { on() {}, off() {} }, Game: {} }
  const { OvertakeTargetWidget } = load('assets/script/gameplay/OvertakeTargetWidget.ts', { cc, '../profile/PlayerAvatarRenderer': { PlayerAvatarRenderer } })
  const serialized = JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/Gameplay/ScoreTargetHUD.prefab')))
  const objects = serialized.map(item => item.__type__ === 'cc.Node' ? new Node() : cc[item.__type__.slice(3)] ? new cc[item.__type__.slice(3)]() : null)
  serialized.forEach((item, i) => {
    const object = objects[i]; if (!object) return
    if (object instanceof Node) { object.name = item._name; object.active = item._active; object.children = item._children.map(ref => objects[ref.__id__]); object.position = new Vec3(item._lpos.x, item._lpos.y, 0); object.components = item._components.map(ref => objects[ref.__id__]).filter(Boolean) }
    else { object.node = objects[item.node.__id__]; if (object instanceof UITransform) { object.setContentSize(item._contentSize.width, item._contentSize.height); object.anchorX = item._anchorPoint.x } if (object instanceof Label) { object.fontSize = item._fontSize; object.string = item._string; object.horizontalAlign = item._horizontalAlign; object.overflow = item._overflow } }
  })
  const component = serialized.find(item => item.currentScoreLabel)
  const widget = new OvertakeTargetWidget(); widget.node = objects[1]
  for (const key of ['currentScoreLabel', 'targetViewport', 'topContent']) widget[key] = objects[component[key].__id__]
  widget.targetSlots = component.targetSlots.map(ref => objects[ref.__id__])
  assert.equal(widget.initialize(), true)
  const target = (value, revision, animate = true) => ({ kind: 'rival', key: String(value), name: '一个超过宽度的很长很长的昵称', value, avatar: { avatarIndex: revision }, revision, animate })
  const a = target(100, 1, false), b = target(200, 2), c = target(300, 3)
  widget.render(a, 100); await flush()
  assert.equal(widget.displayed.key, a.key); assert.ok(widget.slots[0].name.string.endsWith('...'))
  const rootPosition = widget.node.position, numberPosition = widget.currentScoreLabel.node.position
  widget.render(b, 101); await flush(); assert.equal(widget.moving, true)
  await advance(140); assert.equal(widget.slots[0].node.active, true)
  await advance(140); assert.equal(widget.slots[0].node.active, false); assert.equal(widget.slots[1].node.active, true); assert.equal(widget.slots[1].node.position.y, -20)
  widget.render(b, 101, true); await flush(); assert.equal(widget.moving, false); assert.equal(widget.slots[1].node.active, true); assert.equal(widget.slots[1].node.position.y, 0)
  await advance(500); widget.render(b, 101, false)
  widget.render(c, 201); await flush(); await advance(390)
  assert.equal(widget.slots[0].opacity.opacity, 255); assert.equal(widget.moving, true)
  await advance(110); assert.equal(widget.moving, false); assert.equal(widget.displayed.key, c.key)
  assert.equal(widget.targetSlots.filter(slot => slot.active).length, 1)
  assert.equal(widget.node.position, rootPosition); assert.equal(widget.currentScoreLabel.node.position, numberPosition)
  widget.render(target(400, 4), 301); await flush(); await advance(70)
  widget.render(target(500, 5), 401); await flush(); await advance(210)
  assert.equal(widget.slots[1].score.string, '500'); assert.equal(widget.slots[1].node.active, true)
  await advance(220); assert.equal(widget.displayed.key, '500')
  delayAvatar = true
  widget.render(target(600, 6), 501); const d = avatarLoads.at(-1)
  widget.render(target(700, 7), 601); const e = avatarLoads.at(-1)
  d.resolve(true); await flush(); assert.equal(widget.displayed.key, '500')
  e.resolve(true); await flush(); assert.equal(widget.moving, true)
  widget.render(null, 402); await advance(1000); assert.equal(widget.targetViewport.active, false); assert.equal(widget.displayed, null)
  delayAvatar = false; widget.render(target(800, 8, false), 500); await flush()
  widget.setTargetFits(false); assert.equal(widget.targetViewport.active, false); assert.equal(widget.currentScoreLabel.node.position, numberPosition)
  widget.setTargetFits(true); await flush(); assert.equal(widget.targetViewport.active, true)
  widget.reducedMotion = true; widget.render(target(900, 9), 801); await flush(); assert.equal(widget.displayed.key, '900'); assert.equal(widget.moving, false)
  widget.render({ ...target(8102, 10, false), name: '菠萝吹雪' }, 1014); await flush()
  const shortAvatarX = widget.slots[widget.currentSlot].avatarRoot.position.x
  const currentBox = widget.currentScoreLabel.node.getComponent(UITransform)
  assert.equal(widget.currentScoreLabel.horizontalAlign, 2)
  assert.equal(currentBox.width, 240)
  assert.equal(widget.currentScoreLabel.string, '1014')
  for (const label of [widget.slots[widget.currentSlot].name, widget.slots[widget.currentSlot].score]) {
    assert.equal(label.horizontalAlign, 2)
    assert.equal(label.node.position.x + label.node.getComponent(UITransform).width * .5, currentBox.width * .5)
  }
  widget.render({ ...target(2000000, 11, false), name: '月' }, 1000000); await flush()
  assert.equal(widget.slots[widget.currentSlot].score.string, '2000000')
  assert.ok(shortAvatarX > widget.slots[widget.currentSlot].avatarRoot.position.x)
  assert.equal(widget.currentScoreLabel.node.position, numberPosition)
  const slotBox = widget.targetSlots[0].getComponent(UITransform)
  for (const [index, value] of [580000, 2000000, 10000000, 1000000000].entries()) {
    widget.render({ ...target(value, 20 + index, false), name: '目标玩家' }, value); await flush()
    const slot = widget.slots[widget.currentSlot]
    assert.equal(slot.score.string, String(value))
    assert.equal(widget.currentScoreLabel.string, String(value))
    assert.equal(slot.score.overflow, Label.Overflow.SHRINK)
    assert.equal(widget.currentScoreLabel.overflow, Label.Overflow.SHRINK)
    assert.equal(slot.score.node.getComponent(UITransform).width, 176)
    assert.equal(currentBox.width, 240)
    assert.equal(slot.node.getComponent(UITransform).width, slotBox.width)
    assert.ok(slot.avatarRoot.position.x >= -96)
    assert.equal(widget.node.position, rootPosition)
  }
  widget.render({ kind: 'top', key: 'top', revision: 30, animate: false }, 1000000000); await flush()
  assert.equal(widget.topContent.active, true)
  assert.equal(widget.topContent.getChildByName('Title').getComponent(Label).string, '已登顶')
  widget.onDisable(); assert.equal(widget.displayed, null); assert.ok(widget.slots.every(slot => slot.renderer.clears > 0)); widget.dispose()
  console.log('HUD 组件：实际 Prefab 引用、昵称省略、500ms 阶段、入场前替换、暂停收敛、头像竞态、隐藏/减少动态效果和销毁清理通过（模拟引擎时钟）')

  const geometry = load('assets/script/gameplay/BoardGeometry.ts', { cc })
  const { PlayUIController } = load('assets/script/gameplay/PlayUIController.ts', {
    cc, '../settings/PauseOverlayController': {}, '../settlement/GameOverOverlayController': {},
    './OvertakeTargetWidget': { OvertakeTargetWidget }, '../tutorial/FirstEntryTutorialController': {}, './BoardGeometry': geometry
  })
  function layout(columns, rows, height = 1334, contentY = 0, capsule = null) {
    const ui = Object.create(PlayUIController.prototype)
    const content = { width: 750, height: 1334, anchorX: .5, anchorY: .5, convertToNodeSpaceAR: p => new Vec3(p.x, p.y - contentY, 0) }
    const owner = { width: 750, height, anchorX: .5, anchorY: .5, convertToWorldSpaceAR: p => p }
    const board = { position: new Vec3(0, -60, 0), getChildByName: () => null }
    const node = { getComponent: () => owner, getChildByName: name => name === 'board' ? board : null }
    const hud = { node: { parent: { getComponent: () => content }, setPosition(x, y) { this.position = new Vec3(x, y + contentY, 0) } }, setTargetFits(fits) { this.fits = fits } }
    Object.assign(ui, { node, overtakeWidget: hud, boardwidth: columns, boardheight: rows, pieceSize: 120, spacing: 10, spawnOffsetY: 260, getWechatMenuMetrics: () => capsule })
    ui.layoutOvertakeWidget()
    assert.equal(board.position.y, -60)
    return hud
  }
  for (let columns = 1; columns <= 6; columns++) for (let rows = 1; rows <= 7; rows++) {
    const hud = layout(columns, rows), position = hud.node.position
    assert.equal(hud.fits, true)
    assert.ok(position.y - 81 >= -60 + rows * 65 + 18)
    assert.ok(position.y + 81 <= 655)
    const spawnY = -60 - rows * 65 + 65 + rows * 130 + 260
    const sharesColumn = Array.from({ length: columns }, (_, column) => geometry.getBoardCellCenterOffset(column, columns, 130)).some(x => Math.abs(x - position.x) < 184)
    if (sharesColumn) assert.ok(position.y + 81 <= spawnY - 72 || position.y - 81 >= spawnY + 72)
  }
  const short = layout(5, 7, 1334, -48, { windowWidth: 375, windowHeight: 667, screenTop: 0, menuRect: { left: 270, right: 365, top: 24, bottom: 56 } })
  assert.equal(short.fits, false); assert.ok(short.node.position.y - 1 >= 413); assert.ok(short.node.position.y + 81 <= 555 - 12)
  const long = layout(5, 7, 1624, 65, { windowWidth: 375, windowHeight: 812, screenTop: 0, menuRect: { left: 270, right: 365, top: 40, bottom: 72 } })
  assert.equal(long.fits, true); assert.ok(long.node.position.y + 81 <= 668 - 12)
  console.log('HUD 布局：42 种行列组合、出生点/棋盘避让、短屏收起目标保留分数、长屏胶囊避让通过（坐标模拟）')

  const { GameOverOverlayController } = load('assets/script/settlement/GameOverOverlayController.ts', { cc })
  const settlement = new GameOverOverlayController()
  settlement.rankNode = new Node(); settlement.rankLabel = new Label(); settlement.rankLabel.node = new Node()
  settlement.rankDeltaLabel = new Label(); settlement.rankDeltaLabel.node = new Node()
  settlement.renderRank({ previous: 12, current: 4 }, false)
  assert.equal(settlement.rankKey, '')
  settlement.isVisible = true; settlement.renderRank(settlement.latestRank, false)
  await advance(450); assert.equal(settlement.rankLabel.string, '第 4 名'); assert.equal(settlement.rankDeltaLabel.string, '↑8')
  settlement.renderRank({ previous: 4, current: 4 }, false); assert.equal(settlement.rankDeltaLabel.node.active, false)
  settlement.renderRank({ previous: null, current: 13 }, false); assert.equal(settlement.rankLabel.string, '新上榜 第 13 名')
  settlement.renderRank(null, true); assert.equal(settlement.rankLabel.string, '名次计算中')
  settlement.renderRank(null, false); await advance(120); assert.equal(settlement.rankNode.active, false)
  settlement.renderRank({ previous: 50, current: 1 }, false); settlement.stopRankAnimation(); const text = settlement.rankLabel.string
  await advance(700); assert.equal(settlement.rankLabel.string, text)
  console.log('结算组件：素材未就绪时延后动画、上升/持平/首次上榜、超时隐藏和停止补间通过（模拟引擎时钟）')
}

Promise.resolve().then(verifyRivals).then(verifySettlementSync).then(verifyWidget).catch(error => { console.error(error); process.exitCode = 1 })
