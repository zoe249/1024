import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'
import { getBoardCellCenterOffset, getBoardGridSize, getBoardGridStep } from './BoardGeometry'

const { ccclass } = _decorator

export type FirstEntryTutorialStep = 0 | 1 | 2

export type FirstEntryTutorialUIState = {
  active: boolean
  awaitingTap: boolean
  step: FirstEntryTutorialStep
  column: number
  hoverY: number | null
}

export type FirstEntryTutorialLayout = {
  boardwidth: number
  boardheight: number
  pieceSize: number
  spacing: number
}

const HAND_RESOURCE = 'Tutorial/tutorial-hand-tap/spriteFrame'
const TAP_RINGS_RESOURCE = 'Tutorial/tutorial-tap-rings/spriteFrame'
const SPEECH_BUBBLE_RESOURCE = 'Tutorial/tutorial-speech-bubble/spriteFrame'

const MASK_COLOR = new Color(20, 18, 16, 158)
const GUIDE_GLOW_COLOR = new Color(255, 224, 70, 68)
const GUIDE_MID_COLOR = new Color(255, 224, 70, 125)
const GUIDE_EDGE_COLOR = new Color(255, 229, 82, 245)
const GUIDE_DASH_COLOR = new Color(255, 237, 116, 238)
const GUIDE_RADIUS = 20
const GUIDE_SIDE_INSET = 8
const GUIDE_VERTICAL_PADDING = 16
const HAND_SIZE = 112
const TAP_RINGS_SIZE = 104
const BUBBLE_WIDTH = 330
const BUBBLE_HEIGHT = 220

/**
 * 首次落子引导只负责表现和转发触摸。
 *
 * 棋子数字、当前步骤和允许落子的列都由 PlayController 决定；本组件只根据纯数据状态
 * 绘制遮罩、高亮和手势，并把全屏触摸原样回调给玩法层校验。
 */
@ccclass('FirstEntryTutorialController')
export class FirstEntryTutorialController extends Component {
  private hostNode: Node | null = null
  private boardNode: Node | null = null
  private layout: FirstEntryTutorialLayout = {
    boardwidth: 5,
    boardheight: 7,
    pieceSize: 120,
    spacing: 10
  }
  private tapHandler: ((event: EventTouch) => void) | null = null
  private currentState: FirstEntryTutorialUIState = {
    active: false,
    awaitingTap: false,
    step: 0,
    column: 0,
    hoverY: null
  }
  private maskGraphics: Graphics | null = null
  private highlightGraphics: Graphics | null = null
  private handNode: Node | null = null
  private ringsNode: Node | null = null
  private ringsOpacity: UIOpacity | null = null
  private bubbleNode: Node | null = null
  private bubbleLabel: Label | null = null
  private animationStarted = false

  setup(options: {
    hostNode: Node
    boardNode: Node | null
    layout: FirstEntryTutorialLayout
    onTap: (event: EventTouch) => void
  }) {
    this.hostNode = options.hostNode
    this.boardNode = options.boardNode
    this.layout = { ...options.layout }
    this.tapHandler = options.onTap
    this.ensureView()
    this.syncLayout()
    this.renderState(this.currentState)
  }

  renderState(state: FirstEntryTutorialUIState) {
    this.currentState = { ...state }
    this.node.active = state.active
    if (!state.active) {
      this.stopPromptAnimation()
      return
    }

    this.syncLayout()
    this.refreshPromptState()
  }

