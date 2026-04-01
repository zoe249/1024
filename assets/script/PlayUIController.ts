import {
  _decorator,
  AudioSource,
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
  sys,
  Vec3
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
// 暂停面板滑入滑出的动画时长。
const PAUSE_PANEL_ANIM_DURATION = 0.26
// 暂停蒙版淡入淡出的动画时长。
const PAUSE_MASK_ANIM_DURATION = 0.18
// 暂停面板完全滑出屏幕右侧后额外保留一点距离，避免边缘露在屏幕内。
const PAUSE_PANEL_HIDDEN_GAP = 32
// 背景音乐音量本地存储键。
const AUDIO_MUSIC_VOLUME_KEY = 'play.audio.musicVolume'
// 音效音量本地存储键。
const AUDIO_SOUND_EFFECT_KEY = 'play.audio.soundEffectVolume'

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
  // 暂停弹窗根节点，由 scene 中的 PauseOverlay 提供。
  private pauseOverlay: Node | null = null
  // 半透明蒙版节点，只负责遮罩和拦截触摸。
  private pauseOverlayMask: Node | null = null
  // 右侧滑入的弹窗面板节点。
  private pauseOverlayPanel: Node | null = null
  // 记录面板在 scene 中配置好的最终显示位置，打开弹窗时滑到这里。
  private pausePanelShownPosition: Vec3 | null = null
  // 背景音乐控制行容器。
  private bgMusicControl: Node | null = null
  // 背景音乐滑块轨道节点。
  private bgMusicTrack: Node | null = null
  // 背景音乐滑块把手节点。
  private bgMusicThumb: Node | null = null
  // 背景音乐滑块把手在 scene 中配置的最左和最右位置，全部基于现有层级数据计算。
  private bgMusicThumbMinX = 0
  private bgMusicThumbMaxX = 0
  // 背景音乐滑块把手固定使用 scene 中配置好的纵向位置。
  private bgMusicThumbY = 0
  // 音效控制行容器。
  private soundEffectControl: Node | null = null
  // 音效滑块把手图标节点。
  private soundEffectIcon: Node | null = null
  // 音效滑块把手在 scene 中配置的最左和最右位置。
  private soundEffectThumbMinX = 0
  private soundEffectThumbMaxX = 0
  // 音效滑块把手固定使用 scene 中配置好的纵向位置。
  private soundEffectThumbY = 0
  // 当前背景音乐音量，范围固定在 0 到 1。
  private bgMusicVolume = 1
  // 当前音效音量，范围固定在 0 到 1。
  private soundEffectVolume = 1

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
    this.ensureAudioControls()
    this.configureControlBar()
    this.renderState(this.currentState)
  }

  // 某些平台启动后一帧安全区才稳定，因此开放一个额外布局入口给逻辑层补收。
  syncLayout() {
    this.configureControlBar()
    this.ensurePauseOverlayMaskSprite()
    this.configureAudioControlLayout()
    this.refreshAudioControls()
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
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_END, this.swallowOverlayTouch, this)
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
    this.bgMusicControl?.off(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.off(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.off(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.off(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.off(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.off(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.off(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.off(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.off(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.soundEffectControl?.off(Node.EventType.TOUCH_START, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.off(Node.EventType.TOUCH_MOVE, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.off(Node.EventType.TOUCH_END, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.off(Node.EventType.TOUCH_START, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.off(Node.EventType.TOUCH_MOVE, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.off(Node.EventType.TOUCH_END, this.onSoundEffectControlTouch, this)
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

  // 确保暂停弹窗节点存在；优先复用 scene 中已搭好的 PauseOverlay / Mask / Panel 结构。
  private ensurePauseOverlay() {
    const existing = this.node.getChildByName('PauseOverlay')
    if (existing) {
      this.pauseOverlay = existing
      // scene 里允许先保持可见方便调样式，但运行时首次进入游戏应从隐藏状态开始。
      this.pauseOverlay.active = false
      // 暂停层必须始终压在运行时生成的棋子之上，这里先把它放到当前最高层。
      this.pauseOverlay.setSiblingIndex(this.node.children.length - 1)
      this.pauseOverlayMask = existing.getChildByName('Mask') ?? null
      this.pauseOverlayPanel = existing.getChildByName('Panel') ?? null
      this.pausePanelShownPosition = this.pauseOverlayPanel?.position.clone() ?? null
      this.ensurePauseOverlayMaskSprite()
      this.bindPauseOverlayMask()
      return
    }

    const overlay = new Node('PauseOverlay')
    overlay.setParent(this.node)
    overlay.setSiblingIndex(999)
    overlay.active = false
    this.pauseOverlay = overlay

    const overlayTransform = overlay.addComponent(UITransform)
    overlayTransform.setContentSize(750, 1334)

    // 即使 scene 里没配，也补出最小可用的遮罩和面板结构，避免暂停按钮直接失效。
    const mask = new Node('Mask')
    mask.setParent(overlay)
    const maskTransform = mask.addComponent(UITransform)
    maskTransform.setContentSize(750, 1334)
    const maskSprite = mask.addComponent(Sprite)
    maskSprite.color = new Color(0, 0, 0, 160)
    this.pauseOverlayMask = mask
    this.ensurePauseOverlayMaskSprite()

    const panel = new Node('Panel')
    panel.setParent(overlay)
    const panelTransform = panel.addComponent(UITransform)
    panelTransform.setContentSize(360, 560)
    const panelSprite = panel.addComponent(Sprite)
    panelSprite.color = new Color(255, 255, 255, 255)
    panel.setPosition(150, 0, 0)
    this.pauseOverlayPanel = panel
    this.pausePanelShownPosition = panel.position.clone()
    this.bindPauseOverlayMask()
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

  // 根据 paused 状态播放暂停弹窗动画：蒙版淡入淡出，面板从右侧滑入滑出。
  private refreshPauseOverlay() {
    if (!this.pauseOverlay) {
      return
    }

    // 每次弹窗打开前都把暂停层提到最上面，避免被新生成的棋子或特效节点盖住。
    this.pauseOverlay.setSiblingIndex(this.node.children.length - 1)
    const maskNode = this.pauseOverlayMask ?? this.pauseOverlay
    const maskOpacity = maskNode.getComponent(UIOpacity) ?? maskNode.addComponent(UIOpacity)
    Tween.stopAllByTarget(maskOpacity)
    if (this.pauseOverlayPanel) {
      Tween.stopAllByTarget(this.pauseOverlayPanel)
    }

    if (this.currentState.isPaused) {
      this.pauseOverlay.active = true
      maskOpacity.opacity = 0
      tween(maskOpacity).to(PAUSE_MASK_ANIM_DURATION, { opacity: 255 }).start()

      if (this.pauseOverlayPanel) {
        const shown = this.getPausePanelShownPosition()
        this.pauseOverlayPanel.setPosition(this.getPausePanelHiddenX(), shown.y, shown.z)
        tween(this.pauseOverlayPanel)
          .to(PAUSE_PANEL_ANIM_DURATION, { position: shown }, { easing: 'cubicOut' })
          .start()
      }
    } else {
      if (!this.pauseOverlay.active) {
        maskOpacity.opacity = 0
        if (this.pauseOverlayPanel) {
          const shown = this.getPausePanelShownPosition()
          this.pauseOverlayPanel.setPosition(this.getPausePanelHiddenX(), shown.y, shown.z)
        }
        return
      }

      tween(maskOpacity).to(PAUSE_MASK_ANIM_DURATION, { opacity: 0 }).start()

      if (this.pauseOverlayPanel) {
        const shown = this.getPausePanelShownPosition()
        tween(this.pauseOverlayPanel)
          .to(
            PAUSE_PANEL_ANIM_DURATION,
            { position: new Vec3(this.getPausePanelHiddenX(), shown.y, shown.z) },
            { easing: 'cubicIn' }
          )
          .call(() => {
            // 关闭动画结束后再隐藏整层，避免面板刚开始滑出时整层直接消失。
            if (!this.currentState.isPaused) {
              if (this.pauseOverlay) {
                this.pauseOverlay.active = false
              }
            }
          })
          .start()
      } else {
        this.pauseOverlay.active = false
      }
    }
  }

  // 暂停按钮只负责把点击事件转交给逻辑层，避免 UI 层直接改状态。
  private onPauseButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.pauseHandler?.()
  }

  // 蒙版层只负责拦截触摸，防止暂停时点穿到底层棋盘和控制栏。
  private swallowOverlayTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  // 给蒙版补上统一的拦截事件绑定，避免重复绑定导致回调执行多次。
  private bindPauseOverlayMask() {
    if (!this.pauseOverlayMask) {
      return
    }

    this.pauseOverlayMask.off(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.off(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.off(Node.EventType.TOUCH_END, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.off(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.on(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.on(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.on(Node.EventType.TOUCH_END, this.swallowOverlayTouch, this)
    this.pauseOverlayMask.on(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
  }

  // Mask 节点强制使用可显示的 SpriteFrame，避免空 SpriteFrame 导致蒙版完全不显示。
  private ensurePauseOverlayMaskSprite() {
    if (!this.pauseOverlayMask) {
      return
    }

    const maskTransform = this.pauseOverlayMask.getComponent(UITransform)
    const maskSprite = this.pauseOverlayMask.getComponent(Sprite)
    if (!maskTransform || !maskSprite) {
      return
    }

    const rootSprite = this.node.getComponent(Sprite)
    if (!maskSprite.spriteFrame && rootSprite?.spriteFrame) {
      // 复用场景根节点已有的背景 SpriteFrame，确保蒙版一定有可渲染贴图。
      maskSprite.spriteFrame = rootSprite.spriteFrame
    }

    maskSprite.enabled = true
    maskSprite.sizeMode = Sprite.SizeMode.CUSTOM
    maskSprite.type = Sprite.Type.SIMPLE
    // 蒙版只需要统一压暗画面，因此固定使用半透明黑色。
    maskSprite.color = new Color(0, 0, 0, 170)
    maskTransform.setContentSize(maskTransform.width, maskTransform.height)
  }

  // 复用 Panel 中已搭好的音乐和音效节点，补上交互、存档和视觉状态。
  private ensureAudioControls() {
    const panel = this.pauseOverlayPanel ?? this.node.getChildByName('PauseOverlay')?.getChildByName('Panel') ?? null
    if (!panel) {
      return
    }

    this.bgMusicControl = panel.getChildByName('Music On') ?? null
    this.bgMusicTrack = this.bgMusicControl?.getChildByName('BgMusic') ?? null
    this.bgMusicThumb = this.bgMusicControl?.getChildByName('options_icon_512px') ?? null
    this.soundEffectControl = panel.getChildByName('Notifications') ?? null
    this.soundEffectIcon = this.soundEffectControl?.getChildByName('options_icon_512px') ?? null

    this.loadAudioSettings()
    this.configureAudioControlLayout()
    this.bindAudioControlEvents()
    this.refreshAudioControls()
    this.applyAudioSettings()
  }

  // 读取本地保存的背景音乐和音效音量，保证玩家下次进入游戏时保持上次设置。
  private loadAudioSettings() {
    const savedVolume = Number.parseFloat(sys.localStorage.getItem(AUDIO_MUSIC_VOLUME_KEY) ?? '1')
    if (Number.isFinite(savedVolume)) {
      this.bgMusicVolume = Math.max(0, Math.min(1, savedVolume))
    }

    const savedEffectVolume = Number.parseFloat(sys.localStorage.getItem(AUDIO_SOUND_EFFECT_KEY) ?? '1')
    if (Number.isFinite(savedEffectVolume)) {
      this.soundEffectVolume = Math.max(0, Math.min(1, savedEffectVolume))
    }
  }

  // 音频控件的尺寸、图片和排版都以 scene 为准，这里只缓存交互所需的位置数据。
  private configureAudioControlLayout() {
    if (this.bgMusicThumb) {
      this.bgMusicThumb.active = true
      this.bgMusicThumbMaxX = this.bgMusicThumb.position.x
      this.bgMusicThumbY = this.bgMusicThumb.position.y
    }

    const soundEffectTrack = this.soundEffectControl?.getChildByName('SoundEffect') ?? null
    if (this.bgMusicTrack) {
      const bgTrackTransform = this.bgMusicTrack.getComponent(UITransform)
      const bgTrackHalfWidth = bgTrackTransform ? bgTrackTransform.width * 0.5 : 0
      // 轨道起点取 scene 中轨道节点的左边缘，保证视觉更长，但不改节点尺寸。
      this.bgMusicThumbMinX = this.bgMusicTrack.position.x - bgTrackHalfWidth + 8
    }

    if (this.soundEffectIcon) {
      this.soundEffectIcon.active = true
      this.soundEffectThumbMaxX = this.soundEffectIcon.position.x
      this.soundEffectThumbY = this.soundEffectIcon.position.y
    }

    if (soundEffectTrack && this.soundEffectIcon) {
      const soundTrackTransform = soundEffectTrack.getComponent(UITransform)
      const soundTrackHalfWidth = soundTrackTransform ? soundTrackTransform.width * 0.5 : 0
      // 音效同样使用轨道左边缘作为最小值位置，和背景音乐保持一致的交互模型。
      this.soundEffectThumbMinX = soundEffectTrack.position.x - soundTrackHalfWidth + 8
    }
  }

  // 统一绑定背景音乐和音效滑块拖动事件，先解绑再绑定避免重复触发。
  private bindAudioControlEvents() {
    this.bgMusicControl?.off(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.off(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.off(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.off(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.off(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.off(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.off(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.off(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.off(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.on(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.on(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicControl?.on(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.on(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.on(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicTrack?.on(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.on(Node.EventType.TOUCH_START, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.on(Node.EventType.TOUCH_MOVE, this.onBgMusicControlTouch, this)
    this.bgMusicThumb?.on(Node.EventType.TOUCH_END, this.onBgMusicControlTouch, this)

    this.soundEffectControl?.off(Node.EventType.TOUCH_START, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.off(Node.EventType.TOUCH_MOVE, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.off(Node.EventType.TOUCH_END, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.off(Node.EventType.TOUCH_START, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.off(Node.EventType.TOUCH_MOVE, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.off(Node.EventType.TOUCH_END, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.on(Node.EventType.TOUCH_START, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.on(Node.EventType.TOUCH_MOVE, this.onSoundEffectControlTouch, this)
    this.soundEffectControl?.on(Node.EventType.TOUCH_END, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.on(Node.EventType.TOUCH_START, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.on(Node.EventType.TOUCH_MOVE, this.onSoundEffectControlTouch, this)
    this.soundEffectIcon?.on(Node.EventType.TOUCH_END, this.onSoundEffectControlTouch, this)
  }

  // 根据当前设置刷新两条音量滑块的视觉状态。
  private refreshAudioControls() {
    this.redrawBgMusicSlider()
    this.redrawSoundEffectToggle()
  }

  // 音量变化后立即刷新本地状态、视觉状态和真实音频源。
  private setBgMusicVolume(volume: number, persist = true) {
    this.bgMusicVolume = Math.max(0, Math.min(1, volume))
    if (persist) {
      sys.localStorage.setItem(AUDIO_MUSIC_VOLUME_KEY, this.bgMusicVolume.toString())
    }

    this.refreshAudioControls()
    this.applyAudioSettings()
  }

  // 音效音量变化后同步保存，并立即影响后续音效播放。
  private setSoundEffectVolume(volume: number, persist = true) {
    this.soundEffectVolume = Math.max(0, Math.min(1, volume))
    if (persist) {
      sys.localStorage.setItem(AUDIO_SOUND_EFFECT_KEY, this.soundEffectVolume.toString())
    }

    this.refreshAudioControls()
    this.applyAudioSettings()
  }

  // 背景音乐滑块支持点击和拖动，直接把触摸点映射到 0 到 1 的音量范围。
  private onBgMusicControlTouch(event: EventTouch) {
    event.propagationStopped = true
    if (!this.bgMusicControl) {
      return
    }

    const controlTransform = this.bgMusicControl.getComponent(UITransform)
    if (!controlTransform) {
      return
    }

    const uiLocation = event.getUILocation()
    const local = controlTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
    const minX = Math.min(this.bgMusicThumbMinX, this.bgMusicThumbMaxX)
    const maxX = Math.max(this.bgMusicThumbMinX, this.bgMusicThumbMaxX)
    const volume = (local.x - minX) / Math.max(1, maxX - minX)
    this.setBgMusicVolume(volume)
  }

  // 音效滑块支持点击和拖动，直接把触摸点映射到 0 到 1 的音量范围。
  private onSoundEffectControlTouch(event: EventTouch) {
    event.propagationStopped = true
    if (!this.soundEffectControl) {
      return
    }

    const controlTransform = this.soundEffectControl.getComponent(UITransform)
    if (!controlTransform) {
      return
    }

    const uiLocation = event.getUILocation()
    const local = controlTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
    const minX = Math.min(this.soundEffectThumbMinX, this.soundEffectThumbMaxX)
    const maxX = Math.max(this.soundEffectThumbMinX, this.soundEffectThumbMaxX)
    const volume = (local.x - minX) / Math.max(1, maxX - minX)
    this.setSoundEffectVolume(volume)
  }

  // 背景音乐滑块保留 scene 中已有图片尺寸，只移动右侧图片并重绘轨道。
  private redrawBgMusicSlider() {
    const trackNode = this.bgMusicTrack
    const trackTransform = trackNode?.getComponent(UITransform)
    const trackGraphics = trackNode?.getComponent(Graphics)
    if (!trackNode || !trackTransform || !trackGraphics) {
      return
    }

    const width = Math.max(1, Math.abs(this.bgMusicThumbMaxX - this.bgMusicThumbMinX))
    const visualHeight = Math.max(12, Math.min(18, trackTransform.height * 0.18))
    const radius = visualHeight * 0.5
    const knobX = this.bgMusicThumbMinX + (this.bgMusicThumbMaxX - this.bgMusicThumbMinX) * this.bgMusicVolume
    const startX = Math.min(this.bgMusicThumbMinX, this.bgMusicThumbMaxX) - trackNode.position.x

    trackGraphics.clear()
    trackGraphics.fillColor = new Color(59, 53, 74, 255)
    trackGraphics.roundRect(startX, -visualHeight * 0.5, width, visualHeight, radius)
    trackGraphics.fill()

    trackGraphics.fillColor = new Color(255, 214, 149, 255)
    trackGraphics.roundRect(
      startX,
      -visualHeight * 0.5,
      Math.max(visualHeight, width * this.bgMusicVolume),
      visualHeight,
      radius
    )
    trackGraphics.fill()

    if (this.bgMusicThumb) {
      // 滑块把手直接复用 scene 中给定的图片和尺寸，这里只更新位置。
      this.bgMusicThumb.active = true
      this.bgMusicThumb.setPosition(knobX, this.bgMusicThumbY, 0)
    }
  }

  // 音效音量条和背景音乐保持同一套滑块表现，只复用 scene 中已有图片作为把手。
  private redrawSoundEffectToggle() {
    const toggleNode = this.soundEffectControl?.getChildByName('SoundEffect') ?? null
    const toggleTransform = toggleNode?.getComponent(UITransform)
    const toggleGraphics = toggleNode?.getComponent(Graphics)
    if (!toggleNode || !toggleTransform || !toggleGraphics) {
      return
    }

    const width = Math.max(1, Math.abs(this.soundEffectThumbMaxX - this.soundEffectThumbMinX))
    const visualHeight = Math.max(12, Math.min(18, toggleTransform.height * 0.18))
    const radius = visualHeight * 0.5
    const knobX = this.soundEffectThumbMinX + (this.soundEffectThumbMaxX - this.soundEffectThumbMinX) * this.soundEffectVolume
    const startX = Math.min(this.soundEffectThumbMinX, this.soundEffectThumbMaxX) - toggleNode.position.x

    toggleGraphics.clear()
    toggleGraphics.fillColor = new Color(59, 53, 74, 255)
    toggleGraphics.roundRect(startX, -visualHeight * 0.5, width, visualHeight, radius)
    toggleGraphics.fill()

    toggleGraphics.fillColor = new Color(255, 214, 149, 255)
    toggleGraphics.roundRect(
      startX,
      -visualHeight * 0.5,
      Math.max(visualHeight, width * this.soundEffectVolume),
      visualHeight,
      radius
    )
    toggleGraphics.fill()

    const rowSprite = this.soundEffectControl?.getComponent(Sprite)
    if (rowSprite) {
      rowSprite.color = new Color(255, 255, 255, 255)
    }

    const iconSprite = this.soundEffectIcon?.getComponent(Sprite)
    if (iconSprite && this.soundEffectIcon) {
      iconSprite.color = new Color(255, 255, 255, 255)
      this.soundEffectIcon.setPosition(knobX, this.soundEffectThumbY, 0)
    }
  }

  // 如果场景后续挂了 AudioSource，这里会自动把 UI 设置同步到真实音频源。
  private applyAudioSettings() {
    const audioSources = this.node.getComponentsInChildren(AudioSource)
    for (const audioSource of audioSources) {
      const lowerName = audioSource.node.name.toLowerCase()
      if (lowerName.includes('bgm') || lowerName.includes('music')) {
        audioSource.volume = this.bgMusicVolume
        continue
      }

      if (lowerName.includes('sfx') || lowerName.includes('effect') || lowerName.includes('sound')) {
        audioSource.volume = this.soundEffectVolume
      }
    }
  }

  // 读取 scene 中配置好的面板最终显示位置，后续打开弹窗都滑到这里。
  private getPausePanelShownPosition() {
    if (this.pausePanelShownPosition) {
      return this.pausePanelShownPosition.clone()
    }

    return this.pauseOverlayPanel?.position.clone() ?? Vec3.ZERO.clone()
  }

  // 根据当前屏幕宽度和面板宽度，动态计算完全滑出屏幕右侧后的隐藏位置。
  private getPausePanelHiddenX() {
    const overlayTransform = this.pauseOverlay?.getComponent(UITransform)
    const panelTransform = this.pauseOverlayPanel?.getComponent(UITransform)
    const shown = this.getPausePanelShownPosition()
    if (!overlayTransform || !panelTransform) {
      return shown.x
    }

    const overlayHalfWidth = overlayTransform.width * 0.5
    const panelHalfWidth = panelTransform.width * 0.5
    return overlayHalfWidth + panelHalfWidth + PAUSE_PANEL_HIDDEN_GAP
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
