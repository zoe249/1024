import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'

const { ccclass } = _decorator

// 结算弹窗使用短促的缩放与淡入动画，避免打断游戏结束反馈。
const GAME_OVER_ANIM_DURATION = 0.18
// 面板尺寸与项目现有 Popup 素材比例接近，同时为纵向信息和双按钮留足空间。
const GAME_OVER_PANEL_WIDTH = 610
const GAME_OVER_PANEL_HEIGHT = 790
const GAME_OVER_PANEL_EDGE_INSET = 32
const GAME_OVER_PANEL_VERTICAL_INSET = 64
const GAME_OVER_BUTTON_WIDTH = 350
const GAME_OVER_BUTTON_HEIGHT = 112

type GameOverOverlayOptions = {
  hostNode: Node
  replayHandler: (() => void) | null
  shareHandler: (() => void) | null
  popupSpriteFrame?: SpriteFrame | null
  replayButtonSpriteFrame?: SpriteFrame | null
  shareButtonSpriteFrame?: SpriteFrame | null
}

@ccclass('GameOverOverlayController')
export class GameOverOverlayController extends Component {
  // 持有 play 根节点，用于同步画布尺寸并铺满遮罩。
  private hostNode: Node | null = null
  private maskNode: Node | null = null
  private panelNode: Node | null = null
  private scoreValueLabel: Label | null = null
  private highestValueLabel: Label | null = null
  private replayButtonNode: Node | null = null
  private shareButtonNode: Node | null = null
  private overlayOpacity: UIOpacity | null = null
  private isVisible = false
  private replayHandler: (() => void) | null = null
  private shareHandler: (() => void) | null = null
  private popupSpriteFrame: SpriteFrame | null = null
  private replayButtonSpriteFrame: SpriteFrame | null = null
  private shareButtonSpriteFrame: SpriteFrame | null = null
  private panelLayoutScale = 1

  setup(options: GameOverOverlayOptions) {
    this.hostNode = options.hostNode
    this.replayHandler = options.replayHandler
    this.shareHandler = options.shareHandler
    this.popupSpriteFrame = options.popupSpriteFrame ?? null
    this.replayButtonSpriteFrame = options.replayButtonSpriteFrame ?? null
    this.shareButtonSpriteFrame = options.shareButtonSpriteFrame ?? null
    this.ensureOverlayStructure()
    this.bindTouchEvents()
    this.syncLayout()
  }

  // 屏幕尺寸变化时同步遮罩，并在安全边距内等比缩放结算面板。
  syncLayout() {
    const hostTransform = this.hostNode?.getComponent(UITransform)
    const overlayTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const width = hostTransform?.width ?? overlayTransform.width ?? 750
    const height = hostTransform?.height ?? overlayTransform.height ?? 1334
    overlayTransform.setContentSize(width, height)

    this.drawMask(width, height)
    this.panelLayoutScale = Math.min(
      1,
      Math.max(0.58, (width - GAME_OVER_PANEL_EDGE_INSET * 2) / GAME_OVER_PANEL_WIDTH),
      Math.max(0.58, (height - GAME_OVER_PANEL_VERTICAL_INSET * 2) / GAME_OVER_PANEL_HEIGHT)
    )
    this.panelNode?.setPosition(0, 0, 0)
    this.panelNode?.setScale(this.getPanelScale())
    this.drawPanelFallback()
  }

  // 外部只传入纯状态，弹窗自身负责显示、隐藏和文本刷新。
  renderState(isGameOver: boolean, score: number, highestValue: number) {
    this.refreshScore(score)
    this.refreshHighestValue(highestValue)
    this.bringNodeToTop(this.node)

    if (isGameOver) {
      this.show()
      return
    }

    this.hide()
  }

