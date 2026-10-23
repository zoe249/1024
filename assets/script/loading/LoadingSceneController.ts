import { appearanceRuntime, type AppearanceLease } from '../appearance/AppearanceRuntime'
import { LoadingAppearance } from './LoadingAppearance'
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

import { LoadingLeavesEffect } from './LoadingLeavesEffect'

const { ccclass, property } = _decorator

const DESIGN_WIDTH = 750
const DESIGN_HEIGHT = 1334
const PROGRESS_WIDTH = 440
const PROGRESS_FILL_WIDTH = 428

const BROWN = new Color(74, 48, 28, 255)
const CREAM = new Color(255, 246, 218, 255)

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

  private readonly appearance = new LoadingAppearance()
  private gameAppearance: AppearanceLease | null = null
  private backgroundNode: Node | null = null
  private designRoot: Node | null = null
  private leafLayer: Node | null = null
  private contentRoot: Node | null = null
  private windStreakNode: Node | null = null
  private progressFillNode: Node | null = null
  private percentLabel: Label | null = null
  private leavesEffect: LoadingLeavesEffect | null = null
  private activeTip = LOADING_TIPS[0]
  private hasRequestedLoadScene = false
  private loadingStartedAtMs = 0

  onLoad() {
    this.gameAppearance = appearanceRuntime.acquireBase('game')
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
    this.leavesEffect?.update(deltaTime)
  }

  onDestroy() {
    this.gameAppearance?.release()
    this.gameAppearance = null
    this.appearance.dispose()
    this.unscheduleAllCallbacks()
    this.stopNodeTween(this.contentRoot)
    this.stopNodeTween(this.windStreakNode)
    this.stopNodeTween(this.progressFillNode)
    this.leavesEffect?.dispose()
    this.leavesEffect = null
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
            const ticket = this.gameAppearance ? appearanceRuntime.handoffGame(this.gameAppearance, this.targetSceneName) : null
            this.gameAppearance = null
            const accepted = director.loadScene(this.targetSceneName, () => {
              if (ticket !== null) appearanceRuntime.discardPendingGame(ticket)
            })
            if (accepted === false && ticket !== null) appearanceRuntime.discardPendingGame(ticket)
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
    this.leavesEffect = new LoadingLeavesEffect(this.leafLayer, this.appearance.leaf(this.leafSpriteFrame))
    this.leavesEffect.initialize()

    this.contentRoot = this.ensureNode(this.designRoot, 'LoadingContent')
    this.contentRoot.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    this.ensureStatusCopy(this.contentRoot)
    this.ensureProgress(this.contentRoot)
  }

  private ensureBackground() {
    const node = this.ensureNode(this.node, 'Background')
    node.setSiblingIndex(0)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    const backgroundFrame = this.appearance.background(this.backgroundSpriteFrame)
    sprite.spriteFrame = backgroundFrame
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.enabled = !!backgroundFrame

    const sourceWidth = backgroundFrame?.originalSize.width || DESIGN_WIDTH
    const sourceHeight = backgroundFrame?.originalSize.height || DESIGN_HEIGHT
    node.getComponent(UITransform)?.setContentSize(sourceWidth, sourceHeight)

    const fallback = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    fallback.clear()
    fallback.enabled = !backgroundFrame
    if (!backgroundFrame) {
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

  private ensureStatusCopy(parent: Node) {
    this.createLabel(parent, 'Title', '游戏准备中', 44, CREAM, new Vec3(0, 17, 0), 460, 62, true, BROWN, 4)
    this.createLabel(parent, 'Subtitle', '正在整理棋盘与数字', 22, this.appearance.color('text'), new Vec3(0, -41, 0), 400, 40, false, CREAM, 2)
    this.createLabel(parent, 'Tip', `小提示：${this.activeTip}`, 21, this.appearance.color('text'), new Vec3(0, -425, 0), 610, 44, false, CREAM, 2)
  }

  private ensureProgress(parent: Node) {
    this.percentLabel = this.createLabel(parent, 'Percent', '0%', 22, this.appearance.color('text'), new Vec3(0, -318, 0), 140, 40, true, CREAM, 2)

    const track = this.ensureNode(parent, 'ProgressTrack')
    track.setPosition(0, -366, 0)
    track.getComponent(UITransform)?.setContentSize(PROGRESS_WIDTH, 36)
    const graphics = track.getComponent(Graphics) ?? track.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = new Color(62, 40, 25, 80)
    graphics.roundRect(-217, -20, PROGRESS_WIDTH, 30, 15)
    graphics.fill()
    graphics.fillColor = this.appearance.color('track')
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
    fillGraphics.fillColor = this.appearance.color('fill')
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