  syncLayout() {
    if (!this.node.isValid) {
      return
    }

    const hostTransform = this.hostNode?.getComponent(UITransform)
    const parentTransform = this.node.parent?.getComponent(UITransform)
    const width = parentTransform?.width ?? hostTransform?.width ?? 750
    const height = parentTransform?.height ?? hostTransform?.height ?? 1334
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    transform.setContentSize(width, height)
    this.node.setPosition(0, 0, 0)

    if (!this.currentState.active) {
      return
    }

    const spotlight = this.getSpotlightBounds(width, height)
    this.drawMask(width, height, spotlight)
    this.drawColumnHighlight(spotlight)
    this.layoutPrompt(spotlight, width)
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.stopPromptAnimation()
    this.hostNode = null
    this.boardNode = null
    this.tapHandler = null
    this.maskGraphics = null
    this.highlightGraphics = null
    this.handNode = null
    this.ringsNode = null
    this.ringsOpacity = null
    this.bubbleNode = null
    this.bubbleLabel = null
  }

  private ensureView() {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    transform.setAnchorPoint(0.5, 0.5)
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this)

    const maskNode = this.ensureNode('Mask')
    this.maskGraphics = maskNode.getComponent(Graphics) ?? maskNode.addComponent(Graphics)

    const highlightNode = this.ensureNode('ColumnHighlight')
    this.highlightGraphics = highlightNode.getComponent(Graphics) ?? highlightNode.addComponent(Graphics)

    this.ringsNode = this.ensureSpriteNode('TapRings', TAP_RINGS_SIZE, TAP_RINGS_SIZE)
    this.ringsOpacity = this.ringsNode.getComponent(UIOpacity) ?? this.ringsNode.addComponent(UIOpacity)
    this.handNode = this.ensureSpriteNode('Hand', HAND_SIZE, HAND_SIZE)
    this.bubbleNode = this.ensureSpriteNode('SpeechBubble', BUBBLE_WIDTH, BUBBLE_HEIGHT)
    this.ensureBubbleLabel()

