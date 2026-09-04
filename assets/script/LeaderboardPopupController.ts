import {
  _decorator,
  Color,
  Component,
  director,
  Director,
  EventTouch,
  Graphics,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'

const { ccclass } = _decorator

type LeaderboardTabId = 'level' | 'friend'

type LeaderboardEntry = {
  name: string
  score: string
  avatar: string
}

type LeaderboardTab = {
  id: LeaderboardTabId
  label: string
  entries: LeaderboardEntry[]
  self: LeaderboardEntry
}

type LeaderboardPopupOptions = {
  onClose: () => void
  onInvite: () => void
  onButtonClick?: () => void
}

type TabView = {
  node: Node
  background: Sprite
  label: Label
  endHandler: (event: EventTouch) => void
}

type RowView = {
  avatar: Sprite
  name: Label
  score: Label
}

const PANEL_WIDTH = 720
const PANEL_HEIGHT = 1240
const ROW_WIDTH = 610
const ROW_HEIGHT = 76
const ROW_START_Y = 140
const ROW_STEP_Y = 74
const TEXTURE_WARMUP_DRAW_COUNT = 2

const BROWN = new Color(79, 46, 27, 255)
const CORAL = new Color(240, 102, 69, 255)
const CREAM = new Color(255, 248, 220, 255)
const MUTED = new Color(137, 93, 60, 255)
const WHITE = new Color(255, 255, 255, 255)

const TABS: LeaderboardTab[] = [
  {
    id: 'level',
    label: '通关榜',
    entries: [
      { name: '糖糖', score: '第5940关', avatar: 'rabbit' },
      { name: '森森', score: '第4296关', avatar: 'fox' },
      { name: '小满', score: '第2125关', avatar: 'blue-bird' },
      { name: '阿橙', score: '第2122关', avatar: 'orange-cat' },
      { name: '七喜', score: '第1905关', avatar: 'chick' },
      { name: '乌龟电车', score: '第1760关', avatar: 'turtle' },
      { name: 'Vilma佳', score: '第1646关', avatar: 'deer' }
    ],
    self: { name: '我 · 我', score: '第3关', avatar: 'raccoon' }
  },
  {
    id: 'friend',
    label: '好友榜',
    entries: [
      { name: '团子', score: '32680分', avatar: 'alpaca' },
      { name: '小栗', score: '29840分', avatar: 'squirrel' },
      { name: '橙橙', score: '26420分', avatar: 'orange-cat' },
      { name: '芽芽', score: '21860分', avatar: 'frog' },
      { name: '啾啾', score: '19640分', avatar: 'chick' },
      { name: '小蓝', score: '17320分', avatar: 'blue-bird' },
      { name: '刺刺', score: '15680分', avatar: 'hedgehog' }
    ],
    self: { name: '我 · 我', score: '1024分', avatar: 'raccoon' }
  }
]

// 先一次性载入弹窗会用到的全部贴图，再显示内容，避免首开和切榜时出现白色头像占位。
const LEADERBOARD_SPRITE_PATHS = [
  'Leaderboard/panel-background/spriteFrame',
  'Leaderboard/header-leaderboard/spriteFrame',
  'Leaderboard/tab-selected/spriteFrame',
  'Leaderboard/tab-default/spriteFrame',
  'Leaderboard/row-gold/spriteFrame',
  'Leaderboard/row-silver/spriteFrame',
  'Leaderboard/row-bronze/spriteFrame',
  'Leaderboard/row-default/spriteFrame',
  'Leaderboard/row-self/spriteFrame',
  'Leaderboard/medal-gold/spriteFrame',
  'Leaderboard/medal-silver/spriteFrame',
  'Leaderboard/medal-bronze/spriteFrame',
  'Leaderboard/avatar-frame/spriteFrame',
  'Leaderboard/button-invite/spriteFrame',
  'Leaderboard/button-invite-pressed/spriteFrame',
  'Settings/button-close/spriteFrame',
  'Leaderboard/Avatars/avatar-rabbit/spriteFrame',
  'Leaderboard/Avatars/avatar-fox/spriteFrame',
  'Leaderboard/Avatars/avatar-blue-bird/spriteFrame',
  'Leaderboard/Avatars/avatar-orange-cat/spriteFrame',
  'Leaderboard/Avatars/avatar-chick/spriteFrame',
  'Leaderboard/Avatars/avatar-turtle/spriteFrame',
  'Leaderboard/Avatars/avatar-deer/spriteFrame',
  'Leaderboard/Avatars/avatar-alpaca/spriteFrame',
  'Leaderboard/Avatars/avatar-squirrel/spriteFrame',
  'Leaderboard/Avatars/avatar-frog/spriteFrame',
  'Leaderboard/Avatars/avatar-hedgehog/spriteFrame',
  'Leaderboard/Avatars/avatar-raccoon/spriteFrame'
] as const

/**
 * 排行榜静态展示控制器。
 *
 * 当前只维护弹窗结构、素材加载、标签切换和模拟数据渲染；真实排行、开放数据域与
 * 邀请能力均通过回调留给外层，后续接入时不需要改动本组件的视觉层级。
 */
@ccclass('LeaderboardPopupController')
export class LeaderboardPopupController extends Component {
  private closeHandler: (() => void) | null = null
  private inviteHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private closeButtonNode: Node | null = null
  private inviteButtonNode: Node | null = null
  private inviteButtonSprite: Sprite | null = null
  private currentTabIndex = 0
  private readonly tabViews: TabView[] = []
  private readonly rowViews: RowView[] = []
  private selfRowView: RowView | null = null
  private contentOpacity: UIOpacity | null = null
  private preloadPromise: Promise<void> | null = null
  private isContentReady = false
  private wantsVisible = false
  private isDisposed = false
  private warmupDrawsRemaining = 0
  private readonly spriteFrameCache = new Map<string, SpriteFrame>()
  private readonly pendingSprites = new Map<string, Set<Sprite>>()
  private readonly spriteResourcePaths = new Map<Sprite, string>()

  setup(options: LeaderboardPopupOptions) {
    this.isDisposed = false
    this.closeHandler = options.onClose
    this.inviteHandler = options.onInvite
    this.buttonClickHandler = options.onButtonClick ?? null
    this.contentOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.contentOpacity.opacity = 0
    void this.prepareContent()
  }

  /** 打开前先以几乎不可见的透明度真实渲染数帧，避免头像纹理首帧显示成白块。 */
  prepareForShow() {
    this.wantsVisible = true
    this.cancelRevealSchedule()
    if (this.isContentReady) {
      this.beginTextureWarmup()
    } else if (this.contentOpacity) {
      this.contentOpacity.opacity = 0
    }
  }

  // 退场动画期间停止尚未完成的显现调度，但保留当前画面供外层平滑缩小和淡出。
  prepareForHide() {
    this.wantsVisible = false
    this.cancelRevealSchedule()
  }

  // 外层退场动画完成后再真正隐藏内容，避免下一次激活时闪出上一帧。
  hideContent() {
    this.prepareForHide()
    if (this.contentOpacity) {
      this.contentOpacity.opacity = 0
    }
  }

  onDestroy() {
    this.isDisposed = true
    this.wantsVisible = false
    this.cancelRevealSchedule()
    // 节点销毁时引擎会自动清理事件。这里不再访问已经进入销毁流程的子节点，
    // 避免切换游戏场景时重复解绑导致 Node.off 空对象错误。
    this.tabViews.length = 0
    this.rowViews.length = 0
    this.pendingSprites.clear()
    this.spriteResourcePaths.clear()
    this.spriteFrameCache.clear()
    this.closeButtonNode = null
    this.inviteButtonNode = null
    this.inviteButtonSprite = null
    this.selfRowView = null
    this.contentOpacity = null
  }

  /** 等待所有公共素材和两套榜单头像载入，再一次性创建并显示弹窗内容。 */
  private async prepareContent() {
    if (!this.preloadPromise) {
      this.preloadPromise = Promise.all(
        LEADERBOARD_SPRITE_PATHS.map((resourcePath) => this.preloadSpriteFrame(resourcePath))
      ).then(() => undefined)
    }

    await this.preloadPromise
    if (this.isDisposed) {
      return
    }

    this.ensureStructure()
    this.renderTab(0)
    this.isContentReady = true
    if (this.wantsVisible) {
      this.beginTextureWarmup()
    } else if (this.contentOpacity) {
      this.contentOpacity.opacity = 0
    }
  }

  private beginTextureWarmup() {
    if (!this.contentOpacity || this.isDisposed || !this.wantsVisible) {
      return
    }

    // opacity=1 会进入渲染提交但肉眼不可见；按实际绘制次数计数，不依赖设备帧率。
    this.contentOpacity.opacity = 1
    this.warmupDrawsRemaining = TEXTURE_WARMUP_DRAW_COUNT
    director.on(Director.EVENT_AFTER_DRAW, this.handleWarmupDraw, this)
  }

  private readonly handleWarmupDraw = () => {
    if (this.isDisposed || !this.wantsVisible) {
      this.cancelRevealSchedule()
      return
    }

    this.warmupDrawsRemaining -= 1
    if (this.warmupDrawsRemaining > 0) {
      return
    }

    director.off(Director.EVENT_AFTER_DRAW, this.handleWarmupDraw, this)
    this.revealContent()
  }

  private readonly revealContent = () => {
    if (!this.isDisposed && this.wantsVisible && this.contentOpacity) {
      this.contentOpacity.opacity = 255
    }
  }

  private cancelRevealSchedule() {
    this.warmupDrawsRemaining = 0
    director.off(Director.EVENT_AFTER_DRAW, this.handleWarmupDraw, this)
  }

  private preloadSpriteFrame(resourcePath: string) {
    return new Promise<void>((resolve) => {
      const cached = this.spriteFrameCache.get(resourcePath)
      if (cached) {
        resolve()
        return
      }

      resources.load(resourcePath, SpriteFrame, (error, spriteFrame) => {
        if (!this.isDisposed && !error && spriteFrame) {
          this.spriteFrameCache.set(resourcePath, spriteFrame)
        } else if (!this.isDisposed && error) {
          console.warn(`[排行榜] 素材预加载失败: ${resourcePath}`, error)
        }
        resolve()
      })
    })
  }

  private ensureStructure() {
    if (this.node.getChildByName('PanelBackground')) {
      return
    }

    ;(this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(
      PANEL_WIDTH,
      PANEL_HEIGHT
    )

    this.createSpriteNode(
      this.node,
      'PanelBackground',
      'Leaderboard/panel-background/spriteFrame',
      680,
      982,
      0,
      -70
    )
    this.createTabs()
    this.createRows()
    this.createInviteButton()
    this.createSpriteNode(
      this.node,
      'Header',
      'Leaderboard/header-leaderboard/spriteFrame',
      720,
      356,
      0,
      450
    )
    this.createCloseButton()
  }

  private createTabs() {
    const xPositions = [-140, 140]
    TABS.forEach((tab, index) => {
      const node = new Node(`Tab-${tab.id}`)
      node.setParent(this.node)
      node.setPosition(xPositions[index], 224, 0)
      node.addComponent(UITransform).setContentSize(254, 74)
      const background = node.addComponent(Sprite)
      this.configureSprite(background)
      const label = this.createLabel(node, 'Label', tab.label, 25, BROWN, 0, 0, 220, 48)
      label.isBold = true

      const endHandler = (event: EventTouch) => {
        event.propagationStopped = true
        node.setScale(Vec3.ONE)
        if (this.currentTabIndex !== index) {
          this.buttonClickHandler?.()
          this.renderTab(index)
        }
      }
      node.on(Node.EventType.TOUCH_START, this.handlePressStart, this)
      node.on(Node.EventType.TOUCH_CANCEL, this.handlePressCancel, this)
      node.on(Node.EventType.TOUCH_END, endHandler, this)
      this.tabViews.push({ node, background, label, endHandler })
    })
  }

  private createRows() {
    for (let index = 0; index < 7; index++) {
      const rank = index + 1
      const row = this.createRankRow(`RankRow${rank}`, rank, ROW_START_Y - index * ROW_STEP_Y)
      this.rowViews.push(row)
    }
    this.selfRowView = this.createRankRow('SelfRow', 0, -405, true)
  }

  private createRankRow(name: string, rank: number, y: number, isSelf = false): RowView {
    const row = new Node(name)
    row.setParent(this.node)
    row.setPosition(0, y, 0)
    row.addComponent(UITransform).setContentSize(ROW_WIDTH, ROW_HEIGHT)

    const rowAsset = isSelf
      ? 'row-self'
      : rank === 1
        ? 'row-gold'
        : rank === 2
          ? 'row-silver'
          : rank === 3
            ? 'row-bronze'
            : 'row-default'
    this.createSpriteNode(
      row,
      'Background',
      `Leaderboard/${rowAsset}/spriteFrame`,
      ROW_WIDTH,
      ROW_HEIGHT,
      0,
      0
    )

    if (rank > 0 && rank <= 3) {
      const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'
      this.createSpriteNode(
        row,
        'Medal',
        `Leaderboard/medal-${medal}/spriteFrame`,
        55,
        60,
        -268,
        1
      )
    }

    const rankLabel = this.createLabel(
      row,
      'Rank',
      isSelf ? '—' : `${rank}`,
      21,
      isSelf ? CORAL : BROWN,
      -268,
      rank <= 3 && !isSelf ? 4 : 0,
      50,
      44
    )
    rankLabel.isBold = true

    const avatarDisc = new Node('AvatarDisc')
    avatarDisc.setParent(row)
    avatarDisc.setPosition(-210, 0, 0)
    avatarDisc.addComponent(UITransform).setContentSize(58, 58)
    const avatarDiscGraphics = avatarDisc.addComponent(Graphics)
    avatarDiscGraphics.fillColor = CREAM
    avatarDiscGraphics.circle(0, 0, 27)
    avatarDiscGraphics.fill()

    const avatar = this.createSpriteNode(row, 'Avatar', '', 54, 54, -210, 0).sprite
    this.createSpriteNode(
      row,
      'AvatarFrame',
      'Leaderboard/avatar-frame/spriteFrame',
      60,
      60,
      -210,
      0
    )

    const nameLabel = this.createLabel(
      row,
      'Name',
      '',
      21,
      isSelf ? CORAL : BROWN,
      -83,
      0,
      190,
      46,
      Label.HorizontalAlign.LEFT
    )
    nameLabel.isBold = true
    const scoreLabel = this.createLabel(
      row,
      'Score',
      '',
      21,
      CORAL,
      188,
      0,
      190,
      46,
      Label.HorizontalAlign.RIGHT
    )
    scoreLabel.isBold = true

    return { avatar, name: nameLabel, score: scoreLabel }
  }

  private createInviteButton() {
    const result = this.createSpriteNode(
      this.node,
      'InviteButton',
      'Leaderboard/button-invite/spriteFrame',
      500,
      114,
      0,
      -548
    )
    this.inviteButtonNode = result.node
    this.inviteButtonSprite = result.sprite
    const label = this.createLabel(result.node, 'Label', '邀请好友挑战', 31, WHITE, 0, 1, 430, 64)
    label.isBold = true
    result.node.on(Node.EventType.TOUCH_START, this.handleInvitePressStart, this)
    result.node.on(Node.EventType.TOUCH_CANCEL, this.handleInvitePressCancel, this)
    result.node.on(Node.EventType.TOUCH_END, this.handleInviteTap, this)
  }

  private createCloseButton() {
    const result = this.createSpriteNode(
      this.node,
      'CloseButton',
      'Settings/button-close/spriteFrame',
      70,
      71,
      310,
      505
    )
    this.closeButtonNode = result.node
    result.node.on(Node.EventType.TOUCH_START, this.handlePressStart, this)
    result.node.on(Node.EventType.TOUCH_CANCEL, this.handlePressCancel, this)
    result.node.on(Node.EventType.TOUCH_END, this.handleCloseTap, this)
  }

  private renderTab(index: number) {
    const tab = TABS[index] ?? TABS[0]
    this.currentTabIndex = Math.max(0, TABS.indexOf(tab))
    this.tabViews.forEach((view, tabIndex) => {
      const selected = tabIndex === this.currentTabIndex
      this.applySpriteFrame(
        view.background,
        selected
          ? 'Leaderboard/tab-selected/spriteFrame'
          : 'Leaderboard/tab-default/spriteFrame'
      )
      view.label.color = selected ? WHITE : BROWN
    })

    this.rowViews.forEach((row, rowIndex) => {
      const entry = tab.entries[rowIndex]
      if (entry) {
        this.renderRow(row, entry)
      }
    })
    if (this.selfRowView) {
      this.renderRow(this.selfRowView, tab.self)
    }
  }

  private renderRow(view: RowView, entry: LeaderboardEntry) {
    view.name.string = entry.name
    view.score.string = entry.score
    this.applySpriteFrame(
      view.avatar,
      `Leaderboard/Avatars/avatar-${entry.avatar}/spriteFrame`
    )
  }

  private createSpriteNode(
    parent: Node,
    name: string,
    resourcePath: string,
    width: number,
    height: number,
    x: number,
    y: number
  ) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(width, height)
    const sprite = node.addComponent(Sprite)
    this.configureSprite(sprite)
    if (resourcePath) {
      this.applySpriteFrame(sprite, resourcePath)
    }
    return { node, sprite }
  }

  private configureSprite(sprite: Sprite) {
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.trim = false
    sprite.color = Color.WHITE
  }

  private applySpriteFrame(sprite: Sprite, resourcePath: string) {
    this.spriteResourcePaths.set(sprite, resourcePath)
    const cached = this.spriteFrameCache.get(resourcePath)
    if (cached) {
      sprite.spriteFrame = cached
      return
    }

    sprite.spriteFrame = null
    let waiters = this.pendingSprites.get(resourcePath)
    if (waiters) {
      waiters.add(sprite)
      return
    }

    waiters = new Set<Sprite>([sprite])
    this.pendingSprites.set(resourcePath, waiters)
    resources.load(resourcePath, SpriteFrame, (error, spriteFrame) => {
      if (this.isDisposed) {
        return
      }
      const waitingSprites = this.pendingSprites.get(resourcePath)
      this.pendingSprites.delete(resourcePath)
      if (error || !spriteFrame) {
        console.warn(`[排行榜] 素材加载失败: ${resourcePath}`, error)
        return
      }
      this.spriteFrameCache.set(resourcePath, spriteFrame)
      waitingSprites?.forEach((waitingSprite) => {
        if (
          waitingSprite.isValid &&
          waitingSprite.node?.isValid &&
          this.spriteResourcePaths.get(waitingSprite) === resourcePath
        ) {
          waitingSprite.spriteFrame = spriteFrame
        }
      })
    })
  }

  private createLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    x: number,
    y: number,
    width: number,
    height: number,
    horizontalAlign = Label.HorizontalAlign.CENTER
  ) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(width, height)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = fontSize + 5
    label.color = color
    label.horizontalAlign = horizontalAlign
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.overflow = Label.Overflow.SHRINK
    label.enableWrapText = false
    return label
  }

  private handlePressStart(event: EventTouch) {
    event.propagationStopped = true
    const target = event.currentTarget as Node | null
    target?.setScale(new Vec3(0.95, 0.95, 1))
  }

  private handlePressCancel(event: EventTouch) {
    event.propagationStopped = true
    const target = event.currentTarget as Node | null
    target?.setScale(Vec3.ONE)
  }

  private handleCloseTap(event: EventTouch) {
    event.propagationStopped = true
    this.closeButtonNode?.setScale(Vec3.ONE)
    this.buttonClickHandler?.()
    this.closeHandler?.()
  }

  private handleInvitePressStart(event: EventTouch) {
    this.handlePressStart(event)
    if (this.inviteButtonSprite) {
      this.applySpriteFrame(
        this.inviteButtonSprite,
        'Leaderboard/button-invite-pressed/spriteFrame'
      )
    }
  }

  private handleInvitePressCancel(event: EventTouch) {
    this.handlePressCancel(event)
    if (this.inviteButtonSprite) {
      this.applySpriteFrame(this.inviteButtonSprite, 'Leaderboard/button-invite/spriteFrame')
    }
  }

  private handleInviteTap(event: EventTouch) {
    event.propagationStopped = true
    this.inviteButtonNode?.setScale(Vec3.ONE)
    if (this.inviteButtonSprite) {
      this.applySpriteFrame(this.inviteButtonSprite, 'Leaderboard/button-invite/spriteFrame')
    }
    this.buttonClickHandler?.()
    this.inviteHandler?.()
  }
}
