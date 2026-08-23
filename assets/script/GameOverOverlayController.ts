import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'

const { ccclass } = _decorator

const SETTLEMENT_ANIM_DURATION = 0.2
const SETTLEMENT_CONTENT_WIDTH = 750
const SETTLEMENT_CONTENT_HEIGHT = 1180
const SETTLEMENT_EDGE_INSET = 20
const SETTLEMENT_VERTICAL_INSET = 32
const SETTLEMENT_ART_ROOT = 'Settlement/'

const SettlementArtwork = {
  header: 'victory-header',
  statistics: 'statistics-strip',
  starHollow: 'star-hollow',
  starFilled: 'star-filled',
  rewardCoin: 'reward-coin',
  continue: 'button-continue'
} as const

type GameOverOverlayOptions = {
  hostNode: Node
  replayHandler: (() => void) | null
  homeHandler: (() => void) | null
  onButtonClick?: () => void
  // 旧资源参数只保留接口兼容；新结算页统一从 resources/Settlement 加载拆分素材。
  popupSpriteFrame?: SpriteFrame | null
  replayButtonSpriteFrame?: SpriteFrame | null
  homeButtonSpriteFrame?: SpriteFrame | null
  shareButtonSpriteFrame?: SpriteFrame | null
}

type SettlementStar = {
  root: Node
  filled: Node
  filledOpacity: UIOpacity
}

@ccclass('GameOverOverlayController')
export class GameOverOverlayController extends Component {
  private hostNode: Node | null = null
  private maskNode: Node | null = null
  private contentNode: Node | null = null
  private statisticsLabel: Label | null = null
  private rewardValueLabel: Label | null = null
  private continueButtonNode: Node | null = null
  private overlayOpacity: UIOpacity | null = null
  private settlementStars: SettlementStar[] = []
  private replayHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private isVisible = false
  private earnedStarCount = 1
  private contentLayoutScale = 1

  setup(options: GameOverOverlayOptions) {
    this.hostNode = options.hostNode
    this.replayHandler = options.replayHandler
    this.buttonClickHandler = options.onButtonClick ?? null
    this.ensureOverlayStructure()
    this.bindTouchEvents()
    this.syncLayout()
  }

  /**
   * 遮罩永远铺满实际游戏画布；结算内容按 750 × 1180 的安全区域等比缩放，
   * 长屏不会把标题顶出屏幕，窄屏也不会裁掉底部按钮。
   */
  syncLayout() {
    const hostTransform = this.hostNode?.getComponent(UITransform)
    const overlayTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const width = hostTransform?.width ?? overlayTransform.width ?? 750
    const height = hostTransform?.height ?? overlayTransform.height ?? 1334
    overlayTransform.setContentSize(width, height)
    this.drawMask(width, height)

    this.contentLayoutScale = Math.min(
      1,
      Math.max(0.58, (width - SETTLEMENT_EDGE_INSET * 2) / SETTLEMENT_CONTENT_WIDTH),
      Math.max(0.58, (height - SETTLEMENT_VERTICAL_INSET * 2) / SETTLEMENT_CONTENT_HEIGHT)
    )
    this.contentNode?.setPosition(0, -18, 0)
    this.contentNode?.setScale(this.getContentScale())
  }

  // UI 主控只传入纯展示状态，结算组件不直接读取或修改棋盘数据。
  renderState(
    isGameOver: boolean,
    score: number,
    highestValue: number,
    coinReward: number
  ) {
    this.refreshStatistics(score, highestValue)
    this.refreshReward(coinReward)
    this.earnedStarCount = this.calculateStarCount(score, highestValue)
    this.bringNodeToTop(this.node)

    if (isGameOver) {
      this.show()
    } else {
      this.hide()
    }
  }

  onDestroy() {
    this.unbindSwallowNode(this.maskNode)
    this.unbindSwallowNode(this.contentNode)
    this.unbindButtonTouchEvents(this.continueButtonNode, this.onContinueButtonTap)
    this.stopNodeTreeTweens(this.node)
  }

