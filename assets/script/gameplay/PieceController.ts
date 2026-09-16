import {
  _decorator,
  Color,
  Component,
  Label,
  ParticleSystem2D,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2
} from 'cc'

const { ccclass, property } = _decorator

type PieceDecoration = 'none' | 'sparkle' | 'crown'

type PieceStyle = {
  bodyColor: string
  textColor?: string
  outlineColor?: string
  decoration?: PieceDecoration
  textScale?: number
}

const DEFAULT_STYLE: PieceStyle = {
  bodyColor: '#cf586d'
}

// 色阶沿用设计稿的暖色低级块、冷色中级块和深青色皇冠终局块。
const PIECE_STYLE: Record<number, PieceStyle> = {
  2: { bodyColor: '#f8ecdc' },
  4: { bodyColor: '#f7a536' },
  8: { bodyColor: '#ffc22e' },
  16: { bodyColor: '#9bc849' },
  32: { bodyColor: '#50ae61' },
  64: { bodyColor: '#35a1a5' },
  128: { bodyColor: '#3f88c7' },
  256: { bodyColor: '#5872c8' },
  512: { bodyColor: '#6e55b8' },
  1024: { bodyColor: '#8f54ad', textScale: 0.94 },
  2048: { bodyColor: '#cf586d', textScale: 0.9 },
  4096: { bodyColor: '#db5935', textScale: 0.9 },
  8192: {
    bodyColor: '#2f6c78',
    textColor: '#ffe4a0',
    outlineColor: '#e8ad2d',
    decoration: 'crown',
    textScale: 0.86
  }
}

