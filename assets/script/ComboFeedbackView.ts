import { Color, Graphics, Label, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc'
import { TransientFxRegistry } from './TransientFxRegistry'

export type ComboFeedbackBounds = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ComboFeedbackOptions = {
  parent: Node
  anchorPosition: Vec3
  chainDepth: number
  pieceSize: number
  bounds: ComboFeedbackBounds
}

type ComboPalette = {
  title: Color
  count: Color
  outline: Color
  shadow: Color
  burst: Color
}

const COMBO_MIN_DEPTH = 2

/**
 * 运行时绘制消消乐式连击字效，不依赖额外图片资源。
 *
 * 字效只保留一份活动实例：新连击会替换上一层提示，通过放大过冲、回弹、扫光式粒子和
 * 上浮淡出表现层数增长。所有节点挂在 FxLayer，并交给临时特效注册表统一回收。
 */
export class ComboFeedbackView {
  private activeRoot: Node | null = null

  constructor(private readonly transientFx: TransientFxRegistry) {}

  play(options: ComboFeedbackOptions) {
    const chainDepth = Math.max(1, Math.floor(options.chainDepth))
    if (chainDepth < COMBO_MIN_DEPTH || !options.parent.isValid) {
      return
    }

    this.clear()
    if (!this.transientFx.canRegister(1)) {
      return
    }

    const root = new Node('ComboFeedback')
    root.layer = options.parent.layer
    root.setParent(options.parent)
    root.setPosition(options.anchorPosition)
    root.addComponent(UITransform).setContentSize(options.pieceSize * 3, options.pieceSize * 2.4)
    this.transientFx.register(root)
    this.activeRoot = root

    const palette = this.getPalette(chainDepth)
    this.createImpactBurst(root, options.pieceSize, palette)
    const wordmark = this.createWordmark(root, chainDepth, options, palette)
    this.createSparkleSweep(root, wordmark)
    this.animateWordmark(root, wordmark)
  }

  clear() {
    const root = this.activeRoot
    this.activeRoot = null
    if (!root?.isValid) {
      return
    }

    this.stopNodeTweens(root)
    this.transientFx.destroy(root)
  }

  /** 创建贴近棋子的短促爆点，模拟消消乐合并瞬间的白金色冲击。 */
  private createImpactBurst(root: Node, pieceSize: number, palette: ComboPalette) {
    const burst = new Node('ComboImpact')
    burst.layer = root.layer
    burst.setParent(root)
    burst.addComponent(UITransform).setContentSize(pieceSize * 2, pieceSize * 2)
    burst.setScale(new Vec3(0.46, 0.46, 1))

    const graphics = burst.addComponent(Graphics)
    graphics.lineCap = Graphics.LineCap.ROUND
    const innerRadius = pieceSize * 0.48
    for (let index = 0; index < 10; index++) {
      const angle = (Math.PI * 2 * index) / 10
      const rayLength = pieceSize * (index % 2 === 0 ? 0.28 : 0.18)
      graphics.lineWidth = index % 2 === 0 ? 6 : 4
      graphics.strokeColor = index % 2 === 0
        ? palette.burst
        : new Color(255, 255, 238, 218)
      graphics.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius)
      graphics.lineTo(
        Math.cos(angle) * (innerRadius + rayLength),
        Math.sin(angle) * (innerRadius + rayLength)
      )
      graphics.stroke()
    }

    const sparklePositions = [
      new Vec3(-pieceSize * 0.72, pieceSize * 0.34, 0),
      new Vec3(pieceSize * 0.68, pieceSize * 0.46, 0),
      new Vec3(-pieceSize * 0.58, -pieceSize * 0.53, 0),
      new Vec3(pieceSize * 0.75, -pieceSize * 0.26, 0)
    ]
    graphics.fillColor = new Color(255, 252, 218, 240)
    for (const position of sparklePositions) {
      const size = pieceSize * 0.055
      graphics.moveTo(position.x, position.y + size)
      graphics.lineTo(position.x + size, position.y)
      graphics.lineTo(position.x, position.y - size)
      graphics.lineTo(position.x - size, position.y)
      graphics.close()
      graphics.fill()
    }

    const opacity = burst.addComponent(UIOpacity)
    opacity.opacity = 228
    // Cocos 3.8.8 在深层 parallel 中混用 Node/UIOpacity 目标时可能丢失子目标，
    // 因此缩放与透明度使用两条独立 Tween，连续替换字效时不会访问空属性列表。
    tween(burst)
      .to(0.24, { scale: new Vec3(1.24, 1.24, 1) }, { easing: 'sineOut' })
      .start()
    tween(opacity)
      .delay(0.07)
      .to(0.17, { opacity: 0 }, { easing: 'sineIn' })
      .start()
  }

  /** 组合双色文字与错位阴影，形成 V5 稿中典型的消消乐大字层级。 */
  private createWordmark(
    root: Node,
    chainDepth: number,
    options: ComboFeedbackOptions,
    palette: ComboPalette
  ) {
    const fontSize = Math.max(40, Math.min(52, Math.round(options.pieceSize * 0.41)))
    const titleWidth = fontSize * 2.3
    const countText = `×${chainDepth}`
    const countWidth = fontSize * Math.max(1.7, 1.05 + countText.length * 0.38)
    const wordmarkWidth = titleWidth + countWidth
    const wordmarkHeight = fontSize * 1.5
    const position = this.getWordmarkPosition(
      options.anchorPosition,
      wordmarkWidth,
      wordmarkHeight,
      options.pieceSize,
      options.bounds
    )

    const wordmark = new Node('ComboWordmark')
    wordmark.layer = root.layer
    wordmark.setParent(root)
    wordmark.setPosition(
      position.x - options.anchorPosition.x,
      position.y - options.anchorPosition.y,
      0
    )
    wordmark.setScale(new Vec3(0.52, 0.42, 1))
    wordmark.angle = -6
    wordmark.addComponent(UITransform).setContentSize(wordmarkWidth, wordmarkHeight)

    const titleX = -countWidth * 0.5
    const countX = titleWidth * 0.5
    this.createStyledLabel(
      wordmark,
      'TitleShadow',
      '连击',
      titleX,
      -7,
      titleWidth,
      wordmarkHeight,
      fontSize,
      palette.shadow,
      palette.outline,
      5
    )
    this.createStyledLabel(
      wordmark,
      'CountShadow',
      countText,
      countX,
      -7,
      countWidth,
      wordmarkHeight,
      fontSize,
      palette.shadow,
      palette.outline,
      5
    )
    this.createStyledLabel(
      wordmark,
      'Title',
      '连击',
      titleX,
      0,
      titleWidth,
      wordmarkHeight,
      fontSize,
      palette.title,
      palette.outline,
      5
    )
    this.createStyledLabel(
      wordmark,
      'Count',
      countText,
      countX,
      0,
      countWidth,
      wordmarkHeight,
      fontSize,
      palette.count,
      new Color(255, 249, 211, 255),
      4
    )

    const opacity = wordmark.addComponent(UIOpacity)
    opacity.opacity = 0
    return wordmark
  }

  private createStyledLabel(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
    outlineColor: Color,
    outlineWidth: number
  ) {
    const node = new Node(name)
    node.layer = parent.layer
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(width, height)

    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.ceil(fontSize * 1.15)
    label.color = color
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.overflow = Label.Overflow.SHRINK
    label.isBold = true
    label.enableOutline = true
    label.outlineColor = outlineColor
    label.outlineWidth = outlineWidth
  }

  /** 在字效回弹结束后补一次短扫光，承接 V5 动画稿第六帧的节奏。 */
  private createSparkleSweep(root: Node, wordmark: Node) {
    const wordmarkWidth = wordmark.getComponent(UITransform)?.contentSize.width ?? 240
    const sweep = new Node('ComboSweep')
    sweep.layer = root.layer
    sweep.setParent(root)
    sweep.addComponent(UITransform).setContentSize(48, 48)
    const start = wordmark.position.clone().add3f(-wordmarkWidth * 0.42, 2, 0)
    const end = wordmark.position.clone().add3f(wordmarkWidth * 0.42, 10, 0)
    sweep.setPosition(start)

    const graphics = sweep.addComponent(Graphics)
    graphics.fillColor = new Color(255, 255, 233, 248)
    graphics.moveTo(0, 18)
    graphics.lineTo(6, 6)
    graphics.lineTo(18, 0)
    graphics.lineTo(6, -6)
    graphics.lineTo(0, -18)
    graphics.lineTo(-6, -6)
    graphics.lineTo(-18, 0)
    graphics.lineTo(-6, 6)
    graphics.close()
    graphics.fill()
    graphics.fillColor = new Color(255, 211, 74, 230)
    graphics.circle(-19, 13, 3.5)
    graphics.circle(19, -12, 2.5)
    graphics.fill()

    const opacity = sweep.addComponent(UIOpacity)
    opacity.opacity = 0
    tween(sweep)
      .delay(0.31)
      .to(0.2, { position: end, scale: new Vec3(0.74, 0.74, 1) }, { easing: 'sineInOut' })
      .start()
    tween(opacity)
      .delay(0.31)
      .to(0.045, { opacity: 255 }, { easing: 'sineOut' })
      .delay(0.065)
      .to(0.09, { opacity: 0 }, { easing: 'sineIn' })
      .start()
  }

  /**
   * 按“出现—过冲—回弹—停留—上浮”的节奏播放字效。
   * 动画不参与玩法 await，避免视觉反馈反过来拖慢连锁结算。
   */
  private animateWordmark(root: Node, wordmark: Node) {
    const opacity = wordmark.getComponent(UIOpacity)!
    const origin = wordmark.position.clone()
    const exitPosition = origin.clone().add3f(0, 28, 0)

    tween(opacity)
      .to(0.075, { opacity: 255 }, { easing: 'sineOut' })
      .delay(0.47)
      .to(0.2, { opacity: 0 }, { easing: 'sineIn' })
      .start()

    tween(wordmark)
      .to(0.11, {
        scale: new Vec3(1.24, 1.24, 1),
        angle: 3
      }, { easing: 'backOut' })
      .to(0.075, { scale: new Vec3(0.96, 0.96, 1), angle: -1.5 }, { easing: 'sineInOut' })
      .to(0.065, { scale: new Vec3(1.035, 1.035, 1), angle: 0.5 }, { easing: 'sineOut' })
      .to(0.055, { scale: Vec3.ONE, angle: 0 }, { easing: 'sineInOut' })
      .delay(0.24)
      .to(0.2, {
        position: exitPosition,
        scale: new Vec3(0.88, 0.88, 1)
      }, { easing: 'sineIn' })
      .call(() => {
        if (this.activeRoot === root) {
          this.activeRoot = null
        }
        if (root.isValid) {
          this.transientFx.destroy(root)
        }
      })
      .start()
  }

  private getWordmarkPosition(
    anchorPosition: Vec3,
    width: number,
    height: number,
    pieceSize: number,
    bounds: ComboFeedbackBounds
  ) {
    const boardWidth = Math.max(0, bounds.right - bounds.left)
    const halfWidth = Math.min(width * 0.5, boardWidth * 0.5)
    const x = Math.max(
      bounds.left + halfWidth,
      Math.min(bounds.right - halfWidth, anchorPosition.x)
    )
    const halfHeight = height * 0.5
    const offset = pieceSize * 0.92
    const aboveY = anchorPosition.y + offset
    const belowY = anchorPosition.y - offset
    const y = aboveY + halfHeight <= bounds.top
      ? aboveY
      : Math.max(bounds.bottom + halfHeight, belowY)

    return new Vec3(x, y, anchorPosition.z)
  }

  private getPalette(chainDepth: number): ComboPalette {
    if (chainDepth >= 5) {
      return {
        title: new Color(255, 244, 166, 255),
        count: new Color(255, 110, 67, 255),
        outline: new Color(66, 65, 39, 255),
        shadow: new Color(221, 101, 34, 255),
        burst: new Color(255, 205, 74, 245)
      }
    }
    if (chainDepth >= 4) {
      return {
        title: new Color(255, 246, 177, 255),
        count: new Color(247, 141, 51, 255),
        outline: new Color(36, 79, 68, 255),
        shadow: new Color(218, 111, 35, 255),
        burst: new Color(255, 215, 88, 240)
      }
    }
    return {
      title: new Color(255, 244, 173, 255),
      count: new Color(105, 186, 59, 255),
      outline: new Color(35, 82, 69, 255),
      shadow: new Color(218, 128, 35, 255),
      burst: new Color(255, 222, 104, 235)
    }
  }

  private stopNodeTweens(node: Node) {
    Tween.stopAllByTarget(node)
    const opacity = node.getComponent(UIOpacity)
    if (opacity) {
      Tween.stopAllByTarget(opacity)
    }
    for (const child of node.children) {
      this.stopNodeTweens(child)
    }
  }
}
