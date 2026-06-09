import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  LabelShadow,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
  ParticleSystem2D
} from 'cc'

const { ccclass } = _decorator

type PieceStyle = {
  bg: string
  text?: string
}

// 未命中样式表时的兜底颜色，避免出现空样式导致棋子不可见。
const DEFAULT_STYLE: PieceStyle = {
  bg: '#f04a9c'
}

// 旧版棋子色板备份，后续如果需要回滚或对比饱和度，可以直接参考这里。
const ORIGINAL_PIECE_STYLE: Record<number, PieceStyle> = {
  2: { bg: '#ff89d1' },
  4: { bg: '#7c55fa' },
  8: { bg: '#a55fd4' },
  16: { bg: '#14e2de' },
  32: { bg: '#62ccfe' },
  64: { bg: '#89e66c' },
  128: { bg: '#f87275' },
  256: { bg: '#a46f62' },
  512: { bg: '#8d949c' },
  1024: { bg: '#ffb659' }
}

// 不同数字对应不同底色，数字越大颜色层次越靠后，方便玩家快速识别等级。
const PIECE_STYLE: Record<number, PieceStyle> = {
  2: { bg: '#f8ecdc', text: '#263745' },
  4: { bg: '#ffc928' },
  8: { bg: '#35d6b7' },
  16: { bg: '#ff5a45' },
  32: { bg: '#178fd8' },
  64: { bg: '#7a5cff' },
  128: { bg: '#32c85f' },
  256: { bg: '#ff8a1f' },
  512: { bg: '#d947ef' },
  1024: { bg: '#f23f8f' }
}

@ccclass('PieceController')
export class PieceController extends Component {
  // 棋子统一使用 8 像素圆角，与棋盘内层圆角保持一致。
  private static readonly CORNER_RADIUS = 8

  // 当前棋子的数值。
  private value = 2
  // 原始 Sprite 组件仍然保留引用，便于特效节点复用它的 SpriteFrame。
  private sprite: Sprite | null = null
  // 真实显示棋子底色和圆角外观的 Graphics 组件。
  private bodyGraphics: Graphics | null = null
  // 中间显示数字的 Label。
  private valueLabel: Label | null = null
  // 数字 Label 的尺寸控制组件，用来适配多位数排版。
  private valueTransform: UITransform | null = null
  // 当前棋子底色缓存，特效节点也会读取这个颜色。
  private currentBgColor = new Color(53, 80, 107, 255)
  // 当前文字颜色缓存，便于统一刷新。
  private currentTextColor = new Color(245, 250, 255, 255)
  // 粒子拖尾系统
  private particleSystem: ParticleSystem2D | null = null
  // 记录上一次按尺寸配置拖尾的结果，避免每帧反复重建粒子状态。
  private lastTrailWidth = 0
  private lastTrailHeight = 0

  // 初始化圆角棋子外观、数值文本引用以及文本特效。
  onLoad() {
    this.sprite = this.ensureRoundedBody()
    const valueNode = this.node.getChildByName('Value')
    this.valueLabel = valueNode?.getComponent(Label) ?? null
    this.valueTransform = valueNode?.getComponent(UITransform) ?? null
    this.particleSystem = this.node.getChildByName('TrailEmitter')?.getComponent(ParticleSystem2D) ?? null
    this.ensureLabelEffects()
    this.refreshView()
    this.syncTrailEffect()
  }

  // 供外部逻辑读取棋子数值。
  getValue() {
    return this.value
  }

