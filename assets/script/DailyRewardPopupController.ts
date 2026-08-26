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
import type { DailyRewardState } from './PlayerEconomyStore'

const { ccclass, property } = _decorator

type DailyRewardPopupOptions = {
  hostNode: Node
  onClaim: () => void
  onClose: () => void
  onButtonClick?: () => void
}

type DayCardConfig = {
  day: number
  x: number
  y: number
  width: number
  height: number
  wide?: boolean
}

const PANEL_WIDTH = 750
const PANEL_HEIGHT = 1334
const POPUP_ANIM_DURATION = 0.18

const BROWN = new Color(73, 43, 27, 255)
const CREAM = new Color(255, 244, 213, 255)
const CARD_FILL = new Color(255, 239, 207, 255)
const CLAIMED_CARD_FILL = new Color(229, 216, 188, 255)
const CORAL = new Color(243, 105, 76, 255)
const GREEN = new Color(111, 166, 55, 255)
const TEXT = new Color(73, 43, 27, 255)
const MUTED_TEXT = new Color(125, 94, 67, 255)

const DAY_CARDS: DayCardConfig[] = [
  { day: 1, x: -255, y: 334, width: 150, height: 220 },
  { day: 2, x: -85, y: 334, width: 150, height: 220 },
  { day: 3, x: 83, y: 334, width: 152, height: 220 },
  { day: 4, x: 254, y: 334, width: 150, height: 220 },
  { day: 5, x: -85, y: 84, width: 150, height: 214 },
  { day: 6, x: 84, y: 84, width: 152, height: 214 },
  { day: 7, x: 5, y: -145, width: 530, height: 178, wide: true }
]

/**
 * 首页七日金币奖励弹窗。
 *
 * Prefab 只承载可复用素材和组件；领取规则由 PlayerEconomyStore 负责，
 * 本组件只接收 DailyRewardState、绘制状态并通过回调发出操作。
 */
