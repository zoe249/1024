import {
  _decorator,
  Button,
  Color,
  Component,
  EventTouch,
  Graphics,
  instantiate,
  Label,
  Node,
  Prefab,
  Sprite,
  tween,
  Tween,
  UITransform,
  UIOpacity,
  Vec3
} from 'cc'
import { PieceController } from './PieceController'

const { ccclass, property } = _decorator

type BoardCell = PieceController | null

type CellPosition = {
  row: number
  column: number
}

type MergeGroup = {
  value: number
  anchor: PieceController
  anchorPos: CellPosition
  members: PieceController[]
}

type DirectedMergeResult = {
  anchor: PieceController | null
  changed: boolean
}

const MAX_ACTIVE_FX = 18
const BOARD_BORDER_WIDTH = 20
// Match the board inner corner radius with the piece corner radius.
const BOARD_INNER_RADIUS = 8
// Draw the board entirely in code and keep the fill and border on one graphics layer.
const BOARD_FRAME_COLOR = new Color(255, 215, 0, 255)
const BOARD_FILL_COLOR = new Color(255, 175, 0, 255)
// Match the outer corner to a true 20px ring so the border and fill stay seamless.
const BOARD_OUTER_RADIUS = BOARD_INNER_RADIUS + BOARD_BORDER_WIDTH
// Use softer rounded dash blocks so the separators blend into the board fill.
const BOARD_DASH_WIDTH = 4
const BOARD_DASH_LENGTH = 16
const BOARD_DASH_GAP = 12
const BOARD_DASH_INSET = 16
const BOARD_DASH_RADIUS = 2
const BOARD_DASH_COLOR = new Color(223, 146, 10, 150)

@ccclass('PlayController')
export class PlayController extends Component {
  @property({ tooltip: 'Board columns' })
  boardwidth = 5

  @property({ tooltip: 'Board rows' })
  boardheight = 7

  @property({ type: Prefab, tooltip: 'Piece prefab' })
  basePieceController: Prefab | null = null

  @property({ tooltip: 'Cell spacing' })
  spacing = 10

  @property({ tooltip: 'Bottom-left cell center X' })
  x = -260

  @property({ tooltip: 'Bottom-left cell center Y' })
  y = -390

  @property({ tooltip: 'Piece size' })
  pieceSize = 120

  @property({ tooltip: 'Normal fall speed' })
  fallSpeed = 360

  @property({ tooltip: 'Fast fall speed' })
  fastFallSpeed = 1800

  @property({ tooltip: 'Spawn offset above board' })
  spawnOffsetY = 160