  private ensureOverlayStructure() {
    this.node.active = false
    this.overlayOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.overlayOpacity.opacity = 0

    this.maskNode = this.getOrCreateNode(this.node, 'Mask')
    this.maskNode.getComponent(Graphics) ?? this.maskNode.addComponent(Graphics)

    // 复用 Scene 中的 Panel 挂点，但关闭旧版卡片、标签和三枚 icon，避免两套结算界面叠加。
    this.contentNode = this.getOrCreateNode(this.node, 'Panel')
    ;(this.contentNode.getComponent(UITransform) ?? this.contentNode.addComponent(UITransform)).setContentSize(
      SETTLEMENT_CONTENT_WIDTH,
      SETTLEMENT_CONTENT_HEIGHT
    )
    const legacySprite = this.contentNode.getComponent(Sprite)
    if (legacySprite) {
      legacySprite.enabled = false
    }
    const legacyGraphics = this.contentNode.getComponent(Graphics)
    if (legacyGraphics) {
      legacyGraphics.clear()
      legacyGraphics.enabled = false
    }
    for (const child of this.contentNode.children) {
      child.active = false
    }

    this.ensureHeader(this.contentNode)
    this.ensureStatistics(this.contentNode)
    this.ensureStars(this.contentNode)
    this.ensureReward(this.contentNode)
    this.ensureActions(this.contentNode)
  }

  private ensureHeader(parent: Node) {
    const header = this.getOrCreateNode(parent, 'SettlementHeader')
    header.active = true
    header.setPosition(0, 400, 0)
    this.applyArtwork(header, SettlementArtwork.header, 710, 346)
  }

  private ensureStatistics(parent: Node) {
    const statistics = this.getOrCreateNode(parent, 'SettlementStatistics')
    statistics.active = true
    statistics.setPosition(0, 190, 0)
    this.applyArtwork(statistics, SettlementArtwork.statistics, 660, 128)

    // 素材保留手绘边框，内部示例数字由同色底覆盖，再叠加真实对局数据。
    const cover = this.getOrCreateNode(statistics, 'DynamicCover')
    cover.active = true
    cover.setPosition(0, 0, 0)
    ;(cover.getComponent(UITransform) ?? cover.addComponent(UITransform)).setContentSize(610, 82)
    const graphics = cover.getComponent(Graphics) ?? cover.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(255, 247, 226, 255)
    graphics.roundRect(-305, -41, 610, 82, 26)
    graphics.fill()

    this.statisticsLabel = this.ensureLabel(
      cover,
      'StatisticsText',
      '本关得分 0   ◆   最高合成 0',
      29,
      new Color(71, 48, 31, 255),
      Vec3.ZERO,
      600,
      70,
      true
    )
  }

  private ensureStars(parent: Node) {
    const stars = this.getOrCreateNode(parent, 'SettlementStars')
    stars.active = true
    stars.setPosition(0, -50, 0)
    ;(stars.getComponent(UITransform) ?? stars.addComponent(UITransform)).setContentSize(590, 250)

    this.settlementStars = [
      this.ensureStar(stars, 'StarLeft', -178, -10, 170, 174),
      this.ensureStar(stars, 'StarCenter', 0, 22, 226, 230),
      this.ensureStar(stars, 'StarRight', 178, -10, 170, 174)
    ]
  }

  private ensureStar(parent: Node, name: string, x: number, y: number, width: number, height: number) {
    const root = this.getOrCreateNode(parent, name)
    root.active = true
    root.setPosition(x, y, 0)
    ;(root.getComponent(UITransform) ?? root.addComponent(UITransform)).setContentSize(width, height)

    const hollow = this.getOrCreateNode(root, 'Hollow')
    hollow.active = true
    hollow.setPosition(Vec3.ZERO)
    this.applyArtwork(hollow, SettlementArtwork.starHollow, width, height)

    const filled = this.getOrCreateNode(root, 'Filled')
    filled.active = false
    filled.setPosition(Vec3.ZERO)
    this.applyArtwork(filled, SettlementArtwork.starFilled, width, height)
    const filledOpacity = filled.getComponent(UIOpacity) ?? filled.addComponent(UIOpacity)
    filledOpacity.opacity = 0
    return { root, filled, filledOpacity }
  }

  private ensureReward(parent: Node) {
    const reward = this.getOrCreateNode(parent, 'SettlementReward')
    reward.active = true
    reward.setPosition(0, -330, 0)
    ;(reward.getComponent(UITransform) ?? reward.addComponent(UITransform)).setContentSize(520, 110)

    this.ensureLabel(
      reward,
      'RewardTitle',
      '奖励',
      48,
      Color.WHITE,
      new Vec3(-145, 0, 0),
      150,
      86,
      true,
      new Color(87, 53, 27, 255),
      4
    )

    const coin = this.getOrCreateNode(reward, 'RewardCoin')
    coin.active = true
    coin.setPosition(-18, 0, 0)
    this.applyArtwork(coin, SettlementArtwork.rewardCoin, 84, 89)

    this.rewardValueLabel = this.ensureLabel(
      reward,
      'RewardValue',
      '×0',
      54,
      new Color(255, 187, 31, 255),
      new Vec3(122, 0, 0),
      210,
      92,
      true,
      new Color(77, 45, 22, 255),
      4
    )
  }

