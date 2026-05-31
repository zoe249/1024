import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  tween,
  Tween,
  UITransform,
  UIOpacity,
  Vec3
} from 'cc'

const { ccclass } = _decorator

type StartPageOptions = {
  onStartTap: () => void
}

type RankEntry = {
  rank: number
  name: string
  score: number
  color: Color
}

// 首页整体改用低亮护眼色，降低手机屏幕上的白场刺激。
const PAGE_BG_COLOR = new Color(235, 247, 244, 255)
const PAGE_DOT_COLOR = new Color(164, 216, 219, 54)
const MINT_COLOR = new Color(72, 202, 157, 255)
const BLUE_COLOR = new Color(70, 161, 218, 255)
const TEAL_COLOR = new Color(46, 108, 121, 255)
const LIGHT_TEXT = new Color(255, 255, 255, 255)
const SUBTEXT_COLOR = new Color(105, 153, 164, 255)
const YELLOW_COLOR = new Color(246, 231, 153, 205)
const GREEN_CIRCLE = new Color(176, 223, 150, 158)

const RANKING_DATA: RankEntry[] = [
  { rank: 1, name: 'Mao', score: 42880, color: new Color(255, 209, 105, 255) },
  { rank: 2, name: 'Lily', score: 29640, color: new Color(208, 240, 255, 255) },
  { rank: 3, name: 'Kai', score: 24120, color: new Color(255, 225, 208, 255) },
  { rank: 4, name: 'Mint', score: 18640, color: new Color(198, 242, 218, 255) },
  { rank: 5, name: 'Berry', score: 15200, color: new Color(255, 215, 223, 255) },
  { rank: 6, name: 'Ocean', score: 13440, color: new Color(212, 226, 255, 255) }
]

const TIP_TEXTS = [
  '相同数字相遇会合成更大的数字',
  '按住目标列，棋子会快速下落',
  '先观察底部数字，再选择落点',
  '连续合成可以快速拉高分数',
  '棋盘填满前，尽量留出一列空间'
]

@ccclass('StartPageController')
export class StartPageController extends Component {
  private startHandler: (() => void) | null = null
  private rootNode: Node | null = null
  private pageCardNode: Node | null = null
  private rankMaskNode: Node | null = null
  private rankPanelNode: Node | null = null
  private toastNode: Node | null = null
  private toastOpacity: UIOpacity | null = null
  private startButtonNode: Node | null = null
  private rankButtonNode: Node | null = null
  private tipLabel: Label | null = null
  private tipOpacity: UIOpacity | null = null
  private currentTipIndex = -1
  private pageDecorNodes: Node[] = []

  setup(options: StartPageOptions) {
    this.startHandler = options.onStartTap
    this.ensurePage()
    this.syncLayout()
    this.show()
  }

  syncLayout() {
    if (!this.rootNode) {
      return
    }

    const parentTransform = this.node.getComponent(UITransform)
    const rootTransform = this.rootNode.getComponent(UITransform)
    const cardTransform = this.pageCardNode?.getComponent(UITransform) ?? null
    if (!parentTransform || !rootTransform || !cardTransform || !this.pageCardNode) {
      return
    }

    rootTransform.setContentSize(parentTransform.width, parentTransform.height)
    this.pageCardNode.setPosition(0, 0, 0)

    const cardWidth = parentTransform.width
    const cardHeight = parentTransform.height
    cardTransform.setContentSize(cardWidth, cardHeight)
    this.redrawBackground()
    this.redrawCard()
    this.layoutPageContents(cardWidth, cardHeight)
    this.layoutRankModal(parentTransform.width, parentTransform.height)
  }

  show() {
    if (!this.rootNode) {
      return
    }

    const opacity = this.rootNode.getComponent(UIOpacity) ?? this.rootNode.addComponent(UIOpacity)
    this.rootNode.active = true
    this.rootNode.setSiblingIndex(this.node.children.length - 1)
    // 返回首页时要恢复上次隐藏动画压缩过的卡片比例，避免首页越显示越小。
    this.pageCardNode?.setScale(Vec3.ONE)
    opacity.opacity = 255
  }

