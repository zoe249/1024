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
  UITransform,
  UIOpacity,
  Vec3
} from 'cc'
import { ECONOMY_CONFIG, type EconomySnapshot } from './PlayerEconomyStore'
import type { SkillKind } from './SkillStock'

const { ccclass, property } = _decorator

type SkillShopOptions = {
  hostNode: Node
  onPurchase: (skill: SkillKind) => void
  onStart: () => void
  onClose: () => void
}

type SkillRowConfig = {
  skill: SkillKind
  name: string
  price: number
  y: number
  icon: SpriteFrame | null
}

// 弹窗按设计稿使用固定视觉尺寸，再根据设备可用区域整体等比缩放。
const PANEL_WIDTH = 650
const PANEL_HEIGHT = 680
const PANEL_EDGE_INSET = 32
const PANEL_VERTICAL_INSET = 72
const POPUP_ANIM_DURATION = 0.18

@ccclass('SkillShopPopupController')
export class SkillShopPopupController extends Component {
  // 面板、按钮和技能图标全部引用项目现有素材，Prefab 可以在其它入口直接复用。
  @property({ type: SpriteFrame, tooltip: '购买技能弹窗底图' })
  popupSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '右上角关闭按钮图片' })
  closeButtonSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '绿色购买按钮图片' })
  greenButtonSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '蓝色开始游戏按钮图片' })
  blueButtonSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '炸弹技能图片' })
  bombSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '锤子技能图片' })
  hammerSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '交换技能图片' })
  swapSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '金币图片' })
  coinSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '技能数量底图，复用游戏内 AmountBG' })
  amountBgSpriteFrame: SpriteFrame | null = null

  @property({ type: [SpriteFrame], tooltip: '技能数量数字贴图，按 0-9 顺序配置' })
  counterNumberSpriteFrames: SpriteFrame[] = []

  private hostNode: Node | null = null
  private panelNode: Node | null = null
  private maskNode: Node | null = null
  private closeButtonNode: Node | null = null
  private startButtonNode: Node | null = null
  private messageLabel: Label | null = null
  private balanceLabel: Label | null = null
  private overlayOpacity: UIOpacity | null = null
  private purchaseHandler: ((skill: SkillKind) => void) | null = null
  private startHandler: (() => void) | null = null
  private closeHandler: (() => void) | null = null
  private purchaseButtonNodes = new Map<SkillKind, Node>()
  private purchaseButtonLabels = new Map<SkillKind, Label>()
  private skillCountSprites = new Map<SkillKind, Sprite>()
  private skillCountFallbackLabels = new Map<SkillKind, Label>()
  private currentSkillCounts: Record<SkillKind, number> = {
    bomb: 0,
    hammer: 0,
    swap: 0
  }
  private purchaseTapHandlers = new Map<SkillKind, (event: EventTouch) => void>()
  private panelLayoutScale = 1

  setup(options: SkillShopOptions) {
    this.hostNode = options.hostNode
    this.purchaseHandler = options.onPurchase
    this.startHandler = options.onStart
    this.closeHandler = options.onClose
    this.ensureStructure()
    this.bindTouchEvents()
    this.syncLayout()
  }

  /**
   * 只接收经济层快照并刷新展示，金币扣除和技能库存变更仍由 HomeSceneController 负责。
   */
  renderState(snapshot: EconomySnapshot) {
    if (this.balanceLabel) {
      this.balanceLabel.string = `${snapshot.coins}`
    }

    this.currentSkillCounts = { ...snapshot.skills }
    this.refreshSkillRows(snapshot)
  }

  show() {
    if (!this.panelNode || !this.overlayOpacity) {
      return
    }

    this.node.active = true
    this.node.setSiblingIndex(this.node.parent?.children.length ? this.node.parent.children.length - 1 : 0)
    this.overlayOpacity.opacity = 0
    this.panelNode.setScale(this.getPanelScale(0.92))
    Tween.stopAllByTarget(this.overlayOpacity)
    Tween.stopAllByTarget(this.panelNode)
    tween(this.overlayOpacity).to(0.14, { opacity: 255 }).start()
    tween(this.panelNode)
      .to(POPUP_ANIM_DURATION, { scale: this.getPanelScale() }, { easing: 'backOut' })
      .start()
  }

  hide(onHidden?: () => void) {
    if (!this.panelNode || !this.overlayOpacity || !this.node.active) {
      onHidden?.()
      return
    }

    Tween.stopAllByTarget(this.overlayOpacity)
    Tween.stopAllByTarget(this.panelNode)
    tween(this.overlayOpacity)
      .to(0.14, { opacity: 0 })
      .call(() => {
        this.node.active = false
        onHidden?.()
      })
      .start()
    tween(this.panelNode)
      .to(0.14, { scale: this.getPanelScale(0.96) }, { easing: 'quadIn' })
      .start()
  }

  showMessage(message: string, isError = false) {
    if (!this.messageLabel) {
      return
    }

    this.messageLabel.string = message
    this.messageLabel.color = isError
      ? new Color(202, 73, 63, 255)
      : new Color(43, 151, 92, 255)
  }

  // 首帧和屏幕尺寸变化时，遮罩铺满宿主节点，面板保持安全边距内居中。
  syncLayout() {
    const hostTransform = this.hostNode?.getComponent(UITransform)
    const rootTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const width = hostTransform?.width ?? rootTransform.width ?? 750
    const height = hostTransform?.height ?? rootTransform.height ?? 1334
    rootTransform.setContentSize(width, height)
    this.drawMask(width, height)

    this.panelLayoutScale = Math.min(
      1,
      Math.max(0.56, (width - PANEL_EDGE_INSET * 2) / PANEL_WIDTH),
      Math.max(0.56, (height - PANEL_VERTICAL_INSET * 2) / PANEL_HEIGHT)
    )
    this.panelNode?.setPosition(0, 0, 0)
    this.panelNode?.setScale(this.getPanelScale())
  }

  onDestroy() {
    this.unbindTouchEvents()
    // 切场景时子节点可能已经被引擎先行销毁，只清理仍有效的缓存目标。
    this.stopNodeTween(this.node)
    this.stopNodeTween(this.panelNode)
    this.stopNodeTween(this.closeButtonNode)
    this.stopNodeTween(this.startButtonNode)
    this.purchaseButtonNodes.forEach((node) => this.stopNodeTween(node))
    if (this.overlayOpacity?.isValid) {
      Tween.stopAllByTarget(this.overlayOpacity)
    }
    this.purchaseButtonNodes.clear()
    this.purchaseButtonLabels.clear()
    this.skillCountSprites.clear()
    this.skillCountFallbackLabels.clear()
    this.purchaseTapHandlers.clear()
  }

  private ensureStructure() {
    this.overlayOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.maskNode = this.ensureMask()
    this.panelNode = this.ensurePanel()
    this.ensureHeader()
    this.ensureBalance()
    this.ensureSkillRows()
    this.ensureFooter()
    this.node.active = false
  }

  private ensureMask() {
    const mask = this.getOrCreateNode(this.node, 'Mask')
    mask.setSiblingIndex(0)
    mask.getComponent(UITransform)?.setContentSize(750, 1334)
    mask.getComponent(Graphics) ?? mask.addComponent(Graphics)
    return mask
  }

  private ensurePanel() {
    const panel = this.getOrCreateNode(this.node, 'Panel')
    const sprite = panel.getComponent(Sprite) ?? panel.addComponent(Sprite)
    sprite.spriteFrame = this.popupSpriteFrame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    // SpriteFrame 赋值会先恢复素材原始尺寸，因此自定义尺寸必须放在最后设置。
    panel.getComponent(UITransform)?.setContentSize(PANEL_WIDTH, PANEL_HEIGHT)
    return panel
  }

  private ensureHeader() {
    if (!this.panelNode) {
      return
    }

    this.ensureLabel(this.panelNode, 'Title', '购买技能', 48, new Vec3(0, 282, 0), 360, 68, new Color(255, 255, 255, 255), true)
    this.closeButtonNode = this.ensureSpriteNode(
      this.panelNode,
      'CloseButton',
      this.closeButtonSpriteFrame,
      new Vec3(290, 286, 0),
      68,
      71
    )
  }

  private ensureBalance() {
    if (!this.panelNode) {
      return
    }

    const balanceGroup = this.getOrCreateNode(this.panelNode, 'Balance')
    balanceGroup.setPosition(0, 218, 0)
    balanceGroup.getComponent(UITransform)?.setContentSize(230, 48)
    this.ensureSpriteNode(balanceGroup, 'Coin', this.coinSpriteFrame, new Vec3(-58, 0, 0), 38, 40)
    this.balanceLabel = this.ensureLabel(
      balanceGroup,
      'Amount',
      '0',
      28,
      new Vec3(32, 0, 0),
      140,
      46,
      new Color(133, 67, 22, 255),
      true
    )
  }

  private ensureSkillRows() {
    if (!this.panelNode) {
      return
    }

    const rows: SkillRowConfig[] = [
      { skill: 'bomb', name: '炸弹', price: 500, y: 126, icon: this.bombSpriteFrame },
      { skill: 'hammer', name: '锤子', price: 300, y: -2, icon: this.hammerSpriteFrame },
      { skill: 'swap', name: '交换', price: 400, y: -130, icon: this.swapSpriteFrame }
    ]

    rows.forEach((row, index) => {
      const rowNode = this.getOrCreateNode(this.panelNode!, `SkillRow_${row.skill}`)
      rowNode.setPosition(0, row.y, 0)
      rowNode.getComponent(UITransform)?.setContentSize(540, 118)
      this.ensureSpriteNode(rowNode, 'Icon', row.icon, new Vec3(-218, 0, 0), 104, 107)
      this.ensureSkillCountBadge(rowNode, row.skill)
      this.ensureLabel(rowNode, 'Name', row.name, 34, new Vec3(-58, 24, 0), 230, 52, new Color(112, 52, 14, 255), true)
      this.ensurePrice(rowNode, row.price)
      const buyButton = this.ensureImageButton(
        rowNode,
        'BuyButton',
        this.greenButtonSpriteFrame,
        '购买',
        new Vec3(205, 0, 0),
        150,
        58,
        30
      )
      this.purchaseButtonNodes.set(row.skill, buyButton)
      const buyLabel = buyButton.getChildByName('Label')?.getComponent(Label) ?? null
      if (buyLabel) {
        this.purchaseButtonLabels.set(row.skill, buyLabel)
      }
      if (index < rows.length - 1) {
        this.drawDivider(rowNode)
      }
    })
  }

  private ensureSkillCountBadge(rowNode: Node, skill: SkillKind) {
    const badge = this.getOrCreateNode(rowNode, 'CountBadge')
    badge.setPosition(-179, -36, 0)
    badge.getComponent(UITransform)?.setContentSize(36, 36)

    const amountBg = this.ensureSpriteNode(badge, 'AmountBG', this.amountBgSpriteFrame, Vec3.ZERO, 36, 36)
    amountBg.setSiblingIndex(0)

    const countNode = this.ensureSpriteNode(badge, 'Count', null, new Vec3(0, 0, 0), 14, 22)
    countNode.setSiblingIndex(1)
    const countSprite = countNode.getComponent(Sprite) ?? countNode.addComponent(Sprite)
    this.skillCountSprites.set(skill, countSprite)

    const fallbackLabel = this.ensureLabel(
      badge,
      'FallbackCount',
      '0',
      19,
      Vec3.ZERO,
      28,
      28,
      new Color(255, 255, 255, 255),
      true
    )
    fallbackLabel.node.setSiblingIndex(2)
    this.skillCountFallbackLabels.set(skill, fallbackLabel)
  }

  private refreshSkillRows(snapshot: EconomySnapshot) {
    const skills: SkillKind[] = ['bomb', 'hammer', 'swap']
    for (const skill of skills) {
      const count = Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, Math.floor(snapshot.skills[skill])))
      const numberSpriteFrame = this.getCounterNumberSpriteFrame(count)
      const countSprite = this.skillCountSprites.get(skill) ?? null
      const fallbackLabel = this.skillCountFallbackLabels.get(skill) ?? null
      if (countSprite) {
        countSprite.spriteFrame = numberSpriteFrame
        countSprite.enabled = !!numberSpriteFrame
      }
      if (fallbackLabel) {
        fallbackLabel.string = `${count}`
        fallbackLabel.node.active = !numberSpriteFrame
      }

      const isMax = count >= ECONOMY_CONFIG.maxSkillCount
      const button = this.purchaseButtonNodes.get(skill) ?? null
      const buttonLabel = this.purchaseButtonLabels.get(skill) ?? null
      if (buttonLabel) {
        buttonLabel.string = isMax ? '已满' : '购买'
      }
      if (button) {
        const opacity = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity)
        opacity.opacity = isMax ? 150 : 255
      }
    }
  }

  private getCounterNumberSpriteFrame(count: number) {
    const displayCount = Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, count))
    const displayName = `${displayCount}`
    return (
      this.counterNumberSpriteFrames.find((spriteFrame) => spriteFrame?.name === displayName) ??
      this.counterNumberSpriteFrames[displayCount] ??
      null
    )
  }

  private ensurePrice(rowNode: Node, price: number) {
    const priceNode = this.getOrCreateNode(rowNode, 'Price')
    priceNode.setPosition(-56, -27, 0)
    priceNode.getComponent(UITransform)?.setContentSize(158, 46)
    const graphics = priceNode.getComponent(Graphics) ?? priceNode.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(255, 218, 154, 230)
    graphics.roundRect(-79, -23, 158, 46, 23)
    graphics.fill()
    this.ensureSpriteNode(priceNode, 'Coin', this.coinSpriteFrame, new Vec3(-55, 0, 0), 36, 38)
    this.ensureLabel(priceNode, 'Amount', `${price}`, 28, new Vec3(23, 0, 0), 100, 42, new Color(133, 67, 22, 255), true)
  }

  private drawDivider(rowNode: Node) {
    const divider = this.getOrCreateNode(rowNode, 'Divider')
    divider.setPosition(5, -63, 0)
    divider.getComponent(UITransform)?.setContentSize(470, 2)
    const graphics = divider.getComponent(Graphics) ?? divider.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(239, 189, 125, 125)
    graphics.roundRect(-235, -1, 470, 2, 1)
    graphics.fill()
  }

  private ensureFooter() {
    if (!this.panelNode) {
      return
    }

    this.messageLabel = this.ensureLabel(
      this.panelNode,
      'Message',
      '可在开始前补充技能',
      22,
      new Vec3(0, -216, 0),
      520,
      38,
      new Color(153, 102, 64, 255),
      false
    )
    this.startButtonNode = this.ensureImageButton(
      this.panelNode,
      'StartButton',
      this.blueButtonSpriteFrame,
      '开始游戏',
      new Vec3(0, -282, 0),
      276,
      106,
      36
    )
  }

  private ensureImageButton(
    parent: Node,
    name: string,
    spriteFrame: SpriteFrame | null,
    text: string,
    position: Vec3,
    width: number,
    height: number,
    fontSize: number
  ) {
    const button = this.ensureSpriteNode(parent, name, spriteFrame, position, width, height)
    this.ensureLabel(button, 'Label', text, fontSize, Vec3.ZERO, width - 20, height - 12, new Color(255, 255, 255, 255), true)
    return button
  }

  private ensureSpriteNode(
    parent: Node,
    name: string,
    spriteFrame: SpriteFrame | null,
    position: Vec3,
    width: number,
    height: number
  ) {
    const node = this.getOrCreateNode(parent, name)
    node.setPosition(position)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.spriteFrame = spriteFrame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    // 保持设计稿尺寸，不让 503px 按钮和 121px 金币图按原图大小撑开布局。
    node.getComponent(UITransform)?.setContentSize(width, height)
    return node
  }

  private ensureLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    position: Vec3,
    width: number,
    height: number,
    color: Color,
    isBold: boolean
  ) {
    const node = this.getOrCreateNode(parent, name)
    node.setPosition(position)
    const label = node.getComponent(Label) ?? node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.ceil(fontSize * 1.15)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = color
    label.isBold = isBold
    const outline = node.getComponent(LabelOutline) ?? node.addComponent(LabelOutline)
    outline.color = new Color(117, 42, 20, isBold ? 165 : 0)
    outline.width = isBold && color.r > 220 ? 2 : 0
    // Label 组件初始化后可能写入默认尺寸，最后再恢复 Prefab 的布局宽高。
    node.getComponent(UITransform)?.setContentSize(width, height)
    return label
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

  private drawMask(width: number, height: number) {
    if (!this.maskNode) {
      return
    }

    const transform = this.maskNode.getComponent(UITransform) ?? this.maskNode.addComponent(UITransform)
    transform.setContentSize(width, height)
    const graphics = this.maskNode.getComponent(Graphics) ?? this.maskNode.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(19, 42, 62, 142)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
  }

  private bindTouchEvents() {
    this.bindSwallowNode(this.maskNode)
    this.bindSwallowNode(this.panelNode)
    this.bindPressable(this.closeButtonNode, this.onCloseTap)
    this.bindPressable(this.startButtonNode, this.onStartTap)
    this.purchaseButtonNodes.forEach((node, skill) => {
      let handler = this.purchaseTapHandlers.get(skill)
      if (!handler) {
        handler = (event) => this.onPurchaseTap(event, skill)
        this.purchaseTapHandlers.set(skill, handler)
      }
      this.bindPressable(node, handler)
    })
  }

  private unbindTouchEvents() {
    this.unbindSwallowNode(this.maskNode)
    this.unbindSwallowNode(this.panelNode)
    this.unbindPressable(this.closeButtonNode, this.onCloseTap)
    this.unbindPressable(this.startButtonNode, this.onStartTap)
    this.purchaseButtonNodes.forEach((node, skill) => {
      const handler = this.purchaseTapHandlers.get(skill)
      if (handler) {
        this.unbindPressable(node, handler)
      }
    })
  }

  private bindSwallowNode(node: Node | null) {
    if (!node?.isValid) {
      return
    }
    node.on(Node.EventType.TOUCH_START, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_MOVE, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_END, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this)
  }

  private unbindSwallowNode(node: Node | null) {
    if (!node?.isValid) {
      return
    }
    node.off(Node.EventType.TOUCH_START, this.consumeTouch, this)
    node.off(Node.EventType.TOUCH_MOVE, this.consumeTouch, this)
    node.off(Node.EventType.TOUCH_END, this.consumeTouch, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this)
  }

  private bindPressable(node: Node | null, handler: (event: EventTouch) => void) {
    if (!node?.isValid) {
      return
    }
    node.on(Node.EventType.TOUCH_START, this.onButtonPressStart, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.onButtonPressCancel, this)
    node.on(Node.EventType.TOUCH_END, handler, this)
  }

  private unbindPressable(node: Node | null, handler: (event: EventTouch) => void) {
    if (!node?.isValid) {
      return
    }
    node.off(Node.EventType.TOUCH_START, this.onButtonPressStart, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.onButtonPressCancel, this)
    node.off(Node.EventType.TOUCH_END, handler, this)
  }

  private onButtonPressStart(event: EventTouch) {
    event.propagationStopped = true
    const target = event.currentTarget as Node
    Tween.stopAllByTarget(target)
    tween(target).to(0.06, { scale: new Vec3(0.94, 0.94, 1) }).start()
  }

  private onButtonPressCancel(event: EventTouch) {
    event.propagationStopped = true
    this.restoreButtonScale(event.currentTarget as Node)
  }

  private onPurchaseTap(event: EventTouch, skill: SkillKind) {
    event.propagationStopped = true
    this.restoreButtonScale(event.currentTarget as Node)
    if (this.currentSkillCounts[skill] >= ECONOMY_CONFIG.maxSkillCount) {
      this.showMessage(`${this.getSkillName(skill)}最多持有 ${ECONOMY_CONFIG.maxSkillCount} 个`, true)
      return
    }

    this.purchaseHandler?.(skill)
  }

  private getSkillName(skill: SkillKind) {
    return skill === 'bomb' ? '炸弹' : skill === 'hammer' ? '锤子' : '交换'
  }

  private onStartTap(event: EventTouch) {
    event.propagationStopped = true
    this.restoreButtonScale(event.currentTarget as Node)
    this.startHandler?.()
  }

  private onCloseTap(event: EventTouch) {
    event.propagationStopped = true
    this.restoreButtonScale(event.currentTarget as Node)
    this.closeHandler?.()
  }

  private restoreButtonScale(node: Node) {
    Tween.stopAllByTarget(node)
    tween(node).to(0.08, { scale: Vec3.ONE }, { easing: 'quadOut' }).start()
  }

  private consumeTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  private getPanelScale(factor = 1) {
    const scale = this.panelLayoutScale * factor
    return new Vec3(scale, scale, 1)
  }

  private stopNodeTween(node: Node | null) {
    if (node?.isValid) {
      Tween.stopAllByTarget(node)
    }
  }
}
