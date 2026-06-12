import { _decorator, Color, Component, director, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc'

const { ccclass, property } = _decorator

const DEFAULT_PROGRESS_WIDTH = 420
const DEFAULT_PROGRESS_HEIGHT = 26
const DEFAULT_PROGRESS_Y = -492
const DEFAULT_LABEL_Y = -548

@ccclass('LoadingSceneController')
export class LoadingSceneController extends Component {
  // 加载完成后进入的目标场景，默认对应 assets/scence/game.scene。
  @property({ tooltip: 'Target scene name' })
  targetSceneName = 'game'

  // 加载页背景图，当前绑定 loading_bg_candy_shop。
  @property({ type: SpriteFrame, tooltip: 'Loading page background sprite frame' })
  backgroundSpriteFrame: SpriteFrame | null = null

  // 背景节点优先由层级管理器维护，脚本只负责 cover 适配。
  @property({ type: Node, tooltip: 'Background node' })
  private backgroundNodeRef: Node | null = null

  // 进度条填充节点可在层级管理器里指定，缺失时用代码兜底绘制。
  @property({ type: Node, tooltip: 'Progress fill node' })
  private progressFillNodeRef: Node | null = null

  // 百分比文本节点可在层级管理器里指定，缺失时用代码兜底创建。
  @property({ type: Node, tooltip: 'Percent label node' })
  private percentLabelNodeRef: Node | null = null

  private backgroundNode: Node | null = null
  private progressTrackNode: Node | null = null
  private progressFillNode: Node | null = null
  private percentLabel: Label | null = null
  private hasRequestedLoadScene = false

  onLoad() {
    this.ensureLoadingUi()
    this.renderProgress(0)
  }

  start() {
    this.fitBackgroundToCanvas()
    this.scheduleOnce(() => this.fitBackgroundToCanvas(), 0)
    this.startLoadingTargetScene()
  }

  /**
   * 加载目标场景并同步进度表现。
   *
   * Cocos 的 preloadScene 会分阶段回调 completedCount / totalCount；
   * 加载完成后再 loadScene，避免直接切玩法场景时出现黑屏等待。
   */
  private startLoadingTargetScene() {
    if (this.hasRequestedLoadScene) {
      return
    }

    this.hasRequestedLoadScene = true
    director.preloadScene(
      this.targetSceneName,
      (completedCount, totalCount) => {
        this.renderProgress(totalCount > 0 ? completedCount / totalCount : 0)
      },
      () => {
        this.renderProgress(1)
        this.scheduleOnce(() => director.loadScene(this.targetSceneName), 0)
      }
    )
  }

  // 加载页 UI 优先使用层级节点，缺失时补最小结构，便于 Creator 里继续调样式。
  private ensureLoadingUi() {
    this.backgroundNode = this.backgroundNodeRef ?? this.node.getChildByName('Background') ?? this.createBackgroundNode()
    this.progressFillNode = this.progressFillNodeRef ?? this.findChildDeep(this.node, 'ProgressFill')
    this.percentLabel = this.percentLabelNodeRef?.getComponent(Label) ?? this.findChildDeep(this.node, 'PercentLabel')?.getComponent(Label) ?? null

    if (!this.progressFillNode) {
      this.createFallbackProgressBar()
    }
    if (!this.percentLabel) {
      this.percentLabel = this.createFallbackPercentLabel()
    }

    this.fitBackgroundToCanvas()
  }

  private createBackgroundNode() {
    const background = new Node('Background')
    background.setParent(this.node)
    background.addComponent(UITransform)
    const sprite = background.addComponent(Sprite)
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.spriteFrame = this.backgroundSpriteFrame
    background.setSiblingIndex(0)
    return background
  }

  /**
   * 按 cover 规则铺满加载页背景。
   *
   * loading_bg_candy_shop 是竖版图，直接按 Canvas 拉伸会变形；
   * 这里保持原比例铺满屏幕，多出的部分交给 Canvas 边界裁掉。
   */
  private fitBackgroundToCanvas() {
    if (!this.backgroundNode || !this.backgroundSpriteFrame) {
      return
    }

    const canvasTransform = this.node.getComponent(UITransform)
    const backgroundTransform = this.backgroundNode.getComponent(UITransform) ?? this.backgroundNode.addComponent(UITransform)
    const backgroundSprite = this.backgroundNode.getComponent(Sprite) ?? this.backgroundNode.addComponent(Sprite)
    if (!canvasTransform) {
      return
    }

    const imageSize = this.backgroundSpriteFrame.originalSize
    const imageWidth = imageSize.width
    const imageHeight = imageSize.height
    const scale = Math.max(canvasTransform.width / imageWidth, canvasTransform.height / imageHeight)
    backgroundTransform.setContentSize(Math.ceil(imageWidth * scale), Math.ceil(imageHeight * scale))
    backgroundSprite.spriteFrame = this.backgroundSpriteFrame
    backgroundSprite.type = Sprite.Type.SIMPLE
    backgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM
  }

  // 没有层级进度条时，脚本补一条简洁进度条，确保加载页最小可用。
  private createFallbackProgressBar() {
    const track = new Node('ProgressTrack')
    track.setParent(this.node)
    track.setPosition(0, DEFAULT_PROGRESS_Y, 0)
    track.addComponent(UITransform).setContentSize(DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT)
    const trackGraphics = track.addComponent(Graphics)
    trackGraphics.fillColor = new Color(26, 61, 78, 142)
    trackGraphics.roundRect(-DEFAULT_PROGRESS_WIDTH / 2, -DEFAULT_PROGRESS_HEIGHT / 2, DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT, DEFAULT_PROGRESS_HEIGHT / 2)
    trackGraphics.fill()

    const fill = new Node('ProgressFill')
    fill.setParent(track)
    fill.setPosition(-DEFAULT_PROGRESS_WIDTH / 2, 0, 0)
    const fillTransform = fill.addComponent(UITransform)
    fillTransform.setContentSize(DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT)
    fill.setScale(new Vec3(0, 1, 1))
    const fillGraphics = fill.addComponent(Graphics)
    fillGraphics.fillColor = new Color(41, 215, 129, 255)
    // 填充条从节点原点向右绘制，节点固定在轨道左边缘，刷新进度时只改 scaleX。
    fillGraphics.roundRect(0, -DEFAULT_PROGRESS_HEIGHT / 2, DEFAULT_PROGRESS_WIDTH, DEFAULT_PROGRESS_HEIGHT, DEFAULT_PROGRESS_HEIGHT / 2)
    fillGraphics.fill()

    this.progressTrackNode = track
    this.progressFillNode = fill
  }

  private createFallbackPercentLabel() {
    const labelNode = new Node('PercentLabel')
    labelNode.setParent(this.node)
    labelNode.setPosition(0, DEFAULT_LABEL_Y, 0)
    labelNode.addComponent(UITransform).setContentSize(360, 48)
    const label = labelNode.addComponent(Label)
    label.string = '加载中 0%'
    label.fontSize = 24
    label.lineHeight = 30
    label.color = new Color(255, 255, 255, 235)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    return label
  }

  private renderProgress(progress: number) {
    const normalizedProgress = Math.max(0, Math.min(1, progress))
    this.progressFillNode?.setScale(new Vec3(normalizedProgress, 1, 1))
    if (this.percentLabel) {
      this.percentLabel.string = `加载中 ${Math.round(normalizedProgress * 100)}%`
    }
  }

  // 层级里可能多包了一层容器，递归查找可以减少手动拖引用的必要。
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
}
