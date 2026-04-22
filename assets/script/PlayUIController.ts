import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  screen,
  Sprite,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  sys
} from 'cc'
import { PauseOverlayController } from './PauseOverlayController'

const { ccclass } = _decorator

// UI 层只关心界面展示所需的最小状态，不参与棋盘运算和合并逻辑。
export type PlayUIState = {
  currentValue: number | null
  score: number
  isGameOver: boolean
  isPaused: boolean
  isResolving: boolean
  activeSkill: 'bomb' | 'hammer' | 'swap' | null
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
  windowHeight?: number
  screenTop?: number
}

// 棋盘边框厚度，UI 绘制和棋盘内区布局都会基于这个值计算。
const BOARD_BORDER_WIDTH = 20
// 棋盘内层圆角与棋子圆角保持一致，保证视觉统一。
const BOARD_INNER_RADIUS = 8
// 棋盘外层玻璃阴影色，用很低透明度替代原来的实色边框。
const BOARD_GLASS_SHADOW_COLOR = new Color(28, 56, 70, 68)
// 棋盘主体玻璃蒙版色改成浅青蓝灰，保持冷色调但不过度压暗。
const BOARD_GLASS_TINT_COLOR = new Color(116, 190, 214, 52)
// 棋盘内区玻璃底色只做浅冷雾化，避免变成厚重实色背景。
const BOARD_GLASS_INNER_COLOR = new Color(156, 220, 236, 30)
// 棋盘列的轻量蒙版色，用交替透明块让五列仍然可识别。
const BOARD_COLUMN_TINT_COLOR = new Color(188, 238, 248, 20)
// 棋盘列边缘柔光色，让虚线和玻璃面板看起来是一体的。
const BOARD_COLUMN_EDGE_COLOR = new Color(126, 216, 238, 48)
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
const BOARD_DASH_COLOR = new Color(214, 248, 255, 92)

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
    score: 0,
    isGameOver: false,
    isPaused: false,
    isResolving: false,
    activeSkill: null
  }
  // 顶部状态栏文字。
  // private statusLabel: Label | null = null
  // 底部暂停按钮文字。
  private pauseButtonLabel: Label | null = null
  // 分数数值文本直接复用 scene 里的 Score/Number 节点，UI 层只负责刷新显示。
  private scoreNumberLabel: Label | null = null
  // 当前已经显示到界面的分数，数字滚动动画会从这个值补间到目标值。
  private displayedScore = 0
  // Tween 直接驱动这个简单对象，避免去改节点缩放或位置。
  private readonly scoreTweenState = { value: 0 }
  // 暂停弹窗相关逻辑全部拆到独立组件，这里只保留组件引用和调用入口。
  private pauseOverlayController: PauseOverlayController | null = null
  // 缓存第一个技能节点，和其他技能共用选中态与取消提示。
  private bombSkillNode: Node | null = null
  // 缓存第三个技能节点，便于刷新选中态和销毁时解绑事件。
  private swapSkillNode: Node | null = null
  // 缓存第二个技能节点，和第三技能共用同一套技能态表现。
  private hammerSkillNode: Node | null = null
  // 技能施放提示由运行时生成，避免为了一个提示再要求手动维护 scene 节点。
  private skillHintNode: Node | null = null
  // 提示透明度单独缓存，方便做进入、闪烁和退出动画。
  private skillHintOpacity: UIOpacity | null = null
  // 记录提示当前是否显示，避免每帧刷新状态时重复重启动画。
  private isSkillHintVisible = false

  // 由逻辑层在启动时调用，把棋盘尺寸和交互回调交给 UI 层管理。
  setup(options: {
    boardwidth: number
    boardheight: number
    pieceSize: number
    spacing: number
    onPauseTap: () => void
    onBombSkillTap: () => void
    onHammerSkillTap: () => void
    onSwapSkillTap: () => void
  }) {
    this.boardwidth = options.boardwidth
    this.boardheight = options.boardheight
    this.pieceSize = options.pieceSize
    this.spacing = options.spacing
    this.pauseHandler = options.onPauseTap
    this.bombSkillHandler = options.onBombSkillTap
    this.hammerSkillHandler = options.onHammerSkillTap
    this.swapSkillHandler = options.onSwapSkillTap

    this.fitBackgroundToScreen()
    this.ensureBoardDecorations()
    this.ensureScoreDisplay()
    this.ensureSkillButtons()
    this.ensureSkillHint()
    // this.ensureStatusLabel()
    // this.ensurePauseButton()
    this.ensurePauseOverlay()
    this.configureControlBar()
    this.configureStatusBar()
    this.updateSkillHintLayout()
    this.renderState(this.currentState)
  }

  // 某些平台启动后一帧安全区才稳定，因此开放一个额外布局入口给逻辑层补收。
  syncLayout() {
    this.configureControlBar()
    this.configureStatusBar()
    this.updateSkillHintLayout()
    this.pauseOverlayController?.syncLayout()
  }

  // 逻辑层每次状态变化后只需要把结果喂给 UI 层即可。
  renderState(state: PlayUIState) {
    this.currentState = state
    this.refreshScoreDisplay()
    this.refreshSkillButtonState()
    // this.refreshStatus()
    // this.refreshPauseButton()
    this.pauseOverlayController?.renderState(this.currentState.isPaused)
  }

  onDestroy() {
    // UI 组件自己负责解绑按钮事件，避免逻辑层还要知道具体节点层级。
    this.getControlContainer().getChildByName('PauseButton')?.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
    this.bombSkillNode?.off(Node.EventType.TOUCH_END, this.onBombSkillButtonTap, this)
    this.hammerSkillNode?.off(Node.EventType.TOUCH_END, this.onHammerSkillButtonTap, this)
    this.swapSkillNode?.off(Node.EventType.TOUCH_END, this.onSwapSkillButtonTap, this)
    Tween.stopAllByTarget(this.scoreTweenState)
    if (this.skillHintNode) {
      Tween.stopAllByTarget(this.skillHintNode)
    }
    if (this.skillHintOpacity) {
      Tween.stopAllByTarget(this.skillHintOpacity)
    }
    if (this.bombSkillNode) {
      Tween.stopAllByTarget(this.bombSkillNode)
    }
    if (this.hammerSkillNode) {
      Tween.stopAllByTarget(this.hammerSkillNode)
    }
    if (this.swapSkillNode) {
      Tween.stopAllByTarget(this.swapSkillNode)
    }
    this.scoreNumberLabel = null
    this.bombSkillNode = null
    this.hammerSkillNode = null
    this.swapSkillNode = null
    this.skillHintNode = null
    this.skillHintOpacity = null
    this.pauseOverlayController = null
  }

  // 背景节点依然挂在 play 根节点上，这里只负责把它铺满整个画布。
  private fitBackgroundToScreen() {
    const selfTransform = this.node.getComponent(UITransform)
    const parentTransform = this.node.parent?.getComponent(UITransform) ?? null
    if (!selfTransform || !parentTransform) {
      return
    }

    selfTransform.setContentSize(parentTransform.width, parentTransform.height)

    const bgSprite = this.node.getComponent(Sprite)
    if (bgSprite) {
      bgSprite.sizeMode = Sprite.SizeMode.CUSTOM
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
    let overlay = this.node.getChildByName('PauseOverlay')
    if (!overlay) {
      overlay = new Node('PauseOverlay')
      overlay.setParent(this.node)
      overlay.active = false
      overlay.addComponent(UITransform).setContentSize(750, 1334)
    }

    this.pauseOverlayController = overlay.getComponent(PauseOverlayController) ?? overlay.addComponent(PauseOverlayController)
    this.pauseOverlayController.setup({ hostNode: this.node, pauseHandler: this.pauseHandler })
  }

  // 分数显示优先复用 Status/Content 下已经配好的 Score/Number 节点，不改 scene 布局。
  private ensureScoreDisplay() {
    const statusContent = this.node.getChildByName('Status')?.getChildByName('Content')
    const scoreNode =
      statusContent?.getChildByName('Score') ??
      statusContent?.getChildByName('Source') ??
      this.node.getChildByName('Score') ??
      this.node.getChildByName('Source')
    this.scoreNumberLabel = scoreNode?.getChildByName('Number')?.getComponent(Label) ?? null
    this.displayedScore = this.currentState.score
    this.scoreTweenState.value = this.currentState.score
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

    // 控制栏的贴底位置交给 scene 里的 Widget 处理，这里只根据安全区补高度。
    controlTransform.setContentSize(controlTransform.width, totalHeight)
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
  private getWechatMenuMetrics(): { menuRect: WechatMenuButtonRect; windowHeight: number; screenTop: number } | null {
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
    this.pauseHandler?.()
  }

  // 技能按钮节点来自 scene 层级，UI 层只负责绑定点击事件和表现选中状态。
  private ensureSkillButtons() {
    const skillsContainer = this.getSkillsContainer()
    this.bombSkillNode = skillsContainer?.getChildByName('Skill1') ?? null
    this.hammerSkillNode = skillsContainer?.getChildByName('Skill2') ?? null
    this.swapSkillNode = skillsContainer?.getChildByName('Skill3') ?? null
    if (this.bombSkillNode) {
      this.bombSkillNode.off(Node.EventType.TOUCH_END, this.onBombSkillButtonTap, this)
      this.bombSkillNode.on(Node.EventType.TOUCH_END, this.onBombSkillButtonTap, this)
    }
    if (this.hammerSkillNode) {
      this.hammerSkillNode.off(Node.EventType.TOUCH_END, this.onHammerSkillButtonTap, this)
      this.hammerSkillNode.on(Node.EventType.TOUCH_END, this.onHammerSkillButtonTap, this)
    }
    if (!this.swapSkillNode) {
      return
    }

    this.swapSkillNode.off(Node.EventType.TOUCH_END, this.onSwapSkillButtonTap, this)
    this.swapSkillNode.on(Node.EventType.TOUCH_END, this.onSwapSkillButtonTap, this)
  }

  // 技能模式提示放在技能栏上方，明确告诉玩家可以拖动交换，也可以再次点击取消。
  private ensureSkillHint() {
    let hintNode = this.node.getChildByName('SkillModeHint')
    if (!hintNode) {
      hintNode = new Node('SkillModeHint')
      hintNode.setParent(this.node)
      hintNode.addComponent(UITransform).setContentSize(520, 48)
    }

    hintNode.active = false
    hintNode.setScale(Vec3.ONE)
    this.skillHintNode = hintNode
    this.skillHintOpacity = hintNode.getComponent(UIOpacity) ?? hintNode.addComponent(UIOpacity)
    this.skillHintOpacity.opacity = 0

    const label = hintNode.getComponent(Label) ?? hintNode.addComponent(Label)
    label.string = '拖动相邻棋子交换，再点技能取消'
    label.fontSize = 25
    label.lineHeight = 32
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(255, 246, 210, 255)
    // 给提示文字加深色描边，保证在棋盘、背景和技能栏上方都能清楚识别。
    const outline = hintNode.getComponent(LabelOutline) ?? hintNode.addComponent(LabelOutline)
    outline.color = new Color(64, 38, 8, 255)
    outline.width = 3
  }

  // 第一个技能当前定义为炸弹技能，点击后进入点选爆炸中心模式。
  private onBombSkillButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.bombSkillHandler?.()
  }

  // 第二个技能当前定义为锤子技能，点击后进入点选敲碎模式。
  private onHammerSkillButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.hammerSkillHandler?.()
  }

  // 第三个技能当前定义为交换技能，点击后只把意图交给 PlayController 处理。
  private onSwapSkillButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.swapSkillHandler?.()
  }

  // 交换技能激活时给按钮一个轻量反馈，避免玩家不知道已经进入拖拽选棋状态。
  private refreshSkillButtonState() {
    const isBombActive = this.currentState.activeSkill === 'bomb'
    const isHammerActive = this.currentState.activeSkill === 'hammer'
    const isSwapActive = this.currentState.activeSkill === 'swap'
    if (this.bombSkillNode) {
      Tween.stopAllByTarget(this.bombSkillNode)
      tween(this.bombSkillNode)
        .to(0.08, { scale: isBombActive ? new Vec3(1.08, 1.08, 1) : Vec3.ONE }, { easing: 'quadOut' })
        .start()
    }
    if (this.hammerSkillNode) {
      Tween.stopAllByTarget(this.hammerSkillNode)
      tween(this.hammerSkillNode)
        .to(0.08, { scale: isHammerActive ? new Vec3(1.08, 1.08, 1) : Vec3.ONE }, { easing: 'quadOut' })
        .start()
    }
    if (this.swapSkillNode) {
      Tween.stopAllByTarget(this.swapSkillNode)
      tween(this.swapSkillNode)
        .to(0.08, { scale: isSwapActive ? new Vec3(1.08, 1.08, 1) : Vec3.ONE }, { easing: 'quadOut' })
        .start()
    }
    this.refreshSkillHintState(this.currentState.activeSkill)
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

    const label = this.skillHintNode.getComponent(Label)
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

  // 优先复用 scene 中已有的 Controller 节点，方便继续在层级管理器里调样式。
  private getControlContainer() {
    return this.node.getChildByName('Controller') ?? this.node
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
