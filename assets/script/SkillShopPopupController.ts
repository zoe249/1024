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
  onClose: () => void
  onButtonClick?: () => void
}

type SkillCardConfig = {
  skill: SkillKind
  name: string
  price: number
  x: number
  y: number
  seed: number
  icon: SpriteFrame | null
}

// 新版商城以 750 × 1334 首页设计稿为坐标系，再根据实际画布整体等比缩放。
const PANEL_WIDTH = 750
const PANEL_HEIGHT = 1334
const PANEL_EDGE_INSET = 0
const PANEL_VERTICAL_INSET = 0
const CARD_WIDTH = 246
const CARD_HEIGHT = 300
const POPUP_ANIM_DURATION = 0.18

const BROWN = new Color(78, 48, 28, 255)
const CARD_FILL = new Color(247, 190, 121, 255)
const CREAM = new Color(255, 246, 222, 255)
const CORAL = new Color(242, 111, 80, 255)
const TEXT = new Color(76, 48, 31, 255)
const MUTED_TEXT = new Color(127, 86, 55, 255)

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
  private messageLabel: Label | null = null
  private balanceLabel: Label | null = null
  private overlayOpacity: UIOpacity | null = null
  private purchaseHandler: ((skill: SkillKind) => void) | null = null
  private closeHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private purchaseButtonNodes = new Map<SkillKind, Node>()
  private purchaseButtonLabels = new Map<SkillKind, Label>()
  private purchaseCoinNodes = new Map<SkillKind, Node>()
  private skillOwnedLabels = new Map<SkillKind, Label>()
  private readonly skillPrices: Record<SkillKind, number> = {
    bomb: 500,
    hammer: 300,
    swap: 400
  }
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
    this.closeHandler = options.onClose
    this.buttonClickHandler = options.onButtonClick ?? null
    this.ensureStructure()
    this.bindTouchEvents()
    this.syncLayout()
  }

  /**
   * 只接收经济层快照并刷新展示，金币扣除和技能库存变更仍由 HomeSceneController 负责。
   */
  renderState(snapshot: EconomySnapshot) {
    if (this.balanceLabel) {
      this.balanceLabel.string = `金币 ${snapshot.coins}`
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

  showMessage(message: string, isError = false, isSuccess = false) {
    if (!this.messageLabel) {
      return
    }

    this.messageLabel.string = message
    this.messageLabel.color = isError
      ? new Color(202, 73, 63, 255)
      : isSuccess
        ? new Color(43, 151, 92, 255)
        : MUTED_TEXT
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
    this.purchaseButtonNodes.forEach((node) => this.stopNodeTween(node))
    if (this.overlayOpacity?.isValid) {
      Tween.stopAllByTarget(this.overlayOpacity)
    }
    this.purchaseButtonNodes.clear()
    this.purchaseButtonLabels.clear()
    this.purchaseCoinNodes.clear()
    this.skillOwnedLabels.clear()
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
    // 新版设计不使用整块弹窗底板，保留组件只为兼容旧 Prefab 的序列化字段。
    sprite.spriteFrame = null
    sprite.enabled = false
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    panel.getComponent(UITransform)?.setContentSize(PANEL_WIDTH, PANEL_HEIGHT)
    return panel
  }

  private ensureHeader() {
    if (!this.panelNode) {
      return
    }

    this.closeButtonNode = this.ensureSpriteNode(
      this.panelNode,
      'CloseButton',
      this.closeButtonSpriteFrame,
      new Vec3(278, 462, 0),
      66,
      66
    )
  }

  private ensureBalance() {
    if (!this.panelNode) {
      return
    }

    const balanceGroup = this.getOrCreateNode(this.panelNode, 'Balance')
    balanceGroup.setPosition(0, 358, 0)
    balanceGroup.getComponent(UITransform)?.setContentSize(238, 62)
    this.drawCrayonSurface(balanceGroup, 238, 62, 24, CREAM, 301, 3, true, 0.7)
    this.ensureSpriteNode(balanceGroup, 'Coin', this.coinSpriteFrame, new Vec3(-78, 0, 0), 38, 38)
    this.balanceLabel = this.ensureLabel(
      balanceGroup,
      'Amount',
      '金币 0',
      23,
      new Vec3(34, 0, 0),
      154,
      50,
      TEXT,
      true
    )
  }

  private ensureSkillRows() {
    if (!this.panelNode) {
      return
    }

    const cards: SkillCardConfig[] = [
      { skill: 'bomb', name: '炸弹', price: 500, x: -142, y: 127, seed: 401, icon: this.bombSpriteFrame },
      { skill: 'hammer', name: '木槌', price: 300, x: 142, y: 127, seed: 411, icon: this.hammerSpriteFrame },
      { skill: 'swap', name: '交换', price: 400, x: 0, y: -205, seed: 421, icon: this.swapSpriteFrame }
    ]

    cards.forEach((card) => {
      const cardNode = this.getOrCreateNode(this.panelNode!, `SkillCard_${card.skill}`)
      cardNode.setPosition(card.x, card.y, 0)
      cardNode.getComponent(UITransform)?.setContentSize(CARD_WIDTH, CARD_HEIGHT)
      this.drawCrayonSurface(cardNode, CARD_WIDTH, CARD_HEIGHT, 21, CARD_FILL, card.seed, 3, true, 1.35)

      this.ensureLabel(cardNode, 'Name', card.name, 28, new Vec3(0, 111, 0), 218, 47, TEXT, true)
      this.ensureSpriteNode(cardNode, 'Icon', card.icon, new Vec3(0, 21, 0), 126, 126)

      const ownedNode = this.getOrCreateNode(cardNode, 'Owned')
      ownedNode.setPosition(0, -67, 0)
      ownedNode.getComponent(UITransform)?.setContentSize(126, 37)
      this.drawCrayonSurface(ownedNode, 126, 37, 17, new Color(255, 240, 205, 255), card.seed + 1, 2, false, 0.8)
      const ownedLabel = this.ensureLabel(ownedNode, 'Label', '持有 0/9', 17, Vec3.ZERO, 118, 31, MUTED_TEXT, true)
      this.skillOwnedLabels.set(card.skill, ownedLabel)

      const priceButton = this.ensurePriceButton(cardNode, card.skill, card.price, card.seed + 2)
      this.purchaseButtonNodes.set(card.skill, priceButton)
    })
  }

  private refreshSkillRows(snapshot: EconomySnapshot) {
    const skills: SkillKind[] = ['bomb', 'hammer', 'swap']
    for (const skill of skills) {
      const count = Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, Math.floor(snapshot.skills[skill])))
      const ownedLabel = this.skillOwnedLabels.get(skill) ?? null
      if (ownedLabel) {
        ownedLabel.string = `持有 ${count}/${ECONOMY_CONFIG.maxSkillCount}`
      }

      const isMax = count >= ECONOMY_CONFIG.maxSkillCount
      const button = this.purchaseButtonNodes.get(skill) ?? null
      const buttonLabel = this.purchaseButtonLabels.get(skill) ?? null
      const coinNode = this.purchaseCoinNodes.get(skill) ?? null
      if (buttonLabel) {
        buttonLabel.string = isMax ? '已满' : `${this.skillPrices[skill]}`
        buttonLabel.node.setPosition(isMax ? 0 : 25, 0, 0)
      }
      if (coinNode) {
        coinNode.active = !isMax
      }
      if (button) {
        const opacity = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity)
        opacity.opacity = isMax ? 150 : 255
      }
    }
  }

  private ensurePriceButton(parent: Node, skill: SkillKind, price: number, seed: number) {
    const button = this.getOrCreateNode(parent, 'PriceButton')
    button.setPosition(0, -118, 0)
    button.getComponent(UITransform)?.setContentSize(172, 45)
    this.drawCrayonSurface(button, 172, 45, 20, CORAL, seed, 3, true, 1.35)

    const coinNode = this.ensureSpriteNode(button, 'Coin', this.coinSpriteFrame, new Vec3(-48, 0, 0), 27, 27)
    this.purchaseCoinNodes.set(skill, coinNode)
    const amountLabel = this.ensureLabel(button, 'Amount', `${price}`, 21, new Vec3(25, 0, 0), 88, 39, new Color(255, 253, 235, 255), true)
    this.purchaseButtonLabels.set(skill, amountLabel)
    return button
  }

  private ensureFooter() {
    if (!this.panelNode) {
      return
    }

    const messageNode = this.getOrCreateNode(this.panelNode, 'Message')
    messageNode.setPosition(0, -417, 0)
    messageNode.getComponent(UITransform)?.setContentSize(290, 56)
    this.drawCrayonSurface(messageNode, 290, 56, 22, new Color(255, 246, 222, 232), 431, 2, false, 0.7)
    this.messageLabel = this.ensureLabel(messageNode, 'Label', '点击价格即可购买', 19, Vec3.ZERO, 276, 48, MUTED_TEXT, true)
  }

  /**
   * 使用 Graphics 绘制可缩放的彩铅色块。
   *
   * 底色保持平涂，细碎短线只模拟彩铅在纸面反复铺色的笔触，避免使用顶部亮条或玻璃高光。
   */
  private drawCrayonSurface(
    node: Node,
    width: number,
    height: number,
    radius: number,
    fill: Color,
    seed: number,
    outlineWidth: number,
    shadow: boolean,
    textureDensity: number
  ) {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    const left = -width * 0.5
    const bottom = -height * 0.5
    graphics.clear()

    if (shadow) {
      graphics.fillColor = new Color(52, 35, 23, 72)
      graphics.roundRect(left + 2, bottom - 5, width, height, radius)
      graphics.fill()
    }

    graphics.fillColor = fill
    graphics.roundRect(left, bottom, width, height, radius)
    graphics.fill()

    const random = this.createSeededRandom(seed)
    // 每组线段一次性提交给 Graphics，控制微信小游戏上的顶点数量和提交次数。
    const strokeCount = Math.max(24, Math.round(width * height / 500 * textureDensity))
    graphics.lineWidth = 1
    const drawStrokeGroup = (count: number, color: Color, reverse = false) => {
      graphics.strokeColor = color
      for (let index = 0; index < count; index += 1) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const length = 7 + Math.floor(random() * 17)
          const x = left + 4 + (reverse ? length : 0) + random() * Math.max(1, width - length - 8)
          const y = bottom + 4 + random() * Math.max(1, height - 8)
          const slope = -4 + Math.floor(random() * 9)
          const endX = reverse ? x - length : x + length
          const endY = reverse ? y - slope : y + slope
          if (
            !this.isInsideRoundedRect(x, y, left, bottom, width, height, radius, 3) ||
            !this.isInsideRoundedRect(endX, endY, left, bottom, width, height, radius, 3)
          ) {
            continue
          }
          graphics.moveTo(x, y)
          graphics.lineTo(endX, endY)
          break
        }
      }
      graphics.stroke()
    }
    drawStrokeGroup(Math.ceil(strokeCount * 0.52), new Color(255, 240, 204, 38))
    drawStrokeGroup(Math.floor(strokeCount * 0.48), new Color(112, 68, 35, 31))

    const crossStrokeCount = Math.max(12, Math.floor(strokeCount / 7))
    drawStrokeGroup(crossStrokeCount, new Color(101, 62, 34, 24), true)

    // 深棕轮廓最后绘制，确保纹理线不会削弱卡片边界。
    graphics.lineWidth = outlineWidth
    graphics.strokeColor = BROWN
    graphics.roundRect(left, bottom, width, height, radius)
    graphics.stroke()
  }

  private createSeededRandom(seed: number) {
    let state = seed >>> 0
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 0x100000000
    }
  }

  private isInsideRoundedRect(
    x: number,
    y: number,
    left: number,
    bottom: number,
    width: number,
    height: number,
    radius: number,
    inset: number
  ) {
    const safeLeft = left + inset
    const safeBottom = bottom + inset
    const safeRight = left + width - inset
    const safeTop = bottom + height - inset
    const safeRadius = Math.max(0, radius - inset)
    if (x < safeLeft || x > safeRight || y < safeBottom || y > safeTop) {
      return false
    }
    if (
      (x >= safeLeft + safeRadius && x <= safeRight - safeRadius) ||
      (y >= safeBottom + safeRadius && y <= safeTop - safeRadius)
    ) {
      return true
    }

    const centerX = x < safeLeft + safeRadius ? safeLeft + safeRadius : safeRight - safeRadius
    const centerY = y < safeBottom + safeRadius ? safeBottom + safeRadius : safeTop - safeRadius
    const deltaX = x - centerX
    const deltaY = y - centerY
    return deltaX * deltaX + deltaY * deltaY <= safeRadius * safeRadius
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
    label.overflow = Label.Overflow.SHRINK
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
    graphics.fillColor = new Color(5, 35, 44, 176)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
  }

  private bindTouchEvents() {
    this.bindSwallowNode(this.maskNode)
    this.bindSwallowNode(this.panelNode)
    this.bindPressable(this.closeButtonNode, this.onCloseTap)
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
    this.playButtonClickFeedback()
    this.restoreButtonScale(event.currentTarget as Node)
    if (this.currentSkillCounts[skill] >= ECONOMY_CONFIG.maxSkillCount) {
      this.showMessage(`${this.getSkillName(skill)}最多持有 ${ECONOMY_CONFIG.maxSkillCount} 个`, true)
      return
    }

    this.purchaseHandler?.(skill)
  }

  private getSkillName(skill: SkillKind) {
    return skill === 'bomb' ? '炸弹' : skill === 'hammer' ? '木槌' : '交换'
  }

  private onCloseTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.restoreButtonScale(event.currentTarget as Node)
    this.closeHandler?.()
  }

  private playButtonClickFeedback() {
    this.buttonClickHandler?.()
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