  /**
   * 根据棋子运行时尺寸校准拖尾发射器。
   *
   * 拖尾节点挂在棋子预制体内部，但棋子的真实尺寸会由棋盘布局动态决定。
   * 因此这里统一根据当前 `UITransform` 重算发射区域、粒子尺寸、速度和颜色，
   * 同时缓存上一次尺寸，避免每帧重复改写粒子系统造成表现抖动。
   *
   * @param force 是否强制刷新；棋子数值变化导致颜色变化时需要传入 true。
   */
  syncTrailEffect(force = false) {
    if (!this.particleSystem) {
      return
    }

    const rootTransform = this.node.getComponent(UITransform)
    const width = rootTransform?.contentSize.width ?? 120
    const height = rootTransform?.contentSize.height ?? width
    const shouldReconfigure =
      force ||
      this.lastTrailWidth !== width ||
      this.lastTrailHeight !== height

    if (!shouldReconfigure) {
      return
    }

    this.lastTrailWidth = width
    this.lastTrailHeight = height
    const emitterNode = this.particleSystem.node
    const emitterTransform = emitterNode.getComponent(UITransform) ?? emitterNode.addComponent(UITransform)

    // 棋子向下运动时，拖尾应从上缘留在运动路径上，看起来才会贴在棋子后方。
    emitterNode.setSiblingIndex(0)
    emitterNode.setPosition(0, height * 0.46, 0)
    emitterTransform.setContentSize(width, Math.max(24, height * 0.3))

    const particle = this.particleSystem as any
    particle.sourcePos = new Vec2(0, 0)
    particle.posVar = new Vec2(width * 0.5, height * 0.04)
    particle.startSize = Math.max(30, width * 0.3)
    particle.startSizeVar = Math.max(4, width * 0.08)
    particle.endSize = Math.max(6, width * 0.06)
    particle.endSizeVar = Math.max(2, width * 0.03)
    particle.life = 0.38
    particle.lifeVar = 0.08
    particle.speed = Math.max(110, height)
    particle.speedVar = Math.max(32, height * 0.3)
    particle.angle = 90
    particle.angleVar = 12
    particle.emissionRate = 260
    particle.totalParticles = 56
    particle._totalParticles = 56
    this.syncTrailColor(particle, 235, 70)
    // 使用 FREE 位置类型，让已经生成的粒子停在世界路径上，形成真正的拖尾。
    particle.positionType = 0
  }

  /**
   * 让拖尾颜色跟随棋子底色，并从起点到尾端逐渐变浅。
   *
   * Cocos 粒子组件在不同版本里可能同时读取公开字段和内部序列化字段，
   * 所以这里同步写入两组颜色字段，保证预览和运行时表现一致。
   *
   * @param particle 粒子系统实例，使用 any 是为了兼容内部颜色字段。
   * @param startAlpha 靠近棋子位置的起始透明度。
   * @param endAlpha 拖尾尾端的结束透明度。
   */
  private syncTrailColor(particle: any, startAlpha: number, endAlpha: number) {
    const baseColor = this.currentBgColor
    const startColor = new Color(
      Math.round(baseColor.r * 0.92),
      Math.round(baseColor.g * 0.92),
      Math.round(baseColor.b * 0.92),
      startAlpha
    )
    const endColor = new Color(
      Math.round(baseColor.r + (255 - baseColor.r) * 0.45),
      Math.round(baseColor.g + (255 - baseColor.g) * 0.45),
      Math.round(baseColor.b + (255 - baseColor.b) * 0.45),
      endAlpha
    )

    particle.startColor = startColor
    particle.endColor = endColor
    particle.startColorVar = new Color(18, 18, 18, 12)
    particle.endColorVar = new Color(10, 10, 10, 8)
    particle._startColor = startColor
    particle._endColor = endColor
    particle._startColorVar = new Color(18, 18, 18, 12)
    particle._endColorVar = new Color(10, 10, 10, 8)
  }

  // 停止拖尾，棋子落地后不再继续喷射粒子。
  stopParticle() {
    if (this.particleSystem) {
      this.particleSystem.resetSystem()
      this.particleSystem.stopSystem()
    }
  }

  // 返回原始 SpriteFrame，供拖尾和合并粒子复用。
  getSpriteFrame(): SpriteFrame | null {
    return this.sprite?.spriteFrame ?? null
  }

  // 返回一份底色拷贝，避免外部直接修改内部颜色对象。
  getBackgroundColor() {
    return this.currentBgColor.clone()
  }

  // 返回一份文字颜色拷贝，避免外部直接修改内部颜色对象。
  getTextColor() {
    return this.currentTextColor.clone()
  }

  // 更新棋子数值后，立即刷新底色和文本显示。
  setValue(value: number) {
    this.value = value
    this.refreshView()
    this.syncTrailEffect(true)
  }

  // 统一配置数字文本样式，保证不同位数下的观感尽量稳定。
  private ensureLabelEffects() {
    if (!this.valueLabel) {
      return
    }

    const shadow = this.valueLabel.getComponent(LabelShadow) ?? this.valueLabel.addComponent(LabelShadow)
    shadow.offset = new Vec2(0, 0)
    shadow.blur = 0
    shadow.color = new Color(255, 255, 255, 0)

    this.valueLabel.fontFamily = 'Courier New'
    this.valueLabel.isBold = true
    // 这里统一设置字体和粗细，减少不同数字长度带来的观感跳动。
  }

