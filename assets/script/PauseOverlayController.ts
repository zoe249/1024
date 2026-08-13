import {
  _decorator,
  AudioSource,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UITransform,
  UIOpacity,
  sys,
  Vec3
} from 'cc'

const { ccclass, property } = _decorator

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
// 游戏中设置弹窗按 750 × 1334 定稿适配；左右保留 65 像素安全边距。
const PAUSE_PANEL_WIDTH = 620
const PAUSE_PANEL_HEIGHT = 770
const PAUSE_UTILITY_BUTTON_WIDTH = 210
const PAUSE_UTILITY_BUTTON_HEIGHT = 145
const PAUSE_GAME_BUTTON_WIDTH = 250
const PAUSE_GAME_BUTTON_HEIGHT = 88
// 滑块轨道略向右收窄，并把旋钮活动区内缩半个旋钮宽度，避免静音时压住左侧图标。
const PAUSE_SLIDER_TRACK_WIDTH = 356
const PAUSE_SLIDER_TRACK_CENTER_X = 12
const PAUSE_SLIDER_KNOB_WIDTH = 64
const PAUSE_SLIDER_KNOB_HEIGHT = 68
const PAUSE_SLIDER_DEFAULT_KNOB_X =
  PAUSE_SLIDER_TRACK_CENTER_X + PAUSE_SLIDER_TRACK_WIDTH * 0.5 - PAUSE_SLIDER_KNOB_WIDTH * 0.5
const PAUSE_TEXT_COLOR = new Color(81, 55, 37, 255)
const GENERATED_BACKGROUND_NAME = 'GeneratedBackground'
const SETTINGS_ART_ROOT = 'Settings/'

const SettingsArtwork = {
  panel: 'panel-background',
  title: 'title-settings',
  close: 'button-close',
  sound: 'icon-sound',
  music: 'icon-music',
  sliderTrack: 'slider-track-empty',
  sliderFill: 'slider-fill',
  sliderKnob: 'slider-knob',
  share: 'button-share-friend',
  feedback: 'button-customer-feedback',
  home: 'button-return-home',
  replay: 'button-restart'
} as const

@ccclass('PauseOverlayController')
export class PauseOverlayController extends Component {
  // 持有 play 根节点引用，方便复用背景图和同步整局的音频源。
  private hostNode: Node | null = null
  // 半透明蒙版节点，只负责遮罩和拦截触摸。
  private pauseOverlayMask: Node | null = null
  // 右侧滑入的弹窗面板节点。
  private pauseOverlayPanel: Node | null = null
  // 记录面板在 scene 中配置好的最终显示位置，打开弹窗时滑到这里。
  private pausePanelShownPosition: Vec3 | null = null
  // 背景音乐控制行容器。
  private bgMusicControl: Node | null = null
  // 背景音乐滑块根节点。
  private bgMusicSlider: Node | null = null
  // 背景音乐滑块空槽节点。
  private bgMusicSliderBase: Node | null = null
  // 背景音乐滑块填充节点。
  private bgMusicFill: Node | null = null
  // 背景音乐滑块控制点节点。
  private bgMusicController: Node | null = null
  // 背景音乐滑块控制点在 scene 中配置的最左和最右位置。
  private bgMusicControllerMinX = 0
  private bgMusicControllerMaxX = 0
  // 音效控制行容器。
  private soundEffectControl: Node | null = null
  // 音效滑块根节点。
  private soundEffectSlider: Node | null = null
  // 音效滑块空槽节点。
  private soundEffectSliderBase: Node | null = null
  // 音效滑块填充节点。
  private soundEffectFill: Node | null = null
  // 音效滑块控制点节点。
  private soundEffectController: Node | null = null
  // 音效滑块控制点在 scene 中配置的最左和最右位置。
  private soundEffectControllerMinX = 0
  private soundEffectControllerMaxX = 0
  // 当前背景音乐音量，范围固定在 0 到 1。
  private bgMusicVolume = 1
  // 当前音效音量，范围固定在 0 到 1。
  private soundEffectVolume = 1
  // 记录当前暂停状态，只让弹窗脚本关心自己是否该显示。
  private isPaused = false
  // 由逻辑层注入的暂停切换回调，按钮点击后只通知逻辑，不直接改游戏状态。
  private pauseHandler: (() => void) | null = null
  // 暂停层重玩按钮只通知逻辑层重开当前对局。
  private replayHandler: (() => void) | null = null
  // 暂停层回首页按钮只通知逻辑层保存对局并切换到首页场景。
  private homeHandler: (() => void) | null = null
  // 分享和反馈只派发平台意图，暂停组件自身不访问平台 API。
  private shareHandler: (() => void) | null = null
  private feedbackHandler: (() => void) | null = null
  // 回首页会销毁当前游戏场景，点击后只派发一次，避免连续触摸重复触发解绑和切场景。
  private isReturningHome = false
  // 关闭弹窗的按钮
  @property({ type: Node, tooltip: '关闭按钮节点' })
  private closeButtonNode: Node | null = null
  // 面板里的 Play/继续按钮，点击后和关闭按钮一样通知逻辑层恢复游戏。
  private playButtonNode: Node | null = null
  // 层级管理器中配置的重玩按钮节点，兼容当前 Repay 命名和标准 Replay 命名。
  private replayButtonNode: Node | null = null
  // 层级管理器中配置的回首页按钮节点。
  private homeButtonNode: Node | null = null
  private shareButtonNode: Node | null = null
  private feedbackButtonNode: Node | null = null
  private utilityActionsNode: Node | null = null
  private gameActionsNode: Node | null = null