@ccclass('PieceController')
export class PieceController extends Component {
  @property({ type: SpriteFrame, tooltip: '128 以上棋子使用的星点装饰' })
  sparkleSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '8192 及以上棋子使用的皇冠装饰' })
  crownSpriteFrame: SpriteFrame | null = null

  private value = 2
  private shadowSprite: Sprite | null = null
  private bodySprite: Sprite | null = null
  private outlineSprite: Sprite | null = null
  private highlightSprite: Sprite | null = null
  private decorationSprite: Sprite | null = null
  private valueLabel: Label | null = null
  private valueTransform: UITransform | null = null
  private particleSystem: ParticleSystem2D | null = null
  private currentBgColor = new Color(248, 236, 220, 255)
  private currentTextColor = new Color(61, 43, 36, 255)
  private lastLayoutWidth = 0
  private lastLayoutHeight = 0
  private lastTrailColorValue = -1

  onLoad() {
    this.resolveViewNodes()
    this.configureView()
    this.refreshView()
    this.syncLayout(true)
  }

  getValue() {
    return this.value
  }

  /** 数值是棋子表现的唯一入口，颜色、文字、装饰和拖尾在同一帧完成刷新。 */
  setValue(value: number) {
    this.value = value
    this.refreshView()
    this.syncLayout(true)
  }

  /**
   * 根据根节点实时尺寸同步所有可见图层。
   * PlayController 会先改变根 UITransform，再调用本方法，因此不能依赖 Prefab 的 120 像素初始值。
   */
  syncLayout(force = false) {
    const rootTransform = this.node.getComponent(UITransform)
    const width = rootTransform?.contentSize.width ?? 120
    const height = rootTransform?.contentSize.height ?? width
    if (!force && this.lastLayoutWidth === width && this.lastLayoutHeight === height) {
      return
    }

    this.lastLayoutWidth = width
    this.lastLayoutHeight = height
    this.resizeSpriteNode(this.shadowSprite, width * 1.06, height * 1.06, 0, -height * 0.025)
    this.resizeSpriteNode(this.bodySprite, width, height)
    this.resizeSpriteNode(this.outlineSprite, width, height)
    this.resizeSpriteNode(this.highlightSprite, width, height)
    this.resizeSpriteNode(this.decorationSprite, width, height)
    this.refreshValueLayout(width, height)
    this.syncTrailLayout(width, height, true)
  }

  // 兼容旧调用点：拖尾尺寸同步现在会连同整颗棋子的分层布局一起刷新。
  syncTrailEffect(force = false) {
    this.syncLayout(force)
  }

  stopParticle() {
    if (!this.particleSystem) {
      return
    }
    this.particleSystem.resetSystem()
    this.particleSystem.stopSystem()
  }

  // 技能碎片和合并临时棋子只复制主体图，不复制数字、描边和皇冠。
  getSpriteFrame(): SpriteFrame | null {
    return this.bodySprite?.spriteFrame ?? null
  }

  getBackgroundColor() {
    return this.currentBgColor.clone()
  }

  getTextColor() {
    return this.currentTextColor.clone()
  }

  private resolveViewNodes() {
    this.shadowSprite = this.node.getChildByName('Shadow')?.getComponent(Sprite) ?? null
    this.bodySprite = this.node.getChildByName('Body')?.getComponent(Sprite) ?? null
    this.outlineSprite = this.node.getChildByName('Outline')?.getComponent(Sprite) ?? null
    this.highlightSprite = this.node.getChildByName('Highlight')?.getComponent(Sprite) ?? null
    this.decorationSprite = this.node.getChildByName('Decoration')?.getComponent(Sprite) ?? null
    const valueNode = this.node.getChildByName('Value')
    this.valueLabel = valueNode?.getComponent(Label) ?? null
    this.valueTransform = valueNode?.getComponent(UITransform) ?? null
    this.particleSystem = this.node.getChildByName('TrailEmitter')?.getComponent(ParticleSystem2D) ?? null
  }

  private configureView() {
    const sprites = [
      this.shadowSprite,
      this.bodySprite,
      this.outlineSprite,
      this.highlightSprite,
      this.decorationSprite
    ]
    for (const sprite of sprites) {
      if (!sprite) {
        continue
      }
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      // 保留 160x160 原始透明画布坐标，星点和皇冠才不会被自动裁边后放大到整颗棋子。
      sprite.trim = false
    }

    if (this.shadowSprite) {
      this.shadowSprite.color = new Color(255, 255, 255, 150)
    }
    if (this.highlightSprite) {
      this.highlightSprite.color = new Color(255, 255, 255, 125)
    }
    if (this.valueLabel) {
      this.valueLabel.isBold = false
      this.valueLabel.enableShadow = false
      this.valueLabel.enableOutline = true
    }
    if (this.particleSystem) {
      // 游戏页改用固定橙色虚线落子指引，不再用高光粒子拖尾干扰手绘风格。
      this.particleSystem.stopSystem()
      this.particleSystem.node.active = false
    }
  }

  private refreshView() {
    const style = PIECE_STYLE[this.value] ?? DEFAULT_STYLE
    this.currentBgColor = this.fromHex(style.bodyColor)
    this.currentTextColor = this.fromHex(style.textColor ?? '#fff9ea')

    if (this.bodySprite) {
      this.bodySprite.color = this.currentBgColor
    }
    if (this.outlineSprite) {
      this.outlineSprite.color = this.fromHex(style.outlineColor ?? '#4b3528')
    }

    this.refreshDecoration(style.decoration ?? 'none')
    this.refreshValueLabel(style)
    this.lastTrailColorValue = -1
  }

  private refreshDecoration(decoration: PieceDecoration) {
    const sprite = this.decorationSprite
    if (!sprite) {
      return
    }

    if (decoration === 'none') {
      sprite.node.active = false
      return
    }

    sprite.node.active = true
    sprite.spriteFrame = decoration === 'crown' ? this.crownSpriteFrame : this.sparkleSpriteFrame
    sprite.enabled = !!sprite.spriteFrame
  }

  private refreshValueLabel(style: PieceStyle) {
    if (!this.valueLabel) {
      return
    }

    this.valueLabel.string = `${this.value}`
    this.valueLabel.color = this.currentTextColor
    const usesDarkText = (style.textColor ?? '').toLowerCase() === '#3d2b24'
    this.valueLabel.outlineColor = usesDarkText
      ? new Color(255, 249, 234, 235)
      : new Color(74, 49, 37, 235)
    this.valueLabel.outlineWidth = 2
  }

  private refreshValueLayout(width: number, height: number) {
    if (!this.valueLabel) {
      return
    }

    const digits = `${this.value}`.length
    const style = PIECE_STYLE[this.value] ?? DEFAULT_STYLE
    const scale = Math.min(width, height) / 120
    const baseFontSize = digits >= 5 ? 32 : digits === 4 ? 37 : digits === 3 ? 46 : 56
    const decorationOffset = style.decoration === 'crown' ? -height * 0.08 : 0
    this.valueLabel.node.setPosition(0, decorationOffset, 0)
    this.valueLabel.fontSize = Math.max(18, Math.round(baseFontSize * scale * (style.textScale ?? 1)))
    this.valueLabel.lineHeight = this.valueLabel.fontSize
    this.valueLabel.spacingX = Math.round((digits >= 5 ? -5 : digits === 4 ? -4 : digits === 3 ? -2 : 0) * scale)
    this.valueLabel.outlineWidth = Math.max(1, Math.round(2 * scale))
    this.valueTransform?.setContentSize(width * 0.92, height * 0.72)
  }

  private resizeSpriteNode(sprite: Sprite | null, width: number, height: number, x = 0, y = 0) {
    if (!sprite) {
      return
    }
    const transform = sprite.node.getComponent(UITransform) ?? sprite.node.addComponent(UITransform)
    transform.setContentSize(width, height)
    sprite.node.setPosition(x, y, 0)
  }

  private syncTrailLayout(width: number, height: number, force: boolean) {
    if (!this.particleSystem) {
      return
    }

    const emitterNode = this.particleSystem.node
    const emitterTransform = emitterNode.getComponent(UITransform) ?? emitterNode.addComponent(UITransform)
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
    particle.positionType = 0

    if (force || this.lastTrailColorValue !== this.value) {
      this.lastTrailColorValue = this.value
      this.syncTrailColor(particle, 220, 55)
    }
  }

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
    particle.startColorVar = new Color(14, 14, 14, 10)
    particle.endColorVar = new Color(8, 8, 8, 6)
    particle._startColor = startColor
    particle._endColor = endColor
    particle._startColorVar = particle.startColorVar
    particle._endColorVar = particle.endColorVar
  }

  private fromHex(hex: string) {
    const color = new Color()
    Color.fromHEX(color, hex)
    return color
  }
}
