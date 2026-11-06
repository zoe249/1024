// 执行临时棋子、碎片与冲击波，不读写棋盘、分数或技能次数。
import { Color, Graphics, Node, Sprite, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc'
import type { PieceController } from './PieceController'
import { TransientFxRegistry } from './TransientFxRegistry'

export type ShuffleFeedbackCue = 'gather' | 'shuffle' | 'deal' | 'land'

export class PlayEffects {
  private shuffleClock: { time: number } | null = null
  private shuffleDone: ((completed: boolean) => void) | null = null
  private shuffleTrail: Node | null = null

  static destroyPiece(piece: PieceController) {
    if (!piece.isValid || !piece.node?.isValid) return
    Tween.stopAllByTarget(piece.node)
    const opacity = piece.node.getComponent(UIOpacity)
    if (opacity?.isValid) Tween.stopAllByTarget(opacity)
    piece.node.destroy()
  }

  constructor(
    private readonly transientFx: TransientFxRegistry,
    private pieceSize: number,
    private readonly getFxLayer: () => Node
  ) {}

  setPieceSize(size: number) { this.pieceSize = size }

  /** 停止自身时间轴；棋盘由已提交的阶段快照恢复，不在表现层改写或销毁棋子。 */
  cancelShuffleRedeal() {
    if (this.shuffleClock) Tween.stopAllByTarget(this.shuffleClock)
    this.shuffleClock = null
    if (this.shuffleTrail?.isValid) this.transientFx.destroy(this.shuffleTrail)
    this.shuffleTrail = null
    const done = this.shuffleDone; this.shuffleDone = null; done?.(false)
  }

  /**
   * 收成牌叠、左右交错洗牌，再逐张发出并高速落回；牌在整个过程中保持可见。
   * 这里只移动原节点，不创建新棋子、抽取位置或触发合并，最终结算由玩法层统一执行。
   */
  playShuffleRedeal(
    targets: { node: Node; position: Vec3 }[], gather: Vec3,
    isAlive: () => boolean, onFeedback?: (cue: ShuffleFeedbackCue) => void
  ): Promise<boolean> {
    this.cancelShuffleRedeal()
    if (!targets.length || !isAlive()) return Promise.resolve(false)
    const entries = targets.map((target, i) => {
      Tween.stopAllByTarget(target.node)
      const opacity = target.node.getComponent(UIOpacity) ?? target.node.addComponent(UIOpacity)
      Tween.stopAllByTarget(opacity)
      const body = target.node.getChildByName('Body')?.getComponent(Sprite) ?? null
      const slot = targets.length > 1 ? i / (targets.length - 1) - 0.5 : 0
      return {
        ...target, origin: target.node.position.clone(), opacity, alpha: opacity.opacity, launched: false, landed: false,
        body, bodyColor: body?.color.clone() ?? null,
        deck: gather.clone().add3f(slot * this.pieceSize * 0.24, slot * this.pieceSize * 0.14, 0),
        tilt: slot * 9, side: i % 2 === 0 ? -1 : 1, sibling: target.node.getSiblingIndex()
      }
    })
    const clock = { time: 0 }
    this.shuffleClock = clock
    let speedLines: Graphics | null = null
    if (this.transientFx.canRegister(1)) {
      const trail = new Node('ShuffleSpeedLines')
      trail.addComponent(UITransform)
      trail.setParent(this.getFxLayer())
      speedLines = trail.addComponent(Graphics)
      speedLines.lineWidth = Math.max(2, this.pieceSize * 0.035)
      this.transientFx.register(trail)
      this.shuffleTrail = trail
    }
    const gatherHold = 0.09, gatherMove = 0.42, gatherStagger = Math.min(0.10, (entries.length - 1) * 0.004)
    const gatherEnd = gatherHold + gatherMove + gatherStagger
    const shuffleSeconds = 0.78, shuffleCycle = 0.26, shuffleEnd = gatherEnd + shuffleSeconds
    const squareSeconds = 0.10, firstDropSeconds = shuffleEnd + squareSeconds
    const dropInterval = 0.085, launchSeconds = 0.065, fallSeconds = 0.115, landSeconds = 0.10, impactSeconds = 0.16
    const startY = gather.y + this.pieceSize * 1.5
    const duration = firstDropSeconds + (entries.length - 1) * dropInterval + launchSeconds + fallSeconds + impactSeconds
    const baseSibling = Math.min(...entries.map(entry => entry.sibling))
    let deckOrder = entries.slice(), lastRiffle = 0, gatherCued = false
    const emitCue = (cue: ShuffleFeedbackCue) => {
      onFeedback?.(cue)
      return this.shuffleClock === clock && isAlive()
    }
    const render = () => {
      if (this.shuffleClock !== clock || !isAlive()) return
      const lines = speedLines?.isValid && this.shuffleTrail?.isValid ? speedLines : null
      lines?.clear()
      let dealt = false, landed = false
      if (!gatherCued && clock.time >= gatherHold) {
        gatherCued = true
        if (!emitCue('gather')) return
      }
      if (clock.time >= gatherEnd && clock.time < shuffleEnd) {
        const beat = Math.floor((clock.time - gatherEnd) / (shuffleCycle / 2))
        if (beat > lastRiffle) {
          // 两叠经过中线时交换前后层并交错插入，避免只左右摇晃而没有洗牌感。
          while (lastRiffle < beat) {
            const half = Math.ceil(deckOrder.length / 2), interleaved: typeof entries = []
            for (let j = 0; j < half; j++) {
              if (j + half < deckOrder.length) interleaved.push(deckOrder[j + half])
              interleaved.push(deckOrder[j])
            }
            deckOrder = interleaved; lastRiffle++
          }
          deckOrder.forEach((entry, rank) => { if (entry.node.isValid) entry.node.setSiblingIndex(baseSibling + rank) })
          if (!emitCue('shuffle')) return
        }
        const hitAge = (clock.time - gatherEnd) % (shuffleCycle / 2)
        if (beat > 0) this.drawShuffleImpact(lines, gather.x, gather.y, hitAge / 0.09, this.pieceSize * 1.05, 0.8)
      }
      this.drawShuffleImpact(lines, gather.x, gather.y, (clock.time - firstDropSeconds) / 0.15, this.pieceSize * 1.15, 0.75)
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i], node = entry.node
        if (!node.isValid || !entry.opacity.isValid) continue
        entry.opacity.opacity = entry.alpha
        if (clock.time < gatherEnd) {
          const delay = entries.length > 1 ? i / (entries.length - 1) * gatherStagger : 0
          if (clock.time < gatherHold + delay) {
            const charge = Math.sin(Math.min(1, clock.time / gatherHold) * Math.PI / 2)
            node.setPosition(entry.origin.x, entry.origin.y - this.pieceSize * 0.04 * charge, 0)
            node.setScale(1 + 0.10 * charge, 1 - 0.12 * charge, 1); node.angle = 0
            continue
          }
          const p = Math.max(0, Math.min(1, (clock.time - gatherHold - delay) / gatherMove))
          const move = 1 - Math.pow(1 - p, 3), inverse = 1 - move
          const controlX = (entry.origin.x + entry.deck.x) / 2 + entry.side * this.pieceSize * 0.60
          const controlY = Math.max(entry.origin.y, entry.deck.y) + this.pieceSize * 0.65
          node.setPosition(
            inverse * inverse * entry.origin.x + 2 * inverse * move * controlX + move * move * entry.deck.x,
            inverse * inverse * (entry.origin.y - this.pieceSize * 0.04) + 2 * inverse * move * controlY + move * move * entry.deck.y, 0
          )
          node.angle = entry.tilt * move + entry.side * 12 * Math.sin(Math.PI * p)
          const release = Math.sin(Math.PI * Math.min(1, p / 0.20))
          node.setScale(1.10 - 0.18 * move - 0.08 * release, 0.88 + 0.04 * move + 0.22 * release, 1)
          continue
        }
        if (clock.time < shuffleEnd) {
          const elapsed = clock.time - gatherEnd
          const envelope = Math.min(1, elapsed / 0.07, (shuffleSeconds - elapsed) / 0.07)
          const halfCycle = shuffleCycle / 2, beat = Math.floor(elapsed / halfCycle), local = elapsed % halfCycle
          // 交错点只停留 18ms，停的是牌叠姿态，不暂停引擎或其他动画。
          const hold = beat > 0 ? 0.018 : 0
          const phase = (beat + Math.max(0, (local - hold) / (halfCycle - hold))) * Math.PI
          const wave = Math.sin(phase) * envelope, lift = (1 - Math.cos(phase)) * 0.5 * envelope
          const hit = beat > 0 ? Math.max(0, 1 - local / 0.07) : 0
          node.setPosition(entry.deck.x + entry.side * this.pieceSize * 0.95 * wave, entry.deck.y + entry.side * this.pieceSize * 0.22 * lift, 0)
          node.angle = entry.tilt + entry.side * 13 * wave
          node.setScale(0.92 + 0.02 * lift + 0.10 * hit, 0.92 + 0.02 * lift - 0.10 * hit, 1)
          continue
        }
        const square = Math.min(1, (clock.time - shuffleEnd) / squareSeconds)
        const tighten = square * square * (3 - 2 * square)
        const deckX = gather.x + (entry.deck.x - gather.x) * (1 - 0.7 * tighten)
        const deckY = gather.y + (entry.deck.y - gather.y) * (1 - 0.7 * tighten)
        const elapsed = clock.time - firstDropSeconds - i * dropInterval
        if (elapsed < 0) {
          const charge = Math.sin(Math.PI * square)
          node.setPosition(deckX, deckY, 0); node.setScale(0.92 + 0.10 * charge, 0.92 - 0.14 * charge, 1); node.angle = entry.tilt * (1 - tighten)
          continue
        }
        if (!entry.launched) {
          entry.launched = true
          if (node.parent?.isValid) node.setSiblingIndex(node.parent.children.length - 1)
          // 同帧跨过多个时刻时只触发一份反馈，方便后续接音效而不突然叠响。
          if (!dealt) { dealt = true; if (!emitCue('deal')) return }
        }
        if (elapsed < launchSeconds) {
          const p = elapsed / launchSeconds, inverse = 1 - p
          node.setPosition(
            inverse * inverse * deckX + (1 - inverse * inverse) * entry.position.x,
            inverse * inverse * deckY + 2 * inverse * p * (startY + this.pieceSize * 0.8) + p * p * startY, 0
          )
          node.angle = (entry.position.x < gather.x ? -1 : 1) * 12 * Math.sin(Math.PI * p)
          node.setScale(0.92 - 0.20 * p, 0.92 + 0.58 * p, 1)
          continue
        }
        const fallTime = elapsed - launchSeconds
        const p = Math.min(1, fallTime / fallSeconds)
        const y = startY + (entry.position.y - startY) * p
        node.setPosition(entry.position.x, y, 0)
        node.angle = 0
        if (p < 1) {
          node.setScale(0.72, 1.5, 1)
          if (lines) {
            lines.lineWidth = Math.max(2, this.pieceSize * 0.035)
            lines.strokeColor = new Color(255, 249, 227, Math.round(190 * (1 - p * 0.6)))
            for (let lane = -1; lane <= 1; lane++) {
              const x = entry.position.x + lane * this.pieceSize * 0.23
              lines.moveTo(x, y + this.pieceSize * 0.65)
              lines.lineTo(x, y + this.pieceSize * (lane === 0 ? 2.25 : 1.65))
            }
            lines.stroke()
          }
        } else {
          if (!entry.landed) {
            entry.landed = true
            if (!landed) { landed = true; if (!emitCue('land')) return }
          }
          const age = fallTime - fallSeconds, p = Math.min(1, age / landSeconds)
          const scaleX = p < 0.4 ? 1.24 - 0.30 * (p / 0.4) : 0.94 + 0.06 * ((p - 0.4) / 0.6)
          const scaleY = p < 0.4 ? 0.72 + 0.36 * (p / 0.4) : 1.08 - 0.08 * ((p - 0.4) / 0.6)
          node.setPosition(entry.position.x, entry.position.y + this.pieceSize * (scaleY - 1) / 2, 0)
          node.setScale(scaleX, scaleY, 1)
          if (entry.body?.isValid && entry.bodyColor) {
            const flash = Math.max(0, 1 - age / 0.065) * 0.72, base = entry.bodyColor
            entry.body.color = new Color(base.r + (255 - base.r) * flash, base.g + (249 - base.g) * flash, base.b + (227 - base.b) * flash, base.a)
          }
          this.drawShuffleImpact(lines, entry.position.x, entry.position.y - this.pieceSize / 2, age / impactSeconds, this.pieceSize * 1.1, 0.28)
        }
      }
    }
    return new Promise(resolve => {
      this.shuffleDone = resolve
      render()
      tween(clock).to(duration, { time: duration }, { onUpdate: render }).call(() => {
        if (this.shuffleClock !== clock) return
        const completed = isAlive()
        if (completed) { clock.time = duration; render() }
        this.shuffleClock = null
        if (this.shuffleTrail?.isValid) this.transientFx.destroy(this.shuffleTrail)
        this.shuffleTrail = null
        const done = this.shuffleDone; this.shuffleDone = null; done?.(completed)
      }).start()
    })
  }

  /** 动作碰点共用的扩散圈、短射线和碎点；重绘自身 Alpha，不依赖 Graphics 的 UIOpacity。 */
  private drawShuffleImpact(graphics: Graphics | null, x: number, y: number, p: number, size: number, flat: number) {
    if (!graphics || p < 0 || p >= 1) return
    const alpha = Math.round(230 * (1 - p)), radius = size * (0.22 + 0.75 * p)
    graphics.lineWidth = Math.max(2, size * 0.085 * (1 - p * 0.6))
    graphics.strokeColor = new Color(98, 57, 31, Math.round(alpha * 0.65))
    graphics.ellipse(x, y, radius, radius * flat); graphics.stroke()
    graphics.lineWidth = Math.max(1, size * 0.05 * (1 - p * 0.6))
    graphics.strokeColor = new Color(255, 202, 77, alpha)
    graphics.ellipse(x, y, radius, radius * flat); graphics.stroke()
    graphics.strokeColor = new Color(255, 249, 227, alpha)
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + 0.2, distance = size * (0.40 + 0.75 * p)
      const dx = Math.cos(angle), dy = Math.sin(angle) * flat
      graphics.moveTo(x + dx * distance, y + dy * distance)
      graphics.lineTo(x + dx * (distance + size * 0.20 * (1 - p)), y + dy * (distance + size * 0.20 * (1 - p)))
    }
    graphics.stroke()
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3, distance = size * (0.45 + p)
      const side = size * 0.055 * (1 - p)
      graphics.fillColor = i % 2 ? new Color(255, 129, 88, alpha) : new Color(164, 207, 83, alpha)
      graphics.roundRect(x + Math.cos(angle) * distance - side, y + Math.sin(angle) * distance * flat - side, side * 2, side * 2, side * 0.5)
      graphics.fill()
    }
  }


  /**
   * 生成技能消除专用碎片。
   *
   * 从被消除棋子的贴图和底色派生多个小碎片，沿圆周方向喷射并淡出。
   * 所有碎片都会登记到 transientFx，保证返回首页、重开或落地清理时不会残留。
   *
   * @param piece 提供贴图和底色参考的棋子。
   * @param position 碎片爆发中心。
   * @param count 碎片数量。
   * @param forceScale 扩散距离缩放，炸弹会比锤子更大。
   */
  spawnSkillShatterParticles(piece: PieceController, position: Vec3, count: number, forceScale: number) {
    if (!this.transientFx.canRegister(count)) {
      return
    }

    const spriteFrame = piece.getSpriteFrame()
    const baseColor = piece.getBackgroundColor()
    const particleSize = Math.max(10, this.pieceSize * 0.16)

    for (let i = 0; i < count; i++) {
      const particle = new Node('SkillShatterParticle')
      const transform = particle.addComponent(UITransform)
      const sizeScale = 0.72 + Math.random() * 0.72
      transform.setContentSize(particleSize * sizeScale, particleSize * sizeScale)

      const sprite = particle.addComponent(Sprite)
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.spriteFrame = spriteFrame
      // 粒子颜色在原棋子颜色上做轻微提亮，避免碎片混在背景里看不清。
      sprite.color = new Color(
        Math.min(255, baseColor.r + 35 + Math.random() * 24),
        Math.min(255, baseColor.g + 35 + Math.random() * 24),
        Math.min(255, baseColor.b + 35 + Math.random() * 24),
        255
      )

      const opacity = particle.addComponent(UIOpacity)
      opacity.opacity = 230
      const fxLayer = this.getFxLayer()
      particle.setParent(fxLayer)
      particle.setSiblingIndex(fxLayer.children.length - 1)
      particle.setPosition(position.clone().add3f(
        (Math.random() - 0.5) * this.pieceSize * 0.28,
        (Math.random() - 0.5) * this.pieceSize * 0.28,
        0
      ))
      particle.setScale(new Vec3(0.8, 0.8, 1))
      this.transientFx.register(particle)

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55
      const distance = this.pieceSize * forceScale * (0.38 + Math.random() * 0.42)
      const target = position.clone().add3f(Math.cos(angle) * distance, Math.sin(angle) * distance, 0)
      const endScale = new Vec3(0.18 + Math.random() * 0.12, 0.18 + Math.random() * 0.12, 1)
      const duration = 0.24 + Math.random() * 0.12

      tween(particle)
        .parallel(
          tween().to(duration, { position: target, scale: endScale, eulerAngles: new Vec3(0, 0, 180 + Math.random() * 240) }, { easing: 'quadOut' }),
          tween(opacity).to(duration, { opacity: 0 }, { easing: 'quadIn' })
        )
        .call(() => this.transientFx.destroy(particle))
        .start()
    }
  }


  /**
   * 在炸弹中心生成短暂冲击波。
   *
   * 冲击波使用临时节点表现，大小会随本次命中的棋子数量略微变化，
   * 用来强化炸弹范围和命中反馈。
   *
   * @param position 爆炸中心位置。
   * @param strength 本次炸弹影响的棋子数量。
   */
  spawnBombShockwave(position: Vec3, strength: number) {
    if (!this.transientFx.canRegister(1)) {
      return
    }

    const shockwave = new Node('BombShockwave')
    const transform = shockwave.addComponent(UITransform)
    transform.setContentSize(this.pieceSize * 1.6, this.pieceSize * 1.6)
    const sprite = shockwave.addComponent(Sprite)
    sprite.color = new Color(255, 231, 132, 190)
    const opacity = shockwave.addComponent(UIOpacity)
    opacity.opacity = 140
    shockwave.setParent(this.getFxLayer())
    shockwave.setPosition(position)
    shockwave.setScale(new Vec3(0.35, 0.35, 1))
    this.transientFx.register(shockwave)

    const scale = 1.2 + Math.min(strength, 9) * 0.05
    tween(shockwave)
      .parallel(
        tween().to(0.18, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' }),
        tween(opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' })
      )
      .call(() => this.transientFx.destroy(shockwave))
      .start()
  }


  /**
   * 在当前棋子位置生成升级爆点。
   *
   * 爆点使用锚点棋子的外观快速放大淡出，作为数值升级瞬间的主视觉。
   * 它和普通碎片、闪光叠加，但只在当前棋子位置出现，避免又变回“其他棋子飞来合成”的感觉。
   *
   * @param anchor 提供贴图和颜色参考的当前棋子。
   * @param position 爆点中心位置。
   * @param strength 本次消除数量，用来轻微放大爆点规模。
   */
  spawnUpgradeImpact(anchor: PieceController, position: Vec3, strength: number) {
    if (!this.transientFx.canRegister(1)) {
      return
    }

    const impact = this.createFxPiece(anchor)
    const opacity = impact.addComponent(UIOpacity)
    opacity.opacity = 150
    const fxLayer = this.getFxLayer()
    impact.setParent(fxLayer)
    impact.setSiblingIndex(fxLayer.children.length - 1)
    impact.setPosition(position)
    impact.setScale(new Vec3(0.58, 0.58, 1))

    const sprite = impact.getComponent(Sprite)
    if (sprite) {
      sprite.color = new Color(255, 246, 176, 255)
    }

    this.transientFx.register(impact)
    const targetScale = 1.34 + Math.min(strength, 4) * 0.08
    tween(impact)
      .parallel(
        tween().to(0.26, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'sineOut' }),
        tween(opacity).to(0.26, { opacity: 0 }, { easing: 'sineOut' })
      )
      .call(() => this.transientFx.destroy(impact))
      .start()
  }


  /**
   * 在合并锚点位置生成短暂闪光。
   *
   * 闪光复用棋子贴图并快速放大淡出，用来强调升级瞬间；
   * strength 会轻微影响放大幅度，但仍受特效数量上限约束。
   *
   * @param anchor 提供贴图和颜色参考的锚点棋子。
   * @param position 闪光出现的位置。
   * @param strength 本次合并强度，通常与被消除棋子数量相关。
   */
  spawnMergeFlash(anchor: PieceController, position: Vec3, strength: number) {
    if (!this.transientFx.canRegister(1)) {
      return
    }

    const flash = this.createFxPiece(anchor)
    const opacity = flash.addComponent(UIOpacity)
    opacity.opacity = 88
    flash.setParent(this.getFxLayer())
    flash.setPosition(position)
    flash.setScale(new Vec3(0.82, 0.82, 1))
    const sprite = flash.getComponent(Sprite)
    if (sprite) {
      sprite.color = new Color(255, 248, 214, 255)
    }
    this.transientFx.register(flash)

    const targetScale = 1.08 + Math.min(strength, 2) * 0.05
    tween(flash)
      .parallel(
        tween().to(0.22, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'sineOut' }),
        tween(opacity).to(0.22, { opacity: 0 }, { easing: 'sineOut' })
      )
      .call(() => this.transientFx.destroy(flash))
      .start()
  }

  /**
   * 合并时从锚点向四周喷射碎片粒子。
   *
   * 粒子数量和扩散半径会随 strength 增加，用来区分普通合并和更大的连锁合并。
   * 所有粒子都会登记到 transientFx，便于暂停、返回首页或重开时统一清理。
   *
   * @param anchor 提供贴图和颜色参考的锚点棋子。
   * @param position 粒子爆发中心。
   * @param strength 本次合并强度。
   */
  spawnMergeBurst(anchor: PieceController, position: Vec3, strength: number) {
    const count = Math.min(3, 1 + strength)
    if (!this.transientFx.canRegister(count)) {
      return
    }

    const radius = 28 + strength * 5
    for (let i = 0; i < count; i++) {
      const particle = this.createFxPiece(anchor)
      const opacity = particle.addComponent(UIOpacity)
      opacity.opacity = 120
      const transform = particle.getComponent(UITransform)
      transform?.setContentSize(14, 14)
      particle.setParent(this.getFxLayer())
      particle.setPosition(position)
      particle.setScale(new Vec3(0.14, 0.14, 1))
      this.transientFx.register(particle)

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35
      const distance = radius * (0.75 + Math.random() * 0.4)
      const target = new Vec3(
        position.x + Math.cos(angle) * distance,
        position.y + Math.sin(angle) * distance,
        0
      )

      tween(particle)
        .parallel(
          tween().to(0.24, { position: target, scale: new Vec3(0.08, 0.08, 1) }, { easing: 'sineOut' }),
          tween(opacity).to(0.24, { opacity: 0 }, { easing: 'sineOut' })
        )
        .call(() => this.transientFx.destroy(particle))
        .start()
    }
  }


  // 创建一个用于特效表现的临时棋子节点，复用原棋子的颜色与外观。
  createFxPiece(source: PieceController) {
    const node = new Node('FxPiece')
    const transform = node.addComponent(UITransform)
    transform.setContentSize(this.pieceSize, this.pieceSize)

    const sprite = node.addComponent(Sprite)
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.spriteFrame = source.getSpriteFrame()
    sprite.color = source.getBackgroundColor()
    return node
  }
}
