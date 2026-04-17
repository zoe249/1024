import { _decorator, Color, Component, EventTouch, instantiate, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc'
import { PieceController } from './PieceController'
import { PlayUIController, type PlayUIState } from './PlayUIController'

const { ccclass, property } = _decorator

type BoardCell = PieceController | null

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

// 分数奖励先独立成事件结构，后面要加连锁倍率、活动加成时只需要扩展这里。
type ScoreRewardEvent = {
  source: 'merge'
  amount: number
  resultValue: number
  consumedCount: number
  chainDepth: number
}

// 控制同屏特效节点上限，避免频繁创建粒子导致卡顿。
const MAX_ACTIVE_FX = 18

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
  // 游戏结束标记，结束后点击任意位置会重新开始。
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
  // 奖励分数和棋盘总和分开累计，方便后续扩展更多得分来源。
  private bonusScore = 0
  // UI 渲染组件，专门负责棋盘绘制、状态栏、控制栏和暂停遮罩。
  private uiController: PlayUIController | null = null
  // 拖尾生成计时器，用来控制特效频率。
  private trailTimer = 0
  // 当前屏幕上仍未销毁的特效节点集合，便于统一清理。
  private activeFx = new Set<Node>()
  // 生命周期入口：先准备棋盘数据，再把界面初始化交给独立的 UI 组件。
  onLoad() {
    this.resetBoard()
    this.uiController = this.getComponent(PlayUIController) ?? this.addComponent(PlayUIController)
    // UI 组件只接收绘制所需参数和按钮回调，不参与玩法计算。
    this.uiController.setup({
      boardwidth: this.boardwidth,
      boardheight: this.boardheight,
      pieceSize: this.pieceSize,
      spacing: this.spacing,
      onPauseTap: () => this.togglePauseFromUi(),
      onBombSkillTap: () => this.toggleBombSkillFromUi(),
      onHammerSkillTap: () => this.toggleHammerSkillFromUi(),
      onSwapSkillTap: () => this.toggleSwapSkillFromUi()
    })
    this.bindInput()
  }
  // 等场景节点初始化完成后再生成第一颗棋子，避免引用未准备好的节点。
  start() {
    // 某些平台会在启动后一帧才拿到稳定的安全区，这里让 UI 组件再补一次布局。
    this.uiController?.syncLayout()
    this.refreshUiState()
    this.spawnPiece()
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this)
    this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this)
    this.uiController = null
  }

  // 每帧更新当前下落棋子的目标位置，并在接近落点时触发落地结算。
  update(dt: number) {
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

    this.currentPiece.node.setPosition(targetPosition.x, nextY, 0)
    this.updateFallingTrail(dt)

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
    if (!this.isSwapSkillActive) {
      return
    }

    this.handleSwapSkillTouchMove(event)
  }

  // 触摸抬起时结束本次按住状态；当前逻辑中只需要停止继续加速即可。
  private handleTouchEnd(event: EventTouch) {
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
    this.board = Array.from({ length: this.boardheight }, () =>
      Array.from({ length: this.boardwidth }, () => null)
    )
    // 重开或首次进入时，奖励分数要和棋盘一起清零。
    this.bonusScore = 0
    this.currentColumn = Math.floor(this.boardwidth / 2)
  }
  // 生成下一颗棋子并放到 spawn 区
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

    const value = this.basePieceList[Math.floor(Math.random() * this.basePieceList.length)]
    this.currentColumn = column
    this.isFastDropping = false
    this.trailTimer = 0
    pieceController.setValue(value)
    pieceNode.setScale(Vec3.ONE)
    pieceNode.setPosition(this.getSpawnPosition(column))
    this.node.addChild(pieceNode)
    this.currentPiece = pieceController
    this.refreshUiState()
  }

  // 棋子真正落地后写入棋盘，再触发定向合并与全盘结算。
  private async landPiece(row: number, column: number) {
    if (!this.currentPiece || this.isResolving) {
      return
    }

    this.isResolving = true
    const landedPiece = this.currentPiece
    this.currentPiece = null
    this.clearTransientFx()
    this.board[row][column] = landedPiece
    landedPiece.node.setPosition(this.getCellPosition(row, column))
    this.refreshUiState()

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

  // 反复执行“重力下落 -> 全盘合并”，直到棋盘稳定为止。
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
      await this.rollbackSwapSkill(dragState, target)
      this.restoreSwapPieceLayer(dragState)
      this.isResolving = false
      this.refreshUiState()
      return
    }

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

  // 技能消除专用碎片：拆出多块小棋子向外喷射，表现比整块缩小更接近“炸碎”。
  private spawnSkillShatterParticles(piece: PieceController, position: Vec3, count: number, forceScale: number) {
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
        .call(() => particle.destroy())
        .start()
    }
  }

  // 爆炸中心补一个短暂冲击波，帮助玩家看清本次炸弹范围。
  private spawnBombShockwave(position: Vec3, strength: number) {
    if (!this.canSpawnFx(1)) {
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
    this.activeFx.add(shockwave)

    const scale = 1.2 + Math.min(strength, 9) * 0.05
    tween(shockwave)
      .parallel(
        tween().to(0.18, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' }),
        tween(opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' })
      )
      .call(() => this.destroyFxNode(shockwave))
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

  // 只围绕刚落地的棋子做定向连锁检测，优先保证“当前落点继续向上连锁”的手感。
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
  // 扫描整个棋盘，把所有值相同且四向连通的棋子分组成待合并组。
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
      rewards.push(this.buildMergeReward(nextValue, consumed.length, chainDepth))
      consumedGroups.push(consumed)
      animations.push(this.animateMergeGroup(group.anchor, anchorPosition, consumed, nextValue))
    }

    this.applyScoreRewards(rewards)
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

  // 只检查落地点所在的连通块，并把其中可合并的成员全部吸附到新的锚点上。
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
    this.applyScoreRewards([this.buildMergeReward(nextValue, consumed.length, chainDepth)])
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

  // 落地后的首次合并优先保留落点列里最靠下的棋子，保证玩家对合并方向的预期稳定。
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

  // 对全盘应用重力：每一列都向下压缩，消除中间空洞。
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
  // 指定列重力落下
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
  // 用统一的缓动方式把节点移动到目标格子，保证落子和重力动画节奏一致。
  private animateMove(node: Node, position: Vec3, duration: number) {
    Tween.stopAllByTarget(node)
    return new Promise<void>(resolve => {
      tween(node)
        .to(Math.min(duration, 0.09), { position }, { easing: 'quadOut' })
        .call(resolve as any)
        .start()
    })
  }
  // 执行一次完整的合并表现：成员吸附、锚点升级、闪光和爆裂，再做回弹。
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
  // 用计时器控制下落拖尾的生成频率，避免每帧都创建特效。
  private updateFallingTrail(dt: number) {
    if (!this.currentPiece) {
      return
    }

    this.trailTimer += dt
    const interval = this.isFastDropping ? 0.04 : 0.08
    if (this.trailTimer < interval) {
      return
    }

    this.trailTimer = 0
    this.spawnTrailParticles(this.currentPiece)
  }
  // 根据当前下落速度生成拖尾粒子，快速下落时会更密、更长。
  private spawnTrailParticles(piece: PieceController) {
    const count = this.isFastDropping ? 2 : 1
    if (!this.canSpawnFx(count)) {
      return
    }

    const origin = piece.node.position.clone().add3f(0, -this.pieceSize * 0.32, 0)

    for (let i = 0; i < count; i++) {
      const particle = this.createFxPiece(piece)
      const opacity = particle.addComponent(UIOpacity)
      opacity.opacity = this.isFastDropping ? 110 : 72
      const transform = particle.getComponent(UITransform)
      const width = this.isFastDropping ? 14 + Math.random() * 6 : 10 + Math.random() * 4
      const height = this.isFastDropping ? 44 + Math.random() * 14 : 28 + Math.random() * 10
      transform?.setContentSize(width, height)

      particle.setParent(this.node)
      particle.setSiblingIndex(0)
      particle.setPosition(
        new Vec3(
          origin.x + (Math.random() - 0.5) * this.pieceSize * 0.22,
          origin.y - Math.random() * 10,
          0
        )
      )
      particle.setScale(this.isFastDropping ? new Vec3(0.18, 0.1, 1) : new Vec3(0.12, 0.08, 1))

      const sprite = particle.getComponent(Sprite)
      if (sprite) {
        const color = piece.getBackgroundColor()
        color.r = Math.min(255, color.r + 55)
        color.g = Math.min(255, color.g + 55)
        color.b = Math.min(255, color.b + 55)
        color.a = 255
        sprite.color = color
      }

      this.activeFx.add(particle)

      const driftX = (Math.random() - 0.5) * (this.isFastDropping ? 20 : 12)
      const driftY = this.isFastDropping ? -56 - Math.random() * 22 : -36 - Math.random() * 16
      const target = particle.position.clone().add3f(driftX, driftY, 0)
      const stretch = this.isFastDropping ? new Vec3(0.04, 0.34, 1) : new Vec3(0.03, 0.24, 1)
      const duration = this.isFastDropping ? 0.18 : 0.22

      tween(particle)
        .parallel(
          tween().to(duration, { position: target, scale: stretch }, { easing: 'sineOut' }),
          tween(opacity).to(duration, { opacity: 0 })
        )
        .call(() => this.destroyFxNode(particle))
        .start()
    }
  }

  // 合并瞬间在锚点位置补一个短暂的闪光，加强升级反馈。
  private spawnMergeFlash(anchor: PieceController, position: Vec3, strength: number) {
    if (!this.canSpawnFx(1)) {
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
    this.activeFx.add(flash)

    const targetScale = 1.1 + Math.min(strength, 2) * 0.08
    tween(flash)
      .parallel(
        tween().to(0.12, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'quadOut' }),
        tween(opacity).to(0.12, { opacity: 0 })
      )
      .call(() => this.destroyFxNode(flash))
      .start()
  }
  // 合并时向四周喷射碎片粒子，strength 越高，粒子越多、扩散越远。
  private spawnMergeBurst(anchor: PieceController, position: Vec3, strength: number) {
    const count = Math.min(4, 2 + strength)
    if (!this.canSpawnFx(count)) {
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
      this.activeFx.add(particle)

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
        .call(() => this.destroyFxNode(particle))
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

  // 限制特效节点总数，避免短时间内创建过多粒子。
  private canSpawnFx(count: number) {
    return this.activeFx.size + count <= MAX_ACTIVE_FX
  }
  // 销毁并移除特效节点
  private destroyFxNode(node: Node) {
    this.activeFx.delete(node)
    node.destroy()
  }
  // 停止并清理所有运行中粒子
  private clearTransientFx() {
    for (const node of this.activeFx) {
      Tween.stopAllByTarget(node)
      const opacity = node.getComponent(UIOpacity)
      if (opacity) {
        Tween.stopAllByTarget(opacity)
      }
      node.destroy()
    }
    this.activeFx.clear()
  }

  // 在棋盘数组里查找某颗棋子当前所在的行列坐标。
  private findPiece(target: PieceController) {
    for (let row = 0; row < this.boardheight; row++) {
      for (let column = 0; column < this.boardwidth; column++) {
        if (this.board[row][column] === target) {
          return { row, column }
        }
      }
    }

    return null
  }

  // 判断给定的行列是否仍处在棋盘合法范围内。
  private isInsideBoard(row: number, column: number) {
    return row >= 0 && row < this.boardheight && column >= 0 && column < this.boardwidth
  }
  // 检查每列是否已满
  private isBoardFull() {
    for (let column = 0; column < this.boardwidth; column++) {
      if (this.getDropRow(column) >= 0) {
        return false
      }
    }
    return true
  }
  // 返回某列第一个空行
  private getDropRow(column: number) {
    for (let row = 0; row < this.boardheight; row++) {
      if (!this.board[row][column]) {
        return row
      }
    }
    return -1
  }
  // 找到离目标列最近的可用列
  private getNearestAvailableColumn(preferredColumn: number) {
    if (preferredColumn >= 0 && preferredColumn < this.boardwidth && this.getDropRow(preferredColumn) >= 0) {
      return preferredColumn
    }

    for (let distance = 1; distance < this.boardwidth; distance++) {
      const left = preferredColumn - distance
      if (left >= 0 && this.getDropRow(left) >= 0) {
        return left
      }

      const right = preferredColumn + distance
      if (right < this.boardwidth && this.getDropRow(right) >= 0) {
        return right
      }
    }

    return -1
  }

  // 把触摸点换算成列索引，换算时使用当前棋盘实时计算出的网格原点。
  private getColumnFromTouch(event: EventTouch) {
    const uiTransform = this.node.getComponent(UITransform)
    if (!uiTransform) {
      return -1
    }

    const uiLocation = event.getUILocation()
    // 棋盘外的触摸不参与列选择，避免底栏、状态栏等区域误触发加速下落。
    if (!this.isTouchInsideBoard(uiLocation.x, uiLocation.y)) {
      return -1
    }

    const local = uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
    const step = this.getStepSize()
    // 棋盘尺寸和边框可能会调整，所以这里不能再依赖旧的固定 x 偏移。
    const column = Math.round((local.x - this.getBoardGridOriginX()) / step)
    return Math.max(0, Math.min(this.boardwidth - 1, column))
  }

  // 把触摸点换算成棋盘格子坐标，交换技能会用它来判断起点和释放目标。
  private getCellFromTouch(event: EventTouch): CellPosition | null {
    const uiLocation = event.getUILocation()
    if (!this.isTouchInsideBoard(uiLocation.x, uiLocation.y)) {
      return null
    }

    const local = this.getLocalPositionFromTouch(event)
    if (!local) {
      return null
    }

    const step = this.getStepSize()
    const column = Math.round((local.x - this.getBoardGridOriginX()) / step)
    const row = Math.round((local.y - this.getBoardGridOriginY()) / step)
    if (!this.isInsideBoard(row, column)) {
      return null
    }

    return { row, column }
  }

  // Cocos 触摸坐标先从 UI 坐标转成本节点坐标，所有棋盘操作都基于同一坐标系。
  private getLocalPositionFromTouch(event: EventTouch) {
    const uiTransform = this.node.getComponent(UITransform)
    if (!uiTransform) {
      return null
    }

    const uiLocation = event.getUILocation()
    return uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
  }

  // 使用棋盘节点的世界包围盒判断触摸是否真的落在棋盘区域内。
  private isTouchInsideBoard(x: number, y: number) {
    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (!boardTransform) {
      return false
    }

    return boardTransform.getBoundingBoxToWorld().contains(new Vec2(x, y))
  }
  // 把棋盘中的行列坐标换成节点本地坐标，所有落点、重力和合并都走这套换算。
  private getCellPosition(row: number, column: number) {
    const step = this.getStepSize()
    // 从棋盘当前内区实时计算原点，避免边框或尺寸变化后边缘列跑出外框。
    return new Vec3(this.getBoardGridOriginX() + column * step, this.getBoardGridOriginY() + row * step, 0)
  }
  // 获取新棋子的出生点，x 与列严格对齐，y 位于棋盘顶部之外。
  private getSpawnPosition(column: number) {
    const step = this.getStepSize()
    // 出生点也复用同一套网格原点，保证生成后垂直落下时不会偏列。
    return new Vec3(
      this.getBoardGridOriginX() + column * step,
      this.getBoardGridOriginY() + this.boardheight * step + this.spawnOffsetY,
      0
    )
  }

  // 单格步长 = 棋子尺寸 + 列间距，这是所有坐标换算的基础。
  private getStepSize() {
    return this.pieceSize + this.spacing
  }

  // 读取棋盘内区宽度；逻辑层优先读 BoardFill，避免继续依赖具体边框画法。
  private getBoardInnerWidth() {
    const fillTransform = this.node.getChildByName('board')?.getChildByName('BoardFill')?.getComponent(UITransform)
    if (fillTransform) {
      return fillTransform.width
    }

    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (boardTransform) {
      return boardTransform.width - 40
    }

    return this.getStepSize() * this.boardwidth
  }

  // 读取棋盘内区高度；逻辑层只关心有效落子区域，不关心具体边框样式。
  private getBoardInnerHeight() {
    const fillTransform = this.node.getChildByName('board')?.getChildByName('BoardFill')?.getComponent(UITransform)
    if (fillTransform) {
      return fillTransform.height
    }

    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (boardTransform) {
      return boardTransform.height - 40
    }

    return this.getStepSize() * this.boardheight
  }

  // 根据棋盘当前内区宽度计算左下角第一个格子的中心 x 坐标。
  private getBoardGridOriginX() {
    return -this.getBoardInnerWidth() / 2 + this.getStepSize() / 2
  }

  // 根据棋盘当前内区高度计算左下角第一个格子的中心 y 坐标。
  private getBoardGridOriginY() {
    return -this.getBoardInnerHeight() / 2 + this.getStepSize() / 2
  }

  // 把当前玩法状态统一推送给 UI 组件，避免逻辑层分别操作多个界面节点。
  private refreshUiState() {
    this.uiController?.renderState(this.buildUiState())
  }

  // 逻辑层只暴露一份纯数据状态给 UI 层，保证职责边界清晰。
  private buildUiState(): PlayUIState {
    const boardScore = this.getBoardScore()
    return {
      currentValue: this.currentPiece?.getValue() ?? null,
      score: boardScore + this.bonusScore,
      isGameOver: this.isGameOver,
      isPaused: this.isPaused,
      isResolving: this.isResolving,
      activeSkill: this.isBombSkillActive ? 'bomb' : this.isHammerSkillActive ? 'hammer' : this.isSwapSkillActive ? 'swap' : null
    }
  }

  // 当前分数定义为棋盘内所有已落地棋子的数字总和，不包含仍在下落中的当前棋子。
  private getBoardScore() {
    let score = 0
    for (const row of this.board) {
      for (const piece of row) {
        if (!piece) {
          continue
        }
        score += piece.getValue()
      }
    }

    return score
  }

  // 当前版本的奖励分规则集中放在这里，后面扩展倍率或不同来源时不需要到处改调用点。
  private buildMergeReward(nextValue: number, consumedCount: number, chainDepth: number): ScoreRewardEvent {
    const amount = this.calculateMergeRewardAmount(nextValue, consumedCount, chainDepth)
    return {
      source: 'merge',
      amount,
      resultValue: nextValue,
      consumedCount,
      chainDepth
    }
  }

  // 合并奖励分按“结果值 x 消除倍率”计算；消除越多，倍率越高。
  private calculateMergeRewardAmount(nextValue: number, consumedCount: number, chainDepth: number) {
    const clearMultiplier = Math.max(1, consumedCount)
    // 连锁深度先单独保留入口，当前版本不叠加倍率，后续活动或模式扩展时直接在这里继续乘即可。
    const chainMultiplier = 1 + Math.max(0, chainDepth - 1) * 0
    return Math.floor(nextValue * clearMultiplier * chainMultiplier)
  }

  // 奖励分统一走这个入口累计，方便后续增加日志、上报或临时活动加成。
  private applyScoreRewards(rewards: ScoreRewardEvent[]) {
    if (rewards.length === 0) {
      return
    }

    for (const reward of rewards) {
      this.bonusScore += reward.amount
    }
    this.refreshUiState()
  }

  // UI 层按钮点击后只通过这个入口切换暂停，真正的状态变化仍由逻辑层维护。
  private togglePauseFromUi() {
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

  // UI 层第三技能按钮通过这个入口切换交换技能，技能态只冻结下落，不打开暂停弹窗。
  private toggleSwapSkillFromUi() {
    if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isHammerSkillActive || this.isBombSkillActive) {
      return
    }

    if (this.isSwapSkillActive) {
      void this.cancelActiveSkillMode()
      return
    }

    this.isFastDropping = false
    this.trailTimer = 0
    this.isSwapSkillActive = true
    this.refreshUiState()
  }

  // UI 层第二技能按钮通过这个入口切换锤子技能，技能态只等待点选棋子。
  private toggleHammerSkillFromUi() {
    if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isSwapSkillActive || this.isBombSkillActive) {
      return
    }

    if (this.isHammerSkillActive) {
      void this.cancelActiveSkillMode()
      return
    }

    this.isFastDropping = false
    this.trailTimer = 0
    this.isHammerSkillActive = true
    this.refreshUiState()
  }

  // UI 层第一个技能按钮通过这个入口切换炸弹技能，等待玩家点选爆炸中心。
  private toggleBombSkillFromUi() {
    if (this.isResolving || this.isGameOver || this.isPaused || !this.currentPiece || this.isSwapSkillActive || this.isHammerSkillActive) {
      return
    }

    if (this.isBombSkillActive) {
      void this.cancelActiveSkillMode()
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
    this.clearTransientFx()
    this.refreshUiState()
  }
  // 重新开始游戏并清空棋盘
  private async restartGame() {
    if (this.isResolving) {
      return
    }

    for (let row = 0; row < this.boardheight; row++) {
      for (let column = 0; column < this.boardwidth; column++) {
        this.board[row][column]?.node.destroy()
      }
    }

    if (this.currentPiece) {
      this.currentPiece.node.destroy()
      this.currentPiece = null
    }

    this.clearTransientFx()
    this.isGameOver = false
    this.isFastDropping = false
    this.isResolving = false
    this.isPaused = false
    this.isSwapSkillActive = false
    this.isHammerSkillActive = false
    this.isBombSkillActive = false
    this.swapDragState = null
    this.resetBoard()
    this.spawnPiece()
  }
}
