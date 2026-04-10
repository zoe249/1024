import { _decorator, Color, Component, EventTouch, instantiate, Node, Prefab, Sprite, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc'
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
      onPauseTap: () => this.togglePauseFromUi()
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
    this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this)
    this.uiController = null
  }

  // 每帧更新当前下落棋子的目标位置，并在接近落点时触发落地结算。
  update(dt: number) {
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
    this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this)
  }
  // 触摸按下时确定列并开启快速下落
  private handleTouchStart(event: EventTouch) {
    if (this.isGameOver) {
      void this.restartGame()
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

  // 触摸抬起时结束本次按住状态；当前逻辑中只需要停止继续加速即可。
  private handleTouchEnd() {
    if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
      return
    }

    // 只有在手指仍按住时才保持快速下落，抬起或取消触摸后要立即恢复正常速度。
    // this.isFastDropping = false
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
      isResolving: this.isResolving
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

    this.isPaused = !this.isPaused
    if (!this.isPaused) {
      this.trailTimer = 0
    }
    this.refreshUiState()
  }
  // 进入游戏结束流程
  private endGame() {
    this.isGameOver = true
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
    this.resetBoard()
    this.spawnPiece()
  }
}
