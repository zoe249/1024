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
const CELEBRATION_ART_ROOT = `${SETTLEMENT_ART_ROOT}Celebration/`

const SettlementArtwork = {
  header: 'victory-header',
  statistics: 'statistics-strip',
  rewardCoin: 'reward-coin',
  replayButton: 'button-replay-v2',
  boastButton: 'button-boast-v2'
} as const

type GameOverOverlayOptions = {
  hostNode: Node
  replayHandler: (() => void) | null
  homeHandler: (() => void) | null
  shareHandler: (() => void) | null
  onButtonClick?: () => void
  // 旧资源参数只保留接口兼容；新结算页统一从 resources/Settlement 加载拆分素材。
  popupSpriteFrame?: SpriteFrame | null
  replayButtonSpriteFrame?: SpriteFrame | null
  homeButtonSpriteFrame?: SpriteFrame | null
  shareButtonSpriteFrame?: SpriteFrame | null
}

@ccclass('GameOverOverlayController')
export class GameOverOverlayController extends Component {
  private hostNode: Node | null = null
  private maskNode: Node | null = null
  private contentNode: Node | null = null
  private statisticsLabel: Label | null = null
  private rewardValueLabel: Label | null = null
  private rewardNode: Node | null = null
  private actionsNode: Node | null = null
  private continueButtonNode: Node | null = null
  private shareButtonNode: Node | null = null
  private mascotRoot: Node | null = null
  private glowNode: Node | null = null
  private noteNodes: Node[] = []
  private overlayOpacity: UIOpacity | null = null
  private replayHandler: (() => void) | null = null
  private shareHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private isVisible = false
  private contentLayoutScale = 1

