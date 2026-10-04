import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Mask,
  Node,
  resources,
  ScrollView,
  Sprite,
  SpriteFrame,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'

import { type PlayerAvatar } from '../../profile/AvatarCatalog'
import { PlayerAvatarRenderer } from '../../profile/PlayerAvatarRenderer'

const { ccclass } = _decorator

type LeaderboardTabId = 'score' | 'highestNumber'

export type LeaderboardViewEntry = {
  rank: number | null
  name: string
  score: string
  avatar: PlayerAvatar
}

export type LeaderboardViewTab = {
  id: LeaderboardTabId
  label: string
  page: number
  hasMore: boolean
  entries: LeaderboardViewEntry[]
  self: LeaderboardViewEntry
}

export type LeaderboardViewData = {
  tabs: LeaderboardViewTab[]
}

type LeaderboardPopupOptions = {
  onClose: () => void
  onInvite: () => void
  onLoadNextPage?: (page: number) => Promise<LeaderboardViewTab>
  onButtonClick?: () => void
}

type RowView = {
  node: Node
  rank: Label
  background: Sprite
  medal: Sprite
  isSelf: boolean
  entry: LeaderboardViewEntry | null
  avatar: Sprite
  avatarRenderer: PlayerAvatarRenderer
  name: Label
  score: Label
}

const PANEL_WIDTH = 720
const PANEL_HEIGHT = 1240
const ROW_WIDTH = 610
const ROW_HEIGHT = 76
const ROW_STEP_Y = 78
const LIST_HEIGHT = ROW_STEP_Y * 7
const LIST_TOP_Y = 203
const FOOTER_HEIGHT = 44
const ROW_POOL_SIZE = Math.ceil(LIST_HEIGHT / ROW_STEP_Y) + 2
const TEXTURE_WARMUP_DRAW_COUNT = 2

const BROWN = new Color(79, 46, 27, 255)
const CORAL = new Color(240, 102, 69, 255)
const CREAM = new Color(255, 248, 220, 255)
const MUTED = new Color(137, 93, 60, 255)
const WHITE = new Color(255, 255, 255, 255)

const DEFAULT_TABS: LeaderboardViewTab[] = [
  {
    id: 'score',
    label: '最高分榜',
    page: 1,
    hasMore: false,
    entries: [],
    self: { rank: null, name: '我', score: '暂无成绩', avatar: { avatarIndex: 11 } }
  }
]

