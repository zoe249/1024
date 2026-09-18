import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  UITransform,
  Vec3,
  view
} from 'cc'

const { ccclass } = _decorator

/** 登录状态层只渲染进度和失败操作，不直接读写会话。 */
@ccclass('LoginStatusController')
export class LoginStatusController extends Component {
  private messageLabel: Label | null = null
  private retryButton: Node | null = null
  private closeButton: Node | null = null
  private retryHandler: (() => void) | null = null
  private closeHandler: (() => void) | null = null

  setup(onClose: () => void) {
    this.closeHandler = onClose
    this.ensureStructure()
    this.node.active = false
  }

  showLoading(message: string) {
    this.ensureStructure()
    this.messageLabel!.string = message
    this.retryButton!.active = false
    this.closeButton!.active = false
    this.node.active = true
    this.node.setSiblingIndex(this.node.parent?.children.length ? this.node.parent.children.length - 1 : 0)
  }

  showFailure(message: string, onRetry: () => void) {
    this.ensureStructure()
    this.messageLabel!.string = message
    this.retryHandler = onRetry
    this.retryButton!.active = true
    this.closeButton!.active = true
    this.node.active = true
  }

  hide() {
    this.retryHandler = null
    this.node.active = false
  }

  syncLayout() {
    const visible = view.getVisibleSize()
    const width = Math.max(750, visible.width)
    const height = Math.max(1335, visible.height)
    ;(this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(width, height)
    const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(20, 40, 43, 205)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
  }

  onDestroy() {
    // 节点销毁时引擎会自动清理事件。子按钮可能先于父控制器进入销毁流程，
    // 此处不能再次调用 off，否则微信运行时会访问已释放的事件处理器。
    this.messageLabel = null
    this.retryButton = null
    this.closeButton = null
    this.retryHandler = null
    this.closeHandler = null
  }

  private ensureStructure() {
    if (this.messageLabel && this.retryButton && this.closeButton) {
      this.syncLayout()
      return
    }
    this.syncLayout()

    const panel = new Node('LoginStatusPanel')
    panel.setParent(this.node)
    panel.setPosition(0, 0, 0)
    panel.addComponent(UITransform).setContentSize(560, 300)
    const panelGraphics = panel.addComponent(Graphics)
    panelGraphics.fillColor = new Color(255, 248, 220, 255)
    panelGraphics.strokeColor = new Color(72, 202, 157, 255)
    panelGraphics.lineWidth = 5
    panelGraphics.roundRect(-280, -150, 560, 300, 28)
    panelGraphics.fill()
    panelGraphics.stroke()

    this.messageLabel = this.createLabel(panel, 'Message', '正在登录…', 31, new Vec3(0, 38, 0), 490, 100)
    this.retryButton = this.createButton(panel, 'RetryButton', '重试', -120)
    this.closeButton = this.createButton(panel, 'CloseButton', '关闭', 120)
    this.retryButton.on(Node.EventType.TOUCH_END, this.onRetryTap, this)
    this.closeButton.on(Node.EventType.TOUCH_END, this.onCloseTap, this)
  }

  private createButton(parent: Node, name: string, text: string, x: number) {
    const button = new Node(name)
    button.setParent(parent)
    button.setPosition(x, -73, 0)
    button.addComponent(UITransform).setContentSize(190, 72)
    const graphics = button.addComponent(Graphics)
    graphics.fillColor = name === 'RetryButton'
      ? new Color(72, 202, 157, 255)
      : new Color(137, 154, 155, 255)
    graphics.roundRect(-95, -36, 190, 72, 20)
    graphics.fill()
    this.createLabel(button, 'Label', text, 27, Vec3.ZERO, 170, 60).color = Color.WHITE
    return button
  }

  private createLabel(parent: Node, name: string, text: string, fontSize: number, position: Vec3, width: number, height: number) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(position)
    node.addComponent(UITransform).setContentSize(width, height)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = fontSize + 8
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.overflow = Label.Overflow.SHRINK
    label.color = new Color(79, 46, 27, 255)
    label.isBold = true
    return label
  }

  private onRetryTap(event: EventTouch) {
    event.propagationStopped = true
    this.retryHandler?.()
  }

  private onCloseTap(event: EventTouch) {
    event.propagationStopped = true
    this.closeHandler?.()
  }
}
