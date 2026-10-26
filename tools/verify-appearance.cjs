// 使用实际解析器、租约和视图验证外观边界；测试主题不登记到生产目录。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.argv[2] || 'typescript')
const { environment } = require('./verify-refactor.cjs')

async function verifyMode(cocosSpread) {
  let transformOutput = output => output
  if (cocosSpread) {
    // 同时验证 Creator 的 loose 展开，避免 Node 原生迭代掩盖 Set/Map 兼容问题。
    const typescriptRoot = path.dirname(require.resolve(`${process.argv[2] || 'typescript'}/package.json`))
    const engineModules = path.resolve(typescriptRoot, '../../../resources/3d/engine/node_modules')
    const babel = require(path.join(engineModules, '@babel/core'))
    const spread = require(path.join(engineModules, '@babel/plugin-transform-spread'))
    transformOutput = output => babel.transformSync(output, { babelrc: false, configFile: false, plugins: [[spread, { loose: true }]] }).code
  }
const env = environment(false, transformOutput)
const { cc, load, child } = env
const plain = value => JSON.parse(JSON.stringify(value))
const equal = (a, b) => assert.deepEqual(plain(a), plain(b))
class Asset {
  constructor(name) { Object.assign(this, { name, isValid: true, refs: 0, adds: 0, releases: 0 }) }
  addRef() { assert.ok(this.isValid); this.refs++; this.adds++; return this }
  decRef() { assert.ok(this.refs > 0, '引用不能重复释放'); this.refs--; this.releases++; if (!this.refs) this.isValid = false; return this }
}
class SpriteFrame extends Asset { originalSize = { width: 160, height: 160 } }
cc.Asset = Asset; cc.SpriteFrame = SpriteFrame; cc.Prefab = class extends Asset {}
cc.Color.WHITE = new cc.Color(255, 255, 255, 255)
const pending = [], bundleCallbacks = [], bundles = new Map()
cc.assetManager = {
  loadAny: (uuid, done) => pending.push({ key: uuid, done }),
  getBundle: name => bundles.get(name),
  loadBundle: (name, done) => bundleCallbacks.push({ name, done }),
  removeBundle: () => { throw new Error('不得移除其他调用方可能使用的 Bundle') }
}
cc.resources = { load: (path, type, done) => pending.push({ key: path, done }) }
const types = load('assets/script/appearance/AppearanceTypes.ts')
const { BASE_APPEARANCE: base } = load('assets/script/appearance/BaseAppearance.ts')
const { resolveAppearance } = load('assets/script/appearance/AppearanceResolver.ts')
const { findAppearanceTheme } = load('assets/script/appearance/AppearanceCatalog.ts')
const { AppearanceAssetLoader, appearanceAssetLoader } = load('assets/script/appearance/AppearanceAssetLoader.ts')
const { AppearanceRuntime, appearanceRuntime } = load('assets/script/appearance/AppearanceRuntime.ts')
const ref = path => ({ source: 'resources', path, kind: 'spriteFrame' })
const theme = (overrides, themeId = 'fixture_a') => ({ themeId, version: 1, overrides })
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function backendHarness() {
  const jobs = [], assets = []
  const loader = new AppearanceAssetLoader({ load: (ref, done) => jobs.push({ ref, done }) })
  function finish(index, error = null, asset = new SpriteFrame(`asset_${index}`)) { assets.push(asset); jobs[index].done(error, asset); return asset }
  return { loader, jobs, assets, finish, finishAll: () => jobs.forEach((job, i) => { if (!job.finished) { job.finished = true; finish(i) } }) }
}

async function verify() {
  equal(resolveAppearance(), base)
  assert.ok(Object.isFrozen(base.piece.stylesByValue[8192]))
  const input = theme({ game: { board: { shadow: { opacity: 0 } } }, loading: { leaf: { enabled: false } }, piece: { stylesByValue: { 8192: { bodyColor: '#112233' } }, preview: { styledValues: [2, 8192] } } })
  const a = resolveAppearance(input)
  assert.equal(a.game.board.shadow.opacity, 0); assert.equal(a.loading.leaf.enabled, false)
  assert.equal(a.piece.stylesByValue[8192].decoration, 'crown'); assert.equal(a.piece.stylesByValue[8192].textScale, 0.86)
  assert.ok(!Object.isFrozen(input.overrides.piece.preview.styledValues), '解析器不能冻结调用方输入')
  input.overrides.piece.preview.styledValues.push(4)
  equal(a.piece.preview.styledValues, [2, 8192])
  const b = resolveAppearance(theme({ loading: { progress: { fill: '#334455' } } }, 'fixture_b'))
  assert.equal(b.game.board.shadow.opacity, 18); assert.equal(b.loading.leaf.enabled, true)
  equal(b.piece, base.piece); equal(resolveAppearance(), base)
  for (const overrides of [
    { game: { boardwidth: 6 } }, { home: { nodePath: 'Main/board' } }, { game: { background: null } },
    { piece: { stylesByValue: { 3: { bodyColor: '#ffffff' } } } }, { piece: { fallbackStyle: { textScale: 0 } } },
    { game: { background: { ...ref('x'), extra: true } } }, { game: { background: { ...ref('x'), kind: 'prefab' } } },
    { game: { background: { source: 'bundle', bundle: '//remote', path: 'x', kind: 'spriteFrame' } } },
    { game: { background: ref('../outside') } }, { game: { background: ref('https://remote') } },
    { game: { background: { source: 'binding', id: 'arbitrary.node', kind: 'spriteFrame' } } },
    { piece: { bodyMode: 'fullColor' } }, { loading: { leaf: { asset: null, enabled: false } } }
  ]) assert.throws(() => resolveAppearance(theme(overrides)))
  assert.equal(findAppearanceTheme('fixture_a'), undefined)
  console.log('解析：缺省继承、零透明度、隐藏、逐值合并、Base→A→B→Base、非法字段/资源/关联约束及输入隔离通过')

  const h = backendHarness(), shared = new SpriteFrame('shared')
  let loadedCallbacks = 0
  const onLoaded = (error, asset) => { assert.equal(error, null); assert.equal(asset, shared); loadedCallbacks++ }
  const first = h.loader.acquire(ref('same'), onLoaded), second = h.loader.acquire(ref('same'), onLoaded)
  assert.equal(h.jobs.length, 1); h.finish(0, null, shared)
  assert.equal((await first.ready).status, 'ready'); assert.equal((await second.ready).status, 'ready')
  assert.equal(loadedCallbacks, 2, '共享资源必须通知每个租约的回调')
  assert.equal(shared.refs, 1)
  first.release(); first.release(); assert.equal(shared.refs, 1)
  second.release(); second.release(); assert.equal(shared.refs, 0)
  const late = h.loader.acquire(ref('late'), () => assert.fail('取消后不得调用资源回调')); late.release()
  assert.equal((await late.ready).status, 'cancelled')
  const lateAsset = h.finish(1); assert.equal(lateAsset.refs, 0); assert.equal(lateAsset.adds, lateAsset.releases)
  const cancelled = h.loader.acquire(ref('rejoin')); cancelled.release()
  const rejoined = h.loader.acquire(ref('rejoin')); assert.equal(h.jobs.length, 3)
  const rejoinedAsset = h.finish(2); assert.equal((await rejoined.ready).status, 'ready'); assert.equal(rejoinedAsset.refs, 1); rejoined.release()
  let failedCallbacks = 0
  const onFailed = (error, asset) => { assert.equal(error.message, 'fixture'); assert.equal(asset, null); failedCallbacks++ }
  const errored = h.loader.acquire(ref('error'), onFailed), alsoErrored = h.loader.acquire(ref('error'), onFailed)
  const errorAsset = h.finish(3, new Error('fixture'))
  assert.equal((await errored.ready).status, 'failed'); assert.equal(errorAsset.refs, 0)
  assert.equal((await alsoErrored.ready).status, 'failed'); assert.equal(failedCallbacks, 2)
  assert.equal(errored.isReleased, true); assert.equal(alsoErrored.isReleased, true)
  const retry = h.loader.acquire(ref('error')); assert.equal(h.jobs.length, 5); h.finish(4); retry.release()
  const aliases = [h.loader.acquire(ref('alias')), h.loader.acquire({ source: 'uuid', kind: 'spriteFrame', uuid: 'alias-uuid' })]
  const aliasAsset = new SpriteFrame('one asset two identifiers'); h.finish(5, null, aliasAsset); h.finish(6, null, aliasAsset)
  assert.equal(aliasAsset.refs, 2); aliases[0].release(); assert.equal(aliasAsset.refs, 1); aliases[1].release(); assert.equal(aliasAsset.refs, 0)
  const thrown = new AppearanceAssetLoader({ load() { throw new Error('sync failure') } }).acquire(ref('throws'))
  assert.equal((await thrown.ready).status, 'failed')
  console.log('资源：同标识去重、共享引用、别名同资产、取消后重入、迟到资产回收、失败重试、同步抛错与重复释放通过')

  const bundleRef = path => ({ source: 'bundle', bundle: 'theme_fixture_v1', path, kind: 'spriteFrame' })
  const bundleA = appearanceAssetLoader.acquire(bundleRef('a')), bundleB = appearanceAssetLoader.acquire(bundleRef('b'))
  assert.equal(bundleCallbacks.length, 1)
  const bundle = { load: (path, type, done) => pending.push({ key: path, done }) }
  bundles.set('theme_fixture_v1', bundle); bundleCallbacks.shift().done(null, bundle)
  for (const job of pending.splice(0)) job.done(null, new SpriteFrame(job.key))
  assert.equal((await bundleA.ready).status, 'ready'); assert.equal((await bundleB.ready).status, 'ready')
  bundleA.release(); bundleB.release()
  const originalBundleLoad = cc.assetManager.loadBundle
  cc.assetManager.loadBundle = () => { throw new Error('bundle throws') }
  const throwingBundleRef = { ...bundleRef('throw'), bundle: 'theme_throw_v1' }
  assert.equal((await appearanceAssetLoader.acquire(throwingBundleRef).ready).status, 'failed')
  cc.assetManager.loadBundle = originalBundleLoad
  const retriedBundle = appearanceAssetLoader.acquire(throwingBundleRef)
  assert.equal(bundleCallbacks.length, 1, '同步异常后必须移除 Bundle 的在途占位')
  bundleCallbacks.shift().done(new Error('bundle failure'))
  assert.equal((await retriedBundle.ready).status, 'failed')
  const wrongType = appearanceAssetLoader.acquire({ source: 'uuid', uuid: 'wrong-type', kind: 'spriteFrame' })
  const wrongAsset = new cc.Prefab('wrong-kind'); pending.shift().done(null, wrongAsset)
  assert.equal((await wrongType.ready).status, 'failed'); assert.equal(wrongAsset.refs, 0)
  console.log('Bundle：并发加载合并、按资源类型加载及独立引用释放通过；没有 releaseAll/removeBundle')

  const gameFixture = resolveAppearance(theme({ piece: { layers: { body: ref('piece/body') } } }))
  const owned = backendHarness(), runtime = new AppearanceRuntime(owned.loader)
  const preparing = runtime.prepareResolved('game', gameFixture)
  assert.equal(owned.jobs.length, 6, '游戏只准备五个游戏资源与一个方块覆盖，不加载首页/加载页')
  let delivered = false
  preparing.ready.then(() => { delivered = true })
  owned.finish(0); owned.jobs[0].finished = true; await flush()
  assert.equal(delivered, false, '一个资源完成不能提前交付整套外观')
  owned.finishAll(); const prepared = await preparing.ready; assert.equal(prepared.status, 'ready')
  const transferred = prepared.lease
  const ticket = runtime.handoffGame(transferred, 'game')
  assert.equal(transferred.isReleased, true); transferred.release()
  assert.throws(() => runtime.handoffGame(transferred, 'game'))
  assert.equal(runtime.takeGame(ticket, 'home'), null)
  const gameLease = runtime.takeGame(ticket, 'game'); assert.ok(gameLease)
  assert.equal(runtime.takeGame(ticket, 'game'), null)
  const uiLease = gameLease.retain(); gameLease.release()
  assert.ok(owned.assets.every(asset => asset.refs === 1))
  uiLease.release(); assert.ok(owned.assets.every(asset => asset.refs === 0))
  const oldTicket = runtime.handoffGame(runtime.acquireBase('game'), 'game')
  const newTicket = runtime.handoffGame(runtime.acquireBase('game'), 'game')
  runtime.discardPendingGame(oldTicket); assert.equal(runtime.getGameTicket('game'), newTicket)
  runtime.discardPendingGame(newTicket); assert.equal(runtime.getGameTicket('game'), null)
  const failed = runtime.prepareResolved('game', gameFixture)
  const offset = owned.jobs.length - 6
  owned.finish(offset, new Error('declared resource missing'))
  assert.equal((await failed.ready).status, 'failed', '一个资源失败立即结束候选，不等待其他资源')
  for (let i = offset + 1; i < owned.jobs.length; i++) owned.finish(i)
  assert.ok(owned.assets.every(asset => asset.refs === 0))
  const aborted = runtime.prepareResolved('game', gameFixture), abortOffset = owned.jobs.length - 6
  aborted.cancel(); aborted.cancel(); assert.equal((await aborted.ready).status, 'cancelled')
  for (let i = abortOffset; i < owned.jobs.length; i++) owned.finish(i)
  assert.ok(owned.assets.every(asset => asset.refs === 0))
  const jobCount = owned.jobs.length, fallback = await runtime.prepare('game', 'unknown-theme').ready
  assert.equal(fallback.status, 'ready'); assert.equal(fallback.lease.appearance.themeId, 'base'); assert.equal(owned.jobs.length, jobCount); fallback.lease.release()
  console.log('运行时：场景资源范围、一次性交接、旧票据抑制、UI 独立保留、失败整体释放、取消及未知主题 Base 回退通过')

  const { PieceController } = load('assets/script/gameplay/PieceController.ts')
  const piece = new PieceController(); piece.node = new cc.Node('Piece'); piece.node.addComponent(cc.UITransform)
  const original = new SpriteFrame('original'); original.addRef()
  for (const name of ['Shadow', 'Body', 'Outline', 'Highlight', 'Decoration']) child(piece.node, name).addComponent(cc.Sprite).spriteFrame = original
  const label = child(piece.node, 'Value').addComponent(cc.Label)
  piece.onLoad(); piece.setValue(8192)
  const bodyFrame = new SpriteFrame('full-color-body')
  const full = resolveAppearance(theme({ piece: { layers: { body: ref('fullColor') }, bodyMode: 'fullColor', stylesByValue: { 8192: { textColor: '#123456', textScale: 0.5 } } } }))
  piece.applyAppearance(full.piece, { body: bodyFrame }); piece.syncLayout(true); piece.setValue(8192)
  equal(piece.getBackgroundColor(), new cc.Color(255, 255, 255)); equal(piece.getTextColor(), cc.Color.fromHEX(new cc.Color(), '#123456'))
  assert.equal(piece.getSpriteFrame(), bodyFrame); assert.equal(label.fontSize, 19)
  const preview = new cc.Node('Tile'), previewTile = preview.addComponent(cc.Graphics), previewLabel = child(preview, 'Value').addComponent(cc.Label)
  const { PlayHudView } = load('assets/script/gameplay/PlayHudView.ts')
  PlayHudView.renderNextPiece(8192, previewLabel, previewTile, full.piece, bodyFrame)
  const previewBody = preview.getChildByName('AppearanceBody').getComponent(cc.Sprite)
  assert.equal(previewBody.spriteFrame, bodyFrame); equal(previewBody.color, new cc.Color(255, 255, 255)); assert.equal(previewBody.trim, false)
  const { GameOverOverlayController } = load('assets/script/settlement/GameOverOverlayController.ts')
  const settlement = new GameOverOverlayController()
  Object.assign(settlement, { values: { highest: 8192 }, highestIcon: new cc.Sprite(), highestIconOutline: new cc.Sprite(), highestIconLabel: new cc.Label() })
  settlement.highestIcon.node = new cc.Node('highest'); settlement.highestIcon.spriteFrame = original
  settlement.applyPieceAppearance(full.piece, { body: bodyFrame })
  equal(settlement.highestIcon.color, new cc.Color(255, 255, 255)); assert.equal(settlement.highestIcon.spriteFrame, bodyFrame)
  piece.applyAppearance(b.piece); piece.setValue(8192); piece.syncLayout(true)
  assert.equal(piece.getSpriteFrame(), original); equal(piece.getBackgroundColor(), cc.Color.fromHEX(new cc.Color(), '#2f6c78'))
  settlement.applyPieceAppearance(base.piece); assert.equal(settlement.highestIcon.spriteFrame, original)
  PlayHudView.renderNextPiece(8192, previewLabel, previewTile); assert.equal(preview.getChildByName('AppearanceBody').active, false)
  console.log('视图：棋盘/预览/结算共用注入样式，布局和 setValue 不回默认；完整彩色图白色乘色与返回 Base 还原通过')

  const uiFrames = [], allGame = await appearanceRuntime.prepare('game').ready
  const { GameAppearance } = load('assets/script/gameplay/GameAppearance.ts')
  const view = new GameAppearance(allGame.lease)
  const background = new cc.Node('background').addComponent(cc.Sprite); background.spriteFrame = original
  view.bindSprite(base.game.background, background, () => uiFrames.push(background.spriteFrame))
  const backgroundAsset = new SpriteFrame('background'); pending.shift().done(null, backgroundAsset)
  assert.equal(backgroundAsset.refs, 1); view.dispose(); view.dispose()
  assert.equal(background.spriteFrame, original); assert.equal(backgroundAsset.refs, 0)
  const lateView = new GameAppearance(), lateSprite = new cc.Node('late').addComponent(cc.Sprite)
  lateView.bindSprite(base.game.settings, lateSprite, () => { throw new Error('离场后不得调用视图') })
  lateView.dispose(); const lateFrame = new SpriteFrame('late'); pending.shift().done(null, lateFrame); assert.equal(lateFrame.refs, 0)
  const destroyedView = new GameAppearance(), destroyedSprite = new cc.Node('destroyed').addComponent(cc.Sprite)
  destroyedView.bindSprite(base.game.background, destroyedSprite, () => {})
  const destroyedFrame = new SpriteFrame('destroyed'); pending.shift().done(null, destroyedFrame)
  destroyedSprite.isValid = false; destroyedSprite.node = null; destroyedView.dispose(); destroyedView.dispose(); assert.equal(destroyedFrame.refs, 0)
  assert.equal(uiFrames.length, 1)
  console.log('资源视图销毁：父组件单独移除先解绑引用；子组件字段清空、离场晚到加载及重复释放通过')

  const { HomeAppearance } = load('assets/script/home/HomeAppearance.ts')
  const homeNode = new cc.Node('Logo'), homeSprite = homeNode.addComponent(cc.Sprite); homeNode.addComponent(cc.UITransform)
  homeSprite.spriteFrame = original
  const home = new HomeAppearance()
  home.applyArtwork(homeNode, 'logo', 560, 322)
  assert.equal(pending.length, 0, '已序列化 Base 首帧不得再加载')
  home.dispose(); assert.equal(homeSprite.spriteFrame, original)
  const blank = new cc.Node('blank'); blank.addComponent(cc.UITransform)
  const missing = new HomeAppearance(); missing.applyArtwork(blank, 'logo', 560, 322)
  assert.equal(pending[0].key, 'Homepage/logo-1024-number-garden/spriteFrame')
  missing.dispose(); const lateHome = new SpriteFrame('late-home'); pending.shift().done(null, lateHome); assert.equal(lateHome.refs, 0)
  const homeRequest = appearanceRuntime.prepareResolved('home', resolveAppearance(theme({ home: { artwork: { logo: ref('home/override') } } })))
  for (const job of pending.splice(0)) job.done(null, new SpriteFrame(job.key))
  const homeResult = await homeRequest.ready
  const homeOverride = new HomeAppearance(homeResult.lease)
  homeOverride.applyArtwork(homeNode, 'logo', 560, 322)
  assert.equal(homeSprite.spriteFrame.name, 'home/override', '主题必须覆盖已存在的 SpriteFrame')
  homeOverride.dispose(); assert.equal(homeSprite.spriteFrame, original)
  console.log('首页外观：序列化首帧不加载、缺图原路径、晚到取消及已准备覆盖替换现有贴图通过')
  await verifySceneEntries()
  await flush()
}

function evaluate(file, overrides) {
  const module = { exports: {} }
  const output = transformOutput(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText)
  vm.runInNewContext(output, { module, exports: module.exports, console, require: name => {
    if (name === 'cc') return cc
    if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
    const local = path.posix.normalize(path.posix.join(path.posix.dirname(file), `${name}.ts`))
    if (local.startsWith('assets/script/appearance/') || /(?:PieceController|(?:Game|Home|Loading)Appearance|LoadingLeavesEffect|PlayEffects|HomePopupHost|BoardConfig|BoardModel|BoardGeometry|TransientFxRegistry)\.ts$/.test(local)) return load(local)
    return {}
  } }, { filename: file })
  return module.exports
}

async function verifySceneEntries() {
  const events = [], h = backendHarness(), runtime = new AppearanceRuntime(h.loader)
  let snapshot = null, config = { columns: 3, rows: 7 }, active = false, consumeCount = 0, acceptEnergy
  const session = { consumeSnapshot() { events.push('snapshot'); const result = snapshot; snapshot = null; return result }, hasActiveGame: () => active,
    beginNewGame(value) { active = true; config = value; events.push('begin') }, getBoardConfig: () => config }
  const cloud = { consumeEnergy: () => { consumeCount++; return new Promise(resolve => { acceptEnergy = resolve }) } }
  const overrides = {
    '../appearance/AppearanceRuntime': { appearanceRuntime: runtime }, './OngoingGameSession': { OngoingGameSession: session },
    '../gameplay/OngoingGameSession': { OngoingGameSession: session },
    '../platform/GameAudioManager': { GameAudioManager: class { setup() {} playGameplayBackgroundMusic() {} } },
    '../online/leaderboard/OvertakeRivalStore': { OvertakeRivalStore: { getInstance: () => ({ end() {} }) } },
    '../online/sync/PlayerCloudSyncStore': { PlayerCloudSyncStore: { getInstance: () => cloud } }
  }
  const { PlayController } = evaluate('assets/script/gameplay/PlayController.ts', overrides)
  function gameEntry() {
    const controller = Object.create(PlayController.prototype)
    const root = new cc.Node('Main'); root.off = () => {}; root.addComponent(cc.UITransform)
    Object.assign(controller, { node: root, isValid: true, boardwidth: 3, boardheight: 7, pieceSize: 120, spacing: 10, spawnOffsetY: 260,
      shareAdapter: { enableWechatShareMenu() {}, disableWechatShareMenu() {} }, rewardedAdAdapter: { initialize() {}, dispose() {} },
      hasCompletedFirstEntryTutorial: () => true, ensureGameplayLayers: () => {}, preloadDefaultGameOverAudio: () => {}, bindInput: () => {},
      resetBoard() { events.push('reset'); this.board = Array.from({ length: this.boardheight }, () => Array(this.boardwidth).fill(null)) },
      boardModel: new (load('assets/script/gameplay/BoardModel.ts').BoardModel)(), comboFeedback: { clear() {} }, transientFx: { clear() {} },
      currentPiece: null, unschedule() {}, settlementGeneration: 0, getComponent: () => ({ showTransientMessage() {}, setup: options => { events.push('ui'); assert.equal(options.layout.boardwidth, 3); assert.ok(!options.appearance.isReleased) } }),
      restoreOngoingGame: () => events.push('restore') })
    return controller
  }
  cc.director = { getScene: () => ({ name: 'game' }) }
  // cc 在实际模块求值前已由上面的入口共享引用，属性读取发生在调用时。
  const direct = gameEntry(); direct.onLoad()
  equal(events.slice(0, 4), ['snapshot', 'begin', 'reset', 'ui'])
  const directLease = direct.gameAppearance.lease; direct.onDestroy(); assert.equal(directLease.isReleased, true)
  events.length = 0; active = true; snapshot = { fixture: true }
  const ongoing = gameEntry(); ongoing.onLoad()
  equal(events, ['snapshot', 'reset', 'ui', 'restore']); ongoing.onDestroy()

  const styledRequest = runtime.prepareResolved('game', resolveAppearance(theme({ piece: { stylesByValue: { 2: { bodyColor: '#123456' } } } })))
  h.finishAll(); const styledResult = await styledRequest.ready
  runtime.handoffGame(styledResult.lease, 'game')
  const styledGame = gameEntry(); styledGame.onLoad()
  const { PieceController } = load('assets/script/gameplay/PieceController.ts')
  const prefabFrame = new SpriteFrame('prefab-body'); prefabFrame.addRef()
  cc.instantiate = () => {
    const node = new cc.Node('Piece'); node.addComponent(cc.UITransform)
    for (const name of ['Body', 'Shadow', 'Outline', 'Highlight', 'Decoration']) child(node, name).addComponent(cc.Sprite).spriteFrame = prefabFrame
    child(node, 'Value').addComponent(cc.Label)
    const piece = node.addComponent(PieceController); piece.onLoad(); return node
  }
  Object.assign(styledGame, { basePieceController: {}, scoreManager: { updateHighestPieceValue() {} }, nextPieceValue: 2, randomBasePieceValue: () => 4, refreshUiState() {} })
  styledGame.spawnPiece()
  equal(styledGame.currentPiece.getBackgroundColor(), cc.Color.fromHEX(new cc.Color(), '#123456'))
  const restoredPiece = styledGame.instantiateSnapshotPiece(2)
  equal(restoredPiece.getBackgroundColor(), cc.Color.fromHEX(new cc.Color(), '#123456'))
  styledGame.board[0][0] = restoredPiece
  styledGame.onDisable()
  function destructPiece(piece) {
    piece.node.isValid = false
    for (const component of piece.node.components) {
      component.isValid = false
      for (const key of Object.keys(component)) if (typeof component[key] === 'object' || typeof component[key] === 'function') component[key] = null
    }
  }
  destructPiece(styledGame.currentPiece); destructPiece(restoredPiece)
  const styledLease = styledGame.gameAppearance.lease
  styledGame.onDestroy()
  assert.equal(styledLease.isReleased, true); assert.ok(h.assets.every(asset => asset.refs === 0))
  assert.equal(prefabFrame.refs, 1, '单颗棋子不能释放 Creator 持有的共享 Prefab 素材')

  const { LoadingSceneController } = evaluate('assets/script/loading/LoadingSceneController.ts', overrides)
  function loadingEntry() {
    const loading = new LoadingSceneController(), scheduled = [], progress = []
    Object.assign(loading, { node: new cc.Node('Loading'), selectRandomTip() {}, ensureLoadingUi() {}, renderProgress: value => progress.push(value),
      scheduleOnce: (callback, seconds) => scheduled.push({ callback, seconds }), unscheduleAllCallbacks: () => { scheduled.length = 0 } })
    loading.onLoad(); return { loading, scheduled, progress }
  }
  const loads = []
  cc.director.preloadScene = (target, progress, complete) => loads.push({ target, progress, complete })
  const { loading, scheduled, progress } = loadingEntry()
  loading.startLoadingTargetScene(); loading.startLoadingTargetScene(); assert.equal(loads.length, 1)
  loads[0].progress(1, 2); loads[0].complete()
  equal(progress, [0, 0.5, 1]); assert.ok(scheduled[0].seconds >= 0 && scheduled[0].seconds <= 1.8)
  let enteredGame
  cc.director.loadScene = (target, done) => {
    assert.equal(target, 'game'); assert.ok(runtime.getGameTicket('game') !== null)
    loading.onDestroy()
    enteredGame = gameEntry(); enteredGame.onLoad()
    done(null); return true
  }
  scheduled[0].callback(); assert.equal(runtime.getGameTicket('game'), null)
  enteredGame.onDestroy()
  const cancelled = loadingEntry(); cancelled.loading.startLoadingTargetScene()
  const candidate = cancelled.loading.gameAppearance
  cancelled.loading.onDestroy(); cancelled.loading.isValid = false
  for (const key of Object.keys(cancelled.loading)) if (typeof cancelled.loading[key] === 'object' || typeof cancelled.loading[key] === 'function') cancelled.loading[key] = null
  loads[1].progress(1, 1); loads[1].complete(); assert.equal(candidate.isReleased, true)
  const failed = loadingEntry(); failed.loading.startLoadingTargetScene(); loads[2].complete(new Error('fixture'))
  cc.director.loadScene = () => false
  failed.scheduled[0].callback(); assert.equal(runtime.getGameTicket('game'), null); failed.loading.onDestroy()

  const restart = gameEntry(); restart.onLoad()
  const oldLease = restart.gameAppearance.lease
  Object.assign(restart, { isResolving: false, skillAdLoading: null, isConsumingRestartEnergy: false, isPaused: true, economy: {},
    clearBoardPieces: () => events.push('clear-board'), clearTransientEffects: () => events.push('clear-fx'), beginOvertakeSession() {}, spawnPiece: () => events.push('spawn'), refreshUiState() {} })
  const firstRestart = restart.restartGame(), duplicateRestart = restart.restartGame()
  assert.equal(consumeCount, 1); assert.equal(restart.gameAppearance.lease, oldLease)
  acceptEnergy({ accepted: false }); await firstRestart; await duplicateRestart
  assert.equal(restart.isPaused, true); assert.equal(oldLease.isReleased, false)
  restart.uiController = null
  const acceptedRestart = restart.restartGame(); acceptEnergy({ accepted: true }); await acceptedRestart
  assert.equal(oldLease.isReleased, true); assert.equal(restart.gameAppearance.lease.isReleased, false)
  assert.equal(restart.gameAppearance.piece, base.piece); restart.onDestroy()

  const { HomeSceneController } = evaluate('assets/script/home/HomeSceneController.ts', overrides)
  function homeEntry(loadingSceneName) {
    const home = Object.create(HomeSceneController.prototype)
    Object.assign(home, { node: new cc.Node('Home'), isValid: true, isLoadingGameScene: false, isConsumingEnergy: false, cloudSync: cloud,
      economy: {}, newGameColumns: 3, newGameRows: 7, popupHost: { skillShop: null }, updateAdapter: { isBlockingNavigation: () => false },
      loadingSceneName, gameSceneName: 'game', refreshPlayerResources() {}, loadSceneAfterButtonFeedback: target => events.push(target) })
    return home
  }
  for (const target of ['loading', '']) {
    const home = homeEntry(target), before = consumeCount
    const start = home.enterGameScene(); home.enterGameScene()
    assert.equal(consumeCount, before + 1); acceptEnergy({ accepted: true }); await start
    assert.equal(events[events.length - 1], target || 'game')
  }
  const homeOngoing = homeEntry('loading'), before = consumeCount
  homeOngoing.startGameFromHome(); assert.equal(consumeCount, before); assert.equal(events[events.length - 1], 'game')
  console.log('实际入口：新局只扣一次、续局直达、空 loading 兜底、game/loading 直接预览、生成/恢复注入、最低时长、交接失败/离场、重开失败/成功及子组件字段清空后父销毁通过')
}
await verify()
console.log(`外观验证（${cocosSpread ? 'Creator loose 展开编译' : 'Node 原生迭代'}）通过`)
}

const timeout = setTimeout(() => { console.error('外观验证超时，存在未结束的资源等待'); process.exitCode = 1 }, 30000)
;(async () => { await verifyMode(false); await verifyMode(true) })()
  .catch(error => { console.error(error); process.exitCode = 1 })
  .finally(() => clearTimeout(timeout))