  private readonly basePieceList = [2, 4, 8, 16, 32, 64, 128]
  // 浜岀淮鏁扮粍琛ㄧず浜斿垪涓冭鐨勬鐩橈紝绌轰綅涓?null
  private board: BoardCell[][] = []
  private currentPiece: PieceController | null = null
  private currentColumn = 0
  private isFastDropping = false
  private isGameOver = false
  private isResolving = false
  private isPaused = false
  private statusLabel: Label | null = null
  private pauseButtonLabel: Label | null = null
  private pauseOverlay: Node | null = null
  private pauseOverlayTitle: Label | null = null
  private pauseOverlayHint: Label | null = null
  private trailTimer = 0
  private activeFx = new Set<Node>()
  // 先初始化棋盘/背景/状态提示与输入
  onLoad() {
    this.resetBoard()
    this.fitBackgroundToScreen()
    this.ensureBoardDecorations()
    this.ensureStatusLabel()
    this.ensurePauseButton()
    this.ensurePauseOverlay()
    this.bindInput()
  }
  // Scene 初始后再生成第一颗棋子
  start() {
    this.spawnPiece()
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this)
    this.node.getChildByName('PauseButton')?.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
  }

  // 姣忓抚鏇存柊锛氳绠楄惤鐐广€佺Щ鍔ㄥ綋鍓嶆瀛愩€佽Е鍙戣惤鍦伴€昏緫
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

  // 缁戝畾鍏ㄥ眬瑙︽懜浜嬩欢锛岀敤浜庡揩閫熶笅钀戒笌鍒楅€夋嫨
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
      this.refreshStatus()
    }
  }

  // 瑙︽懜鎶捣鏃跺仠姝㈠姞閫燂紙鐩墠閫昏緫浠呴噸缃揩钀芥爣璁帮級
  private handleTouchEnd() {
    if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
      return
    }
  }

  // 閲嶇疆妫嬬洏鏁版嵁骞堕粯璁ゆ媺鍒颁腑闂村垪
  private resetBoard() {
    this.board = Array.from({ length: this.boardheight }, () =>
      Array.from({ length: this.boardwidth }, () => null)
    )
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
      // Keep the prefab visuals in sync with the gameplay cell size.
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
    this.refreshStatus()
  }

  // 妫嬪瓙钀藉湴锛氬啓鍏ユ鐩樸€佸紑濮嬫秷闄ら摼
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
    this.refreshStatus()

    const directedResult = await this.resolveLandingChain(landedPiece)
    await this.settleBoard(directedResult.anchor)

    this.isResolving = false
    this.refreshStatus()
    if (this.isBoardFull()) {
      this.endGame()
      return
    }

    this.spawnPiece()
  }

  // 閫愯疆搴旂敤閲嶅姏涓庡悎骞讹紝鐩村埌妫嬬洏绋冲畾
  private async settleBoard(preferredAnchor: PieceController | null) {
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

      await this.playMergeGroups(groups)
      preferredAnchor = null
    }
  }

  // 鎺㈡祴褰撳墠钀界偣闄勮繎鏄惁鑳藉舰鎴愯繛閿佸悎骞讹紝浼樺厛缁х画鍚戜笂婊氬姩
  private async resolveLandingChain(anchor: PieceController): Promise<DirectedMergeResult> {
    let currentAnchor: PieceController | null = anchor
    let changed = false

    while (currentAnchor) {
      const mergeResult = await this.mergeLandingComponent(currentAnchor)
      if (mergeResult.anchor) {
        currentAnchor = mergeResult.anchor
        changed = true
        continue
      }

      break
    }

    return { anchor: currentAnchor, changed }
  }
  // 扫描全盘获取所有可合并组
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

  // 骞垮害浼樺厛鎼滅储杩為€氬潡
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
  // 按照规则选出连通块的锚点
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
  // 统一播放所有合并动画
  private async playMergeGroups(groups: MergeGroup[]) {
    const animations: Promise<void>[] = []

    for (const group of groups) {
      const anchorPosition = this.getCellPosition(group.anchorPos.row, group.anchorPos.column)
      const consumed = group.members.filter(piece => piece !== group.anchor)
      const nextValue = group.value * Math.pow(2, consumed.length)

      for (const piece of consumed) {
        const piecePos = this.findPiece(piece)
        if (piecePos) {
          this.board[piecePos.row][piecePos.column] = null
        }
      }

      animations.push(this.animateMergeGroup(group.anchor, anchorPosition, consumed, nextValue))
    }

    await Promise.all(animations)
  }

  // 鍙洿缁曡惤鐐规娴嬭繛閫氬潡锛屽苟鎶婂彲鍚堝苟鎴愬憳鍚搁檮鍒拌閿氱偣
  private async mergeLandingComponent(anchorPiece: PieceController): Promise<DirectedMergeResult> {
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
      this.board[pos.row][pos.column] = null
    }

    await this.animateDirectedMerge(
      mergeAnchor,
      this.getCellPosition(mergeAnchorPos.row, mergeAnchorPos.column),
      consumed,
      mergeAnchor.getValue() * Math.pow(2, consumed.length)
    )
    await this.applyGravityColumns([...affectedColumns])
    return { anchor: mergeAnchor, changed: true }
  }

  // 閫夋嫨钀界偣鍒楀唴鏈€闈犱笂鐨勫渾蹇冿紝鑻ユ棤鍒欏洖閫€鍒版暣缁勬渶杩戠殑鏍煎瓙
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

  // 鍗曟潯鍚堝苟缁勭殑鍔ㄧ敾灏佽锛屽鐢?directed merge
  private async animateMergeGroup(
    anchor: PieceController,
    anchorPosition: Vec3,
    consumed: PieceController[],
    nextValue: number
  ) {
    await this.animateDirectedMerge(anchor, anchorPosition, consumed, nextValue)
  }

  // 鍏ㄧ洏涓嬭惤锛氭墍鏈夊垪鏀剁缉鍒版渶搴曢儴
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
  // 缓动节点移动到目标格子
  private animateMove(node: Node, position: Vec3, duration: number) {
    Tween.stopAllByTarget(node)
    return new Promise<void>(resolve => {
      tween(node)
        .to(Math.min(duration, 0.09), { position }, { easing: 'quadOut' })
        .call(resolve)
        .start()
    })
  }
  // 吸附并回弹合成特效
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
        .call(resolve)
        .start()
    })
  }
  // 控制下落拖尾的生成节奏
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
  // 根据速度生成拖尾粒子
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

  // 绠€鍗曠殑鍚堟垚闂厜
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
  // 合成时的爆裂粒子
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

  // 涓存椂绮掑瓙鑺傜偣澶嶇敤妫嬪瓙璐村浘
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

  // 閬垮厤鐗规晥鑺傜偣杩囧
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

  // 鏌ユ壘涓€涓瀛愬綋鍓嶅湪妫嬬洏涓殑浣嶇疆
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

  // 鍒ゆ柇鍧愭爣鏄惁鍦ㄦ鐩樺唴
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

  // 鏍规嵁鐐瑰嚮浣嶇疆鎹㈢畻鍑鸿惤鍦ㄧ鍑犲垪
  private getColumnFromTouch(event: EventTouch) {
    const uiTransform = this.node.getComponent(UITransform)
    if (!uiTransform) {
      return -1
    }

    const uiLocation = event.getUILocation()
    const local = uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
    const step = this.getStepSize()
    // Derive the grid origin from the live board size so touch columns stay aligned after board style changes.
    const column = Math.round((local.x - this.getBoardGridOriginX()) / step)
    return Math.max(0, Math.min(this.boardwidth - 1, column))
  }
  // 行列转屏幕坐标
  private getCellPosition(row: number, column: number) {
    const step = this.getStepSize()
    // Always place pieces from the current board inner rect so edge columns do not drift outside the frame.
    return new Vec3(this.getBoardGridOriginX() + column * step, this.getBoardGridOriginY() + row * step, 0)
  }
  // 获取生成点坐标
  private getSpawnPosition(column: number) {
    const step = this.getStepSize()
    // Reuse the same dynamic grid origin for spawn points so falling pieces line up with the board columns.
    return new Vec3(
      this.getBoardGridOriginX() + column * step,
      this.getBoardGridOriginY() + this.boardheight * step + this.spawnOffsetY,
      0
    )
  }

  // 鏍煎瓙涓庨棿璺濇€诲拰
  private getStepSize() {
    return this.pieceSize + this.spacing
  }

  // Keep the board visuals aligned with the gameplay grid.
  private ensureBoardDecorations() {
    const boardNode = this.node.getChildByName('board')
    if (!boardNode) {
      return
    }

    const innerWidth = this.getBoardInnerWidth()
    const innerHeight = this.getBoardInnerHeight()
    const boardSprite = boardNode.getComponent(Sprite)
    if (boardSprite) {
      boardSprite.enabled = false
    }
    const boardGraphics = boardNode.getComponent(Graphics)
    if (boardGraphics) {
      boardGraphics.clear()
      boardGraphics.enabled = false
    }

    let boardFrame = boardNode.getChildByName('BoardFrame')
    if (!boardFrame) {
      boardFrame = new Node('BoardFrame')
      boardFrame.setParent(boardNode)
    }
    boardFrame.setPosition(0, 0, 0)
    boardFrame.setSiblingIndex(0)

    const frameTransform = boardFrame.getComponent(UITransform) ?? boardFrame.addComponent(UITransform)
    frameTransform.setContentSize(
      innerWidth + BOARD_BORDER_WIDTH * 2,
      innerHeight + BOARD_BORDER_WIDTH * 2
    )

    const frameGraphics = boardFrame.getComponent(Graphics) ?? boardFrame.addComponent(Graphics)
    frameGraphics.enabled = true
    frameGraphics.clear()
    // Fill the entire outer frame first so there is no seam between border and board background.
    frameGraphics.fillColor = BOARD_FRAME_COLOR
    frameGraphics.roundRect(
      -innerWidth / 2 - BOARD_BORDER_WIDTH,
      -innerHeight / 2 - BOARD_BORDER_WIDTH,
      innerWidth + BOARD_BORDER_WIDTH * 2,
      innerHeight + BOARD_BORDER_WIDTH * 2,
      BOARD_OUTER_RADIUS
    )
    frameGraphics.fill()
    // Cover the center with the board color so the visible result is a seamless rounded ring.
    frameGraphics.fillColor = BOARD_FILL_COLOR
    frameGraphics.roundRect(
      -innerWidth / 2,
      -innerHeight / 2,
      innerWidth,
      innerHeight,
      BOARD_INNER_RADIUS
    )
    frameGraphics.fill()

    const boardFill = boardNode.getChildByName('BoardFill')
    if (boardFill) {
      boardFill.setPosition(0, 0, 0)
      boardFill.setSiblingIndex(1)
      const fillTransform = boardFill.getComponent(UITransform)
      if (fillTransform) {
        fillTransform.setContentSize(innerWidth, innerHeight)
      }
      const fillSprite = boardFill.getComponent(Sprite)
      if (fillSprite) {
        fillSprite.enabled = false
      }
      const fillGraphics = boardFill.getComponent(Graphics) ?? boardFill.addComponent(Graphics)
      fillGraphics.enabled = false
      fillGraphics.clear()
    }

    for (let column = 0; column < this.boardwidth; column++) {
      const columnNode = boardNode.getChildByName(`column${column + 1}`)
      if (!columnNode) {
        continue
      }

      columnNode.setPosition(this.getBoardColumnCenterX(column), 0, 0)
      const columnTransform = columnNode.getComponent(UITransform)
      if (columnTransform) {
        columnTransform.setContentSize(innerWidth / this.boardwidth, innerHeight)
      }

      const columnSprite = columnNode.getComponent(Sprite)
      if (columnSprite) {
        columnSprite.enabled = false
      }
    }

    let dashedLines = boardNode.getChildByName('BoardDashedLines')
    if (!dashedLines) {
      dashedLines = new Node('BoardDashedLines')
      dashedLines.setParent(boardNode)
    }
    dashedLines.setPosition(0, 0, 0)

    let dashedTransform = dashedLines.getComponent(UITransform)
    if (!dashedTransform) {
      dashedTransform = dashedLines.addComponent(UITransform)
    }
    dashedTransform.setContentSize(innerWidth, innerHeight)

    let graphics = dashedLines.getComponent(Graphics)
    if (!graphics) {
      graphics = dashedLines.addComponent(Graphics)
    }

    graphics.clear()
    graphics.fillColor = BOARD_DASH_COLOR

    const top = innerHeight / 2 - BOARD_DASH_INSET
    const bottom = -innerHeight / 2 + BOARD_DASH_INSET
    for (let column = 0; column < this.boardwidth - 1; column++) {
      const x = this.getBoardSeparatorX(column)
      for (let y = bottom; y < top; y += BOARD_DASH_LENGTH + BOARD_DASH_GAP) {
        const segmentEnd = Math.min(y + BOARD_DASH_LENGTH, top)
        graphics.roundRect(
          x - BOARD_DASH_WIDTH / 2,
          y,
          BOARD_DASH_WIDTH,
          Math.max(0, segmentEnd - y),
          BOARD_DASH_RADIUS
        )
      }
    }
    graphics.fill()
  }

  private getBoardInnerWidth() {
    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (boardTransform) {
      return boardTransform.width - BOARD_BORDER_WIDTH * 2
    }

    return this.getStepSize() * this.boardwidth
  }

  private getBoardInnerHeight() {
    const boardTransform = this.node.getChildByName('board')?.getComponent(UITransform)
    if (boardTransform) {
      return boardTransform.height - BOARD_BORDER_WIDTH * 2
    }

    return this.getStepSize() * this.boardheight
  }

  private getBoardColumnCenterX(column: number) {
    const columnWidth = this.getBoardInnerWidth() / this.boardwidth
    return -this.getBoardInnerWidth() / 2 + columnWidth * (column + 0.5)
  }

  private getBoardSeparatorX(column: number) {
    const columnWidth = this.getBoardInnerWidth() / this.boardwidth
    return -this.getBoardInnerWidth() / 2 + columnWidth * (column + 1)
  }

  // Keep the logical grid origin locked to the current board inner width.
  private getBoardGridOriginX() {
    return -this.getBoardInnerWidth() / 2 + this.getStepSize() / 2
  }

  // Keep the logical grid origin locked to the current board inner height.
  private getBoardGridOriginY() {
    return -this.getBoardInnerHeight() / 2 + this.getStepSize() / 2
  }

  // 背景铺满屏幕
  private fitBackgroundToScreen() {
    const selfTransform = this.node.getComponent(UITransform)
    const parentTransform = this.node.parent?.getComponent(UITransform) ?? null
    if (!selfTransform || !parentTransform) {
      return
    }

    selfTransform.setContentSize(parentTransform.width, parentTransform.height)

    const bgSprite = this.node.getComponent(Sprite)
    if (bgSprite) {
      bgSprite.sizeMode = Sprite.SizeMode.CUSTOM
    }
  }
  // 确保状态提示节点存在
  private ensureStatusLabel() {
    const existing = this.node.getChildByName('StatusLabel')
    if (existing) {
      this.statusLabel = existing.getComponent(Label)
      return
    }

    const labelNode = new Node('StatusLabel')
    labelNode.setParent(this.node)
    labelNode.setPosition(0, 565, 0)

    const transform = labelNode.addComponent(UITransform)
    transform.setContentSize(680, 80)

    const label = labelNode.addComponent(Label)
    label.fontSize = 28
    label.lineHeight = 34
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.color = new Color(250, 246, 242, 255)

    this.statusLabel = label
    this.refreshStatus()
  }

  // 淇濆簳鍒涘缓鏆傚仠鎸夐挳
  private ensurePauseButton() {
    const existing = this.node.getChildByName('PauseButton')
    if (existing) {
      this.pauseButtonLabel = existing.getChildByName('Label')?.getComponent(Label) ?? null
      existing.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
      existing.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
      this.refreshPauseButton()
      return
    }

    const buttonNode = new Node('PauseButton')
    buttonNode.setParent(this.node)
    buttonNode.setPosition(280, 575, 0)

    const transform = buttonNode.addComponent(UITransform)
    transform.setContentSize(140, 56)
    buttonNode.addComponent(Button)

    const bg = buttonNode.addComponent(Sprite)
    bg.color = new Color(37, 55, 80, 235)

    const labelNode = new Node('Label')
    labelNode.setParent(buttonNode)
    labelNode.setPosition(0, 0, 0)
    const labelTransform = labelNode.addComponent(UITransform)
    labelTransform.setContentSize(140, 56)

    const label = labelNode.addComponent(Label)
    label.string = 'Pause'
    label.fontSize = 26
    label.lineHeight = 30
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.color = new Color(245, 250, 255, 255)

    buttonNode.on(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
    this.pauseButtonLabel = label
    this.refreshPauseButton()
  }

  // 淇濆簳鍒涘缓鏆傚仠閬僵
  private ensurePauseOverlay() {
    const existing = this.node.getChildByName('PauseOverlay')
    if (existing) {
      this.pauseOverlay = existing
      this.pauseOverlayTitle = existing.getChildByName('Title')?.getComponent(Label) ?? null
      this.pauseOverlayHint = existing.getChildByName('Hint')?.getComponent(Label) ?? null
      this.refreshPauseOverlay()
      return
    }

    const overlay = new Node('PauseOverlay')
    overlay.setParent(this.node)
    overlay.setSiblingIndex(999)
    overlay.active = false
    this.pauseOverlay = overlay

    const overlayTransform = overlay.addComponent(UITransform)
    overlayTransform.setContentSize(750, 1334)

    const overlayBg = overlay.addComponent(Sprite)
    overlayBg.color = new Color(10, 16, 24, 150)

    const titleNode = new Node('Title')
    titleNode.setParent(overlay)
    titleNode.setPosition(0, 70, 0)
    const titleTransform = titleNode.addComponent(UITransform)
    titleTransform.setContentSize(420, 80)
    const titleLabel = titleNode.addComponent(Label)
    titleLabel.string = 'Paused'
    titleLabel.fontSize = 54
    titleLabel.lineHeight = 60
    titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER
    titleLabel.color = new Color(250, 252, 255, 255)
    this.pauseOverlayTitle = titleLabel

    const hintNode = new Node('Hint')
    hintNode.setParent(overlay)
    hintNode.setPosition(0, -5, 0)
    const hintTransform = hintNode.addComponent(UITransform)
    hintTransform.setContentSize(500, 60)
    const hintLabel = hintNode.addComponent(Label)
    hintLabel.string = 'Tap the top-right button to resume'
    hintLabel.fontSize = 24
    hintLabel.lineHeight = 30
    hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER
    hintLabel.color = new Color(210, 220, 235, 255)
    this.pauseOverlayHint = hintLabel

    this.refreshPauseOverlay()
  }

  // 鏆傚仠鎸夐挳浜嬩欢
  private onPauseButtonTap(event: EventTouch) {
    event.propagationStopped = true
    if (this.isResolving || this.isGameOver) {
      return
    }

    this.isPaused = !this.isPaused
    if (!this.isPaused) {
      this.trailTimer = 0
    }
    this.refreshStatus()
    this.refreshPauseButton()
    this.refreshPauseOverlay()
  }
  // 更新状态栏文字
  private refreshStatus() {
    if (!this.statusLabel) {
      return
    }

    if (this.isGameOver) {
      this.statusLabel.string = 'Game Over - Tap to restart'
      return
    }

    if (this.isResolving) {
      this.statusLabel.string = 'Resolving...'
      return
    }

    if (this.isPaused) {
      this.statusLabel.string = 'Paused'
      return
    }

    const value = this.currentPiece?.getValue()
    if (!value) {
      this.statusLabel.string = ''
      return
    }

    this.statusLabel.string = `Current ${value} - Drag to choose column, tap to fast drop until landing`
  }

  // 鏍规嵁鏆傚仠鐘舵€佽皟鏁存寜閽枃瀛?棰滆壊
  private refreshPauseButton() {
    if (!this.pauseButtonLabel) {
      return
    }

    this.pauseButtonLabel.string = this.isPaused ? 'Resume' : 'Pause'
    const bg = this.pauseButtonLabel.node.parent?.getComponent(Sprite)
    if (bg) {
      bg.color = this.isPaused ? new Color(73, 111, 83, 240) : new Color(37, 55, 80, 235)
    }
  }

  // 鎺у埗閬僵鐨勬樉闅愪笌娣″叆
  private refreshPauseOverlay() {
    if (!this.pauseOverlay) {
      return
    }

    const opacity = this.pauseOverlay.getComponent(UIOpacity) ?? this.pauseOverlay.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)

    if (this.isPaused) {
      this.pauseOverlay.active = true
      opacity.opacity = 0
      tween(opacity).to(0.12, { opacity: 255 }).start()
    } else {
      opacity.opacity = 0
      this.pauseOverlay.active = false
    }

    if (this.pauseOverlayTitle) {
      this.pauseOverlayTitle.string = 'Paused'
    }

    if (this.pauseOverlayHint) {
      this.pauseOverlayHint.string = 'Tap the top-right button to resume'
    }
  }
  // 进入游戏结束流程
  private endGame() {
    this.isGameOver = true
    this.currentPiece = null
    this.clearTransientFx()
    this.refreshStatus()
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
    this.refreshStatus()
    this.refreshPauseButton()
    this.refreshPauseOverlay()
  }
}
