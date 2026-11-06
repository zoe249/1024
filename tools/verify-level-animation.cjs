// 用实际无尽代码生成动作轨迹，对照闯关独立实现，避免只检查最终棋盘。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.argv[2] || 'typescript')
const { environment } = require('./verify-refactor.cjs')
const root = path.resolve(__dirname, '..')
const plain = value => JSON.parse(JSON.stringify(value))
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-7, `${message}: ${a} != ${b}`)

function load(name, cc, math = Math) {
  const module = { exports: {} }
  const file = path.join(root, `assets/script/level/${name}.ts`)
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(output, { module, exports: module.exports, require: id => { assert.equal(id, 'cc'); return cc }, Math: math })
  return module.exports
}
const animation = load('LevelAnimation', {})
const env = environment(false)
const { PlayController } = env.load('assets/script/gameplay/PlayController.ts')
const controller = Object.create(PlayController.prototype)
Object.assign(controller, { pieceSize: 112, scoreManager: { updateHighestPieceValue() {} },
  spawnUpgradeImpact() {}, spawnMergeFlash() {}, spawnMergeBurst() {}, spawnSkillShatterParticles() {} })

// 将真实Tween记录展开为时间轨迹，包括同帧的Node和UIOpacity目标。
function timeline(ops, offset = 0, frames = []) {
  let time = offset
  for (const [kind, ...args] of ops) {
    if (kind === 'delay') time += args[0]
    if (kind === 'to') { frames.push({ start: time, duration: args[0], props: args[1], easing: args[2]?.easing }); time += args[0] }
    if (kind === 'sequence') time = timeline(args.flat(), time, frames).time
    if (kind === 'parallel') time = Math.max(time, ...args.map(child => timeline(child, time, frames).time))
  }
  return { time, frames }
}
function sample(frames, time, initial) {
  const value = plain(initial)
  const ease = (kind, t) => kind === 'sineOut' ? Math.sin(t * Math.PI / 2) : kind === 'sineInOut' ? (1 - Math.cos(Math.PI * t)) / 2 : kind === 'quadOut' ? 1 - (1 - t) ** 2 : t
  for (const frame of frames) {
    if (time < frame.start) continue
    const t = ease(frame.easing, Math.min(1, (time - frame.start) / frame.duration))
    for (const [key, end] of Object.entries(frame.props)) {
      const from = value[key]
      value[key] = typeof end === 'number' ? from + (end - from) * t : Object.fromEntries(Object.keys(end).map(axis => [axis, from[axis] + (end[axis] - from[axis]) * t]))
    }
  }
  return value
}
for (let index = 0; index < 6; index++) {
  const node = new env.cc.Node('ClearReference'); node.setPosition(122, -244, 0)
  env.trace.length = 0
  controller.animateConsumedPieceClear({ node }, index)
  const record = env.trace.find(item => item[0] === 'start')
  const frames = timeline(record[2]).frames
  for (let frame = 0; frame <= 54; frame++) {
    const elapsed = frame / 120
    const expected = sample(frames, elapsed, { scale: { x: 1, y: 1, z: 1 }, opacity: 255, position: { x: 122, y: -244, z: 0 } })
    const actual = animation.sampleLevelClear(elapsed, index, 112)
    near(actual.scale, expected.scale.x, '原地消除缩放')
    near(actual.opacity, expected.opacity, '原地消除透明度')
    near(actual.rise, expected.position.y + 244, '原地消除微升')
    near(expected.position.x, 122, '消除不向锚点吸附')
  }
}
env.trace.length = 0
const anchor = { node: new env.cc.Node('AnchorReference'), setValue() {} }
controller.animateAnchorUpgrade(anchor, new env.cc.Vec3(), 8, 1, 1, false)
const upgrade = timeline(env.trace.find(item => item[0] === 'start')[2])
near(upgrade.time + .1, animation.LEVEL_MERGE_DURATION, '完整合并时间')
for (let frame = 0; frame < 60; frame++) {
  const time = frame / 120
  const expected = sample(upgrade.frames, Math.max(0, time - .1), { scale: { x: 1, y: 1, z: 1 } })
  const actual = animation.sampleLevelUpgrade(time)
  near(actual.scale, expected.scale.x, '升级三段回弹')
  assert.equal(actual.upgraded, time >= .1)
}
env.trace.length = 0
controller.animateMove(new env.cc.Node('GravityReference'), new env.cc.Vec3(0, -122, 0), .12)
const gravity = timeline(env.trace.find(item => item[0] === 'start')[2])
near(gravity.time, animation.LEVEL_GRAVITY_DURATION, '重力时长')
const gameScene = JSON.parse(fs.readFileSync(path.join(root, 'assets/scence/game.scene')))
assert.equal(animation.LEVEL_DROP_SPEED, gameScene.find(c => c.fastFallSpeed)?.fastFallSpeed)

function compareEffects(name, method, args) {
  const results = [false, true].map(level => {
    const e = environment(false)
    e.cc.Graphics.LineCap = { ROUND: 1 }
    for (const op of ['close', 'circle']) e.cc.Graphics.prototype[op] = function(...values) { this.ops.push([op, ...values]) }
    let seed = 1024
    const math = Object.create(Math)
    math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
    const layer = new e.cc.Node('FxLayer')
    const { TransientFxRegistry } = e.load('assets/script/gameplay/TransientFxRegistry.ts')
    const registry = new TransientFxRegistry(18)
    const Class = level ? load(name, e.cc, math)[name] : e.load(`assets/script/gameplay/${name === 'LevelEffects' ? 'PlayEffects' : 'ComboFeedbackView'}.ts`)[name === 'LevelEffects' ? 'PlayEffects' : 'ComboFeedbackView']
    const instance = name === 'LevelEffects' ? new Class(registry, 112, () => layer) : new Class(registry)
    const piece = { getSpriteFrame: () => ({ name: 'body' }), getBackgroundColor: () => new e.cc.Color(50, 174, 97, 255) }
    if (name === 'LevelEffects') instance[method](piece, new e.cc.Vec3(122, -244, 0), ...args)
    else instance.play({ parent: layer, anchorPosition: new e.cc.Vec3(244, 366, 0), chainDepth: args[0], pieceSize: 112, bounds: { left: -300, right: 300, top: 422, bottom: -422 } })
    return { tree: e.snapshot(layer), trace: e.trace }
  })
  assert.deepEqual(plain(results[1]), plain(results[0]), `${name}.${method}必须与无尽表现一致`)
}
for (const [method, args] of [['spawnSkillShatterParticles', [3, .24]], ['spawnUpgradeImpact', [2]], ['spawnMergeFlash', [2]], ['spawnMergeBurst', [2]]]) compareEffects('LevelEffects', method, args)
for (const depth of [2, 3, 4, 5, 8]) compareEffects('LevelComboFeedback', 'play', [depth])
console.log('动画对照通过：120Hz逐帧原地消除与三段回弹、重力时长、快速落子速度、四种特效及五档连击字效均与无尽实际代码一致')