    this.loadSprite(TAP_RINGS_RESOURCE, this.ringsNode)
    this.loadSprite(HAND_RESOURCE, this.handNode)
    this.loadSprite(SPEECH_BUBBLE_RESOURCE, this.bubbleNode)
  }

  private ensureNode(name: string) {
    let node = this.node.getChildByName(name)
    if (!node) {
      node = new Node(name)
      node.setParent(this.node)
    }
    node.setPosition(0, 0, 0)
    return node
  }

  private ensureSpriteNode(name: string, width: number, height: number) {
    const node = this.ensureNode(name)
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.type = Sprite.Type.SIMPLE
    sprite.trim = false
    return node
  }

  private ensureBubbleLabel() {
    if (!this.bubbleNode) {
      return
    }

    let labelNode = this.bubbleNode.getChildByName('Text')
    if (!labelNode) {
      labelNode = new Node('Text')
      labelNode.setParent(this.bubbleNode)
    }
    labelNode.setPosition(0, 20, 0)
    const transform = labelNode.getComponent(UITransform) ?? labelNode.addComponent(UITransform)
    transform.setContentSize(270, 98)
    const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label)
    label.fontSize = 30
    label.lineHeight = 38
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.overflow = Label.Overflow.SHRINK
    label.color = new Color(80, 52, 35, 255)
    label.enableOutline = true
    const outline = labelNode.getComponent(LabelOutline) ?? labelNode.addComponent(LabelOutline)
    outline.color = new Color(255, 250, 226, 220)
    outline.width = 1
    this.bubbleLabel = label
  }

  private loadSprite(path: string, node: Node | null) {
    const sprite = node?.getComponent(Sprite) ?? null
    if (!sprite) {
      return
    }

    resources.load(path, SpriteFrame, (error, frame) => {
      if (error || !frame || !node?.isValid || !sprite.isValid) {
        if (error) {
          console.warn(`[首次引导] 素材加载失败：${path}`, error)
        }
        return
      }
      sprite.spriteFrame = frame
    })
  }

  private handleTouchStart(event: EventTouch) {
    // 覆盖层始终吞掉触摸；玩法层只会放行当前高亮列，其余位置保持完全无操作。
    event.propagationStopped = true
    this.tapHandler?.(event)
  }

  private getSpotlightBounds(width: number, height: number) {
    const safeColumn = Math.max(0, Math.min(this.layout.boardwidth - 1, this.currentState.column))
    const step = getBoardGridStep(this.layout.pieceSize, this.layout.spacing)
    const gridSize = getBoardGridSize(
      this.layout.boardwidth,
      this.layout.boardheight,
      this.layout.pieceSize,
      this.layout.spacing
    )
    const boardPosition = this.boardNode?.position ?? Vec3.ZERO
    const centerX = boardPosition.x + getBoardCellCenterOffset(safeColumn, this.layout.boardwidth, step)
    const laneWidth = Math.max(this.layout.pieceSize + GUIDE_SIDE_INSET, step - GUIDE_SIDE_INSET)
    const boardBottom = boardPosition.y - gridSize.height * 0.5
    const fallbackHoverY = boardPosition.y + gridSize.height * 0.5 + this.layout.pieceSize
    const hoverY = this.currentState.hoverY ?? fallbackHoverY
    const bottom = Math.max(-height * 0.5, boardBottom - GUIDE_VERTICAL_PADDING)
    const top = Math.min(height * 0.5, hoverY + this.layout.pieceSize * 0.5 + GUIDE_VERTICAL_PADDING)

    return {
      left: Math.max(-width * 0.5, centerX - laneWidth * 0.5),
      right: Math.min(width * 0.5, centerX + laneWidth * 0.5),
      bottom,
      top,
      centerX,
      hoverY
    }
  }

  private drawMask(
    width: number,
    height: number,
    spotlight: { left: number; right: number; bottom: number; top: number }
  ) {
    const graphics = this.maskGraphics
    if (!graphics) {
      return
    }

    const left = -width * 0.5
    const right = width * 0.5
    const bottom = -height * 0.5
    const top = height * 0.5
    graphics.clear()
    graphics.fillColor = MASK_COLOR
    graphics.rect(left, bottom, Math.max(0, spotlight.left - left), height)
    graphics.rect(spotlight.right, bottom, Math.max(0, right - spotlight.right), height)
    graphics.rect(spotlight.left, bottom, spotlight.right - spotlight.left, Math.max(0, spotlight.bottom - bottom))
    graphics.rect(spotlight.left, spotlight.top, spotlight.right - spotlight.left, Math.max(0, top - spotlight.top))
    graphics.fill()
  }

  private drawColumnHighlight(spotlight: {
    left: number
    right: number
    bottom: number
    top: number
    centerX: number
    hoverY: number
  }) {
    const graphics = this.highlightGraphics
    if (!graphics) {
      return
    }

    const width = spotlight.right - spotlight.left
    const height = spotlight.top - spotlight.bottom
    graphics.clear()
    this.strokeRoundedRect(graphics, spotlight.left, spotlight.bottom, width, height, 20, GUIDE_GLOW_COLOR)
    this.strokeRoundedRect(graphics, spotlight.left, spotlight.bottom, width, height, 11, GUIDE_MID_COLOR)
    this.strokeRoundedRect(graphics, spotlight.left, spotlight.bottom, width, height, 4, GUIDE_EDGE_COLOR)

    const dashTop = spotlight.hoverY - this.layout.pieceSize * 0.75
    const dashBottom = spotlight.bottom + 72
    graphics.fillColor = GUIDE_DASH_COLOR
    for (let y = dashBottom; y < dashTop; y += 34) {
      graphics.roundRect(spotlight.centerX - 3, y, 6, Math.min(18, dashTop - y), 3)
    }
    graphics.fill()

    const arrowY = spotlight.bottom + 52
    graphics.moveTo(spotlight.centerX - 14, arrowY + 12)
    graphics.lineTo(spotlight.centerX, arrowY)
    graphics.lineTo(spotlight.centerX + 14, arrowY + 12)
    graphics.strokeColor = GUIDE_EDGE_COLOR
    graphics.lineWidth = 6
    graphics.lineJoin = Graphics.LineJoin.ROUND
    graphics.stroke()
  }

  private strokeRoundedRect(
    graphics: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    lineWidth: number,
    color: Color
  ) {
    graphics.strokeColor = color
    graphics.lineWidth = lineWidth
    graphics.roundRect(x, y, width, height, GUIDE_RADIUS)
    graphics.stroke()
  }

  private layoutPrompt(
    spotlight: { centerX: number; bottom: number; top: number },
    rootWidth: number
  ) {
    const tapY = spotlight.bottom + (spotlight.top - spotlight.bottom) * 0.54
    this.ringsNode?.setPosition(spotlight.centerX, tapY, 0)
    this.handNode?.setPosition(spotlight.centerX + 18, tapY - HAND_SIZE * 0.46, 0)

    if (this.bubbleNode) {
      const prefersLeft = spotlight.centerX + BUBBLE_WIDTH * 0.72 > rootWidth * 0.5
      const xOffset = prefersLeft ? -BUBBLE_WIDTH * 0.56 : BUBBLE_WIDTH * 0.56
      const minX = -rootWidth * 0.5 + BUBBLE_WIDTH * 0.5 + 12
      const maxX = rootWidth * 0.5 - BUBBLE_WIDTH * 0.5 - 12
      const bubbleX = Math.max(minX, Math.min(maxX, spotlight.centerX + xOffset))
      this.bubbleNode.setPosition(bubbleX, tapY + 120, 0)
    }
  }

  private refreshPromptState() {
    const visible = this.currentState.awaitingTap
    if (this.handNode) {
      this.handNode.active = visible
    }
    if (this.ringsNode) {
      this.ringsNode.active = visible
    }
    if (this.bubbleNode) {
      this.bubbleNode.active = visible
    }
    if (this.bubbleLabel) {
      this.bubbleLabel.string = this.currentState.step === 2
        ? '再来一次，合成 4'
        : '点击高亮列，让方块落下'
    }

    if (visible) {
      this.startPromptAnimation()
    } else {
      this.stopPromptAnimation()
    }
  }

  private startPromptAnimation() {
    if (this.animationStarted || !this.ringsNode || !this.ringsOpacity || !this.handNode) {
      return
    }

    this.animationStarted = true
    const handBasePosition = this.handNode.position.clone()
    this.ringsNode.setScale(new Vec3(0.82, 0.82, 1))
    this.ringsOpacity.opacity = 230
    this.handNode.setScale(Vec3.ONE)

    tween(this.ringsNode)
      .repeatForever(
        tween<Node>()
          .to(0.65, { scale: new Vec3(1.16, 1.16, 1) }, { easing: 'sineOut' })
          .to(0.08, { scale: new Vec3(0.82, 0.82, 1) })
      )
      .start()
    tween(this.ringsOpacity)
      .repeatForever(
        tween<UIOpacity>()
          .to(0.65, { opacity: 72 }, { easing: 'sineOut' })
          .to(0.08, { opacity: 230 })
      )
      .start()
    tween(this.handNode)
      .repeatForever(
        tween<Node>()
          .to(0.42, {
            position: new Vec3(handBasePosition.x, handBasePosition.y + 8, handBasePosition.z),
            scale: new Vec3(0.96, 0.96, 1)
          }, { easing: 'sineInOut' })
          .to(0.42, {
            position: handBasePosition,
            scale: Vec3.ONE
          }, { easing: 'sineInOut' })
      )
      .start()
  }

  private stopPromptAnimation() {
    this.animationStarted = false
    if (this.ringsNode?.isValid) {
      Tween.stopAllByTarget(this.ringsNode)
      this.ringsNode.setScale(Vec3.ONE)
    }
    if (this.ringsOpacity?.isValid) {
      Tween.stopAllByTarget(this.ringsOpacity)
      this.ringsOpacity.opacity = 255
    }
    if (this.handNode?.isValid) {
      Tween.stopAllByTarget(this.handNode)
      this.handNode.setScale(Vec3.ONE)
    }
  }
}
