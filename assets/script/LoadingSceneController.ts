import {
  _decorator,
  Color,
  Component,
  director,
  Graphics,
  Label,
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

const DEFAULT_PROGRESS_WIDTH = 420
const DEFAULT_PROGRESS_HEIGHT = 22
const DEFAULT_PROGRESS_Y = -492
const DEFAULT_LABEL_Y = -548
const TIP_CARD_WIDTH = 620
const TIP_CARD_HEIGHT = 500

type LoadingTipVisual = 'merge' | 'drop' | 'plan' | 'chain' | 'space' | 'bomb' | 'hammer' | 'swap'

type LoadingTip = {
  category: '玩法提示' | '技能教程'
  title: string
  description: string
  visual: LoadingTipVisual
}

// 玩法提示沿用首页的五条核心信息，技能提示补充实际施放手势，避免两个页面出现冲突口径。
const LOADING_TIPS: ReadonlyArray<LoadingTip> = [
  {
    category: '玩法提示',
    title: '相同数字，碰一碰就升级',
    description: '相同数字相邻后会自动合成，越大的数字得分越高。',
    visual: 'merge'
  },
  {
    category: '玩法提示',
    title: '按住目标列，快速落子',
    description: '在棋盘内按住想放的列，棋子会加速下落。',
    visual: 'drop'
  },
  {
    category: '玩法提示',
    title: '先看底部，再选落点',
    description: '给相同数字预留相邻位置，下一步更容易连锁。',
    visual: 'plan'
  },
  {
    category: '玩法提示',
    title: '连锁合成，分数涨得更快',
    description: '一次落子触发多轮合并，连锁越长奖励越多。',
    visual: 'chain'
  },
  {
    category: '玩法提示',
    title: '给棋盘留一点呼吸空间',
    description: '尽量留出一列空位，避免所有列同时被塞满。',
    visual: 'space'
  },
  {
    category: '技能教程',
    title: '炸弹：清理一大片',
    description: '点击炸弹技能，再点一个中心棋子，炸掉周围 3×3 范围。',
    visual: 'bomb'
  },
  {
    category: '技能教程',
    title: '锤子：精准清障',
    description: '点击锤子技能，再点一个棋子，单独把它敲碎。',
    visual: 'hammer'
  },
  {
    category: '技能教程',
    title: '交换：拖出新组合',
    description: '点击交换技能，拖动一个棋子到相邻格；形成合并才会保留。',
    visual: 'swap'
  }
]

const TILE_COLORS = [
  new Color(255, 205, 119, 255),
  new Color(116, 210, 177, 255),
  new Color(102, 179, 224, 255),
  new Color(244, 144, 150, 255)
]

// 模块级索引跨 loading.scene 的多次实例保留，用来减少连续两次抽到同一条提示的概率。
let previousTipIndex = -1

@ccclass('LoadingSceneController')
export class LoadingSceneController extends Component {
  // 加载完成后进入的目标场景，默认对应 assets/scence/game.scene。
  @property({ tooltip: 'Target scene name' })
  targetSceneName = 'game'

  // 加载页最短停留时间，给玩家留出看清随机提示的时间。
  @property({ tooltip: 'Minimum loading page duration in seconds' })
  minimumDisplaySeconds = 1.8

  // 三个技能教程复用游戏内技能按钮贴图，保证玩家进入对局后能直接认出对应按钮。
  @property({ type: SpriteFrame, tooltip: 'Bomb skill tutorial sprite frame' })
  bombSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: 'Hammer skill tutorial sprite frame' })
  hammerSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: 'Swap skill tutorial sprite frame' })
  swapSpriteFrame: SpriteFrame | null = null

  // 背景节点优先由层级管理器维护，脚本只负责绘制轻量纯色装饰。
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
  private tipCardNode: Node | null = null
  private tipIconNode: Node | null = null
  private activeTip: LoadingTip = LOADING_TIPS[0]
  private hasRequestedLoadScene = false
  // 记录 loading 开始时间，用来保证加载页至少展示 minimumDisplaySeconds。
  private loadingStartedAtMs = 0

  onLoad() {
    this.selectRandomPresentation()
    this.ensureLoadingUi()
    this.renderProgress(0)
  }

  start() {
    this.fitBackgroundToCanvas()
    this.scheduleOnce(() => this.fitBackgroundToCanvas(), 0)
    this.playEntranceAnimation()
    this.startLoadingTargetScene()
  }

  onDestroy() {
    if (this.tipCardNode) {
      Tween.stopAllByTarget(this.tipCardNode)
    }
    if (this.tipIconNode) {
      Tween.stopAllByTarget(this.tipIconNode)
    }
  }

  /**
   * 加载目标场景并同步进度表现。
   *
   * Cocos 的 preloadScene 会分阶段回调 completedCount / totalCount；
   * 加载完成后再结合最短展示时间 loadScene，避免直接切玩法场景时出现黑屏等待或闪屏感。
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
        this.renderProgress(totalCount > 0 ? completedCount / totalCount : 0)
      },
      () => {
        this.renderProgress(1)
        const elapsedSeconds = (Date.now() - this.loadingStartedAtMs) / 1000
        const remainingSeconds = Math.max(0, this.minimumDisplaySeconds - elapsedSeconds)
        // 即使资源已加载完成，也等到最短停留时间后再切场景，让过渡节奏更稳定。
        this.scheduleOnce(() => director.loadScene(this.targetSceneName), remainingSeconds)
      }
    )
  }

  // 加载页 UI 优先使用层级节点，缺失时补最小结构，便于 Creator 里继续调样式。
  private ensureLoadingUi() {
    // loading 不再展示旧 1024 Logo；场景节点保留关闭状态，避免破坏已有层级引用。
    const legacyLogo = this.findChildDeep(this.node, 'Logo')
    if (legacyLogo) {
      legacyLogo.active = false
    }

    this.backgroundNode = this.backgroundNodeRef ?? this.node.getChildByName('Background') ?? this.createBackgroundNode()
    this.progressFillNode = this.progressFillNodeRef ?? this.findChildDeep(this.node, 'ProgressFill')
    this.percentLabel = this.percentLabelNodeRef?.getComponent(Label) ?? this.findChildDeep(this.node, 'PercentLabel')?.getComponent(Label) ?? null

    if (!this.progressFillNode) {
      this.createFallbackProgressBar()
    }
    if (!this.percentLabel) {
      this.percentLabel = this.createFallbackPercentLabel()
    }

    this.createLoadingHeader()
    this.createRandomTipCard()
    this.fitBackgroundToCanvas()
  }

  /**
   * 为本次加载选择提示。
   *
   * 随机结果会避开上一次使用的索引；当提示只有一项时仍安全回退到该项。
   * 选择动作发生在 UI 创建之前，保证玩家看到的首帧就是最终内容，不产生文字或图片跳变。
   */
  private selectRandomPresentation() {
    const tipIndex = this.pickRandomIndex(LOADING_TIPS.length, previousTipIndex)
    previousTipIndex = tipIndex
    this.activeTip = LOADING_TIPS[tipIndex]
  }

  // 随机索引会尽量避开上一项，让玩家连续返回首页再开始时更容易看到新内容。
  private pickRandomIndex(length: number, excludedIndex: number) {
    if (length <= 1) {
      return 0
    }

    const randomOffset = Math.floor(Math.random() * (length - 1)) + 1
    return excludedIndex >= 0 ? (excludedIndex + randomOffset) % length : Math.floor(Math.random() * length)
  }

  private createBackgroundNode() {
    const background = new Node('Background')
    background.setParent(this.node)
    background.addComponent(UITransform)
    background.addComponent(Graphics)
    background.setSiblingIndex(0)
    return background
  }

  /**
   * 根据 Canvas 尺寸绘制加载页纯色背景。
   *
   * 背景只使用低对比纯色、圆形色块和点阵，不再依赖首页背景图或 Logo 资源；
   * 既能降低加载页自身资源量，也让随机提示卡成为页面唯一视觉重点。
   */
  private fitBackgroundToCanvas() {
    if (!this.backgroundNode) {
      return
    }

    const canvasTransform = this.node.getComponent(UITransform)
    const backgroundTransform = this.backgroundNode.getComponent(UITransform) ?? this.backgroundNode.addComponent(UITransform)
    const backgroundGraphics = this.backgroundNode.getComponent(Graphics) ?? this.backgroundNode.addComponent(Graphics)
    if (!canvasTransform) {
      return
    }

    const width = canvasTransform.width
    const height = canvasTransform.height
    backgroundTransform.setContentSize(width, height)
    backgroundGraphics.clear()
    backgroundGraphics.fillColor = new Color(236, 248, 244, 255)
    backgroundGraphics.rect(-width / 2, -height / 2, width, height)
    backgroundGraphics.fill()

    // 大色块只压在边角，中心区域保持干净，避免影响教程文字可读性。
    backgroundGraphics.fillColor = new Color(190, 226, 226, 115)
    backgroundGraphics.circle(-width * 0.48, height * 0.43, width * 0.48)
    backgroundGraphics.fill()
    backgroundGraphics.fillColor = new Color(247, 221, 157, 105)
    backgroundGraphics.circle(width * 0.52, -height * 0.44, width * 0.5)
    backgroundGraphics.fill()
    backgroundGraphics.fillColor = new Color(104, 192, 165, 30)
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        backgroundGraphics.circle(-width * 0.42 + column * 28, -height * 0.1 + row * 28, 4)
      }
    }
    backgroundGraphics.fill()
  }

  // 顶部只保留状态文字和三个圆点，不再使用任何品牌 Logo 图片。
  private createLoadingHeader() {
    const header = new Node('LoadingHeader')
    header.setParent(this.node)
    header.setPosition(0, 410, 0)
    header.addComponent(UITransform).setContentSize(520, 120)
    this.createLabel(header, 'Title', '游戏准备中', 38, new Color(43, 98, 107, 255), new Vec3(0, 20, 0), 500, 54)
    this.createLabel(header, 'Subtitle', '正在整理棋盘与数字', 21, new Color(105, 145, 148, 235), new Vec3(0, -25, 0), 420, 36)

    const dots = header.addComponent(Graphics)
    dots.fillColor = new Color(100, 201, 165, 255)
    dots.circle(-26, -58, 5)
    dots.circle(0, -58, 5)
    dots.circle(26, -58, 5)
    dots.fill()
  }

  /**
   * 创建随机提示卡和教程插图。
   *
   * 卡片外壳保持固定，内容则根据 activeTip 生成。技能提示会同时展示游戏内按钮图片和棋盘示意，
   * 普通玩法提示使用轻量 Graphics 图解，因此不会额外引入加载页专用大图资源。
   */
  private createRandomTipCard() {
    const card = new Node('TipCard')
    card.setParent(this.node)
    card.setPosition(0, 6, 0)
    card.addComponent(UITransform).setContentSize(TIP_CARD_WIDTH, TIP_CARD_HEIGHT)
    const opacity = card.addComponent(UIOpacity)
    opacity.opacity = 0

    const graphics = card.addComponent(Graphics)
    graphics.fillColor = new Color(36, 77, 91, 42)
    graphics.roundRect(-TIP_CARD_WIDTH / 2 + 6, -TIP_CARD_HEIGHT / 2 - 10, TIP_CARD_WIDTH, TIP_CARD_HEIGHT, 34)
    graphics.fill()
    graphics.fillColor = new Color(248, 253, 250, 244)
    graphics.roundRect(-TIP_CARD_WIDTH / 2, -TIP_CARD_HEIGHT / 2, TIP_CARD_WIDTH, TIP_CARD_HEIGHT, 34)
    graphics.fill()
    graphics.strokeColor = new Color(255, 255, 255, 210)
    graphics.lineWidth = 3
    graphics.roundRect(-TIP_CARD_WIDTH / 2 + 2, -TIP_CARD_HEIGHT / 2 + 2, TIP_CARD_WIDTH - 4, TIP_CARD_HEIGHT - 4, 32)
    graphics.stroke()

    this.createCategoryBadge(card, this.activeTip.category)
    this.createLabel(card, 'TipTitle', this.activeTip.title, 34, new Color(43, 98, 107, 255), new Vec3(0, 144, 0), 548, 52)
    this.createLabel(card, 'TipDescription', this.activeTip.description, 23, new Color(91, 126, 132, 255), new Vec3(0, 92, 0), 530, 66)

    const tutorial = new Node('TutorialIllustration')
    tutorial.setParent(card)
    tutorial.setPosition(0, -42, 0)
    tutorial.addComponent(UITransform).setContentSize(540, 202)
    const tutorialGraphics = tutorial.addComponent(Graphics)
    tutorialGraphics.fillColor = new Color(224, 244, 237, 218)
    tutorialGraphics.roundRect(-270, -101, 540, 202, 25)
    tutorialGraphics.fill()

    if (this.isSkillTip(this.activeTip.visual)) {
      this.drawSkillTutorial(tutorial, this.activeTip.visual)
    } else {
      this.drawGameplayTutorial(tutorial, this.activeTip.visual)
    }

    this.createLabel(
      card,
      'RandomTipFootnote',
      '每次进入，都会遇见一条新提示',
      19,
      new Color(119, 159, 159, 230),
      new Vec3(0, -218, 0),
      480,
      32
    )

    this.tipCardNode = card
  }

  private createCategoryBadge(parent: Node, category: LoadingTip['category']) {
    const badge = new Node('TipCategory')
    badge.setParent(parent)
    badge.setPosition(0, 207, 0)
    badge.addComponent(UITransform).setContentSize(178, 48)
    const graphics = badge.addComponent(Graphics)
    graphics.fillColor = category === '技能教程'
      ? new Color(255, 204, 112, 255)
      : new Color(102, 203, 166, 255)
    graphics.roundRect(-89, -24, 178, 48, 24)
    graphics.fill()
    this.createLabel(badge, 'Label', category, 22, new Color(255, 255, 255, 255), Vec3.ZERO, 170, 40)
  }

  private isSkillTip(visual: LoadingTipVisual): visual is 'bomb' | 'hammer' | 'swap' {
    return visual === 'bomb' || visual === 'hammer' || visual === 'swap'
  }

  /**
   * 绘制技能教程：左侧使用真实技能按钮图片，右侧用小棋盘说明作用范围或操作方向。
   * @param parent 教程插图容器。
   * @param visual 当前技能类型。
   */
  private drawSkillTutorial(parent: Node, visual: 'bomb' | 'hammer' | 'swap') {
    const iconFrame = visual === 'bomb'
      ? this.bombSpriteFrame
      : visual === 'hammer'
        ? this.hammerSpriteFrame
        : this.swapSpriteFrame

    if (iconFrame) {
      const icon = new Node('SkillIcon')
      icon.setParent(parent)
      icon.setPosition(-182, 12, 0)
      icon.addComponent(UITransform).setContentSize(118, 118)
      const sprite = icon.addComponent(Sprite)
      sprite.spriteFrame = iconFrame
      sprite.type = Sprite.Type.SIMPLE
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      this.tipIconNode = icon
    } else {
      this.createTutorialTile(parent, 'SkillFallback', '技能', -182, 12, 96, TILE_COLORS[1], 24)
    }

    const arrow = parent.getComponent(Graphics)
    if (arrow) {
      this.drawArrow(arrow, -108, 12, -55, 12, new Color(70, 143, 144, 230))
    }

    if (visual === 'bomb') {
      this.drawBombDiagram(parent)
      return
    }
    if (visual === 'hammer') {
      this.drawHammerDiagram(parent)
      return
    }
    this.drawSwapDiagram(parent)
  }

  private drawBombDiagram(parent: Node) {
    const size = 48
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const isCenter = row === 1 && column === 1
        this.createTutorialTile(
          parent,
          `BombCell${row}${column}`,
          isCenter ? '✦' : '',
          65 + (column - 1) * 54,
          18 + (row - 1) * 54,
          size,
          isCenter ? new Color(244, 125, 112, 255) : new Color(255, 193, 103, 215),
          26
        )
      }
    }
    this.createLabel(parent, 'BombRangeLabel', '点击中心 · 清除 3×3', 19, new Color(83, 119, 124, 255), new Vec3(65, -78, 0), 250, 28)
  }

  private drawHammerDiagram(parent: Node) {
    const values = ['2', '8', '4']
    values.forEach((value, index) => {
      const isTarget = index === 1
      this.createTutorialTile(
        parent,
        `HammerCell${index}`,
        isTarget ? '×' : value,
        65 + (index - 1) * 72,
        18,
        62,
        isTarget ? new Color(244, 125, 112, 255) : TILE_COLORS[index],
        isTarget ? 38 : 25
      )
    })
    this.createLabel(parent, 'HammerTargetLabel', '点哪颗 · 敲哪颗', 19, new Color(83, 119, 124, 255), new Vec3(65, -66, 0), 250, 28)
  }

  private drawSwapDiagram(parent: Node) {
    this.createTutorialTile(parent, 'SwapLeft', '2', 15, 18, 68, TILE_COLORS[0], 27)
    this.createTutorialTile(parent, 'SwapRight', '4', 115, 18, 68, TILE_COLORS[2], 27)
    const graphics = parent.getComponent(Graphics)
    if (graphics) {
      this.drawArrow(graphics, 50, 38, 80, 38, new Color(70, 143, 144, 230))
      this.drawArrow(graphics, 80, -2, 50, -2, new Color(70, 143, 144, 230))
    }
    this.createLabel(parent, 'SwapDirectionLabel', '拖到相邻格 · 可合并才保留', 18, new Color(83, 119, 124, 255), new Vec3(65, -66, 0), 280, 28)
  }

  /**
   * 根据首页提示类型生成对应的小型玩法图解。
   * @param parent 教程插图容器。
   * @param visual 玩法图解类型。
   */
  private drawGameplayTutorial(parent: Node, visual: Exclude<LoadingTipVisual, 'bomb' | 'hammer' | 'swap'>) {
    if (visual === 'merge') {
      this.createTutorialTile(parent, 'MergeLeft', '2', -140, 8, 72, TILE_COLORS[0], 29)
      this.createLabel(parent, 'MergePlus', '+', 28, new Color(76, 122, 128, 255), new Vec3(-72, 8, 0), 38, 40)
      this.createTutorialTile(parent, 'MergeRight', '2', -5, 8, 72, TILE_COLORS[0], 29)
      this.createLabel(parent, 'MergeEqual', '=', 28, new Color(76, 122, 128, 255), new Vec3(64, 8, 0), 38, 40)
      this.createTutorialTile(parent, 'MergeResult', '4', 140, 8, 80, TILE_COLORS[1], 31)
      return
    }

    if (visual === 'drop' || visual === 'plan') {
      this.drawDropDiagram(parent, visual === 'plan')
      return
    }

    if (visual === 'chain') {
      this.createTutorialTile(parent, 'Chain2', '2', -170, 12, 62, TILE_COLORS[0], 25)
      this.createLabel(parent, 'ChainArrow1', '→', 28, new Color(76, 122, 128, 255), new Vec3(-103, 12, 0), 40, 40)
      this.createTutorialTile(parent, 'Chain4', '4', -35, 12, 70, TILE_COLORS[1], 27)
      this.createLabel(parent, 'ChainArrow2', '→', 28, new Color(76, 122, 128, 255), new Vec3(38, 12, 0), 40, 40)
      this.createTutorialTile(parent, 'Chain8', '8', 115, 12, 82, TILE_COLORS[2], 31)
      this.createLabel(parent, 'ChainLabel', '连锁！', 21, new Color(235, 132, 76, 255), new Vec3(202, 12, 0), 80, 32)
      return
    }

    this.drawSpaceDiagram(parent)
  }

  private drawDropDiagram(parent: Node, isPlanningTip: boolean) {
    const graphics = parent.getComponent(Graphics)
    const targetColumn = isPlanningTip ? 3 : 2
    for (let column = 0; column < 5; column += 1) {
      const value = isPlanningTip && (column === 2 || column === 3) ? '2' : column === 1 ? '4' : ''
      this.createTutorialTile(parent, `DropBase${column}`, value, -128 + column * 64, -45, 54, value === '2' ? TILE_COLORS[0] : TILE_COLORS[1], 21)
    }
    this.createTutorialTile(parent, 'FallingPiece', isPlanningTip ? '2' : '8', -128 + targetColumn * 64, 54, 58, isPlanningTip ? TILE_COLORS[0] : TILE_COLORS[2], 23)
    if (graphics) {
      this.drawArrow(graphics, -128 + targetColumn * 64, 20, -128 + targetColumn * 64, -12, new Color(70, 143, 144, 230))
    }
  }

  private drawSpaceDiagram(parent: Node) {
    for (let column = 0; column < 5; column += 1) {
      for (let row = 0; row < 2; row += 1) {
        if (column === 3) {
          continue
        }
        const value = ((column + row) % 2 === 0) ? '2' : '4'
        this.createTutorialTile(parent, `SpaceCell${column}${row}`, value, -128 + column * 64, -30 + row * 62, 54, TILE_COLORS[(column + row) % 2], 20)
      }
    }
    this.createLabel(parent, 'SpaceLabel', '留一列', 20, new Color(235, 132, 76, 255), new Vec3(64, 75, 0), 100, 30)
  }

  private createTutorialTile(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    size: number,
    color: Color,
    fontSize: number
  ) {
    const tile = new Node(name)
    tile.setParent(parent)
    tile.setPosition(x, y, 0)
    tile.addComponent(UITransform).setContentSize(size, size)
    const graphics = tile.addComponent(Graphics)
    graphics.fillColor = new Color(41, 89, 98, 32)
    graphics.roundRect(-size / 2 + 3, -size / 2 - 4, size, size, 14)
    graphics.fill()
    graphics.fillColor = color
    graphics.roundRect(-size / 2, -size / 2, size, size, 14)
    graphics.fill()
    if (text) {
      this.createLabel(tile, 'Value', text, fontSize, new Color(255, 255, 255, 255), Vec3.ZERO, size - 6, size - 6)
    }
    return tile
  }

  private drawArrow(graphics: Graphics, startX: number, startY: number, endX: number, endY: number, color: Color) {
    const angle = Math.atan2(endY - startY, endX - startX)
    const arrowSize = 9
    graphics.strokeColor = color
    graphics.lineWidth = 4
    graphics.moveTo(startX, startY)
    graphics.lineTo(endX, endY)
    graphics.moveTo(endX, endY)
    graphics.lineTo(endX - Math.cos(angle - Math.PI / 6) * arrowSize, endY - Math.sin(angle - Math.PI / 6) * arrowSize)
    graphics.moveTo(endX, endY)
    graphics.lineTo(endX - Math.cos(angle + Math.PI / 6) * arrowSize, endY - Math.sin(angle + Math.PI / 6) * arrowSize)
    graphics.stroke()
  }

  private createLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    position: Vec3,
    width: number,
    height: number
  ) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(position)
    node.addComponent(UITransform).setContentSize(width, height)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.round(fontSize * 1.35)
    label.color = color
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.overflow = Label.Overflow.SHRINK
    return label
  }

  // 卡片淡入并轻微上浮；技能图片额外做小幅呼吸，让静态教程更容易被注意到。
  private playEntranceAnimation() {
    if (!this.tipCardNode) {
      return
    }

    const opacity = this.tipCardNode.getComponent(UIOpacity)
    this.tipCardNode.setScale(new Vec3(0.94, 0.94, 1))
    this.tipCardNode.setPosition(0, -10, 0)
    tween(this.tipCardNode)
      .parallel(
        tween().to(0.32, { scale: Vec3.ONE }, { easing: 'backOut' }),
        tween().to(0.32, { position: new Vec3(0, 6, 0) }, { easing: 'quadOut' })
      )
      .start()
    if (opacity) {
      tween(opacity).to(0.2, { opacity: 255 }, { easing: 'quadOut' }).start()
    }

    if (this.tipIconNode) {
      tween(this.tipIconNode)
        .repeatForever(
          tween()
            .to(0.72, { position: new Vec3(-182, 18, 0) }, { easing: 'sineInOut' })
            .to(0.72, { position: new Vec3(-182, 8, 0) }, { easing: 'sineInOut' })
        )
        .start()
    }
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
    label.string = '正在准备游戏 · 0%'
    label.fontSize = 24
    label.lineHeight = 30
    // 新背景是浅色纯色底，进度文案改用深青色保证移动端户外环境下仍清晰可读。
    label.color = new Color(66, 111, 117, 235)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    return label
  }

  private renderProgress(progress: number) {
    const normalizedProgress = Math.max(0, Math.min(1, progress))
    this.progressFillNode?.setScale(new Vec3(normalizedProgress, 1, 1))
    if (this.percentLabel) {
      const percentage = Math.round(normalizedProgress * 100)
      this.percentLabel.string = percentage >= 100 ? '准备完成 · 100%' : `正在准备游戏 · ${percentage}%`
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