  onDestroy() {
    this.safeOff(this.maskNode, Node.EventType.TOUCH_START, this.swallowTouch)
    this.safeOff(this.maskNode, Node.EventType.TOUCH_MOVE, this.swallowTouch)
    this.safeOff(this.maskNode, Node.EventType.TOUCH_END, this.swallowTouch)
    this.safeOff(this.maskNode, Node.EventType.TOUCH_CANCEL, this.swallowTouch)
    this.safeOff(this.panelNode, Node.EventType.TOUCH_START, this.swallowTouch)
    this.safeOff(this.panelNode, Node.EventType.TOUCH_MOVE, this.swallowTouch)
    this.safeOff(this.panelNode, Node.EventType.TOUCH_END, this.swallowTouch)
    this.safeOff(this.panelNode, Node.EventType.TOUCH_CANCEL, this.swallowTouch)
    this.unbindButtonTouchEvents(this.replayButtonNode, this.onReplayButtonTap)
    this.unbindButtonTouchEvents(this.shareButtonNode, this.onShareButtonTap)
    this.stopNodeTreeTweens(this.node)
  }

  private ensureOverlayStructure() {
    this.node.active = false
    this.overlayOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.overlayOpacity.opacity = 0

    this.maskNode = this.getOrCreateNode(this.node, 'Mask')
    this.maskNode.getComponent(Graphics) ?? this.maskNode.addComponent(Graphics)

    this.panelNode = this.getOrCreateNode(this.node, 'Panel')
    this.panelNode.getComponent(UITransform)?.setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT)
    this.configurePanelSprite(this.panelNode)