  setup(options: GameOverOverlayOptions) {
    this.hostNode = options.hostNode
    this.replayHandler = options.replayHandler
    this.shareHandler = options.shareHandler
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
    this.unbindButtonTouchEvents(this.shareButtonNode, this.onShareButtonTap)
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
    this.ensureCelebration(this.contentNode)
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
    statistics.setPosition(0, 145, 0)
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

  /** 兔子保持静止，庆祝感只由背后的光芒和闪光粒子提供，避免低帧切图破坏实机观感。 */
  private ensureCelebration(parent: Node) {
    const celebration = this.getOrCreateNode(parent, 'SettlementCelebration')
    celebration.active = true
    celebration.setPosition(0, -65, 0)
    ;(celebration.getComponent(UITransform) ?? celebration.addComponent(UITransform)).setContentSize(500, 430)

    this.glowNode = this.getOrCreateNode(celebration, 'GoldenBurst')
    this.glowNode.active = true
    this.glowNode.setPosition(0, 0, 0)
    this.applyResourceArtwork(this.glowNode, `${CELEBRATION_ART_ROOT}golden-burst`, 480, 480)

    this.mascotRoot = this.getOrCreateNode(celebration, 'SuonaRabbit')
    this.mascotRoot.active = true
    this.mascotRoot.setPosition(0, -4, 0)
    ;(this.mascotRoot.getComponent(UITransform) ?? this.mascotRoot.addComponent(UITransform)).setContentSize(390, 390)
    this.applyResourceArtwork(this.mascotRoot, `${CELEBRATION_ART_ROOT}rabbit-inhale`, 390, 390)

    this.noteNodes = [
      this.ensureEffectNode(celebration, 'MusicNoteA', 'note-single-a', 135, 72),
      this.ensureEffectNode(celebration, 'MusicNoteB', 'note-double', 168, 122),
      this.ensureEffectNode(celebration, 'Sparkle', 'sparkle', 104, 105)
    ]
  }

  private ensureEffectNode(parent: Node, name: string, resource: string, x: number, y: number) {
    const node = this.getOrCreateNode(parent, name)
    node.active = true
    node.setPosition(x, y, 0)
    this.applyResourceArtwork(node, `${CELEBRATION_ART_ROOT}${resource}`, 66, 66)
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
    opacity.opacity = 0
    return node
  }

  private ensureReward(parent: Node) {
    const reward = this.getOrCreateNode(parent, 'SettlementReward')
    this.rewardNode = reward
    reward.active = true
    reward.setPosition(0, -300, 0)
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
    this.actionsNode = actions
    actions.active = true
    actions.setPosition(0, -455, 0)
    ;(actions.getComponent(UITransform) ?? actions.addComponent(UITransform)).setContentSize(700, 150)

    // 旧版操作按钮统一关闭，再创建职责清晰的“继续”和“炫耀”双主入口。
    for (const child of actions.children) {
      child.active = false
    }
    this.continueButtonNode = this.ensureActionButton(
      actions,
      'ContinueButton',
      -170,
      SettlementArtwork.replayButton
    )
    this.shareButtonNode = this.ensureActionButton(
      actions,
      'BoastButton',
      170,
      SettlementArtwork.boastButton
    )
  }

  /** 直接使用项目既有的手绘按钮语言，避免运行时矢量按钮与首页美术割裂。 */
  private ensureActionButton(
    parent: Node,
    name: string,
    x: number,
    artwork: string
  ) {
    const button = this.getOrCreateNode(parent, name)
    button.active = true
    button.setPosition(x, 0, 0)
    ;(button.getComponent(UITransform) ?? button.addComponent(UITransform)).setContentSize(316, 126)

    const background = button.getComponent(Graphics)
    if (background) {
      background.clear()
      background.enabled = false
    }
    const legacySprite = button.getComponent(Sprite)
    if (legacySprite) {
      legacySprite.enabled = false
    }
    for (const child of button.children) {
      child.active = false
    }
    // Sprite 放在独立子节点上，避免同一节点同时挂 Graphics 与 Sprite 的渲染组件冲突。
    const artworkNode = this.getOrCreateNode(button, 'Artwork')
    artworkNode.active = true
    this.applyArtwork(artworkNode, artwork, 316, 126)
    return button
  }

  private applyArtwork(node: Node, artwork: string, width: number, height: number) {
    this.applyResourceArtwork(node, `${SETTLEMENT_ART_ROOT}${artwork}`, width, height)
  }

  private applyResourceArtwork(node: Node, resourcePath: string, width: number, height: number) {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.enabled = true
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.type = Sprite.Type.SIMPLE
    sprite.trim = false
    sprite.color = Color.WHITE

    resources.load(`${resourcePath}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !this.canUseNode(node)) {
        console.warn(`[结算弹窗] 素材加载失败: ${resourcePath}`, error)
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
    this.bindButtonTouchEvents(this.shareButtonNode, this.onShareButtonTap)
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
    this.playActionFeedback(this.continueButtonNode, this.replayHandler)
  }

  private onShareButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.playActionFeedback(this.shareButtonNode, this.shareHandler)
  }

  // 点击只做一次短促回弹；回调延后到回弹低点，触感清楚但不会拖慢操作。
  private playActionFeedback(node: Node | null, handler: (() => void) | null) {
    this.playButtonClickFeedback()
    if (!this.canUseNode(node)) {
      handler?.()
      return
    }
    Tween.stopAllByTarget(node)
    tween(node)
      .to(0.06, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'quadOut' })
      .call(() => handler?.())
      .to(0.1, { scale: Vec3.ONE }, { easing: 'backOut' })
      .start()
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

  private resetCelebrationAnimation() {
    if (this.canUseNode(this.mascotRoot)) {
      Tween.stopAllByTarget(this.mascotRoot)
      this.mascotRoot.setPosition(0, -4, 0)
      this.mascotRoot.setScale(Vec3.ONE)
      this.mascotRoot.angle = 0
    }
    if (this.canUseNode(this.glowNode)) {
      Tween.stopAllByTarget(this.glowNode)
      this.glowNode.setScale(Vec3.ONE)
      this.glowNode.angle = 0
    }
    for (const note of this.noteNodes) {
      Tween.stopAllByTarget(note)
      const opacity = note.getComponent(UIOpacity)
      if (opacity) {
        Tween.stopAllByTarget(opacity)
        opacity.opacity = 0
      }
      note.setScale(new Vec3(0.55, 0.55, 1))
    }
  }

  /** 角色完全静止；光芒与闪光粒子独立循环，不受五点五秒音频长度限制。 */
  private playCelebrationAnimation() {
    this.resetCelebrationAnimation()

    if (this.glowNode) {
      this.glowNode.setScale(new Vec3(0.96, 0.96, 1))
      tween(this.glowNode)
        .repeatForever(
          tween<Node>()
            .to(1.15, { scale: new Vec3(1.06, 1.06, 1), angle: 4 }, { easing: 'sineInOut' })
            .to(1.15, { scale: new Vec3(0.96, 0.96, 1), angle: 0 }, { easing: 'sineInOut' })
        )
        .start()
    }

    const noteOrigins = [new Vec3(135, 72, 0), new Vec3(168, 122, 0), new Vec3(104, 105, 0)]
    this.noteNodes.forEach((note, index) => {
      const opacity = note.getComponent(UIOpacity)
      if (!opacity) {
        return
      }
      note.setPosition(noteOrigins[index])
      tween(opacity)
        .delay(0.55 + index * 0.42)
        .repeatForever(
          tween<UIOpacity>()
            .to(0.18, { opacity: 210 }, { easing: 'sineOut' })
            .delay(0.28)
            .to(0.42, { opacity: 0 }, { easing: 'sineIn' })
            .delay(1.45)
        )
        .start()
      tween(note)
        .delay(0.55 + index * 0.42)
        .repeatForever(
          tween<Node>()
            .call(() => {
              note.setPosition(noteOrigins[index])
              note.setScale(new Vec3(0.62, 0.62, 1))
            })
            .to(0.88, { position: noteOrigins[index].clone().add3f(12 - index * 8, 48, 0), scale: Vec3.ONE }, { easing: 'sineOut' })
            .delay(1.45)
        )
        .start()
    })
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
    this.contentNode?.setPosition(0, -42, 0)
    Tween.stopAllByTarget(this.overlayOpacity)
    if (this.contentNode) {
      Tween.stopAllByTarget(this.contentNode)
    }
    tween(this.overlayOpacity).to(SETTLEMENT_ANIM_DURATION, { opacity: 255 }, { easing: 'quadOut' }).start()
    if (this.contentNode) {
      tween(this.contentNode)
        .to(
          SETTLEMENT_ANIM_DURATION,
          { position: new Vec3(0, -18, 0), scale: this.getContentScale() },
          { easing: 'quadOut' }
        )
        .start()
    }
    this.playCelebrationAnimation()

    for (const [node, delay] of [[this.rewardNode, 0.9], [this.actionsNode, 1.15]] as const) {
      if (!node) {
        continue
      }
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
      opacity.opacity = 0
      node.setScale(new Vec3(0.92, 0.92, 1))
      tween(opacity).delay(delay).to(0.18, { opacity: 255 }, { easing: 'quadOut' }).start()
      tween(node).delay(delay).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start()
    }
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
    this.resetCelebrationAnimation()
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
