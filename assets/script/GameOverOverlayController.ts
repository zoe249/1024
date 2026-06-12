import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'

const { ccclass } = _decorator

// 结算弹窗的进入和退出动画统一控制在较短时间，避免盖住游戏结束反馈太久。
const GAME_OVER_ANIM_DURATION = 0.18
// 弹窗面板尺寸固定，布局位置再根据根节点尺寸居中适配。
const GAME_OVER_PANEL_WIDTH = 540
const GAME_OVER_PANEL_HEIGHT = 520

@ccclass('GameOverOverlayController')
export class GameOverOverlayController extends Component {
  // 持有 play 根节点，用于读取当前画布尺寸并保证遮罩铺满屏幕。
  private hostNode: Node | null = null
  // 全屏蒙版节点，只负责压暗背景和拦截触摸。
  private maskNode: Node | null = null
  // 中央结算面板节点。
  private panelNode: Node | null = null
  // 本次分数数字文本，renderState 时跟随逻辑层传入的分数刷新。
  private scoreValueLabel: Label | null = null
  // 最高合成数字文本，只在逻辑层传入后刷新显示。
  private highestValueLabel: Label | null = null
  // 重玩按钮节点，销毁时需要解绑触摸事件。
  private replayButtonNode: Node | null = null
  // 分享按钮节点，销毁时需要解绑触摸事件。
  private shareButtonNode: Node | null = null
  // 透明度组件单独缓存，方便做整层淡入淡出。
  private overlayOpacity: UIOpacity | null = null
  // 当前是否已经展示，避免每帧 renderState 都重复启动弹窗动画。
  private isVisible = false
  // 重玩只通知逻辑层处理，UI 层不直接清棋盘。
  private replayHandler: (() => void) | null = null
  // 分享只通知逻辑层适配平台 API。
  private shareHandler: (() => void) | null = null

  setup(options: {
    hostNode: Node
    replayHandler: (() => void) | null
    shareHandler: (() => void) | null
  }) {
    this.hostNode = options.hostNode
    this.replayHandler = options.replayHandler
    this.shareHandler = options.shareHandler
    this.ensureOverlayStructure()
    this.bindTouchEvents()
    this.syncLayout()
  }

  // 屏幕尺寸变化或首帧安全区稳定后，重新铺满遮罩并保持面板居中。
  syncLayout() {
    const hostTransform = this.hostNode?.getComponent(UITransform)
    const overlayTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const width = hostTransform?.width ?? overlayTransform.width ?? 750
    const height = hostTransform?.height ?? overlayTransform.height ?? 1334
    overlayTransform.setContentSize(width, height)

    this.drawMask(width, height)
    this.panelNode?.setPosition(0, 0, 0)
    this.drawPanel()
  }

  // 外部只传入是否结束和最终分数，弹窗自己负责显隐和动画。
  renderState(isGameOver: boolean, score: number, highestValue: number) {
    this.refreshScore(score)
    this.refreshHighestValue(highestValue)
    // 结算层必须始终在棋子、特效、技能栏和暂停层之上。
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

    let mask = this.node.getChildByName('Mask')
    if (!mask) {
      mask = new Node('Mask')
      mask.setParent(this.node)
      mask.addComponent(UITransform)
      mask.addComponent(Graphics)
    }
    this.maskNode = mask

    let panel = this.node.getChildByName('Panel')
    if (!panel) {
      panel = new Node('Panel')
      panel.setParent(this.node)
      panel.addComponent(UITransform).setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT)
      panel.addComponent(Graphics)
    }
    this.panelNode = panel

