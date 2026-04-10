import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  screen,
  Sprite,
  tween,
  Tween,
  UITransform,
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
// 棋盘边框颜色。
const BOARD_FRAME_COLOR = new Color(255, 215, 0, 255)
// 棋盘底色。
const BOARD_FILL_COLOR = new Color(255, 175, 0, 255)
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
// 虚线颜色。
const BOARD_DASH_COLOR = new Color(223, 146, 10, 150)

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
    isResolving: false
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

  // 由逻辑层在启动时调用，把棋盘尺寸和交互回调交给 UI 层管理。
  setup(options: {
    boardwidth: number
    boardheight: number
    pieceSize: number
    spacing: number
    onPauseTap: () => void
  }) {
    this.boardwidth = options.boardwidth
    this.boardheight = options.boardheight
    this.pieceSize = options.pieceSize
    this.spacing = options.spacing
    this.pauseHandler = options.onPauseTap

    this.fitBackgroundToScreen()
    this.ensureBoardDecorations()
    this.ensureScoreDisplay()
    // this.ensureStatusLabel()
    // this.ensurePauseButton()
    this.ensurePauseOverlay()
    this.configureControlBar()
    this.configureStatusBar()
    this.renderState(this.currentState)
  }

  // 某些平台启动后一帧安全区才稳定，因此开放一个额外布局入口给逻辑层补收。
  syncLayout() {
    this.configureControlBar()
    this.configureStatusBar()
    this.pauseOverlayController?.syncLayout()
  }

  // 逻辑层每次状态变化后只需要把结果喂给 UI 层即可。
  renderState(state: PlayUIState) {
    this.currentState = state
    this.refreshScoreDisplay()
    // this.refreshStatus()
    // this.refreshPauseButton()
    this.pauseOverlayController?.renderState(this.currentState.isPaused)
  }

  onDestroy() {
    // UI 组件自己负责解绑按钮事件，避免逻辑层还要知道具体节点层级。
    this.getControlContainer().getChildByName('PauseButton')?.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
    Tween.stopAllByTarget(this.scoreTweenState)
    this.scoreNumberLabel = null
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

  // 纯代码绘制棋盘边框、底色和列虚线，并同步列节点占位尺寸。
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
    // 先填满外框，再覆盖内层底色，避免边框与底色之间出现缝隙。
    frameGraphics.fillColor = BOARD_FRAME_COLOR
    frameGraphics.roundRect(
      -innerWidth / 2 - BOARD_BORDER_WIDTH,
      -innerHeight / 2 - BOARD_BORDER_WIDTH,
      innerWidth + BOARD_BORDER_WIDTH * 2,
      innerHeight + BOARD_BORDER_WIDTH * 2,
      BOARD_OUTER_RADIUS
    )
    frameGraphics.fill()
    frameGraphics.fillColor = BOARD_FILL_COLOR
    frameGraphics.roundRect(-innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight, BOARD_INNER_RADIUS)
    frameGraphics.fill()

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

    const dashedTransform = dashedLines.getComponent(UITransform) ?? dashedLines.addComponent(UITransform)
    dashedTransform.setContentSize(innerWidth, innerHeight)

    const graphics = dashedLines.getComponent(Graphics) ?? dashedLines.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = BOARD_DASH_COLOR

    const top = innerHeight / 2 - BOARD_DASH_INSET
    const bottom = -innerHeight / 2 + BOARD_DASH_INSET
    for (let column = 0; column < this.boardwidth - 1; column++) {
      const x = this.getBoardSeparatorX(column)
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
    }
    graphics.fill()
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