  private ensureActions(parent: Node) {
    const actions = this.getOrCreateNode(parent, 'SettlementActions')
    actions.active = true
    actions.setPosition(0, -490, 0)
    ;(actions.getComponent(UITransform) ?? actions.addComponent(UITransform)).setContentSize(700, 132)

    // 结算页现在只保留继续入口，旧版操作按钮统一关闭，避免老场景节点重新露出。
    for (const child of actions.children) {
      child.active = false
    }
    this.continueButtonNode = this.ensureArtworkButton(
      actions,
      'ContinueButton',
      SettlementArtwork.continue,
      0,
      0,
      316,
      114
    )
  }

  private ensureArtworkButton(
    parent: Node,
    name: string,
    artwork: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const button = this.getOrCreateNode(parent, name)
    button.active = true
    button.setPosition(x, y, 0)
    ;(button.getComponent(UITransform) ?? button.addComponent(UITransform)).setContentSize(width + 12, 126)
    this.applyArtwork(button, artwork, width, height)
    return button
  }

  private applyArtwork(node: Node, artwork: string, width: number, height: number) {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.enabled = true
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.type = Sprite.Type.SIMPLE
    sprite.trim = false
    sprite.color = Color.WHITE

    resources.load(`${SETTLEMENT_ART_ROOT}${artwork}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !this.canUseNode(node)) {
        console.warn(`[结算弹窗] 素材加载失败: ${artwork}`, error)
        return
      }
      sprite.spriteFrame = spriteFrame
      transform.setContentSize(width, height)
    })
  }

  private ensureLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    position: Vec3,
    width: number,
    height: number,
    isBold: boolean,
    outlineColor = new Color(255, 255, 255, 0),
    outlineWidth = 0
  ) {
    const labelNode = this.getOrCreateNode(parent, name)
    labelNode.active = true
    labelNode.setPosition(position)
    ;(labelNode.getComponent(UITransform) ?? labelNode.addComponent(UITransform)).setContentSize(width, height)
    const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.ceil(fontSize * 1.18)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = color
    label.isBold = isBold
    const outline = labelNode.getComponent(LabelOutline) ?? labelNode.addComponent(LabelOutline)
    outline.color = outlineColor
    outline.width = outlineWidth
    return label
  }

  private refreshStatistics(score: number, highestValue: number) {
    if (!this.statisticsLabel) {
      return
    }
    const safeScore = Math.max(0, Math.floor(score))
    const safeHighest = Math.max(0, Math.floor(highestValue))
    this.statisticsLabel.string = `本关得分 ${safeScore}   ◆   最高合成 ${safeHighest}`
  }

  private refreshReward(coinReward: number) {
    if (this.rewardValueLabel) {
      this.rewardValueLabel.string = `×${Math.max(0, Math.floor(coinReward))}`
    }
  }

  // 当前项目尚未接入关卡星级表，先按分数与最高合成值生成稳定的展示星级。
  private calculateStarCount(score: number, highestValue: number) {
    if (highestValue >= 1024 || score >= 12000) {
      return 3
    }
    if (highestValue >= 256 || score >= 5000) {
      return 2
    }
    return 1
  }

  private resetStars() {
    for (const star of this.settlementStars) {
      Tween.stopAllByTarget(star.filled)
      Tween.stopAllByTarget(star.filledOpacity)
      star.filled.active = false
      star.filledOpacity.opacity = 0
      star.filled.setScale(Vec3.ONE)
    }
  }

  /**
   * 三颗星先统一显示为空心，再按左、中、右依次点亮。
   * 中心星素材尺寸更大，动画只做轻微弹性缩放，避免高光和过度爆炸效果抢占主体。
   */
  private animateStars() {
    this.resetStars()
    for (let index = 0; index < this.earnedStarCount; index += 1) {
      const star = this.settlementStars[index]
      const delay = 0.18 + index * 0.2
      star.filled.setScale(new Vec3(0.68, 0.68, 1))
      tween(star.filledOpacity)
        .delay(delay)
        .call(() => {
          star.filled.active = true
        })
        .to(0.2, { opacity: 255 }, { easing: 'quadOut' })
        .start()
      tween(star.filled)
        .delay(delay)
        .to(0.24, { scale: Vec3.ONE }, { easing: 'backOut' })
        .start()
    }
  }

  private drawMask(width: number, height: number) {
    if (!this.maskNode) {
      return
    }
    const transform = this.maskNode.getComponent(UITransform) ?? this.maskNode.addComponent(UITransform)
    transform.setContentSize(width, height)
    const graphics = this.maskNode.getComponent(Graphics) ?? this.maskNode.addComponent(Graphics)
    graphics.enabled = true
    graphics.clear()
    graphics.fillColor = new Color(0, 48, 53, 190)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
  }

  private bindTouchEvents() {
    this.bindSwallowNode(this.maskNode)
    this.bindSwallowNode(this.contentNode)
    this.bindButtonTouchEvents(this.continueButtonNode, this.onContinueButtonTap)
  }

  private bindSwallowNode(node: Node | null) {
    this.unbindSwallowNode(node)
    this.safeOn(node, Node.EventType.TOUCH_START, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_MOVE, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_END, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_CANCEL, this.swallowTouch)
  }

  private unbindSwallowNode(node: Node | null) {
    this.safeOff(node, Node.EventType.TOUCH_START, this.swallowTouch)
    this.safeOff(node, Node.EventType.TOUCH_MOVE, this.swallowTouch)
    this.safeOff(node, Node.EventType.TOUCH_END, this.swallowTouch)
    this.safeOff(node, Node.EventType.TOUCH_CANCEL, this.swallowTouch)
  }

  private bindButtonTouchEvents(node: Node | null, endHandler: (event: EventTouch) => void) {
    this.unbindButtonTouchEvents(node, endHandler)
    if (!this.canUseNode(node)) {
      return
    }
    node.on(Node.EventType.TOUCH_START, this.swallowTouch, this)
    node.on(Node.EventType.TOUCH_MOVE, this.swallowTouch, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.swallowTouch, this)
    node.on(Node.EventType.TOUCH_END, endHandler, this)
  }

  private unbindButtonTouchEvents(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }
    node.off(Node.EventType.TOUCH_START, this.swallowTouch, this)
    node.off(Node.EventType.TOUCH_MOVE, this.swallowTouch, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.swallowTouch, this)
    node.off(Node.EventType.TOUCH_END, endHandler, this)
  }

  private onContinueButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.replayHandler?.()
  }

  private playButtonClickFeedback() {
    this.buttonClickHandler?.()
  }

  private swallowTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  private getOrCreateNode(parent: Node, name: string) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
    }
    return node
  }

  private canUseNode(node: Node | null): node is Node {
    return !!node && node.isValid
  }

  private safeOn(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (this.canUseNode(node)) {
      node.on(eventType, handler, this)
    }
  }

  private safeOff(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (this.canUseNode(node)) {
      node.off(eventType, handler, this)
    }
  }

  private bringNodeToTop(node: Node | null) {
    const parent = node?.parent ?? null
    if (this.canUseNode(node) && parent?.isValid) {
      node.setSiblingIndex(parent.children.length - 1)
    }
  }

  private stopNodeTreeTweens(node: Node | null) {
    if (!this.canUseNode(node)) {
      return
    }
    Tween.stopAllByTarget(node)
    const opacity = node.getComponent(UIOpacity)
    if (opacity) {
      Tween.stopAllByTarget(opacity)
    }
    for (const child of [...node.children]) {
      this.stopNodeTreeTweens(child)
    }
  }

  private getContentScale(factor = 1) {
    const scale = this.contentLayoutScale * factor
    return new Vec3(scale, scale, 1)
  }

  private show() {
    if (!this.overlayOpacity) {
      return
    }
    if (this.isVisible) {
      this.node.active = true
      this.overlayOpacity.opacity = 255
      this.contentNode?.setScale(this.getContentScale())
      return
    }

    this.isVisible = true
    this.node.active = true
    this.overlayOpacity.opacity = 0
    this.contentNode?.setScale(this.getContentScale(0.94))
    Tween.stopAllByTarget(this.overlayOpacity)
    if (this.contentNode) {
      Tween.stopAllByTarget(this.contentNode)
    }
    tween(this.overlayOpacity).to(SETTLEMENT_ANIM_DURATION, { opacity: 255 }, { easing: 'quadOut' }).start()
    if (this.contentNode) {
      tween(this.contentNode)
        .to(SETTLEMENT_ANIM_DURATION, { scale: this.getContentScale() }, { easing: 'backOut' })
        .start()
    }
    this.animateStars()
  }

  private hide() {
    if (!this.overlayOpacity) {
      return
    }
    if (!this.isVisible) {
      this.node.active = false
      return
    }

    this.isVisible = false
    this.resetStars()
    Tween.stopAllByTarget(this.overlayOpacity)
    if (this.contentNode) {
      Tween.stopAllByTarget(this.contentNode)
    }
    tween(this.overlayOpacity)
      .to(0.12, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        if (!this.isVisible) {
          this.node.active = false
          this.contentNode?.setScale(this.getContentScale())
        }
      })
      .start()
  }
}
