import {
  _decorator,
  assetManager,
  Button,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  Prefab,
  ResolutionPolicy,
  screen,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  view,
  Widget,
  sys
} from 'cc'
import { PauseOverlayController } from './PauseOverlayController'
import { GameOverOverlayController } from './GameOverOverlayController'

const { ccclass } = _decorator

type PlaySkillKind = 'bomb' | 'hammer' | 'swap'

// UI 层只关心界面展示所需的最小状态，不参与棋盘运算和合并逻辑。
export type PlayUIState = {
  currentValue: number | null
  nextValue: number | null
  currentColumn: number
  score: number
  highestValue: number
  gameOverCoinReward: number
  isGameOver: boolean
  isPaused: boolean
  isResolving: boolean
  activeSkill: PlaySkillKind | null
  coins: number
  skillCounts: {
    bomb: number
    hammer: number
    swap: number
  }
  skillUsed: {
    bomb: boolean
    hammer: boolean
    swap: boolean
  }
}

export type PlayUILayout = {
  boardwidth: number
  boardheight: number
  pieceSize: number
  spacing: number
}

// 所有 UI 操作统一通过回调回到玩法层，UI 组件不直接修改棋盘、经济或场景状态。
export type PlayUIActions = {
  pause: () => void
  restart: () => void
  homeFromPause: () => void
  shareFromPause: () => void
  feedbackFromPause: () => void
  useBomb: () => void
  useHammer: () => void
  useSwap: () => void
  homeFromGameOver: () => void
  shareFromGameOver: () => void
  onButtonClick?: () => void
  coinRewardShare: () => void
}

// 资源仍由场景序列化后注入，但在 UI 入口处集中成一个对象，避免继续扩张玩法参数列表。
export type PlayUIResources = {
  coinBarPrefab?: Prefab | null
  counterNumberSpriteFrames?: SpriteFrame[]
  gameOverPopupSpriteFrame?: SpriteFrame | null
  gameOverReplayButtonSpriteFrame?: SpriteFrame | null
  gameOverHomeButtonSpriteFrame?: SpriteFrame | null
  gameOverShareButtonSpriteFrame?: SpriteFrame | null
}