    this.ensureLabels(panel)
    this.replayButtonNode = this.ensureActionButton(panel, 'ReplayButton', '重玩', new Color(73, 215, 164, 255), -116)
    this.shareButtonNode = this.ensureActionButton(panel, 'ShareButton', '分享', new Color(70, 161, 218, 255), 116)
  }

  private ensureLabels(panel: Node) {
    this.ensureLabel(panel, 'Title', '游戏结束', 44, new Color(46, 108, 121, 255), new Vec3(0, 160, 0), 420, 68, true)
    this.ensureLabel(panel, 'ScoreTitle', '本次分数', 26, new Color(105, 153, 164, 255), new Vec3(0, 78, 0), 360, 42, false)
    this.scoreValueLabel = this.ensureLabel(
      panel,
      'ScoreValue',
      '0',
      58,
      new Color(255, 179, 79, 255),
      new Vec3(0, 18, 0),
      420,
      82,
      true
    )
    this.highestValueLabel = this.ensureLabel(
      panel,
      'HighestValue',
      '最高合成：0',
      28,
      new Color(46, 108, 121, 255),
      new Vec3(0, -60, 0),
      420,
      46,
      true
    )
    this.ensureLabel(panel, 'Tip', '再来一局，继续冲 1024', 24, new Color(105, 153, 164, 255), new Vec3(0, -104, 0), 420, 44, false)
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
    isBold: boolean
  ) {
    let labelNode = parent.getChildByName(name)
    if (!labelNode) {
      labelNode = new Node(name)
      labelNode.setParent(parent)
      labelNode.addComponent(UITransform)
    }

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
    outline.color = new Color(255, 255, 255, isBold ? 210 : 0)
    outline.width = isBold ? 2 : 0
    return label
  }

  private ensureActionButton(parent: Node, name: string, text: string, color: Color, x: number) {
    let button = parent.getChildByName(name)
    if (!button) {
      button = new Node(name)
      button.setParent(parent)
      button.addComponent(UITransform).setContentSize(196, 86)
      button.addComponent(Graphics)
    }

    button.setPosition(x, -166, 0)
    this.drawButton(button, color)
    this.ensureButtonLabel(button, text)
    return button
  }

  private ensureButtonLabel(button: Node, text: string) {
    let labelNode = button.getChildByName('Label')
    if (!labelNode) {
      labelNode = new Node('Label')
      labelNode.setParent(button)
      labelNode.addComponent(UITransform).setContentSize(180, 62)
    }

    labelNode.setPosition(0, 0, 0)
    const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label)
    label.string = text
    label.fontSize = 30
    label.lineHeight = 36
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
    graphics.fillColor = new Color(0, 0, 0, 168)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
  }

  private drawPanel() {
    if (!this.panelNode) {
      return
    }

    const transform = this.panelNode.getComponent(UITransform) ?? this.panelNode.addComponent(UITransform)
    transform.setContentSize(GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT)
    const graphics = this.panelNode.getComponent(Graphics) ?? this.panelNode.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(49, 123, 136, 68)
    graphics.roundRect(-GAME_OVER_PANEL_WIDTH * 0.5 + 8, -GAME_OVER_PANEL_HEIGHT * 0.5 - 10, GAME_OVER_PANEL_WIDTH - 16, GAME_OVER_PANEL_HEIGHT, 34)
    graphics.fill()
    graphics.fillColor = new Color(255, 255, 255, 248)
    graphics.roundRect(-GAME_OVER_PANEL_WIDTH * 0.5, -GAME_OVER_PANEL_HEIGHT * 0.5, GAME_OVER_PANEL_WIDTH, GAME_OVER_PANEL_HEIGHT, 34)
    graphics.fill()
    graphics.lineWidth = 4
    graphics.strokeColor = new Color(205, 237, 240, 210)
    graphics.roundRect(-GAME_OVER_PANEL_WIDTH * 0.5 + 4, -GAME_OVER_PANEL_HEIGHT * 0.5 + 4, GAME_OVER_PANEL_WIDTH - 8, GAME_OVER_PANEL_HEIGHT - 8, 30)
    graphics.stroke()
  }

  private drawButton(button: Node, color: Color) {
    const transform = button.getComponent(UITransform) ?? button.addComponent(UITransform)
    transform.setContentSize(196, 86)
    const graphics = button.getComponent(Graphics) ?? button.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(color.r, color.g, color.b, 255)
    graphics.roundRect(-98, -43, 196, 86, 28)
    graphics.fill()
    graphics.fillColor = new Color(255, 255, 255, 42)
    graphics.roundRect(-88, 4, 176, 28, 14)
    graphics.fill()
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
    if (!this.canUseNode(node)) {
      return
    }

    node.on(eventType, handler, this)
  }

  private safeOff(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(eventType, handler, this)
  }

  // setSiblingIndex 需要节点仍挂在父节点下，切场景销毁阶段必须先判断 parent。
  private bringNodeToTop(node: Node | null) {
    const parent = node?.parent ?? null
    if (!this.canUseNode(node) || !parent?.isValid) {
      return
    }

    node.setSiblingIndex(parent.children.length - 1)
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
    if (!this.scoreValueLabel) {
      return
    }

    this.scoreValueLabel.string = `${Math.max(0, Math.floor(score))}`
  }

  private refreshHighestValue(highestValue: number) {
    if (!this.highestValueLabel) {
      return
    }

    this.highestValueLabel.string = `最高合成：${Math.max(0, Math.floor(highestValue))}`
  }

  private show() {
    if (!this.overlayOpacity) {
      return
    }

    if (this.isVisible) {
      this.node.active = true
      this.overlayOpacity.opacity = 255
      return
    }

    this.isVisible = true
    this.node.active = true
    this.panelNode?.setScale(new Vec3(0.94, 0.94, 1))
    this.overlayOpacity.opacity = 0
    if (this.panelNode) {
      Tween.stopAllByTarget(this.panelNode)
    }
    Tween.stopAllByTarget(this.overlayOpacity)
    tween(this.overlayOpacity).to(GAME_OVER_ANIM_DURATION, { opacity: 255 }, { easing: 'quadOut' }).start()
    if (this.panelNode) {
      tween(this.panelNode).to(GAME_OVER_ANIM_DURATION, { scale: Vec3.ONE }, { easing: 'backOut' }).start()
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
          this.panelNode?.setScale(Vec3.ONE)
        }
      })
      .start()
  }
}
