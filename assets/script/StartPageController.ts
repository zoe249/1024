import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  instantiate,
  Label,
  Node,
  Prefab,
  resources,
  screen,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UITransform,
  UIOpacity,
  Vec3
} from 'cc'
import { HomeSwingAnimator } from './HomeSwingAnimator'
import { LeaderboardPopupController } from './LeaderboardPopupController'

const { ccclass, property } = _decorator

type StartPageOptions = {
  onStartTap: () => void
  onShareTap?: () => void
  onButtonClick?: () => void
  backgroundSpriteFrame?: SpriteFrame | null
  rankButtonSpriteFrame?: SpriteFrame | null
  settingsButtonSpriteFrame?: SpriteFrame | null
  shareButtonSpriteFrame?: SpriteFrame | null
  energyBarPrefab?: Prefab | null
  energy?: number
  maxEnergy?: number
  onEnergyMoreTap?: () => void
  coins?: number
  onSettingsTap?: () => void
  onDailyRewardTap?: () => void
  onShopTap?: () => void
}

// 只读取首页胶囊避让所需字段，避免项目依赖额外的微信类型声明。
type WechatMenuButtonRect = {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

type WechatWindowInfo = {
  windowHeight?: number
  screenTop?: number
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
const START_BUTTON_WIDTH = 332
const START_BUTTON_HEIGHT = 90
const ACTION_ICON_WIDTH = 80
const ACTION_ICON_HEIGHT = 82
const ACTION_ICON_PAIR_OFFSET = 62
// 资源条保持已经确认的小尺寸，以下常量统一用于胶囊避让和标题间距计算。
const AMOUNT_BAR_SCALE = 0.36
const DEFAULT_MAX_ENERGY = 10
const ENERGY_HEART_LEFT_X = -132
const ENERGY_HEART_RIGHT_X = 132
const ENERGY_HEART_Y = 2
const AMOUNT_BAR_SOURCE_HEIGHT = 155
const AMOUNT_BAR_DEFAULT_TOP_INSET = 92
const AMOUNT_BAR_TITLE_GAP = 20
// 固定资源条左边缘，数值取自最初确认的 0.55 缩放布局，后续缩放不会再向中间漂移。
const AMOUNT_BAR_LEFT_INSET = 57
// 排行榜使用深色遮罩突出弹窗，暂停页复用时保持透明，避免叠加已有暂停蒙版。
const RANK_MASK_HOME_COLOR = new Color(23, 43, 46, 196)
const RANK_MASK_PAUSE_COLOR = new Color(0, 0, 0, 0)
const HOMEPAGE_ART_ROOT = 'Homepage/'
const HOMEPAGE_DESIGN_WIDTH = 750
const HOMEPAGE_DESIGN_HEIGHT = 1625

const HomepageArtwork = {
  background: 'SwingV14/background-tree-branch',
  start: 'button-start-game',
  swingBird: 'SwingV14/swing-bird-seated',
  swingSeat: 'SwingV14/swing-seat',
  swingRope: 'SwingV14/swing-rope',
  swingKnot: 'SwingV14/swing-seat-knot',
  swingLeaf: 'SwingV14/swing-leaf',
  daily: 'feature-daily-reward',
  leaderboard: 'feature-leaderboard',
  share: 'feature-share',
  shop: 'feature-shop',
  logo: 'logo-1024-number-garden',
  coin: 'resource-coin',
  stamina: 'resource-stamina',
  settings: 'ui-settings'
} as const

const TIP_TEXTS = [
  '相同数字相遇会合成更大的数字',
  '按住目标列，棋子会快速下落',
  '先观察底部数字，再选择落点',
  '连续合成可以快速拉高分数',
  '棋盘填满前，尽量留出一列空间'
]

@ccclass('StartPageController')
export class StartPageController extends Component {
  // 首页根节点优先由层级管理器指定，未指定时再按 StartPageOverlay 名称查找。
  @property({ type: Node, tooltip: '首页根节点，建议在 home.scene 层级中维护' })
  private rootNodeRef: Node | null = null

  // 首页内容容器优先从层级管理器读取，脚本只负责绑定事件和必要动画。
  @property({ type: Node, tooltip: '首页内容容器，可选，默认查找 PageCard' })
  private pageCardNodeRef: Node | null = null

  // 首页背景节点可在层级管理器里摆好，脚本只在绑定背景图时做 cover 适配。
  @property({ type: Node, tooltip: '首页背景节点，可选，默认查找 Background' })
  private backgroundNodeRef: Node | null = null

  // 首页背景图片节点可在层级管理器里拖入，未配置时保留代码兜底背景。
  @property({ type: Node, tooltip: '首页背景图片节点，可选，默认查找 BackgroundImage' })
  private backgroundImageNodeRef: Node | null = null

  // 开始按钮建议在层级管理器里维护样式，脚本只绑定点击开始游戏。
  @property({ type: Node, tooltip: '开始游戏按钮节点，可选，默认查找 StartButton' })
  private startButtonNodeRef: Node | null = null

  // 底部排行榜入口建议使用层级管理器中的图片按钮。
  @property({ type: Node, tooltip: '排行榜按钮节点，可选，默认查找 RankButton' })
  private rankButtonNodeRef: Node | null = null

  // 底部设置入口建议使用层级管理器中的图片按钮。
  @property({ type: Node, tooltip: '设置按钮节点，可选，默认查找 SettingsButton' })
  private settingsButtonNodeRef: Node | null = null

  // 底部分享入口建议使用层级管理器中的图片按钮。
  @property({ type: Node, tooltip: '分享按钮节点，可选，默认查找 ShareButton' })
  private shareButtonNodeRef: Node | null = null

  // 排行榜遮罩和面板可由层级管理器搭好，脚本只负责显隐和数据兜底。
  @property({ type: Node, tooltip: '排行榜遮罩节点，可选，默认查找 RankMask' })
  private rankMaskNodeRef: Node | null = null

  @property({ type: Node, tooltip: '排行榜面板节点，可选，默认查找 RankPanel' })
  private rankPanelNodeRef: Node | null = null

  // 首页提示文本和 Toast 都支持编辑器节点，避免运行时强行改层级。
  @property({ type: Node, tooltip: '首页提示文本节点，可选，默认查找 TipText' })
  private tipTextNodeRef: Node | null = null

  @property({ type: Node, tooltip: 'Toast 节点，可选，默认查找 Toast' })
  private toastNodeRef: Node | null = null

  private startHandler: (() => void) | null = null
  private shareHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private energyMoreHandler: (() => void) | null = null
  private settingsHandler: (() => void) | null = null
  private dailyRewardHandler: (() => void) | null = null
  private shopHandler: (() => void) | null = null
  private currentCoins = 0
  private currentEnergy = 0
  private currentMaxEnergy = DEFAULT_MAX_ENERGY
  private rootNode: Node | null = null
  private pageCardNode: Node | null = null
  private rankMaskNode: Node | null = null
  private rankPanelNode: Node | null = null
  private rankCloseButtonNode: Node | null = null
  private leaderboardController: LeaderboardPopupController | null = null
  private rankPanelLayoutScale = 1
  private backgroundNode: Node | null = null
  private backgroundImageNode: Node | null = null
  private toastNode: Node | null = null
  private toastOpacity: UIOpacity | null = null
  private startButtonNode: Node | null = null
  private rankButtonNode: Node | null = null
  private settingsButtonNode: Node | null = null
  private shareButtonNode: Node | null = null
  // 首页只展示体力 Prefab；金币 Prefab 移到玩法场景，避免顶部信息重复。
  private energyBarNode: Node | null = null
  private energyMoreButtonNode: Node | null = null
  private energyHeartNodes: Node[] = []
  private tipLabel: Label | null = null
  private tipOpacity: UIOpacity | null = null
  private currentTipIndex = -1
  private backgroundSpriteFrame: SpriteFrame | null = null
  private rankButtonSpriteFrame: SpriteFrame | null = null
  private settingsButtonSpriteFrame: SpriteFrame | null = null
  private shareButtonSpriteFrame: SpriteFrame | null = null
  // 暂停页打开排行榜时只借用榜单弹窗，不显示首页背景和首页卡片。
  private isRankOnlyMode = false
  // 有层级节点时不再由脚本重新排版首页主体，避免覆盖编辑器里的 UI 调整。
  private usesHierarchyNodes = false
  private pageDecorNodes: Node[] = []
  private homepageLayerNode: Node | null = null
  private dailyRewardButtonNode: Node | null = null
  private shopButtonNode: Node | null = null
  private coinResourceButtonNode: Node | null = null
  private staminaResourceButtonNode: Node | null = null
  private coinValueLabel: Label | null = null
  private staminaValueLabel: Label | null = null

  setup(options: StartPageOptions) {
    this.startHandler = options.onStartTap
    this.shareHandler = options.onShareTap ?? null
    this.buttonClickHandler = options.onButtonClick ?? null
    this.backgroundSpriteFrame = options.backgroundSpriteFrame ?? null
    this.rankButtonSpriteFrame = options.rankButtonSpriteFrame ?? null
    this.settingsButtonSpriteFrame = options.settingsButtonSpriteFrame ?? null
    this.shareButtonSpriteFrame = options.shareButtonSpriteFrame ?? null
    this.energyMoreHandler = options.onEnergyMoreTap ?? null
    this.settingsHandler = options.onSettingsTap ?? null
    this.dailyRewardHandler = options.onDailyRewardTap ?? null
    this.shopHandler = options.onShopTap ?? null
    this.currentCoins = Math.max(0, Math.floor(options.coins ?? 0))
    this.currentEnergy = Math.max(0, Math.floor(options.energy ?? 0))
    this.currentMaxEnergy = Math.max(1, Math.floor(options.maxEnergy ?? DEFAULT_MAX_ENERGY))
    this.ensurePage()
    if (!this.usesHierarchyNodes) {
      this.ensureEnergyBar(options.energyBarPrefab ?? null)
    }
    this.renderPlayerResources(options.energy ?? 0, options.maxEnergy ?? DEFAULT_MAX_ENERGY)
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

    const cardWidth = parentTransform.width
    const cardHeight = parentTransform.height
    this.redrawBackground()
    if (!this.usesHierarchyNodes) {
      this.pageCardNode.setPosition(0, 0, 0)
      cardTransform.setContentSize(cardWidth, cardHeight)
      this.redrawCard()
      this.layoutPageContents(cardWidth, cardHeight)
    }
    if (this.homepageLayerNode) {
      this.layoutHomepageArtwork(cardWidth, cardHeight)
    } else {
      this.layoutAmountBars(cardHeight)
    }
    this.layoutRankModal(parentTransform.width, parentTransform.height)
  }

  // 首页逻辑层每次资源变化后只需要传入纯数值，Prefab 节点不持有经济状态。
  public renderPlayerResources(energy: number, maxEnergy: number, coins = this.currentCoins) {
    this.currentEnergy = Math.max(0, Math.floor(energy))
    this.currentMaxEnergy = Math.max(1, Math.floor(maxEnergy))
    this.currentCoins = Math.max(0, Math.floor(coins))
    this.ensureEnergyHeartCapacity(this.currentMaxEnergy)
    this.layoutEnergyHearts(this.currentMaxEnergy)
    const visibleEnergy = Math.min(
      this.energyHeartNodes.length,
      Math.max(0, Math.floor(maxEnergy)),
      Math.max(0, Math.floor(energy))
    )
    this.energyHeartNodes.forEach((heartNode, index) => {
      heartNode.active = index < visibleEnergy && index < this.currentMaxEnergy
    })
    if (this.coinValueLabel) {
      this.coinValueLabel.string = `${this.currentCoins}`
    }
    if (this.staminaValueLabel) {
      this.staminaValueLabel.string = `${this.currentEnergy}/${this.currentMaxEnergy}`
    }
  }

  // 首页逻辑层统一通过这个入口展示领取、分享和体力不足提示。
  public showMessage(message: string) {
    this.showToast(message)
  }

  show() {
    if (!this.rootNode) {
      return
    }

    const opacity = this.rootNode.getComponent(UIOpacity) ?? this.rootNode.addComponent(UIOpacity)
    this.rootNode.active = true
    this.bringNodeToTop(this.rootNode)
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
    if (this.pageCardNode) {
      Tween.stopAllByTarget(this.pageCardNode)
    }
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

  // 外部页面可以复用首页排行榜弹窗；rankOnly 为 true 时只显示榜单，不恢复首页主体。
  showRankModal(rankOnly = false, event?: EventTouch) {
    if (event) {
      event.propagationStopped = true
    }
    if (!this.rankMaskNode || !this.rankPanelNode) {
      return
    }

    this.isRankOnlyMode = rankOnly
    if (rankOnly && this.rootNode) {
      this.rootNode.active = true
      this.bringNodeToTop(this.rootNode)
      const rootOpacity = this.rootNode.getComponent(UIOpacity) ?? this.rootNode.addComponent(UIOpacity)
      rootOpacity.opacity = 255
      const background = this.backgroundNode
      if (background) {
        background.active = false
      }
      if (this.pageCardNode) {
        this.pageCardNode.active = false
      }
    }
    this.refreshRankMaskStyle()

    const opacity = this.rankMaskNode.getComponent(UIOpacity) ?? this.rankMaskNode.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)
    Tween.stopAllByTarget(this.rankPanelNode)
    this.leaderboardController?.prepareForShow()
    opacity.opacity = 0
    this.rankMaskNode.active = true
    this.rankPanelNode.setScale(this.getRankPanelScale(0.94))
    tween(opacity).to(0.14, { opacity: 255 }).start()
    tween(this.rankPanelNode)
      .to(0.18, { scale: this.getRankPanelScale() }, { easing: 'backOut' })
      .start()
  }

  onDestroy() {
    this.unscheduleAllCallbacks()
    this.unbindPressableButton(this.startButtonNode, this.handleStartTap)
    this.unbindPressableButton(this.rankButtonNode, this.handleRankTap)
    this.unbindPressableButton(this.shareButtonNode, this.handleShareTap)
    this.unbindPressableButton(this.settingsButtonNode, this.handleSettingsTap)
    this.unbindPressableButton(this.dailyRewardButtonNode, this.handleDailyRewardTap)
    this.unbindPressableButton(this.shopButtonNode, this.handleShopTap)
    this.unbindPressableButton(this.coinResourceButtonNode, this.handleCoinResourceTap)
    this.unbindPressableButton(this.staminaResourceButtonNode, this.handleEnergyMoreTap)
    this.unbindAmountBar(this.energyMoreButtonNode, this.handleEnergyMoreTap)
    this.safeOff(this.rankCloseButtonNode, Node.EventType.TOUCH_END, this.handleRankCloseTap)
    this.safeOff(this.rankMaskNode, Node.EventType.TOUCH_END, this.hideRankModal)
    this.safeOff(this.toastNode, Node.EventType.TOUCH_END, this.consumeTouch)
    this.stopPageTweens()
    if (this.tipOpacity) {
      Tween.stopAllByTarget(this.tipOpacity)
    }
  }

  private ensurePage() {
    if (this.rootNode) {
      return
    }

    const hierarchyRoot = this.resolveHierarchyRoot()
    if (hierarchyRoot) {
      this.bindHierarchyPage(hierarchyRoot)
      this.ensureHierarchyFallbackNodes()
      this.ensureHierarchyDynamicEffects()
      this.bindPageInteractions()
      this.startTipRotation()
      return
    }

    this.buildRuntimeFallbackPage()
    this.bindPageInteractions()
    this.startTipRotation()
  }

  // 首页场景优先使用层级管理器中的节点，便于后续直接在 Creator 里调整 UI 样式。
  private resolveHierarchyRoot() {
    if (this.rootNodeRef) {
      return this.rootNodeRef
    }

    if (this.node.name === 'StartPageOverlay') {
      return this.node
    }

    return this.node.getChildByName('StartPageOverlay')
  }

  // 绑定已有首页节点时只缓存引用，不主动重建视觉层级。
  private bindHierarchyPage(root: Node) {
    this.usesHierarchyNodes = true
    this.rootNode = root
    this.rootNode.getComponent(UITransform) ?? this.rootNode.addComponent(UITransform)
    this.rootNode.getComponent(UIOpacity) ?? this.rootNode.addComponent(UIOpacity)
    this.backgroundNode = this.backgroundNodeRef ?? this.findChildDeep(root, 'Background')
    this.backgroundImageNode = this.backgroundImageNodeRef ?? this.findChildDeep(root, 'BackgroundImage')
    this.pageCardNode = this.pageCardNodeRef ?? this.findChildDeep(root, 'PageCard')
    this.startButtonNode = this.startButtonNodeRef ?? this.findChildDeep(root, 'StartButton')
    this.rankButtonNode = this.rankButtonNodeRef ?? this.findChildDeep(root, 'RankButton')
    this.settingsButtonNode = this.settingsButtonNodeRef ?? this.findChildDeep(root, 'SettingsButton')
    this.shareButtonNode = this.shareButtonNodeRef ?? this.findChildDeep(root, 'ShareButton')
    this.rankMaskNode = this.rankMaskNodeRef ?? this.findChildDeep(root, 'RankMask')
    this.rankPanelNode = this.rankPanelNodeRef ?? (this.rankMaskNode ? this.findChildDeep(this.rankMaskNode, 'RankPanel') : this.findChildDeep(root, 'RankPanel'))
    this.rankCloseButtonNode = this.rankPanelNode ? this.findChildDeep(this.rankPanelNode, 'CloseButton') : this.findChildDeep(root, 'CloseButton')
    this.toastNode = this.toastNodeRef ?? this.findChildDeep(root, 'Toast')
    const tipNode = this.tipTextNodeRef ?? this.findChildDeep(root, 'TipText')
    this.tipLabel = tipNode?.getComponent(Label) ?? tipNode?.getChildByName('Label')?.getComponent(Label) ?? null
    this.tipOpacity = tipNode?.getComponent(UIOpacity) ?? tipNode?.addComponent(UIOpacity) ?? null
    if (this.tipLabel && !this.tipLabel.string) {
      this.tipLabel.string = this.pickNextTip()
    }
    this.toastOpacity = this.toastNode?.getComponent(UIOpacity) ?? this.toastNode?.addComponent(UIOpacity) ?? null
    this.pageDecorNodes = ['DecorLeft', 'DecorRight']
      .map((name) => this.findChildDeep(root, name))
      .filter((node): node is Node => !!node)
  }

  // 层级节点不完整时只补功能必需节点，避免因为少拖一个节点导致首页无法进入游戏。
  private ensureHierarchyFallbackNodes() {
    if (!this.rootNode) {
      return
    }

    // 新版首页已经静态放入场景时，不再补建旧版背景和提示节点，避免首帧出现两套首页。
    const hasDesignedHomepage = !!this.pageCardNode?.getChildByName('HomepageArtwork')
    if (!hasDesignedHomepage && !this.backgroundNode) {
      this.backgroundNode = new Node('Background')
      this.backgroundNode.setParent(this.rootNode)
      this.backgroundNode.addComponent(UITransform)
      this.backgroundNode.addComponent(Graphics)
    }
    if (!hasDesignedHomepage && !this.backgroundImageNode && this.backgroundNode) {
      this.backgroundImageNode = new Node('BackgroundImage')
      this.backgroundImageNode.setParent(this.backgroundNode)
      this.backgroundImageNode.addComponent(UITransform)
      this.backgroundImageNode.addComponent(Sprite)
    }
    if (!this.pageCardNode) {
      this.pageCardNode = new Node('PageCard')
      this.pageCardNode.setParent(this.rootNode)
      this.pageCardNode.addComponent(UITransform)
      this.pageCardNode.addComponent(Graphics)
    }
    if (!this.startButtonNode && this.pageCardNode) {
      this.startButtonNode = this.createStartButton(this.pageCardNode)
    }
    if (!this.rankButtonNode || !this.shareButtonNode) {
      this.ensureFallbackActionButtons()
    }
    if (!this.rankMaskNode) {
      this.buildRankModal(this.rootNode)
    }
    if (!this.toastNode) {
      this.buildToast(this.rootNode)
    }
    if (!hasDesignedHomepage && !this.tipLabel && this.pageCardNode) {
      this.buildTipText(this.pageCardNode)
    }
  }

  // 首页静态视觉由 home.scene 层级维护，这里只补充需要运行时 tween 的动效节点。
  private ensureHierarchyDynamicEffects() {
    if (!this.usesHierarchyNodes || !this.pageCardNode) {
      return
    }

    this.ensureDesignedHomepage()
  }

  /**
   * 首页定稿由独立的 HomepageArtwork 层承载，旧 Logo、ActionBar 和提示文字只关闭显示，
   * 不删除 Scene 节点，方便排行榜弹窗继续复用历史结构，也避免破坏序列化引用。
   */
  private ensureDesignedHomepage() {
    if (!this.pageCardNode) {
      return
    }

    for (const name of ['Logo', 'TitleCard', 'TileRow', 'ActionBar', 'TipText']) {
      const legacyNode = this.pageCardNode.getChildByName(name)
      if (legacyNode) {
        legacyNode.active = false
      }
    }
    const legacyGraphics = this.pageCardNode.getComponent(Graphics)
    if (legacyGraphics) {
      legacyGraphics.clear()
    }

    this.homepageLayerNode = this.getOrCreatePageNode(this.pageCardNode, 'HomepageArtwork')
    this.homepageLayerNode.active = true
    ;(this.homepageLayerNode.getComponent(UITransform) ?? this.homepageLayerNode.addComponent(UITransform)).setContentSize(
      HOMEPAGE_DESIGN_WIDTH,
      HOMEPAGE_DESIGN_HEIGHT
    )

    const background = this.getOrCreatePageNode(this.homepageLayerNode, 'HomepageBackground')
    background.setSiblingIndex(0)
    this.applyHomepageArtwork(background, HomepageArtwork.background, 750, 1625)
    this.ensureHomepageSwing(background)

    const logo = this.getOrCreatePageNode(this.homepageLayerNode, 'HomepageLogo')
    this.applyHomepageArtwork(logo, HomepageArtwork.logo, 560, 318)

    this.settingsButtonNode = this.getOrCreatePageNode(this.homepageLayerNode, 'SettingsButton')
    this.applyHomepageArtwork(this.settingsButtonNode, HomepageArtwork.settings, 76, 79)
    this.coinResourceButtonNode = this.ensureResourceBar(
      this.homepageLayerNode,
      'CoinResource',
      HomepageArtwork.coin,
      false
    )
    this.staminaResourceButtonNode = this.ensureResourceBar(
      this.homepageLayerNode,
      'StaminaResource',
      HomepageArtwork.stamina,
      true
    )

    this.dailyRewardButtonNode = this.ensureHomepageButton(
      this.homepageLayerNode,
      'DailyRewardButton',
      HomepageArtwork.daily,
      142,
      128
    )
    this.rankButtonNode = this.ensureHomepageButton(
      this.homepageLayerNode,
      'RankButton',
      HomepageArtwork.leaderboard,
      142,
      140
    )
    this.shopButtonNode = this.ensureHomepageButton(
      this.homepageLayerNode,
      'ShopButton',
      HomepageArtwork.shop,
      142,
      134
    )
    this.shareButtonNode = this.ensureHomepageButton(
      this.homepageLayerNode,
      'ShareButton',
      HomepageArtwork.share,
      142,
      138
    )
    this.startButtonNode = this.ensureHomepageButton(
      this.homepageLayerNode,
      'StartButton',
      HomepageArtwork.start,
      360,
      128
    )
    this.startHierarchyStartButtonBreathing()
    this.layoutHomepageArtwork(HOMEPAGE_DESIGN_WIDTH, HOMEPAGE_DESIGN_HEIGHT)
  }

  private ensureHomepageButton(
    parent: Node,
    name: string,
    artwork: string,
    width: number,
    height: number
  ) {
    const button = this.getOrCreatePageNode(parent, name)
    button.active = true
    this.applyHomepageArtwork(button, artwork, width, height)
    return button
  }

  private ensureResourceBar(parent: Node, name: string, artwork: string, stamina: boolean) {
    const bar = this.getOrCreatePageNode(parent, name)
    bar.active = true
    this.applyHomepageArtwork(bar, artwork, 188, stamina ? 60 : 54)

    // 资源条素材保留了定稿中的示例数字，运行时先用同色小底板盖住，再渲染真实数据。
    // 这样不需要再复制一套只差数字的位图，也不会出现动态数字与“1280 / 8/10”叠字。
    const valueCover = this.getOrCreatePageNode(bar, 'DynamicValueCover')
    valueCover.setPosition(0, stamina ? 0 : 1, 0)
    valueCover.getComponent(UITransform)?.setContentSize(76, stamina ? 42 : 38)
    const coverGraphics = valueCover.getComponent(Graphics) ?? valueCover.addComponent(Graphics)
    coverGraphics.clear()
    coverGraphics.fillColor = stamina
      ? new Color(249, 226, 186, 255)
      : new Color(248, 230, 197, 255)
    coverGraphics.roundRect(-38, stamina ? -21 : -19, 76, stamina ? 42 : 38, 10)
    coverGraphics.fill()

    const value = this.ensureHomepageValueLabel(bar, 'DynamicValue', stamina ? `0/${DEFAULT_MAX_ENERGY}` : '0')
    value.node.setPosition(0, stamina ? 0 : 1, 0)
    value.node.getComponent(UITransform)?.setContentSize(76, 42)
    if (stamina) {
      this.staminaValueLabel = value
    } else {
      this.coinValueLabel = value
    }
    return bar
  }

  private ensureHomepageValueLabel(parent: Node, name: string, text: string) {
    const node = this.getOrCreatePageNode(parent, name)
    node.active = true
    const label = node.getComponent(Label) ?? node.addComponent(Label)
    label.string = text
    label.fontSize = 25
    label.lineHeight = 32
    label.isBold = true
    label.overflow = Label.Overflow.SHRINK
    label.color = new Color(88, 46, 27, 255)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    return label
  }

  private applyHomepageArtwork(node: Node, artwork: string, width: number, height: number) {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.enabled = true
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.trim = false
    sprite.color = Color.WHITE

    // 场景中已经绑定的新版素材可直接参与首帧渲染，不再重复走异步 resources.load。
    if (sprite.spriteFrame) {
      return
    }

    resources.load(`${HOMEPAGE_ART_ROOT}${artwork}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !this.canUseNode(node)) {
        console.warn(`[首页] 素材加载失败: ${artwork}`, error)
        return
      }
      sprite.spriteFrame = spriteFrame
      transform.setContentSize(width, height)
    })
  }

  private getOrCreatePageNode(parent: Node, name: string) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
    }
    return node
  }

  /**
   * 秋千动画作为背景子层创建，背景执行 cover 缩放时挂点与活动素材保持同一坐标系。
   * 动画组件只接收节点引用，不处理首页按钮、经济数据或页面跳转。
   */
  private ensureHomepageSwing(background: Node) {
    const swingLayer = this.getOrCreatePageNode(background, 'SwingAnimation')
    swingLayer.active = true
    swingLayer.setPosition(0, 0, 0)
    ;(swingLayer.getComponent(UITransform) ?? swingLayer.addComponent(UITransform)).setContentSize(
      HOMEPAGE_DESIGN_WIDTH,
      HOMEPAGE_DESIGN_HEIGHT
    )

    const leftRope = this.getOrCreatePageNode(swingLayer, 'LeftRope')
    this.applyHomepageArtwork(leftRope, HomepageArtwork.swingRope, 14, 335)
    const rightRope = this.getOrCreatePageNode(swingLayer, 'RightRope')
    this.applyHomepageArtwork(rightRope, HomepageArtwork.swingRope, 14, 335)

    const seatRoot = this.getOrCreatePageNode(swingLayer, 'SwingSeatRoot')
    ;(seatRoot.getComponent(UITransform) ?? seatRoot.addComponent(UITransform)).setContentSize(260, 230)
    const seat = this.getOrCreatePageNode(seatRoot, 'Seat')
    this.applyHomepageArtwork(seat, HomepageArtwork.swingSeat, 250, 88)
    seat.setPosition(0, 0, 0)

    const leftKnot = this.getOrCreatePageNode(seatRoot, 'LeftKnot')
    this.applyHomepageArtwork(leftKnot, HomepageArtwork.swingKnot, 36, 48)
    leftKnot.setPosition(-102, 28, 0)
    const rightKnot = this.getOrCreatePageNode(seatRoot, 'RightKnot')
    this.applyHomepageArtwork(rightKnot, HomepageArtwork.swingKnot, 36, 48)
    rightKnot.setPosition(102, 28, 0)

    const bird = this.getOrCreatePageNode(seatRoot, 'SwingBird')
    this.applyHomepageArtwork(bird, HomepageArtwork.swingBird, 176, 176)
    bird.setPosition(0, 88, 0)

    const leaves = Array.from({ length: 3 }, (_, index) => {
      const leaf = this.getOrCreatePageNode(swingLayer, `FloatingLeaf${index + 1}`)
      this.applyHomepageArtwork(leaf, HomepageArtwork.swingLeaf, 54, 54)
      return leaf
    })

    leftRope.setSiblingIndex(0)
    rightRope.setSiblingIndex(1)
    seatRoot.setSiblingIndex(2)
    leaves.forEach((leaf, index) => leaf.setSiblingIndex(3 + index))

    const animator = swingLayer.getComponent(HomeSwingAnimator) ?? swingLayer.addComponent(HomeSwingAnimator)
    animator.setup({ leftRope, rightRope, seatRoot, bird, leaves })
  }

  /**
   * 定稿坐标以 750 × 1625 为基准：横向按画布宽度等比缩放，短屏压缩纵向间距；
   * 背景独立使用 cover 铺满实际画布，前景素材本身始终保持比例、不做拉伸。
   */
  private layoutHomepageArtwork(cardWidth: number, cardHeight: number) {
    if (!this.homepageLayerNode) {
      return
    }
    // 横向始终贴合设计宽度；短屏只压缩元素间的纵向距离，不把整套 UI 等比缩小到画面中央。
    // 这样 750 × 1335 预览里设置按钮仍贴近左上角，左右功能按钮也不会向中间收拢。
    const foregroundScale = cardWidth / HOMEPAGE_DESIGN_WIDTH
    const verticalScale = Math.min(1, cardHeight / Math.max(1, HOMEPAGE_DESIGN_HEIGHT * foregroundScale))
    this.homepageLayerNode.setPosition(0, 0, 0)
    this.homepageLayerNode.setScale(foregroundScale, foregroundScale, 1)

    const background = this.homepageLayerNode.getChildByName('HomepageBackground')
    const coverScale = Math.max(cardWidth / 750, cardHeight / 1625) / Math.max(0.001, foregroundScale)
    background?.setPosition(0, 0, 0)
    background?.setScale(coverScale, coverScale, 1)

    this.homepageLayerNode.getChildByName('HomepageLogo')?.setPosition(0, 455 * verticalScale, 0)
    this.settingsButtonNode?.setPosition(-318, 705 * verticalScale, 0)
    this.coinResourceButtonNode?.setPosition(-164, 705 * verticalScale, 0)
    this.staminaResourceButtonNode?.setPosition(90, 705 * verticalScale, 0)
    this.dailyRewardButtonNode?.setPosition(-294, -292 * verticalScale, 0)
    this.rankButtonNode?.setPosition(-294, -455 * verticalScale, 0)
    this.shopButtonNode?.setPosition(294, -292 * verticalScale, 0)
    this.shareButtonNode?.setPosition(294, -455 * verticalScale, 0)
    this.startButtonNode?.setPosition(0, -655 * verticalScale, 0)
    this.renderPlayerResources(this.currentEnergy, this.currentMaxEnergy, this.currentCoins)
  }

  /**
   * 把体力 Prefab 挂到首页 PageCard 顶部。
   *
   * Prefab 负责内部美术结构，首页控制器只负责整体布局、数值刷新和按钮回调；
   * 重复 setup 时优先复用已有节点，避免热重载产生重复资源条。
   */
  private ensureEnergyBar(energyBarPrefab: Prefab | null) {
    if (!this.pageCardNode) {
      return
    }

    this.energyBarNode = this.pageCardNode.getChildByName('EnergyBar')
    if (!this.energyBarNode && energyBarPrefab) {
      this.energyBarNode = instantiate(energyBarPrefab)
      this.energyBarNode.setParent(this.pageCardNode)
    }
    this.energyHeartNodes = this.energyBarNode
      ? this.collectEnergyHeartNodes()
      : []
    this.ensureEnergyHeartCapacity(this.currentMaxEnergy)
    this.layoutEnergyHearts(this.currentMaxEnergy)
    // 整个体力 Prefab 都是分享入口，加号只是视觉提示。
    this.energyMoreButtonNode = this.energyBarNode

    this.unbindAmountBar(this.energyMoreButtonNode, this.handleEnergyMoreTap)
    this.bindAmountBar(this.energyMoreButtonNode, this.handleEnergyMoreTap)
  }

  private collectEnergyHeartNodes() {
    if (!this.energyBarNode) {
      return []
    }

    return this.energyBarNode.children
      .filter(child => /^Heart\d+$/.test(child.name))
      .sort((a, b) => this.getHeartIndex(a) - this.getHeartIndex(b))
  }

  // 旧版体力条 Prefab 只有 4 颗心；体力上限调到 10 后运行时补齐，不改 Prefab 资源。
  private ensureEnergyHeartCapacity(maxEnergy: number) {
    if (!this.energyBarNode) {
      return
    }

    const hearts = this.collectEnergyHeartNodes()
    const template = hearts[hearts.length - 1]
    if (!template) {
      this.energyHeartNodes = []
      return
    }

    for (let index = hearts.length + 1; index <= maxEnergy; index++) {
      const heart = instantiate(template)
      heart.name = `Heart${index}`
      heart.setParent(this.energyBarNode)
      hearts.push(heart)
    }
    this.energyHeartNodes = hearts
  }

  private layoutEnergyHearts(maxEnergy: number) {
    if (this.energyHeartNodes.length <= 0) {
      return
    }

    const count = Math.max(1, Math.min(maxEnergy, this.energyHeartNodes.length))
    const step = count <= 1 ? 0 : (ENERGY_HEART_RIGHT_X - ENERGY_HEART_LEFT_X) / (count - 1)
    const scale = count > 4 ? Math.max(0.58, Math.min(1, 4 / count + 0.25)) : 1
    this.energyHeartNodes.forEach((heartNode, index) => {
      if (index >= maxEnergy) {
        heartNode.active = false
        return
      }

      const x = count <= 1 ? 0 : ENERGY_HEART_LEFT_X + step * index
      heartNode.setPosition(x, ENERGY_HEART_Y, 0)
      heartNode.setScale(scale, scale, 1)
    })
  }

  private getHeartIndex(node: Node) {
    const match = node.name.match(/^Heart(\d+)$/)
    return match ? Number(match[1]) : 0
  }

  /**
   * 布局首页体力条并与微信原生胶囊水平对齐。
   *
   * Web 和编辑器沿用设计稿顶部间距；微信端把胶囊中心换算到 Cocos 画布，
   * 体力条放在左侧并共享同一条水平中线，不与右侧原生胶囊重叠。
   */
  private layoutAmountBars(cardHeight: number) {
    const menuMetrics = this.getWechatMenuMetrics()
    const amountBarHalfHeight = AMOUNT_BAR_SOURCE_HEIGHT * AMOUNT_BAR_SCALE * 0.5
    let centerTopInset = AMOUNT_BAR_DEFAULT_TOP_INSET

    if (menuMetrics) {
      const sourceWindowHeight = menuMetrics.windowHeight > 0
        ? menuMetrics.windowHeight
        : screen.windowSize.height
      const heightScale = cardHeight / Math.max(1, sourceWindowHeight)
      const capsuleCenterFromTop =
        Math.max(
          0,
          (menuMetrics.menuRect.top + menuMetrics.menuRect.bottom) * 0.5 - menuMetrics.screenTop
        ) * heightScale
      centerTopInset = Math.min(
        cardHeight - amountBarHalfHeight,
        Math.max(amountBarHalfHeight, capsuleCenterFromTop)
      )
    }

    const y = cardHeight / 2 - centerTopInset
    const cardWidth = this.pageCardNode?.getComponent(UITransform)?.width ?? 750
    const amountBarWidth = this.energyBarNode?.getComponent(UITransform)?.width ?? 466
    const x =
      -cardWidth * 0.5 +
      AMOUNT_BAR_LEFT_INSET +
      amountBarWidth * AMOUNT_BAR_SCALE * 0.5
    this.configureAmountBarNode(this.energyBarNode, x, y)
    this.layoutTitleBelowAmountBars(cardHeight, y, amountBarHalfHeight, !!menuMetrics)
  }

  private configureAmountBarNode(amountBarNode: Node | null, x: number, y: number) {
    if (!amountBarNode) {
      return
    }

    amountBarNode.setPosition(x, y, 0)
    amountBarNode.setScale(AMOUNT_BAR_SCALE, AMOUNT_BAR_SCALE, 1)
  }

  // 微信端资源条下移后给标题腾出固定间距；非微信平台恢复首页原始标题位置。
  private layoutTitleBelowAmountBars(
    cardHeight: number,
    amountBarY: number,
    amountBarHalfHeight: number,
    shouldAvoidCapsule: boolean
  ) {
    const titleCard = this.pageCardNode?.getChildByName('TitleCard') ?? null
    const titleTransform = titleCard?.getComponent(UITransform) ?? null
    if (!titleCard || !titleTransform) {
      return
    }

    const defaultTitleY = cardHeight * 0.31
    const titleY = shouldAvoidCapsule
      ? Math.min(
          defaultTitleY,
          amountBarY - amountBarHalfHeight - AMOUNT_BAR_TITLE_GAP - titleTransform.height * 0.5
        )
      : defaultTitleY
    titleCard.setPosition(titleCard.position.x, titleY, titleCard.position.z)
  }

  // 微信小游戏的胶囊坐标需结合窗口高度和 screenTop，才能正确换算到 Creator 画布。
  private getWechatMenuMetrics(): {
    menuRect: WechatMenuButtonRect
    windowHeight: number
    screenTop: number
  } | null {
    const wxApi = (globalThis as {
      wx?: {
        getMenuButtonBoundingClientRect?: () => WechatMenuButtonRect
        getWindowInfo?: () => WechatWindowInfo
        getSystemInfoSync?: () => WechatWindowInfo
      }
    }).wx
    if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') {
      return null
    }

    const menuRect = wxApi.getMenuButtonBoundingClientRect()
    if (!menuRect || menuRect.width <= 0 || menuRect.height <= 0) {
      return null
    }

    const windowInfo = typeof wxApi.getWindowInfo === 'function'
      ? wxApi.getWindowInfo()
      : typeof wxApi.getSystemInfoSync === 'function'
        ? wxApi.getSystemInfoSync()
        : null

    return {
      menuRect,
      windowHeight: windowInfo?.windowHeight ?? 0,
      screenTop: windowInfo?.screenTop ?? 0
    }
  }

  // 首页旧版 logo 是代码绘制的数字块标题；层级里的图片 logo 只留给加载页使用。
  private ensureHierarchyOldLogo() {
    if (!this.pageCardNode) {
      return
    }

    const imageLogoNode = this.pageCardNode.getChildByName('Logo')
    if (imageLogoNode) {
      imageLogoNode.active = false
    }

    if (!this.pageCardNode.getChildByName('TitleCard')) {
      this.buildTitleCard(this.pageCardNode)
    }
    this.pageCardNode.getChildByName('TitleCard')?.setPosition(0, 414, 0)
  }

  // 旧版开始按钮由 Graphics 绘制，不依赖图片资源，方便保持原来的胶囊按钮观感。
  private ensureHierarchyOldStartButton() {
    if (!this.startButtonNode) {
      return
    }

    const transform = this.startButtonNode.getComponent(UITransform) ?? this.startButtonNode.addComponent(UITransform)
    transform.setContentSize(START_BUTTON_WIDTH, START_BUTTON_HEIGHT)
    this.startButtonNode.setPosition(0, -214, 0)

    const sprite = this.startButtonNode.getComponent(Sprite)
    if (sprite) {
      sprite.enabled = false
    }

    const graphics = this.startButtonNode.getComponent(Graphics) ?? this.startButtonNode.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(105, 54, 90, 72)
    graphics.roundRect(
      -START_BUTTON_WIDTH / 2 + 2,
      -START_BUTTON_HEIGHT / 2 - 8,
      START_BUTTON_WIDTH - 4,
      START_BUTTON_HEIGHT,
      START_BUTTON_HEIGHT / 2
    )
    graphics.fill()
    graphics.fillColor = new Color(255, 70, 115, 255)
    graphics.roundRect(-START_BUTTON_WIDTH / 2, -START_BUTTON_HEIGHT / 2, START_BUTTON_WIDTH, START_BUTTON_HEIGHT, START_BUTTON_HEIGHT / 2)
    graphics.fill()
    graphics.fillColor = new Color(255, 103, 144, 255)
    graphics.roundRect(-START_BUTTON_WIDTH / 2 + 18, 9, START_BUTTON_WIDTH - 36, 20, 10)
    graphics.fill()

    const shadow = this.ensureButtonTextLabel(this.startButtonNode, 'LabelShadow', '开始游戏', 38, new Color(128, 31, 58, 116), new Vec3(0, -4, 0))
    shadow.isBold = true
    const label = this.ensureButtonTextLabel(this.startButtonNode, 'Label', '开始游戏', 38, LIGHT_TEXT, new Vec3(0, 1, 0))
    label.isBold = true
  }

  private ensureButtonTextLabel(parent: Node, name: string, text: string, fontSize: number, color: Color, position: Vec3) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
    }
    node.setPosition(position)
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(START_BUTTON_WIDTH, 58)

    const label = node.getComponent(Label) ?? node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = fontSize + 6
    label.color = color
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    return label
  }

  // 层级中已经摆好的开始按钮只追加呼吸动效，不再由脚本重建按钮节点。
  private startHierarchyStartButtonBreathing() {
    if (!this.startButtonNode) {
      return
    }

    Tween.stopAllByTarget(this.startButtonNode)
    tween(this.startButtonNode)
      .repeatForever(
        tween()
          .sequence(
            tween().to(1.15, { scale: new Vec3(1.025, 1.025, 1) }, { easing: 'sineInOut' }),
            tween().to(1.15, { scale: Vec3.ONE }, { easing: 'sineInOut' })
          )
      )
      .start()
  }

  // 旧场景没有首页节点时保留运行时兜底，方便 Web 预览和资源缺失排查。
  private buildRuntimeFallbackPage() {
    const root = new Node('StartPageOverlay')
    root.setParent(this.node)
    root.addComponent(UITransform)
    root.addComponent(UIOpacity)
    this.rootNode = root

    const background = new Node('Background')
    background.setParent(root)
    background.addComponent(UITransform)
    background.addComponent(Graphics)
    this.backgroundNode = background

    // 首页背景图独立放在子节点上，父节点保留 Graphics 兜底，资源丢失时仍能绘制旧背景。
    const backgroundImage = new Node('BackgroundImage')
    backgroundImage.setParent(background)
    backgroundImage.addComponent(UITransform)
    backgroundImage.addComponent(Sprite)
    this.backgroundImageNode = backgroundImage

    const card = new Node('PageCard')
    card.setParent(root)
    card.addComponent(UITransform)
    card.addComponent(Graphics)
    this.pageCardNode = card

    const decorTopLeft = this.createCircleDecoration(card, 'DecorLeft', 78, GREEN_CIRCLE, 0.88)
    const decorTopRight = this.createCircleDecoration(card, 'DecorRight', 92, YELLOW_COLOR, 0.92)
    this.pageDecorNodes.push(decorTopLeft, decorTopRight)

    this.buildTitleCard(card)
    this.buildFloatingTiles(card)
    this.startButtonNode = this.createStartButton(card)
    this.buildActionButtons(card)
    this.buildTipText(card)
    this.buildRankModal(root)
    this.buildToast(root)
  }

  // 统一绑定首页交互，兼容编辑器节点和运行时兜底节点两种来源。
  private bindPageInteractions() {
    if (this.rootNode) {
      this.bindSwallowTouch(this.rootNode)
    }
    if (this.pageCardNode && this.pageCardNode !== this.rootNode) {
      this.bindSwallowTouch(this.pageCardNode)
    }
    if (this.rankPanelNode) {
      this.bindSwallowTouch(this.rankPanelNode)
    }
    if (this.toastNode) {
      this.safeOff(this.toastNode, Node.EventType.TOUCH_END, this.consumeTouch)
      this.safeOn(this.toastNode, Node.EventType.TOUCH_END, this.consumeTouch)
    }

    this.unbindPressableButton(this.startButtonNode, this.handleStartTap)
    this.unbindPressableButton(this.rankButtonNode, this.handleRankTap)
    this.unbindPressableButton(this.shareButtonNode, this.handleShareTap)
    this.unbindPressableButton(this.settingsButtonNode, this.handleSettingsTap)
    this.unbindPressableButton(this.dailyRewardButtonNode, this.handleDailyRewardTap)
    this.unbindPressableButton(this.shopButtonNode, this.handleShopTap)
    this.unbindPressableButton(this.coinResourceButtonNode, this.handleCoinResourceTap)
    this.unbindPressableButton(this.staminaResourceButtonNode, this.handleEnergyMoreTap)
    this.bindPressableButton(this.startButtonNode, this.handleStartTap)
    this.bindPressableButton(this.rankButtonNode, this.handleRankTap)
    this.bindPressableButton(this.shareButtonNode, this.handleShareTap)
    this.bindPressableButton(this.settingsButtonNode, this.handleSettingsTap)
    this.bindPressableButton(this.dailyRewardButtonNode, this.handleDailyRewardTap)
    this.bindPressableButton(this.shopButtonNode, this.handleShopTap)
    this.bindPressableButton(this.coinResourceButtonNode, this.handleCoinResourceTap)
    this.bindPressableButton(this.staminaResourceButtonNode, this.handleEnergyMoreTap)

    this.safeOff(this.rankCloseButtonNode, Node.EventType.TOUCH_END, this.handleRankCloseTap)
    this.safeOn(this.rankCloseButtonNode, Node.EventType.TOUCH_END, this.handleRankCloseTap)
    this.safeOff(this.rankMaskNode, Node.EventType.TOUCH_END, this.hideRankModal)
    this.safeOn(this.rankMaskNode, Node.EventType.TOUCH_END, this.hideRankModal)
  }

  // 层级里只缺少部分底部按钮时，在已有 ActionBar 下补齐，不覆盖已经摆好的按钮。
  private ensureFallbackActionButtons() {
    if (!this.pageCardNode) {
      return
    }

    let bar = this.pageCardNode.getChildByName('ActionBar')
    if (!bar) {
      bar = new Node('ActionBar')
      bar.setParent(this.pageCardNode)
      bar.addComponent(UITransform).setContentSize(300, 96)
    }

    if (!this.rankButtonNode) {
      this.rankButtonNode = this.createActionIconButton(bar, 'RankButton', this.rankButtonSpriteFrame, '榜')
      this.rankButtonNode.setPosition(-ACTION_ICON_PAIR_OFFSET, 0, 0)
    }
    if (!this.shareButtonNode) {
      this.shareButtonNode = this.createActionIconButton(bar, 'ShareButton', this.shareButtonSpriteFrame, '享')
      this.shareButtonNode.setPosition(ACTION_ICON_PAIR_OFFSET, 0, 0)
    }
    if (!this.homepageLayerNode) {
      this.hideHomeSettingsButton()
    }
  }

  private hideHomeSettingsButton() {
    if (!this.settingsButtonNode) {
      return
    }

    // 首页不再提供设置入口；保留节点引用仅用于兼容旧场景，避免运行时残留可点击热区。
    this.settingsButtonNode.active = false
  }

  private redrawBackground() {
    const background = this.backgroundNode ?? this.rootNode?.getChildByName('Background')
    const backgroundTransform = background?.getComponent(UITransform) ?? null
    const graphics = background?.getComponent(Graphics) ?? null
    const backgroundImage = this.backgroundImageNode ?? background?.getChildByName('BackgroundImage') ?? null
    const backgroundImageTransform = backgroundImage?.getComponent(UITransform) ?? null
    const backgroundImageSprite = backgroundImage?.getComponent(Sprite) ?? null
    const rootTransform = this.rootNode?.getComponent(UITransform) ?? null
    if (!background || !backgroundTransform || !rootTransform) {
      return
    }

    backgroundTransform.setContentSize(rootTransform.width, rootTransform.height)
    if (this.backgroundSpriteFrame && backgroundImage && backgroundImageTransform && backgroundImageSprite) {
      backgroundImage.active = true
      this.fitBackgroundImage(backgroundImageTransform, backgroundImageSprite, rootTransform.width, rootTransform.height)
      return
    }

    if (backgroundImage) {
      backgroundImage.active = false
    }

    if (!graphics) {
      return
    }

    // 未绑定图片时保留旧的低亮点阵背景，避免开发期或资源缺失时首页空白。
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

  /**
   * 按 cover 规则铺满首页背景图。
   *
   * World_3_BG 是竖版大图，直接拉伸会在 Web 横屏预览时变形；这里使用较大的缩放比，
   * 让图片始终保持原始比例并覆盖完整屏幕，多出的部分交给画布边界裁掉。
   */
  private fitBackgroundImage(backgroundTransform: UITransform, sprite: Sprite, screenWidth: number, screenHeight: number) {
    const imageSize = this.backgroundSpriteFrame?.originalSize
    const imageWidth = imageSize?.width ?? screenWidth
    const imageHeight = imageSize?.height ?? screenHeight
    const scale = Math.max(screenWidth / imageWidth, screenHeight / imageHeight)

    backgroundTransform.setContentSize(Math.ceil(imageWidth * scale), Math.ceil(imageHeight * scale))
    sprite.spriteFrame = this.backgroundSpriteFrame
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.color = new Color(255, 255, 255, 255)
    sprite.enabled = true
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
    this.pageCardNode.getChildByName('TileRow')?.setPosition(0, cardHeight * 0.08, 0)
    this.pageDecorNodes[0]?.setPosition(-cardWidth * 0.33, cardHeight * 0.34, 0)
    this.pageDecorNodes[1]?.setPosition(cardWidth * 0.28, cardHeight * 0.39, 0)
    this.startButtonNode?.setPosition(0, -cardHeight * 0.15, 0)
    this.pageCardNode.getChildByName('ActionBar')?.setPosition(0, -cardHeight * 0.31, 0)
    this.pageCardNode.getChildByName('TipText')?.setPosition(0, -cardHeight * 0.42, 0)
  }

  private buildTitleCard(parent: Node) {
    const card = new Node('TitleCard')
    card.setParent(parent)
    card.addComponent(UITransform).setContentSize(560, 236)
    const graphics = card.addComponent(Graphics)
    graphics.fillColor = new Color(60, 94, 126, 38)
    graphics.roundRect(-246, -96, 492, 170, 42)
    graphics.fill()
    graphics.fillColor = new Color(255, 255, 255, 106)
    graphics.roundRect(-230, -84, 460, 164, 40)
    graphics.fill()
    graphics.fillColor = new Color(255, 247, 219, 226)
    graphics.roundRect(-124, -102, 248, 52, 26)
    graphics.fill()

    this.createTitleAccent(card, 'TitleLeaf', -220, 66, 34, new Color(176, 223, 150, 116))
    this.createTitleAccent(card, 'TitleSun', 220, 70, 42, new Color(246, 231, 153, 118))
    this.createTitleAccent(card, 'TitleDotLeft', -178, -56, 8, new Color(MINT_COLOR.r, MINT_COLOR.g, MINT_COLOR.b, 170))
    this.createTitleAccent(card, 'TitleDotRight', 178, -56, 8, new Color(BLUE_COLOR.r, BLUE_COLOR.g, BLUE_COLOR.b, 168))

    // 标题改为四颗数字块，呼应玩法里的数字合成，同时比单行字标更有首页记忆点。
    this.createTitleDigit(card, '1', -156, 18, new Color(255, 105, 151, 255))
    this.createTitleDigit(card, '0', -52, 26, new Color(255, 172, 84, 255))
    this.createTitleDigit(card, '2', 52, 18, new Color(68, 194, 222, 255))
    this.createTitleDigit(card, '4', 156, 26, new Color(103, 205, 116, 255))

    const subtitle = this.createCapsule(card, 'SubtitleBadge', '数字花园', 0, -76, 214, 42, new Color(255, 247, 219, 0), new Color(164, 78, 72, 255))
    subtitle.fontSize = 25
    subtitle.lineHeight = 32
    subtitle.isBold = true
  }

  private createTitleDigit(parent: Node, text: string, x: number, y: number, color: Color) {
    const node = new Node(`TitleDigit${text}`)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(92, 104)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = new Color(50, 88, 102, 50)
    graphics.roundRect(-46, -58, 92, 104, 22)
    graphics.fill()
    graphics.fillColor = color
    graphics.roundRect(-46, -48, 92, 104, 22)
    graphics.fill()
    graphics.lineWidth = 4
    graphics.strokeColor = new Color(255, 255, 255, 150)
    graphics.roundRect(-42, -44, 84, 96, 19)
    graphics.stroke()

    const label = this.createLabel(node, 'Value', text, 60, LIGHT_TEXT, new Vec3(0, 4, 0))
    label.isBold = true
    label.lineHeight = 66
    label.node.getComponent(UITransform)?.setContentSize(92, 86)
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

  private createStartButton(parent: Node) {
    const buttonNode = new Node('StartButton')
    buttonNode.setParent(parent)
    buttonNode.addComponent(UITransform).setContentSize(START_BUTTON_WIDTH, START_BUTTON_HEIGHT)
    buttonNode.addComponent(UIOpacity)

    // 开始按钮使用纯文字胶囊样式，不放图标，避免主入口和底部图片按钮抢视觉层级。
    const graphics = buttonNode.addComponent(Graphics)
    graphics.fillColor = new Color(105, 54, 90, 72)
    graphics.roundRect(
      -START_BUTTON_WIDTH / 2 + 2,
      -START_BUTTON_HEIGHT / 2 - 8,
      START_BUTTON_WIDTH - 4,
      START_BUTTON_HEIGHT,
      START_BUTTON_HEIGHT / 2
    )
    graphics.fill()
    graphics.fillColor = new Color(255, 70, 115, 255)
    graphics.roundRect(-START_BUTTON_WIDTH / 2, -START_BUTTON_HEIGHT / 2, START_BUTTON_WIDTH, START_BUTTON_HEIGHT, START_BUTTON_HEIGHT / 2)
    graphics.fill()
    graphics.fillColor = new Color(255, 103, 144, 255)
    graphics.roundRect(-START_BUTTON_WIDTH / 2 + 18, 9, START_BUTTON_WIDTH - 36, 20, 10)
    graphics.fill()

    const shadow = this.createLabel(buttonNode, 'LabelShadow', '开始游戏', 38, new Color(128, 31, 58, 116), new Vec3(0, -4, 0))
    shadow.isBold = true
    shadow.node.getComponent(UITransform)?.setContentSize(START_BUTTON_WIDTH, 58)

    const label = this.createLabel(buttonNode, 'Label', '开始游戏', 38, LIGHT_TEXT, new Vec3(0, 1, 0))
    label.isBold = true
    label.node.getComponent(UITransform)?.setContentSize(START_BUTTON_WIDTH, 58)

    tween(buttonNode)
      .repeatForever(
        tween()
          .sequence(
            tween().to(1.15, { scale: new Vec3(1.025, 1.025, 1) }, { easing: 'sineInOut' }),
            tween().to(1.15, { scale: Vec3.ONE }, { easing: 'sineInOut' })
          )
      )
      .start()
    return buttonNode
  }

  private buildActionButtons(parent: Node) {
    const bar = new Node('ActionBar')
    bar.setParent(parent)
    bar.addComponent(UITransform).setContentSize(300, 96)

    // 底部入口统一使用现成图片资源，减少文字按钮造成的视觉重量。
    this.rankButtonNode = this.createActionIconButton(bar, 'RankButton', this.rankButtonSpriteFrame, '榜')
    this.shareButtonNode = this.createActionIconButton(bar, 'ShareButton', this.shareButtonSpriteFrame, '享')
    this.rankButtonNode.setPosition(-ACTION_ICON_PAIR_OFFSET, 0, 0)
    this.shareButtonNode.setPosition(ACTION_ICON_PAIR_OFFSET, 0, 0)
  }

  private createActionIconButton(parent: Node, name: string, spriteFrame: SpriteFrame | null, fallbackText: string) {
    const buttonNode = new Node(name)
    buttonNode.setParent(parent)
    const transform = buttonNode.addComponent(UITransform)
    transform.setContentSize(ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT)
    buttonNode.addComponent(UIOpacity)

    if (spriteFrame) {
      const sprite = buttonNode.addComponent(Sprite)
      sprite.type = Sprite.Type.SIMPLE
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.spriteFrame = spriteFrame
      // 设置 SpriteFrame 后再同步一次尺寸，避免 Sprite 按原图尺寸覆盖图标按钮大小。
      transform.setContentSize(ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT)
    } else {
      // 图标资源缺失时给一个简化占位，避免按钮热区存在但没有可见内容。
      const graphics = buttonNode.addComponent(Graphics)
      graphics.fillColor = new Color(255, 93, 135, 235)
      graphics.roundRect(-ACTION_ICON_WIDTH / 2, -ACTION_ICON_HEIGHT / 2, ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT, 30)
      graphics.fill()
      const label = this.createLabel(buttonNode, 'FallbackLabel', fallbackText, 30, LIGHT_TEXT, Vec3.ZERO)
      label.isBold = true
      label.node.getComponent(UITransform)?.setContentSize(ACTION_ICON_WIDTH, ACTION_ICON_HEIGHT)
    }

    return buttonNode
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
    panel.addComponent(UITransform).setContentSize(720, 1240)
    this.bindSwallowTouch(panel)
    this.rankPanelNode = panel

    const leaderboard = panel.addComponent(LeaderboardPopupController)
    this.leaderboardController = leaderboard
    leaderboard.setup({
      onClose: () => this.hideRankModal(),
      onInvite: () => this.showToast('邀请好友功能暂未接入'),
      onButtonClick: () => this.playButtonClickFeedback()
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
    if (!maskTransform) {
      return
    }

    maskTransform.setContentSize(width, height)
    this.refreshRankMaskStyle()

    if (!panelTransform) {
      return
    }
    this.rankPanelLayoutScale = Math.min(
      1,
      Math.max(0.54, (width - 18) / Math.max(1, panelTransform.width)),
      Math.max(0.54, (height - 18) / Math.max(1, panelTransform.height))
    )
    this.rankPanelNode.setPosition(0, 0, 0)
    this.rankPanelNode.setScale(this.getRankPanelScale())
  }

  private getRankPanelScale(multiplier = 1) {
    const scale = this.rankPanelLayoutScale * multiplier
    return new Vec3(scale, scale, 1)
  }

  // 排行榜遮罩根据打开来源切换颜色：首页为浅雾化，暂停页为透明，保留原暂停暗色遮罩。
  private refreshRankMaskStyle() {
    const maskTransform = this.rankMaskNode?.getComponent(UITransform)
    const maskGraphics = this.rankMaskNode?.getComponent(Graphics)
    if (!maskTransform || !maskGraphics) {
      return
    }

    const width = maskTransform.width
    const height = maskTransform.height
    maskGraphics.clear()
    maskGraphics.fillColor = this.isRankOnlyMode ? RANK_MASK_PAUSE_COLOR : RANK_MASK_HOME_COLOR
    maskGraphics.rect(-width / 2, -height / 2, width, height)
    maskGraphics.fill()
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

  // 层级管理器里的节点可能多包了一层容器，这里做递归查找来减少拖引用的硬性要求。
  private findChildDeep(parent: Node, name: string): Node | null {
    const directChild = parent.getChildByName(name)
    if (directChild) {
      return directChild
    }

    for (const child of parent.children) {
      const matched = this.findChildDeep(child, name)
      if (matched) {
        return matched
      }
    }
    return null
  }

  private bindPressableButton(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.on(Node.EventType.TOUCH_START, this.handleButtonPressStart, this)
    node.on(Node.EventType.TOUCH_END, this.handleButtonPressEnd, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.handleButtonPressEnd, this)
    node.on(Node.EventType.TOUCH_END, endHandler, this)
  }

  private unbindPressableButton(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(Node.EventType.TOUCH_START, this.handleButtonPressStart, this)
    node.off(Node.EventType.TOUCH_END, this.handleButtonPressEnd, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.handleButtonPressEnd, this)
    node.off(Node.EventType.TOUCH_END, endHandler, this)
  }

  // 资源条本身已有 0.55 缩放，使用独立按压动画避免复用普通按钮时被恢复成 1 倍。
  private bindAmountBar(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.on(Node.EventType.TOUCH_START, this.handleAmountBarPressStart, this)
    node.on(Node.EventType.TOUCH_END, this.handleAmountBarPressEnd, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.handleAmountBarPressEnd, this)
    node.on(Node.EventType.TOUCH_END, endHandler, this)
  }

  private unbindAmountBar(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(Node.EventType.TOUCH_START, this.handleAmountBarPressStart, this)
    node.off(Node.EventType.TOUCH_END, this.handleAmountBarPressEnd, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.handleAmountBarPressEnd, this)
    node.off(Node.EventType.TOUCH_END, endHandler, this)
  }

  // 切场景时节点可能已经进入销毁流程，解绑前先确认引用仍可安全使用。
  private canUseNode(node: Node | null): node is Node {
    return !!node && node.isValid
  }

  private safeOff(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(eventType, handler, this)
  }

  private safeOn(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.on(eventType, handler, this)
  }

  // setSiblingIndex 依赖节点仍在父节点下；场景切换时先判断，避免触发引擎内部空 parent。
  private bringNodeToTop(node: Node | null) {
    const parent = node?.parent ?? null
    if (!this.canUseNode(node) || !parent?.isValid) {
      return
    }

    node.setSiblingIndex(parent.children.length - 1)
  }

  // 首页离开或销毁时停止所有面板动画，避免 tween 在节点销毁后继续写属性。
  private stopPageTweens() {
    this.stopNodeTreeTweens(this.rootNode)
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

  // 所有首页按钮共用轻微按压反馈，保证图片按钮和开始按钮的交互手感一致。
  private handleButtonPressStart(event: EventTouch) {
    const node = event.currentTarget as Node | null
    if (this.canUseNode(node)) {
      node.setScale(new Vec3(0.94, 0.94, 1))
    }
  }

  private handleButtonPressEnd(event: EventTouch) {
    const node = event.currentTarget as Node | null
    if (this.canUseNode(node)) {
      node.setScale(Vec3.ONE)
    }
    if (event.type === Node.EventType.TOUCH_END) {
      this.playButtonClickFeedback()
    }
  }

  private handleAmountBarPressStart(event: EventTouch) {
    const node = event.currentTarget as Node | null
    if (this.canUseNode(node)) {
      node.setScale(AMOUNT_BAR_SCALE * 0.94, AMOUNT_BAR_SCALE * 0.94, 1)
    }
  }

  private handleAmountBarPressEnd(event: EventTouch) {
    const node = event.currentTarget as Node | null
    if (this.canUseNode(node)) {
      node.setScale(AMOUNT_BAR_SCALE, AMOUNT_BAR_SCALE, 1)
    }
    if (event.type === Node.EventType.TOUCH_END) {
      this.playButtonClickFeedback()
    }
  }

  private handleStartTap(event: EventTouch) {
    event.propagationStopped = true
    this.startHandler?.()
  }

  private handleRankTap(event: EventTouch) {
    event.propagationStopped = true
    // 排行榜数据尚未接入，入口先保留并给出统一提示，后续只需恢复弹窗调用即可。
    this.showToast('敬请期待')
  }

  private handleRankCloseTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.hideRankModal()
  }

  private handleShareTap(event: EventTouch) {
    event.propagationStopped = true
    this.shareHandler?.()
  }

  private handleSettingsTap(event: EventTouch) {
    event.propagationStopped = true
    this.settingsHandler?.()
  }

  private handleDailyRewardTap(event: EventTouch) {
    event.propagationStopped = true
    this.dailyRewardHandler?.()
  }

  private handleShopTap(event: EventTouch) {
    event.propagationStopped = true
    this.shopHandler?.()
  }

  private handleCoinResourceTap(event: EventTouch) {
    event.propagationStopped = true
    this.shopHandler?.()
  }

  private handleEnergyMoreTap(event: EventTouch) {
    event.propagationStopped = true
    this.energyMoreHandler?.()
  }

  private playButtonClickFeedback() {
    this.buttonClickHandler?.()
  }

  private hideRankModal(event?: EventTouch) {
    if (event) {
      event.propagationStopped = true
    }
    if (!this.rankMaskNode) {
      return
    }

    this.leaderboardController?.prepareForHide()
    const opacity = this.rankMaskNode.getComponent(UIOpacity) ?? this.rankMaskNode.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)
    if (this.rankPanelNode) {
      Tween.stopAllByTarget(this.rankPanelNode)
    }
    tween(opacity)
      .to(0.18, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        this.leaderboardController?.hideContent()
        if (this.rankMaskNode) {
          this.rankMaskNode.active = false
        }
        if (this.isRankOnlyMode) {
          // 暂停页借用排行榜后，关闭榜单时要把首页根节点重新隐藏，露出原来的暂停遮罩。
          this.isRankOnlyMode = false
          if (this.rootNode) {
            const background = this.backgroundNode
            if (background) {
              background.active = true
            }
            if (this.pageCardNode) {
              this.pageCardNode.active = true
            }
            this.rootNode.active = false
          }
        }
      })
      .start()
    if (this.rankPanelNode) {
      tween(this.rankPanelNode)
        .to(0.18, { scale: this.getRankPanelScale(0.94) }, { easing: 'quadIn' })
        .start()
    }
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
    if (!this.canUseNode(node)) {
      return
    }

    node.off(Node.EventType.TOUCH_START, this.consumeTouch, this)
    node.off(Node.EventType.TOUCH_MOVE, this.consumeTouch, this)
    node.off(Node.EventType.TOUCH_END, this.consumeTouch, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_START, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_MOVE, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_END, this.consumeTouch, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.consumeTouch, this)
  }
}