  /**
   * 确保棋子使用 Graphics 绘制圆角底板。
   *
   * 预制体根节点保留 Sprite 是为了兼容资源引用和特效贴图复用，
   * 实际棋子外观由 Body 子节点上的 Graphics 绘制，方便根据数字颜色动态重绘。
   *
   * @returns 根节点原始 Sprite，用于后续特效节点复用 SpriteFrame。
   */
  private ensureRoundedBody() {
    const rootTransform = this.node.getComponent(UITransform)
    const sourceSprite = this.node.getComponent(Sprite)
    const width = rootTransform?.contentSize.width ?? 120
    const height = rootTransform?.contentSize.height ?? 120

    let body = this.node.getChildByName('Body')
    if (!body) {
      body = new Node('Body')
      body.setParent(this.node)
      body.setSiblingIndex(0)
    }

    const bodyTransform = body.getComponent(UITransform) ?? body.addComponent(UITransform)
    bodyTransform.setContentSize(width, height)

    const graphics = body.getComponent(Graphics) ?? body.addComponent(Graphics)
    this.bodyGraphics = graphics

    if (sourceSprite) {
      sourceSprite.enabled = false
    }

    return sourceSprite
  }

  /**
   * 按当前尺寸和底色重绘棋子的圆角底板。
   *
   * 棋子尺寸会跟随棋盘布局变化，不能依赖预制体里的固定像素。
   * 每次数值或尺寸变化后都通过这里重新计算圆角半径和绘制范围。
   */
  private redrawRoundedBody() {
    if (!this.bodyGraphics) {
      return
    }

    const rootTransform = this.node.getComponent(UITransform)
    const width = rootTransform?.contentSize.width ?? 120
    const height = rootTransform?.contentSize.height ?? 120
    const radius = Math.min(PieceController.CORNER_RADIUS, width * 0.5, height * 0.5)

    this.bodyGraphics.clear()
    this.bodyGraphics.fillColor = this.currentBgColor
    this.bodyGraphics.roundRect(-width * 0.5, -height * 0.5, width, height, radius)
    this.bodyGraphics.fill()
  }

  /**
   * 按当前数值刷新棋子的完整显示状态。
   *
   * 这里集中处理数字对应色板、文字颜色、圆角底板重绘以及多位数字排版，
   * 避免外部逻辑直接操作棋子内部节点，保持棋子视图更新入口统一。
   */
  private refreshView() {
    const style = PIECE_STYLE[this.value] ?? DEFAULT_STYLE
    this.currentBgColor = this.fromHex(style.bg)
    this.currentTextColor = style.text ? this.fromHex(style.text) : new Color(255, 255, 255, 255)

    this.redrawRoundedBody()

    if (!this.valueLabel) {
      return
    }

    const digits = `${this.value}`.length
    const blockSize = this.node.getComponent(UITransform)?.contentSize.width ?? 120
    const scale = blockSize / 120
    this.valueLabel.string = `${this.value}`
    this.valueLabel.color = this.currentTextColor
    // 根据棋子尺寸缩放字体，避免棋盘缩小时数字仍然过大而溢出边界。
    const baseFontSize = digits >= 5 ? 40 : digits === 4 ? 52 : digits === 3 ? 64 : 76
    this.valueLabel.fontSize = Math.round(baseFontSize * scale)
    this.valueLabel.lineHeight = this.valueLabel.fontSize
    this.valueLabel.spacingX = Math.round((digits >= 5 ? -6 : digits === 4 ? -4 : digits === 3 ? -2 : 0) * scale)

    if (this.valueTransform) {
      // 多位数字需要更宽的文本框，否则 512、1024 这类数字容易挤出圆角块。
      const width = Math.min(
        blockSize,
        Math.round((digits >= 5 ? 120 : digits === 4 ? 116 : digits === 3 ? 110 : 104) * scale)
      )
      const height = Math.round((digits >= 4 ? 88 : 96) * scale)
      this.valueTransform.setContentSize(width, height)
    }
  }

  // 把十六进制颜色字符串转成 Cocos Color，便于直接应用到 Graphics 和 Label。
  private fromHex(hex: string) {
    const color = new Color()
    Color.fromHEX(color, hex)
    return color
  }
}