// 只读取胶囊布局会用到的字段，避免在没有微信类型声明时丢失类型约束。
type WechatMenuButtonRect = {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

// 微信环境里还需要读取窗口高度和顶部原生偏移，才能把胶囊坐标稳定换算到 Cocos 坐标系。
type WechatWindowInfo = {
  windowWidth?: number
  windowHeight?: number
  screenTop?: number
}

// 棋盘边框厚度，UI 绘制和棋盘内区布局都会基于这个值计算。
const BOARD_BORDER_WIDTH = 8
// 棋盘内层圆角与棋子圆角保持一致，保证视觉统一。
const BOARD_INNER_RADIUS = 14
// 棋盘外层玻璃阴影色，用很低透明度替代原来的实色边框。
const BOARD_GLASS_SHADOW_COLOR = new Color(75, 55, 32, 18)
// 棋盘主体玻璃蒙版色改成浅青蓝灰，保持冷色调但不过度压暗。
const BOARD_GLASS_TINT_COLOR = new Color(255, 248, 220, 8)
// 棋盘内区玻璃底色只做浅冷雾化，避免变成厚重实色背景。
const BOARD_GLASS_INNER_COLOR = new Color(255, 248, 220, 0)
// 棋盘列的轻量蒙版色，用交替透明块让五列仍然可识别。
const BOARD_COLUMN_TINT_COLOR = new Color(255, 255, 255, 0)
// 棋盘列边缘柔光色，让虚线和玻璃面板看起来是一体的。
const BOARD_COLUMN_EDGE_COLOR = new Color(255, 255, 255, 0)
// 外层圆角由内层圆角叠加边框厚度得到，确保边框厚度视觉一致。
const BOARD_OUTER_RADIUS = BOARD_INNER_RADIUS + BOARD_BORDER_WIDTH
// 列分隔虚线宽度。
const BOARD_DASH_WIDTH = 4
// 单段虚线长度。
const BOARD_DASH_LENGTH = 16
// 虚线段之间的空隙。
const BOARD_DASH_GAP = 12
// 虚线距离棋盘上下边缘的留白。
const BOARD_DASH_INSET = 16
// 虚线圆角半径，让列分隔更柔和。
const BOARD_DASH_RADIUS = 2
// 虚线颜色改成浅冷柔光，配合新的玻璃蒙版而不是原来的实色样式。
const BOARD_DASH_COLOR = new Color(255, 255, 255, 0)
// 技能次数角标的默认位置参考左侧第一个技能的 MoreBtn，也就是无次数时视觉正确的加号位置。
const SKILL_BADGE_FALLBACK_X = -45.529
const SKILL_BADGE_FALLBACK_Y = -40.613
// 角标底图和加号图在 scene 中都是 40x40；只有找不到参考节点时才使用这个默认尺寸。
const SKILL_BADGE_FALLBACK_SIZE = 40
// AmountBG 是数字背后的底盘，不需要和加号一样大；按 40x40 参考尺寸收成约 24x24。
const SKILL_AMOUNT_BG_WIDTH_SCALE = 0.6
const SKILL_AMOUNT_BG_HEIGHT_SCALE = 0.6
// 数字层按 scene 里 Count 小图的视觉尺寸收口，避免有次数时数字显得过大。
const SKILL_COUNT_WIDTH = 10
const SKILL_COUNT_HEIGHT = 20
// 首页和游戏资源条统一缩放，游戏内再根据设置按钮位置单独布局。
const PLAYER_AMOUNT_BAR_SCALE = 0.36
const PLAYER_AMOUNT_BAR_SOURCE_HEIGHT = 155
const PLAYER_AMOUNT_BAR_DEFAULT_TOP_INSET = 92
const PLAYER_AMOUNT_BAR_FALLBACK_X = -190
const PLAYER_AMOUNT_BAR_SETTINGS_GAP = 18
const PLAYER_AMOUNT_BAR_CAPSULE_GAP = 18
// 游戏页以 750×1334 为设计基准，运行时只对安全区做整体补偿。
const GAME_DESIGN_WIDTH = 750
const GAME_DESIGN_HEIGHT = 1334
const GAME_BACKGROUND_SPRITE_FRAME_UUID = '5ad49fb5-9e08-4dc5-9ee9-1451320c9378@f9941'
// 游戏页与首页共用同一枚设置图标，避免两个界面出现不同的齿轮样式。
const GAME_SETTINGS_SPRITE_FRAME_UUID = '84a1f2b0-6d31-4e77-9c42-2b80d1f5100d@f9941'
const SKILL_ICON_SPRITE_FRAME_UUIDS: Record<PlaySkillKind, string> = {
  bomb: 'c2bd34f2-a783-4855-8af8-fa07fe942dc1@f9941',
  hammer: 'a7c0480a-a4dd-46dc-ab94-4c0df29d1bd8@f9941',
  swap: '32927f70-f651-471d-b8a1-7c2bbe5ddc17@f9941'
}
const GAME_BOARD_Y = -60
const GAME_SKILLS_Y = -568
const GAME_SKILLS_WIDTH = 520
const GAME_SKILLS_HEIGHT = 124
const GAME_SKILL_X_POSITIONS = [-145, 0, 145] as const
const HUD_SETTINGS_HIT_SIZE = 76
const HUD_SETTINGS_ICON_SIZE = 64
const HUD_SETTINGS_X = -325
const HUD_SETTINGS_Y = 616
const HUD_MODE_WIDTH = 230
const HUD_MODE_HEIGHT = 64
const HUD_MODE_Y = 615
const HUD_OBJECTIVE_WIDTH = 210
const HUD_OBJECTIVE_HEIGHT = 90
const HUD_OBJECTIVE_Y = 507
const HUD_SCORE_WIDTH = 174
const HUD_SCORE_HEIGHT = 50
const HUD_SCORE_X = 268
const HUD_SCORE_Y = 415
const HUD_NEXT_X = -297
const HUD_NEXT_Y = 400
const HUD_SCORE_BG_COLOR = new Color(255, 250, 230, 238)
const HUD_SCORE_BORDER_COLOR = new Color(91, 61, 35, 235)
const HUD_SCORE_TEXT_COLOR = new Color(81, 55, 37, 255)
const HUD_CARD_BG_COLOR = new Color(255, 250, 234, 246)
const HUD_CARD_BORDER_COLOR = new Color(75, 53, 40, 255)
const HUD_ACCENT_GREEN = new Color(101, 190, 54, 255)
const HUD_ACCENT_BLUE = new Color(74, 183, 205, 255)
// 技能状态层只做轻量描边和标签，不创建独立材质。
const SKILL_SELECTION_COLOR = new Color(255, 242, 142, 245)
const SKILL_DISABLED_OPACITY = 118
const SKILL_EMPTY_OPACITY = 178
const SKILL_CARD_BORDER_COLOR = new Color(75, 53, 40, 255)
const SKILL_CARD_INNER_COLORS: Record<PlaySkillKind, Color> = {
  bomb: new Color(131, 82, 185, 255),
  hammer: new Color(61, 148, 208, 255),
  swap: new Color(255, 190, 53, 255)
}
const SKILL_CARD_LABELS: Record<PlaySkillKind, string> = {
  bomb: '炸弹',
  hammer: '木槌',
  swap: '交换'
}
const SKILL_NODE_NAMES: Record<PlaySkillKind, string> = {
  bomb: 'Skill1',
  hammer: 'Skill2',
  swap: 'Skill3'
}
const SKILL_ICON_NODE_NAMES: Record<PlaySkillKind, string> = {
  bomb: 'BombBtn',
  hammer: 'HammerBtn',
  swap: 'V_RocketBtn'
}
// 新版技能素材是透明图标，不再带旧圆形按钮底座；运行时需要在卡片里放大到主视觉尺寸。
const SKILL_ICON_LAYOUTS: Record<PlaySkillKind, { width: number; height: number; y: number }> = {
  bomb: { width: 72, height: 76, y: 14 },
  hammer: { width: 76, height: 76, y: 14 },
  swap: { width: 78, height: 78, y: 14 }
}

const HUD_PIECE_COLORS: Record<number, Color> = {
  2: new Color(248, 236, 220, 255),
  4: new Color(247, 165, 54, 255),
  8: new Color(255, 194, 46, 255),
  16: new Color(155, 200, 73, 255),
  32: new Color(80, 174, 97, 255),
  64: new Color(53, 161, 165, 255),
  128: new Color(63, 136, 199, 255)
}

@ccclass('PlayUIController')
export class PlayUIController extends Component {
  // 当前棋盘列数，供棋盘绘制和列节点对齐使用。
  private boardwidth = 5
  // 当前棋盘行数，虽然 UI 不直接参与结算，但用于保持绘制配置完整。
  private boardheight = 7
  // 棋子尺寸，主要用于保持 UI 层和逻辑层的棋盘配置一致。
  private pieceSize = 120
  // 格子之间的间距，方便后续继续扩展 UI 布局时保持同一套棋盘参数。
  private spacing = 10
  // 由逻辑层注入的暂停切换回调，按钮点击后只通知逻辑，不直接改游戏状态。
  private pauseHandler: (() => void) | null = null
  // 暂停弹窗重玩按钮只转交给逻辑层处理，不直接清棋盘。
  private pauseReplayHandler: (() => void) | null = null
  // 暂停弹窗回首页按钮只转交给逻辑层处理，不直接切页面。
  private pauseHomeHandler: (() => void) | null = null
  private pauseShareHandler: (() => void) | null = null
  private pauseFeedbackHandler: (() => void) | null = null
  // 第一个技能按钮只通知逻辑层进入炸弹技能，不在 UI 层直接操作棋盘。
  private bombSkillHandler: (() => void) | null = null
  // 第二个技能按钮只通知逻辑层进入锤子技能，不在 UI 层直接操作棋盘。
  private hammerSkillHandler: (() => void) | null = null
  // 第三个技能按钮只通知逻辑层进入交换技能，不在 UI 层直接改棋盘状态。
  private swapSkillHandler: (() => void) | null = null
  // 控制栏在 scene 中配置的基础高度，只记录一次，后续只叠加安全区补偿。
  private controlBarBaseHeight = 0
  // Status/Content 的原始局部坐标需要缓存下来，避免非微信平台也被运行时布局覆盖。
  private statusContentBasePosition: { x: number; y: number; z: number } | null = null
  // Content 的原始尺寸同样要保留，方便切回编辑器默认布局。
  private statusContentBaseSize: { width: number; height: number } | null = null
  // UI 层缓存当前展示状态，便于统一刷新状态栏、按钮和遮罩。
  private currentState: PlayUIState = {
    currentValue: null,
    nextValue: null,
    currentColumn: 2,
    score: 0,
    highestValue: 0,
    gameOverCoinReward: 0,
    isGameOver: false,
    isPaused: false,
    isResolving: false,
    activeSkill: null,
    coins: 0,
    skillCounts: {
      bomb: 1,
      hammer: 1,
      swap: 1
    },
    skillUsed: {
      bomb: false,
      hammer: false,
      swap: false
    }
  }
  // 顶部状态栏文字。
  // private statusLabel: Label | null = null
  // 底部暂停按钮文字。
  private pauseButtonLabel: Label | null = null
  // 分数数值文本直接复用 scene 里的 Score/Number 节点，UI 层只负责刷新显示。
  private scoreNumberLabel: Label | null = null
  private objectiveProgressLabel: Label | null = null
  private nextValueLabel: Label | null = null
  private nextValueTile: Graphics | null = null
  // 当前已经显示到界面的分数，数字滚动动画会从这个值补间到目标值。
  private displayedScore = 0
  // Tween 直接驱动这个简单对象，避免去改节点缩放或位置。
  private readonly scoreTweenState = { value: 0 }
  // 暂停弹窗相关逻辑全部拆到独立组件，这里只保留组件引用和调用入口。
  private pauseOverlayController: PauseOverlayController | null = null
  // 游戏结束弹窗同样交给独立组件，UI 主控只负责转交状态和按钮回调。
  private gameOverOverlayController: GameOverOverlayController | null = null
  // 结算弹窗重玩按钮只通知逻辑层重新开局。
  private gameOverReplayHandler: (() => void) | null = null
  // 结算弹窗分享按钮只通知逻辑层做平台分享适配。
  private gameOverShareHandler: (() => void) | null = null
  // 结算弹窗首页 icon 只通知逻辑层切回首页，不在 UI 层直接改对局状态。
  private gameOverHomeHandler: (() => void) | null = null
  // 缓存第一个技能节点，和其他技能共用选中态与取消提示。
  private bombSkillNode: Node | null = null
  // 缓存第三个技能节点，便于刷新选中态和销毁时解绑事件。
  private swapSkillNode: Node | null = null
  // 缓存第二个技能节点，和第三技能共用同一套技能态表现。
  private hammerSkillNode: Node | null = null
  // 三个技能数量图片由 UI 层统一缓存，具体显示由 Skill/Box 下的节点显隐控制。
  private skillCountSprites: Record<PlaySkillKind, Sprite | null> = {
    bomb: null,
    hammer: null,
    swap: null
  }
  // 技能数量 0-9 图片由 PlayController 传入，按图片名匹配当前数量。
  private counterNumberSpriteFrames: SpriteFrame[] = []
  // 技能施放提示由运行时生成，避免为了一个提示再要求手动维护 scene 节点。
  private skillHintNode: Node | null = null
  // 提示透明度单独缓存，方便做进入、闪烁和退出动画。
  private skillHintOpacity: UIOpacity | null = null
  // 记录提示当前是否显示，避免每帧刷新状态时重复重启动画。
  private isSkillHintVisible = false
  private feedbackLayer: Node | null = null
  private toastNode: Node | null = null
  private toastOpacity: UIOpacity | null = null
  // 游戏场景顶部只显示金币 Prefab，数值由 PlayUIState 单向渲染。
  private coinBarNode: Node | null = null
  private coinAmountLabel: Label | null = null
  private coinMoreHandler: (() => void) | null = null
  private buttonClickHandler: (() => void) | null = null
  // 背景独立于游戏内容节点铺放，避免长屏适配时连棋盘和 HUD 一起缩放。
  private gameBackgroundNode: Node | null = null

  // 由逻辑层在启动时调用，把布局、动作和表现资源分别交给 UI 层管理。
  setup(options: {
    layout: PlayUILayout
    actions: PlayUIActions
    resources?: PlayUIResources
  }) {
    const { layout, actions, resources = {} } = options
    this.boardwidth = layout.boardwidth
    this.boardheight = layout.boardheight
    this.pieceSize = layout.pieceSize
    this.spacing = layout.spacing
    this.pauseHandler = actions.pause
    this.pauseReplayHandler = actions.restart
    this.pauseHomeHandler = actions.homeFromPause
    this.pauseShareHandler = actions.shareFromPause
    this.pauseFeedbackHandler = actions.feedbackFromPause
    this.bombSkillHandler = actions.useBomb
    this.hammerSkillHandler = actions.useHammer
    this.swapSkillHandler = actions.useSwap
    this.gameOverReplayHandler = actions.restart
    this.gameOverHomeHandler = actions.homeFromGameOver
    this.gameOverShareHandler = actions.shareFromGameOver
    this.coinMoreHandler = actions.coinRewardShare
    this.buttonClickHandler = actions.onButtonClick ?? null
    this.counterNumberSpriteFrames = resources.counterNumberSpriteFrames ?? []

    // 竖屏小游戏固定按宽度适配，让 Canvas 覆盖完整窗口；额外高度交给背景和安全区布局吸收。
    view.setDesignResolutionSize(GAME_DESIGN_WIDTH, GAME_DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH)
    this.ensureGameBackground()
    this.fitBackgroundToScreen()
    this.ensureGamePageLayout()
    this.hideCoinBar()
    this.ensureBoardDecorations()
    this.ensureScoreDisplay()
    this.ensureSkillButtons()
    this.ensureFeedbackLayer()
    this.ensureSkillHint()
    this.ensureToast()
    // this.ensureStatusLabel()
    // this.ensurePauseButton()
    this.ensurePauseOverlay()
    this.ensureGameOverOverlay(
      resources.gameOverPopupSpriteFrame ?? null,
      resources.gameOverReplayButtonSpriteFrame ?? null,
      resources.gameOverHomeButtonSpriteFrame ?? null,
      resources.gameOverShareButtonSpriteFrame ?? null
    )
    this.configureControlBar()
    this.configureStatusBar()
    this.updateSkillHintLayout()
    this.renderState(this.currentState)
  }

  // 某些平台启动后一帧安全区才稳定，因此开放一个额外布局入口给逻辑层补收。
  syncLayout() {
    this.fitBackgroundToScreen()
    this.ensureGamePageLayout()
    this.configureControlBar()
    this.configureStatusBar()
    this.updateSkillHintLayout()
    this.pauseOverlayController?.syncLayout()
    this.gameOverOverlayController?.syncLayout()
  }

  // 逻辑层每次状态变化后只需要把结果喂给 UI 层即可。
  renderState(state: PlayUIState) {
    this.currentState = state
    this.refreshScoreDisplay()
    this.refreshObjectiveDisplay()
    this.refreshNextPieceDisplay()
    this.refreshSkillButtonState()
    // this.refreshStatus()
    // this.refreshPauseButton()
    this.pauseOverlayController?.renderState(this.currentState.isPaused)
    this.gameOverOverlayController?.renderState(
      this.currentState.isGameOver,
      this.currentState.score,
      this.currentState.highestValue,
      this.currentState.gameOverCoinReward
    )
  }
  private skillVisualKeys: Record<PlaySkillKind, string> = {
    bomb: '',
    hammer: '',
    swap: ''
  }

  /**
   * 显示由逻辑层传入的一次性提示，例如技能购买结果或体力不足。
   * Toast 与技能模式提示拆开，避免临时消息破坏仍处于激活状态的技能提示。
   */
  showTransientMessage(message: string) {
    if (!this.toastNode || !this.toastOpacity) {
      return
    }

    const label = this.toastNode.getChildByName('Text')?.getComponent(Label) ?? null
    if (!label) {
      return
    }

    Tween.stopAllByTarget(this.toastNode)
    Tween.stopAllByTarget(this.toastOpacity)
    // FeedbackLayer 保持在 OverlayLayer 下方，不能因为一次 Toast 破坏暂停/结算层的输入优先级。
    this.toastNode.active = true
    this.toastNode.setScale(new Vec3(0.96, 0.96, 1))
    this.toastOpacity.opacity = 0
    label.string = message
    tween(this.toastOpacity).to(0.12, { opacity: 255 }, { easing: 'quadOut' }).start()
    tween(this.toastNode).to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start()
    tween(this.toastOpacity)
      .delay(1.5)
      .to(0.16, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        if (this.toastNode) {
          this.toastNode.active = false
        }
      })
      .start()
  }

  onDestroy() {
    // UI 组件自己负责解绑按钮事件，避免逻辑层还要知道具体节点层级。
    const controlContainer = this.canUseNode(this.node) ? this.getControlContainer() : null
    const pauseButtonNode = this.canUseNode(controlContainer) ? controlContainer.getChildByName('PauseButton') : null
    const settingsButtonNode = this.canUseNode(this.node)
      ? this.node
        .getChildByName('Status')
        ?.getChildByName('Content')
        ?.getChildByName('SettingsBtn') ?? null
      : null
    this.safeOff(pauseButtonNode, Node.EventType.TOUCH_END, this.onPauseButtonTap)
    this.safeOff(settingsButtonNode, Node.EventType.TOUCH_END, this.onPauseButtonTap)
    this.safeOff(this.bombSkillNode, Node.EventType.TOUCH_END, this.onBombSkillButtonTap)
    this.safeOff(this.hammerSkillNode, Node.EventType.TOUCH_END, this.onHammerSkillButtonTap)
    this.safeOff(this.swapSkillNode, Node.EventType.TOUCH_END, this.onSwapSkillButtonTap)
    this.unbindCoinBar()
    Tween.stopAllByTarget(this.scoreTweenState)
    if (this.canUseNode(this.skillHintNode)) {
      Tween.stopAllByTarget(this.skillHintNode)
    }
    if (this.skillHintOpacity?.isValid) {
      Tween.stopAllByTarget(this.skillHintOpacity)
    }
    if (this.canUseNode(this.toastNode)) {
      Tween.stopAllByTarget(this.toastNode)
    }
    if (this.toastOpacity?.isValid) {
      Tween.stopAllByTarget(this.toastOpacity)
    }
    if (this.canUseNode(this.bombSkillNode)) {
      Tween.stopAllByTarget(this.bombSkillNode)
    }
    if (this.canUseNode(this.hammerSkillNode)) {
      Tween.stopAllByTarget(this.hammerSkillNode)
    }
    if (this.canUseNode(this.swapSkillNode)) {
      Tween.stopAllByTarget(this.swapSkillNode)
    }
    this.scoreNumberLabel = null
    this.objectiveProgressLabel = null
    this.nextValueLabel = null
    this.nextValueTile = null
    this.bombSkillNode = null
    this.hammerSkillNode = null
    this.swapSkillNode = null
    this.skillCountSprites.bomb = null
    this.skillCountSprites.hammer = null
    this.skillCountSprites.swap = null
    this.skillHintNode = null
    this.skillHintOpacity = null
    this.toastNode = null
    this.toastOpacity = null
    this.feedbackLayer = null
    this.coinBarNode = null
    this.coinAmountLabel = null
    this.gameBackgroundNode = null
    this.pauseOverlayController = null
    this.gameOverOverlayController = null
  }

  // 主内容节点跟随 Canvas；背景独立按 cover 规则等比放大，避免长屏上下露底。
  private fitBackgroundToScreen() {
    const selfTransform = this.node.getComponent(UITransform)
    const parentTransform = this.node.parent?.getComponent(UITransform) ?? null
    if (!selfTransform || !parentTransform) {
      return
    }

    selfTransform.setContentSize(parentTransform.width, parentTransform.height)
    this.node.setPosition(0, 0, 0)

    const background = this.gameBackgroundNode ?? this.node.getChildByName('Background')
    const backgroundTransform = background?.getComponent(UITransform) ?? null
    const backgroundSprite = background?.getComponent(Sprite) ?? null
    if (!background || !backgroundTransform || !backgroundSprite) {
      return
    }

    background.setPosition(0, 0, 0)
    background.setSiblingIndex(0)
    backgroundSprite.enabled = true
    backgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM
    backgroundSprite.type = Sprite.Type.SIMPLE
    backgroundSprite.trim = false
    const imageSize = backgroundSprite.spriteFrame?.originalSize
    const imageWidth = imageSize?.width ?? GAME_DESIGN_WIDTH
    const imageHeight = imageSize?.height ?? GAME_DESIGN_HEIGHT
    const coverScale = Math.max(parentTransform.width / imageWidth, parentTransform.height / imageHeight)
    backgroundTransform.setContentSize(Math.ceil(imageWidth * coverScale), Math.ceil(imageHeight * coverScale))
  }

  /**
   * 强制使用游戏页已压缩的春日草地背景。
   * Scene 中仍保留序列化引用，UUID 加载用于覆盖预览中可能存在的旧场景缓存。
   */
  private ensureGameBackground() {
    const rootSprite = this.node.getComponent(Sprite)
    let background = this.node.getChildByName('Background')
    if (!background) {
      background = new Node('Background')
      background.setParent(this.node)
      background.addComponent(UITransform)
      background.addComponent(Sprite)
    }
    this.gameBackgroundNode = background
    background.setSiblingIndex(0)
    const sprite = background.getComponent(Sprite) ?? background.addComponent(Sprite)
    sprite.spriteFrame = rootSprite?.spriteFrame ?? sprite.spriteFrame
    if (rootSprite) {
      rootSprite.enabled = false
    }

    sprite.enabled = true
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    assetManager.loadAny(GAME_BACKGROUND_SPRITE_FRAME_UUID, (error, asset) => {
      if (error || !this.node.isValid || !(asset instanceof SpriteFrame)) {
        return
      }
      sprite.spriteFrame = asset
      sprite.enabled = true
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.type = Sprite.Type.SIMPLE
      sprite.trim = false
      this.fitBackgroundToScreen()
    })
  }

  /**
   * 把历史场景节点收口到游戏页设计稿的 750×1334 坐标。
   * 仅调整 UI 容器与棋盘节点，棋盘行列、落子和合并规则不变。
   */
  private ensureGamePageLayout() {
    const rootTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const canvasTransform = this.node.parent?.getComponent(UITransform) ?? null
    const viewportWidth = canvasTransform?.width ?? GAME_DESIGN_WIDTH
    const viewportHeight = canvasTransform?.height ?? GAME_DESIGN_HEIGHT
    rootTransform.setContentSize(viewportWidth, viewportHeight)
    const topAlignedOffsetY = Math.max(0, (viewportHeight - GAME_DESIGN_HEIGHT) * 0.5)

    const boardNode = this.node.getChildByName('board')
    if (boardNode) {
      boardNode.setPosition(0, GAME_BOARD_Y, 0)
      boardNode.getComponent(UITransform)?.setContentSize(
        this.getBoardInnerWidth() + BOARD_BORDER_WIDTH * 2,
        this.getBoardInnerHeight() + BOARD_BORDER_WIDTH * 2
      )
    }

    const skillsNode = this.getSkillsContainer()
    if (skillsNode) {
      this.layoutSkillsContainer(skillsNode)
    }

    const statusNode = this.node.getChildByName('Status')
    const contentNode = statusNode?.getChildByName('Content')
    statusNode?.setPosition(0, 0, 0)
    // HUD 仍使用 750×1334 定稿坐标，但整体贴住可视区顶部，避免长屏上分数和设置按钮一起下沉。
    contentNode?.setPosition(0, topAlignedOffsetY, 0)
    statusNode?.getComponent(UITransform)?.setContentSize(viewportWidth, viewportHeight)
    contentNode?.getComponent(UITransform)?.setContentSize(GAME_DESIGN_WIDTH, GAME_DESIGN_HEIGHT)
    this.statusContentBasePosition = { x: 0, y: topAlignedOffsetY, z: 0 }
    this.statusContentBaseSize = { width: GAME_DESIGN_WIDTH, height: GAME_DESIGN_HEIGHT }
  }

  // 无论技能栏来自 scene 还是运行时，都使用同一套定稿坐标。
  private layoutSkillsContainer(skillsNode: Node) {
    skillsNode.setPosition(0, GAME_SKILLS_Y, 0)
    ;(skillsNode.getComponent(UITransform) ?? skillsNode.addComponent(UITransform)).setContentSize(
      GAME_SKILLS_WIDTH,
      GAME_SKILLS_HEIGHT
    )
    for (let index = 0; index < GAME_SKILL_X_POSITIONS.length; index += 1) {
      skillsNode.getChildByName(`Skill${index + 1}`)?.setPosition(GAME_SKILL_X_POSITIONS[index], 0, 0)
    }
  }

  // 纯代码绘制玻璃棋盘、列蒙版和列分隔线，并同步列节点占位尺寸。
  private ensureBoardDecorations() {
    const boardNode = this.node.getChildByName('board')
    if (!boardNode) {
      return
    }

    const innerWidth = this.getBoardInnerWidth()
    const innerHeight = this.getBoardInnerHeight()
    const boardSprite = boardNode.getComponent(Sprite)
    if (boardSprite) {
      boardSprite.enabled = false
    }
    const boardGraphics = boardNode.getComponent(Graphics)
    if (boardGraphics) {
      boardGraphics.clear()
      boardGraphics.enabled = false
    }

    let boardFrame = boardNode.getChildByName('BoardFrame')
    if (!boardFrame) {
      boardFrame = new Node('BoardFrame')
      boardFrame.setParent(boardNode)
    }
    boardFrame.setPosition(0, 0, 0)
    boardFrame.setSiblingIndex(0)

    const frameTransform = boardFrame.getComponent(UITransform) ?? boardFrame.addComponent(UITransform)
    frameTransform.setContentSize(innerWidth + BOARD_BORDER_WIDTH * 2, innerHeight + BOARD_BORDER_WIDTH * 2)

    const frameGraphics = boardFrame.getComponent(Graphics) ?? boardFrame.addComponent(Graphics)
    frameGraphics.enabled = true
    frameGraphics.clear()
    // 外层先铺一层低透明阴影，视觉上保留边界但不再使用厚重实色边框。
    frameGraphics.fillColor = BOARD_GLASS_SHADOW_COLOR
    frameGraphics.roundRect(
      -innerWidth / 2 - BOARD_BORDER_WIDTH,
      -innerHeight / 2 - BOARD_BORDER_WIDTH,
      innerWidth + BOARD_BORDER_WIDTH * 2,
      innerHeight + BOARD_BORDER_WIDTH * 2,
      BOARD_OUTER_RADIUS
    )
    frameGraphics.fill()

    // 主体玻璃层略小于阴影层，避免外缘太硬，同时覆盖原来的黄色纯色样式。
    frameGraphics.fillColor = BOARD_GLASS_TINT_COLOR
    frameGraphics.roundRect(
      -innerWidth / 2 - BOARD_BORDER_WIDTH * 0.65,
      -innerHeight / 2 - BOARD_BORDER_WIDTH * 0.65,
      innerWidth + BOARD_BORDER_WIDTH * 1.3,
      innerHeight + BOARD_BORDER_WIDTH * 1.3,
      BOARD_OUTER_RADIUS
    )
    frameGraphics.fill()

    // 内区只保留轻微雾化蒙版，让棋盘仍然有面积感，但不会变成纯色背景。
    frameGraphics.fillColor = BOARD_GLASS_INNER_COLOR
    frameGraphics.roundRect(-innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight, BOARD_INNER_RADIUS)
    frameGraphics.fill()

    // 不再绘制额外高光条，避免顶部或左侧出现独立白线。

    const boardFill = boardNode.getChildByName('BoardFill')
    if (boardFill) {
      boardFill.setPosition(0, 0, 0)
      boardFill.setSiblingIndex(1)
      const fillTransform = boardFill.getComponent(UITransform)
      if (fillTransform) {
        fillTransform.setContentSize(innerWidth, innerHeight)
      }
      const fillSprite = boardFill.getComponent(Sprite)
      if (fillSprite) {
        fillSprite.enabled = false
      }
      const fillGraphics = boardFill.getComponent(Graphics) ?? boardFill.addComponent(Graphics)
      fillGraphics.enabled = false
      fillGraphics.clear()
    }

    for (let column = 0; column < this.boardwidth; column++) {
      const columnNode = boardNode.getChildByName(`column${column + 1}`)
      if (!columnNode) {
        continue
      }

      columnNode.setPosition(this.getBoardColumnCenterX(column), 0, 0)
      const columnTransform = columnNode.getComponent(UITransform)
      if (columnTransform) {
        columnTransform.setContentSize(innerWidth / this.boardwidth, innerHeight)
      }

      const columnSprite = columnNode.getComponent(Sprite)
      if (columnSprite) {
        // 列节点只保留占位，不再使用半透明底色。
        columnSprite.enabled = false
      }
    }

    let dashedLines = boardNode.getChildByName('BoardDashedLines')
    if (!dashedLines) {
      dashedLines = new Node('BoardDashedLines')
      dashedLines.setParent(boardNode)
    }
    dashedLines.setPosition(0, 0, 0)
    // 列样式只作为棋盘背景存在，优先放在 BoardFill 后面、列节点前面，避免覆盖棋子。
    const columnDecorationIndex = boardFill ? 2 : 1
    dashedLines.setSiblingIndex(Math.min(columnDecorationIndex, boardNode.children.length - 1))

    const dashedTransform = dashedLines.getComponent(UITransform) ?? dashedLines.addComponent(UITransform)
    dashedTransform.setContentSize(innerWidth, innerHeight)

    const graphics = dashedLines.getComponent(Graphics) ?? dashedLines.addComponent(Graphics)
    graphics.clear()

    const top = innerHeight / 2 - BOARD_DASH_INSET
    const bottom = -innerHeight / 2 + BOARD_DASH_INSET
    const columnWidth = innerWidth / this.boardwidth
    // 使用交替列蒙版表达五等分列，同时透明度很低，不会抢棋子的视觉焦点。
    for (let column = 0; column < this.boardwidth; column++) {
      if (column % 2 !== 0) {
        continue
      }

      graphics.fillColor = BOARD_COLUMN_TINT_COLOR
      graphics.roundRect(
        -innerWidth / 2 + columnWidth * column + 5,
        bottom,
        columnWidth - 10,
        top - bottom,
        BOARD_INNER_RADIUS
      )
      graphics.fill()
    }

    for (let column = 0; column < this.boardwidth - 1; column++) {
      const x = this.getBoardSeparatorX(column)
      // 每条分隔线先铺一条柔光底，再叠加短虚线，避免虚线像单独贴上去的素材。
      graphics.fillColor = BOARD_COLUMN_EDGE_COLOR
      graphics.roundRect(x - BOARD_DASH_WIDTH / 2, bottom, BOARD_DASH_WIDTH, top - bottom, BOARD_DASH_RADIUS)
      graphics.fill()

      graphics.fillColor = BOARD_DASH_COLOR
      for (let y = bottom; y < top; y += BOARD_DASH_LENGTH + BOARD_DASH_GAP) {
        const segmentEnd = Math.min(y + BOARD_DASH_LENGTH, top)
        graphics.roundRect(
          x - BOARD_DASH_WIDTH / 2,
          y,
          BOARD_DASH_WIDTH,
          Math.max(0, segmentEnd - y),
          BOARD_DASH_RADIUS
        )
      }
      graphics.fill()
    }

    this.disableDropGuide(boardNode)
  }

  // 当前版本不再显示下落指引轨道；保留清理逻辑，兼容旧场景里已经存在的 DropGuide 节点。
  private disableDropGuide(boardNode: Node) {
    const guideNode = boardNode.getChildByName('DropGuide')
    if (!guideNode) {
      return
    }

    guideNode.getComponent(Graphics)?.clear()
    guideNode.active = false
  }

  // 确保状态文字节点存在；如果 scene 中没有，就由 UI 层自行补建。
  // private ensureStatusLabel() {
  //   const existing = this.node.getChildByName('StatusLabel')
  //   if (existing) {
  //     // this.statusLabel = existing.getComponent(Label)
  //     return
  //   }

  //   const labelNode = new Node('StatusLabel')
  //   labelNode.setParent(this.node)
  //   labelNode.setPosition(0, 565, 0)

  //   const transform = labelNode.addComponent(UITransform)
  //   transform.setContentSize(680, 80)

  //   const label = labelNode.addComponent(Label)
  //   label.fontSize = 28
  //   label.lineHeight = 34
  //   label.horizontalAlign = Label.HorizontalAlign.CENTER
  //   label.color = new Color(250, 246, 242, 255)

  //   // this.statusLabel = label
  // }

  // 确保底部控制栏里的暂停按钮存在；如果 scene 已经配好，就直接复用。
  // private ensurePauseButton() {
  //   const container = this.getControlContainer()
  //   const existing = container.getChildByName('PauseButton')
  //   if (existing) {
  //     this.pauseButtonLabel = existing.getChildByName('Label')?.getComponent(Label) ?? null
  //     existing.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
  //     existing.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
  //     return
  //   }

  //   const buttonNode = new Node('PauseButton')
  //   buttonNode.setParent(container)
  //   buttonNode.setPosition(0, 0, 0)

  //   const transform = buttonNode.addComponent(UITransform)
  //   transform.setContentSize(140, 56)
  //   buttonNode.addComponent(Button)

  //   const bg = buttonNode.addComponent(Sprite)
  //   bg.color = new Color(37, 55, 80, 235)

  //   const labelNode = new Node('Label')
  //   labelNode.setParent(buttonNode)
  //   labelNode.setPosition(0, 0, 0)
  //   const labelTransform = labelNode.addComponent(UITransform)
  //   labelTransform.setContentSize(140, 56)

  //   const label = labelNode.addComponent(Label)
  //   // label.string = 'Pause'
  //   label.fontSize = 26
  //   label.lineHeight = 30
  //   label.horizontalAlign = Label.HorizontalAlign.CENTER
  //   label.verticalAlign = Label.VerticalAlign.CENTER
  //   label.color = new Color(245, 250, 255, 255)
  //   buttonNode.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
  //   this.pauseButtonLabel = label
  // }

  // PauseOverlay 根节点仍由主 UI 层接入，但节点内部动画和事件完全交给独立组件处理。
  private ensurePauseOverlay() {
    const overlayLayer = this.ensureOverlayLayer()
    let overlay = overlayLayer.getChildByName('PauseOverlay') ?? this.node.getChildByName('PauseOverlay')
    if (!overlay) {
      overlay = new Node('PauseOverlay')
      overlay.setParent(overlayLayer)
      overlay.active = false
      overlay.addComponent(UITransform).setContentSize(750, 1334)
    } else if (overlay.parent !== overlayLayer) {
      // OverlayLayer 与 Main 使用同一原点，迁移旧节点不会改变暂停面板的局部坐标。
      overlay.setParent(overlayLayer)
    }

    this.pauseOverlayController = overlay.getComponent(PauseOverlayController) ?? overlay.addComponent(PauseOverlayController)
    this.pauseOverlayController.setup({
      hostNode: this.node,
      pauseHandler: this.pauseHandler,
      replayHandler: this.pauseReplayHandler,
      homeHandler: this.pauseHomeHandler,
      shareHandler: this.pauseShareHandler,
      feedbackHandler: this.pauseFeedbackHandler,
      onButtonClick: this.buttonClickHandler ?? undefined
    })
  }

  // 优先绑定场景中的固定 GameOverOverlay 根节点，旧场景缺失时只补最小挂点。
  private ensureGameOverOverlay(
    popupSpriteFrame: SpriteFrame | null,
    replayButtonSpriteFrame: SpriteFrame | null,
    homeButtonSpriteFrame: SpriteFrame | null,
    shareButtonSpriteFrame: SpriteFrame | null
  ) {
    const overlayLayer = this.ensureOverlayLayer()
    let overlay = overlayLayer.getChildByName('GameOverOverlay') ?? this.node.getChildByName('GameOverOverlay')
    if (!overlay) {
      overlay = new Node('GameOverOverlay')
      overlay.setParent(overlayLayer)
      overlay.active = false
      overlay.addComponent(UITransform).setContentSize(750, 1334)
    } else if (overlay.parent !== overlayLayer) {
      overlay.setParent(overlayLayer)
    }

    this.gameOverOverlayController = overlay.getComponent(GameOverOverlayController) ?? overlay.addComponent(GameOverOverlayController)
    this.gameOverOverlayController.setup({
      hostNode: this.node,
      replayHandler: this.gameOverReplayHandler,
      homeHandler: this.gameOverHomeHandler,
      onButtonClick: this.buttonClickHandler ?? undefined,
      popupSpriteFrame,
      replayButtonSpriteFrame,
      homeButtonSpriteFrame,
      shareButtonSpriteFrame
    })
  }

  // Scene 中固定提供覆盖层挂点；旧场景缺失时只补一个与 Main 同原点的空容器。
  private ensureOverlayLayer() {
    let layer = this.node.getChildByName('OverlayLayer')
    if (!layer) {
      layer = new Node('OverlayLayer')
      layer.setParent(this.node)
      layer.addComponent(UITransform)
    }
    const hostTransform = this.node.getComponent(UITransform)
    const transform = layer.getComponent(UITransform) ?? layer.addComponent(UITransform)
    transform.setContentSize(hostTransform?.width ?? 750, hostTransform?.height ?? 1334)
    layer.setPosition(0, 0, 0)
    layer.setSiblingIndex(this.node.children.length - 1)
    return layer
  }

  // 顶部 HUD 复用 scene 中的固定节点，脚本只统一视觉、触摸热区和动态分数。
  private ensureScoreDisplay() {
    const statusContent = this.node.getChildByName('Status')?.getChildByName('Content')
    if (!statusContent) {
      return
    }
    this.ensureSettingsButtonVisual(statusContent?.getChildByName('SettingsBtn') ?? null)
    this.hideUnsupportedProgressCards(statusContent)
    this.ensureNextPieceCard(statusContent)
    const scoreNode =
      statusContent?.getChildByName('Score') ??
      statusContent?.getChildByName('Source') ??
      this.node.getChildByName('Score') ??
      this.node.getChildByName('Source')
    if (!scoreNode) {
      return
    }

    scoreNode.setPosition(HUD_SCORE_X, HUD_SCORE_Y, 0)
    const scoreTransform = scoreNode.getComponent(UITransform) ?? scoreNode.addComponent(UITransform)
    scoreTransform.setContentSize(HUD_SCORE_WIDTH, HUD_SCORE_HEIGHT)
    this.drawScoreCard(scoreNode)

    const titleNode = scoreNode.getChildByName('Label')
    const titleLabel = titleNode?.getComponent(Label) ?? null
    if (titleNode && titleLabel) {
      titleNode.setPosition(-26, 0, 0)
      const titleTransform = titleNode.getComponent(UITransform) ?? titleNode.addComponent(UITransform)
      titleTransform.setContentSize(58, 36)
      titleTransform.setAnchorPoint(0.5, 0.5)
      titleLabel.string = '分数'
      titleLabel.fontSize = 20
      titleLabel.lineHeight = 24
      titleLabel.color = HUD_SCORE_TEXT_COLOR
      titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER
      titleLabel.verticalAlign = Label.VerticalAlign.CENTER
      titleLabel.isBold = true
      titleLabel.enableOutline = false
      titleLabel.enableShadow = false
      const titleOutline = titleNode.getComponent(LabelOutline)
      if (titleOutline) {
        titleOutline.enabled = false
      }
    }

    this.ensureScoreStar(scoreNode)

    const numberNode = scoreNode.getChildByName('Number')
    this.scoreNumberLabel = numberNode?.getComponent(Label) ?? null
    if (numberNode && this.scoreNumberLabel) {
      numberNode.setPosition(42, 0, 0)
      const numberTransform = numberNode.getComponent(UITransform) ?? numberNode.addComponent(UITransform)
      numberTransform.setContentSize(88, 40)
      numberTransform.setAnchorPoint(0.5, 0.5)
      this.scoreNumberLabel.fontSize = 25
      this.scoreNumberLabel.lineHeight = 30
      this.scoreNumberLabel.color = HUD_SCORE_TEXT_COLOR
      this.scoreNumberLabel.horizontalAlign = Label.HorizontalAlign.CENTER
      this.scoreNumberLabel.verticalAlign = Label.VerticalAlign.CENTER
      this.scoreNumberLabel.isBold = true
      this.scoreNumberLabel.enableOutline = false
      this.scoreNumberLabel.enableShadow = false
      const numberOutline = numberNode.getComponent(LabelOutline)
      if (numberOutline) {
        numberOutline.enabled = false
      }
    }
    this.displayedScore = this.currentState.score
    this.scoreTweenState.value = this.currentState.score
  }

  // 当前为无关卡目标的经典合成模式，不展示“第几关”和冰封进度占位卡。
  private hideUnsupportedProgressCards(parent: Node) {
    for (const name of ['ModeCard', 'ObjectiveCard']) {
      const node = parent.getChildByName(name)
      if (node) {
        node.active = false
      }
    }
    this.objectiveProgressLabel = null
  }

  /** 分数星标独立绘制，避免星星和文字共用一种颜色。 */
  private ensureScoreStar(scoreNode: Node) {
    const starNode = this.ensureHudNode(scoreNode, 'Star', -66, 0, 28, 28)
    const star = starNode.getComponent(Graphics) ?? starNode.addComponent(Graphics)
    star.clear()
    star.fillColor = HUD_CARD_BORDER_COLOR
    this.traceStar(star, 0, 0, 14, 7)
    star.fill()
    star.fillColor = new Color(255, 193, 48, 255)
    this.traceStar(star, 0, 0, 10.5, 5.2)
    star.fill()
  }

  private traceStar(graphics: Graphics, x: number, y: number, outerRadius: number, innerRadius: number) {
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius
      const angle = -Math.PI / 2 + index * Math.PI / 5
      const pointX = x + Math.cos(angle) * radius
      const pointY = y + Math.sin(angle) * radius
      if (index === 0) {
        graphics.moveTo(pointX, pointY)
      } else {
        graphics.lineTo(pointX, pointY)
      }
    }
    graphics.close()
  }

  private ensureModeCard(parent: Node) {
    const card = this.ensureHudCard(parent, 'ModeCard', 0, HUD_MODE_Y, HUD_MODE_WIDTH, HUD_MODE_HEIGHT, 20)
    const markNode = this.ensureHudNode(card, 'Mark', -78, 0, 28, 28)
    const mark = markNode.getComponent(Graphics) ?? markNode.addComponent(Graphics)
    mark.clear()
    mark.fillColor = HUD_CARD_BORDER_COLOR
    mark.moveTo(0, 14)
    mark.lineTo(14, 0)
    mark.lineTo(0, -14)
    mark.lineTo(-14, 0)
    mark.close()
    mark.fill()
    mark.fillColor = HUD_ACCENT_GREEN
    mark.moveTo(0, 10)
    mark.lineTo(10, 0)
    mark.lineTo(0, -10)
    mark.lineTo(-10, 0)
    mark.close()
    mark.fill()
    this.ensureHudLabel(card, 'Label', '第12关', 22, 0, 156, 46, 29, HUD_SCORE_TEXT_COLOR)
  }

  private ensureObjectiveCard(parent: Node) {
    const card = this.ensureHudCard(
      parent,
      'ObjectiveCard',
      0,
      HUD_OBJECTIVE_Y,
      HUD_OBJECTIVE_WIDTH,
      HUD_OBJECTIVE_HEIGHT,
      22
    )
    const iconNode = this.ensureHudNode(card, 'Icon', -62, 0, 58, 58)
    const icon = iconNode.getComponent(Graphics) ?? iconNode.addComponent(Graphics)
    icon.clear()
    icon.fillColor = HUD_CARD_BORDER_COLOR
    icon.roundRect(-29, -29, 58, 58, 12)
    icon.fill()
    icon.fillColor = new Color(221, 248, 247, 255)
    icon.roundRect(-25, -25, 50, 50, 9)
    icon.fill()
    icon.strokeColor = HUD_ACCENT_BLUE
    icon.lineWidth = 4
    icon.moveTo(-13, 0)
    icon.lineTo(13, 0)
    icon.moveTo(0, -13)
    icon.lineTo(0, 13)
    icon.moveTo(-9, -9)
    icon.lineTo(9, 9)
    icon.moveTo(-9, 9)
    icon.lineTo(9, -9)
    icon.stroke()

    card.getChildByName('Title')?.destroy()
    card.getChildByName('Description')?.destroy()
    const progressNode = this.ensureHudNode(card, 'Progress', 43, 0, 94, 62)
    progressNode.getComponent(Graphics)?.clear()
    this.objectiveProgressLabel = this.ensureHudLabel(
      progressNode,
      'Value',
      '0/8',
      0,
      0,
      92,
      54,
      38,
      HUD_SCORE_TEXT_COLOR
    )
  }

  private ensureNextPieceCard(parent: Node) {
    const card = this.ensureHudNode(parent, 'NextPieceCard', HUD_NEXT_X, HUD_NEXT_Y, 108, 108)
    card.getComponent(Graphics)?.clear()
    const title = this.ensureHudLabel(card, 'Title', '下一枚', 0, 27, 92, 28, 20, HUD_SCORE_TEXT_COLOR)
    title.enableOutline = true
    title.outlineColor = new Color(255, 250, 230, 255)
    title.outlineWidth = 3
    const tileNode = this.ensureHudNode(card, 'Tile', 0, -18, 52, 52)
    this.nextValueTile = tileNode.getComponent(Graphics) ?? tileNode.addComponent(Graphics)
    this.nextValueLabel = this.ensureHudLabel(tileNode, 'Value', '2', 0, 0, 48, 42, 24, HUD_SCORE_TEXT_COLOR)
    this.refreshNextPieceDisplay()
  }

  private ensureHudCard(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    const node = this.ensureHudNode(parent, name, x, y, width, height)
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = HUD_CARD_BORDER_COLOR
    graphics.roundRect(-width * 0.5, -height * 0.5, width, height, radius)
    graphics.fill()
    graphics.fillColor = HUD_CARD_BG_COLOR
    graphics.roundRect(-width * 0.5 + 3, -height * 0.5 + 3, width - 6, height - 6, Math.max(1, radius - 3))
    graphics.fill()
    return node
  }

  private ensureHudNode(parent: Node, name: string, x: number, y: number, width: number, height: number) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
    }
    node.setPosition(x, y, 0)
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    return node
  }

  private ensureHudLabel(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: Color
  ) {
    const node = this.ensureHudNode(parent, name, x, y, width, height)
    const label = node.getComponent(Label) ?? node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.ceil(fontSize * 1.18)
    label.color = color
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.isBold = true
    return label
  }

  // 设置按钮视觉尺寸与触摸热区分离，保证图标克制但左上角仍容易点击。
  private ensureSettingsButtonVisual(settingsNode: Node | null) {
    if (!settingsNode) {
      return
    }

    settingsNode.setPosition(HUD_SETTINGS_X, HUD_SETTINGS_Y, 0)
    const settingsTransform = settingsNode.getComponent(UITransform) ?? settingsNode.addComponent(UITransform)
    settingsTransform.setContentSize(HUD_SETTINGS_HIT_SIZE, HUD_SETTINGS_HIT_SIZE)
    const settingsWidget = settingsNode.getComponent(Widget)
    if (settingsWidget) {
      // HUD 已统一使用游戏页坐标，禁用旧 Widget 防止它在下一帧把设置按钮拉回历史偏移。
      settingsWidget.enabled = false
    }
    const settingsButton = settingsNode.getComponent(Button)
    if (settingsButton) {
      settingsButton.enabled = false
    }
    settingsNode.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
    settingsNode.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
    // 根节点保留较大的触摸热区，图标单独放在子节点中，避免视觉尺寸跟着热区一起放大。
    const rootSprite = settingsNode.getComponent(Sprite)
    if (rootSprite) {
      rootSprite.enabled = false
    }
    let iconNode = settingsNode.getChildByName('Icon')
    if (!iconNode) {
      iconNode = new Node('Icon')
      iconNode.setParent(settingsNode)
      iconNode.addComponent(UITransform)
      iconNode.addComponent(Sprite)
    }
    iconNode.setPosition(0, 0, 0)
    iconNode.getComponent(UITransform)?.setContentSize(HUD_SETTINGS_ICON_SIZE, HUD_SETTINGS_ICON_SIZE)
    const iconSprite = iconNode.getComponent(Sprite)
    if (!iconSprite) {
      return
    }
    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM
    assetManager.loadAny(GAME_SETTINGS_SPRITE_FRAME_UUID, (error, asset) => {
      if (!error && iconSprite.node.isValid && asset instanceof SpriteFrame) {
        iconSprite.spriteFrame = asset
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM
        iconSprite.node.getComponent(UITransform)?.setContentSize(HUD_SETTINGS_ICON_SIZE, HUD_SETTINGS_ICON_SIZE)
      }
    })
  }

  // 分数卡用轻量 Graphics 绘制，避免为一个可伸缩小面板增加新的大图。
  private drawScoreCard(scoreNode: Node) {
    const graphics = scoreNode.getComponent(Graphics) ?? scoreNode.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = HUD_SCORE_BORDER_COLOR
    graphics.roundRect(-HUD_SCORE_WIDTH * 0.5, -HUD_SCORE_HEIGHT * 0.5, HUD_SCORE_WIDTH, HUD_SCORE_HEIGHT, 18)
    graphics.fill()
    graphics.fillColor = HUD_SCORE_BG_COLOR
    graphics.roundRect(
      -HUD_SCORE_WIDTH * 0.5 + 3,
      -HUD_SCORE_HEIGHT * 0.5 + 3,
      HUD_SCORE_WIDTH - 6,
      HUD_SCORE_HEIGHT - 6,
      15
    )
    graphics.fill()
  }

  // 分数字样改成“数字递增”动画；加分时逐步滚到目标值，减分或清零时直接同步。
  private refreshScoreDisplay() {
    if (!this.scoreNumberLabel) {
      return
    }

    const nextScore = Math.max(0, Math.floor(this.currentState.score))
    const currentScore = Math.max(0, Math.floor(this.displayedScore))
    Tween.stopAllByTarget(this.scoreTweenState)

    if (nextScore <= currentScore) {
      // 重开或回退时直接落到目标值，避免分数向下滚动造成误解。
      this.displayedScore = nextScore
      this.scoreTweenState.value = nextScore
      this.scoreNumberLabel.string = `${nextScore}`
      return
    }

    // 差值越大动画稍微长一点，但整体仍然控制在很短的 UI 反馈范围内。
    const duration = Math.min(0.36, Math.max(0.08, (nextScore - currentScore) / 900))
    this.scoreTweenState.value = currentScore
    tween(this.scoreTweenState)
      .to(duration, { value: nextScore }, {
        easing: 'quadOut',
        onUpdate: target => {
          const value = Math.min(nextScore, Math.round(target.value))
          this.displayedScore = value
          if (this.scoreNumberLabel) {
            this.scoreNumberLabel.string = `${value}`
          }
        }
      })
      .start()
  }

  private refreshObjectiveDisplay() {
    if (this.objectiveProgressLabel) {
      // 当前关卡规则尚未接入冰封计数，先保持设计稿占位，避免用最高合成值冒充目标进度。
      this.objectiveProgressLabel.string = '0/8'
    }
  }

  private refreshNextPieceDisplay() {
    if (!this.nextValueLabel || !this.nextValueTile) {
      return
    }

    const value = this.currentState.nextValue ?? 2
    const bodyColor = HUD_PIECE_COLORS[value] ?? new Color(207, 88, 109, 255)
    this.nextValueTile.clear()
    this.nextValueTile.fillColor = HUD_CARD_BORDER_COLOR
    this.nextValueTile.roundRect(-26, -26, 52, 52, 9)
    this.nextValueTile.fill()
    this.nextValueTile.fillColor = bodyColor
    this.nextValueTile.roundRect(-23, -23, 46, 46, 7)
    this.nextValueTile.fill()
    this.nextValueLabel.string = `${value}`
    this.nextValueLabel.fontSize = value >= 100 ? 19 : value >= 10 ? 21 : 24
    this.nextValueLabel.color = new Color(255, 249, 234, 255)
    this.nextValueLabel.enableOutline = true
    this.nextValueLabel.outlineColor = HUD_CARD_BORDER_COLOR
    this.nextValueLabel.outlineWidth = 2
  }

  // 游戏内不再展示金币余额；金币仍由经济仓库维护，首页和购买弹窗按需展示。
  private hideCoinBar() {
    this.coinBarNode = this.node.getChildByName('CoinBar')
    if (!this.coinBarNode) {
      return
    }

    this.coinAmountLabel = this.coinBarNode.getChildByName('Amount')?.getComponent(Label) ?? null
    this.unbindCoinBar()
    this.coinBarNode.active = false
    this.coinBarNode = null
    this.coinAmountLabel = null
  }

  private unbindCoinBar() {
    if (!this.coinBarNode?.isValid) {
      return
    }

    this.coinBarNode.off(Node.EventType.TOUCH_START, this.handleCoinBarPressStart, this)
    this.coinBarNode.off(Node.EventType.TOUCH_END, this.handleCoinBarPressEnd, this)
    this.coinBarNode.off(Node.EventType.TOUCH_CANCEL, this.handleCoinBarPressEnd, this)
    this.coinBarNode.off(Node.EventType.TOUCH_END, this.handleCoinMoreTap, this)
    Tween.stopAllByTarget(this.coinBarNode)
  }

  private handleCoinBarPressStart(event: EventTouch) {
    event.propagationStopped = true
    if (!this.coinBarNode) {
      return
    }

    Tween.stopAllByTarget(this.coinBarNode)
    tween(this.coinBarNode)
      .to(0.06, {
        scale: new Vec3(
          PLAYER_AMOUNT_BAR_SCALE * 0.94,
          PLAYER_AMOUNT_BAR_SCALE * 0.94,
          1
        )
      })
      .start()
  }

  private handleCoinBarPressEnd(event: EventTouch) {
    event.propagationStopped = true
    if (!this.coinBarNode) {
      return
    }

    Tween.stopAllByTarget(this.coinBarNode)
    tween(this.coinBarNode)
      .to(0.08, {
        scale: new Vec3(PLAYER_AMOUNT_BAR_SCALE, PLAYER_AMOUNT_BAR_SCALE, 1)
      }, { easing: 'backOut' })
      .start()
  }

  private handleCoinMoreTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.coinMoreHandler?.()
  }

  // 金币数值完全来自逻辑层快照，购买技能或领取奖励后会随 renderState 自动刷新。
  private refreshCoinDisplay() {
    if (this.coinAmountLabel) {
      this.coinAmountLabel.string = Math.max(0, Math.floor(this.currentState.coins))
        .toLocaleString('en-US')
    }
  }

  // 底部控制栏的视觉样式尽量交给 scene，这里只做异形屏安全区补偿。
  private configureControlBar() {
    const container = this.getControlContainer()
    const rootTransform = this.node.getComponent(UITransform)
    const controlTransform = container.getComponent(UITransform)
    if (!rootTransform || !controlTransform) {
      return
    }

    const safeArea = sys.getSafeAreaRect()
    const safeBottom = safeArea ? (safeArea.y / screen.windowSize.height) * rootTransform.height : 0
    if (this.controlBarBaseHeight <= 0) {
      // 把 scene 中当前控制栏高度记为基准高度，后续不再覆盖编辑器里的布局配置。
      this.controlBarBaseHeight = controlTransform.height
    }
    const baseHeight = this.controlBarBaseHeight
    const totalHeight = baseHeight + safeBottom
    const widget = container.getComponent(Widget)
    if (widget) {
      widget.enabled = false
    }

    // 参考稿中三个技能卡直接落在草地上，不再使用旧版整块灰色托盘。
    // 只能关闭技能栏的旧托盘，不得在兼容回退时把 Main 背景 Sprite 一起关掉。
    const background = container === this.node ? null : container.getComponent(Sprite)
    if (background) {
      background.enabled = false
    }

    // 技能栏保持设计稿基准坐标，真机时再整体叠加底部安全区。
    controlTransform.setContentSize(controlTransform.width, totalHeight)
    container.setPosition(0, GAME_SKILLS_Y + safeBottom, 0)
  }

  /**
   * 游戏金币条跟随左侧设置按钮布局。
   * 金币条放在设置按钮右侧并共享水平中线；微信端额外限制右边界，避免侵入原生胶囊。
   */
  private configureCoinBar() {
    const rootTransform = this.node.getComponent(UITransform)
    if (!this.coinBarNode || !rootTransform) {
      return
    }

    const coinTransform = this.coinBarNode.getComponent(UITransform)
    const amountBarHalfHeight =
      PLAYER_AMOUNT_BAR_SOURCE_HEIGHT * PLAYER_AMOUNT_BAR_SCALE * 0.5
    const amountBarHalfWidth =
      (coinTransform?.width ?? 0) * PLAYER_AMOUNT_BAR_SCALE * 0.5
    let x = PLAYER_AMOUNT_BAR_FALLBACK_X
    let y = rootTransform.height * 0.5 - PLAYER_AMOUNT_BAR_DEFAULT_TOP_INSET
    const settingsNode = this.node
      .getChildByName('Status')
      ?.getChildByName('Content')
      ?.getChildByName('SettingsBtn') ?? null
    const settingsTransform = settingsNode?.getComponent(UITransform) ?? null
    if (settingsNode && settingsTransform) {
      // 主动刷新 Widget，确保首帧读取到的就是异形屏适配后的设置按钮坐标。
      settingsNode.getComponent(Widget)?.updateAlignment()
      const settingsPosition = rootTransform.convertToNodeSpaceAR(settingsNode.worldPosition)
      x =
        settingsPosition.x +
        settingsTransform.width * settingsNode.worldScale.x * 0.5 +
        PLAYER_AMOUNT_BAR_SETTINGS_GAP +
        amountBarHalfWidth
      y = settingsPosition.y
    }

    const menuMetrics = this.getWechatMenuMetrics()
    if (menuMetrics) {
      const sourceWindowWidth = menuMetrics.windowWidth > 0
        ? menuMetrics.windowWidth
        : screen.windowSize.width
      const widthScale = rootTransform.width / Math.max(1, sourceWindowWidth)
      const capsuleLeft =
        -rootTransform.width * 0.5 + menuMetrics.menuRect.left * widthScale
      x = Math.min(
        x,
        capsuleLeft - PLAYER_AMOUNT_BAR_CAPSULE_GAP - amountBarHalfWidth
      )
    }

    // 兜底时仍保证资源条不会超出画布上下边界。
    y = Math.min(
      rootTransform.height * 0.5 - amountBarHalfHeight,
      Math.max(-rootTransform.height * 0.5 + amountBarHalfHeight, y)
    )
    this.coinBarNode.setPosition(x, y, 0)
    this.coinBarNode.setScale(
      PLAYER_AMOUNT_BAR_SCALE,
      PLAYER_AMOUNT_BAR_SCALE,
      1
    )
  }

  // 顶部 Status 只在微信小程序里对齐胶囊按钮，其他平台继续使用 scene 中的原始布局。
  private configureStatusBar() {
    const statusNode = this.node.getChildByName('Status')
    const contentNode = statusNode?.getChildByName('Content')
    const rootTransform = this.node.getComponent(UITransform)
    const contentTransform = contentNode?.getComponent(UITransform)
    if (!statusNode || !contentNode || !rootTransform || !contentTransform) {
      return
    }

    // HUD 必须位于棋盘和棋子之上、技能栏之下，否则全屏棋盘会抢走设置按钮的触摸事件。
    const skillsNode = this.node.getChildByName('SkliisController') ?? this.node.getChildByName('SkillsController')
    if (skillsNode) {
      statusNode.setSiblingIndex(Math.max(0, skillsNode.getSiblingIndex() - 1))
    }

    if (!this.statusContentBasePosition) {
      // Content 的基础位置只记录一次，避免每次布局后都把运行时位置当成新的默认值。
      this.statusContentBasePosition = {
        x: contentNode.position.x,
        y: contentNode.position.y,
        z: contentNode.position.z
      }
    }
    if (!this.statusContentBaseSize) {
      // Content 的基础尺寸同理需要缓存，方便平台切换或调试时恢复。
      this.statusContentBaseSize = {
        width: contentTransform.width,
        height: contentTransform.height
      }
    }
    const basePosition = this.statusContentBasePosition
    const baseSize = this.statusContentBaseSize
    if (!baseSize) {
      return
    }
    if (!basePosition) {
      return
    }

    const menuMetrics = this.getWechatMenuMetrics()
    if (!menuMetrics) {
      this.restoreStatusBarLayout(contentNode, contentTransform)
      return
    }

    const sourceWindowHeight = menuMetrics.windowHeight && menuMetrics.windowHeight > 0
      ? menuMetrics.windowHeight
      : screen.windowSize.height
    const heightScale = rootTransform.height / sourceWindowHeight
    const contentHeight = baseSize.height
    const anchorY = contentTransform.anchorPoint.y
    const capsuleTopFromTop = Math.max(0, menuMetrics.menuRect.top - menuMetrics.screenTop) * heightScale
    const statusHeight = statusNode.getComponent(UITransform)?.height ?? 0
    const contentLocalY = statusHeight * 0.5 - capsuleTopFromTop - contentHeight * (1 - anchorY)
    // Content 保留 scene 里的横向位置和尺寸，只把自身距离顶部的偏移改成与胶囊一致。
    contentNode.setPosition(basePosition.x, contentLocalY, basePosition.z)
  }

  // 没有胶囊数据时恢复 scene 默认布局，避免浏览器和编辑器里的排版被微信适配逻辑污染。
  private restoreStatusBarLayout(contentNode: Node, contentTransform: UITransform) {
    if (this.statusContentBaseSize) {
      contentTransform.setContentSize(this.statusContentBaseSize.width, this.statusContentBaseSize.height)
    }
    if (this.statusContentBasePosition) {
      contentNode.setPosition(
        this.statusContentBasePosition.x,
        this.statusContentBasePosition.y,
        this.statusContentBasePosition.z
      )
    }
  }

  // 微信小程序和小游戏里，胶囊矩形需要和窗口信息一起读取，才能消掉真机顶部原生偏移。
  private getWechatMenuMetrics(): {
    menuRect: WechatMenuButtonRect
    windowWidth: number
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
      windowWidth: windowInfo?.windowWidth ?? 0,
      windowHeight: windowInfo?.windowHeight ?? 0,
      screenTop: windowInfo?.screenTop ?? 0
    }
  }

  // 把当前逻辑状态翻译成状态栏文本。
  // private refreshStatus() {
  //   if (!this.statusLabel) {
  //     return
  //   }

  //   if (this.currentState.isGameOver) {
  //     this.statusLabel.string = 'Game Over - Tap to restart'
  //     return
  //   }

  //   if (this.currentState.isResolving) {
  //     this.statusLabel.string = 'Resolving...'
  //     return
  //   }

  //   if (this.currentState.isPaused) {
  //     this.statusLabel.string = 'Paused'
  //     return
  //   }

  //   if (!this.currentState.currentValue) {
  //     this.statusLabel.string = ''
  //     return
  //   }

  //   this.statusLabel.string = `Current ${this.currentState.currentValue} - Drag to choose column, tap to fast drop until landing`
  // }

  // 根据 paused 状态刷新按钮文案和颜色。
  // private refreshPauseButton() {
  //   if (!this.pauseButtonLabel) {
  //     return
  //   }

  //   this.pauseButtonLabel.string = this.currentState.isPaused ? 'Resume' : 'Pause'
  //   const bg = this.pauseButtonLabel.node.parent?.getComponent(Sprite)
  //   if (bg) {
  //     bg.color = this.currentState.isPaused ? new Color(73, 111, 83, 240) : new Color(37, 55, 80, 235)
  //   }
  // }

  // 暂停按钮只负责把点击事件转交给逻辑层，避免 UI 层直接改状态。
  private onPauseButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.pauseHandler?.()
  }

  /**
   * 技能栏优先复用 scene 中的新旧节点；静态层级被删除时，在运行时补齐同名结构。
   * 点击仍只通过回调通知玩法层，技能次数仍由 PlayUIState 单向渲染。
   */
  private ensureSkillButtons() {
    const skillsContainer = this.ensureSkillsContainer()
    this.bombSkillNode = this.ensureSkillButtonNode(skillsContainer, 'bomb')
    this.hammerSkillNode = this.ensureSkillButtonNode(skillsContainer, 'hammer')
    this.swapSkillNode = this.ensureSkillButtonNode(skillsContainer, 'swap')

    this.configureSkillButton(this.bombSkillNode, 'bomb', this.onBombSkillButtonTap)
    this.configureSkillButton(this.hammerSkillNode, 'hammer', this.onHammerSkillButtonTap)
    this.configureSkillButton(this.swapSkillNode, 'swap', this.onSwapSkillButtonTap)
    this.layoutSkillsContainer(skillsContainer)
  }

  /** 新场景使用 SkillsController，历史场景的 SkliisController 仍可直接复用。 */
  private ensureSkillsContainer() {
    let skillsContainer = this.getSkillsContainer()
    if (!skillsContainer) {
      skillsContainer = new Node('SkillsController')
      skillsContainer.setParent(this.node)
      skillsContainer.addComponent(UITransform)
    }

    skillsContainer.active = true
    const transform = skillsContainer.getComponent(UITransform) ?? skillsContainer.addComponent(UITransform)
    transform.setContentSize(GAME_SKILLS_WIDTH, GAME_SKILLS_HEIGHT)
    this.keepSkillsBelowFeedbackLayers(skillsContainer)
    return skillsContainer
  }

  /** 局部缺节点时也单独补齐，避免一个技能缺失导致整栏无法交互。 */
  private ensureSkillButtonNode(skillsContainer: Node, skill: PlaySkillKind) {
    const nodeName = SKILL_NODE_NAMES[skill]
    let skillNode = skillsContainer.getChildByName(nodeName)
    if (!skillNode) {
      skillNode = new Node(nodeName)
      skillNode.setParent(skillsContainer)
      skillNode.addComponent(UITransform)
    }
    skillNode.active = true
    ;(skillNode.getComponent(UITransform) ?? skillNode.addComponent(UITransform)).setContentSize(108, 114)

    const iconName = SKILL_ICON_NODE_NAMES[skill]
    let iconNode = skillNode.getChildByName(iconName)
    if (!iconNode) {
      iconNode = new Node(iconName)
      iconNode.setParent(skillNode)
      iconNode.addComponent(UITransform)
      iconNode.addComponent(Sprite)
    }
    iconNode.active = true
    const iconLayout = SKILL_ICON_LAYOUTS[skill]
    iconNode.setPosition(0, iconLayout.y, 0)
    ;(iconNode.getComponent(UITransform) ?? iconNode.addComponent(UITransform)).setContentSize(
      iconLayout.width,
      iconLayout.height
    )
    const iconSprite = iconNode.getComponent(Sprite) ?? iconNode.addComponent(Sprite)
    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM
    iconSprite.type = Sprite.Type.SIMPLE
    iconSprite.trim = false

    // Box 作为次数节点容器；旧场景保留原 Box，新场景则交给现有计数逻辑补子节点。
    let boxNode = skillNode.getChildByName('Box')
    if (!boxNode) {
      boxNode = new Node('Box')
      boxNode.setParent(skillNode)
      boxNode.addComponent(UITransform).setContentSize(100, 100)
    }
    return skillNode
  }

  private configureSkillButton(
    skillNode: Node,
    skill: PlaySkillKind,
    tapHandler: (event: EventTouch) => void
  ) {
    skillNode.off(Node.EventType.TOUCH_END, tapHandler, this)
    skillNode.on(Node.EventType.TOUCH_END, tapHandler, this)
    this.ensureSkillCardVisual(skillNode, skill)
    this.skillCountSprites[skill] = this.ensureSkillCountSprite(skillNode)
    this.ensureSkillStateDecorations(skillNode)
  }

  /** 技能栏必须位于反馈和弹窗层下方，否则运行时后追加的按钮会拦截暂停页点击。 */
  private keepSkillsBelowFeedbackLayers(skillsContainer: Node) {
    const upperLayers = ['FeedbackLayer', 'OverlayLayer']
      .map((name) => this.node.getChildByName(name))
      .filter((node): node is Node => !!node && node !== skillsContainer)
    if (upperLayers.length === 0) {
      return
    }

    const firstUpperIndex = Math.min(...upperLayers.map((node) => node.getSiblingIndex()))
    if (skillsContainer.getSiblingIndex() > firstUpperIndex) {
      skillsContainer.setSiblingIndex(firstUpperIndex)
    }
  }

  /** 把历史圆形技能按钮收口为设计稿的方形手绘卡片。 */
  private ensureSkillCardVisual(skillNode: Node, skill: PlaySkillKind) {
    const rootTransform = skillNode.getComponent(UITransform) ?? skillNode.addComponent(UITransform)
    rootTransform.setContentSize(108, 114)

    let cardNode = skillNode.getChildByName('Card')
    if (!cardNode) {
      cardNode = new Node('Card')
      cardNode.setParent(skillNode)
      cardNode.addComponent(UITransform)
      cardNode.addComponent(Graphics)
    }
    cardNode.setPosition(0, -1, 0)
    cardNode.setSiblingIndex(0)
    cardNode.getComponent(UITransform)?.setContentSize(96, 104)
    const card = cardNode.getComponent(Graphics)
    if (card) {
      card.clear()
      card.fillColor = SKILL_CARD_BORDER_COLOR
      card.roundRect(-48, -52, 96, 104, 13)
      card.fill()
      card.fillColor = SKILL_CARD_INNER_COLORS[skill]
      card.roundRect(-45, -49, 90, 98, 10)
      card.fill()
      card.fillColor = new Color(255, 248, 220, 34)
      card.roundRect(-41, 19, 82, 24, 7)
      card.fill()
    }

    const iconName = SKILL_ICON_NODE_NAMES[skill]
    const iconNode = skillNode.getChildByName(iconName)
    if (iconNode) {
      const iconLayout = SKILL_ICON_LAYOUTS[skill]
      iconNode.setPosition(0, iconLayout.y, 0)
      iconNode.getComponent(UITransform)?.setContentSize(iconLayout.width, iconLayout.height)
      const icon = iconNode.getComponent(Sprite)
      if (icon) {
        icon.sizeMode = Sprite.SizeMode.CUSTOM
        icon.trim = false
        assetManager.loadAny(SKILL_ICON_SPRITE_FRAME_UUIDS[skill], (error, asset) => {
          if (!error && icon.node.isValid && asset instanceof SpriteFrame) {
            icon.spriteFrame = asset
            icon.sizeMode = Sprite.SizeMode.CUSTOM
            icon.node.getComponent(UITransform)?.setContentSize(iconLayout.width, iconLayout.height)
          }
        })
      }
      iconNode.setSiblingIndex(Math.min(1, skillNode.children.length - 1))
    }

    let labelNode = skillNode.getChildByName('Name')
    if (!labelNode) {
      labelNode = new Node('Name')
      labelNode.setParent(skillNode)
      labelNode.addComponent(UITransform)
      labelNode.addComponent(Label)
    }
    labelNode.setPosition(0, -36, 0)
    labelNode.getComponent(UITransform)?.setContentSize(88, 27)
    labelNode.setSiblingIndex(Math.min(2, skillNode.children.length - 1))
    const label = labelNode.getComponent(Label)
    if (label) {
      label.string = SKILL_CARD_LABELS[skill]
      label.fontSize = 18
      label.lineHeight = 22
      label.color = new Color(255, 250, 230, 255)
      label.horizontalAlign = Label.HorizontalAlign.CENTER
      label.verticalAlign = Label.VerticalAlign.CENTER
      label.isBold = true
      label.enableOutline = true
      label.outlineColor = new Color(75, 53, 40, 240)
      label.outlineWidth = 2
    }

    const boxNode = this.getSkillBox(skillNode)
    boxNode.setSiblingIndex(skillNode.children.length - 1)
    for (const badgeName of ['MoreBtn', 'AmountBG', 'Count']) {
      const badgeNode = boxNode.getChildByName(badgeName)
      badgeNode?.setPosition(39, 41, 0)
      const badgeSprite = badgeNode?.getComponent(Sprite)
      if (badgeSprite) {
        badgeSprite.enabled = false
      }
    }
    this.ensureSkillCountBadge(skillNode)
  }

  /** 数量角标使用代码绘制的绿色小圆，避免沿用旧版蓝色大圆盘。 */
  private ensureSkillCountBadge(skillNode: Node) {
    let badgeNode = skillNode.getChildByName('CountBadge')
    if (!badgeNode) {
      badgeNode = new Node('CountBadge')
      badgeNode.setParent(skillNode)
      badgeNode.addComponent(UITransform).setContentSize(40, 40)
      badgeNode.addComponent(Graphics)
    }
    badgeNode.setPosition(39, 41, 0)
    badgeNode.setSiblingIndex(skillNode.children.length - 1)
    const badge = badgeNode.getComponent(Graphics)
    if (badge) {
      badge.clear()
      badge.fillColor = HUD_CARD_BORDER_COLOR
      badge.circle(0, 0, 20)
      badge.fill()
      badge.fillColor = new Color(92, 170, 47, 255)
      badge.circle(0, 0, 17)
      badge.fill()
    }
    const label = this.ensureHudLabel(badgeNode, 'Value', '1', 0, 0, 34, 32, 19, new Color(255, 255, 246, 255))
    label.enableOutline = false
  }

  private ensureSkillStateDecorations(skillNode: Node) {
    let ringNode = skillNode.getChildByName('SelectionRing')
    if (!ringNode) {
      ringNode = new Node('SelectionRing')
      ringNode.setParent(skillNode)
      ringNode.addComponent(UITransform).setContentSize(112, 120)
      ringNode.addComponent(Graphics)
    }
    ringNode.setPosition(0, 0, 0)
    ringNode.setSiblingIndex(0)
    ringNode.active = false
    const ring = ringNode.getComponent(Graphics)
    if (ring) {
      ring.clear()
      ring.lineWidth = 6
      ring.strokeColor = SKILL_SELECTION_COLOR
      ring.roundRect(-54, -58, 108, 116, 18)
      ring.stroke()
    }

    let usedNode = skillNode.getChildByName('UsedLabel')
    if (!usedNode) {
      usedNode = new Node('UsedLabel')
      usedNode.setParent(skillNode)
      usedNode.addComponent(UITransform).setContentSize(72, 32)
      usedNode.addComponent(Graphics)
    }
    usedNode.setPosition(0, 0, 0)
    usedNode.active = false
    const usedBg = usedNode.getComponent(Graphics)
    if (usedBg) {
      usedBg.clear()
      usedBg.fillColor = new Color(61, 57, 52, 224)
      usedBg.roundRect(-36, -16, 72, 32, 14)
      usedBg.fill()
    }
    const usedLabel = this.ensureHudLabel(
      usedNode,
      'Text',
      '已用',
      0,
      0,
      68,
      28,
      19,
      new Color(255, 248, 221, 255)
    )
    if (usedLabel) {
      usedLabel.lineHeight = 24
    }
  }

  // 技能数量节点固定在 Box 里；旧场景还没迁移 Box 时，临时兼容直接挂在 Skill 下的节点。
  private getSkillBox(skillNode: Node) {
    return skillNode.getChildByName('Box') ?? skillNode
  }

  // Count 是数字图片节点，不再使用 Label 文本，样式由场景里的节点尺寸和位置决定。
  private ensureSkillCountSprite(skillNode: Node) {
    const boxNode = this.getSkillBox(skillNode)
    if (boxNode !== skillNode) {
      boxNode.setSiblingIndex(skillNode.children.length - 1)
    }
    this.ensureSkillBoxChild(boxNode, 'MoreBtn')
    this.ensureSkillBoxChild(boxNode, 'AmountBG')
    const countNode = this.ensureSkillBoxChild(boxNode, 'Count')
    this.syncSkillBoxLayer(boxNode)
    return countNode.getComponent(Sprite) ?? countNode.addComponent(Sprite)
  }

  // 三个技能的角标结构共用一套逻辑，缺失的节点从其它技能复制图片和尺寸，位置贴当前技能已有角标。
  private ensureSkillBoxChild(boxNode: Node, nodeName: 'MoreBtn' | 'AmountBG' | 'Count') {
    const currentNode = boxNode.getChildByName(nodeName)
    if (currentNode) {
      return currentNode
    }

    const referenceNode = this.findSkillBoxChild(nodeName, boxNode)
    const localMoreButtonNode = boxNode.getChildByName('MoreBtn')
    const positionReferenceNode =
      localMoreButtonNode ??
      boxNode.getChildByName('Count') ??
      boxNode.getChildByName('AmountBG') ??
      referenceNode
    const node = new Node(nodeName)
    node.setParent(boxNode)
    node.setPosition(
      positionReferenceNode?.position.x ?? SKILL_BADGE_FALLBACK_X,
      positionReferenceNode?.position.y ?? SKILL_BADGE_FALLBACK_Y,
      positionReferenceNode?.position.z ?? 0
    )

    const transform = node.addComponent(UITransform)
    const referenceTransform = (nodeName === 'AmountBG' ? localMoreButtonNode : referenceNode)?.getComponent(UITransform)
    transform.setContentSize(
      referenceTransform?.width ?? (nodeName === 'Count' ? SKILL_COUNT_WIDTH : SKILL_BADGE_FALLBACK_SIZE),
      referenceTransform?.height ?? (nodeName === 'Count' ? SKILL_COUNT_HEIGHT : SKILL_BADGE_FALLBACK_SIZE)
    )

    const sprite = node.addComponent(Sprite)
    const referenceSpriteFrame = referenceNode?.getComponent(Sprite)?.spriteFrame ?? null
    if (referenceSpriteFrame) {
      sprite.spriteFrame = referenceSpriteFrame
    }
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    return node
  }

  // 从其它技能上找同名角标节点，保证 Skill1/Skill2/Skill3 缺图时可以复用同一套视觉资源。
  private findSkillBoxChild(nodeName: 'MoreBtn' | 'AmountBG' | 'Count', ignoredBoxNode: Node) {
    const skillNodes = [this.bombSkillNode, this.hammerSkillNode, this.swapSkillNode]
    for (const skillNode of skillNodes) {
      const boxNode = skillNode ? this.getSkillBox(skillNode) : null
      const childNode = boxNode?.getChildByName(nodeName) ?? null
      if (boxNode && boxNode !== ignoredBoxNode && childNode) {
        return childNode
      }
    }
    return null
  }

  // AmountBG 必须在 Count 下层；这里只调整同父节点下的渲染顺序，不改坐标、尺寸、缩放。
  private syncSkillBoxLayer(boxNode: Node) {
    const moreButtonNode = boxNode.getChildByName('MoreBtn')
    const amountBgNode = boxNode.getChildByName('AmountBG')
    const countNode = boxNode.getChildByName('Count')

    if (amountBgNode) {
      amountBgNode.setSiblingIndex(boxNode.children.length - 1)
    }
    if (moreButtonNode) {
      moreButtonNode.setSiblingIndex(boxNode.children.length - 1)
    }
    if (countNode) {
      countNode.setSiblingIndex(boxNode.children.length - 1)
    }
  }

  // 反馈层集中容纳技能提示和 Toast，避免临时节点散落在 Main 根节点。
  private ensureFeedbackLayer() {
    let layer = this.node.getChildByName('FeedbackLayer')
    if (!layer) {
      layer = new Node('FeedbackLayer')
      layer.setParent(this.node)
      layer.addComponent(UITransform)
    }

    const rootTransform = this.node.getComponent(UITransform)
    const layerTransform = layer.getComponent(UITransform) ?? layer.addComponent(UITransform)
    layerTransform.setContentSize(rootTransform?.width ?? 750, rootTransform?.height ?? 1334)
    layer.setPosition(0, 0, 0)
    this.feedbackLayer = layer
  }

  private ensureToast() {
    const parent = this.feedbackLayer ?? this.node
    let toast = parent.getChildByName('Toast')
    if (!toast) {
      toast = new Node('Toast')
      toast.setParent(parent)
      toast.addComponent(UITransform)
    }

    toast.active = false
    toast.setPosition(0, -360, 0)
    toast.getComponent(UITransform)?.setContentSize(500, 64)
    this.drawFeedbackBubble(toast, 500, 64, new Color(54, 75, 71, 235), new Color(255, 248, 220, 245))
    this.toastNode = toast
    this.toastOpacity = toast.getComponent(UIOpacity) ?? toast.addComponent(UIOpacity)

    const label = this.ensureFeedbackLabel(toast, 'Text', 23)
    label.string = ''
  }

  // 技能模式提示放在技能栏上方，明确告诉玩家可以拖动交换，也可以再次点击取消。
  private ensureSkillHint() {
    const parent = this.feedbackLayer ?? this.node
    let hintNode = parent.getChildByName('SkillModeHint')
    if (!hintNode) {
      hintNode = new Node('SkillModeHint')
      hintNode.setParent(parent)
      hintNode.addComponent(UITransform).setContentSize(520, 48)
    }

    hintNode.active = false
    hintNode.setScale(Vec3.ONE)
    this.skillHintNode = hintNode
    this.skillHintOpacity = hintNode.getComponent(UIOpacity) ?? hintNode.addComponent(UIOpacity)
    this.skillHintOpacity.opacity = 0

    this.drawFeedbackBubble(hintNode, 520, 48, new Color(74, 47, 20, 224), new Color(255, 244, 196, 238))
    const label = this.ensureFeedbackLabel(hintNode, 'Text', 23)
    label.string = '拖动相邻棋子交换，再点技能取消'
    label.color = new Color(255, 246, 210, 255)
    // 给提示文字加深色描边，保证在棋盘、背景和技能栏上方都能清楚识别。
    const outline = label.node.getComponent(LabelOutline) ?? label.node.addComponent(LabelOutline)
    outline.color = new Color(64, 38, 8, 255)
    outline.width = 2
  }

  private ensureFeedbackLabel(parent: Node, name: string, fontSize: number) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
      node.addComponent(Label)
    }

    node.setPosition(0, 0, 0)
    const parentTransform = parent.getComponent(UITransform)
    node.getComponent(UITransform)?.setContentSize(
      Math.max(0, (parentTransform?.width ?? 500) - 30),
      Math.max(0, (parentTransform?.height ?? 56) - 8)
    )
    const label = node.getComponent(Label) ?? node.addComponent(Label)
    label.fontSize = fontSize
    label.lineHeight = Math.ceil(fontSize * 1.25)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.isBold = true
    return label
  }

  private drawFeedbackBubble(node: Node, width: number, height: number, border: Color, fill: Color) {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = border
    graphics.roundRect(-width * 0.5, -height * 0.5, width, height, height * 0.5)
    graphics.fill()
    graphics.fillColor = fill
    graphics.roundRect(-width * 0.5 + 3, -height * 0.5 + 3, width - 6, height - 6, height * 0.5 - 3)
    graphics.fill()
  }

  // 第一个技能当前定义为炸弹技能，点击后进入点选爆炸中心模式。
  private onBombSkillButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.bombSkillHandler?.()
  }

  // 第二个技能当前定义为锤子技能，点击后进入点选敲碎模式。
  private onHammerSkillButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.hammerSkillHandler?.()
  }

  // 第三个技能当前定义为交换技能，点击后只把意图交给 PlayController 处理。
  private onSwapSkillButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.playButtonClickFeedback()
    this.swapSkillHandler?.()
  }

  private playButtonClickFeedback() {
    this.buttonClickHandler?.()
  }

  // 三个技能统一刷新选中、库存为空和本局已使用状态。
  private refreshSkillButtonState() {
    this.refreshSingleSkillVisual('bomb', this.bombSkillNode)
    this.refreshSingleSkillVisual('hammer', this.hammerSkillNode)
    this.refreshSingleSkillVisual('swap', this.swapSkillNode)
    this.refreshSkillCountDisplay()
    this.refreshSkillHintState(this.currentState.activeSkill)
  }

  private refreshSingleSkillVisual(skill: PlaySkillKind, skillNode: Node | null) {
    if (!skillNode) {
      return
    }

    const isActive = this.currentState.activeSkill === skill
    const isUsed = this.currentState.skillUsed[skill]
    const count = Math.max(0, this.currentState.skillCounts[skill])
    const visualKey = `${isActive}-${isUsed}-${count}`
    skillNode.getChildByName('SelectionRing')!.active = isActive && !isUsed && count > 0
    skillNode.getChildByName('UsedLabel')!.active = isUsed
    const opacity = skillNode.getComponent(UIOpacity) ?? skillNode.addComponent(UIOpacity)
    opacity.opacity = isUsed ? SKILL_DISABLED_OPACITY : count <= 0 ? SKILL_EMPTY_OPACITY : 255

    if (this.skillVisualKeys[skill] === visualKey) {
      return
    }
    this.skillVisualKeys[skill] = visualKey
    Tween.stopAllByTarget(skillNode)
    tween(skillNode)
      .to(0.1, { scale: isActive ? new Vec3(1.05, 1.05, 1) : Vec3.ONE }, { easing: 'quadOut' })
      .start()
  }

  // 技能库存使用小角标展示，库存为零时显示加号，本局已使用仍保留库存但整体置灰。
  private refreshSkillCountDisplay() {
    this.refreshSingleSkillCount('bomb', this.bombSkillNode)
    this.refreshSingleSkillCount('hammer', this.hammerSkillNode)
    this.refreshSingleSkillCount('swap', this.swapSkillNode)
  }

  private refreshSingleSkillCount(skill: PlaySkillKind, skillNode: Node | null) {
    const hasUsedThisGame = this.currentState.skillUsed[skill]
    if (!skillNode) {
      return
    }

    const boxNode = this.getSkillBox(skillNode)
    const moreButtonNode = boxNode.getChildByName('MoreBtn')
    const amountBgNode = boxNode.getChildByName('AmountBG')
    const countNode = boxNode.getChildByName('Count')

    const count = Math.max(0, Math.floor(this.currentState.skillCounts[skill]))
    const hasStock = count > 0
    const customBadge = skillNode.getChildByName('CountBadge')
    const customBadgeLabel = customBadge?.getChildByName('Value')?.getComponent(Label) ?? null
    if (customBadge) {
      customBadge.active = hasStock || !hasUsedThisGame
    }
    if (customBadgeLabel) {
      customBadgeLabel.string = hasStock ? (count >= 10 ? '9+' : `${count}`) : '+'
    }
    if (moreButtonNode) {
      // 静态层移除后不再依赖旧版 MoreBtn 图片，零库存统一由绿色角标显示加号。
      moreButtonNode.active = false
    }
    if (amountBgNode) {
      amountBgNode.active = false
    }
    if (countNode) {
      countNode.active = false
      const countSprite = countNode.getComponent(Sprite) ?? countNode.addComponent(Sprite)
      const spriteFrame = this.getCounterNumberSpriteFrame(count)
      countSprite.spriteFrame = spriteFrame
      countSprite.enabled = !!spriteFrame
      countSprite.sizeMode = Sprite.SizeMode.CUSTOM
      const fallback = this.ensureSkillCountFallback(countNode)
      fallback.node.active = !spriteFrame
      fallback.string = count >= 10 ? '9+' : `${count}`
    }
  }

  private ensureSkillCountFallback(countNode: Node) {
    let fallbackNode = countNode.getChildByName('FallbackLabel')
    if (!fallbackNode) {
      fallbackNode = new Node('FallbackLabel')
      fallbackNode.setParent(countNode)
      fallbackNode.addComponent(UITransform).setContentSize(28, 24)
      fallbackNode.addComponent(Label)
    }
    fallbackNode.setPosition(0, 0, 0)
    const label = fallbackNode.getComponent(Label) ?? fallbackNode.addComponent(Label)
    label.fontSize = 17
    label.lineHeight = 20
    label.color = new Color(255, 255, 255, 255)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.isBold = true
    return label
  }

  // counterNumberSpriteFrames 里的图片以 0-9 命名，优先按名字找，找不到时用下标兜底。
  private getCounterNumberSpriteFrame(count: number) {
    const displayCount = Math.min(9, Math.max(0, count))
    const displayName = `${displayCount}`
    return (
      this.counterNumberSpriteFrames.find((spriteFrame) => spriteFrame?.name === displayName) ??
      this.counterNumberSpriteFrames[displayCount] ??
      null
    )
  }

  // 技能激活时提示常驻并轻微呼吸，取消或施放结束时淡出。
  private refreshSkillHintState(activeSkill: PlayUIState['activeSkill']) {
    const isActive = activeSkill !== null
    if (!this.skillHintNode || !this.skillHintOpacity) {
      return
    }
    this.refreshSkillHintText(activeSkill)
    if (this.isSkillHintVisible === isActive) {
      return
    }

    this.isSkillHintVisible = isActive
    Tween.stopAllByTarget(this.skillHintNode)
    Tween.stopAllByTarget(this.skillHintOpacity)

    if (isActive) {
      this.updateSkillHintLayout()
      this.skillHintNode.active = true
      this.skillHintNode.setScale(new Vec3(0.96, 0.96, 1))
      this.skillHintOpacity.opacity = 0
      tween(this.skillHintOpacity).to(0.12, { opacity: 255 }, { easing: 'quadOut' }).start()
      tween(this.skillHintNode)
        .sequence(
          tween().to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }),
          tween()
            .repeatForever(
              tween()
                .sequence(
                  tween().to(0.48, { scale: new Vec3(1.04, 1.04, 1) }, { easing: 'sineInOut' }),
                  tween().to(0.48, { scale: Vec3.ONE }, { easing: 'sineInOut' })
                )
            )
        )
        .start()
      return
    }

    tween(this.skillHintOpacity)
      .to(0.1, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        if (this.skillHintNode) {
          this.skillHintNode.active = false
          this.skillHintNode.setScale(Vec3.ONE)
        }
      })
      .start()
  }

  // 不同技能使用同一个提示节点，文案随当前激活技能切换。
  private refreshSkillHintText(activeSkill: PlayUIState['activeSkill']) {
    if (!this.skillHintNode || !activeSkill) {
      return
    }

    const label = this.skillHintNode.getChildByName('Text')?.getComponent(Label) ?? null
    if (!label) {
      return
    }

    label.string = activeSkill === 'bomb'
      ? '点选中心棋子，炸碎周围棋子'
      : activeSkill === 'hammer'
        ? '点选一个棋子敲碎，再点技能取消'
        : '拖动相邻棋子交换，再点技能取消'
  }

  // 提示位置跟随技能栏，避免异形屏或 scene 调整后提示跑到错误位置。
  private updateSkillHintLayout() {
    if (!this.skillHintNode) {
      return
    }

    const skillsContainer = this.getSkillsContainer()
    if (!skillsContainer) {
      this.skillHintNode.setPosition(0, -400, 0)
      return
    }

    this.skillHintNode.setPosition(skillsContainer.position.x, skillsContainer.position.y + 120, 0)
  }

  // 技能栏节点历史上有拼写错误，这里同时兼容新旧两个名字。
  private getSkillsContainer() {
    return this.node.getChildByName('SkliisController') ?? this.node.getChildByName('SkillsController')
  }

  // 切场景返回首页时，节点引用可能非空但已进入销毁态，调用事件接口前必须确认仍有效。
  private canUseNode(node: Node | null): node is Node {
    return !!node && node.isValid
  }

  private safeOff(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(eventType, handler, this)
  }

  // 优先复用 scene 中已有的 Controller 节点，方便继续在层级管理器里调样式。
  private getControlContainer() {
    return this.node.getChildByName('Controller') ?? this.getSkillsContainer() ?? this.node
  }

  // 读取棋盘内区宽度，优先使用 BoardFill 的尺寸，避免和逻辑层出现偏差。
  private getBoardInnerWidth() {
    const fillTransform = this.node.getChildByName('board')?.getChildByName('BoardFill')?.getComponent(UITransform)
    if (fillTransform) {
      return fillTransform.width
    }

    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (boardTransform) {
      return boardTransform.width - BOARD_BORDER_WIDTH * 2
    }

    return this.boardwidth * (this.pieceSize + this.spacing)
  }

  // 读取棋盘内区高度，优先使用 BoardFill 的尺寸，保证 UI 与逻辑共用一套内区。
  private getBoardInnerHeight() {
    const fillTransform = this.node.getChildByName('board')?.getChildByName('BoardFill')?.getComponent(UITransform)
    if (fillTransform) {
      return fillTransform.height
    }

    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (boardTransform) {
      return boardTransform.height - BOARD_BORDER_WIDTH * 2
    }

    return this.boardheight * (this.pieceSize + this.spacing)
  }

  // 根据棋盘内区宽度计算每一列的中心点。
  private getBoardColumnCenterX(column: number) {
    const columnWidth = this.getBoardInnerWidth() / this.boardwidth
    return -this.getBoardInnerWidth() / 2 + columnWidth * (column + 0.5)
  }

  // 根据棋盘内区宽度计算列分隔线的位置。
  private getBoardSeparatorX(column: number) {
    const columnWidth = this.getBoardInnerWidth() / this.boardwidth
    return -this.getBoardInnerWidth() / 2 + columnWidth * (column + 1)
  }
}
