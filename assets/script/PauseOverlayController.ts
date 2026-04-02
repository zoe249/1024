import {
  _decorator,
  AudioSource,
  Color,
  Component,
  EventTouch,
  Node,
  Sprite,
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
  // 关闭弹窗的按钮
  @property({ type: Node, tooltip: '关闭按钮节点' })
  private closeButtonNode: Node | null = null

  // 由外部 UI 组件在启动时调用，把 play 根节点传进来，方便暂停层复用已有资源。
  setup(options: { hostNode: Node; pauseHandler: (() => void) | null }) {
    this.hostNode = options.hostNode
    this.pauseHandler = options.pauseHandler
    this.ensureOverlayStructure()
    this.ensurePauseOverlayMaskSprite()
    this.bindPauseOverlayMask()
    this.ensureAudioControls()
    this.refreshPauseOverlay()

    // 绑定关闭按钮事件，点击后调用 pauseHandler 继续游戏
    this.closeButtonNode?.on(Node.EventType.TOUCH_END, this.pauseHandler, this)
  }

  // 某些平台安全区和尺寸会在首帧后稳定，这里补一次遮罩和滑块布局收口。
  syncLayout() {
    this.ensurePauseOverlayMaskSprite()
    this.configureAudioControlLayout()
    this.refreshAudioControls()
    this.refreshPauseOverlay()
  }

  // 外部只需要告诉暂停层当前是否暂停，具体动画和显示细节全部交给弹窗脚本。
  renderState(isPaused: boolean) {
    this.isPaused = isPaused
    this.refreshPauseOverlay()
  }

  onDestroy() {
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_START, this.swallowOverlayTouch, this)
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_MOVE, this.swallowOverlayTouch, this)
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_END, this.swallowOverlayTouch, this)
    this.pauseOverlayMask?.off(Node.EventType.TOUCH_CANCEL, this.swallowOverlayTouch, this)
    this.unbindSliderTouchEvents([this.bgMusicControl, this.bgMusicSlider, this.bgMusicController], this.onBgMusicControlTouch)
    this.unbindSliderTouchEvents(
      [this.soundEffectControl, this.soundEffectSlider, this.soundEffectController],
      this.onSoundEffectControlTouch
    )
  }

  // PauseOverlay 节点优先复用 scene 中现成的 Mask 和 Panel，缺失时再补最小结构。
  private ensureOverlayStructure() {
    this.node.active = false
    if (this.node.parent) {
      // 暂停层必须压在棋子和特效上方，避免打开弹窗后仍被运行时节点遮挡。
      this.node.setSiblingIndex(this.node.parent.children.length - 1)
    }

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

  // 统一读取滑块底槽的左右边界，兼容不同锚点，避免每一条滑块都重复写一遍坐标换算。
  private getSliderRange(baseNode: Node | null) {
    const baseTransform = baseNode?.getComponent(UITransform)
    if (!baseNode || !baseTransform) {
      return null
    }

    const minX = baseNode.position.x - baseTransform.width * baseTransform.anchorX
    const maxX = minX + baseTransform.width
    return {
      minX,
      maxX,
      width: baseTransform.width
    }
  }

  // Fill 改用 Sprite 自带的横向填充，显示时只裁剪贴图，不再通过改宽度拉伸素材。
  private prepareSliderFill(fillNode: Node | null, fullWidth: number, minX: number) {
    const fillTransform = fillNode?.getComponent(UITransform)
    const fillSprite = fillNode?.getComponent(Sprite)
    if (!fillNode || !fillTransform || !fillSprite) {
      return
    }

    fillSprite.type = Sprite.Type.FILLED
    fillSprite.fillType = Sprite.FillType.HORIZONTAL
    fillSprite.fillStart = 0
    fillTransform.setContentSize(fullWidth, fillTransform.height)
    fillNode.setPosition(minX + fullWidth * fillTransform.anchorX, fillNode.position.y, fillNode.position.z)
  }

  // 一次性处理多个滑块相关节点的触摸绑定，减少重复代码，也避免漏绑或重复绑。
  private bindSliderTouchEvents(nodes: Array<Node | null>, handler: (event: EventTouch) => void) {
    this.unbindSliderTouchEvents(nodes, handler)
    for (const node of nodes) {
      node?.on(Node.EventType.TOUCH_START, handler, this)
      node?.on(Node.EventType.TOUCH_MOVE, handler, this)
      node?.on(Node.EventType.TOUCH_END, handler, this)
    }
  }

  // 销毁时统一解绑滑块触摸事件，避免界面关闭后残留回调。
  private unbindSliderTouchEvents(nodes: Array<Node | null>, handler: (event: EventTouch) => void) {
    for (const node of nodes) {
      node?.off(Node.EventType.TOUCH_START, handler, this)
      node?.off(Node.EventType.TOUCH_MOVE, handler, this)
      node?.off(Node.EventType.TOUCH_END, handler, this)
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
    const bgRange = this.getSliderRange(this.bgMusicSliderBase)
    if (bgRange) {
      this.bgMusicControllerMinX = bgRange.minX
      this.bgMusicControllerMaxX = bgRange.maxX
      this.prepareSliderFill(this.bgMusicFill, bgRange.width, bgRange.minX)
    }

    const soundRange = this.getSliderRange(this.soundEffectSliderBase)
    if (soundRange) {
      this.soundEffectControllerMinX = soundRange.minX
      this.soundEffectControllerMaxX = soundRange.maxX
      this.prepareSliderFill(this.soundEffectFill, soundRange.width, soundRange.minX)
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
    if (this.node.parent) {
      // 每次弹窗打开前都把暂停层提到最上面，避免被新生成的棋子或特效节点盖住。
      this.node.setSiblingIndex(this.node.parent.children.length - 1)
    }

    const maskNode = this.pauseOverlayMask ?? this.node
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
