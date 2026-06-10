import { _decorator, Color, Component, EventTouch, instantiate, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc'
import { PieceController } from './PieceController'
import { AudioClip } from 'cc'
import { PlayUIController, type PlayUIState } from './PlayUIController'
import { StartPageController } from './StartPageController'
import { GameAudioManager } from './GameAudioManager'
import { GameShareAdapter } from './GameShareAdapter'
import { SkillStock } from './SkillStock'
import { BoardGeometry } from './BoardGeometry'
import { ScoreManager, type ScoreRewardEvent } from './ScoreManager'
import { BoardModel, type BoardCell } from './BoardModel'
import { TransientFxRegistry } from './TransientFxRegistry'

const { ccclass, property } = _decorator

// 统一描述棋盘中的格子坐标，row 从下往上增长，column 从左往右增长。
type CellPosition = {
  row: number
  column: number
}

// 表示一次可执行的合并组，anchor 是保留下来的棋子，其余成员会向它聚合。
type MergeGroup = {
  value: number
  anchor: PieceController
  anchorPos: CellPosition
  members: PieceController[]
}

// 定向合并的结果，anchor 表示合并后继续参与后续连锁的棋子。
type DirectedMergeResult = {
  anchor: PieceController | null
  changed: boolean
}

// 交换技能拖拽时需要记录起点和原始表现，方便无效释放时回到原位。
type SwapDragState = {
  source: CellPosition
  piece: PieceController
  originalPosition: Vec3
  originalScale: Vec3
  originalSiblingIndex: number
  dragAxis: 'horizontal' | 'vertical' | null
  previewTarget: CellPosition | null
  previewPiece: PieceController | null
  desiredPiecePosition: Vec3
  desiredPreviewPiecePosition: Vec3 | null
}

// 控制同屏特效节点上限，避免频繁创建粒子导致卡顿。
const MAX_ACTIVE_FX = 18
// 每局开始时三个技能都给 1 次，后续奖励或商店扩展可以从这里统一调整初始值。
const INITIAL_SKILL_COUNT = 1

@ccclass('PlayController')
export class PlayController extends Component {
  // 棋盘列数，当前玩法固定为 5 列。
  @property({ tooltip: 'Board columns' })
  boardwidth = 5

  // 棋盘行数，当前玩法固定为 7 行。
  @property({ tooltip: 'Board rows' })
  boardheight = 7

  // 棋子预制体，运行时会从这里实例化新的下落棋子。
  @property({ type: Prefab, tooltip: 'Piece prefab' })
  basePieceController: Prefab | null = null

  // 锤子技能使用的贴图，场景里绑定 assets/images/Skills/Hammer.png 的 SpriteFrame。
  @property({ type: SpriteFrame, tooltip: 'Hammer skill sprite frame' })
  hammerSkillSpriteFrame: SpriteFrame | null = null

  // 炸弹技能使用的贴图，场景里绑定 assets/images/Skills/Bomb.png 的 SpriteFrame。
  @property({ type: SpriteFrame, tooltip: 'Bomb skill sprite frame' })
  bombSkillSpriteFrame: SpriteFrame | null = null

  // 棋子落地触碰时播放的音效。
  @property({ type: AudioClip, tooltip: 'Piece collision sound effect' })
  collisionAudioClip: AudioClip | null = null

  // 棋子落地后直接触发消除时播放的音效。
  @property({ type: AudioClip, tooltip: 'Landing merge sound effect' })
  landingMergeAudioClip: AudioClip | null = null

  // 交换后无法形成消除时，回退动画播放的提示音。
  @property({ type: AudioClip, tooltip: 'Swap rollback sound effect' })
  swapRollbackAudioClip: AudioClip | null = null

  // 首页背景音乐预留资源位；未绑定专属音频时首页保持静音，不复用玩法 BGM。
  @property({ type: AudioClip, tooltip: 'Start page background music' })
  startPageBgmClip: AudioClip | null = null

  // 游戏场景循环播放的背景音乐。
  @property({ type: AudioClip, tooltip: 'Gameplay background music' })
  gameplayBgmClip: AudioClip | null = null

  // 单元格之间的额外间距，步长 = 棋子尺寸 + 间距。
  @property({ tooltip: 'Cell spacing' })
  spacing = 10

  // 旧版手动配置的棋盘原点，当前主要作为序列化兼容字段保留。
  @property({ tooltip: 'Bottom-left cell center X' })
  x = -260

  // 旧版手动配置的棋盘原点，当前主要作为序列化兼容字段保留。
  @property({ tooltip: 'Bottom-left cell center Y' })
  y = -390

  // 棋子显示尺寸，生成棋子和特效时都会同步使用这个尺寸。
  @property({ tooltip: 'Piece size' })
  pieceSize = 120

  // 普通下落速度。
  @property({ tooltip: 'Normal fall speed' })
  fallSpeed = 360

  // 快速下落速度，按下时切换到这个速度。
  @property({ tooltip: 'Fast fall speed' })
  fastFallSpeed = 1800

  // 新棋子出生在棋盘顶部之外的偏移量，给玩家留出观察和拖动时间。
  @property({ tooltip: 'Spawn offset above board' })
  spawnOffsetY = 160

  @property({ type: [SpriteFrame], tooltip: '技能计数数字贴图' })
  counterNumberSpriteFrames: SpriteFrame[] = []

  // 可直接随机生成的初始数字池，超过 128 的数字只能通过合成得到。
  private readonly basePieceList = [2, 4, 8, 16, 32, 64, 128]
  // 二维数组表示棋盘状态，board[row][column] 为空时用 null 表示。
  private board: BoardCell[][] = []
  // 当前正在下落的棋子；当它落地并结算后，这里会被清空。
  private currentPiece: PieceController | null = null
  // 当前下落棋子的目标列。
  private currentColumn = 0
  // 是否处于按住后的快速下落状态。
  private isFastDropping = false
  // 游戏结束标记；当前由结算弹窗接管重玩入口，根节点触摸重开只作为兜底。
  private isGameOver = false
  // 是否正在执行合并、重力结算等异步流程；期间禁止再次操作。
  private isResolving = false
  // 暂停标记，暂停时 update 不再推动棋子下落。
  private isPaused = false
  // 交换技能激活时只冻结玩法，不触发真正暂停弹窗。
  private isSwapSkillActive = false
  // 锤子技能激活时同样只冻结玩法，等待玩家点选一个棋盘内棋子敲碎。
  private isHammerSkillActive = false
  // 炸弹技能激活时冻结玩法，等待玩家点选中心棋子并炸掉九宫格范围。
  private isBombSkillActive = false
  // 当前正在被拖拽的棋子信息，释放后用于判断是否可以交换。
  private swapDragState: SwapDragState | null = null
  // 本局技能库存交给独立对象管理，玩法层只判断能否施放和何时扣减。
  private readonly skillStock = new SkillStock(INITIAL_SKILL_COUNT)
  // 棋盘坐标和分数规则都交给独立模块，PlayController 保留对局流程调度。
  private readonly boardModel = new BoardModel()
  private boardGeometry: BoardGeometry | null = null
  private readonly scoreManager = new ScoreManager()
  // UI 渲染组件，专门负责棋盘绘制、状态栏、控制栏和暂停遮罩。
  private uiController: PlayUIController | null = null
  // 首页单独交给启动页组件管理，避免把展示逻辑散落在玩法代码里。
  private startPageController: StartPageController | null = null
  // 首次进入场景时先停在开始页，点击开始后才真正进入对局。
  private hasStartedSession = false
  // 拖尾生成计时器，用来控制特效频率。
  private trailTimer = 0
  // 当前屏幕上仍未销毁的特效节点交给注册表统一管理，便于重开和回首页收口。
  private readonly transientFx = new TransientFxRegistry(MAX_ACTIVE_FX)
  // 音频和分享适配从玩法主流程中拆出，降低 PlayController 的横向职责。
  private audioManager: GameAudioManager | null = null
  private readonly shareAdapter = new GameShareAdapter()
  // 生命周期入口：先准备棋盘数据，再把界面初始化交给独立的 UI 组件。
  onLoad() {
    this.resetBoard()
    this.boardGeometry = new BoardGeometry(this.node, this.buildBoardGeometryOptions())
    this.audioManager = new GameAudioManager(this.node)
    this.audioManager.setup()
    this.uiController = this.getComponent(PlayUIController) ?? this.addComponent(PlayUIController)
    // UI 组件只接收绘制所需参数和按钮回调，不参与玩法计算。
    this.uiController.setup({
      boardwidth: this.boardwidth,
      boardheight: this.boardheight,
      pieceSize: this.pieceSize,
      spacing: this.spacing,
      onPauseTap: () => this.togglePauseFromUi(),
      onReturnHomeTap: () => this.returnToStartPageFromPause(),
      onRankTap: () => this.showRankFromPause(),
      onBombSkillTap: () => this.toggleBombSkillFromUi(),
      onHammerSkillTap: () => this.toggleHammerSkillFromUi(),
      onSwapSkillTap: () => this.toggleSwapSkillFromUi(),
      onGameOverReplayTap: () => {
        void this.restartGame()
      },
      onGameOverShareTap: () => this.shareGameFromGameOver(),
      counterNumberSpriteFrames: this.counterNumberSpriteFrames
    })
    this.startPageController = this.getComponent(StartPageController) ?? this.addComponent(StartPageController)
    this.startPageController.setup({
      onStartTap: () => this.startSessionFromStartPage()
    })
    this.bindInput()
  }
  // 等场景节点初始化完成后再生成第一颗棋子，避免引用未准备好的节点。
  start() {
    // 某些平台会在启动后一帧才拿到稳定的安全区，这里让 UI 组件再补一次布局。
    this.uiController?.syncLayout()
    this.startPageController?.syncLayout()
    this.audioManager?.playStartPageBackgroundMusic(this.startPageBgmClip)
    this.refreshUiState()
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this)
    this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this)
    this.uiController = null
    this.startPageController = null
  }

  // 每帧更新当前下落棋子的目标位置，并在接近落点时触发落地结算。
  update(dt: number) {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isSwapSkillActive) {
      // 技能态下不推进下落，只更新交换预览的惯性跟随。
      this.updateSwapDragMotion(dt)
      return
    }
    if (this.isHammerSkillActive) {
      return
    }
    if (this.isBombSkillActive) {
      return
    }

    if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
      return
    }

    const row = this.getDropRow(this.currentColumn)
    if (row < 0) {
      const fallbackColumn = this.getNearestAvailableColumn(this.currentColumn)
      if (fallbackColumn < 0) {
        this.endGame()
        return
      }
      this.currentColumn = fallbackColumn
    }

    const dropRow = this.getDropRow(this.currentColumn)
    if (dropRow < 0) {
      this.endGame()
      return
    }

    const speed = this.isFastDropping ? this.fastFallSpeed : this.fallSpeed
    const targetPosition = this.getCellPosition(dropRow, this.currentColumn)
    const currentPosition = this.currentPiece.node.position.clone()
    const nextY = Math.max(targetPosition.y, currentPosition.y - speed * dt)

    this.currentPiece.syncTrailEffect()
    this.currentPiece.node.setPosition(targetPosition.x, nextY, 0)
    // this.updateFallingTrail(dt)

    if (nextY <= targetPosition.y + 1) {
      void this.landPiece(dropRow, this.currentColumn)
    }
  }

  // 绑定全局触摸事件，玩家通过按下位置选择列，并用按住实现快速下落。
  private bindInput() {
    this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this)
    this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this)
  }
  // 触摸按下时确定列并开启快速下落
  private handleTouchStart(event: EventTouch) {
    if (this.isGameOver) {
      void this.restartGame()
      return
    }

    if (!this.hasStartedSession) {
      return
    }

    if (this.isSwapSkillActive) {
      this.handleSwapSkillTouchStart(event)
      return
    }
    if (this.isHammerSkillActive) {
      void this.handleHammerSkillTouchStart(event)
      return
    }
    if (this.isBombSkillActive) {
      void this.handleBombSkillTouchStart(event)
      return
    }

    if (!this.currentPiece || this.isResolving || this.isPaused) {
      return
    }

    const column = this.getColumnFromTouch(event)
    if (column < 0) {
      return
    }

    const availableColumn = this.getNearestAvailableColumn(column)
    if (availableColumn >= 0) {
      this.currentColumn = availableColumn
      this.isFastDropping = true
      this.trailTimer = 0
      this.refreshUiState()
    }
  }

  // 技能拖拽期间移动被选中的棋子，普通模式下不处理移动事件。
  private handleTouchMove(event: EventTouch) {
    if (!this.hasStartedSession) {
      return
    }

    if (!this.isSwapSkillActive) {
      return
    }

    this.handleSwapSkillTouchMove(event)
  }

  // 触摸抬起时结束本次按住状态；当前逻辑中只需要停止继续加速即可。
  private handleTouchEnd(event: EventTouch) {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isSwapSkillActive) {
      void this.handleSwapSkillTouchEnd(event)
      return
    }

    if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
      return
    }

    // 只有在手指仍按住时才保持快速下落，抬起或取消触摸后要立即恢复正常速度。
    // this.isFastDropping = false
  }

  // 触摸被系统取消时不能执行技能交换，只恢复拖拽棋子，避免切后台等场景误触发。
  private handleTouchCancel() {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isSwapSkillActive && this.swapDragState) {
      void this.restoreSwapDraggedPiece(this.swapDragState)
    }
  }

  // 锤子技能点选任意落地棋子后立即敲碎，并在动画后触发重力和消除检测。
  private async handleHammerSkillTouchStart(event: EventTouch) {
    if (this.isResolving) {
      return
    }

    const target = this.getCellFromTouch(event)
    if (!target) {
      return
    }

    const piece = this.board[target.row][target.column]
    if (!piece) {
      return
    }

    event.propagationStopped = true
    await this.executeHammerSkill(target, piece)
  }

  // 炸弹技能点选中心棋子后，会收集周围九宫格内所有已落地棋子并统一炸碎。
  private async handleBombSkillTouchStart(event: EventTouch) {
    if (this.isResolving) {
      return
    }

    const target = this.getCellFromTouch(event)
    if (!target || !this.board[target.row][target.column]) {
      return
    }

    event.propagationStopped = true
    await this.executeBombSkill(target)
  }

  // 重置棋盘数据，并把默认目标列放在中间列。
  private resetBoard() {
    this.board = this.boardModel.createEmptyBoard(this.boardheight, this.boardwidth)
    // 重开或首次进入时，分数统计要和棋盘一起清零。
    this.scoreManager.reset()
    this.currentColumn = Math.floor(this.boardwidth / 2)
  }

  // 清理棋盘中已经实例化的棋子节点，返回首页和重新开始都复用这套收口逻辑。
  private clearBoardPieces() {
    this.boardModel.destroyBoardPieces(this.board, this.boardheight, this.boardwidth)

    if (this.currentPiece) {
      this.currentPiece.node.destroy()
      this.currentPiece = null
    }
  }

  /**
   * 生成下一颗可操作棋子并放到出生区。
   *
   * 这里只负责实例化预制体、同步棋盘格子尺寸、随机初始数值和刷新 UI 状态。
   * 如果当前棋盘已经没有可落子列，会直接进入游戏结束流程。
   */
  private spawnPiece() {
    if (this.isBoardFull() || !this.basePieceController) {
      this.endGame()
      return
    }

    const column = this.getNearestAvailableColumn(Math.floor(this.boardwidth / 2))
    if (column < 0) {
      this.endGame()
      return
    }

    const pieceNode = instantiate(this.basePieceController)
    const pieceController = pieceNode.getComponent(PieceController)
    if (!pieceController) {
      pieceNode.destroy()
      return
    }
    const pieceTransform = pieceNode.getComponent(UITransform)
    if (pieceTransform) {
      // 让预制体的真实显示尺寸和当前棋盘格子尺寸保持一致。
      pieceTransform.setContentSize(this.pieceSize, this.pieceSize)
    }
    // 棋子尺寸由棋盘动态决定，拖尾发射区域也要在实例化后按真实尺寸重新校准。
    pieceController.syncTrailEffect()

    const value = this.basePieceList[Math.floor(Math.random() * this.basePieceList.length)]
    this.currentColumn = column
    this.isFastDropping = false
    this.trailTimer = 0
    pieceController.setValue(value)
    this.scoreManager.updateHighestPieceValue(value)
    pieceNode.setScale(Vec3.ONE)
    pieceNode.setPosition(this.getSpawnPosition(column))
    this.node.addChild(pieceNode)
    this.currentPiece = pieceController
    this.refreshUiState()
  }

  /**
   * 将当前下落棋子写入棋盘并启动完整落地结算。
   *
   * 落地后先停止拖尾并固定棋子坐标，再执行“落地点定向连锁合并”，
   * 最后进入统一的重力和全盘合并循环。整个过程中通过 `isResolving`
   * 冻结输入，避免异步动画期间棋盘状态被再次修改。
   *
   * @param row 落地行，row 从底部向上递增。
   * @param column 落地列，column 从左向右递增。
   */
  private async landPiece(row: number, column: number) {

    if (!this.currentPiece || this.isResolving) {
      return
    }
    this.currentPiece.stopParticle()
    this.isResolving = true
    const landedPiece = this.currentPiece
    this.currentPiece = null
    this.transientFx.clear()
    this.board[row][column] = landedPiece
    landedPiece.node.setPosition(this.getCellPosition(row, column))
    this.refreshUiState()

    const willMergeOnLanding = this.canPieceMergeNow(landedPiece)
    if (!willMergeOnLanding) {
      this.audioManager?.playSoundEffect(this.collisionAudioClip)
    }

    const directedResult = await this.resolveLandingChain(landedPiece)
    await this.settleBoard(directedResult.anchor)

    this.isResolving = false
    this.refreshUiState()
    if (this.isBoardFull()) {
      this.endGame()
      return
    }

    this.spawnPiece()
  }

  /**
   * 反复执行重力下落和全盘合并，直到棋盘稳定。
   *
   * 每轮先把所有列向下压缩，再扫描全盘可合并组。
   * 如果没有合并但发生过重力移动，会继续下一轮扫描，确保重力导致的新相邻组也能被处理。
   *
   * @param preferredAnchor 优先保留的合并锚点，通常来自刚刚落地或连锁产生的棋子。
   */
  private async settleBoard(preferredAnchor: PieceController | null) {
    let chainDepth = 1
    while (true) {
      const moved = await this.applyGravityAllColumns()
      const groups = this.findMergeGroups(preferredAnchor)
      if (groups.length === 0) {
        if (!moved) {
          return
        }
        preferredAnchor = null
        continue
      }

      await this.playMergeGroups(groups, chainDepth)
      chainDepth += 1
      preferredAnchor = null
    }
  }

  // 进入交换技能后的第一次按下只允许选择棋盘内已经落地的棋子。
  private handleSwapSkillTouchStart(event: EventTouch) {
    if (this.isResolving || this.swapDragState) {
      return
    }

    const source = this.getCellFromTouch(event)
    if (!source) {
      return
    }

    const piece = this.board[source.row][source.column]
    if (!piece) {
      return
    }

    event.propagationStopped = true
    Tween.stopAllByTarget(piece.node)
    this.swapDragState = {
      source,
      piece,
      originalPosition: piece.node.position.clone(),
      originalScale: piece.node.scale.clone(),
      originalSiblingIndex: piece.node.getSiblingIndex(),
      dragAxis: null,
      previewTarget: null,
      previewPiece: null,
      desiredPiecePosition: piece.node.position.clone(),
      desiredPreviewPiecePosition: null
    }
    // 被拖动的棋子临时提到更高层级，避免拖拽过程中被其他棋子遮住。
    piece.node.setSiblingIndex(this.node.children.length - 1)
    piece.node.setScale(new Vec3(1.08, 1.08, 1))
    this.moveSwapDragPiece(event)
  }

  // 拖拽过程中让棋子跟随手指，释放时再判断是否落在相邻棋子上。
  private handleSwapSkillTouchMove(event: EventTouch) {
    if (!this.swapDragState || this.isResolving) {
      return
    }

    event.propagationStopped = true
    this.moveSwapDragPiece(event)
  }

  // 交换技能释放时只接受相邻且非空的目标格，否则回到起点继续等待玩家操作。
  private async handleSwapSkillTouchEnd(event: EventTouch) {
    if (!this.swapDragState || this.isResolving) {
      return
    }

    event.propagationStopped = true
    const dragState = this.swapDragState
    const target = this.getSwapTargetFromDrag(event, dragState, true)
    if (!target || !this.canSwapCells(dragState.source, target)) {
      await this.restoreSwapDraggedPiece(dragState)
      return
    }
    this.syncSwapPreviewPiece(dragState, target)

    const targetPiece = this.board[target.row][target.column]
    if (!targetPiece) {
      await this.restoreSwapDraggedPiece(dragState)
      return
    }

    this.swapDragState = null
    await this.executeSwapSkill(dragState, target)
  }

  // 拖拽坐标统一转成 play 节点本地坐标，保证棋子跟手时不受屏幕分辨率影响。
  private moveSwapDragPiece(event: EventTouch) {
    if (!this.swapDragState) {
      return
    }

    const preview = this.getSwapDragPreview(event, this.swapDragState)
    if (!preview) {
      return
    }

    this.syncSwapPreviewPiece(this.swapDragState, preview.target)
    this.swapDragState.previewTarget = preview.target
    this.swapDragState.desiredPiecePosition = preview.position
    this.swapDragState.desiredPreviewPiecePosition = preview.previewPiecePosition
  }

  // 无效释放不会消耗技能，只把棋子动画退回原来的格子。
  private async restoreSwapDraggedPiece(dragState: SwapDragState) {
    this.swapDragState = null
    const animations = [
      this.animateSwapMove(dragState.piece.node, dragState.originalPosition, dragState.originalScale, 0.12)
    ]
    if (dragState.previewPiece && dragState.previewTarget) {
      // 无效释放时，相邻被预览挤开的棋子也要回到自己的格子。
      animations.push(
        this.animateSwapMove(
          dragState.previewPiece.node,
          this.getCellPosition(dragState.previewTarget.row, dragState.previewTarget.column),
          Vec3.ONE,
          0.12
        )
      )
    }

    await Promise.all(animations)
    this.restoreSwapPieceLayer(dragState)
  }

  // 根据当前有效目标同步被挤开的相邻棋子，目标变化时先让旧目标回到原格。
  private syncSwapPreviewPiece(dragState: SwapDragState, target: CellPosition | null) {
    const nextPiece = target ? this.board[target.row][target.column] : null
    if (dragState.previewPiece === nextPiece) {
      return
    }

    if (dragState.previewPiece && dragState.previewTarget) {
      void this.animateSwapMove(
        dragState.previewPiece.node,
        this.getCellPosition(dragState.previewTarget.row, dragState.previewTarget.column),
        Vec3.ONE,
        0.08
      )
    }

    dragState.previewPiece = nextPiece
  }

  // 拖拽预览用插值靠近目标位置，形成一点惯性，不再像普通拖拽一样硬贴手指。
  private updateSwapDragMotion(dt: number) {
    if (!this.swapDragState || this.isResolving) {
      return
    }

    const dragState = this.swapDragState
    this.lerpNodePosition(dragState.piece.node, dragState.desiredPiecePosition, dt, 18)
    if (dragState.previewPiece && dragState.desiredPreviewPiecePosition) {
      this.lerpNodePosition(dragState.previewPiece.node, dragState.desiredPreviewPiecePosition, dt, 14)
    }
  }

  // 简单的一阶插值足够模拟三消拖拽的惯性，同时不会引入额外 Tween 冲突。
  private lerpNodePosition(node: Node, target: Vec3, dt: number, speed: number) {
    const current = node.position
    const factor = Math.min(1, dt * speed)
    node.setPosition(
      current.x + (target.x - current.x) * factor,
      current.y + (target.y - current.y) * factor,
      current.z + (target.z - current.z) * factor
    )
  }

  // 被拖动棋子在拖拽、交换和回弹期间保持上层，流程结束后再恢复原来的层级。
  private restoreSwapPieceLayer(dragState: SwapDragState) {
    if (!dragState.piece.node?.isValid) {
      return
    }

    dragState.piece.node.setSiblingIndex(Math.min(dragState.originalSiblingIndex, this.node.children.length - 1))
  }

  // 真正执行交换：先改棋盘数据，再播放双向移动，随后复用现有全盘消除结算。
  private async executeSwapSkill(dragState: SwapDragState, target: CellPosition) {
    const source = dragState.source
    const sourcePiece = this.board[source.row][source.column]
    const targetPiece = this.board[target.row][target.column]
    if (!sourcePiece || !targetPiece) {
      return
    }

    this.isResolving = true
    this.board[source.row][source.column] = targetPiece
    this.board[target.row][target.column] = sourcePiece
    this.refreshUiState()

    await Promise.all([
      this.animateSwapMove(sourcePiece.node, this.getCellPosition(target.row, target.column), Vec3.ONE, 0.18),
      this.animateSwapMove(targetPiece.node, this.getCellPosition(source.row, source.column), Vec3.ONE, 0.18)
    ])

    if (this.findMergeGroups(sourcePiece).length === 0) {
      this.audioManager?.playSoundEffect(this.swapRollbackAudioClip)
      await this.rollbackSwapSkill(dragState, target)
      this.restoreSwapPieceLayer(dragState)
      this.isResolving = false
      this.refreshUiState()
      return
    }

    this.skillStock.consume('swap')
    this.refreshUiState()
    await this.settleBoard(sourcePiece)
    this.restoreSwapPieceLayer(dragState)
    this.isResolving = false
    this.isSwapSkillActive = false
    this.refreshUiState()
  }

  // 交换后如果没有形成任何可消除连通组，需要把棋盘数据和视觉都回弹到交换前。
  private async rollbackSwapSkill(dragState: SwapDragState, target: CellPosition) {
    const source = dragState.source
    const sourcePiece = this.board[target.row][target.column]
    const targetPiece = this.board[source.row][source.column]
    if (!sourcePiece || !targetPiece) {
      return
    }

    this.board[source.row][source.column] = sourcePiece
    this.board[target.row][target.column] = targetPiece
    await Promise.all([
      this.animateSwapMove(sourcePiece.node, this.getCellPosition(source.row, source.column), Vec3.ONE, 0.16),
      this.animateSwapMove(targetPiece.node, this.getCellPosition(target.row, target.column), Vec3.ONE, 0.16)
    ])
  }

  // 交换动画不复用普通落子移动，因为技能交换需要更明显的双向位移动画。
  private animateSwapMove(node: Node, position: Vec3, scale: Vec3, duration: number) {
    Tween.stopAllByTarget(node)
    return new Promise<void>(resolve => {
      tween(node)
        .parallel(
          tween().to(duration, { position }, { easing: 'quadOut' }),
          tween().to(duration, { scale }, { easing: 'quadOut' })
        )
        .call(resolve as any)
        .start()
    })
  }

  // 相邻交换只允许上下左右一格，不能斜向交换，也不能原地释放。
  private canSwapCells(source: CellPosition, target: CellPosition) {
    if (!this.isInsideBoard(target.row, target.column)) {
      return false
    }

    const distance = Math.abs(source.row - target.row) + Math.abs(source.column - target.column)
    return distance === 1
  }

  // 技能拖拽只允许横向或纵向预览，边缘向外和空格方向都不会产生视觉位移。
  private getSwapDragPreview(event: EventTouch, dragState: SwapDragState) {
    const localPosition = this.getLocalPositionFromTouch(event)
    if (!localPosition) {
      return null
    }

    const step = this.getStepSize()
    const deltaX = localPosition.x - dragState.originalPosition.x
    const deltaY = localPosition.y - dragState.originalPosition.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    if (Math.max(absX, absY) < step * 0.12) {
      dragState.dragAxis = null
      return { position: dragState.originalPosition, target: null, previewPiecePosition: null }
    }

    // 每次拖动都按当前热区重新判断方向：上下位移更大走纵向，否则走横向。
    dragState.dragAxis = absY > absX ? 'vertical' : 'horizontal'
    const axisDelta = dragState.dragAxis === 'horizontal' ? deltaX : deltaY
    const direction = axisDelta >= 0 ? 1 : -1
    const target = this.getSwapTargetFromDelta(dragState, direction)
    if (!target || !this.board[target.row][target.column]) {
      // 边缘棋子向边缘外拖动时直接保持原位，不给错误的可交换暗示。
      return { position: dragState.originalPosition, target: null, previewPiecePosition: null }
    }

    const distance = Math.min(Math.abs(axisDelta), step)
    const position = dragState.originalPosition.clone()
    if (dragState.dragAxis === 'horizontal') {
      position.x += direction * distance
    } else {
      position.y += direction * distance
    }

    const targetOrigin = this.getCellPosition(target.row, target.column)
    const previewPiecePosition = targetOrigin.clone()
    if (dragState.dragAxis === 'horizontal') {
      previewPiecePosition.x -= direction * distance
    } else {
      previewPiecePosition.y -= direction * distance
    }

    return { position, target, previewPiecePosition }
  }

  // 释放时必须拖过半格才算选择相邻目标，轻微误触只会回到原位。
  private getSwapTargetFromDrag(event: EventTouch, dragState: SwapDragState, requireThreshold: boolean) {
    const preview = this.getSwapDragPreview(event, dragState)
    if (!preview || !dragState.dragAxis || !preview.target) {
      return null
    }

    if (!requireThreshold) {
      return preview.target
    }

    const distance = Math.hypot(
      preview.position.x - dragState.originalPosition.x,
      preview.position.y - dragState.originalPosition.y
    )
    return distance >= this.getStepSize() * 0.45 ? preview.target : null
  }

  // 根据锁定轴和方向换算相邻目标格，越界时直接视为无效目标。
  private getSwapTargetFromDelta(dragState: SwapDragState, direction: number): CellPosition | null {
    const target = {
      row: dragState.source.row + (dragState.dragAxis === 'vertical' ? direction : 0),
      column: dragState.source.column + (dragState.dragAxis === 'horizontal' ? direction : 0)
    }

    return this.isInsideBoard(target.row, target.column) ? target : null
  }

  // 执行锤子技能：先把目标棋子从棋盘数组移除，再播放碎裂动画并进入现有结算流程。
  private async executeHammerSkill(target: CellPosition, piece: PieceController) {
    this.isResolving = true
    this.board[target.row][target.column] = null
    this.skillStock.consume('hammer')
    this.refreshUiState()

    await this.animateHammerBreak(piece)
    await this.settleBoard(null)

    this.isResolving = false
    this.isHammerSkillActive = false
    this.refreshUiState()
  }

  // 锤子技能的表现先播放锤子敲击，再把棋子炸成碎片粒子。
  private async animateHammerBreak(piece: PieceController) {
    const node = piece.node
    const origin = node.position.clone()
    await this.playHammerStrike(origin)
    this.spawnMergeFlash(piece, origin, 2)
    this.spawnSkillShatterParticles(piece, origin, 14, 1.1)

    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
    await new Promise<void>(resolve => {
      Tween.stopAllByTarget(node)
      Tween.stopAllByTarget(opacity)
      tween(node)
        .sequence(
          tween().to(0.05, { scale: new Vec3(1.12, 0.86, 1), position: origin.clone().add3f(0, -8, 0) }, { easing: 'quadIn' }),
          tween().to(0.06, { scale: new Vec3(0.92, 1.08, 1), position: origin.clone().add3f(0, 4, 0) }, { easing: 'backOut' }),
          tween().to(0.06, { scale: new Vec3(0.08, 0.08, 1), position: origin.clone().add3f(0, 10, 0) }, { easing: 'quadIn' })
        )
        .call(resolve as any)
        .start()
      tween(opacity)
        .delay(0.06)
        .to(0.1, { opacity: 0 }, { easing: 'quadIn' })
        .start()
    })

    node.destroy()
  }

  // 执行炸弹技能：以点选棋子为中心，移除九宫格范围内最多 9 个棋子。
  private async executeBombSkill(center: CellPosition) {
    const targets = this.collectBombTargets(center)
    if (targets.length === 0) {
      return
    }

    this.isResolving = true
    this.skillStock.consume('bomb')
    this.refreshUiState()
    const centerPosition = this.getCellPosition(center.row, center.column)
    await this.playBombCast(centerPosition)

    for (const target of targets) {
      this.board[target.row][target.column] = null
    }
    this.refreshUiState()

    await this.shakeBombTargets(targets, centerPosition)
    await this.animateBombBreakTargets(targets, centerPosition)
    await this.settleBoard(null)

    this.isResolving = false
    this.isBombSkillActive = false
    this.refreshUiState()
  }

  // 炸弹范围固定为中心格周围 3x3，边缘位置会自然少于 9 个。
  private collectBombTargets(center: CellPosition) {
    const targets: Array<{ row: number; column: number; piece: PieceController; position: Vec3 }> = []
    for (let row = center.row - 1; row <= center.row + 1; row++) {
      for (let column = center.column - 1; column <= center.column + 1; column++) {
        if (!this.isInsideBoard(row, column)) {
          continue
        }

        const piece = this.board[row][column]
        if (!piece) {
          continue
        }

        targets.push({
          row,
          column,
          piece,
          position: this.getCellPosition(row, column)
        })
      }
    }

    return targets
  }

  // 炸弹施放动画先把炸弹抛到目标点，再通过快速抖动制造引爆前摇。
  private async playBombCast(position: Vec3) {
    const bombNode = this.createBombSkillNode(position)
    if (!bombNode) {
      return
    }

    const opacity = bombNode.addComponent(UIOpacity)
    opacity.opacity = 0
    const startPosition = position.clone().add3f(-this.pieceSize * 0.58, this.pieceSize * 1.04, 0)
    bombNode.setPosition(startPosition)

    await new Promise<void>(resolve => {
      Tween.stopAllByTarget(bombNode)
      Tween.stopAllByTarget(opacity)
      tween(bombNode)
        .sequence(
          tween().parallel(
            tween().to(0.18, { position, scale: new Vec3(1.08, 1.08, 1) }, { easing: 'quadOut' }),
            tween(opacity).to(0.08, { opacity: 255 }, { easing: 'quadOut' })
          ),
          tween().to(0.04, { position: position.clone().add3f(-6, 4, 0), scale: new Vec3(1.1, 1.1, 1) }, { easing: 'quadOut' }),
          tween().to(0.04, { position: position.clone().add3f(7, -3, 0), scale: new Vec3(1.16, 1.16, 1) }, { easing: 'quadOut' }),
          tween().to(0.04, { position: position.clone().add3f(-4, -5, 0), scale: new Vec3(1.22, 1.22, 1) }, { easing: 'quadOut' }),
          tween().to(0.04, { position, scale: new Vec3(1.3, 1.3, 1) }, { easing: 'quadOut' }),
          tween().to(0.06, { scale: new Vec3(0.2, 0.2, 1) }, { easing: 'quadIn' })
        )
        .call(() => {
          bombNode.destroy()
          resolve()
        })
        .start()
      tween(opacity)
        .delay(0.34)
        .to(0.08, { opacity: 0 }, { easing: 'quadIn' })
        .start()
    })
  }

  // 使用技能资源创建一次性炸弹节点，动画结束后销毁。
  private createBombSkillNode(position: Vec3) {
    if (!this.bombSkillSpriteFrame) {
      return null
    }

    const bombNode = new Node('BombSkillFx')
    const transform = bombNode.addComponent(UITransform)
    transform.setContentSize(this.pieceSize * 1.12, this.pieceSize * 1.4)

    const sprite = bombNode.addComponent(Sprite)
    sprite.spriteFrame = this.bombSkillSpriteFrame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM

    bombNode.setParent(this.node)
    bombNode.setSiblingIndex(this.node.children.length - 1)
    bombNode.setPosition(position)
    bombNode.setScale(new Vec3(0.72, 0.72, 1))
    return bombNode
  }

  // 炸弹范围内的棋子向外炸开并淡出，最后统一销毁。
  private async shakeBombTargets(
    targets: Array<{ row: number; column: number; piece: PieceController; position: Vec3 }>,
    centerPosition: Vec3
  ) {
    const animations = targets.map(target => {
      const node = target.piece.node
      const distanceX = Math.abs(target.position.x - centerPosition.x)
      const distanceY = Math.abs(target.position.y - centerPosition.y)
      const strength = distanceX < 1 && distanceY < 1 ? 8 : 5
      // 爆炸前让范围内棋子短促抖动，中心棋子抖动更强，提示玩家炸弹影响范围。
      return new Promise<void>(resolve => {
        Tween.stopAllByTarget(node)
        tween(node)
          .sequence(
            tween().to(0.035, { position: target.position.clone().add3f(-strength, strength * 0.45, 0) }, { easing: 'quadOut' }),
            tween().to(0.035, { position: target.position.clone().add3f(strength, -strength * 0.38, 0) }, { easing: 'quadOut' }),
            tween().to(0.035, { position: target.position.clone().add3f(-strength * 0.6, -strength * 0.5, 0) }, { easing: 'quadOut' }),
            tween().to(0.035, { position: target.position }, { easing: 'quadOut' })
          )
          .call(resolve as any)
          .start()
      })
    })

    await Promise.all(animations)
  }

  // 炸弹范围内的棋子炸成粒子并淡出，最后统一销毁。
  private async animateBombBreakTargets(
    targets: Array<{ row: number; column: number; piece: PieceController; position: Vec3 }>,
    centerPosition: Vec3
  ) {
    const animations = targets.map(target => {
      const node = target.piece.node
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
      const direction = target.position.clone().subtract(centerPosition)
      if (Math.abs(direction.x) < 1 && Math.abs(direction.y) < 1) {
        direction.set(0, 1, 0)
      }
      direction.normalize()
      const endPosition = target.position.clone().add3f(direction.x * this.pieceSize * 0.18, direction.y * this.pieceSize * 0.18, 0)
      this.spawnSkillShatterParticles(target.piece, target.position, 10, 1.35)

      return new Promise<void>(resolve => {
        Tween.stopAllByTarget(node)
        Tween.stopAllByTarget(opacity)
        tween(node)
          .parallel(
            tween().to(0.12, { position: endPosition, scale: new Vec3(0.06, 0.06, 1) }, { easing: 'quadOut' }),
            tween(opacity).to(0.12, { opacity: 0 }, { easing: 'quadIn' })
          )
          .call(() => {
            node.destroy()
            resolve()
          })
          .start()
      })
    })

    this.spawnBombShockwave(centerPosition, targets.length)
    await Promise.all(animations)
  }

  /**
   * 生成技能消除专用碎片。
   *
   * 从被消除棋子的贴图和底色派生多个小碎片，沿圆周方向喷射并淡出。
   * 所有碎片都会登记到 transientFx，保证返回首页、重开或落地清理时不会残留。
   *
   * @param piece 提供贴图和底色参考的棋子。
   * @param position 碎片爆发中心。
   * @param count 碎片数量。
   * @param forceScale 扩散距离缩放，炸弹会比锤子更大。
   */
  private spawnSkillShatterParticles(piece: PieceController, position: Vec3, count: number, forceScale: number) {
    if (!this.transientFx.canRegister(count)) {
      return
    }

    const spriteFrame = piece.getSpriteFrame()
    const baseColor = piece.getBackgroundColor()
    const particleSize = Math.max(10, this.pieceSize * 0.16)

    for (let i = 0; i < count; i++) {
      const particle = new Node('SkillShatterParticle')
      const transform = particle.addComponent(UITransform)
      const sizeScale = 0.72 + Math.random() * 0.72
      transform.setContentSize(particleSize * sizeScale, particleSize * sizeScale)

      const sprite = particle.addComponent(Sprite)
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.spriteFrame = spriteFrame
      // 粒子颜色在原棋子颜色上做轻微提亮，避免碎片混在背景里看不清。
      sprite.color = new Color(
        Math.min(255, baseColor.r + 35 + Math.random() * 24),
        Math.min(255, baseColor.g + 35 + Math.random() * 24),
        Math.min(255, baseColor.b + 35 + Math.random() * 24),
        255
      )

      const opacity = particle.addComponent(UIOpacity)
      opacity.opacity = 230
      particle.setParent(this.node)
      particle.setSiblingIndex(this.node.children.length - 1)
      particle.setPosition(position.clone().add3f(
        (Math.random() - 0.5) * this.pieceSize * 0.28,
        (Math.random() - 0.5) * this.pieceSize * 0.28,
        0
      ))
      particle.setScale(new Vec3(0.8, 0.8, 1))
      this.transientFx.register(particle)

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55
      const distance = this.pieceSize * forceScale * (0.38 + Math.random() * 0.42)
      const target = position.clone().add3f(Math.cos(angle) * distance, Math.sin(angle) * distance, 0)
      const endScale = new Vec3(0.18 + Math.random() * 0.12, 0.18 + Math.random() * 0.12, 1)
      const duration = 0.24 + Math.random() * 0.12

      tween(particle)
        .parallel(
          tween().to(duration, { position: target, scale: endScale, eulerAngles: new Vec3(0, 0, 180 + Math.random() * 240) }, { easing: 'quadOut' }),
          tween(opacity).to(duration, { opacity: 0 }, { easing: 'quadIn' })
        )
        .call(() => this.transientFx.destroy(particle))
        .start()
    }
  }

  /**
   * 在炸弹中心生成短暂冲击波。
   *
   * 冲击波使用临时节点表现，大小会随本次命中的棋子数量略微变化，
   * 用来强化炸弹范围和命中反馈。
   *
   * @param position 爆炸中心位置。
   * @param strength 本次炸弹影响的棋子数量。
   */
  private spawnBombShockwave(position: Vec3, strength: number) {
    if (!this.transientFx.canRegister(1)) {
      return
    }

    const shockwave = new Node('BombShockwave')
    const transform = shockwave.addComponent(UITransform)
    transform.setContentSize(this.pieceSize * 1.6, this.pieceSize * 1.6)
    const sprite = shockwave.addComponent(Sprite)
    sprite.color = new Color(255, 231, 132, 190)
    const opacity = shockwave.addComponent(UIOpacity)
    opacity.opacity = 140
    shockwave.setParent(this.node)
    shockwave.setPosition(position)
    shockwave.setScale(new Vec3(0.35, 0.35, 1))
    this.transientFx.register(shockwave)

    const scale = 1.2 + Math.min(strength, 9) * 0.05
    tween(shockwave)
      .parallel(
        tween().to(0.18, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' }),
        tween(opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' })
      )
      .call(() => this.transientFx.destroy(shockwave))
      .start()
  }

  // 使用技能资源创建一次性的锤子节点，敲击结束后立即销毁，避免污染场景层级。
  private createHammerSkillNode(position: Vec3) {
    if (!this.hammerSkillSpriteFrame) {
      return null
    }

    const hammerNode = new Node('HammerSkillFx')
    const transform = hammerNode.addComponent(UITransform)
    // 按棋子尺寸缩放锤子贴图，保持不同棋盘尺寸下的敲击比例一致。
    transform.setContentSize(this.pieceSize * 1.05, this.pieceSize * 1.14)

    const sprite = hammerNode.addComponent(Sprite)
    sprite.spriteFrame = this.hammerSkillSpriteFrame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM

    hammerNode.setParent(this.node)
    hammerNode.setSiblingIndex(this.node.children.length - 1)
    hammerNode.setPosition(position.clone().add3f(this.pieceSize * 0.32, this.pieceSize * 0.58, 0))
    hammerNode.setScale(new Vec3(0.92, 0.92, 1))
    hammerNode.setRotationFromEuler(0, 0, -28)
    return hammerNode
  }

  // 锤子从右上方向目标棋子砸下，命中后短暂停顿，给后续碎裂动画一个清晰前摇。
  private async playHammerStrike(position: Vec3) {
    const hammerNode = this.createHammerSkillNode(position)
    if (!hammerNode) {
      return
    }

    const startPosition = hammerNode.position.clone()
    const hitPosition = position.clone().add3f(this.pieceSize * 0.08, this.pieceSize * 0.12, 0)
    await new Promise<void>(resolve => {
      Tween.stopAllByTarget(hammerNode)
      tween(hammerNode)
        .sequence(
          tween().to(
            0.08,
            {
              position: startPosition.clone().add3f(this.pieceSize * 0.12, this.pieceSize * 0.16, 0),
              scale: new Vec3(1.04, 1.04, 1),
              eulerAngles: new Vec3(0, 0, -42)
            },
            { easing: 'quadOut' }
          ),
          tween().to(
            0.09,
            {
              position: hitPosition,
              scale: new Vec3(1.18, 1.18, 1),
              eulerAngles: new Vec3(0, 0, 18)
            },
            { easing: 'quadIn' }
          ),
          tween().to(
            0.06,
            {
              position: hitPosition.clone().add3f(0, this.pieceSize * 0.06, 0),
              scale: Vec3.ONE,
              eulerAngles: new Vec3(0, 0, 4)
            },
            { easing: 'backOut' }
          )
        )
        .call(() => {
          hammerNode.destroy()
          resolve()
        })
        .start()
    })
  }

  /**
   * 围绕刚落地的棋子执行定向连锁合并。
   *
   * 与全盘扫描不同，这里始终以当前连锁锚点为起点，只处理它所在的同值连通块。
   * 如果合并后产生了新的锚点，会继续向上检查，保证“刚落下的棋子继续升级”的手感。
   *
   * @param anchor 刚落地或上一轮连锁产生的锚点棋子。
   * @returns 本轮连锁最终保留下来的锚点，以及是否发生过棋盘变化。
   */
  private async resolveLandingChain(anchor: PieceController): Promise<DirectedMergeResult> {
    let currentAnchor: PieceController | null = anchor
    let changed = false
    let chainDepth = 1

    while (currentAnchor) {
      const mergeResult = await this.mergeLandingComponent(currentAnchor, chainDepth)
      if (mergeResult.anchor) {
        currentAnchor = mergeResult.anchor
        changed = true
        chainDepth += 1
        continue
      }

      break
    }

    return { anchor: currentAnchor, changed }
  }
  /**
   * 扫描全盘并收集所有可合并的同值连通块。
   *
   * 使用 BFS/DFS 收集四向连通组件，长度大于 1 的组件会转成待合并组。
   * 当传入 preferredAnchor 时，所在组件会优先以它作为保留棋子，减少连锁结算的跳动感。
   *
   * @param preferredAnchor 当前结算流程希望优先保留的锚点棋子。
   * @returns 所有待播放合并动画的合并组。
   */
  private findMergeGroups(preferredAnchor: PieceController | null) {
    const visited = Array.from({ length: this.boardheight }, () =>
      Array.from({ length: this.boardwidth }, () => false)
    )
    const groups: MergeGroup[] = []

    for (let row = 0; row < this.boardheight; row++) {
      for (let column = 0; column < this.boardwidth; column++) {
        const piece = this.board[row][column]
        if (!piece || visited[row][column]) {
          continue
        }

        const component = this.collectComponent(row, column, visited)
        if (component.length <= 1) {
          continue
        }

        let anchorPos = this.chooseAnchor(component, preferredAnchor)
        const anchor = this.board[anchorPos.row][anchorPos.column]
        if (!anchor) {
          continue
        }

        groups.push({
          value: anchor.getValue(),
          anchor,
          anchorPos,
          members: component.map(pos => this.board[pos.row][pos.column]).filter(Boolean) as PieceController[]
        })
      }
    }

    groups.sort((a, b) => {
      if (a.anchor === preferredAnchor) {
        return -1
      }
      if (b.anchor === preferredAnchor) {
        return 1
      }
      if (a.anchorPos.row !== b.anchorPos.row) {
        return a.anchorPos.row - b.anchorPos.row
      }
      return a.anchorPos.column - b.anchorPos.column
    })

    return groups
  }

  // 通过广度优先搜索收集一个连通块，连通规则只看上下左右四个方向。
  private collectComponent(startRow: number, startColumn: number, visited: boolean[][]) {
    const startPiece = this.board[startRow][startColumn]
    if (!startPiece) {
      return []
    }

    const targetValue = startPiece.getValue()
    const queue: CellPosition[] = [{ row: startRow, column: startColumn }]
    const component: CellPosition[] = []
    visited[startRow][startColumn] = true

    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)

      const neighbors = [
        { row: current.row - 1, column: current.column },
        { row: current.row + 1, column: current.column },
        { row: current.row, column: current.column - 1 },
        { row: current.row, column: current.column + 1 }
      ]

      for (const neighbor of neighbors) {
        if (!this.isInsideBoard(neighbor.row, neighbor.column) || visited[neighbor.row][neighbor.column]) {
          continue
        }

        const neighborPiece = this.board[neighbor.row][neighbor.column]
        if (!neighborPiece || neighborPiece.getValue() !== targetValue) {
          continue
        }

        visited[neighbor.row][neighbor.column] = true
        queue.push(neighbor)
      }
    }

    return component
  }

  // 落地后先快速预判当前棋子是否会直接形成连通消除，用来决定先播碰撞还是消除音。
  private canPieceMergeNow(piece: PieceController) {
    const piecePos = this.findPiece(piece)
    if (!piecePos) {
      return false
    }

    const visited = Array.from({ length: this.boardheight }, () =>
      Array.from({ length: this.boardwidth }, () => false)
    )
    return this.collectComponent(piecePos.row, piecePos.column, visited).length > 1
  }

  // 按规则决定整组保留哪颗棋子作为锚点，其他棋子都会向它聚合并消失。
  private chooseAnchor(component: CellPosition[], preferredAnchor: PieceController | null) {
    if (preferredAnchor) {
      const preferredPos = this.findPiece(preferredAnchor)
      if (preferredPos && component.some(pos => pos.row === preferredPos.row && pos.column === preferredPos.column)) {
        return preferredPos
      }
    }

    return component.reduce((best, current) => {
      if (current.row < best.row) {
        return current
      }
      if (current.row > best.row) {
        return best
      }

      const center = (this.boardwidth - 1) / 2
      const currentDistance = Math.abs(current.column - center)
      const bestDistance = Math.abs(best.column - center)
      if (currentDistance < bestDistance) {
        return current
      }
      if (currentDistance > bestDistance) {
        return best
      }

      return current.column < best.column ? current : best
    })
  }
  // 并发播放当前批次的所有合并动画，等全部完成后再进入下一轮结算。
  private async playMergeGroups(groups: MergeGroup[], chainDepth: number) {
    const animations: Promise<void>[] = []
    const rewards: ScoreRewardEvent[] = []
    const consumedGroups: PieceController[][] = []

    for (const group of groups) {
      const anchorPosition = this.getCellPosition(group.anchorPos.row, group.anchorPos.column)
      const consumed = group.members.filter(piece => piece !== group.anchor)
      const nextValue = group.value * Math.pow(2, consumed.length)
      // 奖励分在合并动画开始前就结算，让总分数字可以连续滚动，不会等动画播完再跳第二次。
      rewards.push(this.scoreManager.buildMergeReward(nextValue, consumed.length, chainDepth))
      consumedGroups.push(consumed)
      animations.push(this.animateMergeGroup(group.anchor, anchorPosition, consumed, nextValue))
    }

    this.applyScoreRewards(rewards)
    if (groups.length > 0) {
      this.audioManager?.playSoundEffect(this.landingMergeAudioClip)
    }
    await Promise.all(animations)
    // 动画播完后再真正从棋盘数据里移除被吞掉的棋子，保证结算前后的棋盘总和一致。
    for (const consumed of consumedGroups) {
      for (const piece of consumed) {
        const piecePos = this.findPiece(piece)
        if (piecePos) {
          this.board[piecePos.row][piecePos.column] = null
        }
      }
    }
  }

  /**
   * 合并落地点所在的同值连通块。
   *
   * 这个方法只处理 anchorPiece 当前所在组件，不扫描全盘。
   * 合并锚点优先选择落点列中更靠下的棋子，其余成员播放吸附动画后从棋盘数组移除，
   * 再对受影响列执行重力下落，为下一轮连锁创造稳定输入。
   *
   * @param anchorPiece 当前落地连锁的起点棋子。
   * @param chainDepth 当前连锁深度，用于计算奖励分和动画强度。
   * @returns 合并后保留的锚点，以及本轮是否改变棋盘。
   */
  private async mergeLandingComponent(anchorPiece: PieceController, chainDepth: number): Promise<DirectedMergeResult> {
    const anchorPos = this.findPiece(anchorPiece)
    if (!anchorPos) {
      return { anchor: null, changed: false }
    }

    const visited = Array.from({ length: this.boardheight }, () =>
      Array.from({ length: this.boardwidth }, () => false)
    )
    const component = this.collectComponent(anchorPos.row, anchorPos.column, visited)
    if (component.length <= 1) {
      return { anchor: null, changed: false }
    }

    const mergeAnchorPos = this.chooseLandingAnchor(component, anchorPos.column)
    const mergeAnchor = this.board[mergeAnchorPos.row][mergeAnchorPos.column]
    if (!mergeAnchor) {
      return { anchor: null, changed: false }
    }

    const consumed: PieceController[] = []
    const affectedColumns = new Set<number>()

    for (const pos of component) {
      affectedColumns.add(pos.column)
      if (pos.row === mergeAnchorPos.row && pos.column === mergeAnchorPos.column) {
        continue
      }

      const piece = this.board[pos.row][pos.column]
      if (!piece) {
        continue
      }

      consumed.push(piece)
    }

    const nextValue = mergeAnchor.getValue() * Math.pow(2, consumed.length)
    // 落地连锁的奖励分同样提前结算，避免分数先停住再补播一次消除加分。
    this.applyScoreRewards([this.scoreManager.buildMergeReward(nextValue, consumed.length, chainDepth)])
    this.audioManager?.playSoundEffect(this.landingMergeAudioClip)
    await this.animateDirectedMerge(
      mergeAnchor,
      this.getCellPosition(mergeAnchorPos.row, mergeAnchorPos.column),
      consumed,
      nextValue
    )
    // 动画结束后再清理被合并掉的棋子引用，后续重力和二次结算才能拿到稳定棋盘。
    for (const piece of consumed) {
      const piecePos = this.findPiece(piece)
      if (piecePos) {
        this.board[piecePos.row][piecePos.column] = null
      }
    }
    await this.applyGravityColumns([...affectedColumns])
    return { anchor: mergeAnchor, changed: true }
  }

  /**
   * 为落地连锁选择保留下来的锚点格子。
   *
   * 优先选择落点列内最靠下的棋子；如果连通块不在落点列，则退化为整组内最靠下、
   * 且距离落点列最近的棋子，保证玩家对合并方向的预期稳定。
   *
   * @param component 当前同值连通块内的所有格子。
   * @param landingColumn 本次落子的列。
   * @returns 应作为合并锚点的格子坐标。
   */
  private chooseLandingAnchor(component: CellPosition[], landingColumn: number) {
    const sameColumn = component.filter(pos => pos.column === landingColumn)
    const candidates = sameColumn.length > 0 ? sameColumn : component

    return candidates.reduce((best, current) => {
      if (current.row < best.row) {
        return current
      }
      if (current.row > best.row) {
        return best
      }

      return Math.abs(current.column - landingColumn) < Math.abs(best.column - landingColumn) ? current : best
    })
  }

  // 单个合并组的动画封装，底层复用定向合并的表现逻辑。
  private async animateMergeGroup(
    anchor: PieceController,
    anchorPosition: Vec3,
    consumed: PieceController[],
    nextValue: number
  ) {
    await this.animateDirectedMerge(anchor, anchorPosition, consumed, nextValue)
  }

  /**
   * 对整张棋盘应用重力下落。
   *
   * 每列从底部开始写入非空棋子，清除中间空洞，并为移动过的棋子播放下落动画。
   * 返回值用于 settleBoard 判断是否需要继续扫描新形成的合并组。
   *
   * @returns 是否有任何棋子发生了位置移动。
   */
  private async applyGravityAllColumns() {
    const animations: Promise<void>[] = []
    let moved = false

    for (let column = 0; column < this.boardwidth; column++) {
      let writeRow = 0
      for (let row = 0; row < this.boardheight; row++) {
        const piece = this.board[row][column]
        if (!piece) {
          continue
        }

        if (writeRow !== row) {
          this.board[writeRow][column] = piece
          this.board[row][column] = null
          animations.push(this.animateMove(piece.node, this.getCellPosition(writeRow, column), 0.12))
          moved = true
        }

        writeRow += 1
      }

      for (let row = writeRow; row < this.boardheight; row++) {
        this.board[row][column] = null
      }
    }

    if (animations.length > 0) {
      await Promise.all(animations)
    }

    return moved
  }
  /**
   * 只对指定列应用重力下落。
   *
   * 技能消除或落地点局部合并后，只有部分列会出现空洞。
   * 这里先去重并过滤非法列，再逐列压缩棋子，减少不必要的全盘动画。
   *
   * @param columns 需要重新压缩的列索引集合。
   * @returns 是否有任何棋子发生了位置移动。
   */
  private async applyGravityColumns(columns: number[]) {
    const uniqueColumns = [...new Set(columns)].filter(column => column >= 0 && column < this.boardwidth)
    if (uniqueColumns.length === 0) {
      return false
    }

    const animations: Promise<void>[] = []
    let moved = false

    for (const column of uniqueColumns) {
      let writeRow = 0
      for (let row = 0; row < this.boardheight; row++) {
        const piece = this.board[row][column]
        if (!piece) {
          continue
        }

        if (writeRow !== row) {
          this.board[writeRow][column] = piece
          this.board[row][column] = null
          animations.push(this.animateMove(piece.node, this.getCellPosition(writeRow, column), 0.12))
          moved = true
        }

        writeRow += 1
      }

      for (let row = writeRow; row < this.boardheight; row++) {
        this.board[row][column] = null
      }
    }

    if (animations.length > 0) {
      await Promise.all(animations)
    }

    return moved
  }
  /**
   * 用统一缓动把节点移动到目标格子。
   *
   * 落子、重力和局部结算都复用这套移动节奏，调用前会先停止目标节点旧 Tween，
   * 避免同一棋子同时被多个动画驱动。
   *
   * @param node 需要移动的节点。
   * @param position 目标本地坐标。
   * @param duration 期望动画时长，会被限制到较短范围以保持结算节奏。
   */
  private animateMove(node: Node, position: Vec3, duration: number) {
    Tween.stopAllByTarget(node)
    return new Promise<void>(resolve => {
      tween(node)
        .to(Math.min(duration, 0.09), { position }, { easing: 'quadOut' })
        .call(resolve as any)
        .start()
    })
  }
  /**
   * 执行一次完整的定向合并表现。
   *
   * 所有被吞并棋子先并发吸附到锚点并缩小销毁，随后锚点升级数值，
   * 再播放闪光、爆裂和轻微回弹，形成一次完整的合并反馈。
   *
   * @param anchor 合并后保留并升级的棋子。
   * @param anchorPosition 锚点所在的目标坐标。
   * @param consumed 会被吸附并销毁的棋子列表。
   * @param nextValue 合并后锚点的新数值。
   */
  private async animateDirectedMerge(
    anchor: PieceController,
    anchorPosition: Vec3,
    consumed: PieceController[],
    nextValue: number
  ) {
    const consumedAnimations = consumed.map(piece =>
      new Promise<void>(resolve => {
        Tween.stopAllByTarget(piece.node)
        tween(piece.node)
          .parallel(
            tween().to(0.16, { position: anchorPosition }, { easing: 'sineIn' }),
            tween().to(0.16, { scale: new Vec3(0.24, 0.24, 1) }, { easing: 'quadIn' })
          )
          .call(() => {
            piece.node.destroy()
            resolve()
          })
          .start()
      })
    )

    await Promise.all(consumedAnimations)
    anchor.setValue(nextValue)
    this.scoreManager.updateHighestPieceValue(nextValue)
    anchor.node.setPosition(anchorPosition)
    this.spawnMergeFlash(anchor, anchorPosition, consumed.length)
    this.spawnMergeBurst(anchor, anchorPosition, consumed.length)

    await new Promise<void>(resolve => {
      Tween.stopAllByTarget(anchor.node)
      tween(anchor.node)
        .sequence(
          tween().to(0.08, { scale: new Vec3(1.18, 1.18, 1) }, { easing: 'sineOut' }),
          tween().to(0.12, { scale: new Vec3(0.98, 0.98, 1) }, { easing: 'sineInOut' }),
          tween().to(0.08, { scale: Vec3.ONE }, { easing: 'sineOut' })
        )
        .call(resolve as any)
        .start()
    })
  }
  /**
   * 在合并锚点位置生成短暂闪光。
   *
   * 闪光复用棋子贴图并快速放大淡出，用来强调升级瞬间；
   * strength 会轻微影响放大幅度，但仍受特效数量上限约束。
   *
   * @param anchor 提供贴图和颜色参考的锚点棋子。
   * @param position 闪光出现的位置。
   * @param strength 本次合并强度，通常与被吞并棋子数量相关。
   */
  private spawnMergeFlash(anchor: PieceController, position: Vec3, strength: number) {
    if (!this.transientFx.canRegister(1)) {
      return
    }

    const flash = this.createFxPiece(anchor)
    const opacity = flash.addComponent(UIOpacity)
    opacity.opacity = 120
    flash.setParent(this.node)
    flash.setPosition(position)
    flash.setScale(new Vec3(0.9, 0.9, 1))
    const sprite = flash.getComponent(Sprite)
    if (sprite) {
      sprite.color = new Color(255, 248, 214, 255)
    }
    this.transientFx.register(flash)

    const targetScale = 1.1 + Math.min(strength, 2) * 0.08
    tween(flash)
      .parallel(
        tween().to(0.12, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'quadOut' }),
        tween(opacity).to(0.12, { opacity: 0 })
      )
      .call(() => this.transientFx.destroy(flash))
      .start()
  }
  /**
   * 合并时从锚点向四周喷射碎片粒子。
   *
   * 粒子数量和扩散半径会随 strength 增加，用来区分普通合并和更大的连锁合并。
   * 所有粒子都会登记到 transientFx，便于暂停、返回首页或重开时统一清理。
   *
   * @param anchor 提供贴图和颜色参考的锚点棋子。
   * @param position 粒子爆发中心。
   * @param strength 本次合并强度。
   */
  private spawnMergeBurst(anchor: PieceController, position: Vec3, strength: number) {
    const count = Math.min(4, 2 + strength)
    if (!this.transientFx.canRegister(count)) {
      return
    }

    const radius = 48 + strength * 8
    for (let i = 0; i < count; i++) {
      const particle = this.createFxPiece(anchor)
      const opacity = particle.addComponent(UIOpacity)
      opacity.opacity = 150
      const transform = particle.getComponent(UITransform)
      transform?.setContentSize(14, 14)
      particle.setParent(this.node)
      particle.setPosition(position)
      particle.setScale(new Vec3(0.15, 0.15, 1))
      this.transientFx.register(particle)

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35
      const distance = radius * (0.75 + Math.random() * 0.4)
      const target = new Vec3(
        position.x + Math.cos(angle) * distance,
        position.y + Math.sin(angle) * distance,
        0
      )

      tween(particle)
        .parallel(
          tween().to(0.18, { position: target, scale: new Vec3(0.04, 0.04, 1) }, { easing: 'quadOut' }),
          tween(opacity).to(0.18, { opacity: 0 })
        )
        .call(() => this.transientFx.destroy(particle))
        .start()
    }
  }

  // 创建一个用于特效表现的临时棋子节点，复用原棋子的颜色与外观。
  private createFxPiece(source: PieceController) {
    const node = new Node('FxPiece')
    const transform = node.addComponent(UITransform)
    transform.setContentSize(this.pieceSize, this.pieceSize)

    const sprite = node.addComponent(Sprite)
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.spriteFrame = source.getSpriteFrame()
    sprite.color = source.getBackgroundColor()
    return node
  }

  // 在棋盘数组里查找某颗棋子当前所在的行列坐标。
  private findPiece(target: PieceController) {
    return this.boardModel.findPiece(this.board, this.boardheight, this.boardwidth, target)
  }

  // 判断给定的行列是否仍处在棋盘合法范围内。
  private isInsideBoard(row: number, column: number) {
    return this.boardGeometry?.isInsideBoard(row, column) ?? false
  }
  // 检查每列是否已满
  private isBoardFull() {
    return this.boardModel.isBoardFull(this.board, this.boardheight, this.boardwidth)
  }
  // 返回某列第一个空行
  private getDropRow(column: number) {
    return this.boardModel.getDropRow(this.board, this.boardheight, column)
  }
  // 找到离目标列最近的可用列
  private getNearestAvailableColumn(preferredColumn: number) {
    return this.boardModel.getNearestAvailableColumn(this.board, this.boardheight, this.boardwidth, preferredColumn)
  }

  // 触摸列换算已交给 BoardGeometry，这里只保持旧调用入口。
  private getColumnFromTouch(event: EventTouch) {
    this.syncBoardGeometryOptions()
    return this.boardGeometry?.getColumnFromTouch(event) ?? -1
  }

  // 触摸格子换算已交给 BoardGeometry，这里只保持旧调用入口。
  private getCellFromTouch(event: EventTouch): CellPosition | null {
    this.syncBoardGeometryOptions()
    return this.boardGeometry?.getCellFromTouch(event) ?? null
  }

  // Cocos 触摸坐标先从 UI 坐标转成本节点坐标，所有棋盘操作都基于同一坐标系。
  private getLocalPositionFromTouch(event: EventTouch) {
    this.syncBoardGeometryOptions()
    return this.boardGeometry?.getLocalPositionFromTouch(event) ?? null
  }

  // 使用棋盘节点的世界包围盒判断触摸是否真的落在棋盘区域内。
  private isTouchInsideBoard(x: number, y: number) {
    return this.boardGeometry?.isTouchInsideBoard(x, y) ?? false
  }
  // 格子坐标换算已交给 BoardGeometry，这里只保持旧调用入口。
  private getCellPosition(row: number, column: number) {
    this.syncBoardGeometryOptions()
    return this.boardGeometry?.getCellPosition(row, column) ?? new Vec3()
  }
  // 出生点换算已交给 BoardGeometry，这里只保持旧调用入口。
  private getSpawnPosition(column: number) {
    this.syncBoardGeometryOptions()
    return this.boardGeometry?.getSpawnPosition(column) ?? new Vec3()
  }

  // 单格步长 = 棋子尺寸 + 列间距，这是所有坐标换算的基础。
  private getStepSize() {
    this.syncBoardGeometryOptions()
    return this.boardGeometry?.getStepSize() ?? this.pieceSize + this.spacing
  }

  // 把 PlayController 上的可调参数同步给几何模块，兼容编辑器里继续改属性。
  private syncBoardGeometryOptions() {
    this.boardGeometry?.updateOptions(this.buildBoardGeometryOptions())
  }

  // 几何模块只接收必要参数，避免直接读取玩法控制器内部状态。
  private buildBoardGeometryOptions() {
    return {
      boardWidth: this.boardwidth,
      boardHeight: this.boardheight,
      pieceSize: this.pieceSize,
      spacing: this.spacing,
      spawnOffsetY: this.spawnOffsetY
    }
  }

  // 把当前玩法状态统一推送给 UI 组件，避免逻辑层分别操作多个界面节点。
  private refreshUiState() {
    this.uiController?.renderState(this.buildUiState())
  }

  // 首页点击开始后再生成第一颗棋子，让开始页和首局开场自然衔接。
  private startSessionFromStartPage() {
    if (this.hasStartedSession) {
      return
    }

    this.hasStartedSession = true
    this.skillStock.reset()
    this.refreshUiState()
    this.audioManager?.playGameplayBackgroundMusic(this.gameplayBgmClip)
    this.startPageController?.hide(() => {
      if (!this.currentPiece && !this.isGameOver) {
        this.spawnPiece()
      }
    })
  }

  // 逻辑层只暴露一份纯数据状态给 UI 层，保证职责边界清晰。
  private buildUiState(): PlayUIState {
    const boardScore = this.scoreManager.getBoardScore(this.board)
    return {
      currentValue: this.currentPiece?.getValue() ?? null,
      score: boardScore + this.scoreManager.getBonusScore(),
      highestValue: this.scoreManager.getHighestPieceValue(),
      isGameOver: this.isGameOver,
      isPaused: this.isPaused,
      isResolving: this.isResolving,
      activeSkill: this.isBombSkillActive ? 'bomb' : this.isHammerSkillActive ? 'hammer' : this.isSwapSkillActive ? 'swap' : null,
      skillCounts: this.skillStock.toUiState()
    }
  }

  // 奖励分累计已交给 ScoreManager，这里负责根据结果刷新 UI。
  private applyScoreRewards(rewards: ScoreRewardEvent[]) {
    if (this.scoreManager.applyScoreRewards(rewards)) {
      this.refreshUiState()
    }
  }

  // UI 层按钮点击后只通过这个入口切换暂停，真正的状态变化仍由逻辑层维护。
  private togglePauseFromUi() {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isResolving || this.isGameOver) {
      return
    }

    if (this.isSwapSkillActive || this.isHammerSkillActive || this.isBombSkillActive) {
      void this.cancelActiveSkillMode()
      return
    }

    this.isPaused = !this.isPaused
    if (!this.isPaused) {
      this.trailTimer = 0
    }
    this.refreshUiState()
  }

  // 暂停弹窗点击返回首页时，清理当前对局但不生成新棋子，交回开始页接管。
  private returnToStartPageFromPause() {
    if (!this.hasStartedSession) {
      return
    }

    this.clearBoardPieces()
    this.transientFx.clear()
    this.hasStartedSession = false
    this.isGameOver = false
    this.isFastDropping = false
    this.isResolving = false
    this.isPaused = false
    this.isSwapSkillActive = false
    this.isHammerSkillActive = false
    this.isBombSkillActive = false
    this.swapDragState = null
    this.resetBoard()
    this.skillStock.reset()
    this.audioManager?.playStartPageBackgroundMusic(this.startPageBgmClip)
    this.refreshUiState()
    this.startPageController?.syncLayout()
    this.startPageController?.show()
  }

  // 暂停遮罩右下角的排行榜按钮复用首页排行榜弹窗，只显示榜单本身，不恢复首页卡片。
  private showRankFromPause() {
    this.startPageController?.showRankModal(true)
  }

  // 分享入口只负责适配平台能力；没有平台 API 时保持静默降级，避免打断暂停弹窗。
  private shareGameFromPause() {
    this.shareAdapter.shareScore(this.scoreManager.getTotalScore(this.board), 'pause_share')
  }

  // 结算弹窗分享本局分数，和暂停分享共用平台适配逻辑。
  private shareGameFromGameOver() {
    this.shareAdapter.shareScore(this.scoreManager.getTotalScore(this.board), 'game_over_share')
  }

  // UI 层第三技能按钮通过这个入口切换交换技能，技能态只冻结下落，不打开暂停弹窗。
  private toggleSwapSkillFromUi() {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isHammerSkillActive || this.isBombSkillActive) {
      return
    }

    if (this.isSwapSkillActive) {
      void this.cancelActiveSkillMode()
      return
    }

    if (!this.skillStock.has('swap')) {
      return
    }

    this.isFastDropping = false
    this.trailTimer = 0
    this.isSwapSkillActive = true
    this.refreshUiState()
  }

  // UI 层第二技能按钮通过这个入口切换锤子技能，技能态只等待点选棋子。
  private toggleHammerSkillFromUi() {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isSwapSkillActive || this.isBombSkillActive) {
      return
    }

    if (this.isHammerSkillActive) {
      void this.cancelActiveSkillMode()
      return
    }

    if (!this.skillStock.has('hammer')) {
      return
    }

    this.isFastDropping = false
    this.trailTimer = 0
    this.isHammerSkillActive = true
    this.refreshUiState()
  }

  // UI 层第一个技能按钮通过这个入口切换炸弹技能，等待玩家点选爆炸中心。
  private toggleBombSkillFromUi() {
    if (!this.hasStartedSession) {
      return
    }

    if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isSwapSkillActive || this.isHammerSkillActive) {
      return
    }

    if (this.isBombSkillActive) {
      void this.cancelActiveSkillMode()
      return
    }

    if (!this.skillStock.has('bomb')) {
      return
    }

    this.isFastDropping = false
    this.trailTimer = 0
    this.isBombSkillActive = true
    this.refreshUiState()
  }

  // 主动取消技能时，如果交换技能已经拎起棋子，需要先把棋子放回原格子。
  private async cancelActiveSkillMode() {
    if (this.swapDragState) {
      await this.restoreSwapDraggedPiece(this.swapDragState)
    }

    this.isSwapSkillActive = false
    this.isHammerSkillActive = false
    this.isBombSkillActive = false
    this.refreshUiState()
  }
  // 进入游戏结束流程
  private endGame() {
    this.isGameOver = true
    this.isSwapSkillActive = false
    this.isHammerSkillActive = false
    this.isBombSkillActive = false
    this.swapDragState = null
    this.currentPiece = null
    this.transientFx.clear()
    this.refreshUiState()
  }
  // 重新开始游戏并清空棋盘
  private async restartGame() {
    if (this.isResolving) {
      return
    }

    this.clearBoardPieces()
    this.transientFx.clear()
    this.isGameOver = false
    this.isFastDropping = false
    this.isResolving = false
    this.isPaused = false
    this.isSwapSkillActive = false
    this.isHammerSkillActive = false
    this.isBombSkillActive = false
    this.swapDragState = null
    this.resetBoard()
    this.skillStock.reset()
    this.spawnPiece()
  }
}
