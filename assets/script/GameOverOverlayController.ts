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
// 面板尺寸与项目现有 Popup 素材比例接近，同时为纵向信息和 icon 操作区留足空间。
const GAME_OVER_PANEL_WIDTH = 610
const GAME_OVER_PANEL_HEIGHT = 790
const GAME_OVER_PANEL_EDGE_INSET = 32
const GAME_OVER_PANEL_VERTICAL_INSET = 64
const GAME_OVER_ACTION_CENTER_X = 18
const GAME_OVER_ACTION_CENTER_Y = -232
const GAME_OVER_ACTION_SPACING = 116
const GAME_OVER_ICON_SIZE = 72
const GAME_OVER_HOME_ICON_SIZE = 80
const GAME_OVER_ICON_HIT_SIZE = 104
const GAME_OVER_ICON_LABEL_Y = -60
// Modal 图标原图是 208x214，显式按原图缩放可以避开 Sprite 自身 raw 尺寸覆盖 UITransform 的情况。
const GAME_OVER_ICON_SOURCE_WIDTH = 208
const GAME_OVER_ICON_SOURCE_HEIGHT = 214

type GameOverIconKind = 'replay' | 'home' | 'share'

type GameOverOverlayOptions = {
  hostNode: Node
  replayHandler: (() => void) | null
  shareHandler: (() => void) | null
  homeHandler: (() => void) | null
  popupSpriteFrame?: SpriteFrame | null
  replayButtonSpriteFrame?: SpriteFrame | null
  homeButtonSpriteFrame?: SpriteFrame | null
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
  private homeButtonNode: Node | null = null
  private shareButtonNode: Node | null = null
  private overlayOpacity: UIOpacity | null = null
  private isVisible = false
  private replayHandler: (() => void) | null = null
  private shareHandler: (() => void) | null = null
  private homeHandler: (() => void) | null = null
  private popupSpriteFrame: SpriteFrame | null = null
  private replayButtonSpriteFrame: SpriteFrame | null = null
  private homeButtonSpriteFrame: SpriteFrame | null = null
  private shareButtonSpriteFrame: SpriteFrame | null = null
  private panelLayoutScale = 1

  setup(options: GameOverOverlayOptions) {
    this.hostNode = options.hostNode
    this.replayHandler = options.replayHandler
    this.shareHandler = options.shareHandler
    this.homeHandler = options.homeHandler
    this.popupSpriteFrame = options.popupSpriteFrame ?? null
    this.replayButtonSpriteFrame = options.replayButtonSpriteFrame ?? null
    this.homeButtonSpriteFrame = options.homeButtonSpriteFrame ?? null
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
    this.unbindButtonTouchEvents(this.homeButtonNode, this.onHomeButtonTap)
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
    this.replayButtonNode = this.ensureIconAction(
      this.panelNode,
      'ReplayButton',
      '再来',
      this.replayButtonSpriteFrame,
      'replay',
      GAME_OVER_ACTION_CENTER_X - GAME_OVER_ACTION_SPACING,
      GAME_OVER_ACTION_CENTER_Y,
      GAME_OVER_ICON_SIZE
    )
    this.homeButtonNode = this.ensureIconAction(
      this.panelNode,
      'HomeButton',
      '首页',
      this.homeButtonSpriteFrame,
      'home',
      GAME_OVER_ACTION_CENTER_X,
      GAME_OVER_ACTION_CENTER_Y + 10,
      GAME_OVER_HOME_ICON_SIZE
    )
    this.shareButtonNode = this.ensureIconAction(
      this.panelNode,
      'ShareButton',
      '分享',
      this.shareButtonSpriteFrame,
      'share',
      GAME_OVER_ACTION_CENTER_X + GAME_OVER_ACTION_SPACING,
      GAME_OVER_ACTION_CENTER_Y,
      GAME_OVER_ICON_SIZE
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

  private ensureIconAction(
    parent: Node,
    name: string,
    text: string,
    spriteFrame: SpriteFrame | null,
    iconKind: GameOverIconKind,
    x: number,
    y: number,
    iconSize: number
  ) {
    const button = this.getOrCreateNode(parent, name)
    button.setPosition(x, y, 0)
    // icon 视觉较轻，但触摸热区保持足够大，避免小屏误点。
    button.getComponent(UITransform)?.setContentSize(GAME_OVER_ICON_HIT_SIZE, GAME_OVER_ICON_HIT_SIZE + 34)
    // 兼容旧版大按钮节点热更新复用：父节点只作为点击热区，不再渲染旧 Sprite/Graphics。
    const legacySprite = button.getComponent(Sprite)
    if (legacySprite) {
      legacySprite.enabled = false
    }
    const legacyGraphics = button.getComponent(Graphics)
    if (legacyGraphics) {
      legacyGraphics.clear()
      legacyGraphics.enabled = false
    }

    const iconNode = this.getOrCreateNode(button, 'Icon')
    iconNode.setPosition(0, 8, 0)
    const iconTransform = iconNode.getComponent(UITransform) ?? iconNode.addComponent(UITransform)
    const sprite = iconNode.getComponent(Sprite) ?? iconNode.addComponent(Sprite)
    sprite.spriteFrame = spriteFrame
    sprite.enabled = !!spriteFrame
    const graphics = iconNode.getComponent(Graphics) ?? iconNode.addComponent(Graphics)
    graphics.clear()
    if (spriteFrame) {
      iconTransform.setContentSize(GAME_OVER_ICON_SOURCE_WIDTH, GAME_OVER_ICON_SOURCE_HEIGHT)
      sprite.sizeMode = Sprite.SizeMode.RAW
      iconNode.setScale(this.getIconImageScale(iconSize))
      graphics.enabled = false
    } else {
      iconTransform.setContentSize(iconSize, iconSize)
      iconNode.setScale(Vec3.ONE)
      graphics.enabled = true
      this.drawIconFallback(iconNode, iconKind, iconSize)
    }

    const fallbackIcon = iconNode.getChildByName('FallbackIcon')
    if (fallbackIcon) {
      fallbackIcon.active = !spriteFrame
    }

    this.ensureIconLabel(button, text)
    return button
  }

  private getIconImageScale(iconSize: number) {
    const scale = iconSize / GAME_OVER_ICON_SOURCE_WIDTH
    return new Vec3(scale, scale, 1)
  }

  private ensureIconLabel(button: Node, text: string) {
    const labelNode = this.getOrCreateNode(button, 'Label')
    labelNode.setPosition(0, GAME_OVER_ICON_LABEL_Y, 0)
    labelNode.getComponent(UITransform)?.setContentSize(110, 36)
    const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label)
    label.string = text
    label.fontSize = 21
    label.lineHeight = 28
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(93, 152, 162, 255)
    label.isBold = true
    const outline = labelNode.getComponent(LabelOutline) ?? labelNode.addComponent(LabelOutline)
    outline.color = new Color(255, 255, 255, 150)
    outline.width = 1
  }

  private drawIconFallback(iconNode: Node, iconKind: GameOverIconKind, iconSize: number) {
    const graphics = iconNode.getComponent(Graphics) ?? iconNode.addComponent(Graphics)
    graphics.clear()
    const halfSize = iconSize * 0.5
    const innerSize = iconSize * 0.78
    const innerHalf = innerSize * 0.5
    graphics.fillColor = new Color(249, 253, 255, 255)
    graphics.roundRect(-halfSize, -halfSize, iconSize, iconSize, iconSize * 0.34)
    graphics.fill()
    graphics.fillColor = new Color(255, 59, 107, 255)
    graphics.roundRect(-innerHalf, -innerHalf, innerSize, innerSize, innerSize * 0.33)
    graphics.fill()

    // 缺少图片引用时用简化符号兜底；正式场景会绑定 Modal 下的三枚 icon。
    const iconText = iconKind === 'replay' ? '↻' : iconKind === 'home' ? '⌂' : '↗'
    const fallbackLabel = this.getOrCreateNode(iconNode, 'FallbackIcon')
    fallbackLabel.setPosition(0, iconKind === 'home' ? 0 : 1, 0)
    fallbackLabel.getComponent(UITransform)?.setContentSize(innerSize, innerSize)
    const label = fallbackLabel.getComponent(Label) ?? fallbackLabel.addComponent(Label)
    label.string = iconText
    label.fontSize = iconKind === 'home' ? 55 : 58
    label.lineHeight = 62
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(255, 255, 255, 255)
    label.isBold = true
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

  private bindTouchEvents() {
    this.bindSwallowNode(this.maskNode)
    this.bindSwallowNode(this.panelNode)
    this.bindButtonTouchEvents(this.replayButtonNode, this.onReplayButtonTap)
    this.bindButtonTouchEvents(this.homeButtonNode, this.onHomeButtonTap)
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

  private onHomeButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.homeHandler?.()
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
