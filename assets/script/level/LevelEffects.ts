// 与无尽模式同源的合并表现参数，闯关独立执行并清理。
import { Color, Node, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc'
import type { LevelPieceController } from './LevelPieceController'
import { LevelTransientFx } from './LevelTransientFx'

export class LevelEffects {
  constructor(private readonly transientFx: LevelTransientFx, private readonly pieceSize: number, private readonly getFxLayer: () => Node) {}




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
  spawnSkillShatterParticles(piece: LevelPieceController, position: Vec3, count: number, forceScale: number) {
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
   * 在当前棋子位置生成升级爆点。
   *
   * 爆点使用锚点棋子的外观快速放大淡出，作为数值升级瞬间的主视觉。
   * 它和普通碎片、闪光叠加，但只在当前棋子位置出现，避免又变回“其他棋子飞来合成”的感觉。
   *
   * @param anchor 提供贴图和颜色参考的当前棋子。
   * @param position 爆点中心位置。
   * @param strength 本次消除数量，用来轻微放大爆点规模。
   */
  spawnUpgradeImpact(anchor: LevelPieceController, position: Vec3, strength: number) {
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
  spawnMergeFlash(anchor: LevelPieceController, position: Vec3, strength: number) {
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
  spawnMergeBurst(anchor: LevelPieceController, position: Vec3, strength: number) {
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
  createFxPiece(source: LevelPieceController) {
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
