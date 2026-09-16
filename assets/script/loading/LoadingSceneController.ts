import {
  _decorator,
  Color,
  Component,
  director,
  Graphics,
  Label,
  LabelOutline,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'

const { ccclass, property } = _decorator

const DESIGN_WIDTH = 750
const DESIGN_HEIGHT = 1334
const PROGRESS_WIDTH = 440
const PROGRESS_FILL_WIDTH = 428
const LEAF_COUNT = 24

const BROWN = new Color(74, 48, 28, 255)
const CREAM = new Color(255, 246, 218, 255)
const GREEN = new Color(126, 183, 54, 255)
const TRACK = new Color(255, 239, 199, 255)

const LOADING_TIPS: ReadonlyArray<string> = [
  '相同数字相邻后会自动合成',
  '按住目标列，可以让棋子快速落下',
  '提前给相同数字留出相邻位置',
  '连续合成会获得更高分数',
  '尽量留出一列空位，棋盘更安全',
  '炸弹可以清除中心周围的棋子',
  '木槌可以精准敲碎一颗棋子',
  '交换技能只能作用于相邻棋子'
]

type WindPath = {
  start: Vec3
  controlA: Vec3
  controlB: Vec3
  end: Vec3
}

type LeafParticle = {
  node: Node
  opacity: UIOpacity
  pathIndex: number
  progress: number
  speed: number
  sway: number
  phase: number
  baseScale: number
  baseRotation: number
  angularVelocity: number
}

// 模块级索引用于降低连续两次加载时出现同一句提示的概率。
let previousTipIndex = -1

@ccclass('LoadingSceneController')
export class LoadingSceneController extends Component {
  @property({ tooltip: 'Target scene name' })
  targetSceneName = 'game'

  @property({ tooltip: 'Minimum loading page duration in seconds' })
  minimumDisplaySeconds = 1.8

  @property({ type: SpriteFrame, tooltip: 'Spring meadow loading background' })
  backgroundSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: 'Shared hand-drawn leaf sprite frame' })
  leafSpriteFrame: SpriteFrame | null = null

  private backgroundNode: Node | null = null
  private designRoot: Node | null = null
  private leafLayer: Node | null = null
  private contentRoot: Node | null = null
  private windStreakNode: Node | null = null
  private progressFillNode: Node | null = null
  private percentLabel: Label | null = null
  private readonly leafParticles: LeafParticle[] = []
  private activeTip = LOADING_TIPS[0]
  private hasRequestedLoadScene = false
  private loadingStartedAtMs = 0
  private randomState = 1024
  private elapsedSeconds = 0

  private readonly windPaths: ReadonlyArray<WindPath> = [
    {
      start: new Vec3(430, 610, 0),
      controlA: new Vec3(110, 500, 0),
      controlB: new Vec3(70, -130, 0),
      end: new Vec3(-430, -560, 0)
    },
    {
      start: new Vec3(440, 330, 0),
      controlA: new Vec3(160, 230, 0),
      controlB: new Vec3(-130, -70, 0),
      end: new Vec3(-430, -310, 0)
    }
  ]

  onLoad() {
    this.selectRandomTip()
    this.ensureLoadingUi()
    this.renderProgress(0, false)
  }

  start() {
    this.syncLayout()
    this.scheduleOnce(() => this.syncLayout(), 0)
    this.playEntranceAnimation()
    this.startLoadingTargetScene()
  }

  update(deltaTime: number) {
    const safeDeltaTime = Math.min(deltaTime, 0.05)
    this.elapsedSeconds += safeDeltaTime
    this.updateLeafParticles(safeDeltaTime)
  }

  onDestroy() {
    this.unscheduleAllCallbacks()
    this.stopNodeTween(this.contentRoot)
    this.stopNodeTween(this.windStreakNode)
    this.stopNodeTween(this.progressFillNode)
    this.leafParticles.forEach((particle) => this.stopNodeTween(particle.node))
    this.leafParticles.length = 0
  }

  /**
   * 预加载目标场景并把真实进度同步给底部彩铅进度条。
   * 加载完成后仍遵守最短展示时长，避免叶片刚出现就立刻闪走。
   */
  private startLoadingTargetScene() {
    if (this.hasRequestedLoadScene) {
      return
    }

    this.hasRequestedLoadScene = true
    this.loadingStartedAtMs = Date.now()
    director.preloadScene(
      this.targetSceneName,
      (completedCount, totalCount) => {
        if (!this.isValid) {
          return
        }
        this.renderProgress(totalCount > 0 ? completedCount / totalCount : 0)
      },
      () => {
        if (!this.isValid) {
          return
        }
        this.renderProgress(1)
        const elapsedSeconds = (Date.now() - this.loadingStartedAtMs) / 1000
        const remainingSeconds = Math.max(0, this.minimumDisplaySeconds - elapsedSeconds)
        this.scheduleOnce(() => {
          if (this.isValid) {
            director.loadScene(this.targetSceneName)
          }
        }, remainingSeconds)
      }
    )
  }

  private selectRandomTip() {
    if (LOADING_TIPS.length <= 1) {
      this.activeTip = LOADING_TIPS[0]
      return
    }

    const randomOffset = Math.floor(Math.random() * (LOADING_TIPS.length - 1)) + 1
    const index = previousTipIndex >= 0
      ? (previousTipIndex + randomOffset) % LOADING_TIPS.length
      : Math.floor(Math.random() * LOADING_TIPS.length)
    previousTipIndex = index
    this.activeTip = LOADING_TIPS[index]
  }

  private ensureLoadingUi() {
    const legacyLogo = this.node.getChildByName('Logo')
    if (legacyLogo) {
      legacyLogo.active = false
    }

    this.backgroundNode = this.ensureBackground()
    this.designRoot = this.ensureNode(this.node, 'TransitionDesignRoot')
    this.designRoot.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)

    this.windStreakNode = this.ensureWindStreaks(this.designRoot)
    this.leafLayer = this.ensureNode(this.designRoot, 'LeafLayer')
    this.leafLayer.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    this.createLeafParticles()

    this.contentRoot = this.ensureNode(this.designRoot, 'LoadingContent')
    this.contentRoot.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    this.ensureStatusCopy(this.contentRoot)
    this.ensureProgress(this.contentRoot)
  }

  private ensureBackground() {
    const node = this.ensureNode(this.node, 'Background')
    node.setSiblingIndex(0)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.spriteFrame = this.backgroundSpriteFrame
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.enabled = !!this.backgroundSpriteFrame

    const sourceWidth = this.backgroundSpriteFrame?.originalSize.width || DESIGN_WIDTH
    const sourceHeight = this.backgroundSpriteFrame?.originalSize.height || DESIGN_HEIGHT
    node.getComponent(UITransform)?.setContentSize(sourceWidth, sourceHeight)

    const fallback = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    fallback.clear()
    fallback.enabled = !this.backgroundSpriteFrame
    if (!this.backgroundSpriteFrame) {
      fallback.fillColor = new Color(54, 190, 227, 255)
      fallback.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT)
      fallback.fill()
    }
    return node
  }

  private ensureWindStreaks(parent: Node) {
    const node = this.ensureNode(parent, 'WindStreaks')
    node.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    graphics.clear()
    graphics.lineWidth = 2
    graphics.strokeColor = new Color(255, 249, 217, 88)

    ;[-38, -10, 22].forEach((offset) => {
      graphics.moveTo(392, 558 + offset)
      graphics.bezierCurveTo(110, 466 + offset, 30, -120 + offset, -390, -500 + offset)
    })
    ;[-24, 12].forEach((offset) => {
      graphics.moveTo(405, 292 + offset)
      graphics.bezierCurveTo(155, 204 + offset, -105, -76 + offset, -405, -268 + offset)
    })
    graphics.stroke()

    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
    opacity.opacity = 115
    return node
  }

  private createLeafParticles() {
    if (!this.leafLayer || !this.leafSpriteFrame || this.leafParticles.length > 0) {
      return
    }

    const leafColors = [
      new Color(255, 255, 255, 255),
      new Color(226, 255, 190, 255),
      new Color(255, 242, 160, 255),
      new Color(208, 238, 154, 255)
    ]

    for (let index = 0; index < LEAF_COUNT; index += 1) {
      const node = new Node(`WindLeaf_${index}`)
      node.setParent(this.leafLayer)
      const transform = node.addComponent(UITransform)
      transform.setContentSize(52, 56)
      const sprite = node.addComponent(Sprite)
      sprite.spriteFrame = this.leafSpriteFrame
      sprite.type = Sprite.Type.SIMPLE
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.color = leafColors[index % leafColors.length]
      const opacity = node.addComponent(UIOpacity)

      const particle: LeafParticle = {
        node,
        opacity,
        pathIndex: index % this.windPaths.length,
        progress: (index / LEAF_COUNT + this.random() * 0.08) % 1,
        speed: 0.13 + this.random() * 0.09,
        sway: 8 + this.random() * 20,
        phase: this.random() * Math.PI * 2,
        baseScale: 0.5 + this.random() * 0.72,
        baseRotation: this.random() * 360,
        angularVelocity: (this.random() > 0.5 ? 1 : -1) * (70 + this.random() * 150)
      }
      this.leafParticles.push(particle)
      this.placeLeafParticle(particle)
    }
  }

  private updateLeafParticles(deltaTime: number) {
    for (const particle of this.leafParticles) {
      particle.progress += particle.speed * deltaTime
      if (particle.progress >= 1) {
        particle.progress -= 1
        particle.pathIndex = (particle.pathIndex + 1) % this.windPaths.length
      }
      this.placeLeafParticle(particle)
    }
  }

  private placeLeafParticle(particle: LeafParticle) {
    const path = this.windPaths[particle.pathIndex]
    const progress = particle.progress
    const position = this.cubicBezier(path, progress)
    const tangent = this.cubicBezierTangent(path, progress)
    const tangentLength = Math.max(0.001, Math.hypot(tangent.x, tangent.y))
    const normalX = -tangent.y / tangentLength
    const normalY = tangent.x / tangentLength
    const wave = Math.sin(progress * Math.PI * 5 + particle.phase) * particle.sway
    particle.node.setPosition(position.x + normalX * wave, position.y + normalY * wave, 0)

    const pulse = 1 + Math.sin(progress * Math.PI * 4 + particle.phase) * 0.08
    const scale = particle.baseScale * pulse
    particle.node.setScale(scale, scale, 1)
    particle.node.angle = particle.baseRotation + this.elapsedSeconds * particle.angularVelocity

    // 路径首尾淡入淡出，循环回到起点时不会产生跳闪。
    const edgeFade = Math.min(1, progress * 10, (1 - progress) * 10)
    particle.opacity.opacity = Math.round(255 * edgeFade)
  }

  private cubicBezier(path: WindPath, progress: number) {
    const inverse = 1 - progress
    const inverseSquared = inverse * inverse
    const progressSquared = progress * progress
    return new Vec3(
      inverseSquared * inverse * path.start.x
        + 3 * inverseSquared * progress * path.controlA.x
        + 3 * inverse * progressSquared * path.controlB.x
        + progressSquared * progress * path.end.x,
      inverseSquared * inverse * path.start.y
        + 3 * inverseSquared * progress * path.controlA.y
        + 3 * inverse * progressSquared * path.controlB.y
        + progressSquared * progress * path.end.y,
      0
    )
  }

  private cubicBezierTangent(path: WindPath, progress: number) {
    const inverse = 1 - progress
    return new Vec3(
      3 * inverse * inverse * (path.controlA.x - path.start.x)
        + 6 * inverse * progress * (path.controlB.x - path.controlA.x)
        + 3 * progress * progress * (path.end.x - path.controlB.x),
      3 * inverse * inverse * (path.controlA.y - path.start.y)
        + 6 * inverse * progress * (path.controlB.y - path.controlA.y)
        + 3 * progress * progress * (path.end.y - path.controlB.y),
      0
    )
  }

  private ensureStatusCopy(parent: Node) {
    this.createLabel(parent, 'Title', '游戏准备中', 44, CREAM, new Vec3(0, 17, 0), 460, 62, true, BROWN, 4)
    this.createLabel(parent, 'Subtitle', '正在整理棋盘与数字', 22, BROWN, new Vec3(0, -41, 0), 400, 40, false, CREAM, 2)
    this.createLabel(parent, 'Tip', `小提示：${this.activeTip}`, 21, BROWN, new Vec3(0, -425, 0), 610, 44, false, CREAM, 2)
  }

  private ensureProgress(parent: Node) {
    this.percentLabel = this.createLabel(parent, 'Percent', '0%', 22, BROWN, new Vec3(0, -318, 0), 140, 40, true, CREAM, 2)

    const track = this.ensureNode(parent, 'ProgressTrack')
    track.setPosition(0, -366, 0)
    track.getComponent(UITransform)?.setContentSize(PROGRESS_WIDTH, 36)
    const graphics = track.getComponent(Graphics) ?? track.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(62, 40, 25, 80)
    graphics.roundRect(-217, -20, PROGRESS_WIDTH, 30, 15)
    graphics.fill()
    graphics.fillColor = TRACK
    graphics.roundRect(-220, -15, PROGRESS_WIDTH, 30, 15)
    graphics.fill()
    graphics.lineWidth = 3
    graphics.strokeColor = BROWN
    graphics.roundRect(-220, -15, PROGRESS_WIDTH, 30, 15)
    graphics.stroke()

    const fill = this.ensureNode(track, 'ProgressFill')
    fill.setPosition(-214, 0, 0)
    const fillTransform = fill.getComponent(UITransform) ?? fill.addComponent(UITransform)
    fillTransform.setContentSize(PROGRESS_FILL_WIDTH, 18)
    fillTransform.setAnchorPoint(0, 0.5)
    const fillGraphics = fill.getComponent(Graphics) ?? fill.addComponent(Graphics)
    fillGraphics.clear()
    fillGraphics.fillColor = GREEN
    fillGraphics.roundRect(0, -9, PROGRESS_FILL_WIDTH, 18, 9)
    fillGraphics.fill()
    fillGraphics.strokeColor = new Color(76, 125, 35, 90)
    fillGraphics.lineWidth = 1
    for (let index = 0; index < 42; index += 1) {
      const x = 5 + (index * 37) % (PROGRESS_FILL_WIDTH - 12)
      const y = -6 + (index * 11) % 12
      fillGraphics.moveTo(x, y)
      fillGraphics.lineTo(Math.min(PROGRESS_FILL_WIDTH - 4, x + 8), y + (index % 3) - 1)
    }
    fillGraphics.stroke()
    this.progressFillNode = fill
  }

  private renderProgress(progress: number, animated = true) {
    const normalized = Math.max(0, Math.min(1, progress))
    if (this.progressFillNode) {
      const targetScale = new Vec3(normalized, 1, 1)
      Tween.stopAllByTarget(this.progressFillNode)
      if (animated) {
        tween(this.progressFillNode).to(0.16, { scale: targetScale }, { easing: 'quadOut' }).start()
      } else {
        this.progressFillNode.setScale(targetScale)
      }
    }
    if (this.percentLabel) {
      this.percentLabel.string = `${Math.round(normalized * 100)}%`
    }
  }

  private playEntranceAnimation() {
    if (!this.contentRoot) {
      return
    }

    const opacity = this.contentRoot.getComponent(UIOpacity) ?? this.contentRoot.addComponent(UIOpacity)
    opacity.opacity = 0
    this.contentRoot.setPosition(0, -12, 0)
    tween(opacity).to(0.22, { opacity: 255 }, { easing: 'quadOut' }).start()
    tween(this.contentRoot).to(0.32, { position: Vec3.ZERO }, { easing: 'backOut' }).start()

    const streakOpacity = this.windStreakNode?.getComponent(UIOpacity)
    if (streakOpacity) {
      tween(streakOpacity)
        .repeatForever(
          tween()
            .to(0.9, { opacity: 165 }, { easing: 'sineInOut' })
            .to(0.9, { opacity: 95 }, { easing: 'sineInOut' })
        )
        .start()
    }
  }

  private syncLayout() {
    const rootTransform = this.node.getComponent(UITransform)
    if (!rootTransform) {
      return
    }

    const width = rootTransform.width || DESIGN_WIDTH
    const height = rootTransform.height || DESIGN_HEIGHT
    if (this.backgroundNode) {
      const sourceSize = this.backgroundNode.getComponent(UITransform)?.contentSize
      const sourceWidth = sourceSize?.width || DESIGN_WIDTH
      const sourceHeight = sourceSize?.height || DESIGN_HEIGHT
      const backgroundScale = Math.max(width / sourceWidth, height / sourceHeight)
      this.backgroundNode.setScale(backgroundScale, backgroundScale, 1)
      this.backgroundNode.setPosition(0, 0, 0)
    }

    if (this.designRoot) {
      const contentScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT)
      this.designRoot.setScale(contentScale, contentScale, 1)
      this.designRoot.setPosition(0, 0, 0)
    }
  }

  private createLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    position: Vec3,
    width: number,
    height: number,
    bold: boolean,
    outlineColor: Color,
    outlineWidth: number
  ) {
    const node = this.ensureNode(parent, name)
    node.setPosition(position)
    node.getComponent(UITransform)?.setContentSize(width, height)
    const label = node.getComponent(Label) ?? node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.round(fontSize * 1.25)
    label.color = color
    label.isBold = bold
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.overflow = Label.Overflow.SHRINK
    const outline = node.getComponent(LabelOutline) ?? node.addComponent(LabelOutline)
    outline.color = outlineColor
    outline.width = outlineWidth
    return label
  }

  private ensureNode(parent: Node, name: string) {
    const existing = parent.getChildByName(name)
    if (existing) {
      return existing
    }

    const node = new Node(name)
    node.setParent(parent)
    node.addComponent(UITransform)
    return node
  }

  private random() {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0
    return this.randomState / 0x100000000
  }

  private stopNodeTween(node: Node | null) {
    if (node?.isValid) {
      Tween.stopAllByTarget(node)
      const opacity = node.getComponent(UIOpacity)
      if (opacity?.isValid) {
        Tween.stopAllByTarget(opacity)
      }
    }
  }
}