    this.ensureLabels(this.panelNode)
    this.replayButtonNode = this.ensureActionButton(
      this.panelNode,
      'ReplayButton',
      '再来一局',
      this.replayButtonSpriteFrame,
      new Color(18, 217, 117, 255),
      -150
    )
    this.shareButtonNode = this.ensureActionButton(
      this.panelNode,
      'ShareButton',
      '分享成绩',
      this.shareButtonSpriteFrame,
      new Color(16, 188, 232, 255),
      -275
    )
  }

  private configurePanelSprite(panel: Node) {
    const sprite = panel.getComponent(Sprite) ?? panel.addComponent(Sprite)
    sprite.spriteFrame = this.popupSpriteFrame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    panel.getComponent(UITransform)?.setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT)

    const graphics = panel.getComponent(Graphics) ?? panel.addComponent(Graphics)
    graphics.enabled = !this.popupSpriteFrame
  }

  /**
   * 信息层级按“最高合成 → 本次得分 → 行动按钮”纵向展开。
   * 只刷新数值节点，标题和提示保持为静态展示文案。
   */
  private ensureLabels(panel: Node) {
    this.ensureLabel(
      panel,
      'Title',
      '游戏结束',
      48,
      new Color(255, 255, 255, 255),
      new Vec3(18, 330, 0),
      430,
      72,
      true,
      new Color(183, 39, 68, 230),
      3
    )

    const highestTile = this.getOrCreateNode(panel, 'HighestTile')
    highestTile.setPosition(18, 196, 0)
    highestTile.getComponent(UITransform)?.setContentSize(120, 104)
    this.drawHighestTile(highestTile)
    this.highestValueLabel = this.ensureLabel(
      highestTile,
      'Value',
      '0',
      39,
      new Color(255, 255, 255, 255),
      Vec3.ZERO,
      108,
      80,
      true,
      new Color(191, 105, 31, 210),
      2
    )

    this.ensureLabel(
      panel,
      'HighestTitle',
      '最高合成数字',
      24,
      new Color(92, 147, 154, 255),
      new Vec3(18, 122, 0),
      380,
      42,
      false
    )
    this.ensureLabel(
      panel,
      'ScoreTitle',
      '本次得分',
      25,
      new Color(54, 110, 119, 255),
      new Vec3(18, 76, 0),
      360,
      42,
      true
    )
    this.scoreValueLabel = this.ensureLabel(
      panel,
      'ScoreValue',
      '0',
      58,
      new Color(40, 103, 117, 255),
      new Vec3(18, 18, 0),
      430,
      78,
      true
    )
    this.ensureLabel(
      panel,
      'Tip',
      '再接再厉，继续冲击 1024',
      22,
      new Color(166, 119, 76, 255),
      new Vec3(18, -48, 0),
      430,
      42,
      false
    )
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
    labelNode.setPosition(position)
    labelNode.getComponent(UITransform)?.setContentSize(width, height)
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

  private ensureActionButton(
    parent: Node,
    name: string,
    text: string,
    spriteFrame: SpriteFrame | null,
    fallbackColor: Color,
    y: number
  ) {
    const button = this.getOrCreateNode(parent, name)
    button.setPosition(18, y, 0)
    button.getComponent(UITransform)?.setContentSize(GAME_OVER_BUTTON_WIDTH, GAME_OVER_BUTTON_HEIGHT)

    const sprite = button.getComponent(Sprite) ?? button.addComponent(Sprite)
    sprite.spriteFrame = spriteFrame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    button.getComponent(UITransform)?.setContentSize(GAME_OVER_BUTTON_WIDTH, GAME_OVER_BUTTON_HEIGHT)

    const graphics = button.getComponent(Graphics) ?? button.addComponent(Graphics)
    graphics.enabled = !spriteFrame
    if (!spriteFrame) {
      this.drawButtonFallback(button, fallbackColor)
    }

    this.ensureButtonLabel(button, text)
    return button
  }

  private ensureButtonLabel(button: Node, text: string) {
    const labelNode = this.getOrCreateNode(button, 'Label')
    labelNode.setPosition(0, 4, 0)
    labelNode.getComponent(UITransform)?.setContentSize(320, 70)
    const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label)
    label.string = text
    label.fontSize = 32
    label.lineHeight = 38
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(255, 255, 255, 255)
    label.isBold = true
    const outline = labelNode.getComponent(LabelOutline) ?? labelNode.addComponent(LabelOutline)
    outline.color = new Color(33, 120, 136, 150)
    outline.width = 2
  }

  private drawMask(width: number, height: number) {
    if (!this.maskNode) {
      return
    }

    const maskTransform = this.maskNode.getComponent(UITransform) ?? this.maskNode.addComponent(UITransform)
    maskTransform.setContentSize(width, height)
    const graphics = this.maskNode.getComponent(Graphics) ?? this.maskNode.addComponent(Graphics)
    graphics.clear()
    // 使用深蓝灰遮罩衔接冬季背景，避免纯黑色让结算态显得突兀。
    graphics.fillColor = new Color(19, 42, 62, 158)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
  }

  private drawPanelFallback() {
    if (!this.panelNode || this.popupSpriteFrame) {
      return
    }

    const graphics = this.panelNode.getComponent(Graphics) ?? this.panelNode.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(225, 109, 38, 255)
    graphics.roundRect(
      -GAME_OVER_PANEL_WIDTH * 0.5,
      -GAME_OVER_PANEL_HEIGHT * 0.5,
      GAME_OVER_PANEL_WIDTH,
      GAME_OVER_PANEL_HEIGHT,
      44
    )
    graphics.fill()
    graphics.fillColor = new Color(255, 241, 216, 255)
    graphics.roundRect(
      -GAME_OVER_PANEL_WIDTH * 0.5 + 34,
      -GAME_OVER_PANEL_HEIGHT * 0.5 + 34,
      GAME_OVER_PANEL_WIDTH - 68,
      GAME_OVER_PANEL_HEIGHT - 92,
      34
    )
    graphics.fill()
    graphics.fillColor = new Color(255, 62, 104, 255)
    graphics.roundRect(-226, 228, 470, 105, 28)
    graphics.fill()
  }

  private drawHighestTile(tile: Node) {
    const graphics = tile.getComponent(Graphics) ?? tile.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(202, 122, 40, 92)
    graphics.roundRect(-56, -56, 112, 104, 22)
    graphics.fill()
    graphics.fillColor = new Color(255, 174, 70, 255)
    graphics.roundRect(-60, -48, 120, 104, 22)
    graphics.fill()
    graphics.fillColor = new Color(255, 255, 255, 42)
    graphics.roundRect(-50, 18, 100, 25, 12)
    graphics.fill()
  }

  private drawButtonFallback(button: Node, color: Color) {
    const graphics = button.getComponent(Graphics) ?? button.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = color
    graphics.roundRect(
      -GAME_OVER_BUTTON_WIDTH * 0.5,
      -GAME_OVER_BUTTON_HEIGHT * 0.5,
      GAME_OVER_BUTTON_WIDTH,
      GAME_OVER_BUTTON_HEIGHT,
      46
    )
    graphics.fill()
    graphics.lineWidth = 7
    graphics.strokeColor = new Color(255, 255, 255, 245)
    graphics.roundRect(
      -GAME_OVER_BUTTON_WIDTH * 0.5 + 5,
      -GAME_OVER_BUTTON_HEIGHT * 0.5 + 5,
      GAME_OVER_BUTTON_WIDTH - 10,
      GAME_OVER_BUTTON_HEIGHT - 10,
      41
    )
    graphics.stroke()
  }

  private bindTouchEvents() {
    this.bindSwallowNode(this.maskNode)
    this.bindSwallowNode(this.panelNode)
    this.bindButtonTouchEvents(this.replayButtonNode, this.onReplayButtonTap)
    this.bindButtonTouchEvents(this.shareButtonNode, this.onShareButtonTap)
  }

  private bindSwallowNode(node: Node | null) {
    this.safeOff(node, Node.EventType.TOUCH_START, this.swallowTouch)
    this.safeOff(node, Node.EventType.TOUCH_MOVE, this.swallowTouch)
    this.safeOff(node, Node.EventType.TOUCH_END, this.swallowTouch)
    this.safeOff(node, Node.EventType.TOUCH_CANCEL, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_START, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_MOVE, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_END, this.swallowTouch)
    this.safeOn(node, Node.EventType.TOUCH_CANCEL, this.swallowTouch)
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

  private getOrCreateNode(parent: Node, name: string) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
    }
    return node
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

  private swallowTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  private onReplayButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.replayHandler?.()
  }

  private onShareButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.shareHandler?.()
  }

  private refreshScore(score: number) {
    if (this.scoreValueLabel) {
      this.scoreValueLabel.string = `${Math.max(0, Math.floor(score))}`
    }
  }

  private refreshHighestValue(highestValue: number) {
    if (this.highestValueLabel) {
      this.highestValueLabel.string = `${Math.max(0, Math.floor(highestValue))}`
    }
  }

  private getPanelScale(factor = 1) {
    const scale = this.panelLayoutScale * factor
    return new Vec3(scale, scale, 1)
  }

  private show() {
    if (!this.overlayOpacity) {
      return
    }

    if (this.isVisible) {
      this.node.active = true
      this.overlayOpacity.opacity = 255
      this.panelNode?.setScale(this.getPanelScale())
      return
    }

    this.isVisible = true
    this.node.active = true
    this.panelNode?.setScale(this.getPanelScale(0.92))
    this.overlayOpacity.opacity = 0
    if (this.panelNode) {
      Tween.stopAllByTarget(this.panelNode)
    }
    Tween.stopAllByTarget(this.overlayOpacity)
    tween(this.overlayOpacity).to(GAME_OVER_ANIM_DURATION, { opacity: 255 }, { easing: 'quadOut' }).start()
    if (this.panelNode) {
      tween(this.panelNode)
        .to(GAME_OVER_ANIM_DURATION, { scale: this.getPanelScale() }, { easing: 'backOut' })
        .start()
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
    if (this.panelNode) {
      Tween.stopAllByTarget(this.panelNode)
    }
    Tween.stopAllByTarget(this.overlayOpacity)
    tween(this.overlayOpacity)
      .to(0.12, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        if (!this.isVisible) {
          this.node.active = false
          this.panelNode?.setScale(this.getPanelScale())
        }
      })
      .start()
  }
}
