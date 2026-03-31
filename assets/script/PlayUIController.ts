import {
  _decorator,
  Button,
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
  UIOpacity,
  SafeArea,
  sys
} from 'cc'

const { ccclass } = _decorator

// UI 层只关心界面展示所需的最小状态，不参与棋盘运算和合并逻辑。
export type PlayUIState = {
  currentValue: number | null
  isGameOver: boolean
  isPaused: boolean
  isResolving: boolean
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
  // UI 层缓存当前展示状态，便于统一刷新状态栏、按钮和遮罩。
  private currentState: PlayUIState = {
    currentValue: null,
    isGameOver: false,
    isPaused: false,
    isResolving: false
  }
  // 顶部状态栏文字。
  private statusLabel: Label | null = null
  // 底部暂停按钮文字。
  private pauseButtonLabel: Label | null = null
  // 暂停遮罩节点。
  private pauseOverlay: Node | null = null
  private pauseOverlayTitle: Label | null = null
  private pauseOverlayHint: Label | null = null

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
    this.ensureStatusLabel()
    this.ensurePauseButton()
    this.ensurePauseOverlay()
    this.configureControlBar()
    this.renderState(this.currentState)
  }

  // 某些平台启动后一帧安全区才稳定，因此开放一个额外布局入口给逻辑层补收。
  syncLayout() {
    this.configureControlBar()
  }

  // 逻辑层每次状态变化后只需要把结果喂给 UI 层即可。
  renderState(state: PlayUIState) {
    this.currentState = state
    this.refreshStatus()
    this.refreshPauseButton()
    this.refreshPauseOverlay()
  }

  onDestroy() {
    // UI 组件自己负责解绑按钮事件，避免逻辑层还要知道具体节点层级。
    this.getControlContainer().getChildByName('PauseButton')?.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
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
  private ensureStatusLabel() {
    const existing = this.node.getChildByName('StatusLabel')
    if (existing) {
      this.statusLabel = existing.getComponent(Label)
      return
    }

    const labelNode = new Node('StatusLabel')
    labelNode.setParent(this.node)
    labelNode.setPosition(0, 565, 0)

    const transform = labelNode.addComponent(UITransform)
    transform.setContentSize(680, 80)

    const label = labelNode.addComponent(Label)
    label.fontSize = 28
    label.lineHeight = 34
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.color = new Color(250, 246, 242, 255)

    this.statusLabel = label
  }

  // 确保底部控制栏里的暂停按钮存在；如果 scene 已经配好，就直接复用。
  private ensurePauseButton() {
    const container = this.getControlContainer()
    const existing = container.getChildByName('PauseButton')
    if (existing) {
      this.pauseButtonLabel = existing.getChildByName('Label')?.getComponent(Label) ?? null
      existing.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
      existing.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
      return
    }

    const buttonNode = new Node('PauseButton')
    buttonNode.setParent(container)
    buttonNode.setPosition(0, 0, 0)

    const transform = buttonNode.addComponent(UITransform)
    transform.setContentSize(140, 56)
    buttonNode.addComponent(Button)

    const bg = buttonNode.addComponent(Sprite)
    bg.color = new Color(37, 55, 80, 235)

    const labelNode = new Node('Label')
    labelNode.setParent(buttonNode)
    labelNode.setPosition(0, 0, 0)
    const labelTransform = labelNode.addComponent(UITransform)
    labelTransform.setContentSize(140, 56)

    const label = labelNode.addComponent(Label)
    label.string = 'Pause'
    label.fontSize = 26
    label.lineHeight = 30
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(245, 250, 255, 255)

    buttonNode.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
    this.pauseButtonLabel = label
  }

  // 确保暂停遮罩存在；逻辑层只关心 paused 状态，具体节点和动画都由 UI 层负责。
  private ensurePauseOverlay() {
    const existing = this.node.getChildByName('PauseOverlay')
    if (existing) {
      this.pauseOverlay = existing
      this.pauseOverlayTitle = existing.getChildByName('Title')?.getComponent(Label) ?? null
      this.pauseOverlayHint = existing.getChildByName('Hint')?.getComponent(Label) ?? null
      return
    }

    const overlay = new Node('PauseOverlay')
    overlay.setParent(this.node)
    overlay.setSiblingIndex(999)
    overlay.active = false
    this.pauseOverlay = overlay

    const overlayTransform = overlay.addComponent(UITransform)
    overlayTransform.setContentSize(750, 1334)

    const overlayBg = overlay.addComponent(Sprite)
    overlayBg.color = new Color(10, 16, 24, 150)

    const titleNode = new Node('Title')
    titleNode.setParent(overlay)
    titleNode.setPosition(0, 70, 0)
    const titleTransform = titleNode.addComponent(UITransform)
    titleTransform.setContentSize(420, 80)
    const titleLabel = titleNode.addComponent(Label)
    titleLabel.string = 'Paused'
    titleLabel.fontSize = 54
    titleLabel.lineHeight = 60
    titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER
    titleLabel.color = new Color(250, 252, 255, 255)
    this.pauseOverlayTitle = titleLabel

    const hintNode = new Node('Hint')
    hintNode.setParent(overlay)
    hintNode.setPosition(0, -5, 0)
    const hintTransform = hintNode.addComponent(UITransform)
    hintTransform.setContentSize(500, 60)
    const hintLabel = hintNode.addComponent(Label)
    hintLabel.string = 'Tap the top-right button to resume'
    hintLabel.fontSize = 24
    hintLabel.lineHeight = 30
    hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER
    hintLabel.color = new Color(210, 220, 235, 255)
    this.pauseOverlayHint = hintLabel
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
    // const safeArea = screen.safeAreaRect
    const safeBottom = safeArea ? (safeArea.y / screen.windowSize.height) * rootTransform.height : 0
    if (this.controlBarBaseHeight <= 0) {
      // 把 scene 中当前控制栏高度记为基准高度，后续不再覆盖编辑器里的布局配置。
      this.controlBarBaseHeight = controlTransform.height
    }
    const baseHeight = this.controlBarBaseHeight
    const totalHeight = baseHeight + safeBottom

    // 控制栏的贴底位置交给 scene 里的 Widget 处理，这里只根据安全区补高度。
    controlTransform.setContentSize(controlTransform.width, totalHeight)

    // 按钮节点的垂直居中交给 scene 里的 Widget 和当前控制栏高度共同决定，
    // 这里不再单独抬高暂停按钮，避免小程序安全区环境下出现额外上移。
  }

  // 把当前逻辑状态翻译成状态栏文本。
  private refreshStatus() {
    if (!this.statusLabel) {
      return
    }

    if (this.currentState.isGameOver) {
      this.statusLabel.string = 'Game Over - Tap to restart'
      return
    }

    if (this.currentState.isResolving) {
      this.statusLabel.string = 'Resolving...'
      return
    }

    if (this.currentState.isPaused) {
      this.statusLabel.string = 'Paused'
      return
    }

    if (!this.currentState.currentValue) {
      this.statusLabel.string = ''
      return
    }

    this.statusLabel.string = `Current ${this.currentState.currentValue} - Drag to choose column, tap to fast drop until landing`
  }

  // 根据 paused 状态刷新按钮文案和颜色。
  private refreshPauseButton() {
    if (!this.pauseButtonLabel) {
      return
    }

    this.pauseButtonLabel.string = this.currentState.isPaused ? 'Resume' : 'Pause'
    const bg = this.pauseButtonLabel.node.parent?.getComponent(Sprite)
    if (bg) {
      bg.color = this.currentState.isPaused ? new Color(73, 111, 83, 240) : new Color(37, 55, 80, 235)
    }
  }

  // 根据 paused 状态显示或隐藏遮罩，并播放简单的淡入动画。
  private refreshPauseOverlay() {
    if (!this.pauseOverlay) {
      return
    }

    const opacity = this.pauseOverlay.getComponent(UIOpacity) ?? this.pauseOverlay.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)

    if (this.currentState.isPaused) {
      this.pauseOverlay.active = true
      opacity.opacity = 0
      tween(opacity).to(0.12, { opacity: 255 }).start()
    } else {
      opacity.opacity = 0
      this.pauseOverlay.active = false
    }

    if (this.pauseOverlayTitle) {
      this.pauseOverlayTitle.string = 'Paused'
    }

    if (this.pauseOverlayHint) {
      this.pauseOverlayHint.string = 'Tap the top-right button to resume'
    }
  }

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