  // 由外部 UI 组件在启动时调用，把 play 根节点传进来；暂停层只绑定已有按钮，不创建额外层级。
  setup(options: {
    hostNode: Node
    pauseHandler: (() => void) | null
    replayHandler: (() => void) | null
    homeHandler: (() => void) | null
    shareHandler: (() => void) | null
    feedbackHandler: (() => void) | null
  }) {
    this.hostNode = options.hostNode
    this.pauseHandler = options.pauseHandler
    this.replayHandler = options.replayHandler
    this.homeHandler = options.homeHandler
    this.shareHandler = options.shareHandler
    this.feedbackHandler = options.feedbackHandler
    this.isReturningHome = false
    this.ensureOverlayStructure()
    this.ensurePauseOverlayMaskSprite()
    this.bindPauseOverlayMask()
    this.ensureAudioControls()
    this.configurePausePanelLayout()
    this.configureAudioControlLayout()
    this.refreshAudioControls()
    this.bindPlayButton()
    this.bindPauseActionButtons()
    this.layoutPauseActionButtons()
    this.refreshPauseOverlay()

    // 绑定关闭按钮事件，点击后调用 pauseHandler 继续游戏
    this.safeOff(this.closeButtonNode, Node.EventType.TOUCH_END, this.onCloseButtonTap)
    this.safeOn(this.closeButtonNode, Node.EventType.TOUCH_END, this.onCloseButtonTap)
  }

  // 某些平台安全区和尺寸会在首帧后稳定，这里补一次遮罩和滑块布局收口。
  syncLayout() {
    if (this.isReturningHome) {
      return
    }

    this.ensurePauseOverlayMaskSprite()
    this.configurePausePanelLayout()
    this.configureAudioControlLayout()
    this.layoutPauseActionButtons()
    this.refreshAudioControls()
    this.refreshPauseOverlay()
  }

  // 外部只需要告诉暂停层当前是否暂停，具体动画和显示细节全部交给弹窗脚本。
  renderState(isPaused: boolean) {
    if (this.isReturningHome) {
      return
    }

    this.isPaused = isPaused
    this.refreshPauseOverlay()
  }

