// 检查实际玩法与 UI 方法；模拟广告回执，不替代微信广告及 Creator 运行验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.argv[2] || 'typescript')
const root = path.resolve(__dirname, '..')
const skills = ['bomb', 'hammer', 'swap']
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
class Component {}
class Graphics {}
class Sprite {}
class Label {}
const cc = {
  _decorator: { ccclass: () => type => type, property: () => () => {} },
  Component, Graphics, Sprite, Label, Color: class {},
  Tween: { stopAllByTarget() {} },
  tween: () => { const chain = { by: () => chain, repeatForever: () => chain, start() {} }; return chain }
}
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true
  } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, console,
    require: name => name === 'cc' ? cc : dependencies[name] || {} }, { filename: file })
  return module.exports
}
const boardConfig = load('assets/script/gameplay/BoardConfig.ts')
const { OngoingGameSession } = load('assets/script/gameplay/OngoingGameSession.ts', { './BoardConfig': boardConfig })
const { PlayController } = load('assets/script/gameplay/PlayController.ts', {
  './BoardConfig': boardConfig, './OngoingGameSession': { OngoingGameSession },
  '../online/leaderboard/OvertakeRivalStore': { OvertakeRivalStore: { getInstance: () => ({ resolveOvertake: () => null }) } }
})
const { PlayUIController } = load('assets/script/gameplay/PlayUIController.ts')
function harness(initialStock = 0) {
  const stocks = Object.fromEntries(skills.map(skill => [skill, initialStock]))
  const consumed = [], requests = [], states = []
  const controller = Object.create(PlayController.prototype)
  Object.assign(controller, {
    isValid: true, node: { isValid: true }, hasStartedSession: true,
    boardwidth: 5, boardheight: 7, currentColumn: 2, nextPieceValue: 2,
    currentPiece: { getValue: () => 2, node: { position: { y: 500 } } },
    firstEntryTutorialStep: 0, isGameOver: false, isResolving: false, isPaused: false,
    isBombSkillActive: false, isHammerSkillActive: false, isSwapSkillActive: false,
    isFastDropping: true, trailTimer: 0, skillAdLoading: null, skillAdRequestVersion: 1,
    basePieceController: {},
    boardModel: { createEmptyBoard: (rows, columns) => Array.from({ length: rows }, () => Array(columns).fill(null)) },
    scoreManager: { reset() {}, restore() {}, getBoardScore: () => 0, getBonusScore: () => 0, getHighestPieceValue: () => 2 },
    economy: {
      getSnapshot: () => ({ coins: 0 }), hasSkill: skill => stocks[skill] > 0,
      consumeSkill: skill => { if (!stocks[skill]) return false; stocks[skill]--; consumed.push(skill); return true }
    },
    rewardedAdAdapter: { show: () => new Promise(resolve => requests.push({ resolve })) },
    getNearestAvailableColumn: () => 2,
    randomBasePieceValue: () => 2,
    refreshUiState: () => states.push(controller.buildUiState())
  })
  controller.resetBoard()
  return { controller, stocks, consumed, requests, states }
}
function assertBadge(controller, skill, expectedAd, expectedCount) {
  const children = new Map()
  for (const name of ['Value', 'AdIcon', 'AdLoading']) children.set(name, { active: false, angle: 0 })
  const label = new Label(); label.node = children.get('Value')
  label.node.getComponent = () => label
  const background = new Graphics()
  const badge = { getChildByName: name => children.get(name), getComponent: type => type === Graphics ? background : null }
  const ui = Object.create(PlayUIController.prototype)
  ui.currentState = controller.buildUiState()
  ui.getSkillBox = () => ({ getChildByName: () => null })
  ui.refreshSingleSkillCount(skill, { getChildByName: name => name === 'CountBadge' ? badge : null })
  assert.equal(children.get('AdIcon').active, expectedAd)
  assert.equal(children.get('Value').active, !expectedAd && !ui.currentState.skillAdLoading)
  if (expectedCount !== undefined) assert.equal(label.string, `${expectedCount}`)
}
async function verify() {
  for (const skill of skills) {
    const h = harness(), c = h.controller
    assert.equal(c.buildUiState().skillAdAvailable[skill], true, `${skill}：零库存新开局必须有广告机会`)
    assertBadge(c, skill, true)
    const tap = { bomb: 'toggleBombSkillFromUi', hammer: 'toggleHammerSkillFromUi', swap: 'toggleSwapSkillFromUi' }[skill]
    c[tap](); c[tap]()
    assert.equal(h.requests.length, 1)
    assert.equal(c.skillAdLoading, skill); assert.equal(c.isFastDropping, false)
    h.requests[0].resolve('completed'); await flush()
    assert.equal(c.getSkillRemainingCount(skill), 1)
    assert.equal(c.isFastDropping, true); assert.equal(c.skillAdLoading, null)
    assert.equal(h.consumed.length, 0)
    assert.ok(!c.isBombSkillActive && !c.isHammerSkillActive && !c.isSwapSkillActive)
    assertBadge(c, skill, false, 1)

    // 零库存领取的奖励需跨首页续局保留，使用后不能重新领取。
    c.currentPiece = null
    OngoingGameSession.beginNewGame(c.buildBoardConfig())
    OngoingGameSession.save(c.buildOngoingGameSnapshot())
    const resumed = harness(), r = resumed.controller
    r.restoreOngoingGame(OngoingGameSession.consumeSnapshot())
    assert.equal(r.getSkillRemainingCount(skill), 1)
    assert.equal(r.consumeSkillUse(skill), true)
    assert.equal(r.consumeSkillUse(skill), false)
    assert.equal(resumed.consumed.length, 0)
    assert.equal(r.isSkillAdAvailable(skill), false)
    r.currentPiece = null
    r.restoreOngoingGame(r.buildOngoingGameSnapshot())
    assert.equal(r.isSkillAdAvailable(skill), false)
    assertBadge(r, skill, false, 0)
    r.resetBoard(); assert.equal(r.isSkillAdAvailable(skill), true)

    const stocked = harness(3), s = stocked.controller
    assertBadge(s, skill, false, 1)
    assert.equal(s.ensureSkillAvailable(skill), true); assert.equal(stocked.requests.length, 0)
    assert.equal(s.consumeSkillUse(skill), true); assert.equal(stocked.stocks[skill], 2)
    assertBadge(s, skill, true)
    const watched = s.watchSkillRewardedAd(skill)
    stocked.requests[0].resolve('completed'); await watched
    assert.equal(s.consumeSkillUse(skill), true); assert.equal(stocked.stocks[skill], 2)
    assert.equal(s.consumeSkillUse(skill), false); assert.equal(s.isSkillAdAvailable(skill), false)
    assert.ok(skills.filter(other => other !== skill).every(other => s.isSkillAdAvailable(other)))

    for (const result of ['cancelled', 'failed', 'unsupported', 'busy']) {
      const cancelled = harness(), p = cancelled.controller.watchSkillRewardedAd(skill)
      cancelled.requests[0].resolve(result); await p
      assert.equal(cancelled.controller.getSkillRemainingCount(skill), 0)
      assert.equal(cancelled.controller.isSkillAdAvailable(skill), true)
      assertBadge(cancelled.controller, skill, true)
    }
    for (const exit of ['reset', 'destroy']) {
      const late = harness(), pending = late.controller.watchSkillRewardedAd(skill)
      if (exit === 'reset') late.controller.resetBoard()
      else {
        late.controller.isValid = false
        for (const key of Object.keys(late.controller)) {
          if (typeof late.controller[key] === 'object' || typeof late.controller[key] === 'function') late.controller[key] = null
        }
      }
      late.requests[0].resolve('completed'); await pending
      if (exit === 'reset') assert.equal(late.controller.skillAdRewards[skill], 'unclaimed')
    }
  }
  console.log('技能广告：三种道具零库存入口、库存优先、每局独立奖励、完成/取消/失败、防重复、续局、新局重置及离场晚回调通过（模拟广告回执与节点销毁）')
}
verify().catch(error => { console.error(error); process.exitCode = 1 })
