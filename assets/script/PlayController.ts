import {
  _decorator,
  Button,
  Color,
  Component,
  EventTouch,
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

  onLoad() {
    this.resetBoard()
    this.fitBackgroundToScreen()
    this.ensureStatusLabel()
    this.ensurePauseButton()
    this.ensurePauseOverlay()
    this.bindInput()
  }

  start() {
    this.spawnPiece()
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this)
    this.node.getChildByName('PauseButton')?.off(Node.EventType.TOUCH_END, this.onPauseButtonTap, this)
  }

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

  private bindInput() {
    this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this)
    this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this)
    this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this)
  }

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

  private handleTouchEnd() {
    if (!this.currentPiece || this.isGameOver || this.isResolving || this.isPaused) {
      return
    }
  }

  private resetBoard() {
    this.board = Array.from({ length: this.boardheight }, () =>
      Array.from({ length: this.boardwidth }, () => null)
    )
    this.currentColumn = Math.floor(this.boardwidth / 2)
  }

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

  private async animateMergeGroup(
    anchor: PieceController,
    anchorPosition: Vec3,
    consumed: PieceController[],
    nextValue: number
  ) {
    await this.animateDirectedMerge(anchor, anchorPosition, consumed, nextValue)
  }

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

  private animateMove(node: Node, position: Vec3, duration: number) {
    Tween.stopAllByTarget(node)
    return new Promise<void>(resolve => {
      tween(node)
        .to(Math.min(duration, 0.09), { position }, { easing: 'quadOut' })
        .call(resolve)
        .start()
    })
  }

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

  private canSpawnFx(count: number) {
    return this.activeFx.size + count <= MAX_ACTIVE_FX
  }

  private destroyFxNode(node: Node) {
    this.activeFx.delete(node)
    node.destroy()
  }

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

  private isInsideBoard(row: number, column: number) {
    return row >= 0 && row < this.boardheight && column >= 0 && column < this.boardwidth
  }

  private isBoardFull() {
    for (let column = 0; column < this.boardwidth; column++) {
      if (this.getDropRow(column) >= 0) {
        return false
      }
    }
    return true
  }

  private getDropRow(column: number) {
    for (let row = 0; row < this.boardheight; row++) {
      if (!this.board[row][column]) {
        return row
      }
    }
    return -1
  }

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

  private getColumnFromTouch(event: EventTouch) {
    const uiTransform = this.node.getComponent(UITransform)
    if (!uiTransform) {
      return -1
    }

    const uiLocation = event.getUILocation()
    const local = uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
    const step = this.getStepSize()
    const column = Math.round((local.x - this.x) / step)
    return Math.max(0, Math.min(this.boardwidth - 1, column))
  }

  private getCellPosition(row: number, column: number) {
    const step = this.getStepSize()
    return new Vec3(this.x + column * step, this.y + row * step, 0)
  }

  private getSpawnPosition(column: number) {
    const step = this.getStepSize()
    return new Vec3(this.x + column * step, this.y + this.boardheight * step + this.spawnOffsetY, 0)
  }

  private getStepSize() {
    return this.pieceSize + this.spacing
  }

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

  private endGame() {
    this.isGameOver = true
    this.currentPiece = null
    this.clearTransientFx()
    this.refreshStatus()
  }

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