  onDestroy() {
    this.unscheduleAllCallbacks()
    this.stopPauseOverlayTweens()
    this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_START, this.swallowOverlayTouch)
    this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch)
    this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_END, this.swallowOverlayTouch)
    this.safeOff(this.pauseOverlayMask, Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch)
    this.unbindSliderTouchEvents([this.bgMusicControl, this.bgMusicSlider, this.bgMusicController], this.onBgMusicControlTouch)
    this.unbindSliderTouchEvents(
      [this.soundEffectControl, this.soundEffectSlider, this.soundEffectController],
      this.onSoundEffectControlTouch
    )
    this.safeOff(this.closeButtonNode, Node.EventType.TOUCH_END, this.onCloseButtonTap)
    this.unbindPauseActionButton(this.playButtonNode, this.onCloseButtonTap)
    this.unbindPauseActionButton(this.replayButtonNode, this.onReplayButtonTap)
    this.unbindPauseActionButton(this.homeButtonNode, this.onHomeButtonTap)
    this.unbindPauseActionButton(this.shareButtonNode, this.onShareButtonTap)
    this.unbindPauseActionButton(this.feedbackButtonNode, this.onFeedbackButtonTap)
  }

  // PauseOverlay 节点优先复用 scene 中现成的 Mask 和 Panel，缺失时再补最小结构。
  private ensureOverlayStructure() {
    this.node.active = false
    // 暂停层必须压在棋子和特效上方，避免打开弹窗后仍被运行时节点遮挡。
    this.bringNodeToTop(this.node)

    const overlayTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    if (overlayTransform.width <= 0 || overlayTransform.height <= 0) {
      overlayTransform.setContentSize(750, 1334)
    }

    let mask = this.node.getChildByName('Mask')
    if (!mask) {
      mask = new Node('Mask')
      mask.setParent(this.node)
      const maskTransform = mask.addComponent(UITransform)
      maskTransform.setContentSize(overlayTransform.width, overlayTransform.height)
      mask.addComponent(Sprite)
    }
    this.pauseOverlayMask = mask

    let panel = this.node.getChildByName('Panel')
    if (!panel) {
      panel = new Node('Panel')
      panel.setParent(this.node)
      const panelTransform = panel.addComponent(UITransform)
      panelTransform.setContentSize(360, 560)
      panel.addComponent(Sprite)
      panel.setPosition(150, 0, 0)
    }
    this.pauseOverlayPanel = panel
    this.pausePanelShownPosition = panel.position.clone()
  }

  // 设置面板严格按游戏中定稿分区：标题、双滑块、平台操作和游戏操作依次向下排列。
  private configurePausePanelLayout() {
    const panel = this.pauseOverlayPanel
    if (!panel) {
      return
    }

    const panelTransform = panel.getComponent(UITransform) ?? panel.addComponent(UITransform)
    panelTransform.setContentSize(PAUSE_PANEL_WIDTH, PAUSE_PANEL_HEIGHT)
    panel.setPosition(0, -78, 0)
    this.pausePanelShownPosition = panel.position.clone()
    this.applyArtwork(panel, SettingsArtwork.panel, PAUSE_PANEL_WIDTH, PAUSE_PANEL_HEIGHT)
    const generatedBackground = panel.getChildByName(GENERATED_BACKGROUND_NAME)
    if (generatedBackground) {
      generatedBackground.active = false
    }

    const titleNode = panel.getChildByName('SettingLabel')
    const titleLabel = titleNode?.getComponent(Label) ?? null
    if (titleNode) {
      titleNode.setPosition(0, 356, 0)
      titleNode.getComponent(UITransform)?.setContentSize(250, 110)
      if (titleLabel) {
        titleLabel.enabled = false
      }
      const titleArtwork = this.ensureArtworkNode(titleNode, 'TitleArtwork')
      this.applyArtwork(titleArtwork, SettingsArtwork.title, 250, 110)
    }

    this.closeButtonNode = this.closeButtonNode ?? panel.getChildByName('CloseBtn')
    if (this.closeButtonNode) {
      this.closeButtonNode.setPosition(258, 328, 0)
      this.applyArtwork(this.closeButtonNode, SettingsArtwork.close, 72, 74)
    }

    // 定稿要求“音效”在上、“音量（背景音乐）”在下，节点历史命名不再决定视觉顺序。
    this.layoutAudioControl(this.soundEffectControl, 218, '音效', SettingsArtwork.sound)
    this.layoutAudioControl(this.bgMusicControl, 92, '音量', SettingsArtwork.music)
    this.ensureSeparator(panel, 'AudioSeparator', 12)
    this.ensureSeparator(panel, 'ActionSeparator', -193)
  }

  private layoutAudioControl(control: Node | null, y: number, title: string, iconArtwork: string) {
    if (!this.canUseNode(control)) {
      return
    }
    control.setPosition(-202, y, 0)
    this.applyArtwork(control, iconArtwork, 92, 97)

    const labelNode = this.ensureLabelNode(control, 'RowTitle')
    labelNode.setPosition(104, 31, 0)
    labelNode.getComponent(UITransform)?.setContentSize(140, 38)
    const label = labelNode.getComponent(Label)!
    label.string = title
    label.fontSize = 27
    label.lineHeight = 34
    label.color = PAUSE_TEXT_COLOR
    label.isBold = true
    label.horizontalAlign = Label.HorizontalAlign.LEFT
    label.verticalAlign = Label.VerticalAlign.CENTER

    const slider = control.getChildByName('Slider')
    if (!slider) {
      return
    }
    slider.setPosition(242, -18, 0)
    const sliderTransform = slider.getComponent(UITransform) ?? slider.addComponent(UITransform)
    sliderTransform.setContentSize(400, 72)
    sliderTransform.setAnchorPoint(0.5, 0.5)
    const base = slider.getChildByName('SliderBase')
    const fill = slider.getChildByName('Fill')
    const knob = slider.getChildByName('Controller')
    if (base) {
      base.setPosition(PAUSE_SLIDER_TRACK_CENTER_X, 0, 0)
      ;(base.getComponent(UITransform) ?? base.addComponent(UITransform)).setAnchorPoint(0.5, 0.5)
      this.applyArtwork(base, SettingsArtwork.sliderTrack, PAUSE_SLIDER_TRACK_WIDTH, 40)
    }
    if (fill) {
      fill.setPosition(PAUSE_SLIDER_TRACK_CENTER_X, 0, 0)
      ;(fill.getComponent(UITransform) ?? fill.addComponent(UITransform)).setAnchorPoint(0.5, 0.5)
      this.applyArtwork(fill, SettingsArtwork.sliderFill, PAUSE_SLIDER_TRACK_WIDTH, 42)
    }
    if (knob) {
      knob.setPosition(PAUSE_SLIDER_DEFAULT_KNOB_X, 0, 0)
      ;(knob.getComponent(UITransform) ?? knob.addComponent(UITransform)).setAnchorPoint(0.5, 0.5)
      this.applyArtwork(knob, SettingsArtwork.sliderKnob, PAUSE_SLIDER_KNOB_WIDTH, PAUSE_SLIDER_KNOB_HEIGHT)
    }
  }

  // 蒙版层只负责拦截触摸，防止暂停时点穿到底层棋盘和控制栏。
  private swallowOverlayTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  private onCloseButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.pauseHandler?.()
  }

  private onReplayButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.replayHandler?.()
  }

  private onHomeButtonTap(event: EventTouch) {
    event.propagationStopped = true
    if (this.isReturningHome) {
      return
    }

    this.isReturningHome = true
    this.stopPauseOverlayTweens()
    // 等当前 TOUCH_END 派发结束后再切场景，避免按钮节点被销毁时事件系统还在继续访问它。
    this.scheduleOnce(() => this.homeHandler?.(), 0)
  }

  private onShareButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.shareHandler?.()
  }

  private onFeedbackButtonTap(event: EventTouch) {
    event.propagationStopped = true
    this.feedbackHandler?.()
  }

  // 定稿通过右上角关闭按钮继续游戏，旧 Play 节点只保留序列化兼容，不再占用底部空间。
  private bindPlayButton() {
    this.playButtonNode = this.findExistingPauseActionNode(['Play', 'Save', 'Continue'])
    if (this.playButtonNode) {
      this.unbindPauseActionButton(this.playButtonNode, this.onCloseButtonTap)
      this.playButtonNode.active = false
    }
  }

  // 固定按钮优先复用 Scene 节点；迁移期缺失的分享、反馈挂点只补到明确的固定容器中。
  private bindPauseActionButtons() {
    this.replayButtonNode = this.findExistingPauseActionNode(['Repay', 'Replay'])
    this.homeButtonNode = this.findExistingPauseActionNode(['Home'])
    this.ensurePauseActionStructure()
    this.bindPauseActionButton(this.replayButtonNode, this.onReplayButtonTap)
    this.bindPauseActionButton(this.homeButtonNode, this.onHomeButtonTap)
    this.bindPauseActionButton(this.shareButtonNode, this.onShareButtonTap)
    this.bindPauseActionButton(this.feedbackButtonNode, this.onFeedbackButtonTap)
  }

  // 平台操作和游戏操作各占一行；返回首页与重新开始严格等宽、同高、水平对齐。
  private layoutPauseActionButtons() {
    if (!this.pauseOverlayPanel) {
      return
    }

    this.utilityActionsNode?.setPosition(0, -94, 0)
    this.gameActionsNode?.setPosition(0, -272, 0)
    if (this.canUseNode(this.shareButtonNode)) {
      this.shareButtonNode.setPosition(-133, 0, 0)
    }
    if (this.canUseNode(this.feedbackButtonNode)) {
      this.feedbackButtonNode.setPosition(133, 0, 0)
    }
    if (this.canUseNode(this.homeButtonNode)) {
      this.homeButtonNode.setPosition(-140, 0, 0)
    }
    if (this.canUseNode(this.replayButtonNode)) {
      this.replayButtonNode.setPosition(140, 0, 0)
    }
  }

  private ensurePauseActionStructure() {
    const panel = this.pauseOverlayPanel
    if (!panel) {
      return
    }

    this.utilityActionsNode = this.ensureContainer(panel, 'UtilityActions', 560, PAUSE_UTILITY_BUTTON_HEIGHT)
    this.gameActionsNode = this.ensureContainer(panel, 'GameActions', 560, PAUSE_GAME_BUTTON_HEIGHT)
    this.shareButtonNode =
      this.findChildDeep(panel, ['ShareButton', 'Share']) ?? this.createActionNode(this.utilityActionsNode, 'ShareButton')
    this.feedbackButtonNode =
      this.findChildDeep(panel, ['FeedbackButton', 'Feedback']) ??
      this.createActionNode(this.utilityActionsNode, 'FeedbackButton')

    this.moveNodeToContainer(this.shareButtonNode, this.utilityActionsNode)
    this.moveNodeToContainer(this.feedbackButtonNode, this.utilityActionsNode)
    this.moveNodeToContainer(this.homeButtonNode, this.gameActionsNode)
    this.moveNodeToContainer(this.replayButtonNode, this.gameActionsNode)

    this.styleArtworkButton(
      this.shareButtonNode,
      SettingsArtwork.share,
      PAUSE_UTILITY_BUTTON_WIDTH,
      PAUSE_UTILITY_BUTTON_HEIGHT
    )
    this.styleArtworkButton(
      this.feedbackButtonNode,
      SettingsArtwork.feedback,
      PAUSE_UTILITY_BUTTON_WIDTH,
      PAUSE_UTILITY_BUTTON_HEIGHT
    )
    this.styleArtworkButton(this.homeButtonNode, SettingsArtwork.home, PAUSE_GAME_BUTTON_WIDTH, PAUSE_GAME_BUTTON_HEIGHT)
    this.styleArtworkButton(
      this.replayButtonNode,
      SettingsArtwork.replay,
      PAUSE_GAME_BUTTON_WIDTH,
      PAUSE_GAME_BUTTON_HEIGHT
    )
  }

  private ensureContainer(parent: Node, name: string, width: number, height: number) {
    let container = parent.getChildByName(name)
    if (!container) {
      container = new Node(name)
      container.setParent(parent)
      container.addComponent(UITransform)
    }
    const transform = container.getComponent(UITransform) ?? container.addComponent(UITransform)
    transform.setContentSize(width, height)
    return container
  }

  private createActionNode(parent: Node, name: string) {
    const node = new Node(name)
    node.setParent(parent)
    node.addComponent(UITransform)
    return node
  }

  private moveNodeToContainer(node: Node | null, container: Node | null) {
    if (!this.canUseNode(node) || !this.canUseNode(container) || node.parent === container) {
      return
    }
    node.setParent(container)
  }

  // 操作按钮直接使用设计稿拆分出的完整按钮素材，避免符号图标和临时底板破坏手绘风格。
  private styleArtworkButton(node: Node | null, artwork: string, width: number, height: number) {
    if (!this.canUseNode(node)) {
      return
    }

    node.active = true
    for (const child of node.children) {
      if (child.name === GENERATED_BACKGROUND_NAME || child.name === 'Icon' || child.name === 'Text') {
        child.active = false
      }
    }
    this.applyArtwork(node, artwork, width, height)
  }

  /**
   * 从 resources/Settings 异步加载单张轻量 SpriteFrame。
   * 节点的点击区域先按定稿尺寸落位，因此首次加载素材时不会产生布局跳动。
   */
  private applyArtwork(node: Node, artwork: string, width: number, height: number) {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.enabled = true
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.type = Sprite.Type.SIMPLE
    sprite.trim = false
    sprite.color = Color.WHITE

    resources.load(`${SETTINGS_ART_ROOT}${artwork}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !this.canUseNode(node)) {
        console.warn(`[设置弹窗] 素材加载失败: ${artwork}`, error)
        return
      }
      sprite.spriteFrame = spriteFrame
      transform.setContentSize(width, height)
      if (artwork === SettingsArtwork.sliderFill) {
        const base = node.parent?.getChildByName('SliderBase') ?? null
        const controller = node.parent?.getChildByName('Controller') ?? null
        const range = this.getSliderRange(base, controller)
        if (range) {
          this.prepareSliderFill(node, range.trackWidth, range.trackMinX)
          this.refreshAudioControls()
        }
      }
    })
  }

  private ensureArtworkNode(parent: Node, name: string) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
      node.addComponent(Sprite)
    }
    node.active = true
    node.setPosition(Vec3.ZERO)
    return node
  }

  private ensureLabelNode(parent: Node, name: string) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
      node.addComponent(Label)
    }
    node.active = true
    return node
  }

  // 两条细分隔线只用 Graphics 绘制，不为 3 像素直线额外引入纹理。
  private ensureSeparator(parent: Node, name: string, y: number) {
    let node = parent.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(parent)
      node.addComponent(UITransform)
      node.addComponent(Graphics)
    }
    node.active = true
    node.setPosition(0, y, 0)
    node.getComponent(UITransform)?.setContentSize(510, 8)
    const graphics = node.getComponent(Graphics)!
    graphics.clear()
    graphics.lineWidth = 3
    graphics.strokeColor = new Color(112, 76, 49, 70)
    graphics.moveTo(-255, 0)
    graphics.lineTo(255, 0)
    graphics.stroke()
  }

  // 按钮可能已经迁移到动作容器，递归查找可以兼容旧 Scene 和新 Scene 两种层级。
  private findExistingPauseActionNode(names: string[]) {
    const parents = [this.node, this.pauseOverlayPanel, this.pauseOverlayMask]
    for (const parent of parents) {
      if (!parent) {
        continue
      }
      const node = this.findChildDeep(parent, names)
      if (node) {
        return node
      }
    }
    return null
  }

  private findChildDeep(parent: Node, names: string[]): Node | null {
    for (const child of parent.children) {
      if (names.indexOf(child.name) >= 0) {
        return child
      }
      const nested = this.findChildDeep(child, names)
      if (nested) {
        return nested
      }
    }
    return null
  }

  // 按钮节点自己拦截触摸过程，避免事件继续传到底层棋盘或遮罩。
  private bindPauseActionButton(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    this.unbindPauseActionButton(node, endHandler)
    node.on(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    node.on(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    node.on(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
    node.on(Node.EventType.TOUCH_END, endHandler, this)
  }

  // 销毁或重复 setup 前统一解绑，避免一次点击触发多次回调。
  private unbindPauseActionButton(node: Node | null, endHandler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    node.off(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    node.off(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
    node.off(Node.EventType.TOUCH_END, endHandler, this)
  }

  // 给蒙版补上统一的拦截事件绑定，避免重复绑定导致回调执行多次。
  private bindPauseOverlayMask() {
    const maskNode = this.pauseOverlayMask
    if (!this.canUseNode(maskNode)) {
      return
    }

    this.safeOff(maskNode, Node.EventType.TOUCH_START, this.swallowOverlayTouch)
    this.safeOff(maskNode, Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch)
    this.safeOff(maskNode, Node.EventType.TOUCH_END, this.swallowOverlayTouch)
    this.safeOff(maskNode, Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch)
    maskNode.on(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    maskNode.on(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    maskNode.on(Node.EventType.TOUCH_END, this.swallowOverlayTouch, this)
    maskNode.on(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
  }

  // 切场景销毁节点时，旧引用可能还没置空但已经不可用，所有事件解绑前都先走这里。
  private canUseNode(node: Node | null): node is Node {
    return !!node && node.isValid
  }

  private safeOn(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.on(eventType, handler, this)
  }

  private safeOff(node: Node | null, eventType: string, handler: (event: EventTouch) => void) {
    if (!this.canUseNode(node)) {
      return
    }

    node.off(eventType, handler, this)
  }

  // setSiblingIndex 只有在节点仍挂在父节点下时才安全，切场景销毁边界上必须先保护。
  private bringNodeToTop(node: Node | null) {
    const parent = node?.parent ?? null
    if (!this.canUseNode(node) || !parent?.isValid) {
      return
    }

    node.setSiblingIndex(parent.children.length - 1)
  }

  // 回首页和销毁时统一停止暂停层动画，避免 tween 在节点销毁后继续访问内部 parent。
  private stopPauseOverlayTweens() {
    this.stopNodeTreeTweens(this.node)
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

    const rootSprite = this.hostNode?.getComponent(Sprite)
    if (!maskSprite.spriteFrame && rootSprite?.spriteFrame) {
      // 复用 play 根节点已有的背景 SpriteFrame，确保蒙版一定有可渲染贴图。
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
    const panel = this.pauseOverlayPanel
    if (!panel) {
      return
    }

    this.bgMusicControl = panel.getChildByName('BgSound') ?? panel.getChildByName('Music On') ?? null
    this.bgMusicSlider = this.bgMusicControl?.getChildByName('Slider') ?? null
    this.bgMusicSliderBase = this.bgMusicSlider?.getChildByName('SliderBase') ?? null
    this.bgMusicFill = this.bgMusicSlider?.getChildByName('Fill') ?? null
    this.bgMusicController = this.bgMusicSlider?.getChildByName('Controller') ?? null
    this.soundEffectControl = panel.getChildByName('Notifications') ?? null
    this.soundEffectSlider = this.soundEffectControl?.getChildByName('Slider') ?? null
    this.soundEffectSliderBase = this.soundEffectSlider?.getChildByName('SliderBase') ?? null
    this.soundEffectFill = this.soundEffectSlider?.getChildByName('Fill') ?? null
    this.soundEffectController = this.soundEffectSlider?.getChildByName('Controller') ?? null

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

  /**
   * 根据轨道与旋钮的实际尺寸计算活动范围。
   * 旋钮中心内缩到轨道内部，因此 0% 时左缘对齐轨道左缘，100% 时右缘对齐轨道右缘。
   */
  private getSliderRange(baseNode: Node | null, controllerNode: Node | null) {
    const baseTransform = baseNode?.getComponent(UITransform)
    const controllerTransform = controllerNode?.getComponent(UITransform)
    if (!baseNode || !baseTransform || !controllerTransform) {
      return null
    }

    const trackMinX = baseNode.position.x - baseTransform.width * baseTransform.anchorX
    const trackMaxX = trackMinX + baseTransform.width
    const minX = trackMinX + controllerTransform.width * controllerTransform.anchorX
    const maxX = trackMaxX - controllerTransform.width * (1 - controllerTransform.anchorX)
    if (maxX < minX) {
      return null
    }

    return {
      minX,
      maxX,
      trackMinX,
      trackWidth: baseTransform.width
    }
  }

  // Fill 改用 Sprite 自带的横向填充，显示时只裁剪贴图，不再通过改宽度拉伸素材。
  private prepareSliderFill(fillNode: Node | null, fullWidth: number, trackMinX: number) {
    const fillTransform = fillNode?.getComponent(UITransform)
    const fillSprite = fillNode?.getComponent(Sprite)
    if (!fillNode || !fillTransform || !fillSprite) {
      return
    }

    fillSprite.type = Sprite.Type.FILLED
    fillSprite.fillType = Sprite.FillType.HORIZONTAL
    fillSprite.fillStart = 0
    fillTransform.setContentSize(fullWidth, fillTransform.height)
    fillNode.setPosition(trackMinX + fullWidth * fillTransform.anchorX, fillNode.position.y, fillNode.position.z)
  }

  // 一次性处理多个滑块相关节点的触摸绑定，减少重复代码，也避免漏绑或重复绑。
  private bindSliderTouchEvents(nodes: Array<Node | null>, handler: (event: EventTouch) => void) {
    this.unbindSliderTouchEvents(nodes, handler)
    for (const node of nodes) {
      if (!this.canUseNode(node)) {
        continue
      }

      node.on(Node.EventType.TOUCH_START, handler, this)
      node.on(Node.EventType.TOUCH_MOVE, handler, this)
      node.on(Node.EventType.TOUCH_END, handler, this)
    }
  }

  // 销毁时统一解绑滑块触摸事件，避免界面关闭后残留回调。
  private unbindSliderTouchEvents(nodes: Array<Node | null>, handler: (event: EventTouch) => void) {
    for (const node of nodes) {
      if (!this.canUseNode(node)) {
        continue
      }

      node.off(Node.EventType.TOUCH_START, handler, this)
      node.off(Node.EventType.TOUCH_MOVE, handler, this)
      node.off(Node.EventType.TOUCH_END, handler, this)
    }
  }

  // 把触摸点按当前滑块的真实范围换算成 0 到 1 的数值，背景音乐和音效共用这套逻辑。
  private updateSliderValueFromTouch(
    event: EventTouch,
    sliderNode: Node | null,
    minX: number,
    maxX: number,
    setter: (value: number) => void
  ) {
    const sliderTransform = sliderNode?.getComponent(UITransform)
    if (!sliderNode || !sliderTransform) {
      return
    }

    const uiLocation = event.getUILocation()
    const local = sliderTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
    const rangeMinX = Math.min(minX, maxX)
    const rangeMaxX = Math.max(minX, maxX)
    const value = (local.x - rangeMinX) / Math.max(1, rangeMaxX - rangeMinX)
    setter(value)
  }

  // 刷新单条滑块的视觉，只更新 Fill 的填充比例和按钮位置，不再改变素材尺寸。
  private refreshSliderVisual(
    fillNode: Node | null,
    controllerNode: Node | null,
    minX: number,
    maxX: number,
    value: number
  ) {
    const fillSprite = fillNode?.getComponent(Sprite)
    if (!fillNode || !controllerNode || !fillSprite) {
      return
    }

    const rangeMinX = Math.min(minX, maxX)
    const rangeMaxX = Math.max(minX, maxX)
    const controllerX = rangeMinX + (rangeMaxX - rangeMinX) * value
    // Fill 直接裁剪到当前比例，避免滑动时左侧图片被横向拉伸变形。
    fillSprite.fillRange = Math.max(0, Math.min(1, value))
    controllerNode.setPosition(controllerX, controllerNode.position.y, controllerNode.position.z)
  }

  // 音频控件的尺寸、图片和排版都以 scene 为准，这里只缓存交互所需的位置数据。
  private configureAudioControlLayout() {
    const bgRange = this.getSliderRange(this.bgMusicSliderBase, this.bgMusicController)
    if (bgRange) {
      this.bgMusicControllerMinX = bgRange.minX
      this.bgMusicControllerMaxX = bgRange.maxX
      this.prepareSliderFill(this.bgMusicFill, bgRange.trackWidth, bgRange.trackMinX)
    }

    const soundRange = this.getSliderRange(this.soundEffectSliderBase, this.soundEffectController)
    if (soundRange) {
      this.soundEffectControllerMinX = soundRange.minX
      this.soundEffectControllerMaxX = soundRange.maxX
      this.prepareSliderFill(this.soundEffectFill, soundRange.trackWidth, soundRange.trackMinX)
    }
  }

  // 统一绑定背景音乐和音效滑块拖动事件，先解绑再绑定避免重复触发。
  private bindAudioControlEvents() {
    this.bindSliderTouchEvents([this.bgMusicControl, this.bgMusicSlider, this.bgMusicController], this.onBgMusicControlTouch)
    this.bindSliderTouchEvents(
      [this.soundEffectControl, this.soundEffectSlider, this.soundEffectController],
      this.onSoundEffectControlTouch
    )
  }

  // 根据当前设置刷新两条音量滑块的视觉状态。
  private refreshAudioControls() {
    this.redrawBgMusicSlider()
    this.redrawSoundEffectSlider()
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
    this.updateSliderValueFromTouch(
      event,
      this.bgMusicSlider,
      this.bgMusicControllerMinX,
      this.bgMusicControllerMaxX,
      (volume) => this.setBgMusicVolume(volume)
    )
  }

  // 音效滑块支持点击和拖动，直接把触摸点映射到 0 到 1 的音量范围。
  private onSoundEffectControlTouch(event: EventTouch) {
    event.propagationStopped = true
    this.updateSliderValueFromTouch(
      event,
      this.soundEffectSlider,
      this.soundEffectControllerMinX,
      this.soundEffectControllerMaxX,
      (volume) => this.setSoundEffectVolume(volume)
    )
  }

  // 背景音乐滑块只复用 scene 中的 SliderBase、Fill 和 Controller 图片，不再自己绘制轨道。
  private redrawBgMusicSlider() {
    this.refreshSliderVisual(
      this.bgMusicFill,
      this.bgMusicController,
      this.bgMusicControllerMinX,
      this.bgMusicControllerMaxX,
      this.bgMusicVolume
    )
  }

  // 音效音量条和背景音乐保持同一套逻辑，同样只操作 Fill 的填充比例和 Controller 位置。
  private redrawSoundEffectSlider() {
    this.refreshSliderVisual(
      this.soundEffectFill,
      this.soundEffectController,
      this.soundEffectControllerMinX,
      this.soundEffectControllerMaxX,
      this.soundEffectVolume
    )
  }

  // 如果场景后续挂了 AudioSource，这里会自动把 UI 设置同步到真实音频源。
  private applyAudioSettings() {
    const owner = this.hostNode ?? this.node.parent ?? this.node
    const audioSources = owner.getComponentsInChildren(AudioSource)
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

  // 根据当前弹窗尺寸和面板宽度，动态计算完全滑出屏幕右侧后的隐藏位置。
  private getPausePanelHiddenX() {
    const overlayTransform = this.node.getComponent(UITransform)
    const panelTransform = this.pauseOverlayPanel?.getComponent(UITransform)
    const shown = this.getPausePanelShownPosition()
    if (!overlayTransform || !panelTransform) {
      return shown.x
    }

    const overlayHalfWidth = overlayTransform.width * 0.5
    const panelHalfWidth = panelTransform.width * 0.5
    return overlayHalfWidth + panelHalfWidth + PAUSE_PANEL_HIDDEN_GAP
  }

  // 根据 paused 状态播放暂停弹窗动画：蒙版淡入淡出，面板从右侧滑入滑出。
  private refreshPauseOverlay() {
    // 每次弹窗打开前都把暂停层提到最上面，避免被新生成的棋子或特效节点盖住。
    this.bringNodeToTop(this.node)

    const maskNode = this.pauseOverlayMask ?? this.node
    if (!this.canUseNode(maskNode)) {
      return
    }

    const maskOpacity = maskNode.getComponent(UIOpacity) ?? maskNode.addComponent(UIOpacity)
    Tween.stopAllByTarget(maskOpacity)
    if (this.pauseOverlayPanel) {
      Tween.stopAllByTarget(this.pauseOverlayPanel)
    }

    if (this.isPaused) {
      this.node.active = true
      maskOpacity.opacity = 0
      tween(maskOpacity).to(PAUSE_MASK_ANIM_DURATION, { opacity: 255 }).start()

      if (this.pauseOverlayPanel) {
        const shown = this.getPausePanelShownPosition()
        this.pauseOverlayPanel.setPosition(this.getPausePanelHiddenX(), shown.y, shown.z)
        tween(this.pauseOverlayPanel)
          .to(PAUSE_PANEL_ANIM_DURATION, { position: shown }, { easing: 'cubicOut' })
          .start()
      }
      return
    }

    if (!this.node.active) {
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
          if (!this.isPaused) {
            this.node.active = false
          }
        })
        .start()
      return
    }

    this.node.active = false
  }
}