@ccclass('DailyRewardPopupController')
export class DailyRewardPopupController extends Component {
  @property({ type: SpriteFrame, tooltip: '金币图片' })
  coinSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '右上角关闭按钮图片' })
  closeButtonSpriteFrame: SpriteFrame | null = null

  private hostNode: Node | null = null
  private maskNode: Node | null = null
  private panelNode: Node | null = null
  private closeButtonNode: Node | null = null
  private claimButtonNode: Node | null = null
  private claimButtonLabel: Label | null = null
  private todayStatusLabel: Label | null = null
  private todayAmountLabel: Label | null = null
  private messageLabel: Label | null = null
  private overlayOpacity: UIOpacity | null = null
  private claimHandler: (() => void) | null = null
  private closeHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private claimEnabled = false
  private panelLayoutScale = 1
  private readonly cardNodes = new Map<number, Node>()
  private readonly titleLabels = new Map<number, Label>()
  private readonly amountLabels = new Map<number, Label>()
  private readonly coinNodes = new Map<number, Node>()
  private readonly checkNodes = new Map<number, Node>()
  private readonly todayBadgeNodes = new Map<number, Node>()

  setup(options: DailyRewardPopupOptions) {
    this.unbindTouchEvents()
    this.hostNode = options.hostNode
    this.claimHandler = options.onClaim
    this.closeHandler = options.onClose
    this.buttonClickHandler = options.onButtonClick ?? null
    this.ensureStructure()
    this.bindTouchEvents()
    this.syncLayout()
  }

  /** 只根据经济层快照刷新领取状态，不在 UI 内直接修改金币。 */
  renderState(state: DailyRewardState) {
    const currentDay = Math.min(7, Math.max(1, Math.floor(state.currentDay)))
    DAY_CARDS.forEach((config) => {
      const isToday = config.day === currentDay
      const isClaimed = config.day < currentDay || (isToday && !state.canClaim)
      this.renderDayCard(config, state.rewards[config.day - 1] ?? 0, isToday, isClaimed)
    })

    this.claimEnabled = state.canClaim
    if (this.todayStatusLabel) {
      this.todayStatusLabel.string = state.canClaim ? '今日可领取' : '今日已领取'
    }
    if (this.todayAmountLabel) {
      this.todayAmountLabel.string = `${state.todayAmount} 金币`
    }
    this.refreshClaimButton()
    if (this.messageLabel) {
      this.messageLabel.string = ''
    }
  }

  showMessage(message: string, isSuccess = false) {
    if (!this.messageLabel) {
      return
    }
    this.messageLabel.string = message
    this.messageLabel.color = isSuccess ? new Color(210, 242, 163, 255) : CREAM
  }

  show() {
    if (!this.panelNode || !this.overlayOpacity) {
      return
    }

    this.node.active = true
    this.node.setSiblingIndex(this.node.parent?.children.length ? this.node.parent.children.length - 1 : 0)
    this.overlayOpacity.opacity = 0
    this.panelNode.setScale(this.getPanelScale(0.94))
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

  // 遮罩铺满宿主，内部设计坐标整体等比缩放，避免窄屏把第 1、4 天裁掉。
  syncLayout() {
    const hostTransform = this.hostNode?.getComponent(UITransform)
    const rootTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const width = hostTransform?.width ?? rootTransform.width ?? PANEL_WIDTH
    const height = hostTransform?.height ?? rootTransform.height ?? PANEL_HEIGHT
    rootTransform.setContentSize(width, height)
    this.drawMask(width, height)

    this.panelLayoutScale = Math.min(1, Math.max(0.56, width / PANEL_WIDTH), Math.max(0.56, height / PANEL_HEIGHT))
    this.panelNode?.setPosition(0, 0, 0)
    this.panelNode?.setScale(this.getPanelScale())
  }

  onDestroy() {
    this.unbindTouchEvents()
    this.stopNodeTween(this.panelNode)
    this.stopNodeTween(this.closeButtonNode)
    this.stopNodeTween(this.claimButtonNode)
    if (this.overlayOpacity?.isValid) {
      Tween.stopAllByTarget(this.overlayOpacity)
    }
    this.cardNodes.clear()
    this.titleLabels.clear()
    this.amountLabels.clear()
    this.coinNodes.clear()
    this.checkNodes.clear()
    this.todayBadgeNodes.clear()
  }

  private ensureStructure() {
    if (this.panelNode) {
      return
    }

    this.overlayOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.maskNode = this.ensureMask()
    this.panelNode = this.getOrCreateNode(this.node, 'Panel')
    this.panelNode.getComponent(UITransform)?.setContentSize(PANEL_WIDTH, PANEL_HEIGHT)
    this.ensureHeader()
    this.ensureDayCards()
    this.ensureTodayReward()
    this.ensureFooter()
    this.node.active = false
  }

  private ensureMask() {
    const mask = this.getOrCreateNode(this.node, 'Mask')
    mask.setSiblingIndex(0)
    mask.getComponent(Graphics) ?? mask.addComponent(Graphics)
    return mask
  }

  private ensureHeader() {
    if (!this.panelNode) {
      return
    }

    this.ensureLabel(this.panelNode, 'Title', '每日奖励', 52, new Vec3(0, 594, 0), 540, 77, CREAM, true, 3)
    this.ensureLabel(
      this.panelNode,
      'Subtitle',
      '连续登录越久，金币奖励越多！',
      23,
      new Vec3(0, 524, 0),
      580,
      48,
      CREAM,
      true,
      2
    )
    this.closeButtonNode = this.ensureSpriteNode(
      this.panelNode,
      'CloseButton',
      this.closeButtonSpriteFrame,
      new Vec3(315, 594, 0),
      60,
      60
    )
  }

  private ensureDayCards() {
    if (!this.panelNode) {
      return
    }

    DAY_CARDS.forEach((config) => {
      const card = this.getOrCreateNode(this.panelNode!, `DayCard_${config.day}`)
      card.setPosition(config.x, config.y, 0)
      card.getComponent(UITransform)?.setContentSize(config.width, config.height)
      this.cardNodes.set(config.day, card)

      if (config.wide) {
        this.ensureWideCardContents(card, config)
      } else {
        this.ensureSmallCardContents(card, config)
      }
    })
  }

  private ensureSmallCardContents(card: Node, config: DayCardConfig) {
    const title = this.ensureLabel(
      card,
      'DayTitle',
      `第${config.day}天`,
      19,
      new Vec3(0, 82, 0),
      130,
      37,
      TEXT,
      true
    )
    this.titleLabels.set(config.day, title)
    this.coinNodes.set(
      config.day,
      this.ensureSpriteNode(card, 'Coin', this.coinSpriteFrame, new Vec3(0, 4, 0), 72, 76)
    )
    const amount = this.ensureLabel(card, 'Amount', '0', 25, new Vec3(0, -84, 0), 120, 40, TEXT, true)
    this.amountLabels.set(config.day, amount)

    const check = this.getOrCreateNode(card, 'ClaimedCheck')
    check.setPosition(config.width * 0.5 - 25, -33, 0)
    check.getComponent(UITransform)?.setContentSize(32, 32)
    this.drawCheck(check)
    check.active = false
    this.checkNodes.set(config.day, check)

    const badge = this.getOrCreateNode(card, 'TodayBadge')
    badge.setPosition(0, config.height * 0.5 + 1, 0)
    badge.getComponent(UITransform)?.setContentSize(70, 30)
    this.drawCrayonSurface(badge, 70, 30, 10, CORAL, 900 + config.day, 2, false, 0.7, BROWN)
    this.ensureLabel(badge, 'Label', '今日', 16, Vec3.ZERO, 64, 26, CREAM, true, 1)
    badge.active = false
    this.todayBadgeNodes.set(config.day, badge)
  }

  private ensureWideCardContents(card: Node, config: DayCardConfig) {
    const title = this.ensureLabel(card, 'DayTitle', '第7天', 27, new Vec3(-190, 51, 0), 150, 45, TEXT, true)
    this.titleLabels.set(config.day, title)
    this.ensureLabel(card, 'Description', '连续大奖', 19, new Vec3(-190, 8, 0), 150, 38, MUTED_TEXT, true)
    this.coinNodes.set(
      config.day,
      this.ensureSpriteNode(card, 'Coin', this.coinSpriteFrame, new Vec3(0, 14, 0), 88, 93)
    )
    const amount = this.ensureLabel(card, 'Amount', '×12000', 34, new Vec3(165, 14, 0), 190, 70, CORAL, true, 2)
    this.amountLabels.set(config.day, amount)
    this.ensureLabel(card, 'Hint', '累计登录7天即可领取', 18, new Vec3(0, -67, 0), 490, 34, MUTED_TEXT, false)

    const check = this.getOrCreateNode(card, 'ClaimedCheck')
    check.setPosition(229, 48, 0)
    check.getComponent(UITransform)?.setContentSize(32, 32)
    this.drawCheck(check)
    check.active = false
    this.checkNodes.set(config.day, check)

    const badge = this.getOrCreateNode(card, 'TodayBadge')
    badge.setPosition(0, config.height * 0.5 + 1, 0)
    badge.getComponent(UITransform)?.setContentSize(70, 30)
    this.drawCrayonSurface(badge, 70, 30, 10, CORAL, 907, 2, false, 0.7, BROWN)
    this.ensureLabel(badge, 'Label', '今日', 16, Vec3.ZERO, 64, 26, CREAM, true, 1)
    badge.active = false
    this.todayBadgeNodes.set(config.day, badge)
  }

  private ensureTodayReward() {
    if (!this.panelNode) {
      return
    }

    const group = this.getOrCreateNode(this.panelNode, 'TodayReward')
    group.setPosition(0, -337, 0)
    group.getComponent(UITransform)?.setContentSize(430, 64)
    this.todayStatusLabel = this.ensureLabel(
      group,
      'Status',
      '今日可领取',
      24,
      new Vec3(-110, 0, 0),
      190,
      58,
      CREAM,
      true,
      2
    )
    this.ensureSpriteNode(group, 'Coin', this.coinSpriteFrame, Vec3.ZERO, 42, 45)
    this.todayAmountLabel = this.ensureLabel(
      group,
      'Amount',
      '1000 金币',
      27,
      new Vec3(108, 0, 0),
      180,
      58,
      CREAM,
      true,
      2
    )
  }

  private ensureFooter() {
    if (!this.panelNode) {
      return
    }

    this.messageLabel = this.ensureLabel(
      this.panelNode,
      'Message',
      '',
      20,
      new Vec3(0, -430, 0),
      520,
      44,
      CREAM,
      true,
      1
    )

    this.claimButtonNode = this.getOrCreateNode(this.panelNode, 'ClaimButton')
    this.claimButtonNode.setPosition(-12, -539, 0)
    this.claimButtonNode.getComponent(UITransform)?.setContentSize(282, 88)
    this.claimButtonLabel = this.ensureLabel(
      this.claimButtonNode,
      'Label',
      '立即领取',
      36,
      Vec3.ZERO,
      260,
      78,
      CREAM,
      true,
      2
    )
    this.refreshClaimButton()
  }

  private renderDayCard(config: DayCardConfig, amount: number, isToday: boolean, isClaimed: boolean) {
    const card = this.cardNodes.get(config.day)
    if (!card) {
      return
    }

    const fill = isClaimed && !isToday ? CLAIMED_CARD_FILL : CARD_FILL
    this.drawCrayonSurface(
      card,
      config.width,
      config.height,
      config.wide ? 24 : 18,
      fill,
      500 + config.day,
      isToday ? 4 : 3,
      true,
      0.8,
      isToday ? CORAL : BROWN
    )

    const title = this.titleLabels.get(config.day)
    const amountLabel = this.amountLabels.get(config.day)
    if (title) {
      title.color = isClaimed && !isToday ? MUTED_TEXT : TEXT
    }
    if (amountLabel) {
      amountLabel.string = config.wide ? `×${amount}` : `${amount}`
      amountLabel.color = config.wide ? CORAL : isClaimed && !isToday ? MUTED_TEXT : TEXT
    }

    const coinNode = this.coinNodes.get(config.day)
    if (coinNode) {
      const opacity = coinNode.getComponent(UIOpacity) ?? coinNode.addComponent(UIOpacity)
      opacity.opacity = isClaimed && !isToday ? 165 : 255
    }
    const check = this.checkNodes.get(config.day)
    if (check) {
      check.active = isClaimed
    }
    const todayBadge = this.todayBadgeNodes.get(config.day)
    if (todayBadge) {
      todayBadge.active = isToday
      todayBadge.setSiblingIndex(card.children.length - 1)
    }
  }

  private refreshClaimButton() {
    if (!this.claimButtonNode) {
      return
    }

    this.drawCrayonSurface(this.claimButtonNode, 282, 88, 34, CORAL, 801, 3, true, 1.15, BROWN)
    const opacity = this.claimButtonNode.getComponent(UIOpacity) ?? this.claimButtonNode.addComponent(UIOpacity)
    opacity.opacity = this.claimEnabled ? 255 : 155
    if (this.claimButtonLabel) {
      this.claimButtonLabel.string = this.claimEnabled ? '立即领取' : '今日已领取'
    }
  }

  /** 平涂底色叠加少量短线，保持与首页和商城一致的彩铅纸面质感。 */
  private drawCrayonSurface(
    node: Node,
    width: number,
    height: number,
    radius: number,
    fill: Color,
    seed: number,
    outlineWidth: number,
    shadow: boolean,
    textureDensity: number,
    outline: Color
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
    const strokeCount = Math.max(18, Math.round(width * height / 620 * textureDensity))
    graphics.lineWidth = 1
    const drawStrokeGroup = (count: number, color: Color, reverse = false) => {
      graphics.strokeColor = color
      for (let index = 0; index < count; index += 1) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const length = 7 + Math.floor(random() * 15)
          const x = left + 5 + (reverse ? length : 0) + random() * Math.max(1, width - length - 10)
          const y = bottom + 5 + random() * Math.max(1, height - 10)
          const endX = reverse ? x - length : x + length
          const endY = y + (-3 + Math.floor(random() * 7))
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
    drawStrokeGroup(Math.ceil(strokeCount * 0.55), new Color(255, 247, 221, 34))
    drawStrokeGroup(Math.floor(strokeCount * 0.45), new Color(105, 63, 34, 25))
    drawStrokeGroup(Math.max(8, Math.floor(strokeCount / 8)), new Color(101, 62, 34, 20), true)

    graphics.lineWidth = outlineWidth
    graphics.strokeColor = outline
    graphics.roundRect(left, bottom, width, height, radius)
    graphics.stroke()
  }

  private drawCheck(node: Node) {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = BROWN
    graphics.circle(0, 0, 16)
    graphics.fill()
    graphics.fillColor = GREEN
    graphics.circle(0, 0, 13)
    graphics.fill()
    graphics.lineWidth = 4
    graphics.strokeColor = CREAM
    graphics.moveTo(-7, 0)
    graphics.lineTo(-1, -7)
    graphics.lineTo(9, 7)
    graphics.stroke()
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
    isBold: boolean,
    outlineWidth = 0
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
    outline.color = BROWN
    outline.width = outlineWidth
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
    this.bindPressable(this.claimButtonNode, this.onClaimTap)
  }

  private unbindTouchEvents() {
    this.unbindSwallowNode(this.maskNode)
    this.unbindSwallowNode(this.panelNode)
    this.unbindPressable(this.closeButtonNode, this.onCloseTap)
    this.unbindPressable(this.claimButtonNode, this.onClaimTap)
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

  private onClaimTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.restoreButtonScale(event.currentTarget as Node)
    if (!this.claimEnabled) {
      this.showMessage('今日奖励已经领取')
      return
    }

    // 先锁按钮再通知逻辑层，避免连续触摸在下一帧重复触发。
    this.claimEnabled = false
    this.refreshClaimButton()
    this.claimHandler?.()
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