  hide(onHidden?: () => void) {
    if (!this.rootNode) {
      onHidden?.()
      return
    }

    const opacity = this.rootNode.getComponent(UIOpacity) ?? this.rootNode.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)
    Tween.stopAllByTarget(this.pageCardNode)
    tween(opacity)
      .to(0.16, { opacity: 0 })
      .call(() => {
        if (this.rootNode) {
          this.rootNode.active = false
        }
        onHidden?.()
      })
      .start()
    if (this.pageCardNode) {
      tween(this.pageCardNode).to(0.16, { scale: new Vec3(0.97, 0.97, 1) }).start()
    }
  }

  onDestroy() {
    this.startButtonNode?.off(Node.EventType.TOUCH_END, this.handleStartTap, this)
    this.rankButtonNode?.off(Node.EventType.TOUCH_END, this.handleRankTap, this)
    this.rankMaskNode?.off(Node.EventType.TOUCH_END, this.hideRankModal, this)
    this.toastNode?.off(Node.EventType.TOUCH_END, this.consumeTouch, this)
    if (this.tipOpacity) {
      Tween.stopAllByTarget(this.tipOpacity)
    }
  }

  private ensurePage() {
    if (this.rootNode) {
      return
    }

    const root = new Node('StartPageOverlay')
    root.setParent(this.node)
    root.addComponent(UITransform)
    root.addComponent(UIOpacity)
    this.bindSwallowTouch(root)
    this.rootNode = root

    const background = new Node('Background')
    background.setParent(root)
    background.addComponent(UITransform)
    background.addComponent(Graphics)

    const card = new Node('PageCard')
    card.setParent(root)
    card.addComponent(UITransform)
    card.addComponent(Graphics)
    this.bindSwallowTouch(card)
    this.pageCardNode = card

    const decorTopLeft = this.createCircleDecoration(card, 'DecorLeft', 78, GREEN_CIRCLE, 0.88)
    const decorTopRight = this.createCircleDecoration(card, 'DecorRight', 92, YELLOW_COLOR, 0.92)
    this.pageDecorNodes.push(decorTopLeft, decorTopRight)

    this.buildTitleCard(card)
    this.buildFloatingTiles(card)
    this.startButtonNode = this.createPrimaryButton(card, 'StartButton', '开始游戏', MINT_COLOR, 90)
    this.rankButtonNode = this.createPrimaryButton(card, 'RankButton', '排行榜', BLUE_COLOR, 10)
    this.startButtonNode.on(Node.EventType.TOUCH_END, this.handleStartTap, this)
    this.rankButtonNode.on(Node.EventType.TOUCH_END, this.handleRankTap, this)
    this.buildTipText(card)
    this.buildRankModal(root)
    this.buildToast(root)
    this.startTipRotation()
  }

  private redrawBackground() {
    const background = this.rootNode?.getChildByName('Background')
    const backgroundTransform = background?.getComponent(UITransform) ?? null
    const graphics = background?.getComponent(Graphics) ?? null
    const rootTransform = this.rootNode?.getComponent(UITransform) ?? null
    if (!background || !backgroundTransform || !graphics || !rootTransform) {
      return
    }

    backgroundTransform.setContentSize(rootTransform.width, rootTransform.height)
    graphics.clear()
    graphics.fillColor = PAGE_BG_COLOR
    graphics.rect(-rootTransform.width / 2, -rootTransform.height / 2, rootTransform.width, rootTransform.height)
    graphics.fill()

    graphics.fillColor = PAGE_DOT_COLOR
    const spacing = 42
    for (let x = -rootTransform.width / 2 + 20; x < rootTransform.width / 2; x += spacing) {
      for (let y = -rootTransform.height / 2 + 20; y < rootTransform.height / 2; y += spacing) {
        graphics.circle(x, y, 1.45)
      }
    }
    graphics.fill()
  }

  private redrawCard() {
    const graphics = this.pageCardNode?.getComponent(Graphics) ?? null
    if (!graphics) {
      return
    }

    graphics.clear()
  }

  private layoutPageContents(cardWidth: number, cardHeight: number) {
    if (!this.pageCardNode) {
      return
    }

    this.pageCardNode.getChildByName('TitleCard')?.setPosition(0, cardHeight * 0.31, 0)
    this.pageCardNode.getChildByName('TileRow')?.setPosition(0, cardHeight * 0.12, 0)
    this.pageDecorNodes[0]?.setPosition(-cardWidth * 0.33, cardHeight * 0.34, 0)
    this.pageDecorNodes[1]?.setPosition(cardWidth * 0.28, cardHeight * 0.39, 0)
    this.startButtonNode?.setPosition(0, -cardHeight * 0.06, 0)
    this.rankButtonNode?.setPosition(0, -cardHeight * 0.19, 0)
    this.pageCardNode.getChildByName('TipText')?.setPosition(0, -cardHeight * 0.37, 0)
  }

  private buildTitleCard(parent: Node) {
    const card = new Node('TitleCard')
    card.setParent(parent)
    card.addComponent(UITransform).setContentSize(420, 166)
    const graphics = card.addComponent(Graphics)
    graphics.fillColor = new Color(70, 178, 160, 22)
    graphics.roundRect(-194, -88, 388, 150, 34)
    graphics.fill()
    graphics.fillColor = new Color(245, 251, 247, 232)
    graphics.roundRect(-210, -78, 420, 156, 36)
    graphics.fill()
    graphics.fillColor = new Color(190, 226, 228, 82)
    graphics.roundRect(-120, 48, 240, 10, 5)
    graphics.fill()

    this.createTitleAccent(card, 'TitleLeaf', -164, 30, 36, new Color(176, 223, 150, 120))
    this.createTitleAccent(card, 'TitleSun', 168, 36, 44, new Color(246, 231, 153, 118))
    this.createTitleAccent(card, 'TitleDotLeft', -136, -42, 9, new Color(MINT_COLOR.r, MINT_COLOR.g, MINT_COLOR.b, 178))
    this.createTitleAccent(card, 'TitleDotRight', 134, -42, 9, new Color(BLUE_COLOR.r, BLUE_COLOR.g, BLUE_COLOR.b, 168))

    // 主标题改成完整字标，避免拆成棋子后显得过碎。
    const titleShadow = this.createLabel(card, 'TitleShadow', '1024', 78, new Color(47, 117, 128, 54), new Vec3(0, 10, 0))
    titleShadow.isBold = true
    titleShadow.lineHeight = 86
    titleShadow.node.getComponent(UITransform)?.setContentSize(360, 92)

    const title = this.createLabel(card, 'Title', '1024', 78, TEAL_COLOR, new Vec3(0, 18, 0))
    title.isBold = true
    title.lineHeight = 86
    title.node.getComponent(UITransform)?.setContentSize(360, 92)

    const subtitle = this.createCapsule(card, 'SubtitleBadge', '数字花园', 0, -50, 176, 38, new Color(224, 244, 237, 238), SUBTEXT_COLOR)
    subtitle.fontSize = 22
    subtitle.lineHeight = 28
    subtitle.isBold = true
  }

  private createTitleAccent(parent: Node, name: string, x: number, y: number, radius: number, color: Color) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(radius * 2, radius * 2)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = color
    graphics.circle(0, 0, radius)
    graphics.fill()
  }

  private buildFloatingTiles(parent: Node) {
    const row = new Node('TileRow')
    row.setParent(parent)
    row.addComponent(UITransform).setContentSize(560, 170)

    // 首页数字棋子降低饱和度，保留活泼感但减少高亮色块带来的刺眼感。
    const config = [
      { size: 74, label: '2', color: new Color(234, 124, 194, 255) },
      { size: 76, label: '4', color: new Color(105, 82, 210, 255) },
      { size: 78, label: '8', color: new Color(146, 92, 188, 255) },
      { size: 84, label: '16', color: new Color(24, 194, 190, 255) },
      { size: 84, label: '32', color: new Color(88, 178, 220, 255) },
      { size: 84, label: '64', color: new Color(122, 203, 101, 255) },
      { size: 86, label: '128', color: new Color(222, 104, 108, 255) },
      { size: 92, label: '1024', color: new Color(234, 162, 84, 255) }
    ]
    const step = 138
    const trackWidth = step * config.length
    const startX = -280

    const trackA = this.createTileTrack(row, 'TileTrackA', config, startX, step)
    const trackB = this.createTileTrack(row, 'TileTrackB', config, startX + trackWidth, step)
    const duration = 11.4

    tween(trackA)
      .repeatForever(
        tween()
          .sequence(
            tween().to(duration, { position: new Vec3(startX - trackWidth, 0, 0) }, { easing: 'linear' }),
            tween().set({ position: new Vec3(startX, 0, 0) })
          )
      )
      .start()
    tween(trackB)
      .repeatForever(
        tween()
          .sequence(
            tween().to(duration, { position: new Vec3(startX, 0, 0) }, { easing: 'linear' }),
            tween().set({ position: new Vec3(startX + trackWidth, 0, 0) })
          )
      )
      .start()
  }

  private createTileTrack(
    parent: Node,
    name: string,
    config: Array<{ size: number; label: string; color: Color }>,
    x: number,
    step: number
  ) {
    const track = new Node(name)
    track.setParent(parent)
    track.setPosition(x, 0, 0)
    track.addComponent(UITransform).setContentSize(step * config.length, 170)

    for (const [index, item] of config.entries()) {
      const tile = new Node(`Tile${item.label}`)
      tile.setParent(track)
      const baseX = index * step
      const baseY = index % 2 === 0 ? 0 : 18
      tile.setPosition(baseX, baseY, 0)
      tile.addComponent(UITransform).setContentSize(item.size, item.size)
      const graphics = tile.addComponent(Graphics)
      graphics.fillColor = item.color
      graphics.roundRect(-item.size / 2, -item.size / 2, item.size, item.size, 18)
      graphics.fill()

      const label = this.createLabel(tile, 'Value', item.label, item.label.length >= 4 ? 34 : 38, LIGHT_TEXT, Vec3.ZERO)
      label.isBold = true
      tween(tile)
        .delay(index * 0.22)
        .repeatForever(
          tween()
            .sequence(
              tween().to(0.24, { position: new Vec3(baseX - 8, baseY + 24, 0) }, { easing: 'quadOut' }),
              tween().to(0.3, { position: new Vec3(baseX - 18, baseY, 0) }, { easing: 'bounceOut' }),
              tween().delay(1.06),
              tween().set({ position: new Vec3(baseX, baseY, 0) })
            )
        )
        .start()
    }

    return track
  }

  private createPrimaryButton(parent: Node, name: string, text: string, fillColor: Color, y: number) {
    const buttonNode = new Node(name)
    buttonNode.setParent(parent)
    buttonNode.setPosition(0, y, 0)
    const isStartButton = name === 'StartButton'
    const isRankButton = name === 'RankButton'
    const width = isStartButton ? 430 : isRankButton ? 292 : 320
    const height = isStartButton ? 86 : isRankButton ? 62 : 68
    const radius = height / 2
    // 首页按钮分清主次：开始游戏保留光效，排行榜降级为轻描边按钮。
    buttonNode.addComponent(UITransform).setContentSize(width, height)
    buttonNode.addComponent(UIOpacity)

    if (isStartButton) {
      this.createButtonGlow(buttonNode, width, height, radius, fillColor)
    }

    const body = new Node('Body')
    body.setParent(buttonNode)
    body.addComponent(UITransform).setContentSize(width, height)
    const bodyGraphics = body.addComponent(Graphics)
    bodyGraphics.fillColor = isRankButton ? new Color(243, 249, 247, 190) : fillColor
    bodyGraphics.roundRect(-width / 2, -height / 2, width, height, radius)
    bodyGraphics.fill()
    bodyGraphics.lineWidth = isRankButton ? 2 : 3
    bodyGraphics.strokeColor = isRankButton ? new Color(fillColor.r, fillColor.g, fillColor.b, 108) : new Color(255, 255, 255, 62)
    bodyGraphics.roundRect(-width / 2 + 1.5, -height / 2 + 1.5, width - 3, height - 3, radius - 1.5)
    bodyGraphics.stroke()

    if (isStartButton) {
      this.createButtonSpark(buttonNode, 'SparkLeft', -width / 2 + 52, height / 2 - 16, 8)
      this.createButtonSpark(buttonNode, 'SparkRight', width / 2 - 58, -height / 2 + 18, 6)
    }

    const labelColor = isRankButton ? new Color(fillColor.r, fillColor.g, fillColor.b, 255) : LIGHT_TEXT
    const label = this.createLabel(buttonNode, 'Label', text, isStartButton ? 39 : isRankButton ? 28 : 31, labelColor, Vec3.ZERO)
    label.isBold = true
    label.node.getComponent(UITransform)?.setContentSize(width, height)
    if (isStartButton) {
      tween(buttonNode)
        .repeatForever(
          tween()
            .sequence(
              tween().to(1.25, { scale: new Vec3(1.015, 1.015, 1) }, { easing: 'sineInOut' }),
              tween().to(1.25, { scale: Vec3.ONE }, { easing: 'sineInOut' })
            )
          )
        .start()
    }
    return buttonNode
  }

  private createButtonGlow(parent: Node, width: number, height: number, radius: number, color: Color) {
    const glow = new Node('Glow')
    glow.setParent(parent)
    glow.addComponent(UITransform).setContentSize(width + 28, height + 22)
    const opacity = glow.addComponent(UIOpacity)
    opacity.opacity = 92
    const graphics = glow.addComponent(Graphics)
    graphics.fillColor = new Color(color.r, color.g, color.b, 20)
    graphics.roundRect(-(width + 28) / 2, -(height + 22) / 2, width + 28, height + 22, radius + 11)
    graphics.fill()
    graphics.fillColor = new Color(255, 255, 255, 16)
    graphics.roundRect(-(width + 8) / 2, -(height + 4) / 2, width + 8, height + 4, radius + 2)
    graphics.fill()
    // 柔光只做原地呼吸，不产生方向性，避免误导玩家去滑动按钮。
    tween(opacity)
      .repeatForever(
        tween()
          .sequence(
            tween().to(1.35, { opacity: 145 }, { easing: 'sineInOut' }),
            tween().to(1.35, { opacity: 82 }, { easing: 'sineInOut' })
          )
      )
      .start()
  }

  private createButtonSpark(parent: Node, name: string, x: number, y: number, radius: number) {
    const spark = new Node(name)
    spark.setParent(parent)
    spark.setPosition(x, y, 0)
    spark.addComponent(UITransform).setContentSize(radius * 2, radius * 2)
    const opacity = spark.addComponent(UIOpacity)
    opacity.opacity = 74
    const graphics = spark.addComponent(Graphics)
    graphics.fillColor = new Color(255, 255, 255, 118)
    graphics.circle(0, 0, radius)
    graphics.fill()
    tween(spark)
      .repeatForever(
        tween()
          .sequence(
            tween().to(1.15, { scale: new Vec3(1.35, 1.35, 1) }, { easing: 'sineInOut' }),
            tween().to(1.15, { scale: Vec3.ONE }, { easing: 'sineInOut' })
          )
      )
      .start()
    tween(opacity)
      .repeatForever(
        tween()
          .sequence(
            tween().to(1.15, { opacity: 132 }, { easing: 'sineInOut' }),
            tween().to(1.15, { opacity: 62 }, { easing: 'sineInOut' })
          )
      )
      .start()
  }

  private buildTipText(parent: Node) {
    const tipNode = new Node('TipText')
    tipNode.setParent(parent)
    tipNode.addComponent(UITransform).setContentSize(520, 48)
    this.tipOpacity = tipNode.addComponent(UIOpacity)
    this.tipOpacity.opacity = 255

    const label = tipNode.addComponent(Label)
    label.string = this.pickNextTip()
    label.fontSize = 22
    label.lineHeight = 28
    label.color = SUBTEXT_COLOR
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    this.tipLabel = label
  }

  private startTipRotation() {
    if (!this.tipOpacity || !this.tipLabel) {
      return
    }

    Tween.stopAllByTarget(this.tipOpacity)
    tween(this.tipOpacity)
      .repeatForever(
        tween()
          .sequence(
            tween().delay(5.2),
            tween().to(0.28, { opacity: 0 }),
            tween().call(() => {
              if (this.tipLabel) {
                this.tipLabel.string = this.pickNextTip()
              }
            }),
            tween().to(0.28, { opacity: 255 })
          )
      )
      .start()
  }

  private pickNextTip() {
    if (TIP_TEXTS.length <= 1) {
      return TIP_TEXTS[0] ?? ''
    }

    let index = Math.floor(Math.random() * TIP_TEXTS.length)
    if (index === this.currentTipIndex) {
      index = (index + 1) % TIP_TEXTS.length
    }
    this.currentTipIndex = index
    return TIP_TEXTS[index]
  }

  private buildRankModal(parent: Node) {
    const mask = new Node('RankMask')
    mask.setParent(parent)
    mask.addComponent(UITransform)
    mask.addComponent(UIOpacity).opacity = 0
    mask.active = false
    this.rankMaskNode = mask
    mask.addComponent(Graphics)

    const panel = new Node('RankPanel')
    panel.setParent(mask)
    panel.addComponent(UITransform).setContentSize(470, 760)
    panel.addComponent(Graphics)
    this.bindSwallowTouch(panel)
    this.rankPanelNode = panel

    const close = this.createCircleButton(panel, 'CloseButton', '×', 180, 320, 42)
    close.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true
      this.hideRankModal()
    })

    const title = this.createLabel(panel, 'Title', '好友排行榜', 42, TEAL_COLOR, new Vec3(0, 260, 0))
    title.isBold = true
    const badge = this.createCapsule(panel, 'Badge', '本周合成之星', 0, 198, 188, 40, new Color(242, 252, 255, 255), SUBTEXT_COLOR)
    badge.fontSize = 18

    this.buildPodium(panel)
    this.buildRankList(panel)
    const invite = this.createPrimaryButton(panel, 'InviteBtn', '邀请好友', BLUE_COLOR, -286)
    invite.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true
      this.showToast('邀请功能待小游戏能力接入')
    })

    mask.on(Node.EventType.TOUCH_END, this.hideRankModal, this)
  }

  private buildPodium(parent: Node) {
    const top3 = RANKING_DATA.slice(0, 3)
    const positions = [
      { x: 0, y: 120, size: 96 },
      { x: -120, y: 78, size: 72 },
      { x: 120, y: 78, size: 72 }
    ]

    top3.forEach((entry, index) => {
      const holder = new Node(`Top${entry.rank}`)
      holder.setParent(parent)
      holder.setPosition(positions[index].x, positions[index].y, 0)
      holder.addComponent(UITransform).setContentSize(130, 160)
      const bubble = holder.addComponent(Graphics)
      const size = positions[index].size
      bubble.fillColor = entry.color
      bubble.roundRect(-size / 2, -size / 2 + 20, size, size, 24)
      bubble.fill()
      if (entry.rank === 1) {
        bubble.fillColor = new Color(255, 209, 105, 255)
        bubble.circle(0, size / 2 + 24, 24)
        bubble.fill()
      }

      const rankLabel = this.createLabel(holder, 'Rank', `${entry.rank}`, 26, TEAL_COLOR, new Vec3(0, 20, 0))
      rankLabel.isBold = true
      const nameLabel = this.createLabel(holder, 'Name', entry.name, 24, TEAL_COLOR, new Vec3(0, -42, 0))
      nameLabel.isBold = true
      const scoreLabel = this.createLabel(holder, 'Score', `${entry.score}`, index === 0 ? 42 : 28, TEAL_COLOR, new Vec3(0, -78, 0))
      scoreLabel.isBold = true
    })
  }

  private buildRankList(parent: Node) {
    const entries = RANKING_DATA.slice(3)
    entries.forEach((entry, index) => {
      const row = new Node(`Row${entry.rank}`)
      row.setParent(parent)
      row.setPosition(0, -38 - index * 92, 0)
      row.addComponent(UITransform).setContentSize(360, 70)
      const graphics = row.addComponent(Graphics)
      graphics.fillColor = new Color(255, 255, 255, 218)
      graphics.roundRect(-180, -35, 360, 70, 24)
      graphics.fill()
      graphics.fillColor = entry.color
      graphics.circle(-122, 0, 18)
      graphics.fill()

      const rankLabel = this.createLabel(row, 'Rank', `${entry.rank}`, 24, SUBTEXT_COLOR, new Vec3(-158, 0, 0))
      rankLabel.isBold = true
      const nameLabel = this.createLabel(row, 'Name', entry.name, 22, TEAL_COLOR, new Vec3(-34, 0, 0))
      nameLabel.isBold = true
      const scoreLabel = this.createLabel(row, 'Score', `${entry.score}`, 22, new Color(89, 188, 163, 255), new Vec3(112, 0, 0))
      scoreLabel.isBold = true
    })
  }

  private buildToast(parent: Node) {
    const toast = new Node('Toast')
    toast.setParent(parent)
    toast.addComponent(UITransform).setContentSize(360, 72)
    toast.addComponent(Graphics)
    toast.addComponent(UIOpacity).opacity = 0
    toast.active = false
    toast.on(Node.EventType.TOUCH_END, this.consumeTouch, this)

    const label = this.createLabel(toast, 'Label', '', 22, LIGHT_TEXT, Vec3.ZERO)
    label.isBold = true
    this.toastNode = toast
    this.toastOpacity = toast.getComponent(UIOpacity)
  }

  private layoutRankModal(width: number, height: number) {
    if (!this.rankMaskNode || !this.rankPanelNode) {
      return
    }

    const maskTransform = this.rankMaskNode.getComponent(UITransform)
    const panelTransform = this.rankPanelNode.getComponent(UITransform)
    const maskGraphics = this.rankMaskNode.getComponent(Graphics)
    const panelGraphics = this.rankPanelNode.getComponent(Graphics)
    if (!maskTransform || !panelTransform || !maskGraphics || !panelGraphics) {
      return
    }

    maskTransform.setContentSize(width, height)
    maskGraphics.clear()
    maskGraphics.fillColor = new Color(234, 246, 250, 212)
    maskGraphics.rect(-width / 2, -height / 2, width, height)
    maskGraphics.fill()

    panelTransform.setContentSize(Math.min(470, width - 90), Math.min(760, height - 180))
    panelGraphics.clear()
    panelGraphics.fillColor = new Color(186, 225, 232, 64)
    panelGraphics.roundRect(-panelTransform.width / 2 - 4, -panelTransform.height / 2 - 6, panelTransform.width + 8, panelTransform.height + 12, 28)
    panelGraphics.fill()
    panelGraphics.fillColor = new Color(242, 253, 255, 248)
    panelGraphics.roundRect(-panelTransform.width / 2, -panelTransform.height / 2, panelTransform.width, panelTransform.height, 28)
    panelGraphics.fill()
  }

  private createCircleDecoration(parent: Node, name: string, radius: number, color: Color, alphaScale: number) {
    const node = new Node(name)
    node.setParent(parent)
    node.addComponent(UITransform).setContentSize(radius * 2, radius * 2)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = new Color(color.r, color.g, color.b, Math.round(color.a * alphaScale))
    graphics.circle(0, 0, radius)
    graphics.fill()
    tween(node)
      .repeatForever(
        tween()
          .sequence(
            tween().to(2, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' }),
            tween().to(2, { scale: Vec3.ONE }, { easing: 'sineInOut' })
          )
      )
      .start()
    return node
  }

  private createCircleButton(parent: Node, name: string, text: string, x: number, y: number, radius: number) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(radius * 2, radius * 2)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = new Color(255, 255, 255, 248)
    graphics.circle(0, 0, radius)
    graphics.fill()
    const label = this.createLabel(node, 'Label', text, 26, TEAL_COLOR, Vec3.ZERO)
    label.isBold = true
    return node
  }

  private createCapsule(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: Color,
    textColor: Color
  ) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(width, height)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = fillColor
    graphics.roundRect(-width / 2, -height / 2, width, height, height / 2)
    graphics.fill()
    const label = this.createLabel(node, 'Label', text, 20, textColor, Vec3.ZERO)
    label.isBold = true
    return label
  }

  private createLabel(parent: Node, name: string, text: string, fontSize: number, color: Color, position: Vec3) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(position)
    node.addComponent(UITransform).setContentSize(420, 56)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = fontSize + 6
    label.color = color
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    return label
  }

  private handleStartTap(event: EventTouch) {
    event.propagationStopped = true
    this.startHandler?.()
  }

  private handleRankTap(event: EventTouch) {
    event.propagationStopped = true
    if (!this.rankMaskNode || !this.rankPanelNode) {
      return
    }

    const opacity = this.rankMaskNode.getComponent(UIOpacity) ?? this.rankMaskNode.addComponent(UIOpacity)
    opacity.opacity = 0
    this.rankMaskNode.active = true
    this.rankPanelNode.setScale(new Vec3(0.94, 0.94, 1))
    tween(opacity).to(0.14, { opacity: 255 }).start()
    tween(this.rankPanelNode).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start()
  }

  private hideRankModal(event?: EventTouch) {
    if (event) {
      event.propagationStopped = true
    }
    if (!this.rankMaskNode) {
      return
    }

    const opacity = this.rankMaskNode.getComponent(UIOpacity) ?? this.rankMaskNode.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)
    tween(opacity)
      .to(0.12, { opacity: 0 })
      .call(() => {
        if (this.rankMaskNode) {
          this.rankMaskNode.active = false
        }
      })
      .start()
  }

  private showToast(message: string) {
    if (!this.toastNode || !this.toastOpacity) {
      return
    }

    const graphics = this.toastNode.getComponent(Graphics)
    const label = this.toastNode.getChildByName('Label')?.getComponent(Label) ?? null
    const transform = this.toastNode.getComponent(UITransform)
    if (!graphics || !label || !transform) {
      return
    }

    this.toastNode.active = true
    this.toastNode.setPosition(0, -520, 0)
    label.string = message
    graphics.clear()
    graphics.fillColor = new Color(46, 108, 121, 232)
    graphics.roundRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height, 24)
    graphics.fill()

    Tween.stopAllByTarget(this.toastOpacity)
    this.toastOpacity.opacity = 0
    tween(this.toastOpacity)
      .sequence(
        tween().to(0.12, { opacity: 255 }),
        tween().delay(1.2),
        tween().to(0.12, { opacity: 0 }),
        tween().call(() => {
          if (this.toastNode) {
            this.toastNode.active = false
          }
        })
      )
      .start()
  }

  private consumeTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  private bindSwallowTouch(node: Node) {
    node.on(Node.EventType.TOUCH_START, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_MOVE, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_END, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this)
  }
}