// 先一次性载入弹窗会用到的全部贴图，再显示内容，避免首开和切榜时出现白色头像占位。
const LEADERBOARD_SPRITE_PATHS = [
  'Leaderboard/panel-background/spriteFrame',
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
 * 排行榜 Prefab 的数据渲染控制器。
 *
 * 外层只传入真实榜单纯数据和操作回调；本组件负责资源预热与最高分榜渲染。
 */
@ccclass('LeaderboardPopupController')
export class LeaderboardPopupController extends Component {
  private closeHandler: (() => void) | null = null
  private inviteHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private loadNextPageHandler: ((page: number) => Promise<LeaderboardViewTab>) | null = null
  private scrollView: ScrollView | null = null
  private listContent: Node | null = null
  private footerLabel: Label | null = null
  private pageRevision = 0
  private isLoadingPage = false
  private pageLoadFailed = false
  private closeButtonNode: Node | null = null
  private inviteButtonNode: Node | null = null
  private inviteButtonSprite: Sprite | null = null
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
  private tabs: LeaderboardViewTab[] = DEFAULT_TABS.map(tab => ({ ...tab, entries: [], self: { ...tab.self } }))

  setup(options: LeaderboardPopupOptions) {
    this.isDisposed = false
    this.closeHandler = options.onClose
    this.inviteHandler = options.onInvite
    this.buttonClickHandler = options.onButtonClick ?? null
    this.loadNextPageHandler = options.onLoadNextPage ?? null
    this.contentOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.contentOpacity.opacity = 0
    void this.prepareContent()
  }

  setData(data: LeaderboardViewData) {
    const scoreTab = data.tabs.find(tab => tab.id === 'score')
    if (!scoreTab) {
      return
    }
    this.cancelPageLoad()
    this.pageLoadFailed = false
    this.tabs = [
      {
        ...scoreTab,
        entries: scoreTab.entries.map(entry => ({ ...entry })),
        self: { ...scoreTab.self }
      }
    ]
    if (this.isContentReady) {
      this.renderScoreBoard()
      this.scrollView?.scrollToTop(0)
      this.renderVisibleRows()
    }
  }

  /** 打开前先以几乎不可见的透明度真实渲染数帧，避免头像纹理首帧显示成白块。 */
  prepareForShow() {
    this.wantsVisible = true
    this.cancelRevealSchedule()
    if (this.isContentReady) {
      this.renderScoreBoard()
      this.beginTextureWarmup()
    } else if (this.contentOpacity) {
      this.contentOpacity.opacity = 0
    }
  }

  // 退场动画期间停止尚未完成的显现调度，但保留当前画面供外层平滑缩小和淡出。
  prepareForHide() {
    this.wantsVisible = false
    this.cancelPageLoad()
    this.scrollView?.stopAutoScroll()
    this.cancelRevealSchedule()
  }

  lateUpdate() {
    if (this.warmupDrawsRemaining <= 0) {
      return
    }
    if (this.isDisposed || !this.wantsVisible) {
      this.cancelRevealSchedule()
      return
    }

    this.warmupDrawsRemaining -= 1
    if (this.warmupDrawsRemaining <= 0) {
      this.revealContent()
    }
  }

  // 外层退场动画完成后再真正隐藏内容，避免下一次激活时闪出上一帧。
  hideContent() {
    this.clearRowAvatars()
    this.prepareForHide()
    if (this.contentOpacity) {
      this.contentOpacity.opacity = 0
    }
  }

  onDisable() {
    this.prepareForHide()
    this.clearRowAvatars()
  }

  onDestroy() {
    this.rowViews.forEach(row => row.avatarRenderer.dispose())
    this.selfRowView?.avatarRenderer.dispose()
    this.isDisposed = true
    this.cancelPageLoad()
    this.loadNextPageHandler = null
    this.wantsVisible = false
    this.cancelRevealSchedule()
    // 节点销毁时引擎会自动清理事件。这里不再访问已经进入销毁流程的子节点，
    // 避免切换游戏场景时重复解绑导致 Node.off 空对象错误。
    this.rowViews.length = 0
    this.pendingSprites.clear()
    this.spriteResourcePaths.clear()
    this.spriteFrameCache.clear()
    this.closeButtonNode = null
    this.inviteButtonNode = null
    this.inviteButtonSprite = null
    this.selfRowView = null
    this.contentOpacity = null
    this.scrollView = null
    this.listContent = null
    this.footerLabel = null
  }

  private clearRowAvatars() {
    const rows = this.selfRowView ? [...this.rowViews, this.selfRowView] : this.rowViews
    rows.forEach(row => {
      row.avatarRenderer.clear()
      row.entry = null
    })
  }

  private cancelPageLoad() {
    // 关闭或重新取榜后，旧请求不能追加到新一轮列表。
    this.pageRevision += 1
    this.isLoadingPage = false
  }

  /** 等待所有公共素材和榜单头像载入，再一次性创建并显示弹窗内容。 */
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
    this.renderScoreBoard()
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

    // opacity=1 会进入渲染提交但肉眼不可见；组件自身逐帧计数，避免跨场景持有全局 director 监听。
    this.contentOpacity.opacity = 1
    this.warmupDrawsRemaining = TEXTURE_WARMUP_DRAW_COUNT
  }

  private readonly revealContent = () => {
    if (!this.isDisposed && this.wantsVisible && this.contentOpacity) {
      this.contentOpacity.opacity = 255
    }
  }

  private cancelRevealSchedule() {
    this.warmupDrawsRemaining = 0
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
      720,
      1160,
      0,
      0
    )
    const title = this.createLabel(this.node, 'Title', '排行榜', 43, BROWN, 0, 268, 280, 60)
    title.isBold = true
    this.createRows()
    this.createInviteButton()
    this.createCloseButton()
  }

  private createRows() {
    const viewport = new Node('RankScrollView')
    viewport.active = false
    viewport.setParent(this.node)
    viewport.setPosition(0, LIST_TOP_Y, 0)
    const viewTransform = viewport.addComponent(UITransform)
    viewTransform.setAnchorPoint(0.5, 1)
    viewTransform.setContentSize(ROW_WIDTH + 10, LIST_HEIGHT)
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT

    const content = new Node('Content')
    content.setParent(viewport)
    const contentTransform = content.addComponent(UITransform)
    contentTransform.setAnchorPoint(0.5, 1)
    contentTransform.setContentSize(ROW_WIDTH + 10, LIST_HEIGHT)
    this.listContent = content
    this.scrollView = viewport.addComponent(ScrollView)
    this.scrollView.content = content
    this.scrollView.horizontal = false
    this.scrollView.vertical = true
    this.scrollView.cancelInnerEvents = true
    viewport.on(ScrollView.EventType.SCROLLING, this.handleScroll, this)
    viewport.on(ScrollView.EventType.SCROLL_TO_BOTTOM, this.handleScroll, this)

    // 只保留视口附近的行，翻页不会同时创建和加载整张榜单的头像。
    for (let index = 0; index < ROW_POOL_SIZE; index++) {
      this.rowViews.push(this.createRankRow(content, `RankRow${index + 1}`, 0))
    }
    this.footerLabel = this.createLabel(content, 'PageStatus', '', 19, MUTED, 0, 0, ROW_WIDTH, FOOTER_HEIGHT)
    this.footerLabel.node.on(Node.EventType.TOUCH_END, this.handlePageRetry, this)
    this.selfRowView = this.createRankRow(this.node, 'SelfRow', -405, true)
    viewport.active = true
  }

  private createRankRow(parent: Node, name: string, y: number, isSelf = false): RowView {
    const row = new Node(name)
    row.setParent(parent)
    row.setPosition(0, y, 0)
    row.addComponent(UITransform).setContentSize(ROW_WIDTH, ROW_HEIGHT)
    const background = this.createSpriteNode(
      row,
      'Background',
      `Leaderboard/${isSelf ? 'row-self' : 'row-default'}/spriteFrame`,
      ROW_WIDTH,
      ROW_HEIGHT,
      0,
      0
    ).sprite
    const medal = this.createSpriteNode(row, 'Medal', 'Leaderboard/medal-gold/spriteFrame', 55, 60, -268, 1).sprite
    medal.node.active = false

    const rankLabel = this.createLabel(
      row,
      'Rank',
      '—',
      21,
      isSelf ? CORAL : BROWN,
      -268,
      0,
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

    return { node: row, rank: rankLabel, background, medal, isSelf, entry: null, avatar, avatarRenderer: new PlayerAvatarRenderer(avatar), name: nameLabel, score: scoreLabel }
  }

  private createInviteButton() {
    const result = this.createSpriteNode(
      this.node,
      'InviteButton',
      'Leaderboard/button-invite/spriteFrame',
      420,
      96,
      0,
      -510
    )
    this.inviteButtonNode = result.node
    this.inviteButtonSprite = result.sprite
    const label = this.createLabel(result.node, 'Label', '邀请好友挑战', 27, WHITE, 0, 1, 360, 54)
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
      86,
      88,
      285,
      285
    )
    this.closeButtonNode = result.node
    result.node.on(Node.EventType.TOUCH_START, this.handlePressStart, this)
    result.node.on(Node.EventType.TOUCH_CANCEL, this.handlePressCancel, this)
    result.node.on(Node.EventType.TOUCH_END, this.handleCloseTap, this)
  }

  private renderScoreBoard() {
    const tab = this.tabs[0]
    if (!tab) {
      return
    }

    this.listContent?.getComponent(UITransform)?.setContentSize(
      ROW_WIDTH + 10,
      Math.max(LIST_HEIGHT, tab.entries.length * ROW_STEP_Y + FOOTER_HEIGHT)
    )
    this.footerLabel?.node.setPosition(0, -tab.entries.length * ROW_STEP_Y - FOOTER_HEIGHT / 2, 0)
    this.renderPageStatus()
    this.renderVisibleRows()
    if (this.selfRowView) {
      this.renderRow(this.selfRowView, tab.self)
    }
  }

  private renderVisibleRows() {
    const entries = this.tabs[0]?.entries ?? []
    const offset = Math.max(0, this.scrollView?.getScrollOffset().y ?? 0)
    const firstIndex = Math.min(Math.max(0, Math.floor(offset / ROW_STEP_Y) - 1), Math.max(0, entries.length - ROW_POOL_SIZE))
    this.rowViews.forEach((row, poolIndex) => {
      // 按数据下标循环复用，让每滚过一行只替换一行，保留仍在视口内的头像。
      const entryIndex = firstIndex + (poolIndex - firstIndex % ROW_POOL_SIZE + ROW_POOL_SIZE) % ROW_POOL_SIZE
      const entry = entries[entryIndex]
      if (entry) {
        row.node.active = true
        row.node.setPosition(0, -ROW_HEIGHT / 2 - entryIndex * ROW_STEP_Y, 0)
        this.renderRow(row, entry)
      } else {
        row.node.active = false
        if (row.entry) {
          row.avatarRenderer.clear()
          row.entry = null
        }
      }
    })
  }

  private renderRow(view: RowView, entry: LeaderboardViewEntry) {
    if (view.entry === entry) {
      return
    }
    view.entry = entry
    const medalColor = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : ''
    const showMedal = !view.isSelf && !!medalColor
    this.applySpriteFrame(view.background, `Leaderboard/row-${view.isSelf ? 'self' : medalColor || 'default'}/spriteFrame`)
    view.medal.node.active = showMedal
    if (showMedal) {
      this.applySpriteFrame(view.medal, `Leaderboard/medal-${medalColor}/spriteFrame`)
    }
    view.rank.string = showMedal ? '' : entry.rank === null ? '—' : `${entry.rank}`
    view.name.string = entry.name
    view.score.string = entry.score
    void view.avatarRenderer.render(entry.avatar)
  }

  private handleScroll() {
    this.renderVisibleRows()
    if (this.scrollView && this.scrollView.getMaxScrollOffset().y - this.scrollView.getScrollOffset().y <= ROW_STEP_Y) {
      void this.loadNextPage()
    }
  }

  private handlePageRetry(event: EventTouch) {
    event.propagationStopped = true
    if (this.pageLoadFailed) {
      this.pageLoadFailed = false
      void this.loadNextPage()
    }
  }

  private renderPageStatus() {
    if (!this.footerLabel) {
      return
    }
    this.footerLabel.string = this.isLoadingPage ? '加载中…'
      : this.pageLoadFailed ? '加载失败，点击重试'
        : this.tabs[0].hasMore ? '继续上滑加载更多'
          : this.tabs[0].entries.length ? '已显示全部排名' : '暂无上榜玩家'
  }

  private async loadNextPage() {
    const tab = this.tabs[0]
    if (!this.wantsVisible || this.isDisposed || this.isLoadingPage || this.pageLoadFailed || !tab.hasMore || !this.loadNextPageHandler) {
      return
    }
    const revision = this.pageRevision
    const page = tab.page + 1
    this.isLoadingPage = true
    this.renderPageStatus()
    try {
      const next = await this.loadNextPageHandler(page)
      if (this.isDisposed || !this.wantsVisible || revision !== this.pageRevision) {
        return
      }
      if (next.id !== tab.id || next.page !== page) {
        throw new Error('排行榜分页响应异常')
      }
      this.tabs[0] = {
        ...next,
        entries: [...tab.entries, ...next.entries],
        hasMore: next.hasMore && next.entries.length > 0
      }
      this.renderScoreBoard()
    } catch (error) {
      if (revision === this.pageRevision && !this.isDisposed) {
        this.pageLoadFailed = true
        console.warn('[排行榜] 分页加载失败', error)
      }
    } finally {
      if (revision === this.pageRevision && !this.isDisposed) {
        this.isLoadingPage = false
        this.renderPageStatus()
      }
    }
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
